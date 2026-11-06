import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FE-UX-07a QĐ-9: liên kết "Giới thiệu dự án" ở đáy thanh bên, ngay trên ô chọn chain. Chỉ Nhà đầu tư
 * thấy (điều kiện đặt ở `sidebar.tsx`). Không phải mục menu: không nằm trong `nav`, không đánh dấu trang đang xem.
 * Thanh bên thu gọn thì chỉ còn mũi tên, tên đọc qua `aria-label`, `title` và chữ `sr-only`.
 */
export function IntroLink({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <Link
      prefetch={false}
      href="/gioi-thieu"
      onClick={onNavigate}
      aria-label={collapsed ? "Giới thiệu dự án" : undefined}
      title={collapsed ? "Giới thiệu dự án" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0",
      )}
    >
      <span className={cn(collapsed && "sr-only")}>Giới thiệu dự án</span>
      <ArrowRight className="nudge-x size-4 text-primary/50" aria-hidden="true" />
    </Link>
  );
}
