'use client';

import { create } from 'zustand';
import type { ChainKey } from '@bidv/shared';

/**
 * Chain đang chọn ở UI (Zustand).
 *
 * `null` = "chưa chọn, dùng mặc định của server" — nhờ vậy render đầu tiên giống hệt server,
 * không sinh hydration mismatch. Dùng `useSelectedChain()` để lấy giá trị đã giải quyết.
 *
 * Cố tình KHÔNG persist: chain luôn được truyền TƯỜNG MINH vào server action,
 * nên server không bao giờ phải đoán client đang ở chain nào.
 */
interface ChainState {
  selected: ChainKey | null;
  setSelected: (chain: ChainKey) => void;
}

export const useChainStore = create<ChainState>((set) => ({
  selected: null,
  setSelected: (chain) => set({ selected: chain }),
}));
