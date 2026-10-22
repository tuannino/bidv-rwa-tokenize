'use client';

import { useEffect, useState } from 'react';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  approveDistributionAction,
  continueDistributionAction,
  getDistributionPageAction,
  listDistributionPayoutsAction,
  listDistributionPeriodsAction,
  reapproveDistributionAction,
} from '@/app/actions/distribution';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  ActivePeriodView,
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

const amount = (value: string) => BigInt(value).toLocaleString('vi-VN');
const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;
const when = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : 'chưa có');

/** Câu xác nhận bắt buộc của QĐ-F, giữ nguyên văn. */
export const CONFIRM_SCOPE =
  'Kiểm soát viên duyệt tổng số VNDB của kỳ; danh sách và tỷ lệ chỉ là dự kiến. Quyền hưởng cuối cùng chốt theo ảnh chụp trên chuỗi lúc mở kỳ.';
export const CONFIRM_TRANSFER = 'bấm duyệt sẽ chuyển tiền';

const PERIOD_STATUS: Record<string, string> = {
  OPENING: 'Đang mở trên chuỗi',
  OPEN: 'Đã mở',
  DISTRIBUTING: 'Đang chia',
  COMPLETED: 'Hoàn tất',
  EXPIRED: 'Hết hạn nhận',
  CLOSED: 'Đã đóng',
};
const APPROVAL_STATUS: Record<string, string> = {
  APPROVED: 'Đã duyệt',
  AMOUNT_CHANGED: 'Số đổi, chờ duyệt lại',
};
const VAULT_STATUS: Record<string, string> = {
  PENDING: 'Đã giữ chỗ',
  SENT: 'Đã gửi, đang đối soát',
  DONE: 'Đã chốt',
  CONFLICT: 'CONFLICT, cần xử lý tay',
};
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

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}

function TxLink({ chain, txHash }: { chain: ChainKey; txHash: string | null }) {
  if (!txHash) return <span className="text-xs text-muted-foreground">không có</span>;
  const url = explorerTxUrl(chain, txHash);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs underline">
      {short(txHash)}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  ) : (
    <span className="font-mono text-xs" title={txHash}>{short(txHash)}</span>
  );
}

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
        <p className="text-sm font-medium text-destructive">Lưu ý: {CONFIRM_TRANSFER}.</p>
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

function ActivePeriodCard({
  chain,
  active,
  canApprove,
  busy,
  onReapprove,
  onContinue,
}: {
  chain: ChainKey;
  active: ActivePeriodView;
  canApprove: boolean;
  busy: boolean;
  onReapprove: () => void;
  onContinue: () => void;
}) {
  const { period, progress } = active;
  return (
    <Card aria-label="Kỳ hoạt động">
      <CardHeader><CardTitle className="text-base">Kỳ hoạt động</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Mã kỳ" value={period.periodKey} />
          <Metric label="Trạng thái" value={PERIOD_STATUS[period.status] ?? period.status} />
          <Metric
            label="Trạng thái duyệt"
            value={period.approvalStatus ? APPROVAL_STATUS[period.approvalStatus] : 'Chưa có kết luận duyệt'}
          />
          <Metric label="Số đã duyệt" value={approvedAmountLabel(period, 'cell')} />
          <Metric label="Số thực tế trên chuỗi" value={period.status === 'OPENING' ? 'chưa đọc được' : `${amount(period.totalAmount)} VNDB`} />
          <Metric label="Chốt kỳ vault" value={period.vaultCloseStatus ? VAULT_STATUS[period.vaultCloseStatus] : 'Chưa chốt'} />
          <Metric label="Đã trả" value={`${amount(progress.paidAmount)} VNDB (${progress.paid} hồ sơ)`} />
          <Metric label="Còn phải chi / lỗi" value={`${progress.outstanding} / ${progress.failed}`} />
        </dl>
        <p className="text-sm" role="status" aria-label="Ghi chú kỳ hoạt động">{active.note}</p>
        {active.pendingOnChain && (
          <p className="text-sm text-muted-foreground">
            Đã gửi lên chuỗi, đang đối soát
            {period.openTxHash && period.status === 'OPENING' ? <> (mở kỳ <TxLink chain={chain} txHash={period.openTxHash} />)</> : null}
            {period.vaultCloseStatus === 'SENT' ? <> (chốt vault <TxLink chain={chain} txHash={period.vaultCloseTxHash} />)</> : null}.
          </p>
        )}
        {canApprove && active.nextAction === 'REAPPROVE' && period.status !== 'OPENING' && (
          <Button onClick={onReapprove} disabled={busy}>
            Duyệt lại số thực tế {amount(period.totalAmount)} VNDB
          </Button>
        )}
        {canApprove && active.nextAction === 'CONTINUE' && (
          <Button onClick={onContinue} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Tiếp tục chia
          </Button>
        )}
      </CardContent>
    </Card>
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
  if (!result.ok) return <p role="alert" className="text-sm text-destructive">{result.error}</p>;
  const pages = Math.max(1, Math.ceil(result.data.total / result.data.pageSize));
  return (
    <div className="space-y-2">
      <Table aria-label="Hồ sơ trả từng ví">
        <TableHeader><TableRow>
          <TableHead>Ví</TableHead><TableHead className="text-right">WPT tại ảnh chụp</TableHead>
          <TableHead className="text-right">Số chia (VNDB)</TableHead><TableHead>Trạng thái</TableHead><TableHead>Giao dịch</TableHead>
        </TableRow></TableHeader>
        <TableBody>{result.data.rows.map((row) => (
          <TableRow key={row.investorWallet}>
            <TableCell className="font-mono text-xs" title={row.investorWallet}>{short(row.investorWallet)}</TableCell>
            <TableCell className="text-right font-mono">{amount(row.balanceAt)}</TableCell>
            <TableCell className="text-right font-mono">{amount(row.amount)}</TableCell>
            <TableCell>{PAYOUT_STATUS[row.status] ?? row.status}</TableCell>
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
  return (
    <Card aria-label="Lịch sử kỳ chia">
      <CardHeader><CardTitle className="text-base">Lịch sử kỳ chia</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">Đang đọc lịch sử…</p>
        ) : !result.ok ? (
          <p role="alert" className="text-sm text-destructive">{result.error}</p>
        ) : result.data.total === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có kỳ chia nào trên chain này.</p>
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
                  <TableCell className="font-mono text-xs">{period.periodKey}</TableCell>
                  <TableCell>{PERIOD_STATUS[period.status] ?? period.status}</TableCell>
                  <TableCell>{period.approvalStatus ? APPROVAL_STATUS[period.approvalStatus] : 'Chưa duyệt'}</TableCell>
                  <TableCell className="font-mono text-xs">{period.approvedBy ?? 'không có'}</TableCell>
                  <TableCell className="text-xs">{when(period.approvedAt)}</TableCell>
                  <TableCell className="text-right font-mono">{approvedAmountLabel(period, 'table')}</TableCell>
                  <TableCell className="text-right font-mono">{amount(period.totalAmount)}</TableCell>
                  <TableCell className="text-right font-mono">{period.reapprovedFrom ? amount(period.reapprovedFrom) : 'không'}</TableCell>
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

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Lịch chạy (20 lượt gần nhất)</h3>
          {!runLog.ok ? (
            <p role="alert" className="text-sm text-destructive">{runLog.error}</p>
          ) : runLog.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lượt chạy nào.</p>
          ) : (
            <Table aria-label="Lịch chạy">
              <TableHeader><TableRow>
                <TableHead>Kỳ</TableHead><TableHead className="text-right">Vòng</TableHead><TableHead>Nguồn</TableHead>
                <TableHead>Kết quả</TableHead><TableHead>Bắt đầu</TableHead><TableHead>Lỗi</TableHead>
              </TableRow></TableHeader>
              <TableBody>{runLog.data.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-xs">{run.periodKey ?? 'vòng rỗng'}</TableCell>
                  <TableCell className="text-right font-mono">{run.runNo}</TableCell>
                  <TableCell>{run.triggerSource === 'MANUAL' ? 'Kiểm soát viên' : 'Keeper'}</TableCell>
                  <TableCell>{run.status}</TableCell>
                  <TableCell className="text-xs">{when(run.startedAt)}</TableCell>
                  <TableCell className="text-xs">{run.error ?? ''}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
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
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Chia lợi nhuận</h1>
        <p className="text-sm text-muted-foreground">
          Kiểm soát viên duyệt tổng số VNDB của kỳ trên chain <span className="font-mono">{chain}</span>; hệ thống chốt kỳ vault rồi
          mới chia cho người nắm giữ WPT.
        </p>
      </header>

      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} aria-label="Kết quả thao tác chia" className={message.tone === 'error' ? 'text-sm text-destructive' : 'text-sm'}>
          {message.text}
        </p>
      )}

      {fresh === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc quỹ chia…
        </div>
      ) : !fresh.ok ? (
        <p role="alert" className="text-sm text-destructive">{fresh.error}</p>
      ) : data ? (
        <>
          {!data.supported ? (
            <Card><CardContent className="pt-6 text-sm">{data.approveBlockers.join(' ')}</CardContent></Card>
          ) : (
            <>
              <Card aria-label="Quỹ chia">
                <CardHeader><CardTitle className="text-base">Quỹ chia</CardTitle></CardHeader>
                <CardContent>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Số dư quỹ" value={`${amount(data.pool!.poolBalance)} VNDB`} />
                    <Metric label="Tổng dự trữ các kỳ" value={`${amount(data.pool!.reservedBalance)} VNDB`} />
                    <Metric label="Chưa phân bổ" value={`${amount(data.pool!.unallocatedBalance)} VNDB`} />
                    <Metric label="Ngưỡng tối thiểu" value={`${amount(data.pool!.threshold)} VNDB`} />
                  </dl>
                </CardContent>
              </Card>

              <Card aria-label="Dự kiến">
                <CardHeader><CardTitle className="text-base">Dự kiến (tham khảo)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Theo số dư WPT hiện tại trên tổng cung {amount(data.forecast!.totalSupply)} WPT. Quyền hưởng cuối cùng chốt theo ảnh
                    chụp trên chuỗi lúc mở kỳ. Tổng dự kiến {amount(data.forecast!.allocated)} VNDB, phần dư làm tròn{' '}
                    {amount(data.forecast!.dust)} VNDB.
                  </p>
                  {data.forecast!.truncated && (
                    <p role="alert" className="text-sm text-destructive">Danh sách người nhận bị cắt nên không đầy đủ; nút duyệt bị khoá.</p>
                  )}
                  <Table aria-label="Người nhận dự kiến">
                    <TableHeader><TableRow>
                      <TableHead>Ví</TableHead><TableHead className="text-right">WPT hiện tại</TableHead><TableHead className="text-right">Phần dự kiến (VNDB)</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{data.forecast!.rows.map((row) => (
                      <TableRow key={row.wallet}>
                        <TableCell className="font-mono text-xs" title={row.wallet}>{short(row.wallet)}{row.isVault ? ' (vault)' : ''}</TableCell>
                        <TableCell className="text-right font-mono">{amount(row.balance)}</TableCell>
                        <TableCell className="text-right font-mono">{amount(row.share)}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {data.viewerCanApprove && (
            <Card aria-label="Duyệt chia">
              <CardHeader><CardTitle className="text-base">Duyệt chia</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.approveBlockers.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground" aria-label="Lý do chưa duyệt được">
                    {data.approveBlockers.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
                <Button
                  disabled={busy || data.approveBlockers.length > 0 || !data.pool}
                  onClick={() => setConfirm({ kind: 'approve', amount: data.pool!.unallocatedBalance })}
                >
                  Duyệt chia {data.pool ? amount(data.pool.unallocatedBalance) : '0'} VNDB
                </Button>
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
