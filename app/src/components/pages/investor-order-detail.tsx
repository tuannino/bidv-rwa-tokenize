'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrderDetailAction } from '@/app/actions/trade';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount, formatDateTime } from '@/lib/format';
import type { OrderDetailView } from '@/lib/bank/trade.service';
import { SettlementProgress } from '@/components/trading/settlement-progress';
import { ORDER_STATUS_LABELS, SIDE_LABELS, unitPriceOf } from '@/components/trading/gates';

/**
 * Màn CHI TIẾT LỆNH của Nhà đầu tư (FE-25 việc 11, 12): thông tin lệnh, tiến trình quyết toán năm
 * bước kèm mốc thời gian, nhật ký kiểm toán của lệnh.
 *
 * Phạm vi xem do `getOrderDetailAction` quyết định (đi qua `listOrders`, lọc theo ví ở máy chủ): dò
 * mã lệnh của ví khác nhận "không tìm thấy", không nhận lệnh đó.
 */
export function InvestorOrderDetailPage({ orderId }: { orderId: string }) {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();
  const [loaded, setLoaded] = useState<{ key: string; data: OrderDetailView | null; error: string | null } | null>(null);

  const requestKey = address ? `${chain}|${address}|${orderId}` : null;
  useEffect(() => {
    if (!requestKey || !address) return;
    let cancelled = false;
    void getOrderDetailAction({ chain, investorWallet: address, orderId }).then((result) => {
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
  }, [requestKey, chain, address, orderId]);

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Chưa kết nối ví</p>
      </div>
    );
  }

  const fresh = loaded?.key === requestKey ? loaded : null;
  if (fresh === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Đang tải lệnh…
      </p>
    );
  }
  if (fresh.error || !fresh.data) return <p className="text-sm text-destructive">{fresh.error}</p>;

  const { order, audit } = fresh.data;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          Lệnh {SIDE_LABELS[order.side].toLowerCase()} {order.id.slice(0, 8)}
        </h1>
        <Badge variant="outline">{ORDER_STATUS_LABELS[order.status]}</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin lệnh</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="Mã lệnh" mono>{order.id}</Row>
            <Row label="Chiều">{SIDE_LABELS[order.side]}</Row>
            <Row label="Số lượng" mono>{formatAmount(order.wptAmount)}</Row>
            <Row label="Giá" mono>{formatAmount(unitPriceOf(order))} VNDB</Row>
            <Row label="Giá trị" mono>{formatAmount(order.vndAmount)} VNDB</Row>
            <Row label="Ví" mono>{order.investorWallet}</Row>
            <Row label="Thời điểm tạo">{formatDateTime(order.createdAt)}</Row>
            <Row label="Cập nhật">{formatDateTime(order.updatedAt)}</Row>
            <Row label="Mã giao dịch" mono>{order.txHash ?? 'chưa có'}</Row>
            <Row label="Lý do">{order.reason ?? 'không có'}</Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiến trình quyết toán</CardTitle>
        </CardHeader>
        <CardContent>
          <SettlementProgress steps={order.steps} settlement={order.settlement} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nhật ký kiểm toán của lệnh</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có dòng nhật ký nào gắn với lệnh này.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {audit.map((entry, index) => (
                <li key={index} className="border-b border-border/60 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{formatDateTime(entry.at)}</span>
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.actorRole}, {entry.outcome}
                    </span>
                  </div>
                  {entry.detail && <p className="mt-1 text-muted-foreground">{entry.detail}</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-1">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? 'truncate text-right font-mono' : 'truncate text-right'}>{children}</dd>
    </div>
  );
}
