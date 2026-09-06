"use client";

import { useState } from "react";
import { RefreshCw, Plus, ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { explorerTxUrl } from "@bidv/shared";
import { MOCK_ASSETS, MOCK_STATS, type Asset, type AssetType, type AssetStatus } from "@/lib/mock-data";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<AssetType, string> = {
  GOLD: "Vàng",
  REAL_ESTATE: "Bất động sản",
  CARBON: "Carbon",
};

const TYPE_COLORS: Record<AssetType, string> = {
  GOLD: "bg-yellow-600",
  REAL_ESTATE: "bg-blue-600",
  CARBON: "bg-green-700",
};

const TOKEN_SYMBOLS: Record<AssetType, string> = {
  GOLD: "BGT",
  REAL_ESTATE: "BRT",
  CARBON: "BCT",
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  TRADING: "Đang giao dịch",
  PROCESSING: "Đang xử lý",
  PAUSED: "Tạm dừng",
};

type FilterType = "ALL" | AssetType;
type FilterStatus = "ALL" | AssetStatus;

export function AssetsPage() {
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  const filtered = MOCK_ASSETS.filter((a) => {
    if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Niêm yết tài sản số</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Module E · Danh sách tài sản đã được tạo on-chain qua AssetRegistry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors">
              <Plus className="h-4 w-4" />
              Tạo niêm yết mới
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-card border-border">
              <div className="px-3 py-2 text-xs text-muted-foreground uppercase tracking-wide">
                Chọn loại tài sản
              </div>
              <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted">
                <span className="mt-0.5 text-xs px-1.5 py-0.5 rounded font-mono text-white bg-yellow-600">AU</span>
                <div>
                  <div className="text-sm text-foreground font-medium">Vàng (BGT)</div>
                  <div className="text-xs text-muted-foreground">SJC · DOJI · PNJ — backed 100% vật chất</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted">
                <span className="mt-0.5 text-xs px-1.5 py-0.5 rounded font-mono text-white bg-blue-600">BDS</span>
                <div>
                  <div className="text-sm text-foreground font-medium">Bất động sản (BRT)</div>
                  <div className="text-xs text-muted-foreground">Căn hộ · Văn phòng · Retail — qua SPV</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted">
                <span className="mt-0.5 text-xs px-1.5 py-0.5 rounded font-mono text-white bg-green-700">CO₂</span>
                <div>
                  <div className="text-sm text-foreground font-medium">Carbon Credit (BCT)</div>
                  <div className="text-xs text-muted-foreground">VCS · Gold Standard — 1 BCT = 1tCO₂e</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Tổng niêm yết" value="3" sub="3 active · 0 pending" />
        <StatCard label="Vàng (BGT)" value={`${MOCK_STATS.gold.count} lô`} sub={MOCK_STATS.gold.detail} color="yellow" />
        <StatCard label="BĐS (BRT)" value={`${MOCK_STATS.realEstate.count} dự án`} sub={MOCK_STATS.realEstate.detail} color="blue" />
        <StatCard label="Carbon (BCT)" value={`${MOCK_STATS.carbon.count} đợt`} sub={MOCK_STATS.carbon.detail} color="green" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        {/* Filters */}
        <div className="flex items-center gap-6 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Loại:</span>
            {(["ALL", "GOLD", "REAL_ESTATE", "CARBON"] as FilterType[]).map((t) => (
              <FilterBtn
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                label={t === "ALL" ? "Tất cả" : TYPE_LABELS[t as AssetType]}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Trạng thái:</span>
            {(["ALL", "TRADING", "PROCESSING"] as FilterStatus[]).map((s) => (
              <FilterBtn
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                label={s === "ALL" ? "Tất cả" : STATUS_LABELS[s as AssetStatus]}
              />
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} kết quả</span>
        </div>

        {/* Table head */}
        <div className="grid grid-cols-[2fr_1fr_1.5fr_2fr_1.5fr_1fr_1.5fr_1.5fr] gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
          <span>Mã & Tên tài sản</span>
          <span>Loại</span>
          <span>Tổng phát hành</span>
          <span>Backing thực</span>
          <span>Giá hiện tại</span>
          <span>Trạng thái</span>
          <span>Niêm yết</span>
          <span>TX Hash</span>
        </div>

        {/* Rows */}
        {filtered.map((asset) => (
          <AssetRow key={asset.id} asset={asset} />
        ))}

        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Không có tài sản nào phù hợp
          </div>
        )}

        <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
          Hiển thị 1–{filtered.length} / {MOCK_ASSETS.length} kết quả
        </div>
      </div>
    </div>
  );
}

function AssetRow({ asset }: { asset: Asset }) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1.5fr_2fr_1.5fr_1fr_1.5fr_1.5fr] gap-4 px-4 py-3.5 text-sm border-b border-border/50 hover:bg-muted/30 transition-colors">
      <div>
        <div className="text-xs text-muted-foreground font-mono">{asset.code}</div>
        <div className="font-medium text-white mt-0.5">{asset.name}</div>
      </div>
      <div className="flex items-start pt-0.5">
        <span className={cn("text-xs px-2 py-0.5 rounded text-white font-medium", TYPE_COLORS[asset.type])}>
          {TYPE_LABELS[asset.type]}
        </span>
      </div>
      <div className="font-mono text-sm text-foreground/90">
        {asset.totalSupply.toLocaleString("vi-VN")}{" "}
        <span className="text-muted-foreground">{TOKEN_SYMBOLS[asset.type]}</span>
      </div>
      <div className="text-foreground/70 text-xs leading-relaxed">{asset.backingAmount}</div>
      <div className="font-mono text-foreground/90">
        {asset.currentPrice}{" "}
        <span className="text-xs text-muted-foreground">{asset.priceUnit}</span>
      </div>
      <div>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {STATUS_LABELS[asset.status]}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        <div>{asset.listedAt}</div>
        <div className="text-muted-foreground font-mono">{asset.adminAddress}</div>
      </div>
      <div>
        <TxLink txHash={asset.txHash} />
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
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color?: "yellow" | "blue" | "green";
}) {
  const borderMap = { yellow: "border-yellow-900/50", blue: "border-blue-900/50", green: "border-green-900/50" };
  return (
    <div className={cn("rounded-lg border bg-card p-4", color ? borderMap[color] : "border-border")}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-md text-xs transition-colors",
        active ? "bg-zinc-700 text-white" : "text-muted-foreground hover:text-foreground/90"
      )}
    >
      {label}
    </button>
  );
}
