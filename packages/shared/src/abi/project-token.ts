/**
 * ABI **TỐI GIẢN** của ProjectToken (WPT) — chỉ những hàm/event mà `ILedgerPort` cần.
 *
 * Vì sao không import artifact Hardhat: artifact chứa bytecode + AST (hàng trăm KB/contract),
 * bundle vào worker edge là phình vô ích (xem docs/DEPLOYMENT.md).
 * `packages/contracts-evm/scripts/deploy.js` kiểm tra chéo file này với artifact thật khi deploy,
 * nên chữ ký lệch sẽ fail sớm chứ không âm thầm sai lúc runtime.
 */
export const projectTokenAbi = [
  // --- Đọc: tuân thủ ---
  {
    type: 'function',
    name: 'isWhitelisted',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isFrozen',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },

  // --- Đọc: token ---
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },

  // --- Đọc: phân quyền on-chain (để chẩn đoán "signer thiếu role") ---
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'MINTER_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'AGENT_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },

  // --- Ghi: tuân thủ (AGENT_ROLE) ---
  {
    type: 'function',
    name: 'setWhitelisted',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setFrozen',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'status', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'forcedTransfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },

  // --- Ghi: phát hành / thu hồi ---
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'agentBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },

  // --- Events (dùng cho lịch sử / đối soát) ---
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WhitelistUpdated',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'status', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FrozenUpdated',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'status', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ForcedTransfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
