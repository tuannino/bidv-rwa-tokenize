'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
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
import { listOrdersAction, placeOrderAction, preparePermitAction } from '@/app/actions/purchase';
import { getTradeContextAction, previewTradeAction } from '@/app/actions/trade';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount } from '@/lib/format';
import type { OrderView, PermitPreparationView } from '@/lib/bank/purchase.service';
import { CHAINS } from '@bidv/shared';
import { useWalletStatus } from '@/lib/hooks/use-wallet-status';
import { signPermitWithWallet } from '@/lib/signer/wallet-permit';
import { isUserRejection } from '@/lib/wallet/switch-error';
import { tradeSides } from '@/components/trading/sides';
import type { TradeContextView } from '@/lib/bank/trade.service';
import type { OrderSide } from '@/lib/store/order.store.port';
import { TradeCheckBlock } from '@/components/trading/trade-check-block';
import {
  SIDE_LABELS,
  confirmBlockReason,
  isSettled,
  parseQuantity,
  quantityBlockReason,
  WALLET_NOT_BOUND_REASON,
  type TradePreviewState,
} from '@/components/trading/gates';
import { WalletNotBoundNotice } from '@/components/investor/wallet-not-bound-notice';
import { tradeBlockText } from '@/components/recall/gates';
import { TokenScopeSelect } from '@/components/token/token-scope-select';
import {
  ConnectWalletPrompt,
  OrderSummary,
  PermitNotice,
  Row,
  TokenInfoCard,
  TrackedOrder,
} from '@/components/trading/trade-panels';

/**
 * Màn GIAO DỊCH TOKEN của Nhà đầu tư (FE-25 việc 1 đến 8).
 *
 * Mọi con số và mọi kết luận lấy từ máy chủ: trần số lượng và số dư từ `getTradeContextAction`, năm
 * điều kiện và tổng giá trị từ `previewTradeAction`, tiến trình từ `listOrdersAction`. Component không
 * nhập `viem` và không gọi chuỗi (LUẬT #1).
 *
 * Lệnh hợp lệ được hệ thống tự quyết toán bằng ví ngân hàng; quyền `order:execute` vẫn tách riêng
 * và chỉ dùng khi Giao dịch viên can thiệp lệnh kẹt. Kết quả của lời gọi đặt lệnh đã mang trạng
 * thái cuối; polling chỉ là lưới an toàn cho trạng thái đang dở.
 */

/** Hoãn lời gọi kiểm tra sau khi người dùng ngừng gõ: service không có bộ nhớ đệm. */
const PREVIEW_DEBOUNCE_MS = 400;
/** Nhịp làm mới tiến trình lệnh vừa gửi. */
const TRACK_INTERVAL_MS = 3_000;

type Keyed<T> = { key: string; value: T };

/**
 * Bước của nút ký trên chain thật (FE-05 QĐ-I): chuẩn bị typed data, chờ người dùng ký trong ví,
 * gửi lệnh. `idle` là chưa làm gì hoặc vừa quay lại hộp xác nhận.
 */
type SignPhase = 'idle' | 'preparing' | 'signing' | 'sending';

const SIGN_PHASE_LABELS: Record<Exclude<SignPhase, 'idle'>, string> = {
  preparing: 'Đang chuẩn bị…',
  signing: 'Đang chờ ký trong ví…',
  sending: 'Đang gửi lệnh…',
};

export function InvestorTradePage({ mockWallet }: { mockWallet: string | null }) {
  const { address, isConnected, connector } = useAccount();
  const { chain } = useSelectedChain();
  // FE-05: chain EVM thật đặt lệnh bằng chữ ký permit của ví; mock giữ nguyên hành vi cũ.
  const needsPermit = CHAINS[chain].family === 'evm';
  const walletStatus = useWalletStatus();
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
  const [signPhase, setSignPhase] = useState<SignPhase>('idle');
  /** Typed data đã chuẩn bị, gắn với ý định lệnh để không ký số của một lệnh khác. */
  const [prepared, setPrepared] = useState<Keyed<PermitPreparationView> | null>(null);
  /** Câu báo trong hộp xác nhận (huỷ ký, lỗi chuẩn bị/ký); khác `submitError` hiện ngoài hộp. */
  const [dialogNote, setDialogNote] = useState<string | null>(null);

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
  // FIX-01 E2: ví chưa gắn cho hồ sơ phiên thì khoá ô số lượng và nút gửi, không xem trước.
  const walletBound = ctx?.walletBound ?? true;
  const quantityReason = quantityBlockReason(quantity, side, caps, walletBound);
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
          value: result.ok
            ? { kind: 'checked', ...result.data }
            : { kind: 'error', message: result.error, notBound: result.code === 'WALLET_NOT_BOUND' },
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
  const tradeBlocked = ctx?.tradeBlock !== null && ctx?.tradeBlock !== undefined;
  const blockReason = confirmBlockReason(quantity, side, caps, preview, tradeBlocked, walletBound);
  const total = preview.kind === 'checked' && preview.wptAmount === amount ? preview.vndAmount : null;

  // --- Theo dõi lệnh vừa gửi tới khi có kết cục -------------------------------------
  const trackingId = tracked && !isSettled(tracked) ? tracked.id : null;
  useEffect(() => {
    if (!trackingId || !wallet) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void listOrdersAction({ chain, investorWallet: wallet, orderId: trackingId }).then((result) => {
        if (cancelled) return;
        const order = result.ok ? result.data[0] : undefined;
        if (!order) return;
        setTracked(order);
        // Có kết cục thì đọc lại số dư từ chuỗi (việc 8).
        if (isSettled(order)) setContextTick((tick) => tick + 1);
      });
    }, TRACK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [trackingId, chain, wallet]);

  const intent = wallet && amount ? `${chain}|${wallet.toLowerCase()}|${side}|${amount}` : null;
  const freshPrepared = prepared && prepared.key === intent ? prepared.value : null;

  /** FE-05 QĐ-A bước 1: máy chủ dựng typed data đúng số của lệnh. `null` khi không chuẩn bị được. */
  async function preparePermit(): Promise<PermitPreparationView | null> {
    if (!wallet || !amount || !intent) return null;
    setSignPhase('preparing');
    const result = await preparePermitAction({ chain, investorWallet: wallet, wptAmount: amount, side });
    setSignPhase('idle');
    if (!result.ok) {
      setDialogNote(result.error);
      return null;
    }
    setPrepared({ key: intent, value: result.data });
    return result.data;
  }

  function openConfirm() {
    setDialogNote(null);
    setConfirmOpen(true);
    // Chuẩn bị ngay khi mở hộp để câu xác nhận nêu đúng số sẽ ký và giờ hết hạn.
    if (needsPermit && !freshPrepared) void preparePermit();
  }

  async function submit() {
    if (!wallet || !amount || !intent) return;
    // BE-17: một mã chống trùng cho MỘT ý định lệnh, giữ qua mọi lần thử lại, kể cả khi ký lại.
    if (requestRef.current?.intent !== intent) {
      requestRef.current = { intent, id: crypto.randomUUID() };
    }
    const clientRequestId = requestRef.current.id;
    setSubmitting(true);
    setSubmitError(null);
    setDialogNote(null);

    let permit: { value: string; deadline: string; nonce: string; signature: string } | undefined;
    if (needsPermit) {
      const data = freshPrepared ?? (await preparePermit());
      if (!data) {
        setSubmitting(false);
        return;
      }
      setSignPhase('signing');
      try {
        const provider = (await connector?.getProvider()) as Parameters<typeof signPermitWithWallet>[0];
        const signature = await signPermitWithWallet(provider, data.typedData);
        permit = { value: data.value, deadline: data.deadline, nonce: data.nonce, signature };
      } catch (error) {
        // Từ chối ký là lựa chọn của người dùng, không phải sự cố: quay lại hộp xác nhận, không gửi gì.
        setDialogNote(
          isUserRejection(error)
            ? 'Bạn đã huỷ ký. Chưa có lệnh nào được gửi.'
            : `Không ký được: ${error instanceof Error ? error.message : 'lỗi ví không xác định.'}`,
        );
        setSignPhase('idle');
        setSubmitting(false);
        return;
      }
      setSignPhase('sending');
    }

    const result = await placeOrderAction({
      chain,
      investorWallet: wallet,
      wptAmount: amount,
      side,
      clientRequestId,
      ...(permit ? { permit } : {}),
    });
    setSignPhase('idle');
    setSubmitting(false);
    // Chữ ký đã dùng cho lần gửi này; lần thử sau chuẩn bị lại (nonce, giá, hạn có thể đã đổi).
    setPrepared(null);
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

  const walletBlocked = needsPermit && !walletStatus.canSign;

  if (!wallet || (chain !== 'mock' && !isConnected)) return <ConnectWalletPrompt />;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Giao dịch token</h1>
      </header>

      {chain === 'mock' && (
        <p className="text-xs text-muted-foreground" role="note">
          Chế độ mô phỏng đang dùng ví trong hồ sơ Nhà đầu tư: <span className="font-code">{wallet}</span>.
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
              {!ctx.walletBound && <WalletNotBoundNotice wallet={ctx.wallet} />}
              {ctx.tradeBlock && (
                <div role="alert" className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                  <p className="font-semibold">Giao dịch tạm dừng</p>
                  <p>{tradeBlockText(ctx.tradeBlock)}</p>
                  <Link prefetch={false} href="/portfolio" className="underline underline-offset-4">Xem thông báo ở Tổng quan</Link>
                </div>
              )}
              <TokenScopeSelect
                id="token-scope"
                ariaLabel="Token"
                tokens={ctx.tokens}
                value={ctx.token?.tokenSymbol}
                disabled={tradeBlocked}
              />

              {/* FIX-02 A4: chỉ một chiều (Nhà đầu tư chỉ mua) thì không dựng cụm nút; `side` giữ BUY. */}
              {tradeSides(ctx.sellEnabled).length > 1 && (
              <div role="tablist" aria-label="Chiều lệnh" className="grid grid-cols-2 gap-2">
                {tradeSides(ctx.sellEnabled).map((value) => (
                  <Button
                    key={value}
                    role="tab"
                    aria-selected={side === value}
                    variant={side === value ? 'default' : 'outline'}
                    disabled={tradeBlocked}
                    onClick={() => setSide(value)}
                  >
                    {SIDE_LABELS[value]}
                  </Button>
                ))}
              </div>
              )}

              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Số lượng</span>
                <input
                  aria-label="Số lượng"
                  inputMode="numeric"
                  className={FIELD}
                  value={quantity}
                  aria-invalid={quantity !== '' && quantityReason !== null}
                  disabled={tradeBlocked || !ctx.walletBound}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <span className="block text-xs text-muted-foreground" data-testid="quantity-cap">
                  {ctx.walletBound ? ctx.caps[side].reason : WALLET_NOT_BOUND_REASON}
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
                <span className="tabular-nums text-lg font-semibold">{total ? `${formatAmount(total)} VNDB` : 'Chưa có'}</span>
              </div>

              <TradeCheckBlock preview={preview} wallet={ctx.wallet} />

              <div className="space-y-1">
                <Button className="w-full" disabled={blockReason !== null} onClick={openConfirm}>
                  Xác nhận lệnh {SIDE_LABELS[side].toLowerCase()}
                </Button>
                {blockReason && <p className="text-xs text-muted-foreground">{blockReason}</p>}
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <OrderSummary side={side} quantity={amount} priceVnd={ctx.priceVnd} total={total} balances={ctx.balances} />
            <TokenInfoCard token={ctx.token} tradeBlock={ctx.tradeBlock} />
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
          {needsPermit && (
            <PermitNotice
              prepared={freshPrepared}
              preparing={signPhase === 'preparing'}
              walletStatus={walletStatus}
            />
          )}
          {dialogNote && (
            <p className="text-sm text-destructive" role="alert" data-testid="sign-note">
              {dialogNote}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Quay lại
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={submitting || blockReason !== null || walletBlocked || signPhase === 'preparing'}
            >
              {signPhase !== 'idle'
                ? SIGN_PHASE_LABELS[signPhase]
                : needsPermit
                  ? 'Ký và đặt lệnh'
                  : submitting
                    ? 'Đang gửi…'
                    : 'Gửi lệnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive';
