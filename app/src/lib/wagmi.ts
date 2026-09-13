import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';
import { CHAINS } from '@bidv/shared';

/**
 * Cấu hình wagmi cho ví client (RainbowKit) — chỉ dùng cho thao tác của NHÀ ĐẦU TƯ.
 * Thao tác đặc quyền ngân hàng ký bằng `serverSigner` trong server action, không qua đây.
 *
 * Chain dựng từ `@bidv/shared` để không có nguồn sự thật thứ hai.
 * **KHÔNG Polygon** (đã loại, SPEC §1).
 *
 * `process.env.NEXT_PUBLIC_*` phải viết tường minh: Next inline giá trị lúc build,
 * đọc bằng khoá động sẽ ra undefined ở bundle browser.
 */

const hardhatInfo = CHAINS['hardhat-local'];
const evmInfo = CHAINS.evm;

export const hardhatLocal = defineChain({
  id: hardhatInfo.chainId!,
  name: hardhatInfo.label,
  nativeCurrency: hardhatInfo.nativeCurrency!,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_HARDHAT || hardhatInfo.defaultRpcUrl!] },
  },
  testnet: true,
});

export const evmTestnet = defineChain({
  id: evmInfo.chainId!,
  name: evmInfo.label,
  nativeCurrency: evmInfo.nativeCurrency!,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_EVM || evmInfo.defaultRpcUrl!] },
  },
  testnet: true,
});

const chains = [hardhatLocal, evmTestnet] as const;
const appName = 'BIDV RWA — Điện gió';

/**
 * WalletConnect projectId là TÙY CHỌN ở PoC.
 *
 * `getDefaultConfig` (và cả `connectorsForWallets`) của RainbowKit bắt buộc có projectId
 * thật và NÉM LỖI NGAY LÚC NẠP MODULE nếu thiếu — đủ để làm trắng toàn bộ ứng dụng,
 * kể cả những trang không dùng ví.
 *
 * Không có projectId thì dựng wagmi config trực tiếp với connector `injected` (MetaMask).
 * `RainbowKitProvider` chạy được trên config wagmi bất kỳ, chỉ là danh sách ví ngắn hơn.
 * Đúng nhu cầu hardhat-local và giữ nguyên tắc "chạy được ngay, không phải setup gì".
 */
const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

export const wagmiConfig = walletConnectProjectId
  ? getDefaultConfig({ appName, projectId: walletConnectProjectId, chains, ssr: true })
  : createConfig({
      chains,
      connectors: [injected()],
      transports: {
        [hardhatLocal.id]: http(),
        [evmTestnet.id]: http(),
      },
      ssr: true,
    });
