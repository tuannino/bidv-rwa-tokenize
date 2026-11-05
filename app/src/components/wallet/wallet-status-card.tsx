'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, LogOut, Wallet } from 'lucide-react';
import { CHAINS, explorerAddressUrl, type ChainKey } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { useNativeBalance } from '@/lib/hooks/use-native-balance';
import { shortenAddress } from '@/lib/wallet/format';

/**
 * Nút viền trên thẻ nền xanh: `tile-hl` đổi chữ thành trắng còn nút viền có nền sáng, nên đặt nền, chữ theo thẻ.
 */
const ON_TILE =
  'border-transparent bg-(--tile-hl-chip) text-(--tile-hl-ink) hover:bg-(--tile-hl-chip) hover:opacity-90';

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
    <div className="grid gap-6 min-[1100px]:grid-cols-12">
      {/* Thẻ nền xanh: `tile-hl` không đổi `--card`, `--border`, nên đặt lại để đường kẻ và ô biểu tượng đọc được. */}
      <Card tone="hl" className="[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)] min-[1100px]:col-span-7">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <Wallet />
              </CardTitleIcon>
              Ví đã kết nối
            </CardTitle>
            <Badge variant="outline">{info.label}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Địa chỉ ví */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Địa chỉ ví</div>
            {/*
              Hiện bản rút gọn cho dễ đối chiếu, nhưng để địa chỉ đầy đủ trong `title` và
              trong nhánh chỉ-dành-cho-trình-đọc: rút gọn là chuyện trình bày, không được làm
              mất dữ liệu với người dùng trình đọc màn hình.
            */}
            <span className="block font-code text-3xl font-semibold break-all" title={address}>
              {shortenAddress(address)}
            </span>
            <span className="sr-only">Địa chỉ đầy đủ: {address}</span>

            <div className="flex flex-wrap items-center gap-2">
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
                  className={ON_TILE}
                />
              )}
            </div>
          </div>

          {/*
            Số dư WPT và VNDB không hiển thị ở đây: hai thứ đó là số dư hợp đồng, phải đi qua
            `ILedgerPort` và thuộc FE-04. Xem ở trang Tổng quan.
          */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Số WPT đang giữ xem ở trang Tổng quan.
            </p>
            <Button onClick={onDisconnect} variant="outline" size="sm" className={ON_TILE}>
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Ngắt kết nối
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Số dư đồng bản địa */}
      <Kpi
        tone="gold"
        className="min-[1100px]:col-span-5"
        label={<>Số dư {info.nativeCurrency?.symbol ?? 'đồng bản địa'}</>}
        value={
          balance.loading ? (
            <span className="inline-flex items-center gap-1.5 text-base">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              đang đọc…
            </span>
          ) : balance.amount ? (
            balance.amount
          ) : (
            'chưa có'
          )
        }
        unit={!balance.loading && balance.amount ? balance.symbol : undefined}
      >
        {balance.error && <p className="mt-2 text-xs text-bad-ink">{balance.error}</p>}

        {/*
          Task 2.5: ghi nhãn rõ. Đây là phí giao dịch của mạng, KHÔNG phải VNDB và không
          phải tiền thật. Trên hardhat-local và Sepolia thì nó không có giá trị nào.
        */}
        <p className="mt-2 text-xs text-muted-foreground">
          Đây là đồng của {info.label} dùng để trả phí giao dịch, không phải VNDB và không phải
          tiền thật.
        </p>
      </Kpi>
    </div>
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
      className={ON_TILE}
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
