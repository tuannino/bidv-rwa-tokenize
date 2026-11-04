import { ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';

/**
 * Thông báo dùng chung khi ví đang kết nối chưa được ngân hàng gắn cho hồ sơ phiên (FIX-01 E1). Máy
 * chủ không trả dữ liệu của ví đó, nên khối thay số liệu bằng thông báo này, không hiện số của ví
 * trước.
 */
export function WalletNotBoundNotice({ wallet }: { wallet: string }) {
  const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  return (
    <Alert
      tone="warn"
      role="alert"
      data-wallet-not-bound
      icon={<ShieldAlert className="mt-px size-[18px] shrink-0" aria-hidden="true" />}
    >
      <div className="space-y-0.5">
        <p className="font-semibold">Ví chưa được định danh</p>
        <p>
          Ví <span className="font-code">{short}</span> chưa được ngân hàng định danh cho tài khoản này. Liên hệ
          ngân hàng hoặc kết nối ví khác.
        </p>
      </div>
    </Alert>
  );
}

/** Kết quả action báo ví chưa được định danh. */
export const isWalletNotBound = (result: { ok: boolean; code?: string }): boolean =>
  !result.ok && result.code === 'WALLET_NOT_BOUND';
