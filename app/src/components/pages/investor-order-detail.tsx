'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, Wallet } from 'lucide-react';
import { getOrderDetailAction } from '@/app/actions/trade';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import type { OrderDetailView } from '@/lib/bank/trade.service';
import { OrderDetailContent } from '@/components/trading/order-detail-content';

/**
 * Màn CHI TIẾT LỆNH của Nhà đầu tư (FE-25 việc 11, 12): thông tin lệnh, tiến trình quyết toán năm
 * bước kèm mốc thời gian, nhật ký kiểm toán của lệnh.
 *
 * Phạm vi xem do `getOrderDetailAction` quyết định (đi qua `listOrders`, lọc theo ví ở máy chủ): dò
 * mã lệnh của ví khác nhận "không tìm thấy", không nhận lệnh đó.
 */
export function InvestorOrderDetailPage({ orderId, mockWallet }: { orderId: string; mockWallet: string | null }) {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();
  const wallet = chain === 'mock' ? mockWallet : address;
  const [loaded, setLoaded] = useState<{ key: string; data: OrderDetailView | null; error: string | null } | null>(null);

  const requestKey = wallet ? `${chain}|${wallet}|${orderId}` : null;
  useEffect(() => {
    if (!requestKey || !wallet) return;
    let cancelled = false;
    void getOrderDetailAction({ chain, investorWallet: wallet, orderId }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, data: result.data, error: null }
          : { key: requestKey, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey, chain, wallet, orderId]);

  if (!wallet || (chain !== 'mock' && !isConnected)) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Chưa kết nối ví</p>
      </div>
    );
  }

  const fresh = loaded?.key === requestKey ? loaded : null;
  if (fresh === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Đang tải lệnh…
      </p>
    );
  }
  if (fresh.error || !fresh.data) return <p className="text-sm text-destructive">{fresh.error}</p>;

  return <OrderDetailContent detail={fresh.data} />;
}
