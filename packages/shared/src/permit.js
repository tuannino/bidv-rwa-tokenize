/**
 * Dựng EIP-712 typed data cho ERC-2612 permit. Hàm thuần dữ liệu để FE-05 có
 * thể đưa thẳng kết quả vào walletClient.signTypedData mà không kéo SDK chain
 * vào package dùng chung.
 */
export function buildPermitTypedData({
  tokenName,
  chainId,
  verifyingContract,
  owner,
  spender,
  value,
  nonce,
  deadline,
}) {
  return {
    domain: {
      name: tokenName,
      version: '1',
      chainId,
      verifyingContract,
    },
    types: {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    message: { owner, spender, value, nonce, deadline },
  };
}
