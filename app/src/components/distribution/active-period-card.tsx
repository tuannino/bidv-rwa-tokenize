import type { ChainKey } from '@bidv/shared';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivePeriodView } from '@/lib/bank/distribution-approval.service';
import { approvedAmountLabel } from '@/components/pages/distribution-amount-label';
import { amount, APPROVAL_STATUS, PERIOD_STATUS, VAULT_STATUS } from './display';
import { TxLink } from './tx-link';

/** Ô khoá và giá trị (dời nguyên văn từ `distribution-approval.tsx`). */
export function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-code text-sm font-semibold">{value}</dd>
    </div>
  );
}

/**
 * Thẻ "Kỳ hoạt động" (FE-UX-03b QĐ-10): dời nguyên văn từ `distribution-approval.tsx`. Chỉ nhận dữ liệu và
 * callback, không gọi action, không có effect; trang giữ hai callback (mở hộp duyệt lại, tiếp tục chia).
 */
export function ActivePeriodCard({
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
