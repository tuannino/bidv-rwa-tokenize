import type { ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import type { NewAudit } from './store.port';
import { assertStatus, StoreUsageError, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ YÊU CẦU MINT / BURN theo mô hình lập–duyệt (bảng `TokenRequest`, BE-12).
 *
 * Cổng này chỉ LƯU TRỮ và giữ hai bất biến mà nghiệp vụ không được tự giữ trong mã:
 *   1. Chuyển trạng thái MỘT CHIỀU — bảng `TOKEN_REQUEST_TRANSITIONS` dưới đây.
 *   2. Chuyển trạng thái CÓ ĐIỀU KIỆN — điều kiện trạng thái nguồn nằm trong chính câu `UPDATE`.
 *
 * Kiểm điều kiện nghiệp vụ (trần còn lại, ví đích, nguồn Burn), người lập ≠ người duyệt, gọi
 * ledger là việc của `lib/bank/token-request.service.ts`.
 */

export const TOKEN_REQUEST_TYPES = ['MINT', 'BURN'] as const;
export type TokenRequestType = (typeof TOKEN_REQUEST_TYPES)[number];

/**
 * Nguồn của yêu cầu Burn.
 *
 * `UNDISTRIBUTED` phần chưa phân phối — WPT còn nằm trong ví thanh toán của người bán.
 * `TOTAL_SUPPLY`  toàn bộ nguồn cung — chỉ hợp lệ khi KHÔNG còn token nào đang lưu hành.
 */
export const TOKEN_REQUEST_BURN_SOURCES = ['UNDISTRIBUTED', 'TOTAL_SUPPLY'] as const;
export type TokenRequestBurnSource = (typeof TOKEN_REQUEST_BURN_SOURCES)[number];

/**
 * Năm trạng thái:
 *
 *     PENDING ──► EXECUTING ──► COMPLETED
 *        │            └──► FAILED
 *        └──► REJECTED
 *
 * Tài liệu yêu cầu gọi tên ba trạng thái (chờ duyệt, hoàn tất, từ chối). Hai trạng thái thêm
 * là bắt buộc để giữ đúng ràng buộc "hai người cùng duyệt chỉ một lần tác động token":
 *
 * - `EXECUTING` là đích của lần CHIẾM QUYỀN duyệt. Không có nó thì câu `UPDATE` có điều kiện
 *   chỉ còn đích `COMPLETED`, tức là phải đánh dấu hoàn tất TRƯỚC khi gửi giao dịch — tiến
 *   trình chết giữa chừng để lại một yêu cầu trông như đã xong mà token chưa hề đổi.
 * - `FAILED` là kết cục khi giao dịch bị chuỗi từ chối. Gộp vào `REJECTED` thì sổ không còn
 *   phân biệt được "Kiểm soát viên không đồng ý" với "chuỗi không thực hiện được".
 */
export const TOKEN_REQUEST_STATUSES = [
  'PENDING',
  'EXECUTING',
  'COMPLETED',
  'REJECTED',
  'FAILED',
] as const;
export type TokenRequestStatus = (typeof TOKEN_REQUEST_STATUSES)[number];

/** Chuyển tiếp hợp lệ. Trạng thái không có khoá ở đây là trạng thái KẾT THÚC. */
export const TOKEN_REQUEST_TRANSITIONS: Readonly<
  Partial<Record<TokenRequestStatus, readonly TokenRequestStatus[]>>
> = {
  PENDING: ['EXECUTING', 'REJECTED'],
  EXECUTING: ['COMPLETED', 'FAILED'],
};

export const assertTokenRequestStatus = (value: string): TokenRequestStatus =>
  assertStatus('TokenRequest', TOKEN_REQUEST_STATUSES, value);

export const assertTokenRequestType = (value: string): TokenRequestType =>
  assertStatus('TokenRequest.type', TOKEN_REQUEST_TYPES, value);

export const assertTokenRequestBurnSource = (value: string): TokenRequestBurnSource =>
  assertStatus('TokenRequest.burnSource', TOKEN_REQUEST_BURN_SOURCES, value);

/**
 * Chặn chuyển tiếp ngược chiều TRƯỚC khi chạm dữ liệu — ở cả hai bản.
 *
 * Câu `UPDATE` có điều kiện chỉ nói "trạng thái hiện tại có nằm trong `from` không"; nó không
 * biết `from → to` có hợp lệ không. Thiếu phép kiểm này thì một lời gọi
 * `{ from: ['COMPLETED'], to: 'PENDING' }` sẽ mở lại một yêu cầu đã tác động token.
 */
export function assertTokenRequestTransition(
  from: readonly TokenRequestStatus[],
  to: TokenRequestStatus,
): void {
  if (from.length === 0) {
    throw new StoreUsageError('"from" rỗng — phải nêu trạng thái nguồn được phép.');
  }
  for (const source of from) {
    if (!TOKEN_REQUEST_TRANSITIONS[source]?.includes(to)) {
      throw new StoreUsageError(
        `Chuyển "${source}" → "${to}" không hợp lệ cho yêu cầu Mint/Burn: trạng thái chỉ đi một chiều.`,
      );
    }
  }
}

/** Đích của lần QUYẾT ĐỊNH (duyệt hoặc từ chối) — ghi mốc `decidedAt`. */
export const DECISION_STATUSES: readonly TokenRequestStatus[] = ['EXECUTING', 'REJECTED'];
/** Đích của KẾT CỤC on-chain — ghi mốc `completedAt`. */
export const OUTCOME_STATUSES: readonly TokenRequestStatus[] = ['COMPLETED', 'FAILED'];

export interface TokenRequestRecord {
  id: string;
  chain: ChainKey;
  tokenSymbol: string;
  type: TokenRequestType;
  /** Số lượng token, dạng CHUỖI — `bigint` không qua được biên máy chủ sang trình duyệt. */
  amount: string;
  /** Chỉ Burn; Mint là `null`. */
  burnSource: TokenRequestBurnSource | null;
  wallet: string;
  reason: string;
  documentRef: string | null;
  effectiveDate: string | null;
  note: string | null;
  makerId: string;
  makerRole: Role;
  checkerId: string | null;
  checkerRole: Role | null;
  status: TokenRequestStatus;
  rejectReason: string | null;
  failureReason: string | null;
  txHash: string | null;
  createdAt: string;
  decidedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface NewTokenRequest {
  chain: ChainKey;
  tokenSymbol: string;
  type: TokenRequestType;
  amount: string;
  burnSource?: TokenRequestBurnSource | null;
  wallet: string;
  reason: string;
  documentRef?: string | null;
  effectiveDate?: string | null;
  note?: string | null;
  makerId: string;
  makerRole: Role;
}

/** Một lần chuyển trạng thái CÓ ĐIỀU KIỆN. Trường `undefined` = không chạm cột. */
export interface TokenRequestTransition {
  id: string;
  from: readonly TokenRequestStatus[];
  to: TokenRequestStatus;
  checkerId?: string;
  checkerRole?: Role;
  rejectReason?: string;
  failureReason?: string;
  txHash?: string;
}

/**
 * Chốt KẾT CỤC on-chain của một yêu cầu đang `EXECUTING` (HF-05), cùng mọi tác động database đi
 * kèm, trong MỘT đơn vị nguyên tử.
 *
 * Vì sao không chỉ đưa câu chuyển trạng thái lên trước: chuyển `COMPLETED` rồi mới ghi sổ thì
 * tiến trình chết ở giữa để lại yêu cầu `COMPLETED` thiếu dòng sổ, và không lượt nào ghi bù được
 * (lượt sau thấy `COMPLETED` nên dừng). Gom lại thì chỉ có hai kết cục: đủ cả, hoặc không có gì
 * (yêu cầu còn `EXECUTING`, đối soát lại được).
 */
export interface TokenRequestFinalization {
  id: string;
  to: Extract<TokenRequestStatus, 'COMPLETED' | 'FAILED'>;
  txHash?: string;
  failureReason?: string;
  /**
   * Mint: ghi mốc phát hành cho dự án này nếu CHƯA có. Đã có thì không phải lỗi: mỗi chain chỉ
   * có một yêu cầu Mint đang chờ (BE-12), nên không có hai yêu cầu khác nhau tranh mốc.
   */
  markIssuedProjectId?: string;
  /** Dòng sổ kiểm toán ghi CÙNG đơn vị nguyên tử, theo thứ tự. */
  audits: readonly NewAudit[];
}

export interface ITokenRequestStore {
  readonly kind: StoreKind;

  /** Luôn tạo ở `PENDING`: yêu cầu mới lập chưa được tác động token. */
  createRequest(request: NewTokenRequest): Promise<TokenRequestRecord>;
  findRequest(id: string): Promise<TokenRequestRecord | null>;

  /**
   * KHOÁ LẠC QUAN. Trả `null` khi trạng thái hiện tại không nằm trong `from` — một tiến trình
   * khác đã chiếm hoặc yêu cầu đã đóng. Người gọi PHẢI dừng khi nhận `null`.
   *
   * Tự ghi `decidedAt` khi đích là quyết định, `completedAt` khi đích là kết cục on-chain.
   */
  transitionRequest(transition: TokenRequestTransition): Promise<TokenRequestRecord | null>;

  /**
   * Gắn mã giao dịch vào yêu cầu ĐANG `EXECUTING`, không đổi trạng thái — để giao dịch có vết
   * ngay khi gửi, TRƯỚC khi đợi biên nhận.
   */
  attachRequestTxHash(input: { id: string; txHash: string }): Promise<TokenRequestRecord | null>;

  /**
   * HF-05: chốt yêu cầu `EXECUTING` sang `COMPLETED` hoặc `FAILED`, ghi mốc phát hành (Mint) và
   * các dòng sổ trong MỘT transaction. Trả `null` khi yêu cầu không còn `EXECUTING`: lượt khác
   * đã chốt; khi đó KHÔNG ghi gì. Lỗi giữa chừng thì không có gì được ghi.
   */
  finalizeTokenRequest(input: TokenRequestFinalization): Promise<TokenRequestRecord | null>;

  listRequests(options?: {
    chain?: ChainKey;
    tokenSymbol?: string;
    type?: TokenRequestType;
    status?: TokenRequestStatus;
    makerId?: string;
    limit?: number;
  }): Promise<TokenRequestRecord[]>;

  /**
   * Đếm theo trạng thái, lọc theo người lập. Đếm ở cơ sở dữ liệu chứ không `list` rồi lấy độ
   * dài: `list` mặc định cắt ở 50 dòng, nên số đếm sẽ đứng ở 50 mà không ai biết.
   */
  countRequests(options: {
    chain?: ChainKey;
    status: TokenRequestStatus;
    makerId?: string;
    excludeMakerId?: string;
    /** FE-22: thẻ số liệu tách yêu cầu tạo và yêu cầu huỷ token. */
    type?: TokenRequestType;
    /**
     * FE-22: chỉ đếm yêu cầu có mốc quyết định (`decidedAt`) từ thời điểm này (ISO) trở đi — cho
     * thẻ "đã duyệt hôm nay" / "đã từ chối hôm nay". Yêu cầu chưa có quyết định không bao giờ khớp.
     */
    decidedFrom?: string;
  }): Promise<number>;
}
