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
// RainbowKit nhận chuỗi màu cụ thể, không nhận `var(--primary)`: đây là ngoại lệ
// đã ghi rõ trong lib/brand.ts, không phải chỗ được hardcode màu tuỳ ý.
const DARK_WALLET_THEME  = darkTheme({ accentColor: BRAND.green, accentColorForeground: "white", borderRadius: "medium" });
const LIGHT_WALLET_THEME = lightTheme({ accentColor: BRAND.green, accentColorForeground: "white", borderRadius: "medium" });

/**
 * RainbowWithTheme: tách khỏi Providers để dùng useTheme().
 * Server không biết theme đã lưu trong trình duyệt nên lần vẽ đầu luôn dùng giao diện Sáng
 * (khớp defaultTheme="light"); sau khi mount (`useIsMounted()`) mới theo `resolvedTheme`.
 */
function RainbowWithTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const mounted = useIsMounted();

  // Trước khi mount: dùng Sáng để khớp lần vẽ đầu (defaultTheme="light").
  const walletTheme = mounted && resolvedTheme === "dark"
    ? DARK_WALLET_THEME
    : LIGHT_WALLET_THEME;

  return (
    <RainbowKitProvider theme={walletTheme} locale="en-US">
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowWithTheme>{children}</RainbowWithTheme>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
