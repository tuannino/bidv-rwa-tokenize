import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBankSigner, resetSignerCache, SignerUnavailableError } from '@/lib/signer';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger, getLedger } from '@/lib/ledger';
import { getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';
import { onboardInvestor } from '@/lib/bank/mint.service';

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('SERVER_SIGNER_PRIVATE_KEY')) vi.stubEnv(key, undefined);
  }
  vi.stubEnv('SIGNER_KIND', 'server');
  vi.stubEnv('DEMO_ROLE', 'TELLER');
  vi.stubEnv('USE_MOCK_KYC', 'true');
  vi.stubEnv('USE_MOCK_DB', 'true');
  resetServerEnvCache();
  resetSignerCache();
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
  resetSignerCache();
  resetStoreCache();
});

describe('OP-02 — chỉ mock được chạy khi không có khóa ký', () => {
  it('mock trả tài khoản cố định không mang khóa, không ném lỗi', async () => {
    const signer = getBankSigner('mock');
    const account = await signer.getAccount();
    expect(account.type).toBe('json-rpc');
    expect(account.address).toBe('0x0000000000000000000000000000000000000001');
    expect(await signer.getAddress()).toBe(account.address);
    expect(await getBankSigner('mock').getAccount()).toEqual(account);
  });

  it.each(['hardhat-local', 'evm'] as const)('%s vẫn từ chối khi thiếu khóa', async chain => {
    const signer = getBankSigner(chain);
    await expect(signer.getAccount()).rejects.toBeInstanceOf(SignerUnavailableError);
    await expect(signer.getAddress()).rejects.toThrow(`Thiếu khóa ký cho chain "${chain}"`);
    await expect(signer.getAccount()).rejects.toThrow('SERVER_SIGNER_PRIVATE_KEY');
  });

  it('KYC và whitelist qua service thật trên mock chạy hết luồng không có khóa', async () => {
    const wallet = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const result = await onboardInvestor({ chain: 'mock', wallet });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.whitelisted).toBe(true);
    expect(result.data.status).toBe('CONFIRMED');
    expect(await getLedger('mock').isWhitelisted(wallet)).toBe(true);
    const tx = (await getStore().listTxns({ chain: 'mock' })).find(t => t.txHash === result.data.txHash);
    expect(tx?.actorAddress).toBe(await getBankSigner('mock').getAddress());
  });
});
