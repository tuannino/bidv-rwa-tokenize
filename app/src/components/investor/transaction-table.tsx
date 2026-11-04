import { ExternalLink } from 'lucide-react';
import { explorerTxUrl } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TxnView } from '@/lib/bank/mint.service';
import { operationLabel } from '@/lib/txn-labels';

/**
 * Bảng "Giao dịch gần đây" (FE-UX-04a QĐ-5): dời nguyên văn từ `transaction-history-box.tsx`. Chỉ nhận các dòng,
 * không gọi action, không có state hay effect.
 */
export function TransactionTable({ rows }: { rows: TxnView[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Thời điểm</TableHead>
          <TableHead>Nghiệp vụ</TableHead>
          <TableHead className="text-right">Số lượng</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="text-right">Tra cứu</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((txn) => {
          const url = explorerTxUrl(txn.chain, txn.txHash);
          return (
            <TableRow key={txn.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(txn.createdAt).toLocaleString('vi-VN')}
              </TableCell>
              <TableCell className="font-medium">{operationLabel(txn.operation)}</TableCell>
              <TableCell className="text-right tabular-nums">{txn.amount ?? '–'}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    txn.status === 'CONFIRMED'
                      ? 'ok'
                      : txn.status === 'FAILED'
                        ? 'bad'
                        : 'info'
                  }
                >
                  {txn.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {/*
                  Chain cục bộ và mock không có trình khám phá nên `explorerTxUrl` trả null.
                  Khi đó hiện mã giao dịch dạng chữ, không dựng link chết.
                */}
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-code text-xs text-primary hover:underline"
                  >
                    {txn.txHash.slice(0, 10)}…
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span
                    className="font-code text-xs text-muted-foreground"
                    title={`${txn.txHash}, chain ${txn.chain} không có trình khám phá`}
                  >
                    {txn.txHash.slice(0, 10)}…
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
