'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
import {
  cancelWithdrawRequestAction,
  checkPayoutWalletAction,
  continueWithdrawRequestAction,
  createWithdrawRequestAction,
  reconcileAndListMyWithdrawRequestsAction,
} from '@/app/actions/withdraw';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WithdrawRequestView } from '@/lib/bank/withdraw.service';
import { quoteWithdraw } from '@/lib/bank/withdraw-limit';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';
import { describePolicy, nf } from '@/components/seller/format';
import { WITHDRAW_STATUS_LABELS } from '@/components/seller/labels';
import { SellerWithdrawRow } from '@/components/seller/seller-withdraw-row';
import { useSellerOverview } from '@/components/seller/use-seller-overview';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

/**
 * Màn TẠO LỆNH RÚT NGƯỜI BÁN (FE-21 việc 10–15, BE-13 QĐ-I, FIX-01 G1 tới G6).
 *
 * Số dư, phần khoá và phần được rút là SỐ THẬT của vault trên chuỗi (`getSellerOverview`). Người bán
 * chọn ví nhận ngay ở lệnh (điền sẵn ví đang đặt trên vault); ví khác ví đang đặt thì hệ thống gửi
 * thêm một giao dịch đặt ví nhận trước khi rút. Bấm "Tạo lệnh rút" thì máy chủ kiểm ví nhận TRƯỚC khi
 * mở hộp mã một lần. Không thu phí trong PoC: số nhận bằng số rút.
 */

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted';

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

export function SellerWithdrawPage() {
  const { data, error, loading, reload } = useSellerOverview();
  const { chain } = useSelectedChain();
  const chainLabel = usePublicConfig().chains.find((c) => c.key === chain)?.label ?? chain;

  const { address } = useAccount();
  const [form, setForm] = useState({ amount: '', purpose: '', note: '' });
  /** Ví nhận người dùng đã sửa, theo chain; chưa sửa thì dùng ví đang đặt trên vault (G1). */
  const [payoutDraft, setPayoutDraft] = useState<{ chain: string; value: string } | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  /** Hộp mã một lần dùng chung: tạo lệnh mới, hoặc gửi rút cho lệnh đã đặt ví nhận (G6). */
  const [dialog, setDialog] = useState<
    | { kind: 'create'; wallet: string }
    | { kind: 'continue'; id: string; amount: string; wallet: string }
    | null
  >(null);
  const otpOpen = dialog !== null;
  const setOtpOpen = (open: boolean) => {
    if (!open) setDialog(null);
  };
  const [otp, setOtp] = useState('');
  /** Sinh MỘT lần cho mỗi lần mở hộp xác nhận: bấm lại hay gửi lại trong cùng lần đó không tạo lệnh thứ hai. */
  const [clientRequestId, setClientRequestId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);
  const [requests, setRequests] = useState<{ key: string; rows: WithdrawRequestView[]; error: string | null } | null>(null);
  const [requestsVersion, setRequestsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Mở lại màn là một lần đối soát (QĐ-E): lệnh dở được chốt theo chuỗi trước khi hiển thị.
    void reconcileAndListMyWithdrawRequestsAction({ chain }).then((result) => {
      if (cancelled) return;
      setRequests(result.ok ? { key: chain, rows: result.data, error: null } : { key: chain, rows: [], error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [chain, requestsVersion]);

  const wallet = data?.wallet;
  const withdrawable = wallet?.withdrawableVnd ?? null;
  const vaultPayoutWallet = wallet?.payoutWallet ?? null;
  const payoutInput = payoutDraft?.chain === chain ? payoutDraft.value : (vaultPayoutWallet ?? '');
  const changesPayout =
    payoutInput.trim() !== '' && payoutInput.trim().toLowerCase() !== (vaultPayoutWallet ?? '').toLowerCase();
  const quote = withdrawable !== null ? quoteWithdraw(form.amount, withdrawable) : null;
  // G2b: vault chưa có ví nhận vẫn rút được: ví nhận do chính lệnh rút đặt.
  const blocker =
    withdrawable === null
      ? 'Chain này chưa có vault thanh toán: chưa rút được.'
      : wallet?.withdrawalsPaused
        ? 'Vault đang tạm dừng rút.'
        : null;
  const canSubmit =
    blocker === null &&
    quote !== null &&
    quote.receivedVnd !== null &&
    !quote.exceedsLimit &&
    form.purpose.trim() !== '' &&
    payoutInput.trim() !== '' &&
    !checking;
  const setPayout = (value: string) => {
    setPayoutDraft({ chain, value });
    setPayoutError(null);
  };

  const set = (name: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [name]: e.target.value }));

  /** G2: kiểm ví nhận ở máy chủ trước; không đạt thì hiện câu dưới ô, không mở hộp mã một lần. */
  const openConfirm = async () => {
    setChecking(true);
    setFeedback(null);
    const checked = await checkPayoutWalletAction({ chain, wallet: payoutInput.trim() });
    setChecking(false);
    if (!checked.ok) {
      setPayoutError(checked.fieldErrors?.payoutWallet?.[0] ?? checked.error);
      return;
    }
    setPayoutError(null);
    setClientRequestId(crypto.randomUUID());
    setOtp('');
    setDialog({ kind: 'create', wallet: checked.data.wallet });
  };

  const openContinue = (row: WithdrawRequestView) => {
    setOtp('');
    setFeedback(null);
    setDialog({ kind: 'continue', id: row.id, amount: row.amount, wallet: row.payoutWallet });
  };

  const settledMessage = (view: WithdrawRequestView): { tone: 'ok' | 'error'; message: string } =>
    view.status === 'COMPLETED'
      ? { tone: 'ok', message: `Đã rút ${nf(view.amount)} VNDB về ví ${view.payoutWallet}.` }
      : view.status === 'PAYOUT_SENT'
        ? { tone: 'ok', message: 'Đang chờ biên nhận đặt ví nhận; mở lại màn sau ít phút để gửi rút.' }
        : { tone: 'error', message: `Lệnh rút đang ở trạng thái: ${WITHDRAW_STATUS_LABELS[view.status]}.` };

  const confirm = async () => {
    if (!dialog) return;
    setSubmitting(true);
    const result =
      dialog.kind === 'create'
        ? await createWithdrawRequestAction({
            chain,
            amount: form.amount.trim(),
            purpose: form.purpose.trim(),
            note: form.note.trim(),
            otp,
            clientRequestId,
            payoutWallet: dialog.wallet,
          })
        : await continueWithdrawRequestAction({ chain, id: dialog.id, otp });
    setSubmitting(false);
    setOtp('');
    if (result.ok) {
      if (dialog.kind === 'create') {
        setForm({ amount: '', purpose: '', note: '' });
        setPayoutDraft(null);
      }
      setDialog(null);
      setFeedback(settledMessage(result.data));
    } else {
      if (result.fieldErrors?.otp === undefined) setDialog(null);
      setFeedback({ tone: 'error', message: result.error });
    }
    reload();
    setRequestsVersion((value) => value + 1);
  };

  const cancel = async (id: string) => {
    setFeedback(null);
    const result = await cancelWithdrawRequestAction({ chain, id });
    setFeedback(
      result.ok
        ? { tone: 'ok', message: `Đã huỷ lệnh rút ${id.slice(0, 8)}.` }
        : { tone: 'error', message: result.error },
    );
    reload();
    setRequestsVersion((value) => value + 1);
  };

  const rows = requests?.key === chain ? requests.rows : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Tạo lệnh rút</h1>
      </header>

      <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc số dư…
        </div>
      ) : error || !data ? (
        <p className="py-6 text-sm text-destructive">{error}</p>
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
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) void openConfirm();
                }}
              >
                <Field id="w-amount" label="Số tiền rút (VNDB)">
                  <AmountInput
                    id="w-amount"
                    value={form.amount}
                    onValueChange={(raw) => setForm((current) => ({ ...current, amount: raw }))}
                    className={`${FIELD} tabular-nums`}
                  />
                </Field>
                {quote?.exceedsLimit && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Vượt phần được rút: chỉ rút được tối đa {nf(withdrawable)} VNDB.
                  </p>
                )}
                <Field id="w-network" label="Mạng">
                  <input id="w-network" readOnly value={chainLabel} className={FIELD} />
                </Field>
                <Field id="w-address" label="Ví nhận">
                  <input
                    id="w-address"
                    value={payoutInput}
                    onChange={(e) => setPayout(e.target.value)}
                    placeholder="0x…"
                    spellCheck={false}
                    aria-invalid={payoutError !== null}
                    className={`${FIELD} font-code`}
                  />
                </Field>
                {chain !== 'mock' && (
                  <Button type="button" variant="outline" disabled={!address} onClick={() => address && setPayout(address)}>
                    Dùng ví đang kết nối
                  </Button>
                )}
                {changesPayout && (
                  <p role="note" className="text-xs text-muted-foreground">
                    Đổi ví nhận: hệ thống gửi thêm một giao dịch đặt ví nhận trước khi rút.
                  </p>
                )}
                {payoutError && (
                  <p role="alert" className="text-sm text-destructive">
                    {payoutError}
                  </p>
                )}
                <Field id="w-purpose" label="Mục đích">
                  <input id="w-purpose" value={form.purpose} onChange={set('purpose')} className={FIELD} />
                </Field>
                <Field id="w-note" label="Ghi chú">
                  <textarea id="w-note" rows={2} value={form.note} onChange={set('note')} className={FIELD} />
                </Field>
                {blocker && (
                  <p role="note" className="text-sm text-muted-foreground">
                    {blocker}
                  </p>
                )}
                <Button type="submit" disabled={!canSubmit}>
                  {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Tạo lệnh rút
                </Button>
                {feedback && !otpOpen && (
                  <p
                    role={feedback.tone === 'error' ? 'alert' : 'status'}
                    aria-label="Kết quả lệnh rút"
                    className={feedback.tone === 'error' ? 'text-sm text-destructive' : 'text-sm text-foreground'}
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
                <dt className="text-muted-foreground">Số dư VNDB của vault</dt>
                <dd className="text-right tabular-nums">{nf(wallet?.paymentVnd)}</dd>
                <dt className="text-muted-foreground">Phần khoá</dt>
                <dd className="text-right tabular-nums">{nf(wallet?.lockedVnd)}</dd>
                <dt className="text-muted-foreground">Phần được rút</dt>
                <dd className="text-right tabular-nums" data-testid="withdrawable">
                  {nf(withdrawable)}
                </dd>
                <dt className="font-medium">Số tiền nhận được</dt>
                <dd className="text-right tabular-nums font-semibold">{nf(quote?.receivedVnd)}</dd>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">{describePolicy(wallet?.policy ?? null)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC).</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2} className="text-base">
            Yêu cầu rút của tôi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests?.key === chain && requests.error ? (
            <p className="text-sm text-destructive">{requests.error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có yêu cầu rút nào trên chain này.</p>
          ) : (
            <Table aria-label="Yêu cầu rút của tôi">
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Ví nhận</TableHead>
                  <TableHead>Mục đích</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Giao dịch</TableHead>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <SellerWithdrawRow
                    key={r.id}
                    row={r}
                    chain={chain}
                    onContinue={() => openContinue(r)}
                    onCancel={() => cancel(r.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận mã một lần</DialogTitle>
            <DialogDescription>
              Nhập mã sáu chữ số để rút {nf(dialog?.kind === 'continue' ? dialog.amount : form.amount)} VNDB về ví nhận.
              Bản thử: chưa gửi mã thật, hệ thống chỉ kiểm đúng sáu chữ số.
            </DialogDescription>
          </DialogHeader>
          {dialog && (
            <p className="break-all text-sm" data-testid="otp-payout-wallet">
              Ví nhận: <span className="font-code">{dialog.wallet}</span> (đã whitelist)
            </p>
          )}
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
          {feedback?.tone === 'error' && otpOpen && (
            <p role="alert" className="text-sm text-destructive">
              {feedback.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" disabled={!/^\d{6}$/.test(otp) || submitting} onClick={() => void confirm()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
