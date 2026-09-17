import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ForbiddenError,
  ROLES,
  assertCan,
  can,
  permissionsOf,
  type Action,
  type Role,
} from '@/lib/rbac';
import { resetServerEnvCache } from '@/lib/config/env';
import {
  DemoPaymentMintDisabledError,
  assertCanMintDemoPayment,
  canMintDemoPayment,
} from '@/lib/rbac/demo-payment';

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

  it('cổng kênh nhà đầu tư: CHỈ INVESTOR có portfolio:read', () => {
    // Đây là điểm FE-01 v1 làm sai: v1 dùng `balance:read` làm cổng kênh, mà quyền đó
    // nằm trong READ_ONLY nên cả bốn vai đều có -> guard không chặn được ai.
    expect(can('INVESTOR', 'portfolio:read')).toBe(true);

    for (const role of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR'] as const) {
      expect(can(role, 'portfolio:read'), `${role} KHÔNG được vào kênh nhà đầu tư`).toBe(false);
    }
  });

  it('portfolio:read KHÔNG bị lẫn vào nhóm chỉ-đọc dùng chung', () => {
    // Chốt bằng test để lần sau ai thêm nó vào READ_ONLY là đỏ ngay, không phải phát hiện
    // bằng cách bấm thử trên giao diện.
    const readOnlyShared = ['balance:read', 'txn:read', 'audit:read'] as const;
    for (const action of readOnlyShared) {
      expect(can('AUDITOR', action), `AUDITOR vẫn phải có ${action}`).toBe(true);
    }
    expect(permissionsOf('AUDITOR')).not.toContain('portfolio:read');
    expect(permissionsOf('BANK_ADMIN')).not.toContain('portfolio:read');
    expect(permissionsOf('COMPLIANCE')).not.toContain('portfolio:read');
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

// ===========================================================================
//  BE-08 — quyền cho ba luồng: khớp lệnh mua, chia lợi nhuận, tất toán
// ===========================================================================

/**
 * Bảng quyền hiện có TRƯỚC BE-08, chép từ `git show dev:app/src/lib/rbac/permissions.ts`.
 *
 * Dùng làm mốc chống hồi quy: thêm quyền thì không được làm mất quyền cũ. Không có mốc này
 * thì một lần sắp xếp lại `ROLE_PERMISSIONS` là đủ để lặng lẽ gỡ quyền của một vai, và
 * triệu chứng chỉ hiện ra khi có người bấm nút trên giao diện.
 */
const PERMISSIONS_BEFORE_BE08: Record<Role, readonly Action[]> = {
  BANK_ADMIN: [
    'token:mint',
    'token:burn',
    'token:freeze',
    'token:clawback',
    'investor:whitelist',
    'kyc:approve',
    'balance:read',
    'txn:read',
    'audit:read',
  ],
  COMPLIANCE: [
    'investor:whitelist',
    'kyc:approve',
    'token:freeze',
    'balance:read',
    'txn:read',
    'audit:read',
  ],
  INVESTOR: ['token:transfer', 'portfolio:read', 'balance:read', 'txn:read'],
  AUDITOR: ['balance:read', 'txn:read', 'audit:read'],
};

/** Hành động đã có trước BE-08 — dùng để tính "hành động mới" mà không phải đếm tay. */
const ACTIONS_BEFORE_BE08: readonly Action[] = [
  'token:mint',
  'token:burn',
  'token:freeze',
  'token:clawback',
  'investor:whitelist',
  'kyc:approve',
  'token:transfer',
  'balance:read',
  'txn:read',
  'audit:read',
  'portfolio:read',
];

/**
 * Ma trận quyền của 10 hành động BE-08 thêm vào (docs/be-08-rbac-actions/design.md §2).
 *
 * Liệt kê vai ĐƯỢC PHÉP; mọi vai còn lại phải bị chặn. Viết theo hướng này thay vì
 * liệt kê cả hai phía để không có kẽ hở: thêm vai mới vào `ROLES` là test tự kiểm luôn.
 */
const NEW_ACTIONS: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  { action: 'order:place', allowed: ['INVESTOR'], why: 'nhà đầu tư đặt lệnh, ngân hàng không đặt thay' },
  { action: 'order:execute', allowed: ['BANK_ADMIN'], why: 'chỉ ngân hàng khớp lệnh và chuyển tiền' },
  { action: 'distribution:snapshot', allowed: ['BANK_ADMIN'], why: 'chốt quyền là quyết định của ngân hàng' },
  { action: 'distribution:execute', allowed: ['BANK_ADMIN'], why: 'tuân thủ giám sát, không tự chi trả' },
  { action: 'settlement:initiate', allowed: ['BANK_ADMIN'], why: 'ngân hàng điều phối đóng quỹ' },
  { action: 'settlement:set-nav', allowed: ['BANK_ADMIN'], why: 'đặt giá hoàn vốn là việc của ngân hàng' },
  { action: 'settlement:confirm', allowed: ['INVESTOR'], why: 'nhà đầu tư tự xác nhận hoàn vốn' },
  { action: 'treasury:manage', allowed: ['BANK_ADMIN'], why: 'quản trị ví SPV và ví chia lợi nhuận' },
  {
    action: 'reconcile:read',
    allowed: ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR'],
    why: 'báo cáo đối soát là dữ liệu toàn hệ — nhà đầu tư chỉ xem vị thế của mình',
  },
  { action: 'demo:mint-payment', allowed: ['BANK_ADMIN'], why: 'chỉ môi trường thử, và còn cần cờ' },
];

/** Mọi hành động GHI — không vai chỉ-đọc nào được có, kể cả vai trò lạ. */
const ALL_WRITE_ACTIONS: readonly Action[] = [
  'token:mint',
  'token:burn',
  'token:freeze',
  'token:clawback',
  'token:transfer',
  'investor:whitelist',
  'kyc:approve',
  'order:place',
  'order:execute',
  'distribution:snapshot',
  'distribution:execute',
  'settlement:initiate',
  'settlement:set-nav',
  'settlement:confirm',
  'treasury:manage',
  'demo:mint-payment',
];

describe('RBAC — ma trận quyền ba luồng (BE-08)', () => {
  it.each(NEW_ACTIONS)('$action: chỉ $allowed được, các vai khác bị chặn ($why)', ({ action, allowed }) => {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      expect(can(role, action), `${role} × ${action} phải là ${expected}`).toBe(expected);
    }
  });

  it('mọi hành động mới đều có dòng trong bảng test (R4.4)', () => {
    // Chốt bằng test để lần sau ai thêm action mà quên test là đỏ ngay, chứ không phải
    // trông vào việc người review nhớ ra.
    const covered = new Set<string>([...ACTIONS_BEFORE_BE08, ...NEW_ACTIONS.map((row) => row.action)]);
    const missing = ACTIONS.filter((action) => !covered.has(action));
    expect(missing, `thêm dòng cho các action này vào NEW_ACTIONS: ${missing.join(', ')}`).toEqual([]);
  });

  it('BANK_ADMIN KHÔNG đặt lệnh và KHÔNG xác nhận hoàn vốn thay nhà đầu tư', () => {
    // Ngân hàng làm thay hai việc này thì mất dấu ai đã đồng ý, và sổ kiểm toán không còn
    // dùng được để đối chiếu trách nhiệm.
    expect(can('BANK_ADMIN', 'order:place')).toBe(false);
    expect(can('BANK_ADMIN', 'settlement:confirm')).toBe(false);
  });

  it('COMPLIANCE giám sát chứ không thực hiện giao dịch tiền', () => {
    expect(can('COMPLIANCE', 'reconcile:read')).toBe(true);
    for (const action of ['order:execute', 'distribution:execute', 'settlement:set-nav'] as const) {
      expect(can('COMPLIANCE', action), `COMPLIANCE không được ${action}`).toBe(false);
    }
  });

  it('INVESTOR KHÔNG có reconcile:read', () => {
    // `reconcile:read` nằm trong nhóm READ_ONLY (ba vai ngân hàng tự nhận), còn INVESTOR
    // không spread nhóm đó. Test này chốt lại để không ai "tiện tay" thêm vào.
    expect(can('INVESTOR', 'reconcile:read')).toBe(false);
    expect(permissionsOf('INVESTOR')).not.toContain('reconcile:read');
  });

  it('vai trò lạ quy về AUDITOR: không một quyền GHI nào', () => {
    for (const value of ['admin', 'ADMIN', 'BANK-ADMIN', '', null, undefined, 42, {}, []]) {
      for (const action of ALL_WRITE_ACTIONS) {
        expect(can(value, action), `${String(value)} không được ${action}`).toBe(false);
      }
    }
    // Nhưng vẫn được đọc như AUDITOR — fallback là "quyền thấp nhất", không phải "không quyền".
    expect(can('nguoi-la', 'reconcile:read')).toBe(true);
    expect(can('nguoi-la', 'audit:read')).toBe(true);
  });

  it('AUDITOR không có quyền GHI nào, kể cả các hành động mới', () => {
    for (const action of ALL_WRITE_ACTIONS) {
      expect(can('AUDITOR', action), `AUDITOR không được ${action}`).toBe(false);
    }
  });

  it('không vai trò nào MẤT quyền đang có trước BE-08 (R4.3)', () => {
    for (const role of ROLES) {
      const now = permissionsOf(role);
      for (const action of PERMISSIONS_BEFORE_BE08[role]) {
        expect(now, `${role} vẫn phải có ${action}`).toContain(action);
      }
    }
  });
});

// ===========================================================================
//  BE-08 — chốt chặn HAI LỚP cho chức năng phát hành VNDB demo
// ===========================================================================

const setFlag = (value: string | undefined) => {
  if (value === undefined) delete process.env.ENABLE_DEMO_PAYMENT_MINT;
  else process.env.ENABLE_DEMO_PAYMENT_MINT = value;
  resetServerEnvCache();
};

afterEach(() => setFlag(undefined));

describe('demo:mint-payment — cờ trước, quyền sau', () => {
  it('KHÔNG đặt cờ thì mặc định TẮT, BANK_ADMIN cũng bị từ chối (R3.2, R3.3)', () => {
    setFlag(undefined);
    expect(canMintDemoPayment('BANK_ADMIN')).toBe(false);
  });

  it('cờ đặt false thì BANK_ADMIN bị từ chối dù CÓ quyền RBAC', () => {
    // Đây là điểm chính của hai lớp: quyền RBAC vẫn có, nhưng cờ tắt là chặn.
    setFlag('false');
    expect(can('BANK_ADMIN', 'demo:mint-payment')).toBe(true);
    expect(canMintDemoPayment('BANK_ADMIN')).toBe(false);
  });

  it('cờ bật thì CHỈ BANK_ADMIN được — cờ không tự cấp quyền cho vai khác (R2.5)', () => {
    setFlag('true');
    expect(canMintDemoPayment('BANK_ADMIN')).toBe(true);
    for (const role of ['COMPLIANCE', 'INVESTOR', 'AUDITOR'] as const) {
      expect(canMintDemoPayment(role), `${role} không được dù cờ đã bật`).toBe(false);
    }
    expect(canMintDemoPayment('nguoi-la')).toBe(false);
  });

  it('cờ tắt: assert ném lỗi nói đúng nguyên nhân là CỜ, không phải vai', () => {
    setFlag('false');
    // Người vận hành đọc log phải biết đi bật cờ. Nếu message nói "vai BANK_ADMIN không có
    // quyền" thì họ sẽ đi sửa bảng quyền — sai chỗ, và mở rộng quyền một cách vô ích.
    expect(() => assertCanMintDemoPayment('BANK_ADMIN')).toThrow(DemoPaymentMintDisabledError);
    expect(() => assertCanMintDemoPayment('BANK_ADMIN')).toThrow(/ENABLE_DEMO_PAYMENT_MINT/);
  });

  it('lỗi cờ tắt vẫn là ForbiddenError nên toResult() quy về 403', () => {
    setFlag('false');
    try {
      assertCanMintDemoPayment('BANK_ADMIN');
      expect.unreachable('phải ném lỗi khi cờ tắt');
    } catch (error) {
      // Kế thừa ForbiddenError là có chủ ý: `lib/bank/authorize.ts` quy lỗi theo instanceof,
      // nên không phải sửa bảng quy lỗi để có đúng mã HTTP.
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).action).toBe('demo:mint-payment');
    }
  });

  it('cờ bật nhưng thiếu quyền: ném ForbiddenError thường', () => {
    setFlag('true');
    expect(() => assertCanMintDemoPayment('AUDITOR')).toThrow(ForbiddenError);
    expect(() => assertCanMintDemoPayment('AUDITOR')).not.toThrow(DemoPaymentMintDisabledError);
    expect(() => assertCanMintDemoPayment('BANK_ADMIN')).not.toThrow();
  });

  it('nhận các cách viết "bật" thường gặp, còn lại coi là tắt', () => {
    for (const on of ['true', '1', 'yes', 'on', 'TRUE', ' true ']) {
      setFlag(on);
      expect(canMintDemoPayment('BANK_ADMIN'), `"${on}" phải là bật`).toBe(true);
    }
    for (const off of ['false', '0', 'no', '', 'bat']) {
      setFlag(off);
      expect(canMintDemoPayment('BANK_ADMIN'), `"${off}" phải là tắt`).toBe(false);
    }
  });
});
