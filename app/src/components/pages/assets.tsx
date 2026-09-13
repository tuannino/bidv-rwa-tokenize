"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Gauge, Plus, RefreshCw, Wind, Zap } from "lucide-react";
import { explorerTxUrl } from "@bidv/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const GRID = "grid-cols-[2.2fr_1.4fr_1fr_1.2fr_1.3fr_1.2fr_1.3fr_1.4fr]";

const nf = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dự án điện gió đã token hoá</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi dự án phát hành WPT (quyền hưởng lợi tức). Sản lượng lấy từ EnergyOracle, lợi tức
            chia qua ProfitDistributor.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" title="Làm mới">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
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
        </div>
      </div>

      {/* Số liệu tổng quan danh mục */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Wind className="h-4 w-4" />}
          label="Dự án điện gió"
          value={String(MOCK_WIND_STATS.projects)}
          sub={`${MOCK_PROJECTS.reduce((sum, p) => sum + p.turbines, 0)} tổ máy`}
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Tổng công suất đặt"
          value={`${nf(MOCK_WIND_STATS.totalCapacityMw, 1)} MW`}
          sub="Theo hợp đồng PPA với EVN"
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="WPT đã phát hành"
          value={nf(MOCK_WIND_STATS.wptIssued)}
          sub={`${nf(MOCK_WIND_STATS.whitelistedInvestors)} nhà đầu tư đã whitelist`}
          accent
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Sản lượng luỹ kế"
          value={`${nf(MOCK_WIND_STATS.cumulativeGenerationMwh)} MWh`}
          sub={`Lợi tức đã chia: ${nf(MOCK_WIND_STATS.profitDistributedVndBn, 1)} tỷ VND`}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {/* Bộ lọc */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
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
          <div className="flex items-center gap-2 text-sm">
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

        <div
          className={cn(
            "grid gap-4 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
            GRID,
          )}
        >
          <span>Mã &amp; Tên dự án</span>
          <span>Vùng</span>
          <span className="text-right">Công suất</span>
          <span className="text-right">WPT phát hành</span>
          <span className="text-right">Sản lượng luỹ kế</span>
          <span>Trạng thái</span>
          <span>Vận hành từ</span>
          <span>TX Hash</span>
        </div>

        {filtered.map((project) => (
          <ProjectRow key={project.id} project={project} />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Wind className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Không có dự án nào khớp bộ lọc</p>
            <p className="text-xs text-muted-foreground">Thử bỏ lọc vùng hoặc trạng thái</p>
          </div>
        )}

        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Hiển thị {filtered.length ? 1 : 0}–{filtered.length} / {MOCK_PROJECTS.length} dự án
        </div>
      </div>
    </div>
  );
}

const REGION_HINTS: Record<ProjectRegion, string> = {
  ONSHORE_HIGHLAND: "Gia Lai · Quảng Trị · Đắk Lắk — gió mùa ổn định",
  ONSHORE_COASTAL: "Ninh Thuận · Bình Thuận — hệ số công suất cao",
  NEARSHORE: "Bạc Liêu · Trà Vinh — móng trụ trong bãi bồi",
};

function ProjectRow({ project }: { project: WindProject }) {
  return (
    <div
      className={cn(
        "grid gap-4 border-b border-border/50 px-4 py-3.5 text-sm transition-colors hover:bg-muted/30",
        GRID,
      )}
    >
      <div>
        <div className="font-mono text-xs text-muted-foreground">{project.code}</div>
        <div className="mt-0.5 font-medium text-foreground">{project.name}</div>
        <div className="text-xs text-muted-foreground">{project.location}</div>
      </div>

      <div className="flex items-start pt-0.5">
        <span
          className="rounded px-2 py-0.5 text-xs font-medium"
          style={{
            color: REGION_CHART_VAR[project.region],
            backgroundColor: `color-mix(in oklab, ${REGION_CHART_VAR[project.region]} 14%, transparent)`,
          }}
        >
          {REGION_LABELS[project.region]}
        </span>
      </div>

      <div className="text-right font-mono text-foreground">
        {nf(project.capacityMw, 1)} <span className="text-xs text-muted-foreground">MW</span>
        <div className="text-xs text-muted-foreground">{project.turbines} tổ máy</div>
      </div>

      <div className="text-right font-mono text-foreground">
        {nf(project.wptIssued)} <span className="text-xs text-muted-foreground">WPT</span>
      </div>

      <div className="text-right font-mono text-foreground">
        {nf(project.generationMwh)} <span className="text-xs text-muted-foreground">MWh</span>
        <div className="text-xs text-muted-foreground">
          CF {nf(project.capacityFactorPct, 1)}% · {nf(project.ppaPricePerKwh)} đ/kWh
        </div>
      </div>

      <div className="flex items-start pt-0.5">
        <span className="flex items-center gap-1.5 text-xs text-foreground/90">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[project.status])} />
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        <div>{project.commissionedAt}</div>
        <div className="font-mono">{project.operatorAddress}</div>
      </div>

      <div className="flex items-start pt-0.5">
        <TxLink txHash={project.txHash} />
      </div>
    </div>
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
        className="font-mono text-xs text-muted-foreground"
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
      className="flex items-center gap-1 font-mono text-xs text-primary transition-colors hover:underline"
    >
      {txHash}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        accent ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={accent ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      </div>
      <div
        className={cn("font-mono text-2xl font-bold", accent ? "text-primary" : "text-foreground")}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1 text-xs transition-colors",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
