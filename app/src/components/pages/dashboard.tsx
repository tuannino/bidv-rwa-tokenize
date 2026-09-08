"use client";

import Link from "next/link";
import { Banknote, Coins, Gauge, Plus, Users, Wind, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useIsMounted } from "@/lib/hooks/use-is-mounted";
import { MOCK_GENERATION_SERIES, MOCK_PROJECTS, MOCK_WIND_STATS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * Tổng quan danh mục **điện gió**.
 *
 * Màu của biểu đồ đi qua theme token (`var(--chart-*)`, `var(--border)`, `var(--card)`...)
 * nên đọc được ở cả light và dark. Trước đây grid và nền tooltip bị ghi cứng bằng hex
 * tối theo dark theme, làm biểu đồ gần như vô hình trên nền sáng.
 * (Recharts nhận `var()` trong presentation attribute — cùng cách shadcn/ui làm.)
 */

const nf = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Trục/nhãn dùng màu chữ phụ của theme, không phải hex cố định. */
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

export function DashboardPage() {
  const totalTurbines = MOCK_PROJECTS.reduce((sum, project) => sum + project.turbines, 0);
  const operating = MOCK_PROJECTS.filter((project) => project.status === "OPERATING").length;

  /**
   * Mốc "Cập nhật" CHỈ tính ở client, sau khi hydrate.
   *
   * Trước đây gọi `new Date()` thẳng trong thân component: trang `/` được prerender
   * tĩnh nên giá trị bị đóng băng vào HTML lúc BUILD (đo được: HTML chứa "20:19 7/9/2026"
   * trong khi giờ thật đã là 23:46 8/9/2026). Ngoài ra giờ ở server (container UTC) khác
   * giờ ở browser -> lệch nội dung khi hydrate.
   */
  const mounted = useIsMounted();
  const updatedAt = mounted
    ? `${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${new Date().toLocaleDateString("vi-VN")}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tổng quan điện gió</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Token hoá quyền hưởng lợi tức dự án điện gió · PoC
            {updatedAt && <> · Cập nhật {updatedAt}</>}
          </p>
        </div>
        <Link
          href="/mint"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Phát hành WPT
        </Link>
      </div>

      {/* KPI chính */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="WPT đã phát hành"
          value={nf(MOCK_WIND_STATS.wptIssued)}
          sub={`${MOCK_WIND_STATS.projects} dự án · ${totalTurbines} tổ máy`}
          icon={<Coins className="h-4 w-4" />}
          highlight
        />
        <KpiCard
          label="Nhà đầu tư whitelisted"
          value={nf(MOCK_WIND_STATS.whitelistedInvestors)}
          sub="Đã qua KYC, đủ điều kiện nắm giữ"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Sản lượng luỹ kế"
          value={`${nf(MOCK_WIND_STATS.cumulativeGenerationMwh)} MWh`}
          sub={`Nguồn: EnergyOracle · ${operating}/${MOCK_WIND_STATS.projects} dự án đang phát`}
          icon={<Zap className="h-4 w-4" />}
        />
        <KpiCard
          label="Lợi tức đã chia"
          value={`${nf(MOCK_WIND_STATS.profitDistributedVndBn, 1)} tỷ`}
          sub={`VND · ${MOCK_WIND_STATS.distributionPeriods} kỳ qua ProfitDistributor`}
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      {/* Biểu đồ + phân bổ */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Sản lượng &amp; lợi tức theo kỳ</h2>
            <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">6 kỳ gần nhất</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={MOCK_GENERATION_SERIES} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="generationGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="mwh"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={62}
                unit=" MWh"
              />
              <YAxis
                yAxisId="vnd"
                orientation="right"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={48}
                unit=" tỷ"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--popover-foreground)",
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
                itemStyle={{ color: "var(--muted-foreground)" }}
                formatter={(value, name) => {
                  // Hai series khác đơn vị (MWh vs tỷ VND) nên phải format riêng.
                  const amount = typeof value === "number" ? value : Number(value ?? 0);
                  return name === "Lợi tức đã chia"
                    ? [`${nf(amount, 1)} tỷ VND`, name]
                    : [`${nf(amount)} MWh`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
              <Area
                yAxisId="mwh"
                type="monotone"
                dataKey="generationMwh"
                name="Sản lượng"
                stroke="var(--chart-1)"
                fill="url(#generationGradient)"
                strokeWidth={2}
              />
              <Line
                yAxisId="vnd"
                type="monotone"
                dataKey="profitVndBn"
                name="Lợi tức đã chia"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--chart-2)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Phân bổ WPT theo dự án */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Phân bổ WPT theo dự án</h2>
            <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Tổng cung</span>
          </div>
          <div className="space-y-4">
            {MOCK_PROJECTS.map((project, index) => (
              <ProjectBar
                key={project.id}
                label={project.name}
                location={project.location}
                value={project.wptIssued}
                total={MOCK_WIND_STATS.wptIssued}
                colorVar={PROJECT_CHART_VARS[index % PROJECT_CHART_VARS.length]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Thẻ từng dự án */}
      <div className="grid gap-4 md:grid-cols-3">
        {MOCK_PROJECTS.map((project, index) => (
          <ProjectCard
            key={project.id}
            name={project.name}
            location={project.location}
            capacityMw={project.capacityMw}
            generationMwh={project.generationMwh}
            capacityFactorPct={project.capacityFactorPct}
            colorVar={PROJECT_CHART_VARS[index % PROJECT_CHART_VARS.length]}
          />
        ))}
      </div>
    </div>
  );
}

/** green · teal · sky — bảng màu điện gió, không có tím (xem frontend.md). */
const PROJECT_CHART_VARS = ["var(--chart-1)", "var(--chart-5)", "var(--chart-3)"] as const;

function KpiCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={highlight ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      </div>
      <div
        className={cn(
          "font-mono text-2xl font-bold tracking-tight",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ProjectBar({
  label,
  location,
  value,
  total,
  colorVar,
}: {
  label: string;
  location: string;
  value: number;
  total: number;
  colorVar: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Wind className="h-3.5 w-3.5 shrink-0" style={{ color: colorVar }} aria-hidden="true" />
          <span className="truncate text-foreground/90">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">{nf(value)} WPT</span>
          <span className="font-mono text-foreground/70">{nf(pct, 1)}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: colorVar }}
        />
      </div>
      <div className="text-xs text-muted-foreground">{location}</div>
    </div>
  );
}

function ProjectCard({
  name,
  location,
  capacityMw,
  generationMwh,
  capacityFactorPct,
  colorVar,
}: {
  name: string;
  location: string;
  capacityMw: number;
  generationMwh: number;
  capacityFactorPct: number;
  colorVar: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded"
          style={{ backgroundColor: `color-mix(in oklab, ${colorVar} 16%, transparent)` }}
        >
          <Wind className="h-4 w-4" style={{ color: colorVar }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">{location}</div>
        </div>
      </div>
      <dl className="space-y-1.5 text-xs">
        <Row term="Công suất đặt" desc={`${nf(capacityMw, 1)} MW`} />
        <Row term="Sản lượng luỹ kế" desc={`${nf(generationMwh)} MWh`} />
        <Row
          term="Hệ số công suất"
          desc={
            <span className="inline-flex items-center gap-1">
              <Gauge className="h-3 w-3" aria-hidden="true" />
              {nf(capacityFactorPct, 1)}%
            </span>
          }
        />
      </dl>
    </div>
  );
}

function Row({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-mono text-foreground">{desc}</dd>
    </div>
  );
}
