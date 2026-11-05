import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { nf } from '@/components/seller/format';
import { WITHDRAW_STATUS_LABELS } from '@/components/seller/labels';
import { short } from '@/components/withdraw/format';
import type { WithdrawRequestView } from '@/lib/bank/withdraw.service';

/** Một dòng của bảng "Yêu cầu rút của tôi" (`/seller/withdraw`), dời nguyên văn từ `seller-withdraw.tsx` (FE-UX-05c QĐ-5). */
export function SellerWithdrawRow({
  row,
  chain,
  onContinue,
  onCancel,
}: {
  row: WithdrawRequestView;
  chain: ChainKey;
  onContinue: () => void;
  onCancel: () => void | Promise<void>;
}) {
  const url = row.txHash ? explorerTxUrl(chain, row.txHash) : null;
  return (
    <TableRow data-status={row.status}>
      <TableCell className="font-code text-xs" title={row.id}>
        {row.id.slice(0, 8)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{nf(row.amount)}</TableCell>
      <TableCell className="font-code text-xs" title={row.payoutWallet}>
        {short(row.payoutWallet)}
      </TableCell>
      <TableCell>{row.purpose}</TableCell>
      <TableCell>
        <Badge variant="outline" title={row.reason ?? undefined}>
          {WITHDRAW_STATUS_LABELS[row.status]}
        </Badge>
      </TableCell>
      <TableCell className="font-code text-xs">
        {row.txHash === null ? (
          ''
        ) : url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            {short(row.txHash)}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span title={row.txHash}>{short(row.txHash)}</span>
        )}
      </TableCell>
      <TableCell className="text-xs">{new Date(row.createdAt).toLocaleString('vi-VN')}</TableCell>
      <TableCell>
        {row.status === 'PAYOUT_SET' ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => onContinue()}>
              Gửi lệnh rút
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void onCancel()}>
              Huỷ
            </Button>
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
