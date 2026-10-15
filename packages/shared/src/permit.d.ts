export type PermitAddress = `0x${string}`;

export interface PermitTypedDataInput {
  tokenName: string;
  chainId: number | bigint;
  verifyingContract: PermitAddress;
  owner: PermitAddress;
  spender: PermitAddress;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

export interface PermitTypedData {
  domain: {
    name: string;
    version: '1';
    chainId: number | bigint;
    verifyingContract: PermitAddress;
  };
  types: {
    Permit: readonly [
      { readonly name: 'owner'; readonly type: 'address' },
      { readonly name: 'spender'; readonly type: 'address' },
      { readonly name: 'value'; readonly type: 'uint256' },
      { readonly name: 'nonce'; readonly type: 'uint256' },
      { readonly name: 'deadline'; readonly type: 'uint256' },
    ];
  };
  primaryType: 'Permit';
  message: {
    owner: PermitAddress;
    spender: PermitAddress;
    value: bigint;
    nonce: bigint;
    deadline: bigint;
  };
}

export function buildPermitTypedData(input: PermitTypedDataInput): PermitTypedData;
