import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Account } from 'viem';
import { getContractAddress } from '@bidv/shared';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { LedgerError, type ILedgerPort, type TxResult } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';

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
