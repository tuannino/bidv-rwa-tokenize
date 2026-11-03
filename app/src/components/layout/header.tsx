"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useIsMounted } from "@/lib/hooks/use-is-mounted";
import { MENU_BUTTON_ID, openDrawer, useDrawerPath, useNarrow } from "./shell-state";

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
}

/** Ngăn kéo đang mở (chỉ dưới 1100 px): thanh đầu và nội dung khi đó có `inert`. */
function useDrawerOpen(): boolean {
  const pathname = usePathname();
  const narrow = useNarrow();
  const drawerPath = useDrawerPath();
  return narrow && drawerPath === pathname;
}

/**
 * Thanh đầu (FE-UX-01b QĐ-5): trái là nút menu (dưới 1100 px) và tên màn, phải là "Kết nối ví" và
 * nút Sáng Tối. Bỏ dòng crumb của bản cũ: tên màn là phần tử CUỐI của `breadcrumbs` các trang đang
 * truyền (crumb cũ không phải liên kết nên không mất điều hướng). Tên màn là đoạn văn, không phải
 * heading: mỗi trang có đúng một `h1` trong `main`.
 */
export function Header({ breadcrumbs = [] }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // `resolvedTheme` chỉ có ở client -> chờ hydrate xong mới render nút, tránh mismatch.
  const mounted = useIsMounted();
  const pathname = usePathname();
  const open = useDrawerOpen();
  const title = breadcrumbs[breadcrumbs.length - 1]?.label ?? "";

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <header
      inert={open}
      className="sticky top-0 z-30 mx-3 mt-3 flex h-12 shrink-0 items-center justify-between gap-3 rounded-[22px] bg-card/80 px-3 ring-1 ring-border backdrop-blur min-[1100px]:h-14 min-[1100px]:px-5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          id={MENU_BUTTON_ID}
          type="button"
          aria-label="Mở menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          onClick={() => openDrawer(pathname)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground min-[1100px]:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <p className="truncate text-base font-medium text-foreground">{title}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/*
          Nhãn trung tính, KHÔNG nói "Admin".

          Thanh trên dùng chung cho cả ba kênh, mà ví trình duyệt chỉ phục vụ thao tác của
          NHÀ ĐẦU TƯ: thao tác đặc quyền của ngân hàng ký bằng khóa phía máy chủ qua `ISigner`
          (FE-02 R7.2). Nhãn cũ "Kết nối ví Admin" mời cán bộ ngân hàng kết nối ví để làm việc
          của ngân hàng — đúng ngược với thiết kế.

          Chi tiết trạng thái ví và xử lý sai mạng ở `/wallet`. Màu vàng của nút đặt ở
          `providers.tsx` (theme RainbowKit, `BRAND.walletAccent*`).
        */}
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={false}
          label="Kết nối ví"
        />
        {/* Dark/Light toggle */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={resolvedTheme === "dark" ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

/** Vùng nội dung chính; có `inert` khi ngăn kéo đang mở (QĐ-4). */
export function ShellMain({ children }: { children: React.ReactNode }) {
  const open = useDrawerOpen();
  return (
    <main inert={open} className="flex-1 px-3 pt-4 pb-6 min-[1100px]:px-6">
      {children}
    </main>
  );
}
