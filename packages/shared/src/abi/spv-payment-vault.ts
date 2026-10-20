export const spvPaymentVaultAbi = [
  ...[
    ['projectToken', 'address'], ['paymentToken', 'address'], ['MATCHER_ROLE', 'bytes32'],
    ['lockMode', 'uint8'],
    ['fixedLockAmount', 'uint256'], ['percentRateBps', 'uint256'],
    ['pendingPercentRateBps', 'uint256'], ['hasPendingRate', 'bool'],
    ['netProceeds', 'uint256'], ['lockedAmount', 'uint256'], ['withdrawable', 'uint256'],
    ['lastPeriodRef', 'uint256'], ['lastDistributedPrev', 'uint256'],
    ['percentLocked', 'uint256'], ['payoutWallet', 'address'], ['paused', 'bool'],
  ].map(([name, type]) => ({
    type: 'function' as const, name, stateMutability: 'view' as const, inputs: [],
    outputs: [{ name: '', type }],
  })),
  {
    type: 'function', name: 'isOrderSettled', stateMutability: 'view',
    inputs: [{ name: 'orderRef', type: 'bytes32' }], outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'setLockMode', stateMutability: 'nonpayable',
    inputs: [{ name: 'mode', type: 'uint8' }], outputs: [],
  },
  {
    type: 'function', name: 'setFixedLock', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'setPercentRate', stateMutability: 'nonpayable',
    inputs: [{ name: 'bps', type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'closePeriod', stateMutability: 'nonpayable',
    inputs: [
      { name: 'periodRef', type: 'uint256' },
      { name: 'distributedPrev', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'setPayoutWallet', stateMutability: 'nonpayable',
    inputs: [{ name: 'wallet', type: 'address' }], outputs: [],
  },
  {
    type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }], outputs: [],
  },
  { type: 'function', name: 'pauseWithdrawals', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'unpauseWithdrawals', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'event', name: 'OrderSettled', inputs: [
      { name: 'orderRef', type: 'bytes32', indexed: true },
      { name: 'investor', type: 'address', indexed: true },
      { name: 'side', type: 'uint8', indexed: false },
      { name: 'wptAmount', type: 'uint256', indexed: false },
      { name: 'vndbAmount', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'PeriodClosed', inputs: [
      { name: 'periodRef', type: 'uint256', indexed: true },
      { name: 'distributedPrev', type: 'uint256', indexed: false },
      { name: 'rateBps', type: 'uint256', indexed: false },
      { name: 'percentLocked', type: 'uint256', indexed: false },
      { name: 'operator', type: 'address', indexed: true },
    ],
  },
  // BE-13 QĐ-C1: bốn sự kiện cấu hình là nguồn sự thật của lịch sử cấu hình.
  { type: 'event', name: 'LockModeChanged', inputs: [{ name: 'mode', type: 'uint8', indexed: false }] },
  { type: 'event', name: 'FixedLockSet', inputs: [{ name: 'amount', type: 'uint256', indexed: false }] },
  {
    type: 'event', name: 'PercentRateSet', inputs: [
      { name: 'bps', type: 'uint256', indexed: false },
      { name: 'pending', type: 'bool', indexed: false },
    ],
  },
  { type: 'event', name: 'PayoutWalletSet', inputs: [{ name: 'wallet', type: 'address', indexed: false }] },
  {
    type: 'event', name: 'Withdrawn', inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'operator', type: 'address', indexed: true },
    ],
  },
  ...[
    ['ZeroAddress', []], ['ZeroAmount', []], ['ZeroPrice', []], ['ZeroOrderRef', []],
    ['InvalidLockMode', []], ['PayoutWalletNotSet', []], ['EnforcedPause', []],
    ['OrderAlreadySettled', [{ name: 'orderRef', type: 'bytes32' }]],
    ['AmountPriceMismatch', [
      { name: 'wpt', type: 'uint256' }, { name: 'vndb', type: 'uint256' },
      { name: 'price', type: 'uint256' },
    ]],
    ['RateTooHigh', [{ name: 'bps', type: 'uint256' }]],
    ['InvalidPeriodRef', [
      { name: 'expected', type: 'uint256' }, { name: 'got', type: 'uint256' },
    ]],
    ['PayoutWalletNotVerified', [{ name: 'wallet', type: 'address' }]],
    ['ExceedsWithdrawable', [
      { name: 'requested', type: 'uint256' }, { name: 'available', type: 'uint256' },
    ]],
  ].map(([name, inputs]) => ({ type: 'error' as const, name, inputs })),
] as const;
