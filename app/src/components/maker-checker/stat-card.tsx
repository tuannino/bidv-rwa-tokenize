import { Card, CardContent } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';

/** Thẻ số liệu của hai màn lập–duyệt. `value = null` là chưa đọc được, không phải 0. */
export function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card size="sm" aria-label={label}>
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-2xl font-semibold">{value === null ? '—' : formatAmount(value)}</p>
      </CardContent>
    </Card>
  );
}

/** Kiểu ô nhập dùng chung của hai màn — cùng kiểu với màn `/mint` có sẵn. */
export const INPUT_CLASS =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
