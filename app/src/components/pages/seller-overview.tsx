'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSellerOverviewAction } from '@/app/actions/seller';
import type { SellerOverviewView } from '@/lib/bank/seller.service';
import type { WithdrawPolicy } from '@/lib/bank/withdraw-limit';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import type { ProjectStatus } from '@/lib/store/project.store.port';

/**
 * Màn TỔNG QUAN NGƯỜI BÁN (FE-21 việc 1–7) — CHỈ ĐỌC.
 *
 * Mọi con số đến từ `getSellerOverview`; màn này chỉ định dạng, không cộng trừ gì (yêu cầu 16).
 * Không có nút nào thay đổi dữ liệu — hai nút tắt chỉ là liên kết.
 */

export const nf = (value: string | null | undefined) => {
  if (value === null || value === undefined) return '—';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export const describePolicy = (policy: WithdrawPolicy | null) =>
  policy === null
    ? 'Chưa cấu hình hạn mức rút — chưa rút được.'
    : policy.mode === 'FIXED'
      ? `Khoá cố định ${nf(policy.lockedVnd)} VNDB.`
      : `Khoá ${policy.lockedPercent}% số dư tại thời điểm rút.`;

/** Đọc tổng quan theo chuỗi đang chọn. Dùng chung cho màn Tổng quan và màn Tạo lệnh rút. */
export function useSellerOverview() {
  const { chain } = useSelectedChain();
  const [loaded, setLoaded] = useState<{
    key: string;
    data: SellerOverviewView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSellerOverviewAction({ chain }).then((result) => {
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
  return { data: fresh?.data ?? null, error: fresh?.error ?? null, loading: fresh === null };
}

const TOKEN_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Chưa phát hành',
  ISSUED: 'Đã phát hành',
  CLOSED: 'Đã tất toán',
};

/** Định nghĩa từng chỉ tiêu nguồn cung — yêu cầu 2 bắt hiện kèm số. */
const SUPPLY_METRICS = [
  ['cap', 'Trần phát hành', 'Tổng số token tối đa được phát hành, theo hồ sơ dự án.'],
  ['remaining', 'Số còn được phát hành', 'Trần phát hành trừ tổng cung hiện tại.'],
  ['totalSupply', 'Tổng cung hiện tại', 'Số token đang tồn tại trên chuỗi: đã phát hành trừ đã đốt.'],
  ['undistributed', 'Chưa phân phối', 'Token còn nằm trong ví thanh toán của Người bán, chưa bán cho nhà đầu tư.'],
  ['circulating', 'Đang lưu hành', 'Token đã nằm trong ví nhà đầu tư: tổng cung trừ phần chưa phân phối.'],
] as const;

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="text-base">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SellerOverviewPage() {
  const { data, error, loading } = useSellerOverview();
  const token = data?.tokens[0];
  const wallet = data?.wallet;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Tổng quan</h1>
          <p className="text-sm text-muted-foreground">
            Tình hình bán token, nguồn cung và số dư ví của Người bán. Màn chỉ đọc.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Lối tắt">
          <Link href="/seller/transactions" className={buttonVariants({ variant: 'outline' })}>
            Danh sách giao dịch <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/seller/withdraw" className={buttonVariants()}>
            Tạo lệnh rút <ArrowRight aria-hidden="true" />
          </Link>
        </nav>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc số liệu…
        </div>
      ) : error || !data ? (
        <p className="py-6 text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Box title="Token khớp lệnh trong ngày">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Số lượng mua" value={nf(data.today.buyWpt)} unit="WPT" hint={`${data.today.buyCount} lệnh`} />
              <Stat label="Tổng giá trị mua" value={nf(data.today.buyVnd)} unit="VNDB" />
              <Stat label="Số lượng bán" value="—" hint="Hệ thống chưa có lệnh bán lại." />
              <Stat label="Tổng giá trị bán" value="—" hint="Hệ thống chưa có lệnh bán lại." />
            </div>
          </Box>

          <div className="grid gap-6 lg:grid-cols-2">
            <Box title="Thông tin nguồn cung">
              {token ? (
                <dl className="space-y-3">
                  {SUPPLY_METRICS.map(([key, label, definition]) => (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <div>
                        <dt className="text-sm font-medium">{label}</dt>
                        <dd className="text-xs text-muted-foreground">{definition}</dd>
                      </div>
                      <dd className="font-mono text-sm font-semibold" data-metric={key}>
                        {nf(token[key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có dự án trên chuỗi này.</p>
              )}
            </Box>

            <Box title="Thông tin token">
              {token ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <dt className="text-muted-foreground">Mã token</dt>
                  <dd className="font-mono font-semibold">{token.tokenSymbol}</dd>
                  <dt className="text-muted-foreground">Dự án</dt>
                  <dd>{token.projectName}</dd>
                  <dt className="text-muted-foreground">Trần phát hành</dt>
                  <dd className="font-mono">{nf(token.cap)}</dd>
                  <dt className="text-muted-foreground">Giá phát hành</dt>
                  <dd className="font-mono">{nf(token.issuePriceVnd)} VNDB</dd>
                  <dt className="text-muted-foreground">Trạng thái token</dt>
                  <dd>{TOKEN_STATUS_LABELS[token.tokenStatus]}</dd>
                  <dt className="text-muted-foreground">Trạng thái giao dịch</dt>
                  <dd>{token.tradingOpen ? 'Đang mở bán' : 'Ngừng bán (đang tất toán)'}</dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có dự án trên chuỗi này.</p>
              )}
            </Box>
          </div>

          <Box title="Tồn kho token">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã token</TableHead>
                  {SUPPLY_METRICS.map(([key, label]) => (
                    <TableHead key={key} className="text-right">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tokens.map((row) => (
                  <TableRow key={row.tokenSymbol}>
                    <TableCell className="font-mono font-semibold">{row.tokenSymbol}</TableCell>
                    {SUPPLY_METRICS.map(([key]) => (
                      <TableCell key={key} className="text-right font-mono">
                        {nf(row[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <div className="grid gap-6 lg:grid-cols-2">
            <Box title="Tài sản trong ví thanh toán">
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat
                  label="Token chưa phân phối"
                  value={nf(token?.undistributed)}
                  unit="WPT"
                  hint="Không rút qua kênh này — lệnh rút chỉ áp cho VNDB."
                />
                <Stat label="VNDB" value={nf(wallet?.paymentVnd)} unit="VNDB" />
                <Stat label="VNDB đã khoá" value={nf(wallet?.lockedVnd)} unit="VNDB" />
                <Stat label="VNDB còn rút được" value={nf(wallet?.withdrawableVnd)} unit="VNDB" />
              </div>
              {data.spvWallet === null && (
                <p className="mt-3 text-xs text-muted-foreground">Chưa phát hành lần nào nên chưa có ví thanh toán.</p>
              )}
            </Box>

            <Box title="Số dư ví">
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat label="VNDB ví thanh toán" value={nf(wallet?.paymentVnd)} unit="VNDB" />
                <Stat label="VNDB ví chia lợi nhuận" value={nf(wallet?.profitPoolVnd)} unit="VNDB" />
                <Stat label="Phần khoá" value={nf(wallet?.lockedVnd)} unit="VNDB" />
                <Stat label="Hạn mức còn rút được" value={nf(wallet?.withdrawableVnd)} unit="VNDB" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{describePolicy(wallet?.policy ?? null)}</p>
            </Box>
          </div>
        </>
      )}
    </div>
  );
}
