'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAccount, useConfig, useDisconnect, useSwitchChain } from 'wagmi';
import { CHAINS } from '@bidv/shared';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import {
  getInjectedProviderServerSnapshot,
  getInjectedProviderSnapshot,
  subscribeInjectedProvider,
} from '@/lib/wallet/injected-provider';
import { describeSwitchError } from '@/lib/wallet/switch-error';
import {
  blockedSigningReason,
  canSignWith,
  chainIdToSwitchTo,
  resolveWalletStatus,
  type WalletStatus,
} from '@/lib/wallet/wallet-status';
import { useIsMounted } from './use-is-mounted';

export type { WalletStatus } from '@/lib/wallet/wallet-status';

export interface UseWalletStatusResult {
  status: WalletStatus;
  /** Ví sẵn sàng cho thao tác cần ký. Đây là thứ FE-05/FE-09/FE-11 dùng để bật/tắt nút ký. */
  canSign: boolean;
  /** Lý do không ký được, `null` khi ký được (R3.5). */
  blockedReason: string | null;
  /** Yêu cầu ví chuyển sang chain mà ứng dụng đang xem. Chỉ gọi khi người dùng bấm (QĐ-5). */
  switchToExpected: () => Promise<void>;
  /** Đang chờ ví trả lời yêu cầu chuyển chain. */
  switching: boolean;
  /** Lý do lần chuyển chain vừa rồi không thành, kể cả khi người dùng tự từ chối. */
  switchError: string | null;
  disconnect: () => void;
}

/**
 * MỘT nguồn sự thật cho câu hỏi "ví có sẵn sàng để ký chưa".
 *
 * FE-04, FE-05, FE-09 và FE-11 đều cần biết điều này. Nếu mỗi màn tự ghép `useAccount`,
 * `useChainId`, `useSwitchChain` thì logic phân tán và lệch nhau — nên gom hết vào đây.
 * Quy tắc quyết định nằm ở `lib/wallet/wallet-status.ts` (thuần, có unit test); hook này
 * chỉ thu thập đầu vào thật rồi gọi nó.
 *
 * KHÔNG gọi hợp đồng nào (LUẬT #1 — mọi lời gọi hợp đồng đi qua `ILedgerPort`). Các hook
 * wagmi ở đây chỉ phục vụ riêng việc kết nối ví.
 */
export function useWalletStatus(): UseWalletStatusResult {
  const mounted = useIsMounted();
  const { chain: appChain } = useSelectedChain();
  const config = useConfig();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { disconnect } = useDisconnect();

  /**
   * `useAccount().chainId` chứ KHÔNG dùng `useChainId()`.
   *
   * `useChainId()` trả chain "đang hoạt động" của config, và khi chưa kết nối thì nó lùi về
   * chain đầu tiên trong danh sách cấu hình. Lấy giá trị đó làm "chain của ví" sẽ ra kết luận
   * sai: lúc chưa có ví nào vẫn thấy khớp chain. `useAccount().chainId` là `undefined` khi
   * chưa kết nối, tức là nói thật.
   */
  const { address, chainId: walletChainId, isConnected, isReconnecting, isConnecting } = useAccount();

  const hasInjectedProvider = useSyncExternalStore(
    subscribeInjectedProvider,
    getInjectedProviderSnapshot,
    getInjectedProviderServerSnapshot,
  );

  const [switchError, setSwitchError] = useState<string | null>(null);

  const status = useMemo(
    () =>
      resolveWalletStatus({
        mounted,
        appChain,
        hasInjectedProvider,
        isConnected,
        isReconnecting: isReconnecting || isConnecting,
        address,
        walletChainId,
      }),
    [
      mounted,
      appChain,
      hasInjectedProvider,
      isConnected,
      isReconnecting,
      isConnecting,
      address,
      walletChainId,
    ],
  );

  const switchToExpected = useCallback(async () => {
    const targetChainId = chainIdToSwitchTo(status);
    if (targetChainId === undefined) return;

    /**
     * Thông số chain đưa cho ví lấy từ `packages/shared` qua cấu hình wagmi, KHÔNG ghi cứng
     * (R3.3). Cụ thể:
     *   - `rpcUrls` lấy từ chain trong config wagmi vì `lib/wagmi.ts` đã áp env override
     *     (`NEXT_PUBLIC_RPC_*`) lên `defaultRpcUrl` của `CHAINS`. Đọc lại `CHAINS` ở đây sẽ
     *     làm mất phần override đó.
     *   - `blockExplorerUrls` lấy từ `CHAINS` vì `lib/wagmi.ts` không khai báo explorer.
     *     Không có bước này thì `wallet_addEthereumChain` gửi đi thiếu explorer.
     */
    const configured = config.chains.find((candidate) => candidate.id === targetChainId);
    const info = Object.values(CHAINS).find((candidate) => candidate.chainId === targetChainId);
    const targetLabel = info?.label ?? `chain ID ${targetChainId}`;

    if (!configured || !info) {
      setSwitchError(
        `Mạng ${targetLabel} chưa có trong cấu hình ví của ứng dụng, chưa chuyển được.`,
      );
      return;
    }

    setSwitchError(null);
    try {
      await switchChainAsync({
        chainId: configured.id,
        addEthereumChainParameter: {
          chainName: info.label,
          nativeCurrency: info.nativeCurrency,
          rpcUrls: [configured.rpcUrls.default.http[0]],
          blockExplorerUrls: info.explorerBaseUrl ? [info.explorerBaseUrl] : undefined,
        },
      });
    } catch (error) {
      /**
       * Từ chối cũng đi vào đây. Chỉ ghi lý do rồi dừng — KHÔNG thử lại (R3.4): gọi lại là
       * dựng vòng lặp hộp thoại mà người dùng không có cách nào thoát ngoài đóng tab.
       * Trạng thái cảnh báo vẫn giữ nguyên vì `status` suy ra từ chain thật của ví.
       */
      setSwitchError(describeSwitchError(error, targetLabel));
    }
  }, [config.chains, status, switchChainAsync]);

  return {
    status,
    canSign: canSignWith(status),
    blockedReason: blockedSigningReason(status),
    switchToExpected,
    switching,
    switchError,
    disconnect,
  };
}
