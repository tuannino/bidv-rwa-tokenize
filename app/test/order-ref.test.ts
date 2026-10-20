import { describe, expect, it } from 'vitest';
import { orderIdFromOrderRef, orderRefFromOrderId } from '@bidv/shared';

describe('SC-03 orderRef UUID hai chiều', () => {
  const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
  const ref = '0x3f2504e04f8911d39a0c0305e82c330100000000000000000000000000000000';

  it('đặt đúng 16 byte UUID ở đầu bytes32 và đổi ngược về chữ thường', () => {
    expect(orderRefFromOrderId(uuid)).toBe(ref);
    expect(orderIdFromOrderRef(ref)).toBe(uuid);
  });

  it('UUID chữ hoa cho cùng kết quả', () => {
    expect(orderRefFromOrderId(uuid.toUpperCase())).toBe(ref);
  });

  it('từ chối chuỗi không phải UUID và orderRef có nửa sau khác 0', () => {
    expect(() => orderRefFromOrderId('not-a-uuid')).toThrow(/UUID/);
    expect(() => orderIdFromOrderRef(`${ref.slice(0, -1)}1`)).toThrow(/16 byte cuối/);
  });
});
