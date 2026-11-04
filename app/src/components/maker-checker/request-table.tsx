import Link from 'next/link';
import { CHAINS } from '@bidv/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatAmount, formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/role-labels';
import type { TokenRequestRecord } from '@/lib/store/token-request.store.port';
import { BURN_SOURCE_LABELS } from './gates';
import { StatusBadge } from './status-badge';

/**
 * Bảng yêu cầu Mint / Burn — dùng cho thẻ "Yêu cầu đã lập" (màn Lập lệnh) và hai hàng chờ (màn
 * Phê duyệt lệnh).
 *
 * `detailHref`: có thì mã yêu cầu thành liên kết sang màn chi tiết. Màn Lập lệnh KHÔNG truyền, vì
 * màn chi tiết nằm trong khu vực Kiểm soát mà Giao dịch viên không vào được.
 *
 * `variant` (UIUX-01): `'history'` cho thẻ "Lịch sử phê duyệt", thêm cột Loại, Người duyệt, Thời
 * điểm duyệt và bỏ Thời điểm lập, Lý do. Cột Chain đứng sau Trạng thái ở cả hai biến thể.
 *
 * `loading` (FE-UX-02b): bảng chưa có dữ liệu vì đang tải; khung rỗng hiện vòng quay. Màn Phê duyệt
 * không truyền, nên vẫn hiện `emptyText` trong khung rỗng không quay như cũ.
 */
export function RequestTable({
  rows,
  caption,
  detailHref,
  emptyText,
  variant = 'queue',
  loading = false,
}: {
  rows: readonly TokenRequestRecord[];
  caption: string;
  detailHref?: (id: string) => string;
  emptyText: string;
  variant?: 'queue' | 'history';
  loading?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState loading={loading}>{emptyText}</EmptyState>;
  }
  const showSource = rows.some((row) => row.type === 'BURN');
  const history = variant === 'history';
  return (
    <Table aria-label={caption}>
      <TableHeader>
        <TableRow>
          <TableHead>Mã yêu cầu</TableHead>
          {history ? <TableHead>Loại</TableHead> : <TableHead>Thời điểm lập</TableHead>}
          <TableHead>Token</TableHead>
          <TableHead className="text-right">Số lượng</TableHead>
          {showSource && <TableHead>Nguồn</TableHead>}
          <TableHead>Người lập</TableHead>
          {history ? (
            <>
              <TableHead>Người duyệt</TableHead>
              <TableHead>Thời điểm duyệt</TableHead>
            </>
          ) : (
            <TableHead>Lý do</TableHead>
          )}
          <TableHead>Trạng thái</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead>Kết quả</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-request-id={row.id}>
            <TableCell className="font-code text-xs">
              {detailHref ? (
                <Link prefetch={false} className="text-primary underline-offset-4 hover:underline" href={detailHref(row.id)}>
                  {row.id.slice(0, 8)}
                </Link>
              ) : (
                <span title={row.id}>{row.id.slice(0, 8)}</span>
              )}
            </TableCell>
            {history ? (
              <TableCell className="whitespace-nowrap text-xs">{TYPE_LABELS[row.type]}</TableCell>
            ) : (
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {formatDateTime(row.createdAt)}
              </TableCell>
            )}
            <TableCell className="text-xs">{row.tokenSymbol}</TableCell>
            <TableCell className="text-right tabular-nums">{formatAmount(row.amount)}</TableCell>
            {showSource && (
              <TableCell className="text-xs">
                {row.burnSource ? BURN_SOURCE_LABELS[row.burnSource] : '–'}
              </TableCell>
            )}
            <TableCell className="text-xs">{row.makerId}</TableCell>
            {history ? (
              <>
                <TableCell className="text-xs">{row.checkerId ?? 'Không có'}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {row.decidedAt ? formatDateTime(row.decidedAt) : 'Không có'}
                </TableCell>
              </>
            ) : (
              <TableCell className="max-w-[16rem] truncate text-xs" title={row.reason}>
                {row.reason}
              </TableCell>
            )}
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">{CHAINS[row.chain].label}</TableCell>
            <TableCell className="max-w-[16rem] truncate text-xs text-muted-foreground" title={resultText(row)}>
              {resultText(row)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const TYPE_LABELS: Record<TokenRequestRecord['type'], string> = {
  MINT: 'Tạo token',
  BURN: 'Huỷ token',
};

/**
 * Một dòng kết quả theo trạng thái, đọc nguyên từ các cột máy chủ đã ghi. Xuất ra để test câu
 * từ chối (UIUX-01 A4).
 */
export function resultText(row: TokenRequestRecord): string {
  switch (row.status) {
    case 'PENDING':
      return '–';
    case 'REJECTED': {
      const who = [row.checkerRole ? ROLE_LABELS[row.checkerRole] : null, row.checkerId]
        .filter(Boolean)
        .join(' ');
      return `${who} từ chối do: ${row.rejectReason ?? 'Không có'}`.trim();
    }
    case 'FAILED':
      return row.failureReason ?? 'Thất bại khi thực hiện';
    case 'EXECUTING':
      return row.txHash ? `Đã gửi ${row.txHash.slice(0, 12)}…, chờ kết cục` : `${row.checkerId ?? ''} đã duyệt, đang gửi`;
    case 'COMPLETED':
      return row.txHash
        ? `${row.checkerId ?? ''} duyệt, tx ${row.txHash.slice(0, 12)}…`
        : `${row.checkerId ?? ''} duyệt`;
  }
}
