import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLES, can, type Role } from '@/lib/rbac';
import { AREAS, AREA_GATES, AREA_LABELS, type Area } from '@/lib/rbac/area-gates';
import { NAV_BY_ROLE } from '@/components/layout/nav-config';

/**
 * FE-20 — khu vực và đường dẫn: đọc CÂY ROUTE THẬT trên đĩa rồi đối chiếu.
 *
 * Vì sao đọc tệp chứ không chỉ kiểm hằng số: cây route của App Router là thư mục, không phải
 * một bảng ai đó khai. Một mục menu trỏ tới đường dẫn không có trang, hoặc một trang nằm
 * ngoài mọi khu vực (tức không có cổng nào), đều là lỗi KHÔNG thể phát hiện bằng cách đọc
 * hằng số — và cả hai đều lọt qua `tsc`.
 */

const APP_DIR = path.resolve(__dirname, '../src/app');

/** Khu vực ↔ tên thư mục route-group. `Record` đủ khoá nên thêm khu vực mà quên group là lỗi. */
const AREA_DIR: Record<Area, string> = {
  investor: '(investor)',
  seller: '(seller)',
  ops: '(ops)',
  draft: '(ops-draft)',
  approval: '(control)',
  wallet: '(wallet)',
  account: '(account)',
};

/**
 * Quét mọi `page.tsx` trong một route-group và suy ra đường dẫn URL.
 *
 * Route-group KHÔNG tạo phân đoạn đường dẫn, nên tên group bị loại khỏi URL — đó cũng là lý
 * do hai group khác nhau không được chứa cùng một đường dẫn.
 */
function routesIn(dir: string): string[] {
  const root = path.join(APP_DIR, dir);
  const found: string[] = [];

  const walk = (current: string, urlParts: string[]) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) {
        // Thư mục bọc trong ngoặc là route-group: không góp phân đoạn nào vào URL.
        walk(full, entry.startsWith('(') ? urlParts : [...urlParts, entry]);
      } else if (entry === 'page.tsx') {
        found.push('/' + urlParts.join('/'));
      }
    }
  };

  walk(root, []);
  return found.map((route) => (route === '/' ? '/' : route.replace(/\/$/, ''))).sort();
}

const ROUTES_BY_AREA = Object.fromEntries(
  AREAS.map((area) => [area, routesIn(AREA_DIR[area])]),
) as Record<Area, string[]>;

const ALL_ROUTES = AREAS.flatMap((area) => ROUTES_BY_AREA[area]);

/** Vai nào vào được khu vực nào — suy từ `AREA_GATES`, không liệt kê lại. */
const rolesAllowedIn = (area: Area): Role[] =>
  ROLES.filter((role) => AREA_GATES[area].some((action) => can(role, action)));

// ===========================================================================
//  Cấu trúc: mọi trang nằm trong một khu vực có cổng
// ===========================================================================

describe('FE-20 — cây route khớp bảng khu vực', () => {
  it('mỗi khu vực có layout gắn ĐÚNG cổng của mình', () => {
    // Đọc tệp layout thật: `AREA_GATES` đúng mà layout nối sai cổng thì guard chặn sai vai,
    // và không phép kiểm nào trên hằng số bắt được.
    for (const area of AREAS) {
      const source = readFileSync(path.join(APP_DIR, AREA_DIR[area], 'layout.tsx'), 'utf8');
      expect(source, `${AREA_DIR[area]} phải dùng AREA_GATES.${area}`).toContain(
        `AREA_GATES.${area}`,
      );
      expect(source, `${AREA_DIR[area]} phải dùng AREA_LABELS.${area}`).toContain(
        `AREA_LABELS.${area}`,
      );
    }
  });

  it('KHÔNG trang nào nằm ngoài route-group (trừ layout gốc)', () => {
    // Trang ngoài group là trang không có cổng nào: ai cũng vào được, và không có chỗ nào ghi
    // rằng đó là chủ ý. `/` từng ở đây trước FE-20 — nay nằm trong (ops).
    const stray = readdirSync(APP_DIR).filter(
      (entry) => statSync(path.join(APP_DIR, entry)).isFile() && entry === 'page.tsx',
    );
    expect(stray, 'src/app/page.tsx phải nằm trong một route-group').toEqual([]);
  });

  it('KHÔNG hai khu vực nào chứa cùng một đường dẫn', () => {
    // Route-group không tạo phân đoạn, nên trùng đường dẫn giữa hai group là trùng route —
    // Next.js sẽ báo lỗi lúc dựng, nhưng ở đây thì báo kèm tên hai khu vực.
    const seen = new Map<string, Area>();
    for (const area of AREAS) {
      for (const route of ROUTES_BY_AREA[area]) {
        const other = seen.get(route);
        expect(other, `${route} có ở cả ${other} và ${area}`).toBeUndefined();
        seen.set(route, area);
      }
    }
  });

  it('mọi mục menu trỏ tới một trang có thật', () => {
    for (const role of ROLES) {
      for (const item of NAV_BY_ROLE[role].groups.flatMap((group) => group.items)) {
        if (item.disabled === true) continue;
        expect(ALL_ROUTES, `${role}: menu trỏ tới ${item.href} mà không có trang`).toContain(
          item.href,
        );
      }
    }
  });

  it('mọi mục menu của một vai nằm trong khu vực vai đó VÀO ĐƯỢC', () => {
    // Đây là lỗi tệ nhất mà khung này có thể có: menu bày một mục, bấm vào ra màn từ chối.
    // Chặn đúng nhưng người dùng đọc là hệ thống lỗi.
    for (const role of ROLES) {
      for (const item of NAV_BY_ROLE[role].groups.flatMap((group) => group.items)) {
        if (item.disabled === true) continue;
        const area = AREAS.find((candidate) => ROUTES_BY_AREA[candidate].includes(item.href));
        expect(area, `${item.href} không thuộc khu vực nào`).toBeDefined();
        expect(
          rolesAllowedIn(area as Area),
          `${role} thấy mục ${item.href} nhưng không vào được khu vực ${area}`,
        ).toContain(role);
      }
    }
  });
});

// ===========================================================================
//  Ca 3, 4, 5 — mỗi vai chỉ vào được khu vực của mình, kiểm CẢ HAI chiều
// ===========================================================================

/**
 * Ai vào được khu vực nào. Viết ra tường minh, không suy từ `AREA_GATES` — suy từ chính thứ
 * đang kiểm thì phép kiểm luôn xanh.
 */
const EXPECTED_ACCESS: Record<Area, readonly Role[]> = {
  investor: ['INVESTOR'],
  seller: ['SELLER'],
  ops: ['TELLER', 'CONTROLLER'],
  draft: ['TELLER'],
  approval: ['CONTROLLER'],
  wallet: ['INVESTOR', 'SELLER'],
  account: ['INVESTOR', 'SELLER', 'TELLER', 'CONTROLLER'],
};

describe('FE-20 ca 3, 4, 5 — cổng khu vực chặn đúng hai chiều', () => {
  it.each(AREAS)('khu vực %s: đúng tập vai đã chốt vào được, các vai khác bị chặn', (area) => {
    for (const role of ROLES) {
      const expected = EXPECTED_ACCESS[area].includes(role);
      const actual = AREA_GATES[area].some((action) => can(role, action));
      expect(actual, `${role} × ${AREA_LABELS[area]} phải là ${expected}`).toBe(expected);
    }
  });

  it('ca 3 — nhà đầu tư bị chặn khỏi Vận hành, và hai vai vận hành bị chặn khỏi Nhà đầu tư', () => {
    expect(rolesAllowedIn('ops')).not.toContain('INVESTOR');
    expect(rolesAllowedIn('investor')).toEqual(['INVESTOR']);
  });

  it('ca 4 — Kiểm soát viên vào được Phê duyệt, Giao dịch viên thì không', () => {
    expect(rolesAllowedIn('approval')).toEqual(['CONTROLLER']);
  });

  it('ca 5 — Giao dịch viên vào được Lập lệnh, Kiểm soát viên thì không', () => {
    expect(rolesAllowedIn('draft')).toEqual(['TELLER']);
  });

  it('KHÔNG vai nào vào được cả Lập lệnh lẫn Phê duyệt', () => {
    // Bất biến của mô hình lập–duyệt. Một vai giữ cả hai cổng là mất lớp kiểm soát thứ hai,
    // và đó là loại lỗi cấp quyền không ai nhận ra khi đọc từng dòng bảng quyền.
    for (const role of ROLES) {
      const both =
        AREA_GATES.draft.some((a) => can(role, a)) &&
        AREA_GATES.approval.some((a) => can(role, a));
      expect(both, `${role} giữ cả hai cổng lập và duyệt`).toBe(false);
    }
  });
});

// ===========================================================================
//  Ca 7 — ba màn đã có vẫn còn, và vẫn ở khu vực đúng
// ===========================================================================

describe('FE-20 ca 7 — ba màn đã có vẫn chạy', () => {
  it('tổng quan nhà đầu tư và chi tiết token ở khu vực Nhà đầu tư', () => {
    expect(ROUTES_BY_AREA.investor).toContain('/portfolio');
    expect(ROUTES_BY_AREA.investor).toContain('/tokens/[symbol]');
  });

  it('kết nối ví mở cho ĐÚNG hai vai khách hàng', () => {
    // Tài liệu yêu cầu cho CẢ Nhà đầu tư và Người bán mục Kết nối ví. Để /wallet trong
    // (investor) thì Người bán bị chặn khỏi ví của chính mình; để nó dưới một cổng cả bốn
    // vai đều qua thì hai vai vận hành cũng vào được, trái thiết kế ký bằng khóa máy chủ.
    expect(ROUTES_BY_AREA.wallet).toEqual(['/wallet']);
    expect(rolesAllowedIn('wallet')).toEqual(['INVESTOR', 'SELLER']);
  });

  it('thông tin tài khoản mở cho cả bốn vai', () => {
    expect(ROUTES_BY_AREA.account).toEqual(['/account']);
    expect(rolesAllowedIn('account')).toEqual([...ROLES]);
  });

  it('bảng điều khiển vẫn ở `/` và nay có cổng Vận hành', () => {
    expect(ROUTES_BY_AREA.ops).toContain('/');
  });

  it('bốn màn rời và sổ kiểm toán vẫn còn mã, dù không có trong menu', () => {
    // Yêu cầu FE-20: không xóa mã của bảng điều khiển và các màn đã có. Chúng không vào menu
    // vì menu phải khớp tài liệu yêu cầu — trang /draft ghi rõ việc này cho FE-22.
    for (const route of ['/mint', '/kyc', '/assets', '/reconciliation', '/audit']) {
      expect(ROUTES_BY_AREA.ops, `${route} phải còn trong (ops)`).toContain(route);
    }

    const inMenu = new Set(
      ROLES.flatMap((role) =>
        NAV_BY_ROLE[role].groups.flatMap((group) => group.items.map((item) => item.href)),
      ),
    );
    for (const route of ['/mint', '/kyc', '/assets', '/reconciliation', '/audit']) {
      expect(inMenu.has(route), `${route} chưa nên vào menu — tài liệu không có mục này`).toBe(
        false,
      );
    }
  });

  it('khu vực của vai trò Kiểm toán cũ đã gỡ', () => {
    const groups = readdirSync(APP_DIR).filter((entry) => entry.startsWith('('));
    expect(groups).not.toContain('(audit)');
    expect(groups).not.toContain('(admin)');
    expect(groups).not.toContain('(client)');
    expect(groups.sort()).toEqual(AREAS.map((area) => AREA_DIR[area]).sort());
  });
});
