'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { CheckCircle2, Coins, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { ChainKey } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';
import { can } from '@/lib/rbac';
import {
  listTransactionsAction,
  mintAction,
  onboardInvestorAction,
  readBalanceAction,
} from '@/app/actions/bank';
import type { TxnView } from '@/lib/bank/mint.service';

/**
 * Trang PHÁT HÀNH (mint) — kênh cán bộ ngân hàng.
 *
 * Component này KHÔNG gọi chain: mọi thứ đi qua server action -> `mint.service` -> `ILedgerPort`.
 * `can()` ở đây chỉ để ẩn/hiện nút cho đỡ khó hiểu; chốt chặn thật nằm ở server
 * (server action gọi được bằng POST trực tiếp, không thể tin UI).
 */

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

interface WalletStatus {
  balance: string;
  whitelisted: boolean;
  frozen: boolean;
}

export function MintPage() {
  const config = usePublicConfig();
  const { chain } = useSelectedChain();

  const [wallet, setWallet] = useState('');
  const [amount, setAmount] = useState('100');
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [txns, setTxns] = useState<TxnView[]>([]);
  const [pending, startTransition] = useTransition();

  const mayMint = can(config.role, 'token:mint');
  const mayWhitelist = can(config.role, 'investor:whitelist');

  /**
   * Nạp lịch sử + trạng thái ví cho một chain.
   *
   * Trả về dữ liệu chứ KHÔNG tự setState: nhờ vậy người gọi quyết định lúc nào áp,
   * và effect bên dưới có thể huỷ kết quả cũ khi người dùng đổi chain liên tiếp
   * (không có chỗ này thì phản hồi chậm của chain trước sẽ ghi đè chain sau).
   */
  const load = useCallback(
    async (activeChain: ChainKey, target: string) => {
      const wantsStatus = /^0x[0-9a-fA-F]{40}$/.test(target.trim());

      const [txnResult, statusResult] = await Promise.all([
        listTransactionsAction({ chain: activeChain, limit: 20 }),
        wantsStatus
          ? readBalanceAction({ chain: activeChain, wallet: target.trim() })
          : Promise.resolve(null),
      ]);

      return {
        txns: txnResult.ok ? txnResult.data : [],
        status:
          statusResult?.ok === true
            ? {
                balance: statusResult.data.balance,
                whitelisted: statusResult.data.whitelisted,
                frozen: statusResult.data.frozen,
              }
            : null,
        error: statusResult && !statusResult.ok ? statusResult.error : null,
      };
    },
    [],
  );

  const apply = useCallback((result: Awaited<ReturnType<typeof load>>) => {
    setTxns(result.txns);
    setStatus(result.status);
    if (result.error) setFeedback({ tone: 'error', message: result.error });
  }, []);

  /**
   * Đổi chain hoặc đổi ví -> nạp lại. Có debounce vì effect này phụ thuộc `wallet`:
   * không debounce thì mỗi ký tự gõ vào ô địa chỉ là một lượt gọi server (~42 lượt cho
   * một địa chỉ). Cleanup vừa clear timer vừa bỏ kết quả đã lỗi thời.
   */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void load(chain, wallet).then((result) => {
        if (!cancelled) apply(result);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chain, wallet, load, apply]);

  const run = (task: () => Promise<Feedback>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await task();
      const refreshed = await load(chain, wallet);
      setTxns(refreshed.txns);
      setStatus(refreshed.status);
      // Kết quả của thao tác vừa chạy quan trọng hơn lỗi đọc lại, nên set sau cùng.
      setFeedback(result);
    });
  };

  const handleOnboard = () =>
    run(async () => {
      const result = await onboardInvestorAction({ chain, wallet: wallet.trim() });
      return result.ok
        ? {
            tone: 'success',
            message: `KYC ${result.data.kycReference} đã duyệt · whitelist=${result.data.whitelisted} · tx ${result.data.txHash.slice(0, 12)}… (${result.data.status})`,
          }
        : { tone: 'error', message: result.error };
    });

  const handleMint = () =>
    run(async () => {
      const result = await mintAction({ chain, wallet: wallet.trim(), amount: amount.trim() });
      return result.ok
        ? {
            tone: 'success',
            message: `Đã phát hành ${result.data.amount} SPT · số dư mới ${result.data.balanceAfter} · tx ${result.data.txHash.slice(0, 12)}… (${result.data.status})`,
          }
        : { tone: 'error', message: result.error };
    });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Phát hành token dự án điện gió</h1>
        <p className="text-sm text-muted-foreground">
          KYC (mock auto-approve) → whitelist on-chain → phát hành SPT. Chain đang dùng:{' '}
          <span className="font-mono text-foreground">{chain}</span>
          {config.mocks.kyc && ' · KYC ở chế độ mock'}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nhà đầu tư</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="mint-wallet" className="text-sm font-medium">
                Ví nhà đầu tư
              </label>
              <input
                id="mint-wallet"
                value={wallet}
                onChange={(event) => setWallet(event.target.value)}
                placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                spellCheck={false}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Ở hardhat-local có thể dùng account #1:{' '}
                <span className="font-mono">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mint-amount" className="text-sm font-medium">
                Số lượng SPT
              </label>
              <input
                id="mint-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="numeric"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">SPT có 0 chữ số thập phân — nhập số nguyên.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleOnboard}
                disabled={pending || !wallet || !mayWhitelist}
                title={mayWhitelist ? undefined : `Vai trò ${config.role} không có quyền whitelist`}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                1 · KYC + Whitelist
              </Button>

              <Button
                type="button"
                onClick={handleMint}
                disabled={pending || !wallet || !mayMint}
                title={mayMint ? undefined : `Vai trò ${config.role} không có quyền phát hành`}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                2 · Phát hành
              </Button>
            </div>

            {feedback && (
              <div
                role="status"
                className={
                  feedback.tone === 'success'
                    ? 'flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground'
                    : 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground'
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
            <CardTitle className="text-base">Trạng thái on-chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {status ? (
              <>
                <Row label="Số dư SPT">
                  <span className="font-mono text-lg font-semibold">{status.balance}</span>
                </Row>
                <Row label="Whitelist">
                  <Badge variant={status.whitelisted ? 'default' : 'destructive'}>
                    {status.whitelisted ? 'đã KYC' : 'chưa KYC'}
                  </Badge>
                </Row>
                <Row label="Đóng băng">
                  <Badge variant={status.frozen ? 'destructive' : 'outline'}>
                    {status.frozen ? 'đang băng' : 'bình thường'}
                  </Badge>
                </Row>
              </>
            ) : (
              <p className="text-muted-foreground">Nhập ví để đọc số dư trực tiếp từ ledger.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử giao dịch ({chain})</CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có giao dịch nào trên chain này.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Nghiệp vụ</TableHead>
                  <TableHead>Ví nhận</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Vai trò</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleTimeString('vi-VN')}
                    </TableCell>
                    <TableCell className="font-medium">{txn.operation}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {txn.toWallet ? `${txn.toWallet.slice(0, 10)}…${txn.toWallet.slice(-4)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono">{txn.amount ?? '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          txn.status === 'CONFIRMED'
                            ? 'default'
                            : txn.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {txn.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{txn.actorRole}</TableCell>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
