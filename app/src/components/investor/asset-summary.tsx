'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Coins, Loader2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { getPortfolioAction } from '@/app/actions/portfolio';
import type { PortfolioView } from '@/lib/bank/portfolio.service';
import { OnChainBadge } from './mock-badge';

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

const nf = (value: string) => {
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

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
          ? { key: requestKey, data: result.data, error: null }
          : { key: requestKey, data: null, error: result.error },
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

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle role="heading" aria-level={2} className="text-base">Tài sản đã đầu tư</CardTitle>
        <OnChainBadge />
      </CardHeader>

      <CardContent>
        {/* R5.3: chưa kết nối thì MỜI kết nối, không hiện số 0 — số 0 là một khẳng định sai. */}
        {!isConnected || !address ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Chưa kết nối ví</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Kết nối ví ở góc trên phải để xem số lượng WPT đang giữ và giá trị quy đổi.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang đọc số dư từ chuỗi…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : data ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {data.token.symbol} đang giữ
              </div>
              <div className="font-mono text-3xl font-bold text-primary">{nf(data.balance)}</div>
            </div>

            <div className="space-y-1 border-t border-border pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Giá trị theo giá phát hành</span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {nf(data.valueVnd)} ₫
                </span>
              </div>
              {/*
                Ghi rõ đây KHÔNG phải giá thị trường: hệ thống chưa có thị trường thứ cấp nên
                không có giá giao dịch. Trình bày như định giá là sai bản chất.
              */}
              <p className="text-xs text-muted-foreground">
                Quy đổi theo giá phát hành {data.issuePriceVnd.toLocaleString('vi-VN')} ₫/
                {data.token.symbol}. Chưa có thị trường thứ cấp nên đây không phải giá giao dịch.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Badge variant={data.whitelisted ? 'default' : 'destructive'}>
                {data.whitelisted ? 'đã KYC' : 'chưa KYC'}
              </Badge>
              {data.frozen && <Badge variant="destructive">đang đóng băng</Badge>}
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {data.wallet.slice(0, 10)}…{data.wallet.slice(-4)}
              </span>
            </div>

            {/*
              R5.4: KHÔNG hiển thị số dư VNDB. `ILedgerPort` chưa có phương thức đọc số dư
              token thanh toán, hiện số 0 sẽ là bịa. Nêu tường minh là đang thiếu.
            */}
            <p className="flex items-start gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Số dư VNDB chưa hiển thị được: tầng ledger chưa có phương thức đọc số dư token
              thanh toán (chờ BE-01).
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
