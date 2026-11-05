# FE-UX-05a: chi tiết dời nguyên văn (kèm `docs/CHECKPOINT_FEUX05A.md` mục 3)

Đoạn trước lấy từ mã tại merge-base `11160f1` (lần dời 1) hoặc ngay trước commit `16f4c5e` (lần dời 2); đoạn sau lấy từ mã
tại commit dời tương ứng, CHƯA đổi kiểu. Kiểm bằng máy: bỏ khoảng trắng đầu dòng và dòng trống, so `diff`.

"<gạch dài>" trong đoạn mã thay cho ký tự U+2014 có trong mã gốc (tài liệu không dùng ký tự đó); mã thật giữ nguyên ký tự.

## 1. Lần dời 1 (commit `b746d6f`, QĐ-4)

### 1.1 `nf`, `describePolicy`

Trước (`seller-overview.tsx:23-42` tại `11160f1`):

```tsx
export const nf = (value: string | null | undefined) => {
  if (value === null || value === undefined) return '<gạch dài>';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export const describePolicy = (policy: SellerWithdrawPolicy | null) => {
  if (policy === null) return 'Chain này chưa có vault thanh toán: chưa rút được.';
  if (policy.lockMode === 'UNSET') return 'Nguồn on-chain: chưa cấu hình, vault khoá toàn bộ.';
  if (policy.lockMode === 'FIXED') {
    return `Nguồn on-chain: khoá cố định ${nf(policy.fixedLockAmount)} VNDB.`;
  }
  return (
    `Nguồn on-chain: khoá ${Number(policy.percentRateBps) / 100}% theo kỳ, làm tròn xuống; ` +
    `thu ròng ${nf(policy.netProceeds)} VNDB, phần khoá kỳ gần nhất ${nf(policy.percentLocked)} VNDB.`
  );
};
```

Sau (`components/seller/format.ts` tại `b746d6f`; `diff` rỗng ngoài dòng nhập kiểu và chú thích đầu tệp):

```ts
import type { SellerWithdrawPolicy } from '@/lib/bank/seller.service';

/** Định dạng dùng chung của các màn Người bán, dời nguyên văn từ `seller-overview.tsx` (FE-UX-05a QĐ-4). */

export const nf = (value: string | null | undefined) => {
  if (value === null || value === undefined) return '<gạch dài>';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export const describePolicy = (policy: SellerWithdrawPolicy | null) => {
  if (policy === null) return 'Chain này chưa có vault thanh toán: chưa rút được.';
  if (policy.lockMode === 'UNSET') return 'Nguồn on-chain: chưa cấu hình, vault khoá toàn bộ.';
  if (policy.lockMode === 'FIXED') {
    return `Nguồn on-chain: khoá cố định ${nf(policy.fixedLockAmount)} VNDB.`;
  }
  return (
    `Nguồn on-chain: khoá ${Number(policy.percentRateBps) / 100}% theo kỳ, làm tròn xuống; ` +
    `thu ròng ${nf(policy.netProceeds)} VNDB, phần khoá kỳ gần nhất ${nf(policy.percentLocked)} VNDB.`
  );
};
```

### 1.2 `SellerOverviewBody`

Trước (`seller-overview.tsx:79-124` và `:152-281` tại `11160f1`, bỏ `SellerOverviewPage` ở `:120-122`):

```tsx
const TOKEN_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Chưa phát hành',
  ISSUED: 'Đã phát hành',
  CLOSED: 'Đã tất toán',
};

/** Định nghĩa từng chỉ tiêu nguồn cung <gạch dài> yêu cầu 2 bắt hiện kèm số. */
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
      <p className="tabular-nums text-lg font-semibold">
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
// … :123-124
  const token = data?.tokens[0];
  const wallet = data?.wallet;
// … :152-281 (khối trong `<>…</>` của nhánh có dữ liệu)
        <>
          <Box title="Token khớp lệnh trong ngày">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Số lượng mua" value={nf(data.today.buyWpt)} unit="WPT" hint={`${data.today.buyCount} lệnh`} />
              <Stat label="Tổng giá trị mua" value={nf(data.today.buyVnd)} unit="VNDB" />
              <Stat label="Số lượng bán" value={nf(data.today.sell.wpt)} unit="WPT" hint={`${data.today.sell.count} lệnh`} />
              <Stat label="Tổng giá trị bán" value={nf(data.today.sell.vnd)} unit="VNDB" />
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
                      <dd className="tabular-nums text-sm font-semibold" data-metric={key}>
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
                  <dd className="font-semibold">{token.tokenSymbol}</dd>
                  <dt className="text-muted-foreground">Dự án</dt>
                  <dd>{token.projectName}</dd>
                  <dt className="text-muted-foreground">Trần phát hành</dt>
                  <dd className="tabular-nums">{nf(token.cap)}</dd>
                  <dt className="text-muted-foreground">Giá phát hành</dt>
                  <dd className="tabular-nums">{nf(token.issuePriceVnd)} VNDB</dd>
                  <dt className="text-muted-foreground">Tuổi thọ còn lại</dt>
                  <dd>{token.terms.remainingLifetimeYears} năm</dd>
                  <dt className="text-muted-foreground">Lợi tức mục tiêu</dt>
                  <dd>{token.terms.annualYieldPercent.toLocaleString('vi-VN')}%/năm</dd>
                  <dt className="text-muted-foreground">Phí giao dịch</dt>
                  <dd>
                    {token.terms.tradingFeePercent === 0
                      ? 'Không tính'
                      : `${token.terms.tradingFeePercent.toLocaleString('vi-VN')}%`}
                  </dd>
                  <dt className="text-muted-foreground">Trạng thái token</dt>
                  <dd>{TOKEN_STATUS_LABELS[token.tokenStatus]}</dd>
                  <dt className="text-muted-foreground">Trạng thái giao dịch</dt>
                  <dd>{tradingStatusLabel(data.recallPhase, token.tradingOpen, 'seller')}</dd>
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
                    <TableCell className="font-semibold">{row.tokenSymbol}</TableCell>
                    {SUPPLY_METRICS.map(([key]) => (
                      <TableCell key={key} className="text-right tabular-nums">
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
                  hint="Không rút qua kênh này <gạch dài> lệnh rút chỉ áp cho VNDB."
                />
                <Stat label="VNDB" value={nf(wallet?.paymentVnd)} unit="VNDB" />
                <Stat label="VNDB đã khoá" value={nf(wallet?.lockedVnd)} unit="VNDB" />
                <Stat label="VNDB còn rút được" value={nf(wallet?.withdrawableVnd)} unit="VNDB" />
              </div>
              {wallet?.paymentWallet && (
                <p className="mt-3 break-all text-xs text-muted-foreground">
                  Địa chỉ vault: <span className="font-code">{wallet.paymentWallet}</span>
                </p>
              )}
              {wallet?.warning && (
                <p role="alert" className="mt-3 text-sm font-medium text-destructive">{wallet.warning}</p>
              )}
              {wallet?.paymentWallet === null && (
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
              {wallet?.warning && (
                <p role="alert" className="mt-3 text-sm font-medium text-destructive">{wallet.warning}</p>
              )}
            </Box>
          </div>
        </>
```

Sau (`components/seller/seller-overview-body.tsx` tại `b746d6f`):

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SellerOverviewView } from '@/lib/bank/seller.service';
import type { ProjectStatus } from '@/lib/store/project.store.port';
import { tradingStatusLabel } from '@/components/recall/gates';
import { describePolicy, nf } from '@/components/seller/format';

/**
 * Phần có số liệu của màn Tổng quan Người bán (nhánh có dữ liệu), dời nguyên văn từ `seller-overview.tsx`
 * (FE-UX-05a QĐ-4) để dựng được các trạng thái không có trên mock bằng dữ liệu giả.
 */

const TOKEN_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Chưa phát hành',
  ISSUED: 'Đã phát hành',
  CLOSED: 'Đã tất toán',
};

/** Định nghĩa từng chỉ tiêu nguồn cung <gạch dài> yêu cầu 2 bắt hiện kèm số. */
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
      <p className="tabular-nums text-lg font-semibold">
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

export function SellerOverviewBody({ data }: { data: SellerOverviewView }) {
  const token = data.tokens[0];
  const wallet = data.wallet;

  return (
    <>
      <Box title="Token khớp lệnh trong ngày">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Số lượng mua" value={nf(data.today.buyWpt)} unit="WPT" hint={`${data.today.buyCount} lệnh`} />
          <Stat label="Tổng giá trị mua" value={nf(data.today.buyVnd)} unit="VNDB" />
          <Stat label="Số lượng bán" value={nf(data.today.sell.wpt)} unit="WPT" hint={`${data.today.sell.count} lệnh`} />
          <Stat label="Tổng giá trị bán" value={nf(data.today.sell.vnd)} unit="VNDB" />
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
                  <dd className="tabular-nums text-sm font-semibold" data-metric={key}>
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
              <dd className="font-semibold">{token.tokenSymbol}</dd>
              <dt className="text-muted-foreground">Dự án</dt>
              <dd>{token.projectName}</dd>
              <dt className="text-muted-foreground">Trần phát hành</dt>
              <dd className="tabular-nums">{nf(token.cap)}</dd>
              <dt className="text-muted-foreground">Giá phát hành</dt>
              <dd className="tabular-nums">{nf(token.issuePriceVnd)} VNDB</dd>
              <dt className="text-muted-foreground">Tuổi thọ còn lại</dt>
              <dd>{token.terms.remainingLifetimeYears} năm</dd>
              <dt className="text-muted-foreground">Lợi tức mục tiêu</dt>
              <dd>{token.terms.annualYieldPercent.toLocaleString('vi-VN')}%/năm</dd>
              <dt className="text-muted-foreground">Phí giao dịch</dt>
              <dd>
                {token.terms.tradingFeePercent === 0
                  ? 'Không tính'
                  : `${token.terms.tradingFeePercent.toLocaleString('vi-VN')}%`}
              </dd>
              <dt className="text-muted-foreground">Trạng thái token</dt>
              <dd>{TOKEN_STATUS_LABELS[token.tokenStatus]}</dd>
              <dt className="text-muted-foreground">Trạng thái giao dịch</dt>
              <dd>{tradingStatusLabel(data.recallPhase, token.tradingOpen, 'seller')}</dd>
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
                <TableCell className="font-semibold">{row.tokenSymbol}</TableCell>
                {SUPPLY_METRICS.map(([key]) => (
                  <TableCell key={key} className="text-right tabular-nums">
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
              hint="Không rút qua kênh này <gạch dài> lệnh rút chỉ áp cho VNDB."
            />
            <Stat label="VNDB" value={nf(wallet?.paymentVnd)} unit="VNDB" />
            <Stat label="VNDB đã khoá" value={nf(wallet?.lockedVnd)} unit="VNDB" />
            <Stat label="VNDB còn rút được" value={nf(wallet?.withdrawableVnd)} unit="VNDB" />
          </div>
          {wallet?.paymentWallet && (
            <p className="mt-3 break-all text-xs text-muted-foreground">
              Địa chỉ vault: <span className="font-code">{wallet.paymentWallet}</span>
            </p>
          )}
          {wallet?.warning && (
            <p role="alert" className="mt-3 text-sm font-medium text-destructive">{wallet.warning}</p>
          )}
          {wallet?.paymentWallet === null && (
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
          {wallet?.warning && (
            <p role="alert" className="mt-3 text-sm font-medium text-destructive">{wallet.warning}</p>
          )}
        </Box>
      </div>
    </>
  );
}
```

Kết quả `diff` (164 dòng mỗi bên sau khi bỏ khoảng trắng đầu dòng, dòng trống và vỏ hàm):

```text
38,39c38,39
< const token = data?.tokens[0];
< const wallet = data?.wallet;
---
> const token = data.tokens[0];
> const wallet = data.wallet;
```

Chỗ gọi trong trang (tại `b746d6f`):

```tsx
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc số liệu…
        </div>
      ) : error || !data ? (
        <p className="py-6 text-sm text-destructive">{error}</p>
      ) : (
        <SellerOverviewBody data={data} />
```

## 2. Lần dời 2 (commit `16f4c5e` và `e001470`, QĐ-9, mở rộng phạm vi đã được Supervisor duyệt)

### 2.1 `useSellerOverview`

Trước (`seller-overview.tsx` tại `862ffa5~2`, tức `bbb3e04`):

```tsx
/** Đọc tổng quan theo chuỗi đang chọn. Dùng chung cho màn Tổng quan và màn Tạo lệnh rút. */
export function useSellerOverview() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [chain, reloadKey]);

  const fresh = loaded?.key === chain ? loaded : null;
  return {
    data: fresh?.data ?? null,
    error: fresh?.error ?? null,
    loading: fresh === null,
    /** Đọc lại số dư sau một lệnh rút, giữ số cũ trên màn trong lúc chờ. */
    reload: () => setReloadKey((value) => value + 1),
  };
}
```

Sau (`components/seller/use-seller-overview.ts` tại `16f4c5e`; đoạn trước nằm nguyên văn trong tệp, 34 dòng):

```ts
'use client';

import { useEffect, useState } from 'react';
import { getSellerOverviewAction } from '@/app/actions/seller';
import type { SellerOverviewView } from '@/lib/bank/seller.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';

/** Đọc tổng quan theo chuỗi đang chọn. Dùng chung cho màn Tổng quan và màn Tạo lệnh rút. */
export function useSellerOverview() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [chain, reloadKey]);

  const fresh = loaded?.key === chain ? loaded : null;
  return {
    data: fresh?.data ?? null,
    error: fresh?.error ?? null,
    loading: fresh === null,
    /** Đọc lại số dư sau một lệnh rút, giữ số cũ trên màn trong lúc chờ. */
    reload: () => setReloadKey((value) => value + 1),
  };
}
```

### 2.2 `WITHDRAW_STATUS_LABELS`

Trước (`seller-transactions.tsx` tại `bbb3e04`):

```tsx
/** Trạng thái lệnh rút (BE-13 QĐ-E, FIX-01 G4). */
export const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  PAYOUT_SENDING: 'Đang đặt ví nhận',
  PAYOUT_SENT: 'Đang đặt ví nhận',
  PAYOUT_SET: 'Đã đặt ví nhận, chờ gửi rút',
  PAYOUT_REVIEW: 'Cần xem xét (đặt ví nhận)',
  SENDING: 'Đang gửi',
  SENT: 'Đã gửi, chờ biên nhận',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  NEEDS_REVIEW: 'Cần Kiểm soát viên xem',
};
```

Sau (`components/seller/labels.ts` tại `16f4c5e`; nguyên văn, 12 dòng):

```ts
import type { WithdrawStatus } from '@/lib/store/vault.store.port';

/** Trạng thái lệnh rút (BE-13 QĐ-E, FIX-01 G4). */
export const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  PAYOUT_SENDING: 'Đang đặt ví nhận',
  PAYOUT_SENT: 'Đang đặt ví nhận',
  PAYOUT_SET: 'Đã đặt ví nhận, chờ gửi rút',
  PAYOUT_REVIEW: 'Cần xem xét (đặt ví nhận)',
  SENDING: 'Đang gửi',
  SENT: 'Đã gửi, chờ biên nhận',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  NEEDS_REVIEW: 'Cần Kiểm soát viên xem',
};
```

### 2.3 Dòng nhập ở `seller-withdraw.tsx` (chỉ đổi các dòng này)

```diff
-import { describePolicy, nf, useSellerOverview } from './seller-overview';
-import { WITHDRAW_STATUS_LABELS } from './seller-transactions';
+import { describePolicy, nf } from '@/components/seller/format';
+import { WITHDRAW_STATUS_LABELS } from '@/components/seller/labels';
+import { useSellerOverview } from '@/components/seller/use-seller-overview';

```

Ở `16f4c5e` hai trang còn export lại tên cũ; theo quyết định Supervisor, `e001470` bỏ các dòng export lại đó (kể cả
`export { describePolicy, nf }` ở `seller-overview.tsx`) vì ngoài `seller-withdraw.tsx` không nơi nào nhập.

### 2.4 `WITHDRAW_STATUS_TONES` (commit `e001470`)

Trước (`seller-transactions.tsx` tại `e001470~1`, bảng sắc mới của QĐ-6 tạo ở `7414967`):

```tsx
/** Sắc nhãn trạng thái lệnh rút (FE-UX-05a QĐ-6): xong `ok`, hỏng `bad`, còn lại đang xử lý `warn`. */
export const WITHDRAW_STATUS_TONES: Record<WithdrawStatus, StatusTone> = {
  PAYOUT_SENDING: 'warn',
  PAYOUT_SENT: 'warn',
  PAYOUT_SET: 'warn',
  PAYOUT_REVIEW: 'warn',
  SENDING: 'warn',
  SENT: 'warn',
  COMPLETED: 'ok',
  FAILED: 'bad',
  NEEDS_REVIEW: 'warn',
};
```

Sau (`components/seller/labels.ts` tại `e001470`; nguyên văn, 12 dòng; tệp chứa cả nhãn và sắc):

```ts
import type { StatusTone } from '@/components/trading/order-status-tone';
import type { WithdrawStatus } from '@/lib/store/vault.store.port';

/** Trạng thái lệnh rút (BE-13 QĐ-E, FIX-01 G4). */
export const WITHDRAW_STATUS_LABELS: Record<WithdrawStatus, string> = {
  PAYOUT_SENDING: 'Đang đặt ví nhận',
  PAYOUT_SENT: 'Đang đặt ví nhận',
  PAYOUT_SET: 'Đã đặt ví nhận, chờ gửi rút',
  PAYOUT_REVIEW: 'Cần xem xét (đặt ví nhận)',
  SENDING: 'Đang gửi',
  SENT: 'Đã gửi, chờ biên nhận',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  NEEDS_REVIEW: 'Cần Kiểm soát viên xem',
};

/** Sắc nhãn trạng thái lệnh rút (FE-UX-05a QĐ-6): xong `ok`, hỏng `bad`, còn lại đang xử lý `warn`. */
export const WITHDRAW_STATUS_TONES: Record<WithdrawStatus, StatusTone> = {
  PAYOUT_SENDING: 'warn',
  PAYOUT_SENT: 'warn',
  PAYOUT_SET: 'warn',
  PAYOUT_REVIEW: 'warn',
  SENDING: 'warn',
  SENT: 'warn',
  COMPLETED: 'ok',
  FAILED: 'bad',
  NEEDS_REVIEW: 'warn',
};
```

### 2.5 Dòng đổi ở hai trang tại `e001470`

```diff
-export { describePolicy, nf } from '@/components/seller/format';
-export { useSellerOverview } from '@/components/seller/use-seller-overview';
-
-import { WITHDRAW_STATUSES, type WithdrawStatus } from '@/lib/store/vault.store.port';
+import { WITHDRAW_STATUSES } from '@/lib/store/vault.store.port';
-import { WITHDRAW_STATUS_LABELS } from '@/components/seller/labels';
-import { orderStatusTone, type StatusTone } from '@/components/trading/order-status-tone';
+import { WITHDRAW_STATUS_LABELS, WITHDRAW_STATUS_TONES } from '@/components/seller/labels';
+import { orderStatusTone } from '@/components/trading/order-status-tone';
-export { WITHDRAW_STATUS_LABELS } from '@/components/seller/labels';
-
-/** Sắc nhãn trạng thái lệnh rút (FE-UX-05a QĐ-6): xong `ok`, hỏng `bad`, còn lại đang xử lý `warn`. */
-export const WITHDRAW_STATUS_TONES: Record<WithdrawStatus, StatusTone> = {
-  PAYOUT_SENDING: 'warn',
-  PAYOUT_SENT: 'warn',
-  PAYOUT_SET: 'warn',
-  PAYOUT_REVIEW: 'warn',
-  SENDING: 'warn',
-  SENT: 'warn',
-  COMPLETED: 'ok',
-  FAILED: 'bad',
-  NEEDS_REVIEW: 'warn',
-};
-

```
