'use client';

import Link from 'next/link';
import { ChevronRight, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MOCK_PROJECTS,
  MOCK_WIND_STATS,
  PROJECT_STATUS_LABELS,
  REGION_LABELS,
} from '@/lib/mock-data';
import { MockBadge, OnChainBadge } from './mock-badge';

/**
 * Hộp 4 — DANH SÁCH TOKEN đang được token hoá.
 *
 * Nguồn duy nhất là `MOCK_PROJECTS` (không dựng nguồn dữ liệu dự án thứ hai).
 *
 * Hệ thống hiện chỉ triển khai MỘT token trên chuỗi, nên mỗi dòng phải nói rõ mình thuộc loại
 * nào: `onChain` thì số liệu đọc được từ chuỗi, còn lại là dữ liệu mẫu. Trộn hai loại mà không
 * ghi nhãn là để người xem tưởng cả ba dự án đều đã phát hành thật.
 *
 * Số nhà đầu tư đang giữ lấy từ `MOCK_WIND_STATS` — dữ liệu mẫu, có nhãn: đếm chủ sở hữu thật
 * cần chỉ mục sự kiện Transfer, chưa có ở giai đoạn này.
 */
export function TokenListBox() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wind className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Token dự án điện gió
        </CardTitle>
      </CardHeader>

      <CardContent className="divide-y divide-border p-0">
        {MOCK_PROJECTS.map((project) => (
          <Link
            key={project.id}
            href={`/tokens/${project.tokenSymbol}`}
            className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {project.tokenSymbol}
                </span>
                {project.onChain ? (
                  <OnChainBadge />
                ) : (
                  <MockBadge title="Dự án chưa triển khai token trên chuỗi" />
                )}
              </div>
              <div className="truncate text-sm text-muted-foreground">{project.name}</div>
              <div className="text-xs text-muted-foreground">
                {REGION_LABELS[project.region]} · {PROJECT_STATUS_LABELS[project.status]}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {project.onChain
                    ? MOCK_WIND_STATS.whitelistedInvestors.toLocaleString('vi-VN')
                    : '—'}
                </span>
                {project.onChain && <MockBadge title="Số nhà đầu tư nắm giữ — số liệu minh hoạ" />}
              </div>
              <div className="text-xs text-muted-foreground">nhà đầu tư nắm giữ</div>
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
