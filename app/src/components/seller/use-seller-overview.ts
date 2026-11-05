'use client';

import { useEffect, useState } from 'react';
import { getSellerOverviewAction } from '@/app/actions/seller';
import type { SellerOverviewView } from '@/lib/bank/seller.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';

/** Đọc tổng quan theo chuỗi đang chọn. Dùng chung cho màn Tổng quan và màn Tạo lệnh rút. */
export function useSellerOverview() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: SellerOverviewView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSellerOverviewAction({ chain }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: chain, data: result.data, error: null }
          : { key: chain, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, reloadKey]);

  const fresh = loaded?.key === chain ? loaded : null;
  return {
    data: fresh?.data ?? null,
    error: fresh?.error ?? null,
    loading: fresh === null,
    /** Đọc lại số dư sau một lệnh rút, giữ số cũ trên màn trong lúc chờ. */
    reload: () => setReloadKey((value) => value + 1),
  };
}
