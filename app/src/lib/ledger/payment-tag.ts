/**
 * FIX-09 QĐ-1: dữ liệu gọi có mang nhãn lệnh rút VNDB hay không.
 *
 * Ứng dụng nối nhãn 32 byte sau calldata `transfer` (FE-23 QĐ-12), nhưng ví có thể gói calldata đó vào
 * một lời gọi khác (ví dụ MetaMask chuyển ví sang EIP-7702 rồi gọi `DelegationManager.redeemDelegations`):
 * nhãn khi đó nằm giữa dữ liệu ABI lồng, sau nó còn byte đệm. Vì vậy chỉ đòi nhãn xuất hiện ĐÚNG RANH GIỚI
 * BYTE (vị trí chẵn trên chuỗi hex đã bỏ `0x`), không đòi ở cuối, không đòi ranh giới 32 byte. Các điều kiện
 * an toàn khác (người gửi, log `Transfer`) do nơi gọi kiểm.
 */
export function inputCarriesTag(input: string, tag: string): boolean {
  const data = input.toLowerCase().replace(/^0x/, '');
  const wanted = tag.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(wanted)) return false;
  for (let at = data.indexOf(wanted); at !== -1; at = data.indexOf(wanted, at + 1)) {
    if (at % 2 === 0) return true;
  }
  return false;
}
