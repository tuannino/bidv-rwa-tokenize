"use client";

import { useState } from "react";
import { Search, RefreshCw, InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type KycLevel = "ALL" | "LEVEL1" | "LEVEL2" | "VIP";
type KycStatus = "ALL" | "ACTIVE" | "PENDING" | "FROZEN";

const LEVEL_LABELS: Record<KycLevel, string> = { ALL: "Tất cả", LEVEL1: "Level 1", LEVEL2: "Level 2", VIP: "VIP" };
const STATUS_LABELS: Record<KycStatus, string> = { ALL: "Tất cả", ACTIVE: "Hoạt động", PENDING: "Chờ duyệt", FROZEN: "Đóng băng" };

export function KycPage() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<KycLevel>("ALL");
  const [status, setStatus] = useState<KycStatus>("ALL");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quản lý KYC nhà đầu tư</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Module A · Duyệt KYC, freeze/unfreeze ví, quản lý whitelist
          </p>
        </div>
        <button className="text-muted-foreground hover:text-white transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Tổng nhà đầu tư" value="0" sub="Từ 01/01/2026" />
        <KpiCard label="KYC Level 2+" value="0" sub="Giao dịch không giới hạn" />
        <KpiCard label="Chờ duyệt" value="0" sub="Cần xử lý trong 24h" warn />
        <KpiCard label="Đóng băng" value="0" sub="Tạm dừng on-chain" danger />
      </div>

      {/* Filters + Search */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 space-y-3 border-b border-border">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, ID, SĐT..."
              className="w-full rounded-md border border-zinc-700 bg-muted pl-9 pr-4 py-2 text-sm text-foreground/95 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          {/* KYC Level filter */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">KYC:</span>
            {(Object.keys(LEVEL_LABELS) as KycLevel[]).map((l) => (
              <FilterBtn key={l} active={level === l} onClick={() => setLevel(l)} label={LEVEL_LABELS[l]} />
            ))}
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">Trạng thái:</span>
            {(Object.keys(STATUS_LABELS) as KycStatus[]).map((s) => (
              <FilterBtn key={s} active={status === s} onClick={() => setStatus(s)} label={STATUS_LABELS[s]} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">0 kết quả</p>
        </div>

        {/* Table head */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_2fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
          <span>Nhà đầu tư</span>
          <span>CCCD</span>
          <span>Cấp KYC</span>
          <span>Khẩu vị RR</span>
          <span>Địa chỉ ví</span>
          <span>Danh mục</span>
          <span>Trạng thái</span>
          <span>Đăng ký</span>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <InboxIcon className="h-10 w-10 text-zinc-700" />
          <p className="text-sm text-muted-foreground">Không có dữ liệu KYC.</p>
          <p className="text-xs text-zinc-700">Dữ liệu nhà đầu tư sẽ xuất hiện khi Phase 2 được tích hợp</p>
        </div>

        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Hiển thị 0–0 / 0 nhà đầu tư</span>
          <div className="flex gap-2">
            <button disabled className="px-3 py-1 rounded border border-border text-zinc-700 cursor-not-allowed">Trang trước</button>
            <button disabled className="px-3 py-1 rounded border border-border text-zinc-700 cursor-not-allowed">Trang sau</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, warn, danger }: { label: string; value: string; sub: string; warn?: boolean; danger?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", danger ? "border-red-900/50" : warn ? "border-yellow-900/50" : "border-border")}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={cn("text-3xl font-bold", danger ? "text-red-400" : warn ? "text-yellow-500" : "text-white")}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn("px-3 py-1 rounded-md text-xs transition-colors", active ? "bg-zinc-700 text-white" : "text-muted-foreground hover:text-foreground/90")}
    >
      {label}
    </button>
  );
}
