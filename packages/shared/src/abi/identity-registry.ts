/** ABI tối giản của sổ danh tính ERC-3643 PoC. */
export const identityRegistryAbi = [
  {
    type: 'function',
    name: 'isVerified',
    stateMutability: 'view',
    inputs: [{ name: 'userAddress', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'investorCountry',
    stateMutability: 'view',
    inputs: [{ name: 'userAddress', type: 'address' }],
    outputs: [{ name: '', type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'registerIdentity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'userAddress', type: 'address' },
      { name: 'country', type: 'uint16' },
    ],
    outputs: [],
  },
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'neededRole', type: 'bytes32' },
    ],
  },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
] as const;
