'use client';

import { useEffect, useState } from 'react';
import { getTokenSummaryAction } from '@/app/actions/portfolio';
import { freshFor, loadTokenSummary, type Loaded } from './token-summary-state';

export function useTokenSummary(chain: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTokenSummary(chain, getTokenSummaryAction).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  // "Đang tải" suy ra từ khoá, không đặt state đồng bộ trong effect (cùng cách hộp cũ đang làm).
  const fresh = freshFor(chain, loaded);
  return { fresh, data: fresh?.data ?? null, error: fresh?.error ?? null, loading: fresh === null };
}
