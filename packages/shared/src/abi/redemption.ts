/**
 * ABI **TỐI GIẢN** của Redemption — hoàn vốn/tất toán: nhà đầu tư đưa WPT vào,
 * contract đốt WPT và trả VNDB theo `rate`.
 *
 * CHÚ Ý về ngữ nghĩa (BE-01 R6): contract này có `rate` (VNDB trên 1 WPT) và
 * `paused`, gần với "giá NAV" và "giai đoạn tất toán" mà `ILedgerPort` yêu cầu,
 * nhưng KHÔNG trùng khít:
 *
 *  - `Redemption.paused = true` tắt việc hoàn vốn, tức NGƯỢC hướng với "bật giai
 *    đoạn tất toán". Còn thứ chặn chuyển nhượng mà vẫn cho đốt là
 *    `ProjectToken.paused` (vì `agentBurn` bỏ qua kiểm tra tuân thủ).
 *  - Chưa có contract nào phơi ra một cờ "đang tất toán" riêng.
 *
 * Vì vậy `setSettlementMode`/`navRate` CHƯA được nối vào contract nào ở
 * `evm.adapter`. Xem câu hỏi mở trong `docs/CHECKPOINT_BE01.md`.
 */
export const redemptionAbi = [
  // --- Đọc ---
  /** Số VNDB trả cho mỗi 1 WPT. */
  {
    type: 'function',
    name: 'rate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  /** Số VNDB nhận được cho `wptAmount` — chỉ nhân với `rate`, không có tỷ giá. */
  {
    type: 'function',
    name: 'quote',
    stateMutability: 'view',
    inputs: [{ name: 'wptAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  /** Địa chỉ token chi trả (VNDB) — để đọc thanh khoản của contract. */
  {
    type: 'function',
    name: 'payoutToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },

  // --- Ghi (MANAGER_ROLE) ---
  {
    type: 'function',
    name: 'setRate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newRate', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setPaused',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'status', type: 'bool' }],
    outputs: [],
  },
  /** Ngân hàng nạp thanh khoản VNDB (phải approve trước). */
  {
    type: 'function',
    name: 'fund',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },

  // --- Ghi (nhà đầu tư) ---
  /** Đổi WPT lấy VNDB. Cần approve WPT cho contract này trước. */
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wptAmount', type: 'uint256' }],
    outputs: [{ name: 'vndAmount', type: 'uint256' }],
  },

  // --- Events ---
  {
    type: 'event',
    name: 'Redeemed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'wptAmount', type: 'uint256', indexed: false },
      { name: 'vndAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RateUpdated',
    inputs: [{ name: 'newRate', type: 'uint256', indexed: false }],
  },
] as const;
