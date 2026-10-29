import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encodeFunctionData, keccak256, parseAbi, toBytes, type Account } from 'viem';
import { getContractAddress } from '@bidv/shared';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { configRefOf, setFireblocksConfigForTest } from '@/lib/custody/fireblocks-config';
import { setFireblocksClientForTest } from '@/lib/custody/fireblocks-client';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';
import { resetSignerCache, type ISigner } from '@/lib/signer';
import { getStore, getTokenRequestStore, resetMemoryStore, resetStoreCache } from '@/lib/store';
import { FakeFireblocks, type Broadcaster } from './helpers/fake-fireblocks';

/**
 * IN-04 ca 12 tới 14 trên nút Hardhat THẬT (`TEST_HARDHAT_RPC`, nút vừa dựng lại bằng
 * `scripts/evm-local.sh reset`). Khách Fireblocks giả "phát lên nút" bằng `eth_sendTransaction` từ vault
 * giả là tài khoản Hardhat #7 (nút mở khoá sẵn, không có khoá nào trong test); tài khoản #0 (quản trị
 * khi triển khai) cấp vai cho vault. Mọi đọc, mô phỏng, biên nhận đi qua adapter EVM thật.
 */

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const CHAIN = 'hardhat-local' as const;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
/** Vault Fireblocks giả: tài khoản Hardhat #7. */
const VAULT = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955';
const SPV = getContractAddress(CHAIN, 'SpvPaymentVault');
const TOKEN = getContractAddress(CHAIN, 'ProjectToken');
const CONFIG = {
  baseUrl: 'https://fireblocks.test',
  apiKey: 'api-key-thu',
  privateKeyPem: 'không dùng: khách giả',
  vaultId: '7',
  vaultAddress: VAULT,
  configRef: configRefOf('https://fireblocks.test', 'api-key-thu'),
};

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(HARDHAT_RPC!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? `RPC ${method} lỗi.`);
  return body.result as T;
}

/** "Phát lên nút": gửi đúng `to`, `data` từ địa chỉ vault giả; Hardhat tự đào khối. */
const broadcastFromVault: Broadcaster = (call) =>
  rpc<string>('eth_sendTransaction', [{ from: VAULT, to: call.contract, data: call.data }]);

function unlockedSigner(address: `0x${string}`): ISigner {
  const account: Account = { address, type: 'json-rpc' };
  return {
    kind: 'server',
    async getAddress() {
      return account.address;
    },
    async getAccount() {
      return account;
    },
  };
}

function actAs(role: 'TELLER' | 'CONTROLLER', actor: string): void {
  process.env.DEMO_ROLE = role;
  process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

async function wait(ledger: ILedgerPort, tx: TxResult) {
  const receipt = await ledger.waitReceipt(tx.txHash, 30_000);
  expect(receipt.status).toBe('CONFIRMED');
}

/** Chỉ lời gọi quản trị cấp vai, ngoài ABI dùng chung của ứng dụng (ứng dụng không cấp vai). */
const GRANT_ROLE_ABI = parseAbi(['function grantRole(bytes32 role, address account)']);

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('IN-04 ca 12 tới 14: Fireblocks giả trên nút Hardhat', () => {
  const keys = [
    'RPC_HARDHAT',
    'SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL',
    'USE_MOCK_DB',
    'DEMO_ROLE',
    'DEMO_ACTOR',
    'FIREBLOCKS_HASH_WAIT_MS',
  ] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let admin: ILedgerPort;
  let fb: FakeFireblocks;
  let service: typeof import('@/lib/bank/token-request.service');
  let custody: typeof import('@/lib/bank/custody.service');

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    process.env.FIREBLOCKS_HASH_WAIT_MS = '1';
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetMemoryStore();
    resetStoreCache();
    admin = createEvmLedger(CHAIN, unlockedSigner(ADMIN));
    await wait(admin, await admin.whitelist(SPV));
    service = await import('@/lib/bank/token-request.service');
    custody = await import('@/lib/bank/custody.service');
    setFireblocksConfigForTest({ config: CONFIG, chainAssets: { [CHAIN]: 'ETH_TEST5' } });
    actAs('TELLER', 'GDV001');
    expect((await custody.setFireblocksCustody({ enabled: true })).ok).toBe(true);
  });

  beforeEach(() => {
    fb = new FakeFireblocks(broadcastFromVault);
    setFireblocksClientForTest(fb);
  });

  afterAll(() => {
    setFireblocksClientForTest(null);
    setFireblocksConfigForTest(null);
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetStoreCache();
  });

  async function draft(input: Record<string, unknown>): Promise<string> {
    actAs('TELLER', 'GDV001');
    const created = await service.createTokenRequest({ chain: CHAIN, tokenSymbol: 'WPT', reason: 'IN-04 Hardhat', ...input });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) throw new Error(created.error);
    return created.data.request.id;
  }

  const approve = (requestId: string) => {
    actAs('CONTROLLER', 'KSV001');
    return service.approveTokenRequest({ chain: CHAIN, requestId });
  };

  const txnOf = async (txHash: string) =>
    (await getStore().listTxns({ chain: CHAIN, limit: 500 })).filter((row) => row.txHash === txHash);

  async function grantVaultRoles() {
    for (const role of ['MINTER_ROLE', 'AGENT_ROLE']) {
      const data = encodeFunctionData({ abi: GRANT_ROLE_ABI, functionName: 'grantRole', args: [keccak256(toBytes(role)), VAULT] });
      const txHash = await rpc<string>('eth_sendTransaction', [{ from: ADMIN, to: TOKEN, data }]);
      await wait(admin, { txHash, status: 'PENDING' });
    }
  }

  it('ca 12: vault chưa có vai thì chặn, PENDING; cấp vai rồi duyệt Mint: COMPLETED, người gửi trên chuỗi là vault', async () => {
    const id = await draft({ type: 'MINT', wallet: SPV, amount: '1000' });
    const blocked = await approve(id);
    expect(blocked).toMatchObject({ ok: false, code: 'REQUEST_CHECK' });
    expect(!blocked.ok && blocked.error).toContain('chưa có quyền MINTER_ROLE trên ProjectToken');
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('PENDING');
    expect(fb.creates).toHaveLength(0);

    await grantVaultRoles();
    const supplyBefore = (await admin.tokenInfo()).totalSupply;
    const result = await approve(id);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    const record = (await getTokenRequestStore().findRequest(id))!;
    expect(record).toMatchObject({ status: 'COMPLETED', custody: 'FIREBLOCKS' });
    expect(record.custodyTxId).not.toBeNull();
    expect((await admin.tokenInfo()).totalSupply).toBe(supplyBefore + 1000n);
    const onChain = await rpc<{ from: string; to: string }>('eth_getTransactionByHash', [record.txHash]);
    expect(onChain.from.toLowerCase()).toBe(VAULT.toLowerCase());
    expect(onChain.to.toLowerCase()).toBe(TOKEN.toLowerCase());
    const rows = await txnOf(record.txHash!);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorAddress?.toLowerCase()).toBe(VAULT.toLowerCase());
  });

  it('ca 13: Burn "Phần chưa phân phối" qua vault: COMPLETED, số dư ví SPV giảm đúng', async () => {
    const before = await admin.balanceOf(SPV);
    const id = await draft({ type: 'BURN', burnSource: 'UNDISTRIBUTED', amount: '100' });
    const result = await approve(id);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('COMPLETED');
    expect(await admin.balanceOf(SPV)).toBe(before - 100n);
  });

  it('ca 14: khách chậm: EXECUTING, đối soát được; phát rồi đối soát: COMPLETED, phát đúng một lần, một dòng Txn của vault', async () => {
    fb.hold = true;
    const id = await draft({ type: 'MINT', wallet: SPV, amount: '10' });
    const approved = await approve(id);
    expect(approved.ok && approved.data.status).toBe('EXECUTING');
    actAs('CONTROLLER', 'KSV001');
    const detail = await service.getTokenRequestDetail({ chain: CHAIN, requestId: id });
    expect(detail.ok && detail.data.canReconcile).toBe(true);

    await fb.release();
    actAs('CONTROLLER', 'KSV001');
    const reconciled = await service.reconcileTokenRequest({ chain: CHAIN, requestId: id });
    expect(reconciled.ok && reconciled.data.status).toBe('COMPLETED');
    expect(fb.broadcasts).toBe(1);
    expect(fb.creates).toHaveLength(1);
    const record = (await getTokenRequestStore().findRequest(id))!;
    const rows = await txnOf(record.txHash!);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorAddress?.toLowerCase()).toBe(VAULT.toLowerCase());
  });
});
