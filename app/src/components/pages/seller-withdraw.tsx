'use client';

import { useEffect, useState } from 'react';
import { explorerTxUrl } from '@bidv/shared';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  createWithdrawRequestAction,
  reconcileAndListMyWithdrawRequestsAction,
} from '@/app/actions/withdraw';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WithdrawRequestView } from '@/lib/bank/withdraw.service';
import { quoteWithdraw } from '@/lib/bank/withdraw-limit';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';
import { describePolicy, nf, useSellerOverview } from './seller-overview';
import { WITHDRAW_STATUS_LABELS } from './seller-transactions';

/**
 * Màn TẠO LỆNH RÚT NGƯỜI BÁN (FE-21 việc 10–15, BE-13 QĐ-I).
 *
 * Số dư, phần khoá và phần được rút là SỐ THẬT của vault trên chuỗi (`getSellerOverview`). Lệnh rút
 * đi qua `createWithdrawRequest`: hệ thống gọi `withdraw` của vault, tiền về ví nhận đã đặt trên
 * vault. Mạng và ví nhận chỉ đọc. Không thu phí trong PoC: số nhận bằng số rút.
 */

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring read-only:bg-muted';

const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

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

  const [form, setForm] = useState({ amount: '', purpose: '', note: '' });
  const [otpOpen, setOtpOpen] = useState(false);
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
  const payoutWallet = wallet?.payoutWallet ?? null;
  const quote = withdrawable !== null ? quoteWithdraw(form.amount, withdrawable) : null;
  const blocker =
    withdrawable === null
      ? 'Chain này chưa có vault thanh toán: chưa rút được.'
      : !payoutWallet
        ? 'Vault chưa có ví nhận tiền rút. Liên hệ Kiểm soát viên đặt ví nhận trên màn Vault.'
        : wallet?.withdrawalsPaused
          ? 'Vault đang tạm dừng rút.'
          : null;
  const canSubmit =
    blocker === null && quote !== null && quote.receivedVnd !== null && !quote.exceedsLimit && form.purpose.trim() !== '';

  const set = (name: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [name]: e.target.value }));

  const openConfirm = () => {
    setClientRequestId(crypto.randomUUID());
    setOtp('');
    setFeedback(null);
    setOtpOpen(true);
  };

  const confirm = async () => {
    setSubmitting(true);
    const result = await createWithdrawRequestAction({
      chain,
      amount: form.amount.trim(),
      purpose: form.purpose.trim(),
      note: form.note.trim(),
      otp,
      clientRequestId,
    });
    setSubmitting(false);
    setOtp('');
    if (result.ok) {
      setOtpOpen(false);
      setForm({ amount: '', purpose: '', note: '' });
      setFeedback({
        tone: result.data.status === 'COMPLETED' ? 'ok' : 'error',
        message:
          result.data.status === 'COMPLETED'
            ? `Đã rút ${nf(result.data.amount)} VNDB về ví ${result.data.payoutWallet}.`
            : `Lệnh rút đang ở trạng thái: ${WITHDRAW_STATUS_LABELS[result.data.status]}.`,
      });
    } else {
      setOtpOpen(result.fieldErrors?.otp !== undefined);
      setFeedback({ tone: 'error', message: result.error });
    }
    reload();
    setRequestsVersion((value) => value + 1);
  };

  const rows = requests?.key === chain ? requests.rows : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Tạo lệnh rút</h1>
        <p className="text-sm text-muted-foreground">
          Rút VNDB từ vault thanh toán về ví nhận đã đặt. Xác nhận bằng mã một lần sáu chữ số, không qua phê duyệt.
        </p>
      </header>

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
                  if (canSubmit) openConfirm();
                }}
              >
                <Field id="w-amount" label="Số tiền rút (VNDB)">
                  <input id="w-amount" inputMode="numeric" value={form.amount} onChange={set('amount')} className={`${FIELD} font-mono`} />
                </Field>
                {quote?.exceedsLimit && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Vượt phần được rút: chỉ rút được tối đa {nf(withdrawable)} VNDB.
                  </p>
                )}
                <Field id="w-network" label="Mạng">
                  <input id="w-network" readOnly value={chainLabel} className={FIELD} />
                </Field>
                <Field id="w-address" label="Ví nhận (đặt bởi Kiểm soát viên)">
                  <input id="w-address" readOnly value={payoutWallet ?? 'Chưa đặt'} className={`${FIELD} font-mono`} />
                </Field>
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
                <dd className="text-right font-mono">{nf(wallet?.paymentVnd)}</dd>
                <dt className="text-muted-foreground">Phần khoá</dt>
                <dd className="text-right font-mono">{nf(wallet?.lockedVnd)}</dd>
                <dt className="text-muted-foreground">Phần được rút</dt>
                <dd className="text-right font-mono" data-testid="withdrawable">
                  {nf(withdrawable)}
                </dd>
                <dt className="font-medium">Số tiền nhận được</dt>
                <dd className="text-right font-mono font-semibold">{nf(quote?.receivedVnd)}</dd>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const url = r.txHash ? explorerTxUrl(chain, r.txHash) : null;
                  return (
                    <TableRow key={r.id} data-status={r.status}>
                      <TableCell className="font-mono text-xs" title={r.id}>
                        {r.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{nf(r.amount)}</TableCell>
                      <TableCell className="font-mono text-xs" title={r.payoutWallet}>
                        {short(r.payoutWallet)}
                      </TableCell>
                      <TableCell>{r.purpose}</TableCell>
                      <TableCell>
                        <Badge variant="outline" title={r.reason ?? undefined}>
                          {WITHDRAW_STATUS_LABELS[r.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.txHash === null ? (
                          ''
                        ) : url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                            {short(r.txHash)}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <span title={r.txHash}>{short(r.txHash)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(r.createdAt).toLocaleString('vi-VN')}</TableCell>
                    </TableRow>
                  );
                })}
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
              Nhập mã sáu chữ số để rút {nf(form.amount)} VNDB về ví nhận. Bản thử: chưa gửi mã thật, hệ thống chỉ kiểm
              đúng sáu chữ số.
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="Mã một lần"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className={`${FIELD} text-center font-mono text-lg tracking-[0.5em]`}
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
