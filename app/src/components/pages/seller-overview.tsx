'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getSellerOverviewAction } from '@/app/actions/seller';
import type { SellerOverviewView } from '@/lib/bank/seller.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { SellerOverviewBody } from '@/components/seller/seller-overview-body';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

/**
 * Màn TỔNG QUAN NGƯỜI BÁN (FE-21 việc 1–7) — CHỈ ĐỌC.
 *
 * Mọi con số đến từ `getSellerOverview`; màn này chỉ định dạng, không cộng trừ gì (yêu cầu 16).
 * Không có nút nào thay đổi dữ liệu — hai nút tắt chỉ là liên kết.
 */

export { describePolicy, nf } from '@/components/seller/format';

/** Đọc tổng quan theo chuỗi đang chọn. Dùng chung cho màn Tổng quan và màn Tạo lệnh rút. */
export function useSellerOverview() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: SellerOverviewView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSellerOverviewAction({ chain }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: chain, data: result.data, error: null }
          : { key: chain, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, reloadKey]);

  const fresh = loaded?.key === chain ? loaded : null;
  return {
    data: fresh?.data ?? null,
    error: fresh?.error ?? null,
    loading: fresh === null,
    /** Đọc lại số dư sau một lệnh rút, giữ số cũ trên màn trong lúc chờ. */
    reload: () => setReloadKey((value) => value + 1),
  };
}

export function SellerOverviewPage() {
  const { chain } = useSelectedChain();
  const { data, error, loading } = useSellerOverview();

  return (
    <div className="space-y-6" data-chain={chain}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
        </div>
        <nav className="flex gap-2" aria-label="Lối tắt">
          <Link prefetch={false} href="/seller/transactions" className={buttonVariants({ variant: 'outline' })}>
            Danh sách giao dịch <ArrowRight aria-hidden="true" />
          </Link>
          <Link prefetch={false} href="/seller/withdraw" className={buttonVariants()}>
            Tạo lệnh rút <ArrowRight aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />

      {loading ? (
        <EmptyState loading>Đang đọc số liệu…</EmptyState>
      ) : error || !data ? (
        <Alert tone="bad">{error}</Alert>
      ) : (
        <SellerOverviewBody data={data} />
      )}
    </div>
  );
}
