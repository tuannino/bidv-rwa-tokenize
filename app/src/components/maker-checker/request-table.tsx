import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatAmount, formatDateTime } from '@/lib/format';
import type { TokenRequestRecord } from '@/lib/store/token-request.store.port';
import { BURN_SOURCE_LABELS } from './gates';
import { StatusBadge } from './status-badge';

/**
 * Bảng yêu cầu Mint / Burn — dùng cho thẻ "Yêu cầu đã lập" (màn Lập lệnh) và hai hàng chờ (màn
 * Phê duyệt lệnh).
 *
 * `detailHref`: có thì mã yêu cầu thành liên kết sang màn chi tiết. Màn Lập lệnh KHÔNG truyền, vì
 * màn chi tiết nằm trong khu vực Kiểm soát mà Giao dịch viên không vào được.
 */
export function RequestTable({
  rows,
  caption,
  detailHref,
  emptyText,
}: {
  rows: readonly TokenRequestRecord[];
  caption: string;
  detailHref?: (id: string) => string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  }
  const showSource = rows.some((row) => row.type === 'BURN');
  return (
    <Table aria-label={caption}>
      <TableHeader>
        <TableRow>
          <TableHead>Mã yêu cầu</TableHead>
          <TableHead>Thời điểm lập</TableHead>
          <TableHead>Token</TableHead>
          <TableHead className="text-right">Số lượng</TableHead>
          {showSource && <TableHead>Nguồn</TableHead>}
          <TableHead>Người lập</TableHead>
          <TableHead>Lý do</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Kết quả</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-request-id={row.id}>
            <TableCell className="font-mono text-xs">
              {detailHref ? (
                <Link className="text-primary underline-offset-4 hover:underline" href={detailHref(row.id)}>
                  {row.id.slice(0, 8)}
                </Link>
              ) : (
                <span title={row.id}>{row.id.slice(0, 8)}</span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {formatDateTime(row.createdAt)}
            </TableCell>
            <TableCell className="text-xs">
              {row.tokenSymbol} <span className="text-muted-foreground">({row.chain})</span>
            </TableCell>
            <TableCell className="text-right font-mono">{formatAmount(row.amount)}</TableCell>
            {showSource && (
              <TableCell className="text-xs">
                {row.burnSource ? BURN_SOURCE_LABELS[row.burnSource] : '—'}
              </TableCell>
            )}
            <TableCell className="text-xs">{row.makerId}</TableCell>
            <TableCell className="max-w-[16rem] truncate text-xs" title={row.reason}>
              {row.reason}
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground">
              {resultText(row)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Một dòng kết quả theo trạng thái, đọc nguyên từ các cột máy chủ đã ghi. */
function resultText(row: TokenRequestRecord): string {
  switch (row.status) {
    case 'PENDING':
      return '—';
    case 'REJECTED':
      return `${row.checkerId ?? ''}: ${row.rejectReason ?? ''}`;
    case 'FAILED':
      return row.failureReason ?? 'Thất bại khi thực hiện';
    case 'EXECUTING':
      return row.txHash ? `Đã gửi ${row.txHash.slice(0, 12)}…, chờ kết cục` : `${row.checkerId ?? ''} đã duyệt, đang gửi`;
    case 'COMPLETED':
      return `${row.checkerId ?? ''} duyệt · tx ${row.txHash ? `${row.txHash.slice(0, 12)}…` : '—'}`;
  }
}
