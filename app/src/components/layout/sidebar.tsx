"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BadgeCheck,
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
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Undo2,
  UserCheck,
  UserCog,
  Wallet,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { usePublicConfig } from "@/lib/config/config-context";
import { getPendingWorkAction } from "@/app/actions/token-request";
import { activeNavHref } from "./active-nav";
import { ChainSelector } from "./chain-selector";
import { ChannelSwitcher } from "./channel-switcher";
import { CustodyToggle, type CustodyToggleState } from "./custody-toggle";
import { HoverHint } from "./hover-hint";
import { MENU_BUTTON_ID, closeDrawer, setRail, useDrawerPath, useNarrow, useRail, useRailAnimated } from "./shell-state";
import {
  TELLER_NAV,
  type NavGroup,
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
  Undo2,
  BadgeCheck,
};

const NO_COUNTS: PendingWorkCounts = { draft: 0, approval: 0 };

export function Sidebar({
  nav = TELLER_NAV,
  pendingWork = NO_COUNTS,
  custody = null,
  logo,
  logoMark,
}: {
  nav?: NavSection;
  pendingWork?: PendingWorkCounts;
  /** IN-04: công tắc Lưu ký Fireblocks; `null` với vai không có quyền `custody:toggle`. */
  custody?: CustodyToggleState | null;
  /** FE-UX-01b QĐ-10: logo dựng ở server (bản đầy đủ và bản thu gọn), không vào bundle client. */
  logo?: React.ReactNode;
  logoMark?: React.ReactNode;
}) {
  const pathname = usePathname();
  const config = usePublicConfig();
  const { chain } = useSelectedChain();
  const [loadedCounts, setLoadedCounts] = useState<{
    chain: string;
    counts: PendingWorkCounts;
  } | null>(null);
  // HF-01: `pendingWork` do Server Component đọc cho chain mặc định ở MỖI lần kết xuất (kể cả
  // điều hướng phía client và `router.refresh()`), nên với chain mặc định nó đã là số mới nhất.
  // Chỉ chain khác mới cần gọi action. Gọi thêm cho chain mặc định là một lượt Worker thừa,
  // và vì Next xếp hàng server action nối tiếp, nó còn đẩy lùi mọi action dữ liệu của trang.
  const needsFetch = chain !== config.defaultChain;

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    void getPendingWorkAction(chain).then((result) => {
      if (cancelled || !result.ok) return;
      setLoadedCounts({ chain, counts: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [needsFetch, chain, pendingWork.approval, pendingWork.draft]);

  // Đổi sang chain khác thì hiện 0 trong lúc chờ, không để số của chain cũ xuất hiện dưới chain
  // mới. Phản hồi cũ bị chặn bởi cờ `cancelled` phía trên.
  const activePendingWork = !needsFetch
    ? pendingWork
    : loadedCounts?.chain === chain
      ? loadedCounts.counts
      : NO_COUNTS;

  /**
   * FIX-08: đúng một mục sáng (hoặc không mục nào nếu màn không có trong menu). `activeNavHref` lấy
   * `href` khớp DÀI NHẤT trong mọi mục bấm được của mọi nhóm (gồm nhóm ẩn), nên ở `/seller/withdraw`
   * chỉ `Tạo lệnh rút` sáng, `/seller` không sáng theo. Mục `disabled` không dự phần và không sáng.
   */
  const activeHref = activeNavHref(
    nav.groups.flatMap((group) => group.items.filter((item) => !item.disabled).map((item) => item.href)),
    pathname,
  );
  const isActive = (item: NavItem) => !item.disabled && item.href === activeHref;

  const firstHref = nav.groups[0]?.items[0]?.href ?? "/";

  // FE-UX-01b QĐ-3, QĐ-4: thu gọn chỉ có tác dụng từ 1100 px; dưới đó thanh bên là ngăn kéo, mở khi
  // đường dẫn hiện tại trùng đường dẫn lúc bấm "Mở menu" (đổi trang là tự đóng).
  const narrow = useNarrow();
  const collapsed = useRail() && !narrow;
  const drawerPath = useDrawerPath();
  const open = narrow && drawerPath === pathname;
  // Hiệu ứng đổi rộng chỉ gắn sau lần bấm đầu: tải lại ở trạng thái thu gọn thì không trượt.
  const animated = useRailAnimated();
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Tiêu điểm: mở thì vào nút đóng; đóng (mọi cách) thì về nút "Mở menu" ở thanh đầu.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) document.getElementById(MENU_BUTTON_ID)?.focus();
    wasOpen.current = open;
  }, [open]);

  // Esc đóng ngăn kéo; đường dẫn đã đổi thì xoá đường dẫn lúc mở khỏi store (store ngoài React,
  // không phải state của component), để quay lại trang cũ bằng nút trình duyệt không tự mở lại.
  useEffect(() => {
    if (!open) {
      if (drawerPath !== null) closeDrawer();
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, drawerPath]);

  return (
    <>
      {open && (
        <div
          data-shell-overlay
          aria-hidden="true"
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-foreground/30 min-[1100px]:hidden"
        />
      )}
      <aside
        id="app-sidebar"
        data-rail={collapsed ? "collapsed" : "expanded"}
        inert={narrow && !open}
        className={cn(
          "flex flex-col overflow-hidden rounded-[28px] bg-sidebar text-sidebar-foreground ring-1 ring-border",
          "min-[1100px]:relative min-[1100px]:m-3 min-[1100px]:h-[calc(100vh-24px)] min-[1100px]:shrink-0",
          collapsed ? "min-[1100px]:w-[88px]" : "min-[1100px]:w-[270px]",
          animated && "min-[1100px]:transition-[width] min-[1100px]:duration-200 motion-reduce:transition-none",
          "max-[1099px]:fixed max-[1099px]:inset-y-3 max-[1099px]:left-3 max-[1099px]:z-50 max-[1099px]:w-[270px]",
          "max-[1099px]:max-w-[calc(100vw-24px)] max-[1099px]:transition-transform max-[1099px]:duration-200",
          open ? "max-[1099px]:translate-x-0" : "max-[1099px]:invisible max-[1099px]:-translate-x-[calc(100%+12px)]",
        )}
      >
        {/* Đầu: logo, nút đóng ngăn kéo, ô chọn vai */}
        <div className={cn("space-y-3 px-4 pt-4 pb-3", collapsed && "px-3")}>
          <div className={cn("flex items-start justify-between gap-2", collapsed && "justify-center")}>
            <Link
              href={firstHref}
              prefetch={false}
              onClick={closeDrawer}
              className="rounded-[12px] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={collapsed ? "hidden" : "block"}>{logo}</span>
              <span className={collapsed ? "block" : "hidden"}>{logoMark}</span>
            </Link>
            <button
              ref={closeButton}
              type="button"
              aria-label="Đóng menu"
              onClick={closeDrawer}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-foreground min-[1100px]:hidden"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <ChannelSwitcher collapsed={collapsed} onExpand={() => setRail(false)} />
        </div>

        {/* Menu */}
        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto px-3 py-2", collapsed && "px-2")}>
          {nav.groups.map((group, index) =>
            group.collapsible && group.label !== null ? (
              <CollapsibleGroup
                key={group.label}
                group={group}
                index={index}
                collapsed={collapsed}
                isActive={isActive}
                renderItem={(item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item)}
                    collapsed={collapsed}
                    pendingCount={item.pendingWork ? activePendingWork[item.pendingWork] : undefined}
                  />
                )}
              />
            ) : (
              <div key={group.label ?? `group-${index}`} className="space-y-0.5">
                {group.label !== null && (
                  <div className={cn("px-3 pt-4 pb-1.5", collapsed && "px-0")}>
                    <span
                      className={cn(
                        "text-[11px] font-medium tracking-widest text-muted-foreground uppercase",
                        collapsed && "sr-only",
                      )}
                    >
                      {group.label}
                    </span>
                    {collapsed && <span aria-hidden="true" className="mx-auto block h-px w-8 bg-border" />}
                  </div>
                )}

                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item)}
                    collapsed={collapsed}
                    pendingCount={item.pendingWork ? activePendingWork[item.pendingWork] : undefined}
                  />
                ))}
              </div>
            ),
          )}
        </nav>

        {/* Đáy: Lưu ký (IN-04), chọn chain, trạng thái mạng, nút thu gọn */}
        <div className={cn("space-y-2 border-t border-border px-4 pt-3 pb-4", collapsed && "px-3")}>
          {custody && <CustodyToggle state={custody} collapsed={collapsed} />}
          <ChainSelector collapsed={collapsed} onExpand={() => setRail(false)} />
          <div className={cn("flex items-center justify-between gap-2", collapsed && "justify-center")}>
            <p className={cn("min-w-0 truncate font-code text-[11px] text-muted-foreground", collapsed && "sr-only")}>
              {chain}, vai trò {config.role}
            </p>
            <button
              type="button"
              aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              onClick={() => setRail(!collapsed)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-foreground max-[1099px]:hidden"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * Nhóm menu thu gọn (FIX-01 C1): tiêu đề là nút có `aria-expanded`, `aria-controls`. Mặc định thu
 * gọn; mở sẵn khi trang đang xem nằm trong nhóm. Người dùng đã bấm thì giữ lựa chọn đó.
 */
function CollapsibleGroup({
  group,
  index,
  collapsed,
  isActive,
  renderItem,
}: {
  group: NavGroup;
  index: number;
  collapsed: boolean;
  isActive: (item: NavItem) => boolean;
  renderItem: (item: NavItem) => React.ReactNode;
}) {
  const containsActive = group.items.some(isActive);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? containsActive;
  const listId = `nav-group-${index}`;
  return (
    <div className="space-y-0.5">
      <div className={cn("px-3 pt-4 pb-1.5", collapsed && "px-0")}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setToggled(!open)}
          className={cn(
            "flex w-full items-center gap-1 text-[11px] font-medium tracking-widest text-muted-foreground uppercase hover:text-foreground",
            collapsed && "justify-center",
          )}
        >
          <ChevronRight
            className={cn("size-3 transition-transform motion-reduce:transition-none", open && "rotate-90")}
            aria-hidden="true"
          />
          <span className={cn(collapsed && "sr-only")}>{group.label}</span>
        </button>
      </div>
      <div id={listId} hidden={!open} className="space-y-0.5">
        {group.items.map(renderItem)}
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  pendingCount,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  pendingCount?: number;
}) {
  const Icon = NAV_ICONS[item.icon];

  /*
    Số việc đang chờ. Hiện cả khi bằng 0 vì đó là thông tin thật ("không có việc nào chờ"), và một
    con số biến mất rồi xuất hiện lại làm menu nhảy chỗ mỗi lần tải. Khác 0 thì nền vàng để mắt bắt
    được việc cần làm. Nằm TRONG thẻ `a`; khi thanh bên thu gọn thì thành viên nhỏ ở góc biểu tượng.
  */
  const pending =
    pendingCount !== undefined ? (
      <span
        // `aria-label` chứ không để trình đọc đọc trơ con số: "Lập lệnh 3" nghe như tên
        // mục, còn "Lập lệnh, 3 việc đang chờ" thì nói đúng thứ con số nghĩa là gì.
        aria-label={`${pendingCount} việc đang chờ`}
        // FE-UX-01c QĐ-6: số khác 0 có vòng sáng vàng toả ra (giả phần tử `after`, chỉ `scale`,
        // `opacity`); `isolate` để vòng nằm trên nền viên, dưới chữ số. Số 0 đứng yên.
        data-beacon={pendingCount > 0 ? "" : undefined}
        className={cn(
          "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
          pendingCount > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
          pendingCount > 0 &&
            "relative isolate after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-full after:bg-accent after:animate-[beacon_2.4s_ease-out_infinite]",
          collapsed && "absolute -top-1 -right-1 min-w-4 px-1 py-0 leading-4",
        )}
      >
        {pendingCount}
      </span>
    ) : null;

  const body = (
    <>
      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full",
          // FE-UX-01c QĐ-5: rê lên mục thì biểu tượng xoay nhẹ, phóng to (lò xo).
          "transition-[rotate,scale] duration-500 ease-spring group-hover:-rotate-10 group-hover:scale-112",
          active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
        {collapsed && pending}
      </span>
      <span data-nav-label className={cn("min-w-0 flex-1 truncate text-sm", collapsed && "sr-only")}>
        {item.label}
      </span>
      {!collapsed && pending}
      <span
        className={cn(
          "rounded-md border px-1.5 py-0.5 font-code text-[10px]",
          active
            ? "border-primary-foreground/30 text-primary-foreground"
            : "border-border bg-muted text-muted-foreground",
          collapsed && "hidden",
        )}
      >
        {item.shortcut}
      </span>
    </>
  );

  const shape = cn(
    "flex items-center gap-3 rounded-full py-1.5 pr-2 pl-1.5 transition-colors motion-reduce:transition-none",
    collapsed && "justify-center px-0",
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
        title="Sắp có: chưa mở trong phiên bản này"
        className={cn(shape, "cursor-not-allowed text-sidebar-foreground/40")}
      >
        {body}
      </div>
    );
  }

  // UIUX-02 QĐ-9: dừng chuột 3 giây trên mục thì hiện câu mô tả chức năng màn. Khi thu gọn, tên mục
  // còn là chữ `sr-only` trong liên kết (tên truy cập) và hiện nhanh qua `title`.
  return (
    <HoverHint hint={item.hint}>
      <Link
        href={item.href}
        // HF-01: mỗi lượt prefetch là một lần kết xuất server có truy vấn DB; menu có 4 đến 6 mục
        // nên mỗi lần mở trang tốn thêm chừng đó lượt Worker. Bấm mới tải.
        prefetch={false}
        onClick={closeDrawer}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group",
          shape,
          active
            ? "bg-primary font-medium text-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {body}
      </Link>
    </HoverHint>
  );
}
