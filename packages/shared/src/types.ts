/**
 * Types dùng chung giữa contracts, web (server + client).
 * KHÔNG import gì nặng ở đây — file này bị kéo vào cả bundle edge.
 */

/** Chain chọn được trên UI. KHÔNG có polygon (đã loại theo SPEC §1). */
export const CHAIN_KEYS = ['hardhat-local', 'evm', 'stellar', 'mock'] as const;
export type ChainKey = (typeof CHAIN_KEYS)[number];

export function isChainKey(value: unknown): value is ChainKey {
  return typeof value === 'string' && (CHAIN_KEYS as readonly string[]).includes(value);
}

/** Họ công nghệ của chain — quyết định adapter nào được dùng. */
export type ChainFamily = 'evm' | 'stellar' | 'mock';

export type TxStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface TxResult {
  txHash: string;
  status: TxStatus;
  /** Lý do FAILED (nếu có) — để UI/audit hiển thị. */
  reason?: string;
}

/** Tên contract mà web cần biết địa chỉ. */
export const CONTRACT_NAMES = [
  'ProjectToken',
  'VNDToken',
  'ProfitDistributor',
  'Redemption',
  'IdentityRegistry',
  'ModularCompliance',
  'AllowAllModule',
  'SpvPaymentVault',
  'OrderSettlement',
] as const;
export type ContractName = (typeof CONTRACT_NAMES)[number];

export type ContractAddressMap = Partial<Record<ContractName, string>>;

export interface DeploymentRecord {
  /** chainId EVM (không áp dụng cho stellar/mock). */
  chainId?: number;
  /** Ví deployer = ngân hàng (admin/agent/minter) lúc deploy. */
  deployer?: string;
  deployedAt?: string;
  /** Block triển khai hợp đồng đầu tiên; mốc tối thiểu khi quét sự kiện. */
  deployBlock?: number;
  contracts: ContractAddressMap;
}

/** Nội dung addresses.json: chain key -> deployment. */
export type AddressBook = Partial<Record<ChainKey, DeploymentRecord>>;

/** ISO 3166-1 numeric của Việt Nam, lưu trong IdentityRegistry ERC-3643 PoC. */
export const VIETNAM_COUNTRY_CODE = 704;
