import 'server-only';

import { CONFIG_KEYS, WPT_ISSUE_PRICE_VND, WPT_PRICE_CHANGE_THRESHOLD } from '@/lib/config/issue-terms';
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
