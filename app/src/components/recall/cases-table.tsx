'use client';

import { useState } from 'react';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RecallOverview } from '@/lib/bank/recall.service';
import { formatAmount } from '@/lib/format';
import { CASE_STATUS_LABELS } from './gates';

function Wallet({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="flex items-center gap-2 font-mono text-xs">
      <span title={value}>{value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value}</span>
      <Button variant="ghost" size="icon-xs" aria-label={`Sao chép ví ${value}`} onClick={() => void copy()}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </span>
  );
}

function shortHash(value: string): string {
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

export function RecallCasesTable({ overview }: { overview: RecallOverview }) {
  const rows = overview.cases.length > 0
    ? overview.cases.map((item) => ({ ...item, preview: false }))
    : (overview.preview?.wallets ?? []).map((item) => ({
        wallet: item.wallet,
        wptAmount: item.balance,
        burnedAmount: null,
        status: 'PREVIEW',
        txHash: null,
        reason: null,
        preview: true,
      }));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Chưa có ví ngoài vault cần thu hồi.</p>;
  const previewTotal = overview.cases.length === 0
    ? rows.reduce((sum, row) => sum + BigInt(row.wptAmount), 0n)
    : null;
  return (
    <div className="space-y-3">
      {previewTotal !== null && <p className="text-sm text-muted-foreground">Dự kiến {rows.length} ví, tổng {formatAmount(previewTotal)} WPT.</p>}
      <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ví</TableHead>
            <TableHead className="text-right">WPT</TableHead>
            <TableHead className="text-right">Đã đốt</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Giao dịch / lỗi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const url = row.txHash ? explorerTxUrl(overview.chain as ChainKey, row.txHash) : null;
            return (
              <TableRow key={row.wallet}>
                <TableCell><Wallet value={row.wallet} /></TableCell>
                <TableCell className="text-right tabular-nums">{formatAmount(row.wptAmount)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.burnedAmount ? formatAmount(row.burnedAmount) : '-'}</TableCell>
                <TableCell>{row.preview ? 'Dự kiến' : CASE_STATUS_LABELS[row.status] ?? row.status}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {url
                      ? <a className="inline-flex items-center gap-1 underline" href={url} target="_blank" rel="noreferrer">Xem giao dịch <ExternalLink className="size-3" aria-hidden="true" /></a>
                      : row.txHash
                        ? <span className="font-mono text-xs" title={row.txHash}>{shortHash(row.txHash)}</span>
                        : '-'}
                    {row.reason && <p className="text-xs text-destructive">{row.reason}</p>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
