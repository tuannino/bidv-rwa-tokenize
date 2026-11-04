'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { getOrderDetailAction } from '@/app/actions/trade';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import type { OrderDetailView } from '@/lib/bank/trade.service';
import { OrderDetailContent } from '@/components/trading/order-detail-content';
import { WalletNotBoundNotice } from '@/components/investor/wallet-not-bound-notice';

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
  // FIX-01 E6: kết quả giữ khoá `chain|ví|mã lệnh` của lần gọi; khoá khác hiện tại thì bỏ.
  const [loaded, setLoaded] = useState<{
    key: string;
    data: OrderDetailView | null;
    error: string | null;
    notBound: boolean;
  } | null>(null);

  const requestKey = wallet ? `${chain}|${wallet}|${orderId}` : null;
  useEffect(() => {
    if (!requestKey || !wallet) return;
    let cancelled = false;
    void getOrderDetailAction({ chain, investorWallet: wallet, orderId }).then((result) => {
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
  }, [requestKey, chain, wallet, orderId]);

  if (!wallet || (chain !== 'mock' && !isConnected)) {
    return (
      <EmptyState icon={<Wallet />} className="py-16">
        <p className="font-medium text-foreground">Chưa kết nối ví</p>
      </EmptyState>
    );
  }

  const fresh = loaded?.key === requestKey ? loaded : null;
  if (fresh === null) {
    return (
      <EmptyState loading>Đang tải lệnh…</EmptyState>
    );
  }
  if (fresh.notBound) return <WalletNotBoundNotice wallet={wallet} />;
  if (fresh.error || !fresh.data) return <Alert tone="bad">{fresh.error}</Alert>;

  return <OrderDetailContent detail={fresh.data} />;
}
