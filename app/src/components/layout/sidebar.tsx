"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  ClipboardList,
  Coins,
  LayoutDashboard,
  Receipt,
  Scale,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  UserCog,
  Wallet,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BidvLogo } from "@/components/bidv-logo";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { usePublicConfig } from "@/lib/config/config-context";
import {
  TELLER_NAV,
  type NavIconName,
  type NavItem,
  type NavSection,
  type PendingWorkCounts,
} from "./nav-config";

/**
 * Menu theo VAI TRÒ. Danh sách mục nằm ở `nav-config.ts` (dữ liệu thuần), không ở đây.
 *
 * Bảng tra tên → component đặt ở phía client là CÓ CHỦ Ý: component không tuần tự hoá được
 * nên không thể đi qua biên server → client. Xem ghi chú đầu `nav-config.ts`.
 */
const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Wind,
  Scale,
  UserCheck,
  Coins,
  ScrollText,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Banknote,
  UserCog,
  ClipboardList,
  ShieldCheck,
  ArrowLeftRight,
  Receipt,
};

const NO_COUNTS: PendingWorkCounts = { draft: 0, approval: 0 };

export function Sidebar({
  nav = TELLER_NAV,
  pendingWork = NO_COUNTS,
}: {
  nav?: NavSection;
  pendingWork?: PendingWorkCounts;
}) {
  const pathname = usePathname();

  /**
   * `/` chỉ khớp chính nó. Mọi mục khác khớp cả đường dẫn con, để `/seller/withdraw` vẫn làm
   * sáng mục `Tạo lệnh rút` — nhưng KHÔNG để `/seller` sáng theo, nên phải so bằng trước rồi
   * mới so tiền tố có dấu gạch.
   */
  const isActive = (item: NavItem) =>
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const firstHref = nav.groups[0]?.items[0]?.href ?? "/";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center px-4 py-4 border-b border-border">
        <Link
          href={firstHref}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
        >
          <BidvLogo variant="full" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {nav.groups.map((group, index) => (
          <div key={group.label ?? `group-${index}`} className="space-y-0.5">
            {group.label !== null && (
              <div className="pt-4 pb-1.5 px-2">
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  {group.label}
                </span>
              </div>
            )}

            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item)}
                pendingCount={item.pendingWork ? pendingWork[item.pendingWork] : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Network status */}
      <NetworkStatus />
    </aside>
  );
}

function NavLink({
  item,
  active,
  pendingCount,
}: {
  item: NavItem;
  active: boolean;
  pendingCount?: number;
}) {
  const Icon = NAV_ICONS[item.icon];

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <Icon className={cn("h-4 w-4", active && "text-primary")} />
        {item.label}
      </div>
      <div className="flex items-center gap-1.5">
        {/*
          Số việc đang chờ. Hiện cả khi bằng 0 vì đó là thông tin thật ("không có việc nào
          chờ"), và một con số biến mất rồi xuất hiện lại làm menu nhảy chỗ mỗi lần tải.
          Tô màu chỉ khi khác 0 để mắt bắt được việc cần làm mà không phải đọc từng số.
        */}
        {pendingCount !== undefined && (
          <span
            // `aria-label` chứ không để trình đọc đọc trơ con số: "Lập lệnh 3" nghe như tên
            // mục, còn "Lập lệnh, 3 việc đang chờ" thì nói đúng thứ con số nghĩa là gì.
            aria-label={`${pendingCount} việc đang chờ`}
            className={cn(
              "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
              pendingCount > 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {pendingCount}
          </span>
        )}
        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded border",
            active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {item.shortcut}
        </span>
      </div>
    </>
  );

  /**
   * Mục chưa khả dụng: KHÔNG bọc `Link` để không điều hướng được (nếu bọc rồi chỉ chặn
   * bằng CSS thì bàn phím và trình đọc màn hình vẫn đi tới được). `aria-disabled` để trình
   * đọc màn hình thông báo đúng trạng thái.
   */
  if (item.disabled) {
    return (
      <div
        aria-disabled="true"
        title="Sắp có — chưa mở trong phiên bản này"
        className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
      >
        {body}
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
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
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
