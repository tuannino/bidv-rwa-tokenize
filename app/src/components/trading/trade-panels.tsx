import Link from 'next/link';
import { Loader2, Wallet, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';
import type { OrderView, PermitPreparationView } from '@/lib/bank/purchase.service';
import { WrongChainBanner } from '@/components/wallet/wrong-chain-banner';
import { useWalletStatus } from '@/lib/hooks/use-wallet-status';
import type { InvestorTokenInfo, TradeContextView } from '@/lib/bank/trade.service';
import type { OrderSide } from '@/lib/store/order.store.port';
import { SettlementProgress } from '@/components/trading/settlement-progress';
import { ORDER_STATUS_LABELS, SIDE_LABELS, isSettled } from '@/components/trading/gates';
import { tradingStatusLabel } from '@/components/recall/gates';

/*
 * Phần trình bày của màn Giao dịch token (FE-UX-04b QĐ-5): dời nguyên văn từ `investor-trade.tsx`, chỉ thêm `export`.
 * Không gọi action, không có state hay effect.
 */

/**
 * Câu xác nhận chữ ký trên chain thật (FE-05 QĐ-I): số và token sẽ ký, giờ hết hạn, không tốn phí.
 * Ví sai mạng thì hiện ngay dải cảnh báo dùng chung, nút ký bị khoá theo `canSign`.
 */
export function PermitNotice({
  prepared,
  preparing,
  walletStatus,
}: {
  prepared: PermitPreparationView | null;
  preparing: boolean;
  walletStatus: ReturnType<typeof useWalletStatus>;
}) {
  const { status, switchToExpected, switching, switchError } = walletStatus;
  if (status.kind === 'wrong-chain' || status.kind === 'chain-mismatch') {
    return (
      <WrongChainBanner
        currentLabel={status.kind === 'wrong-chain' ? `chain ID ${status.current}` : status.walletChain}
        expectedLabel={status.kind === 'wrong-chain' ? status.expectedLabel : status.appChain}
        onSwitch={() => void switchToExpected()}
        switching={switching}
        error={switchError}
      />
    );
  }
  if (!walletStatus.canSign) {
    return <p className="text-sm text-destructive">{walletStatus.blockedReason}</p>;
  }
  if (!prepared) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {preparing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Đang chuẩn bị nội dung chữ ký ủy quyền…
      </p>
    );
  }
  const until = new Date(prepared.deadlineAt).toLocaleString('vi-VN');
  return (
    <p className="rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="permit-notice">
      Bạn sẽ ký cho phép hệ thống chi đúng{' '}
      <span className="tabular-nums font-semibold">
        {formatAmount(prepared.value)} {prepared.tokenSymbol}
      </span>{' '}
      cho lệnh này, hiệu lực đến {until}; không tốn phí giao dịch.
    </p>
  );
}

export function Row({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-code' : undefined}>{children}</dd>
    </div>
  );
}

export function OrderSummary({
  side,
  quantity,
  priceVnd,
  total,
  balances,
}: {
  side: OrderSide;
  quantity: string | null;
  priceVnd: string;
  total: string | null;
  balances: TradeContextView['balances'];
}) {
  return (
    <Card size="sm" aria-label="Tóm tắt lệnh">
      <CardHeader>
        <CardTitle className="text-sm">Tóm tắt lệnh</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-1 text-sm">
          <Row label="Loại lệnh">{SIDE_LABELS[side]}</Row>
          <Row label="Số lượng" mono>{formatAmount(quantity)}</Row>
          <Row label="Giá" mono>{formatAmount(priceVnd)} VNDB</Row>
          <Row label="Tổng giá trị dự kiến" mono>{total ? `${formatAmount(total)} VNDB` : 'Chưa có'}</Row>
          {/* FIX-01 E1: ví chưa được định danh thì máy chủ không trả số dư; không hiện số cũ. */}
          <Row label="Token đang giữ" mono>{balances ? formatAmount(balances.wpt) : 'Không có'}</Row>
          <Row label="Số dư VNDB" mono>{balances ? formatAmount(balances.vndb) : 'Không có'}</Row>
        </dl>
      </CardContent>
    </Card>
  );
}

const TOKEN_STATUS_LABELS: Record<InvestorTokenInfo['tokenStatus'], string> = {
  DRAFT: 'Chưa phát hành',
  ISSUED: 'Đã phát hành',
  CLOSED: 'Đã đóng',
};

export function TokenInfoCard({ token, tradeBlock }: { token: InvestorTokenInfo | null; tradeBlock: TradeContextView['tradeBlock'] }) {
  return (
    <Card size="sm" aria-label="Thông tin token" className="bg-muted/30">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">Thông tin token</CardTitle>
        <Wind className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {!token ? (
          <p className="text-sm text-muted-foreground">Chuỗi này chưa có dự án nào được token hoá.</p>
        ) : (
          <dl className="grid gap-1 text-sm">
            <Row label="Dự án">{token.projectName}</Row>
            <Row label="Trần phát hành" mono>{formatAmount(token.cap)}</Row>
            <Row label="Giá phát hành" mono>{formatAmount(token.issuePriceVnd)} VNDB</Row>
            <Row label="Trạng thái token">{TOKEN_STATUS_LABELS[token.tokenStatus]}</Row>
            <Row label="Trạng thái giao dịch">
              <Badge variant={token.tradingOpen ? 'secondary' : 'outline'}>
                {tradingStatusLabel(tradeBlock?.phase ?? 'NONE', token.tradingOpen, 'trade')}
              </Badge>
            </Row>
            <Row label="Số chưa phân phối" mono>{formatAmount(token.undistributed)}</Row>
            <Row label="Tuổi thọ còn lại">{token.terms.remainingLifetimeYears} năm</Row>
            <Row label="Lợi tức mục tiêu">
              {token.terms.annualYieldPercent.toLocaleString('vi-VN')}%/năm
            </Row>
            <Row label="Phí giao dịch">
              {token.terms.tradingFeePercent === 0
                ? 'Không tính'
                : `${token.terms.tradingFeePercent.toLocaleString('vi-VN')}%`}
            </Row>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function TrackedOrder({ order, chain }: { order: OrderView; chain: string }) {
  return (
    <Card aria-label="Lệnh vừa gửi">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Lệnh {SIDE_LABELS[order.side].toLowerCase()} vừa gửi: {ORDER_STATUS_LABELS[order.status]}
        </CardTitle>
        <Link prefetch={false} href={`/orders/${order.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          Xem chi tiết
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isSettled(order) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Hệ thống đang tự quyết toán; màn hình sẽ tự cập nhật kết quả.
          </p>
        )}
        {order.txHash && (
          <p className="text-sm">
            Mã giao dịch{chain === 'mock' ? ' mô phỏng' : ''}:{' '}
            <span className="break-all font-code text-xs">{order.txHash}</span>
          </p>
        )}
        {order.reason && <p className="text-sm text-destructive">{order.reason}</p>}
        <SettlementProgress steps={order.steps} settlement={order.settlement} />
      </CardContent>
    </Card>
  );
}

export function ConnectWalletPrompt() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">Chưa kết nối ví</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Kết nối ví ở góc trên phải, hoặc mở{' '}
        <Link prefetch={false} href="/wallet" className="text-primary underline-offset-4 hover:underline">
          Ví của tôi
        </Link>{' '}
        để đặt lệnh mua hoặc bán token.
      </p>
    </div>
  );
}
