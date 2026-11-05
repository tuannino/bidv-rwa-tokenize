import { ArrowLeftRight, Boxes, Landmark, Package, Wallet, Wind } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
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

/** Một dòng của danh sách nhãn và giá trị, kẻ ngăn giữa các dòng. */
const ROW = 'flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0';

/** `highlight`: ô còn rút được nền vàng (`tile-gold` vẽ `::before` tuyệt đối nên ô cần định vị và cắt tràn). */
function Stat({
  label,
  value,
  unit,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`space-y-1 rounded-[14px] p-3.5 ${highlight ? 'relative isolate overflow-hidden tile-gold' : 'bg-muted/60'}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular-nums text-lg font-semibold">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Box({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>{icon}</CardTitleIcon>
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
      <section className="space-y-3">
        <h2 className="flex items-center gap-2.5 text-base font-medium">
          <CardTitleIcon>
            <ArrowLeftRight />
          </CardTitleIcon>
          Token khớp lệnh trong ngày
        </h2>
        {/* Mỗi ô bọc `div.rounded-lg`: `fix-04-noi-du-lieu-that.spec.ts:64` tìm ô "Số lượng bán" theo khung này. */}
        <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
          <div className="rounded-lg">
            <Kpi
              tone="hl"
              label="Số lượng mua"
              value={nf(data.today.buyWpt)}
              unit="WPT"
              sub={`${data.today.buyCount} lệnh`}
            />
          </div>
          <div className="rounded-lg">
            <Kpi tone="gold" label="Tổng giá trị mua" value={nf(data.today.buyVnd)} unit="VNDB" />
          </div>
          <div className="rounded-lg">
            <Kpi label="Số lượng bán" value={nf(data.today.sell.wpt)} unit="WPT" sub={`${data.today.sell.count} lệnh`} />
          </div>
          <div className="rounded-lg">
            <Kpi label="Tổng giá trị bán" value={nf(data.today.sell.vnd)} unit="VNDB" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <Box title="Thông tin nguồn cung" icon={<Boxes />}>
          {token ? (
            <dl className="divide-y divide-border">
              {SUPPLY_METRICS.map(([key, label, definition]) => (
                <div key={key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <dt className="text-sm font-medium">{label}</dt>
                    <dd className="text-xs text-muted-foreground">{definition}</dd>
                  </div>
                  <dd className="text-right tabular-nums text-sm font-semibold" data-metric={key}>
                    {nf(token[key])}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có dự án trên chuỗi này.</p>
          )}
        </Box>

        <Box title="Thông tin token" icon={<Wind />}>
          {token ? (
            <dl className="divide-y divide-border text-sm">
              <div className={ROW}>
                <dt className="text-muted-foreground">Mã token</dt>
                <dd className="font-semibold">{token.tokenSymbol}</dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Dự án</dt>
                <dd className="text-right font-semibold">{token.projectName}</dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Trần phát hành</dt>
                <dd className="tabular-nums font-semibold">{nf(token.cap)}</dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Giá phát hành</dt>
                <dd className="tabular-nums font-semibold">{nf(token.issuePriceVnd)} VNDB</dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Tuổi thọ còn lại</dt>
                <dd className="font-semibold">{token.terms.remainingLifetimeYears} năm</dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Lợi tức mục tiêu</dt>
                <dd className="font-semibold">{token.terms.annualYieldPercent.toLocaleString('vi-VN')}%/năm</dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Phí giao dịch</dt>
                <dd className="font-semibold">
                  {token.terms.tradingFeePercent === 0
                    ? 'Không tính'
                    : `${token.terms.tradingFeePercent.toLocaleString('vi-VN')}%`}
                </dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Trạng thái token</dt>
                <dd>
                  <Badge variant="info">{TOKEN_STATUS_LABELS[token.tokenStatus]}</Badge>
                </dd>
              </div>
              <div className={ROW}>
                <dt className="text-muted-foreground">Trạng thái giao dịch</dt>
                <dd>
                  <Badge variant={token.tradingOpen ? 'ok' : 'warn'}>
                    {tradingStatusLabel(data.recallPhase, token.tradingOpen, 'seller')}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có dự án trên chuỗi này.</p>
          )}
        </Box>
      </div>

      <Box title="Tồn kho token" icon={<Package />}>
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

      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <Box title="Tài sản trong ví thanh toán" icon={<Wallet />}>
          <div className="grid gap-3 min-[640px]:grid-cols-2">
            <Stat
              label="Token chưa phân phối"
              value={nf(token?.undistributed)}
              unit="WPT"
              hint="Không rút qua kênh này, lệnh rút chỉ áp cho VNDB."
            />
            <Stat label="VNDB" value={nf(wallet?.paymentVnd)} unit="VNDB" />
            <Stat label="VNDB đã khoá" value={nf(wallet?.lockedVnd)} unit="VNDB" />
            <Stat label="VNDB còn rút được" value={nf(wallet?.withdrawableVnd)} unit="VNDB" highlight />
          </div>
          {wallet?.paymentWallet && (
            <p className="mt-3 break-all text-xs text-muted-foreground">
              Địa chỉ vault: <span className="font-code">{wallet.paymentWallet}</span>
            </p>
          )}
          {wallet?.warning && (
            <Alert tone="bad" role="alert" className="mt-3">
              {wallet.warning}
            </Alert>
          )}
          {wallet?.paymentWallet === null && (
            <p className="mt-3 text-xs text-muted-foreground">Chưa phát hành lần nào nên chưa có ví thanh toán.</p>
          )}
        </Box>

        <Box title="Số dư ví" icon={<Landmark />}>
          <div className="grid gap-3 min-[640px]:grid-cols-2">
            <Stat label="VNDB ví thanh toán" value={nf(wallet?.paymentVnd)} unit="VNDB" />
            <Stat label="VNDB ví chia lợi nhuận" value={nf(wallet?.profitPoolVnd)} unit="VNDB" />
            <Stat label="Phần khoá" value={nf(wallet?.lockedVnd)} unit="VNDB" />
            <Stat label="Hạn mức còn rút được" value={nf(wallet?.withdrawableVnd)} unit="VNDB" highlight />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{describePolicy(wallet?.policy ?? null)}</p>
          {wallet?.warning && (
            <Alert tone="bad" role="alert" className="mt-3">
              {wallet.warning}
            </Alert>
          )}
        </Box>
      </div>
    </>
  );
}
