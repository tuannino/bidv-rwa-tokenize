import { afterEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { resetServerEnvCache, serverEnv } from '@/lib/config/env';

/**
 * Khóa ký phải nhận được cả hai dạng: có và không có tiền tố `0x`.
 *
 * Vì sao đáng test: MetaMask xuất khóa dạng 64 hex TRƠN (không 0x), hardhat cũng chấp nhận
 * dạng đó — nên đây là dạng người dùng thực tế sẽ dán vào .env. viem thì bắt buộc có 0x và
 * chỉ báo "invalid private key ... got string", rất khó truy khi đang giữa lúc mint.
 */
const HEX64 = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const EXPECTED = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

afterEach(() => {
  delete process.env.SERVER_SIGNER_PRIVATE_KEY;
  resetServerEnvCache();
});

describe('SERVER_SIGNER_PRIVATE_KEY', () => {
  it('nhận dạng có tiền tố 0x', () => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = `0x${HEX64}`;
    resetServerEnvCache();
    expect(serverEnv().serverSignerPrivateKey).toBe(`0x${HEX64}`);
  });

  it('nhận dạng 64 hex trơn và tự thêm 0x (dạng MetaMask xuất ra)', () => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = HEX64;
    resetServerEnvCache();
    expect(serverEnv().serverSignerPrivateKey).toBe(`0x${HEX64}`);
  });

  it('cả hai dạng cho ra CÙNG một địa chỉ ví', () => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = HEX64;
    resetServerEnvCache();
    const fromBare = privateKeyToAccount(serverEnv().serverSignerPrivateKey as `0x${string}`);

    process.env.SERVER_SIGNER_PRIVATE_KEY = `0x${HEX64}`;
    resetServerEnvCache();
    const fromPrefixed = privateKeyToAccount(serverEnv().serverSignerPrivateKey as `0x${string}`);

    expect(fromBare.address).toBe(EXPECTED);
    expect(fromPrefixed.address).toBe(EXPECTED);
  });

  it('từ chối khóa sai độ dài kèm message nói rõ cả hai dạng đều được', () => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = '0xdeadbeef';
    resetServerEnvCache();
    expect(() => serverEnv()).toThrow(/hex 32 byte/);
  });

  it('trống thì là undefined, không phải lỗi (chain mock không cần khóa)', () => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = '';
    resetServerEnvCache();
    expect(serverEnv().serverSignerPrivateKey).toBeUndefined();
  });
});
