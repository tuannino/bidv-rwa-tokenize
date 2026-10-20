/**
 * Báo giá một lần rút của Người bán, hàm THUẦN dùng được ở cả máy chủ và màn hình.
 *
 * BE-13 QĐ-H gỡ hạn mức và phí kiểu FE-21: phần được rút là `withdrawable` của vault trên chuỗi
 * (hợp đồng tính), PoC không thu phí nên số nhận bằng số rút. Phí ngân hàng ngoài chuỗi chưa áp dụng.
 *
 * Mọi số tiền là CHUỖI thập phân ở biên: `bigint` không qua được biên máy chủ → trình duyệt.
 */

export interface WithdrawQuote {
  /** Số tiền nhận được; `null` khi số nhập không phải số nguyên dương. */
  receivedVnd: string | null;
  exceedsLimit: boolean;
}

/** Báo giá một lần rút: vượt phần được rút chưa, nhận về bao nhiêu (bằng số rút). */
export function quoteWithdraw(amountVnd: string, withdrawableVnd: string): WithdrawQuote {
  if (!/^\d+$/.test(amountVnd) || BigInt(amountVnd) === 0n) return { receivedVnd: null, exceedsLimit: false };
  const amount = BigInt(amountVnd);
  return { receivedVnd: amount.toString(), exceedsLimit: amount > BigInt(withdrawableVnd) };
}
