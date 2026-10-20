import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { CONFIG_KEYS } from '@/lib/config/issue-terms';
import { getLedger } from '@/lib/ledger';
import { assertCan, type Role } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import {
  getConfigStore,
  getDistributionStore,
  getKeeperStore,
  getStore,
  UniqueConstraintError,
} from '@/lib/store';
import type { DistributionPeriodRecord, ITxnStore, KeeperRunRecord } from '@/lib/store';
import {
  readDistributionMinNewBalance,
  readDistributionSettledBalance,
  readDistributionStuckAfterRuns,
} from '@/lib/store/config-values';
import { authorize, toResult } from './authorize';
import {
  distributePeriod,
  MAX_RECIPIENT_SCAN,
  openPeriod,
  reconcileChainPeriods,
  type DistributionRunView,
} from './distribution.service';
import { err, ok, type Result } from './result';
import { distributionCycleSchema, keeperRunQuerySchema } from './schemas';

/**
 * TIẾN TRÌNH TỰ ĐỘNG CHIA LỢI NHUẬN — phát hiện ví lợi nhuận nhận tiền rồi chia, không cần
 * người bấm.
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
 * bằng cách HỎI ĐỊNH KỲ phần chưa phân bổ của quỹ. Đường nâng cấp ghi ở `detectNewFunds`.
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
 * Phải là ký tự KHÔNG hợp lệ trong mã kỳ chia (`periodKeySchema` chỉ cho chữ, số và `. _ -`),
 * nếu không thì `auto-2026-01-01-01#2` và một mã kỳ tên `auto-2026-01-01-01#2` do người đặt
 * sẽ không phân biệt được, và số vòng tách ra sai.
 */
const RUN_KEY_SEPARATOR = '#';

/**
 * Tiền tố mã kỳ do tiến trình tự sinh, đứng sau tiền tố chain (SC-06 CH-6): `<chain>:auto-`.
 * Phân biệt với kỳ do cán bộ ngân hàng tự đặt tên.
 */
const AUTO_PERIOD_PREFIX = 'auto-';

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
 * Kết cục của một vòng chạy. Sáu giá trị này đều là kết cục BÌNH THƯỜNG.
 *
 * Tình huống bất thường (quỹ hụt so với tổng dự trữ, SC-06 QĐ-I) KHÔNG có mặt ở đây: nó trả về
 * `Result` lỗi. Lý do là người gọi phải xử lý khác nhau —
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
  | 'PERIOD_ENDED';

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
  /** SC-06: phần chưa phân bổ ở đầu vòng — căn cứ mở kỳ mới. */
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
  /** `true` khi kỳ được MỞ trong chính vòng này. */
  periodOpened: boolean;
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

/**
 * Kỳ CHƯA hoàn tất của chuỗi đang xét; `null` nghĩa là mọi kỳ đã xong.
 *
 * Lấy kỳ MỞ SỚM NHẤT khi có nhiều hơn một. Tình huống đó chỉ xảy ra khi cán bộ ngân hàng mở
 * kỳ bằng tay ở FE-08 trong lúc một kỳ khác còn dở — tiến trình này không bao giờ mở kỳ thứ
 * hai. Chọn kỳ cũ nhất để một kỳ bị bỏ quên không bị các kỳ mới chen lên trước mãi.
 */
async function findUnfinishedPeriod(
  chain: ChainKey,
): Promise<DistributionPeriodRecord | null | Result<never>> {
  const periods = await getDistributionStore().listPeriods({ chain, limit: MAX_RECIPIENT_SCAN });
  if (periods.length >= MAX_RECIPIENT_SCAN) {
    return scanLimitError('Danh sách kỳ chia', MAX_RECIPIENT_SCAN);
  }

  // SC-06: kỳ EXPIRED/CLOSED là trạng thái kết thúc, không chặn kỳ mới.
  const unfinished = periods.filter(
    (period) =>
      period.status === 'OPENING' || period.status === 'OPEN' || period.status === 'DISTRIBUTING',
  );
  if (unfinished.length === 0) return null;

  return unfinished.reduce((oldest, period) =>
    period.openedAt < oldest.openedAt ? period : oldest,
  );
}

/**
 * Mã kỳ tự sinh: `<chain>:auto-<ngày UTC>-<số thứ tự trong ngày>`, ví dụ
 * `mock:auto-2026-09-27-01` (SC-06 CH-6: tiền tố chain).
 *
 * Ngày theo UTC, không theo giờ địa phương: tiến trình định kỳ có thể chạy ở múi giờ khác
 * máy sinh mã trước đó, và khi đó "số thứ tự trong ngày" đếm trên hai ngày khác nhau sẽ cho
 * ra mã đã dùng — `openPeriod` từ chối, tiến trình đứng.
 *
 * Tiền tố chain làm số thứ tự tự đếm riêng từng chain mà vẫn không trùng `periodKey` (duy nhất
 * toàn hệ). Kỳ giữ chỗ bị xoá vì chuỗi từ chối thì mã đó được sinh lại ở vòng sau.
 *
 * Hai vòng đồng thời cố ý sinh ra CÙNG một mã: chốt chặn là ràng buộc duy nhất ở `KeeperRun`
 * và ở `periodKey`, không phải sự khác nhau của mã.
 */
async function nextAutoPeriodKey(chain: ChainKey, now: Date): Promise<string | Result<never>> {
  const prefix = `${chain}:${AUTO_PERIOD_PREFIX}${now.toISOString().slice(0, 10)}-`;

  const periods = await getDistributionStore().listPeriods({ limit: MAX_RECIPIENT_SCAN });
  if (periods.length >= MAX_RECIPIENT_SCAN) {
    return scanLimitError('Danh sách kỳ chia', MAX_RECIPIENT_SCAN);
  }

  const used = periods.filter((period) => period.periodKey.startsWith(prefix)).length;
  return `${prefix}${String(used + 1).padStart(2, '0')}`;
}

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
//  PHÁT HIỆN TIỀN VÀO
// =============================================================================

/** Việc phải làm sau khi đọc phần chưa phân bổ. */
type Decision =
  | { kind: 'continue'; period: DistributionPeriodRecord }
  | { kind: 'open' }
  | { kind: 'idle'; outcome: 'NO_NEW_FUNDS' | 'BELOW_MIN_NEW_BALANCE'; message: string };

/**
 * Quyết định vòng này làm gì từ PHẦN CHƯA PHÂN BỔ của quỹ (SC-06 QĐ-I).
 *
 * Kỳ đang dở (`OPENING`, `OPEN`, `DISTRIBUTING`) được xét TRƯỚC: tiến trình không mở kỳ thứ hai
 * khi còn kỳ dở. Không có kỳ dở thì mở khi `unallocatedProfit() >= distribution.min_new_balance`.
 * Phần chưa phân bổ đã trừ phần các kỳ còn nợ, nên phần lẻ của kỳ cũ không bị hiểu nhầm là tiền
 * mới, còn tiền được giải phóng khi đóng kỳ thì được tính lại đúng.
 *
 * @pending IN-02 | đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được, giữ nguyên ba nhánh quyết định và nguyên phần chia ở `runDistributionCycle`
 * @flow distribute:13 | đọc phần chưa phân bổ của quỹ, quyết định mở kỳ mới hay chia tiếp kỳ dở
 */
async function detectNewFunds(
  chain: ChainKey,
  unallocated: bigint,
): Promise<Decision | Result<never>> {
  const unfinished = await findUnfinishedPeriod(chain);
  if (isResultError(unfinished)) return unfinished;
  if (unfinished) return { kind: 'continue', period: unfinished };

  if (unallocated === 0n) {
    return {
      kind: 'idle',
      outcome: 'NO_NEW_FUNDS',
      message: 'Quỹ chia lợi nhuận không có phần chưa phân bổ: không có tiền mới.',
    };
  }

  const minNewBalance = await readDistributionMinNewBalance();
  if (unallocated < minNewBalance) {
    return {
      kind: 'idle',
      outcome: 'BELOW_MIN_NEW_BALANCE',
      message:
        `Quỹ chia lợi nhuận có ${unallocated} VNDB chưa phân bổ, chưa tới ngưỡng ` +
        `${minNewBalance} VNDB nên chưa mở kỳ. Một kỳ chia tốn một ảnh chụp trên chuỗi ` +
        `cộng một giao dịch cho mỗi lô, không đáng cho vài đồng lẻ.`,
    };
  }

  return { kind: 'open' };
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
 * trong ví lợi nhuận. Nhờ vậy lượt sau thấy số dư đúng bằng mốc và kết luận "không có tiền
 * mới" — phần dư KHÔNG bị hiểu lầm là một lần nạp tiền.
 *
 * ⚠️ KHÔNG lấy mốc bằng cách đọc lại `profitPoolBalance` sau khi chia, dù nghe có vẻ tương
 * đương. Giữa lúc mở kỳ và lúc chia xong, SPV có thể đã nạp thêm tiền; đọc lại số dư sẽ đưa
 * cả số tiền mới đó vào mốc, và hệ quả là nó vĩnh viễn không được chia cho ai. Tính từ con số
 * của kỳ thì phần vượt quá mốc còn nguyên trong ví và lượt sau nhận ra nó là tiền mới.
 *
 * ⚠️ Chỉ gọi khi `outstanding === 0`. Khi đó mọi hồ sơ đã `PAID` nên "đã chi" bằng đúng tổng
 * phân bổ, và hiệu số là phần dư. Gọi giữa lúc còn hồ sơ chưa chi sẽ ghi một mốc cao hơn số
 * dư thật, rồi lượt sau kết luận "số dư giảm" và dừng hẳn.
 *
 * @flow distribute:14 | ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn
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

/** Ghi sổ kiểm toán cho một vòng chạy — gom lại để không lặp sáu chỗ. */
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
 * KIỂM TOÁN, không nhồi vào cột này: cột tên `error` và tài liệu của nó nói "thông báo lỗi khi
 * thất bại", nên đặt một câu tóm tắt thành công vào đó làm mọi truy vấn kiểu "vòng nào có lỗi"
 * trả về cả những vòng chạy đúng. `KeeperRun` chưa có cột tóm tắt — đã ghi thành câu hỏi mở
 * trong checkpoint BE-07.
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
//  MỘT VÒNG CHẠY
// =============================================================================

/**
 * Chạy MỘT vòng: phát hiện tiền vào, mở kỳ nếu cần, chia tối đa số lô cấu hình, kết thúc.
 *
 * ## Thứ tự các bước
 *
 * 1. Kiểm quyền `distribution:execute`.
 * 2. DỌN (SC-06): phục hồi kỳ `OPENING`, thử lại phần vault của các kỳ chưa chốt vault.
 * 3. ĐỌC quỹ, dự trữ, phần chưa phân bổ; quỹ hụt thì dừng; quyết định việc phải làm.
 * 4. CHIẾM chỗ chạy bằng `startRun` — từ đây mới gửi giao dịch chia.
 * 5. Mở kỳ (nếu là kỳ mới) rồi chia theo lô, bằng cách gọi lại BE-06.
 * 6. Cập nhật mốc số dư (chỉ để hiển thị) nếu kỳ đã xong trọn vẹn.
 * 7. Đóng dòng `KeeperRun` và ghi sổ kiểm toán.
 *
 * Bước 3 nằm TRƯỚC bước 4, khác với lời khuyên "gọi `startRun` trước khi làm việc" ở
 * `keeper.store.port.ts`, và đây là chủ đích: khoá chiếm chỗ mang mã kỳ, nên phải biết kỳ nào
 * trước khi xin khoá. Không mất gì vì bước 3 chỉ ĐỌC — hai vòng đồng thời cùng đọc ra cùng một
 * kết luận, rồi cùng xin một khoá, và ràng buộc duy nhất loại một vòng TRƯỚC khi vòng đó ghi
 * dòng nào hay gửi giao dịch nào.
 *
 * Bước 2 cũng an toàn khi hai vòng chạy đồng thời: mở kỳ trên chuỗi chống trùng nhãn, và đẩy
 * vault giành quyền gửi bằng chuyển trạng thái có điều kiện.
 *
 * ## Vì sao không kiểm quỹ đủ cho phần còn phải chia theo từng kỳ
 *
 * Quỹ giữ sổ dự trữ: phần còn nợ của mỗi kỳ chưa đóng không nhỏ hơn tổng hồ sơ chưa trả của kỳ
 * đó. Phép kiểm "quỹ không hụt so với tổng dự trữ" ở bước 3 vì vậy đã bao mọi kỳ cùng lúc.
 *
 * @flow distribute:12 | chạy một vòng: dọn kỳ OPENING và phần vault, phát hiện phần chưa phân bổ, chiếm chỗ chạy, mở kỳ, chia theo lô
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

    // --- 0. Dọn: phục hồi kỳ OPENING, thử lại phần vault (SC-06 QĐ-F, QĐ-G) --
    const housekeeping = await reconcileChainPeriods(chain, role);
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

    // --- 1. ĐỌC: quỹ, dự trữ, phần chưa phân bổ và việc phải làm -------------
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
      periodOpened: false,
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
      claimed = await claimRun(runKey);
      if (!claimed) return ok(alreadyRunning(base, runKey));
      await closeRun(claimed, true, message);
      await auditCycle(txnStore, role, chain, runKey, 'FAILURE', `vòng chạy tự động: ${message}`);
      // Bất thường về TIỀN trả về lỗi chứ không phải một `ok` mang cờ: người gọi phải báo
      // người vận hành, không phải ghi nhật ký rồi chờ lượt sau.
      return err('INSUFFICIENT_PROFIT_POOL', message);
    }

    const decision = await detectNewFunds(chain, unallocatedBalance);
    if (isResultError(decision)) return decision;

    // --- 3. Không có việc -> vòng rỗng --------------------------------------
    if (decision.kind === 'idle') {
      const runKey = idleRunKey(new Date());

      claimed = await claimRun(runKey);
      if (!claimed) return ok(alreadyRunning(base, runKey));

      await closeRun(claimed, false, decision.message);
      await auditCycle(
        txnStore,
        role,
        chain,
        runKey,
        'SUCCESS',
        `vòng chạy tự động: ${decision.message}`,
      );

      return ok({
        ...base,
        outcome: decision.outcome,
        runId: claimed.id,
        message: decision.message,
      });
    }

    // --- 3. Xác định kỳ và CHIẾM chỗ chạy -----------------------------------
    const isNewPeriod = decision.kind === 'open';

    const periodKey = isNewPeriod
      ? await nextAutoPeriodKey(chain, new Date())
      : decision.period.periodKey;
    if (isResultError(periodKey)) return periodKey;

    const previousRuns = await countRuns(periodKey);
    if (isResultError(previousRuns)) return previousRuns;

    const runNo = previousRuns + 1;
    const runKey = runKeyOf(periodKey, runNo);

    claimed = await claimRun(runKey);
    if (!claimed) return ok(alreadyRunning({ ...base, periodKey, runNo }, runKey));

    // --- 4. Mở kỳ (nếu mới) -------------------------------------------------
    let periodId: string;
    if (isNewPeriod) {
      const opened = await openPeriod({ chain, periodKey });
      if (!opened.ok) {
        await closeRun(claimed, true, opened.error);
        return opened;
      }
      periodId = opened.data.id;
    } else {
      // Quỹ đủ cho phần còn phải chia đã được bảo đảm ở bước 2: dự trữ của kỳ không nhỏ hơn
      // tổng hồ sơ chưa trả, và quỹ không hụt so với tổng dự trữ.
      periodId = decision.period.id;
    }

    // --- 5. Chia theo lô, giới hạn số lô do BE-06 đọc từ tham số hệ thống ---
    const distributed = await distributePeriod({ chain, periodId });
    if (!distributed.ok) {
      await closeRun(claimed, true, distributed.error);
      return distributed;
    }
    const run = distributed.data;

    // --- 6. Mốc số dư (hiển thị): CHỈ khi kỳ đã chia xong toàn bộ -----------
    const ended = run.period.status === 'EXPIRED' || run.period.status === 'CLOSED';
    const completed = run.outstanding === 0;
    const nextSettled =
      completed && !ended ? await settleBalanceMark(run, role) : settledBalance;

    // --- 7. Cảnh báo kỳ treo ------------------------------------------------
    const stuckAfterRuns = await readDistributionStuckAfterRuns();
    const stuck = !completed && runNo >= stuckAfterRuns;

    const message = ended
      ? `Kỳ "${periodKey}" đã ${run.period.status === 'CLOSED' ? 'đóng' : 'hết hạn nhận'} trên ` +
        `chuỗi ở vòng ${runNo}: ${run.expired} hồ sơ chưa nhận chuyển EXPIRED, ${run.reconciled} ` +
        `đối soát từ chuỗi, không gửi lô. Vòng sau được mở kỳ mới.`
      : completed
        ? `Kỳ "${periodKey}" hoàn tất ở vòng ${runNo}: ${run.batches} lô, ${run.paid} hồ sơ đã ` +
          `chi, ${run.failed} thất bại; mốc số dư chuyển từ ${settledBalance} sang ${nextSettled}.`
        : `Kỳ "${periodKey}" chia dở ở vòng ${runNo}: ${run.batches}/${run.maxBatches} lô, ` +
          `${run.paid} hồ sơ đã chi, ${run.failed} thất bại, còn ${run.outstanding} phải chi. ` +
          `Lượt sau chia tiếp đúng kỳ này.`;

    const stuckNote = stuck
      ? ` CẢNH BÁO: kỳ này đã qua ${runNo} vòng (ngưỡng ${stuckAfterRuns}) mà chưa chia xong. ` +
        `Hoặc lô đang lỗi lặp lại, hoặc số ví lớn hơn mức ` +
        `distribution.max_batches_per_run × distribution.batch_size dự tính. Cần người xem.`
      : '';

    await closeRun(claimed, stuck, stuck ? message + stuckNote : null);
    await auditCycle(
      txnStore,
      role,
      chain,
      runKey,
      stuck ? 'FAILURE' : 'SUCCESS',
      `vòng chạy tự động: ${message}${stuckNote}`,
    );

    return ok({
      ...base,
      outcome: ended ? 'PERIOD_ENDED' : completed ? 'DISTRIBUTED' : 'PARTIAL',
      nextSettledBalance: nextSettled.toString(),
      runId: claimed.id,
      runNo,
      periodId,
      periodKey,
      periodOpened: isNewPeriod,
      batches: run.batches,
      paid: run.paid,
      failed: run.failed,
      outstanding: run.outstanding,
      stuck,
      message: message + stuckNote,
    });
  } catch (error) {
    // Đóng dòng `KeeperRun` cho lỗi KHÔNG lường trước, nếu vòng này đã chiếm được chỗ. Bỏ qua
    // việc này sẽ để lại một dòng `RUNNING` vĩnh viễn, và nó chặn mọi lượt sau của cùng kỳ và
    // cùng số vòng — tiến trình tự khoá chính nó vì một lỗi nhất thời.
    const reason = error instanceof Error ? error.message : 'Lỗi không xác định.';
    await closeRun(claimed, true, reason).catch(() => undefined);
    return toResult(error);
  }
}

/** Chiếm chỗ chạy; `null` nghĩa là một vòng khác đã giữ đúng khoá này. */
async function claimRun(runKey: string): Promise<KeeperRunRecord | null> {
  try {
    return await getKeeperStore().startRun({
      jobName: DISTRIBUTION_JOB_NAME,
      periodKey: runKey,
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
 * Quyền là `reconcile:read` — dữ liệu toàn hệ, nên ba vai phía ngân hàng đọc được, còn nhà đầu
 * tư thì không.
 *
 * @pending FE-08 | đã sẵn đầu cuối: kiểm quyền `reconcile:read`, đọc bảng `KeeperRun` của công việc chia tự động, tách khoá ghép thành `periodKey` + `runNo` nên màn hình không phải tự bóc chuỗi. FE-08 chỉ cần gọi rồi dựng bảng lịch chạy; `status` `FAILED` kèm `error` khác null là dòng cần người xem, và nhiều dòng cùng `periodKey` với `runNo` tăng dần là một kỳ đang chia nhiều vòng
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
    });

    return ok(
      runs.map((run) => ({
        id: run.id,
        ...parseRunKey(run.periodKey),
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        error: run.error,
      })),
    );
  } catch (error) {
    return toResult(error);
  }
}
