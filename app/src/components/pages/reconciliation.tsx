"use client";

import { useState } from "react";
import { Clock, Gauge, Link2, RefreshCw, Scale, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitleIcon } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Kpi } from "@/components/ui/kpi";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MOCK_PROJECTS, MOCK_WIND_STATS } from "@/lib/mock-data";
import { HoverHint } from "@/components/layout/hover-hint";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { FilterBtn } from "@/components/ops/filter-button";

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

/** Bảng sát mép thẻ (`Card` không đệm): ô đầu và cuối cách mép như thanh lọc. */
const TABLE_EDGE = "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4";

const nf = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function ReconciliationPage() {
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("ALL");

  // Chưa nối nguồn SCADA/EVN nên chưa có kỳ nào để đối soát (Phase 3).
  const periods: never[] = [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <HoverHint hint="So khớp sản lượng điện, hoá đơn và số liệu trên chuỗi theo từng kỳ." side="bottom">
            <h1 className="text-2xl font-semibold tracking-tight">Đối soát doanh thu điện</h1>
          </HoverHint>
          <SampleDataNote />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* QĐ-5: chưa có hành động, khoá kèm chú thích. */}
          <Button variant="outline" className="gap-2" disabled aria-describedby="reconciliation-poc-note">
            <RefreshCw className="h-4 w-4" />
            Làm mới dữ liệu
          </Button>
          <span id="reconciliation-poc-note" className="text-xs text-muted-foreground">
            Chưa hỗ trợ trong PoC
          </span>
        </div>
      </div>

      {/* Ba nguồn số liệu */}
      <div className="grid gap-4 min-[640px]:grid-cols-3">
        {SOURCES.map((source) => (
          <SourceCard
            key={source.key}
            label={source.label}
            desc={source.desc}
            icon={<source.icon className="h-4 w-4" aria-hidden="true" />}
          />
        ))}
      </div>

      {/* KPI */}
      <div className="grid gap-4 min-[640px]:grid-cols-3">
        <Kpi
          tone="hl"
          label="Kỳ đã đối soát khớp"
          value={String(MOCK_WIND_STATS.distributionPeriods)}
          sub="Đủ điều kiện chia lợi tức"
        />
        <Kpi
          label="Sản lượng đã đối soát"
          value={nf(MOCK_WIND_STATS.cumulativeGenerationMwh)}
          unit="MWh"
          sub="Luỹ kế toàn danh mục"
        />
        <Kpi
          tone={MOCK_WIND_STATS.pendingReconciliations > 0 ? "gold" : "default"}
          label="Kỳ lệch chờ xử lý"
          value={String(MOCK_WIND_STATS.pendingReconciliations)}
          sub={
            MOCK_WIND_STATS.pendingReconciliations === 0
              ? "Không có kỳ nào lệch"
              : "Cần rà soát trước khi chia"
          }
        />
      </div>

      <Card className="gap-0 py-0">
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

        <Table className={TABLE_EDGE}>
          <TableHeader>
            <TableRow>
              <TableHead>Kỳ</TableHead>
              <TableHead>Dự án</TableHead>
              <TableHead className="text-right">SCADA (MWh)</TableHead>
              <TableHead className="text-right">EVN (MWh)</TableHead>
              <TableHead className="text-right">On-chain (MWh)</TableHead>
              <TableHead className="text-right">Lệch</TableHead>
              <TableHead>Kết quả</TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        {/* Trạng thái rỗng */}
        <div className="p-4">
          <EmptyState icon={<Scale />}>
            <p>Chưa có kỳ nào để đối soát.</p>
            <p className="mx-auto mt-1 max-w-md text-xs">
              Bảng này cần dữ liệu từ SCADA và hoá đơn EVN. Hai nguồn đó nối ở Phase 3, cùng lúc với
              EnergyOracle và chia lợi tức.
            </p>
          </EmptyState>
        </div>

        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Hiển thị 0–0 / 0 kỳ đối soát
        </div>
      </Card>
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
    <Card className="flex-row items-start gap-3 px-4">
      <CardTitleIcon>{icon}</CardTitleIcon>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
        <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Chờ nối ở Phase 3
        </div>
      </div>
    </Card>
  );
}
