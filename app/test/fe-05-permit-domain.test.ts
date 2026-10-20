import { describe, expect, it } from 'vitest';
import { buildPermitTypedData } from '@bidv/shared';
import { assertSupportedPermitDomain } from '@/lib/bank/permit';
import type { PermitDomain } from '@/lib/ledger';
import { LedgerError } from '@/lib/ledger';

/**
 * FE-05 ca 1b: domain permit chỉ nhận khuôn chuẩn đang hỗ trợ; `buildPermitTypedData` bắt buộc
 * `version`. Domain giả dựng theo đúng address book hardhat-local (địa chỉ tất định).
 */

const VND_TOKEN = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const PROJECT_TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ZERO_SALT = `0x${'0'.repeat(64)}` as const;

function domain(overrides: Partial<PermitDomain> = {}): PermitDomain {
  return {
    fields: '0x0f',
    name: 'VND Bank Token',
    version: '1',
    chainId: 31337n,
    verifyingContract: VND_TOKEN,
    salt: ZERO_SALT,
    extensions: [],
    ...overrides,
  };
}

describe('FE-05 ca 1b: readPermitDomain chỉ nhận khuôn hỗ trợ', () => {
  it('domain đúng khuôn trả name, version, chainId cấu hình và địa chỉ address book', () => {
    expect(assertSupportedPermitDomain('hardhat-local', 'payment', domain())).toEqual({
      name: 'VND Bank Token',
      version: '1',
      chainId: 31337,
      verifyingContract: VND_TOKEN,
    });
    expect(
      assertSupportedPermitDomain(
        'hardhat-local',
        'project',
        domain({ verifyingContract: PROJECT_TOKEN.toLowerCase(), version: '2' }),
      ).version,
    ).toBe('2');
  });

  it.each([
    ['fields khác 0x0f', { fields: '0x1f' as const }, /fields = 0x1f/],
    ['salt khác 0', { salt: `0x${'0'.repeat(63)}1` as const }, /salt khác 0/],
    ['extensions không rỗng', { extensions: [1n] }, /extensions không rỗng/],
    ['chainId lệch', { chainId: 1n }, /chainId = 1/],
    ['verifyingContract lệch', { verifyingContract: PROJECT_TOKEN }, /verifyingContract/],
  ])('%s là lỗi cấu hình, không dựng typed data', (_label, overrides, reason) => {
    const run = () => assertSupportedPermitDomain('hardhat-local', 'payment', domain(overrides));
    expect(run).toThrow(LedgerError);
    expect(run).toThrow(/không đúng khuôn hỗ trợ/);
    expect(run).toThrow(reason);
  });

  it('chain không có chainId EVM (mock) bị chặn', () => {
    expect(() => assertSupportedPermitDomain('mock', 'payment', domain())).toThrow(LedgerError);
  });
});

describe('FE-05 ca 1b: buildPermitTypedData bắt buộc version', () => {
  const input = {
    tokenName: 'VND Bank Token',
    chainId: 31337,
    verifyingContract: VND_TOKEN,
    owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    spender: '0x9A676e781A523b5d0C0e43731313A708CB607508',
    value: 10_000_000n,
    nonce: 0n,
    deadline: 1_800n,
  } as const;

  it('thiếu version thì ném lỗi, không lùi về "1"', () => {
    expect(() => buildPermitTypedData(input as never)).toThrow(/thiếu version EIP-712/);
    expect(() => buildPermitTypedData({ ...input, version: '' })).toThrow(/thiếu version EIP-712/);
  });

  it('có version thì dùng đúng version đó', () => {
    expect(buildPermitTypedData({ ...input, version: '7' }).domain.version).toBe('7');
  });
});
