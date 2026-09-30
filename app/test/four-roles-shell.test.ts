import { describe, expect, it } from 'vitest';
import { ROLES, type Role } from '@/lib/rbac';
import {
  CHANNELS,
  CHANNEL_HOME,
  CHANNEL_ROLE,
  DEFAULT_CHANNEL,
  ROLE_CHANNEL,
  homeForRole,
  isChannel,
  type Channel,
} from '@/lib/session/channel';
import { NAV_BY_ROLE, type NavItem } from '@/components/layout/nav-config';
import { NO_PENDING_WORK, pendingWorkCounts } from '@/lib/nav/pending-work';

/**
 * FE-20 — khung bốn vai trò: menu, khu vực, điều hướng.
 *
 * Cổng khu vực (ca 3, 4, 5) nằm ở `rbac.test.ts` (bảng `FE20_AREA_GATES`) và
 * `four-roles-routes.test.ts` (đối chiếu gate với layout thật).
 */

// ===========================================================================
//  Ca 2 — menu của mỗi vai đúng tài liệu yêu cầu
// ===========================================================================

/**
 * Bảng menu CHÉP TỪ `docs/fe-20-four-roles/requirements.md` mục "Menu theo tài liệu yêu cầu".
 *
 * Chép lại ở đây thay vì đọc tệp tài liệu là có chủ ý: đọc tệp thì test chỉ kiểm mã khớp
 * tài liệu tại thời điểm chạy, nên một lần ai sửa tài liệu là test tự xanh theo và không ai
 * biết giao diện đã lệch bản đã chốt. Chép vào test làm bản đã chốt thành thứ phải sửa TƯỜNG
 * MINH, và diff của lần sửa đó là chỗ người review nhìn vào.
 *
 * `label` so sánh nguyên văn, kể cả phần "(chỉ xem)" — đó là phần nói cho người dùng biết vai
 * này không bấm được nút nào ở trang đó.
 */
const URD_MENU: Record<Role, ReadonlyArray<{ group: string | null; labels: readonly string[] }>> = {
  INVESTOR: [
    {
      group: null,
      labels: [
        'Tổng quan',
        'Giao dịch token',
        'Quản lý lệnh',
        'Rút VNDB',
        'Kết nối ví',
        'Thông tin tài khoản',
      ],
    },
  ],
  SELLER: [
    {
      group: null,
      labels: [
        'Tổng quan',
        'Danh sách giao dịch',
        'Tạo lệnh rút',
        'Kết nối ví',
        'Thông tin tài khoản',
      ],
    },
  ],
  TELLER: [
    { group: 'Vận hành', labels: ['Bảng điều khiển', 'Lập lệnh', 'Giao dịch', 'Chia lợi nhuận'] },
    { group: 'Tài khoản', labels: ['Thông tin tài khoản'] },
  ],
  CONTROLLER: [
    {
      group: 'Vận hành',
      labels: ['Bảng điều khiển', 'Giao dịch', 'Chia lợi nhuận (chỉ xem)'],
    },
    { group: 'Kiểm soát', labels: ['Phê duyệt lệnh'] },
    { group: 'Tài khoản', labels: ['Thông tin tài khoản'] },
  ],
};

const itemsOf = (role: Role): readonly NavItem[] =>
  NAV_BY_ROLE[role].groups.flatMap((group) => group.items);

describe('FE-20 ca 2 — bốn nhóm menu đúng tài liệu yêu cầu', () => {
  it.each(ROLES)('vai %s có đúng các nhóm và mục đã chốt', (role) => {
    const actual = NAV_BY_ROLE[role].groups.map((group) => ({
      group: group.label,
      labels: group.items.map((item) => item.label),
    }));
    expect(actual).toEqual(URD_MENU[role]);
  });

  it('mỗi vai có menu, không vai nào bị bỏ sót', () => {
    // `Record<Role, ...>` đã buộc điều này lúc biên dịch; test chốt thêm ở thời điểm chạy để
    // một lần ai đổi sang kiểu thưa (`Partial`) không lặng lẽ đi qua.
    for (const role of ROLES) {
      expect(NAV_BY_ROLE[role].groups.length, role).toBeGreaterThan(0);
    }
  });

  it('phím tắt KHÔNG trùng nhau trong cùng một menu', () => {
    // Trùng phím tắt thì hai mục cùng nhận một lần bấm, và mục nào thắng phụ thuộc thứ tự
    // duyệt — một lỗi chỉ hiện ra khi có người dùng bàn phím.
    for (const role of ROLES) {
      const shortcuts = itemsOf(role).map((item) => item.shortcut);
      expect(new Set(shortcuts).size, `${role}: ${shortcuts.join(', ')}`).toBe(shortcuts.length);
    }
  });

  it('đường dẫn KHÔNG trùng nhau trong cùng một menu', () => {
    for (const role of ROLES) {
      const hrefs = itemsOf(role).map((item) => item.href);
      expect(new Set(hrefs).size, `${role}: ${hrefs.join(', ')}`).toBe(hrefs.length);
    }
  });

  it('menu của hai vai khách hàng KHÔNG lẫn mục vận hành, và ngược lại', () => {
    // Đây là ca 3 ở tầng hiển thị: guard chặn được nhưng menu vẫn bày ra thì người dùng bấm
    // vào rồi nhận màn từ chối — chặn đúng mà trải nghiệm thì như hệ thống lỗi.
    const opsOnly = ['/draft', '/transactions', '/distribution', '/approvals'];
    for (const role of ['INVESTOR', 'SELLER'] as const) {
      const hrefs = itemsOf(role).map((item) => item.href);
      for (const href of opsOnly) {
        expect(hrefs, `${role} không được thấy ${href}`).not.toContain(href);
      }
    }

    const clientOnly = ['/portfolio', '/trade', '/orders', '/withdraw', '/seller'];
    for (const role of ['TELLER', 'CONTROLLER'] as const) {
      const hrefs = itemsOf(role).map((item) => item.href);
      for (const href of clientOnly) {
        expect(hrefs, `${role} không được thấy ${href}`).not.toContain(href);
      }
    }
  });
});

// ===========================================================================
//  Ca 6 — đổi vai trò thì về trang mặc định của vai đó
// ===========================================================================

describe('FE-20 ca 6 — khu vực ↔ vai trò và trang mặc định', () => {
  it('đúng bốn khu vực, một-một với bốn vai', () => {
    expect([...CHANNELS]).toEqual(['investor', 'seller', 'teller', 'controller']);
    expect(Object.keys(ROLE_CHANNEL).sort()).toEqual([...ROLES].sort());
  });

  it('CHANNEL_ROLE và ROLE_CHANNEL là hai chiều của cùng một quan hệ', () => {
    // Suy ROLE_CHANNEL từ CHANNEL_ROLE nên phép kiểm này không thể đỏ vì lệch bảng — nó chốt
    // rằng cách suy KHÔNG làm mất khoá nào (ví dụ hai khu vực trỏ về cùng một vai thì một
    // khoá bị ghi đè, và vai còn lại biến mất khỏi ROLE_CHANNEL).
    for (const channel of CHANNELS) {
      expect(ROLE_CHANNEL[CHANNEL_ROLE[channel]], channel).toBe(channel);
    }
    for (const role of ROLES) {
      expect(CHANNEL_ROLE[ROLE_CHANNEL[role]], role).toBe(role);
    }
  });

  it('mỗi khu vực có trang mặc định, và trang đó là đường dẫn tuyệt đối', () => {
    for (const channel of CHANNELS) {
      expect(CHANNEL_HOME[channel], channel).toMatch(/^\//);
    }
  });

  it('trang mặc định của vai trùng trang mặc định của khu vực tương ứng', () => {
    // `homeForRole` là thứ guard và trang chủ dùng; lệch với `CHANNEL_HOME` thì đổi vai và
    // vào trực tiếp cho ra hai trang khác nhau cho cùng một vai.
    for (const role of ROLES) {
      expect(homeForRole(role), role).toBe(CHANNEL_HOME[ROLE_CHANNEL[role]]);
    }
  });

  it('trang mặc định của mỗi vai nằm TRONG menu của vai đó', () => {
    // Đổi vai rồi hạ cánh vào một trang không có trong menu của mình là trạng thái không chỉ
    // ra được đường về: menu không có mục nào đang sáng.
    for (const role of ROLES) {
      const hrefs = itemsOf(role).map((item) => item.href);
      expect(hrefs, `${role} phải có mục ${homeForRole(role)}`).toContain(homeForRole(role));
    }
  });

  it('hai vai vận hành dùng CHUNG bảng điều khiển ở `/`', () => {
    expect(CHANNEL_HOME.teller).toBe('/');
    expect(CHANNEL_HOME.controller).toBe('/');
  });

  it('khu vực mặc định là teller — giữ nguyên hành vi trước FE-20', () => {
    expect(DEFAULT_CHANNEL).toBe('teller');
    expect(CHANNEL_HOME[DEFAULT_CHANNEL]).toBe('/');
  });

  it('giá trị khu vực lạ bị từ chối, kể cả tên khu vực cũ', () => {
    for (const value of ['admin', 'client', 'audit', 'TELLER', '', null, undefined, 42, {}]) {
      expect(isChannel(value), String(value)).toBe(false);
    }
    for (const channel of CHANNELS) {
      expect(isChannel(channel), channel).toBe(true);
    }
  });
});

// ===========================================================================
//  Yêu cầu 10 — số việc đang chờ
// ===========================================================================

describe('FE-20 — số việc đang chờ cạnh mục menu', () => {
  it('đúng hai mục mang số việc chờ, và là hai mục tài liệu chỉ định', () => {
    const withBadge = ROLES.flatMap((role) =>
      itemsOf(role)
        .filter((item) => item.pendingWork !== undefined)
        .map((item) => `${role}:${item.href}:${item.pendingWork}`),
    );
    expect(withBadge.sort()).toEqual(['CONTROLLER:/approvals:approval', 'TELLER:/draft:draft']);
  });

  it('giai đoạn này cả hai số là 0', async () => {
    await expect(pendingWorkCounts()).resolves.toEqual({ draft: 0, approval: 0 });
    expect(NO_PENDING_WORK).toEqual({ draft: 0, approval: 0 });
  });

  it('mọi khoá pendingWork đều có số tương ứng trong nguồn số', async () => {
    // Chốt để một mục menu mới mang khoá lạ là đỏ ngay, chứ không lặng lẽ hiển thị `undefined`.
    const counts = await pendingWorkCounts();
    for (const role of ROLES) {
      for (const item of itemsOf(role)) {
        if (item.pendingWork === undefined) continue;
        expect(counts[item.pendingWork], `${role}:${item.href}`).toBeTypeOf('number');
      }
    }
  });
});
