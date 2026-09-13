import { getAddress, isAddress, type Hex } from 'viem';

/** Địa chỉ ví không hợp lệ (dùng chung cho mọi adapter EVM + validate form). */
export class InvalidAddressError extends Error {
  constructor(value: string, detail = 'Cần dạng 0x + 40 ký tự hex.') {
    super(`Địa chỉ ví không hợp lệ: "${value}". ${detail}`);
    this.name = 'InvalidAddressError';
  }
}

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Chuẩn hoá về checksum EVM, theo đúng ngữ nghĩa EIP-55:
 *
 *  - Toàn chữ thường hoặc toàn chữ HOA: KHÔNG mang thông tin checksum -> chấp nhận.
 *    (Đây là dạng người dùng hay copy từ log/explorer/tài liệu.)
 *  - Chữ hoa-thường lẫn lộn: CÓ mang checksum -> phải khớp, lệch nghĩa là gõ sai.
 *
 * `isAddress` của viem mặc định `strict: true` sẽ loại cả dạng toàn chữ HOA,
 * nên không dùng trực tiếp được ở chỗ nhận input người dùng.
 */
export function normalizeEvmAddress(value: string): Hex {
  const trimmed = value.trim();
  if (!HEX_ADDRESS.test(trimmed)) throw new InvalidAddressError(value);

  const body = trimmed.slice(2);
  const caseless = body === body.toLowerCase() || body === body.toUpperCase();
  if (caseless) return getAddress(trimmed.toLowerCase());

  if (!isAddress(trimmed, { strict: true })) {
    throw new InvalidAddressError(
      value,
      'Checksum EIP-55 không khớp — thường là gõ/copy sai một ký tự.',
    );
  }
  return getAddress(trimmed);
}

/** So sánh địa chỉ không phân biệt hoa/thường (dùng cho khoá map ở mock adapter). */
export function addressKey(value: string): string {
  return value.trim().toLowerCase();
}
