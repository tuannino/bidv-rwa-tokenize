/**
 * Hạn mức rút của Người bán (FE-21) — hàm THUẦN, dùng được ở cả máy chủ và màn hình.
 *
 * Tham số chính sách đọc từ cấu hình (`readSellerWithdrawPolicy`), không có trong tệp này. Tệp
 * này chỉ nói: với số dư và chính sách cho trước, khoá bao nhiêu và rút được bao nhiêu.
 *
 * Mọi số tiền là CHUỖI thập phân ở biên: `bigint` không qua được biên máy chủ → trình duyệt.
 */

export type WithdrawPolicy =
  /** Khoá một số VNDB cố định. */
  | { mode: 'FIXED'; lockedVnd: string }
  /** Khoá một phần trăm số dư tại thời điểm rút. */
  | { mode: 'PERCENT'; lockedPercent: number };

export interface WithdrawLimit {
  lockedVnd: string;
  withdrawableVnd: string;
}

/** Phần khoá không bao giờ vượt số dư, phần rút được không bao giờ âm. */
export function computeWithdrawLimit(balanceVnd: string, policy: WithdrawPolicy): WithdrawLimit {
  const balance = BigInt(balanceVnd);
  const wanted =
    policy.mode === 'FIXED'
      ? BigInt(policy.lockedVnd)
      : // Làm tròn LÊN phần khoá: lệch một đồng thì lệch về phía giữ lại, không về phía rút ra.
        (balance * BigInt(policy.lockedPercent) + 99n) / 100n;
  const locked = wanted > balance ? balance : wanted;
  return { lockedVnd: locked.toString(), withdrawableVnd: (balance - locked).toString() };
}

export interface WithdrawQuote {
  /** Số tiền nhận được sau phí; `null` khi số nhập không hợp lệ hoặc không đủ trả phí. */
  receivedVnd: string | null;
  exceedsLimit: boolean;
}

/** Báo giá một lần rút: vượt hạn mức chưa, nhận về bao nhiêu sau phí. */
export function quoteWithdraw(amountVnd: string, withdrawableVnd: string, feeVnd: string): WithdrawQuote {
  if (!/^\d+$/.test(amountVnd)) return { receivedVnd: null, exceedsLimit: false };
  const amount = BigInt(amountVnd);
  const fee = BigInt(feeVnd);
  return {
    receivedVnd: amount > fee ? (amount - fee).toString() : null,
    exceedsLimit: amount > BigInt(withdrawableVnd),
  };
}
