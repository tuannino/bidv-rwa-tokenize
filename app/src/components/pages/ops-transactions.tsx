'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck, XCircle } from 'lucide-react';
import { executeOrderAction } from '@/app/actions/purchase';
import { listOpsOrdersAction } from '@/app/actions/ops';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ORDER_STATUS_LABELS, SIDE_LABELS } from '@/components/trading/gates';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount, formatDateTime } from '@/lib/format';
import { ORDER_SIDES, ORDER_STATUSES, type OrderSide, type OrderStatus } from '@/lib/store/order.store.port';
import type { OpsOrderPage } from '@/lib/bank/ops-transactions.service';

const PAGE_SIZE = 12;
const FIELD =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface Filters {
  q: string;
  investorWallet: string;
  side: '' | OrderSide;
  status: '' | OrderStatus;
  fromDate: string;
  toDate: string;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  investorWallet: '',
  side: '',
  status: '',
  fromDate: '',
  toDate: '',
};

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

/** Màn tra cứu toàn hệ thống dùng chung cho Giao dịch viên và Kiểm soát viên (FE-06). */
export function OpsTransactionsPage() {
  const { chain } = useSelectedChain();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: OpsOrderPage | null;
    error: string | null;
  } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [, startExecute] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(filters.q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  const query = {
    chain,
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
    ...(filters.investorWallet ? { investorWallet: filters.investorWallet } : {}),
    ...(filters.side ? { side: filters.side } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
    page,
    pageSize: PAGE_SIZE,
  };
  const requestKey = JSON.stringify({ query, revision });

  useEffect(() => {
    let cancelled = false;
    const { query: input } = JSON.parse(requestKey) as {
      query: typeof query;
      revision: number;
    };
    void listOpsOrdersAction(input).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, data: result.data, error: null }
          : { key: requestKey, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const fresh = loaded?.key === requestKey ? loaded : null;
  const data = fresh?.data ?? null;
  const setFilter = (key: keyof Filters) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFilters((current) => ({ ...current, [key]: event.target.value }));
      if (key !== 'q') setPage(1);
    };

  const execute = (orderId: string) =>
    startExecute(async () => {
      setWorkingId(orderId);
      setFeedback(null);
      const result = await executeOrderAction({ chain, orderId });
      setWorkingId(null);
      if (result.ok) {
        setFeedback({ tone: 'success', message: `Đã khớp lệnh ${orderId.slice(0, 8)} và cập nhật số liệu nguồn cung.` });
        setRevision((value) => value + 1);
      } else {
        setFeedback({ tone: 'error', message: result.error });
        setRevision((value) => value + 1);
      }
    });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Giao dịch toàn hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Mọi lệnh mua và bán của tất cả nhà đầu tư, kèm bước nghiệp vụ hiện tại để theo dõi và xử lý khi cần.
        </p>
      </header>

      {data && !data.mayExecute && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm" role="note">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Vai trò Kiểm soát viên chỉ có quyền xem. Màn hình không cung cấp hành động khớp lệnh.</span>
        </div>
      )}

      {data?.supply && (
        <section aria-label="Số liệu nguồn cung" className="grid gap-3 sm:grid-cols-3">
          <SupplyMetric metric="total" label="Tổng cung" value={data.supply.totalSupply} />
          <SupplyMetric metric="undistributed" label="Chưa phân phối" value={data.supply.undistributed} />
          <SupplyMetric metric="circulating" label="Đang lưu hành" value={data.supply.circulating} />
        </section>
      )}

      <form
        role="search"
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(13rem,1.4fr)_minmax(11rem,1fr)_7rem_9rem_9rem_9rem]"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="relative">
          <span className="sr-only">Tìm mã lệnh hoặc nhà đầu tư</span>
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            value={filters.q}
            onChange={setFilter('q')}
            placeholder="Tìm mã lệnh hoặc nhà đầu tư…"
            className={`${FIELD} pl-9`}
          />
        </label>
        <select aria-label="Nhà đầu tư" value={filters.investorWallet} onChange={setFilter('investorWallet')} className={FIELD}>
          <option value="">Tất cả nhà đầu tư</option>
          {(data?.investors ?? []).map((wallet) => (
            <option key={wallet} value={wallet}>{shortWallet(wallet)}</option>
          ))}
        </select>
        <select aria-label="Chiều lệnh" value={filters.side} onChange={setFilter('side')} className={FIELD}>
          <option value="">Mọi chiều</option>
          {ORDER_SIDES.map((side) => <option key={side} value={side}>{SIDE_LABELS[side]}</option>)}
        </select>
        <select aria-label="Trạng thái" value={filters.status} onChange={setFilter('status')} className={FIELD}>
          <option value="">Mọi trạng thái</option>
          {ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}
        </select>
        <input aria-label="Từ ngày" type="date" value={filters.fromDate} onChange={setFilter('fromDate')} className={FIELD} />
        <input aria-label="Đến ngày" type="date" value={filters.toDate} onChange={setFilter('toDate')} className={FIELD} />
      </form>

      {feedback && (
        <div className={feedback.tone === 'success' ? 'rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm' : 'flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'} role="status">
          {feedback.tone === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="px-0">
          {fresh === null ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Đang tải giao dịch…
            </p>
          ) : fresh.error ? (
            <p className="p-4 text-sm text-destructive">{fresh.error}</p>
          ) : data && data.rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Không có lệnh nào khớp bộ lọc.</p>
          ) : data ? (
            <Table aria-label="Giao dịch toàn hệ thống">
              <TableHeader>
                <TableRow>
                  <TableHead>Mã lệnh</TableHead>
                  <TableHead>Nhà đầu tư</TableHead>
                  <TableHead>Chiều</TableHead>
                  <TableHead className="text-right">WPT</TableHead>
                  <TableHead className="text-right">VNDB</TableHead>
                  <TableHead>Bước hiện tại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                  <TableHead>Cập nhật</TableHead>
                  {data.mayExecute && <TableHead>Hành động</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/transactions/${order.id}`} title={order.id} className="font-mono text-xs text-primary hover:underline">
                        {order.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={order.investorWallet}>{shortWallet(order.investorWallet)}</TableCell>
                    <TableCell className={order.side === 'BUY' ? 'font-medium text-primary' : 'font-medium text-chart-4'}>{SIDE_LABELS[order.side]}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(order.wptAmount)}</TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(order.vndAmount)}</TableCell>
                    <TableCell>
                      <span className="text-sm">{order.currentStep.label}</span>
                      <span className="block text-xs text-muted-foreground">{stepStateLabel(order.currentStep.state)}</span>
                    </TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-xs">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(order.updatedAt)}</TableCell>
                    {data.mayExecute && (
                      <TableCell>
                        {order.canExecute ? (
                          <Button size="xs" onClick={() => execute(order.id)} disabled={workingId !== null}>
                            {workingId === order.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                            Khớp lệnh
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{pageSummary(data)}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span>{data.page} / {data.totalPages}</span>
            <Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplyMetric({
  metric,
  label,
  value,
}: {
  metric: 'total' | 'undistributed' | 'circulating';
  label: string;
  value: string;
}) {
  return (
    <Card size="sm" data-testid={`supply-${metric}`}>
      <CardContent>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-base font-semibold">{formatAmount(value)} WPT</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const variant = status === 'COMPLETED' ? 'default' : status === 'FAILED' || status === 'REJECTED' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

function shortWallet(wallet: string): string {
  return wallet.length > 18 ? `${wallet.slice(0, 10)}…${wallet.slice(-6)}` : wallet;
}

function stepStateLabel(state: 'done' | 'current' | 'pending' | 'failed'): string {
  if (state === 'done') return 'Đã xong';
  if (state === 'current') return 'Đang xử lý';
  if (state === 'failed') return 'Dừng tại đây';
  return 'Chưa tới';
}

function pageSummary(data: OpsOrderPage): string {
  if (data.total === 0) return '0 bản ghi';
  const first = (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.page * data.pageSize, data.total);
  return `Hiển thị ${first}–${last} / ${data.total} bản ghi`;
}
