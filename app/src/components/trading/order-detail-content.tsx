import { FileText, History, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import type { OrderDetailView } from '@/lib/bank/trade.service';
import { formatAmount, formatDateTime } from '@/lib/format';
import { ORDER_STATUS_LABELS, SIDE_LABELS, unitPriceOf } from './gates';
import { orderStatusTone } from './order-status-tone';
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Lệnh {SIDE_LABELS[order.side].toLowerCase()} {order.id.slice(0, 8)}
        </h1>
        <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </header>

      <div className="grid gap-5 min-[1100px]:grid-cols-12">
        <Card className="min-w-0 min-[1100px]:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <FileText />
              </CardTitleIcon>
              Thông tin lệnh
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="text-sm">
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

        <Card className="min-w-0 min-[1100px]:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <Timer />
              </CardTitleIcon>
              Tiến trình quyết toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettlementProgress steps={order.steps} settlement={order.settlement} />
          </CardContent>
        </Card>

        <Card className="min-w-0 min-[1100px]:col-span-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <History />
              </CardTitleIcon>
              Nhật ký kiểm toán của lệnh
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dòng nhật ký nào gắn với lệnh này.</p>
            ) : (
              <ol className="text-sm">
                {audit.map((entry, index) => (
                  <li
                    key={index}
                    className="relative grid gap-x-3 gap-y-1 pb-4 pl-6 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)]"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 left-1 size-2.5 rounded-full bg-primary ring-4 ring-ok-bg"
                    />
                    {index < audit.length - 1 && (
                      <span aria-hidden="true" className="absolute top-5 bottom-0 left-2 w-0.5 bg-border" />
                    )}
                    <span className="tabular-nums text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-code">{entry.action}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {entry.actorRole}, {entry.outcome}
                        </span>
                      </div>
                      {entry.detail && <p className="mt-1 break-words text-muted-foreground">{entry.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? 'truncate text-right font-code' : 'truncate text-right'}>{children}</dd>
    </div>
  );
}
