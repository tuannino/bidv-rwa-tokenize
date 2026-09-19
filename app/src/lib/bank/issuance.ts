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
 * ở đây để người gọi cũ (`portfolio.service.ts`) giữ nguyên đường nhập.
 */
export { WPT_ISSUE_PRICE_VND };

/**
 * Quy đổi số lượng WPT sang VND theo giá phát hành.
 *
 * Nhận và trả **chuỗi**: số dư đọc từ chain là `bigint` (uint256), vượt `Number.MAX_SAFE_INTEGER`
 * là mất chính xác, mà `bigint` thì không qua được biên server -> client.
 */
export function wptToVnd(amount: string): string {
  return (BigInt(amount) * BigInt(WPT_ISSUE_PRICE_VND)).toString();
}
