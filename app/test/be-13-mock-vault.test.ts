import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getAddress, keccak256, toHex } from 'viem';
import { MOCK_VAULT_ADDRESS, SAMPLE_WALLETS, vaultAddressFor } from '@bidv/shared';
import { vaultMintTargetError } from '@/lib/bank/issuance.service';
import { resetServerEnvCache } from '@/lib/config/env';
import { getLedger } from '@/lib/ledger';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';
import {
  createDefaultMockLedgerState,
  decodeMockLedgerState,
  encodeMockLedgerState,
  memoryMockLedgerStateStore,
} from '@/lib/ledger/mock-state.store';
import { createMockLedger, resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { mulDivFloor, vaultLockedAmount, vaultWithdrawable } from '@/lib/ledger/vault-lock';

/**
 * BE-13 ca 12 (QĐ-G): vault mô phỏng trên chain mock. Bảng số khoá đọc từ cùng tệp mà kiểm thử
 * hợp đồng `packages/contracts-evm/test/be-13-vault-lock-parity.test.js` chạy trên
 * `SpvPaymentVault` thật, nên khớp bảng ở đây là khớp hợp đồng trên cùng bộ số. Ca dòng JSONB cũ
 * trên Postgres thật nằm ở `mock-ledger-state-store.test.ts` (cùng dòng `mock`, chạy tuần tự).
 */
type Step = {
  op: string;
  bps?: string;
  mode?: 'FIXED' | 'PERCENT';
  amount?: string;
  wpt?: string;
  price?: string;
  periodRef?: string;
  distributedPrev?: string;
  expect: Record<string, string>;
};
type Scenario = { name: string; note: string; price: string; steps: Step[] };

const TABLE = JSON.parse(
  readFileSync(
    path.resolve(__dirname, '../../packages/contracts-evm/test/fixtures/be13-vault-lock-table.json'),
    'utf8',
  ),
) as { scenarios: Scenario[] };

const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const PAYOUT = SAMPLE_WALLETS.NB001;
const OPERATOR = '0x0000000000000000000000000000000000000001';

/** Dựng chain mock đã Mint đầu vào vault, nhà đầu tư có VNDB, ví nhận là NB001. */
async function preparedMock(price: bigint): Promise<ILedgerPort> {
  await resetMockLedger();
  const ledger = createMockLedger('mock');
  await ledger.whitelist(INVESTOR);
  await ledger.whitelist(PAYOUT);
  await ledger.mintInitialSupply(MOCK_VAULT_ADDRESS, 10_000n);
  await seedMockLedger({
    wptPriceVnd: price,
    paymentBalances: { [INVESTOR]: 10_000_000_000n },
    paymentAllowances: { [INVESTOR]: 10_000_000_000n },
  });
  await ledger.setVaultPayoutWallet(PAYOUT);
  return ledger;
}

let orderSeq = 0;
const nextOrderId = () => `00000000-0000-4000-8000-${(++orderSeq).toString(16).padStart(12, '0')}`;

async function runStep(ledger: ILedgerPort, step: Step, price: { value: bigint }): Promise<void> {
  switch (step.op) {
    case 'fund': {
      const current = await ledger.paymentBalanceOf(MOCK_VAULT_ADDRESS);
      await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: current + BigInt(step.amount!) } });
      return;
    }
    case 'setPercentRate':
      await ledger.setVaultPercentRate(BigInt(step.bps!));
      return;
    case 'setFixedLock':
      await ledger.setVaultFixedLock(BigInt(step.amount!));
      return;
    case 'setLockMode':
      await ledger.setVaultLockMode(step.mode!);
      return;
    case 'setPrice':
      price.value = BigInt(step.price!);
      await ledger.setPurchasePrice(price.value);
      return;
    case 'buy': {
      const wpt = BigInt(step.wpt!);
      await ledger.executePurchase({ orderId: nextOrderId(), investor: INVESTOR, wptAmount: wpt, vndAmount: wpt * price.value });
      return;
    }
    case 'sell': {
      const wpt = BigInt(step.wpt!);
      await ledger.executeSale({ orderId: nextOrderId(), investor: INVESTOR, wptAmount: wpt, vndAmount: wpt * price.value });
      return;
    }
    case 'closePeriod':
      await ledger.closeVaultPeriod(BigInt(step.periodRef!), BigInt(step.distributedPrev!));
      return;
    case 'withdrawHalf': {
      const status = await ledger.vaultStatus();
      await ledger.withdrawFromVault(status!.withdrawable / 2n);
      return;
    }
    case 'withdraw':
      await ledger.withdrawFromVault(BigInt(step.amount!));
      return;
    default:
      throw new Error(`Bước lạ trong bảng số: ${step.op}`);
  }
}

describe('BE-13 ca 12: địa chỉ vault mock', () => {
  it('là 20 byte cuối của keccak256 nhãn cố định, khác ví nhận NB001', () => {
    const hash = keccak256(toHex('bidv-rwa-tokenize:mock:SpvPaymentVault'));
    expect(MOCK_VAULT_ADDRESS).toBe(getAddress(`0x${hash.slice(-40)}`));
    expect(MOCK_VAULT_ADDRESS.toLowerCase()).not.toBe(SAMPLE_WALLETS.NB001.toLowerCase());
    expect(BigInt(MOCK_VAULT_ADDRESS)).toBeGreaterThan(0xffffn);
  });

  it('vaultAddressFor: mock trả vault logic; R6 chặn Mint đầu vào NB001 và cho qua vault', () => {
    expect(vaultAddressFor('mock')).toBe(MOCK_VAULT_ADDRESS);
    expect(vaultMintTargetError('mock', SAMPLE_WALLETS.NB001)).toContain(MOCK_VAULT_ADDRESS);
    expect(vaultMintTargetError('mock', MOCK_VAULT_ADDRESS.toLowerCase())).toBeNull();
  });
});

describe('BE-13 ca 12: bảng số khoá: vault mock và hàm thuần khớp hợp đồng', () => {
  beforeEach(() => resetMockLedger());

  for (const scenario of TABLE.scenarios) {
    it(`${scenario.name}: ${scenario.note}`, async () => {
      const price = { value: BigInt(scenario.price) };
      const ledger = await preparedMock(price.value);
      for (const [index, step] of scenario.steps.entries()) {
        const label = `${scenario.name}#${index} ${step.op}`;
        const payoutBefore = await ledger.paymentBalanceOf(PAYOUT);
        await runStep(ledger, step, price);
        const status = (await ledger.vaultStatus())!;
        const want = step.expect;
        expect(status.netProceeds, `${label} netProceeds`).toBe(BigInt(want.netProceeds));
        expect(status.vndbBalance, `${label} vndbBalance`).toBe(BigInt(want.vndbBalance));
        expect(status.lockedAmount, `${label} locked`).toBe(BigInt(want.locked));
        expect(status.withdrawable, `${label} withdrawable`).toBe(BigInt(want.withdrawable));
        // Hàm thuần trên cùng biến trạng thái ra cùng số (QĐ-G "một hàm thuần dùng chung").
        expect(vaultLockedAmount(status), `${label} hàm thuần locked`).toBe(BigInt(want.locked));
        expect(vaultWithdrawable(status), `${label} hàm thuần withdrawable`).toBe(BigInt(want.withdrawable));
        if (want.percentLocked !== undefined) expect(status.percentLocked).toBe(BigInt(want.percentLocked));
        if (want.percentRateBps !== undefined) expect(status.percentRateBps).toBe(BigInt(want.percentRateBps));
        if (want.pendingPercentRateBps !== undefined) {
          expect(status.pendingPercentRateBps).toBe(BigInt(want.pendingPercentRateBps));
        }
        if (want.withdrawn !== undefined) {
          expect((await ledger.paymentBalanceOf(PAYOUT)) - payoutBefore, `${label} withdrawn`).toBe(BigInt(want.withdrawn));
        }
      }
    });
  }

  it('mulDivFloor giữ tích đầy đủ như Math.mulDiv (số lớn, ca 10 của SC-07)', () => {
    const huge = 1n << 255n;
    expect(mulDivFloor(huge, 10_000n, 10_000n)).toBe(huge);
    expect(mulDivFloor(130n, 3_333n, 10_000n)).toBe(43n);
  });
});

describe('BE-13 ca 12: cấu hình, rút và chốt kỳ chạy trên mock', () => {
  beforeEach(() => resetMockLedger());

  it('cấu hình được trước Mint đầu; vault vừa khởi tạo ở UNSET và đã whitelist', async () => {
    const ledger = createMockLedger('mock');
    expect(await ledger.isInitialSupplyMinted()).toBe(false);
    expect(await ledger.isWhitelisted(MOCK_VAULT_ADDRESS)).toBe(true);
    expect(await ledger.vaultStatus()).toMatchObject({ lockMode: 'UNSET', payoutWallet: null });
    await ledger.whitelist(PAYOUT);
    await ledger.setVaultPercentRate(2_000n);
    await ledger.setVaultLockMode('PERCENT');
    await ledger.setVaultPayoutWallet(PAYOUT);
    expect(await ledger.vaultStatus()).toMatchObject({
      lockMode: 'PERCENT',
      percentRateBps: 2_000n,
      payoutWallet: PAYOUT,
    });
    expect(await ledger.isInitialSupplyMinted()).toBe(false);
  });

  it('từ chối như hợp đồng: tỷ lệ > 100%, về UNSET, ví nhận chưa xác minh, mã kỳ sai', async () => {
    const ledger = createMockLedger('mock');
    const before = await ledger.latestBlockNumber();
    await expect(ledger.setVaultPercentRate(10_001n)).rejects.toThrow('Tỷ lệ khoá không được vượt 100%.');
    await expect(ledger.setVaultLockMode('UNSET' as 'FIXED')).rejects.toThrow('Chưa cấu hình');
    await expect(ledger.setVaultPayoutWallet(INVESTOR)).rejects.toThrow('chưa được xác minh');
    await expect(ledger.closeVaultPeriod(2n, 0n)).rejects.toThrow('tăng tuần tự');
    // Lần từ chối không tốn "block" nào.
    expect(await ledger.latestBlockNumber()).toBe(before);
  });

  it('rút: chặn khi thiếu ví nhận, số 0, vượt phần được rút, tạm dừng; thành công thì có sự kiện bền', async () => {
    const ledger = createMockLedger('mock');
    await ledger.whitelist(INVESTOR);
    await ledger.whitelist(PAYOUT);
    await ledger.mintInitialSupply(MOCK_VAULT_ADDRESS, 10_000n);
    await seedMockLedger({ paymentBalances: { [MOCK_VAULT_ADDRESS]: 1_000n } });
    await expect(ledger.withdrawFromVault(1n)).rejects.toThrow('chưa cấu hình ví nhận');
    await ledger.setVaultPayoutWallet(PAYOUT);
    await expect(ledger.withdrawFromVault(1n)).rejects.toThrow('vượt phần VNDB'); // UNSET khoá toàn bộ
    await ledger.setVaultFixedLock(400n);
    await ledger.setVaultLockMode('FIXED');
    await expect(ledger.withdrawFromVault(0n)).rejects.toThrow('lớn hơn 0');
    await expect(ledger.withdrawFromVault(601n)).rejects.toThrow('vượt phần VNDB');
    await seedMockLedger({ vaultPaused: true });
    await expect(ledger.withdrawFromVault(1n)).rejects.toThrow('tạm dừng');
    await seedMockLedger({ vaultPaused: false });

    const claimedBlock = await ledger.latestBlockNumber();
    const tx = await ledger.withdrawFromVault(600n);
    expect(await ledger.latestBlockNumber()).toBe(claimedBlock + 1n);
    expect(await ledger.paymentBalanceOf(PAYOUT)).toBe(600n);
    expect((await ledger.vaultStatus())?.withdrawable).toBe(0n);

    const events = await ledger.findVaultWithdrawals({ fromBlock: claimedBlock, to: PAYOUT, amount: 600n });
    expect(events).toEqual([
      { to: PAYOUT, amount: 600n, operator: OPERATOR, txHash: tx.txHash, blockNumber: claimedBlock + 1n, logIndex: 0 },
    ]);
    expect(await ledger.findVaultWithdrawals({ fromBlock: claimedBlock + 2n })).toEqual([]);
    expect(await ledger.findVaultWithdrawals({ fromBlock: 0n, amount: 599n })).toEqual([]);
    expect(await ledger.vaultWithdrawalReceipt(tx.txHash)).toEqual({
      txHash: tx.txHash,
      status: 'CONFIRMED',
      withdrawals: events,
    });
    // Mã của giao dịch khác (cấu hình) có biên nhận nhưng không có sự kiện rút; mã chưa cấp là null.
    const config = await ledger.setVaultFixedLock(400n);
    expect((await ledger.vaultWithdrawalReceipt(config.txHash))?.withdrawals).toEqual([]);
    expect(await ledger.vaultWithdrawalReceipt(`0x${'f'.repeat(64)}`)).toBeNull();
  });

  it('chốt kỳ chạy thật trên mock: sự kiện bền, tra theo mã kỳ, operator là ví ký của factory', async () => {
    process.env.USE_MOCK_DB = 'true';
    resetServerEnvCache();
    const ledger = getLedger('mock');
    await ledger.setVaultPercentRate(2_000n);
    await ledger.setVaultLockMode('PERCENT');
    const tx = await ledger.closeVaultPeriod(1n, 1_000_000n);
    const close = await ledger.findVaultPeriodClose(1n);
    expect(close).toMatchObject({
      periodRef: 1n,
      distributedPrev: 1_000_000n,
      rateBps: 2_000n,
      percentLocked: 200_000n,
      operator: OPERATOR,
      txHash: tx.txHash,
    });
    expect(await ledger.findVaultPeriodClose(2n)).toBeNull();
    expect(await ledger.vaultPeriodCloses(5)).toEqual([close]);
  });
});

describe('BE-13 ca 12: dòng MockLedgerState cũ thiếu trường vault', () => {
  const legacy = () => {
    const encoded = encodeMockLedgerState(createDefaultMockLedgerState()) as Record<string, unknown>;
    delete encoded.vault;
    encoded.whitelisted = [];
    return encoded;
  };

  it('giải mã thành vault UNSET, whitelist địa chỉ vault, không lỗi', () => {
    const decoded = decodeMockLedgerState(legacy());
    expect(decoded.vault).toEqual(createDefaultMockLedgerState().vault);
    expect(decoded.whitelisted.has(MOCK_VAULT_ADDRESS.toLowerCase())).toBe(true);
  });

  it('khứ hồi giữ đủ sự kiện rút và chốt kỳ', () => {
    const state = createDefaultMockLedgerState();
    state.vault.lockMode = 'PERCENT';
    state.vault.payoutWallet = PAYOUT;
    state.vault.withdrawals.push({ to: PAYOUT, amount: 5n, operator: OPERATOR, txHash: '0x01', blockNumber: 3 });
    state.vault.periodCloses.push({
      periodRef: 1n,
      distributedPrev: 9n,
      rateBps: 2_000n,
      percentLocked: 1n,
      operator: OPERATOR,
      txHash: '0x02',
      blockNumber: 4,
      timestamp: 1_700_000_000,
    });
    expect(decodeMockLedgerState(encodeMockLedgerState(state))).toEqual(state);
  });
});

// Kho bộ nhớ mặc định dùng chung giữa các tệp: dọn để không rò trạng thái vault sang tệp khác.
afterAll(() => resetMockLedger(memoryMockLedgerStateStore));
