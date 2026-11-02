'use client';

import Link from 'next/link';
import { ChevronRight, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UnverifiedNote } from '@/components/ui/unverified-note';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import {
  MOCK_PROJECTS,
  MOCK_WIND_STATS,
  PROJECT_STATUS_LABELS,
  REGION_LABELS,
} from '@/lib/mock-data';
import { OnChainBadge } from './mock-badge';
import { projectNameView } from './token-summary-state';
import { useTokenSummary } from './use-token-summary';

/**
 * Hộp 4: DANH SÁCH TOKEN đang được token hoá.
 *
 * Danh sách dòng lấy từ `MOCK_PROJECTS`. Hệ thống hiện chỉ triển khai MỘT token trên chuỗi
 * (dòng `onChain`): tên dự án của dòng này đọc từ bảng dự án qua `getTokenSummaryAction` (dùng
 * chung một lời gọi với hộp Trạng thái phát hành, FIX-04 F2); đang tải hoặc đọc lỗi thì hiện tên
 * mẫu kèm ghi chú "unverified". Hai dòng còn lại là dự án mẫu chưa lên chuỗi.
 *
 * Chưa có nguồn thật nên giữ số mẫu kèm "unverified": vùng, trạng thái vận hành của mọi dòng, số
 * nhà đầu tư nắm giữ (`MOCK_WIND_STATS`; đếm thật cần chỉ mục sự kiện, FIX-04 mục 1 tách ra sau).
 */
export function TokenListBox() {
  const { chain } = useSelectedChain();
  const { fresh } = useTokenSummary(chain);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <Wind className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Token dự án điện gió
        </CardTitle>
      </CardHeader>

      <CardContent className="divide-y divide-border p-0">
        {MOCK_PROJECTS.map((project) => (
          <Link prefetch={false}
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
                  <UnverifiedNote title="Dự án chưa triển khai token trên chuỗi" />
                )}
              </div>
              <ProjectName name={project.name} onChain={project.onChain} view={projectNameView(fresh, project.name)} />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {REGION_LABELS[project.region]} · {PROJECT_STATUS_LABELS[project.status]}
                <UnverifiedNote />
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {project.onChain
                    ? MOCK_WIND_STATS.whitelistedInvestors.toLocaleString('vi-VN')
                    : '—'}
                </span>
                {project.onChain && <UnverifiedNote title="Chưa đếm được người nắm giữ thật" />}
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

/** Dòng đã lên chuỗi: tên thật khi đọc được, còn lại tên mẫu kèm ghi chú. Dòng mẫu: tên mẫu. */
function ProjectName({
  name,
  onChain,
  view,
}: {
  name: string;
  onChain: boolean;
  view: { text: string; unverified: boolean };
}) {
  if (!onChain) return <div className="truncate text-sm text-muted-foreground">{name}</div>;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      <span className="truncate">{view.text}</span>
      {view.unverified && <UnverifiedNote title="Tên mẫu, chưa đọc được tên dự án trong hệ thống" />}
    </div>
  );
}
