import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Account,
  type Hex,
} from 'viem';
import { hardhat } from 'viem/chains';
import { getContractAddress, profitDistributorAbi } from '@bidv/shared';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { CONFIG_KEYS, WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { LedgerError, type ILedgerPort, type TxResult } from '@/lib/ledger/ledger.port';
import { resetSignerCache, type ISigner } from '@/lib/signer';
import {
  getConfigStore,
  getDistributionStore,
  getOrderStore,
  getStore,
  resetMemoryStore,
  resetStoreCache,
} from '@/lib/store';

/**
 * SC-06 trên nút Hardhat THẬT (`TEST_HARDHAT_RPC`, dựng bằng `bash scripts/evm-local.sh reset`).
 *
 * Ca 12: adapter EVM khớp `ProfitDistributor` (mở kỳ, tra kỳ, chia lô, đã trả, đóng kỳ, sổ dự
 * trữ) và chốt kỳ vault. Chạy được sau `evm-issuance.test.ts` trên cùng nút: mọi số kỳ vọng tính
 * từ trạng thái đọc được, nhãn kỳ mang mốc thời gian để không trùng lần chạy trước.
 */

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const CHAIN = 'hardhat-local' as const;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const VAULT = getContractAddress(CHAIN, 'SpvPaymentVault');
const DISTRIBUTOR = getContractAddress(CHAIN, 'ProfitDistributor');
const RUN = Date.now().toString(36);
const DAY_S = 24 * 60 * 60;
const HARDHAT_ACCOUNT0_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CONTRACTS_DIR = path.resolve(__dirname, '../../packages/contracts-evm');

const signer: ISigner = {
  kind: 'server',
  async getAddress() {
    return ADMIN;
  },
  async getAccount() {
    return { address: ADMIN, type: 'json-rpc' } as Account;
  },
};

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(HARDHAT_RPC!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? `RPC ${method} lỗi`);
  return body.result;
}

/** Tua đồng hồ của chuỗi rồi đào một khối để `block.timestamp` đổi thật. */
async function advanceChainTime(seconds: number) {
  await rpc('evm_increaseTime', [seconds]);
  await rpc('evm_mine');
}

async function confirmed(ledger: ILedgerPort, pending: Promise<TxResult>) {
  const tx = await pending;
  const receipt = await ledger.waitReceipt(tx.txHash);
  expect(receipt.status, receipt.reason).toBe('CONFIRMED');
  return tx;
}

/** Nhà đầu tư nắm WPT trên chuỗi: Mint đầu vào vault (nếu chưa) rồi thu hồi một phần sang ví. */
async function ensureHolders(ledger: ILedgerPort) {
  if (!(await ledger.isInitialSupplyMinted())) {
    await confirmed(ledger, ledger.mintInitialSupply(VAULT, 1_000n));
  }
  if (!(await ledger.isWhitelisted(INVESTOR))) await confirmed(ledger, ledger.whitelist(INVESTOR));
  if ((await ledger.balanceOf(INVESTOR)) === 0n) {
    await confirmed(ledger, ledger.forcedTransfer(VAULT, INVESTOR, 600n));
  }
}

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('SC-06 ca 12 — adapter EVM khớp ProfitDistributor trên Hardhat thật', () => {
  let ledger: ILedgerPort;
  const originalRpc = process.env.RPC_HARDHAT;

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    resetServerEnvCache();
    resetChainRegistryCache();
    ledger = createEvmLedger(CHAIN, signer);
    await ensureHolders(ledger);
  });

  afterAll(() => {
    if (originalRpc === undefined) delete process.env.RPC_HARDHAT;
    else process.env.RPC_HARDHAT = originalRpc;
    resetServerEnvCache();
    resetChainRegistryCache();
  });

  it('mở kỳ từ phần chưa phân bổ, tra theo nhãn, chia lô, đã trả, đóng kỳ trả về quỹ', async () => {
    const label = `${CHAIN}:sc06-ca12-${RUN}`;
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 1_000_000n));
    const unallocated = await ledger.unallocatedProfit();
    const reservedBefore = await ledger.reservedProfit();
    expect(unallocated).toBeGreaterThanOrEqual(1_000_000n);
    expect(await ledger.findDistribution(label)).toBeNull();

    await confirmed(ledger, ledger.openDistribution(label));
    const opened = await ledger.findDistribution(label);
    expect(opened).not.toBeNull();
    expect(opened!.distributor).toBe(DISTRIBUTOR);
    expect(opened!.amount).toBe(unallocated);
    expect(opened!.claimed).toBe(0n);
    expect(opened!.closed).toBe(false);
    expect(opened!.expired).toBe(false);
    expect(opened!.totalSupplyAt).toBe(await ledger.totalSupplyAt(opened!.snapshotId));
    expect(await ledger.distributionState(opened!.distributionId)).toEqual(opened);
    expect(await ledger.unallocatedProfit()).toBe(0n);
    expect(await ledger.reservedProfit()).toBe(reservedBefore + unallocated);

    // Nhãn trùng bị hợp đồng chặn ngay ở bước mô phỏng, với cờ "chắc chắn revert".
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 10n));
    const duplicate = await ledger.openDistribution(label).catch((error: unknown) => error);
    expect(duplicate).toBeInstanceOf(LedgerError);
    expect((duplicate as LedgerError).reverted).toBe(true);
    expect((duplicate as LedgerError).message).toContain('đã dùng trên chuỗi');

    const id = opened!.distributionId;
    const investorShare =
      (opened!.amount * (await ledger.balanceOfAt(INVESTOR, opened!.snapshotId))) / opened!.totalSupplyAt;
    const before = await ledger.paymentBalanceOf(INVESTOR);
    await confirmed(ledger, ledger.distributeBatch(id, [INVESTOR]));
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(before + investorShare);
    expect(await ledger.isDistributionPaid(id, INVESTOR)).toBe(true);
    expect(await ledger.isDistributionPaid(id, VAULT)).toBe(false);
    expect((await ledger.distributionState(id)).claimed).toBe(investorShare);
    expect(await ledger.reservedProfit()).toBe(reservedBefore + unallocated - investorShare);

    const early = await ledger.closeDistribution(id).catch((error: unknown) => error);
    expect(early).toBeInstanceOf(LedgerError);
    expect((early as LedgerError).message).toContain('Chưa hết thời hạn nhận');

    await advanceChainTime(181 * DAY_S);
    const expired = await ledger.distributionState(id);
    expect(expired.expired).toBe(true);
    expect(expired.closed).toBe(false);
    const pool = await ledger.profitPoolBalance();
    const unallocatedBeforeClose = await ledger.unallocatedProfit();
    await confirmed(ledger, ledger.closeDistribution(id));
    expect((await ledger.distributionState(id)).closed).toBe(true);
    expect(await ledger.profitPoolBalance()).toBe(pool);
    expect(await ledger.unallocatedProfit()).toBe(
      unallocatedBeforeClose + opened!.amount - investorShare,
    );
  });

  it('chốt kỳ vault và tra lại đúng sự kiện PeriodClosed theo mã kỳ', async () => {
    const status = await ledger.vaultStatus();
    expect(status).not.toBeNull();
    const ref = status!.lastPeriodRef + 1n;
    expect(await ledger.findVaultPeriodClose(ref)).toBeNull();

    const tx = await confirmed(ledger, ledger.closeVaultPeriod(ref, 123_456n));
    const found = await ledger.findVaultPeriodClose(ref);
    expect(found).toMatchObject({ periodRef: ref, distributedPrev: 123_456n, txHash: tx.txHash });
    expect((await ledger.vaultStatus())!.lastPeriodRef).toBe(ref);

    const again = await ledger.closeVaultPeriod(ref, 123_456n).catch((error: unknown) => error);
    expect(again).toBeInstanceOf(LedgerError);
    expect((again as LedgerError).reverted).toBe(true);
  });
});

// ===========================================================================
//  Ca 14 đến 19, phần EVM: nghiệp vụ BE-06/BE-07 chạy trên nút thật
// ===========================================================================

async function rawWrite(from: Hex, address: Hex, abi: Abi | readonly unknown[], functionName: string, args: readonly unknown[]) {
  const account: Account = { address: from, type: 'json-rpc' };
  const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  const walletClient = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
  const { request } = await publicClient.simulateContract({
    account,
    address,
    abi: abi as Abi,
    functionName: functionName as never,
    args: args as never,
  });
  const hash = await walletClient.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  expect(receipt.status).toBe('success');
}

async function distributionsCount(): Promise<bigint> {
  const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  return (await publicClient.readContract({
    address: DISTRIBUTOR as Hex,
    abi: profitDistributorAbi as Abi,
    functionName: 'distributionsCount',
  })) as bigint;
}

live('SC-06 ca 14 đến 19 — nghiệp vụ chia lợi nhuận trên Hardhat thật', () => {
  let ledger: ILedgerPort;
  let service: typeof import('@/lib/bank/distribution.service');
  let trigger: typeof import('@/lib/bank/distribution-trigger.service');
  const saved = {
    rpc: process.env.RPC_HARDHAT,
    key: process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL,
    useMockDb: process.env.USE_MOCK_DB,
    role: process.env.DEMO_ROLE,
  };
  let label = 0;
  const nextKey = () => `${CHAIN}:sc06-${RUN}-${(label += 1)}`;

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = HARDHAT_ACCOUNT0_KEY;
    process.env.USE_MOCK_DB = 'true';
    process.env.DEMO_ROLE = 'TELLER';
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetMemoryStore();
    resetStoreCache();
    ledger = createEvmLedger(CHAIN, signer);
    await ensureHolders(ledger);
    service = await import('@/lib/bank/distribution.service');
    trigger = await import('@/lib/bank/distribution-trigger.service');
    await getOrderStore().createOrder({
      chain: CHAIN,
      investorWallet: INVESTOR,
      wptAmount: '600',
      vndAmount: (600n * BigInt(WPT_ISSUE_PRICE_VND)).toString(),
      actorRole: 'INVESTOR',
      status: 'COMPLETED',
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('RPC_HARDHAT', saved.rpc);
    restore('SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', saved.key);
    restore('USE_MOCK_DB', saved.useMockDb);
    restore('DEMO_ROLE', saved.role);
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetStoreCache();
  });

  async function openOk(periodKey: string) {
    const result = await service.openPeriod({ chain: CHAIN, periodKey });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }

  async function distributeOk(periodId: string) {
    const result = await service.distributePeriod({ chain: CHAIN, periodId });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }

  async function setBatchLimits(size: number, max: number) {
    for (const [key, value] of [
      [CONFIG_KEYS.distributionBatchSize, size],
      [CONFIG_KEYS.distributionMaxBatchesPerRun, max],
    ] as const) {
      await getConfigStore().setConfig({ key, value: String(value), type: 'number', changedBy: 'TELLER' });
    }
  }

  it('ca 14: openPeriod ghi số trên chuỗi, distributePeriod trả đủ, vault nhận phần SPV, chốt vault một lần', async () => {
    await setBatchLimits(50, 10);
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 1_000_000n));
    const unallocated = await ledger.unallocatedProfit();
    const vaultBefore = (await ledger.vaultStatus())!;
    const vaultVndb = await ledger.paymentBalanceOf(VAULT);
    const investorVndb = await ledger.paymentBalanceOf(INVESTOR);

    const period = await openOk(nextKey());
    const onChain = (await ledger.findDistribution(period.periodKey))!;
    expect(period).toMatchObject({
      status: 'OPEN',
      distributionId: onChain.distributionId,
      totalAmount: unallocated.toString(),
      totalSupplyAt: onChain.totalSupplyAt.toString(),
      snapshotId: onChain.snapshotId,
      vaultCloseStatus: 'DONE',
      vaultPeriodRef: Number(vaultBefore.lastPeriodRef + 1n),
    });
    expect((await getDistributionStore().findPeriod(period.id))!.distributorAddress).toBe(DISTRIBUTOR);
    const vaultAfterOpen = (await ledger.vaultStatus())!;
    expect(vaultAfterOpen.lastPeriodRef).toBe(vaultBefore.lastPeriodRef + 1n);
    expect(vaultAfterOpen.lastDistributedPrev).toBe(unallocated);

    const run = await distributeOk(period.id);
    expect(run.period.status).toBe('COMPLETED');
    const share = async (wallet: string) =>
      (onChain.amount * (await ledger.balanceOfAt(wallet, onChain.snapshotId))) / onChain.totalSupplyAt;
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(investorVndb + (await share(INVESTOR)));
    expect(await ledger.paymentBalanceOf(VAULT)).toBe(vaultVndb + (await share(VAULT)));
    expect((await ledger.vaultStatus())!.netProceeds).toBe(vaultBefore.netProceeds);
    expect(await ledger.isDistributionPaid(onChain.distributionId, VAULT)).toBe(true);
  });

  it('ca 15a: giao dịch mở kỳ lên chuỗi, mất ghi database: phục hồi đúng kỳ, không tạo kỳ thứ hai', async () => {
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 500_000n));
    const count = await distributionsCount();
    const key = nextKey();
    vi.spyOn(getDistributionStore(), 'setOpenTxHash').mockRejectedValueOnce(new Error('mất kết nối'));

    const failed = await service.openPeriod({ chain: CHAIN, periodKey: key });
    expect(failed.ok).toBe(false);
    expect((await getDistributionStore().findPeriodByKey(key))?.status).toBe('OPENING');

    const recovered = await service.recoverOpeningPeriod({ chain: CHAIN, periodKey: key });
    expect(recovered.ok, recovered.ok ? '' : recovered.error).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.data.distributionId).toBe((await ledger.findDistribution(key))!.distributionId);
    expect(await distributionsCount()).toBe(count + 1n);
    expect(recovered.data.vaultCloseStatus).toBe('DONE');
    await distributeOk(recovered.data.id);
  });

  it('ca 17: nhà đầu tư tự claim giữa hai vòng: chốt PAID đối soát từ chuỗi, không trả hai lần', async () => {
    await setBatchLimits(50, 10);
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 300_000n));
    const period = await openOk(nextKey());
    await rawWrite(INVESTOR as Hex, DISTRIBUTOR as Hex, CLAIM_ABI, 'claim', [BigInt(period.distributionId!)]);
    const balance = await ledger.paymentBalanceOf(INVESTOR);

    const run = await distributeOk(period.id);

    expect(run.reconciled).toBe(1);
    expect(run.period.status).toBe('COMPLETED');
    expect(await ledger.paymentBalanceOf(INVESTOR)).toBe(balance);
  });

  it('ca 16a: closePeriod lên chuỗi nhưng mất ghi database: retry đối soát PeriodClosed, DONE, không chốt thêm', async () => {
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 200_000n));
    const before = (await ledger.vaultStatus())!.lastPeriodRef;
    const store = getDistributionStore();
    const original = store.transitionVaultClose.bind(store);
    vi.spyOn(store, 'transitionVaultClose').mockImplementation(async (input) => {
      if (input.to === 'SENT' && typeof input.txHash === 'string') throw new Error('mất kết nối');
      return original(input);
    });

    const period = await openOk(nextKey());
    expect(period.vaultCloseStatus).toBe('SENT');
    expect((await ledger.vaultStatus())!.lastPeriodRef).toBe(before + 1n);
    vi.restoreAllMocks();

    const housekeeping = await service.reconcileChainPeriods(CHAIN, 'TELLER');
    expect(housekeeping.vault).toContain('DONE');
    expect((await store.findPeriod(period.id))!.vaultCloseStatus).toBe('DONE');
    expect((await ledger.vaultStatus())!.lastPeriodRef).toBe(before + 1n);
    await distributeOk(period.id);
  });

  it('ca 16b: hai retry đồng thời chỉ gửi một giao dịch closePeriod', async () => {
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 200_000n));
    const before = (await ledger.vaultStatus())!.lastPeriodRef;
    const store = getDistributionStore();
    vi.spyOn(store, 'transitionVaultClose').mockImplementationOnce(async () => null); // lần giành quyền đầu thua
    const period = await openOk(nextKey());
    expect(period.vaultCloseStatus).toBe('PENDING');
    vi.restoreAllMocks();

    await Promise.all([
      service.reconcileChainPeriods(CHAIN, 'TELLER'),
      service.reconcileChainPeriods(CHAIN, 'TELLER'),
    ]);

    expect((await store.findPeriod(period.id))!.vaultCloseStatus).toBe('DONE');
    expect((await ledger.vaultStatus())!.lastPeriodRef).toBe(before + 1n);
    const sends = (await getStore().listTxns({ limit: 500 })).filter(
      (txn) => txn.operation === 'vault-close-period' && txn.reason?.includes(period.periodKey),
    );
    expect(sends).toHaveLength(1);
    await distributeOk(period.id);
  });

  it('ca 19: BE-07 trên chuỗi thật mở kỳ có tiền tố chain theo phần chưa phân bổ rồi dừng khi hết tiền mới', async () => {
    await setBatchLimits(50, 10);
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 250_000n));
    const unallocated = await ledger.unallocatedProfit();

    const first = await trigger.runDistributionCycle({ chain: CHAIN });
    expect(first.ok, first.ok ? '' : first.error).toBe(true);
    if (!first.ok) return;
    expect(first.data.outcome).toBe('DISTRIBUTED');
    expect(first.data.periodKey).toMatch(/^hardhat-local:auto-/);
    expect((await getDistributionStore().findPeriod(first.data.periodId!))!.totalAmount).toBe(
      unallocated.toString(),
    );

    const second = await trigger.runDistributionCycle({ chain: CHAIN });
    expect(second.ok && second.data.outcome).toBe('NO_NEW_FUNDS');
  });

  it('ca 18: quá hạn thì EXPIRED không gửi lô; đóng bằng distribution-admin.js thì CLOSED', async () => {
    await setBatchLimits(1, 1);
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 100_000n));
    const period = await openOk(nextKey());
    await distributeOk(period.id); // một ví nhận, ví kia chưa
    await advanceChainTime(181 * DAY_S);

    const expired = await distributeOk(period.id);
    expect(expired.period.status).toBe('EXPIRED');
    expect(expired.batches).toBe(0);
    expect(expired.expired).toBe(1);

    const runScript = (confirm: boolean) =>
      execFileSync('npx', ['hardhat', 'run', 'scripts/distribution-admin.js', '--network', 'localhost'], {
        cwd: CONTRACTS_DIR,
        env: {
          ...process.env,
          LOCAL_RPC_URL: HARDHAT_RPC,
          DISTRIBUTION_ADMIN_ACTION: 'close',
          DISTRIBUTION_PERIOD_KEY: period.periodKey,
          DISTRIBUTION_ADMIN_CONFIRM: confirm ? 'yes' : '',
        },
        encoding: 'utf8',
      });
    // Mặc định chỉ in kế hoạch, không gửi gì.
    expect(runScript(false)).toContain('DRY-RUN');
    expect((await ledger.distributionState(period.distributionId!)).closed).toBe(false);
    expect(runScript(true)).toContain('CONFIRMED');

    const closed = await distributeOk(period.id);
    expect(closed.period.status).toBe('CLOSED');
    const rows = await getDistributionStore().listPayouts({ periodId: period.id, limit: 10 });
    expect(rows.map((row) => row.status).sort()).toEqual(['EXPIRED', 'PAID']);
  });

  it('ca 16c, 16d: script chốt mã kỳ vault với số khác thì CONFLICT, không gửi thêm; kỳ sau chờ', async () => {
    await setBatchLimits(50, 10);
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 200_000n));
    const store = getDistributionStore();
    vi.spyOn(store, 'transitionVaultClose').mockImplementationOnce(async () => null);
    const period = await openOk(nextKey());
    expect(period.vaultCloseStatus).toBe('PENDING');
    vi.restoreAllMocks();

    // Kiểm soát viên chạy script chen vào, chốt đúng mã đã giữ chỗ với số khác.
    await confirmed(ledger, ledger.closeVaultPeriod(BigInt(period.vaultPeriodRef!), 999n));
    const housekeeping = await service.reconcileChainPeriods(CHAIN, 'TELLER');
    expect(housekeeping.vault).toContain('CONFLICT');
    expect((await store.findPeriod(period.id))!.vaultCloseStatus).toBe('CONFLICT');
    const ref = (await ledger.vaultStatus())!.lastPeriodRef;
    expect(ref).toBe(BigInt(period.vaultPeriodRef!));

    // 16d: kỳ sau không chốt vault khi kỳ trước chưa DONE.
    await confirmed(ledger, ledger.mintPayment(DISTRIBUTOR, 100_000n));
    const next = await openOk(nextKey());
    expect(next.vaultCloseStatus).toBeNull();
    expect((await ledger.vaultStatus())!.lastPeriodRef).toBe(ref);
  });
});

/** `claim(id)` do chính nhà đầu tư ký — không thuộc cổng của ngân hàng nên khai riêng cho ca 17. */
const CLAIM_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
