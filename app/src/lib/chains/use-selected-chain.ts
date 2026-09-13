'use client';

import { usePublicConfig } from '@/lib/config/config-context';
import type { ChainKey } from '@bidv/shared';
import { useChainStore } from './chain-store';

/**
 * Chain đang dùng = lựa chọn của người dùng, nếu chưa chọn thì lấy mặc định từ server.
 * Nếu lựa chọn đã lưu bỗng thành không dùng được (đổi env), tự lùi về mặc định.
 */
export function useSelectedChain(): {
  chain: ChainKey;
  setChain: (chain: ChainKey) => void;
} {
  const config = usePublicConfig();
  const selected = useChainStore((state) => state.selected);
  const setChain = useChainStore((state) => state.setSelected);

  const isSelectable = config.chains.some((option) => option.key === selected && option.selectable);

  return { chain: isSelectable && selected ? selected : config.defaultChain, setChain };
}
