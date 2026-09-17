/**
 * Cấu hình điều hướng theo KÊNH.
 *
 * Để ở file riêng (không nằm trong `sidebar.tsx`) để thêm kênh chỉ cần thêm một hằng số ở
 * đây, không phải sửa component.
 *
 * ⚠️ File này PHẢI là DỮ LIỆU THUẦN, không import component.
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
  | 'Wallet';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  shortcut: string;
  /**
   * Mục đã có trong lộ trình nhưng chưa có trang: hiển thị mờ kèm chú thích "sắp có" thay vì
   * ẩn đi, để người dùng thấy lộ trình. Mục `disabled` KHÔNG bọc `Link` nên không điều hướng
   * được — nhờ vậy không cần tạo trang chỗ trống. Khi trang xong thì bỏ cờ này.
   */
  disabled?: boolean;
}

export interface NavSection {
  /** Nhóm trên, không có tiêu đề. */
  main: readonly NavItem[];
  /** Tiêu đề của nhóm dưới. */
  moduleLabel: string;
  modules: readonly NavItem[];
}

/**
 * Kênh ngân hàng — SAO Y hiện trạng trước khi tách file, gồm cả nhãn và phím tắt.
 * Đổi bất cứ thứ gì ở đây là đổi giao diện kênh đang chạy, nên đừng "dọn dẹp" nhân thể.
 */
export const BANK_NAV: NavSection = {
  main: [{ href: '/', label: 'Tổng quan', icon: 'LayoutDashboard', shortcut: 'E' }],
  moduleLabel: 'Module nghiệp vụ',
  modules: [
    { href: '/mint', label: 'Phát hành WPT', icon: 'Coins', shortcut: 'M' },
    { href: '/assets', label: 'Dự án điện gió', icon: 'Wind', shortcut: 'D' },
    { href: '/reconciliation', label: 'Đối soát doanh thu', icon: 'Scale', shortcut: 'B' },
    { href: '/kyc', label: 'Nhà đầu tư & KYC', icon: 'UserCheck', shortcut: 'A' },
    { href: '/audit', label: 'Sổ kiểm toán', icon: 'ScrollText', shortcut: 'K' },
  ],
};

/**
 * Kênh nhà đầu tư. Ba mục cuối chưa có nghiệp vụ nên để `disabled`:
 * `/purchase` chờ FE-05, `/earnings` chờ FE-09, `/settlement` chờ FE-11.
 *
 * Đường dẫn đã chọn để KHÔNG trùng `(admin)` (`/`, `/mint`, `/assets`, `/reconciliation`,
 * `/kyc`) và `(audit)` (`/audit`) — route group không tạo phân đoạn đường dẫn nên trùng tên
 * là trùng route.
 */
export const INVESTOR_NAV: NavSection = {
  main: [
    { href: '/portfolio', label: 'Tổng quan', icon: 'LayoutDashboard', shortcut: 'E' },
    /**
     * Ví nằm ở nhóm trên, không phải "module nghiệp vụ": nó là cửa vào của mọi thao tác ký
     * chứ không phải một nghiệp vụ riêng. Phím tắt `V` chưa ai dùng (đã dùng: E M D B A K U L T).
     */
    { href: '/wallet', label: 'Ví của tôi', icon: 'Wallet', shortcut: 'V' },
  ],
  moduleLabel: 'Nghiệp vụ nhà đầu tư',
  modules: [
    { href: '/purchase', label: 'Mua WPT', icon: 'ShoppingCart', shortcut: 'U', disabled: true },
    { href: '/earnings', label: 'Lợi nhuận', icon: 'TrendingUp', shortcut: 'L', disabled: true },
    { href: '/settlement', label: 'Tất toán', icon: 'Wallet', shortcut: 'T', disabled: true },
  ],
};
