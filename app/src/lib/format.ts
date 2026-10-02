/**
 * Định dạng hiển thị dùng chung — LOGIC THUẦN, chạy được cả ở máy chủ lẫn trình duyệt.
 *
 * FE-22 yêu cầu 19: số lượng có phân cách hàng nghìn, mốc thời gian hiện đủ ngày và giờ.
 */

/**
 * Số nguyên dạng chuỗi (số token, `bigint` đã chuyển chuỗi) có phân cách hàng nghìn theo `vi-VN`.
 *
 * Nhận CHUỖI chứ không nhận `number`: số token vượt 2^53 thì `number` mất chính xác ngay, còn
 * `BigInt(...).toLocaleString` thì không. Chuỗi không phải số nguyên thì trả nguyên văn — hiện
 * sai còn tệ hơn hiện thô.
 */
export function formatAmount(value: string | bigint | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return String(value);
  }
}

/** Múi giờ hiển thị cố định: người dùng là cán bộ ngân hàng ở Việt Nam, máy chủ có thể chạy UTC. */
const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Mốc thời gian ISO -> `dd/mm/yyyy hh:mm:ss`, giờ Việt Nam.
 *
 * Ghim múi giờ thay vì để mặc định của máy: trang dựng ở máy chủ (UTC) rồi hydrate ở trình duyệt
 * (giờ Việt Nam) sẽ ra hai chuỗi khác nhau cho cùng một mốc.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: DISPLAY_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
