/**
 * Điều khoản phát hành WPT — THAM SỐ CẤU HÌNH, không phải số liệu thị trường.
 *
 * Vì sao đặt ở đây mà không phải `mock-data.ts`:
 *
 * `mock-data.ts` chứa số liệu *bịa để minh hoạ* (sản lượng, số nhà đầu tư...) và mọi thứ lấy
 * từ đó đều phải gắn nhãn "dữ liệu mẫu" trên giao diện. Giá phát hành thì khác: nó là một
 * điều khoản của đợt phát hành, giống con số trên term sheet — do ngân hàng ấn định, không
 * phải quan sát từ thị trường. Nhờ vậy `số dư thật × giá phát hành` là *thật × tham số*, không
 * phải *thật × số bịa*, nên không vi phạm quy tắc "không trộn số liệu thật với số liệu mẫu
 * trong cùng một con số".
 *
 * ⚠️ Đây KHÔNG phải giá thị trường. Hệ thống chưa có thị trường thứ cấp nên không có giá giao
 * dịch. Mọi chỗ hiển thị con số quy đổi PHẢI ghi rõ là "theo giá phát hành", tuyệt đối không
 * gọi là giá trị thị trường hay định giá.
 */

/** Giá phát hành một WPT, đơn vị VND. WPT có decimals = 0 nên đây là giá của trọn một token. */
export const WPT_ISSUE_PRICE_VND = 100_000;

/**
 * Quy đổi số lượng WPT sang VND theo giá phát hành.
 *
 * Nhận và trả **chuỗi**: số dư đọc từ chain là `bigint` (uint256), vượt `Number.MAX_SAFE_INTEGER`
 * là mất chính xác, mà `bigint` thì không qua được biên server -> client.
 */
export function wptToVnd(amount: string): string {
  return (BigInt(amount) * BigInt(WPT_ISSUE_PRICE_VND)).toString();
}
