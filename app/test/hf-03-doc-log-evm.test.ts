import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Account } from 'viem';
import { addressBook, CHAINS } from '@bidv/shared';
import { logsRpcUrlFor, resetChainRegistryCache, rpcUrlFor } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import type { ISigner } from '@/lib/signer';

/**
 * HF-03: đọc lịch sử vault trên Sepolia hỏng vì RPC chính (Alchemy gói miễn phí) từ chối `eth_getLogs`
 * rộng hơn 10 block (đo ngày 21/10/2026: mã -32600 "Under the Free tier plan, you can make eth_getLogs
 * requests with up to a 10 block range").
 *
 * Máy chủ JSON-RPC giả dưới đây hành xử như vậy: khoảng quét quá `MAX_RANGE` block thì trả đúng lỗi đó.
 * Không gọi mạng thật.
 */
const MAX_RANGE = 10n;
const LATEST = BigInt(addressBook.evm?.deployBlock ?? 0) + 35n;

interface RpcCall { method: string; params: unknown[] }
let server: Server;
let url = '';
const calls: RpcCall[] = [];

function answer(call: RpcCall & { id: unknown }) {
  if (call.method === 'eth_blockNumber') return { result: `0x${LATEST.toString(16)}` };
  if (call.method === 'eth_chainId') return { result: '0xaa36a7' };
  if (call.method === 'eth_getLogs') {
    const filter = call.params[0] as { fromBlock: string; toBlock: string };
    const from = BigInt(filter.fromBlock);
    const to = filter.toBlock === 'latest' ? LATEST : BigInt(filter.toBlock);
    if (to - from + 1n > MAX_RANGE) {
      return { error: { code: -32600, message: 'Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range.' } };
    }
    return { result: [] };
  }
  return { error: { code: -32601, message: `không giả lập ${call.method}` } };
}

const signer: ISigner = {
  kind: 'server',
  async getAddress() { return '0x0000000000000000000000000000000000000001'; },
  async getAccount() { return { address: '0x0000000000000000000000000000000000000001', type: 'json-rpc' } as Account; },
} as ISigner;

const saved = { RPC_EVM: process.env.RPC_EVM, RPC_EVM_LOGS: process.env.RPC_EVM_LOGS, EVM_LOG_BLOCK_CHUNK: process.env.EVM_LOG_BLOCK_CHUNK };

function setEnv(env: Partial<typeof saved>) {
  for (const key of Object.keys(saved) as Array<keyof typeof saved>) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  resetServerEnvCache();
  resetChainRegistryCache();
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const out = list.map((call) => {
        calls.push(call);
        return { jsonrpc: '2.0', id: call.id, ...answer(call) };
      });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(Array.isArray(parsed) ? out : out[0]));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  setEnv(saved);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  calls.length = 0;
});

describe('HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block', () => {
  it('ca 1: evm đọc sự kiện qua RPC_EVM_LOGS; trống thì RPC công khai mặc định, không dùng RPC_EVM', () => {
    setEnv({ RPC_EVM: 'https://rpc-co-key.example/v2/khoa', RPC_EVM_LOGS: undefined });
    expect(rpcUrlFor('evm')).toBe('https://rpc-co-key.example/v2/khoa');
    expect(logsRpcUrlFor('evm')).toBe(CHAINS.evm.defaultRpcUrl);

    setEnv({ RPC_EVM: 'https://rpc-co-key.example/v2/khoa', RPC_EVM_LOGS: 'https://rpc-log.example' });
    expect(logsRpcUrlFor('evm')).toBe('https://rpc-log.example');
    expect(logsRpcUrlFor('hardhat-local')).toBe(rpcUrlFor('hardhat-local'));
  });

  it('ca 2: lịch sử cấu hình và lịch sử chốt kỳ quét theo đoạn không vượt giới hạn của RPC', async () => {
    setEnv({ RPC_EVM: 'http://127.0.0.1:1', RPC_EVM_LOGS: url, EVM_LOG_BLOCK_CHUNK: String(MAX_RANGE) });
    const ledger = createEvmLedger('evm', signer);

    await expect(ledger.vaultConfigEvents()).resolves.toEqual([]);
    await expect(ledger.vaultPeriodCloses(10)).resolves.toEqual([]);

    const scans = calls.filter((call) => call.method === 'eth_getLogs').map((call) => call.params[0] as { fromBlock: string; toBlock: string });
    expect(scans.length).toBe(8); // 36 block, đoạn 10: 4 đoạn cho mỗi lần đọc
    expect(BigInt(scans[0]!.fromBlock)).toBe(BigInt(addressBook.evm!.deployBlock!));
    const end = (scan: { toBlock: string }) => (scan.toBlock === 'latest' ? LATEST : BigInt(scan.toBlock));
    for (const scan of scans) expect(end(scan) - BigInt(scan.fromBlock) + 1n).toBeLessThanOrEqual(MAX_RANGE);
    // đoạn cuối đọc tới `latest`: không sót block sinh ra trong lúc quét
    expect(scans.filter((scan) => scan.toBlock === 'latest').length).toBe(2);
  });

  it('ca 3: một đoạn quá giới hạn thì báo lỗi LedgerError, không trả lịch sử rỗng giả', async () => {
    setEnv({ RPC_EVM: 'http://127.0.0.1:1', RPC_EVM_LOGS: url, EVM_LOG_BLOCK_CHUNK: '50' });
    const ledger = createEvmLedger('evm', signer);
    await expect(ledger.vaultConfigEvents()).rejects.toThrow();
  });
});
