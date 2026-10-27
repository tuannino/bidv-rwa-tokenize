import type { ChainKey } from '@bidv/shared';
import { assertStatus, StoreUsageError, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ vận hành VAULT (BE-13): khoá vận hành bền theo chain (QĐ-D) và lệnh rút (QĐ-E).
 *
 * Cổng này chỉ LƯU TRỮ. Ai được lấy khoá, giữ khoá bao lâu và khi nào nhả là việc của
 * `lib/bank/vault.service.ts` (cấu hình) và `lib/bank/withdraw.service.ts`.
 */

/** `CONFIG`: một lần lưu cấu hình khoá. `WITHDRAW`: một lệnh rút đang dở. */
export const VAULT_OPERATION_KINDS = ['CONFIG', 'WITHDRAW', 'RECALL'] as const;
export type VaultOperationKind = (typeof VAULT_OPERATION_KINDS)[number];

export const assertVaultOperationKind = (value: string): VaultOperationKind =>
  assertStatus('VaultOperationLock', VAULT_OPERATION_KINDS, value);

export interface VaultOperationLockRecord {
  chain: ChainKey;
  kind: VaultOperationKind;
  refId: string;
  actor: string;
  acquiredAt: string;
}

export interface AcquireVaultLockInput {
  chain: ChainKey;
  kind: VaultOperationKind;
  refId: string;
  actor: string;
  /**
   * Chỉ cho lần lấy khoá `CONFIG`: khoá `CONFIG` đang giữ mà lấy từ TRƯỚC mốc này (treo quá thời
   * gian chờ biên nhận) thì bị tiếp quản trong cùng một câu lệnh. Khoá `WITHDRAW` không bao giờ
   * bị tiếp quản.
   */
  takeOverConfigBefore?: Date;
  /** Chỉ tiếp quản một khoá RECALL treo quá toàn bộ ngân sách thu hồi cộng biên an toàn. */
  takeOverRecallBefore?: Date;
}

export interface IVaultStore extends IVaultWithdrawStore {
  readonly kind: StoreKind;

  /**
   * Lấy khoá vận hành của chain bằng MỘT câu ghi. Trả bản ghi khoá khi lấy được, `null` khi chain
   * đang có thao tác khác giữ khoá. KHÔNG đọc trước rồi ghi: hai tiến trình cùng đọc "chưa ai giữ"
   * sẽ cùng gửi giao dịch.
   */
  acquireOperationLock(input: AcquireVaultLockInput): Promise<VaultOperationLockRecord | null>;

  /** Nhả khoá nếu nó còn thuộc `refId`; `false` khi khoá đã bị tiếp quản hoặc không còn. */
  releaseOperationLock(input: { chain: ChainKey; refId: string }): Promise<boolean>;

  findOperationLock(chain: ChainKey): Promise<VaultOperationLockRecord | null>;
}

/**
 * Trạng thái lệnh rút (BE-13 QĐ-E, FIX-01 G4). Ví nhận chọn ở lệnh khác ví đang đặt trên vault thì
 * lệnh đi qua bước đặt ví nhận (`PAYOUT_*`) trước khi rút:
 *
 *     (tạo) ─► PAYOUT_SENDING ─► PAYOUT_SENT ─► SENDING (đường thẳng, cùng lần tạo lệnh)
 *                   │                 ├──────► PAYOUT_SET ─► SENDING (Người bán bấm gửi rút)
 *                   │                 │             └──────► FAILED (kiểm lại không đạt, huỷ)
 *                   │                 ├──────► FAILED (biên nhận FAILED)
 *                   │                 └──────► PAYOUT_REVIEW ─► FAILED (Kiểm soát viên)
 *                   ├──► FAILED (revert, chắc chắn chưa lên chuỗi)
 *                   └──► PAYOUT_REVIEW (mất mã)
 *     (tạo) ─► SENDING ─► SENT ─► COMPLETED
 *                  │        ├───► FAILED
 *                  │        └───► NEEDS_REVIEW ─► COMPLETED / FAILED (Kiểm soát viên)
 *                  ├───► FAILED        (revert hoặc RPC từ chối TRƯỚC khi gửi)
 *                  └───► NEEDS_REVIEW  (mất mã giao dịch)
 */
export const WITHDRAW_STATUSES = [
  'PAYOUT_SENDING',
  'PAYOUT_SENT',
  'PAYOUT_SET',
  'PAYOUT_REVIEW',
  'SENDING',
  'SENT',
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW',
] as const;
export type WithdrawStatus = (typeof WITHDRAW_STATUSES)[number];

export const assertWithdrawStatus = (value: string): WithdrawStatus =>
  assertStatus('WithdrawRequest', WITHDRAW_STATUSES, value);

/** Bảng chuyển tiếp trong mã: cả hai bản cổng từ chối chuyển nào không có ở đây. */
export const WITHDRAW_TRANSITIONS: Readonly<Record<WithdrawStatus, readonly WithdrawStatus[]>> = {
  PAYOUT_SENDING: ['PAYOUT_SENT', 'FAILED', 'PAYOUT_REVIEW'],
  PAYOUT_SENT: ['SENDING', 'PAYOUT_SET', 'FAILED', 'PAYOUT_REVIEW'],
  PAYOUT_SET: ['SENDING', 'FAILED'],
  PAYOUT_REVIEW: ['FAILED'],
  SENDING: ['SENT', 'FAILED', 'NEEDS_REVIEW'],
  SENT: ['COMPLETED', 'FAILED', 'NEEDS_REVIEW'],
  NEEDS_REVIEW: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
};

/** Trạng thái cuối: chuyển sang đây thì `activeChain` về NULL trong cùng câu cập nhật. */
export const WITHDRAW_TERMINAL_STATUSES: readonly WithdrawStatus[] = ['COMPLETED', 'FAILED'];

/** Cả hai bản cổng gọi hàm này trước khi ghi: chuyển không có trong bảng là lỗi lập trình. */
export function assertWithdrawTransition(from: WithdrawStatus, to: WithdrawStatus): void {
  if (!WITHDRAW_TRANSITIONS[assertWithdrawStatus(from)].includes(assertWithdrawStatus(to))) {
    throw new StoreUsageError(`Lệnh rút không chuyển được từ ${from} sang ${to}.`);
  }
}

export interface WithdrawRequestRecord {
  id: string;
  chain: ChainKey;
  clientRequestId: string;
  /** VNDB, chuỗi chữ số. */
  amount: string;
  purpose: string;
  note: string | null;
  payoutWallet: string;
  status: WithdrawStatus;
  activeChain: ChainKey | null;
  claimedBlock: string | null;
  txHash: string | null;
  /** FIX-01: mã giao dịch đặt ví nhận của lệnh, lưu TRƯỚC khi chờ biên nhận. */
  payoutTxHash: string | null;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface NewWithdrawRequest {
  /** Mã do nghiệp vụ cấp trước, để trùng với `refId` của khoá vận hành. */
  id: string;
  chain: ChainKey;
  clientRequestId: string;
  amount: string;
  purpose: string;
  note: string | null;
  payoutWallet: string;
  claimedBlock: string | null;
  createdBy: string;
  /** FIX-01 G5 bước 6: `PAYOUT_SENDING` khi ví chọn khác ví đang đặt trên vault, ngược lại `SENDING`. */
  status: Extract<WithdrawStatus, 'PAYOUT_SENDING' | 'SENDING'>;
}

export interface WithdrawTransition {
  id: string;
  from: WithdrawStatus;
  to: WithdrawStatus;
  /** Ghi khi chuyển `SENDING -> SENT` hoặc khi Kiểm soát viên xác nhận `COMPLETED`. */
  txHash?: string;
  /** FIX-01: ghi khi chuyển `PAYOUT_SENDING -> PAYOUT_SENT`. */
  payoutTxHash?: string;
  reason?: string | null;
}

export interface IVaultWithdrawStore {
  /**
   * Tạo lệnh ở trạng thái đầu `input.status`, `activeChain = chain`. Ném `UniqueConstraintError` khi trùng
   * `(chain, clientRequestId)` hoặc chain đã có lệnh đang dở (`activeChain`).
   */
  createWithdrawRequest(input: NewWithdrawRequest): Promise<WithdrawRequestRecord>;
  findWithdrawRequest(id: string): Promise<WithdrawRequestRecord | null>;
  findWithdrawByClientRequest(input: { chain: ChainKey; clientRequestId: string }): Promise<WithdrawRequestRecord | null>;
  findWithdrawByTxHash(txHash: string): Promise<WithdrawRequestRecord | null>;
  /**
   * Chuyển có điều kiện: chỉ khi trạng thái hiện tại đúng `from` (câu `UPDATE ... WHERE status`).
   * `null` khi lệnh không còn ở `from` (tiến trình khác đã chuyển). Ném `StoreUsageError` khi
   * chuyển không có trong `WITHDRAW_TRANSITIONS`, `UniqueConstraintError` khi `txHash` đã gán lệnh khác.
   */
  transitionWithdrawRequest(input: WithdrawTransition): Promise<WithdrawRequestRecord | null>;
  /** Mới nhất trước, rồi `id` giảm dần để phân trang ổn định. */
  listWithdrawRequests(options: {
    chain: ChainKey;
    createdBy?: string;
    statuses?: readonly WithdrawStatus[];
    limit?: number;
  }): Promise<WithdrawRequestRecord[]>;
}
