import type { VaultLockMode } from './ledger.port';

/**
 * Luật khoá của `SpvPaymentVault` viết thành hàm thuần (BE-13 QĐ-G). Vault mock tính bằng chính
 * các hàm này, và kiểm thử đối chiếu chúng với hợp đồng trên cùng bộ số, nên mock không thể dễ
 * tính hơn hợp đồng.
 */
export const VAULT_BPS_DENOMINATOR = 10_000n;

export interface VaultLockInput {
  lockMode: VaultLockMode;
  fixedLockAmount: bigint;
  percentRateBps: bigint;
  netProceeds: bigint;
  lastPeriodRef: bigint;
  percentLocked: bigint;
  /** Số dư VNDB của vault. */
  vndbBalance: bigint;
}

/** `Math.mulDiv(x, y, d)` của OpenZeppelin với số không âm: tích đầy đủ rồi chia làm tròn xuống. */
export function mulDivFloor(x: bigint, y: bigint, denominator: bigint): bigint {
  if (x < 0n || y < 0n || denominator <= 0n) throw new RangeError('mulDivFloor chỉ nhận số không âm và mẫu dương.');
  return (x * y) / denominator;
}

/** Như `lockedAmount()`: có thể lớn hơn số dư hiện tại. */
export function vaultLockedAmount(input: VaultLockInput): bigint {
  if (input.lockMode === 'UNSET') return input.vndbBalance;
  if (input.lockMode === 'FIXED') return input.fixedLockAmount;
  if (input.lastPeriodRef === 0n) {
    return mulDivFloor(input.netProceeds, input.percentRateBps, VAULT_BPS_DENOMINATOR);
  }
  return input.percentLocked;
}

/** Như `withdrawable()`: phần vượt khoá, chặn ở 0. */
export function vaultWithdrawable(input: VaultLockInput): bigint {
  const locked = vaultLockedAmount(input);
  return input.vndbBalance > locked ? input.vndbBalance - locked : 0n;
}

/** Phần khoá chốt ở `closePeriod`, theo tỷ lệ đã áp tỷ lệ chờ (nếu có). */
export function vaultPercentLockedAfterClose(distributedPrev: bigint, rateBps: bigint): bigint {
  return mulDivFloor(distributedPrev, rateBps, VAULT_BPS_DENOMINATOR);
}

/** Như `settleSell`: trừ `netProceeds`, chặn ở 0. */
export function netProceedsAfterSell(netProceeds: bigint, vndbAmount: bigint): bigint {
  return netProceeds > vndbAmount ? netProceeds - vndbAmount : 0n;
}
