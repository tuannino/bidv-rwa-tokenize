"use client";

import { useEffect, useRef } from "react";
import { Menu, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useIsMounted } from "@/lib/hooks/use-is-mounted";
import { headerProgress, progressRange, stepProgress } from "./header-progress";
import { HeaderWalletButton } from "./header-wallet-button";
import { MENU_BUTTON_ID, openDrawer, useDrawerPath, useNarrow } from "./shell-state";

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  /** FE-UX-07b QĐ-8: logo nhỏ dưới 1100 px (`BidvLogo variant="compact"`), dựng ở server. */
  logo?: React.ReactNode;
}

/** Ngăn kéo đang mở (chỉ dưới 1100 px): thanh đầu và nội dung khi đó có `inert`. */
function useDrawerOpen(): boolean {
  const pathname = usePathname();
  const narrow = useNarrow();
  const drawerPath = useDrawerPath();
  return narrow && drawerPath === pathname;
}

/**
 * Thanh đầu (FE-UX-01b QĐ-5, FE-UX-07b): trái là nút menu (dưới 1100 px) và tên màn, phải là nút ví
 * và nút Sáng Tối. Tên màn là phần tử CUỐI của `breadcrumbs` các trang đang truyền; là đoạn văn, không
 * phải heading: mỗi trang có đúng một `h1` trong `main`.
 *
 * FE-UX-07b (bản chốt `shell.css`, `shell.js:302-310`): ở đầu trang thanh trong suốt, chỉ có nút ví và
 * nút Sáng Tối; cuộn qua tiêu đề màn thì nền xanh tối, tên màn chữ trắng và đường chân trời hiện dần
 * theo tiến độ `--hp` (0 đến 1). `--hp` và `data-on` ghi thẳng lên phần tử qua `ref`, không qua state.
 */
export function Header({ breadcrumbs = [], logo }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // `resolvedTheme` chỉ có ở client: chờ hydrate xong mới render nút, tránh mismatch.
  const mounted = useIsMounted();
  const pathname = usePathname();
  const open = useDrawerOpen();
  const headerRef = useRef<HTMLElement>(null);
  const title = breadcrumbs[breadcrumbs.length - 1]?.label ?? "";

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  // QĐ-2: vùng cuộn là cha của `header` (`app-layout.tsx`). Đổi trang thì tính lại quãng và đích.
  useEffect(() => {
    const header = headerRef.current;
    const scroller = header?.parentElement;
    if (!header || !scroller) return;
    const main = scroller.querySelector("main");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let range = progressRange(scroller, main);
    let target = 0;
    let current = Number.parseFloat(header.style.getPropertyValue("--hp")) || 0;
    let frame = 0;
    const tick = () => {
      current = stepProgress({ current, target, reduce: motion.matches });
      header.style.setProperty("--hp", current.toFixed(3));
      header.toggleAttribute("data-on", current > 0.5);
      frame = current !== target ? window.requestAnimationFrame(tick) : 0;
    };
    const onScroll = () => {
      target = headerProgress({ scrollTop: scroller.scrollTop, range });
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    const onResize = () => {
      range = progressRange(scroller, main);
      onScroll();
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      inert={open}
      className={[
        // QĐ-1: cao 46, cách đỉnh 8, lề 12 (trùng `px-3` của `main`), bo 16; từ 1100 px cao 44, cách đỉnh
        // 10, lề 24 (trùng `px-6`), bo 18. `--hp` mặc định 0 (máy chủ dựng, chưa cuộn).
        "sticky top-2 z-30 mx-3 mt-2 flex h-[46px] shrink-0 items-center gap-2.5 rounded-[16px] pr-2 pl-3 [--hp:0]",
        "min-[1100px]:top-2.5 min-[1100px]:mx-6 min-[1100px]:mt-2.5 min-[1100px]:h-11 min-[1100px]:rounded-[18px] min-[1100px]:pl-5",
        // QĐ-3: mờ nền và bóng theo `--hp` (nền là lớp `data-header-bg` bên dưới).
        "[backdrop-filter:blur(14px)] min-[1100px]:[backdrop-filter:blur(calc(var(--hp)*18px))_saturate(calc(1_+_var(--hp)*0.35))]",
        "[box-shadow:0_10px_28px_-18px_color-mix(in_oklab,var(--hdr-shadow)_calc(var(--hp)*90%),transparent)]",
        "dark:[box-shadow:0_1px_0_color-mix(in_oklab,var(--hdr-shadow)_calc(var(--hp)*6%),transparent)]",
      ].join(" ")}
    >
      {/* QĐ-3: nền xanh tối hiện theo `--hp`; dưới 1100 px ở Sáng còn 4% ở đầu trang. Là phần tử riêng thay
          giả phần tử `::before` để dùng lại lớp có sẵn (CSS dùng chung nhỏ hơn, QĐ-12). */}
      <span
        data-header-bg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-(--hdr-on) opacity-[calc((0.04_+_var(--hp)*0.86)/0.9)] dark:opacity-(--hp) min-[1100px]:opacity-(--hp)"
      />
      {/* FE-UX-01c QĐ-6: đường chân trời ở mép dưới. Dải gradient lặp hai chu kỳ, rộng 200%, dịch nửa
          chiều rộng bằng `translate` nên nối liền, không animate `background-position`. FE-UX-07b: cao
          2 px, cách mép 20 px, hiện theo `--hp`. */}
      <span
        data-horizon
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 bottom-0 h-0.5 overflow-hidden rounded-full opacity-(--hp) after:absolute after:inset-y-0 after:left-0 after:w-[200%] after:animate-[horizon_8s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,var(--primary)_10%,var(--accent)_25%,var(--primary)_40%,transparent_50%,var(--primary)_60%,var(--accent)_75%,var(--primary)_90%,transparent)]"
      />
      <button
        id={MENU_BUTTON_ID}
        type="button"
        aria-label="Mở menu"
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => openDrawer(pathname)}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground in-data-on:text-(--tile-hl-ink) min-[1100px]:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <div className="relative flex min-w-0 flex-1 items-center self-stretch">
        {/* QĐ-8: logo nhỏ dưới 1100 px, mờ dần và trượt lên khi cuộn để không chồng tên màn. */}
        {logo && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center opacity-[calc(1_-_var(--hp)*1.4)] [transform:translateY(calc(var(--hp)*-28px))] min-[1100px]:hidden">
            {logo}
          </span>
        )}
        {/* QĐ-4: chữ trắng 14 px đậm, vạch màu phía trước, hiện dần theo `--hp`. */}
        <p className="flex min-w-0 origin-left items-center gap-2.5 text-sm leading-5 font-bold tracking-[.01em] text-(--tile-hl-ink) opacity-(--hp) [transform:translateY(calc((1_-_var(--hp))*14px))_scale(calc(0.94_+_var(--hp)*0.06))]">
          <span aria-hidden="true" className="h-4 w-[3px] shrink-0 rounded-[3px] bg-[linear-gradient(180deg,var(--hdr-accent-from),var(--hdr-accent-to))]" />
          <span className="truncate">{title}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <HeaderWalletButton />
        {mounted && (
          <button
            onClick={toggleTheme}
            className="flex size-[30px] items-center justify-center rounded-full border border-transparent bg-card/70 text-foreground transition-[rotate,background-color,color] duration-300 ease-spring hover:-rotate-12 in-data-on:border-[color-mix(in_oklab,var(--tile-hl-ink)_20%,transparent)] in-data-on:bg-[color-mix(in_oklab,var(--tile-hl-ink)_12%,transparent)] in-data-on:text-(--tile-hl-ink) [&_svg]:size-[15px]"
            title={resolvedTheme === "dark" ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </button>
        )}
      </div>
    </header>
  );
}

/** Vùng nội dung chính; có `inert` khi ngăn kéo đang mở (FE-UX-01b QĐ-4). */
export function ShellMain({ children }: { children: React.ReactNode }) {
  const open = useDrawerOpen();
  return (
    <main inert={open} className="flex-1 px-3 pt-4 pb-6 min-[1100px]:px-6">
      {/* FE-UX-01c QĐ-4: nội dung màn hiện dần, dịch lên khi vào màn (`rise` trong `globals.css`). */}
      <div data-page-enter>{children}</div>
    </main>
  );
}
