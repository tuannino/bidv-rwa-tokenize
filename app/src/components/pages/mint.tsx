'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Coins, FileClock, Link2, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import type { ChainKey } from '@bidv/shared';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClass } from '@/components/ui/field';
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
import { HoverHint } from '@/components/layout/hover-hint';
import { TxnHistoryTable } from '@/components/mint/txn-history-table';

/**
 * Trang KYC + PHÁT HÀNH DỮ LIỆU THỬ — kênh cán bộ ngân hàng.
 *
 * FE-22: phát hành CHÍNH THỨC đã chuyển sang màn Lập lệnh (`/draft`) + Kiểm soát viên duyệt. Nút
 * phát hành ở đây chỉ còn là đường dữ liệu thử, sau hai lớp chặn `demo:mint-token` + cờ
 * `ENABLE_DEMO_TOKEN_MINT`. Phần KYC + whitelist giữ nguyên vì màn Lập lệnh không thay nó.
 *
 * Component này KHÔNG gọi chain: mọi thứ đi qua server action -> `mint.service` -> `ILedgerPort`.
 * `can()` / `config.demoTokenMint` ở đây chỉ để ẩn/hiện nút cho đỡ khó hiểu; chốt chặn thật nằm ở
 * server (server action gọi được bằng POST trực tiếp, không thể tin UI).
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const loadKey = `${chain}|${wallet}`;
  const activeLoadKey = useRef(loadKey);
  const [loaded, setLoaded] = useState<{
    key: string;
    status: WalletStatus | null;
    txns: TxnView[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    activeLoadKey.current = loadKey;
  }, [loadKey]);

  // Cùng hàm với chốt chặn phía server (`canMintDemoToken`), tính sẵn trong cấu hình công khai.
  const mayMint = config.demoTokenMint;
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

  const apply = useCallback((key: string, result: Awaited<ReturnType<typeof load>>) => {
    setLoaded({ key, txns: result.txns, status: result.status });
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
        if (!cancelled) apply(loadKey, result);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [chain, wallet, loadKey, load, apply]);

  const fresh = loaded?.key === loadKey ? loaded : null;
  const status = fresh?.status ?? null;
  const txns = fresh?.txns ?? [];

  const run = (task: () => Promise<Feedback>) => {
    const submittedKey = loadKey;
    setFeedback(null);
    startTransition(async () => {
      const result = await task();
      const refreshed = await load(chain, wallet);
      if (activeLoadKey.current !== submittedKey) return;
      setLoaded({ key: submittedKey, txns: refreshed.txns, status: refreshed.status });
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
            message: `KYC ${result.data.kycReference} đã duyệt, whitelist=${result.data.whitelisted}, tx ${result.data.txHash.slice(0, 12)}… (${result.data.status})`,
          }
        : { tone: 'error', message: result.error };
    });

  const handleMint = () =>
    run(async () => {
      const result = await mintAction({ chain, wallet: wallet.trim(), amount: amount.trim() });
      return result.ok
        ? {
            tone: 'success',
            message: `Đã phát hành ${result.data.amount} WPT, số dư mới ${result.data.balanceAfter}, tx ${result.data.txHash.slice(0, 12)}… (${result.data.status})`,
          }
        : { tone: 'error', message: result.error };
    });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <HoverHint hint="Phát hành WPT trực tiếp để tạo dữ liệu thử, chỉ dùng trong PoC." side="bottom">
          <h1 className="text-2xl font-semibold tracking-tight">Phát hành token dự án điện gió (dữ liệu thử)</h1>
        </HoverHint>
        <Alert tone="info">
          Phát hành chính thức đi qua màn{' '}
          <Link prefetch={false} href="/draft" className="font-medium text-primary hover:underline">
            Lập lệnh
          </Link>{' '}
          và Kiểm soát viên duyệt. Nút phát hành ở đây chỉ dành cho dữ liệu thử: cần quyền
          demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT bật trên máy chủ.
        </Alert>
      </header>

      <div className="grid gap-6 min-[1100px]:grid-cols-12">
        <Card className="min-[1100px]:col-span-8">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <UserCheck />
              </CardTitleIcon>
              Nhà đầu tư
            </CardTitle>
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
                className={`${fieldClass} font-code`}
              />
              <p className="text-xs text-muted-foreground">
                Ở hardhat-local có thể dùng account #1:{' '}
                <span className="font-code">0x70997970C51812dc3A010C7d01b50e0d17dc79C8</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mint-amount" className="text-sm font-medium">
                Số lượng WPT
              </label>
              <AmountInput
                id="mint-amount"
                value={amount}
                onValueChange={setAmount}
                className={`${fieldClass} tabular-nums`}
              />
              <p className="text-xs text-muted-foreground">WPT có 0 chữ số thập phân: nhập số nguyên.</p>
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
                1. KYC + Whitelist
              </Button>

              <Button
                type="button"
                onClick={handleMint}
                disabled={pending || !wallet || !mayMint}
                title={
                  mayMint
                    ? undefined
                    : `Vai trò ${config.role} không có quyền phát hành dữ liệu thử (cần quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT bật)`
                }
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                2. Phát hành dữ liệu thử
              </Button>
            </div>

            {feedback && (
              <Alert role="status" tone={feedback.tone === 'success' ? 'ok' : 'bad'}>
                <span className="[overflow-wrap:anywhere]">{feedback.message}</span>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="min-[1100px]:col-span-4">
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <Link2 />
              </CardTitleIcon>
              Trạng thái on-chain
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border text-sm">
            {status ? (
              <>
                <Row label="Số dư WPT">
                  <span className="tabular-nums text-lg font-semibold">{status.balance}</span>
                </Row>
                <Row label="Whitelist">
                  <Badge variant={status.whitelisted ? 'ok' : 'warn'}>
                    {status.whitelisted ? 'đã KYC' : 'chưa KYC'}
                  </Badge>
                </Row>
                <Row label="Đóng băng">
                  <Badge variant={status.frozen ? 'bad' : 'outline'}>
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
          <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <FileClock />
            </CardTitleIcon>
            Lịch sử giao dịch ({chain})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <EmptyState icon={<FileClock />}>Chưa có giao dịch nào trên chain này.</EmptyState>
          ) : (
            <TxnHistoryTable txns={txns} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
