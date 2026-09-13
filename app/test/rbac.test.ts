import { describe, expect, it } from 'vitest';
import { ForbiddenError, ROLES, assertCan, can, permissionsOf } from '@/lib/rbac';

describe('RBAC — can(role, action)', () => {
  it('BANK_ADMIN phát hành được, AUDITOR thì không', () => {
    expect(can('BANK_ADMIN', 'token:mint')).toBe(true);
    expect(can('AUDITOR', 'token:mint')).toBe(false);
  });

  it('COMPLIANCE xét KYC/whitelist được nhưng KHÔNG phát hành', () => {
    expect(can('COMPLIANCE', 'kyc:approve')).toBe(true);
    expect(can('COMPLIANCE', 'investor:whitelist')).toBe(true);
    expect(can('COMPLIANCE', 'token:mint')).toBe(false);
  });

  it('kênh (audit) chỉ đọc: AUDITOR không có quyền ghi nào', () => {
    const writeActions = [
      'token:mint',
      'token:burn',
      'token:freeze',
      'token:clawback',
      'token:transfer',
      'investor:whitelist',
      'kyc:approve',
    ] as const;

    for (const action of writeActions) {
      expect(can('AUDITOR', action), `AUDITOR không được ${action}`).toBe(false);
    }
    expect(can('AUDITOR', 'audit:read')).toBe(true);
  });

  it('role lạ bị quy về quyền thấp nhất, KHÔNG mặc định cho qua', () => {
    // Đây là điểm dễ sai nhất: fail-open ở kiểm quyền là lỗ hổng thật.
    for (const value of ['admin', 'ADMIN', '', null, undefined, 42, {}]) {
      expect(can(value, 'token:mint'), `${String(value)} không được mint`).toBe(false);
    }
    expect(can('nguoi-la', 'audit:read')).toBe(true); // lùi về AUDITOR
  });

  it('assertCan ném ForbiddenError kèm role + action', () => {
    expect(() => assertCan('INVESTOR', 'token:mint')).toThrow(ForbiddenError);
    try {
      assertCan('INVESTOR', 'token:mint');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).role).toBe('INVESTOR');
      expect((error as ForbiddenError).action).toBe('token:mint');
    }
    expect(() => assertCan('BANK_ADMIN', 'token:mint')).not.toThrow();
  });

  it('mọi role đều có bảng quyền (không role nào bị bỏ sót)', () => {
    for (const role of ROLES) {
      expect(Array.isArray(permissionsOf(role)), role).toBe(true);
    }
  });
});
