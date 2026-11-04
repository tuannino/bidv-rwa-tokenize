import { Button } from '@/components/ui/button';
import type { WithdrawReviewView } from '@/lib/bank/withdraw.service';
import { amount, FIELD, short } from './display';

/**
 * Một dòng "Lệnh rút cần xem xét" (FE-UX-03c QĐ-5): dời nguyên văn từ thân `rows.map` của `WithdrawReviewCard`
 * (`vault-status.tsx`), chỉ thay ô nhập và lời chốt bằng prop. Không gọi action, không có effect; thẻ giữ
 * `field`, `setField`, `resolve` và truyền xuống.
 */
export function WithdrawReviewItem({
  row,
  canResolve,
  busy,
  txHash,
  reason,
  onChange,
  onResolve,
}: {
  row: WithdrawReviewView;
  canResolve: boolean;
  busy: boolean;
  txHash: string;
  reason: string;
  onChange: (key: 'txHash' | 'reason', value: string) => void;
  onResolve: (outcome: 'COMPLETED' | 'FAILED') => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm" data-request={row.id}>
      <p>
        <span className="font-code">{row.id.slice(0, 8)}</span>: {amount(row.amount)} VNDB tới{' '}
        <span className="font-code">{short(row.payoutWallet)}</span>, tạo lúc {new Date(row.createdAt).toLocaleString('vi-VN')}.
      </p>
      <p className="text-muted-foreground">{row.reason}</p>
      {row.status === 'PAYOUT_REVIEW' ? (
        <p className="text-xs text-muted-foreground">
          Lệnh dừng ở bước đặt ví nhận{row.payoutTxHash ? ` (giao dịch ${short(row.payoutTxHash)})` : ''}, chưa rút
          tiền: chỉ đánh dấu thất bại được, khi ví ký ngân hàng không còn giao dịch đang chờ.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sự kiện Withdrawn ứng viên (chỉ để xem, không chứng minh thuộc lệnh này):{' '}
          {row.candidates.length === 0 ? 'không có' : row.candidates.map((c) => `${short(c.txHash)} (block ${c.blockNumber})`).join(', ')}
        </p>
      )}
      {canResolve && row.status === 'PAYOUT_REVIEW' && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            aria-label={`Lý do thất bại ${row.id}`}
            placeholder="Lý do, ví dụ đã kiểm explorer"
            value={reason}
            onChange={(e) => onChange('reason', e.target.value)}
            className={`${FIELD} font-sans`}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => void onResolve('FAILED')}>
            Đánh dấu thất bại
          </Button>
        </div>
      )}
      {canResolve && row.status !== 'PAYOUT_REVIEW' && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
          <input
            aria-label={`Mã giao dịch xác nhận ${row.id}`}
            placeholder="Mã giao dịch 0x…"
            value={txHash}
            onChange={(e) => onChange('txHash', e.target.value)}
            className={FIELD}
          />
          <Button type="button" disabled={busy} onClick={() => void onResolve('COMPLETED')}>
            Xác nhận hoàn tất
          </Button>
          <input
            aria-label={`Lý do thất bại ${row.id}`}
            placeholder="Lý do, ví dụ đã kiểm explorer"
            value={reason}
            onChange={(e) => onChange('reason', e.target.value)}
            className={`${FIELD} font-sans`}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => void onResolve('FAILED')}>
            Đánh dấu thất bại
          </Button>
        </div>
      )}
    </div>
  );
}
