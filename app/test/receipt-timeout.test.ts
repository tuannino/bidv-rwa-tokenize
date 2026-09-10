import { describe, expect, it } from 'vitest';
import { CHAIN_KEYS } from '@bidv/shared';
import {
  DEFAULT_RECEIPT_TIMEOUT_MS,
  EVM_RECEIPT_TIMEOUT_MS,
  receiptTimeoutFor,
} from '@/lib/ledger/ledger.port';

/**
 * Timeout chờ receipt phải theo chain.
 *
 * Vì sao đáng test: dùng 30s cho Sepolia (block ~12s) sẽ báo PENDING oan khi tx hoàn toàn
 * bình thường — người dùng tưởng mint thất bại rồi bấm lại, sinh giao dịch trùng.
 */
describe('receiptTimeoutFor(chain)', () => {
  it('chain evm (Sepolia) được timeout dài hơn mặc định', () => {
    expect(receiptTimeoutFor('evm')).toBe(EVM_RECEIPT_TIMEOUT_MS);
    expect(EVM_RECEIPT_TIMEOUT_MS).toBeGreaterThan(DEFAULT_RECEIPT_TIMEOUT_MS);
  });

  it('90s phủ được ít nhất 5 block Sepolia (~12s/block)', () => {
    expect(EVM_RECEIPT_TIMEOUT_MS / 12_000).toBeGreaterThanOrEqual(5);
  });

  it('hardhat-local KHÔNG bị đổi hành vi (vẫn 30s)', () => {
    expect(receiptTimeoutFor('hardhat-local')).toBe(DEFAULT_RECEIPT_TIMEOUT_MS);
  });

  it('mock và stellar dùng mặc định', () => {
    expect(receiptTimeoutFor('mock')).toBe(DEFAULT_RECEIPT_TIMEOUT_MS);
    expect(receiptTimeoutFor('stellar')).toBe(DEFAULT_RECEIPT_TIMEOUT_MS);
  });

  it('mọi ChainKey đều có timeout dương (không sót chain nào)', () => {
    // Thêm chain mới mà quên khai timeout -> test này đỏ chứ không âm thầm ra undefined.
    for (const chain of CHAIN_KEYS) {
      const timeout = receiptTimeoutFor(chain);
      expect(timeout, `timeout của ${chain}`).toBeGreaterThan(0);
    }
  });
});
