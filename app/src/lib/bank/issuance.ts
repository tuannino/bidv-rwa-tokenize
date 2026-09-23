import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';

/**
 * Quy đổi số dư WPT sang VND theo **giá phát hành**.
 *
 * ⚠️ Giá phát hành là THAM SỐ CẤU HÌNH, không phải giá thị trường — hệ thống chưa có thị trường
 * thứ cấp nên không có giá giao dịch. Mọi chỗ hiển thị con số ra từ đây PHẢI ghi rõ là "theo giá
 * phát hành", tuyệt đối không gọi là giá trị thị trường hay định giá. Lập luận đầy đủ về việc
 * con số này khác số liệu mẫu ở chỗ nào: `lib/config/issue-terms.ts`.
 *
 * Hằng số nằm ở `lib/config/issue-terms.ts` chứ không ở tệp này vì `lib/ledger/mock.adapter.ts`
 * cũng cần đúng con số đó, mà tầng cổng nhập từ tầng nghiệp vụ là ngược chiều phụ thuộc. Re-export
 * ở đây để người gọi cũ giữ nguyên đường nhập.
 *
 * ⚠️ Từ BE-04, `WPT_ISSUE_PRICE_VND` là GIÁ MẶC ĐỊNH KHI CHƯA CẤU HÌNH, không còn là giá đang có
 * hiệu lực. Giá đang có hiệu lực đọc bằng `readIssuePriceVnd()` (`lib/store/config-values.ts`)
 * hoặc `getIssuePrice()` (`lib/bank/config.service.ts`). Đừng dùng hằng số này để hiển thị.
 */
export { WPT_ISSUE_PRICE_VND };

/**
 * Quy đổi số lượng WPT sang VND theo giá phát hành ĐANG CÓ HIỆU LỰC.
 *
 * Nhận và trả **chuỗi**: số dư đọc từ chain là `bigint` (uint256), vượt `Number.MAX_SAFE_INTEGER`
 * là mất chính xác, mà `bigint` thì không qua được biên server -> client.
 *
 * ## Vì sao `issuePriceVnd` là THAM SỐ, không đọc bên trong hàm
 *
 * Từ BE-04 giá sống trong cơ sở dữ liệu, nên "đọc bên trong" buộc hàm này thành `async` và buộc
 * tệp này nhập tầng lưu trữ — tức là phải thêm `import 'server-only'`. `lib/config/issue-terms.ts`
 * đã ghi rõ vì sao KHÔNG được làm thế: chặn ở phía client sẽ chặn luôn `wptToVnd` và mọi màn hình
 * muốn tự quy đổi con số nó đã có trong tay.
 *
 * Nhận giá làm tham số giữ hàm này THUẦN và dùng được ở cả hai phía. Người gọi ở máy chủ lấy giá
 * bằng `readIssuePriceVnd()`; màn hình đã nhận `issuePriceVnd` trong `PortfolioView` thì truyền
 * lại chính con số đó — nên số hiển thị và số quy đổi không thể lệch nhau.
 */
export function wptToVnd(amount: string, issuePriceVnd: string | number | bigint): string {
  return (BigInt(amount) * BigInt(issuePriceVnd)).toString();
}
