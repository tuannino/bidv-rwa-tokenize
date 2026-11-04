'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { getPortfolioAction } from '@/app/actions/portfolio';
import type { PortfolioView } from '@/lib/bank/portfolio.service';
import { OnChainBadge } from './mock-badge';
import { WalletNotBoundNotice } from './wallet-not-bound-notice';
import { AssetHoldings } from './asset-holdings';

/**
 * Hộp 1 — TÀI SẢN ĐÃ ĐẦU TƯ của ví đang kết nối.
 *
 * Số dư đọc từ chuỗi qua server action -> `portfolio.service` -> `ILedgerPort`.
 * Component KHÔNG nhập `viem`/`ethers` và không tự gọi chain (LUẬT #1).
 *
 * Chỉ ĐỌC trạng thái kết nối ví (`useAccount`); việc kết nối và xử lý sai mạng thuộc FE-02.
 *
 * Tự giữ trạng thái lỗi của riêng mình: một hộp lỗi không được làm sập ba hộp còn lại.
 */

export function AssetSummary() {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();

  /**
   * Một ô state duy nhất, mang theo KHOÁ của lần tải đã sinh ra nó.
   *
   * Cách này thay cho việc reset state ngay trong effect: gọi `setState` đồng bộ trong thân
   * effect gây cascading render và bị `react-hooks/set-state-in-effect` chặn. Có khoá thì
   * "đang tải" là thứ SUY RA (khoá cũ khác khoá hiện tại), không phải state phải tự tay dọn.
   */
  const requestKey = `${chain}|${address ?? ''}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    data: PortfolioView | null;
    error: string | null;
    /** FIX-01 E1: máy chủ trả `WALLET_NOT_BOUND`, không có số liệu của ví này. */
    notBound: boolean;
  } | null>(null);

  useEffect(() => {
    if (!address) return;

    // Đổi ví hoặc đổi chain liên tiếp: bỏ kết quả đã lỗi thời, tránh phản hồi chậm của
    // lượt trước ghi đè lượt sau.
    let cancelled = false;

    void getPortfolioAction({ chain, wallet: address }).then((result) => {
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
  }, [requestKey, address, chain]);

  const fresh = loaded?.key === requestKey ? loaded : null;
  const data = fresh?.data ?? null;
  const error = fresh?.error ?? null;
  const loading = fresh === null;

  // Thẻ nền xanh: `tile-hl` không đổi `--card`, `--border`, nên đặt lại để ô biểu tượng `EmptyState` và đường kẻ đọc được.
  return (
    <Card tone="hl" className="[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <Wallet />
            </CardTitleIcon>
            Tài sản đã đầu tư
          </CardTitle>
          <OnChainBadge />
        </div>
      </CardHeader>

      <CardContent>
        {/* R5.3: chưa kết nối thì MỜI kết nối, không hiện số 0 — số 0 là một khẳng định sai. */}
        {!isConnected || !address ? (
          <EmptyState icon={<Wallet />}>
            <p className="font-medium text-foreground">Chưa kết nối ví</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              Kết nối ví ở góc trên phải, hoặc mở{' '}
              <Link prefetch={false} href="/wallet" className="text-primary underline-offset-4 hover:underline">
                Ví của tôi
              </Link>{' '}
              để xem hướng dẫn, để biết số lượng WPT đang giữ và giá trị quy đổi.
            </p>
          </EmptyState>
        ) : loading ? (
          <EmptyState loading>Đang đọc số dư từ chuỗi…</EmptyState>
        ) : fresh?.notBound ? (
          <WalletNotBoundNotice wallet={address} />
        ) : error ? (
          <Alert tone="bad">{error}</Alert>
        ) : data ? (
          <AssetHoldings data={data} />
        ) : null}
      </CardContent>
    </Card>
  );
}
