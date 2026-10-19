const UUID_PATTERN = /^([0-9a-f]{8})-([0-9a-f]{4})-([1-5][0-9a-f]{3})-([89ab][0-9a-f]{3})-([0-9a-f]{12})$/i;
const ORDER_REF_PATTERN = /^0x([0-9a-f]{32})(0{32})$/i;

/** Mã UUID 16 byte nằm ở nửa đầu bytes32; nửa sau bắt buộc bằng 0. */
export function orderRefFromOrderId(orderId: string): `0x${string}` {
  const match = UUID_PATTERN.exec(orderId);
  if (!match) throw new Error(`Mã lệnh không phải UUID hợp lệ: ${orderId}`);
  return `0x${match.slice(1).join('').toLowerCase()}${'0'.repeat(32)}`;
}

/** Đổi orderRef trên chuỗi về UUID chuẩn chữ thường để so khớp trực tiếp với database. */
export function orderIdFromOrderRef(orderRef: string): string {
  const match = ORDER_REF_PATTERN.exec(orderRef);
  if (!match) throw new Error('orderRef không hợp lệ hoặc 16 byte cuối khác 0.');
  const uuid = match[1].toLowerCase();
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}
