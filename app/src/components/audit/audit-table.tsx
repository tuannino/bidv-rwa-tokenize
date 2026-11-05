import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditRecord } from '@/lib/store/store.port';

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

/** FE-UX-06b QĐ-5: sắc nhãn kết quả kiểm toán, chữ nhãn giữ mã kết quả. */
const OUTCOME_TONES: Record<AuditRecord['outcome'], BadgeVariant> = {
  ALLOWED: 'ok',
  SUCCESS: 'ok',
  DENIED: 'bad',
  FAILURE: 'bad',
};

/** Bảng Sổ kiểm toán (FE-UX-06b QĐ-2: dời nguyên văn từ `app/(ops)/audit/page.tsx`). */
export function AuditTable({ entries }: { entries: AuditRecord[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Thời điểm</TableHead>
          <TableHead>Vai trò</TableHead>
          <TableHead>Hành động</TableHead>
          <TableHead>Đối tượng</TableHead>
          <TableHead>Kết quả</TableHead>
          <TableHead>Chi tiết</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString('vi-VN')}
            </TableCell>
            <TableCell className="text-xs">{entry.actorRole}</TableCell>
            <TableCell className="font-code text-xs">{entry.action}</TableCell>
            <TableCell className="font-code text-xs">
              {entry.target ? `${entry.target.slice(0, 10)}…` : '–'}
            </TableCell>
            <TableCell>
              <Badge variant={OUTCOME_TONES[entry.outcome]}>{entry.outcome}</Badge>
            </TableCell>
            <TableCell
              className="max-w-[28rem] truncate text-xs text-muted-foreground"
              title={entry.detail ?? undefined}
            >
              {entry.detail ?? '–'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
