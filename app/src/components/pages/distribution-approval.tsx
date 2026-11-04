'use client';

import { useEffect, useState } from 'react';
import type { ChainKey } from '@bidv/shared';
import { History, Landmark, Loader2, ShieldCheck, Timer, TriangleAlert, Users } from 'lucide-react';
import {
  approveDistributionAction,
  continueDistributionAction,
  getDistributionPageAction,
  listDistributionPayoutsAction,
  listDistributionPeriodsAction,
  reapproveDistributionAction,
} from '@/app/actions/distribution';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Kpi } from '@/components/ui/kpi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  DistributionApprovalView,
  DistributionHistoryRow,
  DistributionPageView,
  PageView,
  PayoutRowView,
} from '@/lib/bank/distribution-approval.service';
import type { DistributionRunLogView } from '@/lib/bank/distribution-trigger.service';
import type { Result } from '@/lib/bank/result';
import { approvedAmountLabel } from '@/components/pages/distribution-amount-label';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { cn } from '@/lib/utils';
import { TokenScopeSelect } from '@/components/token/token-scope-select';
import { ActivePeriodCard } from '@/components/distribution/active-period-card';
import { amount, APPROVAL_STATUS, PERIOD_STATUS, short } from '@/components/distribution/display';
import { approvalStatusTone, payoutStatusTone, periodStatusTone, runStatusTone } from '@/components/distribution/status-tone';
import { TxLink } from '@/components/distribution/tx-link';

/**
 * Màn CHIA LỢI NHUẬN (FE-08 QĐ-F).
 *
 * Hiệu năng: khi mở và khi tải lại sau một thao tác, màn gọi ĐÚNG MỘT server action
 * (`getDistributionPageAction`, ba phần với kết quả riêng); Next xếp hàng action nối tiếp nên ba action
 * là ba lượt Worker chờ nhau (HF-01). Đổi trang lịch sử, xem hồ sơ một kỳ mới gọi action riêng.
 *
 * Mọi con số do máy chủ trả về (quỹ, dự kiến theo `shareOf`, kỳ hoạt động, lý do chưa duyệt được);
 * màn chỉ hiển thị và định dạng. Kiểm soát viên duyệt TỔNG SỐ của kỳ; danh sách dự kiến chỉ để
 * tham khảo (QĐ-G). Nút khoá trong lúc một thao tác đang chạy; tải lại trang đọc lại trạng thái bền
 * nên tiếp tục được từ kỳ `OPENING`, vault `SENT`, hồ sơ `SENT`.
 */

const when = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : 'chưa có');

/** Câu xác nhận bắt buộc của QĐ-F, giữ nguyên văn. */
export const CONFIRM_SCOPE =
  'Kiểm soát viên duyệt tổng số VNDB của kỳ; danh sách và tỷ lệ chỉ là dự kiến. Quyền hưởng cuối cùng chốt theo ảnh chụp trên chuỗi lúc mở kỳ.';
export const CONFIRM_TRANSFER = 'bấm duyệt sẽ chuyển tiền';

const PAYOUT_STATUS: Record<string, string> = {
  PENDING: 'Chờ gửi',
  SENT: 'Đã gửi, đang đối soát',
  PAID: 'Đã trả',
  FAILED: 'Lỗi, chờ chia lại',
  EXPIRED: 'Hết hạn',
};
const OUTCOME: Record<DistributionApprovalView['outcome'], string> = {
  DISTRIBUTED: 'Kỳ đã chia xong.',
  PARTIAL: 'Đã chia một phần; bấm Tiếp tục chia để chia nốt.',
  AMOUNT_CHANGED: 'Số trên chuỗi khác số đã duyệt; không chia gì, cần duyệt lại số thực tế.',
  VAULT_PENDING: 'Đang chốt kỳ vault; chưa gửi lô nào.',
  VAULT_CONFLICT: 'Kỳ vault CONFLICT, cần xử lý tay; không gửi lô nào.',
  PERIOD_ENDED: 'Kỳ đã hết hạn nhận hoặc đã đóng trên chuỗi.',
  ALREADY_RUNNING: 'Một lượt khác đang chạy cho kỳ này; tải lại sau.',
};

/** Tiêu đề thẻ có biểu tượng tròn (FE-UX-03b QĐ-6). */
function CardHeading({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <CardTitle className={cn('flex items-center gap-2.5 text-base', className)}>
      <CardTitleIcon>{icon}</CardTitleIcon>
      {children}
    </CardTitle>
  );
}

/** Chữ thay cho nhãn khi trạng thái rỗng: chữ thường, không dựng `Badge` (FE-UX-03b QĐ-4). */
const none = (text: string) => <span className="text-muted-foreground">{text}</span>;

/** Hộp xác nhận trước mọi lần duyệt: nói rõ phạm vi duyệt và việc bấm sẽ chuyển tiền (QĐ-F, QĐ-G). */
function ConfirmDialog({
  open,
  title,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{CONFIRM_SCOPE}</DialogDescription>
        </DialogHeader>
        <Alert tone="bad">Lưu ý: {CONFIRM_TRANSFER}.</Alert>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Duyệt và chia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayoutsTable({ chain, periodId }: { chain: ChainKey; periodId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ key: string; result: Result<PageView<PayoutRowView>> } | null>(null);
  const key = `${periodId}:${page}`;

  useEffect(() => {
    let cancelled = false;
    void listDistributionPayoutsAction({ chain, periodId, page, pageSize: 10 }).then((result) => {
      if (!cancelled) setData({ key, result });
    });
    return () => {
      cancelled = true;
    };
  }, [chain, periodId, page, key]);

  const result = data?.key === key ? data.result : null;
  if (!result) return <p className="text-sm text-muted-foreground">Đang đọc hồ sơ trả…</p>;
  if (!result.ok) return <Alert tone="bad" role="alert">{result.error}</Alert>;
  const pages = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));
  return (
    <div className="space-y-3 rounded-[18px] bg-muted/60 p-4">
      <Table aria-label="Hồ sơ trả từng ví">
        <TableHeader><TableRow>
          <TableHead>Ví</TableHead><TableHead className="text-right">WPT tại ảnh chụp</TableHead>
          <TableHead className="text-right">Số chia (VNDB)</TableHead><TableHead>Trạng thái</TableHead><TableHead>Giao dịch</TableHead>
        </TableRow></TableHeader>
        <TableBody>{result.data.rows.map((row) => (
          <TableRow key={row.investorWallet}>
            <TableCell className="font-code text-xs" title={row.investorWallet}>{short(row.investorWallet)}</TableCell>
            <TableCell className="text-right tabular-nums">{amount(row.balanceAt)}</TableCell>
            <TableCell className="text-right tabular-nums">{amount(row.amount)}</TableCell>
            <TableCell><Badge variant={payoutStatusTone(row.status)}>{PAYOUT_STATUS[row.status] ?? row.status}</Badge></TableCell>
            <TableCell><TxLink chain={chain} txHash={row.txHash} /></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
      <div className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</Button>
        <span>Trang {page}/{pages} ({result.data.total} ví)</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Trang sau</Button>
      </div>
    </div>
  );
}

const HISTORY_PAGE_SIZE = 10;

function HistoryCard({
  chain,
  initial,
  runLog,
}: {
  chain: ChainKey;
  /** Trang 1 của lịch sử, đọc cùng lượt mở màn. */
  initial: Result<PageView<DistributionHistoryRow>>;
  runLog: Result<DistributionRunLogView[]>;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<{ page: number; result: Result<PageView<DistributionHistoryRow>> } | null>(null);

  /** Đổi trang là thao tác của người xem: lúc đó mới gọi action riêng cho trang lịch sử. */
  function goTo(next: number) {
    setPage(next);
    if (next === 1) return;
    void listDistributionPeriodsAction({ chain, page: next, pageSize: HISTORY_PAGE_SIZE }).then((result) =>
      setData({ page: next, result }),
    );
  }

  const result = page === 1 ? initial : data?.page === page ? data.result : null;
  const pages = result?.ok ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize)) : 1;
  // Thẻ "Lịch chạy" tách riêng ngay dưới, vẫn do thành phần này trả (FE-UX-03b QĐ-6): cùng dữ liệu, không gọi thêm.
  return (
    <>
      <Card aria-label="Lịch sử kỳ chia">
        <CardHeader><CardHeading icon={<History />}>Lịch sử kỳ chia</CardHeading></CardHeader>
        <CardContent className="space-y-4">
          {!result ? (
            <p className="text-sm text-muted-foreground">Đang đọc lịch sử…</p>
          ) : !result.ok ? (
            <Alert tone="bad" role="alert">{result.error}</Alert>
          ) : result.data.total === 0 ? (
            <EmptyState>Chưa có kỳ chia nào trên chain này.</EmptyState>
          ) : (
            <>
              <Table aria-label="Danh sách kỳ chia">
                <TableHeader><TableRow>
                  <TableHead>Mã kỳ</TableHead><TableHead>Trạng thái</TableHead><TableHead>Duyệt</TableHead>
                  <TableHead>Người duyệt</TableHead><TableHead>Thời điểm duyệt</TableHead>
                  <TableHead className="text-right">Số duyệt</TableHead><TableHead className="text-right">Số thực tế</TableHead>
                  <TableHead className="text-right">Duyệt lại từ</TableHead><TableHead>Nguồn kích hoạt</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>{result.data.rows.map(({ period, triggerSources }) => (
                  <TableRow key={period.id} data-period={period.periodKey}>
                    <TableCell className="font-code text-xs">{period.periodKey}</TableCell>
                    <TableCell><Badge variant={periodStatusTone(period.status)}>{PERIOD_STATUS[period.status] ?? period.status}</Badge></TableCell>
                    <TableCell>
                      {period.approvalStatus ? (
                        <Badge variant={approvalStatusTone(period.approvalStatus)}>{APPROVAL_STATUS[period.approvalStatus]}</Badge>
                      ) : (
                        none('Chưa duyệt')
                      )}
                    </TableCell>
                    <TableCell className="font-code text-xs">{period.approvedBy ?? 'không có'}</TableCell>
                    <TableCell className="text-xs">{when(period.approvedAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{approvedAmountLabel(period, 'table')}</TableCell>
                    <TableCell className="text-right tabular-nums">{amount(period.totalAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{period.reapprovedFrom ? amount(period.reapprovedFrom) : 'không'}</TableCell>
                    <TableCell className="text-xs">{triggerSources.length ? triggerSources.map((s) => (s === 'MANUAL' ? 'Kiểm soát viên' : 'Keeper')).join(', ') : 'chưa chạy'}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setSelected(selected === period.id ? null : period.id)}>
                        {selected === period.id ? 'Ẩn hồ sơ' : 'Xem hồ sơ'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              <div className="flex items-center gap-2 text-sm">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>Trang trước</Button>
                <span>Trang {page}/{pages} ({result.data.total} kỳ)</span>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => goTo(page + 1)}>Trang sau</Button>
              </div>
              {selected && <PayoutsTable key={selected} chain={chain} periodId={selected} />}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardHeading icon={<Timer />}>Lịch chạy (20 lượt gần nhất)</CardHeading></CardHeader>
        <CardContent>
          {!runLog.ok ? (
            <Alert tone="bad" role="alert">{runLog.error}</Alert>
          ) : runLog.data.length === 0 ? (
            <EmptyState>Chưa có lượt chạy nào.</EmptyState>
          ) : (
            <Table aria-label="Lịch chạy">
              <TableHeader><TableRow>
                <TableHead>Kỳ</TableHead><TableHead className="text-right">Vòng</TableHead><TableHead>Nguồn</TableHead>
                <TableHead>Kết quả</TableHead><TableHead>Bắt đầu</TableHead><TableHead>Lỗi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{runLog.data.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-code text-xs">{run.periodKey ?? 'vòng rỗng'}</TableCell>
                  <TableCell className="text-right tabular-nums">{run.runNo}</TableCell>
                  <TableCell>{run.triggerSource === 'MANUAL' ? 'Kiểm soát viên' : 'Keeper'}</TableCell>
                  <TableCell><Badge variant={runStatusTone(run.status)}>{run.status}</Badge></TableCell>
                  <TableCell className="text-xs">{when(run.startedAt)}</TableCell>
                  <TableCell className="text-xs">{run.error ?? ''}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function DistributionApprovalPage() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; result: Result<DistributionPageView> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: 'approve' | 'reapprove'; amount: string; periodId?: string }>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const key = `${chain}:${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    // ĐÚNG MỘT action khi mở và khi tải lại: ba phần, mỗi phần một kết quả riêng.
    void getDistributionPageAction({ chain, page: 1, pageSize: HISTORY_PAGE_SIZE, runLimit: 20 }).then((result) => {
      if (!cancelled) setLoaded({ key, result });
    });
    return () => {
      cancelled = true;
    };
  }, [chain, key]);

  const pageData = loaded?.key === key ? loaded.result : null;
  // Lỗi của cả lượt (dữ liệu vào sai) thì mọi khối cùng hiện lỗi đó; còn lại mỗi khối một kết quả.
  const fresh = pageData === null ? null : pageData.ok ? pageData.data.overview : pageData;
  const data = fresh?.ok ? fresh.data : null;

  async function run(action: () => Promise<Result<DistributionApprovalView>>) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    setBusy(false);
    setConfirm(null);
    setMessage(
      result.ok
        ? { tone: result.data.outcome === 'DISTRIBUTED' ? 'ok' : 'error', text: `${OUTCOME[result.data.outcome]} ${result.data.message}` }
        : { tone: 'error', text: result.error },
    );
    setReloadKey((value) => value + 1);
  }

  const confirmAction = () => {
    if (!confirm) return;
    void run(() =>
      confirm.kind === 'approve'
        ? approveDistributionAction({ chain, expectedAmount: confirm.amount })
        : reapproveDistributionAction({ chain, periodId: confirm.periodId, amount: confirm.amount }),
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Chia lợi nhuận</h1>
        <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
      </header>

      {message && (
        <Alert
          tone={message.tone === 'error' ? 'bad' : 'ok'}
          role={message.tone === 'error' ? 'alert' : 'status'}
          aria-label="Kết quả thao tác chia"
        >
          {message.text}
        </Alert>
      )}

      {fresh === null ? (
        <EmptyState loading>Đang đọc quỹ chia…</EmptyState>
      ) : !fresh.ok ? (
        <Alert tone="bad" role="alert">{fresh.error}</Alert>
      ) : data ? (
        <>
          {/* Quỹ chia (4 ô) và thẻ Duyệt chia cùng một lưới 12 cột từ 1100 px; dưới đó một cột. */}
          <div className="grid gap-4 min-[1100px]:grid-cols-12">
            {!data.supported ? (
              <Card className="min-[1100px]:col-span-12">
                <CardContent>
                  <EmptyState icon={<Landmark />}>{data.approveBlockers.join(' ')}</EmptyState>
                </CardContent>
              </Card>
            ) : (
              <>
                <CardHeading icon={<Landmark />} className="min-[1100px]:col-span-12">Quỹ chia</CardHeading>
                <div
                  aria-label="Quỹ chia"
                  className={cn(
                    'grid gap-4 min-[640px]:grid-cols-2',
                    data.viewerCanApprove ? 'min-[1100px]:col-span-8' : 'min-[1100px]:col-span-12',
                  )}
                >
                  <Kpi
                    label="Số dư quỹ"
                    value={amount(data.pool!.poolBalance)}
                    unit="VNDB"
                    tone="au"
                    size="lg"
                    className="min-[640px]:row-span-2"
                  />
                  <Kpi label="Chưa phân bổ" value={amount(data.pool!.unallocatedBalance)} unit="VNDB" tone="gold" />
                  <Kpi label="Tổng dự trữ các kỳ" value={amount(data.pool!.reservedBalance)} unit="VNDB" />
                  <Kpi
                    label="Ngưỡng tối thiểu"
                    value={amount(data.pool!.threshold)}
                    unit="VNDB"
                    className="min-[640px]:col-span-2"
                  />
                </div>
              </>
            )}

            {data.viewerCanApprove && (
              <Card
                aria-label="Duyệt chia"
                className={data.supported ? 'min-[1100px]:col-span-4' : 'min-[1100px]:col-span-12'}
              >
                <CardHeader><CardHeading icon={<ShieldCheck />}>Duyệt chia</CardHeading></CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  {data.approveBlockers.length > 0 && (
                    <ul className="divide-y divide-border/60" aria-label="Lý do chưa duyệt được">
                      {data.approveBlockers.map((reason) => (
                        <li key={reason} className="flex items-start gap-2.5 py-2 text-sm first:pt-0 last:pb-0">
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad-ink" aria-hidden="true" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    className="mt-auto w-full"
                    disabled={busy || data.approveBlockers.length > 0 || !data.pool}
                    onClick={() => setConfirm({ kind: 'approve', amount: data.pool!.unallocatedBalance })}
                  >
                    Duyệt chia {data.pool ? amount(data.pool.unallocatedBalance) : '0'} VNDB
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {data.supported && (
            <Card tone="tint" aria-label="Dự kiến">
              <CardHeader><CardHeading icon={<Users />}>Dự kiến (tham khảo)</CardHeading></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Theo số dư WPT hiện tại trên tổng cung {amount(data.forecast!.totalSupply)} WPT. Quyền hưởng cuối cùng chốt theo ảnh
                  chụp trên chuỗi lúc mở kỳ. Tổng dự kiến {amount(data.forecast!.allocated)} VNDB, phần dư làm tròn{' '}
                  {amount(data.forecast!.dust)} VNDB.
                </p>
                {data.forecast!.truncated && (
                  <Alert tone="warn" role="alert">Danh sách người nhận bị cắt nên không đầy đủ; nút duyệt bị khoá.</Alert>
                )}
                {/* Bảng cuộn dọc tối đa 280 px: lớp nhắm khung bảng sẵn có của `ui/table` (requirements QĐ-6). */}
                <div className="overflow-hidden rounded-[18px] bg-card px-2 [&_[data-slot=table-container]]:max-h-[280px] [&_[data-slot=table-container]]:overflow-y-auto">
                  <Table aria-label="Người nhận dự kiến">
                    <TableHeader className="sticky top-0 z-10 bg-card"><TableRow>
                      <TableHead>Ví</TableHead><TableHead className="text-right">WPT hiện tại</TableHead><TableHead className="text-right">Phần dự kiến (VNDB)</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{data.forecast!.rows.map((row) => (
                      <TableRow key={row.wallet}>
                        <TableCell className="font-code text-xs" title={row.wallet}>{short(row.wallet)}{row.isVault ? ' (vault)' : ''}</TableCell>
                        <TableCell className="text-right tabular-nums">{amount(row.balance)}</TableCell>
                        <TableCell className="text-right tabular-nums">{amount(row.share)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {data.active && (
            <ActivePeriodCard
              chain={chain}
              active={data.active}
              canApprove={data.viewerCanApprove}
              busy={busy}
              onReapprove={() =>
                setConfirm({ kind: 'reapprove', amount: data.active!.period.totalAmount, periodId: data.active!.period.id })
              }
              onContinue={() => void run(() => continueDistributionAction({ chain, periodId: data.active!.period.id }))}
            />
          )}

          {pageData?.ok && (
            <HistoryCard key={key} chain={chain} initial={pageData.data.periods} runLog={pageData.data.runs} />
          )}

          <ConfirmDialog
            open={confirm !== null}
            title={
              confirm?.kind === 'reapprove'
                ? `Duyệt lại số thực tế ${confirm ? amount(confirm.amount) : ''} VNDB`
                : `Duyệt chia ${confirm ? amount(confirm.amount) : ''} VNDB`
            }
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={confirmAction}
          />
        </>
      ) : null}
    </div>
  );
}
