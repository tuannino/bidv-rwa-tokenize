import { cn } from '@/lib/utils';

/**
 * Nhãn cho số liệu ĐỌC TỪ CHUỖI. Chỉ dùng ở chỗ đứng cạnh số liệu mẫu, để phân biệt hai loại
 * trong cùng một khung nhìn — dùng tràn lan thì thành nhiễu.
 */
export function OnChainBadge({ className }: { className?: string }) {
  return (
    <span
      title="Đọc trực tiếp từ chuỗi qua ILedgerPort"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary',
        className,
      )}
    >
      on-chain
    </span>
  );
}
