'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Coins, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { demoPaymentContextAction, mintDemoPaymentAction } from '@/app/actions/demo-payment';
import type { DemoPaymentContext } from '@/lib/bank/demo-payment.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount } from '@/lib/format';

/**
 * Màn Nạp VNDB mô phỏng (BE-16) — Giao dịch viên nạp VNDB cho ví nhà đầu tư hoặc ví người bán.
 *
 * Không gọi chain, không kiểm quyền: mọi thứ qua server action -> `demo-payment.service`, nơi có hai
 * lớp chặn, trần một lần nạp và quy tắc ví đích. Màn chỉ vẽ và gửi.
 */

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

const INPUT =
  'w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const short = (wallet: string | null) => (wallet ? `${wallet.slice(0, 10)}…${wallet.slice(-4)}` : '—');

export function DemoPaymentPage() {
  const { chain } = useSelectedChain();
  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [context, setContext] = useState<DemoPaymentContext | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const result = await demoPaymentContextAction({ chain });
    return result;
  }, [chain]);

  useEffect(() => {
    let cancelled = false;
    void load().then((result) => {
      if (cancelled) return;
      if (result.ok) setContext(result.data);
      else setFeedback({ tone: 'error', message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  /** Ví gợi ý cho ô chọn: ví người bán và các ví đã từng được nạp. */
  const knownWallets = [
    ...new Set(
      [context?.spvWallet ?? null, ...(context?.history ?? []).map((h) => h.toWallet)].filter(
        (w): w is string => w !== null,
      ),
    ),
  ];

  const submit = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await mintDemoPaymentAction({ chain, wallet: wallet.trim(), amount: amount.trim() });
      const refreshed = await load();
      if (refreshed.ok) setContext(refreshed.data);
      setFeedback(
        result.ok
          ? {
              tone: 'success',
              message: `Đã nạp ${formatAmount(result.data.amount)} VNDB vào ${short(result.data.wallet)} · số dư mới ${formatAmount(result.data.balanceAfter)} VNDB · tx ${result.data.txHash.slice(0, 12)}… (${result.data.status})`,
            }
          : { tone: 'error', message: result.error },
      );
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Nạp VNDB mô phỏng</h1>
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>
            Chức năng <strong>chỉ dùng cho bản trình diễn</strong>: tạo VNDB không có tiền gửi thật đứng
            sau. Sẽ tắt khi lên môi trường thật (cờ ENABLE_DEMO_PAYMENT_MINT). Chuỗi đang dùng:{' '}
            <span className="font-mono">{chain}</span>.
          </span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nạp vào ví</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="demo-payment-wallet" className="text-sm font-medium">
              Ví đích
            </label>
            <input
              id="demo-payment-wallet"
              list="demo-payment-wallets"
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder="0x… ví nhà đầu tư đã KYC, hoặc ví người bán"
              spellCheck={false}
              className={INPUT}
            />
            <datalist id="demo-payment-wallets">
              {knownWallets.map((w) => (
                <option key={w} value={w}>
                  {w === context?.spvWallet ? 'Ví người bán' : 'Đã nạp trước đó'}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Chỉ nạp được cho ví có trong danh sách nhà đầu tư (đã KYC/whitelist) hoặc ví người bán
              {context?.spvWallet ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="font-mono text-primary hover:underline"
                    onClick={() => setWallet(context.spvWallet ?? '')}
                  >
                    {short(context.spvWallet)}
                  </button>
                </>
              ) : null}
              .
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="demo-payment-amount" className="text-sm font-medium">
              Số VNDB
            </label>
            <input
              id="demo-payment-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="numeric"
              className={INPUT}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Gợi ý nhanh:</span>
              {context?.quickAmounts.map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAmount(q.amount)}
                >
                  {q.label}: {formatAmount(q.amount)}
                </Button>
              ))}
              {context && <span>Tối đa một lần: {formatAmount(context.maxAmount)} VNDB.</span>}
            </div>
          </div>

          <Button type="button" onClick={submit} disabled={pending || !wallet.trim() || !amount.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
            Nạp VNDB
          </Button>

          {feedback && (
            <div
              role="status"
              className={
                feedback.tone === 'success'
                  ? 'flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm'
                  : 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'
              }
            >
              {feedback.tone === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử các lần nạp ({chain})</CardTitle>
        </CardHeader>
        <CardContent>
          {!context || context.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lần nạp nào trên chuỗi này.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Ví đích</TableHead>
                  <TableHead className="text-right">Số VNDB</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Vai trò</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {context.history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={row.toWallet ?? undefined}>
                      {short(row.toWallet)}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatAmount(row.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === 'CONFIRMED' ? 'default' : row.status === 'FAILED' ? 'destructive' : 'outline'
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.actorRole}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
