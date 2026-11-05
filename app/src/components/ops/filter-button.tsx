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
        "rounded-md px-3 py-1 text-xs transition-colors",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
