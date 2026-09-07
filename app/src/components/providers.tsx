"use client";

import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useState } from "react";
import { BRAND } from "@/lib/brand";
import { useIsMounted } from "@/lib/hooks/use-is-mounted";
import { wagmiConfig } from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

// Accent của modal ví: dùng màu thương hiệu từ lib/brand.ts.
// RainbowKit nhận chuỗi màu cụ thể, không nhận `var(--primary)` — đây là ngoại lệ
// đã ghi rõ trong lib/brand.ts, không phải chỗ được hardcode màu tuỳ ý.
const DARK_WALLET_THEME  = darkTheme({ accentColor: BRAND.green, accentColorForeground: "white", borderRadius: "medium" });
const LIGHT_WALLET_THEME = lightTheme({ accentColor: BRAND.green, accentColorForeground: "white", borderRadius: "medium" });

/**
 * RainbowWithTheme — phải tách ra khỏi Providers để dùng useTheme()
 * Dùng `useIsMounted()` để tránh hydration mismatch: server luôn render darkTheme,
 * client cập nhật đúng theme sau khi hydrate xong.
 */
function RainbowWithTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  // Trước khi mount: dùng dark để khớp với server render (defaultTheme="dark")
  const walletTheme = mounted && resolvedTheme === "light"
    ? LIGHT_WALLET_THEME
    : DARK_WALLET_THEME;

  return (
    <RainbowKitProvider theme={walletTheme} locale="en-US">
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowWithTheme>{children}</RainbowWithTheme>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
