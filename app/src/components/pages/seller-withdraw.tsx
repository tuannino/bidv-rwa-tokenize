'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { MockBadge } from '@/components/investor/mock-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { quoteWithdraw } from '@/lib/bank/withdraw-limit';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';
import { describePolicy, nf, useSellerOverview } from './seller-overview';

/**
 * Màn TẠO LỆNH RÚT NGƯỜI BÁN (FE-21 việc 10–15).
 *
 * Phần hệ thống hiển thị (số dư, phần khoá, hạn mức, phí) là SỐ THẬT từ `getSellerOverview`,
 * hạn mức đọc từ cấu hình hai chế độ. Phần GHI — tạo lệnh, kiểm mã một lần, bảng yêu cầu của
 * mình — chưa có nghiệp vụ ở backend, nên chạy trên dữ liệu tạm trong trình duyệt và ghi rõ
 * trên màn. Không lệnh nào ở đây rời khỏi trình duyệt.
 */

interface WithdrawRow {
  id: string;
  amountVnd: string;
  receivedVnd: string;
  network: string;
  toAddress: string;
  purpose: string;
  createdAt: string;
}

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
  const { data, error, loading } = useSellerOverview();
  const { chain } = useSelectedChain();
  const networks = usePublicConfig().chains.filter((c) => c.selectable);

  const [form, setForm] = useState({ amount: '', network: '', toAddress: '', purpose: '', note: '' });
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [rows, setRows] = useState<WithdrawRow[]>([]);

  const wallet = data?.wallet;
  const withdrawable = wallet?.withdrawableVnd ?? null;
  const fee = wallet?.withdrawFeeVnd ?? null;
  const configured = withdrawable !== null && fee !== null;
  const quote = configured ? quoteWithdraw(form.amount, withdrawable, fee) : null;
  const network = form.network || chain;

  const canSubmit =
    quote !== null &&
    !quote.exceedsLimit &&
    quote.receivedVnd !== null &&
    form.toAddress.trim() !== '' &&
    form.purpose.trim() !== '';

  const set = (name: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [name]: e.target.value }));

  // @pending BE-13 | biểu mẫu, hạn mức đọc từ cấu hình, khoá nút khi vượt hạn mức, hộp mã một lần và bảng yêu cầu đã chạy trên dữ liệu tạm — BE-13 chỉ thay thân hàm này bằng lời gọi server action tạo lệnh, kiểm mã và đọc yêu cầu rút
  const confirm = () => {
    if (!quote?.receivedVnd) return;
    setRows((prev) => [
      {
        id: `TAM-${prev.length + 1}`,
        amountVnd: form.amount,
        receivedVnd: quote.receivedVnd!,
        network,
        toAddress: form.toAddress.trim(),
        purpose: form.purpose.trim(),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setOtpOpen(false);
    setOtp('');
    setForm({ amount: '', network: '', toAddress: '', purpose: '', note: '' });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Tạo lệnh rút</h1>
        <p className="text-sm text-muted-foreground">
          Rút VNDB từ ví thanh toán. Xác nhận bằng mã một lần sáu chữ số, hoàn tất ngay, không qua phê duyệt.
        </p>
      </header>

      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm"
        data-testid="be13-notice"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Chờ BE-13.</strong> Nghiệp vụ rút chưa có ở backend: lệnh tạo ở đây là <strong>dữ liệu tạm</strong>{' '}
          trong trình duyệt, không chuyển tiền và mất khi tải lại trang. Số dư, phần khoá, hạn mức và phí bên dưới là số thật.
        </p>
      </div>

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
                  if (canSubmit) setOtpOpen(true);
                }}
              >
                <Field id="w-amount" label="Số tiền rút (VNDB)">
                  <input id="w-amount" inputMode="numeric" value={form.amount} onChange={set('amount')} className={`${FIELD} font-mono`} />
                </Field>
                {quote?.exceedsLimit && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Vượt hạn mức: chỉ rút được tối đa {nf(withdrawable)} VNDB.
                  </p>
                )}
                <Field id="w-network" label="Mạng">
                  <select id="w-network" value={network} onChange={set('network')} className={FIELD}>
                    {networks.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="w-address" label="Địa chỉ ví nhận">
                  <input id="w-address" spellCheck={false} value={form.toAddress} onChange={set('toAddress')} className={`${FIELD} font-mono`} />
                </Field>
                <Field id="w-purpose" label="Mục đích">
                  <input id="w-purpose" value={form.purpose} onChange={set('purpose')} className={FIELD} />
                </Field>
                <Field id="w-note" label="Ghi chú">
                  <textarea id="w-note" rows={2} value={form.note} onChange={set('note')} className={FIELD} />
                </Field>
                <Button type="submit" disabled={!canSubmit}>
                  Tạo lệnh rút
                </Button>
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
                <dt className="text-muted-foreground">Số dư VNDB ví thanh toán</dt>
                <dd className="text-right font-mono">{nf(wallet?.paymentVnd)}</dd>
                <dt className="text-muted-foreground">Phần khoá</dt>
                <dd className="text-right font-mono">{nf(wallet?.lockedVnd)}</dd>
                <dt className="text-muted-foreground">Hạn mức còn rút được</dt>
                <dd className="text-right font-mono" data-testid="withdrawable">
                  {nf(withdrawable)}
                </dd>
                <dt className="text-muted-foreground">Phí rút</dt>
                <dd className="text-right font-mono">{nf(fee)}</dd>
                <dt className="font-medium">Số tiền nhận được</dt>
                <dd className="text-right font-mono font-semibold">{nf(quote?.receivedVnd)}</dd>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                {describePolicy(wallet?.policy ?? null)}
                {fee === null && ' Chưa cấu hình phí rút — chưa rút được.'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle role="heading" aria-level={2} className="text-base">
            Yêu cầu rút của tôi
          </CardTitle>
          <MockBadge title="Dữ liệu tạm trong trình duyệt — chờ BE-13" />
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có yêu cầu rút nào trong phiên này.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead className="text-right">Số tiền rút</TableHead>
                  <TableHead className="text-right">Nhận được</TableHead>
                  <TableHead>Mạng</TableHead>
                  <TableHead>Ví nhận</TableHead>
                  <TableHead>Mục đích</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời điểm</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell className="text-right font-mono">{nf(r.amountVnd)}</TableCell>
                    <TableCell className="text-right font-mono">{nf(r.receivedVnd)}</TableCell>
                    <TableCell>{r.network}</TableCell>
                    <TableCell className="font-mono text-xs" title={r.toAddress}>
                      {r.toAddress.slice(0, 10)}…
                    </TableCell>
                    <TableCell>{r.purpose}</TableCell>
                    <TableCell>Hoàn tất (tạm)</TableCell>
                    <TableCell className="text-xs">{new Date(r.createdAt).toLocaleString('vi-VN')}</TableCell>
                  </TableRow>
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
              Nhập mã sáu chữ số để hoàn tất lệnh rút {nf(form.amount)} VNDB. Chờ BE-13: chưa gửi mã thật, mọi mã sáu chữ số đều qua.
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
          <DialogFooter>
            <Button type="button" disabled={!/^\d{6}$/.test(otp)} onClick={confirm}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
