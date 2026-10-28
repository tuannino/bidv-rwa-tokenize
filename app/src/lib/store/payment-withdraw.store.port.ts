import type { ChainKey } from '@bidv/shared';
import { assertStatus, StoreUsageError, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ LỆNH RÚT VNDB của Nhà đầu tư (FE-23 QĐ-6): chuyển VNDB từ ví của Nhà đầu tư sang ví
 * nhận đã whitelist, giao dịch do chính ví của Nhà đầu tư ký và gửi.
 *
 * Cổng này chỉ LƯU TRỮ. Ai được tạo lệnh, khi nào trả giao dịch cần gửi, và bằng chứng nào đủ để
 * chốt hoàn tất là việc của `lib/bank/payment-withdraw.service.ts`.
 *
 *     (tạo) ─► CREATED ─► SENDING ─► SUBMITTED ─► COMPLETED
 *                 │          │           └──────► FAILED ─────┐
 *                 │          ├──► COMPLETED (quét theo nhãn)  │
 *                 │          ├──► CANCELLED ──────────────────┼──► COMPLETED (quét lại 24 giờ)
 *                 │          └──► EXPIRED ────────────────────┘
 *                 └──► CANCELLED (chưa từng trả giao dịch, không vào diện quét lại)
 */
export const PAYMENT_WITHDRAW_STATUSES = [
  'CREATED',
  'SENDING',
  'SUBMITTED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type PaymentWithdrawStatus = (typeof PAYMENT_WITHDRAW_STATUSES)[number];

export const assertPaymentWithdrawStatus = (value: string): PaymentWithdrawStatus =>
  assertStatus('PaymentWithdrawRequest', PAYMENT_WITHDRAW_STATUSES, value);

/** Bảng chuyển tiếp (requirements mục 4). Cả hai bản cổng từ chối chuyển nào không có ở đây. */
export const PAYMENT_WITHDRAW_TRANSITIONS: Readonly<Record<PaymentWithdrawStatus, readonly PaymentWithdrawStatus[]>> = {
  CREATED: ['SENDING', 'CANCELLED'],
  SENDING: ['SUBMITTED', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
  SUBMITTED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  // Trạng thái cuối "âm": quét lại thấy bằng chứng thì về COMPLETED (QĐ-10).
  FAILED: ['COMPLETED'],
  CANCELLED: ['COMPLETED'],
  EXPIRED: ['COMPLETED'],
};

/** Trạng thái chờ: `activeWallet` có giá trị. Còn lại là trạng thái cuối (`activeWallet` NULL). */
export const PAYMENT_WITHDRAW_PENDING_STATUSES: readonly PaymentWithdrawStatus[] = ['CREATED', 'SENDING', 'SUBMITTED'];

/** Trạng thái cuối "âm": vào diện quét lại 24 giờ khi lệnh đã từng `SENDING`. */
export const PAYMENT_WITHDRAW_NEGATIVE_STATUSES: readonly PaymentWithdrawStatus[] = ['FAILED', 'CANCELLED', 'EXPIRED'];

export function assertPaymentWithdrawTransition(from: PaymentWithdrawStatus, to: PaymentWithdrawStatus): void {
  if (!PAYMENT_WITHDRAW_TRANSITIONS[assertPaymentWithdrawStatus(from)].includes(assertPaymentWithdrawStatus(to))) {
    throw new StoreUsageError(`Lệnh rút VNDB không chuyển được từ ${from} sang ${to}.`);
  }
}

/** Khoá "một lệnh đang dở mỗi ví mỗi chain" (QĐ-5). */
export const activeWalletKey = (chain: ChainKey, wallet: string) => `${chain}:${wallet.toLowerCase()}`;

export interface PaymentWithdrawRecord {
  id: string;
  chain: ChainKey;
  clientRequestId: string;
  actorId: string;
  fromWallet: string;
  /** Ví gửi viết thường. */
  fromWalletKey: string;
  toWallet: string;
  /** VNDB, chuỗi chữ số. */
  amount: string;
  purpose: string;
  note: string | null;
  status: PaymentWithdrawStatus;
  activeWallet: string | null;
  createdBlock: string | null;
  submittedTxHash: string | null;
  submittedAt: string | null;
  sendingAt: string | null;
  completedTxHash: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface NewPaymentWithdraw {
  /** Mã do nghiệp vụ cấp trước: nhãn lệnh dựng từ mã này (QĐ-12). */
  id: string;
  chain: ChainKey;
  clientRequestId: string;
  actorId: string;
  /** Đã chuẩn hoá ở tầng nghiệp vụ; cổng tự dựng khoá viết thường. */
  fromWallet: string;
  toWallet: string;
  amount: string;
  purpose: string;
  note: string | null;
  createdBlock: string | null;
}

export interface PaymentWithdrawTransition {
  id: string;
  from: PaymentWithdrawStatus;
  to: PaymentWithdrawStatus;
  /** Ghi khi chuyển `SENDING -> SUBMITTED`. */
  submittedTxHash?: string;
  /** Ghi khi chuyển sang `COMPLETED`; duy nhất theo chain. */
  completedTxHash?: string;
  reason?: string | null;
}

export interface ListPaymentWithdrawOptions {
  statuses?: readonly PaymentWithdrawStatus[];
  /** Chỉ lệnh có `sendingAt` từ mốc này trở đi (diện quét lại 24 giờ). */
  since?: Date;
  /** Chỉ lệnh đã từng `SENDING` (`sendingAt` khác NULL). */
  sentOnly?: boolean;
  limit: number;
}

export interface IPaymentWithdrawStore {
  readonly kind: StoreKind;

  /**
   * Tạo lệnh `CREATED`, `activeWallet = chain:fromWalletKey`. Ném `UniqueConstraintError` khi trùng
   * `(chain, fromWalletKey, clientRequestId)` hoặc ví đã có lệnh đang dở (`activeWallet`).
   */
  create(input: NewPaymentWithdraw): Promise<PaymentWithdrawRecord>;
  findById(id: string): Promise<PaymentWithdrawRecord | null>;
  findByClientRequest(input: { chain: ChainKey; wallet: string; clientRequestId: string }): Promise<PaymentWithdrawRecord | null>;
  /** Lệnh đang dở của ví trên chain (tối đa một, QĐ-5). */
  findActive(chain: ChainKey, wallet: string): Promise<PaymentWithdrawRecord | null>;
  /** Mới nhất trước, rồi `id` giảm dần. */
  listByWallet(chain: ChainKey, wallet: string, options: ListPaymentWithdrawOptions): Promise<PaymentWithdrawRecord[]>;
  findByCompletedTx(chain: ChainKey, txHash: string): Promise<PaymentWithdrawRecord | null>;
  /**
   * Chuyển có điều kiện: chỉ khi trạng thái hiện tại đúng `from` (câu `UPDATE ... WHERE status`).
   * `null` khi trạng thái đã khác. Sang trạng thái cuối thì `activeWallet` NULL trong cùng câu; sang
   * `SENDING` ghi `sendingAt`, sang `SUBMITTED` ghi `submittedAt`. Ném `StoreUsageError` khi chuyển
   * không có trong bảng, `UniqueConstraintError` khi `completedTxHash` đã gán lệnh khác cùng chain.
   */
  transition(input: PaymentWithdrawTransition): Promise<PaymentWithdrawRecord | null>;
  /** Ghi lý do mà không đổi trạng thái (va ràng buộc `completedTxHash`, QĐ-11). */
  noteReason(input: { id: string; reason: string }): Promise<void>;
}
