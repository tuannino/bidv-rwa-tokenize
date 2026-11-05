'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { getAccountWalletAction } from '@/app/actions/account';
import type { AccountWalletView } from '@/lib/bank/account-profile.service';
import type { Result } from '@/lib/bank/result';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { PaymentWalletContent, type AccountWalletState } from '@/components/account/payment-wallet-content';

/**
 * Ví thanh toán của màn tài khoản (FIX-01 F1 tới F3), chỉ cho vai khách hàng. Khách hàng không tự cấu
 * hình ví nữa: ngân hàng gắn ví cho hồ sơ ở màn Định danh ví. Ô "Ví thanh toán" chỉ hiện ví và trạng
 * thái định danh của nó:
 * - `mock` (không có ví trình duyệt): ví mẫu của hồ sơ;
 * - chain khác: ví đang kết nối (wagmi).
 */

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
  return <PaymentWalletContent state={useContext(AccountWalletContext)} />;
}
