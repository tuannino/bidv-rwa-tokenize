/**
 * BIDV Logo SVG Component
 * Tái tạo logo BIDV với màu xanh lá (#1a6b3c) và vàng (#b8860b)
 * Dùng cả sidebar (full) và header (compact)
 */

interface BidvLogoProps {
  /** compact: chỉ icon; full: icon + text */
  variant?: "icon" | "full";
  className?: string;
}

export function BidvLogo({ variant = "full", className = "" }: BidvLogoProps) {
  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="BIDV"
      >
        {/* Outer circle — green */}
        <circle cx="20" cy="20" r="19" fill="#1a6b3c" />
        {/* Inner decorative ring — gold */}
        <circle cx="20" cy="20" r="15" fill="none" stroke="#b8860b" strokeWidth="1.5" />
        {/* Stylized B letter */}
        <path
          d="M13 12h7.5c2.5 0 4 1.2 4 3.2 0 1.4-.8 2.4-2 2.9 1.6.4 2.6 1.6 2.6 3.2C25.1 23.8 23.4 25 20.5 25H13V12zm3 5.2h3.8c1.1 0 1.8-.5 1.8-1.5s-.7-1.5-1.8-1.5H16v3zm0 5.6h4.2c1.2 0 2-.6 2-1.6s-.8-1.6-2-1.6H16v3.2z"
          fill="white"
        />
        {/* Gold accent bar at bottom */}
        <rect x="10" y="31" width="20" height="2.5" rx="1.25" fill="#b8860b" />
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <BidvLogo variant="icon" className="h-9 w-9 shrink-0" />
      <div className="leading-tight">
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold tracking-wide" style={{ color: "#1a6b3c" }}>
            BIDV
          </span>
          <span className="text-xs font-semibold" style={{ color: "#b8860b" }}>
            RWA
          </span>
        </div>
        <div className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground font-medium">
          Admin Console
        </div>
      </div>
    </div>
  );
}
