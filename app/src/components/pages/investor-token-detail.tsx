'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Gauge, Loader2, Wallet, Wind, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { getPortfolioAction } from '@/app/actions/portfolio';
import type { PortfolioView } from '@/lib/bank/portfolio.service';
import {
  MOCK_GENERATION_SERIES,
  PROJECT_STATUS_LABELS,
  REGION_LABELS,
  type WindProject,
} from '@/lib/mock-data';
import { MockBadge, OnChainBadge } from '@/components/investor/mock-badge';

/**
 * Trang CHI TIẾT DỰ ÁN TOKEN.
 *
 * Chỉ dự án `onChain` có số liệu thật (tổng cung, số dư) đọc qua `ILedgerPort`. Hai dự án còn
 * lại chưa triển khai token nên mọi số là dữ liệu mẫu và phần vị thế bị ẩn — hiện số 0 sẽ khiến
 * người xem hiểu là "đã phát hành nhưng bạn không giữ gì", sai hẳn bản chất.
 *
 * `project` truyền từ Server Component xuống: `WindProject` là dữ liệu thuần nên tuần tự hoá được.
 */

const nfNum = (value: number, digits = 0) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const nfBig = (value: string) => {
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export function InvestorTokenDetailPage({ project }: { project: WindProject }) {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();

  const requestKey = `${chain}|${address ?? ''}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    data: PortfolioView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    // Chỉ đọc chain cho dự án đã triển khai token; dự án mẫu không có gì để đọc.
    if (!project.onChain || !address) return;

    let cancelled = false;

    void getPortfolioAction({ chain, wallet: address }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, data: result.data, error: null }
          : { key: requestKey, data: null, error: result.error },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [requestKey, address, chain, project.onChain]);

  const fresh = loaded?.key === requestKey ? loaded : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <span className="font-mono text-sm text-muted-foreground">{project.tokenSymbol}</span>
          {project.onChain ? (
            <OnChainBadge />
          ) : (
            <Badge variant="secondary">chưa triển khai trên chuỗi</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {REGION_LABELS[project.region]} · {project.location} ·{' '}
          {PROJECT_STATUS_LABELS[project.status]}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1 — Thông tin dự án */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wind className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Thông tin dự án
            </CardTitle>
            <MockBadge />
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Mã dự án">
                <span className="font-mono">{project.code}</span>
              </Row>
              <Row label="Công suất đặt">{nfNum(project.capacityMw, 1)} MW</Row>
              <Row label="Số tổ máy">{nfNum(project.turbines)}</Row>
              <Row label="Giá bán điện (PPA)">{nfNum(project.ppaPricePerKwh)} ₫/kWh</Row>
              <Row label="Vận hành từ">{project.commissionedAt}</Row>
              <Row label="Đơn vị vận hành">
                <span className="font-mono text-xs">{project.operatorAddress}</span>
              </Row>
            </dl>
          </CardContent>
        </Card>

        {/* 2 — Tình hình vận hành */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Tình hình vận hành
            </CardTitle>
            <MockBadge />
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Sản lượng luỹ kế">{nfNum(project.generationMwh)} MWh</Row>
              <Row label="Hệ số công suất">{nfNum(project.capacityFactorPct, 1)}%</Row>
            </dl>

            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Sản lượng theo kỳ
              </div>
              <ul className="space-y-1">
                {MOCK_GENERATION_SERIES.map((point) => (
                  <li
                    key={point.period}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">{point.period}</span>
                    <span className="font-mono text-foreground">
                      {nfNum(point.generationMwh)} MWh
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Sản lượng thật sẽ do EnergyOracle cấp; số ở đây là minh hoạ.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3 — Thông tin token */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Thông tin token
            </CardTitle>
            {project.onChain ? <OnChainBadge /> : <MockBadge />}
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Row label="Ký hiệu">
                <span className="font-mono font-semibold">{project.tokenSymbol}</span>
              </Row>

              {project.onChain && fresh?.data ? (
                <>
                  <Row label="Tên token">{fresh.data.token.name}</Row>
                  <Row label="Tổng cung">
                    <span className="font-mono">{nfBig(fresh.data.token.totalSupply)}</span>
                  </Row>
                  <Row label="Giá phát hành">
                    <span className="font-mono">
                      {fresh.data.issuePriceVnd.toLocaleString('vi-VN')} ₫
                    </span>
                  </Row>
                </>
              ) : (
                <Row label="WPT dự kiến phát hành">
                  <span className="font-mono">{nfNum(project.wptIssued)}</span>
                </Row>
              )}
            </dl>

            {!project.onChain && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                Dự án này chưa triển khai token trên chuỗi, nên tổng cung và số dư chưa có số
                liệu thật.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4 — Vị thế của nhà đầu tư */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Vị thế của bạn
            </CardTitle>
            {project.onChain && <OnChainBadge />}
          </CardHeader>
          <CardContent>
            {!project.onChain ? (
              <p className="py-6 text-sm text-muted-foreground">
                Chưa có token trên chuỗi nên chưa có vị thế. Phần này sẽ có số liệu khi dự án
                được phát hành.
              </p>
            ) : !isConnected || !address ? (
              <p className="py-6 text-sm text-muted-foreground">
                Kết nối ví ở góc trên phải để xem số lượng {project.tokenSymbol} bạn đang giữ.
              </p>
            ) : fresh === null ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Đang đọc số dư từ chuỗi…
              </div>
            ) : fresh.error ? (
              <p className="py-6 text-sm text-destructive">{fresh.error}</p>
            ) : fresh.data ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Đang giữ
                  </div>
                  <div className="font-mono text-3xl font-bold text-primary">
                    {nfBig(fresh.data.balance)}
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">
                    Giá trị theo giá phát hành
                  </span>
                  <span className="font-mono text-lg font-semibold">
                    {nfBig(fresh.data.valueVnd)} ₫
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Không phải giá thị trường — hệ thống chưa có thị trường thứ cấp.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
