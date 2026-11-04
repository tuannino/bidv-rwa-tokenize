import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { ExternalLink } from 'lucide-react';
import { short } from './display';

/** Liên kết mã giao dịch tới explorer (FE-UX-03b QĐ-10: dời nguyên văn từ `distribution-approval.tsx`). */
export function TxLink({ chain, txHash }: { chain: ChainKey; txHash: string | null }) {
  if (!txHash) return <span className="text-xs text-muted-foreground">không có</span>;
  const url = explorerTxUrl(chain, txHash);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-code text-xs underline">
      {short(txHash)}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  ) : (
    <span className="font-code text-xs" title={txHash}>{short(txHash)}</span>
  );
}
