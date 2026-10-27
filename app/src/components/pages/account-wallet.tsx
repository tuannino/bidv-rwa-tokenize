'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import type { ChainKey } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import { getAccountWalletAction } from '@/app/actions/account';
import type { AccountWalletView } from '@/lib/bank/account-profile.service';
import type { Result } from '@/lib/bank/result';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';

/**
 * Ví thanh toán của màn tài khoản (FIX-01 F1 tới F3), chỉ cho vai khách hàng. Khách hàng không tự cấu
 * hình ví nữa: ngân hàng gắn ví cho hồ sơ ở màn Định danh ví. Ô "Ví thanh toán" chỉ hiện ví và trạng
 * thái định danh của nó:
 * - `mock` (không có ví trình duyệt): ví mẫu của hồ sơ;
 * - chain khác: ví đang kết nối (wagmi).
 */

interface AccountWalletState {
  chain: ChainKey;
  /** Ví đang kết nối (chain khác `mock`); `undefined` khi chưa kết nối. */
  connected: string | undefined;
  /** `null` khi đang đọc trạng thái của đúng `chain|ví` hiện tại. */
  result: Result<AccountWalletView> | null;
}

const AccountWalletContext = createContext<AccountWalletState | null>(null);

/**
 * Gọi `getAccountWalletAction` MỘT lần mỗi khi giá trị thực sự gửi đi đổi (chain, hoặc ví đang kết
 * nối trên chain khác `mock`). Kết quả giữ kèm khoá `chain|ví` của lần gọi (E6): kết quả có khoá khác
 * giá trị hiện tại bị bỏ, không hiện nhãn "Đã định danh" của ví hay chain trước.
 */
export function AccountWalletProvider({ children }: { children: React.ReactNode }) {
  const { chain } = useSelectedChain();
  const { address } = useAccount();
  const wallet = chain === 'mock' ? undefined : address;
  const requestKey = `${chain}|${wallet ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; result: Result<AccountWalletView> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAccountWalletAction({ chain, wallet }).then((result) => {
      if (!cancelled) setLoaded({ key: requestKey, result });
    });
    return () => {
      cancelled = true;
    };
  }, [chain, wallet, requestKey]);

  const value: AccountWalletState = {
    chain,
    connected: wallet,
    result: loaded?.key === requestKey ? loaded.result : null,
  };
  return <AccountWalletContext.Provider value={value}>{children}</AccountWalletContext.Provider>;
}

/** Ô "Ví thanh toán" (F2). Không có provider (dựng ở máy chủ, test) thì "Đang đọc…". */
export function PaymentWalletValue() {
  const state = useContext(AccountWalletContext);
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
      <span className="break-all font-mono text-xs" data-payment-wallet>{wallet}</span>
      <Badge variant={bound ? 'default' : 'destructive'} data-wallet-bound={bound}>
        {bound ? 'Đã định danh' : 'Ví chưa được định danh'}
      </Badge>
    </span>
  );
}
