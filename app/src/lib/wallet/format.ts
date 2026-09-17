/**
 * Định dạng hiển thị cho phần ví — LOGIC THUẦN, không React, không viem.
 *
 * Vì sao tự viết `formatNativeAmount` thay vì dùng `formatUnits` của viem: thành phần giao
 * diện KHÔNG được nhập viem (LUẬT #1, và `scripts/verify-arch-rules.sh` kiểm điều này), còn
 * `useBalance().data.formatted` của wagmi đã bị đánh dấu `@deprecated` nên không nên bám vào.
 * Hàm ở đây chỉ chia chuỗi số, không cần thư viện.
 */

/**
 * Địa chỉ dạng rút gọn `0x1234…cdef`.
 *
 * Giữ 6 ký tự đầu (gồm `0x`) và 4 ký tự cuối — đủ để đối chiếu bằng mắt với màn hình ví.
 * Địa chỉ ngắn bất thường thì trả nguyên văn: rút gọn tiếp sẽ ra chuỗi vô nghĩa.
 */
export function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Số dư dạng người đọc, từ số nguyên nhỏ nhất của đơn vị (wei) và số chữ số thập phân.
 *
 * Cắt phần thập phân ở `maxFractionDigits`, KHÔNG làm tròn lên: làm tròn số dư lên là nói
 * người dùng có nhiều tiền hơn thực tế. Phần nguyên chấm phân cách theo `vi-VN`.
 */
export function formatNativeAmount(
  value: bigint,
  decimals: number,
  maxFractionDigits = 4,
): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fractionRaw = (abs % base).toString().padStart(decimals, '0');

  const fraction = fractionRaw.slice(0, maxFractionDigits).replace(/0+$/, '');
  const wholeText = whole.toLocaleString('vi-VN');

  return `${negative ? '-' : ''}${wholeText}${fraction ? `,${fraction}` : ''}`;
}
