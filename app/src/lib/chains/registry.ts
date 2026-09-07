import 'server-only';

import { defineChain, type Chain as ViemChain } from 'viem';
import { CHAINS, DEFAULT_CHAIN, isChainKey, type ChainFamily, type ChainKey } from '@bidv/shared';
import { serverEnv } from '@/lib/config/env';

/**
 * Registry chain: ChainKey -> cấu hình cụ thể để adapter dùng.
 * Chỉ có `hardhat-local` | `evm` | `stellar` | `mock`. **KHÔNG Polygon** (đã loại, SPEC §1).
 *
 * Thêm chain EVM mới = thêm entry ở `packages/shared/src/chains.ts` + một nhánh RPC ở đây.
 * Thêm chain khác họ = thêm adapter và đăng ký ở `lib/ledger/index.ts`.
 */

export class UnsupportedChainError extends Error {
  constructor(key: string, reason: string) {
    super(`Chain "${key}" không dùng được: ${reason}`);
    this.name = 'UnsupportedChainError';
  }
}

/** Nhận input ngoài (query string, cookie, form) -> ChainKey an toàn. */
export function resolveChainKey(value: unknown): ChainKey {
  if (isChainKey(value)) return value;
  return serverEnv().defaultChain ?? DEFAULT_CHAIN;
}

export function chainFamily(key: ChainKey): ChainFamily {
  return CHAINS[key].family;
}

/** RPC: env thắng mặc định trong `packages/shared`. */
export function rpcUrlFor(key: ChainKey): string {
  const env = serverEnv();
  const fallback = CHAINS[key].defaultRpcUrl;

  const url =
    key === 'hardhat-local' ? (env.rpcHardhat ?? fallback) : key === 'evm' ? (env.rpcEvm ?? fallback) : undefined;

  if (!url) {
    throw new UnsupportedChainError(
      key,
      key === 'evm'
        ? 'thiếu RPC. Đặt NEXT_PUBLIC_RPC_EVM (hoặc RPC_EVM).'
        : 'thiếu RPC. Đặt NEXT_PUBLIC_RPC_HARDHAT (hoặc RPC_HARDHAT).',
    );
  }
  return url;
}

const viemChainCache = new Map<ChainKey, ViemChain>();

/** Chain object của viem. Tự dựng bằng `defineChain` để không kéo cả `viem/chains` vào bundle. */
export function viemChainFor(key: ChainKey): ViemChain {
  const cached = viemChainCache.get(key);
  if (cached) return cached;

  const info = CHAINS[key];
  if (info.family !== 'evm' || info.chainId === undefined) {
    throw new UnsupportedChainError(key, 'không phải chain EVM.');
  }

  const chain = defineChain({
    id: info.chainId,
    name: info.label,
    nativeCurrency: info.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrlFor(key)] } },
    testnet: true,
  });

  viemChainCache.set(key, chain);
  return chain;
}

/** Xoá cache khi env đổi (test). */
export function resetChainRegistryCache(): void {
  viemChainCache.clear();
}
