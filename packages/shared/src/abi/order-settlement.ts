const uint = { type: 'uint256' } as const;

export const orderSettlementAbi = [
  {
    type: 'function', name: 'price', stateMutability: 'view', inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'setPrice', stateMutability: 'nonpayable',
    inputs: [{ name: 'newPrice', type: 'uint256' }], outputs: [],
  },
  ...['buy', 'sell'].map((name) => ({
    type: 'function' as const, name, stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'orderRef', type: 'bytes32' },
      { name: 'investor', type: 'address' },
      { name: 'wptAmount', type: 'uint256' },
      { name: 'vndbAmount', type: 'uint256' },
    ],
    outputs: [],
  })),
  // FE-05 QĐ-G: khớp lệnh kèm chữ ký permit của nhà đầu tư, không cần approve trước.
  ...['buyWithPermit', 'sellWithPermit'].map((name) => ({
    type: 'function' as const, name, stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'orderRef', type: 'bytes32' },
      { name: 'investor', type: 'address' },
      { name: 'wptAmount', type: 'uint256' },
      { name: 'vndbAmount', type: 'uint256' },
      {
        name: 'permitData',
        type: 'tuple',
        components: [
          { name: 'value', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  })),
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'ZeroPrice', inputs: [] },
  { type: 'error', name: 'OrderAlreadySettled', inputs: [{ name: 'orderRef', type: 'bytes32' }] },
  { type: 'error', name: 'PriceMismatch', inputs: [{ name: 'expected', ...uint }, { name: 'given', ...uint }] },
  { type: 'error', name: 'PermitValueMismatch', inputs: [{ name: 'expected', ...uint }, { name: 'given', ...uint }] },
  { type: 'error', name: 'EnforcedPause', inputs: [] },
] as const;
