/** ABI tối giản của bộ điều phối module tuân thủ ERC-3643 PoC. */
export const modularComplianceAbi = [
  {
    type: 'function',
    name: 'canTransfer',
    stateMutability: 'view',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getModules',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;
