/**
 * Dựng EIP-712 typed data cho ERC-2612 permit. Hàm thuần dữ liệu để FE-05 có
 * thể đưa thẳng kết quả vào walletClient.signTypedData mà không kéo SDK chain
 * vào package dùng chung.
 *
 * `version` BẮT BUỘC (FE-05 QĐ-B): phải là version EIP-712 đọc từ `eip712Domain()` của
 * token, không đoán. Viết cứng '1' thì chữ ký sai im lặng ngay khi một token dùng version
 * khác; `ProjectToken.version()` là phiên bản nghiệp vụ, không phải version EIP-712.
 */
export function buildPermitTypedData({
  tokenName,
  version,
  chainId,
  verifyingContract,
  owner,
  spender,
  value,
  nonce,
  deadline,
}) {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('buildPermitTypedData: thiếu version EIP-712 của token (đọc từ eip712Domain()).');
  }
  return {
    domain: {
      name: tokenName,
      version,
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
