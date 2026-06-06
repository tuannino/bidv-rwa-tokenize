"use client";

import { TrendingUp, Coins, ArrowLeftRight, Clock, Plus } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { MOCK_CHART_DATA, MOCK_STATS } from "@/lib/mock-data";
import Link from "next/link";

export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tổng quan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            BIDV RWA Admin Console · PoC v2.0 · Cập nhật{" "}
            {new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
            {new Date().toLocaleDateString("vi-VN")}
          </p>
        </div>
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tạo niêm yết mới
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Tài sản đang niêm yết"
          value={String(MOCK_STATS.totalAssets)}
          sub="+0 trong 7 ngày"
          icon={<Coins className="h-4 w-4" />}
        />
        <KpiCard
          label="Tổng giá trị on-chain"
          value={MOCK_STATS.totalValueVnd}
          sub="VND · Quy đổi theo giá Oracle"
          icon={<TrendingUp className="h-4 w-4" />}
          highlight
        />
        <KpiCard
          label="Giao dịch hôm nay"
          value={String(MOCK_STATS.todayTransactions)}
          sub="— so với hôm qua"
          icon={<ArrowLeftRight className="h-4 w-4" />}
        />
        <KpiCard
          label="Batch chưa đối soát"
          value={String(MOCK_STATS.pendingBatches)}
          sub="Không có batch tồn đọng"
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Chart + Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="col-span-2 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Giá trị on-chain theo ngày</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">7 ngày qua</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MOCK_CHART_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ca8a04" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ca8a04" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} unit=" tỷ" width={55} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                labelStyle={{ color: "#e4e4e7" }}
                itemStyle={{ color: "#a1a1aa" }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
              <Area type="monotone" dataKey="realEstate" name="Bất động sản" stroke="#2563eb" fill="url(#reGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="gold" name="Vàng" stroke="#ca8a04" fill="url(#goldGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="carbon" name="Carbon" stroke="#16a34a" fill="url(#carbonGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Asset breakdown */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">Phân bổ theo loại tài sản</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">7 ngày qua</span>
          </div>
          <div className="space-y-4">
            <AssetBar label="Bất động sản" tag="BDS" value={194.3} total={295.3} color="bg-blue-600" pct="65,8%" />
            <AssetBar label="Vàng" tag="V" value={95} total={295.3} color="bg-yellow-600" pct="32,2%" />
            <AssetBar label="Carbon" tag="CO₂" value={6} total={295.3} color="bg-green-600" pct="2%" />
          </div>
        </div>
      </div>

      {/* Asset type summary */}
      <div className="grid grid-cols-3 gap-4">
        <AssetTypeCard
          tag="BGT"
          label="Vàng"
          tagColor="bg-yellow-600"
          count={MOCK_STATS.gold.label}
          detail={MOCK_STATS.gold.detail}
        />
        <AssetTypeCard
          tag="BRT"
          label="Bất động sản"
          tagColor="bg-blue-600"
          count={MOCK_STATS.realEstate.label}
          detail={MOCK_STATS.realEstate.detail}
        />
        <AssetTypeCard
          tag="BCT"
          label="Carbon Credit"
          tagColor="bg-green-600"
          count={MOCK_STATS.carbon.label}
          detail={MOCK_STATS.carbon.detail}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, highlight,
}: {
  label: string; value: string; sub: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-green-800 bg-green-950/30" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${highlight ? "text-green-400" : "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function AssetBar({
  label, tag, value, total, color, pct,
}: {
  label: string; tag: string; value: number; total: number; color: string; pct: string;
}) {
  const width = Math.round((value / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono text-white ${color}`}>{tag}</span>
          <span className="text-foreground/90">{label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{value} tỷ</span>
          <span className="font-mono text-foreground/70">{pct}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function AssetTypeCard({
  tag, label, tagColor, count, detail,
}: {
  tag: string; label: string; tagColor: string; count: string; detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded font-mono text-white ${tagColor}`}>{tag}</span>
        <span className="text-sm text-foreground/90">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{count}</div>
      <div className="text-xs text-muted-foreground mt-1">{detail}</div>
    </div>
  );
}
