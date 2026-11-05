import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { nf, short } from '@/components/withdraw/format';
import { PAYMENT_WITHDRAW_STATUS_LABELS } from '@/components/withdraw/labels';
import type { PaymentWithdrawView } from '@/lib/bank/payment-withdraw.service';

/** Một dòng của bảng "Lệnh rút của tôi" (`/withdraw`), dời nguyên văn từ `investor-withdraw.tsx` (FE-UX-04d QĐ-5). */
export function WithdrawRequestRow({
  row,
  chain,
  busy,
  onSend,
  onCancel,
}: {
  row: PaymentWithdrawView;
  chain: ChainKey;
  busy: boolean;
  onSend: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const txHash = row.completedTxHash ?? row.submittedTxHash;
  const url = txHash ? explorerTxUrl(chain, txHash) : null;
  return (
    <TableRow data-status={row.status}>
      <TableCell className="font-code text-xs" title={row.id}>
        {row.id.slice(0, 8)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">{new Date(row.createdAt).toLocaleString('vi-VN')}</TableCell>
      <TableCell className="text-right tabular-nums">{nf(row.amount)}</TableCell>
      <TableCell className="font-code text-xs" title={row.toWallet}>
        {short(row.toWallet)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{PAYMENT_WITHDRAW_STATUS_LABELS[row.status]}</Badge>
      </TableCell>
      <TableCell className="font-code text-xs">
        {txHash === null ? (
          ''
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            {short(txHash)}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span title={txHash}>{short(txHash)}</span>
        )}
      </TableCell>
      <TableCell className="max-w-56 text-xs text-muted-foreground">{row.reason ?? ''}</TableCell>
      <TableCell>
        {row.status === 'CREATED' ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void onSend()}>
              Gửi từ ví
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onCancel()}>
              Huỷ
            </Button>
          </div>
        ) : row.status === 'SENDING' ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Đang chờ ví ký hoặc kết quả trên chuỗi</p>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onCancel()}>
              Huỷ
            </Button>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
