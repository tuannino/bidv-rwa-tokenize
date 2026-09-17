/**
 * Trạng thái kết nối ví — LOGIC THUẦN, không React, không wagmi.
 *
 * Tách khỏi `lib/hooks/use-wallet-status.ts` là có chủ ý: hàm quyết định phải chạy được
 * trong vitest môi trường `node` (xem `vitest.config.ts`) để phủ đủ mọi nhánh mà không cần
 * jsdom, không cần dựng provider của wagmi. Hook chỉ làm một việc: thu thập đầu vào thật
 * từ ví rồi gọi hàm này.
 *
 * Danh sách chain được phép và thông số chain lấy từ `@bidv/shared` — MỘT nguồn sự thật,
 * giống hệt `lib/wagmi.ts`. Không ghi cứng chainId ở đây.
 */
import { CHAINS, CHAIN_ORDER, type ChainKey } from '@bidv/shared';

/**
 * Chain thuộc họ EVM và có chainId — tức chain mà ví trình duyệt có thể kết nối tới.
 * Suy ra từ `CHAINS` nên thêm/bớt chain EVM ở `packages/shared` là tự động có hiệu lực.
 */
export const WALLET_CHAIN_KEYS: readonly ChainKey[] = CHAIN_ORDER.filter(
  (key) => CHAINS[key].family === 'evm' && CHAINS[key].chainId !== undefined,
);

/** chainId của các chain được phép. Ví đang ở chainId ngoài tập này là "sai chuỗi". */
export const ALLOWED_CHAIN_IDS: readonly number[] = WALLET_CHAIN_KEYS.map(
  (key) => CHAINS[key].chainId!,
);

/** Tra `ChainKey` từ chainId của ví, `undefined` nếu chainId không nằm trong danh sách được phép. */
export function chainKeyOfChainId(chainId: number | undefined): ChainKey | undefined {
  if (chainId === undefined) return undefined;
  return WALLET_CHAIN_KEYS.find((key) => CHAINS[key].chainId === chainId);
}

/** Nhãn hiển thị của một chainId. chainId lạ thì nêu thẳng con số, đừng bịa tên. */
export function chainIdLabel(chainId: number): string {
  const key = chainKeyOfChainId(chainId);
  return key ? CHAINS[key].label : `mạng lạ (chain ID ${chainId})`;
}

export type WalletStatus =
  /** Chưa gắn vào cây giao diện, hoặc ví đang tự kết nối lại. */
  | { kind: 'loading' }
  /** Chain đang chọn là `mock`: không cần ví thật. */
  | { kind: 'mock' }
  /** Chain đang chọn không thuộc họ EVM (stellar): ví trình duyệt chưa hỗ trợ. */
  | { kind: 'unsupported-chain'; appChainKey: ChainKey; appChain: string }
  /** Trình duyệt không có ví nào được tiêm vào. */
  | { kind: 'no-provider' }
  | { kind: 'disconnected' }
  /** Ví đang ở chain ngoài danh sách được phép. */
  | { kind: 'wrong-chain'; current: number; expected: number; expectedLabel: string }
  /** Ví ở chain được phép, nhưng khác chain đang chọn trong ứng dụng. */
  | {
      kind: 'chain-mismatch';
      walletChain: string;
      appChain: string;
      walletChainKey: ChainKey;
      appChainKey: ChainKey;
      expected: number;
    }
  | { kind: 'ready'; address: `0x${string}`; chainKey: ChainKey };

export type WalletStatusKind = WalletStatus['kind'];

export interface WalletStatusInput {
  /** Đã hydrate xong chưa (`useIsMounted`). */
  mounted: boolean;
  /** Chain đang chọn ở ứng dụng (`useSelectedChain`). */
  appChain: ChainKey;
  /** Trình duyệt có ví được tiêm vào không. */
  hasInjectedProvider: boolean;
  isConnected: boolean;
  /** Ví đang tự kết nối lại sau khi tải trang, hoặc đang chờ người dùng xác nhận. */
  isReconnecting?: boolean;
  address?: `0x${string}`;
  /** chainId ví đang ở. */
  walletChainId?: number;
}

/**
 * Quyết định trạng thái ví theo THỨ TỰ ƯU TIÊN cố định (design.md QĐ-3).
 *
 * Thứ tự này là phần dễ làm sai nhất của cả task:
 *
 *   1. chưa hydrate                    → loading
 *   2. chain đang chọn là mock         → mock            (dừng, không kiểm gì nữa)
 *   3. chain đang chọn không phải EVM  → unsupported-chain
 *   4. ví đang kết nối lại             → loading
 *   5. không có ví được tiêm           → no-provider
 *   6. chưa kết nối                    → disconnected
 *   7. chainId ngoài danh sách         → wrong-chain
 *   8. chainId khác chain đang chọn    → chain-mismatch
 *   9. còn lại                         → ready
 *
 * `mock` phải đứng trước mọi phép kiểm ví: chế độ mô phỏng không cần ví, nên hiện bất kỳ
 * cảnh báo ví nào ở đó cũng là nhiễu. Đây cũng là chế độ mặc định của bản triển khai
 * miễn phí, tức là trạng thái mà đa số người xem demo gặp đầu tiên.
 *
 * Bước 3 đứng trước bước 5 cũng vì lẽ đó: người đang xem chain Stellar mà bị mời "cài
 * MetaMask" thì lời mời đó vô nghĩa — MetaMask không nói được Stellar.
 */
export function resolveWalletStatus(input: WalletStatusInput): WalletStatus {
  const { mounted, appChain, hasInjectedProvider, isConnected, address, walletChainId } = input;

  // 1 — trạng thái ví chỉ tồn tại ở trình duyệt. Lần kết xuất đầu phải không phụ thuộc nó.
  if (!mounted) return { kind: 'loading' };

  const appInfo = CHAINS[appChain];

  // 2 — mock: dừng tại đây.
  if (appInfo.family === 'mock') return { kind: 'mock' };

  // 3 — stellar (và mọi họ chain không phải EVM về sau).
  if (appInfo.family !== 'evm' || appInfo.chainId === undefined) {
    return { kind: 'unsupported-chain', appChainKey: appChain, appChain: appInfo.label };
  }

  /**
   * 4 — wagmi tự kết nối lại ví đã cho phép sau mỗi lần tải trang. Trong khoảng đó
   * `isConnected` còn `false`; coi là "chưa kết nối" sẽ nháy một nhịp "Chưa kết nối ví"
   * rồi mới hiện địa chỉ.
   */
  if (input.isReconnecting) return { kind: 'loading' };

  /**
   * 5 — không có ví được tiêm.
   *
   * `isConnected` được kiểm trước như một chốt an toàn: đã kết nối được thì hiển nhiên là
   * có ví, dù phép dò không thấy (ví chỉ công bố theo EIP-6963 và không đặt
   * `window.ethereum` là trường hợp thật).
   */
  if (!hasInjectedProvider && !isConnected) return { kind: 'no-provider' };

  // 6 — chưa kết nối.
  if (!isConnected || !address) return { kind: 'disconnected' };

  const expected = appInfo.chainId;

  // 7 — chainId ngoài danh sách được phép (mainnet, một testnet khác, ...).
  const walletChainKey = chainKeyOfChainId(walletChainId);
  if (walletChainId === undefined || walletChainKey === undefined) {
    return {
      kind: 'wrong-chain',
      current: walletChainId ?? 0,
      expected,
      expectedLabel: appInfo.label,
    };
  }

  // 8 — chain được phép nhưng lệch với chain đang xem trong ứng dụng.
  if (walletChainId !== expected) {
    return {
      kind: 'chain-mismatch',
      walletChain: CHAINS[walletChainKey].label,
      appChain: appInfo.label,
      walletChainKey,
      appChainKey: appChain,
      expected,
    };
  }

  // 9 — sẵn sàng.
  return { kind: 'ready', address, chainKey: appChain };
}

/**
 * Ví đã sẵn sàng cho thao tác cần ký chưa.
 *
 * `mock` cũng đúng: chế độ mô phỏng ký bằng ledger trong bộ nhớ, không cần ví. Đây là thứ
 * FE-05 / FE-09 / FE-11 dùng để bật hoặc tắt nút ký — MỘT chỗ quyết định, không rải rác.
 */
export function canSignWith(status: WalletStatus): boolean {
  return status.kind === 'ready' || status.kind === 'mock';
}

/**
 * Lý do KHÔNG ký được, viết cho cán bộ ngân hàng đọc (R3.5).
 * `null` khi ký được — để chỗ gọi phân biệt "không có lý do" với "chưa biết".
 */
export function blockedSigningReason(status: WalletStatus): string | null {
  switch (status.kind) {
    case 'ready':
    case 'mock':
      return null;
    case 'loading':
      return 'Đang kiểm tra ví, vui lòng chờ.';
    case 'unsupported-chain':
      return `Ví trình duyệt chưa hỗ trợ mạng ${status.appChain}. Hãy chọn mạng khác ở ô Chain phía trên.`;
    case 'no-provider':
      return 'Chưa có ví nào trong trình duyệt. Cài ví rồi tải lại trang.';
    case 'disconnected':
      return 'Chưa kết nối ví. Bấm Kết nối ví để tiếp tục.';
    case 'wrong-chain':
      return `Ví đang ở ${chainIdLabel(status.current)}, cần chuyển sang ${status.expectedLabel}.`;
    case 'chain-mismatch':
      return `Ví đang ở ${status.walletChain} còn trang đang xem ${status.appChain}. Hai bên phải cùng một mạng.`;
  }
}

/**
 * chainId mà ví CẦN chuyển sang, `undefined` nếu trạng thái hiện tại không phải chuyện
 * chuyển chain. Dùng để `switchToExpected` không phải đoán.
 */
export function chainIdToSwitchTo(status: WalletStatus): number | undefined {
  if (status.kind === 'wrong-chain') return status.expected;
  if (status.kind === 'chain-mismatch') return status.expected;
  return undefined;
}
