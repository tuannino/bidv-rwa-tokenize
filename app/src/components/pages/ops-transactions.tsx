'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, ChevronRight, Coins, Loader2, Search, ShieldCheck, Users } from 'lucide-react';
import { executeOrderAction } from '@/app/actions/purchase';
import { listOpsOrdersAction } from '@/app/actions/ops';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClass } from '@/components/ui/field';
import { Kpi } from '@/components/ui/kpi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ORDER_STATUS_LABELS, SIDE_LABELS } from '@/components/trading/gates';
import { orderStatusTone } from '@/components/trading/order-status-tone';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount, formatDateTime } from '@/lib/format';
import { ORDER_SIDES, ORDER_STATUSES, type OrderSide, type OrderStatus } from '@/lib/store/order.store.port';
import type { OpsOrderPage } from '@/lib/bank/ops-transactions.service';

const PAGE_SIZE = 12;

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

  const execute = (
    orderId: string,
    intervention: 'CONTINUE' | 'RECONCILE' | 'MANUAL_RECONCILIATION' | null,
  ) => {
    if (intervention !== 'CONTINUE' && intervention !== 'RECONCILE') return;
    startExecute(async () => {
      setWorkingId(orderId);
      setFeedback(null);
      const result = await executeOrderAction({ chain, orderId });
      setWorkingId(null);
      if (result.ok) {
        setFeedback({
          tone: 'success',
          message:
            intervention === 'RECONCILE'
              ? `Đã đối soát giao dịch của lệnh ${orderId.slice(0, 8)}; không phát lại giao dịch.`
              : `Đã tiếp tục quyết toán lệnh ${orderId.slice(0, 8)} và cập nhật số liệu nguồn cung.`,
        });
        setRevision((value) => value + 1);
      } else {
        setFeedback({ tone: 'error', message: result.error });
        setRevision((value) => value + 1);
      }
    });
  };

  return (
    <div className="space-y-5" data-chain={chain}>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Giao dịch toàn hệ thống</h1>
      </header>

      {data && !data.mayExecute && (
        <Alert tone="info" role="note" icon={<ShieldCheck className="mt-px size-[18px] shrink-0" aria-hidden="true" />}>
          Vai trò Kiểm soát viên chỉ có quyền xem. Màn hình không cung cấp hành động can thiệp.
        </Alert>
      )}

      {data?.supply && (
        <section aria-label="Số liệu nguồn cung" className="grid gap-4 sm:grid-cols-3">
          <Kpi
            data-testid="supply-total"
            tone="hl"
            label="Tổng cung"
            value={formatAmount(data.supply.totalSupply)}
            unit="WPT"
            icon={<Coins />}
          />
          <Kpi
            data-testid="supply-undistributed"
            tone="leaf"
            label="Chưa phân phối"
            value={formatAmount(data.supply.undistributed)}
            unit="WPT"
            icon={<Boxes />}
          />
          <Kpi
            data-testid="supply-circulating"
            label="Đang lưu hành"
            value={formatAmount(data.supply.circulating)}
            unit="WPT"
            icon={<Users />}
          />
        </section>
      )}

      <Card>
        <CardContent className="space-y-4">
          <form
            role="search"
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(13rem,1.4fr)_minmax(11rem,1fr)_8rem_10rem_10rem_10rem]"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="relative">
              <span className="sr-only">Tìm mã lệnh hoặc nhà đầu tư</span>
              <Search className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                value={filters.q}
                onChange={setFilter('q')}
                placeholder="Tìm mã lệnh hoặc nhà đầu tư…"
                className={`${fieldClass} pl-10`}
              />
            </label>
            <select aria-label="Nhà đầu tư" value={filters.investorWallet} onChange={setFilter('investorWallet')} className={fieldClass}>
              <option value="">Tất cả nhà đầu tư</option>
              {(data?.investors ?? []).map((wallet) => (
                <option key={wallet} value={wallet}>{shortWallet(wallet)}</option>
              ))}
            </select>
            <select aria-label="Chiều lệnh" value={filters.side} onChange={setFilter('side')} className={fieldClass}>
              <option value="">Mọi chiều</option>
              {ORDER_SIDES.map((side) => <option key={side} value={side}>{SIDE_LABELS[side]}</option>)}
            </select>
            <select aria-label="Trạng thái" value={filters.status} onChange={setFilter('status')} className={fieldClass}>
              <option value="">Mọi trạng thái</option>
              {ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}
            </select>
            <input aria-label="Từ ngày" type="date" value={filters.fromDate} onChange={setFilter('fromDate')} className={fieldClass} />
            <input aria-label="Đến ngày" type="date" value={filters.toDate} onChange={setFilter('toDate')} className={fieldClass} />
          </form>

          {feedback && (
            <Alert tone={feedback.tone === 'success' ? 'ok' : 'bad'} role="status">
              {feedback.message}
            </Alert>
          )}

          {fresh === null ? (
            <EmptyState loading>Đang tải giao dịch…</EmptyState>
          ) : fresh.error ? (
            <EmptyState tone="bad">{fresh.error}</EmptyState>
          ) : data && data.rows.length === 0 ? (
            <EmptyState>Không có lệnh nào khớp bộ lọc.</EmptyState>
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
                      <Link prefetch={false} href={`/transactions/${order.id}`} title={order.id} className="font-code text-xs font-medium text-primary hover:underline">
                        {order.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-code text-xs" title={order.investorWallet}>{shortWallet(order.investorWallet)}</TableCell>
                    <TableCell className={order.side === 'BUY' ? 'font-medium text-primary' : 'font-medium text-chart-4'}>{SIDE_LABELS[order.side]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(order.wptAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(order.vndAmount)}</TableCell>
                    <TableCell>
                      <span className="text-sm">{order.currentStep.label}</span>
                      <span className="block text-xs text-muted-foreground">{stepStateLabel(order.currentStep.state)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell className="text-xs tabular-nums">{formatDateTime(order.updatedAt)}</TableCell>
                    {data.mayExecute && (
                      <TableCell>
                        {order.canExecute && order.intervention !== 'MANUAL_RECONCILIATION' && order.intervention !== null ? (
                          <Button
                            size="xs"
                            onClick={() => execute(order.id, order.intervention)}
                            disabled={workingId !== null}
                          >
                            {workingId === order.id && <Loader2 className="animate-spin" aria-hidden="true" />}
                            {order.intervention === 'RECONCILE' ? 'Đối soát giao dịch' : 'Tiếp tục quyết toán'}
                          </Button>
                        ) : order.intervention === 'MANUAL_RECONCILIATION' ? (
                          <span className="text-xs font-medium text-destructive" title="Giao dịch có thể đã được phát nhưng chưa lưu được mã">
                            Cần đối soát tay
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {data && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{pageSummary(data)}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" aria-label="Trang trước" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span className="tabular-nums">{data.page} / {data.totalPages}</span>
                <Button variant="outline" size="icon-sm" aria-label="Trang sau" disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)}>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
