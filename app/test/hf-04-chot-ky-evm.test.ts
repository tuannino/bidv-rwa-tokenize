import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Account } from 'viem';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import type { ISigner } from '@/lib/signer';

/**
 * HF-04 trên nút Hardhat thật: RPC đọc log đi sau RPC ghi (sự cố OP-05 bước 13.7 ngày 21/10/2026, vault
 * thành CONFLICT dù `PeriodClosed` khớp số). Máy chủ chen giữa chuyển mọi lời gọi tới nút, riêng
 * `eth_getLogs` trả rỗng như RPC chưa thấy khối mới. `findVaultPeriodClose` có mã giao dịch gợi ý thì
 * phải đọc được sự kiện từ biên nhận, và chỉ nhận đúng mã kỳ.
 */
const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const signer: ISigner = {
  kind: 'server',
  async getAddress() { return ADMIN; },
  async getAccount() { return { address: ADMIN, type: 'json-rpc' } as Account; },
};

let server: Server;
const saved = { RPC_HARDHAT: process.env.RPC_HARDHAT };

describe.skipIf(!HARDHAT_RPC)('HF-04: tra chốt kỳ vault qua biên nhận khi quét log chưa thấy', () => {
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        const parsed = JSON.parse(body);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const out = await Promise.all(
          list.map(async (call: { id: unknown; method: string }) => {
            if (call.method === 'eth_getLogs') return { jsonrpc: '2.0', id: call.id, result: [] };
            const upstream = await fetch(HARDHAT_RPC!, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(call),
            });
            return upstream.json();
          }),
        );
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(Array.isArray(parsed) ? out : out[0]));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    process.env.RPC_HARDHAT = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resetServerEnvCache();
    resetChainRegistryCache();
  });

  afterAll(async () => {
    if (saved.RPC_HARDHAT === undefined) delete process.env.RPC_HARDHAT;
    else process.env.RPC_HARDHAT = saved.RPC_HARDHAT;
    resetServerEnvCache();
    resetChainRegistryCache();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('ca 3: không gợi ý thì null (log trễ); gợi ý đúng giao dịch thì ra số thật; sai mã kỳ thì null', async () => {
    const ledger = createEvmLedger('hardhat-local', signer);
    const vault = await ledger.vaultStatus();
    const ref = vault!.lastPeriodRef + 1n;
    const tx = await ledger.closeVaultPeriod(ref, 1_234n);
    expect((await ledger.waitReceipt(tx.txHash)).status).toBe('CONFIRMED');

    expect(await ledger.findVaultPeriodClose(ref)).toBeNull();
    const found = await ledger.findVaultPeriodClose(ref, tx.txHash);
    expect(found).toMatchObject({ periodRef: ref, distributedPrev: 1_234n, txHash: tx.txHash });
    expect(await ledger.findVaultPeriodClose(ref + 1n, tx.txHash)).toBeNull();
  });
});
