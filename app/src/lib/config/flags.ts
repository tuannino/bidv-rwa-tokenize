import 'server-only';

import { CHAIN_ORDER, CHAINS, type ChainKey } from '@bidv/shared';
import { serverEnv } from './env';

/**
 * Feature flags + "chain nào thực sự chọn được" — tính ở server rồi truyền xuống client.
 * Client KHÔNG tự đọc env: tránh lệch giữa server/client và tránh rò biến server.
 */

export interface ChainOption {
  key: ChainKey;
  label: string;
  hint: string;
  /** false = hiện trong dropdown nhưng disable, kèm `disabledReason`. */
  selectable: boolean;
  disabledReason?: string;
}

export interface PublicConfig {
  defaultChain: ChainKey;
  chains: ChainOption[];
  mocks: {
    kyc: boolean;
    oracle: boolean;
    corebank: boolean;
    db: boolean;
  };
  /** Vai trò đang giả lập (PoC). Phase 4: lấy từ session SIWE. */
  role: string;
}

function reasonUnavailable(key: ChainKey): string | undefined {
  const env = serverEnv();
  const info = CHAINS[key];

  if (!info.implemented) return 'Chưa hiện thực (adapter stub) — để Phase 7.';

  if (key === 'hardhat-local' && !env.rpcHardhat && !info.defaultRpcUrl) {
    return 'Thiếu RPC — đặt NEXT_PUBLIC_RPC_HARDHAT.';
  }
  if (key === 'evm' && !env.rpcEvm) {
    return 'Thiếu RPC testnet — đặt NEXT_PUBLIC_RPC_EVM (Phase 6).';
  }
  return undefined;
}

export function publicConfig(): PublicConfig {
  const env = serverEnv();

  const chains: ChainOption[] = CHAIN_ORDER.map((key) => {
    const info = CHAINS[key];
    const disabledReason = reasonUnavailable(key);
    return {
      key,
      label: info.label,
      hint: info.hint,
      selectable: disabledReason === undefined,
      disabledReason,
    };
  });

  // Chain mặc định phải chọn được, nếu không thì lùi về `mock` (luôn chạy được).
  const defaultOption = chains.find((option) => option.key === env.defaultChain);
  const defaultChain: ChainKey = defaultOption?.selectable ? env.defaultChain : 'mock';

  return {
    defaultChain,
    chains,
    mocks: {
      kyc: env.useMockKyc,
      oracle: env.useMockOracle,
      corebank: env.useMockCorebank,
      db: env.useMockDb,
    },
    role: env.demoRole,
  };
}
