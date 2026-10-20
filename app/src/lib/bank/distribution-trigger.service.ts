import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { CONFIG_KEYS } from '@/lib/config/issue-terms';
import { getLedger } from '@/lib/ledger';
import { assertCan, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import {
  getConfigStore,
  getDistributionStore,
  getKeeperStore,
  getStore,
  UniqueConstraintError,
} from '@/lib/store';
import type {
  DistributionPeriodRecord,
  ITxnStore,
  KeeperRunRecord,
  KeeperTriggerSource,
} from '@/lib/store';
import {
  readDistributionMinNewBalance,
  readDistributionSettledBalance,
  readDistributionStuckAfterRuns,
} from '@/lib/store/config-values';
import { authorize, toResult } from './authorize';
import {
  chainContext,
  reconcileChainPeriods,
  runDistributionRound,
  type ChainContext,
  type DistributionRunView,
} from './distribution.service';
import { err, ok, type Result } from './result';
import { distributionCycleSchema, keeperRunQuerySchema } from './schemas';

/**
 * TIẾN TRÌNH TỰ ĐỘNG CHIA LỢI NHUẬN: dọn kỳ dở và tiếp tục kỳ ĐÃ DUYỆT, không cần người bấm.
 *
 * FE-08 QĐ-E (CH-3): keeper KHÔNG BAO GIỜ mở kỳ. Mở kỳ là Kiểm soát viên duyệt đúng số
 * (`distribution-approval.service.ts`); keeper chỉ chia tiếp kỳ `APPROVED`, còn lại báo
 * `AWAITING_APPROVAL`. Tự mở kỳ theo ngưỡng để dành task sau (nợ QĐ-H).
 *
 * ## Hai ràng buộc kỹ thuật quyết định toàn bộ thiết kế
 *
 * **1. Hợp đồng trên chuỗi KHÔNG tự chạy được.** Nhận token ERC-20 chỉ cập nhật bảng số dư,
 * nó không kích hoạt được mã trong hợp đồng nhận. Và cho dù SPV gọi một hàm nạp tiền tường
 * minh, việc chuyển tiền cho hàng trăm ví KHÔNG nằm được trong cùng một giao dịch vì vượt
 * giới hạn tài nguyên. Vì vậy vẫn phải có một tiến trình NGOÀI CHUỖI làm nhiệm vụ phát hiện
 * và kích hoạt. "Tự động" ở đây nghĩa là không cần người bấm, KHÔNG phải là hợp đồng tự chạy.
 *
 * **2. Chưa có Indexer.** Chưa đọc được sự kiện on-chain, nên việc phát hiện tiền vào làm
 * bằng cách HỎI ĐỊNH KỲ phần chưa phân bổ của quỹ. Đường nâng cấp ghi ở `decideCycle`.
 *
 * ## Căn cứ là phần CHƯA PHÂN BỔ của quỹ, không phải mốc số dư (SC-06 QĐ-I)
 *
 * Quỹ chia giữ sổ dự trữ: phần các kỳ còn nợ tách khỏi tiền mới nạp. `unallocatedProfit()` vì
 * vậy là đúng số tiền một kỳ mới sẽ lấy, kể cả khi kỳ cũ còn phần lẻ hoặc vừa đóng và trả phần
 * chưa nhận về quỹ. Mốc `distribution.last_settled_balance` của BE-07 cũ bỏ sót tiền được giải
 * phóng và nhận nhầm tiền còn nợ là tiền mới; nó chỉ còn được ghi để hiển thị lịch sử.
 *
 * Bất thường duy nhất về tiền là quỹ HỤT so với nghĩa vụ: `profitPoolBalance() <
 * reservedProfit()` (chỉ xảy ra khi có người đốt VNDB trong quỹ). Khi đó dừng và ghi lỗi.
 *
 * ## Vì sao tệp này không tự chia mà gọi lại BE-06
 *
 * Tính phần từng ví, lập hồ sơ, chia lô, chạy lại lô lỗi đều đã có ở
 * `distribution.service.ts`. Viết lại ở đây sẽ tạo HAI đường chia tiền song song, và chúng
 * lệch nhau ở lần sửa đầu tiên — lúc đó tiền nhà đầu tư nhận được phụ thuộc vào việc ai gọi,
 * người bấm hay tiến trình định kỳ.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #2 ký nằm trong adapter · LUẬT #3 quyền qua RBAC.
 */

// =============================================================================
//  HẰNG SỐ
// =============================================================================

/** Tên công việc trong bảng `KeeperRun`. Một chỗ duy nhất, vì nó là khoá tra cứu. */
export const DISTRIBUTION_JOB_NAME = 'distribution-trigger';

/**
 * Dấu tách giữa mã kỳ và số vòng trong `KeeperRun.periodKey`.
 *
 * Phải là ký tự KHÔNG hợp lệ trong mã kỳ chia (`periodKeySchema` chỉ cho chữ, số và `. _ - :`),
 * nếu không thì `mock:2026-01-01-01#2` và một mã kỳ tên `mock:2026-01-01-01#2` do người đặt
 * sẽ không phân biệt được, và số vòng tách ra sai.
 */
const RUN_KEY_SEPARATOR = '#';

/** Khoá vòng chạy khi không có kỳ nào phải xử lý. Xem `idleRunKey`. */
const IDLE_RUN_PREFIX = 'idle';

/**
 * Số dòng `KeeperRun` tối đa quét được khi đếm số vòng của một kỳ.
 *
 * Phải tường minh vì `listRuns` mặc định `limit = 50`: đếm trên một danh sách bị cắt âm thầm
 * sẽ cho số vòng nhỏ hơn thực tế, và hệ quả là (a) khoá vòng trùng với một vòng đã có nên
 * `startRun` trượt và tiến trình đứng hẳn, (b) cảnh báo "kỳ treo" không bao giờ bật.
 *
 * 1.000 vòng cho một kỳ đã là dấu hiệu hỏng nặng, nên chạm ngưỡng thì TỪ CHỐI thay vì lấy
 * phần đầu — đếm sai ở đây làm tiến trình tự chặn chính nó, khó lần ra hơn hẳn một lỗi rõ.
 */
const MAX_KEEPER_RUN_SCAN = 1_000;

// =============================================================================
//  KHUNG NHÌN
// =============================================================================

/**
 * Kết cục của một vòng chạy. Mọi giá trị này đều là kết cục BÌNH THƯỜNG.
 *
 * Tình huống bất thường (quỹ hụt so với tổng dự trữ, SC-06 QĐ-I) KHÔNG có mặt ở đây: nó trả về
 * `Result` lỗi. Lý do là người gọi phải xử lý khác nhau :
 * tiến trình định kỳ thấy `ok` thì chỉ ghi nhật ký rồi chờ lượt sau, còn thấy lỗi thì phải
 * báo người vận hành. Gói cả hai vào `ok` là buộc mọi người gọi phải nhớ đọc thêm một trường
 * nữa mới biết có chuyện, và ai quên thì im lặng bỏ qua một bất thường về tiền.
 */
export type DistributionCycleOutcome =
  /** Quỹ không có phần chưa phân bổ: không có tiền mới, không có kỳ nào dở. */
  | 'NO_NEW_FUNDS'
  /** Có phần chưa phân bổ nhưng chưa tới `distribution.min_new_balance`. */
  | 'BELOW_MIN_NEW_BALANCE'
  /** Một vòng khác đang giữ chỗ cho đúng kỳ và đúng số vòng này. */
  | 'ALREADY_RUNNING'
  /** Đã chia và kỳ hoàn tất — không còn ví nào phải nhận. */
  | 'DISTRIBUTED'
  /** Đã chia một phần; còn ví chưa nhận, lượt sau chia tiếp đúng kỳ đó. */
  | 'PARTIAL'
  /** SC-06: kỳ dở đã hết hạn nhận hoặc đã đóng trên chuỗi; chuyển `EXPIRED`/`CLOSED`, không chia. */
  | 'PERIOD_ENDED'
  /**
   * FE-08 QĐ-E: có việc nhưng cần Kiểm soát viên: kỳ hoạt động chưa duyệt hoặc `AMOUNT_CHANGED`,
   * hoặc không có kỳ hoạt động mà phần chưa phân bổ đã tới ngưỡng. Keeper không trả, không mở kỳ.
   */
  | 'AWAITING_APPROVAL'
  /** FE-08: kỳ hoạt động vẫn `OPENING` sau bước dọn; vòng sau phục hồi. */
  | 'OPENING_PENDING'
  /** FE-08 QĐ-D: kỳ đã duyệt nhưng chốt kỳ vault chưa xong; không gửi lô. */
  | 'VAULT_PENDING'
  /** FE-08 QĐ-D: kỳ vault `CONFLICT`, cần xử lý tay; không gửi lô. */
  | 'VAULT_CONFLICT';

export interface DistributionCycleView {
  chain: ChainKey;
  outcome: DistributionCycleOutcome;
  /**
   * Số dư ví lợi nhuận đọc được ở ĐẦU vòng, chuỗi thập phân.
   *
   * Chuỗi chứ không `bigint`: `bigint` không qua được biên server -> client. Cùng lý do với
   * mọi số tiền trong `DistributionPeriodView`.
   */
  poolBalance: string;
  /** SC-06: phần chưa phân bổ ở đầu vòng: số Kiểm soát viên sẽ duyệt cho kỳ mới. */
  unallocatedBalance: string;
  /** SC-06: tổng dự trữ của các kỳ chưa đóng ở đầu vòng. */
  reservedBalance: string;
  /** Mốc số dư (chỉ để hiển thị lịch sử, không dùng quyết định) TRƯỚC vòng này. */
  settledBalance: string;
  /** Mốc số dư SAU vòng này. Khác `settledBalance` chỉ khi kỳ vừa tất toán trọn vẹn. */
  nextSettledBalance: string;
  /** Mã dòng `KeeperRun`. `null` khi vòng không nhận được chỗ chạy. */
  runId: string | null;
  /** Vòng thứ mấy của kỳ này, đếm từ 1. `0` khi vòng không gắn với kỳ nào. */
  runNo: number;
  periodId: string | null;
  periodKey: string | null;
  /** Số lô đã gửi trong vòng này. */
  batches: number;
  /** Số hồ sơ chuyển sang `PAID` trong vòng này. */
  paid: number;
  /** Số hồ sơ thất bại trong vòng này. */
  failed: number;
  /** Số hồ sơ chưa tới `PAID` SAU vòng này. `0` nghĩa là kỳ đã hoàn tất. */
  outstanding: number;
  /** Kỳ chưa xong sau `distribution.stuck_after_runs` vòng — đã ghi cảnh báo. */
  stuck: boolean;
  /** Câu mô tả kết cục, dùng cho nhật ký của tiến trình định kỳ. */
  message: string;
}

/** Một dòng lịch chạy, đã tách mã kỳ và số vòng khỏi khoá ghép. */
export interface DistributionRunLogView {
  id: string;
  /** Mã kỳ chia, hoặc `null` với vòng không gắn kỳ nào. */
  periodKey: string | null;
  /** Vòng thứ mấy của kỳ. `0` với vòng không gắn kỳ nào. */
  runNo: number;
  status: KeeperRunRecord['status'];
  startedAt: string;
  finishedAt: string | null;
  /** Lý do thất bại, hoặc `null`. */
  error: string | null;
  /** FE-08: `MANUAL` (Kiểm soát viên) hoặc `KEEPER`. */
  triggerSource: KeeperTriggerSource;
}

// =============================================================================
//  KHOÁ VÒNG CHẠY
// =============================================================================

/**
 * Khoá chiếm chỗ chạy: `<mã kỳ>#<số vòng>`.
 *
 * ## Vì sao phải ghép số vòng vào, không dùng thẳng mã kỳ
 *
 * Ràng buộc duy nhất `(jobName, periodKey)` của `KeeperRun` cho một công việc chạy ĐÚNG MỘT
 * LẦN cho một khoá. Dùng thẳng mã kỳ chia thì vòng thứ hai của cùng một kỳ không bao giờ
 * chạy được — mà chia nhiều vòng là yêu cầu bắt buộc, vì một lượt chỉ gửi tối đa
 * `distribution.max_batches_per_run` lô.
 *
 * Ghép số vòng giải cả hai: hai vòng ĐỒNG THỜI cùng đếm ra số vòng giống nhau nên cùng xin
 * một khoá, và ràng buộc duy nhất loại một vòng; còn hai vòng NỐI TIẾP đếm ra hai số khác
 * nhau nên cả hai đều chạy được.
 */
const runKeyOf = (periodKey: string, runNo: number): string =>
  `${periodKey}${RUN_KEY_SEPARATOR}${runNo}`;

/**
 * Khoá vòng chạy khi KHÔNG có kỳ nào phải xử lý: `idle#<mốc thời gian>`.
 *
 * Vẫn phải ghi một dòng `KeeperRun` cho vòng rỗng, vì "đã chạy và không có việc" khác hẳn
 * "chưa chạy" — thiếu dòng này thì người vận hành không phân biệt được ví lợi nhuận đang
 * không có tiền mới với tiến trình định kỳ đã chết.
 *
 * Mốc thời gian tới phần nghìn giây làm khoá: hai vòng rỗng trong cùng một phần nghìn giây
 * sẽ trùng khoá và vòng sau dừng — đúng hành vi muốn có, vì đó là hai lần gọi trùng nhau.
 */
const idleRunKey = (now: Date): string =>
  `${IDLE_RUN_PREFIX}${RUN_KEY_SEPARATOR}${now.toISOString()}`;

/** Tách `<mã kỳ>#<số vòng>` trở lại. Khoá vòng rỗng cho `{ periodKey: null, runNo: 0 }`. */
function parseRunKey(runKey: string): { periodKey: string | null; runNo: number } {
  const at = runKey.lastIndexOf(RUN_KEY_SEPARATOR);
  if (at <= 0) return { periodKey: null, runNo: 0 };

  const head = runKey.slice(0, at);
  const tail = runKey.slice(at + 1);
  if (head === IDLE_RUN_PREFIX) return { periodKey: null, runNo: 0 };

  const runNo = Number(tail);
  return { periodKey: head, runNo: Number.isInteger(runNo) && runNo > 0 ? runNo : 0 };
}

// =============================================================================
//  ĐỌC TRẠNG THÁI — mọi lời gọi danh sách đều truyền giới hạn TƯỜNG MINH
// =============================================================================

/** Thông báo khi một danh sách chạm giới hạn quét: nói rõ việc phải làm, không chỉ nói lỗi. */
function scanLimitError<T>(what: string, limit: number): Result<T> {
  return err(
    'UNKNOWN',
    `${what} chạm giới hạn quét ${limit} dòng nên danh sách KHÔNG đầy đủ, và tiến trình tự ` +
      `động chia dừng lại. Quyết định dựa trên danh sách bị cắt sẽ sai âm thầm: số vòng đếm ` +
      `thiếu làm tiến trình tự chặn chính nó, còn số tiền còn phải chia đếm thiếu làm nó chia ` +
      `quá số có trong ví. Cần phân trang thật (Indexer) trước khi chạy ở quy mô này.`,
  );
}

/** Phân biệt giá trị đọc được với `Result` lỗi. Xem lý do ở `readDecision`. */
const isResultError = (value: unknown): value is Result<never> =>
  typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;

/** Số vòng ĐÃ có của một kỳ. Vòng tiếp theo là số này cộng một. */
async function countRuns(periodKey: string): Promise<number | Result<never>> {
  const runs = await getKeeperStore().listRuns({
    jobName: DISTRIBUTION_JOB_NAME,
    limit: MAX_KEEPER_RUN_SCAN,
  });
  if (runs.length >= MAX_KEEPER_RUN_SCAN) {
    return scanLimitError('Lịch chạy tiến trình chia', MAX_KEEPER_RUN_SCAN);
  }

  const prefix = `${periodKey}${RUN_KEY_SEPARATOR}`;
  return runs.filter((run) => run.periodKey.startsWith(prefix)).length;
}

// =============================================================================
//  QUYẾT ĐỊNH CỦA MỘT VÒNG (FE-08 QĐ-E: keeper KHÔNG BAO GIỜ mở kỳ)
// =============================================================================

/** Việc phải làm sau khi đọc kỳ hoạt động và phần chưa phân bổ. */
type Decision =
  | { kind: 'continue'; period: DistributionPeriodRecord }
  | {
      kind: 'idle';
      outcome: 'NO_NEW_FUNDS' | 'BELOW_MIN_NEW_BALANCE' | 'AWAITING_APPROVAL' | 'OPENING_PENDING';
      periodKey: string | null;
      message: string;
    };

/**
 * Quyết định vòng này làm gì (FE-08 QĐ-E, CH-3).
 *
 * - Kỳ hoạt động `APPROVED`: chia tiếp đúng kỳ đó.
 * - Kỳ hoạt động chưa duyệt, `AMOUNT_CHANGED`, hoặc kỳ cũ chưa có lần duyệt: `AWAITING_APPROVAL`,
 *   không trả gì.
 * - Kỳ còn `OPENING` sau bước dọn: `OPENING_PENDING`, chờ vòng sau phục hồi.
 * - Không có kỳ hoạt động: `NO_NEW_FUNDS`, `BELOW_MIN_NEW_BALANCE`, hoặc `AWAITING_APPROVAL` khi phần
 *   chưa phân bổ tới ngưỡng. KHÔNG mở kỳ: mở kỳ là quyết định của Kiểm soát viên (nợ QĐ-H).
 *
 * @pending IN-02 | đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được; kết cục vẫn là `AWAITING_APPROVAL` cho tới khi Kiểm soát viên duyệt
 * @flow distribute:18 | đọc kỳ hoạt động và phần chưa phân bổ: chỉ tiếp tục kỳ APPROVED, còn lại AWAITING_APPROVAL, không bao giờ mở kỳ
 */
async function decideCycle(chain: ChainKey, unallocated: bigint): Promise<Decision> {
  const active = await getDistributionStore().findActivePeriod(chain);
  if (active) {
    if (active.status === 'OPENING') {
      return {
        kind: 'idle',
        outcome: 'OPENING_PENDING',
        periodKey: active.periodKey,
        message:
          `Kỳ "${active.periodKey}" vẫn đang mở trên chuỗi sau bước dọn (chưa đọc được kỳ). ` +
          `Vòng sau phục hồi; không gửi gì thêm.`,
      };
    }
    if (active.approvalStatus === 'APPROVED') return { kind: 'continue', period: active };
    return {
      kind: 'idle',
      outcome: 'AWAITING_APPROVAL',
      periodKey: active.periodKey,
      message:
        active.approvalStatus === 'AMOUNT_CHANGED'
          ? `Kỳ "${active.periodKey}" lấy ${active.totalAmount} VNDB trên chuỗi, khác số đã duyệt ` +
            `${active.expectedAmount} VNDB. Chờ Kiểm soát viên duyệt lại; keeper không trả gì.`
          : `Kỳ "${active.periodKey}" chưa có lần duyệt nào của Kiểm soát viên. Chờ duyệt; keeper ` +
            `không trả gì.`,
    };
  }

  if (unallocated === 0n) {
    return {
      kind: 'idle',
      outcome: 'NO_NEW_FUNDS',
      periodKey: null,
      message: 'Quỹ chia lợi nhuận không có phần chưa phân bổ: không có tiền mới.',
    };
  }

  const minNewBalance = await readDistributionMinNewBalance();
  if (unallocated < minNewBalance) {
    return {
      kind: 'idle',
      outcome: 'BELOW_MIN_NEW_BALANCE',
      periodKey: null,
      message:
        `Quỹ chia lợi nhuận có ${unallocated} VNDB chưa phân bổ, chưa tới ngưỡng ` +
        `${minNewBalance} VNDB nên chưa đề nghị duyệt. Một kỳ chia tốn một ảnh chụp trên chuỗi ` +
        `cộng một giao dịch cho mỗi lô, không đáng cho vài đồng lẻ.`,
    };
  }

  return {
    kind: 'idle',
    outcome: 'AWAITING_APPROVAL',
    periodKey: null,
    message:
      `Quỹ chia lợi nhuận có ${unallocated} VNDB chưa phân bổ, từ ngưỡng ${minNewBalance} VNDB. ` +
      `Chờ Kiểm soát viên duyệt chia; keeper không tự mở kỳ.`,
  };
}

// =============================================================================
//  CẬP NHẬT MỐC SỐ DƯ
// =============================================================================

/**
 * Ghi mốc số dư mới SAU khi một kỳ đã chia xong trọn vẹn. Trả về mốc vừa ghi.
 *
 * SC-06 QĐ-I: mốc KHÔNG còn dùng để quyết định mở kỳ (căn cứ là `unallocatedProfit`). Giữ khoá
 * cấu hình và việc ghi để màn hình còn hiển thị được lịch sử "kỳ nào để lại bao nhiêu phần lẻ".
 *
 * Mốc mới là `totalAmount - đã chi` của kỳ vừa xong, tức đúng phần dư làm tròn còn nằm lại
 * trong ví lợi nhuận.
 *
 * ⚠️ KHÔNG lấy mốc bằng cách đọc lại `profitPoolBalance` sau khi chia: SPV có thể đã nạp thêm tiền
 * giữa lúc mở kỳ và lúc chia xong, và số đó sẽ lẫn vào mốc.
 *
 * ⚠️ Chỉ gọi khi `outstanding === 0`.
 *
 * @flow distribute:16 | ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn
 */
async function settleBalanceMark(run: DistributionRunView, role: Role): Promise<bigint> {
  const nextMark = BigInt(run.period.totalAmount) - BigInt(run.paidAmount);

  await getConfigStore().setConfig({
    key: CONFIG_KEYS.distributionLastSettledBalance,
    value: nextMark.toString(),
    type: 'bigint',
    changedBy: role,
    reason:
      `kỳ ${run.period.periodKey} hoàn tất: tổng ${run.period.totalAmount} VNDB, đã chi ` +
      `${run.paidAmount}, còn lại ${nextMark} là phần dư làm tròn`,
  });

  return nextMark;
}

// =============================================================================
//  GHI VẾT
// =============================================================================

/** Ghi sổ kiểm toán cho một vòng chạy: gom lại để không lặp nhiều chỗ. */
async function auditCycle(
  txnStore: ITxnStore,
  role: Role,
  chain: ChainKey,
  target: string | null,
  outcome: 'SUCCESS' | 'FAILURE',
  detail: string,
): Promise<void> {
  await txnStore.appendAudit({
    actorRole: role,
    action: 'distribution:execute',
    target,
    outcome,
    detail,
    chain,
  });
}

/**
 * Đóng một dòng `KeeperRun`.
 *
 * ⚠️ `error` CHỈ mang thông báo khi vòng thất bại. Tóm tắt của một vòng thành công đi vào SỔ
 * KIỂM TOÁN, không nhồi vào cột này.
 */
async function closeRun(
  run: KeeperRunRecord | null,
  failed: boolean,
  error: string | null,
): Promise<void> {
  if (!run) return;
  await getKeeperStore().finishRun({
    id: run.id,
    status: failed ? 'FAILED' : 'SUCCESS',
    error: failed ? error : null,
  });
}

// =============================================================================
//  MỘT LƯỢT CHIA CỦA KỲ ĐÃ DUYỆT: dùng chung cho Kiểm soát viên và keeper
// =============================================================================

/** Kết cục một lượt chia của kỳ đã duyệt. */
export type ApprovedRoundOutcome =
  /** Một lượt khác (người hoặc keeper) đang giữ đúng số vòng này của kỳ. */
  | 'ALREADY_RUNNING'
  /** Chốt kỳ vault chưa xong (`PENDING`, `SENT`, chờ kỳ trước): không gửi lô, lượt sau đối soát. */
  | 'VAULT_PENDING'
  /** Kỳ vault `CONFLICT`: khoá chia, cần xử lý tay. */
  | 'VAULT_CONFLICT'
  | 'DISTRIBUTED'
  | 'PARTIAL'
  | 'PERIOD_ENDED';

export interface ApprovedRoundView {
  outcome: ApprovedRoundOutcome;
  runId: string | null;
  runNo: number;
  run: DistributionRunView | null;
  stuck: boolean;
  /** Mốc số dư sau lượt; khác mốc cũ chỉ khi kỳ vừa chia xong trọn vẹn. */
  nextSettledBalance: string;
  message: string;
}

/**
 * Chạy MỘT lượt chia cho kỳ `APPROVED` (FE-08 QĐ-D): chiếm số vòng `<mã kỳ>#<n>` trong `KeeperRun`
 * với nguồn kích hoạt, gọi lõi `runDistributionRound` (chốt vault, gửi tối đa
 * `distribution.max_batches_per_run` lô), đóng dòng `KeeperRun`, ghi sổ kiểm toán.
 *
 * Số vòng là trọng tài giữa Kiểm soát viên bấm tiếp tục và keeper: hai bên đếm ra cùng số vòng
 * thì ràng buộc duy nhất `(jobName, periodKey)` loại một bên TRƯỚC khi nó gửi gì.
 *
 * KHÔNG kiểm quyền: người gọi đã kiểm và truyền vai, người thao tác trong `ctx`.
 *
 * @flow distribute:12 | chiếm số vòng KeeperRun kèm nguồn MANUAL hoặc KEEPER, chạy lõi một lượt chia, đóng vòng và ghi sổ
 */
export async function runApprovedPeriod(
  ctx: ChainContext,
  period: DistributionPeriodRecord,
  triggerSource: KeeperTriggerSource,
): Promise<Result<ApprovedRoundView>> {
  const { chain, role, txnStore } = ctx;
  const settledBalance = await readDistributionSettledBalance();
  const previousRuns = await countRuns(period.periodKey);
  if (isResultError(previousRuns)) return previousRuns;
  const runNo = previousRuns + 1;
  const runKey = runKeyOf(period.periodKey, runNo);
  const who = triggerSource === 'MANUAL' ? `Kiểm soát viên ${ctx.actor}` : 'tiến trình định kỳ';

  const claimed = await claimRun(runKey, triggerSource);
  if (!claimed) {
    return ok({
      outcome: 'ALREADY_RUNNING',
      runId: null,
      runNo,
      run: null,
      stuck: false,
      nextSettledBalance: settledBalance.toString(),
      message:
        `Một lượt khác đã giữ chỗ chạy "${runKey}". Lượt này dừng ngay và KHÔNG chia gì: hai lượt ` +
        `cùng chia một kỳ sẽ gửi cùng một lô hai lần.`,
    });
  }

  try {
    const distributed = await runDistributionRound(ctx, period.id);
    if (!distributed.ok) {
      await closeRun(claimed, true, distributed.error);
      return distributed;
    }
    const run = distributed.data;

    const ended = run.period.status === 'EXPIRED' || run.period.status === 'CLOSED';
    const vaultBlocked = run.vault !== 'DONE' && run.vault !== 'NOT_APPLICABLE' && !ended;
    const completed = !vaultBlocked && run.outstanding === 0;
    const nextSettled = completed && !ended ? await settleBalanceMark(run, role) : settledBalance;

    const stuckAfterRuns = await readDistributionStuckAfterRuns();
    const stuck = !completed && !ended && runNo >= stuckAfterRuns;

    const outcome: ApprovedRoundOutcome = ended
      ? 'PERIOD_ENDED'
      : run.vault === 'CONFLICT'
        ? 'VAULT_CONFLICT'
        : vaultBlocked
          ? 'VAULT_PENDING'
          : completed
            ? 'DISTRIBUTED'
            : 'PARTIAL';

    const key = period.periodKey;
    const message = {
      PERIOD_ENDED:
        `Kỳ "${key}" đã ${run.period.status === 'CLOSED' ? 'đóng' : 'hết hạn nhận'} trên chuỗi ở vòng ` +
        `${runNo}: ${run.expired} hồ sơ chưa nhận chuyển EXPIRED, ${run.reconciled} đối soát từ chuỗi, ` +
        `không gửi lô.`,
      VAULT_CONFLICT:
        `Kỳ "${key}": kỳ vault CONFLICT, cần xử lý tay. Không gửi lô nào; khoá chia cho tới khi xử lý.`,
      VAULT_PENDING:
        `Kỳ "${key}": đang chốt kỳ vault (${run.vault}). Không gửi lô nào; lần tiếp tục sau đối soát ` +
        `rồi đi tiếp.`,
      DISTRIBUTED:
        `Kỳ "${key}" hoàn tất ở vòng ${runNo}: ${run.batches} lô, ${run.paid} hồ sơ đã chi, ` +
        `${run.failed} thất bại; mốc số dư chuyển từ ${settledBalance} sang ${nextSettled}.`,
      PARTIAL:
        `Kỳ "${key}" chia dở ở vòng ${runNo}: ${run.batches}/${run.maxBatches} lô, ${run.paid} hồ ` +
        `sơ đã chi, ${run.failed} thất bại, còn ${run.outstanding} phải chi. Tiếp tục để chia nốt.`,
      ALREADY_RUNNING: '',
    }[outcome];
    const stuckNote = stuck
      ? ` CẢNH BÁO: kỳ này đã qua ${runNo} vòng (ngưỡng ${stuckAfterRuns}) mà chưa chia xong. ` +
        `Hoặc lô đang lỗi lặp lại, hoặc số ví lớn hơn mức ` +
        `distribution.max_batches_per_run × distribution.batch_size dự tính. Cần người xem.`
      : '';
    const failed = stuck || outcome === 'VAULT_CONFLICT';

    await closeRun(claimed, failed, failed ? message + stuckNote : null);
    await auditCycle(
      txnStore,
      role,
      chain,
      runKey,
      failed ? 'FAILURE' : 'SUCCESS',
      `lượt chia (${who}): ${message}${stuckNote}`,
    );

    return ok({
      outcome,
      runId: claimed.id,
      runNo,
      run,
      stuck,
      nextSettledBalance: nextSettled.toString(),
      message: message + stuckNote,
    });
  } catch (error) {
    // Đóng dòng `KeeperRun` cho lỗi KHÔNG lường trước: bỏ qua thì dòng `RUNNING` ở lại mãi.
    const reason = error instanceof Error ? error.message : 'Lỗi không xác định.';
    await closeRun(claimed, true, reason).catch(() => undefined);
    throw error;
  }
}

// =============================================================================
//  MỘT VÒNG CHẠY CỦA KEEPER
// =============================================================================

/**
 * Chạy MỘT vòng của tiến trình định kỳ (FE-08 QĐ-E): dọn, đọc quỹ, chỉ tiếp tục kỳ đã duyệt.
 *
 * ## Thứ tự các bước
 *
 * 1. Kiểm quyền `distribution:execute` (vai mặc định của bản demo, nợ QĐ-H).
 * 2. DỌN (SC-06): phục hồi kỳ `OPENING` (kèm so số đã duyệt), thử lại phần vault của kỳ được phép.
 * 3. ĐỌC quỹ, dự trữ, phần chưa phân bổ; quỹ hụt thì dừng; quyết định việc phải làm.
 * 4. Kỳ hoạt động `APPROVED`: một lượt chia với `triggerSource = KEEPER` (`runApprovedPeriod`).
 * 5. Còn lại: ghi vòng rỗng với kết cục (`AWAITING_APPROVAL`, ...). KHÔNG BAO GIỜ mở kỳ.
 *
 * @flow distribute:17 | chạy một vòng keeper: dọn kỳ OPENING và phần vault, đọc quỹ, chỉ tiếp tục kỳ đã APPROVED, không bao giờ mở kỳ
 */
export async function runDistributionCycle(
  input: unknown,
): Promise<Result<DistributionCycleView>> {
  const parsed = distributionCycleSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain } = parsed.data;

  const txnStore = getStore();
  let claimed: KeeperRunRecord | null = null;

  try {
    // `authorize` ghi sổ kiểm toán cho cả hai kết cục rồi mới ném.
    const role = await authorize('distribution:execute', null, chain);
    const actor = await currentActorId(role);

    // --- 0. Dọn: phục hồi kỳ OPENING, thử lại phần vault (SC-06 QĐ-F, QĐ-G) --
    const housekeeping = await reconcileChainPeriods(chain, role, actor);
    if (housekeeping.recovered > 0 || housekeeping.errors.length > 0) {
      await auditCycle(
        txnStore,
        role,
        chain,
        null,
        housekeeping.errors.length > 0 ? 'FAILURE' : 'SUCCESS',
        `vòng chạy tự động, bước dọn: phục hồi ${housekeeping.recovered} kỳ OPENING, còn ` +
          `${housekeeping.stillOpening} kỳ đang mở; vault: ${housekeeping.vault.join(', ') || 'không có việc'}` +
          (housekeeping.errors.length > 0 ? `; lỗi: ${housekeeping.errors.join(' | ')}` : ''),
      );
    }

    // --- 1. ĐỌC: quỹ, dự trữ, phần chưa phân bổ ------------------------------
    const ledger = getLedger(chain);
    const poolBalance = await ledger.profitPoolBalance();
    const reservedBalance = await ledger.reservedProfit();
    const unallocatedBalance = await ledger.unallocatedProfit();
    const settledBalance = await readDistributionSettledBalance();

    const base = {
      chain,
      poolBalance: poolBalance.toString(),
      unallocatedBalance: unallocatedBalance.toString(),
      reservedBalance: reservedBalance.toString(),
      settledBalance: settledBalance.toString(),
      nextSettledBalance: settledBalance.toString(),
      runId: null as string | null,
      runNo: 0,
      periodId: null as string | null,
      periodKey: null as string | null,
      batches: 0,
      paid: 0,
      failed: 0,
      outstanding: 0,
      stuck: false,
    };

    // --- 2. Quỹ hụt so với dự trữ -> dừng, ghi lỗi -------------------------
    if (poolBalance < reservedBalance) {
      const message =
        `Số dư quỹ chia lợi nhuận là ${poolBalance} VNDB, THẤP HƠN tổng dự trữ ${reservedBalance} ` +
        `VNDB mà các kỳ chưa đóng còn phải trả. Quỹ chỉ chuyển tiền ra qua chia cho người được ` +
        `chia, nên quỹ hụt nghĩa là tiền đã ra bằng đường khác (đốt VNDB trong quỹ). Dừng lại: ` +
        `chia tiếp sẽ để những ví ở lô sau không bao giờ nhận được. SPV phải nạp bù ` +
        `${reservedBalance - poolBalance} VNDB.`;
      const runKey = idleRunKey(new Date());
      claimed = await claimRun(runKey, 'KEEPER');
      if (!claimed) return ok(alreadyRunning(base, runKey));
      await closeRun(claimed, true, message);
      await auditCycle(txnStore, role, chain, runKey, 'FAILURE', `vòng chạy tự động: ${message}`);
      return err('INSUFFICIENT_PROFIT_POOL', message);
    }

    const decision = await decideCycle(chain, unallocatedBalance);

    // --- 3. Không có kỳ được phép chia -> vòng rỗng --------------------------
    if (decision.kind === 'idle') {
      const runKey = idleRunKey(new Date());

      claimed = await claimRun(runKey, 'KEEPER');
      if (!claimed) return ok(alreadyRunning(base, runKey));

      await closeRun(claimed, false, decision.message);
      await auditCycle(txnStore, role, chain, runKey, 'SUCCESS', `vòng chạy tự động: ${decision.message}`);

      return ok({
        ...base,
        outcome: decision.outcome,
        runId: claimed.id,
        periodKey: decision.periodKey,
        message: decision.message,
      });
    }

    // --- 4. Kỳ đã duyệt: một lượt chia với nguồn KEEPER ----------------------
    const ctx = chainContext(chain, role, actor);
    const round = await runApprovedPeriod(ctx, decision.period, 'KEEPER');
    if (!round.ok) return round;
    const { run } = round.data;

    return ok({
      ...base,
      outcome: round.data.outcome,
      nextSettledBalance: round.data.nextSettledBalance,
      runId: round.data.runId,
      runNo: round.data.runNo,
      periodId: decision.period.id,
      periodKey: decision.period.periodKey,
      batches: run?.batches ?? 0,
      paid: run?.paid ?? 0,
      failed: run?.failed ?? 0,
      outstanding: run?.outstanding ?? 0,
      stuck: round.data.stuck,
      message: round.data.message,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Lỗi không xác định.';
    await closeRun(claimed, true, reason).catch(() => undefined);
    return toResult(error);
  }
}

/** Chiếm chỗ chạy; `null` nghĩa là một vòng khác đã giữ đúng khoá này. */
async function claimRun(
  runKey: string,
  triggerSource: KeeperTriggerSource,
): Promise<KeeperRunRecord | null> {
  try {
    return await getKeeperStore().startRun({
      jobName: DISTRIBUTION_JOB_NAME,
      periodKey: runKey,
      triggerSource,
    });
  } catch (error) {
    /**
     * Ràng buộc duy nhất `(jobName, periodKey)` là TRỌNG TÀI, không phải một phép kiểm trong
     * mã. Đọc trước bằng `findRun` rồi mới ghi thì hai vòng đồng thời đều thấy "chưa có" và
     * đều chạy — đúng cái mà ràng buộc được dựng để chặn.
     */
    if (error instanceof UniqueConstraintError) return null;
    throw error;
  }
}

/** Khung nhìn cho vòng không nhận được chỗ chạy. Không phải lỗi: hai lượt gọi trùng nhau. */
function alreadyRunning(
  base: Omit<DistributionCycleView, 'outcome' | 'message'>,
  runKey: string,
): DistributionCycleView {
  return {
    ...base,
    outcome: 'ALREADY_RUNNING',
    message:
      `Một vòng khác đã giữ chỗ chạy "${runKey}". Vòng này dừng ngay và KHÔNG chia gì — hai ` +
      `vòng cùng chia một kỳ sẽ gửi cùng một lô hai lần.`,
  };
}

// =============================================================================
//  ĐỌC LỊCH CHẠY
// =============================================================================

/**
 * Lịch chạy của tiến trình tự động chia, mới nhất trước. Hàm ĐỌC.
 *
 * Dùng `assertCan` thay vì `authorize` vì màn hình theo dõi sẽ gọi lại theo chu kỳ: mỗi lời
 * gọi một bản ghi kiểm toán sẽ nhấn chìm sổ bằng hàng trăm dòng "đã cho phép xem", và sổ mất
 * khả năng dùng để đối chiếu trách nhiệm. Cùng lập luận với `getDistributionPeriod` của BE-06.
 *
 * Quyền là `reconcile:read`: dữ liệu toàn hệ, nên hai vai vận hành đọc được, còn nhà đầu tư và
 * Người bán thì không. `periodKey` lọc đúng các vòng của một kỳ (lịch sử kỳ trên màn chia).
 *
 * @flow distribute:24 | kiểm quyền reconcile:read, đọc lịch chạy KeeperRun kèm nguồn kích hoạt MANUAL hoặc KEEPER
 */
export async function listDistributionRuns(
  input: unknown,
): Promise<Result<DistributionRunLogView[]>> {
  const parsed = keeperRunQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }

  try {
    assertCan(await currentRole(), 'reconcile:read');

    const runs = await getKeeperStore().listRuns({
      jobName: DISTRIBUTION_JOB_NAME,
      limit: parsed.data.limit,
      periodKeyPrefix: parsed.data.periodKey
        ? `${parsed.data.periodKey}${RUN_KEY_SEPARATOR}`
        : undefined,
    });

    return ok(
      runs.map((run) => ({
        id: run.id,
        ...parseRunKey(run.periodKey),
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        error: run.error,
        triggerSource: run.triggerSource,
      })),
    );
  } catch (error) {
    return toResult(error);
  }
}
