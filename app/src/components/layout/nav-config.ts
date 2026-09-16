/**
 * Cấu hình điều hướng theo KÊNH.
 *
 * Để ở file riêng (không nằm trong `sidebar.tsx`) để thêm kênh thứ tư chỉ cần thêm
 * một hằng số ở đây, không phải sửa component.
 *
 * ⚠️ File này PHẢI là dữ liệu thuần, không import component. `AppLayout` là Server
 * Component còn `Sidebar` là Client Component, nên `NavSection` đi qua biên server →
 * client và phải tuần tự hóa được. Đặt `icon` là **component** làm Next báo:
 *   Functions cannot be passed directly to Client Components ... render: function UserCheck
 * Vì vậy `icon` là TÊN biểu tượng dạng chuỗi, tra sang component trong `sidebar.tsx`
 * (xem `design.md` mục 7).
 */

/** Tên biểu tượng — phải có khoá tương ứng trong `NAV_ICONS` của `sidebar.tsx`. */
export type NavIconName =
  | "LayoutDashboard"
  | "Wind"
  | "Scale"
  | "UserCheck"
  | "Coins"
  | "ScrollText";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  shortcut: string;
};

export type NavSection = {
  /** Nhóm trên, không có tiêu đề. */
  main: readonly NavItem[];
  /** Tiêu đề của nhóm dưới. */
  moduleLabel: string;
  modules: readonly NavItem[];
};

/**
 * Kênh ngân hàng — sao y hiện trạng trước khi tách file, gồm cả nhãn và phím tắt.
 * Nhãn theo nghiệp vụ điện gió; icon chủ đề gió/turbine (xem frontend.md).
 */
export const BANK_NAV: NavSection = {
  main: [
    { href: "/", label: "Tổng quan", icon: "LayoutDashboard", shortcut: "E" },
  ],
  moduleLabel: "Module nghiệp vụ",
  modules: [
    { href: "/mint",           label: "Phát hành WPT",     icon: "Coins",      shortcut: "M" },
    { href: "/assets",         label: "Dự án điện gió",    icon: "Wind",       shortcut: "D" },
    { href: "/reconciliation", label: "Đối soát doanh thu", icon: "Scale",      shortcut: "B" },
    { href: "/kyc",            label: "Nhà đầu tư & KYC",  icon: "UserCheck",  shortcut: "A" },
    { href: "/audit",          label: "Sổ kiểm toán",      icon: "ScrollText", shortcut: "K" },
  ],
};
