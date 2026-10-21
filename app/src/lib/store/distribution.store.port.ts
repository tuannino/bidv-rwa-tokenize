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
 *     OPENING ──► OPEN ──► DISTRIBUTING ──► COMPLETED
 *                   └──────────┴──► EXPIRED ──► CLOSED
 *
 * `OPEN` = đã chốt quyền, chưa chi đồng nào; `DISTRIBUTING` = đã gửi ít nhất một lô;
 * `COMPLETED` = mọi hồ sơ đã `PAID`.
 *
 * SC-06 thêm ba trạng thái:
 * - `OPENING`: đã GIỮ CHỖ mã kỳ trong cơ sở dữ liệu, đang mở trên chuỗi. Chưa biết số tiền và
 *   ảnh chụp (ghi 0) cho tới khi đọc được kỳ từ chuỗi; phục hồi bằng `recoverOpeningPeriod`.
 * - `EXPIRED`: quá hạn nhận trên chuỗi mà còn hồ sơ chưa trả; không gửi lô nữa.
 * - `CLOSED`: kỳ đã đóng trên chuỗi, phần chưa trả đã về quỹ chưa phân bổ.
 * `EXPIRED` và `CLOSED` là trạng thái kết thúc: không chặn tiến trình tự động mở kỳ mới.
 *
 * KHÔNG có `FAILED` cho kỳ: lô lỗi là trạng thái của từng `DistributionPayout`, và một kỳ
 * có lô lỗi thì vẫn phải chạy lại lô đó chứ không "thất bại" như một khối. Đặt `FAILED` ở
 * cấp kỳ sẽ mời người đọc sau bỏ luôn cả kỳ khi mới lỗi một lô.
 */
export const DISTRIBUTION_PERIOD_STATUSES = [
  'OPENING',
  'OPEN',
  'DISTRIBUTING',
  'COMPLETED',
  'EXPIRED',
  'CLOSED',
] as const;
export type DistributionPeriodStatus = (typeof DISTRIBUTION_PERIOD_STATUSES)[number];

export const assertDistributionPeriodStatus = (value: string): DistributionPeriodStatus =>
  assertStatus('DistributionPeriod', DISTRIBUTION_PERIOD_STATUSES, value);

/**
 * FE-08 QĐ-B: kỳ HOẠT ĐỘNG giữ `activeChain = chain`; kỳ ở trạng thái cuối giữ `activeChain = null`.
 * Mọi câu chuyển trạng thái đặt `activeChain` theo bảng này trong CÙNG câu cập nhật, nên ràng buộc
 * duy nhất trên `activeChain` là trọng tài "mỗi chain tối đa một kỳ hoạt động".
 */
export const ACTIVE_PERIOD_STATUSES = ['OPENING', 'OPEN', 'DISTRIBUTING'] as const satisfies readonly DistributionPeriodStatus[];

export const isActivePeriodStatus = (status: DistributionPeriodStatus): boolean =>
  (ACTIVE_PERIOD_STATUSES as readonly DistributionPeriodStatus[]).includes(status);

/**
 * FE-08 QĐ-C: kết luận duyệt của một kỳ.
 *
 * - `APPROVED`: số trên chuỗi bằng số Kiểm soát viên duyệt; được chốt vault và trả.
 * - `AMOUNT_CHANGED`: số trên chuỗi khác số đã duyệt; không chốt vault, không trả, chờ duyệt lại.
 * - `null`: kỳ tạo trước FE-08 (`expectedAmount` rỗng), hoặc kỳ vừa duyệt đang chờ so số thực tế
 *   (`expectedAmount` có giá trị). Cả hai đều KHÔNG được trả.
 */
export const DISTRIBUTION_APPROVAL_STATUSES = ['APPROVED', 'AMOUNT_CHANGED'] as const;
export type DistributionApprovalStatus = (typeof DISTRIBUTION_APPROVAL_STATUSES)[number];

export const assertDistributionApprovalStatus = (value: string): DistributionApprovalStatus =>
  assertStatus('DistributionPeriod.approvalStatus', DISTRIBUTION_APPROVAL_STATUSES, value);

/**
 * Trạng thái của MỘT hồ sơ chia.
 *
 *     PENDING ──► SENT ──► PAID
 *                   └──► FAILED
 *     (chưa PAID) ──► EXPIRED   (SC-06: kỳ hết hạn hoặc đã đóng mà ví chưa nhận)
 *
 * `SENT` tách khỏi `PAID` là bắt buộc, không phải chi li: giữa lúc gửi giao dịch và lúc có
 * biên nhận, hồ sơ đã có `txHash` mà chưa biết kết quả. Gộp hai trạng thái thì tiến trình
 * chết giữa chừng để lại hồ sơ trông như đã chi xong, và lần chạy lại sẽ chi lần thứ hai.
 *
 * `EXPIRED` KHÔNG bao giờ chuyển thành `PAID`: phần của ví không nhận kịp đã trở về quỹ.
 */
export const DISTRIBUTION_PAYOUT_STATUSES = ['PENDING', 'SENT', 'PAID', 'FAILED', 'EXPIRED'] as const;
export type DistributionPayoutStatus = (typeof DISTRIBUTION_PAYOUT_STATUSES)[number];

export const assertDistributionPayoutStatus = (value: string): DistributionPayoutStatus =>
  assertStatus('DistributionPayout', DISTRIBUTION_PAYOUT_STATUSES, value);

/**
 * Đẩy số đã chia của kỳ vào `closePeriod` của vault thanh toán (SC-06 QĐ-G).
 *
 *     (rỗng) ──► PENDING ──► SENT ──► DONE
 *                   └─────────┴──► CONFLICT
 *
 * `PENDING` = đã giữ chỗ mã kỳ vault; `SENT` = đang gửi hoặc đã gửi; `DONE` = sự kiện
 * `PeriodClosed` trên chuỗi khớp số của kỳ; `CONFLICT` = mã kỳ vault đã bị chốt bằng số khác
 * (ví dụ chạy script chen vào): dừng, chờ xử lý tay.
 *
 * HF-04: `CONFLICT` còn một đường ra `CONFLICT ──► DONE`, chỉ khi đối soát lại thấy sự kiện đúng mã kỳ
 * có số khớp (CONFLICT trước đó do RPC đọc log đi sau). Khác số hoặc không có sự kiện thì giữ nguyên.
 */
export const VAULT_CLOSE_STATUSES = ['PENDING', 'SENT', 'DONE', 'CONFLICT'] as const;
export type VaultCloseStatus = (typeof VAULT_CLOSE_STATUSES)[number];

export const assertVaultCloseStatus = (value: string): VaultCloseStatus =>
  assertStatus('DistributionPeriod.vaultCloseStatus', VAULT_CLOSE_STATUSES, value);

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
  /** SC-06: địa chỉ hợp đồng chia giữ kỳ; `null` với kỳ trước SC-06 hoặc đang `OPENING`. */
  distributorAddress: string | null;
  /** SC-06: mã kỳ trên chuỗi; `null` với kỳ trước SC-06 hoặc đang `OPENING`. */
  distributionId: number | null;
  /** SC-06: mã giao dịch mở kỳ, lưu trước khi chờ biên nhận. */
  openTxHash: string | null;
  /** SC-06 QĐ-G: mã kỳ vault đã giữ chỗ. */
  vaultPeriodRef: number | null;
  vaultCloseStatus: VaultCloseStatus | null;
  vaultCloseTxHash: string | null;
  /** FE-08 QĐ-B: kết luận duyệt; xem `DISTRIBUTION_APPROVAL_STATUSES`. */
  approvalStatus: DistributionApprovalStatus | null;
  /** FE-08: số Kiểm soát viên duyệt lần đầu; `null` với kỳ trước FE-08. */
  expectedAmount: string | null;
  /** FE-08: số được duyệt có hiệu lực; `null` khi chưa `APPROVED`. */
  approvedAmount: string | null;
  /** FE-08: mã tài khoản của lần duyệt có hiệu lực (lần duyệt đầu khi chưa có kết luận). */
  approvedBy: string | null;
  approvedAt: string | null;
  /** FE-08: số cũ nếu từng phải duyệt lại. */
  reapprovedFrom: string | null;
  /** FE-08: `chain` khi kỳ hoạt động, `null` khi kỳ ở trạng thái cuối. */
  activeChain: ChainKey | null;
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

  /**
   * SC-06 QĐ-F: GIỮ CHỖ một mã kỳ ở `OPENING` trước khi gửi giao dịch mở kỳ. Ném
   * `UniqueConstraintError` nếu mã đã có: ràng buộc duy nhất là trọng tài giữa hai tiến trình.
   * Ảnh chụp và số tiền ghi 0 cho tới `completeOpening`.
   *
   * FE-08: đặt `activeChain = chain`; chain đã có kỳ hoạt động thì ném `UniqueConstraintError` trên
   * `activeChain`. `approval` ghi số duyệt và người duyệt CÙNG LÚC giữ chỗ (`approvedAt` = bây giờ),
   * kết luận duyệt để trống cho tới khi so với số trên chuỗi.
   */
  reservePeriod(input: {
    periodKey: string;
    chain: ChainKey;
    approval?: { expectedAmount: string; approvedBy: string };
  }): Promise<DistributionPeriodRecord>;

  /** Ghi mã giao dịch mở kỳ NGAY KHI CÓ. Chỉ áp cho kỳ `OPENING`; khác thì trả `null`. */
  setOpenTxHash(input: { id: string; openTxHash: string }): Promise<DistributionPeriodRecord | null>;

  /**
   * `OPENING -> OPEN` với số liệu ĐỌC TỪ CHUỖI. Cập nhật có điều kiện: kỳ không còn `OPENING`
   * (tiến trình khác đã hoàn tất) thì trả `null`, không ghi đè.
   */
  completeOpening(input: {
    id: string;
    distributionId: number;
    distributorAddress: string;
    snapshotId: number;
    totalAmount: string;
    totalSupplyAt: string;
  }): Promise<DistributionPeriodRecord | null>;

  /** Bỏ bản ghi giữ chỗ khi giao dịch mở kỳ CHẮC CHẮN revert. Chỉ xoá được kỳ `OPENING`. */
  deleteOpeningPeriod(id: string): Promise<boolean>;

  /**
   * SC-06 QĐ-G: giữ chỗ mã kỳ vault. Chỉ thành công khi `vaultCloseStatus` đang rỗng, kỳ đã có
   * `distributionId`, và MỌI kỳ có `distributionId` mở trước nó trên cùng chain đã `DONE`.
   */
  reserveVaultClose(input: { id: string; vaultPeriodRef: number }): Promise<DistributionPeriodRecord | null>;

  /**
   * Chuyển trạng thái đẩy vault có điều kiện: chỉ khi trạng thái hiện tại là `from` và (nếu có)
   * mã giao dịch hiện tại đúng `expectedTxHash`. Hai tiến trình cùng thử thì chỉ một thắng.
   * `txHash` không truyền thì giữ nguyên mã đang lưu.
   */
  transitionVaultClose(input: {
    id: string;
    from: VaultCloseStatus;
    to: VaultCloseStatus;
    expectedTxHash?: string | null;
    txHash?: string | null;
  }): Promise<DistributionPeriodRecord | null>;

  /** Mới nhất trước. `offset` để phân trang (FE-08 QĐ-F). */
  listPeriods(options?: {
    chain?: ChainKey;
    status?: DistributionPeriodStatus;
    limit?: number;
    offset?: number;
  }): Promise<DistributionPeriodRecord[]>;

  /** Số kỳ khớp bộ lọc, cho phân trang. */
  countPeriods(options?: { chain?: ChainKey }): Promise<number>;

  /** FE-08: kỳ hoạt động của chain (`activeChain = chain`), hoặc `null`. */
  findActivePeriod(chain: ChainKey): Promise<DistributionPeriodRecord | null>;

  /**
   * FE-08 QĐ-C: ghi kết luận duyệt, CÓ ĐIỀU KIỆN: chỉ khi kỳ còn hoạt động và `approvalStatus`
   * hiện tại đúng bằng `from` (`null` = chưa có kết luận). Hai bên cùng ghi thì chỉ một thắng; bên
   * thua nhận `null`. Trường không truyền giữ nguyên.
   */
  setApproval(input: {
    id: string;
    from: DistributionApprovalStatus | null;
    approvalStatus: DistributionApprovalStatus;
    approvedAmount?: string | null;
    approvedBy?: string;
    approvedAt?: string;
    reapprovedFrom?: string | null;
  }): Promise<DistributionPeriodRecord | null>;

  /**
   * Đổi trạng thái kỳ. Trả `null` nếu không có kỳ nào mang mã này.
   *
   * `completedAt` do người gọi truyền, cổng KHÔNG tự đặt khi status thành `COMPLETED`:
   * "hoàn tất" là kết luận của nghiệp vụ (đã hết hồ sơ phải chi), cổng lưu trữ không biết
   * và không được đoán.
   *
   * FE-08: `activeChain` đặt theo trạng thái mới trong CÙNG câu cập nhật (`null` khi trạng thái
   * cuối, `chain` khi hoạt động).
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

  /** Mới nhất trước. `offset` để phân trang (FE-08 QĐ-F). */
  listPayouts(options?: {
    periodId?: string;
    investorWallet?: string;
    status?: DistributionPayoutStatus;
    limit?: number;
    offset?: number;
  }): Promise<DistributionPayoutRecord[]>;

  /** Số hồ sơ của một kỳ, cho phân trang. */
  countPayouts(options: { periodId: string }): Promise<number>;
}
