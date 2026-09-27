import { afterEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import {
  KEEPER_SECRET_MIN_LENGTH,
  keeperSecretMatches,
  resetServerEnvCache,
  serverEnv,
} from '@/lib/config/env';

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

/**
 * KEEPER_SECRET (BE-07) — cùng tệp với khoá ký vì cùng một loại rủi ro: một bí mật đọc từ biến
 * môi trường, mà cấu hình sai thì hỏng ở chỗ khó thấy chứ không nổ ra ngay.
 *
 * Phép kiểm ở đây là về TẦNG CẤU HÌNH. Hành vi của route handler (từ chối 401, không nói khoá
 * đã cấu hình hay chưa) nằm ở `distribution-trigger.test.ts` ca 9.
 */
describe('KEEPER_SECRET', () => {
  afterEach(() => {
    delete process.env.KEEPER_SECRET;
    resetServerEnvCache();
  });

  it('trống thì là undefined — route sẽ từ chối hết', () => {
    delete process.env.KEEPER_SECRET;
    resetServerEnvCache();
    expect(serverEnv().keeperSecret).toBeUndefined();
    expect(keeperSecretMatches('bất kỳ')).toBe(false);
  });

  /**
   * Chặn khoá yếu ở tầng CẤU HÌNH, không ở route.
   *
   * Route chỉ thấy khoá khớp hay không, nên một khoá `"secret"` sẽ chạy đúng suốt và không gì
   * báo là nó đoán được trong vài giây. Nổ ra lúc nạp cấu hình thì người triển khai biết ngay.
   */
  it('từ chối khoá quá ngắn, kèm lệnh sinh khoá trong thông báo', () => {
    process.env.KEEPER_SECRET = 'secret';
    resetServerEnvCache();
    expect(() => serverEnv()).toThrow(/openssl rand/);
  });

  it('khoá đủ dài thì khớp chính nó và không khớp khoá khác cùng độ dài', () => {
    const secret = 'f'.repeat(KEEPER_SECRET_MIN_LENGTH);
    process.env.KEEPER_SECRET = secret;
    resetServerEnvCache();

    expect(keeperSecretMatches(secret)).toBe(true);
    expect(keeperSecretMatches('e'.repeat(KEEPER_SECRET_MIN_LENGTH))).toBe(false);
    // Lệch đúng một ký tự cuối: phép so sánh phải đi hết chuỗi mới kết luận được.
    expect(keeperSecretMatches(`${secret.slice(0, -1)}e`)).toBe(false);
    expect(keeperSecretMatches(null)).toBe(false);
  });

  it('cắt khoảng trắng hai đầu, để khoá dán từ tệp cấu hình có xuống dòng vẫn dùng được', () => {
    const secret = '0'.repeat(KEEPER_SECRET_MIN_LENGTH);
    process.env.KEEPER_SECRET = `  ${secret}\n`;
    resetServerEnvCache();

    expect(serverEnv().keeperSecret).toBe(secret);
  });
});
