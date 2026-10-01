import 'server-only';

import {
  CONFIG_KEYS,
  DISTRIBUTION_BATCH_SIZE,
  DISTRIBUTION_BATCH_SIZE_MAX,
  DISTRIBUTION_MAX_BATCHES_PER_RUN,
  DISTRIBUTION_MAX_BATCHES_PER_RUN_MAX,
  DISTRIBUTION_MIN_NEW_BALANCE,
  DISTRIBUTION_STUCK_AFTER_RUNS,
  WPT_ISSUE_PRICE_VND,
  WPT_PRICE_CHANGE_THRESHOLD,
} from '@/lib/config/issue-terms';
import type { WithdrawPolicy } from '@/lib/bank/withdraw-limit';
import { getConfigStore } from './index';

/**
 * ĐỌC tham số hệ thống đã cấu hình, lùi về mặc định trong mã khi bảng còn trống.
 *
 * Vì sao ở tầng lưu trữ chứ không ở `lib/bank/config.service.ts`: có HAI người đọc ở hai tầng
 * khác nhau — tầng nghiệp vụ (`config.service`, `portfolio.service`) và FACTORY `getLedger` ở
 * tầng cổng. Để hàm này ở `lib/bank` thì `lib/ledger/index.ts` phải nhập từ tầng nghiệp vụ, tức
 * ngược chiều phụ thuộc; cùng đúng lập luận đã ghi ở `lib/config/issue-terms.ts` cho việc đặt
 * hằng số giá vào `lib/config`.
 *
 * Viết hai bản "đọc bảng, trống thì lấy mặc định" ở hai tầng cũng không được: hai bản sẽ lệch
 * nhau ở nhánh lùi về mặc định — nhánh ít được chạy nhất, nên lệch ở đó là lệch âm thầm lâu nhất.
 *
 * ⚠️ KHÔNG đệm kết quả. Đổi giá phải có hiệu lực ngay ở yêu cầu tiếp theo; một lớp đệm ở đây là
 * cách chắc chắn nhất để màn hình nhà đầu tư hiện giá cũ sau khi ngân hàng vừa đổi giá.
 */

/** Giá phát hành một WPT đang có hiệu lực, đơn vị VNDB. */
export async function readIssuePriceVnd(): Promise<bigint> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.issuePriceVnd);
  // Không có dòng nào -> mặc định trong mã. `BigInt(row.value)` chứ không `Number`: giá là
  // uint256, qua `number` là mất chính xác từ 2^53.
  return row ? BigInt(row.value) : BigInt(WPT_ISSUE_PRICE_VND);
}

/** Hệ số chặn đổi giá quá mạnh đang có hiệu lực. */
export async function readPriceChangeThreshold(): Promise<number> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.priceChangeThreshold);
  if (!row) return WPT_PRICE_CHANGE_THRESHOLD;

  const parsed = Number(row.value);
  // Giá trị lạ trong bảng -> lùi về mặc định thay vì ném lỗi. Ngưỡng là lớp BẢO VỆ; một dòng
  // dữ liệu hỏng không được làm sập cả chức năng đổi giá, nhưng cũng không được làm mất lớp bảo
  // vệ (`NaN` trong phép so sánh luôn cho `false`, tức là ngưỡng biến mất mà không ai thấy).
  return Number.isFinite(parsed) && parsed > 1 ? parsed : WPT_PRICE_CHANGE_THRESHOLD;
}

/**
 * Số ví tối đa trong một lô chia lợi nhuận (BE-06).
 *
 * Giá trị lạ trong bảng -> lùi về mặc định, KHÔNG ném lỗi: cùng lập luận với
 * `readPriceChangeThreshold`. Nhưng ở đây nhánh lùi về còn quan trọng hơn, vì một giá trị hỏng mà
 * đi được tới `distributeBatch` sẽ cho ra hai kiểu hỏng tệ hơn hẳn: `0` hay `NaN` làm vòng chia lô
 * không sinh ra lô nào, nên hàm chạy xong, báo thành công, và KHÔNG ai được chia đồng nào; còn một
 * số quá lớn thì lô vượt giới hạn gas và thất bại SAU khi đã tốn phí.
 */
export async function readDistributionBatchSize(): Promise<number> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.distributionBatchSize);
  if (!row) return DISTRIBUTION_BATCH_SIZE;

  const parsed = Number(row.value);
  const usable =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= DISTRIBUTION_BATCH_SIZE_MAX;
  return usable ? parsed : DISTRIBUTION_BATCH_SIZE;
}

/**
 * Ví nhận phần dư do làm tròn khi chia lợi nhuận. `null` = chưa cấu hình, phần dư giữ lại trong
 * ví chia lợi nhuận.
 *
 * KHÔNG có mặc định trong mã, và đó là chủ đích: mọi địa chỉ ví đặt sẵn ở đây đều là một ví thật
 * của ai đó, nên một mặc định là lệnh chuyển tiền tới một ví mà không ai chọn. Chưa cấu hình thì
 * tiền nằm yên trong ví lợi nhuận — trạng thái duy nhất không cần ai quyết.
 *
 * Trả về nguyên văn chuỗi trong bảng, KHÔNG chuẩn hoá: chuẩn hoá địa chỉ là việc của biên
 * `lib/ledger/address.ts`, và làm ở đây sẽ hỏng với địa chỉ Stellar (base32 CHỮ HOA).
 */
export async function readDistributionDustWallet(): Promise<string | null> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.distributionDustWallet);
  const value = row?.value.trim();
  return value ? value : null;
}

// =============================================================================
//  BE-07 — THAM SỐ CỦA TIẾN TRÌNH TỰ ĐỘNG CHIA
// =============================================================================

/**
 * Đọc một số nguyên trong khoảng cho phép, lùi về mặc định khi thiếu dòng hoặc giá trị lạ.
 *
 * Gom lại thành MỘT hàm vì ba tham số dưới đây có cùng một quy tắc đọc, và nhánh lùi về mặc
 * định là nhánh ít được chạy nhất — ba bản sao của nó sẽ lệch nhau mà không test nào đi qua.
 *
 * KHÔNG `export`: chỉ ba hàm trong tệp này dùng tới. Chỗ gọi cần giá trị thì gọi hàm có tên
 * nói rõ tham số nào, không tự truyền khoá vào một hàm chung.
 */
async function readBoundedInt(
  key: string,
  fallback: number,
  min: number,
  max: number,
): Promise<number> {
  const row = await getConfigStore().getConfig(key);
  if (!row) return fallback;

  const parsed = Number(row.value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

/** Số lô tối đa một lượt chia được gửi (BE-07). */
export async function readDistributionMaxBatchesPerRun(): Promise<number> {
  return readBoundedInt(
    CONFIG_KEYS.distributionMaxBatchesPerRun,
    DISTRIBUTION_MAX_BATCHES_PER_RUN,
    1,
    DISTRIBUTION_MAX_BATCHES_PER_RUN_MAX,
  );
}

/** Số vòng chạy tối đa cho một kỳ trước khi coi là treo (BE-07). */
export async function readDistributionStuckAfterRuns(): Promise<number> {
  // Chặn trên bằng số lô tối đa mỗi lượt là con số không liên quan, nên dùng một chặn riêng:
  // 1.000 vòng cho một kỳ đã là vô lý, đủ để bắt lỗi gõ sai mà không chặn cấu hình hợp lý.
  return readBoundedInt(CONFIG_KEYS.distributionStuckAfterRuns, DISTRIBUTION_STUCK_AFTER_RUNS, 1, 1_000);
}

/**
 * Mức tăng số dư tối thiểu mới coi là tiền mới (BE-07), đơn vị VNDB.
 *
 * `BigInt` chứ không `Number`: số dư ví lợi nhuận là uint256, và một ngưỡng qua `number` sẽ
 * mất chính xác từ 2^53 rồi so sánh sai ngay ở chỗ quyết định có mở kỳ hay không.
 *
 * Giá trị lạ (không phải số nguyên không dấu) -> lùi về mặc định thay vì ném: ngưỡng là lớp
 * BẢO VỆ, một dòng dữ liệu hỏng không được làm tiến trình định kỳ dừng hẳn. Nhưng cũng không
 * được làm mất lớp bảo vệ, nên không lùi về 0.
 */
export async function readDistributionMinNewBalance(): Promise<bigint> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.distributionMinNewBalance);
  const value = row?.value.trim();
  if (!value || !/^\d+$/.test(value)) return BigInt(DISTRIBUTION_MIN_NEW_BALANCE);

  const parsed = BigInt(value);
  return parsed > 0n ? parsed : BigInt(DISTRIBUTION_MIN_NEW_BALANCE);
}

/**
 * Mốc số dư ví lợi nhuận đã xử lý xong (BE-07). Chưa có dòng nào -> `0n`.
 *
 * Mặc định 0 là giá trị duy nhất đúng, và khác hẳn ba tham số trên: đây KHÔNG phải tham số
 * vận hành mà là TRẠNG THÁI do tiến trình tự ghi. Mặc định khác 0 nghĩa là khẳng định một số
 * tiền nào đó đã được chia trước khi hệ thống chạy lần đầu, và hệ quả là số tiền đó không
 * bao giờ tới tay nhà đầu tư.
 */
export async function readDistributionSettledBalance(): Promise<bigint> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.distributionLastSettledBalance);
  const value = row?.value.trim();
  // Giá trị lạ -> 0, KHÔNG phải "giữ nguyên số dư hiện tại": 0 làm tiến trình coi toàn bộ số
  // dư là tiền mới, tức là chia thừa một lần (contract chặn bằng cờ đã-nhận của ảnh chụp).
  // Lùi về một mốc cao hơn thực tế thì tiền nằm lại trong ví vĩnh viễn và không ai biết.
  return value && /^\d+$/.test(value) ? BigInt(value) : 0n;
}

// =============================================================================
//  FE-21 — HẠN MỨC RÚT CỦA NGƯỜI BÁN
// =============================================================================

const UINT = /^\d+$/;

/**
 * Chính sách khoá số dư khi Người bán rút. `null` = chưa cấu hình hoặc giá trị hỏng.
 *
 * KHÁC các tham số phía trên: KHÔNG lùi về mặc định trong mã. Hạn mức là con số quyết định bao
 * nhiêu tiền rời ví, nên một mặc định ở đây là một hạn mức không ai chọn. Thiếu hay hỏng thì
 * màn rút báo "chưa cấu hình" và khoá nút — trạng thái duy nhất không cần ai quyết.
 */
export async function readSellerWithdrawPolicy(): Promise<WithdrawPolicy | null> {
  const store = getConfigStore();
  const [mode, value] = await Promise.all([
    store.getConfig(CONFIG_KEYS.sellerWithdrawLimitMode),
    store.getConfig(CONFIG_KEYS.sellerWithdrawLimitValue),
  ]);
  const raw = value?.value.trim();
  if (!raw || !UINT.test(raw)) return null;

  const amount = BigInt(raw);
  if (mode?.value.trim() === 'FIXED') return { mode: 'FIXED', lockedVnd: amount.toString() };
  if (mode?.value.trim() === 'PERCENT' && amount <= 100n) {
    return { mode: 'PERCENT', lockedPercent: Number(amount) };
  }
  return null;
}

/** Phí một lần rút, VNDB. `null` = chưa cấu hình — cùng lập luận, không có mặc định. */
export async function readSellerWithdrawFee(): Promise<bigint | null> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.sellerWithdrawFeeVnd);
  const value = row?.value.trim();
  return value && UINT.test(value) ? BigInt(value) : null;
}
