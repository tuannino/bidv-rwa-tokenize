'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Gauge, Wallet, Wind, Zap } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi } from '@/components/ui/kpi';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { getPortfolioAction } from '@/app/actions/portfolio';
import { WalletNotBoundNotice } from '@/components/investor/wallet-not-bound-notice';
import type { PortfolioView } from '@/lib/bank/portfolio.service';
import {
  MOCK_GENERATION_SERIES,
  PROJECT_STATUS_LABELS,
  REGION_LABELS,
  type WindProject,
} from '@/lib/mock-data';
import { OnChainBadge } from '@/components/investor/mock-badge';
import { UnverifiedNote } from '@/components/ui/unverified-note';
import type { TokenTerms } from '@/lib/store/config-values';

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

/** Cột cao nhất của biểu đồ Sản lượng theo kỳ (dữ liệu mẫu tĩnh). */
const MAX_GENERATION_MWH = Math.max(...MOCK_GENERATION_SERIES.map((point) => point.generationMwh));

const nfBig = (value: string) => {
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export function InvestorTokenDetailPage({ project, terms, mockWallet }: { project: WindProject; terms: TokenTerms; mockWallet: string | null }) {
  const { address, isConnected } = useAccount();
  const { chain } = useSelectedChain();
  const wallet = chain === 'mock' ? mockWallet : address;

  const requestKey = `${chain}|${wallet ?? ''}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    data: PortfolioView | null;
    error: string | null;
    /** FIX-01 E1: máy chủ trả `WALLET_NOT_BOUND`, không có vị thế của ví này. */
    notBound: boolean;
  } | null>(null);

  useEffect(() => {
    // Chỉ đọc chain cho dự án đã triển khai token; dự án mẫu không có gì để đọc.
    if (!project.onChain || !wallet) return;

    let cancelled = false;

    void getPortfolioAction({ chain, wallet }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, data: result.data, error: null, notBound: false }
          : { key: requestKey, data: null, error: result.error, notBound: result.code === 'WALLET_NOT_BOUND' },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [requestKey, wallet, chain, project.onChain]);

  const fresh = loaded?.key === requestKey ? loaded : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <span className="text-sm text-muted-foreground">{project.tokenSymbol}</span>
          {project.onChain ? (
            <OnChainBadge />
          ) : (
            <Badge variant="info">chưa triển khai trên chuỗi</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {REGION_LABELS[project.region]}, {project.location},{' '}
          {PROJECT_STATUS_LABELS[project.status]}
          <UnverifiedNote className="ml-1.5" />
        </p>
      </header>

      {/* Lưới 12 cột từ 1100 px: ba thẻ đầu mỗi thẻ 4 cột, Tình hình vận hành trải 12 cột; dưới đó một cột. */}
      <div className="grid gap-6 min-[1100px]:grid-cols-12">
        {/* Thẻ nền xanh: `tile-hl` không đổi `--card`, `--border`, nên đặt lại để đường kẻ và ô biểu tượng đọc được. */}
        <Card tone="hl" className="[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)] min-[1100px]:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
                <CardTitleIcon>
                  <Wallet />
                </CardTitleIcon>
                Vị thế của bạn
              </CardTitle>
              {project.onChain && <OnChainBadge />}
            </div>
          </CardHeader>
          <CardContent>
            {!project.onChain ? (
              <p className="py-6 text-sm text-muted-foreground">
                Chưa có token trên chuỗi nên chưa có vị thế. Phần này sẽ có số liệu khi dự án
                được phát hành.
              </p>
            ) : !wallet || (chain !== 'mock' && !isConnected) ? (
              <p className="py-6 text-sm text-muted-foreground">
                Kết nối ví ở góc trên phải để xem số lượng {project.tokenSymbol} bạn đang giữ.
              </p>
            ) : fresh === null ? (
              <EmptyState loading>Đang đọc số dư từ chuỗi…</EmptyState>
            ) : fresh.notBound ? (
              <WalletNotBoundNotice wallet={wallet} />
            ) : fresh.error ? (
              <Alert tone="bad">{fresh.error}</Alert>
            ) : fresh.data ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[13px] text-muted-foreground">
                    Đang giữ
                  </div>
                  <div className="tabular-nums text-5xl font-semibold tracking-tight">
                    {nfBig(fresh.data.balance)}
                  </div>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">
                    Giá trị theo giá phát hành
                  </span>
                  <span className="tabular-nums text-2xl font-semibold">
                    {nfBig(fresh.data.valueVnd)} ₫
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Không phải giá thị trường, hệ thống chưa có thị trường thứ cấp.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="min-[1100px]:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
                <CardTitleIcon>
                  <Wind />
                </CardTitleIcon>
                Thông tin dự án
              </CardTitle>
              <UnverifiedNote />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              <Row label="Mã dự án">
                <span className="font-code">{project.code}</span>
              </Row>
              <Row label="Công suất đặt">{nfNum(project.capacityMw, 1)} MW</Row>
              <Row label="Số tổ máy">{nfNum(project.turbines)}</Row>
              <Row label="Giá bán điện (PPA)">{nfNum(project.ppaPricePerKwh)} ₫/kWh</Row>
              <Row label="Vận hành từ">{project.commissionedAt}</Row>
              <Row label="Đơn vị vận hành">
                <span className="font-code text-xs break-all">{project.operatorAddress}</span>
              </Row>
            </dl>
          </CardContent>
        </Card>

        <Card className="min-[1100px]:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
                <CardTitleIcon>
                  <Gauge />
                </CardTitleIcon>
                Thông tin token
              </CardTitle>
              {project.onChain ? <OnChainBadge /> : <UnverifiedNote />}
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              <Row label="Ký hiệu">
                <span className="font-semibold">{project.tokenSymbol}</span>
              </Row>
              <Row label="Tuổi thọ còn lại">{terms.remainingLifetimeYears} năm</Row>
              <Row label="Lợi tức mục tiêu">{nfNum(terms.annualYieldPercent, 1)}%/năm</Row>
              <Row label="Phí giao dịch">
                {terms.tradingFeePercent === 0
                  ? 'Không tính'
                  : `${nfNum(terms.tradingFeePercent, 2)}%`}
              </Row>

              {project.onChain && fresh?.data ? (
                <>
                  <Row label="Tên token">{fresh.data.token.name}</Row>
                  <Row label="Tổng cung">
                    <span className="tabular-nums">{nfBig(fresh.data.token.totalSupply)}</span>
                  </Row>
                  <Row label="Giá phát hành">
                    <span className="tabular-nums">
                      {nfBig(fresh.data.issuePriceVnd)} ₫
                    </span>
                  </Row>
                </>
              ) : (
                <Row label="WPT dự kiến phát hành">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="tabular-nums">{nfNum(project.wptIssued)}</span>
                    <UnverifiedNote />
                  </span>
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

        <Card className="min-[1100px]:col-span-12">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
                <CardTitleIcon>
                  <Zap />
                </CardTitleIcon>
                Tình hình vận hành
              </CardTitle>
              <UnverifiedNote />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="grid gap-4">
                <Kpi label="Sản lượng luỹ kế" value={nfNum(project.generationMwh)} unit="MWh" tone="leaf" />
                <Kpi label="Hệ số công suất" value={nfNum(project.capacityFactorPct, 1)} unit="%" />
              </div>

              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Sản lượng theo kỳ
                </div>
                {/* Biểu đồ cột vẽ lại đúng các số của danh sách dưới (trang trí, đã có chữ ở danh sách). */}
                <div aria-hidden="true" className="flex h-40 items-end gap-3 border-b border-border">
                  {MOCK_GENERATION_SERIES.map((point) => (
                    <div
                      key={point.period}
                      className="flex-1 rounded-t-[10px] bg-primary"
                      style={{ height: `${Math.round((point.generationMwh / MAX_GENERATION_MWH) * 100)}%` }}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-3 gap-2 min-[640px]:grid-cols-6">
                  {MOCK_GENERATION_SERIES.map((point) => (
                    <li
                      key={point.period}
                      className="rounded-[14px] bg-muted px-3 py-2 text-xs"
                    >
                      <span className="block tabular-nums text-muted-foreground">{point.period}</span>
                      <span className="block tabular-nums text-foreground">
                        {nfNum(point.generationMwh)} MWh
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Sản lượng thật sẽ do EnergyOracle cấp; số ở đây là minh hoạ.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
