'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicConfig } from './flags';

/**
 * Cấu hình công khai do SERVER tính (xem `flags.ts`) rồi truyền xuống client.
 * Client không tự đọc `process.env` -> không lệch server/client, không rò biến server.
 */
const ConfigContext = createContext<PublicConfig | null>(null);

export function ConfigProvider({ value, children }: { value: PublicConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function usePublicConfig(): PublicConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('usePublicConfig phải nằm trong <ConfigProvider>.');
  return config;
}
