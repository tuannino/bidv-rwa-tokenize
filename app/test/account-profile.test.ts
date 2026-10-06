import { afterEach, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/config/env';
import type { Role } from '@/lib/rbac';
import {
  findInvestorProfileByWallet,
  findOwnAccountProfile,
  getOwnAccountProfile,
} from '@/lib/bank/account-profile.service';

const ACTORS: Record<Role, string> = {
  INVESTOR: 'NDT001',
  SELLER: 'NB001',
  TELLER: 'GDV001',
  CONTROLLER: 'KSV001',
};

function actAs(role: Role, actorId = ACTORS[role]) {
  process.env.DEMO_ROLE = role;
  process.env.DEMO_ACTOR = actorId;
  resetServerEnvCache();
}

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  resetServerEnvCache();
});

describe('FE-24 — nguồn hồ sơ bốn vai', () => {
  it.each(Object.entries(ACTORS) as Array<[Role, string]>)('%s chỉ đọc hồ sơ của chính mình', async (role, actorId) => {
    actAs(role, actorId);
    const result = await getOwnAccountProfile();
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ actorId, role, status: 'ACTIVE' });
  });

  it('mã người dùng của vai khác không làm lộ hồ sơ', async () => {
    actAs('INVESTOR', 'NB001');
    const result = await getOwnAccountProfile();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Không tìm thấy hồ sơ NB001 cho vai INVESTOR/);
    expect(findOwnAccountProfile('INVESTOR', 'NB001')).toBeNull();
  });

  it('hai vai khách hàng có hồ sơ KYC, rủi ro, AML, hạn mức và ví', () => {
    for (const role of ['INVESTOR', 'SELLER'] as const) {
      const profile = findOwnAccountProfile(role, ACTORS[role]);
      expect(profile?.kind).toBe('CUSTOMER');
      if (!profile || profile.kind !== 'CUSTOMER') continue;
      expect(profile.identityStatus).toBe('APPROVED');
      expect(profile.riskRating).toBe('LOW');
      expect(profile.amlStatus).toBe('CLEARED');
      expect(BigInt(profile.dailyTransactionLimitVnd)).toBeGreaterThan(0n);
      expect(profile.wallet).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('hai vai ngân hàng không có trường đầu tư và không có ví', () => {
    for (const role of ['TELLER', 'CONTROLLER'] as const) {
      const profile = findOwnAccountProfile(role, ACTORS[role]);
      expect(profile?.kind).toBe('EMPLOYEE');
      expect(profile).not.toHaveProperty('wallet');
      expect(profile).not.toHaveProperty('identityStatus');
      expect(profile).not.toHaveProperty('riskRating');
      expect(profile).not.toHaveProperty('amlStatus');
    }
  });

  it('khối trước lệnh tra đúng hồ sơ bằng ví, không khớp ví người bán', () => {
    const investor = findOwnAccountProfile('INVESTOR', ACTORS.INVESTOR);
    expect(investor?.kind).toBe('CUSTOMER');
    if (!investor || investor.kind !== 'CUSTOMER') return;
    expect(findInvestorProfileByWallet(investor.wallet)?.actorId).toBe('NDT001');

    const seller = findOwnAccountProfile('SELLER', ACTORS.SELLER);
    expect(seller?.kind).toBe('CUSTOMER');
    if (!seller || seller.kind !== 'CUSTOMER') return;
    expect(findInvestorProfileByWallet(seller.wallet)).toBeNull();
  });
});
