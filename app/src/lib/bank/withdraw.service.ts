import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import {
  getLedger,
  LedgerError,
  receiptTimeoutFor,
  type ILedgerPort,
  type VaultWithdrawal,
} from '@/lib/ledger';
import { can, ForbiddenError, type Action, type Role } from '@/lib/rbac';
import { currentActorId } from '@/lib/rbac/session';
import {
  getStore,
  getVaultStore,
  UniqueConstraintError,
  type WithdrawRequestRecord,
  type WithdrawStatus,
} from '@/lib/store';
import { authorize, toResult } from './authorize';
import { signerAddressOrNull } from './issuance.service';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';

/**
 * Lệnh rút VNDB của Người bán từ vault (BE-13 QĐ-E, QĐ-F).
 *
 * Cam kết là "KHÔNG TỰ GỬI LẠI", không phải "đúng một lần chứng minh được trên chuỗi": sự kiện
 * `Withdrawn` không mang mã lệnh (chủ dự án chốt không sửa hợp đồng, nợ QĐ-J). Vì vậy:
 *  - mỗi lệnh giữ khoá vận hành `WITHDRAW` của chain từ lúc tạo tới trạng thái cuối, và cột
 *    `activeChain` chốt thêm ở chính bảng lệnh: mỗi chain một lệnh đang dở;
 *  - mã giao dịch lưu TRƯỚC khi chờ biên nhận; mất mã thì đối soát chuyển `NEEDS_REVIEW` kèm sự
 *    kiện ứng viên cho Kiểm soát viên xem, không bao giờ tự kết luận `COMPLETED` hay gửi lại.
 */

const OTP_PATTERN = /^\d{6}$/;
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const createWithdrawSchema = z.object({
  chain: chainSchema,
  amount: z.string().trim().max(80),
  purpose: z.string().trim().min(1, 'Nhập mục đích rút.').max(200),
  note: z.string().trim().max(500).optional().default(''),
  // Không giới hạn dạng ở đây: sai dạng phải đi qua đúng một câu lỗi riêng, không lộ giá trị.
  otp: z.string().max(20),
  clientRequestId: z.string().uuid('Mã chống trùng phải là UUID.'),
});

const chainOnlySchema = z.object({ chain: chainSchema });

const resolveSchema = z.object({
  chain: chainSchema,
  id: z.string().min(1).max(80),
  outcome: z.enum(['COMPLETED', 'FAILED']),
  txHash: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(500).optional(),
});

export interface WithdrawRequestView {
  id: string;
  chain: ChainKey;
  amount: string;
  purpose: string;
  note: string | null;
  payoutWallet: string;
  status: WithdrawStatus;
  txHash: string | null;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface WithdrawCandidateView {
  txHash: string;
  blockNumber: string;
  to: string;
  amount: string;
  operator: string;
}

export interface WithdrawReviewView extends WithdrawRequestView {
  /** Sự kiện `Withdrawn` từ `claimedBlock` khớp ví nhận, số tiền và ví ký máy chủ (chỉ để xem). */
  candidates: WithdrawCandidateView[];
}

const toView = (record: WithdrawRequestRecord): WithdrawRequestView => ({
  id: record.id,
  chain: record.chain,
  amount: record.amount,
  purpose: record.purpose,
  note: record.note,
  payoutWallet: record.payoutWallet,
  status: record.status,
  txHash: record.txHash,
  reason: record.reason,
  createdBy: record.createdBy,
  createdAt: record.createdAt,
  completedAt: record.completedAt,
});

const sameAddress = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Sự kiện của biên nhận khớp đúng lệnh: tới ví nhận đã chụp, đúng số tiền. */
const matchesRequest = (request: WithdrawRequestRecord, event: VaultWithdrawal) =>
  sameAddress(event.to, request.payoutWallet) && event.amount === BigInt(request.amount);

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Kiểm quyền với một trong nhiều quyền, vẫn ghi audit như `authorize`. */
function anyOf(actions: readonly Action[]) {
  return (role: Role, action: Action) => {
    if (!actions.some((candidate) => can(role, candidate))) throw new ForbiddenError(role, action);
  };
}

function audit(
  role: Role,
  action: Action,
  chain: ChainKey,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
  target: string | null = null,
) {
  return getStore().appendAudit({ actorRole: role, action, target, outcome, detail, chain });
}

/** Nhả khoá vận hành của lệnh (refId = mã lệnh) khi lệnh về trạng thái cuối. */
const releaseLock = (request: Pick<WithdrawRequestRecord, 'chain' | 'id'>) =>
  getVaultStore().releaseOperationLock({ chain: request.chain, refId: request.id });

// =============================================================================
//  TẠO LỆNH
// =============================================================================

/**
 * Người bán tạo lệnh rút (QĐ-E). Thứ tự:
 *  1. kiểm quyền `vault:withdraw`; kiểm `otp` đúng sáu chữ số (CH-2), mã không lưu, không vào log,
 *     audit hay câu lỗi;
 *  2. tra `clientRequestId`: cùng nội dung trả lệnh cũ, khác nội dung từ chối;
 *  3. lấy khoá vận hành `WITHDRAW`;
 *  4. kiểm vault, số tiền, ví nhận, tạm dừng, `amount <= withdrawable` đọc trên chuỗi NGAY LÚC NÀY;
 *  5. tạo bản ghi `SENDING` với `claimedBlock`;
 *  6. gửi, lưu mã giao dịch (`SENT`) TRƯỚC khi chờ biên nhận, chốt theo biên nhận, nhả khoá khi về
 *     trạng thái cuối;
 *  7. audit cả bốn kết cục.
 */
export async function createWithdrawRequest(input: unknown): Promise<Result<WithdrawRequestView>> {
  const parsed = createWithdrawSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    // Không trả lại gì từ ô mã một lần, kể cả thông báo của zod.
    delete (fieldErrors as Record<string, unknown>).otp;
    return err('VALIDATION', 'Dữ liệu lệnh rút không hợp lệ.', fieldErrors);
  }
  const { chain, purpose, clientRequestId } = parsed.data;
  const note = parsed.data.note === '' ? null : parsed.data.note;

  let role: Role;
  try {
    role = await authorize('vault:withdraw', null, chain);
  } catch (error) {
    return toResult(error);
  }
  const fail = async (code: Parameters<typeof err>[0], message: string, fieldErrors?: Record<string, string[]>) => {
    await audit(role, 'vault:withdraw', chain, 'FAILURE', `Từ chối trước khi gửi: ${message}`);
    return err<WithdrawRequestView>(code, message, fieldErrors);
  };

  if (!OTP_PATTERN.test(parsed.data.otp)) {
    return fail('VALIDATION', 'Mã một lần phải đúng sáu chữ số.', { otp: ['Mã một lần phải đúng sáu chữ số.'] });
  }
  if (!/^\d+$/.test(parsed.data.amount) || BigInt(parsed.data.amount) <= 0n) {
    return fail('VALIDATION', 'Số tiền rút là số nguyên VNDB lớn hơn 0.', {
      amount: ['Số tiền rút là số nguyên VNDB lớn hơn 0.'],
    });
  }
  const amount = BigInt(parsed.data.amount);
  const actor = await currentActorId(role);
  const vaultStore = getVaultStore();

  const repeated = await vaultStore.findWithdrawByClientRequest({ chain, clientRequestId });
  if (repeated) return repeatedResult(repeated, { amount, purpose, note, actor });

  const id = randomUUID();
  const lock = await vaultStore.acquireOperationLock({ chain, kind: 'WITHDRAW', refId: id, actor });
  if (!lock) {
    const held = await vaultStore.findOperationLock(chain);
    return fail(
      'VAULT_BUSY',
      `Vault đang có thao tác khác (${held?.kind === 'CONFIG' ? 'Kiểm soát viên đang lưu cấu hình khoá' : 'đã có lệnh rút đang dở'}); thử lại sau.`,
    );
  }

  let created: WithdrawRequestRecord | null = null;
  try {
    const ledger = getLedger(chain);
    const status = await ledger.vaultStatus();
    if (!status) return await fail('VALIDATION', `Chain "${chain}" không có vault thanh toán SPV để rút.`);
    if (!status.payoutWallet) {
      return await fail('WITHDRAW_STATE', 'Vault chưa có ví nhận tiền rút; liên hệ Kiểm soát viên đặt ví nhận.');
    }
    if (sameAddress(status.payoutWallet, status.address)) {
      return await fail('WITHDRAW_STATE', 'Ví nhận đang trùng địa chỉ vault; liên hệ Kiểm soát viên sửa cấu hình.');
    }
    if (status.withdrawalsPaused) return await fail('WITHDRAW_STATE', 'Vault đang tạm dừng rút.');
    if (amount > status.withdrawable) {
      return await fail('VALIDATION', `Số tiền rút ${amount} VNDB vượt phần được rút ${status.withdrawable} VNDB.`, {
        amount: [`Tối đa ${status.withdrawable} VNDB.`],
      });
    }

    const claimedBlock = await ledger.latestBlockNumber();
    try {
      created = await vaultStore.createWithdrawRequest({
        id,
        chain,
        clientRequestId,
        amount: amount.toString(),
        purpose,
        note,
        payoutWallet: status.payoutWallet,
        claimedBlock: claimedBlock.toString(),
        createdBy: actor,
      });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError) || error.table !== 'WithdrawRequest') throw error;
      if (error.columns.join('|') === 'chain|clientRequestId') {
        const winner = await vaultStore.findWithdrawByClientRequest({ chain, clientRequestId });
        if (winner) return repeatedResult(winner, { amount, purpose, note, actor });
      }
      return await fail('VAULT_BUSY', 'Chain đã có lệnh rút đang dở; chờ lệnh đó kết thúc.');
    }

    return await sendWithdraw(ledger, created, role);
  } catch (error) {
    return toResult(error);
  } finally {
    // Chưa tạo được lệnh thì khoá không thuộc lệnh nào: nhả ngay.
    if (!created) await vaultStore.releaseOperationLock({ chain, refId: id });
  }
}

function repeatedResult(
  record: WithdrawRequestRecord,
  intent: { amount: bigint; purpose: string; note: string | null; actor: string },
): Result<WithdrawRequestView> {
  const same =
    record.amount === intent.amount.toString() &&
    record.purpose === intent.purpose &&
    record.note === intent.note &&
    record.createdBy === intent.actor;
  if (!same) {
    return err('WITHDRAW_STATE', `Mã chống trùng ${record.clientRequestId} đã dùng cho một lệnh rút có nội dung khác.`);
  }
  return ok(toView(record));
}

/** Gửi `withdraw`, lưu mã TRƯỚC khi chờ, chốt theo biên nhận. Không bao giờ gọi lại cho cùng lệnh. */
async function sendWithdraw(
  ledger: ILedgerPort,
  request: WithdrawRequestRecord,
  role: Role,
): Promise<Result<WithdrawRequestView>> {
  const { chain } = request;
  const vaultStore = getVaultStore();
  const store = getStore();
  const amount = BigInt(request.amount);

  let txHash: string;
  try {
    txHash = (await ledger.withdrawFromVault(amount)).txHash;
  } catch (error) {
    if (error instanceof LedgerError && error.reverted) {
      // Mô phỏng revert: chắc chắn chưa lên chuỗi.
      const failed = await vaultStore.transitionWithdrawRequest({
        id: request.id,
        from: 'SENDING',
        to: 'FAILED',
        reason: error.message,
      });
      await releaseLock(request);
      await audit(role, 'vault:withdraw', chain, 'FAILURE', `Lệnh rút ${request.id} ${amount} VNDB thất bại trước khi gửi: ${error.message}`, request.payoutWallet);
      return err('LEDGER', error.message, failed ? undefined : { id: [request.id] });
    }
    // Không chắc đã gửi hay chưa: để `SENDING`, đối soát sẽ chuyển người xem. KHÔNG gửi lại.
    await audit(role, 'vault:withdraw', chain, 'FAILURE', `Lệnh rút ${request.id} chưa rõ đã gửi: ${errorMessage(error)}`, request.payoutWallet);
    return err('LEDGER', `Chưa rõ giao dịch rút đã lên chuỗi hay chưa: ${errorMessage(error)} Lệnh giữ ở trạng thái đang gửi để đối soát.`);
  }

  // Lưu mã giao dịch TRƯỚC khi chờ biên nhận. Lỗi ở đây để lệnh ở `SENDING` không mã: đối soát
  // chuyển `NEEDS_REVIEW` kèm sự kiện ứng viên.
  const sent = await vaultStore.transitionWithdrawRequest({ id: request.id, from: 'SENDING', to: 'SENT', txHash });
  if (!sent) throw new Error(`Lệnh rút ${request.id} không còn ở trạng thái đang gửi.`);
  const txn = await store.saveTxn({
    chain,
    operation: 'vault:withdraw',
    txHash,
    status: 'PENDING',
    fromWallet: null,
    toWallet: request.payoutWallet,
    amount: request.amount,
    reason: null,
    actorRole: role,
    actorAddress: await signerAddressOrNull(chain),
  });

  const receipt = await ledger.waitReceipt(txHash, receiptTimeoutFor(chain));
  if (receipt.status === 'PENDING') {
    await audit(role, 'vault:withdraw', chain, 'SUCCESS', `Đã gửi lệnh rút ${request.id} ${amount} VNDB, tx ${txHash}; chưa có biên nhận.`, request.payoutWallet);
    return ok(toView(sent));
  }
  await store.updateTxnStatus(txn.id, receipt.status, receipt.reason);
  const settled = await settleSent(ledger, sent, role);
  return ok(toView(settled ?? sent));
}

/**
 * Chốt lệnh `SENT` theo biên nhận: thành công VÀ có `Withdrawn` khớp thì `COMPLETED`; revert thì
 * `FAILED`; thành công mà không có sự kiện khớp thì `NEEDS_REVIEW`. Chưa có biên nhận thì giữ nguyên.
 */
async function settleSent(
  ledger: ILedgerPort,
  request: WithdrawRequestRecord,
  role: Role,
): Promise<WithdrawRequestRecord | null> {
  const txHash = request.txHash!;
  const receipt = await ledger.vaultWithdrawalReceipt(txHash);
  if (!receipt) return null;
  const vaultStore = getVaultStore();
  const amount = request.amount;
  if (receipt.status === 'FAILED') {
    const failed = await vaultStore.transitionWithdrawRequest({
      id: request.id,
      from: 'SENT',
      to: 'FAILED',
      reason: `Giao dịch ${txHash} bị revert trên chuỗi.`,
    });
    if (failed) {
      await releaseLock(request);
      await audit(role, 'vault:withdraw', request.chain, 'FAILURE', `Lệnh rút ${request.id} ${amount} VNDB bị revert, tx ${txHash}.`, request.payoutWallet);
    }
    return failed;
  }
  if (receipt.withdrawals.some((event) => matchesRequest(request, event))) {
    const completed = await vaultStore.transitionWithdrawRequest({ id: request.id, from: 'SENT', to: 'COMPLETED' });
    if (completed) {
      await releaseLock(request);
      await audit(role, 'vault:withdraw', request.chain, 'SUCCESS', `Lệnh rút ${request.id} hoàn tất: ${amount} VNDB tới ${request.payoutWallet}, tx ${txHash}.`, request.payoutWallet);
    }
    return completed;
  }
  const review = await vaultStore.transitionWithdrawRequest({
    id: request.id,
    from: 'SENT',
    to: 'NEEDS_REVIEW',
    reason: `Biên nhận ${txHash} thành công nhưng không có sự kiện Withdrawn tới ${request.payoutWallet} đúng ${amount} VNDB.`,
  });
  if (review) {
    await audit(role, 'vault:withdraw', request.chain, 'FAILURE', `Lệnh rút ${request.id} chuyển người xem: ${review.reason}`, request.payoutWallet);
  }
  return review;
}

// =============================================================================
//  ĐỐI SOÁT
// =============================================================================

/** Sự kiện ứng viên của lệnh mất mã: từ `claimedBlock`, đúng ví nhận, số tiền, ví ký máy chủ. */
async function candidatesFor(ledger: ILedgerPort, request: WithdrawRequestRecord): Promise<VaultWithdrawal[]> {
  const operator = await signerAddressOrNull(request.chain);
  const events = await ledger.findVaultWithdrawals({
    fromBlock: BigInt(request.claimedBlock ?? '0'),
    to: request.payoutWallet,
    amount: BigInt(request.amount),
  });
  return events.filter((event) => operator === null || sameAddress(event.operator, operator));
}

const toCandidate = (event: VaultWithdrawal): WithdrawCandidateView => ({
  txHash: event.txHash,
  blockNumber: event.blockNumber.toString(),
  to: event.to,
  amount: event.amount.toString(),
  operator: event.operator,
});

export interface ReconcileWithdrawView {
  requests: WithdrawRequestView[];
}

/**
 * Đối soát lệnh chưa kết thúc của chain (QĐ-E). Idempotent: mọi chuyển là câu có điều kiện trạng
 * thái, chỉ lần chuyển thành công mới ghi audit. Chạy khi vai vận hành bấm đối soát và khi Người bán
 * mở lại màn rút.
 *  - `SENT`: đọc biên nhận và chốt như lúc tạo;
 *  - `SENDING` quá thời gian chờ biên nhận (mất mã giao dịch): LUÔN `NEEDS_REVIEW`, kèm số sự kiện
 *    ứng viên. Không tự `COMPLETED` dù có đúng một ứng viên: sự kiện không mang mã lệnh nên không
 *    chứng minh được thuộc lệnh nào.
 */
export async function reconcileWithdrawRequests(input: unknown): Promise<Result<ReconcileWithdrawView>> {
  const parsed = chainOnlySchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  const { chain } = parsed.data;
  try {
    const role = await authorize('vault:read', null, chain, anyOf(['vault:read', 'vault:withdraw']));
    const vaultStore = getVaultStore();
    const ledger = getLedger(chain);
    const open = await vaultStore.listWithdrawRequests({ chain, statuses: ['SENDING', 'SENT'], limit: 20 });
    const staleBefore = Date.now() - receiptTimeoutFor(chain);
    for (const request of open) {
      if (request.status === 'SENT' && request.txHash) {
        await settleSent(ledger, request, role);
        continue;
      }
      if (request.status === 'SENDING' && Date.parse(request.updatedAt) < staleBefore) {
        const candidates = await candidatesFor(ledger, request);
        const reason =
          'Mất mã giao dịch sau khi gửi; ' +
          (candidates.length === 0
            ? 'chưa thấy sự kiện Withdrawn ứng viên nào.'
            : `${candidates.length} sự kiện Withdrawn ứng viên: ${candidates.map((event) => event.txHash).join(', ')}.`) +
          ' Kiểm soát viên xác nhận bằng mã giao dịch đúng hoặc đánh dấu thất bại.';
        const moved = await vaultStore.transitionWithdrawRequest({ id: request.id, from: 'SENDING', to: 'NEEDS_REVIEW', reason });
        if (moved) await audit(role, 'vault:reconcile', chain, 'FAILURE', `Lệnh rút ${request.id} chuyển người xem: ${reason}`, request.payoutWallet);
      }
    }
    const after = await Promise.all(open.map((request) => vaultStore.findWithdrawRequest(request.id)));
    return ok({ requests: after.filter((row): row is WithdrawRequestRecord => row !== null).map(toView) });
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  XỬ LÝ NEEDS_REVIEW (Kiểm soát viên, QĐ-F)
// =============================================================================

/**
 * Kiểm soát viên chốt lệnh `NEEDS_REVIEW`. Không gửi giao dịch nào.
 *  - `COMPLETED` cần `txHash`: biên nhận thành công, có `Withdrawn` khớp ví nhận và số tiền, mã chưa
 *    gán cho lệnh khác. Đạt thì ghi mã, bổ sung `Txn` nếu chưa có, audit.
 *  - `FAILED` cần `reason`.
 * Idempotent: gọi lại với cùng kết cục trên lệnh đã chốt trả lệnh đó, không thêm `Txn` hay audit.
 */
export async function resolveWithdrawRequest(input: unknown): Promise<Result<WithdrawRequestView>> {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu xử lý không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain, id, outcome } = parsed.data;
  const txHash = parsed.data.txHash || undefined;
  const reason = parsed.data.reason || undefined;
  try {
    const role = await authorize('vault:reconcile', id, chain);
    const vaultStore = getVaultStore();
    const request = await vaultStore.findWithdrawRequest(id);
    if (!request || request.chain !== chain) return err('WITHDRAW_STATE', `Không có lệnh rút ${id} trên chain "${chain}".`);

    if (request.status === outcome && (outcome === 'FAILED' || request.txHash === txHash)) return ok(toView(request));
    if (request.status !== 'NEEDS_REVIEW') {
      return err('WITHDRAW_STATE', `Lệnh rút ${id} đang ở ${request.status}, không phải trạng thái cần xem xét.`);
    }

    if (outcome === 'FAILED') {
      if (!reason) return err('VALIDATION', 'Đánh dấu thất bại cần lý do.', { reason: ['Nhập lý do.'] });
      const failed = await vaultStore.transitionWithdrawRequest({ id, from: 'NEEDS_REVIEW', to: 'FAILED', reason });
      if (!failed) return err('WITHDRAW_STATE', `Lệnh rút ${id} vừa được xử lý ở nơi khác.`);
      await releaseLock(request);
      await audit(role, 'vault:reconcile', chain, 'SUCCESS', `Lệnh rút ${id} đánh dấu thất bại: ${reason}`, request.payoutWallet);
      return ok(toView(failed));
    }

    if (!txHash || !TX_HASH_PATTERN.test(txHash)) {
      return err('VALIDATION', 'Xác nhận hoàn tất cần mã giao dịch dạng 0x + 64 ký tự hex.', { txHash: ['Mã giao dịch không hợp lệ.'] });
    }
    const owner = await vaultStore.findWithdrawByTxHash(txHash);
    if (owner && owner.id !== id) {
      return err('WITHDRAW_STATE', `Mã giao dịch ${txHash} đã gán cho lệnh rút ${owner.id}.`);
    }
    const ledger = getLedger(chain);
    const receipt = await ledger.vaultWithdrawalReceipt(txHash);
    if (!receipt || receipt.status !== 'CONFIRMED' || !receipt.withdrawals.some((event) => matchesRequest(request, event))) {
      await audit(role, 'vault:reconcile', chain, 'FAILURE', `Từ chối xác nhận lệnh rút ${id} bằng ${txHash}: biên nhận không thành công hoặc không có Withdrawn khớp.`, request.payoutWallet);
      return err(
        'WITHDRAW_STATE',
        `Giao dịch ${txHash} không phải lần rút ${request.amount} VNDB tới ${request.payoutWallet} thành công trên chuỗi.`,
      );
    }
    let completed: WithdrawRequestRecord | null;
    try {
      completed = await vaultStore.transitionWithdrawRequest({ id, from: 'NEEDS_REVIEW', to: 'COMPLETED', txHash, reason: null });
    } catch (error) {
      if (error instanceof UniqueConstraintError) return err('WITHDRAW_STATE', `Mã giao dịch ${txHash} đã gán cho lệnh rút khác.`);
      throw error;
    }
    if (!completed) return err('WITHDRAW_STATE', `Lệnh rút ${id} vừa được xử lý ở nơi khác.`);
    const store = getStore();
    if (!(await store.findTxnByHash(chain, txHash))) {
      await store.saveTxn({
        chain,
        operation: 'vault:withdraw',
        txHash,
        status: 'CONFIRMED',
        fromWallet: null,
        toWallet: request.payoutWallet,
        amount: request.amount,
        reason: null,
        actorRole: role,
        actorAddress: await signerAddressOrNull(chain),
      });
    }
    await releaseLock(request);
    await audit(role, 'vault:reconcile', chain, 'SUCCESS', `Lệnh rút ${id} xác nhận hoàn tất bằng ${txHash}.`, request.payoutWallet);
    return ok(toView(completed));
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  ĐỌC
// =============================================================================

/** "Yêu cầu rút của tôi" (QĐ-I): lệnh của chính tài khoản đang thao tác trên chain. */
export async function listMyWithdrawRequests(input: unknown): Promise<Result<WithdrawRequestView[]>> {
  const parsed = chainOnlySchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  const { chain } = parsed.data;
  try {
    const role = await authorize('vault:withdraw', null, chain);
    const createdBy = await currentActorId(role);
    const rows = await getVaultStore().listWithdrawRequests({ chain, createdBy, limit: 50 });
    return ok(rows.map(toView));
  } catch (error) {
    return toResult(error);
  }
}

/** "Lệnh rút cần xem xét" trên `/vault` (QĐ-F), kèm sự kiện ứng viên đọc trực tiếp từ chuỗi. */
export async function listWithdrawReviews(input: unknown): Promise<Result<WithdrawReviewView[]>> {
  const parsed = chainOnlySchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  const { chain } = parsed.data;
  try {
    await authorize('vault:read', null, chain);
    const ledger = getLedger(chain);
    const rows = await getVaultStore().listWithdrawRequests({ chain, statuses: ['NEEDS_REVIEW'], limit: 20 });
    return ok(
      await Promise.all(
        rows.map(async (row) => ({ ...toView(row), candidates: (await candidatesFor(ledger, row)).map(toCandidate) })),
      ),
    );
  } catch (error) {
    return toResult(error);
  }
}
