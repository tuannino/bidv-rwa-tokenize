'use client';

import { useEffect, useState } from 'react';
import { explorerTxUrl } from '@bidv/shared';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getVaultOverviewAction } from '@/app/actions/vault';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { VaultOverviewView } from '@/lib/bank/vault.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';

const amount = (value: string) => BigInt(value).toLocaleString('vi-VN');
const percent = (bps: string) => `${Number(bps) / 100}%`;
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

const MODE_LABEL = {
  UNSET: 'Chưa cấu hình, khoá toàn bộ',
  FIXED: 'Khoá số tiền cố định',
  PERCENT: 'Khoá theo tỷ lệ kỳ',
} as const;

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}

/** Màn chỉ đọc: không có thao tác quản trị vault nào được đưa lên trình duyệt. */
export function VaultStatusPage() {
  const { chain } = useSelectedChain();
  const [loaded, setLoaded] = useState<{
    key: string;
    data: VaultOverviewView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVaultOverviewAction({ chain }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: chain, data: result.data, error: null }
          : { key: chain, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const fresh = loaded?.key === chain ? loaded : null;
  const data = fresh?.data ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Vault thanh toán SPV</h1>
        <p className="text-sm text-muted-foreground">
          Trạng thái giữ WPT, VNDB và phần tiền bị khoá trên chain <span className="font-mono">{chain}</span>.
          Màn chỉ đọc.
        </p>
      </header>

      {fresh === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc trạng thái vault…
        </div>
      ) : fresh.error ? (
        <p role="alert" className="text-sm text-destructive">{fresh.error}</p>
      ) : data?.status === null ? (
        <Card><CardContent className="pt-6">Chain này chưa triển khai vault thanh toán SPV</CardContent></Card>
      ) : data?.status ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Trạng thái hiện tại</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Địa chỉ vault" value={data.status.address} />
                <Metric label="Chế độ khoá" value={MODE_LABEL[data.status.lockMode]} />
                <Metric label="Số dư WPT" value={`${amount(data.status.wptBalance)} WPT`} />
                <Metric label="Số dư VNDB" value={`${amount(data.status.vndbBalance)} VNDB`} />
                <Metric label="Khoá cố định" value={`${amount(data.status.fixedLockAmount)} VNDB`} />
                <Metric label="Tỷ lệ hiện hành" value={percent(data.status.percentRateBps)} />
                <Metric
                  label="Tỷ lệ chờ áp"
                  value={data.status.pendingPercentRateBps === null ? 'Không có' : percent(data.status.pendingPercentRateBps)}
                />
                <Metric label="Thu ròng" value={`${amount(data.status.netProceeds)} VNDB`} />
                <Metric label="Đang khoá" value={`${amount(data.status.lockedAmount)} VNDB`} />
                <Metric label="Có thể rút" value={`${amount(data.status.withdrawable)} VNDB`} />
                <Metric label="Kỳ gần nhất" value={amount(data.status.lastPeriodRef)} />
                <Metric label="Đã chia kỳ trước" value={`${amount(data.status.lastDistributedPrev)} VNDB`} />
                <Metric label="Phần khoá theo kỳ" value={`${amount(data.status.percentLocked)} VNDB`} />
                <Metric label="Ví nhận tiền rút" value={data.status.payoutWallet ?? 'Chưa cấu hình'} />
                <Metric label="Trạng thái rút" value={data.status.withdrawalsPaused ? 'Đang tạm dừng' : 'Đang hoạt động'} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Lịch sử chốt kỳ (10 lần gần nhất)</CardTitle></CardHeader>
            <CardContent>
              {data.historyError ? (
                <p role="alert" className="text-sm text-destructive">{data.historyError}</p>
              ) : data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có kỳ nào được chốt.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Kỳ</TableHead><TableHead className="text-right">Đã chia kỳ trước</TableHead>
                    <TableHead className="text-right">Tỷ lệ</TableHead><TableHead className="text-right">Phần khoá</TableHead>
                    <TableHead>Người đặt</TableHead><TableHead>Thời điểm</TableHead><TableHead>Giao dịch</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{data.history.map((row) => {
                    const url = explorerTxUrl(chain, row.txHash);
                    return <TableRow key={`${row.txHash}:${row.periodRef}`}>
                      <TableCell className="font-mono">{row.periodRef}</TableCell>
                      <TableCell className="text-right font-mono">{amount(row.distributedPrev)}</TableCell>
                      <TableCell className="text-right font-mono">{percent(row.rateBps)}</TableCell>
                      <TableCell className="text-right font-mono">{amount(row.percentLocked)}</TableCell>
                      <TableCell className="font-mono text-xs" title={row.operator}>{short(row.operator)}</TableCell>
                      <TableCell className="text-xs">{new Date(row.timestamp * 1000).toLocaleString('vi-VN')}</TableCell>
                      <TableCell>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs underline">{short(row.txHash)}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <span className="font-mono text-xs" title={row.txHash}>{short(row.txHash)}</span>}</TableCell>
                    </TableRow>;
                  })}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
