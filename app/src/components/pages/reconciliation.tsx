"use client";

import { useState } from "react";
import { Clock, Gauge, Link2, RefreshCw, Scale, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_PROJECTS, MOCK_WIND_STATS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * Đối soát **doanh thu điện**: sản lượng SCADA ↔ hoá đơn EVN ↔ số liệu on-chain.
 *
 * Ba nguồn phải khớp trước khi chia lợi tức: SCADA là số đo tại nhà máy, EVN là số
 * được mua thật (cơ sở để thu tiền), on-chain là số đã chốt qua EnergyOracle. Lệch giữa
 * ba nguồn nghĩa là kỳ chia lợi tức chưa đáng tin.
 *
 * Trước đây trang này lọc theo các loại tài sản của console cũ và dùng class màu xám
 * cố định. Nay lọc theo dự án điện gió và dùng theme token.
 */

/** Nguồn số liệu tham gia đối soát — mỗi nguồn một icon riêng để phân biệt nhanh. */
const SOURCES = [
  { key: "SCADA", label: "SCADA nhà máy", desc: "Đồng hồ đo tại tổ máy", icon: Gauge },
  { key: "EVN", label: "Hoá đơn EVN", desc: "Sản lượng được mua theo PPA", icon: ReceiptText },
  { key: "ONCHAIN", label: "On-chain", desc: "EnergyOracle đã chốt kỳ", icon: Link2 },
] as const;

type ProjectFilter = "ALL" | string;

const GRID = "grid-cols-[1.2fr_1.8fr_1.2fr_1.2fr_1.2fr_1fr_1.4fr]";

const nf = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function ReconciliationPage() {
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("ALL");

  // Chưa nối nguồn SCADA/EVN nên chưa có kỳ nào để đối soát (Phase 3).
  const periods: never[] = [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Đối soát doanh thu điện</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            So khớp sản lượng SCADA ↔ hoá đơn EVN ↔ số liệu on-chain theo từng kỳ, trước khi chia
            lợi tức cho nhà đầu tư.
          </p>
        </div>
        <Button variant="outline" className="shrink-0 gap-2">
          <RefreshCw className="h-4 w-4" />
          Làm mới dữ liệu
        </Button>
      </div>

      {/* Ba nguồn số liệu */}
      <div className="grid gap-4 md:grid-cols-3">
        {SOURCES.map((source) => (
          <SourceCard
            key={source.key}
            label={source.label}
            desc={source.desc}
            icon={<source.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          />
        ))}
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Kỳ đã đối soát khớp"
          value={String(MOCK_WIND_STATS.distributionPeriods)}
          sub="Đủ điều kiện chia lợi tức"
        />
        <KpiCard
          label="Sản lượng đã đối soát"
          value={`${nf(MOCK_WIND_STATS.cumulativeGenerationMwh)} MWh`}
          sub="Luỹ kế toàn danh mục"
        />
        <KpiCard
          label="Kỳ lệch chờ xử lý"
          value={String(MOCK_WIND_STATS.pendingReconciliations)}
          sub={
            MOCK_WIND_STATS.pendingReconciliations === 0
              ? "Không có kỳ nào lệch"
              : "Cần rà soát trước khi chia"
          }
          warn={MOCK_WIND_STATS.pendingReconciliations > 0}
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {/* Lọc theo dự án */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Dự án:</span>
          <FilterBtn
            active={projectFilter === "ALL"}
            onClick={() => setProjectFilter("ALL")}
            label="Tất cả"
          />
          {MOCK_PROJECTS.map((project) => (
            <FilterBtn
              key={project.id}
              active={projectFilter === project.id}
              onClick={() => setProjectFilter(project.id)}
              label={project.name}
            />
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{periods.length} kỳ</span>
        </div>

        <div
          className={cn(
            "grid gap-4 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
            GRID,
          )}
        >
          <span>Kỳ</span>
          <span>Dự án</span>
          <span className="text-right">SCADA (MWh)</span>
          <span className="text-right">EVN (MWh)</span>
          <span className="text-right">On-chain (MWh)</span>
          <span className="text-right">Lệch</span>
          <span>Kết quả</span>
        </div>

        {/* Trạng thái rỗng */}
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <Scale className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chưa có kỳ nào để đối soát.</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Bảng này cần dữ liệu từ SCADA và hoá đơn EVN. Hai nguồn đó nối ở Phase 3, cùng lúc với
            EnergyOracle và chia lợi tức.
          </p>
        </div>

        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Hiển thị 0–0 / 0 kỳ đối soát
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  label,
  desc,
  icon,
}: {
  label: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Chờ nối ở Phase 3
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", warn ? "border-accent/50" : "border-border")}>
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-2xl font-bold tracking-tight",
          warn ? "text-accent" : "text-foreground",
        )}
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
