"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Gauge, Plus, RefreshCw, Wind, Zap } from "lucide-react";
import { explorerTxUrl } from "@bidv/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Kpi } from "@/components/ui/kpi";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MOCK_PROJECTS,
  MOCK_WIND_STATS,
  PROJECT_STATUS_LABELS,
  REGION_LABELS,
  type ProjectRegion,
  type ProjectStatus,
  type WindProject,
} from "@/lib/mock-data";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { cn } from "@/lib/utils";
import { HoverHint } from "@/components/layout/hover-hint";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { FilterBtn } from "@/components/ops/filter-button";

/**
 * Danh mục **dự án điện gió** đã token hoá.
 *
 * Mọi màu đi qua theme token (`var(--chart-*)`, `border-border`, `text-foreground`...)
 * để đọc được ở cả light và dark — xem `.kiro/steering/frontend.md`.
 */

/** Màu badge theo vùng, lấy từ bảng chart token (green · teal · sky). */
const REGION_CHART_VAR: Record<ProjectRegion, string> = {
  ONSHORE_HIGHLAND: "var(--chart-1)",
  ONSHORE_COASTAL: "var(--chart-5)",
  NEARSHORE: "var(--chart-3)",
};

const STATUS_DOT: Record<ProjectStatus, string> = {
  OPERATING: "bg-primary",
  COMMISSIONING: "bg-accent",
  MAINTENANCE: "bg-muted-foreground",
};

const nf = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Bảng sát mép thẻ (`Card` không đệm): ô đầu và cuối cách mép như thanh lọc. */
const TABLE_EDGE = "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4";

type FilterRegion = "ALL" | ProjectRegion;
type FilterStatus = "ALL" | ProjectStatus;

export function AssetsPage() {
  const [regionFilter, setRegionFilter] = useState<FilterRegion>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  const filtered = MOCK_PROJECTS.filter((project) => {
    if (regionFilter !== "ALL" && project.region !== regionFilter) return false;
    if (statusFilter !== "ALL" && project.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <HoverHint hint="Xem danh sách dự án điện gió đã token hoá." side="bottom">
            <h1 className="text-2xl font-semibold tracking-tight">Dự án điện gió đã token hoá</h1>
          </HoverHint>
          <SampleDataNote />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* QĐ-5: chưa có hành động, khoá kèm chú thích. */}
          <Button
            variant="ghost"
            size="icon"
            title="Làm mới"
            aria-label="Làm mới"
            disabled
            aria-describedby="assets-poc-note"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants()} disabled aria-describedby="assets-poc-note">
              <Plus className="h-4 w-4" />
              Thêm dự án
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 border-border bg-card">
              <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                Chọn loại dự án điện gió
              </div>
              {(Object.keys(REGION_LABELS) as ProjectRegion[]).map((region) => (
                <DropdownMenuItem
                  key={region}
                  className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted"
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 items-center justify-center rounded"
                    style={{ backgroundColor: `color-mix(in oklab, ${REGION_CHART_VAR[region]} 18%, transparent)` }}
                  >
                    <Wind className="h-3.5 w-3.5" style={{ color: REGION_CHART_VAR[region] }} />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{REGION_LABELS[region]}</div>
                    <div className="text-xs text-muted-foreground">{REGION_HINTS[region]}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span id="assets-poc-note" className="text-xs text-muted-foreground">
            Chưa hỗ trợ trong PoC
          </span>
        </div>
      </div>

      {/* Số liệu tổng quan danh mục */}
      <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
        <Kpi
          icon={<Wind />}
          label="Dự án điện gió"
          value={String(MOCK_WIND_STATS.projects)}
          sub={`${MOCK_PROJECTS.reduce((sum, p) => sum + p.turbines, 0)} tổ máy`}
        />
        <Kpi
          icon={<Zap />}
          label="Tổng công suất đặt"
          value={nf(MOCK_WIND_STATS.totalCapacityMw, 1)}
          unit="MW"
          sub="Theo hợp đồng PPA với EVN"
        />
        <Kpi
          tone="hl"
          icon={<Gauge />}
          label="WPT đã phát hành"
          value={nf(MOCK_WIND_STATS.wptIssued)}
          sub={`${nf(MOCK_WIND_STATS.whitelistedInvestors)} nhà đầu tư đã whitelist`}
        />
        <Kpi
          tone="leaf"
          icon={<Zap />}
          label="Sản lượng luỹ kế"
          value={nf(MOCK_WIND_STATS.cumulativeGenerationMwh)}
          unit="MWh"
          sub={`Lợi tức đã chia: ${nf(MOCK_WIND_STATS.profitDistributedVndBn, 1)} tỷ VND`}
        />
      </div>

      <Card className="gap-0 py-0">
        {/* Bộ lọc */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Vùng:</span>
            {(["ALL", ...Object.keys(REGION_LABELS)] as FilterRegion[]).map((region) => (
              <FilterBtn
                key={region}
                active={regionFilter === region}
                onClick={() => setRegionFilter(region)}
                label={region === "ALL" ? "Tất cả" : REGION_LABELS[region as ProjectRegion]}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Trạng thái:</span>
            {(["ALL", ...Object.keys(PROJECT_STATUS_LABELS)] as FilterStatus[]).map((status) => (
              <FilterBtn
                key={status}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                label={status === "ALL" ? "Tất cả" : PROJECT_STATUS_LABELS[status as ProjectStatus]}
              />
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} kết quả</span>
        </div>

        <Table className={TABLE_EDGE}>
          <TableHeader>
            <TableRow>
              <TableHead>Mã &amp; Tên dự án</TableHead>
              <TableHead>Vùng</TableHead>
              <TableHead className="text-right">Công suất</TableHead>
              <TableHead className="text-right">WPT phát hành</TableHead>
              <TableHead className="text-right">Sản lượng luỹ kế</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Vận hành từ</TableHead>
              <TableHead>TX Hash</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <div className="p-4">
            <EmptyState icon={<Wind />}>
              <p>Không có dự án nào khớp bộ lọc</p>
              <p className="mt-1 text-xs">Thử bỏ lọc vùng hoặc trạng thái</p>
            </EmptyState>
          </div>
        )}

        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Hiển thị {filtered.length ? 1 : 0}–{filtered.length} / {MOCK_PROJECTS.length} dự án
        </div>
      </Card>
    </div>
  );
}

const REGION_HINTS: Record<ProjectRegion, string> = {
  ONSHORE_HIGHLAND: "Gia Lai, Quảng Trị, Đắk Lắk: gió mùa ổn định",
  ONSHORE_COASTAL: "Ninh Thuận, Bình Thuận: hệ số công suất cao",
  NEARSHORE: "Bạc Liêu, Trà Vinh: móng trụ trong bãi bồi",
};

function ProjectRow({ project }: { project: WindProject }) {
  return (
    <TableRow>
      <TableCell className="min-w-56 align-top whitespace-normal">
        <div className="font-code text-xs text-muted-foreground">{project.code}</div>
        <div className="mt-0.5 font-medium text-foreground">{project.name}</div>
        <div className="text-xs text-muted-foreground">{project.location}</div>
      </TableCell>

      <TableCell className="align-top">
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{
            color: REGION_CHART_VAR[project.region],
            backgroundColor: `color-mix(in oklab, ${REGION_CHART_VAR[project.region]} 14%, transparent)`,
          }}
        >
          {REGION_LABELS[project.region]}
        </span>
      </TableCell>

      <TableCell className="align-top text-right tabular-nums text-foreground">
        {nf(project.capacityMw, 1)} <span className="text-xs text-muted-foreground">MW</span>
        <div className="text-xs text-muted-foreground">{project.turbines} tổ máy</div>
      </TableCell>

      <TableCell className="align-top text-right tabular-nums text-foreground">
        {nf(project.wptIssued)} <span className="text-xs text-muted-foreground">WPT</span>
      </TableCell>

      <TableCell className="align-top text-right tabular-nums text-foreground">
        {nf(project.generationMwh)} <span className="text-xs text-muted-foreground">MWh</span>
        <div className="text-xs text-muted-foreground">
          CF {nf(project.capacityFactorPct, 1)}%, {nf(project.ppaPricePerKwh)} đ/kWh
        </div>
      </TableCell>

      <TableCell className="align-top">
        <span className="flex items-center gap-1.5 text-xs text-foreground/90">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[project.status])} />
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </TableCell>

      <TableCell className="align-top text-xs text-muted-foreground">
        <div>{project.commissionedAt}</div>
        <div className="font-code">{project.operatorAddress}</div>
      </TableCell>

      <TableCell className="align-top">
        <TxLink txHash={project.txHash} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Link tới explorer của **chain đang chọn**.
 *
 * Trước đây trỏ cứng vào explorer của một chain đã bị loại khỏi dự án (SPEC §1),
 * nên sai với mọi chain hiện tại. Chain cục bộ/mock không có explorer nào biết tới,
 * nên hiện hash dạng chữ kèm giải thích thay vì một link chắc chắn 404.
 */
function TxLink({ txHash }: { txHash: string }) {
  const { chain } = useSelectedChain();
  const url = explorerTxUrl(chain, txHash);

  if (!url) {
    return (
      <span
        className="font-code text-xs text-muted-foreground"
        title={`Chain "${chain}" không có block explorer công khai`}
      >
        {txHash}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 font-code text-xs text-primary transition-colors hover:underline"
    >
      {txHash}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
