export const spvPaymentVaultAbi = [
  ...[
    ['projectToken', 'address'], ['paymentToken', 'address'], ['lockMode', 'uint8'],
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
    type: 'event', name: 'PeriodClosed', inputs: [
      { name: 'periodRef', type: 'uint256', indexed: true },
      { name: 'distributedPrev', type: 'uint256', indexed: false },
      { name: 'rateBps', type: 'uint256', indexed: false },
      { name: 'percentLocked', type: 'uint256', indexed: false },
      { name: 'operator', type: 'address', indexed: true },
    ],
  },
  ...[
    ['ZeroAddress', []], ['ZeroAmount', []], ['ZeroPrice', []], ['ZeroOrderRef', []],
    ['InvalidLockMode', []], ['PayoutWalletNotSet', []],
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
