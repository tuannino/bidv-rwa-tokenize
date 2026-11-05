'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { CHAINS } from '@bidv/shared';
import { BadgeCheck, Loader2, Wallet } from 'lucide-react';
import {
  beginPaymentSendAction,
  cancelPaymentWithdrawAction,
  checkPaymentWithdrawTargetAction,
  createPaymentWithdrawAction,
  getPaymentWithdrawPageAction,
  submitPaymentWithdrawTxAction,
} from '@/app/actions/payment-withdraw';
import { WalletNotBoundNotice } from '@/components/investor/wallet-not-bound-notice';
import { AmountInput } from '@/components/ui/amount-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { nf } from '@/components/withdraw/format';
import { PAYMENT_WITHDRAW_STATUS_LABELS } from '@/components/withdraw/labels';
import { WithdrawRequestRow } from '@/components/withdraw/withdraw-request-row';
import type { PaymentWithdrawPageView, PaymentWithdrawView } from '@/lib/bank/payment-withdraw.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';
import { assertWalletReady, sendPaymentTransferWithWallet } from '@/lib/signer/wallet-transfer';
import { isUserRejection } from '@/lib/wallet/switch-error';

/**
 * Màn RÚT VNDB của Nhà đầu tư (FE-23 C1 tới C6), chép bố cục màn "Tạo lệnh rút" của Người bán.
 *
 * VNDB nằm trong ví của Nhà đầu tư, nên giao dịch do CHÍNH ví đó ký và gửi (Nhà đầu tư trả gas). Một lần
 * bấm "Xác nhận": máy chủ tạo lệnh, giữ chỗ lần gửi và trả giao dịch cần gửi đúng một lần, trình duyệt
 * gửi qua ví rồi báo mã; máy chủ chỉ chốt hoàn tất khi có bằng chứng trên chuỗi. Chain mock không có ví
 * trình duyệt: máy chủ chuyển thay, lệnh về "Hoàn tất" ngay.
 */

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted disabled:opacity-60';

type Feedback = { tone: 'ok' | 'error'; message: string };

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Câu kết quả theo trạng thái lệnh sau một lần thao tác (C4). */
function settledMessage(view: PaymentWithdrawView): Feedback {
  if (view.status === 'COMPLETED') return { tone: 'ok', message: `Đã rút ${nf(view.amount)} VNDB tới ví ${view.toWallet}.` };
  if (view.status === 'SUBMITTED') return { tone: 'ok', message: 'Đã gửi, chờ xác nhận trên chuỗi; mở lại màn sau ít phút.' };
  if (view.status === 'CANCELLED') return { tone: 'error', message: `Lệnh rút đã huỷ${view.reason ? `: ${view.reason}` : '.'}` };
  return { tone: 'error', message: `Lệnh rút đang ở trạng thái: ${PAYMENT_WITHDRAW_STATUS_LABELS[view.status]}.` };
}

export function InvestorWithdrawPage({ mockWallet }: { mockWallet: string | null }) {
  const { chain } = useSelectedChain();
  const chainLabel = usePublicConfig().chains.find((c) => c.key === chain)?.label ?? chain;
  const { address, connector } = useAccount();
  const onMock = CHAINS[chain].family === 'mock';
  const chainId = CHAINS[chain].chainId;
  // Mock không ký giao dịch: ví gửi là ví mẫu của hồ sơ. Chain thật chỉ tin địa chỉ do ví cung cấp.
  const wallet = onMock ? mockWallet : (address ?? null);

  const [version, setVersion] = useState(0);
  const requestKey = `${chain}|${wallet ?? ''}|${version}`;
  /** E6: kết quả giữ khoá `chain|ví` của lần gọi; khoá khác hiện tại thì bỏ. */
  const [loaded, setLoaded] = useState<{
    key: string;
    data: PaymentWithdrawPageView | null;
    error: string | null;
    notBound: boolean;
  } | null>(null);

  const [form, setForm] = useState({ amount: '', toWallet: '', purpose: '', note: '' });
  const [toError, setToError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [checkedTo, setCheckedTo] = useState('');
  const [otp, setOtp] = useState('');
  /** Sinh MỘT lần cho mỗi lần mở hộp xác nhận: bấm lại trong cùng lần đó không tạo lệnh thứ hai. */
  const [clientRequestId, setClientRequestId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    void getPaymentWithdrawPageAction({ chain, wallet }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, data: result.data, error: null, notBound: false }
          : { key: requestKey, data: null, error: result.error, notBound: result.code === 'WALLET_NOT_BOUND' },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, wallet, requestKey]);

  const fresh = loaded?.key === requestKey ? loaded : null;
  // Tải lại sau thao tác: giữ số liệu cùng chain, cùng ví trong lúc chờ để màn không nhấp nháy.
  const sameScope = loaded?.key.startsWith(`${chain}|${wallet ?? ''}|`) ? loaded : null;
  const data = (fresh ?? sameScope)?.data ?? null;
  const reload = () => setVersion((value) => value + 1);

  const balance = data ? BigInt(data.balance) : null;
  const amount = /^\d+$/.test(form.amount) ? BigInt(form.amount) : null;
  const exceeds = balance !== null && amount !== null && amount > balance;
  const after = balance !== null && amount !== null && !exceeds ? balance - amount : null;
  const canSubmit =
    data !== null &&
    amount !== null &&
    amount > 0n &&
    !exceeds &&
    form.toWallet.trim() !== '' &&
    form.purpose.trim() !== '' &&
    !checking &&
    busy === null;

  const set = (name: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [name]: e.target.value }));
    if (name === 'toWallet') setToError(null);
  };

  const provider = async () => (await connector?.getProvider()) as Parameters<typeof sendPaymentTransferWithWallet>[0];

  /** C2: kiểm ví nhận ở máy chủ trước; không đạt thì hiện câu dưới ô, không mở hộp mã một lần. */
  const openConfirm = async () => {
    if (!wallet) return;
    setChecking(true);
    setFeedback(null);
    const checked = await checkPaymentWithdrawTargetAction({ chain, wallet, toWallet: form.toWallet.trim() });
    setChecking(false);
    if (!checked.ok) {
      setToError(checked.fieldErrors?.toWallet?.[0] ?? checked.error);
      return;
    }
    setCheckedTo(checked.data.toWallet);
    setClientRequestId(crypto.randomUUID());
    setOtp('');
    setDialogOpen(true);
  };

  /**
   * A8 rồi gửi qua ví (chain khác mock), báo mã (A2); từ chối ký (4001) thì huỷ có quét (A3). Từ khi
   * A8 trả giao dịch, lệnh đã `SENDING`: lỗi ví khác không gửi lại được, Nhà đầu tư huỷ hoặc để hết hạn.
   */
  const sendFromWallet = async (view: PaymentWithdrawView): Promise<Feedback> => {
    if (!onMock && chainId !== undefined) {
      try {
        await assertWalletReady(await provider(), { from: view.fromWallet, chainId });
      } catch (error) {
        return { tone: 'error', message: error instanceof Error ? error.message : 'Ví chưa sẵn sàng.' };
      }
    }
    const begun = await beginPaymentSendAction({ chain, id: view.id });
    if (!begun.ok) return { tone: 'error', message: begun.error };
    if (!begun.data.txRequest) return settledMessage(begun.data);
    const txRequest = begun.data.txRequest;
    setBusy('Đang chờ ký trong ví…');
    let txHash: string;
    try {
      txHash = await sendPaymentTransferWithWallet(await provider(), {
        from: view.fromWallet,
        chainId: txRequest.chainId,
        to: txRequest.to,
        data: txRequest.data,
      });
    } catch (error) {
      if (isUserRejection(error)) {
        const cancelled = await cancelPaymentWithdrawAction({ chain, id: view.id, walletRejected: true });
        if (cancelled.ok && cancelled.data.status === 'COMPLETED') return settledMessage(cancelled.data);
        return { tone: 'error', message: 'Bạn đã từ chối ký trong ví; lệnh rút đã huỷ.' };
      }
      return {
        tone: 'error',
        message: `Ví không gửi được giao dịch: ${error instanceof Error ? error.message : 'lỗi ví không xác định.'} Lệnh đã gửi tới ví nên không gửi lại được; bấm "Huỷ" rồi tạo lệnh mới, hoặc để lệnh hết hạn.`,
      };
    }
    setBusy('Đang báo mã giao dịch…');
    const submitted = await submitPaymentWithdrawTxAction({ chain, id: view.id, txHash });
    return submitted.ok ? settledMessage(submitted.data) : { tone: 'error', message: submitted.error };
  };

  /** Một lần bấm "Xác nhận": A1 rồi A8 ngay. */
  const confirm = async () => {
    if (!wallet) return;
    setBusy('Đang tạo lệnh…');
    setFeedback(null);
    const created = await createPaymentWithdrawAction({
      chain,
      wallet,
      toWallet: checkedTo,
      amount: form.amount,
      purpose: form.purpose.trim(),
      note: form.note.trim(),
      otp,
      clientRequestId,
    });
    setOtp('');
    if (!created.ok) {
      setBusy(null);
      if (created.fieldErrors?.otp === undefined) setDialogOpen(false);
      setFeedback({ tone: 'error', message: created.error });
      reload();
      return;
    }
    setDialogOpen(false);
    setForm({ amount: '', toWallet: '', purpose: '', note: '' });
    const outcome = await sendFromWallet(created.data);
    setBusy(null);
    setFeedback(outcome);
    reload();
  };

  const sendRow = async (view: PaymentWithdrawView) => {
    setBusy('Đang gửi tới ví…');
    setFeedback(null);
    const outcome = await sendFromWallet(view);
    setBusy(null);
    setFeedback(outcome);
    reload();
  };

  const cancelRow = async (view: PaymentWithdrawView) => {
    setBusy('Đang huỷ…');
    setFeedback(null);
    const result = await cancelPaymentWithdrawAction({ chain, id: view.id, walletRejected: false });
    setBusy(null);
    setFeedback(result.ok ? settledMessage(result.data) : { tone: 'error', message: result.error });
    reload();
  };

  const header = (
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-foreground">Rút VNDB</h1>
    </header>
  );

  if (!wallet) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-medium">Chưa kết nối ví</p>
            <p className="text-xs text-muted-foreground">
              Kết nối ví đã định danh để rút VNDB.{' '}
              <Link prefetch={false} href="/wallet" className="text-primary underline-offset-4 hover:underline">
                Kết nối ví
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = data?.requests ?? [];
  return (
    <div className="space-y-6">
      {header}

      {fresh?.notBound ? (
        <WalletNotBoundNotice wallet={wallet} />
      ) : data === null && fresh?.error ? (
        <p className="py-6 text-sm text-destructive">{fresh.error}</p>
      ) : data === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc số dư…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Thông tin lệnh rút
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                aria-label="Biểu mẫu rút VNDB"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) void openConfirm();
                }}
              >
                <Field id="pw-amount" label="Số tiền rút (VNDB)">
                  <AmountInput
                    id="pw-amount"
                    value={form.amount}
                    onValueChange={(raw) => setForm((current) => ({ ...current, amount: raw }))}
                    className={`${FIELD} tabular-nums`}
                  />
                </Field>
                {exceeds && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Vượt số dư: chỉ rút được tối đa {nf(balance)} VNDB.
                  </p>
                )}
                <Field id="pw-network" label="Mạng">
                  <input id="pw-network" readOnly value={chainLabel} className={FIELD} />
                </Field>
                <div className="space-y-1.5">
                  <label htmlFor="pw-from" className="text-sm font-medium">
                    Ví gửi
                  </label>
                  <div className="flex items-center gap-2">
                    <input id="pw-from" readOnly value={wallet} className={`${FIELD} font-code`} />
                    <Badge className="shrink-0 gap-1" data-wallet-bound="true">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                      Đã định danh
                    </Badge>
                  </div>
                </div>
                <Field id="pw-to" label="Ví nhận">
                  <input
                    id="pw-to"
                    value={form.toWallet}
                    onChange={set('toWallet')}
                    placeholder="0x…"
                    spellCheck={false}
                    aria-invalid={toError !== null}
                    className={`${FIELD} font-code`}
                  />
                </Field>
                {toError && (
                  <p role="alert" className="text-sm text-destructive">
                    {toError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Ví nhận phải đã whitelist trên chuỗi và khác ví gửi.</p>
                <Field id="pw-purpose" label="Mục đích">
                  <input id="pw-purpose" value={form.purpose} onChange={set('purpose')} className={FIELD} />
                </Field>
                <Field id="pw-note" label="Ghi chú">
                  <textarea id="pw-note" rows={2} value={form.note} onChange={set('note')} className={FIELD} />
                </Field>
                <Button type="submit" disabled={!canSubmit}>
                  {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Tạo lệnh rút
                </Button>
                {busy && (
                  <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {busy}
                  </p>
                )}
                {feedback && !dialogOpen && (
                  <p
                    role={feedback.tone === 'error' ? 'alert' : 'status'}
                    aria-label="Kết quả rút VNDB"
                    className={feedback.tone === 'error' ? 'break-all text-sm text-destructive' : 'break-all text-sm text-foreground'}
                  >
                    {feedback.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2} className="text-base">
                Hệ thống tính
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-muted-foreground">Số dư VNDB</dt>
                <dd className="text-right tabular-nums" data-testid="payment-balance">
                  {nf(balance)}
                </dd>
                <dt className="text-muted-foreground">Số rút</dt>
                <dd className="text-right tabular-nums">{amount !== null ? nf(amount) : '-'}</dd>
                <dt className="font-medium">Số dư sau rút</dt>
                <dd className="text-right tabular-nums font-semibold">{nf(after)}</dd>
              </dl>
              {!onMock && <p className="mt-3 text-xs text-muted-foreground">Phí gas do ví của bạn trả bằng ETH của mạng.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Lệnh rút của tôi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lệnh rút VNDB nào của ví này trên chain này.</p>
          ) : (
            <Table aria-label="Lệnh rút của tôi">
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Ví nhận</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Mã giao dịch</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <WithdrawRequestRow
                    key={r.id}
                    row={r}
                    chain={chain}
                    busy={busy !== null}
                    onSend={() => sendRow(r)}
                    onCancel={() => cancelRow(r)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận mã một lần</DialogTitle>
            <DialogDescription>
              Nhập mã sáu chữ số để rút {nf(form.amount)} VNDB tới ví nhận. Bản thử: chưa gửi mã thật, hệ thống chỉ kiểm
              đúng sáu chữ số.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-sm" data-testid="otp-payment-target">
            Ví nhận: <span className="font-code">{checkedTo}</span> (đã whitelist)
          </p>
          {!onMock && <p className="text-xs text-muted-foreground">Sau khi xác nhận, ví của bạn sẽ hỏi ký giao dịch.</p>}
          <input
            aria-label="Mã một lần"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className={`${FIELD} text-center font-code text-lg tracking-[0.5em]`}
          />
          {!/^\d{6}$/.test(otp) && otp.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Mã một lần phải đúng sáu chữ số.
            </p>
          )}
          {feedback?.tone === 'error' && dialogOpen && (
            <p role="alert" className="text-sm text-destructive">
              {feedback.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" disabled={!/^\d{6}$/.test(otp) || busy !== null} onClick={() => void confirm()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
