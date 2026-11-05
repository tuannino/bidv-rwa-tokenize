import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TxnView } from '@/lib/bank/mint.service';
import { operationLabel } from '@/lib/txn-labels';

/** Bảng lịch sử giao dịch của `/mint` (FE-UX-06b QĐ-2: dời nguyên văn từ `components/pages/mint.tsx`). */
export function TxnHistoryTable({ txns }: { txns: TxnView[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Thời điểm</TableHead>
          <TableHead>Nghiệp vụ</TableHead>
          <TableHead>Ví nhận</TableHead>
          <TableHead className="text-right">Số lượng</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Vai trò</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {txns.map((txn) => (
          <TableRow key={txn.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(txn.createdAt).toLocaleTimeString('vi-VN')}
            </TableCell>
            <TableCell className="font-medium">{operationLabel(txn.operation)}</TableCell>
            <TableCell className="font-code text-xs">
              {txn.toWallet ? `${txn.toWallet.slice(0, 10)}…${txn.toWallet.slice(-4)}` : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">{txn.amount ?? '—'}</TableCell>
            <TableCell>
              <Badge
                variant={
                  txn.status === 'CONFIRMED'
                    ? 'default'
                    : txn.status === 'FAILED'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {txn.status}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{txn.actorRole}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
