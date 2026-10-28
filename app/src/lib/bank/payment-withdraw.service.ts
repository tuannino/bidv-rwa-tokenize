import 'server-only';

import { randomUUID } from 'node:crypto';
import { concat, encodeFunctionData, keccak256, toBytes, type Hex } from 'viem';
import { z } from 'zod';
import {
  addressBook,
  CHAINS,
  getContractAddress,
  profitDistributorAddressFor,
  vaultAddressFor,
  vndTokenAbi,
  type ChainKey,
} from '@bidv/shared';
import { chainFamily } from '@/lib/chains/registry';
import { getLedger, normalizeEvmAddress, type ILedgerPort, type PaymentTransferEvidence } from '@/lib/ledger';
import { assertCan, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import {
  getPaymentWithdrawStore,
  getStore,
  PAYMENT_WITHDRAW_NEGATIVE_STATUSES,
  UniqueConstraintError,
  type PaymentWithdrawRecord,
  type PaymentWithdrawStatus,
} from '@/lib/store';
import { authorize, toResult } from './authorize';
import { PAYOUT_NOT_WHITELISTED, payoutWalletFormatError } from './payout-wallet';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';
import { assertSessionWallet } from './wallet-owner';

/**
 * RÚT VNDB CỦA NHÀ ĐẦU TƯ ra ví nhận đã whitelist (FE-23).
 *
 * VNDB nằm trong CHÍNH ví của Nhà đầu tư: máy chủ không chuyển được, nên ví của Nhà đầu tư ký và gửi
 * giao dịch (QĐ-1), trừ chain họ mock nơi máy chủ chuyển thay (QĐ-4). Máy chủ lập lệnh, trả giao dịch
 * cần gửi ĐÚNG MỘT LẦN (QĐ-13), rồi chỉ chốt hoàn tất khi có bằng chứng trên chuỗi (QĐ-9). Giao dịch
 * mang nhãn của lệnh (32 byte nối sau calldata `transfer`, QĐ-12), nên đối soát tìm được giao dịch của
 * lệnh dù trình duyệt mất mã, và hai lệnh giống nhau không nhận nhầm giao dịch của nhau (QĐ-11).
 */

/** Lệnh `SENDING` chưa có mã, hoặc `SUBMITTED` mà chuỗi không biết mã, quá mốc này thì chốt âm. */
export const PENDING_TTL_MS = 30 * 60_000;
/** Lệnh cuối âm đã từng `SENDING` được quét lại trong cửa sổ này khi mở màn (QĐ-10). */
export const RESCAN_WINDOW_MS = 24 * 60 * 60_000;
export const RESCAN_LIMIT = 5;
const LIST_LIMIT = 50;

const OTP_PATTERN = /^\d{6}$/;
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export const PAYMENT_ACTIVE_MESSAGE = 'Ví đang có lệnh rút chưa xong; chờ hoặc huỷ lệnh đó.';
export const PAYMENT_ALREADY_SENT_MESSAGE = 'Lệnh đã được gửi tới ví; chờ kết quả hoặc huỷ.';
export const PAYMENT_BALANCE_MESSAGE = 'Số dư VNDB không đủ.';
const WALLET_REJECTED_REASON = 'Trình duyệt báo người dùng từ chối ký';

const walletSchema = z.string().trim().max(80);
const idSchema = z.string().min(1).max(80);

const createSchema = z.object({
  chain: chainSchema,
  wallet: walletSchema,
  toWallet: walletSchema,
  amount: z.string().trim().max(80),
  purpose: z.string().trim().min(1, 'Nhập mục đích rút.').max(200),
  note: z.string().trim().max(500).optional().default(''),
  // Không giới hạn dạng ở đây: sai dạng đi qua đúng một câu lỗi riêng, không lộ giá trị.
  otp: z.string().max(20),
  clientRequestId: z.string().uuid('Mã chống trùng phải là UUID.'),
});
const requestSchema = z.object({ chain: chainSchema, id: idSchema });
const submitSchema = z.object({ chain: chainSchema, id: idSchema, txHash: z.string().trim().max(80) });
const cancelSchema = z.object({ chain: chainSchema, id: idSchema, walletRejected: z.boolean().optional().default(false) });
const pageSchema = z.object({ chain: chainSchema, wallet: walletSchema });
const checkSchema = z.object({ chain: chainSchema, wallet: walletSchema, toWallet: walletSchema });

export interface PaymentWithdrawView {
  id: string;
  chain: ChainKey;
  fromWallet: string;
  toWallet: string;
  amount: string;
  purpose: string;
  note: string | null;
  status: PaymentWithdrawStatus;
  submittedTxHash: string | null;
  completedTxHash: string | null;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Giao dịch trình duyệt gửi qua ví đang kết nối: chuyển VNDB, calldata nối nhãn lệnh. */
export interface TxRequest {
  chainId: number;
  to: `0x${string}`;
  data: `0x${string}`;
  value: '0';
}

export interface PaymentWithdrawPageView {
  balance: string;
  requests: PaymentWithdrawView[];
}

const toView = (record: PaymentWithdrawRecord): PaymentWithdrawView => ({
  id: record.id,
  chain: record.chain,
  fromWallet: record.fromWallet,
  toWallet: record.toWallet,
  amount: record.amount,
  purpose: record.purpose,
  note: record.note,
  status: record.status,
  submittedTxHash: record.submittedTxHash,
  completedTxHash: record.completedTxHash,
  reason: record.reason,
  createdAt: record.createdAt,
  completedAt: record.completedAt,
});

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

// =============================================================================
//  HÀM THUẦN
// =============================================================================

/** Nhãn lệnh (QĐ-12): `keccak256` của mã lệnh, 32 byte. */
export function paymentTag(id: string): `0x${string}` {
  return keccak256(toBytes(id));
}

/** Calldata `transfer(ví nhận, số lượng)` NỐI THÊM nhãn lệnh; VNDB bỏ qua byte thừa sau tham số. */
export function paymentTransferCalldata(request: { id: string; toWallet: string; amount: string }): `0x${string}` {
  return concat([
    encodeFunctionData({
      abi: vndTokenAbi,
      functionName: 'transfer',
      args: [request.toWallet as Hex, BigInt(request.amount)],
    }),
    paymentTag(request.id),
  ]);
}

/**
 * Ví nhận theo QĐ-2, QĐ-8: đúng dạng, khác địa chỉ 0, không là ví mẫu công khai trên chain thật
 * (`payoutWalletFormatError`), khác ví gửi, không là địa chỉ hệ thống. `null` khi đạt. Whitelist kiểm
 * riêng vì phải đọc chuỗi.
 */
export function paymentTargetError(input: {
  chain: ChainKey;
  fromWallet: string;
  toWallet: string;
  systemAddresses: readonly string[];
}): string | null {
  const formatError = payoutWalletFormatError({ chain: input.chain, wallet: input.toWallet });
  if (formatError) return formatError;
  const target = input.toWallet.toLowerCase();
  if (target === input.fromWallet.toLowerCase()) return 'Ví nhận phải khác ví gửi.';
  if (input.systemAddresses.some((address) => address.toLowerCase() === target)) {
    return 'Ví nhận là địa chỉ hệ thống (hợp đồng, vault, quỹ chia lợi nhuận hoặc ví SPV), không nhận tiền rút.';
  }
  return null;
}

/**
 * Bằng chứng hoàn tất (QĐ-9): người gửi giao dịch là ví gửi, dữ liệu gọi kết thúc bằng nhãn của lệnh,
 * và có ít nhất một log `Transfer` của VNDB khớp đủ ví gửi, ví nhận, số lượng. Log khác không làm hỏng
 * việc khớp. Biên nhận thành công kiểm ở nơi gọi.
 */
export function matchesTransfer(
  request: { id: string; fromWallet: string; toWallet: string; amount: string },
  evidence: Pick<PaymentTransferEvidence, 'txFrom' | 'input' | 'transfers'>,
): boolean {
  if (!same(evidence.txFrom, request.fromWallet)) return false;
  const tag = paymentTag(request.id).slice(2).toLowerCase();
  if (!evidence.input || !evidence.input.toLowerCase().endsWith(tag)) return false;
  const amount = BigInt(request.amount);
  return evidence.transfers.some(
    (transfer) => same(transfer.from, request.fromWallet) && same(transfer.to, request.toWallet) && transfer.value === amount,
  );
}

/** Địa chỉ hệ thống của chain (QĐ-8), chữ thường, bỏ rỗng. */
async function systemAddresses(chain: ChainKey, ledger: ILedgerPort): Promise<string[]> {
  const contracts = Object.values(addressBook[chain]?.contracts ?? {});
  const spv = await ledger.spvWallet();
  return [...contracts, vaultAddressFor(chain), profitDistributorAddressFor(chain), spv]
    .filter((address): address is string => typeof address === 'string' && address !== '')
    .map((address) => address.toLowerCase());
}

function txRequestFor(record: PaymentWithdrawRecord): TxRequest {
  const chainId = CHAINS[record.chain].chainId;
  if (chainId === undefined) throw new Error(`Chain ${record.chain} không có chainId EVM.`);
  return {
    chainId,
    to: getContractAddress(record.chain, 'VNDToken') as `0x${string}`,
    data: paymentTransferCalldata(record),
    value: '0',
  };
}

// =============================================================================
//  SỔ KIỂM TOÁN, LỆNH CỦA NGƯỜI GỌI
// =============================================================================

function audit(role: Role, chain: ChainKey, outcome: 'SUCCESS' | 'FAILURE', detail: string, target: string | null = null) {
  return getStore().appendAudit({ actorRole: role, action: 'payment:withdraw', target, outcome, detail, chain });
}

const NOT_OWNER_MESSAGE = 'Không tìm thấy lệnh rút này trong các lệnh của bạn.';

/** Chỉ người tạo lệnh thao tác được, và đúng chain đang chọn. */
async function ownRequest(role: Role, chain: ChainKey, id: string): Promise<PaymentWithdrawRecord | null> {
  const record = await getPaymentWithdrawStore().findById(id);
  if (!record || record.chain !== chain) return null;
  return record.actorId === (await currentActorId(role)) ? record : null;
}

const statusLabel: Record<PaymentWithdrawStatus, string> = {
  CREATED: 'Chờ gửi',
  SENDING: 'Chờ ký trong ví',
  SUBMITTED: 'Đã gửi, chờ xác nhận',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã huỷ',
  EXPIRED: 'Hết hạn',
};

// =============================================================================
//  ĐỐI SOÁT (A4)
// =============================================================================

/**
 * Chốt `COMPLETED` bằng mã đã chứng minh. Mã đã là `completedTxHash` của lệnh KHÁC (va ràng buộc duy
 * nhất theo chain) thì giữ trạng thái cũ, ghi lý do, không nổ lỗi (QĐ-11).
 */
async function complete(record: PaymentWithdrawRecord, txHash: string, role: Role): Promise<PaymentWithdrawRecord> {
  const store = getPaymentWithdrawStore();
  try {
    const done = await store.transition({ id: record.id, from: record.status, to: 'COMPLETED', completedTxHash: txHash, reason: null });
    if (!done) return (await store.findById(record.id)) ?? record;
    await audit(role, record.chain, 'SUCCESS', `Lệnh rút VNDB ${record.id} hoàn tất: ${record.amount} VNDB tới ${record.toWallet}, tx ${txHash}.`, record.toWallet);
    return done;
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    const reason = `Giao dịch ${txHash} đã gán cho một lệnh rút khác; giữ trạng thái hiện tại.`;
    await store.noteReason({ id: record.id, reason });
    return (await store.findById(record.id)) ?? record;
  }
}

/** Chuyển sang trạng thái cuối âm (hoặc `SUBMITTED`) kèm lý do và một dòng sổ kiểm toán. */
async function move(
  record: PaymentWithdrawRecord,
  to: PaymentWithdrawStatus,
  reason: string,
  role: Role,
  outcome: 'SUCCESS' | 'FAILURE',
): Promise<PaymentWithdrawRecord> {
  const store = getPaymentWithdrawStore();
  const moved = await store.transition({ id: record.id, from: record.status, to, reason });
  if (!moved) return (await store.findById(record.id)) ?? record;
  await audit(role, record.chain, outcome, `Lệnh rút VNDB ${record.id} sang ${statusLabel[to]}: ${reason}`, record.toWallet);
  return moved;
}

/**
 * Quét theo nhãn (QĐ-11) từ `createdBlock`. Chỉ loại ứng viên mà mã đã là `completedTxHash` của lệnh
 * KHÁC; mã do trình duyệt báo (`submittedTxHash`) của lệnh khác KHÔNG loại ứng viên.
 */
async function scanByTag(ledger: ILedgerPort, record: PaymentWithdrawRecord): Promise<string | null> {
  const found = await ledger.findPaymentTransferByTag({
    from: record.fromWallet,
    to: record.toWallet,
    value: BigInt(record.amount),
    tag: paymentTag(record.id),
    fromBlock: BigInt(record.createdBlock ?? '0'),
  });
  if (!found) return null;
  const owner = await getPaymentWithdrawStore().findByCompletedTx(record.chain, found.txHash);
  if (owner && owner.id !== record.id) return null;
  return found.txHash;
}

const elapsedSince = (iso: string | null, now: number) => (iso === null ? 0 : now - Date.parse(iso));

/** Đối soát MỘT lệnh theo bảng requirements mục 4. Trả bản ghi sau đối soát. */
async function reconcileOne(ledger: ILedgerPort, record: PaymentWithdrawRecord, role: Role): Promise<PaymentWithdrawRecord> {
  const now = Date.now();
  if (record.status === 'SENDING') {
    // Mọi lần đối soát đều quét: ví có thể đã gửi mà trình duyệt mất mã.
    const txHash = await scanByTag(ledger, record);
    if (txHash) return complete(record, txHash, role);
    if (elapsedSince(record.sendingAt, now) > PENDING_TTL_MS) {
      return move(record, 'EXPIRED', 'Quá 30 phút từ lúc gửi tới ví, không thấy giao dịch của lệnh trên chuỗi.', role, 'FAILURE');
    }
    return record;
  }

  if (record.status === 'SUBMITTED' && record.submittedTxHash) {
    const evidence = await ledger.paymentTransferReceipt(record.submittedTxHash);
    if (evidence.status === 'CONFIRMED' && matchesTransfer(record, evidence)) {
      return complete(record, record.submittedTxHash, role);
    }
    if (evidence.status === 'PENDING') return record;
    if (evidence.status === 'UNKNOWN' && elapsedSince(record.submittedAt, now) <= PENDING_TTL_MS) return record;
    // Cần chốt âm: quét theo nhãn trước (giao dịch thay thế bằng "tăng tốc" mang cùng nhãn).
    const txHash = await scanByTag(ledger, record);
    if (txHash) return complete(record, txHash, role);
    const reason =
      evidence.status === 'FAILED'
        ? `Giao dịch ${record.submittedTxHash} thất bại trên chuỗi.`
        : evidence.status === 'CONFIRMED'
          ? `Giao dịch ${record.submittedTxHash} không phải lần chuyển của lệnh này (sai người gửi, nhãn, ví nhận hoặc số lượng).`
          : `Quá 30 phút chuỗi không biết giao dịch ${record.submittedTxHash}.`;
    return move(record, 'FAILED', reason, role, 'FAILURE');
  }

  if (PAYMENT_WITHDRAW_NEGATIVE_STATUSES.includes(record.status) && record.sendingAt !== null) {
    const txHash = await scanByTag(ledger, record);
    if (txHash) return complete(record, txHash, role);
  }
  return record;
}

// =============================================================================
//  A7: KIỂM VÍ NHẬN TRƯỚC HỘP MÃ MỘT LẦN
// =============================================================================

export async function checkPaymentWithdrawTarget(input: unknown): Promise<Result<{ toWallet: string }>> {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;
  const reject = (message: string) => err<{ toWallet: string }>('VALIDATION', message, { toWallet: [message] });
  try {
    assertCan(await currentRole(), 'payment:withdraw');
    const ledger = getLedger(chain);
    const fromWallet = normalizeEvmAddress(parsed.data.wallet);
    const targetError = paymentTargetError({
      chain,
      fromWallet,
      toWallet: parsed.data.toWallet,
      systemAddresses: await systemAddresses(chain, ledger),
    });
    if (targetError) return reject(targetError);
    const toWallet = normalizeEvmAddress(parsed.data.toWallet);
    if (!(await ledger.isWhitelisted(toWallet))) return reject(PAYOUT_NOT_WHITELISTED);
    return ok({ toWallet });
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  A1: TẠO LỆNH (không trả giao dịch, không chuyển tiền)
// =============================================================================

export async function createPaymentWithdraw(input: unknown): Promise<Result<PaymentWithdrawView>> {
  const parsed = createSchema.safeParse(input);
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
    role = await authorize('payment:withdraw', parsed.data.wallet, chain);
  } catch (error) {
    return toResult(error);
  }

  // 1. Dạng: mã một lần (không lưu, không vào log, sổ kiểm toán hay câu lỗi), số tiền.
  if (!OTP_PATTERN.test(parsed.data.otp)) {
    return err('VALIDATION', 'Mã một lần phải đúng sáu chữ số.', { otp: ['Mã một lần phải đúng sáu chữ số.'] });
  }
  if (!/^\d+$/.test(parsed.data.amount) || BigInt(parsed.data.amount) <= 0n) {
    return err('VALIDATION', 'Số tiền rút là số nguyên VNDB lớn hơn 0.', { amount: ['Số tiền rút là số nguyên VNDB lớn hơn 0.'] });
  }
  const amount = BigInt(parsed.data.amount);

  try {
    // 2. Ví gửi phải là ví đã định danh của phiên (QĐ-3).
    await assertSessionWallet({ role, chain, wallet: parsed.data.wallet, audit: { action: 'payment:withdraw' } });
    const fromWallet = normalizeEvmAddress(parsed.data.wallet);
    const ledger = getLedger(chain);
    const store = getPaymentWithdrawStore();
    const fail = async (code: Parameters<typeof err>[0], message: string, fieldErrors?: Record<string, string[]>) => {
      await audit(role, chain, 'FAILURE', `Từ chối lệnh rút VNDB: ${message}`, parsed.data.toWallet);
      return err<PaymentWithdrawView>(code, message, fieldErrors);
    };

    // 3. Ví nhận (QĐ-2, QĐ-8).
    const targetError = paymentTargetError({
      chain,
      fromWallet,
      toWallet: parsed.data.toWallet,
      systemAddresses: await systemAddresses(chain, ledger),
    });
    if (targetError) return await fail('VALIDATION', targetError, { toWallet: [targetError] });
    const toWallet = normalizeEvmAddress(parsed.data.toWallet);

    // 4. Chống trùng: cùng nội dung trả lệnh cũ, KHÔNG BAO GIỜ kèm giao dịch cần gửi (QĐ-13).
    const intent = { toWallet, amount: amount.toString(), purpose, note };
    const repeated = await store.findByClientRequest({ chain, wallet: fromWallet, clientRequestId });
    if (repeated) return await repeatedResult(repeated, intent, fail);

    // 5. Mỗi ví một lệnh đang dở (QĐ-5).
    if (await store.findActive(chain, fromWallet)) return await fail('WITHDRAW_STATE', PAYMENT_ACTIVE_MESSAGE);

    // 6. Đọc chuỗi ngay lúc này.
    if (!(await ledger.isWhitelisted(toWallet))) {
      return await fail('VALIDATION', PAYOUT_NOT_WHITELISTED, { toWallet: [PAYOUT_NOT_WHITELISTED] });
    }
    if ((await ledger.paymentBalanceOf(fromWallet)) < amount) {
      return await fail('VALIDATION', PAYMENT_BALANCE_MESSAGE, { amount: [PAYMENT_BALANCE_MESSAGE] });
    }

    // 7. Tạo lệnh; ràng buộc duy nhất là trọng tài cho tranh chấp.
    const createdBlock = await ledger.latestBlockNumber();
    let created: PaymentWithdrawRecord;
    try {
      created = await store.create({
        id: randomUUID(),
        chain,
        clientRequestId,
        actorId: await currentActorId(role),
        fromWallet,
        toWallet,
        amount: amount.toString(),
        purpose,
        note,
        createdBlock: createdBlock.toString(),
      });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError) || error.table !== 'PaymentWithdrawRequest') throw error;
      if (error.columns.includes('clientRequestId')) {
        const winner = await store.findByClientRequest({ chain, wallet: fromWallet, clientRequestId });
        if (winner) return await repeatedResult(winner, intent, fail);
      }
      return await fail('WITHDRAW_STATE', PAYMENT_ACTIVE_MESSAGE);
    }
    await audit(role, chain, 'SUCCESS', `Tạo lệnh rút VNDB ${created.id}: ${created.amount} VNDB từ ${fromWallet} tới ${toWallet}.`, toWallet);
    return ok(toView(created));
  } catch (error) {
    return toResult(error);
  }
}

async function repeatedResult(
  record: PaymentWithdrawRecord,
  intent: { toWallet: string; amount: string; purpose: string; note: string | null },
  fail: (code: 'WITHDRAW_STATE', message: string) => Promise<Result<PaymentWithdrawView>>,
): Promise<Result<PaymentWithdrawView>> {
  const unchanged =
    same(record.toWallet, intent.toWallet) &&
    record.amount === intent.amount &&
    record.purpose === intent.purpose &&
    record.note === intent.note;
  if (!unchanged) {
    return fail('WITHDRAW_STATE', `Mã chống trùng ${record.clientRequestId} đã dùng cho một lệnh rút có nội dung khác.`);
  }
  return ok(toView(record));
}

// =============================================================================
//  A8: BẮT ĐẦU GỬI (trả giao dịch cần gửi đúng một lần)
// =============================================================================

export async function beginPaymentSend(
  input: unknown,
): Promise<Result<PaymentWithdrawView & { txRequest: TxRequest | null }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain, id } = parsed.data;
  try {
    const role = await authorize('payment:withdraw', id, chain);
    const record = await ownRequest(role, chain, id);
    if (!record) return err('WITHDRAW_STATE', NOT_OWNER_MESSAGE);
    if (record.status === 'SENDING') return err('WITHDRAW_STATE', PAYMENT_ALREADY_SENT_MESSAGE);
    if (record.status !== 'CREATED') {
      return err('WITHDRAW_STATE', `Lệnh rút đang ở trạng thái "${statusLabel[record.status]}", không gửi được.`);
    }
    const ledger = getLedger(chain);
    const store = getPaymentWithdrawStore();

    // Đọc lại điều kiện; chưa từng trả giao dịch nên huỷ ở đây là an toàn.
    const blocker = !(await ledger.isWhitelisted(record.toWallet))
      ? PAYOUT_NOT_WHITELISTED
      : (await ledger.paymentBalanceOf(record.fromWallet)) < BigInt(record.amount)
        ? PAYMENT_BALANCE_MESSAGE
        : null;
    if (blocker) {
      const cancelled = await move(record, 'CANCELLED', blocker, role, 'FAILURE');
      return ok({ ...toView(cancelled), txRequest: null });
    }

    // Giữ chỗ lần gửi (QĐ-13): chỉ lần chuyển CREATED sang SENDING thành công mới trả giao dịch.
    const sending = await store.transition({ id, from: 'CREATED', to: 'SENDING' });
    if (!sending) return err('WITHDRAW_STATE', PAYMENT_ALREADY_SENT_MESSAGE);
    await audit(role, chain, 'SUCCESS', `Lệnh rút VNDB ${id} gửi tới ví để ký.`, record.toWallet);

    if (chainFamily(chain) === 'mock') {
      if (!ledger.mockTransferPayment) throw new Error('Ledger mock thiếu mockTransferPayment.');
      // Mock: máy chủ chuyển thay ví, kèm nhãn; lỗi giữa chừng để lại SENDING, đối soát sau tìm theo nhãn.
      await ledger.mockTransferPayment(sending.fromWallet, sending.toWallet, BigInt(sending.amount), paymentTag(sending.id));
      const settled = await reconcileOne(ledger, sending, role);
      return ok({ ...toView(settled), txRequest: null });
    }
    return ok({ ...toView(sending), txRequest: txRequestFor(sending) });
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  A2: TRÌNH DUYỆT BÁO MÃ GIAO DỊCH
// =============================================================================

export async function submitPaymentWithdrawTx(input: unknown): Promise<Result<PaymentWithdrawView>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain, id, txHash } = parsed.data;
  if (!TX_HASH_PATTERN.test(txHash)) {
    return err('VALIDATION', 'Mã giao dịch phải là 0x + 64 ký tự hex.', { txHash: ['Mã giao dịch không hợp lệ.'] });
  }
  try {
    const role = await authorize('payment:withdraw', id, chain);
    const record = await ownRequest(role, chain, id);
    if (!record) return err('WITHDRAW_STATE', NOT_OWNER_MESSAGE);
    // Đối soát khi mở màn có thể đã tìm thấy giao dịch trước khi trình duyệt kịp báo.
    if (record.status === 'COMPLETED') return ok(toView(record));
    if (record.status !== 'SENDING') {
      return err('WITHDRAW_STATE', `Lệnh rút đang ở trạng thái "${statusLabel[record.status]}", không nhận mã giao dịch.`);
    }
    const ledger = getLedger(chain);
    // Đọc được mà người gửi khác ví gửi thì từ chối; nút chưa thấy giao dịch thì vẫn nhận.
    const sender = await ledger.paymentTxSender(txHash);
    if (sender && !same(sender, record.fromWallet)) {
      await audit(role, chain, 'FAILURE', `Lệnh rút VNDB ${id}: mã ${txHash} do ví ${sender} gửi, không phải ví gửi của lệnh.`, record.toWallet);
      return err('WITHDRAW_STATE', `Giao dịch ${txHash} không do ví gửi của lệnh ký; không nhận.`);
    }
    const submitted = await getPaymentWithdrawStore().transition({ id, from: 'SENDING', to: 'SUBMITTED', submittedTxHash: txHash });
    if (!submitted) {
      const current = await getPaymentWithdrawStore().findById(id);
      if (current?.status === 'COMPLETED') return ok(toView(current));
      return err('WITHDRAW_STATE', 'Lệnh rút vừa đổi trạng thái; mở lại màn để xem kết quả.');
    }
    await audit(role, chain, 'SUCCESS', `Lệnh rút VNDB ${id}: trình duyệt báo mã ${txHash}.`, record.toWallet);
    return ok(toView(await reconcileOne(ledger, submitted, role)));
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  A3: HUỶ
// =============================================================================

export async function cancelPaymentWithdraw(input: unknown): Promise<Result<PaymentWithdrawView>> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain, id, walletRejected } = parsed.data;
  try {
    const role = await authorize('payment:withdraw', id, chain);
    const record = await ownRequest(role, chain, id);
    if (!record) return err('WITHDRAW_STATE', NOT_OWNER_MESSAGE);
    if (record.status === 'CREATED') {
      return ok(toView(await move(record, 'CANCELLED', 'Đã huỷ', role, 'SUCCESS')));
    }
    if (record.status !== 'SENDING') {
      return err('WITHDRAW_STATE', `Lệnh rút đang ở trạng thái "${statusLabel[record.status]}", không huỷ được.`);
    }
    // Đã trả giao dịch cho ví: quét theo nhãn trước (QĐ-10). Mã 4001 chỉ là lời khai của trình duyệt.
    const ledger = getLedger(chain);
    const txHash = await scanByTag(ledger, record);
    if (txHash) return ok(toView(await complete(record, txHash, role)));
    const reason = walletRejected ? WALLET_REJECTED_REASON : 'Đã huỷ';
    return ok(toView(await move(record, 'CANCELLED', reason, role, 'SUCCESS')));
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  A5, A6: MỘT ACTION KHI MỞ MÀN
// =============================================================================

export async function getPaymentWithdrawPage(input: unknown): Promise<Result<PaymentWithdrawPageView>> {
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;
  try {
    const role = await currentRole();
    // Không ghi sổ mỗi lần mở màn; chốt chặn ví thì ghi khi chặn.
    assertCan(role, 'payment:withdraw');
    await assertSessionWallet({ role, chain, wallet: parsed.data.wallet, audit: { action: 'payment:withdraw' } });
    const wallet = normalizeEvmAddress(parsed.data.wallet);
    const ledger = getLedger(chain);
    const store = getPaymentWithdrawStore();

    // Đối soát: lệnh đang dở của ví (tối đa một) và lệnh cuối âm đã từng gửi trong 24 giờ (tối đa 5).
    const active = await store.findActive(chain, wallet);
    const rescan = await store.listByWallet(chain, wallet, {
      statuses: PAYMENT_WITHDRAW_NEGATIVE_STATUSES,
      since: new Date(Date.now() - RESCAN_WINDOW_MS),
      sentOnly: true,
      limit: RESCAN_LIMIT,
    });
    for (const record of [...(active ? [active] : []), ...rescan]) await reconcileOne(ledger, record, role);

    const [balance, requests] = await Promise.all([
      ledger.paymentBalanceOf(wallet),
      store.listByWallet(chain, wallet, { limit: LIST_LIMIT }),
    ]);
    return ok({ balance: balance.toString(), requests: requests.map(toView) });
  } catch (error) {
    return toResult(error);
  }
}
