/**
 * ABI **TỐI GIẢN** của ProfitDistributor — ví chia lợi nhuận: giữ quỹ VNDB của
 * mỗi kỳ và chi trả theo tỉ lệ nắm giữ WPT tại một mã snapshot.
 *
 * Mô hình của contract: một "kỳ chia" (distribution) gắn với MỘT mã snapshot và
 * MỘT số tiền đã chốt. Vì vậy `distributeTo` nhận `distributionId`, KHÔNG nhận
 * `snapshotId`. Tầng nghiệp vụ phải tự giữ mapping snapshotId -> distributionId
 * (đọc từ event `DistributionCreated` hoặc từ cơ sở dữ liệu).
 *
 * Contract KHÔNG có hàm liệt kê người nắm giữ — danh sách ví phải do nghiệp vụ
 * dựng từ cơ sở dữ liệu/Indexer rồi truyền vào `distributeTo`.
 */
export const profitDistributorAbi = [
  // --- Đọc ---
  /** Địa chỉ token chi trả (VNDB). Số dư quỹ = balanceOf(VNDB, địa chỉ contract này). */
  {
    type: 'function',
    name: 'payoutToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'distributionsCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  /** Kỳ chia: (snapshotId, amount, supplyAtSnapshot, claimed, createdAt, period). */
  {
    type: 'function',
    name: 'distributions',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'snapshotId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'supplyAtSnapshot', type: 'uint256' },
      { name: 'claimed', type: 'uint256' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'period', type: 'string' },
    ],
  },
  /** Phần theo quyền của một ví trong một kỳ, không tính đã nhận hay chưa. */
  {
    type: 'function',
    name: 'entitlementOf',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  /** Phần còn nhận được (0 nếu đã nhận) — dùng để hiển thị cho nhà đầu tư. */
  {
    type: 'function',
    name: 'previewClaim',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasClaimed',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },

  // --- Ghi (DISTRIBUTOR_ROLE) ---
  /**
   * Chốt snapshot + kéo `amount` VNDB vào quỹ kỳ này, trả về distributionId.
   * Ngân hàng phải `approve` VNDB cho contract này trước.
   */
  {
    type: 'function',
    name: 'createDistribution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'period', type: 'string' },
    ],
    outputs: [{ name: 'id', type: 'uint256' }],
  },
  /** Chia hộ cho MỘT lô ví. Kích thước lô do tầng nghiệp vụ quyết định. */
  {
    type: 'function',
    name: 'distributeTo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'accounts', type: 'address[]' },
    ],
    outputs: [],
  },

  // --- Events ---
  /** Nguồn sự thật của mapping distributionId <-> snapshotId. */
  {
    type: 'event',
    name: 'DistributionCreated',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'snapshotId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'supplyAtSnapshot', type: 'uint256', indexed: false },
      { name: 'period', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'account', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
