/**
 * Dữ liệu chain (thuần data, không phụ thuộc viem/ethers) — dùng được ở cả server và client.
 * Registry hành vi nằm ở `app/src/lib/chains`; ở đây chỉ là sự thật về chain.
 *
 * Thứ tự ưu tiên theo SPEC §1: hardhat-local (mặc định) -> evm -> stellar.
 * KHÔNG có Polygon.
 */
import type { ChainFamily, ChainKey } from './types';

export interface ChainInfo {
  key: ChainKey;
  /** Nhãn hiển thị trên UI. */
  label: string;
  family: ChainFamily;
  /** chainId EVM (chỉ với family = 'evm'). */
  chainId?: number;
  /** RPC mặc định khi không có env override. */
  defaultRpcUrl?: string;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
  /** false = mới là stub/chưa hiện thực xong, UI nên disable. */
  implemented: boolean;
  /** true = chạy được KHÔNG cần chain thật (phù hợp free-tier). */
  requiresNode: boolean;
  hint: string;
}

export const DEFAULT_CHAIN: ChainKey = 'hardhat-local';

export const CHAINS: Record<ChainKey, ChainInfo> = {
  'hardhat-local': {
    key: 'hardhat-local',
    label: 'Hardhat Local',
    family: 'evm',
    chainId: 31337,
    defaultRpcUrl: 'http://127.0.0.1:8545',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    implemented: true,
    requiresNode: true,
    hint: 'Chain nội bộ cho demo đầy đủ (docker compose up).',
  },
  evm: {
    key: 'evm',
    label: 'EVM Testnet (Sepolia)',
    family: 'evm',
    chainId: 11155111,
    defaultRpcUrl: 'https://rpc.sepolia.org',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    implemented: true,
    requiresNode: false,
    hint: 'Cần RPC + địa chỉ contract qua biến môi trường (Phase 6).',
  },
  stellar: {
    key: 'stellar',
    label: 'Stellar (Soroban)',
    family: 'stellar',
    implemented: false,
    requiresNode: false,
    hint: 'Chưa hiện thực — adapter stub, để Phase 7.',
  },
  mock: {
    key: 'mock',
    label: 'Mock (không cần chain)',
    family: 'mock',
    implemented: true,
    requiresNode: false,
    hint: 'Ledger trong bộ nhớ. Dùng cho demo public / free-tier.',
  },
};

/** Thứ tự hiển thị trên dropdown. */
export const CHAIN_ORDER: ChainKey[] = ['hardhat-local', 'mock', 'evm', 'stellar'];

export function getChainInfo(key: ChainKey): ChainInfo {
  return CHAINS[key];
}
