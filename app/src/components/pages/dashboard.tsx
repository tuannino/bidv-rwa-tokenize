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
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
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
    borderRadius: "var(--radius-lg)",
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Tổng quan</h1>
        <Link prefetch={false} href="/mint" className={cn(buttonVariants(), "shrink-0")}>
          <Plus className="h-4 w-4" />
          Phát hành WPT
        </Link>
      </div>
      {fresh?.error && <Alert tone="bad">{fresh.error}</Alert>}

      {/* Lưới 12 cột từ 1100 px: ô Tổng cung cố định cột 1 đến 4 trên hai hàng, các ô khác tự xếp theo thứ tự DOM.
          Mốc 640 px viết bằng px (không dùng `sm:` theo rem) để Tailwind xếp đúng thứ tự với mốc 1100 px. */}
      <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-12">
        <Kpi
          label="Dự án đang triển khai"
          value={show(data?.issuedProjects, (count) => nf(count))}
          sub="Đã phát hành token trên chain đang chọn"
          icon={<Wind />}
          className="min-[1100px]:col-span-4"
        />
        <Kpi
          tone="hl"
          size="lg"
          label="Tổng cung token"
          value={show(supply, (value) => `${formatAmount(value.totalSupply)} ${value.symbol}`)}
          icon={<Coins />}
          className="min-[640px]:row-span-2 min-[1100px]:col-span-4 min-[1100px]:col-start-1 min-[1100px]:row-start-1"
        >
          <div className="mt-4 space-y-2 text-[13px] text-muted-foreground">
            <SupplyBar label={supply?.symbol ?? "WPT"} value={supply ? formatAmount(supply.totalSupply) : null} />
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                TCC
                <UnverifiedNote title="Chưa hỗ trợ token TCC" />
              </span>
              <span className="tabular-nums">{"–"}</span>
            </div>
          </div>
        </Kpi>
        <Kpi
          label="Nhà đầu tư đã định danh"
          value={show(investors, (value) => `${nf(value.count)}${value.truncated ? "+" : ""}`)}
          sub="Hồ sơ đã gắn ví"
          icon={<Users />}
          className="min-[1100px]:col-span-4"
        />
        <Kpi
          tone="leaf"
          label="Sản lượng luỹ kế"
          value={`${nf(MOCK_WIND_STATS.cumulativeGenerationMwh)} MWh`}
          sub={<UnverifiedNote title="Chưa có nguồn sản lượng thật" />}
          icon={<Zap />}
          className="min-[1100px]:col-span-4"
        />
        <Kpi
          tone="au"
          label="Lợi tức đã chia"
          value={show(profit, (value) => `${formatAmount(value.totalAmount)} VNDB`)}
          sub={profit ? `${nf(profit.periods)}${profit.truncated ? "+" : ""} kỳ đã hoàn tất` : ""}
          icon={<Banknote />}
          className="min-[1100px]:col-span-4"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold text-foreground">Sản lượng và lợi tức theo kỳ</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 min-[1100px]:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-3 flex items-center gap-2.5 text-sm font-medium text-foreground">
              <CardTitleIcon>
                <Banknote />
              </CardTitleIcon>
              Lợi tức theo kỳ
            </h3>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="periodKey" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={72} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value) => [`${nf(typeof value === "number" ? value : Number(value ?? 0))} VNDB`, "Lợi tức"]}
                  />
                  <Bar dataKey="amount" name="Lợi tức" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 flex items-center gap-2.5 text-sm font-medium text-foreground">
              <CardTitleIcon>
                <Zap />
              </CardTitleIcon>
              Sản lượng theo tháng
              <UnverifiedNote />
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={MOCK_GENERATION_SERIES} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="generationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Thanh tổng cung theo loại token: hiện chỉ một token đang chạy nên thanh luôn đầy. */
function SupplyBar({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums">{value ?? "–"}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-full rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
      </div>
    </div>
  );
}
