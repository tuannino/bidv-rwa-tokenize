'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { History, Loader2, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Giao dịch gần đây
        </CardTitle>
        <OnChainBadge />
      </CardHeader>

      <CardContent>
        {!isConnected || !address ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Kết nối ví để xem giao dịch của bạn.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang tải…
          </div>
        ) : fresh?.notBound ? (
          <WalletNotBoundNotice wallet={address} />
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          /* R7.4: trạng thái rỗng tử tế, không để khoảng trống. */
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <History className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Chưa có giao dịch nào</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Giao dịch sẽ hiện ở đây sau khi ngân hàng phát hành WPT về ví này.
            </p>
          </div>
        ) : (
          <TransactionTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}
