'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getOpsOrderDetailAction } from '@/app/actions/ops';
import { OrderDetailContent } from '@/components/trading/order-detail-content';
import { EmptyState } from '@/components/ui/empty-state';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import type { OrderDetailView } from '@/lib/bank/trade.service';

/** Chi tiết lệnh trong khu vực vận hành; dữ liệu dùng chung FE-25, guard dùng riêng FE-06. */
export function OpsOrderDetailPage({ orderId }: { orderId: string }) {
  const { chain } = useSelectedChain();
  const [loaded, setLoaded] = useState<{
    key: string;
    data: OrderDetailView | null;
    error: string | null;
  } | null>(null);
  const requestKey = `${chain}|${orderId}`;

  useEffect(() => {
    let cancelled = false;
    void getOpsOrderDetailAction({ chain, orderId }).then((result) => {
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
  }, [chain, orderId, requestKey]);

  const fresh = loaded?.key === requestKey ? loaded : null;
  return (
    <div className="space-y-4">
      <Link prefetch={false} href="/transactions" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Về danh sách giao dịch
      </Link>
      {fresh === null ? (
        <EmptyState loading>Đang tải lệnh…</EmptyState>
      ) : fresh.error || !fresh.data ? (
        <EmptyState tone="bad">{fresh.error}</EmptyState>
      ) : (
        <OrderDetailContent detail={fresh.data} />
      )}
    </div>
  );
}
