'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listSellerTransactionsAction } from '@/app/actions/seller';
import type { SellerTxnPage } from '@/lib/bank/seller.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/store/order.store.port';
import { nf } from './seller-overview';

/**
 * Màn DANH SÁCH GIAO DỊCH NGƯỜI BÁN (FE-21 việc 8–9) — CHỈ ĐỌC.
 *
 * Lọc và phân trang làm ở `listSellerTransactions`, màn này chỉ gửi bộ lọc và hiển thị.
 */

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Đã đặt',
  CHECKING: 'Đang kiểm tra',
  EXECUTING: 'Đang khớp',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Bị từ chối',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
};

/** Bước nghiệp vụ hiện tại của lệnh mua, theo mô hình trạng thái BE-02. */
const STEP_LABELS: Record<OrderStatus, string> = {
  PLACED: '1. Đặt lệnh',
  CHECKING: '2. Kiểm tra điều kiện',
  EXECUTING: '3. Khớp lệnh trên chuỗi',
  COMPLETED: '4. Đã giao token',
  REJECTED: '2. Dừng ở kiểm tra',
  FAILED: '3. Dừng ở khớp lệnh',
  EXPIRED: '1. Hết hạn chờ',
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString('vi-VN');
const shortWallet = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;

const FIELD =
  'rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface Filters {
  q: string;
  type: string;
  status: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { q: '', type: '', status: '', from: '', to: '' };

export function SellerTransactionsPage() {
  const { chain } = useSelectedChain();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ key: string; data: SellerTxnPage | null; error: string | null } | null>(
    null,
  );

  const query = { chain, page, pageSize: PAGE_SIZE, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
  const key = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    void listSellerTransactionsAction(JSON.parse(key)).then((result) => {
      if (cancelled) return;
      setLoaded(result.ok ? { key, data: result.data, error: null } : { key, data: null, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const fresh = loaded?.key === key ? loaded : null;
  const data = fresh?.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const set = (name: keyof Filters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, [name]: event.target.value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Danh sách giao dịch</h1>
        <p className="text-sm text-muted-foreground">Lệnh mua token của nhà đầu tư khớp với ví Người bán. Màn chỉ đọc.</p>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="search" onSubmit={(e) => e.preventDefault()}>
            <input
              aria-label="Mã lệnh hoặc nhà đầu tư"
              placeholder="Mã lệnh hoặc ví nhà đầu tư"
              value={filters.q}
              onChange={set('q')}
              className={`${FIELD} lg:col-span-1`}
            />
            <select aria-label="Loại" value={filters.type} onChange={set('type')} className={FIELD}>
              <option value="">Mọi loại</option>
              <option value="BUY">Mua</option>
            </select>
            <select aria-label="Trạng thái" value={filters.status} onChange={set('status')} className={FIELD}>
              <option value="">Mọi trạng thái</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <input aria-label="Từ ngày" type="date" value={filters.from} onChange={set('from')} className={FIELD} />
            <input aria-label="Đến ngày" type="date" value={filters.to} onChange={set('to')} className={FIELD} />
          </form>

          {fresh === null ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Đang tải…
            </div>
          ) : fresh.error ? (
            <p className="py-6 text-sm text-destructive">{fresh.error}</p>
          ) : data && data.rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Không có giao dịch khớp bộ lọc.</p>
          ) : (
            data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã lệnh</TableHead>
                    <TableHead>Nhà đầu tư</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Số token</TableHead>
                    <TableHead className="text-right">Số VNDB</TableHead>
                    <TableHead>Bước hiện tại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                    <TableHead>Cập nhật</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs" title={row.id}>
                        {row.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={row.investorWallet}>
                        {shortWallet(row.investorWallet)}
                      </TableCell>
                      <TableCell>Mua</TableCell>
                      <TableCell className="text-right font-mono">{nf(row.wptAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{nf(row.vndAmount)}</TableCell>
                      <TableCell>{STEP_LABELS[row.status]}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{STATUS_LABELS[row.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{fmtTime(row.createdAt)}</TableCell>
                      <TableCell className="text-xs">{fmtTime(row.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          <nav className="flex items-center justify-between text-sm" aria-label="Phân trang">
            <span className="text-muted-foreground">
              {data ? `${data.total} giao dịch · trang ${data.page}/${pages}` : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trang trước
              </Button>
              <Button variant="outline" disabled={!data || page >= pages} onClick={() => setPage((p) => p + 1)}>
                Trang sau
              </Button>
            </div>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
