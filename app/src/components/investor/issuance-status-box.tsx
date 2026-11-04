'use client';

import { Gauge } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { UnverifiedNote } from '@/components/ui/unverified-note';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { MOCK_PROJECTS, PROJECT_STATUS_LABELS } from '@/lib/mock-data';
import { OnChainBadge } from './mock-badge';
import { useTokenSummary } from './use-token-summary';

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

/** Dự án đã lên chuỗi, chỉ để lấy trạng thái vận hành mẫu (chưa có nguồn thật, FIX-04). */
const ON_CHAIN_PROJECT = MOCK_PROJECTS.find((project) => project.onChain);

export function IssuanceStatusBox() {
  const { chain } = useSelectedChain();
  // FIX-04 F2: dùng chung một lời gọi `getTokenSummaryAction` với hộp Danh sách token.
  const { data, error, loading } = useTokenSummary(chain);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>
            <Gauge />
          </CardTitleIcon>
          Trạng thái phát hành
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <EmptyState loading>Đang đọc thông số token…</EmptyState>
        ) : error ? (
          <Alert tone="bad">{error}</Alert>
        ) : data ? (
          <>
            <dl className="divide-y divide-border text-sm">
              <Row label="Ký hiệu token" badge={<OnChainBadge />}>
                <span className="font-semibold">{data.symbol}</span>
              </Row>

              <Row label="Tổng cung đã phát hành" badge={<OnChainBadge />}>
                <span className="tabular-nums font-semibold">{nf(data.totalSupply)}</span>
              </Row>

              <Row label="Giá phát hành">
                <span className="tabular-nums font-semibold">
                  {nf(data.issuePriceVnd)} ₫
                </span>
              </Row>

              <Row label="Dự án">
                <span className="text-right">{data.projectName ?? 'Chưa đọc được'}</span>
              </Row>
              {ON_CHAIN_PROJECT && (
                <Row label="Trạng thái vận hành" badge={<UnverifiedNote />}>
                  <Badge variant="info">{PROJECT_STATUS_LABELS[ON_CHAIN_PROJECT.status]}</Badge>
                </Row>
              )}
            </dl>

            {/*
              Nói thẳng giới hạn thay vì để người xem tự suy: thiếu câu này, một cán bộ ngân
              hàng có thể hiểu "giá phát hành" là giá đang giao dịch.
              Đặt ngoài `dl` (trong `dl` chỉ có cặp nhãn, giá trị).
            */}
            <Alert tone="info" className="mt-3">
              Chưa có thị trường thứ cấp nên không có giá giao dịch, biến động giá hay khối
              lượng. Giá phát hành là điều khoản của đợt phát hành, không phải giá thị trường.
            </Alert>
          </>
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
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {label}
        {badge}
      </dt>
      <dd className="text-right font-semibold text-foreground">{children}</dd>
    </div>
  );
}
