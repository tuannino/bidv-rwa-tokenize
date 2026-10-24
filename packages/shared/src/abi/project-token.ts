/**
 * ABI tối giản của ProjectToken sau SC-09.
 * Chỉ giữ bề mặt app dùng trực tiếp, ERC-3643 core cần chẩn đoán và ERC-2612 permit.
 * ABI đầy đủ sinh vào packages/shared/generated để kiểm tra chữ ký, không ship lên web.
 */
export const projectTokenAbi = [
  // --- ERC-3643: registry, compliance, freeze, pause ---
  {
    type: 'function',
    name: 'identityRegistry',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'compliance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isFrozen',
    stateMutability: 'view',
    inputs: [{ name: 'userAddress', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getFrozenTokens',
    stateMutability: 'view',
    inputs: [{ name: 'userAddress', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'paused',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  { type: 'function', name: 'pause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'unpause', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'setAddressFrozen',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'userAddress', type: 'address' },
      { name: 'freeze', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'freezePartialTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'userAddress', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unfreezePartialTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'userAddress', type: 'address' },
      { name: 'amount', type: 'uint256' },
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
    outputs: [{ name: '', type: 'bool' }],
  },

  // --- ERC-20 / SC-02 ---
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
  {
    type: 'function',
    name: 'initialSupplyMinted',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'spvWallet',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
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
  {
    type: 'function',
    name: 'mintInitialSupply',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spv', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
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
    name: 'burn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'userAddress', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },

  // --- Snapshot ---
  {
    type: 'function',
    name: 'balanceOfAt',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'snapshotId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupplyAt',
    stateMutability: 'view',
    inputs: [{ name: 'snapshotId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCurrentSnapshotId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'snapshot',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // --- Phân quyền ---
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

  // --- ERC-2612 ---
  {
    type: 'function',
    name: 'permit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    // ERC-5267 (FE-05 QĐ-B): domain EIP-712 THẬT của token cho chữ ký permit. Không dùng
    // `version()` của ProjectToken: đó là phiên bản nghiệp vụ, không phải version EIP-712.
    type: 'function',
    name: 'eip712Domain',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'fields', type: 'bytes1' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'extensions', type: 'uint256[]' },
    ],
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },

  // --- Events ---
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
    name: 'AddressFrozen',
    inputs: [
      { name: 'userAddress', type: 'address', indexed: true },
      { name: 'isFrozen', type: 'bool', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'InitialSupplyMinted',
    inputs: [
      { name: 'spvWallet', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'operator', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Snapshot',
    inputs: [{ name: 'id', type: 'uint256', indexed: false }],
  },

  // --- Custom errors cần dịch ở adapter ---
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'neededRole', type: 'bytes32' },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientBalance',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'balance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'ERC20InsufficientAllowance',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'allowance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'ERC20InvalidReceiver', inputs: [{ name: 'receiver', type: 'address' }] },
  { type: 'error', name: 'InitialSupplyAlreadyMinted', inputs: [] },
  { type: 'error', name: 'InitialSupplyNotMinted', inputs: [] },
  {
    type: 'error',
    name: 'MintTargetNotSpv',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'spv', type: 'address' },
    ],
  },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'TokenPaused', inputs: [] },
  { type: 'error', name: 'WalletFrozen', inputs: [{ name: 'wallet', type: 'address' }] },
  { type: 'error', name: 'IdentityRegistryNotSet', inputs: [] },
  { type: 'error', name: 'ComplianceNotSet', inputs: [] },
  { type: 'error', name: 'IdentityNotVerified', inputs: [{ name: 'wallet', type: 'address' }] },
  {
    type: 'error',
    name: 'ComplianceRejected',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientUnfrozenTokens',
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'available', type: 'uint256' },
      { name: 'requested', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'ERC2612ExpiredSignature', inputs: [{ name: 'deadline', type: 'uint256' }] },
  {
    type: 'error',
    name: 'ERC2612InvalidSigner',
    inputs: [
      { name: 'signer', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
  },
  // SC-10: trần tổng cung cố định lúc triển khai.
  {
    "inputs": [],
    "name": "InvalidSupplyCap",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "cap",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "currentSupply",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "SupplyCapExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "cap",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
] as const;
