import { cn } from "@/lib/utils";

/** Nút lọc viên nang dùng chung của ba màn dữ liệu mẫu, dời nguyên văn từ `assets.tsx`, `kyc.tsx`, `reconciliation.tsx` (FE-UX-06a QĐ-2). */
export function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
