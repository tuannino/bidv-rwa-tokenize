/**
 * Phần THUẦN của cấu hình khoá vault (BE-13 QĐ-C): đổi phần trăm sang phần vạn bằng xử lý chuỗi,
 * kiểm số khoá cố định, và lập danh sách giao dịch theo bảng chuyển tiếp. Không đọc chuỗi, không
 * ghi gì: service đọc trạng thái chuỗi rồi gọi các hàm này, nên thứ tự giao dịch kiểm được bằng
 * kiểm thử thuần.
 */
import type { VaultConfigParam, VaultLockMode } from '@/lib/ledger';

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

/**
 * Bước cấu hình của Kiểm soát viên. FIX-01 QĐ-8: không còn bước đặt ví nhận; ví nhận do Người bán
 * chọn trong vòng đời lệnh rút (`withdraw.service.ts`).
 */
export type VaultConfigStep =
  | { kind: 'setFixedLock'; amount: bigint; previous: bigint }
  | { kind: 'setPercentRate'; bps: bigint; previous: bigint }
  | { kind: 'setLockMode'; mode: Exclude<VaultLockMode, 'UNSET'>; previous: VaultLockMode };

export const VAULT_CONFIG_STEP_LABELS: Readonly<Record<VaultConfigStep['kind'], string>> = {
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
}

/** Đích cấu hình theo MỘT chế độ (UIUX-01 C1): chỉ mang giá trị của chế độ đã chọn. */
export type VaultConfigTarget = { mode: 'PERCENT'; percentBps: bigint } | { mode: 'FIXED'; fixedLock: bigint };

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
 * Giá trị luôn lên chuỗi TRƯỚC khi đổi chế độ, nên chế độ
 * hiện hành không bao giờ mang giá trị 0 hay giá trị chưa lên chuỗi. FIXED sang PERCENT KHÔNG gửi
 * `setFixedLock(0)`: chế độ PERCENT không dùng số đó, để nguyên. Đích FIXED không gửi tỷ lệ (bảng
 * chỉ có hai giao dịch cho dòng này); tỷ lệ lên chuỗi khi đích là PERCENT.
 *
 * Sau kỳ đầu, `setPercentRate` chỉ ghi tỷ lệ chờ, nên so với tỷ lệ chờ nếu có: gửi lại đúng tỷ lệ
 * đang chờ là thừa.
 */
export function planVaultConfig(current: VaultConfigCurrent, target: VaultConfigTarget): VaultConfigStep[] {
  const steps: VaultConfigStep[] = [];
  if (target.mode === 'FIXED') {
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

/**
 * Mốc cấu hình hiện hành có hiệu lực (UIUX-01 D4), tính từ lịch sử sự kiện cấu hình.
 *
 * Sự kiện đến theo thứ tự bất kỳ; hàm tự xếp theo `blockNumber` rồi `logIndex`, KHÔNG theo
 * `timestamp` (mock gán nhiều sự kiện cùng giây). Lấy sự kiện mới nhất trong: `LOCK_MODE` (mọi chế
 * độ), `FIXED_LOCK` khi chế độ FIXED, `PERCENT_RATE` khi chế độ PERCENT. Tỷ lệ chờ
 * (`PENDING_PERCENT_RATE`) không tính: nó chưa có hiệu lực.
 *
 * `at: null` khi chưa cấu hình (`UNSET`) hoặc không có sự kiện nào; `unknown: true` khi sự kiện
 * chọn ra không có giờ block (`timestamp` bằng 0).
 */
export function configEffectiveAt(input: {
  lockMode: VaultLockMode;
  events: readonly { param: VaultConfigParam; blockNumber: bigint; logIndex: number; timestamp: number }[];
}): { at: number | null; unknown: boolean } {
  if (input.lockMode === 'UNSET') return { at: null, unknown: false };
  const valueParam: VaultConfigParam = input.lockMode === 'FIXED' ? 'FIXED_LOCK' : 'PERCENT_RATE';
  let latest: (typeof input.events)[number] | null = null;
  for (const event of input.events) {
    if (event.param !== 'LOCK_MODE' && event.param !== valueParam) continue;
    if (
      latest === null ||
      event.blockNumber > latest.blockNumber ||
      (event.blockNumber === latest.blockNumber && event.logIndex > latest.logIndex)
    ) {
      latest = event;
    }
  }
  if (latest === null) return { at: null, unknown: false };
  return latest.timestamp === 0 ? { at: null, unknown: true } : { at: latest.timestamp, unknown: false };
}

/** Giá trị cũ và mới của một bước, viết cho sổ kiểm toán. */
export function describeVaultConfigStep(step: VaultConfigStep): string {
  switch (step.kind) {
    case 'setFixedLock':
      return `số khoá cố định ${step.previous} -> ${step.amount} VNDB`;
    case 'setPercentRate':
      return `tỷ lệ khoá ${bpsToPercent(step.previous)}% -> ${bpsToPercent(step.bps)}%`;
    case 'setLockMode':
      return `chế độ khoá ${step.previous} -> ${step.mode}`;
  }
}
