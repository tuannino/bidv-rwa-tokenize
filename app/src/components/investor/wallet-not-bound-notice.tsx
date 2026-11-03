import { ShieldAlert } from 'lucide-react';

/**
 * Thông báo dùng chung khi ví đang kết nối chưa được ngân hàng gắn cho hồ sơ phiên (FIX-01 E1). Máy
 * chủ không trả dữ liệu của ví đó, nên khối thay số liệu bằng thông báo này, không hiện số của ví
 * trước.
 */
export function WalletNotBoundNotice({ wallet }: { wallet: string }) {
  const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  return (
    <div
      role="alert"
      data-wallet-not-bound
      className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-semibold">Ví chưa được định danh</p>
        <p>
          Ví <span className="font-code">{short}</span> chưa được ngân hàng định danh cho tài khoản này. Liên hệ
          ngân hàng hoặc kết nối ví khác.
        </p>
      </div>
    </div>
  );
}

/** Kết quả action báo ví chưa được định danh. */
export const isWalletNotBound = (result: { ok: boolean; code?: string }): boolean =>
  !result.ok && result.code === 'WALLET_NOT_BOUND';
