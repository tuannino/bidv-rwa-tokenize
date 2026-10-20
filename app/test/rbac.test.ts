import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIONS,
  ForbiddenError,
  UNKNOWN_ROLE,
  ROLES,
  assertCan,
  can,
  isRole,
  permissionsOf,
  type Action,
  type Role,
} from '@/lib/rbac';
import { resetServerEnvCache } from '@/lib/config/env';
import {
  DemoPaymentMintDisabledError,
  DemoTokenMintDisabledError,
  assertCanMintDemoPayment,
  assertCanMintDemoToken,
  canMintDemoPayment,
  canMintDemoToken,
} from '@/lib/rbac/demo-payment';
import { assertCanConfigure, isConfigRole } from '@/lib/rbac/config-role';

/**
 * FE-20 ca 1 — danh sách vai trò là bốn giá trị theo tài liệu yêu cầu.
 *
 * Kiểm CẢ HAI chiều: bốn vai mới có mặt, và hai vai đã gỡ không còn. Chỉ kiểm chiều "có mặt"
 * thì một lần thêm lại `AUDITOR` vào `ROLES` sẽ lọt, tức phân quyền nói khác tài liệu.
 */
describe('RBAC — bốn vai trò theo tài liệu yêu cầu (FE-20 ca 1)', () => {
  it('đúng bốn vai: INVESTOR, SELLER, TELLER, CONTROLLER', () => {
    expect([...ROLES]).toEqual(['INVESTOR', 'SELLER', 'TELLER', 'CONTROLLER']);
  });

  it('hai vai cũ KHÔNG còn trong danh sách', () => {
    for (const removed of ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR']) {
      expect((ROLES as readonly string[]).includes(removed), `${removed} đã gỡ`).toBe(false);
      // Và không còn là vai hợp lệ, nên cookie mang giá trị cũ không có quyền nào (BE-13 QĐ-A).
      expect(isRole(removed), `${removed} không còn hợp lệ`).toBe(false);
    }
  });

  it('mọi role đều có bảng quyền (không role nào bị bỏ sót)', () => {
    for (const role of ROLES) {
      expect(Array.isArray(permissionsOf(role)), role).toBe(true);
    }
  });
});

describe('RBAC — can(role, action)', () => {
  /**
   * FE-22 ca 9 — đóng đường đi vòng qua lập–duyệt.
   *
   * Trước FE-22 Giao dịch viên có `token:mint` / `token:burn`, tức tự tạo và huỷ token được mà
   * không qua Kiểm soát viên — BE-12 thành hình thức. Đột biến "trả lại `token:mint` cho TELLER"
   * phải làm ca này đỏ.
   */
  it('FE-22 ca 9 — Giao dịch viên không còn quyền tạo và huỷ token trực tiếp', () => {
    expect(can('TELLER', 'token:mint')).toBe(false);
    expect(can('TELLER', 'token:burn')).toBe(false);
    // Và không vai nào khác nhận thay: đường duy nhất là lập (TELLER) rồi duyệt (CONTROLLER).
    for (const role of ROLES) {
      expect(can(role, 'token:mint'), `${role} × token:mint`).toBe(false);
      expect(can(role, 'token:burn'), `${role} × token:burn`).toBe(false);
    }
    expect(can('TELLER', 'order:draft')).toBe(true);
    expect(can('CONTROLLER', 'order:approve')).toBe(true);
  });

  it('CONTROLLER chỉ đọc: không một quyền ghi nào, kể cả việc của vai tuân thủ cũ', () => {
    const writeActions = [
      'token:mint',
      'token:burn',
      'token:freeze',
      'token:clawback',
      'token:transfer',
      'investor:whitelist',
      'kyc:approve',
      'order:place',
      'order:execute',
      'order:expire',
    ] as const;

    for (const action of writeActions) {
      expect(can('CONTROLLER', action), `CONTROLLER không được ${action}`).toBe(false);
    }
    expect(can('CONTROLLER', 'audit:read')).toBe(true);
  });

  it('ba quyền của vai tuân thủ cũ vẫn có chủ, và chủ đó là TELLER', () => {
    // Gỡ một vai mà không kiểm chỗ này thì quyền của nó thành VÔ CHỦ: bảng vẫn khai hành
    // động, số đếm không giảm nên `verify-arch-rules.sh` vẫn xanh, mà không ai làm được
    // việc đó nữa. Triệu chứng chỉ hiện ra khi có người bấm nút trên giao diện.
    for (const action of ['investor:whitelist', 'kyc:approve', 'token:freeze'] as const) {
      expect(can('TELLER', action), `TELLER phải làm được ${action}`).toBe(true);
    }
  });

  it('cổng khu vực nhà đầu tư: CHỈ INVESTOR có portfolio:read', () => {
    // Đây là điểm FE-01 v1 làm sai: v1 dùng `balance:read` làm cổng kênh, mà quyền đó
    // nằm trong READ_ONLY nên cả bốn vai đều có -> guard không chặn được ai.
    expect(can('INVESTOR', 'portfolio:read')).toBe(true);

    for (const role of ['SELLER', 'TELLER', 'CONTROLLER'] as const) {
      expect(can(role, 'portfolio:read'), `${role} KHÔNG được vào khu vực nhà đầu tư`).toBe(false);
    }
  });

  it('SC-07 — chỉ hai vai vận hành đọc được vault', () => {
    expect(can('TELLER', 'vault:read')).toBe(true);
    expect(can('CONTROLLER', 'vault:read')).toBe(true);
    expect(can('INVESTOR', 'vault:read')).toBe(false);
    expect(can('SELLER', 'vault:read')).toBe(false);
  });

  it('portfolio:read KHÔNG bị lẫn vào nhóm chỉ-đọc dùng chung', () => {
    // Chốt bằng test để lần sau ai thêm nó vào READ_ONLY là đỏ ngay, không phải phát hiện
    // bằng cách bấm thử trên giao diện.
    const readOnlyShared = ['balance:read', 'txn:read', 'audit:read'] as const;
    for (const action of readOnlyShared) {
      expect(can('CONTROLLER', action), `CONTROLLER vẫn phải có ${action}`).toBe(true);
    }
    for (const role of ['SELLER', 'TELLER', 'CONTROLLER'] as const) {
      expect(permissionsOf(role), role).not.toContain('portfolio:read');
    }
  });

  it('lệnh mua: nhà đầu tư ĐẶT, ngân hàng KHỚP — hai quyền tách rời', () => {
    // Gộp hai quyền làm một thì ai đặt được lệnh cũng tự khớp được lệnh của mình,
    // tức tự rút WPT khỏi ví thanh toán SPV theo ý mình.
    expect(can('INVESTOR', 'order:place')).toBe(true);
    expect(can('INVESTOR', 'order:execute')).toBe(false);

    expect(can('TELLER', 'order:execute')).toBe(true);
    expect(can('TELLER', 'order:place')).toBe(false);

    // Kiểm soát viên giám sát nhưng không chạm tiền: không đặt, không khớp.
    expect(can('CONTROLLER', 'order:place')).toBe(false);
    expect(can('CONTROLLER', 'order:execute')).toBe(false);
  });

  it('order:read:all là thứ phân biệt R5.1 với R5.2, không phải if role', () => {
    // Cả bốn vai đọc được sổ lệnh, nhưng chỉ nhà đầu tư bị buộc lọc theo ví mình.
    // BE-14 việc 12: Người bán xem toàn bộ như hai vai vận hành.
    for (const role of ROLES) {
      expect(can(role, 'order:read'), `${role} phải đọc được lệnh`).toBe(true);
    }
    expect(can('INVESTOR', 'order:read:all'), 'INVESTOR chỉ xem lệnh của ví mình').toBe(false);
    for (const role of ['SELLER', 'TELLER', 'CONTROLLER'] as const) {
      expect(can(role, 'order:read:all'), `${role} xem được toàn hệ`).toBe(true);
    }
  });

  it('order:expire chỉ TELLER — dọn lệnh treo là thao tác ghi', () => {
    expect(can('TELLER', 'order:expire')).toBe(true);
    for (const role of ['INVESTOR', 'SELLER', 'CONTROLLER'] as const) {
      expect(can(role, 'order:expire'), `${role} không được dọn lệnh`).toBe(false);
    }
  });

  it('role lạ KHÔNG mặc định cho qua', () => {
    // Đây là điểm dễ sai nhất: fail-open ở kiểm quyền là lỗ hổng thật.
    for (const value of ['admin', 'ADMIN', '', null, undefined, 42, {}]) {
      expect(can(value, 'token:mint'), `${String(value)} không được mint`).toBe(false);
    }
    // BE-13 QĐ-A: vai lạ không còn đọc được gì (trước đây mượn quyền đọc của SELLER).
    expect(can('nguoi-la', 'balance:read')).toBe(false);
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
    expect(() => assertCan('TELLER', 'token:mint')).toThrow(ForbiddenError);
    expect(() => assertCan('TELLER', 'order:draft')).not.toThrow();
  });
});

/**
 * BE-13 ca 1 (phần RBAC), QĐ-A: vai lạ KHÔNG có quyền nào.
 *
 * Thay cho `FALLBACK_ROLE` của FE-20 (quy vai lạ về `SELLER`). Từ BE-13 cả bốn vai đều có quyền
 * ghi (Người bán có `vault:withdraw`), nên quy vai lạ về BẤT KỲ vai nào cũng là cho một cookie gõ
 * sai một quyền ghi. Đột biến 16a ("`can` quy vai lạ về `SELLER`") phải làm các ca dưới đỏ.
 */
describe('BE-13 ca 1: RBAC đóng cho vai lạ (QĐ-A)', () => {
  const STRANGE = ['UNKNOWN', 'nguoi-la', 'seller', 'BANK_ADMIN', '', ' ', null, undefined, 42, 0, {}, [], 'SELLER ', '{"role":"SELLER"}'];

  it('can sai với MỌI quyền, permissionsOf rỗng', () => {
    for (const value of STRANGE) {
      expect(permissionsOf(value), JSON.stringify(value)).toEqual([]);
      for (const action of ACTIONS) {
        expect(can(value, action), `${JSON.stringify(value)} / ${action}`).toBe(false);
      }
    }
  });

  it('assertCan ném ForbiddenError ghi vai là UNKNOWN, không mượn tên vai thật', () => {
    for (const value of STRANGE) {
      try {
        assertCan(value, 'vault:withdraw');
        expect.unreachable(`${JSON.stringify(value)} không được qua`);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        expect((error as ForbiddenError).role).toBe(UNKNOWN_ROLE);
      }
    }
  });

  it('ba quyền vault mới: chỉ CONTROLLER cấu hình và xử lý NEEDS_REVIEW, chỉ SELLER rút', () => {
    const holders = (action: Action) => ROLES.filter((role) => can(role, action));
    expect(holders('vault:configure')).toEqual(['CONTROLLER']);
    expect(holders('vault:reconcile')).toEqual(['CONTROLLER']);
    expect(holders('vault:withdraw')).toEqual(['SELLER']);
  });

  it('SELLER vẫn KHÔNG đọc được dữ liệu toàn hệ', () => {
    for (const action of ['audit:read', 'reconcile:read'] as const) {
      expect(can('SELLER', action), action).toBe(false);
    }
  });

  it('lớp hai (cấu hình, dữ liệu thử) cũng đóng với vai lạ', () => {
    for (const value of STRANGE) {
      expect(isConfigRole(value), JSON.stringify(value)).toBe(false);
      expect(() => assertCanConfigure(value)).toThrow(ForbiddenError);
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
  INVESTOR: ['token:transfer', 'portfolio:read', 'balance:read', 'txn:read'],
  /**
   * FE-20: vai MỚI, không có mốc trước BE-08 nên để rỗng.
   *
   * Rỗng ở đây là "chưa có gì phải giữ", KHÔNG phải "không cần kiểm". Để `Record` đủ bốn vai
   * thay vì `Partial` là để lần sau ai thêm vai thứ năm phải quyết định ở đây, chứ không im
   * lặng nhận một mốc rỗng mà không ai xem lại.
   */
  SELLER: [],
  /** Giao dịch viên = vai ngân hàng cũ đổi tên, nên mốc của nó chép y nguyên. */
  TELLER: [
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
  /**
   * FE-20: Kiểm soát viên nhận phần CHỈ ĐỌC của vai kiểm toán cũ, nên mốc lấy đúng ba quyền
   * đọc đó. Cố ý KHÔNG lấy mốc của vai tuân thủ cũ: ba quyền ghi của vai đó
   * (`investor:whitelist`, `kyc:approve`, `token:freeze`) chuyển sang `TELLER`, không sang đây.
   */
  CONTROLLER: ['balance:read', 'txn:read', 'audit:read'],
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
  { action: 'order:execute', allowed: ['TELLER'], why: 'chỉ ngân hàng khớp lệnh và chuyển tiền' },
  { action: 'distribution:snapshot', allowed: ['TELLER'], why: 'chốt quyền là quyết định của ngân hàng' },
  { action: 'distribution:execute', allowed: ['TELLER'], why: 'kiểm soát viên giám sát, không tự chi trả' },
  { action: 'settlement:initiate', allowed: ['TELLER'], why: 'ngân hàng điều phối đóng quỹ' },
  { action: 'settlement:set-nav', allowed: ['TELLER'], why: 'đặt giá hoàn vốn là việc của ngân hàng' },
  { action: 'settlement:confirm', allowed: ['INVESTOR'], why: 'nhà đầu tư tự xác nhận hoàn vốn' },
  { action: 'treasury:manage', allowed: ['TELLER'], why: 'quản trị ví SPV và ví chia lợi nhuận' },
  {
    action: 'reconcile:read',
    allowed: ['TELLER', 'CONTROLLER'],
    why: 'báo cáo đối soát là dữ liệu toàn hệ — nhà đầu tư và người bán chỉ xem phần của mình',
  },
  { action: 'demo:mint-payment', allowed: ['TELLER'], why: 'chỉ môi trường thử, và còn cần cờ' },
];

/**
 * Ba hành động sổ lệnh do BE-02 khai thêm, ngoài hai `order:*` mà BE-08 đã có.
 *
 * Bảng này tách khỏi `NEW_ACTIONS` chứ không nhập chung, vì `NEW_ACTIONS` là ma trận của
 * đúng 10 hành động BE-08 (đối chiếu `docs/be-08-rbac-actions/design.md` §2) và
 * `docs/tech-report.md` 3.3 đang đếm theo con số đó. Nhập chung là làm cả hai chỗ nói sai
 * nguồn gốc của quyền.
 *
 * Cần có mặt ở đây vì phép kiểm "mọi hành động đều có dòng trong bảng test" cộng hai bảng
 * lại rồi đối chiếu với `ACTIONS`.
 */
const BE02_ACTIONS: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  {
    action: 'order:expire',
    allowed: ['TELLER'],
    why: 'dọn lệnh treo là thao tác GHI, chỉ ngân hàng',
  },
  {
    action: 'order:read',
    allowed: ['INVESTOR', 'SELLER', 'TELLER', 'CONTROLLER'],
    why: 'ai cũng xem được lệnh; phạm vi ví do order:read:all quyết định',
  },
  {
    action: 'order:read:all',
    allowed: ['SELLER', 'TELLER', 'CONTROLLER'],
    why: 'bỏ trống bộ lọc ví: hai vai vận hành và Người bán (BE-14); nhà đầu tư chỉ xem ví mình',
  },
];

/**
 * Bốn cổng KHU VỰC do FE-20 khai. Bảng riêng, cùng lý do `BE02_ACTIONS` tách khỏi
 * `NEW_ACTIONS`: `NEW_ACTIONS` là ma trận của đúng 10 hành động BE-08 và
 * `docs/tech-report.md` 3.3 đang đếm theo con số đó.
 *
 * Đây là phần chốt cho ca 3, 4 và 5 của FE-20 ở tầng dữ liệu: mỗi dòng liệt kê vai ĐƯỢC
 * PHÉP, và phép kiểm chạy vòng qua `ROLES` nên chiều ngược lại (vai nào bị chặn) được kiểm
 * tự động, không phải liệt kê tay.
 */
const FE20_AREA_GATES: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  {
    action: 'seller:read',
    allowed: ['SELLER'],
    why: 'khu vực Người bán chỉ của Người bán — cũng là thứ chặn ba vai kia',
  },
  {
    action: 'ops:read',
    allowed: ['TELLER', 'CONTROLLER'],
    why: 'khu vực Vận hành mở cho cả hai vai vận hành; nhà đầu tư và người bán bị chặn (ca 3)',
  },
  {
    action: 'vault:read',
    allowed: ['TELLER', 'CONTROLLER'],
    why: 'SC-07: trạng thái vault công khai cho đúng hai vai vận hành',
  },
  {
    action: 'ops:draft:read',
    allowed: ['TELLER'],
    why: 'chỉ Giao dịch viên lập lệnh; Kiểm soát viên không lập lệnh mình sẽ duyệt (ca 5)',
  },
  {
    action: 'ops:approve:read',
    allowed: ['CONTROLLER'],
    why: 'chỉ Kiểm soát viên duyệt; Giao dịch viên không duyệt lệnh mình lập (ca 4)',
  },
  {
    action: 'wallet:connect',
    allowed: ['INVESTOR', 'SELLER'],
    why: 'chỉ hai vai khách hàng ký bằng ví trình duyệt; thao tác ngân hàng ký bằng khóa máy chủ',
  },
];

/**
 * Hai quyền nghiệp vụ lập–duyệt do BE-12 khai. Bảng riêng, cùng lý do các bảng trên tách nhau.
 *
 * Mỗi quyền đúng MỘT vai, và hai vai khác nhau — ca "không vai nào có cả hai" bên dưới kiểm
 * chiều đó cho mọi vai, kể cả vai thêm về sau.
 */
const BE12_ACTIONS: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  {
    action: 'order:draft',
    allowed: ['TELLER'],
    why: 'Giao dịch viên lập yêu cầu Mint/Burn',
  },
  {
    action: 'order:approve',
    allowed: ['CONTROLLER'],
    why: 'Kiểm soát viên duyệt hoặc từ chối yêu cầu Mint/Burn',
  },
];

/**
 * FE-22: hai quyền tạo / huỷ token TRỰC TIẾP không còn chủ, và quyền dữ liệu thử thay chỗ của chúng.
 *
 * `allowed: []` là CỐ Ý — ma trận chạy vòng qua `ROLES`, nên dòng này nói "mọi vai đều bị chặn",
 * kể cả vai thêm về sau.
 */
const FE22_ACTIONS: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  { action: 'token:mint', allowed: [], why: 'tạo token chỉ qua lập–duyệt hoặc đường dữ liệu thử' },
  { action: 'token:burn', allowed: [], why: 'huỷ token chỉ qua lập–duyệt' },
  {
    action: 'demo:mint-token',
    allowed: ['TELLER'],
    why: 'dữ liệu thử, và còn cần cờ ENABLE_DEMO_TOKEN_MINT',
  },
];

/** BE-13 QĐ-B: ba quyền ghi trên vault thanh toán SPV. */
const BE13_ACTIONS: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  { action: 'vault:configure', allowed: ['CONTROLLER'], why: 'Kiểm soát viên cấu hình khoá và ví nhận' },
  { action: 'vault:withdraw', allowed: ['SELLER'], why: 'Người bán tự rút, không qua duyệt (chốt 07/10)' },
  { action: 'vault:reconcile', allowed: ['CONTROLLER'], why: 'xử lý lệnh rút không xác định được kết cục' },
];

/**
 * FE-08 QĐ-A: một quyền ghi mới. Kiểm soát viên duyệt tổng số của kỳ chia rồi chia; Giao dịch viên
 * chỉ xem màn chia.
 */
const FE08_ACTIONS: ReadonlyArray<{ action: Action; allowed: readonly Role[]; why: string }> = [
  {
    action: 'distribution:approve',
    allowed: ['CONTROLLER'],
    why: 'không đồng VNDB nào rời quỹ chia khi chưa có Kiểm soát viên duyệt đúng số',
  },
];

/**
 * Quyền bị gỡ CÓ CHỦ Ý so với mốc trước BE-08, kèm task đã gỡ. Phép kiểm "không vai trò nào mất
 * quyền" bỏ qua đúng các cặp này và KHÔNG gì khác — gỡ thêm mà không ghi vào đây vẫn đỏ.
 */
const INTENTIONALLY_REMOVED: Partial<Record<Role, readonly Action[]>> = {
  // FE-22 việc 14: đóng đường đi vòng qua lập–duyệt.
  TELLER: ['token:mint', 'token:burn'],
};

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
  'order:expire',
  'order:draft',
  'order:approve',
  'demo:mint-token',
  'vault:configure',
  'vault:withdraw',
  'vault:reconcile',
  'distribution:approve',
];

describe('RBAC — ma trận quyền ba luồng (BE-08) + cổng khu vực (FE-20)', () => {
  it.each([...NEW_ACTIONS, ...BE02_ACTIONS, ...FE20_AREA_GATES, ...BE12_ACTIONS, ...FE22_ACTIONS, ...BE13_ACTIONS, ...FE08_ACTIONS])(
    '$action: chỉ $allowed được, các vai khác bị chặn ($why)',
    ({ action, allowed }) => {
      for (const role of ROLES) {
        const expected = allowed.includes(role);
        expect(can(role, action), `${role} × ${action} phải là ${expected}`).toBe(expected);
      }
    },
  );

  it('mọi hành động mới đều có dòng trong bảng test (R4.4)', () => {
    // Chốt bằng test để lần sau ai thêm action mà quên test là đỏ ngay, chứ không phải
    // trông vào việc người review nhớ ra.
    const covered = new Set<string>([
      ...ACTIONS_BEFORE_BE08,
      ...NEW_ACTIONS.map((row) => row.action),
      ...BE02_ACTIONS.map((row) => row.action),
      ...FE20_AREA_GATES.map((row) => row.action),
      ...BE12_ACTIONS.map((row) => row.action),
      ...FE22_ACTIONS.map((row) => row.action),
      ...BE13_ACTIONS.map((row) => row.action),
      ...FE08_ACTIONS.map((row) => row.action),
    ]);
    const missing = ACTIONS.filter((action) => !covered.has(action));
    expect(
      missing,
      `thêm dòng cho các action này vào NEW_ACTIONS, BE02_ACTIONS, FE20_AREA_GATES, BE12_ACTIONS, FE22_ACTIONS hoặc BE13_ACTIONS: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('TELLER KHÔNG đặt lệnh và KHÔNG xác nhận hoàn vốn thay nhà đầu tư', () => {
    // Ngân hàng làm thay hai việc này thì mất dấu ai đã đồng ý, và sổ kiểm toán không còn
    // dùng được để đối chiếu trách nhiệm.
    expect(can('TELLER', 'order:place')).toBe(false);
    expect(can('TELLER', 'settlement:confirm')).toBe(false);
  });

  it('CONTROLLER giám sát chứ không thực hiện giao dịch tiền', () => {
    expect(can('CONTROLLER', 'reconcile:read')).toBe(true);
    for (const action of ['order:execute', 'distribution:execute', 'settlement:set-nav'] as const) {
      expect(can('CONTROLLER', action), `CONTROLLER không được ${action}`).toBe(false);
    }
  });

  it('INVESTOR và SELLER KHÔNG có reconcile:read', () => {
    // `reconcile:read` nằm trong nhóm READ_ONLY (hai vai vận hành tự nhận), còn hai vai này
    // không spread nhóm đó. Test này chốt lại để không ai "tiện tay" thêm vào.
    for (const role of ['INVESTOR', 'SELLER'] as const) {
      expect(can(role, 'reconcile:read'), role).toBe(false);
      expect(permissionsOf(role), role).not.toContain('reconcile:read');
    }
  });

  it('vai trò lạ: không một quyền GHI nào, và từ BE-13 cũng không quyền ĐỌC nào', () => {
    for (const value of ['admin', 'ADMIN', 'BANK-ADMIN', 'AUDITOR', '', null, undefined, 42, {}, []]) {
      for (const action of ALL_WRITE_ACTIONS) {
        expect(can(value, action), `${String(value)} không được ${action}`).toBe(false);
      }
    }
    // BE-13 QĐ-A: trước đây vai lạ mượn quyền đọc của SELLER; nay không còn.
    expect(can('nguoi-la', 'balance:read')).toBe(false);
    expect(can('nguoi-la', 'txn:read')).toBe(false);
  });

  it('SELLER chỉ có đúng một quyền GHI là vault:withdraw; CONTROLLER chỉ duyệt và cấu hình, xử lý vault', () => {
    // BE-13: Người bán tự rút VNDB từ vault, ngoài ra không có quyền ghi nào.
    expect(ALL_WRITE_ACTIONS.filter((action) => can('SELLER', action))).toEqual(['vault:withdraw']);
    // Kiểm soát viên duyệt việc của người khác, không tự làm: ngoài quyền duyệt, hai quyền
    // vault (cấu hình khoá, xử lý lệnh rút cần xem xét) và FE-08 duyệt chia không có quyền ghi
    // nào, kể cả tự rút hay `distribution:execute` trực tiếp.
    const writes = ALL_WRITE_ACTIONS.filter((action) => can('CONTROLLER', action));
    expect(writes).toEqual(['order:approve', 'vault:configure', 'vault:reconcile', 'distribution:approve']);
  });

  it('BE-12 việc 4 — không vai nào có cả quyền lập lẫn quyền duyệt', () => {
    for (const role of ROLES) {
      const both = can(role, 'order:draft') && can(role, 'order:approve');
      expect(both, `${role} có cả order:draft và order:approve`).toBe(false);
    }
    // Và mỗi quyền có chủ: thiếu chủ thì luồng lập–duyệt chết mà bảng quyền trông vẫn "an toàn".
    expect(ROLES.filter((role) => can(role, 'order:draft'))).toEqual(['TELLER']);
    expect(ROLES.filter((role) => can(role, 'order:approve'))).toEqual(['CONTROLLER']);
  });

  it('không vai trò nào MẤT quyền đang có trước BE-08 (R4.3), trừ các cặp gỡ có chủ ý', () => {
    for (const role of ROLES) {
      const now = permissionsOf(role);
      const removed = INTENTIONALLY_REMOVED[role] ?? [];
      for (const action of PERMISSIONS_BEFORE_BE08[role]) {
        if (removed.includes(action)) {
          // Ngoại lệ phải ĐÚNG là đã gỡ — không để danh sách ngoại lệ thành chỗ giấu quyền còn sót.
          expect(now, `${role} phải đã gỡ ${action}`).not.toContain(action);
        } else {
          expect(now, `${role} vẫn phải có ${action}`).toContain(action);
        }
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

const setTokenFlag = (value: string | undefined) => {
  if (value === undefined) delete process.env.ENABLE_DEMO_TOKEN_MINT;
  else process.env.ENABLE_DEMO_TOKEN_MINT = value;
  resetServerEnvCache();
};

afterEach(() => {
  setFlag(undefined);
  setTokenFlag(undefined);
});

describe('demo:mint-payment — cờ trước, quyền sau', () => {
  it('KHÔNG đặt cờ thì bản PoC mặc định BẬT cho TELLER', () => {
    setFlag(undefined);
    expect(canMintDemoPayment('TELLER')).toBe(true);
  });

  it('cờ đặt false thì TELLER bị từ chối dù CÓ quyền RBAC', () => {
    // Đây là điểm chính của hai lớp: quyền RBAC vẫn có, nhưng cờ tắt là chặn.
    setFlag('false');
    expect(can('TELLER', 'demo:mint-payment')).toBe(true);
    expect(canMintDemoPayment('TELLER')).toBe(false);
  });

  it('cờ bật thì CHỈ TELLER được — cờ không tự cấp quyền cho vai khác (R2.5)', () => {
    setFlag('true');
    expect(canMintDemoPayment('TELLER')).toBe(true);
    for (const role of ['INVESTOR', 'SELLER', 'CONTROLLER'] as const) {
      expect(canMintDemoPayment(role), `${role} không được dù cờ đã bật`).toBe(false);
    }
    expect(canMintDemoPayment('nguoi-la')).toBe(false);
  });

  it('cờ tắt: assert ném lỗi nói đúng nguyên nhân là CỜ, không phải vai', () => {
    setFlag('false');
    // Người vận hành đọc log phải biết đi bật cờ. Nếu message nói "vai TELLER không có
    // quyền" thì họ sẽ đi sửa bảng quyền — sai chỗ, và mở rộng quyền một cách vô ích.
    expect(() => assertCanMintDemoPayment('TELLER')).toThrow(DemoPaymentMintDisabledError);
    expect(() => assertCanMintDemoPayment('TELLER')).toThrow(/ENABLE_DEMO_PAYMENT_MINT/);
  });

  it('lỗi cờ tắt vẫn là ForbiddenError nên toResult() quy về 403', () => {
    setFlag('false');
    try {
      assertCanMintDemoPayment('TELLER');
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
    expect(() => assertCanMintDemoPayment('CONTROLLER')).toThrow(ForbiddenError);
    expect(() => assertCanMintDemoPayment('CONTROLLER')).not.toThrow(DemoPaymentMintDisabledError);
    expect(() => assertCanMintDemoPayment('TELLER')).not.toThrow();
  });

  it('nhận các cách viết "bật" thường gặp; rỗng dùng mặc định demo, giá trị khác là tắt', () => {
    for (const on of ['true', '1', 'yes', 'on', 'TRUE', ' true ', '']) {
      setFlag(on);
      expect(canMintDemoPayment('TELLER'), `"${on}" phải là bật`).toBe(true);
    }
    for (const off of ['false', '0', 'no', 'bat']) {
      setFlag(off);
      expect(canMintDemoPayment('TELLER'), `"${off}" phải là tắt`).toBe(false);
    }
  });
});

// ===========================================================================
//  FE-22 việc 17 — đường tạo token trực tiếp cho dữ liệu thử: HAI LỚP chặn
// ===========================================================================

describe('demo:mint-token — cờ trước, quyền sau (cùng khuôn demo:mint-payment)', () => {
  /**
   * Đột biến 2 của FE-22 ("bật cờ ở môi trường thật") làm ca này đỏ: môi trường thật là nơi không
   * ai đặt cờ, nên mặc định phải là TẮT.
   */
  it('KHÔNG đặt cờ thì mặc định TẮT: Giao dịch viên bị từ chối dù có quyền', () => {
    setTokenFlag(undefined);
    expect(can('TELLER', 'demo:mint-token')).toBe(true);
    expect(canMintDemoToken('TELLER')).toBe(false);
    expect(() => assertCanMintDemoToken('TELLER')).toThrow(DemoTokenMintDisabledError);
    expect(() => assertCanMintDemoToken('TELLER')).toThrow(/ENABLE_DEMO_TOKEN_MINT/);
  });

  it('cờ bật thì CHỈ Giao dịch viên — cờ không tự cấp quyền cho vai khác', () => {
    setTokenFlag('true');
    expect(canMintDemoToken('TELLER')).toBe(true);
    for (const role of ['INVESTOR', 'SELLER', 'CONTROLLER', 'nguoi-la'] as const) {
      expect(canMintDemoToken(role), `${role} không được dù cờ đã bật`).toBe(false);
    }
    expect(() => assertCanMintDemoToken('CONTROLLER')).toThrow(ForbiddenError);
    expect(() => assertCanMintDemoToken('CONTROLLER')).not.toThrow(DemoTokenMintDisabledError);
  });

  it('hai cờ độc lập: bật cờ VNDB không mở đường tạo WPT, và ngược lại', () => {
    setFlag('true');
    setTokenFlag(undefined);
    expect(canMintDemoPayment('TELLER')).toBe(true);
    expect(canMintDemoToken('TELLER')).toBe(false);
    setFlag('false');
    setTokenFlag('true');
    expect(canMintDemoPayment('TELLER')).toBe(false);
    expect(canMintDemoToken('TELLER')).toBe(true);
  });
});

// ===========================================================================
//  BE-16 ca 3, 4 — chỉ Giao dịch viên giữ hai quyền tạo ra tiền / token mô phỏng
// ===========================================================================

describe('BE-16 — Người bán, Nhà đầu tư, Kiểm soát viên KHÔNG có quyền nạp mô phỏng', () => {
  it.each(['demo:mint-payment', 'demo:mint-token'] as const)(
    '%s: đúng một vai TELLER trong bảng quyền, Người bán KHÔNG có',
    (action) => {
      expect(ROLES.filter((role) => can(role, action))).toEqual(['TELLER']);
      expect(can('SELLER', action), 'Người bán là pháp nhân ngoài ngân hàng').toBe(false);
    },
  );

  it('cờ bật vẫn không mở cho ba vai còn lại', () => {
    setFlag('true');
    setTokenFlag('true');
    for (const role of ['SELLER', 'INVESTOR', 'CONTROLLER'] as const) {
      expect(canMintDemoPayment(role), role).toBe(false);
      expect(canMintDemoToken(role), role).toBe(false);
      expect(() => assertCanMintDemoPayment(role), role).toThrow(ForbiddenError);
    }
  });
});
