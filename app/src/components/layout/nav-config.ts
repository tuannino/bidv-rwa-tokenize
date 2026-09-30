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
  | 'Receipt';

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
}

export interface NavGroup {
  /** `null` = nhóm trên cùng, không có tiêu đề. */
  label: string | null;
  items: readonly NavItem[];
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
        { href: '/portfolio', label: 'Tổng quan', icon: 'LayoutDashboard', shortcut: 'E' },
        { href: '/trade', label: 'Giao dịch token', icon: 'ShoppingCart', shortcut: 'G' },
        { href: '/orders', label: 'Quản lý lệnh', icon: 'ScrollText', shortcut: 'Q' },
        { href: '/withdraw', label: 'Rút VNDB', icon: 'Banknote', shortcut: 'R' },
        /**
         * Kết nối ví KHÔNG có trong bản tài liệu yêu cầu hiện tại nhưng đã làm ở FE-02 và
         * Owner đã xác nhận giữ. Tài liệu sẽ được bổ sung sau.
         */
        { href: '/wallet', label: 'Kết nối ví', icon: 'Wallet', shortcut: 'V' },
        { href: '/account', label: 'Thông tin tài khoản', icon: 'UserCog', shortcut: 'T' },
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
        { href: '/seller', label: 'Tổng quan', icon: 'LayoutDashboard', shortcut: 'E' },
        {
          href: '/seller/transactions',
          label: 'Danh sách giao dịch',
          icon: 'Receipt',
          shortcut: 'D',
        },
        { href: '/seller/withdraw', label: 'Tạo lệnh rút', icon: 'Banknote', shortcut: 'R' },
        { href: '/wallet', label: 'Kết nối ví', icon: 'Wallet', shortcut: 'V' },
        { href: '/account', label: 'Thông tin tài khoản', icon: 'UserCog', shortcut: 'T' },
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
        { href: '/', label: 'Bảng điều khiển', icon: 'LayoutDashboard', shortcut: 'E' },
        {
          href: '/draft',
          label: 'Lập lệnh',
          icon: 'ClipboardList',
          shortcut: 'L',
          pendingWork: 'draft',
        },
        { href: '/transactions', label: 'Giao dịch', icon: 'ArrowLeftRight', shortcut: 'G' },
        { href: '/distribution', label: 'Chia lợi nhuận', icon: 'TrendingUp', shortcut: 'C' },
      ],
    },
    {
      label: 'Tài khoản',
      items: [{ href: '/account', label: 'Thông tin tài khoản', icon: 'UserCog', shortcut: 'T' }],
    },
  ],
};

/** Kiểm soát viên — ba nhóm: Vận hành, Kiểm soát, Tài khoản. */
export const CONTROLLER_NAV: NavSection = {
  groups: [
    {
      label: 'Vận hành',
      items: [
        { href: '/', label: 'Bảng điều khiển', icon: 'LayoutDashboard', shortcut: 'E' },
        { href: '/transactions', label: 'Giao dịch', icon: 'ArrowLeftRight', shortcut: 'G' },
        /**
         * Nhãn nói rõ "chỉ xem" vì đây là CÙNG đường dẫn Giao dịch viên dùng để chia. Khác
         * nhau ở quyền: vai này không có `distribution:snapshot` / `distribution:execute` nên
         * không bấm được nút nào. Không nói ra thì người dùng đi tìm nút không tồn tại.
         */
        {
          href: '/distribution',
          label: 'Chia lợi nhuận (chỉ xem)',
          icon: 'TrendingUp',
          shortcut: 'C',
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
          pendingWork: 'approval',
        },
      ],
    },
    {
      label: 'Tài khoản',
      items: [{ href: '/account', label: 'Thông tin tài khoản', icon: 'UserCog', shortcut: 'T' }],
    },
  ],
};

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
