import Link from 'next/link';
import type { ChainKey } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import type { AccountWalletView } from '@/lib/bank/account-profile.service';
import type { Result } from '@/lib/bank/result';

/** Phần dựng ô "Ví thanh toán" của màn tài khoản, dời nguyên văn từ `account-wallet.tsx` (FE-UX-05b QĐ-3). */

export interface AccountWalletState {
  chain: ChainKey;
  /** Ví đang kết nối (chain khác `mock`); `undefined` khi chưa kết nối. */
  connected: string | undefined;
  /** `null` khi đang đọc trạng thái của đúng `chain|ví` hiện tại. */
  result: Result<AccountWalletView> | null;
}

export function PaymentWalletContent({ state }: { state: AccountWalletState | null }) {
  if (!state) return <span className="text-muted-foreground">Đang đọc…</span>;
  if (state.chain !== 'mock' && !state.connected) {
    return (
      <span className="text-muted-foreground">
        Chưa kết nối ví.{' '}
        <Link href="/wallet" prefetch={false} className="text-primary underline-offset-4 hover:underline">
          Kết nối ví
        </Link>
      </span>
    );
  }
  if (!state.result) return <span className="text-muted-foreground">Đang đọc…</span>;
  if (!state.result.ok) return <span className="text-destructive">{state.result.error}</span>;
  const { wallet, bound } = state.result.data;
  if (!wallet) return <span className="text-muted-foreground">Chưa kết nối ví.</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="break-all font-code text-xs" data-payment-wallet>{wallet}</span>
      <Badge variant={bound ? 'default' : 'destructive'} data-wallet-bound={bound}>
        {bound ? 'Đã định danh' : 'Ví chưa được định danh'}
      </Badge>
    </span>
  );
}
