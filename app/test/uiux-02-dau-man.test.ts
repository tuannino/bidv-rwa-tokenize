import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEMO_PAYMENT_NAV_ITEM,
  NAV_BY_ROLE,
  WALLET_BINDING_NAV_ITEM,
  type NavItem,
} from '@/components/layout/nav-config';
import {
  TokenScopeSelect,
  initTokenScope,
  scopeOptions,
  tokenScopeOptions,
  tokenScopeReducer,
  type TokenScopeState,
} from '@/components/token/token-scope-select';
import type { Role } from '@/lib/rbac';

/**
 * UIUX-02: ô chọn token ở đầu màn (ca 1 tới 5b), bỏ dòng mô tả, gợi ý trên menu, tiêu đề Tổng quan,
 * `data-chain` (ca 6 tới 10). Chỉ frontend: hàm thuần, dựng tĩnh và quét mã.
 */
const SRC = path.resolve(__dirname, '../src');
const read = (file: string) => readFileSync(path.join(SRC, file), 'utf8');

const SCOPE_SCREENS = [
  'components/pages/draft.tsx',
  'components/pages/approvals.tsx',
  'components/pages/price-config.tsx',
  'components/pages/vault-status.tsx',
  'components/pages/distribution-approval.tsx',
  'components/pages/recall.tsx',
  'components/pages/investor-trade.tsx',
  'components/pages/investor-portfolio.tsx',
  'components/pages/seller-overview.tsx',
  'components/pages/seller-withdraw.tsx',
];

const DEFAULT = [{ tokenSymbol: 'WPT' }];

const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(TokenScopeSelect, { id: 'token-scope', ...props }));

const symbols = (tokens: { tokenSymbol: string }[]) => tokens.map((t) => t.tokenSymbol);

describe('UIUX-02 ô chọn token', () => {
  it('ca 1: dựng mặc định, khoá theo màn, danh sách rỗng', () => {
    const html = render();
    expect(html).toMatch(/<label[^>]*for="token-scope"[^>]*>Token<\/label>/);
    const input = /<input[^>]*>/.exec(html)?.[0] ?? '';
    expect(input).toContain('id="token-scope"');
    expect(input).toContain('role="combobox"');
    expect(input).toContain('aria-expanded="false"');
    expect(input).toContain('value="WPT"');
    expect(input).not.toContain('disabled');

    expect(/<input[^>]*>/.exec(render({ disabled: true }))?.[0]).toContain('disabled=""');

    const empty = /<input[^>]*>/.exec(render({ tokens: [] }))?.[0] ?? '';
    expect(empty).toContain('value=""');
    expect(empty).toContain('placeholder="Chưa có token"');
  });

  it('ca 2: danh sách mặc định là WPT chọn được rồi TCC khoá', () => {
    const options = tokenScopeOptions(DEFAULT, '');
    expect(symbols(options)).toEqual(['WPT', 'TCC']);
    expect(options[0].unsupportedTag).toBeUndefined();
    expect(options[1]).toEqual({ tokenSymbol: 'TCC', name: 'Tokenized Carbon Credit', unsupportedTag: '(chưa hỗ trợ)' });
  });

  it('ca 3: lọc theo mã, theo tên, xếp hạng, không phân biệt hoa thường', () => {
    expect(symbols(tokenScopeOptions(DEFAULT, 'w'))).toEqual(['WPT']);
    expect(symbols(tokenScopeOptions(DEFAULT, 'tc'))).toEqual(['TCC']);
    expect(symbols(tokenScopeOptions(DEFAULT, ' T '))).toEqual(['TCC', 'WPT']);
    expect(symbols(tokenScopeOptions(DEFAULT, 'carbon'))).toEqual(['TCC']);
    const named = [{ tokenSymbol: 'WPT', projectName: 'Dự án điện gió An Viên' }];
    expect(symbols(tokenScopeOptions(named, 'an viên'))).toEqual(['WPT']);
    expect(tokenScopeOptions(DEFAULT, 'zz')).toEqual([]);
    expect(symbols(tokenScopeOptions(DEFAULT, 'WP'))).toEqual(symbols(tokenScopeOptions(DEFAULT, 'wp')));
    expect(symbols(tokenScopeOptions(DEFAULT, 'CARBON'))).toEqual(['TCC']);
  });

  it('ca 4: 10 màn có đúng một ô chọn; màn Giao dịch token bỏ ô select cũ; Rút VNDB không dùng', () => {
    for (const file of SCOPE_SCREENS) {
      expect(read(file).match(/<TokenScopeSelect\b/g)?.length, file).toBe(1);
    }
    const trade = read('components/pages/investor-trade.tsx');
    expect(trade).not.toMatch(/<select aria-label="Token"/);
    expect(trade).not.toContain('ctx.tokens.length <= 1');
    expect(trade).toMatch(/<TokenScopeSelect[\s\S]*?disabled=\{tradeBlocked\}/);
    expect(read('components/pages/investor-withdraw.tsx')).not.toContain('TokenScopeSelect');
  });

  it('ca 5b: chuyển trạng thái của ô chọn', () => {
    const start = initTokenScope({ tokens: DEFAULT, value: undefined, disabled: false });
    const step = (state: TokenScopeState, ...actions: Parameters<typeof tokenScopeReducer>[1][]) =>
      actions.reduce(tokenScopeReducer, state);

    // Gõ trùng token đang chọn vẫn lọc theo chữ gõ.
    expect(symbols(scopeOptions(step(start, { type: 'open' }, { type: 'type', text: 'WPT' })))).toEqual(['WPT']);
    expect(symbols(scopeOptions(step(start, { type: 'open' }, { type: 'type', text: 'wpt' })))).toEqual(['WPT']);

    // Từ trạng thái đóng: mũi tên xuống mở và trỏ WPT; chọn thì đóng.
    const moved = step(start, { type: 'move', step: 1 });
    expect(moved.open).toBe(true);
    expect(scopeOptions(moved)[moved.active].tokenSymbol).toBe('WPT');
    const chosen = step(moved, { type: 'choose' });
    expect(chosen.selected).toBe('WPT');
    expect(chosen.open).toBe(false);

    // Dòng TCC không chọn được, danh sách vẫn mở.
    const opened = step(start, { type: 'open' });
    const byIndex = step(opened, { type: 'choose', index: 1 });
    expect(byIndex.selected).toBe('WPT');
    expect(byIndex.open).toBe(true);
    const typed = step(opened, { type: 'type', text: 'tc' }, { type: 'choose' });
    expect(typed.selected).toBe('WPT');
    expect(typed.open).toBe(true);

    // Khoá khi đang mở: đóng ngay, sau đó mọi thao tác không làm gì.
    const locked = step(opened, { type: 'sync', tokens: DEFAULT, value: undefined, disabled: true });
    expect(locked.open).toBe(false);
    expect(locked.active).toBe(-1);
    for (const action of [{ type: 'open' }, { type: 'type', text: 'tc' }, { type: 'choose', index: 0 }] as const) {
      expect(tokenScopeReducer(locked, action)).toBe(locked);
    }

    // Danh sách rỗng: ô trống, chỉ còn dòng TCC.
    const emptied = step(opened, { type: 'sync', tokens: [], value: undefined, disabled: false });
    expect(emptied.selected).toBe('');
    expect(emptied.text).toBe('');
    expect(symbols(scopeOptions(emptied))).toEqual(['TCC']);

    // `value` đổi từ ngoài sang token khác có trong danh sách.
    const two = [{ tokenSymbol: 'WPT' }, { tokenSymbol: 'WPT-PQY' }];
    const many = initTokenScope({ tokens: two, value: 'WPT', disabled: false });
    const changed = step(many, { type: 'sync', tokens: two, value: 'WPT-PQY', disabled: false });
    expect(changed.selected).toBe('WPT-PQY');
    expect(changed.text).toBe('WPT-PQY');
  });

  it('ca 5: ô chọn chỉ giữ trạng thái giao diện', () => {
    const source = read('components/token/token-scope-select.tsx');
    for (const banned of ['localStorage', 'sessionStorage', 'document.cookie', 'fetch(', 'useRouter', 'useSearchParams', '@/app/actions']) {
      expect(source, banned).not.toContain(banned);
    }
  });
});

/** Bảng QĐ-8, chép nguyên văn; khoá theo vai rồi `href`. */
const HINTS: Record<Role, Record<string, string>> = {
  INVESTOR: {
    '/portfolio': 'Xem số WPT đang giữ, tình trạng phát hành và các dự án đã token hoá.',
    '/trade': 'Đặt lệnh giao dịch WPT bằng VNDB theo giá phát hành.',
    '/orders': 'Theo dõi các lệnh đã đặt và trạng thái quyết toán.',
    '/withdraw': 'Chuyển VNDB từ ví của bạn sang ví nhận đã đăng ký, xác nhận bằng mã một lần.',
    '/wallet': 'Kết nối ví tự quản để xem tài sản và ký giao dịch.',
    '/account': 'Xem hồ sơ và ví gắn với tài khoản đang đăng nhập.',
  },
  SELLER: {
    '/seller': 'Xem tình hình bán token, nguồn cung và số dư ví của người bán.',
    '/seller/transactions': 'Xem lệnh mua bán đã khớp với ví người bán và các lệnh rút VNDB.',
    '/seller/withdraw': 'Rút VNDB từ vault thanh toán về ví nhận, xác nhận bằng mã một lần.',
    '/wallet': 'Kết nối ví tự quản để xem tài sản và ký giao dịch.',
    '/account': 'Xem hồ sơ và ví gắn với tài khoản đang đăng nhập.',
  },
  TELLER: {
    '/': 'Xem nhanh số liệu tổng hợp về dự án, token, nhà đầu tư và lợi tức.',
    '/draft': 'Lập yêu cầu phát hành hoặc huỷ token để Kiểm soát viên duyệt.',
    '/transactions': 'Theo dõi mọi lệnh mua bán và xử lý lệnh bị kẹt.',
    '/distribution': 'Xem các kỳ chia lợi nhuận và trạng thái chi trả.',
    '/vault': 'Xem lượng WPT, VNDB đang giữ và phần tiền bị khoá trong vault của SPV.',
    '/config': 'Đặt giá phát hành WPT và theo dõi tình trạng phát hành.',
    '/recall': 'Xem lịch và trạng thái thu hồi WPT khi dự án hết hạn.',
    '/account': 'Xem hồ sơ cán bộ của tài khoản đang đăng nhập.',
  },
  CONTROLLER: {
    '/': 'Xem nhanh số liệu tổng hợp về dự án, token, nhà đầu tư và lợi tức.',
    '/transactions': 'Theo dõi mọi lệnh mua bán và bước quyết toán hiện tại.',
    '/distribution': 'Duyệt số tiền của kỳ và chia lợi nhuận cho người nắm giữ WPT.',
    '/vault': 'Xem số dư vault của SPV, đối soát lệnh rút và cấu hình mức khoá.',
    '/config': 'Xem giá phát hành WPT và tình trạng phát hành.',
    '/recall': 'Lập lịch, đóng băng và thu hồi WPT khi dự án hết hạn.',
    '/approvals': 'Duyệt hoặc từ chối yêu cầu phát hành, huỷ token do Giao dịch viên lập.',
    '/account': 'Xem hồ sơ cán bộ của tài khoản đang đăng nhập.',
  },
};

/** Bảng QĐ-7 và câu mở đầu của dòng mô tả cũ (design mục 6). */
const OLD_SUBTITLES: Record<string, string> = {
  'components/pages/account-info.tsx': 'Thông tin hồ sơ của tài',
  'components/pages/approvals.tsx': 'Xem yêu cầu Giao dịch viên',
  'components/pages/assets.tsx': 'Mỗi dự án phát hành WPT',
  'components/pages/dashboard.tsx': 'Token hoá quyền hưởng lợi tức',
  'components/pages/distribution-approval.tsx': 'Kiểm soát viên duyệt tổng số VNDB của kỳ trên chain',
  'components/pages/draft.tsx': 'Lập yêu cầu tạo hoặc huỷ',
  'components/pages/investor-orders.tsx': 'Lệnh mua và bán của ví',
  'components/pages/investor-portfolio.tsx': 'Vị thế WPT của ví đang',
  'components/pages/investor-trade.tsx': 'Mua token từ người bán theo giá phát hành',
  'components/pages/investor-withdraw.tsx': 'Chuyển VNDB từ ví đã định',
  'components/pages/kyc.tsx': 'Duyệt KYC, whitelist ví để được',
  'components/pages/mint.tsx': 'KYC (mock auto-approve)',
  'components/pages/ops-transactions.tsx': 'Mọi lệnh mua và bán tự',
  'components/pages/price-config.tsx': 'Giá phát hành WPT áp dụng',
  'components/pages/recall.tsx': 'Thanh toán thực hiện ngoài hệ thống',
  'components/pages/reconciliation.tsx': 'So khớp sản lượng SCADA',
  'components/pages/seller-overview.tsx': 'Tình hình bán token, nguồn cung',
  'components/pages/seller-transactions.tsx': 'Lệnh mua bán token của nhà',
  'components/pages/seller-withdraw.tsx': 'về ví nhận bạn chọn',
  'components/pages/vault-status.tsx': 'Trạng thái giữ WPT, VNDB và',
  'components/pages/wallet-binding.tsx': 'Ngân hàng định danh ví trên',
  'components/pages/wallet-connect.tsx': 'Kết nối ví tự quản để xem vị thế',
  'app/(ops)/audit/page.tsx': 'Mọi lần kiểm quyền và mọi',
};

/** Gợi ý trên tiêu đề của màn không có trong menu (bảng QĐ-8, phần dưới). */
const TITLE_HINTS: Record<string, string> = {
  'app/(ops)/audit/page.tsx': 'Xem lịch sử mọi thao tác và lần kiểm quyền trong hệ thống.',
  'components/pages/mint.tsx': 'Phát hành WPT trực tiếp để tạo dữ liệu thử, chỉ dùng trong PoC.',
  'components/pages/assets.tsx': 'Xem danh sách dự án điện gió đã token hoá.',
  'components/pages/kyc.tsx': 'Xem nhà đầu tư, trạng thái định danh và whitelist ví.',
  'components/pages/reconciliation.tsx': 'So khớp sản lượng điện, hoá đơn và số liệu trên chuỗi theo từng kỳ.',
};

const navItems = (role: Role): NavItem[] => NAV_BY_ROLE[role].groups.flatMap((group) => [...group.items]);

describe('UIUX-02 dòng mô tả và gợi ý', () => {
  it('ca 6: mọi mục menu có gợi ý đúng nguyên văn QĐ-8, không ký tự cấm', () => {
    for (const role of Object.keys(HINTS) as Role[]) {
      const items = navItems(role);
      expect(items.map((item) => item.href).sort(), role).toEqual(Object.keys(HINTS[role]).sort());
      for (const item of items) expect(item.hint, `${role} ${item.href}`).toBe(HINTS[role][item.href]);
    }
    expect(DEMO_PAYMENT_NAV_ITEM.hint).toBe('Nạp VNDB thử vào ví để trình diễn, chỉ dùng trong PoC.');
    expect(WALLET_BINDING_NAV_ITEM.hint).toBe('Định danh ví trên chuỗi và gắn ví vào hồ sơ khách hàng.');
    const all = [
      ...(Object.keys(HINTS) as Role[]).flatMap((role) => navItems(role).map((item) => item.hint)),
      DEMO_PAYMENT_NAV_ITEM.hint,
      WALLET_BINDING_NAV_ITEM.hint,
      ...Object.values(TITLE_HINTS),
    ];
    for (const hint of all) {
      expect(hint.trim()).not.toBe('');
      expect(hint).not.toMatch(/[\u2014\u00b7\u2192]/);
    }
  });

  it('ca 7: menu vẫn "Bảng điều khiển", tiêu đề và breadcrumb là "Tổng quan"', () => {
    for (const role of ['TELLER', 'CONTROLLER'] as const) {
      expect(navItems(role).find((item) => item.href === '/')?.label).toBe('Bảng điều khiển');
    }
    const dashboard = read('components/pages/dashboard.tsx');
    expect(dashboard).toMatch(/<h1[^>]*>Tổng quan<\/h1>/);
    expect(dashboard).not.toContain('Tổng quan điện gió');
    expect(read('app/(ops)/page.tsx')).toContain('breadcrumbs={[{ label: "Tổng quan" }]}');
  });

  it('ca 8: không còn câu mở đầu của dòng mô tả cũ', () => {
    for (const [file, phrase] of Object.entries(OLD_SUBTITLES)) {
      expect(read(file).replace(/\s+/g, ' '), file).not.toContain(phrase);
    }
  });

  it('ca 9: data-chain đúng 4 màn; gợi ý trên 5 tiêu đề; mục menu dùng HoverHint', () => {
    for (const file of ['draft', 'ops-transactions', 'approvals', 'seller-overview']) {
      expect(read(`components/pages/${file}.tsx`), file).toContain('data-chain={chain}');
    }
    expect(read('components/pages/wallet-binding.tsx')).not.toContain('data-chain');
    for (const [file, hint] of Object.entries(TITLE_HINTS)) {
      expect(read(file), file).toMatch(new RegExp(`<HoverHint hint="${hint}" side="bottom">\\s*<h1`));
    }
    expect(read('components/layout/sidebar.tsx')).toMatch(/<HoverHint hint=\{item\.hint\}>\s*<Link/);
  });

  it('ca 10: HoverHint dựng trên tooltip có sẵn, trễ 3000 ms, có mô tả cho trình đọc màn hình', () => {
    const source = read('components/layout/hover-hint.tsx');
    expect(source).toContain("from '@/components/ui/tooltip'");
    expect(source).toContain('3000');
    expect(source).toContain('aria-describedby');
    expect(source).toContain('sr-only');
    for (const banned of ['localStorage', 'fetch(', '@/app/actions', 'setTimeout']) {
      expect(source, banned).not.toContain(banned);
    }
  });
});
