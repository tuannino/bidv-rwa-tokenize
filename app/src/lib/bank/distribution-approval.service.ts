import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { assertCan, can, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { getDistributionStore, getKeeperStore, UniqueConstraintError } from '@/lib/store';
import type { DistributionPayoutRecord, DistributionPeriodRecord } from '@/lib/store';
import { readDistributionMinNewBalance } from '@/lib/store/config-values';
import { authorize, toResult } from './authorize';
import {
  chainContext,
  collectRecipients,
  driveOpening,
  findPeriodOnChain,
  isPayable,
  isPeriod,
  MAX_RECIPIENT_SCAN,
  reconcileChainPeriods,
  shareOf,
  toPeriodView,
  type ChainContext,
  type DistributionPeriodView,
  type DistributionRunView,
} from './distribution.service';
import {
  DISTRIBUTION_JOB_NAME,
  listDistributionRuns,
  runApprovedPeriod,
  type ApprovedRoundOutcome,
  type DistributionRunLogView,
} from './distribution-trigger.service';
import { err, ok, type ErrorCode, type Result } from './result';
import {
  approveDistributionSchema,
  distributionOverviewSchema,
  distributionPageSchema,
  distributionPeriodSchema,
  listDistributionPayoutsSchema,
  listDistributionPeriodsSchema,
  reapproveDistributionSchema,
} from './schemas';

/**
 * FE-08: KIỂM SOÁT VIÊN DUYỆT CON SỐ KỲ RỒI HỆ THỐNG MỚI CHIA.
 *
 * Mục tiêu duy nhất của tệp này: **không đồng VNDB nào rời quỹ chia khi chưa có Kiểm soát viên
 * duyệt đúng số đó**. Ba hành động ghi (`distribution:approve`, chỉ `CONTROLLER`):
 *
 * - `approveDistribution`: duyệt số Kiểm soát viên nhìn thấy; khác phần chưa phân bổ thì từ chối
 *   không gửi gì; khớp thì giữ chỗ kỳ (một kỳ hoạt động mỗi chain), mở kỳ trên chuỗi, so số
 *   thực tế; đúng số thì chốt kỳ vault rồi chia, khác số thì DỪNG ở `AMOUNT_CHANGED`.
 * - `reapproveDistribution`: duyệt lại đúng số trên chuỗi của kỳ `AMOUNT_CHANGED` (hoặc kỳ cũ chưa
 *   có lần duyệt) rồi chia.
 * - `continueDistribution`: tiếp tục kỳ đã `APPROVED` (phục hồi `OPENING`, đối soát vault, chia
 *   tiếp lô còn lại).
 *
 * Kiểm soát viên duyệt TỔNG SỐ, không duyệt danh sách hay tỷ lệ (QĐ-G): danh sách dự kiến trên
 * màn chỉ để tham khảo, quyền hưởng cuối cùng chốt theo ảnh chụp trên chuỗi lúc mở kỳ.
 *
 * Hai chốt chặn cuối (kỳ phải `APPROVED`, vault phải `DONE`) nằm trong lõi
 * `runDistributionRound`, không ở đây: keeper và đường cũ đi qua lõi cũng bị chặn như nhau.
 *
 * LUẬT #1 chain qua `getLedger()`; LUẬT #2 ký nằm trong adapter; LUẬT #3 quyền qua RBAC.
 */

// =============================================================================
//  KHUNG NHÌN
// =============================================================================

/** Kết cục của một lần duyệt, duyệt lại hoặc tiếp tục. */
export type DistributionApprovalOutcome =
  | ApprovedRoundOutcome
  /** Số trên chuỗi khác số đã duyệt: kỳ ở `OPEN`, không chốt vault, không lô nào. */
  | 'AMOUNT_CHANGED';

export interface DistributionApprovalView {
  outcome: DistributionApprovalOutcome;
  period: DistributionPeriodView;
  /** Kết quả lượt chia; `null` khi không có lượt nào chạy (`AMOUNT_CHANGED`, `ALREADY_RUNNING`). */
  run: DistributionRunView | null;
  runNo: number;
  message: string;
}

/** Một người nhận dự kiến: số dư WPT HIỆN TẠI và phần dự kiến bằng đúng `shareOf`. */
export interface ForecastRow {
  wallet: string;
  balance: string;
  share: string;
  /** Ví SPV (vault) giữ WPT chưa bán. */
  isVault: boolean;
}

/** Tiến độ hồ sơ của một kỳ. */
export interface PayoutProgress {
  total: number;
  paid: number;
  sent: number;
  failed: number;
  expired: number;
  /** Hồ sơ còn phải chi: `PENDING` + `SENT` + `FAILED`. */
  outstanding: number;
  paidAmount: string;
}

export interface ActivePeriodView {
  period: DistributionPeriodView;
  progress: PayoutProgress;
  /** Có giao dịch đã lên chuỗi mà chưa có kết luận (mở kỳ, chốt vault, lô): "đang đối soát". */
  pendingOnChain: boolean;
  /** Việc Kiểm soát viên làm được tiếp, do máy chủ quyết định (màn không tự suy). */
  nextAction: 'REAPPROVE' | 'CONTINUE' | 'MANUAL_REVIEW' | 'NONE';
  /** Câu mô tả trạng thái cho người xem. */
  note: string;
}

export interface DistributionOverviewView {
  chain: ChainKey;
  /** Chain có vault thanh toán (mock, `hardhat-local`, `evm`) mới có luồng chia đã duyệt. */
  supported: boolean;
  /** Quỹ chia; `null` trên chain không hỗ trợ (không đọc quỹ của chain chưa có hợp đồng chia). */
  pool: {
    poolBalance: string;
    reservedBalance: string;
    unallocatedBalance: string;
    /** Ngưỡng `distribution.min_new_balance`. */
    threshold: string;
  } | null;
  forecast: {
    rows: ForecastRow[];
    totalSupply: string;
    /** Tổng phần dự kiến; luôn `<=` phần chưa phân bổ, phần còn lại là phần dư làm tròn. */
    allocated: string;
    dust: string;
    /** Danh sách chạm giới hạn quét nên KHÔNG đầy đủ: khoá nút duyệt. */
    truncated: boolean;
  } | null;
  active: ActivePeriodView | null;
  /** Người xem có quyền `distribution:approve`. */
  viewerCanApprove: boolean;
  /** Lý do chưa duyệt được bây giờ (rỗng = duyệt được với số `unallocatedBalance`). */
  approveBlockers: string[];
}

export interface DistributionHistoryRow {
  period: DistributionPeriodView;
  /** Các nguồn đã kích hoạt lượt chia của kỳ, theo thứ tự xuất hiện. */
  triggerSources: ('MANUAL' | 'KEEPER')[];
  runCount: number;
}

export interface PageView<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PayoutRowView {
  investorWallet: string;
  balanceAt: string;
  amount: string;
  status: DistributionPayoutRecord['status'];
  txHash: string | null;
  batchNo: number | null;
}

// =============================================================================
//  DÙNG CHUNG
// =============================================================================

/** Ghi sổ kiểm toán cho một lần duyệt: luôn kèm mã người thao tác (QĐ-A). */
async function auditApproval(
  ctx: ChainContext,
  target: string | null,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
): Promise<void> {
  await ctx.txnStore.appendAudit({
    actorRole: ctx.role,
    action: 'distribution:approve',
    target,
    outcome,
    detail: `người thao tác ${ctx.actor}: ${detail}`,
    chain: ctx.chain,
  });
}

/** Từ chối TRƯỚC khi gửi gì: ghi sổ một dòng FAILURE rồi trả lỗi. */
async function reject<T>(
  ctx: ChainContext,
  target: string | null,
  code: ErrorCode,
  reason: string,
): Promise<Result<T>> {
  await auditApproval(ctx, target, 'FAILURE', `từ chối, không gửi giao dịch: ${reason}`);
  return err(code, reason);
}

/**
 * Mã kỳ của lần duyệt: `<chain>:<ngày UTC>-<số thứ tự trong ngày>`, ví dụ `mock:2026-10-21-01`.
 *
 * Mã chỉ để đọc và làm nhãn trên chuỗi. Trọng tài "một kỳ hoạt động mỗi chain" là `activeChain`,
 * KHÔNG phải sự khác nhau của mã: hai lần duyệt qua ranh giới ngày UTC sinh hai mã khác nhau và
 * vẫn chỉ một lần giữ chỗ thành công. Hai lần duyệt cùng lúc sinh cùng mã thì ràng buộc `periodKey`
 * loại một bên.
 *
 * Bỏ qua cả nhãn ĐÃ CÓ TRÊN CHUỖI mà sổ không biết (sổ bộ nhớ vừa khởi động lại trên một nút
 * Hardhat còn giữ kỳ cũ): mở bằng nhãn đó thì hợp đồng từ chối, và đường phục hồi sẽ đọc nhầm kỳ cũ.
 */
async function nextPeriodKey(chain: ChainKey, ledger: ChainContext['ledger'], now: Date): Promise<string> {
  const prefix = `${chain}:${now.toISOString().slice(0, 10)}-`;
  const periods = await getDistributionStore().listPeriods({ chain, limit: MAX_RECIPIENT_SCAN });
  let next = periods.filter((period) => period.periodKey.startsWith(prefix)).length + 1;
  while (await ledger.findDistribution(`${prefix}${String(next).padStart(2, '0')}`)) next += 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
}

/** Câu "chain không hỗ trợ" dùng chung cho màn và service. */
const unsupportedReason = (chain: ChainKey) =>
  `Chain "${chain}" không có vault thanh toán nên không hỗ trợ luồng chia đã duyệt.`;

/** Kết quả một lượt chia của kỳ đã duyệt, gói thành khung nhìn của lần duyệt. */
async function approvalViewFromRound(
  ctx: ChainContext,
  period: DistributionPeriodRecord,
): Promise<Result<DistributionApprovalView>> {
  // Vault chốt theo thứ tự kỳ: kỳ trước của chain chưa `DONE` thì kỳ này chờ. Luồng bấm tay tự dọn
  // phần đó (PoC không có lịch gọi keeper); lỗi ở đây không chặn vì lõi chia kiểm lại vault.
  await reconcileChainPeriods(ctx.chain, ctx.role, ctx.actor);
  const round = await runApprovedPeriod(ctx, period, 'MANUAL');
  if (!round.ok) return round;
  const latest = (await ctx.store.findPeriod(period.id)) ?? period;
  return ok({
    outcome: round.data.outcome,
    period: toPeriodView(latest),
    run: round.data.run,
    runNo: round.data.runNo,
    message: round.data.message,
  });
}

function amountChangedView(period: DistributionPeriodRecord): DistributionApprovalView {
  return {
    outcome: 'AMOUNT_CHANGED',
    period: toPeriodView(period),
    run: null,
    runNo: 0,
    message:
      `Kỳ "${period.periodKey}" lấy ${period.totalAmount} VNDB trên chuỗi, khác số đã duyệt ` +
      `${period.expectedAmount} VNDB (tiền vào quỹ trong lúc mở kỳ). Không chốt vault, không chia; ` +
      `duyệt lại số thực tế để tiếp tục.`,
  };
}

// =============================================================================
//  DUYỆT (QĐ-C)
// =============================================================================

/**
 * Kiểm soát viên duyệt chia `expectedAmount` VNDB (QĐ-C).
 *
 * 1. `authorize('distribution:approve')`; sổ kiểm toán ghi cả bốn kết cục (bị chặn quyền, từ chối,
 *    `AMOUNT_CHANGED`, `APPROVED`) kèm mã người thao tác.
 * 2. Chain phải có vault; không thì từ chối, không gửi gì.
 * 3. Đọc phần chưa phân bổ: khác `expectedAmount` thì từ chối "số trong quỹ đã đổi"; dưới ngưỡng
 *    thì từ chối. Không gửi giao dịch.
 * 4. Giữ chỗ kỳ `OPENING` (`activeChain`, số duyệt, người duyệt); trùng thì từ chối "đang có kỳ hoạt
 *    động". Mở kỳ trên chuỗi theo đường SC-06; đọc số thực tế của kỳ trên chuỗi.
 * 5. Đúng số: `APPROVED`, chốt kỳ vault, chia (một lượt, tối đa `max_batches_per_run` lô).
 * 6. Khác số: `AMOUNT_CHANGED`, dừng.
 *
 * @flow distribute:4 | kiểm quyền distribution:approve, chain phải có vault, số duyệt phải bằng phần chưa phân bổ, giữ chỗ kỳ OPENING một kỳ hoạt động mỗi chain, mở trên chuỗi rồi so số thực tế
 */
export async function approveDistribution(input: unknown): Promise<Result<DistributionApprovalView>> {
  const parsed = approveDistributionSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain } = parsed.data;
  const expected = BigInt(parsed.data.expectedAmount);

  try {
    const role = await authorize('distribution:approve', null, chain);
    const ctx = chainContext(chain, role, await currentActorId(role));
    const { ledger, store } = ctx;

    // --- 2. Chain phải có vault ----------------------------------------------
    if (!(await ledger.vaultStatus())) {
      return reject(ctx, null, 'PERIOD_STATE', unsupportedReason(chain));
    }

    // --- 3. Số trong quỹ, ngưỡng, nguồn cung (chỉ đọc) -----------------------
    const unallocated = await ledger.unallocatedProfit();
    if (unallocated !== expected) {
      return reject(
        ctx,
        null,
        'PERIOD_STATE',
        `Số trong quỹ đã đổi, xem lại rồi duyệt: màn duyệt ${expected} VNDB nhưng phần chưa phân ` +
          `bổ của quỹ hiện là ${unallocated} VNDB.`,
      );
    }
    const threshold = await readDistributionMinNewBalance();
    if (expected < threshold) {
      return reject(
        ctx,
        null,
        'INSUFFICIENT_PROFIT_POOL',
        `Phần chưa phân bổ ${expected} VNDB dưới ngưỡng ${threshold} VNDB (distribution.min_new_balance).`,
      );
    }
    if ((await ledger.tokenInfo()).totalSupply === 0n) {
      return reject(ctx, null, 'NO_CIRCULATING_SUPPLY', 'Tổng cung WPT bằng 0: không có quyền nào để chia.');
    }

    // --- 4a. Một kỳ hoạt động mỗi chain (đọc trước để báo rõ; trọng tài là ràng buộc) ---
    const active = await store.findActivePeriod(chain);
    if (active) {
      return reject(
        ctx,
        active.periodKey,
        'PERIOD_STATE',
        `Đang có kỳ hoạt động "${active.periodKey}" (${active.status}) trên chain "${chain}". Tiếp tục ` +
          `hoặc duyệt lại kỳ đó trước khi duyệt kỳ mới.`,
      );
    }
    const recipients = await collectRecipients(chain, ledger);
    if (recipients.truncated) {
      return reject(
        ctx,
        null,
        'UNKNOWN',
        `Danh sách người nhận chạm giới hạn quét ${MAX_RECIPIENT_SCAN} ví nên không đầy đủ; không duyệt ` +
          `chia ở quy mô này khi chưa có Indexer.`,
      );
    }

    // --- 4b. Giữ chỗ kỳ OPENING kèm số duyệt và người duyệt ------------------
    const periodKey = await nextPeriodKey(chain, ledger, new Date());
    let reserved: DistributionPeriodRecord;
    try {
      reserved = await store.reservePeriod({
        periodKey,
        chain,
        approval: { expectedAmount: expected.toString(), approvedBy: ctx.actor },
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return reject(
          ctx,
          periodKey,
          'PERIOD_STATE',
          error.columns.includes('activeChain')
            ? `Đang có kỳ hoạt động trên chain "${chain}" (vừa được giữ chỗ bởi một lần duyệt hoặc tiến ` +
                `trình khác). Không mở kỳ thứ hai.`
            : `Mã kỳ "${periodKey}" vừa được một lần duyệt khác giữ chỗ. Tải lại rồi xem kỳ hoạt động.`,
        );
      }
      throw error;
    }
    await auditApproval(
      ctx,
      periodKey,
      'SUCCESS',
      `duyệt chia ${expected} VNDB, giữ chỗ kỳ ${reserved.id} (${periodKey}), gửi mở kỳ trên chuỗi`,
    );

    // --- 4c. Mở trên chuỗi; kết luận duyệt ghi khi đọc được số thực tế -------
    const opened = await driveOpening(ctx, reserved, 'send');
    if (!opened.ok) return opened;
    const period = opened.data;

    // --- 5, 6. Đúng số thì chia; khác số thì dừng ----------------------------
    if (period.approvalStatus === 'AMOUNT_CHANGED') return ok(amountChangedView(period));
    if (period.approvalStatus !== 'APPROVED') {
      return err('PERIOD_STATE', `Kỳ "${periodKey}" chưa có kết luận duyệt; bấm Tiếp tục để đối soát.`);
    }
    return await approvalViewFromRound(ctx, period);
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  DUYỆT LẠI, TIẾP TỤC
// =============================================================================

/**
 * Duyệt lại đúng số trên chuỗi (QĐ-C): kỳ `AMOUNT_CHANGED`, hoặc kỳ hoạt động chưa có lần duyệt
 * (tạo trước FE-08). `amount` phải bằng đúng số của kỳ trên chuỗi; đúng thì ghi `reapprovedFrom`,
 * số duyệt, người, thời điểm, `APPROVED`, rồi chốt vault và chia.
 *
 * @flow distribute:9 | kiểm quyền distribution:approve, kỳ AMOUNT_CHANGED hoặc chưa duyệt, số duyệt lại phải bằng đúng số trên chuỗi, ghi APPROVED rồi chia
 */
export async function reapproveDistribution(input: unknown): Promise<Result<DistributionApprovalView>> {
  const parsed = reapproveDistributionSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodId } = parsed.data;
  const amount = BigInt(parsed.data.amount);

  try {
    const role = await authorize('distribution:approve', periodId, chain);
    const ctx = chainContext(chain, role, await currentActorId(role));

    const found = await findPeriodOnChain(ctx.store, chain, { periodId });
    if (!isPeriod(found)) return found;
    const key = found.periodKey;

    if (found.status === 'OPENING') {
      return reject(ctx, key, 'PERIOD_STATE', `Kỳ "${key}" đang mở trên chuỗi; bấm Tiếp tục để phục hồi trước.`);
    }
    if (found.status !== 'OPEN' && found.status !== 'DISTRIBUTING') {
      return reject(ctx, key, 'PERIOD_STATE', `Kỳ "${key}" đã kết thúc (${found.status}); không duyệt lại được.`);
    }
    if (found.approvalStatus === 'APPROVED') {
      return reject(ctx, key, 'PERIOD_STATE', `Kỳ "${key}" đã được duyệt; dùng Tiếp tục để chia nốt.`);
    }
    if (found.distributionId === null) {
      return reject(ctx, key, 'PERIOD_STATE', `Kỳ "${key}" không gắn với kỳ nào trên chuỗi; không duyệt được.`);
    }

    // Số trên chuỗi là sự thật: đọc lại, không tin cột `totalAmount` một mình.
    const onChain = (await ctx.ledger.distributionState(found.distributionId)).amount;
    if (amount !== onChain || onChain !== BigInt(found.totalAmount)) {
      return reject(
        ctx,
        key,
        'PERIOD_STATE',
        `Số duyệt lại phải bằng đúng số trên chuỗi của kỳ "${key}": chuỗi ${onChain} VNDB, sổ ` +
          `${found.totalAmount} VNDB, số duyệt lại ${amount} VNDB.`,
      );
    }

    const approved = await ctx.store.setApproval({
      id: found.id,
      from: found.approvalStatus,
      approvalStatus: 'APPROVED',
      approvedAmount: amount.toString(),
      approvedBy: ctx.actor,
      approvedAt: new Date().toISOString(),
      reapprovedFrom: found.expectedAmount,
    });
    if (!approved) {
      return reject(ctx, key, 'PERIOD_STATE', `Kỳ "${key}" vừa đổi trạng thái duyệt; tải lại rồi xem.`);
    }
    await auditApproval(
      ctx,
      key,
      'SUCCESS',
      `duyệt lại kỳ ${found.id} APPROVED với số trên chuỗi ${amount} VNDB` +
        (found.expectedAmount ? ` (số duyệt trước ${found.expectedAmount} VNDB)` : ' (kỳ chưa từng được duyệt)'),
    );
    return await approvalViewFromRound(ctx, approved);
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Tiếp tục kỳ hoạt động đã `APPROVED` (QĐ-C, QĐ-D): kỳ `OPENING` được phục hồi trước (giữ nguyên
 * dữ liệu duyệt, so số thực tế nếu chưa so); rồi một lượt chia (đối soát vault, lô còn lại).
 *
 * @flow distribute:11 | kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL
 */
export async function continueDistribution(input: unknown): Promise<Result<DistributionApprovalView>> {
  const parsed = distributionPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodId } = parsed.data;

  try {
    const role = await authorize('distribution:approve', periodId, chain);
    const ctx = chainContext(chain, role, await currentActorId(role));

    const found = await findPeriodOnChain(ctx.store, chain, { periodId });
    if (!isPeriod(found)) return found;
    let period = found;

    if (period.status === 'OPENING') {
      const recovered = await driveOpening(ctx, period, 'recover');
      if (!recovered.ok) return recovered;
      period = recovered.data;
    }
    if (period.status !== 'OPEN' && period.status !== 'DISTRIBUTING') {
      return reject(ctx, period.periodKey, 'PERIOD_STATE', `Kỳ "${period.periodKey}" đã kết thúc (${period.status}).`);
    }
    if (period.approvalStatus === 'AMOUNT_CHANGED') return ok(amountChangedView(period));
    if (period.approvalStatus !== 'APPROVED') {
      return reject(
        ctx,
        period.periodKey,
        'PERIOD_STATE',
        `Kỳ "${period.periodKey}" chưa được duyệt đúng số trên chuỗi; duyệt lại số ${period.totalAmount} VNDB trước.`,
      );
    }
    return await approvalViewFromRound(ctx, period);
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  ĐỌC (QĐ-F): hai vai vận hành, `reconcile:read`, không ghi sổ kiểm toán
// =============================================================================

async function progressOf(periodId: string): Promise<PayoutProgress> {
  const rows = await getDistributionStore().listPayouts({ periodId, limit: MAX_RECIPIENT_SCAN });
  const count = (status: DistributionPayoutRecord['status']) => rows.filter((row) => row.status === status).length;
  return {
    total: rows.length,
    paid: count('PAID'),
    sent: count('SENT'),
    failed: count('FAILED'),
    expired: count('EXPIRED'),
    outstanding: rows.filter(isPayable).length,
    paidAmount: rows
      .filter((row) => row.status === 'PAID')
      .reduce((total, row) => total + BigInt(row.amount), 0n)
      .toString(),
  };
}

function describeActive(
  period: DistributionPeriodRecord,
  progress: PayoutProgress,
): Pick<ActivePeriodView, 'nextAction' | 'note' | 'pendingOnChain'> {
  const pendingOnChain =
    (period.status === 'OPENING' && period.openTxHash !== null) ||
    period.vaultCloseStatus === 'SENT' ||
    progress.sent > 0;
  if (period.status === 'OPENING') {
    return {
      pendingOnChain,
      nextAction: 'CONTINUE',
      note: 'Kỳ đang mở trên chuỗi, chưa đọc được số thực tế. Tiếp tục để phục hồi.',
    };
  }
  if (period.approvalStatus === 'AMOUNT_CHANGED') {
    return {
      pendingOnChain,
      nextAction: 'REAPPROVE',
      note: `Số trên chuỗi ${period.totalAmount} VNDB khác số đã duyệt ${period.expectedAmount} VNDB. Không chia cho tới khi duyệt lại số thực tế.`,
    };
  }
  if (period.approvalStatus !== 'APPROVED') {
    return {
      pendingOnChain,
      nextAction: 'REAPPROVE',
      note: `Kỳ chưa có lần duyệt nào cho số trên chuỗi ${period.totalAmount} VNDB. Duyệt lại số thực tế để chia.`,
    };
  }
  if (period.vaultCloseStatus === 'CONFLICT') {
    return { pendingOnChain, nextAction: 'MANUAL_REVIEW', note: 'Kỳ vault CONFLICT: cần xử lý tay, khoá chia.' };
  }
  if (period.vaultCloseStatus !== 'DONE') {
    return {
      pendingOnChain,
      nextAction: 'CONTINUE',
      note: `Đang chốt kỳ vault (${period.vaultCloseStatus ?? 'chưa giữ chỗ'}). Tiếp tục để đối soát rồi chia.`,
    };
  }
  return progress.outstanding > 0 || progress.total === 0
    ? { pendingOnChain, nextAction: 'CONTINUE', note: `Còn ${progress.outstanding} hồ sơ phải chi.` }
    : { pendingOnChain, nextAction: 'NONE', note: 'Không còn hồ sơ phải chi.' };
}

/**
 * Tổng quan màn chia (QĐ-F): quỹ, dự kiến, kỳ hoạt động, quyền duyệt của người xem và lý do chưa
 * duyệt được. Mọi con số do máy chủ tính, màn không tự tính.
 *
 * Dự kiến dùng CÙNG nguồn người nhận với lúc chia (`collectRecipients`, gồm vault) và CÙNG công
 * thức `shareOf`, nhưng trên số dư HIỆN TẠI: quyền hưởng cuối cùng chốt theo ảnh chụp lúc mở kỳ.
 *
 * @flow distribute:2 | kiểm quyền reconcile:read, đọc quỹ, dự kiến theo shareOf trên số dư hiện tại, kỳ hoạt động và lý do chưa duyệt được
 */
export async function getDistributionOverview(input: unknown): Promise<Result<DistributionOverviewView>> {
  const parsed = distributionOverviewSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain } = parsed.data;

  try {
    const role: Role = await currentRole();
    assertCan(role, 'reconcile:read');
    const ledger = getLedger(chain);
    const store = getDistributionStore();

    const supported = (await ledger.vaultStatus()) !== null;
    const viewerCanApprove = can(role, 'distribution:approve');
    if (!supported) {
      return ok({
        chain,
        supported,
        pool: null,
        forecast: null,
        active: null,
        viewerCanApprove,
        approveBlockers: [unsupportedReason(chain)],
      });
    }
    const poolBalance = await ledger.profitPoolBalance();
    const reservedBalance = await ledger.reservedProfit();
    const unallocated = await ledger.unallocatedProfit();
    const threshold = await readDistributionMinNewBalance();

    const recipients = await collectRecipients(chain, ledger);
    const vault = (await ledger.spvWallet())?.toLowerCase() ?? null;
    const totalSupply = (await ledger.tokenInfo()).totalSupply;
    const rows: ForecastRow[] = [];
    for (const wallet of recipients.wallets) {
      const balance = await ledger.balanceOf(wallet);
      rows.push({
        wallet,
        balance: balance.toString(),
        share: (totalSupply === 0n ? 0n : shareOf(unallocated, balance, totalSupply)).toString(),
        isVault: wallet.toLowerCase() === vault,
      });
    }
    const allocated = rows.reduce((total, row) => total + BigInt(row.share), 0n);

    const activeRecord = await store.findActivePeriod(chain);
    let active: ActivePeriodView | null = null;
    if (activeRecord) {
      const progress = await progressOf(activeRecord.id);
      active = { period: toPeriodView(activeRecord), progress, ...describeActive(activeRecord, progress) };
    }

    const approveBlockers: string[] = [];
    if (activeRecord) approveBlockers.push(`Đang có kỳ hoạt động "${activeRecord.periodKey}".`);
    if (unallocated === 0n) approveBlockers.push('Quỹ không có phần chưa phân bổ.');
    else if (unallocated < threshold) {
      approveBlockers.push(`Phần chưa phân bổ ${unallocated} VNDB dưới ngưỡng ${threshold} VNDB.`);
    }
    if (totalSupply === 0n) approveBlockers.push('Tổng cung WPT bằng 0.');
    if (recipients.truncated) {
      approveBlockers.push(`Danh sách người nhận chạm giới hạn quét ${MAX_RECIPIENT_SCAN} ví, không đầy đủ.`);
    }

    return ok({
      chain,
      supported,
      pool: {
        poolBalance: poolBalance.toString(),
        reservedBalance: reservedBalance.toString(),
        unallocatedBalance: unallocated.toString(),
        threshold: threshold.toString(),
      },
      forecast: {
        rows,
        totalSupply: totalSupply.toString(),
        allocated: allocated.toString(),
        dust: (unallocated - allocated).toString(),
        truncated: recipients.truncated,
      },
      active,
      viewerCanApprove,
      approveBlockers,
    });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Lịch sử kỳ chia, phân trang (QĐ-F): người duyệt, thời điểm, số duyệt, số thực tế, từng duyệt
 * lại, nguồn kích hoạt các lượt chia.
 *
 * @flow distribute:20 | kiểm quyền reconcile:read, trang lịch sử kỳ kèm người duyệt, số duyệt, số thực tế, duyệt lại và nguồn kích hoạt
 */
export async function listDistributionPeriods(
  input: unknown,
): Promise<Result<PageView<DistributionHistoryRow>>> {
  const parsed = listDistributionPeriodsSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, page, pageSize } = parsed.data;

  try {
    assertCan(await currentRole(), 'reconcile:read');
    const store = getDistributionStore();
    const periods = await store.listPeriods({ chain, limit: pageSize, offset: (page - 1) * pageSize });
    const rows: DistributionHistoryRow[] = [];
    for (const period of periods) {
      const runs = await getKeeperStore().listRuns({
        jobName: DISTRIBUTION_JOB_NAME,
        periodKeyPrefix: `${period.periodKey}#`,
        limit: 200,
      });
      const sources: ('MANUAL' | 'KEEPER')[] = [];
      for (const run of [...runs].reverse()) {
        if (!sources.includes(run.triggerSource)) sources.push(run.triggerSource);
      }
      rows.push({ period: toPeriodView(period), triggerSources: sources, runCount: runs.length });
    }
    return ok({ rows, page, pageSize, total: await store.countPeriods({ chain }) });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Hồ sơ trả của một kỳ theo từng ví, phân trang (QĐ-F), GỒM ví được chia 0.
 *
 * @flow distribute:22 | kiểm quyền reconcile:read, trang hồ sơ trả từng ví của một kỳ gồm ví được chia 0
 */
export async function listDistributionPayouts(input: unknown): Promise<Result<PageView<PayoutRowView>>> {
  const parsed = listDistributionPayoutsSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, periodId, page, pageSize } = parsed.data;

  try {
    assertCan(await currentRole(), 'reconcile:read');
    const store = getDistributionStore();
    const found = await findPeriodOnChain(store, chain, { periodId });
    if (!isPeriod(found)) return found;
    const payouts = await store.listPayouts({ periodId, limit: pageSize, offset: (page - 1) * pageSize });
    return ok({
      rows: payouts.map((row) => ({
        investorWallet: row.investorWallet,
        balanceAt: row.balanceAt,
        amount: row.amount,
        status: row.status,
        txHash: row.txHash,
        batchNo: row.batchNo,
      })),
      page,
      pageSize,
      total: await store.countPayouts({ periodId }),
    });
  } catch (error) {
    return toResult(error);
  }
}

// =============================================================================
//  MỘT LẦN MỞ MÀN: một server action, ba phần độc lập
// =============================================================================

/**
 * Ba phần màn `/distribution` cần khi mở. Mỗi phần là một `Result` RIÊNG: phần này lỗi (mất kết
 * nối chuỗi, thiếu quyền) không kéo theo phần khác, màn hiện lỗi đúng khối của nó.
 */
export interface DistributionPageView {
  overview: Result<DistributionOverviewView>;
  periods: Result<PageView<DistributionHistoryRow>>;
  runs: Result<DistributionRunLogView[]>;
}

/** Bắt cả lỗi ném ra ngoài ý muốn, để một phần không làm hỏng cả lượt. */
async function settle<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run();
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Dữ liệu một lần mở màn chia: tổng quan, trang lịch sử kỳ, lịch chạy (FE-08, yêu cầu hiệu năng).
 *
 * Next xếp hàng server action nối tiếp, mỗi action là một lượt Worker (bài học HF-01): ba action khi
 * mở là ba lượt chờ nhau. Hàm này chạy ba phần trong MỘT lượt, song song. Nghiệp vụ và quyền giữ
 * nguyên: mỗi phần gọi đúng service cũ, và service đó tự kiểm quyền của nó (`reconcile:read`) như
 * khi gọi riêng; không có kiểm quyền gộp nào ở đây.
 */
export async function getDistributionPage(input: unknown): Promise<Result<DistributionPageView>> {
  const parsed = distributionPageSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, page, pageSize, runLimit } = parsed.data;
  const [overview, periods, runs] = await Promise.all([
    settle(() => getDistributionOverview({ chain })),
    settle(() => listDistributionPeriods({ chain, page, pageSize })),
    settle(() => listDistributionRuns({ limit: runLimit })),
  ]);
  return ok({ overview, periods, runs });
}
