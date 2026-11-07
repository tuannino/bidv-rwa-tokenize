"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeaderWalletButtonState = "loading" | "disconnected" | "wrong-network" | "connected";

/** Viên nang 30 px của thanh đầu (bản chốt `shell.css:286`, `:350`); đổi màu theo `data-on` của thanh. */
const PILL =
  "inline-flex h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-[15px] [&_svg]:shrink-0";

/**
 * FE-UX-07b QĐ-6: phần trình bày thuần của nút ví (unit test dựng trực tiếp). Không chứa `<p>`: test
 * khung đọc `<p>` đầu tiên của thanh đầu là tên màn.
 */
export function HeaderWalletButtonView({
  state,
  label,
  onClick,
}: {
  state: HeaderWalletButtonState;
  label?: string;
  onClick?: () => void;
}) {
  if (state === "loading") {
    // Giữ chỗ cùng cỡ trước khi RainbowKit sẵn sàng, để thanh không nhảy khi hydrate.
    return (
      <span aria-hidden="true" className={cn(PILL, "pointer-events-none opacity-0 max-[640px]:w-[38px] max-[640px]:px-0")}>
        <Wallet />
        <span className="max-[640px]:sr-only">Kết nối ví</span>
      </span>
    );
  }
  if (state === "wrong-network") {
    return (
      <button type="button" onClick={onClick} className={cn(PILL, "bg-bad-bg text-bad-ink")}>
        Sai mạng
      </button>
    );
  }
  if (state === "connected") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(PILL, "bg-card/90 text-foreground in-data-on:bg-(--tile-hl-chip) in-data-on:text-(--tile-hl-ink)")}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Kết nối ví"
      className={cn(
        PILL,
        "bg-[linear-gradient(135deg,var(--hdr-gold-from),var(--hdr-gold-to))] text-(--hdr-gold-ink) [box-shadow:0_8px_20px_-10px_var(--hdr-gold-to)] in-data-on:[box-shadow:0_6px_16px_-10px_var(--hdr-on)]",
        "max-[640px]:w-[38px] max-[640px]:px-0",
      )}
    >
      <Wallet aria-hidden="true" />
      <span className="max-[640px]:sr-only">Kết nối ví</span>
    </button>
  );
}

/**
 * Nút ví của thanh đầu: `ConnectButton.Custom` của RainbowKit (như `wallet-connect.tsx`), hộp thoại vẫn
 * của RainbowKit. Nhãn trung tính "Kết nối ví": ví trình duyệt chỉ phục vụ thao tác của nhà đầu tư, thao
 * tác đặc quyền của ngân hàng ký bằng khoá phía máy chủ qua `ISigner` (FE-02 R7.2).
 */
export function HeaderWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted) return <HeaderWalletButtonView state="loading" />;
        if (!account || !chain) return <HeaderWalletButtonView state="disconnected" onClick={openConnectModal} />;
        if (chain.unsupported) return <HeaderWalletButtonView state="wrong-network" onClick={openChainModal} />;
        return <HeaderWalletButtonView state="connected" label={account.displayName} onClick={openAccountModal} />;
      }}
    </ConnectButton.Custom>
  );
}
