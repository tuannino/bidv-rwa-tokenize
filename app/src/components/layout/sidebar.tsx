"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wind,
  Scale,
  UserCheck,
  Coins,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BidvLogo } from "@/components/bidv-logo";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { usePublicConfig } from "@/lib/config/config-context";
import type { NavIconName, NavItem, NavSection } from "./nav-config";

/**
 * Bảng tra biểu tượng, đặt ở phía client.
 *
 * `nav-config.ts` chỉ giữ TÊN biểu tượng dạng chuỗi vì `NavSection` đi từ Server
 * Component (`AppLayout`) sang Client Component này qua props, mà hàm thì không tuần
 * tự hóa được. Thêm biểu tượng mới: thêm khoá ở đây và vào `NavIconName`.
 */
const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Wind,
  Scale,
  UserCheck,
  Coins,
  ScrollText,
};

export function Sidebar({ nav }: { nav: NavSection }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center px-4 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <BidvLogo variant="full" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {nav.main.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        <div className="pt-4 pb-1.5 px-2">
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            {nav.moduleLabel}
          </span>
        </div>

        {nav.modules.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href || pathname.startsWith(item.href + "/")}
          />
        ))}
      </nav>

      {/* Network status */}
      <NetworkStatus />
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = NAV_ICONS[item.icon];

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <Icon className={cn("h-4 w-4", active && "text-primary")} />
        {item.label}
      </div>
      <span
        className={cn(
          "text-[10px] font-mono px-1.5 py-0.5 rounded border",
          active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        {item.shortcut}
      </span>
    </>
  );

  // Mục chưa có trang: KHÔNG bọc Link để không điều hướng được, nhưng vẫn nằm trong
  // luồng đọc của trình đọc màn hình nhờ aria-disabled (khác với việc ẩn hẳn).
  if (item.disabled) {
    return (
      <div
        aria-disabled="true"
        title="Sắp có"
        className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
      >
        {body}
        <span className="sr-only">sắp có</span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {body}
    </Link>
  );
}

/**
 * Trạng thái mạng — đọc từ chain ĐANG CHỌN, không hard-code.
 * (Trước đây ghi cứng "Polygon Amoy"; Polygon đã bị loại khỏi dự án.)
 */
function NetworkStatus() {
  const config = usePublicConfig();
  const { chain } = useSelectedChain();
  const info = config.chains.find((option) => option.key === chain);

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="text-sidebar-foreground/80">{info?.label ?? chain}</span>
      </div>
      <div className="text-[11px] text-muted-foreground font-mono mt-0.5 pl-4">
        {chain} · vai trò {config.role}
      </div>
    </div>
  );
}
