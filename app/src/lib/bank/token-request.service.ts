import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { can, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import {
  getProjectStore,
  getStore,
  getTokenRequestStore,
  type ProjectRecord,
  type TokenRequestRecord,
} from '@/lib/store';
import { authorize, toResult } from './authorize';
import { executeIssuance, remainingIssuanceCap, trackTxn } from './issuance.service';
import { err, ok, type Result } from './result';
import {
  approveTokenRequestSchema,
  createTokenRequestSchema,
  rejectTokenRequestSchema,
  tokenRequestQuerySchema,
} from './schemas';

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
 * `excludeRequestId`: lúc duyệt, chính yêu cầu đang duyệt là một yêu cầu "đang chờ"; không loại
 * nó ra thì điều kiện "không có yêu cầu đang chờ" không bao giờ đạt.
 */
async function evaluate(draft: RequestDraft, excludeRequestId?: string): Promise<Evaluation> {
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
    const { cap, supply, remaining } = await remainingIssuanceCap(chain, project);
    checks.push(
      check(
        'cap',
        'Không vượt trần còn lại',
        amount <= remaining,
        `Số lượng ${amount}; trần còn lại ${remaining} (trần ${cap} − tổng cung ${supply}).`,
      ),
    );

    const wallet = draft.wallet ?? '';
    const [whitelisted, frozen] = await Promise.all([
      ledger.isWhitelisted(wallet),
      ledger.isFrozen(wallet),
    ]);
    const matchesSpv = spv === null || spv.toLowerCase() === wallet.toLowerCase();
    checks.push(
      check(
        'wallet',
        'Ví đích hợp lệ',
        whitelisted && !frozen && matchesSpv,
        !matchesSpv
          ? `Ví đích phải là ví thanh toán SPV đã đăng ký trên chuỗi (${spv}).`
          : !whitelisted
            ? `Ví ${wallet} chưa được whitelist.`
            : frozen
              ? `Ví ${wallet} đang bị đóng băng.`
              : `Ví ${wallet} đã whitelist, không bị đóng băng.`,
      ),
    );

    // Đang chờ = chưa có kết cục: PENDING hoặc đang thực hiện.
    const store = getTokenRequestStore();
    const open = (
      await Promise.all(
        (['PENDING', 'EXECUTING'] as const).map((status) =>
          store.listRequests({ chain, tokenSymbol, type: 'MINT', status, limit: 2 }),
        ),
      )
    )
      .flat()
      .filter((r) => r.id !== excludeRequestId);
    checks.push(
      check(
        'noPending',
        'Không có yêu cầu Mint khác đang chờ cho token này',
        open.length === 0,
        open.length === 0
          ? 'Không có.'
          : `Yêu cầu ${open[0].id} đang ở trạng thái ${open[0].status}.`,
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

  const [undistributed, { totalSupply }] = await Promise.all([
    ledger.balanceOf(spv),
    ledger.tokenInfo(),
  ]);
  const circulating = totalSupply - undistributed;

  checks.push(
    check(
      'undistributed',
      'Không vượt phần chưa phân phối',
      amount <= undistributed,
      `Số lượng ${amount}; phần chưa phân phối trong ví SPV ${undistributed}.`,
    ),
  );
  if (draft.burnSource === 'TOTAL_SUPPLY') {
    checks.push(
      check(
        'circulation',
        'Không còn token đang lưu hành',
        circulating === 0n,
        circulating === 0n
          ? 'Toàn bộ nguồn cung còn trong ví SPV.'
          : `Còn ${circulating} token đang lưu hành ngoài ví SPV — không đốt theo toàn bộ nguồn cung.`,
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
): Promise<Result<TokenRequestRecord>> {
  const parsed = approveTokenRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { requestId } = parsed.data;

  try {
    const role = await authorize('order:approve', requestId, null);
    const loaded = await loadForDecision(requestId, role, 'duyệt');
    if (!loaded.ok) return loaded;
    const { request, checkerId } = loaded.data;
    const { chain } = request;

    // Kiểm lại TOÀN BỘ điều kiện tại thời điểm duyệt.
    const evaluation = await evaluate(draftOf(request), request.id);
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

    // Chiếm quyền thực hiện. `null` = một lần duyệt khác đã chiếm trước — dừng, KHÔNG gửi gì.
    const store = getTokenRequestStore();
    const claimed = await store.transitionRequest({
      id: requestId,
      from: ['PENDING'],
      to: 'EXECUTING',
      checkerId,
      checkerRole: role,
    });
    if (!claimed) {
      return err('REQUEST_STATE', `Yêu cầu ${requestId} vừa được một lần duyệt khác xử lý.`);
    }

    let submitted = false;
    const onSubmitted = async (txHash: string) => {
      submitted = true;
      await store.attachRequestTxHash({ id: requestId, txHash });
    };

    try {
      const amount = BigInt(request.amount);
      const auditContext = `Duyệt yêu cầu ${requestId} (lập bởi ${request.makerId}, duyệt bởi ${checkerId})`;
      const outcome =
        request.type === 'MINT'
          ? await executeIssuance({
              chain,
              project: evaluation.project,
              spvWallet: request.wallet,
              amount,
              role,
              auditContext,
              onSubmitted,
            })
          : await executeBurn({ chain, wallet: request.wallet, amount, role, auditContext, onSubmitted });

      if (!outcome.ok) {
        await store.transitionRequest({
          id: requestId,
          from: ['EXECUTING'],
          to: 'FAILED',
          failureReason: outcome.error,
        });
        return outcome;
      }

      const completed = await store.transitionRequest({
        id: requestId,
        from: ['EXECUTING'],
        to: 'COMPLETED',
        txHash: outcome.data.txHash,
      });
      await audit({
        role,
        action: 'order:approve',
        target: requestId,
        outcome: 'SUCCESS',
        detail: `${checkerId} duyệt yêu cầu ${request.type} ${request.amount} ${request.tokenSymbol}; tx ${outcome.data.txHash}`,
        chain,
      });
      return completed ? ok(completed) : err('REQUEST_STATE', `Không đóng được yêu cầu ${requestId}.`);
    } catch (error) {
      /**
       * Chưa gửi giao dịch: chắc chắn token chưa đổi → `FAILED`.
       * Đã gửi mà lỗi lúc đợi biên nhận: KHÔNG biết kết cục → để nguyên `EXECUTING` kèm mã giao
       * dịch cho người đối soát. Đánh `FAILED` ở đây là có thể nói "chưa tác động" về một giao
       * dịch đã thành công trên chuỗi.
       */
      const message = error instanceof Error ? error.message : String(error);
      if (!submitted) {
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
        detail: submitted
          ? `Duyệt yêu cầu ${requestId}: đã gửi giao dịch nhưng chưa biết kết cục (${message}) — cần đối soát.`
          : `Duyệt yêu cầu ${requestId}: không gửi được giao dịch (${message}).`,
        chain,
      });
      throw error;
    }
  } catch (error) {
    return toResult(error);
  }
}

/** Đốt `amount` tại ví SPV — người gọi đã kiểm quyền và điều kiện. */
async function executeBurn(input: {
  chain: ChainKey;
  wallet: string;
  amount: bigint;
  role: Role;
  auditContext: string;
  onSubmitted: (txHash: string) => Promise<void>;
}): Promise<Result<{ txHash: string }>> {
  const { chain, wallet, amount, role } = input;
  const pending = await getLedger(chain).burn(wallet, amount);
  const receipt = await trackTxn({
    chain,
    pending,
    operation: 'burn',
    fromWallet: wallet,
    toWallet: null,
    amount,
    role,
    onSubmitted: input.onSubmitted,
  });
  const failed = receipt.status === 'FAILED';
  await getStore().appendAudit({
    actorRole: role,
    action: 'token:burn',
    target: wallet,
    outcome: failed ? 'FAILURE' : 'SUCCESS',
    detail: `${input.auditContext}: đốt ${amount} tại ví SPV ${failed ? 'thất bại' : 'xong'}; tx ${receipt.txHash}`,
    chain,
  });
  if (failed) return err('LEDGER', receipt.reason ?? 'Giao dịch đốt thất bại on-chain.');
  return ok({ txHash: receipt.txHash });
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
  const { requestId, reason } = parsed.data;

  try {
    const role = await authorize('order:approve', requestId, null);
    const loaded = await loadForDecision(requestId, role, 'từ chối');
    if (!loaded.ok) return loaded;
    const { request, checkerId } = loaded.data;

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
    await authorize('ops:read', null, parsed.data.chain ?? null);
    return ok(await getTokenRequestStore().listRequests(parsed.data));
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
export async function countPendingWork(role: Role, actorId: string): Promise<PendingWorkView> {
  const store = getTokenRequestStore();
  const [draft, approval] = await Promise.all([
    can(role, 'order:draft')
      ? store.countRequests({ status: 'PENDING', makerId: actorId })
      : Promise.resolve(0),
    can(role, 'order:approve')
      ? store.countRequests({ status: 'PENDING', excludeMakerId: actorId })
      : Promise.resolve(0),
  ]);
  return { draft, approval };
}
