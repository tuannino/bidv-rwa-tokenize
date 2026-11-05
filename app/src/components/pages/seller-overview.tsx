'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { SellerOverviewBody } from '@/components/seller/seller-overview-body';
import { useSellerOverview } from '@/components/seller/use-seller-overview';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

/**
 * Màn TỔNG QUAN NGƯỜI BÁN (FE-21 việc 1–7) — CHỈ ĐỌC.
 *
 * Mọi con số đến từ `getSellerOverview`; màn này chỉ định dạng, không cộng trừ gì (yêu cầu 16).
 * Không có nút nào thay đổi dữ liệu — hai nút tắt chỉ là liên kết.
 */

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
