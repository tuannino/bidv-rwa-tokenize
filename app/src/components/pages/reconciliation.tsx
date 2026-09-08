"use client";

import { RefreshCw, InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

type AssetFilter = "ALL" | "GOLD" | "REAL_ESTATE" | "CARBON";

const FILTER_LABELS: Record<AssetFilter, string> = {
  ALL: "Tất cả",
  GOLD: "Vàng",
  REAL_ESTATE: "BĐS",
  CARBON: "Carbon",
};

export function ReconciliationPage() {
  const [filter, setFilter] = useState<AssetFilter>("ALL");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Đối soát batch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Module B · So sánh giao dịch on-chain với hệ thống Core Banking BIDV theo ngày & theo loại tài sản
          </p>
        </div>
        <Button variant="outline" className="border-zinc-700 text-foreground/90 gap-2 hover:bg-muted">
          <RefreshCw className="h-4 w-4" />
          Làm mới dữ liệu
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Tổng giao dịch" value="0" sub="0 batch · 2026-01-01 → 2026-12-31" />
        <KpiCard label="Tổng giá trị VND" value="0 đ" sub="2026-01-01 → 2026-12-31" />
        <KpiCard label="Đang xử lý" value="0" sub="Chưa hoàn tất đối soát" warn />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {/* Filter */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border text-sm">
          <span className="text-muted-foreground">Loại tài sản:</span>
          {(Object.keys(FILTER_LABELS) as AssetFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-md text-xs transition-colors",
                filter === f ? "bg-zinc-700 text-white" : "text-muted-foreground hover:text-foreground/90"
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">0 batch</span>
        </div>

        {/* Table head */}
        <div className="grid grid-cols-7 gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
          <span>Ngày batch</span>
          <span>Loại tài sản</span>
          <span>Số GD</span>
          <span>Mint</span>
          <span>Burn</span>
          <span>Transfer</span>
          <span>Tổng VND</span>
        </div>

        {/* Empty */}
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <InboxIcon className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-muted-foreground">No data</p>
          <p className="text-xs text-zinc-700">Dữ liệu đối soát sẽ xuất hiện khi có giao dịch on-chain</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", warn ? "border-yellow-900/50" : "border-border")}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={cn("text-3xl font-bold", warn ? "text-yellow-500" : "text-white")}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
