import 'server-only';

import { findContractAddress, type ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { readIssuePriceVnd } from '@/lib/store/config-values';

/**
 * MỘT NGUỒN GIÁ cho khách hàng (FE-07, đóng lệch L-02).
 *
 * Giá phát hành nằm ở hai nơi, và hai hàm đọc hai câu hỏi khác nhau:
 *
 * - `readIssuePriceVnd(chain)` (`lib/store/config-values.ts`): **giá đã cấu hình** trong
 *   database. Dùng ở màn cấu hình và khi kiểm ngưỡng đổi giá.
 * - `readEffectiveIssuePrice(chain)` (tệp này): **giá áp dụng cho lệnh**, tức giá mà lệnh sẽ được
 *   chốt. Chain có `OrderSettlement` thì đó là giá trên hợp đồng (`quotePurchase(1n)`), vì
 *   hợp đồng kiểm lại `vndb == wpt nhân price` lúc thực thi; chain khác thì là giá đã cấu hình.
 *   Mọi màn khách hàng hiện "giá phát hành" phải dùng hàm này.
 *
 * Đặt ở tầng nghiệp vụ, không đặt cạnh `readIssuePriceVnd`: hàm này gọi `getLedger`, mà
 * `lib/ledger/index.ts` đã nhập `readIssuePriceVnd` từ `lib/store`; đặt ở `lib/store` là vòng nhập
 * và là tầng lưu trữ phụ thuộc tầng chuỗi.
 */

/**
 * Chain này chốt lệnh theo giá trên hợp đồng `OrderSettlement` không. Quy tắc DUY NHẤT chọn nguồn
 * giá: `getIssuePrice` (màn cấu hình) và `readEffectiveIssuePrice` (màn khách hàng) cùng gọi hàm
 * này, để hai nơi không bao giờ chọn nguồn khác nhau.
 */
export function settlesAtOnChainPrice(chain: ChainKey): boolean {
  return Boolean(findContractAddress(chain, 'OrderSettlement'));
}

/**
 * Giá một WPT áp dụng cho lệnh mới, đơn vị VNDB.
 *
 * `quoted`: người gọi đã đọc (hoặc đang đọc) `quotePurchase(1n)` thì truyền vào, kể cả dạng
 * `Promise`, để lời đọc chuỗi đi chung lô với các lời đọc khác và không đọc hai lần. Chain không
 * dùng giá trên hợp đồng thì bỏ qua `quoted` và đọc giá đã cấu hình.
 */
export async function readEffectiveIssuePrice(
  chain: ChainKey,
  quoted?: bigint | Promise<bigint>,
): Promise<bigint> {
  if (!settlesAtOnChainPrice(chain)) return readIssuePriceVnd(chain);
  return quoted ?? getLedger(chain).quotePurchase(1n);
}
