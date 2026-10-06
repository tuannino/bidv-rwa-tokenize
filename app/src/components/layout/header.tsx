"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useIsMounted } from "@/lib/hooks/use-is-mounted";
import { ChainSelector } from "./chain-selector";
import { ChannelSwitcher } from "./channel-switcher";

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ breadcrumbs = [] }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  // `resolvedTheme` chỉ có ở client -> chờ hydrate xong mới render nút, tránh mismatch.
  const mounted = useIsMounted();

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <span
              className={
                i === breadcrumbs.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Chọn chain: mock | hardhat-local | evm | stellar (KHÔNG Polygon) */}
        <ChainSelector />

        {/*
          Chọn VAI TRÒ — hiện ở mọi khu vực để luôn quay lại được (R1.5).

          FE-20 gỡ bộ chọn vai riêng: từ nay chọn vai CHÍNH LÀ chọn khu vực, nên hai ô chọn
          nhập thành một. Để hai ô cùng đổi được vai là mở đường cho hai cookie lệch nhau —
          vai `CONTROLLER` trong khu vực nhà đầu tư thì mọi trang đều ra màn từ chối, và người
          dùng không có cách nào hiểu vì sao.
        */}
        <ChannelSwitcher />

        <div className="h-6 w-px bg-border" aria-hidden="true" />
        {/* Dark/Light toggle */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={resolvedTheme === "dark" ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        )}

        {/*
          Nhãn trung tính, KHÔNG nói "Admin".

          Thanh trên dùng chung cho cả ba kênh, mà ví trình duyệt chỉ phục vụ thao tác của
          NHÀ ĐẦU TƯ: thao tác đặc quyền của ngân hàng ký bằng khóa phía máy chủ qua `ISigner`
          (FE-02 R7.2). Nhãn cũ "Kết nối ví Admin" mời cán bộ ngân hàng kết nối ví để làm việc
          của ngân hàng — đúng ngược với thiết kế.

          Chi tiết trạng thái ví và xử lý sai mạng ở `/wallet`.
        */}
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={false}
          label="Kết nối ví"
        />
      </div>
    </header>
  );
}
