import { describe, expect, it } from 'vitest';
import { CHAINS } from '@bidv/shared';
import { resolveWalletStatus } from '@/lib/wallet/wallet-status';

/**
 * FE-UX-07b: thanh đầu theo bản chốt, nhãn chain "Private Chain" (design mục 3).
 */

describe('FE-UX-07b nhóm 4: nhãn chain', () => {
  it('hardhat-local hiển thị "Private Chain"; khoá, chainId, RPC giữ nguyên', () => {
    const info = CHAINS['hardhat-local'];
    expect(info.label).toBe('Private Chain');
    expect(info.key).toBe('hardhat-local');
    expect(info.chainId).toBe(31337);
    expect(info.defaultRpcUrl).toBe('http://127.0.0.1:8545');
  });

  const base = { mounted: true, hasInjectedProvider: true, isConnected: true, address: '0x0000000000000000000000000000000000000001' as const };

  it('app ở evm, ví ở chain 31337: chain-mismatch có walletChain "Private Chain"', () => {
    const status = resolveWalletStatus({ ...base, appChain: 'evm', walletChainId: 31337 });
    expect(status.kind).toBe('chain-mismatch');
    expect(status.kind === 'chain-mismatch' && status.walletChain).toBe('Private Chain');
  });

  it('app ở hardhat-local, ví ở chain 1: wrong-chain có expectedLabel "Private Chain"', () => {
    const status = resolveWalletStatus({ ...base, appChain: 'hardhat-local', walletChainId: 1 });
    expect(status.kind).toBe('wrong-chain');
    expect(status.kind === 'wrong-chain' && status.expectedLabel).toBe('Private Chain');
  });
});
