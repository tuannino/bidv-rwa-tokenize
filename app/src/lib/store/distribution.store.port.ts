import type { ChainKey } from '@bidv/shared';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ CHIA LỢI NHUẬN: kỳ chia (`DistributionPeriod`) và chi tiết từng lần chia
 * (`DistributionPayout`).
 *
 * Cổng này chỉ LƯU TRỮ. Tính số tiền từng ví, chia lô, chạy lại lô lỗi là việc của tầng
 * nghiệp vụ (BE-05, BE-06).
 *
 * ⚠️ Danh sách ví cần chia KHÔNG đọc được từ chuỗi. ERC-20 chỉ lưu bảng số dư theo địa
 * chỉ, không lưu danh sách địa chỉ, nên `ILedgerPort` cố ý không có method liệt kê người
 * nắm giữ. Chính bảng `DistributionPayout` này là nơi giữ danh sách đó.
 */

/**
 * Trạng thái của một KỲ chia.
 *
 *     OPEN ──► DISTRIBUTING ──► COMPLETED
 *
 * Ba giá trị là đủ và không hơn: `OPEN` = đã chốt quyền, đã lập đủ hồ sơ, chưa chi đồng
 * nào; `DISTRIBUTING` = đã gửi ít nhất một lô; `COMPLETED` = không còn hồ sơ nào phải chi.
 *
 * KHÔNG có `FAILED` cho kỳ: lô lỗi là trạng thái của từng `DistributionPayout`, và một kỳ
 * có lô lỗi thì vẫn phải chạy lại lô đó chứ không "thất bại" như một khối. Đặt `FAILED` ở
 * cấp kỳ sẽ mời người đọc sau bỏ luôn cả kỳ khi mới lỗi một lô.
 */
export const DISTRIBUTION_PERIOD_STATUSES = ['OPEN', 'DISTRIBUTING', 'COMPLETED'] as const;
export type DistributionPeriodStatus = (typeof DISTRIBUTION_PERIOD_STATUSES)[number];

export const assertDistributionPeriodStatus = (value: string): DistributionPeriodStatus =>
  assertStatus('DistributionPeriod', DISTRIBUTION_PERIOD_STATUSES, value);

/**
 * Trạng thái của MỘT hồ sơ chia.
 *
 *     PENDING ──► SENT ──► PAID
 *                   └──► FAILED
 *
 * `SENT` tách khỏi `PAID` là bắt buộc, không phải chi li: giữa lúc gửi giao dịch và lúc có
 * biên nhận, hồ sơ đã có `txHash` mà chưa biết kết quả. Gộp hai trạng thái thì tiến trình
 * chết giữa chừng để lại hồ sơ trông như đã chi xong, và lần chạy lại sẽ chi lần thứ hai.
 */
export const DISTRIBUTION_PAYOUT_STATUSES = ['PENDING', 'SENT', 'PAID', 'FAILED'] as const;
export type DistributionPayoutStatus = (typeof DISTRIBUTION_PAYOUT_STATUSES)[number];

export const assertDistributionPayoutStatus = (value: string): DistributionPayoutStatus =>
  assertStatus('DistributionPayout', DISTRIBUTION_PAYOUT_STATUSES, value);

export interface DistributionPeriodRecord {
  id: string;
  /** Mã kỳ do nghiệp vụ đặt, ví dụ "2026-Q1". DUY NHẤT toàn hệ (R2.2). */
  periodKey: string;
  /**
   * Mã ảnh chụp số dư trên chuỗi.
   *
   * Chỉ có một nguồn hợp lệ: event `Snapshot` trong biên nhận của
   * `ILedgerSnapshot.takeSnapshot`. KHÔNG tự tăng số đếm và KHÔNG gọi
   * `getCurrentSnapshotId()` sau khi gửi giao dịch — tx snapshot của người khác chen vào
   * giữa hai lời gọi là lấy về mã của họ, rồi chia lợi nhuận theo ảnh chụp sai.
   */
  snapshotId: number;
  /** Tổng VNDB của kỳ, dạng chuỗi. */
  totalAmount: string;
  /** Tổng cung WPT tại ảnh chụp — mẫu số khi tính phần từng ví. */
  totalSupplyAt: string;
  status: DistributionPeriodStatus;
  chain: ChainKey;
  /** Thời điểm chốt quyền. */
  openedAt: string;
  completedAt: string | null;
}

export interface NewDistributionPeriod {
  periodKey: string;
  snapshotId: number;
  totalAmount: string;
  totalSupplyAt: string;
  chain: ChainKey;
  /** Mặc định `OPEN`. */
  status?: DistributionPeriodStatus;
}

export interface DistributionPayoutRecord {
  id: string;
  periodId: string;
  investorWallet: string;
  /** Số dư WPT của ví TẠI ảnh chụp của kỳ. */
  balanceAt: string;
  /**
   * Số VNDB được chia, CHỐT tại thời điểm lập hồ sơ.
   *
   * Lưu lại thay vì tính lại từ `balanceAt / totalSupplyAt` mỗi lần đọc: số đã chuyển cho
   * người ta thì không được đổi theo bất cứ thứ gì sửa sau đó.
   */
  amount: string;
  status: DistributionPayoutStatus;
  txHash: string | null;
  /** Số thứ tự lô đã gửi — để chạy lại đúng lô lỗi thay vì chạy lại cả kỳ. */
  batchNo: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewDistributionPayout {
  investorWallet: string;
  balanceAt: string;
  amount: string;
  /** Mặc định `PENDING`. */
  status?: DistributionPayoutStatus;
  batchNo?: number | null;
}

export interface IDistributionStore {
  readonly kind: StoreKind;

  /**
   * Mở một kỳ chia. Ném `UniqueConstraintError` nếu `periodKey` đã tồn tại (R2.2).
   *
   * Đây là chốt chặn "mở cùng một kỳ hai lần", và nó phải là ràng buộc DUY NHẤT ở cơ sở
   * dữ liệu chứ không phải phép kiểm trước khi ghi: hai tiến trình chạy song song có thể
   * cùng thấy "chưa có kỳ này" rồi cùng ghi.
   */
  openPeriod(period: NewDistributionPeriod): Promise<DistributionPeriodRecord>;

  findPeriod(id: string): Promise<DistributionPeriodRecord | null>;
  findPeriodByKey(periodKey: string): Promise<DistributionPeriodRecord | null>;

  listPeriods(options?: {
    chain?: ChainKey;
    status?: DistributionPeriodStatus;
    limit?: number;
  }): Promise<DistributionPeriodRecord[]>;

  /**
   * Đổi trạng thái kỳ. Trả `null` nếu không có kỳ nào mang mã này.
   *
   * `completedAt` do người gọi truyền, cổng KHÔNG tự đặt khi status thành `COMPLETED`:
   * "hoàn tất" là kết luận của nghiệp vụ (đã hết hồ sơ phải chi), cổng lưu trữ không biết
   * và không được đoán.
   */
  setPeriodStatus(input: {
    id: string;
    status: DistributionPeriodStatus;
    completedAt?: string | null;
  }): Promise<DistributionPeriodRecord | null>;

  /**
   * Lập hồ sơ chia cho một lô ví. TẤT CẢ HOẶC KHÔNG.
   *
   * Một dòng vi phạm duy nhất `(periodId, investorWallet)` thì cả lô không vào và ném
   * `UniqueConstraintError` (R2.4) — chốt chặn chia trùng cho một nhà đầu tư trong cùng
   * kỳ. Nửa lô vào được sẽ để lại kỳ với danh sách thiếu, và không có cách nào phát hiện
   * ngoài đối soát tay.
   */
  createPayouts(input: {
    periodId: string;
    rows: readonly NewDistributionPayout[];
  }): Promise<DistributionPayoutRecord[]>;

  /**
   * Cập nhật một hồ sơ theo khoá nghiệp vụ `(periodId, investorWallet)` — đúng cặp cột
   * mang ràng buộc duy nhất. Trả `null` nếu không có hồ sơ nào khớp.
   */
  markPayout(input: {
    periodId: string;
    investorWallet: string;
    status: DistributionPayoutStatus;
    txHash?: string | null;
    batchNo?: number | null;
  }): Promise<DistributionPayoutRecord | null>;

  listPayouts(options?: {
    periodId?: string;
    investorWallet?: string;
    status?: DistributionPayoutStatus;
    limit?: number;
  }): Promise<DistributionPayoutRecord[]>;
}
