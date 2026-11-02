"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, Coins, Plus, Users, Wind, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getOpsOverviewAction } from "@/app/actions/overview";
import type { OpsOverview } from "@/lib/bank/overview.service";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { formatAmount } from "@/lib/format";
import { MOCK_GENERATION_SERIES, MOCK_WIND_STATS } from "@/lib/mock-data";
import { UnverifiedNote } from "@/components/ui/unverified-note";
import { cn } from "@/lib/utils";

/**
 * Màn TỔNG QUAN của Giao dịch viên, Kiểm soát viên (FIX-05).
 *
 * Số liệu có nguồn thì đọc thật theo chain đang chọn qua MỘT lời gọi `getOpsOverviewAction` (chỉ
 * đọc, không ghi sổ kiểm toán): dự án đã phát hành, tổng cung, hồ sơ nhà đầu tư đã gắn ví, lợi tức
 * các kỳ chia đã hoàn tất. Chưa có nguồn thật (sản lượng, token TCC) thì giữ số mẫu kèm "unverified".
 * Sản lượng (theo tháng) và lợi tức (theo mã kỳ chia) khác trục thời gian nên vẽ thành hai biểu đồ.
 *
 * Màu biểu đồ đi qua theme token (`var(--chart-*)`, `var(--border)`...) để đọc được ở cả hai giao diện.
 */

const nf = (value: number, digits = 0) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Trục, nhãn dùng màu chữ phụ của theme, không phải hex cố định. */
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--popover-foreground)" },
  itemStyle: { color: "var(--muted-foreground)" },
} as const;

type Loaded = { key: string; data: OpsOverview | null; error: string | null };

export function DashboardPage() {
  const { chain } = useSelectedChain();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOpsOverviewAction(chain)
      .then((result): Loaded =>
        result.ok ? { key: chain, data: result.data, error: null } : { key: chain, data: null, error: result.error },
      )
      .catch((): Loaded => ({ key: chain, data: null, error: "Chưa đọc được số liệu tổng quan, thử tải lại trang." }))
      .then((next) => {
        if (!cancelled) setLoaded(next);
      });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  // "Đang đọc" suy ra từ khoá chain, không đặt state đồng bộ trong effect.
  const fresh = loaded?.key === chain ? loaded : null;
  const data = fresh?.data ?? null;
  const show = <T,>(value: T | null | undefined, render: (value: T) => string) =>
    fresh === null ? "Đang đọc" : value === null || value === undefined ? "Chưa đọc được" : render(value);

  const supply = data?.supply ?? null;
  const profit = data?.profit ?? null;
  const investors = data?.investors ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tổng quan</h1>
          {fresh?.error && <p className="mt-1 text-sm text-destructive">{fresh.error}</p>}
        </div>
        <Link prefetch={false}
          href="/mint"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Phát hành WPT
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Dự án đang triển khai"
          value={show(data?.issuedProjects, (count) => nf(count))}
          sub="Đã phát hành token trên chain đang chọn"
          icon={<Wind className="h-4 w-4" />}
        />
        <KpiCard
          label="Tổng cung token"
          value={show(supply, (value) => `${formatAmount(value.totalSupply)} ${value.symbol}`)}
          sub={
            <div className="mt-2 space-y-2">
              <SupplyBar label={supply?.symbol ?? "WPT"} value={supply ? formatAmount(supply.totalSupply) : null} />
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  TCC
                  <UnverifiedNote title="Chưa hỗ trợ token TCC" />
                </span>
                <span className="font-mono">{"–"}</span>
              </div>
            </div>
          }
          icon={<Coins className="h-4 w-4" />}
          highlight
        />
        <KpiCard
          label="Nhà đầu tư đã định danh"
          value={show(investors, (value) => `${nf(value.count)}${value.truncated ? "+" : ""}`)}
          sub="Hồ sơ đã gắn ví"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Sản lượng luỹ kế"
          value={`${nf(MOCK_WIND_STATS.cumulativeGenerationMwh)} MWh`}
          sub={<UnverifiedNote title="Chưa có nguồn sản lượng thật" />}
          icon={<Zap className="h-4 w-4" />}
        />
        <KpiCard
          label="Lợi tức đã chia"
          value={show(profit, (value) => `${formatAmount(value.totalAmount)} VNDB`)}
          sub={profit ? `${nf(profit.periods)}${profit.truncated ? "+" : ""} kỳ đã hoàn tất` : ""}
          icon={<Banknote className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-medium text-foreground">Sản lượng và lợi tức theo kỳ</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Lợi tức theo kỳ</h3>
            {fresh === null ? (
              <p className="py-8 text-sm text-muted-foreground">Đang đọc</p>
            ) : profit === null ? (
              <p className="py-8 text-sm text-muted-foreground">Chưa đọc được</p>
            ) : profit.series.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">Chưa có kỳ chia nào hoàn tất.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={profit.series.map((point) => ({ periodKey: point.periodKey, amount: Number(point.amount) }))}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="periodKey" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={72} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value) => [`${nf(typeof value === "number" ? value : Number(value ?? 0))} VNDB`, "Lợi tức"]}
                  />
                  <Bar dataKey="amount" name="Lợi tức" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Sản lượng theo tháng
              <UnverifiedNote className="normal-case tracking-normal" />
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={MOCK_GENERATION_SERIES} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="generationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="period" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={62} unit=" MWh" />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(value) => [`${nf(typeof value === "number" ? value : Number(value ?? 0))} MWh`, "Sản lượng"]}
                />
                <Area
                  type="monotone"
                  dataKey="generationMwh"
                  name="Sản lượng"
                  stroke="var(--chart-1)"
                  fill="url(#generationGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
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

/** Thanh tổng cung theo loại token: hiện chỉ một token đang chạy nên thanh luôn đầy. */
function SupplyBar({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono">{value ?? "–"}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-full rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
      </div>
    </div>
  );
}
