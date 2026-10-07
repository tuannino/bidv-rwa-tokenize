'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Loader2, Wallet, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { listOrdersAction, placeOrderAction } from '@/app/actions/purchase';
import { getTradeContextAction, previewTradeAction } from '@/app/actions/trade';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount } from '@/lib/format';
import type { OrderView } from '@/lib/bank/purchase.service';
import type { InvestorTokenInfo, TradeContextView } from '@/lib/bank/trade.service';
import type { OrderSide } from '@/lib/store/order.store.port';
import { SettlementProgress } from '@/components/trading/settlement-progress';
import { TradeCheckBlock } from '@/components/trading/trade-check-block';
import {
  ORDER_STATUS_LABELS,
  SIDE_LABELS,
  confirmBlockReason,
  isSettled,
  parseQuantity,
  quantityBlockReason,
  type TradePreviewState,
} from '@/components/trading/gates';

/**
 * Màn GIAO DỊCH TOKEN của Nhà đầu tư (FE-25 việc 1 đến 8).
 *
 * Mọi con số và mọi kết luận lấy từ máy chủ: trần số lượng và số dư từ `getTradeContextAction`, năm
 * điều kiện và tổng giá trị từ `previewTradeAction`, tiến trình từ `listOrdersAction`. Component không
 * nhập `viem` và không gọi chuỗi (LUẬT #1).
 *
 * Khớp lệnh là việc của ngân hàng (Owner chốt giữ tách quyền): gửi xong màn hiện tiến trình và tự làm
 * mới; khi Giao dịch viên khớp thì hiện mã giao dịch và số dư mới.
 */

/** Hoãn lời gọi kiểm tra sau khi người dùng ngừng gõ: service không có bộ nhớ đệm. */
const PREVIEW_DEBOUNCE_MS = 400;
/** Nhịp làm mới tiến trình lệnh vừa gửi. */
const TRACK_INTERVAL_MS = 3_000;

type Keyed<T> = { key: string; value: T };

export function InvestorTradePage({ mockWallet }: { mockWallet: string | null }) {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();
  // Chain mock không ký giao dịch: dùng đúng ví trong hồ sơ của phiên để bản demo chạy không cần
  // extension. Chain thật vẫn chỉ tin địa chỉ do connector ví cung cấp.
  const wallet = chain === 'mock' ? mockWallet : address;

  const [side, setSide] = useState<OrderSide>('BUY');
  const [quantity, setQuantity] = useState('');
  const [contextTick, setContextTick] = useState(0);
  const [context, setContext] = useState<Keyed<{ data: TradeContextView | null; error: string | null }> | null>(null);
  const [previewResult, setPreviewResult] = useState<Keyed<TradePreviewState> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tracked, setTracked] = useState<OrderView | null>(null);
  const requestRef = useRef<{ intent: string; id: string } | null>(null);

  // --- Bối cảnh: token, số dư, giá, trần hai chiều -------------------------------
  const contextKey = wallet ? `${chain}|${wallet}|${contextTick}` : null;
  useEffect(() => {
    if (!contextKey || !wallet) return;
    let cancelled = false;
    void getTradeContextAction({ chain, wallet }).then((result) => {
      if (cancelled) return;
      setContext({
        key: contextKey,
        value: result.ok ? { data: result.data, error: null } : { data: null, error: result.error },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [contextKey, chain, wallet]);
  const freshContext = context?.key === contextKey ? context.value : null;
  const ctx = freshContext?.data ?? null;

  // --- Khối kiểm tra: gọi lại khi đổi chiều / số lượng, đã hoãn ---------------------
  const caps = ctx?.caps ?? null;
  const quantityReason = quantityBlockReason(quantity, side, caps);
  const amount = quantityReason === null ? parseQuantity(quantity)!.toString() : null;
  const previewKey = amount && wallet ? `${chain}|${wallet}|${side}|${amount}|${contextTick}` : null;
  useEffect(() => {
    if (!previewKey || !wallet || !amount) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewTradeAction({ chain, investorWallet: wallet, wptAmount: amount, side }).then((result) => {
        if (cancelled) return;
        setPreviewResult({
          key: previewKey,
          value: result.ok ? { kind: 'checked', ...result.data } : { kind: 'error', message: result.error },
        });
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewKey, chain, wallet, amount, side]);
  const preview: TradePreviewState = !previewKey
    ? { kind: 'idle' }
    : previewResult?.key === previewKey
      ? previewResult.value
      : { kind: 'loading' };
  const blockReason = confirmBlockReason(quantity, side, caps, preview);
  const total = preview.kind === 'checked' && preview.wptAmount === amount ? preview.vndAmount : null;

  // --- Theo dõi lệnh vừa gửi tới khi có kết cục -------------------------------------
  const trackingId = tracked && !isSettled(tracked) ? tracked.id : null;
  useEffect(() => {
    if (!trackingId || !wallet) return;
    const timer = setInterval(() => {
      void listOrdersAction({ chain, investorWallet: wallet, orderId: trackingId }).then((result) => {
        const order = result.ok ? result.data[0] : undefined;
        if (!order) return;
        setTracked(order);
        // Có kết cục thì đọc lại số dư từ chuỗi (việc 8).
        if (isSettled(order)) setContextTick((tick) => tick + 1);
      });
    }, TRACK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [trackingId, chain, wallet]);

  async function submit() {
    if (!wallet || !amount) return;
    const intent = `${chain}|${wallet.toLowerCase()}|${side}|${amount}`;
    if (requestRef.current?.intent !== intent) {
      requestRef.current = { intent, id: crypto.randomUUID() };
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await placeOrderAction({
      chain,
      investorWallet: wallet,
      wptAmount: amount,
      side,
      clientRequestId: requestRef.current.id,
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setTracked(result.data);
    requestRef.current = null;
    setQuantity('');
    setContextTick((tick) => tick + 1);
  }

  if (!wallet || (chain !== 'mock' && !isConnected)) return <ConnectWalletPrompt />;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Giao dịch token</h1>
        <p className="text-sm text-muted-foreground">
          Mua token từ người bán hoặc bán lại cho người bán, theo giá phát hành do ngân hàng cấu hình.
        </p>
      </header>

      {chain === 'mock' && (
        <p className="text-xs text-muted-foreground" role="note">
          Chế độ mô phỏng đang dùng ví trong hồ sơ Nhà đầu tư: <span className="font-mono">{wallet}</span>.
          Không cần kết nối ví trình duyệt.
        </p>
      )}

      {freshContext === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc số dư và thông tin token…
        </p>
      ) : freshContext.error ? (
        <p className="text-sm text-destructive">{freshContext.error}</p>
      ) : ctx ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Đặt lệnh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Token</span>
                <select aria-label="Token" className={FIELD} defaultValue={ctx.token?.tokenSymbol ?? ''} disabled={ctx.tokens.length <= 1}>
                  {ctx.tokens.map((t) => (
                    <option key={t.tokenSymbol} value={t.tokenSymbol}>
                      {t.tokenSymbol}: {t.projectName}
                    </option>
                  ))}
                </select>
              </label>

              <div role="tablist" aria-label="Chiều lệnh" className="grid grid-cols-2 gap-2">
                {(['BUY', 'SELL'] as const).map((value) => (
                  <Button
                    key={value}
                    role="tab"
                    aria-selected={side === value}
                    variant={side === value ? 'default' : 'outline'}
                    onClick={() => setSide(value)}
                  >
                    {SIDE_LABELS[value]}
                  </Button>
                ))}
              </div>

              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Số lượng</span>
                <input
                  aria-label="Số lượng"
                  inputMode="numeric"
                  className={FIELD}
                  value={quantity}
                  aria-invalid={quantity !== '' && quantityReason !== null}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <span className="block text-xs text-muted-foreground" data-testid="quantity-cap">
                  {ctx.caps[side].reason}
                </span>
                {quantity !== '' && quantityReason && (
                  <span className="block text-xs text-destructive" role="alert">
                    {quantityReason}
                  </span>
                )}
              </label>

              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Giá (VNDB / token, chỉ để xem)</span>
                <input aria-label="Giá" className={`${FIELD} bg-muted/40`} value={formatAmount(ctx.priceVnd)} readOnly />
              </label>

              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Tổng giá trị dự kiến</span>
                <span className="font-mono text-lg font-semibold">{total ? `${formatAmount(total)} VNDB` : 'Chưa có'}</span>
              </div>

              <TradeCheckBlock preview={preview} />

              <div className="space-y-1">
                <Button className="w-full" disabled={blockReason !== null} onClick={() => setConfirmOpen(true)}>
                  Xác nhận lệnh {SIDE_LABELS[side].toLowerCase()}
                </Button>
                {blockReason && <p className="text-xs text-muted-foreground">{blockReason}</p>}
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <OrderSummary side={side} quantity={amount} priceVnd={ctx.priceVnd} total={total} balances={ctx.balances} />
            <TokenInfoCard token={ctx.token} />
          </div>
        </div>
      ) : null}

      {tracked && <TrackedOrder order={tracked} chain={chain} />}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đối chiếu lệnh lần cuối</DialogTitle>
            <DialogDescription>Kiểm tra lại trước khi gửi. Số VNDB được chốt tại thời điểm gửi.</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-2 text-sm">
            <Row label="Loại lệnh">{SIDE_LABELS[side]}</Row>
            <Row label="Số lượng" mono>{formatAmount(amount)}</Row>
            <Row label="Giá" mono>{ctx ? `${formatAmount(ctx.priceVnd)} VNDB` : 'Chưa có'}</Row>
            <Row label="Tổng giá trị" mono>{total ? `${formatAmount(total)} VNDB` : 'Chưa có'}</Row>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Quay lại
            </Button>
            <Button onClick={() => void submit()} disabled={submitting || blockReason !== null}>
              {submitting ? 'Đang gửi…' : 'Gửi lệnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive';

function Row({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : undefined}>{children}</dd>
    </div>
  );
}

function OrderSummary({
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
          <Row label="Token đang giữ" mono>{formatAmount(balances.wpt)}</Row>
          <Row label="Số dư VNDB" mono>{formatAmount(balances.vndb)}</Row>
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

function TokenInfoCard({ token }: { token: InvestorTokenInfo | null }) {
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
                {token.tradingOpen ? 'Đang mở' : 'Tạm dừng (tất toán)'}
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

function TrackedOrder({ order, chain }: { order: OrderView; chain: string }) {
  return (
    <Card aria-label="Lệnh vừa gửi">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Lệnh {SIDE_LABELS[order.side].toLowerCase()} vừa gửi: {ORDER_STATUS_LABELS[order.status]}
        </CardTitle>
        <Link href={`/orders/${order.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          Xem chi tiết
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isSettled(order) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang xử lý: lệnh chờ ngân hàng khớp, màn hình tự cập nhật.
          </p>
        )}
        {order.txHash && (
          <p className="text-sm">
            Mã giao dịch{chain === 'mock' ? ' mô phỏng' : ''}:{' '}
            <span className="break-all font-mono text-xs">{order.txHash}</span>
          </p>
        )}
        {order.reason && <p className="text-sm text-destructive">{order.reason}</p>}
        <SettlementProgress steps={order.steps} settlement={order.settlement} />
      </CardContent>
    </Card>
  );
}

function ConnectWalletPrompt() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">Chưa kết nối ví</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Kết nối ví ở góc trên phải, hoặc mở{' '}
        <Link href="/wallet" className="text-primary underline-offset-4 hover:underline">
          Ví của tôi
        </Link>{' '}
        để đặt lệnh mua hoặc bán token.
      </p>
    </div>
  );
}
