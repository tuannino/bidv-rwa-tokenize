/**
 * Phần THUẦN của cấu hình khoá vault (BE-13 QĐ-C): đổi phần trăm sang phần vạn bằng xử lý chuỗi,
 * kiểm số khoá cố định, và lập danh sách giao dịch theo bảng chuyển tiếp. Không đọc chuỗi, không
 * ghi gì: service đọc trạng thái chuỗi rồi gọi các hàm này, nên thứ tự giao dịch kiểm được bằng
 * kiểm thử thuần.
 */
import type { VaultLockMode } from '@/lib/ledger';

/** Phần trăm tối đa hai chữ số thập phân, lớn hơn 0 và không quá 100. Không dùng số thực. */
const PERCENT_PATTERN = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** `"20"` -> 2000n, `"12.5"` -> 1250n, `"0.01"` -> 1n. `null` khi sai dạng, bằng 0 hoặc quá 100. */
export function percentToBps(input: string): bigint | null {
  const match = PERCENT_PATTERN.exec(input.trim());
  if (!match) return null;
  const bps = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  return bps > 0n && bps <= 10_000n ? bps : null;
}

/** 2000n -> `"20"`, 1250n -> `"12.5"`, 1n -> `"0.01"`: chiều ngược để điền sẵn trên màn. */
export function bpsToPercent(bps: bigint | string | number): string {
  const value = BigInt(bps);
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * Số khoá cố định: để trống được (`null` = không đặt, đích là PERCENT); có giá trị thì phải là số
 * nguyên VNDB lớn hơn 0. `'INVALID'` khi sai.
 */
export function parseFixedLock(input: string | null | undefined): bigint | null | 'INVALID' {
  const value = input?.trim() ?? '';
  if (value === '') return null;
  if (!/^\d+$/.test(value)) return 'INVALID';
  const amount = BigInt(value);
  return amount > 0n ? amount : 'INVALID';
}

export type VaultConfigStep =
  | { kind: 'setPayoutWallet'; wallet: string; previous: string | null }
  | { kind: 'setFixedLock'; amount: bigint; previous: bigint }
  | { kind: 'setPercentRate'; bps: bigint; previous: bigint }
  | { kind: 'setLockMode'; mode: Exclude<VaultLockMode, 'UNSET'>; previous: VaultLockMode };

export const VAULT_CONFIG_STEP_LABELS: Readonly<Record<VaultConfigStep['kind'], string>> = {
  setPayoutWallet: 'Đặt ví nhận tiền',
  setFixedLock: 'Đặt số khoá cố định',
  setPercentRate: 'Đặt tỷ lệ khoá',
  setLockMode: 'Đổi chế độ khoá',
};

export interface VaultConfigCurrent {
  lockMode: VaultLockMode;
  fixedLockAmount: bigint;
  percentRateBps: bigint;
  /** Tỷ lệ chờ áp sau kỳ đầu; `null` khi không có. */
  pendingPercentRateBps: bigint | null;
  payoutWallet: string | null;
}

export interface VaultConfigTarget {
  percentBps: bigint;
  /** `null` = để trống: đích là PERCENT. */
  fixedLock: bigint | null;
  payoutWallet: string;
}

/**
 * Giao dịch còn phải gửi, đúng thứ tự (bảng QĐ-C). Chỉ gửi phần còn khác trạng thái chuỗi:
 *
 * | Từ             | Đến     | Thứ tự                                                    |
 * |----------------|---------|-----------------------------------------------------------|
 * | UNSET          | PERCENT | `setPercentRate`, rồi `setLockMode(PERCENT)`              |
 * | UNSET, PERCENT | FIXED   | `setFixedLock`, rồi `setLockMode(FIXED)`                  |
 * | FIXED          | PERCENT | `setPercentRate` (nếu khác), rồi `setLockMode(PERCENT)`   |
 * | giữ chế độ     |         | chỉ setter của giá trị đổi                                |
 *
 * `setPayoutWallet` độc lập, đứng trước. Giá trị luôn lên chuỗi TRƯỚC khi đổi chế độ, nên chế độ
 * hiện hành không bao giờ mang giá trị 0 hay giá trị chưa lên chuỗi. FIXED sang PERCENT KHÔNG gửi
 * `setFixedLock(0)`: chế độ PERCENT không dùng số đó, để nguyên. Đích FIXED không gửi tỷ lệ (bảng
 * chỉ có hai giao dịch cho dòng này); tỷ lệ lên chuỗi khi đích là PERCENT.
 *
 * Sau kỳ đầu, `setPercentRate` chỉ ghi tỷ lệ chờ, nên so với tỷ lệ chờ nếu có: gửi lại đúng tỷ lệ
 * đang chờ là thừa.
 */
export function planVaultConfig(current: VaultConfigCurrent, target: VaultConfigTarget): VaultConfigStep[] {
  const steps: VaultConfigStep[] = [];
  if (current.payoutWallet?.toLowerCase() !== target.payoutWallet.toLowerCase()) {
    steps.push({ kind: 'setPayoutWallet', wallet: target.payoutWallet, previous: current.payoutWallet });
  }
  if (target.fixedLock !== null) {
    if (current.fixedLockAmount !== target.fixedLock) {
      steps.push({ kind: 'setFixedLock', amount: target.fixedLock, previous: current.fixedLockAmount });
    }
    if (current.lockMode !== 'FIXED') steps.push({ kind: 'setLockMode', mode: 'FIXED', previous: current.lockMode });
    return steps;
  }
  const effectiveRate = current.pendingPercentRateBps ?? current.percentRateBps;
  if (effectiveRate !== target.percentBps) {
    steps.push({ kind: 'setPercentRate', bps: target.percentBps, previous: effectiveRate });
  }
  if (current.lockMode !== 'PERCENT') steps.push({ kind: 'setLockMode', mode: 'PERCENT', previous: current.lockMode });
  return steps;
}

/** Giá trị cũ và mới của một bước, viết cho sổ kiểm toán. */
export function describeVaultConfigStep(step: VaultConfigStep): string {
  switch (step.kind) {
    case 'setPayoutWallet':
      return `ví nhận ${step.previous ?? '(chưa đặt)'} -> ${step.wallet}`;
    case 'setFixedLock':
      return `số khoá cố định ${step.previous} -> ${step.amount} VNDB`;
    case 'setPercentRate':
      return `tỷ lệ khoá ${bpsToPercent(step.previous)}% -> ${bpsToPercent(step.bps)}%`;
    case 'setLockMode':
      return `chế độ khoá ${step.previous} -> ${step.mode}`;
  }
}
