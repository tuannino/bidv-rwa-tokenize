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
  /**
   * Gốc block explorer, KHÔNG có dấu `/` cuối. `undefined` = chain này không có explorer
   * (hardhat-local, mock) -> UI phải ẩn link chứ không trỏ sang explorer của chain khác.
   */
  explorerBaseUrl?: string;
  explorerName?: string;
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
    // Chain cục bộ: không có explorer công khai nào biết tới nó.
    implemented: true,
    requiresNode: true,
    hint: 'Chain nội bộ cho demo đầy đủ (docker compose up).',
  },
  evm: {
    key: 'evm',
    label: 'EVM Testnet (Sepolia)',
    family: 'evm',
    chainId: 11155111,
    /**
     * RPC công khai KHÔNG cần API key, để đọc chain được ngay mà chưa phải cấu hình gì.
     *
     * Giá trị cũ `https://rpc.sepolia.org` đã CHẾT (trả HTTP 404, không phải JSON-RPC) —
     * đo được lúc làm P4. Endpoint hiện tại đã kiểm: trả đúng chainId 11155111.
     * Ghi giao dịch thật nên đặt `NEXT_PUBLIC_RPC_EVM`/`RPC_EVM` trỏ RPC có API key,
     * vì endpoint công khai bị rate-limit.
     */
    defaultRpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    explorerName: 'Etherscan',
    implemented: true,
    requiresNode: false,
    hint: 'Testnet công khai. Cần địa chỉ contract qua NEXT_PUBLIC_ADDR_EVM_* sau khi deploy.',
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

/**
 * URL xem giao dịch trên explorer của chain, hoặc `null` nếu chain không có explorer.
 *
 * Trả `null` thay vì một URL đoán bừa: trỏ tx của hardhat-local sang explorer công khai
 * sẽ ra trang "not found", tệ hơn là không có link.
 */
export function explorerTxUrl(key: ChainKey, txHash: string): string | null {
  const base = CHAINS[key].explorerBaseUrl;
  return base ? `${base}/tx/${txHash}` : null;
}
