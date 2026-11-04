'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { History, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { getWalletTransactionsAction } from '@/app/actions/portfolio';
import type { TxnView } from '@/lib/bank/mint.service';
import { OnChainBadge } from './mock-badge';
import { WalletNotBoundNotice } from './wallet-not-bound-notice';
import { TransactionTable } from './transaction-table';

/**
 * Hộp 3 — LỊCH SỬ GIAO DỊCH của ví đang kết nối.
 *
 * Lọc theo ví do TẦNG NGHIỆP VỤ làm (`portfolio.service` truyền `wallet` xuống store), không
 * phải ở đây. Component cố tình KHÔNG có bước `.filter()` nào: nếu giao diện tự lọc thì lời gọi
 * server vẫn mang về dữ liệu ví khác, và bất kỳ chỗ nào quên lọc là rò dữ liệu.
 */

export function TransactionHistoryBox() {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();

  /** Khoá = chain + ví. "Đang tải" suy ra từ khoá cũ, không dùng setState đồng bộ trong effect. */
  const requestKey = `${chain}|${address ?? ''}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: TxnView[];
    error: string | null;
    /** FIX-01 E1: máy chủ trả `WALLET_NOT_BOUND`, không có giao dịch của ví này. */
    notBound: boolean;
  } | null>(null);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    void getWalletTransactionsAction({ chain, wallet: address, limit: 20 }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, rows: result.data, error: null, notBound: false }
          : { key: requestKey, rows: [], error: result.error, notBound: result.code === 'WALLET_NOT_BOUND' },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [requestKey, address, chain]);

  const fresh = loaded?.key === requestKey ? loaded : null;
  const rows = fresh?.rows ?? [];
  const error = fresh?.error ?? null;
  const loading = fresh === null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <History />
            </CardTitleIcon>
            Giao dịch gần đây
          </CardTitle>
          <OnChainBadge />
        </div>
      </CardHeader>

      <CardContent>
        {!isConnected || !address ? (
          <EmptyState icon={<Wallet />}>
            <p>
              Kết nối ví để xem giao dịch của bạn.
            </p>
          </EmptyState>
        ) : loading ? (
          <EmptyState loading>Đang tải…</EmptyState>
        ) : fresh?.notBound ? (
          <WalletNotBoundNotice wallet={address} />
        ) : error ? (
          <Alert tone="bad">{error}</Alert>
        ) : rows.length === 0 ? (
          /* R7.4: trạng thái rỗng tử tế, không để khoảng trống. */
          <EmptyState icon={<History />}>
            <p className="font-medium text-foreground">Chưa có giao dịch nào</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Giao dịch sẽ hiện ở đây sau khi ngân hàng phát hành WPT về ví này.
            </p>
          </EmptyState>
        ) : (
          <TransactionTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}
