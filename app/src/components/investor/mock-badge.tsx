import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Nhãn "dữ liệu mẫu" — dùng ở MỌI con số chưa có nguồn thật.
 *
 * Để một component dùng chung thay vì mỗi hộp tự ghi một kiểu: người xem là ngân hàng, nếu
 * nhãn lúc thì "mock" lúc thì "demo" lúc thì không có, họ sẽ không biết con số nào tin được.
 * Thà một hình thức nhất quán mà nhận ra ngay.
 *
 * Dùng theme token (`--accent`) chứ không hardcode màu, để đọc được ở cả light và dark.
 */
export function MockBadge({
  className,
  title = 'Số liệu minh hoạ, chưa nối nguồn thật',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground',
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      dữ liệu mẫu
    </span>
  );
}

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
