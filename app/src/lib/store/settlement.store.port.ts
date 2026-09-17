import type { ChainKey } from '@bidv/shared';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ TẤT TOÁN: đợt tất toán (`SettlementRound`) và hồ sơ từng người nắm giữ
 * (`SettlementCase`).
 *
 * Cổng này chỉ LƯU TRỮ. Thứ tự bốn bước, ai được chuyển bước nào, khi nào đốt token là
 * việc của tầng nghiệp vụ (BE-04) — cùng với `can(role, action)` trên
 * `settlement:initiate` / `settlement:set-nav` / `settlement:confirm` / `token:burn`.
 */

/**
 * Trạng thái của một ĐỢT tất toán.
 *
 *     INITIATED ──► IN_PROGRESS ──► COMPLETED
 */
export const SETTLEMENT_ROUND_STATUSES = ['INITIATED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type SettlementRoundStatus = (typeof SETTLEMENT_ROUND_STATUSES)[number];

export const assertSettlementRoundStatus = (value: string): SettlementRoundStatus =>
  assertStatus('SettlementRound', SETTLEMENT_ROUND_STATUSES, value);

/**
 * BỐN trạng thái của hồ sơ một người nắm giữ (R3.2):
 *
 *     NOTIFIED ──► CONFIRMED ──► PAID ──► BURNED
 *
 * ⚠️ ĐỪNG rút gọn còn hai. Màn hình FE-10 cần theo dõi đủ bốn, và gộp `PAID` với `BURNED`
 * là mất đúng cái mốc phân biệt "tiền đã ra khỏi ngân hàng" với "token đã bị thu hồi" —
 * hai việc không nằm trong cùng một giao dịch, nên có thật một khoảng thời gian mà cái
 * trước đã xong và cái sau chưa.
 */
export const SETTLEMENT_CASE_STATUSES = ['NOTIFIED', 'CONFIRMED', 'PAID', 'BURNED'] as const;
export type SettlementCaseStatus = (typeof SETTLEMENT_CASE_STATUSES)[number];

export const assertSettlementCaseStatus = (value: string): SettlementCaseStatus =>
  assertStatus('SettlementCase', SETTLEMENT_CASE_STATUSES, value);

/**
 * Trạng thái → cột thời điểm, và cột mã giao dịch nếu bước đó có giao dịch (R3.3).
 *
 * Là BẢNG DỮ LIỆU chứ không phải chuỗi `if`: thêm bước mới thì thêm một dòng ở đây, và
 * `Record<SettlementCaseStatus, ...>` bắt được trạng thái bị bỏ sót ngay lúc biên dịch.
 *
 * Hai bước đầu có `txHash: null` vì chúng KHÔNG sinh giao dịch nào — thông báo là việc
 * ngoài chuỗi, và xác nhận của nhà đầu tư được ghi nhận ở hệ thống, không phải trên chuỗi.
 */
export const SETTLEMENT_CASE_COLUMNS: Readonly<
  Record<SettlementCaseStatus, { readonly at: string; readonly txHash: string | null }>
> = {
  NOTIFIED: { at: 'notifiedAt', txHash: null },
  CONFIRMED: { at: 'confirmedAt', txHash: null },
  PAID: { at: 'paidAt', txHash: 'paidTxHash' },
  BURNED: { at: 'burnedAt', txHash: 'burnTxHash' },
};

export interface SettlementRoundRecord {
  id: string;
  /** Mã ảnh chụp số dư dùng để lập danh sách người nắm giữ của đợt. */
  snapshotId: number;
  /**
   * Số VNDB trả cho mỗi 1 WPT, CHỐT cho đợt này.
   *
   * Chuỗi chỉ giữ một giá NAV hiện hành (`ILedgerSettlement.navRate`); sửa nó không được
   * làm đổi hồ sơ của đợt đã chốt, nên giá phải được sao vào đây.
   */
  navRate: string;
  status: SettlementRoundStatus;
  chain: ChainKey;
  initiatedAt: string;
  completedAt: string | null;
}

export interface NewSettlementRound {
  snapshotId: number;
  navRate: string;
  chain: ChainKey;
  /** Mặc định `INITIATED`. */
  status?: SettlementRoundStatus;
}

export interface SettlementCaseRecord {
  id: string;
  roundId: string;
  holderWallet: string;
  /** Số WPT phải thu hồi. */
  wptAmount: string;
  /**
   * Số VNDB phải trả, CHỐT tại thời điểm lập hồ sơ — KHÔNG tính lại từ `navRate`.
   *
   * Tính lại thì giá NAV bị sửa sau đó sẽ làm đổi số của hồ sơ đã chốt, kể cả hồ sơ đã
   * chi trả xong.
   */
  payoutAmount: string;
  status: SettlementCaseStatus;
  notifiedAt: string | null;
  confirmedAt: string | null;
  paidAt: string | null;
  paidTxHash: string | null;
  burnedAt: string | null;
  burnTxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewSettlementCase {
  holderWallet: string;
  wptAmount: string;
  payoutAmount: string;
  /** Mặc định `NOTIFIED`. Cột thời điểm tương ứng được đặt luôn khi tạo. */
  status?: SettlementCaseStatus;
}

export interface ISettlementStore {
  readonly kind: StoreKind;

  openRound(round: NewSettlementRound): Promise<SettlementRoundRecord>;
  findRound(id: string): Promise<SettlementRoundRecord | null>;

  listRounds(options?: {
    chain?: ChainKey;
    status?: SettlementRoundStatus;
    limit?: number;
  }): Promise<SettlementRoundRecord[]>;

  /** Trả `null` nếu không có đợt nào mang mã này. */
  setRoundStatus(input: {
    id: string;
    status: SettlementRoundStatus;
    completedAt?: string | null;
  }): Promise<SettlementRoundRecord | null>;

  /**
   * Lập hồ sơ tất toán cho một lô ví. TẤT CẢ HOẶC KHÔNG.
   *
   * Một dòng vi phạm duy nhất `(roundId, holderWallet)` thì cả lô không vào và ném
   * `UniqueConstraintError` (R3.4) — chốt chặn chi trả hoặc đốt trùng cho một ví.
   */
  createCases(input: {
    roundId: string;
    rows: readonly NewSettlementCase[];
  }): Promise<SettlementCaseRecord[]>;

  /**
   * Chuyển hồ sơ sang một trong bốn trạng thái, ghi luôn cột thời điểm tương ứng và cột
   * mã giao dịch nếu bước đó có (theo `SETTLEMENT_CASE_COLUMNS`).
   *
   * Truyền `txHash` cho `NOTIFIED` hoặc `CONFIRMED` là lỗi lời gọi (`StoreUsageError`):
   * hai bước đó không có cột để ghi, nhận im lặng rồi bỏ đi là làm mất dữ liệu người gọi
   * tưởng đã lưu.
   *
   * Cổng KHÔNG kiểm thứ tự bốn bước — đó là bảng chuyển tiếp của nghiệp vụ (BE-04).
   */
  markCase(input: {
    roundId: string;
    holderWallet: string;
    status: SettlementCaseStatus;
    txHash?: string;
  }): Promise<SettlementCaseRecord | null>;

  listCases(options?: {
    roundId?: string;
    holderWallet?: string;
    status?: SettlementCaseStatus;
    limit?: number;
  }): Promise<SettlementCaseRecord[]>;
}
