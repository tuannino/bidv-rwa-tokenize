'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listOrdersAction } from '@/app/actions/purchase';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount, formatDateTime } from '@/lib/format';
import type { OrderView } from '@/lib/bank/purchase.service';
import { ORDER_SIDES, ORDER_STATUSES } from '@/lib/store/order.store.port';
import {
  EMPTY_FILTERS,
  ORDER_STATUS_LABELS,
  SIDE_LABELS,
  orderQueryOf,
  sortOrders,
  unitPriceOf,
  type OrderColumn,
  type OrderFilters,
  type SortDirection,
} from '@/components/trading/gates';

/**
 * Màn QUẢN LÝ LỆNH của Nhà đầu tư (FE-25 việc 9, 10, 13, 14).
 *
 * Lọc ở MÁY CHỦ qua `listOrdersAction`, luôn kèm ví đang kết nối: nhà đầu tư chỉ nhận lệnh của mình
 * vì `listOrders` lọc theo ví ở tầng nghiệp vụ, không vì màn hình lọc. Sắp xếp là trình bày, làm ở
 * đây trên đúng tập máy chủ đã trả.
 */

const COLUMNS: Array<{ key: OrderColumn; label: string; numeric?: boolean }> = [
  { key: 'id', label: 'Mã lệnh' },
  { key: 'createdAt', label: 'Thời điểm tạo' },
  { key: 'side', label: 'Chiều' },
  { key: 'wptAmount', label: 'Số lượng', numeric: true },
  { key: 'price', label: 'Giá', numeric: true },
  { key: 'vndAmount', label: 'Giá trị', numeric: true },
  { key: 'status', label: 'Trạng thái' },
  { key: 'updatedAt', label: 'Cập nhật' },
];

const FIELD =
  'rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function InvestorOrdersPage() {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ column: OrderColumn; direction: SortDirection }>({
    column: 'createdAt',
    direction: 'desc',
  });
  const [loaded, setLoaded] = useState<{ key: string; rows: OrderView[] | null; error: string | null } | null>(null);

  const query = address ? orderQueryOf(chain, address, filters) : null;
  const requestKey = query ? JSON.stringify(query) : null;
  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    void listOrdersAction(JSON.parse(requestKey)).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, rows: result.data, error: null }
          : { key: requestKey, rows: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Chưa kết nối ví</p>
        <p className="max-w-xs text-xs text-muted-foreground">Kết nối ví để xem lệnh của chính mình.</p>
      </div>
    );
  }

  const fresh = loaded?.key === requestKey ? loaded : null;
  const rows = fresh?.rows ? sortOrders(fresh.rows, sort.column, sort.direction) : null;
  const set = (key: keyof OrderFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((current) => ({ ...current, [key]: e.target.value }));
  const toggleSort = (column: OrderColumn) =>
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Quản lý lệnh</h1>
        <p className="text-sm text-muted-foreground">Lệnh mua và bán của ví đang kết nối.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <form role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
            <input aria-label="Mã lệnh" placeholder="Mã lệnh (UUID)" value={filters.orderId} onChange={set('orderId')} className={FIELD} />
            <select aria-label="Chiều" value={filters.side} onChange={set('side')} className={FIELD}>
              <option value="">Mọi chiều</option>
              {ORDER_SIDES.map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABELS[s]}
                </option>
              ))}
            </select>
            <select aria-label="Trạng thái" value={filters.status} onChange={set('status')} className={FIELD}>
              <option value="">Mọi trạng thái</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <input aria-label="Từ ngày" type="date" value={filters.fromDate} onChange={set('fromDate')} className={FIELD} />
            <input aria-label="Đến ngày" type="date" value={filters.toDate} onChange={set('toDate')} className={FIELD} />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {fresh === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Đang tải lệnh…
            </p>
          ) : fresh.error ? (
            <p className="text-sm text-destructive">{fresh.error}</p>
          ) : rows && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có lệnh nào khớp bộ lọc.</p>
          ) : rows ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((column) => (
                    <TableHead key={column.key} className={column.numeric ? 'text-right' : undefined}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort(column.key)}
                        aria-label={`Sắp xếp theo ${column.label}`}
                      >
                        {column.label}
                        <SortIcon active={sort.column === column.key} direction={sort.direction} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs" title={order.id}>
                      {order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell>{SIDE_LABELS[order.side]}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(order.wptAmount)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(unitPriceOf(order))}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(order.vndAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(order.updatedAt)}</TableCell>
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
                        Chi tiết
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />;
  return direction === 'asc' ? (
    <ArrowUp className="h-3 w-3" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3 w-3" aria-hidden="true" />
  );
}
