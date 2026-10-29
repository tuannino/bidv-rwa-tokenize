import 'server-only';

import { readStep } from '@/lib/diagnostics/read-trace';

import type { ChainKey, TxResult } from '@bidv/shared';
import { getLedger, LedgerNotImplementedError } from '@/lib/ledger';
import { fireblocksConfig } from '@/lib/custody/fireblocks-config';
import { getFireblocksClient } from '@/lib/custody/fireblocks-client';
import { fireblocksCallMismatch, reconcileViaFireblocks } from '@/lib/custody/fireblocks-execution';
import { assertCan, can, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { SAMPLE_ACCOUNTS } from '@/lib/session/channel';
import {
  APPROVAL_HISTORY_LIMIT,
  getProjectStore,
  getStore,
  getTokenRequestStore,
  type NewAudit,
  type ProjectRecord,
  type TokenRequestCustodyContext,
  type TokenRequestRecord,
  type TokenRequestStatus,
} from '@/lib/store';
import { custodyFor, getCustodyState, getCustodyStateForLayout, type CustodyState } from './custody.service';
import { authorize, toResult } from './authorize';
import {
  executeIssuance,
  sendViaCustody,
  type ApprovalSubmission,
  type CustodyRoute,
  type ExecutionResult,
  readSupplyMetrics,
  remainingIssuanceCap,
  signerAddressOrNull,
  vaultMintTargetError,
} from './issuance.service';
import { formatAmount } from '@/lib/format';
import { err, ok, type Result } from './result';
import {
  approveTokenRequestSchema,
  chainSchema,
  createTokenRequestSchema,
  reconcileTokenRequestSchema,
  rejectTokenRequestSchema,
  tokenInfoQuerySchema,
  tokenRequestDetailSchema,
  tokenRequestQuerySchema,
} from './schemas';
import { readRecallPhase } from './recall.service';
import { tradingBlocked } from './recall-phase';

/**
 * Nghiệp vụ LẬP–DUYỆT yêu cầu Mint / Burn (BE-12): Giao dịch viên lập, Kiểm soát viên duyệt.
 *
 * ## Ba bất biến
 *
 * 1. **Yêu cầu đang chờ không tác động token.** Lập chỉ ghi một dòng `PENDING`.
 * 2. **Duyệt kiểm lại TOÀN BỘ điều kiện** tại thời điểm duyệt, không tin kết quả lúc lập: giữa hai
 *    lúc đó có thể có lần phát hành khác ăn vào trần, hoặc token đã ra khỏi ví SPV.
 * 3. **Hai lần duyệt cùng lúc chỉ tác động token một lần.** Trọng tài là câu `UPDATE` có điều kiện
 *    `PENDING → EXECUTING` ở cổng lưu trữ, không phải phép đọc trạng thái trong mã này.
 *
 * Người lập không duyệt (cũng không từ chối) được yêu cầu của chính mình — phép so theo MÃ TÀI
 * KHOẢN, vì bảng quyền chỉ biết vai.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #3 quyền qua `authorize()` / `can()`.
 */

/** Một điều kiện trong khối kiểm tra mà giao diện hiện trước khi lập / duyệt. */
export interface RequestCheck {
  /** Mã điều kiện, cũng là khoá trong `fieldErrors` khi điều kiện trượt. */
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface TokenRequestCheckView {
  checks: RequestCheck[];
  allPassed: boolean;
}

export interface CreatedTokenRequestView {
  request: TokenRequestRecord;
  checks: RequestCheck[];
}

/**
 * IN-04: kết quả của lần duyệt và lần đối soát. `notice` là câu cho người bấm khi yêu cầu giữ
 * `EXECUTING` vì chưa rõ (Fireblocks chưa có mã, thua lượt gắn mã, cấu hình đã đổi, giao dịch không khớp).
 */
export type TokenRequestOutcomeView = TokenRequestRecord & { notice?: string };

export interface PendingWorkView {
  /** Yêu cầu người này đã lập, đang chờ người khác duyệt. */
  draft: number;
  /** Yêu cầu người khác lập, đang chờ người này duyệt. */
  approval: number;
}

/** Dữ liệu cần để đánh giá điều kiện — dùng chung cho lúc lập và lúc duyệt. */
interface RequestDraft {
  chain: ChainKey;
  tokenSymbol: string;
  type: 'MINT' | 'BURN';
  amount: bigint;
  /** Mint: ví đích nhập vào. Burn: không có — đọc ví SPV từ chuỗi. */
  wallet?: string;
  burnSource?: 'UNDISTRIBUTED' | 'TOTAL_SUPPLY';
}

interface Evaluation {
  checks: RequestCheck[];
  project: ProjectRecord | null;
  /** Ví mà lần duyệt sẽ tác động: Mint là ví đích, Burn là ví SPV trên chuỗi. */
  wallet: string | null;
}

const check = (key: string, label: string, passed: boolean, detail: string): RequestCheck => ({
  key,
  label,
  passed,
  detail,
});

const failedOf = (checks: RequestCheck[]) => checks.filter((c) => !c.passed);

/** `fieldErrors` khoá theo mã điều kiện — giao diện tô đúng dòng trượt. */
const toFieldErrors = (checks: RequestCheck[]): Record<string, string[]> =>
  Object.fromEntries(failedOf(checks).map((c) => [c.key, [c.detail]]));

const describeFailed = (checks: RequestCheck[]): string =>
  failedOf(checks)
    .map((c) => `${c.label}: ${c.detail}`)
    .join('; ');

/**
 * Đánh giá MỌI điều kiện nghiệp vụ của một yêu cầu, không dừng ở điều kiện trượt đầu tiên — khối
 * kiểm tra phải hiện đủ để người lập sửa một lần.
 *
 * FIX-02 QĐ-3: không còn điều kiện "không có yêu cầu Mint khác đang chờ"; Giao dịch viên lập được
 * nhiều yêu cầu Mint cùng token, Kiểm soát viên thấy cảnh báo khi số không còn đủ (`approveWarningOf`).
 */
async function evaluate(draft: RequestDraft): Promise<Evaluation> {
  const { chain, tokenSymbol, type, amount } = draft;
  const checks: RequestCheck[] = [];

  const project = await getProjectStore().findProject({ tokenSymbol, chain });
  checks.push(
    check(
      'project',
      'Dự án tồn tại',
      project !== null,
      project
        ? `Dự án "${project.name}" trên chuỗi "${chain}".`
        : `Chưa có dự án "${tokenSymbol}" trên chuỗi "${chain}".`,
    ),
  );
  if (!project) return { checks, project, wallet: null };

  const ledger = getLedger(chain);
  const spv = await ledger.spvWallet();

  if (type === 'MINT') {
    let settlementMode: boolean | null = null;
    try { settlementMode = await ledger.isSettlementMode(); }
    catch (error) { if (!(error instanceof LedgerNotImplementedError)) throw error; }
    const recallBlock = tradingBlocked(await readRecallPhase(chain), settlementMode);
    checks.push(check(
      'recall',
      'Dự án chưa tới hạn thu hồi',
      !recallBlock.blocked,
      recallBlock.message ?? 'Dự án chưa tới hạn thu hồi.',
    ));
    const { cap, supply, remaining } = await remainingIssuanceCap(chain, project);
    checks.push(
      check(
        'cap',
        'Không vượt trần còn lại',
        amount <= remaining,
        `Số lượng ${formatAmount(amount)}; trần còn lại ${formatAmount(remaining)} (trần ${formatAmount(cap)} trừ tổng cung ${formatAmount(supply)}).`,
      ),
    );

    const wallet = draft.wallet ?? '';
    const vaultTargetError = vaultMintTargetError(chain, wallet);
    const [whitelisted, frozen] = await Promise.all([
      ledger.isWhitelisted(wallet),
      ledger.isFrozen(wallet),
    ]);
    const matchesVault = vaultTargetError === null;
    const matchesSpv = spv === null || spv.toLowerCase() === wallet.toLowerCase();
    checks.push(
      check(
        'wallet',
        'Ví đích hợp lệ',
        whitelisted && !frozen && matchesVault && matchesSpv,
        !matchesVault
          ? vaultTargetError ?? 'Ví đích không phải vault thanh toán SPV.'
          : !matchesSpv
          ? `Ví đích phải là ví thanh toán SPV đã đăng ký trên chuỗi (${spv}).`
          : !whitelisted
            ? `Ví ${wallet} chưa được whitelist.`
            : frozen
              ? `Ví ${wallet} đang bị đóng băng.`
              : `Ví ${wallet} đã whitelist, không bị đóng băng.`,
      ),
    );

    return { checks, project, wallet };
  }

  // ---- BURN ----
  checks.push(
    check(
      'wallet',
      'Có ví thanh toán SPV trên chuỗi',
      spv !== null,
      spv ? `Đốt tại ví SPV ${spv}.` : 'Chưa phát hành lần nào nên chưa có ví SPV để đốt.',
    ),
  );
  if (!spv) return { checks, project, wallet: null };

  // Cùng hàm với khối thông tin token và màn Người bán (FE-21): ba nơi không thể nói khác nhau.
  const metrics = await readSupplyMetrics(chain, project);
  const undistributed = BigInt(metrics.undistributed);
  const circulating = BigInt(metrics.circulating);

  checks.push(
    check(
      'undistributed',
      'Không vượt phần chưa phân phối',
      amount <= undistributed,
      `Số lượng ${formatAmount(amount)}; phần chưa phân phối trong ví SPV ${formatAmount(undistributed)}.`,
    ),
  );
  if (draft.burnSource === 'TOTAL_SUPPLY') {
    // FIX-02 QĐ-5: dùng `metrics` đã đọc ở trên, không đọc thêm. Tổng cung đổi sau khi lập (có Mint
    // khác hoàn tất) thì lần duyệt trượt điều kiện này.
    const totalSupply = BigInt(metrics.totalSupply);
    checks.push(
      check(
        'fullSupply',
        'Số lượng bằng tổng cung',
        amount === totalSupply,
        `Số lượng ${formatAmount(amount)}; tổng cung hiện tại ${formatAmount(totalSupply)}.`,
      ),
    );
    checks.push(
      check(
        'circulation',
        'Không còn token đang lưu hành',
        circulating === 0n,
        circulating === 0n
          ? 'Toàn bộ nguồn cung còn trong ví SPV.'
          : `Còn ${formatAmount(circulating)} token đang lưu hành ngoài ví SPV, không đốt theo toàn bộ nguồn cung.`,
      ),
    );
  }
  return { checks, project, wallet: spv };
}

const draftOf = (request: TokenRequestRecord): RequestDraft => ({
  chain: request.chain,
  tokenSymbol: request.tokenSymbol,
  type: request.type,
  amount: BigInt(request.amount),
  wallet: request.type === 'MINT' ? request.wallet : undefined,
  burnSource: request.burnSource ?? undefined,
});

/** Ghi một dòng sổ kiểm toán cho bước lập–duyệt. */
async function audit(input: {
  role: Role;
  action: 'order:draft' | 'order:approve';
  target: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  detail: string;
  chain: ChainKey | null;
}): Promise<void> {
  await getStore().appendAudit({
    actorRole: input.role,
    action: input.action,
    target: input.target,
    outcome: input.outcome,
    detail: input.detail,
    chain: input.chain,
  });
}

/**
 * Khối kiểm tra TRƯỚC khi lập: trả từng điều kiện kèm trạng thái, không ghi gì.
 *
 * Quyền lập là một dòng trong khối thay vì một lỗi, để giao diện hiện được "bạn không có quyền
 * lập" cạnh các điều kiện khác. Không ghi sổ kiểm toán: đây là phép đọc, lần LẬP mới là thao tác.
 */
export async function previewTokenRequest(
  input: unknown,
): Promise<Result<TokenRequestCheckView>> {
  const parsed = createTokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  try {
    const role = await currentRole();
    const permitted = can(role, 'order:draft');
    const { checks } = await evaluate(parsed.data);
    const all = [
      check(
        'permission',
        'Người lập có quyền lập yêu cầu',
        permitted,
        permitted ? `Vai ${role} có quyền lập.` : `Vai ${role} không có quyền lập yêu cầu.`,
      ),
      ...checks,
    ];
    return ok({ checks: all, allPassed: failedOf(all).length === 0 });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Lập yêu cầu Mint / Burn. Đạt mọi điều kiện thì ghi một dòng `PENDING` — CHƯA tác động token.
 */
export async function createTokenRequest(
  input: unknown,
): Promise<Result<CreatedTokenRequestView>> {
  const parsed = createTokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;
  const label = `${data.type} ${data.amount} ${data.tokenSymbol}`;

  try {
    const role = await authorize('order:draft', label, data.chain);
    const makerId = await currentActorId(role);

    const evaluation = await evaluate(data);
    const checks = [
      check('permission', 'Người lập có quyền lập yêu cầu', true, `Vai ${role} có quyền lập.`),
      ...evaluation.checks,
    ];

    if (failedOf(checks).length > 0 || !evaluation.wallet) {
      await audit({
        role,
        action: 'order:draft',
        target: label,
        outcome: 'FAILURE',
        detail: `${makerId} lập yêu cầu ${label} bị chặn — ${describeFailed(checks)}`,
        chain: data.chain,
      });
      return err(
        'REQUEST_CHECK',
        `Chưa lập được yêu cầu: ${describeFailed(checks)}`,
        toFieldErrors(checks),
      );
    }

    const request = await getTokenRequestStore().createRequest({
      chain: data.chain,
      tokenSymbol: data.tokenSymbol,
      type: data.type,
      amount: data.amount.toString(),
      burnSource: data.type === 'BURN' ? data.burnSource : null,
      wallet: evaluation.wallet,
      reason: data.reason,
      documentRef: data.documentRef ?? null,
      effectiveDate: data.effectiveDate ?? null,
      note: data.note ?? null,
      makerId,
      makerRole: role,
    });

    await audit({
      role,
      action: 'order:draft',
      target: request.id,
      outcome: 'SUCCESS',
      detail: `${makerId} lập yêu cầu ${label}, chờ duyệt.`,
      chain: data.chain,
    });
    return ok({ request, checks });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Tìm yêu cầu còn chờ và chặn tự duyệt — phần chung của duyệt và từ chối.
 *
 * Trả `Result` lỗi đã ghi sổ, hoặc yêu cầu cùng mã người duyệt.
 */
async function loadForDecision(
  requestId: string,
  role: Role,
  verb: 'duyệt' | 'từ chối',
): Promise<Result<{ request: TokenRequestRecord; checkerId: string }>> {
  const checkerId = await currentActorId(role);
  const request = await getTokenRequestStore().findRequest(requestId);
  if (!request) {
    return err('VALIDATION', `Không có yêu cầu ${requestId}.`);
  }
  if (request.status !== 'PENDING') {
    return err(
      'REQUEST_STATE',
      `Yêu cầu ${requestId} đang ở trạng thái ${request.status}, không còn chờ ${verb}.`,
    );
  }
  if (request.makerId === checkerId) {
    await audit({
      role,
      action: 'order:approve',
      target: requestId,
      outcome: 'DENIED',
      detail: `${checkerId} tự ${verb} yêu cầu do chính mình lập — bị chặn.`,
      chain: request.chain,
    });
    return err(
      'SELF_APPROVAL',
      `Người lập (${checkerId}) không được ${verb} yêu cầu của chính mình, kể cả khi có quyền.`,
    );
  }
  return ok({ request, checkerId });
}

/**
 * Duyệt: kiểm lại toàn bộ điều kiện, chiếm quyền thực hiện bằng câu `UPDATE` có điều kiện, rồi
 * thực hiện NGAY trên ví thanh toán của người bán.
 *
 * Điều kiện đã đổi so với lúc lập thì CHẶN lần duyệt và nêu đúng điều kiện trượt; yêu cầu giữ
 * nguyên `PENDING` để Kiểm soát viên từ chối kèm lý do — hệ thống không tự đóng thay họ.
 */
export async function approveTokenRequest(
  input: unknown,
): Promise<Result<TokenRequestOutcomeView>> {
  const parsed = approveTokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { requestId, chain: selectedChain } = parsed.data;

  try {
    const role = await authorize('order:approve', requestId, selectedChain);
    const loaded = await loadForDecision(requestId, role, 'duyệt');
    if (!loaded.ok) return loaded;
    const { request, checkerId } = loaded.data;
    const { chain } = request;
    if (chain !== selectedChain) {
      return err(
        'REQUEST_CHECK',
        `Yêu cầu ${requestId} thuộc chain ${chain}, không phải chain đang chọn ${selectedChain}.`,
      );
    }

    // Kiểm lại TOÀN BỘ điều kiện tại thời điểm duyệt.
    const evaluation = await evaluate(draftOf(request));
    const walletMoved =
      evaluation.wallet !== null && evaluation.wallet.toLowerCase() !== request.wallet.toLowerCase();
    const checks = walletMoved
      ? [
          ...evaluation.checks,
          check('wallet', 'Ví tác động không đổi', false, `Ví lúc lập ${request.wallet}, nay ${evaluation.wallet}.`),
        ]
      : evaluation.checks;
    if (failedOf(checks).length > 0 || !evaluation.project) {
      await audit({
        role,
        action: 'order:approve',
        target: requestId,
        outcome: 'FAILURE',
        detail: `${checkerId} duyệt yêu cầu ${requestId} bị chặn vì điều kiện đã đổi — ${describeFailed(checks)}`,
        chain,
      });
      return err(
        'REQUEST_CHECK',
        `Điều kiện đã đổi so với lúc lập, chưa duyệt được: ${describeFailed(checks)}`,
        toFieldErrors(checks),
      );
    }

    // IN-04 C1: cách thực hiện quyết định TẠI LÚC DUYỆT, trước khi chiếm quyền. Mọi lần chặn ở đây
    // để yêu cầu giữ `PENDING` và KHÔNG BAO GIỜ tự quay về khoá máy chủ (QĐ-13).
    const custodyCheck = await decideCustody(request);
    if (!custodyCheck.ok) {
      await audit({
        role,
        action: 'order:approve',
        target: requestId,
        outcome: 'FAILURE',
        detail: `${checkerId} duyệt yêu cầu ${requestId} bị chặn: ${custodyCheck.error}`,
        chain,
      });
      return err('REQUEST_CHECK', custodyCheck.error);
    }
    const { custody, custodyContext } = custodyCheck.data;

    // Chiếm quyền thực hiện. `null` = một lần duyệt khác đã chiếm trước — dừng, KHÔNG gửi gì.
    // IN-04 QĐ-6: cách thực hiện và bối cảnh ký ghi TRONG cùng câu chiếm quyền.
    const store = getTokenRequestStore();
    const claimed = await store.transitionRequest({
      id: requestId,
      from: ['PENDING'],
      to: 'EXECUTING',
      checkerId,
      checkerRole: role,
      custody,
      ...(custodyContext ? { custodyContext } : {}),
    });
    if (!claimed) {
      return err('REQUEST_STATE', `Yêu cầu ${requestId} vừa được một lần duyệt khác xử lý.`);
    }

    let submitted = false;
    const onSubmitted = async (txHash: string) => {
      submitted = true;
      await store.attachRequestTxHash({ id: requestId, txHash });
    };
    // IN-04 QĐ-8b: bật NGAY TRƯỚC lời gọi tạo giao dịch Fireblocks. Từ đó không lối nào ghi `FAILED`
    // trừ kết quả mang cờ chắc chắn chưa lên chuỗi, hoặc biên nhận `FAILED`.
    let fireblocksAttempted = false;
    const route: CustodyRoute =
      custody === 'FIREBLOCKS' && claimed.custodyContext
        ? {
            kind: 'FIREBLOCKS',
            requestId,
            context: claimed.custodyContext,
            note: `IN-04 ${request.type} ${requestId}`,
            markAttempted: () => {
              fireblocksAttempted = true;
            },
          }
        : { kind: 'SERVER', onSubmitted };
    const via = custody === 'FIREBLOCKS' ? ' qua Fireblocks' : '';

    try {
      const amount = BigInt(request.amount);
      const auditContext = `Duyệt yêu cầu ${requestId} (lập bởi ${request.makerId}, duyệt bởi ${checkerId})`;
      const outcome: ExecutionResult<ApprovalSubmission> =
        request.type === 'MINT'
          ? await executeIssuance({
              chain,
              project: evaluation.project,
              spvWallet: request.wallet,
              amount,
              role,
              auditContext,
              route,
            })
          : await executeBurn({ chain, wallet: request.wallet, amount, role, auditContext, route });

      if (!outcome.ok) {
        if (fireblocksAttempted && !outcome.definitelyNotOnChain && !outcome.receiptFailed) {
          // Đã gọi tạo giao dịch mà lỗi không chứng minh "chưa lên chuỗi": giữ `EXECUTING`.
          return await keepExecuting({
            requestId,
            role,
            chain,
            detail:
              `${checkerId} duyệt yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}${via}: ` +
              `đã gửi Fireblocks, chưa rõ kết quả (${outcome.error}), cần đối soát.`,
            notice: `Đã gửi Fireblocks, chưa rõ kết quả (${outcome.error}); bấm Đối soát sau.`,
          });
        }
        await store.transitionRequest({
          id: requestId,
          from: ['EXECUTING'],
          to: 'FAILED',
          failureReason: outcome.error,
        });
        if (custody === 'FIREBLOCKS') {
          await audit({
            role,
            action: 'order:approve',
            target: requestId,
            outcome: 'FAILURE',
            detail: `${auditContext}${via}: không thực hiện được (${outcome.error}).`,
            chain,
          });
        }
        return { ok: false, code: outcome.code, error: outcome.error, fieldErrors: outcome.fieldErrors };
      }

      const result = outcome.data;
      if (result.status === 'UNKNOWN') {
        if (result.lostClaim) {
          // QĐ-16: lượt khác đã gắn mã và đi tiếp; lượt này KHÔNG ghi sổ, chỉ trả câu.
          const current = await store.findRequest(requestId);
          return current
            ? ok({ ...current, notice: result.reason })
            : err('REQUEST_STATE', `Không đọc lại được yêu cầu ${requestId}.`);
        }
        return await keepExecuting({
          requestId,
          role,
          chain,
          detail:
            `${checkerId} duyệt yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}${via}: ` +
            `đã gửi Fireblocks, chưa rõ kết quả, cần đối soát (${result.reason}).`,
          notice: result.reason,
        });
      }

      const { txHash } = result;
      const executed = result.claimed ?? request;
      const fireblocksNote = executed.custodyTxId ? `; mã Fireblocks ${executed.custodyTxId}` : '';
      if (result.status !== 'CONFIRMED') {
        /**
         * HF-05: hết giờ chờ biên nhận KHÔNG chứng minh giao dịch hỏng, cũng không chứng minh nó
         * xong. Giữ `EXECUTING` kèm mã giao dịch (đã gắn qua `attachRequestTxHash`), không ghi mốc
         * phát hành, không ghi sổ thành công cho thao tác token. Kiểm soát viên đối soát sau.
         */
        await audit({
          role,
          action: 'order:approve',
          target: requestId,
          outcome: 'SUCCESS',
          detail:
            `${checkerId} duyệt yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}${via}; ` +
            `tx ${txHash}: đã gửi, chưa có biên nhận, cần đối soát${fireblocksNote}.`,
          chain,
        });
        const current = await store.findRequest(requestId);
        return current ? ok(current) : err('REQUEST_STATE', `Không đọc lại được yêu cầu ${requestId}.`);
      }

      if (custody === 'FIREBLOCKS') {
        // QĐ-15: biên nhận CONFIRMED vẫn chỉ chốt khi giao dịch đúng lời gọi đã chuẩn bị, theo bối
        // cảnh của CHÍNH bản ghi vừa gắn mã.
        const blocked = await mismatchBlock({ request: executed, role, chain, auditContext });
        if (blocked) return blocked;
      }

      return await finalizeConfirmed({
        request,
        role,
        auditContext,
        txHash,
        approveDetail: `${checkerId} duyệt yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}${via}; tx ${txHash}${fireblocksNote}`,
      });
    } catch (error) {
      /**
       * Chưa gửi giao dịch: chắc chắn token chưa đổi → `FAILED`.
       * Đã gửi mà lỗi lúc đợi biên nhận: KHÔNG biết kết cục → để nguyên `EXECUTING` kèm mã giao
       * dịch cho người đối soát. Đánh `FAILED` ở đây là có thể nói "chưa tác động" về một giao
       * dịch đã thành công trên chuỗi.
       */
      const message = error instanceof Error ? error.message : String(error);
      const unsure = submitted || fireblocksAttempted;
      if (!unsure) {
        await store.transitionRequest({
          id: requestId,
          from: ['EXECUTING'],
          to: 'FAILED',
          failureReason: message,
        });
      }
      await audit({
        role,
        action: 'order:approve',
        target: requestId,
        outcome: 'FAILURE',
        detail: unsure
          ? `Duyệt yêu cầu ${requestId}${via}: đã gửi giao dịch nhưng chưa biết kết cục (${message}) — cần đối soát.`
          : `Duyệt yêu cầu ${requestId}: không gửi được giao dịch (${message}).`,
        chain,
      });
      throw error;
    }
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Đốt `amount` tại ví SPV: người gọi đã kiểm quyền và điều kiện.
 *
 * HF-05: như `executeIssuance`, hàm dừng ở biên nhận. Chỉ biên nhận `FAILED` được ghi sổ (thất
 * bại); dòng sổ thành công ghi lúc chốt, trong `finalizeTokenRequest`.
 */
async function executeBurn(input: {
  chain: ChainKey;
  wallet: string;
  amount: bigint;
  role: Role;
  auditContext: string;
  route: CustodyRoute;
}): Promise<ExecutionResult<ApprovalSubmission>> {
  const { chain, wallet, amount, role } = input;
  const sent = await sendViaCustody({
    chain,
    operation: 'burn',
    wallet,
    amount,
    role,
    fromWallet: wallet,
    toWallet: null,
    route: input.route,
    sendWithServerKey: () => getLedger(chain).burn(wallet, amount),
  });
  if (sent.kind === 'NOT_SENT') return { ok: false, code: 'LEDGER', error: sent.reason, definitelyNotOnChain: true };
  if (sent.kind === 'STORE_ERROR') return { ok: false, code: 'LEDGER', error: sent.reason };
  if (sent.kind === 'UNKNOWN') {
    return ok({ status: 'UNKNOWN', txHash: null, reason: sent.reason, lostClaim: sent.lostClaim });
  }
  const { receipt } = sent;
  if (receipt.status === 'FAILED') {
    await getStore().appendAudit({
      actorRole: role,
      action: 'token:burn',
      target: wallet,
      outcome: 'FAILURE',
      detail: `${input.auditContext}: đốt ${amount} tại ví SPV thất bại; tx ${receipt.txHash}`,
      chain,
    });
    return { ok: false, code: 'LEDGER', error: receipt.reason ?? 'Giao dịch đốt thất bại on-chain.', receiptFailed: true };
  }
  return ok({ txHash: receipt.txHash, status: receipt.status, issuedAt: null, claimed: sent.claimed });
}

/**
 * IN-04 C1: cách thực hiện lần duyệt và bối cảnh ký, TRƯỚC khi chiếm quyền. Trả lỗi (câu cho người
 * duyệt) ở mọi tình huống chưa chắc: đọc công tắc lỗi, bảng chain sai, công tắc bật mà thiếu cấu hình,
 * vault thiếu vai. Không có nhánh nào rơi về khoá máy chủ khi công tắc đang bật cho chain này.
 */
async function decideCustody(
  request: TokenRequestRecord,
): Promise<Result<{ custody: 'SERVER' | 'FIREBLOCKS'; custodyContext: TokenRequestCustodyContext | null }>> {
  const { chain } = request;
  let state: CustodyState;
  try {
    state = await getCustodyState();
  } catch {
    return err('REQUEST_CHECK', 'Không đọc được trạng thái Lưu ký Fireblocks; thử lại.');
  }
  const choice = custodyFor(chain, state);
  if (choice === 'SERVER') return ok({ custody: 'SERVER', custodyContext: null });
  if (choice === 'UNRESOLVED' || !state.scope.ok) {
    const reason = state.scope.ok ? 'không đọc được' : state.scope.reason;
    return err('REQUEST_CHECK', `Bảng chain của Lưu ký Fireblocks sai (${reason}); chưa duyệt được.`);
  }
  const { config, reason } = fireblocksConfig();
  if (!state.configured || !config) {
    return err(
      'REQUEST_CHECK',
      `Lưu ký Fireblocks đang bật nhưng thiếu cấu hình (${state.configError ?? reason}); chưa duyệt được.`,
    );
  }
  const assetId = state.scope.chainAssets[chain];
  if (!assetId) return err('REQUEST_CHECK', `Bảng chain của Lưu ký Fireblocks không có chain ${chain}.`);

  // QĐ-9: vault phải có đúng vai trên ProjectToken TRƯỚC khi chiếm quyền (D3: thiếu phương thức là lỗi lập trình).
  const ledger = getLedger(chain);
  if (!ledger.projectTokenRolesOf || !ledger.prepareContractCall || !ledger.transactionCallOf) {
    throw new Error(`Lỗi lập trình: ledger chain ${chain} không hỗ trợ Lưu ký Fireblocks.`);
  }
  const roles = await ledger.projectTokenRolesOf(config.vaultAddress);
  const needed = request.type === 'MINT' ? 'MINTER_ROLE' : 'AGENT_ROLE';
  if (!(request.type === 'MINT' ? roles.minter : roles.agent)) {
    return err('REQUEST_CHECK', `Vault Fireblocks ${config.vaultAddress} chưa có quyền ${needed} trên ProjectToken.`);
  }
  return ok({
    custody: 'FIREBLOCKS',
    custodyContext: {
      configRef: config.configRef,
      vaultId: config.vaultId,
      address: config.vaultAddress,
      assetId,
      chain,
      contract: null,
      callDataHash: null,
    },
  });
}

/** Giữ `EXECUTING`, ghi một dòng sổ "chưa rõ, cần đối soát" (như nhánh hết giờ HF-05), trả câu. */
async function keepExecuting(input: {
  requestId: string;
  role: Role;
  chain: ChainKey;
  detail: string;
  notice: string;
}): Promise<Result<TokenRequestOutcomeView>> {
  await audit({
    role: input.role,
    action: 'order:approve',
    target: input.requestId,
    outcome: 'SUCCESS',
    detail: input.detail,
    chain: input.chain,
  });
  const current = await getTokenRequestStore().findRequest(input.requestId);
  return current
    ? ok({ ...current, notice: input.notice })
    : err('REQUEST_STATE', `Không đọc lại được yêu cầu ${input.requestId}.`);
}

/**
 * QĐ-15: giao dịch đã gắn không khớp lời gọi đã chuẩn bị thì KHÔNG chốt: giữ `EXECUTING`, ghi sổ
 * FAILURE nêu trường lệch, trả câu cần đối soát tay. Khớp thì trả `null` để người gọi chốt tiếp.
 */
async function mismatchBlock(input: {
  request: TokenRequestRecord;
  role: Role;
  chain: ChainKey;
  auditContext: string;
}): Promise<Result<TokenRequestOutcomeView> | null> {
  const { request, role, chain } = input;
  const mismatch = await fireblocksCallMismatch(request);
  if (mismatch === null) return null;
  const notice = `Giao dịch ${request.txHash} không khớp lời gọi đã chuẩn bị; cần đối soát tay.`;
  await audit({
    role,
    action: 'order:approve',
    target: request.id,
    outcome: 'FAILURE',
    detail: `${input.auditContext} qua Fireblocks: ${notice} Trường lệch: ${mismatch}.`,
    chain,
  });
  const current = await getTokenRequestStore().findRequest(request.id);
  return current ? ok({ ...current, notice }) : err('REQUEST_STATE', `Không đọc lại được yêu cầu ${request.id}.`);
}

/** Câu báo khi chuỗi đã xác nhận mà database chưa chốt được: yêu cầu còn `EXECUTING`. */
const notFinalizedMessage = (requestId: string, why: string) =>
  `Giao dịch của yêu cầu ${requestId} đã xác nhận trên chuỗi, chưa chốt được (${why}). ` +
  'Yêu cầu giữ trạng thái Đang thực hiện; bấm Đối soát lại.';

/**
 * Chốt yêu cầu có biên nhận `CONFIRMED`: dùng chung cho lần duyệt và lần đối soát (HF-05).
 *
 * Đọc tổng cung (Mint) TRƯỚC, rồi gom đổi trạng thái, mốc phát hành và hai dòng sổ vào MỘT thao
 * tác lưu trữ nguyên tử. Lỗi ở bất kỳ bước nào thì yêu cầu giữ `EXECUTING` để đối soát lại:
 * biên nhận `CONFIRMED` không bao giờ dẫn tới `FAILED`.
 */
async function finalizeConfirmed(input: {
  request: TokenRequestRecord;
  role: Role;
  auditContext: string;
  txHash: string;
  approveDetail: string;
}): Promise<Result<TokenRequestRecord>> {
  const { request, role, auditContext, txHash } = input;
  const { chain } = request;

  let tokenAudit: NewAudit;
  let markIssuedProjectId: string | undefined;
  if (request.type === 'MINT') {
    let after: Awaited<ReturnType<typeof remainingIssuanceCap>>;
    try {
      const project = await getProjectStore().findProject({ tokenSymbol: request.tokenSymbol, chain });
      if (!project) throw new Error(`không còn dự án ${request.tokenSymbol} trên chain ${chain}`);
      markIssuedProjectId = project.id;
      after = await remainingIssuanceCap(chain, project);
    } catch (error) {
      return err('LEDGER', notFinalizedMessage(request.id, errorMessage(error)));
    }
    tokenAudit = {
      actorRole: role,
      action: 'token:mint',
      target: request.wallet,
      outcome: 'SUCCESS',
      detail:
        `${auditContext}: Phát hành ${request.amount} ${request.tokenSymbol} vào ví SPV; tổng cung trên chuỗi ` +
        `${after.supply}, trần còn lại ${after.remaining}; tx ${txHash}`,
      chain,
    };
  } else {
    tokenAudit = {
      actorRole: role,
      action: 'token:burn',
      target: request.wallet,
      outcome: 'SUCCESS',
      detail: `${auditContext}: đốt ${request.amount} tại ví SPV xong; tx ${txHash}`,
      chain,
    };
  }

  let finalized: TokenRequestRecord | null;
  try {
    finalized = await getTokenRequestStore().finalizeTokenRequest({
      id: request.id,
      to: 'COMPLETED',
      txHash,
      markIssuedProjectId,
      audits: [
        tokenAudit,
        {
          actorRole: role,
          action: 'order:approve',
          target: request.id,
          outcome: 'SUCCESS',
          detail: input.approveDetail,
          chain,
        },
      ],
    });
  } catch (error) {
    return err('LEDGER', notFinalizedMessage(request.id, errorMessage(error)));
  }
  return finalized
    ? ok(finalized)
    : err('REQUEST_STATE', `Yêu cầu ${request.id} đã được chốt ở lượt khác.`);
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Chờ biên nhận khi ĐỐI SOÁT: tối đa 1 giây, cùng mức `RECHECK_RECEIPT_TIMEOUT_MS` của luồng chia
 * (`distribution.service.ts`). Đối soát là hỏi lại một giao dịch đã gửi từ trước, không phải chờ
 * một giao dịch mới; chờ theo timeout của chuỗi (30 hoặc 90 giây) chỉ giữ người bấm lâu hơn.
 */
const RECONCILE_RECEIPT_TIMEOUT_MS = 1_000;

/**
 * Cập nhật dòng `Txn` theo `(chain, txHash)` sau một lần đọc biên nhận; không có thì tạo một dòng
 * (tiến trình cũ có thể chết trước khi ghi sổ). PENDING giữ nguyên dòng đã có. Idempotent, nên
 * làm ngoài transaction chốt.
 */
async function syncTxnFromReceipt(
  request: TokenRequestRecord,
  receipt: TxResult,
  role: Role,
): Promise<void> {
  const store = getStore();
  const existing = await store.findTxnByHash(request.chain, receipt.txHash);
  if (existing) {
    if (receipt.status !== 'PENDING') {
      await store.updateTxnStatus(existing.id, receipt.status, receipt.reason);
    }
    return;
  }
  // IN-04 QĐ-16: yêu cầu Fireblocks CHỈ cập nhật dòng đã có. Dòng `Txn` do đúng lượt gắn mã thắng ghi;
  // bảng `Txn` không có khoá duy nhất theo mã, nên thêm ở đây là có thể ra hai dòng cho một giao dịch.
  if (request.custody === 'FIREBLOCKS') return;
  await store.saveTxn({
    chain: request.chain,
    operation: request.type === 'MINT' ? 'mint' : 'burn',
    txHash: receipt.txHash,
    status: receipt.status,
    fromWallet: request.type === 'MINT' ? null : request.wallet,
    toWallet: request.type === 'MINT' ? request.wallet : null,
    amount: request.amount,
    reason: receipt.reason ?? null,
    actorRole: role,
    actorAddress: await signerAddressOrNull(request.chain),
  });
}

/**
 * ĐỐI SOÁT yêu cầu Mint/Burn đang `EXECUTING` có mã giao dịch (HF-05): đọc biên nhận MỘT lần rồi
 * chốt theo đúng biên nhận. KHÔNG BAO GIỜ gửi giao dịch mới.
 *
 * - `CONFIRMED`: chốt nguyên tử như lần duyệt (`finalizeConfirmed`).
 * - `FAILED`: `EXECUTING` sang `FAILED` cùng dòng sổ thất bại, trong một thao tác nguyên tử.
 * - `PENDING` hoặc đọc biên nhận lỗi: không đổi gì, trả yêu cầu còn `EXECUTING`.
 */
export async function reconcileTokenRequest(
  input: unknown,
): Promise<Result<TokenRequestOutcomeView>> {
  const parsed = reconcileTokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { requestId, chain: selectedChain } = parsed.data;

  try {
    const role = await authorize('order:approve', requestId, selectedChain);
    const actorId = await currentActorId(role);
    let request = await getTokenRequestStore().findRequest(requestId);
    if (!request) {
      return err('VALIDATION', `Không có yêu cầu ${requestId}.`);
    }
    if (request.chain !== selectedChain) {
      return err(
        'REQUEST_CHECK',
        `Yêu cầu ${requestId} thuộc chain ${request.chain}, không phải chain đang chọn ${selectedChain}.`,
      );
    }
    if (request.status !== 'EXECUTING') {
      return err(
        'REQUEST_STATE',
        `Yêu cầu ${requestId} đang ở trạng thái ${request.status}, không còn chờ đối soát.`,
      );
    }
    if (!request.txHash) {
      if (request.custody !== 'FIREBLOCKS') {
        return err(
          'REQUEST_STATE',
          `Yêu cầu ${requestId} chưa có mã giao dịch, không đối soát được bằng biên nhận; cần đối soát tay.`,
        );
      }
      // IN-04 C4: tra Fireblocks theo bối cảnh đã ghi; KHÔNG BAO GIỜ tạo giao dịch mới.
      const attached = await reconcileFireblocksHash(request, role, actorId);
      if (!attached.ok || attached.data.notice !== undefined || attached.data.status !== 'EXECUTING') {
        return attached;
      }
      request = attached.data;
    }
    const { chain } = request;
    const txHash = request.txHash as string;

    let receipt: TxResult;
    try {
      receipt = await getLedger(chain).waitReceipt(txHash, RECONCILE_RECEIPT_TIMEOUT_MS);
    } catch {
      // Đọc biên nhận lỗi không nói gì về kết cục: coi như còn chờ.
      receipt = { txHash, status: 'PENDING' };
    }
    await syncTxnFromReceipt(request, receipt, role);

    const auditContext = `Đối soát yêu cầu ${requestId} (lập bởi ${request.makerId}, đối soát bởi ${actorId})`;
    if (receipt.status === 'CONFIRMED') {
      if (request.custody === 'FIREBLOCKS') {
        const blocked = await mismatchBlock({ request, role, chain, auditContext });
        if (blocked) return blocked;
      }
      return await finalizeConfirmed({
        request,
        role,
        auditContext,
        txHash,
        approveDetail:
          `${actorId} đối soát yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}: ` +
          `biên nhận CONFIRMED, chốt hoàn tất; tx ${txHash}`,
      });
    }

    if (receipt.status === 'FAILED') {
      const reason = receipt.reason ?? 'Giao dịch thất bại on-chain.';
      const failed = await getTokenRequestStore().finalizeTokenRequest({
        id: requestId,
        to: 'FAILED',
        failureReason: reason,
        audits: [
          {
            actorRole: role,
            action: 'order:approve',
            target: requestId,
            outcome: 'FAILURE',
            detail: `${auditContext}: biên nhận FAILED (${reason}); tx ${txHash}`,
            chain,
          },
        ],
      });
      return failed
        ? ok(failed)
        : err('REQUEST_STATE', `Yêu cầu ${requestId} đã được chốt ở lượt khác.`);
    }

    // PENDING: chưa có kết cục, không ghi gì vào yêu cầu.
    return ok(request);
  } catch (error) {
    return toResult(error);
  }
}

/**
 * IN-04 C4: yêu cầu `FIREBLOCKS` chưa có mã giao dịch. Tra Fireblocks MỘT lần theo bối cảnh đã ghi:
 * - chưa thấy, chưa có mã, cấu hình đã đổi, tra lỗi: giữ nguyên, trả câu (`notice`);
 * - `DEAD`: chốt `FAILED` cùng dòng sổ (chắc chắn chưa phát lên chuỗi);
 * - có mã: gắn CÓ ĐIỀU KIỆN (QĐ-16). Thua thì trả câu, không ghi gì; thắng thì ghi MỘT dòng `Txn` (lỗi
 *   chỉ log) và trả bản ghi vừa gắn mã để đi tiếp đường biên nhận.
 */
async function reconcileFireblocksHash(
  request: TokenRequestRecord,
  role: Role,
  actorId: string,
): Promise<Result<TokenRequestOutcomeView>> {
  const store = getTokenRequestStore();
  const { config } = fireblocksConfig();
  const verdict = await reconcileViaFireblocks(request, {
    currentConfig: config,
    client: config ? getFireblocksClient() : null,
  });
  if (verdict.kind === 'WAIT') {
    if (verdict.fireblocksId && !request.custodyTxId) await noteCustodyTxId(request.id, verdict.fireblocksId);
    return ok({ ...request, notice: verdict.message });
  }
  if (verdict.kind === 'FAILED') {
    const failed = await store.finalizeTokenRequest({
      id: request.id,
      to: 'FAILED',
      failureReason: verdict.reason,
      audits: [
        {
          actorRole: role,
          action: 'order:approve',
          target: request.id,
          outcome: 'FAILURE',
          detail: `Đối soát yêu cầu ${request.id} (đối soát bởi ${actorId}) qua Fireblocks: ${verdict.reason}`,
          chain: request.chain,
        },
      ],
    });
    return failed ? ok(failed) : err('REQUEST_STATE', `Yêu cầu ${request.id} đã được chốt ở lượt khác.`);
  }

  if (!request.custodyTxId) await noteCustodyTxId(request.id, verdict.fireblocksId);
  const claimed = await store.claimTxHash({ id: request.id, txHash: verdict.txHash });
  if (!claimed) {
    const current = await store.findRequest(request.id);
    return ok({ ...(current ?? request), notice: 'Yêu cầu đang được đối soát ở lượt khác.' });
  }
  try {
    await getStore().saveTxn({
      chain: claimed.chain,
      operation: claimed.type === 'MINT' ? 'mint' : 'burn',
      txHash: verdict.txHash,
      status: 'PENDING',
      fromWallet: claimed.type === 'MINT' ? null : claimed.wallet,
      toWallet: claimed.type === 'MINT' ? claimed.wallet : null,
      amount: claimed.amount,
      reason: null,
      actorRole: role,
      actorAddress: claimed.custodyContext?.address ?? null,
    });
  } catch (error) {
    console.error(`[fireblocks] Không ghi được dòng Txn cho yêu cầu ${claimed.id}:`, errorMessage(error));
  }
  return ok(claimed);
}

/** Ghi `custodyTxId` khi đối soát tìm thấy giao dịch theo `externalTxId`; lỗi chỉ log. */
async function noteCustodyTxId(id: string, custodyTxId: string): Promise<void> {
  try {
    await getTokenRequestStore().attachCustodyTxId({ id, custodyTxId });
  } catch (error) {
    console.error(`[fireblocks] Không ghi được mã Fireblocks cho yêu cầu ${id}:`, errorMessage(error));
  }
}

/** Từ chối: bắt buộc có lý do, không tác động token. */
export async function rejectTokenRequest(
  input: unknown,
): Promise<Result<TokenRequestRecord>> {
  const parsed = rejectTokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    // Lần từ chối thiếu lý do cũng là một lần bị chặn, nên cũng vào sổ.
    try {
      const raw = (input ?? {}) as { requestId?: unknown };
      await audit({
        role: await currentRole(),
        action: 'order:approve',
        target: typeof raw.requestId === 'string' ? raw.requestId : null,
        outcome: 'FAILURE',
        detail: `Từ chối bị chặn: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        chain: null,
      });
    } catch {
      // Ghi sổ thất bại không được đổi câu trả lời VALIDATION thành lỗi hệ thống.
    }
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { requestId, chain: selectedChain, reason } = parsed.data;

  try {
    const role = await authorize('order:approve', requestId, selectedChain);
    const loaded = await loadForDecision(requestId, role, 'từ chối');
    if (!loaded.ok) return loaded;
    const { request, checkerId } = loaded.data;
    if (request.chain !== selectedChain) {
      return err(
        'REQUEST_CHECK',
        `Yêu cầu ${requestId} thuộc chain ${request.chain}, không phải chain đang chọn ${selectedChain}.`,
      );
    }

    const rejected = await getTokenRequestStore().transitionRequest({
      id: requestId,
      from: ['PENDING'],
      to: 'REJECTED',
      checkerId,
      checkerRole: role,
      rejectReason: reason,
    });
    if (!rejected) {
      return err('REQUEST_STATE', `Yêu cầu ${requestId} vừa được một lần xử lý khác đóng.`);
    }

    await audit({
      role,
      action: 'order:approve',
      target: requestId,
      outcome: 'SUCCESS',
      detail: `${checkerId} từ chối yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}: ${reason}`,
      chain: request.chain,
    });
    return ok(rejected);
  } catch (error) {
    return toResult(error);
  }
}

/** Danh sách yêu cầu cho hai màn Lập lệnh và Phê duyệt lệnh. Hai vai vận hành đều xem được. */
export async function listTokenRequests(input: unknown): Promise<Result<TokenRequestRecord[]>> {
  const parsed = tokenRequestQuerySchema.safeParse(input ?? {});
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  try {
    const role = await authorize('ops:read', null, parsed.data.chain ?? null);
    const { mine, ...filters } = parsed.data;
    const makerId = mine ? await currentActorId(role) : undefined;
    return ok(await getTokenRequestStore().listRequests({ ...filters, makerId }));
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Số việc đang chờ theo vai — nguồn số cạnh hai mục menu Lập lệnh và Phê duyệt lệnh.
 *
 * Theo QUYỀN, không theo tên vai: vai có `order:draft` thấy số yêu cầu MÌNH đã lập đang chờ duyệt;
 * vai có `order:approve` thấy số yêu cầu NGƯỜI KHÁC lập đang chờ — yêu cầu của chính mình không
 * phải việc của mình để duyệt. Vai không có quyền nào thấy 0.
 */
export async function countPendingWork(
  role: Role,
  actorId: string,
  chain?: ChainKey,
): Promise<PendingWorkView> {
  const store = getTokenRequestStore();
  const [draft, approval] = await Promise.all([
    can(role, 'order:draft')
      ? store.countRequests({ chain, status: 'PENDING', makerId: actorId })
      : Promise.resolve(0),
    can(role, 'order:approve')
      ? store.countRequests({ chain, status: 'PENDING', excludeMakerId: actorId })
      : Promise.resolve(0),
  ]);
  return { draft, approval };
}

/** Số việc chờ trên đúng chain đang chọn, dùng cho menu phía client. */
export async function getPendingWork(chain: unknown): Promise<Result<PendingWorkView>> {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  try {
    const role = await currentRole();
    return ok(await countPendingWork(role, await currentActorId(role), parsed.data));
  } catch (error) {
    return toResult(error);
  }
}

// ===========================================================================
//  FE-22 — các phép ĐỌC cho hai màn Lập lệnh và Phê duyệt lệnh
//
//  Giao diện chỉ hiển thị; mọi con số tính ở đây. Kiểm quyền bằng `assertCan` KHÔNG ghi sổ, cùng
//  cách `listAuditLog`: đây là phép đọc chạy mỗi lần mở trang, ghi sổ từng lần thì sổ kiểm toán
//  ngập dòng "ALLOWED" và những thao tác thật khó tìm.
// ===========================================================================

/** Khối thông tin token — mọi số là CHUỖI vì `bigint` không qua được biên máy chủ sang trình duyệt. */
export interface TokenInfoView {
  chain: ChainKey;
  tokenSymbol: string;
  projectName: string;
  /** Địa chỉ hợp đồng ghi trong bảng dự án; `null` khi bảng chưa ghi. */
  contractAddress: string | null;
  /** Trần phát hành theo bảng dự án. */
  cap: string;
  /** Số còn được phát hành: trần trừ tổng cung trên chuỗi. */
  remaining: string;
  totalSupply: string;
  /** Phần chưa phân phối: số dư ví thanh toán SPV. */
  undistributed: string;
  /** Đang lưu hành: tổng cung trừ phần chưa phân phối. */
  circulating: string;
  /**
   * Mã người bán của dự án. Bảng dự án CHƯA có cột người bán (PoC một người bán), nên lấy mã tài
   * khoản mẫu của vai Người bán — cùng nguồn với bộ chọn vai. Khi có cột thật thì đổi ở đây.
   */
  sellerCode: string;
  /** Ví thanh toán SPV theo chuỗi; `null` khi chưa phát hành lần nào. */
  spvWallet: string | null;
  issuedAt: string | null;
}

/** Không có dự án cho ký hiệu đã gõ — quy về `VALIDATION`, không phải lỗi hệ thống. */
class TokenInfoNotFoundError extends Error {}

const tokenInfoResult = (error: unknown): Result<never> =>
  error instanceof TokenInfoNotFoundError ? err('VALIDATION', error.message) : toResult(error);

/** Tra khối thông tin token theo ký hiệu. */
export async function getTokenInfo(input: unknown): Promise<Result<TokenInfoView>> {
  const parsed = tokenInfoQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, tokenSymbol } = parsed.data;
  try {
    assertCan(await currentRole(), 'ops:read');
    return ok(await readTokenInfo(chain, tokenSymbol));
  } catch (error) {
    return tokenInfoResult(error);
  }
}

/** Phần đọc của `getTokenInfo`, không kiểm quyền — dùng lại cho màn chi tiết. */
async function readTokenInfo(chain: ChainKey, tokenSymbol: string): Promise<TokenInfoView> {
  const project = await readStep('project.lookup', () => getProjectStore().findProject({ tokenSymbol, chain }));
  if (!project) {
    throw new TokenInfoNotFoundError(`Chưa có dự án "${tokenSymbol}" trên chuỗi "${chain}".`);
  }
  // Năm chỉ tiêu nguồn cung đọc qua `readSupplyMetrics` (FE-21) — một chỗ tính cho màn Người bán,
  // khối kiểm tra Burn và khối này, nên ba nơi không thể ra hai con số khác nhau.
  const spvRead = readStep('rpc.spv', () => getLedger(chain).spvWallet());
  const [metrics, spv] = await Promise.all([
    readSupplyMetrics(chain, project, spvRead),
    spvRead,
  ]);
  return {
    chain,
    tokenSymbol: project.tokenSymbol,
    projectName: project.name,
    contractAddress: project.contractAddress,
    ...metrics,
    sellerCode: SAMPLE_ACCOUNTS.seller,
    spvWallet: spv,
    issuedAt: project.issuedAt,
  };
}

/** Bốn thẻ số liệu của màn Lập lệnh: yêu cầu tạo / huỷ token do CHÍNH người này lập, đang chờ duyệt. */
export interface DraftStatsView {
  pendingMint: number;
  pendingBurn: number;
}

export async function getDraftStats(chain: unknown): Promise<Result<DraftStatsView>> {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  try {
    const role = await currentRole();
    assertCan(role, 'order:draft');
    const makerId = await currentActorId(role);
    const store = getTokenRequestStore();
    const [pendingMint, pendingBurn] = await Promise.all(
      (['MINT', 'BURN'] as const).map((type) =>
        store.countRequests({ chain: parsed.data, status: 'PENDING', makerId, type }),
      ),
    );
    return ok({ pendingMint, pendingBurn });
  } catch (error) {
    return toResult(error);
  }
}

/** Ba thẻ số liệu của màn Phê duyệt lệnh. */
export interface ApprovalStatsView {
  /** Yêu cầu NGƯỜI KHÁC lập đang chờ — đúng con số cạnh mục menu. */
  pending: number;
  /** Đã duyệt hôm nay: quyết định duyệt từ đầu ngày, bất kể kết cục sau đó trên chuỗi. */
  approvedToday: number;
  rejectedToday: number;
  /**
   * UIUX-01: 50 yêu cầu đã có quyết định gần nhất của chain, mới quyết định trước. Đi kèm action
   * thẻ số liệu để màn không thêm action khi mở.
   */
  history: TokenRequestRecord[];
}

/**
 * Giờ Việt Nam lệch UTC cố định +7, không có giờ mùa hè — nên một hằng số là đủ, không cần thư
 * viện múi giờ. "Hôm nay" tính theo giờ Việt Nam: máy chủ chạy UTC thì nửa đêm UTC là 7 giờ sáng ở
 * Hà Nội, và thẻ "hôm nay" sẽ xoá số lúc giữa buổi sáng.
 */
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Mốc 00:00 hôm nay theo giờ Việt Nam, dạng ISO (UTC). */
export function startOfVietnamDay(now: Date = new Date()): string {
  const local = new Date(now.getTime() + VIETNAM_UTC_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - VIETNAM_UTC_OFFSET_MS).toISOString();
}

/** Trạng thái mà một yêu cầu ĐÃ ĐƯỢC DUYỆT có thể đang ở: đang xử lý, hoàn tất hoặc thất bại. */
const APPROVED_STATUSES: readonly TokenRequestStatus[] = ['EXECUTING', 'COMPLETED', 'FAILED'];

export async function getApprovalStats(chain: unknown): Promise<Result<ApprovalStatsView>> {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  try {
    const role = await currentRole();
    assertCan(role, 'order:approve');
    const actorId = await currentActorId(role);
    const decidedFrom = startOfVietnamDay();
    const store = getTokenRequestStore();
    const [work, approved, rejectedToday, history] = await Promise.all([
      countPendingWork(role, actorId, parsed.data),
      Promise.all(
        APPROVED_STATUSES.map((status) =>
          store.countRequests({ chain: parsed.data, status, decidedFrom }),
        ),
      ),
      store.countRequests({ chain: parsed.data, status: 'REJECTED', decidedFrom }),
      store.listRequests({ chain: parsed.data, decided: true, limit: APPROVAL_HISTORY_LIMIT }),
    ]);
    return ok({
      pending: work.approval,
      approvedToday: approved.reduce((sum, n) => sum + n, 0),
      rejectedToday,
      history,
    });
  } catch (error) {
    return toResult(error);
  }
}

/** Một dòng nhật ký của yêu cầu. */
export interface TimelineEntry {
  at: string;
  actor: string | null;
  label: string;
  detail: string | null;
}

export interface TokenRequestDetailView {
  request: TokenRequestRecord;
  /** `null` khi không đọc được (dự án đã bị gỡ, chuỗi lỗi) — kèm lý do ở `tokenError`. */
  token: TokenInfoView | null;
  tokenError: string | null;
  /**
   * Lý do người đang xem KHÔNG được duyệt / từ chối yêu cầu này vì chính họ đã lập; `null` khi
   * không phải. Cùng phép so mà `loadForDecision` chặn ở lúc duyệt — giao diện báo trước, không
   * bắt người dùng bấm rồi mới thấy lỗi.
   */
  selfApprovalReason: string | null;
  /**
   * HF-05: hiện nút "Đối soát": yêu cầu `EXECUTING`, có mã giao dịch, và vai đang xem có quyền
   * duyệt. Tính ở đây, trong CÙNG lần đọc chi tiết, để màn không phải gọi thêm action khi mở.
   */
  canReconcile: boolean;
  /**
   * FIX-02 QĐ-4: lý do yêu cầu `PENDING` không thực hiện được với số liệu token hiện tại; `null` khi
   * bấm "Chấp nhận" được. Tính trong CÙNG lần đọc chi tiết, không thêm action. Chỉ khoá "Chấp nhận".
   */
  approveWarning: ApproveWarning | null;
  /**
   * IN-04 C7: dòng "Thực hiện qua". Yêu cầu chờ duyệt: cách sẽ dùng nếu duyệt bây giờ; đã duyệt: cách
   * đã ghi lúc chiếm quyền. Dựng sẵn ở máy chủ trong CÙNG lần đọc chi tiết, không thêm action.
   */
  custodyLabel: string;
  timeline: TimelineEntry[];
}

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const SERVER_CUSTODY_LABEL = 'Khoá ký máy chủ';

/** IN-04 C7 (hàm thuần): nhãn cách thực hiện của một yêu cầu đã chiếm quyền. */
export function recordedCustodyLabel(request: Pick<TokenRequestRecord, 'custody' | 'custodyContext' | 'custodyTxId'>): string {
  if (request.custody !== 'FIREBLOCKS' || !request.custodyContext) return SERVER_CUSTODY_LABEL;
  const { vaultId, address } = request.custodyContext;
  return (
    `Fireblocks, vault ${vaultId} (${shortAddress(address)})` +
    (request.custodyTxId ? `; mã Fireblocks ${request.custodyTxId}` : '')
  );
}

/** Nhãn "Thực hiện qua" cho màn chi tiết; đọc công tắc bằng bản cho hiển thị (không ném). */
async function custodyLabelOf(request: TokenRequestRecord): Promise<string> {
  if (request.status === 'REJECTED') return 'Không thực hiện (đã từ chối)';
  if (request.status !== 'PENDING') return recordedCustodyLabel(request);
  const state = await getCustodyStateForLayout();
  if (state.unreadable) return 'Chưa đọc được';
  const choice = custodyFor(request.chain, state);
  if (choice === 'SERVER') return SERVER_CUSTODY_LABEL;
  if (choice === 'UNRESOLVED') return 'Chưa xác định (bảng chain của Lưu ký Fireblocks sai)';
  const { config } = fireblocksConfig();
  return config
    ? `Fireblocks, vault ${config.vaultId} (${shortAddress(config.vaultAddress)})`
    : 'Fireblocks (thiếu cấu hình; lần duyệt sẽ bị chặn)';
}

export type ApproveWarningKind = 'TOKEN_UNREADABLE' | 'MINT_REMAINING' | 'BURN_FULL_SUPPLY' | 'BURN_UNDISTRIBUTED';

export interface ApproveWarning {
  kind: ApproveWarningKind;
  message: string;
  /** Số lượng của yêu cầu; `null` với `TOKEN_UNREADABLE`. */
  requested: string | null;
  /** Số còn lại để so (trần còn lại, tổng cung, phần chưa phân phối); `null` với `TOKEN_UNREADABLE`. */
  available: string | null;
}

/**
 * Cảnh báo lúc duyệt (FIX-02 QĐ-4), xét theo thứ tự và lấy cái đầu tiên. Không cộng trừ các yêu cầu
 * đang `EXECUTING`; lớp chặn cuối vẫn là lần kiểm lại trong `approveTokenRequest` và hợp đồng.
 */
export function approveWarningOf(
  request: Pick<TokenRequestRecord, 'status' | 'type' | 'amount' | 'burnSource'>,
  token: Pick<TokenInfoView, 'remaining' | 'undistributed' | 'totalSupply'> | null,
): ApproveWarning | null {
  if (request.status !== 'PENDING') return null;
  if (!token) {
    return { kind: 'TOKEN_UNREADABLE', message: 'Không đọc được số liệu token để kiểm tra.', requested: null, available: null };
  }
  const amount = BigInt(request.amount);
  if (request.type === 'MINT') {
    return amount > BigInt(token.remaining)
      ? {
          kind: 'MINT_REMAINING',
          message: 'Không đủ số lượng token còn được phép phát hành.',
          requested: request.amount,
          available: token.remaining,
        }
      : null;
  }
  if (request.burnSource === 'TOTAL_SUPPLY' && amount !== BigInt(token.totalSupply)) {
    return {
      kind: 'BURN_FULL_SUPPLY',
      message: 'Tổng cung đã đổi so với lúc lập yêu cầu huỷ toàn bộ nguồn cung.',
      requested: request.amount,
      available: token.totalSupply,
    };
  }
  if (amount > BigInt(token.undistributed)) {
    return {
      kind: 'BURN_UNDISTRIBUTED',
      message: 'Không đủ số lượng token chưa phân phối còn lại.',
      requested: request.amount,
      available: token.undistributed,
    };
  }
  return null;
}

/**
 * Nhật ký dựng từ các mốc đã lưu trên chính yêu cầu — không có dòng nào suy đoán.
 *
 * Mỗi quyết định là MỘT dòng, nhãn theo kết cục hiện tại: chấp nhận rồi hoàn tất là một việc của
 * Kiểm soát viên, tách hai dòng thì nhật ký trông như có hai người làm hai việc.
 */
function timelineOf(request: TokenRequestRecord): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    {
      at: request.createdAt,
      actor: request.makerId,
      label: 'Lập yêu cầu, chờ duyệt',
      detail: request.reason,
    },
  ];
  if (!request.decidedAt) return entries;

  const decided = { at: request.completedAt ?? request.decidedAt, actor: request.checkerId };
  switch (request.status) {
    case 'REJECTED':
      entries.push({ ...decided, label: 'Từ chối', detail: request.rejectReason });
      break;
    case 'COMPLETED':
      entries.push({ ...decided, label: 'Chấp nhận, hoàn tất trên chuỗi', detail: request.txHash });
      break;
    case 'FAILED':
      entries.push({ ...decided, label: 'Chấp nhận, thất bại khi thực hiện', detail: request.failureReason });
      break;
    case 'EXECUTING':
      entries.push({
        ...decided,
        label: 'Chấp nhận, đang xử lý trên chuỗi',
        detail: request.txHash
          ? `Đã gửi giao dịch ${request.txHash}, chưa biết kết cục — cần đối soát.`
          : null,
      });
      break;
    case 'PENDING':
      break;
  }
  return entries;
}

/** Chi tiết một yêu cầu cho màn chi tiết của Kiểm soát viên. */
export async function getTokenRequestDetail(
  input: unknown,
): Promise<Result<TokenRequestDetailView>> {
  const parsed = tokenRequestDetailSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  try {
    const role = await currentRole();
    assertCan(role, 'ops:read');
    const request = await getTokenRequestStore().findRequest(parsed.data.requestId);
    if (!request) {
      return err('VALIDATION', `Không có yêu cầu ${parsed.data.requestId}.`);
    }
    if (request.chain !== parsed.data.chain) {
      return err(
        'REQUEST_CHECK',
        `Yêu cầu ${request.id} thuộc chain ${request.chain}, không phải chain đang chọn ${parsed.data.chain}.`,
      );
    }
    const actorId = await currentActorId(role);

    let token: TokenInfoView | null = null;
    let tokenError: string | null = null;
    try {
      token = await readTokenInfo(request.chain, request.tokenSymbol);
    } catch (error) {
      const failed = tokenInfoResult(error);
      tokenError = failed.ok ? null : failed.error;
    }

    return ok({
      request,
      token,
      tokenError,
      selfApprovalReason:
        request.makerId === actorId
          ? `Bạn (${actorId}) đã lập yêu cầu này nên không được duyệt hay từ chối nó, kể cả khi có quyền.`
          : null,
      // IN-04 C6: yêu cầu Fireblocks chưa có mã vẫn đối soát được (tra Fireblocks).
      canReconcile:
        request.status === 'EXECUTING' &&
        (request.txHash !== null || request.custody === 'FIREBLOCKS') &&
        can(role, 'order:approve'),
      approveWarning: approveWarningOf(request, token),
      custodyLabel: await custodyLabelOf(request),
      timeline: timelineOf(request),
    });
  } catch (error) {
    return toResult(error);
  }
}
