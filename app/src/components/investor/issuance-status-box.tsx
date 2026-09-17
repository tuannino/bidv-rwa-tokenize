'use client';

import { useEffect, useState } from 'react';
import { Gauge, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { getTokenSummaryAction } from '@/app/actions/portfolio';
import type { TokenSummary } from '@/lib/bank/portfolio.service';
import { MOCK_PROJECTS, PROJECT_STATUS_LABELS } from '@/lib/mock-data';
import { MockBadge, OnChainBadge } from './mock-badge';

/**
 * Hộp 2 — TRẠNG THÁI PHÁT HÀNH VÀ VẬN HÀNH.
 *
 * ⚠️ Cố ý KHÔNG đặt tên là "trạng thái thị trường". Hệ thống chưa có thị trường thứ cấp:
 * không sàn, không khớp lệnh giữa các nhà đầu tư, nên KHÔNG CÓ giá giao dịch. Vì vậy hộp này
 * tuyệt đối không hiển thị biến động giá theo phần trăm, khối lượng giao dịch, hay biểu đồ nến.
 * Người xem là ngân hàng; bày những thứ đó ra là trình bày sai bản chất.
 *
 * Không cần ví — đọc được cả khi chưa kết nối.
 */

const nf = (value: string) => {
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

/** Dự án đã lên chuỗi — nguồn duy nhất là MOCK_PROJECTS, không dựng nguồn thứ hai. */
const ON_CHAIN_PROJECT = MOCK_PROJECTS.find((project) => project.onChain);

export function IssuanceStatusBox() {
  const { chain } = useSelectedChain();

  /** Khoá = chain. "Đang tải" suy ra từ khoá cũ, không dùng setState đồng bộ trong effect. */
  const [loaded, setLoaded] = useState<{
    key: string;
    data: TokenSummary | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getTokenSummaryAction(chain).then((result) => {
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
  }, [chain]);

  const fresh = loaded?.key === chain ? loaded : null;
  const data = fresh?.data ?? null;
  const error = fresh?.error ?? null;
  const loading = fresh === null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Trạng thái phát hành</CardTitle>
        <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang đọc thông số token…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : data ? (
          <dl className="space-y-3 text-sm">
            <Row label="Ký hiệu token" badge={<OnChainBadge />}>
              <span className="font-mono font-semibold">{data.symbol}</span>
            </Row>

            <Row label="Tổng cung đã phát hành" badge={<OnChainBadge />}>
              <span className="font-mono font-semibold">{nf(data.totalSupply)}</span>
            </Row>

            <Row label="Giá phát hành">
              <span className="font-mono font-semibold">
                {data.issuePriceVnd.toLocaleString('vi-VN')} ₫
              </span>
            </Row>

            {ON_CHAIN_PROJECT && (
              <>
                <Row label="Dự án" badge={<MockBadge />}>
                  <span className="text-right">{ON_CHAIN_PROJECT.name}</span>
                </Row>
                <Row label="Trạng thái vận hành" badge={<MockBadge />}>
                  <span>{PROJECT_STATUS_LABELS[ON_CHAIN_PROJECT.status]}</span>
                </Row>
              </>
            )}

            {/*
              Nói thẳng giới hạn thay vì để người xem tự suy: thiếu câu này, một cán bộ ngân
              hàng có thể hiểu "giá phát hành" là giá đang giao dịch.
            */}
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Chưa có thị trường thứ cấp nên không có giá giao dịch, biến động giá hay khối
              lượng. Giá phát hành là điều khoản của đợt phát hành, không phải giá thị trường.
            </p>
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  badge,
  children,
}: {
  label: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {label}
        {badge}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
