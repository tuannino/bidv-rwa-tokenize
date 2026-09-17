'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, LogOut, Wallet } from 'lucide-react';
import { CHAINS, explorerAddressUrl, type ChainKey } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNativeBalance } from '@/lib/hooks/use-native-balance';
import { shortenAddress } from '@/lib/wallet/format';

export interface WalletStatusCardProps {
  address: `0x${string}`;
  chainKey: ChainKey;
  onDisconnect: () => void;
}

/**
 * Trạng thái `ready` — ví đã kết nối và đúng mạng (R1.3, R1.4).
 *
 * Chỉ nhận `address` và `chainKey` chứ không tự đọc `useAccount`: nhờ vậy thẻ này chỉ được
 * kết xuất khi `useWalletStatus` đã xác nhận sẵn sàng, không có đường nào hiện địa chỉ trong
 * lúc đang sai mạng.
 */
export function WalletStatusCard({ address, chainKey, onDisconnect }: WalletStatusCardProps) {
  const info = CHAINS[chainKey];
  const balance = useNativeBalance(address);

  /** `null` = chain này không có explorer (hardhat-local) -> ẩn liên kết (task 2.4). */
  const explorerUrl = explorerAddressUrl(chainKey, address);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
          Ví đã kết nối
        </CardTitle>
        <Badge variant="outline">{info.label}</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Địa chỉ ví */}
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Địa chỉ ví</div>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Hiện bản rút gọn cho dễ đối chiếu, nhưng để địa chỉ đầy đủ trong `title` và
              trong nhánh chỉ-dành-cho-trình-đọc: rút gọn là chuyện trình bày, không được làm
              mất dữ liệu với người dùng trình đọc màn hình.
            */}
            <span className="font-mono text-lg font-semibold text-foreground" title={address}>
              {shortenAddress(address)}
            </span>
            <span className="sr-only">Địa chỉ đầy đủ: {address}</span>

            <CopyAddressButton address={address} />

            {explorerUrl && (
              <Button
                render={
                  <a href={explorerUrl} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Xem trên {info.explorerName ?? 'explorer'}
                    <span className="sr-only">(mở tab mới)</span>
                  </a>
                }
                variant="outline"
                size="sm"
              />
            )}
          </div>
        </div>

        {/* Số dư đồng bản địa */}
        <div className="space-y-1 border-t border-border pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Số dư {info.nativeCurrency?.symbol ?? 'đồng bản địa'}
            </span>
            {balance.loading ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                đang đọc…
              </span>
            ) : balance.amount ? (
              <span className="font-mono text-lg font-semibold text-foreground">
                {balance.amount} {balance.symbol}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">chưa có</span>
            )}
          </div>

          {balance.error && <p className="text-xs text-destructive">{balance.error}</p>}

          {/*
            Task 2.5 — ghi nhãn rõ. Đây là phí giao dịch của mạng, KHÔNG phải VNDB và không
            phải tiền thật. Trên hardhat-local và Sepolia thì nó không có giá trị nào.
          */}
          <p className="text-xs text-muted-foreground">
            Đây là đồng của {info.label} dùng để trả phí giao dịch, không phải VNDB và không phải
            tiền thật.
          </p>
        </div>

        {/*
          Số dư WPT và VNDB không hiển thị ở đây: hai thứ đó là số dư hợp đồng, phải đi qua
          `ILedgerPort` và thuộc FE-04. Xem ở trang Tổng quan.
        */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Số WPT đang giữ xem ở trang Tổng quan.
          </p>
          <Button onClick={onDisconnect} variant="outline" size="sm">
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Ngắt kết nối
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Nút sao chép địa chỉ (R1.4).
 *
 * `navigator.clipboard` cần ngữ cảnh bảo mật (https hoặc localhost) và có thể bị người dùng
 * chặn quyền. Thất bại thì nói thẳng "chưa sao chép được" — im lặng sẽ khiến người dùng dán
 * ra thứ khác mà không biết.
 */
function CopyAddressButton({ address }: { address: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setState('copied');
    } catch {
      setState('failed');
    }
    // Quay về trạng thái thường để nút còn dùng được lần sau.
    window.setTimeout(() => setState('idle'), 2000);
  };

  return (
    <Button
      onClick={() => void copy()}
      variant="outline"
      size="sm"
      aria-label={`Sao chép địa chỉ ví ${address}`}
    >
      {state === 'copied' ? (
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span role="status">
        {state === 'copied' ? 'Đã sao chép' : state === 'failed' ? 'Chưa sao chép được' : 'Sao chép'}
      </span>
    </Button>
  );
}
