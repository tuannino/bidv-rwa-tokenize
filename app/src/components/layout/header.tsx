"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ChainSelector } from "./chain-selector";
import { RoleSwitcher } from "./role-switcher";

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
}

export function Header({ breadcrumbs = [] }: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Tránh hydration mismatch
  useEffect(() => setMounted(true), []);

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
        {/* Chọn chain: hardhat-local | mock | evm | stellar (KHÔNG Polygon) */}
        <ChainSelector />

        {/* Đổi vai trò — chỉ để demo RBAC trong PoC */}
        <RoleSwitcher />

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

        {/* Wallet connect */}
        <ConnectButton
          accountStatus="avatar"
          chainStatus="icon"
          showBalance={false}
          label="Kết nối ví Admin"
        />
      </div>
    </header>
  );
}
