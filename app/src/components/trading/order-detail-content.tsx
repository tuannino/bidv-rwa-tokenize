import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrderDetailView } from '@/lib/bank/trade.service';
import { formatAmount, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, SIDE_LABELS, unitPriceOf } from './gates';
import { SettlementProgress } from './settlement-progress';

/**
 * Nội dung chi tiết lệnh dùng chung cho FE-25 và FE-06.
 *
 * Thành phần chỉ vẽ `OrderDetailView` máy chủ đã cấp quyền và trả về. Nó không biết ví đang kết
 * nối, vai hiện tại hay đường lấy dữ liệu, nên hai khu vực không thể vô tình dùng sai guard.
 */
export function OrderDetailContent({ detail }: { detail: OrderDetailView }) {
  const { order, audit } = detail;
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
