'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Filter, Search, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClass } from '@/components/ui/field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listOrdersAction } from '@/app/actions/purchase';
import { WalletNotBoundNotice } from '@/components/investor/wallet-not-bound-notice';
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
import { orderStatusTone } from '@/components/trading/order-status-tone';

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

export function InvestorOrdersPage({ mockWallet }: { mockWallet: string | null }) {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();
  const wallet = chain === 'mock' ? mockWallet : address;
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ column: OrderColumn; direction: SortDirection }>({
    column: 'createdAt',
    direction: 'desc',
  });
  // FIX-01 E6: kết quả giữ khoá của lần gọi (chain, ví, bộ lọc); khoá khác hiện tại thì bỏ.
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: OrderView[] | null;
    error: string | null;
    notBound: boolean;
  } | null>(null);

  const query = wallet ? orderQueryOf(chain, wallet, filters) : null;
  const requestKey = query ? JSON.stringify(query) : null;
  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    void listOrdersAction(JSON.parse(requestKey)).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, rows: result.data, error: null, notBound: false }
          : { key: requestKey, rows: null, error: result.error, notBound: result.code === 'WALLET_NOT_BOUND' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  if (!wallet || (chain !== 'mock' && !isConnected)) {
    return (
      <EmptyState icon={<Wallet />} className="py-16">
        <p className="font-medium text-foreground">Chưa kết nối ví</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Kết nối ví để xem lệnh của chính mình.</p>
      </EmptyState>
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
        <h1 className="text-2xl font-semibold tracking-tight">Quản lý lệnh</h1>
      </header>

      {chain === 'mock' && (
        <Alert tone="info" role="note">
          Chế độ mô phỏng đang lọc theo ví trong hồ sơ Nhà đầu tư:{' '}
          <span className="font-code break-all">{wallet}</span>. Không cần kết nối ví trình duyệt.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <Filter />
            </CardTitleIcon>
            Bộ lọc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form role="search" className="grid gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input aria-label="Mã lệnh" placeholder="Mã lệnh (UUID)" value={filters.orderId} onChange={set('orderId')} className={`${fieldClass} pl-10`} />
            </div>
            <select aria-label="Chiều" value={filters.side} onChange={set('side')} className={fieldClass}>
              <option value="">Mọi chiều</option>
              {ORDER_SIDES.map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABELS[s]}
                </option>
              ))}
            </select>
            <select aria-label="Trạng thái" value={filters.status} onChange={set('status')} className={fieldClass}>
              <option value="">Mọi trạng thái</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <input aria-label="Từ ngày" type="date" value={filters.fromDate} onChange={set('fromDate')} className={fieldClass} />
            <input aria-label="Đến ngày" type="date" value={filters.toDate} onChange={set('toDate')} className={fieldClass} />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {fresh === null ? (
            <EmptyState loading>Đang tải lệnh…</EmptyState>
          ) : fresh.notBound ? (
            <WalletNotBoundNotice wallet={wallet} />
          ) : fresh.error ? (
            <Alert tone="bad">{fresh.error}</Alert>
          ) : rows && rows.length === 0 ? (
            <EmptyState>Không có lệnh nào khớp bộ lọc.</EmptyState>
          ) : rows ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  {COLUMNS.map((column) => (
                    <TableHead key={column.key} className={column.numeric ? 'text-right' : undefined}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold"
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
                    <TableCell className="font-code text-xs" title={order.id}>
                      {order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell>{SIDE_LABELS[order.side]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(order.wptAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(unitPriceOf(order))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(order.vndAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(order.updatedAt)}</TableCell>
                    <TableCell>
                      <Link prefetch={false} href={`/orders/${order.id}`} className="inline-flex items-center gap-0.5 text-sm text-primary underline-offset-4 hover:underline">
                        Chi tiết
                        <ChevronRight className="size-4" aria-hidden="true" />
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
