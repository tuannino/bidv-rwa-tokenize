import 'server-only';

import {
  CONFIG_KEYS,
  DISTRIBUTION_BATCH_SIZE,
  DISTRIBUTION_BATCH_SIZE_MAX,
  WPT_ISSUE_PRICE_VND,
  WPT_PRICE_CHANGE_THRESHOLD,
} from '@/lib/config/issue-terms';
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
