import type { Role } from '@/lib/rbac';

/**
 * Cấu hình điều hướng theo VAI TRÒ.
 *
 * Để ở file riêng (không nằm trong `sidebar.tsx`) để thêm vai chỉ cần thêm một hằng số ở
 * đây, không phải sửa component.
 *
 * ⚠️ File này PHẢI là DỮ LIỆU THUẦN, không import component, không import module
 * `server-only`. Nó bị `sidebar.tsx` (`'use client'`) nhập vào.
 *
 * Lý do không phải giả thuyết: `AppLayout` được dùng bên trong từng page (Server Component)
 * còn `Sidebar` là `'use client'`, nên `NavSection` bắt buộc đi qua biên server → client.
 * FE-01 v1 để `icon` là component và gặp lỗi thật:
 *
 *   Error: Functions cannot be passed directly to Client Components unless you explicitly
 *   expose it by marking it with "use server".
 *   {$$typeof: ..., render: function UserCheck}
 *
 * Vì vậy `icon` là TÊN biểu tượng dạng chuỗi, tra sang component qua bảng `NAV_ICONS`
 * đặt trong `sidebar.tsx` (phía client).
 *
 * Cách "thêm 'use client' vào file này" KHÔNG giải quyết gốc: prop vẫn phải tuần tự hoá khi
 * qua biên, và nó buộc `AppLayout` thành Client Component, mất khả năng render phía server
 * của mọi trang đang dùng.
 */

/** Tên biểu tượng — phải có khoá tương ứng trong `NAV_ICONS` của `sidebar.tsx`. */
export type NavIconName =
  | 'LayoutDashboard'
  | 'Wind'
  | 'Scale'
  | 'UserCheck'
  | 'Coins'
  | 'ScrollText'
  | 'ShoppingCart'
  | 'TrendingUp'
  | 'Wallet'
  | 'Banknote'
  | 'UserCog'
  | 'ClipboardList'
  | 'ShieldCheck'
  | 'ArrowLeftRight'
  | 'Receipt'
  | 'Undo2'
  | 'BadgeCheck';

/**
 * Mục menu nào mang **số việc đang chờ**.
 *
 * Là KHOÁ (chuỗi), không phải con số: `nav-config.ts` là dữ liệu tĩnh, còn con số phải đọc
 * lúc chạy. Để con số ngay đây thì nó bị đóng băng vào module và không có chỗ nào nối dữ liệu
 * thật vào mà không sửa lại chính bảng menu.
 *
 * Tài liệu yêu cầu chỉ định đúng hai mục: Lập lệnh của Giao dịch viên, Phê duyệt lệnh của
 * Kiểm soát viên.
 */
export type PendingWorkKey = 'draft' | 'approval';

/** Số việc đang chờ theo khoá. `Record` đủ khoá nên thêm khoá mà quên nguồn số là lỗi biên dịch. */
export type PendingWorkCounts = Record<PendingWorkKey, number>;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  shortcut: string;
  /**
   * Mục đã có trong lộ trình nhưng chưa có trang: hiển thị mờ kèm chú thích "sắp có" thay vì
   * ẩn đi, để người dùng thấy lộ trình. Mục `disabled` KHÔNG bọc `Link` nên không điều hướng
   * được — nhờ vậy không cần tạo trang chỗ trống. Khi trang xong thì bỏ cờ này.
   *
   * ⚠️ FE-20 KHÔNG dùng cờ này cho các màn mới: yêu cầu 8 đòi trang chỗ trống ghi rõ task sẽ
   * thay thế, mà mục `disabled` thì bấm không ra trang nào nên không có chỗ ghi. Cờ giữ lại
   * cho trường hợp thật sự chưa có đường dẫn.
   */
  disabled?: boolean;
  /** Có mang số việc đang chờ thì ghi khoá ở đây; `sidebar.tsx` tra số theo khoá. */
  pendingWork?: PendingWorkKey;
  /** UIUX-02 QĐ-8: mô tả ngắn chức năng màn, hiện khi dừng chuột trên mục menu (`HoverHint`). */
  hint: string;
}

export interface NavGroup {
  /** `null` = nhóm trên cùng, không có tiêu đề. */
  label: string | null;
  items: readonly NavItem[];
  /**
   * FIX-01 C1: nhóm thu gọn được. Mặc định thu gọn; mở sẵn khi trang đang xem nằm trong nhóm.
   * Nhóm thu gọn phải có `label` (tiêu đề là nút mở, đóng).
   */
  collapsible?: boolean;
}

/**
 * Menu của một vai = danh sách nhóm.
 *
 * FE-20 đổi từ hình dạng cũ (`main` + một `moduleLabel` + `modules`) sang danh sách nhóm vì
 * Kiểm soát viên cần **ba** nhóm theo tài liệu yêu cầu: Vận hành, Kiểm soát, Tài khoản.
 * Hình dạng cũ chỉ chứa được hai nhóm, nên nhồi nhóm thứ ba vào đó sẽ phải trộn "Phê duyệt
 * lệnh" chung với một nhóm khác — tức bày sai cấu trúc mà tài liệu đã chốt.
 */
export interface NavSection {
  groups: readonly NavGroup[];
}

/** Nhà đầu tư — một nhóm, đúng sáu mục theo tài liệu yêu cầu. */
export const INVESTOR_NAV: NavSection = {
  groups: [
    {
      label: null,
      items: [
        {
          href: '/portfolio',
          label: 'Tổng quan',
          icon: 'LayoutDashboard',
          shortcut: 'E',
          hint: 'Xem số WPT đang giữ, tình trạng phát hành và các dự án đã token hoá.',
        },
        {
          href: '/trade',
          label: 'Giao dịch token',
          icon: 'ShoppingCart',
          shortcut: 'G',
          hint: 'Đặt lệnh giao dịch WPT bằng VNDB theo giá phát hành.',
        },
        {
          href: '/orders',
          label: 'Quản lý lệnh',
          icon: 'ScrollText',
          shortcut: 'Q',
          hint: 'Theo dõi các lệnh đã đặt và trạng thái quyết toán.',
        },
        {
          href: '/withdraw',
          label: 'Rút VNDB',
          icon: 'Banknote',
          shortcut: 'R',
          hint: 'Chuyển VNDB từ ví của bạn sang ví nhận đã đăng ký, xác nhận bằng mã một lần.',
        },
        /**
         * Kết nối ví KHÔNG có trong bản tài liệu yêu cầu hiện tại nhưng đã làm ở FE-02 và
         * Owner đã xác nhận giữ. Tài liệu sẽ được bổ sung sau.
         */
        {
          href: '/wallet',
          label: 'Kết nối ví',
          icon: 'Wallet',
          shortcut: 'V',
          hint: 'Kết nối ví tự quản để xem tài sản và ký giao dịch.',
        },
        {
          href: '/account',
          label: 'Thông tin tài khoản',
          icon: 'UserCog',
          shortcut: 'T',
          hint: 'Xem hồ sơ và ví gắn với tài khoản đang đăng nhập.',
        },
      ],
    },
  ],
};

/** Người bán — một nhóm, đúng năm mục theo tài liệu yêu cầu. */
export const SELLER_NAV: NavSection = {
  groups: [
    {
      label: null,
      items: [
        {
          href: '/seller',
          label: 'Tổng quan',
          icon: 'LayoutDashboard',
          shortcut: 'E',
          hint: 'Xem tình hình bán token, nguồn cung và số dư ví của người bán.',
        },
        {
          href: '/seller/transactions',
          label: 'Danh sách giao dịch',
          icon: 'Receipt',
          shortcut: 'D',
          hint: 'Xem lệnh mua bán đã khớp với ví người bán và các lệnh rút VNDB.',
        },
        {
          href: '/seller/withdraw',
          label: 'Tạo lệnh rút',
          icon: 'Banknote',
          shortcut: 'R',
          hint: 'Rút VNDB từ vault thanh toán về ví nhận, xác nhận bằng mã một lần.',
        },
        {
          href: '/wallet',
          label: 'Kết nối ví',
          icon: 'Wallet',
          shortcut: 'V',
          hint: 'Kết nối ví tự quản để xem tài sản và ký giao dịch.',
        },
        {
          href: '/account',
          label: 'Thông tin tài khoản',
          icon: 'UserCog',
          shortcut: 'T',
          hint: 'Xem hồ sơ và ví gắn với tài khoản đang đăng nhập.',
        },
      ],
    },
  ],
};

/** Giao dịch viên — hai nhóm: Vận hành, Tài khoản. */
export const TELLER_NAV: NavSection = {
  groups: [
    {
      label: 'Vận hành',
      items: [
        {
          href: '/',
          label: 'Bảng điều khiển',
          icon: 'LayoutDashboard',
          shortcut: 'E',
          hint: 'Xem nhanh số liệu tổng hợp về dự án, token, nhà đầu tư và lợi tức.',
        },
        {
          href: '/draft',
          label: 'Lập lệnh',
          icon: 'ClipboardList',
          shortcut: 'L',
          hint: 'Lập yêu cầu phát hành hoặc huỷ token để Kiểm soát viên duyệt.',
          pendingWork: 'draft',
        },
        {
          href: '/transactions',
          label: 'Giao dịch',
          icon: 'ArrowLeftRight',
          shortcut: 'G',
          hint: 'Theo dõi mọi lệnh mua bán và xử lý lệnh bị kẹt.',
        },
        /**
         * FE-08 QĐ-A: Giao dịch viên chỉ xem màn chia; người duyệt và bấm chia là Kiểm soát viên
         * (`distribution:approve`). Nhãn nói rõ để người dùng không đi tìm nút không có.
         */
        {
          href: '/distribution',
          label: 'Chia lợi nhuận (chỉ xem)',
          icon: 'TrendingUp',
          shortcut: 'C',
          hint: 'Xem các kỳ chia lợi nhuận và trạng thái chi trả.',
        },
        {
          href: '/vault',
          label: 'Vault thanh toán SPV',
          icon: 'Banknote',
          shortcut: 'K',
          hint: 'Xem lượng WPT, VNDB đang giữ và phần tiền bị khoá trong vault của SPV.',
        },
        /** FE-07: Giao dịch viên đặt giá; Kiểm soát viên xem cùng màn, không có khối "Đổi giá". */
        {
          href: '/config',
          label: 'Giá và phát hành',
          icon: 'Coins',
          shortcut: 'H',
          hint: 'Đặt giá phát hành WPT và theo dõi tình trạng phát hành.',
        },
        {
          href: '/recall',
          label: 'Thu hồi token (chỉ xem)',
          icon: 'Undo2',
          shortcut: 'U',
          hint: 'Xem lịch và trạng thái thu hồi WPT khi dự án hết hạn.',
        },
      ],
    },
    {
      label: 'Tài khoản',
      items: [
        {
          href: '/account',
          label: 'Thông tin tài khoản',
          icon: 'UserCog',
          shortcut: 'T',
          hint: 'Xem hồ sơ cán bộ của tài khoản đang đăng nhập.',
        },
      ],
    },
  ],
};

/** Kiểm soát viên — ba nhóm: Vận hành, Kiểm soát, Tài khoản. */
export const CONTROLLER_NAV: NavSection = {
  groups: [
    {
      label: 'Vận hành',
      items: [
        {
          href: '/',
          label: 'Bảng điều khiển',
          icon: 'LayoutDashboard',
          shortcut: 'E',
          hint: 'Xem nhanh số liệu tổng hợp về dự án, token, nhà đầu tư và lợi tức.',
        },
        {
          href: '/transactions',
          label: 'Giao dịch',
          icon: 'ArrowLeftRight',
          shortcut: 'G',
          hint: 'Theo dõi mọi lệnh mua bán và bước quyết toán hiện tại.',
        },
        /** FE-08: Kiểm soát viên duyệt tổng số của kỳ rồi chia (`distribution:approve`). */
        {
          href: '/distribution',
          label: 'Chia lợi nhuận',
          icon: 'TrendingUp',
          shortcut: 'C',
          hint: 'Duyệt số tiền của kỳ và chia lợi nhuận cho người nắm giữ WPT.',
        },
        {
          href: '/vault',
          label: 'Vault thanh toán SPV',
          icon: 'Banknote',
          shortcut: 'K',
          hint: 'Xem số dư vault của SPV, đối soát lệnh rút và cấu hình mức khoá.',
        },
        /** FE-07: Giao dịch viên đặt giá; Kiểm soát viên xem cùng màn, không có khối "Đổi giá". */
        {
          href: '/config',
          label: 'Giá và phát hành',
          icon: 'Coins',
          shortcut: 'H',
          hint: 'Xem giá phát hành WPT và tình trạng phát hành.',
        },
        {
          href: '/recall',
          label: 'Thu hồi token',
          icon: 'Undo2',
          shortcut: 'U',
          hint: 'Lập lịch, đóng băng và thu hồi WPT khi dự án hết hạn.',
        },
      ],
    },
    {
      label: 'Kiểm soát',
      items: [
        {
          href: '/approvals',
          label: 'Phê duyệt lệnh',
          icon: 'ShieldCheck',
          shortcut: 'P',
          hint: 'Duyệt hoặc từ chối yêu cầu phát hành, huỷ token do Giao dịch viên lập.',
          pendingWork: 'approval',
        },
      ],
    },
    {
      label: 'Tài khoản',
      items: [
        {
          href: '/account',
          label: 'Thông tin tài khoản',
          icon: 'UserCog',
          shortcut: 'T',
          hint: 'Xem hồ sơ cán bộ của tài khoản đang đăng nhập.',
        },
      ],
    },
  ],
};

/**
 * Mục Nạp VNDB mô phỏng (BE-16). KHÔNG nằm trong menu tĩnh của vai nào: nó chỉ xuất hiện khi chốt
 * chặn phía máy chủ cho phép (cờ `ENABLE_DEMO_PAYMENT_MINT` bật VÀ vai có `demo:mint-payment`), và
 * menu theo tài liệu yêu cầu không có mục này.
 */
export const DEMO_PAYMENT_NAV_ITEM: NavItem = {
  href: '/demo-payment',
  label: 'Nạp VNDB',
  icon: 'Coins',
  shortcut: 'N',
  hint: 'Nạp VNDB thử vào ví để trình diễn, chỉ dùng trong PoC.',
};

/** Mục Định danh ví (FIX-01 C2): chỉ vai có `investor:whitelist`, tức Giao dịch viên. */
export const WALLET_BINDING_NAV_ITEM: NavItem = {
  href: '/wallet-binding',
  label: 'Định danh ví',
  icon: 'BadgeCheck',
  shortcut: 'I',
  hint: 'Định danh ví trên chuỗi và gắn ví vào hồ sơ khách hàng.',
};

export const HIDDEN_OPS_GROUP_LABEL = 'Nghiệp vụ ẩn';

/**
 * Chèn nhóm thu gọn "Nghiệp vụ ẩn" ngay sau nhóm đầu tiên (FIX-01 QĐ-5, C2): Nạp VNDB (khi
 * `demoPayment`) rồi Định danh ví (khi `walletBinding`). Không có mục nào thì menu giữ nguyên. Hai cờ
 * PHẢI tính ở máy chủ (`AppLayout`) bằng đúng hàm chốt chặn của trang: `canMintDemoPayment(role)` và
 * `can(role, 'investor:whitelist')`, để menu và chốt chặn đọc cùng một nguồn.
 */
export function withHiddenOps(
  nav: NavSection,
  input: { demoPayment: boolean; walletBinding: boolean },
): NavSection {
  const items = [
    ...(input.demoPayment ? [DEMO_PAYMENT_NAV_ITEM] : []),
    ...(input.walletBinding ? [WALLET_BINDING_NAV_ITEM] : []),
  ];
  if (items.length === 0) return nav;
  const [first, ...rest] = nav.groups;
  return { groups: [first, { label: HIDDEN_OPS_GROUP_LABEL, collapsible: true, items }, ...rest] };
}

/**
 * Menu theo vai — `Record` đủ bốn vai nên thêm vai mà quên menu là lỗi biên dịch.
 *
 * Tra theo VAI chứ không theo cookie khu vực là có chủ ý: vai là thứ `ChannelGuard` dùng để
 * quyết định cho vào hay không. Tra theo khu vực thì một cookie khu vực đặt tay có thể bày
 * menu Giao dịch viên cho người mang vai nhà đầu tư — menu nói một đằng, guard làm một nẻo.
 */
export const NAV_BY_ROLE: Record<Role, NavSection> = {
  INVESTOR: INVESTOR_NAV,
  SELLER: SELLER_NAV,
  TELLER: TELLER_NAV,
  CONTROLLER: CONTROLLER_NAV,
};
