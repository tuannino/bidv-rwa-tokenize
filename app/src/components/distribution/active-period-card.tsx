import type { ChainKey } from '@bidv/shared';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import type { ActivePeriodView } from '@/lib/bank/distribution-approval.service';
import { approvedAmountLabel } from '@/components/pages/distribution-amount-label';
import { amount, APPROVAL_STATUS, PERIOD_STATUS, VAULT_STATUS } from './display';
import { approvalStatusTone, periodStatusTone, vaultCloseStatusTone } from './status-tone';
import { TxLink } from './tx-link';

/** Ô khoá và giá trị của thẻ (FE-UX-03b: thay `Metric`); lưới tự chia cột tối thiểu 190 px. */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5 rounded-[14px] bg-muted/60 px-3.5 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={className ?? 'text-sm font-semibold tabular-nums [overflow-wrap:anywhere]'}>{children}</dd>
    </div>
  );
}

/** Chữ thay cho nhãn khi trạng thái rỗng: chữ thường, không dựng `Badge` (FE-UX-03b QĐ-4). */
const none = (text: string) => <span className="font-normal text-muted-foreground">{text}</span>;

/**
 * Thẻ "Kỳ hoạt động" (FE-UX-03b QĐ-10): dời từ `distribution-approval.tsx`. Chỉ nhận dữ liệu và callback,
 * không gọi action, không có effect; trang giữ hai callback (mở hộp duyệt lại, tiếp tục chia). Điều kiện hiện
 * nút, `disabled`, `aria-label`, `role` giữ như trước; chỉ đổi vỏ (nhãn trạng thái có sắc, ghi chú `Alert`).
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>
            <CalendarClock />
          </CardTitleIcon>
          Kỳ hoạt động
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          <Field label="Mã kỳ" className="font-code text-sm font-semibold break-all">{period.periodKey}</Field>
          <Field label="Trạng thái">
            <Badge variant={periodStatusTone(period.status)}>{PERIOD_STATUS[period.status] ?? period.status}</Badge>
          </Field>
          <Field label="Trạng thái duyệt">
            {period.approvalStatus ? (
              <Badge variant={approvalStatusTone(period.approvalStatus)}>{APPROVAL_STATUS[period.approvalStatus]}</Badge>
            ) : (
              none('Chưa có kết luận duyệt')
            )}
          </Field>
          <Field label="Số đã duyệt">{approvedAmountLabel(period, 'cell')}</Field>
          <Field label="Số thực tế trên chuỗi">{period.status === 'OPENING' ? 'chưa đọc được' : `${amount(period.totalAmount)} VNDB`}</Field>
          <Field label="Chốt kỳ vault">
            {period.vaultCloseStatus ? (
              <Badge variant={vaultCloseStatusTone(period.vaultCloseStatus)}>{VAULT_STATUS[period.vaultCloseStatus]}</Badge>
            ) : (
              none('Chưa chốt')
            )}
          </Field>
          <Field label="Đã trả">{`${amount(progress.paidAmount)} VNDB (${progress.paid} hồ sơ)`}</Field>
          <Field label="Còn phải chi / lỗi">{`${progress.outstanding} / ${progress.failed}`}</Field>
        </dl>
        <Alert tone="info" role="status" aria-label="Ghi chú kỳ hoạt động">{active.note}</Alert>
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
