import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress } from 'viem';
import { MOCK_VAULT_ADDRESS, PUBLIC_SAMPLE_WALLETS, SAMPLE_WALLETS } from '@bidv/shared';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';

/**
 * OP-05 ca 3: người dùng liên kết ví vào hồ sơ của mình theo chain (QĐ-I).
 *
 * Chain `evm` ở đây chạy trên sổ mock: `getLedger` trả sổ mock cho mọi chain, để phép tra hồ sơ theo
 * chain thật (không có ví mặc định, từ chối ví mẫu) được kiểm mà không cần Sepolia. Bộ lưu trữ trong
 * bộ nhớ; bản Postgres kiểm ở `store-postgres` qua cùng cổng.
 */

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return { ...actual, getLedger: (): ILedgerPort => actual.getLedger('mock') };
});

const { resetServerEnvCache } = await import('@/lib/config/env');
const { resetMockLedger, seedMockLedger } = await import('@/lib/ledger/mock.adapter');
const { getLedger } = await import('@/lib/ledger');
const { getStore, resetMemoryStore, resetStoreCache } = await import('@/lib/store');
const profiles = await import('@/lib/bank/account-profile.service');
const actions = await import('@/app/actions/account');
const { previewTrade } = await import('@/lib/bank/trade.service');

/** Ví MetaMask giả định của Nhà đầu tư và một ví khác, đều không phải ví mẫu Hardhat. */
const OWN = getAddress('0xb3a5a0e1c7f5c3c7d8e9f0a1b2c3d4e5f6a7d033');
const OTHER = getAddress('0x5a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1fc4fd');

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor) process.env.DEMO_ACTOR = actor;
  else delete process.env.DEMO_ACTOR;
  resetServerEnvCache();
}

const linkAudit = async () =>
  (await getStore().listAudit({ limit: 100 })).filter((row) => row.action === 'profile:wallet:link');

beforeEach(() => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('INVESTOR');
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('OP-05 ca 3: liên kết ví trong hồ sơ', () => {
  it('lưu và đọc lại theo chain; chain khác không bị ảnh hưởng; audit ghi ví cũ và ví mới', async () => {
    const empty = await actions.getProfileWalletAction({ chain: 'evm' });
    expect(empty).toEqual({ ok: true, data: { chain: 'evm', linked: null, effective: null, updatedAt: null } });

    const first = await actions.linkProfileWalletAction({ chain: 'evm', wallet: OWN.toLowerCase() });
    expect(first.ok, first.ok ? '' : first.error).toBe(true);
    const second = await actions.linkProfileWalletAction({ chain: 'evm', wallet: OTHER });
    expect(second.ok && second.data.linked).toBe(OTHER);

    const evm = await actions.getProfileWalletAction({ chain: 'evm' });
    expect(evm.ok && evm.data).toMatchObject({ linked: OTHER, effective: OTHER });
    const mock = await actions.getProfileWalletAction({ chain: 'mock' });
    expect(mock.ok && mock.data).toMatchObject({ linked: null, effective: SAMPLE_WALLETS.NDT001 });

    const audit = await linkAudit();
    expect(audit.map((row) => [row.outcome, row.target, row.chain, row.detail])).toEqual([
      ['SUCCESS', 'NDT001', 'evm', `NDT001 liên kết ví trên evm: ví cũ ${OWN}, ví mới ${OTHER}.`],
      ['SUCCESS', 'NDT001', 'evm', `NDT001 liên kết ví trên evm: ví cũ không có, ví mới ${OWN}.`],
    ]);
  });

  it('phiên chỉ sửa được hồ sơ của chính mình: mã hồ sơ trong dữ liệu vào bị bỏ qua', async () => {
    actAs('SELLER');
    const result = await actions.linkProfileWalletAction({ chain: 'evm', wallet: OWN, actorId: 'NDT001' });
    expect(result.ok).toBe(true);

    expect((await linkAudit())[0]).toMatchObject({ target: 'NB001', actorRole: 'SELLER' });
    actAs('INVESTOR');
    const investor = await actions.getProfileWalletAction({ chain: 'evm' });
    expect(investor.ok && investor.data.linked).toBeNull();
  });

  it.each(['TELLER', 'CONTROLLER'])('vai nhân viên %s: FORBIDDEN, có dòng DENIED, không ghi', async (role) => {
    actAs(role);
    const read = await actions.getProfileWalletAction({ chain: 'evm' });
    const link = await actions.linkProfileWalletAction({ chain: 'evm', wallet: OWN });
    expect(!read.ok && read.code).toBe('FORBIDDEN');
    expect(!link.ok && link.code).toBe('FORBIDDEN');
    expect((await linkAudit()).map((row) => row.outcome)).toEqual(['DENIED']);
    expect(await profiles.findInvestorProfileByWallet('evm', OWN)).toBeNull();
  });

  it('ví mẫu Hardhat bị từ chối trên evm, vẫn nhận trên hardhat-local và mock', async () => {
    expect(PUBLIC_SAMPLE_WALLETS).toHaveLength(3);
    for (const sample of PUBLIC_SAMPLE_WALLETS) {
      const rejected = await actions.linkProfileWalletAction({ chain: 'evm', wallet: sample });
      expect(!rejected.ok && rejected.code, sample).toBe('VALIDATION');
      expect(!rejected.ok && rejected.error).toMatch(/ví mẫu công khai của Hardhat/);
    }
    expect((await linkAudit()).map((row) => row.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);

    for (const chain of ['hardhat-local', 'mock']) {
      const accepted = await actions.linkProfileWalletAction({ chain, wallet: SAMPLE_WALLETS.NDT001 });
      expect(accepted.ok, chain).toBe(true);
    }
  });

  it('một ví hai hồ sơ trên cùng chain bị từ chối; khác chain thì được', async () => {
    expect((await actions.linkProfileWalletAction({ chain: 'evm', wallet: OWN })).ok).toBe(true);
    actAs('SELLER');
    const taken = await actions.linkProfileWalletAction({ chain: 'evm', wallet: OWN.toUpperCase().replace('0X', '0x') });
    expect(!taken.ok && taken.error).toMatch(/đã liên kết với một hồ sơ khác/);
    expect((await linkAudit())[0]).toMatchObject({ outcome: 'FAILURE', target: 'NB001' });
    expect((await actions.linkProfileWalletAction({ chain: 'hardhat-local', wallet: OWN })).ok).toBe(true);
  });

  it('dữ liệu vào sai: VALIDATION, không ghi', async () => {
    for (const input of [{ chain: 'evm', wallet: '0x123' }, { chain: 'khong-co', wallet: OWN }, { chain: 'evm' }]) {
      const result = await actions.linkProfileWalletAction(input);
      expect(!result.ok && result.code, JSON.stringify(input)).toBe('VALIDATION');
    }
    expect(await linkAudit()).toEqual([]);
  });

  it('tra hồ sơ theo chain: evm không có ví mặc định; mock giữ ví mẫu tới khi liên kết ví khác', async () => {
    expect(await profiles.findInvestorProfileByWallet('evm', SAMPLE_WALLETS.NDT001)).toBeNull();
    expect((await profiles.findInvestorProfileByWallet('mock', SAMPLE_WALLETS.NDT001))?.actorId).toBe('NDT001');
    expect((await profiles.findInvestorProfileByWallet('hardhat-local', SAMPLE_WALLETS.NDT001))?.actorId).toBe('NDT001');

    await actions.linkProfileWalletAction({ chain: 'mock', wallet: OWN });
    expect((await profiles.findInvestorProfileByWallet('mock', OWN))?.actorId).toBe('NDT001');
    expect(await profiles.findInvestorProfileByWallet('mock', SAMPLE_WALLETS.NDT001)).toBeNull();
    expect(await profiles.ownMockWallet()).toBe(OWN);
  });
});

describe('OP-05 ca 3: previewTrade trên chain thật dùng ví liên kết', () => {
  async function identity(wallet: string) {
    const result = await previewTrade({ chain: 'evm', investorWallet: wallet, wptAmount: '1', side: 'BUY' });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.data.conditions.find((condition) => condition.key === 'identity')!;
  }

  beforeEach(async () => {
    const ledger = getLedger('evm');
    await ledger.whitelist(MOCK_VAULT_ADDRESS);
    await ledger.mintInitialSupply(MOCK_VAULT_ADDRESS, 1_000_000n);
    for (const wallet of [OWN, OTHER]) {
      await ledger.whitelist(wallet);
      await seedMockLedger({ paymentBalances: { [wallet]: 10n ** 12n }, paymentAllowances: { [wallet]: 10n ** 12n } });
    }
  });

  it('ví đã liên kết và whitelist: đạt; ví chưa liên kết: trượt "không thuộc hồ sơ"', async () => {
    expect((await identity(OWN)).passed).toBe(false);
    expect((await identity(OWN)).detail).toMatch(/không thuộc hồ sơ/);

    expect((await actions.linkProfileWalletAction({ chain: 'evm', wallet: OWN })).ok).toBe(true);

    expect((await identity(OWN)).passed).toBe(true);
    const other = await identity(OTHER);
    expect(other.passed).toBe(false);
    expect(other.detail).toMatch(/không thuộc hồ sơ/);
  });

  it('ví liên kết nhưng chưa whitelist: trượt vì danh sách được phép (liên kết không tự whitelist)', async () => {
    const fresh = getAddress('0x1234567890abcdef1234567890abcdef12345678');
    expect((await actions.linkProfileWalletAction({ chain: 'evm', wallet: fresh })).ok).toBe(true);
    const result = await identity(fresh);
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/chưa nằm trong danh sách được phép/);
    expect(await getLedger('evm').isWhitelisted(fresh)).toBe(false);
  });
});
