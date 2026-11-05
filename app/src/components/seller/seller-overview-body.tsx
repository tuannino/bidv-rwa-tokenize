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
              hint="Không rút qua kênh này — lệnh rút chỉ áp cho VNDB."
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
