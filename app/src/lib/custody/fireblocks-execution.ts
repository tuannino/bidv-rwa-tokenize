import 'server-only';

import { keccak256, type Hex } from 'viem';
import { getLedger } from '@/lib/ledger';
import type { TokenRequestCustodyContext, TokenRequestRecord } from '@/lib/store';
import {
  classifyCreateError,
  FireblocksHttpError,
  type FireblocksClient,
  type FireblocksTx,
} from './fireblocks-client';
import type { FireblocksConfig } from './fireblocks-config';

/**
 * IN-04: thực hiện Mint, Burn của lần duyệt qua Fireblocks, và đối soát (requirements C3 tới C5).
 *
 * Hai luật xuyên suốt:
 * - Mỗi yêu cầu nhiều nhất MỘT lời gọi tạo giao dịch (`externalTxId` = mã yêu cầu); đối soát chỉ tra.
 * - Chỉ trả `FAILED` khi CHẮC CHẮN chưa có gì lên chuỗi (QĐ-8, QĐ-7c); còn lại `UNKNOWN`, `WAIT` để
 *   yêu cầu giữ `EXECUTING` cho đối soát. Biên nhận trên chuỗi mới là kết cục cuối.
 *
 * Các phụ thuộc truyền vào (`SubmitDeps`) để kiểm từng nhánh bằng khách giả.
 */

/** Bối cảnh ký chụp lúc chiếm quyền (requirements E1, QĐ-6). */
export type CustodyContext = TokenRequestCustodyContext;

export type FireblocksVerdict =
  | { kind: 'HASH'; txHash: string; fireblocksId: string }
  | { kind: 'DEAD'; reason: string; fireblocksId: string | null }
  | { kind: 'WAIT'; reason?: string; fireblocksId: string | null };

const DEAD_STATUSES = new Set(['CANCELLED', 'BLOCKED', 'REJECTED']);
const INSUFFICIENT_FUNDS_FOR_FEE = 'INSUFFICIENT_FUNDS_FOR_FEE';

const statusText = (tx: FireblocksTx) => (tx.subStatus ? `${tx.status}/${tx.subStatus}` : tx.status);

/**
 * Phân loại trạng thái Fireblocks (requirements C5). Có mã giao dịch ở BẤT KỲ trạng thái nào là `HASH`:
 * kết cục do biên nhận quyết định. Không mã: `CANCELLED`, `BLOCKED`, `REJECTED`, hoặc `FAILED` vì thiếu
 * phí (bị từ chối trước khi phát) là `DEAD`; `FAILED` lý do khác là `WAIT` kèm lý do; còn lại `WAIT`.
 */
export function classifyFireblocksTx(tx: FireblocksTx): FireblocksVerdict {
  if (tx.txHash) return { kind: 'HASH', txHash: tx.txHash, fireblocksId: tx.id };
  if (DEAD_STATUSES.has(tx.status) || (tx.status === 'FAILED' && tx.subStatus === INSUFFICIENT_FUNDS_FOR_FEE)) {
    return { kind: 'DEAD', reason: `Fireblocks ${statusText(tx)}, chưa phát lên chuỗi.`, fireblocksId: tx.id };
  }
  if (tx.status === 'FAILED') {
    return {
      kind: 'WAIT',
      reason: `Fireblocks FAILED/${tx.subStatus ?? ''} không có mã giao dịch; cần đối soát tay.`,
      fireblocksId: tx.id,
    };
  }
  return { kind: 'WAIT', fireblocksId: tx.id };
}

export interface SubmitDeps {
  /** `ledger.prepareContractCall(..., from = context.address)`: mô phỏng rồi trả lời gọi. */
  prepare(): Promise<{ to: string; data: string }>;
  setCustodyCall(input: { contract: string; callDataHash: string }): Promise<TokenRequestRecord | null>;
  /** Gọi NGAY TRƯỚC `createContractCall`: từ đây không lối nào được ghi `FAILED` trừ QĐ-8, QĐ-7c. */
  markAttempted(): void;
  client: FireblocksClient;
  /** Ghi `custodyTxId`; lỗi chỉ log. */
  onCreated(fireblocksId: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  hashWaitMs: number;
  pollMs: number;
}

export type SubmitOutcome =
  | { kind: 'HASH'; txHash: string; fireblocksId: string | null }
  | { kind: 'FAILED'; reason: string; definitelyNotOnChain: true }
  | { kind: 'UNKNOWN'; reason: string; fireblocksId: string | null };

export const UNKNOWN_AFTER_SUBMIT = 'Đã gửi Fireblocks, chưa rõ kết quả; bấm Đối soát sau.';
export const PREPARED_CALL_NOT_SAVED = 'Không ghi được lời gọi đã chuẩn bị; chưa gửi Fireblocks.';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Gửi lời gọi đã chuẩn bị qua Fireblocks và chờ mã giao dịch (requirements C3).
 *
 * Thứ tự: mô phỏng (revert là `FAILED`), ghi lời gọi (ném hoặc `null` là `FAILED`, DỪNG), đánh dấu đã
 * gọi, tạo giao dịch ĐÚNG MỘT lần, xử lý lỗi tạo theo QĐ-7c, hỏi trạng thái tới khi có mã hoặc hết giờ.
 * Không ném sau `markAttempted`. Không gắn mã: trả `HASH` để người gọi gắn bằng `claimTxHash` (QĐ-16).
 */
export async function submitViaFireblocks(
  input: { requestId: string; note: string; context: CustodyContext },
  deps: SubmitDeps,
): Promise<SubmitOutcome> {
  let prepared: { to: string; data: string };
  try {
    prepared = await deps.prepare();
  } catch (error) {
    return { kind: 'FAILED', reason: messageOf(error), definitelyNotOnChain: true };
  }

  let recorded: TokenRequestRecord | null;
  try {
    recorded = await deps.setCustodyCall({ contract: prepared.to, callDataHash: keccak256(prepared.data as Hex) });
  } catch {
    recorded = null;
  }
  if (!recorded) return { kind: 'FAILED', reason: PREPARED_CALL_NOT_SAVED, definitelyNotOnChain: true };

  deps.markAttempted();
  const recordId = async (fireblocksId: string) => {
    try {
      await deps.onCreated(fireblocksId);
    } catch (error) {
      console.error(`[fireblocks] Không ghi được mã Fireblocks cho yêu cầu ${input.requestId}:`, messageOf(error));
    }
  };

  let fireblocksId: string;
  let known: FireblocksTx | null = null;
  try {
    const created = await deps.client.createContractCall({
      externalTxId: input.requestId,
      vaultId: input.context.vaultId,
      assetId: input.context.assetId,
      contract: prepared.to,
      data: prepared.data,
      note: input.note,
    });
    fireblocksId = created.id;
    await recordId(created.id);
  } catch (error) {
    // QĐ-7c: tra lại theo `externalTxId` trong MỌI nhóm, rồi mới kết luận.
    const group = classifyCreateError(error);
    let found: FireblocksTx | null;
    try {
      found = await deps.client.getByExternalTxId(input.requestId);
    } catch {
      return { kind: 'UNKNOWN', reason: UNKNOWN_AFTER_SUBMIT, fireblocksId: null };
    }
    if (!found) {
      if (group === 'REJECTED' && error instanceof FireblocksHttpError) {
        return {
          kind: 'FAILED',
          reason: `Fireblocks từ chối tạo giao dịch (mã ${error.code}): ${error.message}`,
          definitelyNotOnChain: true,
        };
      }
      return { kind: 'UNKNOWN', reason: UNKNOWN_AFTER_SUBMIT, fireblocksId: null };
    }
    fireblocksId = found.id;
    known = found;
    await recordId(found.id);
  }

  // Chờ mã: hỏi ngay, rồi mỗi `pollMs`, tối đa `hashWaitMs`. Một lần hỏi lỗi thì bỏ qua.
  let waitReason: string | undefined;
  for (let elapsed = 0; ; ) {
    let tx: FireblocksTx | null = known;
    known = null;
    if (!tx) {
      try {
        tx = await deps.client.getById(fireblocksId);
      } catch {
        tx = null;
      }
    }
    if (tx) {
      const verdict = classifyFireblocksTx(tx);
      if (verdict.kind === 'HASH') return { kind: 'HASH', txHash: verdict.txHash, fireblocksId };
      if (verdict.kind === 'DEAD') return { kind: 'FAILED', reason: verdict.reason, definitelyNotOnChain: true };
      waitReason = verdict.reason ?? waitReason;
    }
    elapsed += deps.pollMs;
    if (elapsed > deps.hashWaitMs) break;
    await deps.sleep(deps.pollMs);
  }
  return { kind: 'UNKNOWN', reason: waitReason ?? UNKNOWN_AFTER_SUBMIT, fireblocksId };
}

/** Trường lệch giữa giao dịch trên chuỗi và lời gọi đã chuẩn bị (QĐ-15), hoặc `null` khi khớp đủ. */
export function preparedCallMismatch(
  ctx: Pick<CustodyContext, 'address' | 'contract' | 'callDataHash'>,
  tx: { from: string; to: string | null; input: string } | null,
): string | null {
  if (!ctx.contract || !ctx.callDataHash) return 'lời gọi đã chuẩn bị chưa được ghi';
  if (!tx) return 'nút chưa thấy giao dịch';
  if (tx.from.toLowerCase() !== ctx.address.toLowerCase()) return 'from';
  if ((tx.to ?? '').toLowerCase() !== ctx.contract.toLowerCase()) return 'to';
  if (keccak256(tx.input as Hex).toLowerCase() !== ctx.callDataHash.toLowerCase()) return 'input';
  return null;
}

/** QĐ-15: so địa chỉ chữ thường và `keccak256(input)`; `contract`, `callDataHash` null hay `tx` null là false. */
export function matchesPreparedCall(
  ctx: Pick<CustodyContext, 'address' | 'contract' | 'callDataHash'>,
  tx: { from: string; to: string | null; input: string } | null,
): boolean {
  return preparedCallMismatch(ctx, tx) === null;
}

/** Trường lệch của giao dịch đã gắn trên CHÍNH bản ghi truyền vào, hoặc `null` khi khớp. */
export async function fireblocksCallMismatch(request: TokenRequestRecord): Promise<string | null> {
  const ctx = request.custodyContext;
  if (!ctx || !request.txHash) return 'yêu cầu thiếu bối cảnh ký hoặc mã giao dịch';
  const ledger = getLedger(request.chain);
  if (!ledger.transactionCallOf) {
    throw new Error(`Lỗi lập trình: ledger chain ${request.chain} không có transactionCallOf cho Lưu ký Fireblocks.`);
  }
  return preparedCallMismatch(ctx, await ledger.transactionCallOf(request.txHash));
}

export async function confirmFireblocksMatch(request: TokenRequestRecord): Promise<boolean> {
  return (await fireblocksCallMismatch(request)) === null;
}

export const configChangedMessage = (ctx: CustodyContext) =>
  `Cấu hình Fireblocks đã đổi so với lúc duyệt (vault ${ctx.vaultId}); phục hồi cấu hình cũ để đối soát.`;
export const FIREBLOCKS_UNREADABLE = 'Chưa đọc được Fireblocks; thử lại.';
export const FIREBLOCKS_NOT_FOUND =
  'Fireblocks chưa có giao dịch của yêu cầu này (mã 1439); giữ Đang thực hiện, cần xử lý tay.';

export type ReconcileVerdict =
  | { kind: 'HASH'; txHash: string; fireblocksId: string }
  | { kind: 'FAILED'; reason: string; definitelyNotOnChain: true }
  | { kind: 'WAIT'; message: string; fireblocksId: string | null };

/**
 * Đối soát một yêu cầu `FIREBLOCKS` chưa có mã giao dịch (requirements C4). Cấu hình hiện tại thiếu,
 * hoặc khác bối cảnh đã ghi: không tra (QĐ-14). Không có nhánh tự `FAILED` theo thời gian (QĐ-7b).
 * KHÔNG BAO GIỜ tạo giao dịch.
 */
export async function reconcileViaFireblocks(
  request: TokenRequestRecord,
  deps: { client: FireblocksClient | null; currentConfig: FireblocksConfig | null },
): Promise<ReconcileVerdict> {
  const ctx = request.custodyContext;
  if (!ctx) throw new Error(`Lỗi lập trình: yêu cầu ${request.id} đi Fireblocks mà không có bối cảnh ký.`);
  const current = deps.currentConfig;
  if (!current || !deps.client || current.configRef !== ctx.configRef || current.vaultId !== ctx.vaultId) {
    return { kind: 'WAIT', message: configChangedMessage(ctx), fireblocksId: null };
  }
  let tx: FireblocksTx | null;
  try {
    tx = request.custodyTxId
      ? await deps.client.getById(request.custodyTxId)
      : await deps.client.getByExternalTxId(request.id);
  } catch {
    return { kind: 'WAIT', message: FIREBLOCKS_UNREADABLE, fireblocksId: null };
  }
  if (!tx) return { kind: 'WAIT', message: FIREBLOCKS_NOT_FOUND, fireblocksId: null };

  const verdict = classifyFireblocksTx(tx);
  if (verdict.kind === 'HASH') return { kind: 'HASH', txHash: verdict.txHash, fireblocksId: tx.id };
  if (verdict.kind === 'DEAD') return { kind: 'FAILED', reason: verdict.reason, definitelyNotOnChain: true };
  return {
    kind: 'WAIT',
    message: verdict.reason ?? `Fireblocks ${statusText(tx)}, chưa có mã giao dịch; bấm Đối soát sau.`,
    fireblocksId: tx.id,
  };
}
