'use client';

import { useEffect, useState } from 'react';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getVaultConfigHistoryAction, getVaultOverviewAction, saveVaultConfigAction } from '@/app/actions/vault';
import {
  listWithdrawReviewsAction,
  reconcileWithdrawRequestsAction,
  resolveWithdrawRequestAction,
} from '@/app/actions/withdraw';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  VaultConfigFormView,
  VaultConfigHistoryPage,
  VaultConfigHistoryRow,
  VaultConfigStepView,
  VaultOverviewView,
  VaultStatusView,
} from '@/lib/bank/vault.service';
import type { WithdrawReviewView } from '@/lib/bank/withdraw.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';

const amount = (value: string) => BigInt(value).toLocaleString('vi-VN');
const percent = (bps: string) => `${Number(bps) / 100}%`;
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

const MODE_LABEL = {
  UNSET: 'Chưa cấu hình, khoá toàn bộ',
  FIXED: 'Khoá số tiền cố định',
  PERCENT: 'Khoá theo tỷ lệ kỳ',
} as const;

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}

const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

/**
 * Mục "Cấu hình khoá" (BE-13 QĐ-C). Máy chủ kiểm lại mọi ô, đọc trạng thái chuỗi và chỉ gửi giao
 * dịch còn khác; màn chỉ gửi ba ô dạng chuỗi.
 */
function VaultConfigCard({
  chain,
  status,
  config,
  onSaved,
}: {
  chain: ChainKey;
  status: VaultStatusView;
  config: VaultConfigFormView;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ percent: config.percent, fixedLock: config.fixedLock, payoutWallet: config.payoutWallet });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<
    | { tone: 'ok'; message: string; steps: VaultConfigStepView[] }
    | { tone: 'error'; message: string; fieldErrors: Record<string, string[]> }
    | null
  >(null);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const fieldError = (key: string) =>
    result?.tone === 'error' ? result.fieldErrors[key]?.join(' ') : undefined;
  const disabled = !config.canConfigure || saving;
  const afterFirstPeriod = BigInt(status.lastPeriodRef) > 0n;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    const saved = await saveVaultConfigAction({ chain, ...form });
    setSaving(false);
    if (saved.ok) {
      setResult({
        tone: 'ok',
        message: saved.data.outcome === 'NO_CHANGE' ? 'Chuỗi đã đúng cấu hình này, không gửi giao dịch nào.' : 'Đã lưu cấu hình lên chuỗi.',
        steps: saved.data.steps,
      });
      onSaved();
    } else {
      setResult({ tone: 'error', message: saved.error, fieldErrors: saved.fieldErrors ?? {} });
      if (saved.code === 'LEDGER') onSaved();
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cấu hình khoá</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Có số khoá cố định thì vault khoá đúng số đó (FIXED); để trống thì khoá theo tỷ lệ PERCENT trên thu ròng
          của kỳ. {afterFirstPeriod
            ? 'Vault đã qua kỳ chia đầu: tỷ lệ mới chỉ được ghi chờ, có hiệu lực ở lần chốt kỳ kế tiếp; trong lúc đó khoá vẫn theo tỷ lệ đang áp.'
            : 'Vault chưa qua kỳ chia nào: tỷ lệ mới có hiệu lực ngay.'}
        </p>
        {!config.canConfigure && (
          <p className="text-sm text-muted-foreground">Chỉ Kiểm soát viên lưu được cấu hình; vai của bạn chỉ xem.</p>
        )}
        {config.busy && (
          <p role="status" className="text-sm text-muted-foreground">
            Vault đang có thao tác khác ({config.busy.kind === 'WITHDRAW' ? 'lệnh rút đang dở' : 'lần lưu cấu hình khác'}) từ{' '}
            {new Date(config.busy.acquiredAt).toLocaleString('vi-VN')}.
          </p>
        )}
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-3" aria-label="Biểu mẫu cấu hình khoá">
          <div className="space-y-1.5">
            <label htmlFor="vault-percent" className="text-sm font-medium">Tỷ lệ khoá PERCENT (%)</label>
            <input id="vault-percent" inputMode="decimal" value={form.percent} onChange={set('percent')} disabled={disabled} className={FIELD} />
            {fieldError('percent') && <p role="alert" className="text-xs text-destructive">{fieldError('percent')}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="vault-fixed" className="text-sm font-medium">Số khoá cố định (VNDB, để trống được)</label>
            <input id="vault-fixed" inputMode="numeric" value={form.fixedLock} onChange={set('fixedLock')} disabled={disabled} className={FIELD} />
            {fieldError('fixedLock') && <p role="alert" className="text-xs text-destructive">{fieldError('fixedLock')}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="vault-payout" className="text-sm font-medium">Ví nhận tiền rút</label>
            <input id="vault-payout" spellCheck={false} value={form.payoutWallet} onChange={set('payoutWallet')} disabled={disabled} className={FIELD} />
            {fieldError('payoutWallet') && <p role="alert" className="text-xs text-destructive">{fieldError('payoutWallet')}</p>}
          </div>
          {config.canConfigure && (
            <div className="sm:col-span-3">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Lưu cấu hình khoá
              </Button>
            </div>
          )}
        </form>
        {result && (
          <div role={result.tone === 'error' ? 'alert' : 'status'} aria-label="Kết quả lưu cấu hình" className="space-y-2 text-sm">
            <p className={result.tone === 'error' ? 'text-destructive' : 'text-foreground'}>{result.message}</p>
            {result.tone === 'ok' && result.steps.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5">
                {result.steps.map((step) => (
                  <li key={step.txHash}>
                    {step.label}: {step.detail} <span className="font-mono text-xs">({short(step.txHash)})</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Lệnh rút cần xem xét" (BE-13 QĐ-F). Vai vận hành bấm đối soát; chỉ Kiểm soát viên chốt: xác nhận
 * hoàn tất bằng mã giao dịch đúng (máy chủ đọc biên nhận và sự kiện) hoặc đánh dấu thất bại có lý do.
 * Sự kiện ứng viên chỉ để xem: chúng không mang mã lệnh nên không chứng minh được thuộc lệnh nào.
 */
function WithdrawReviewCard({ chain, canResolve, onChanged }: { chain: ChainKey; canResolve: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<WithdrawReviewView[] | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [inputs, setInputs] = useState<Record<string, { txHash: string; reason: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await listWithdrawReviewsAction({ chain });
    if (result.ok) setRows(result.data);
    else setMessage({ tone: 'error', text: result.error });
  };

  useEffect(() => {
    let cancelled = false;
    void listWithdrawReviewsAction({ chain }).then((result) => {
      if (cancelled) return;
      if (result.ok) setRows(result.data);
      else setMessage({ tone: 'error', text: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const field = (id: string) => inputs[id] ?? { txHash: '', reason: '' };
  const setField = (id: string, key: 'txHash' | 'reason', value: string) =>
    setInputs((current) => ({ ...current, [id]: { ...field(id), [key]: value } }));

  async function reconcile() {
    setBusy(true);
    const result = await reconcileWithdrawRequestsAction({ chain });
    setBusy(false);
    setMessage(result.ok ? { tone: 'ok', text: 'Đã đối soát các lệnh rút chưa kết thúc.' } : { tone: 'error', text: result.error });
    await load();
    onChanged();
  }

  async function resolve(id: string, outcome: 'COMPLETED' | 'FAILED') {
    setBusy(true);
    const { txHash, reason } = field(id);
    const result = await resolveWithdrawRequestAction({ chain, id, outcome, txHash, reason });
    setBusy(false);
    setMessage(
      result.ok
        ? { tone: 'ok', text: `Lệnh rút ${id.slice(0, 8)} đã chốt: ${result.data.status === 'COMPLETED' ? 'hoàn tất' : 'thất bại'}.` }
        : { tone: 'error', text: result.error },
    );
    await load();
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Lệnh rút cần xem xét</CardTitle>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void reconcile()}>
          Đối soát lệnh rút
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {message && (
          <p role={message.tone === 'error' ? 'alert' : 'status'} className={message.tone === 'error' ? 'text-sm text-destructive' : 'text-sm'}>
            {message.text}
          </p>
        )}
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Đang đọc…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có lệnh rút nào cần xem xét.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="space-y-2 rounded-lg border border-border p-3 text-sm" data-request={row.id}>
              <p>
                <span className="font-mono">{row.id.slice(0, 8)}</span>: {amount(row.amount)} VNDB tới{' '}
                <span className="font-mono">{short(row.payoutWallet)}</span>, tạo lúc {new Date(row.createdAt).toLocaleString('vi-VN')}.
              </p>
              <p className="text-muted-foreground">{row.reason}</p>
              <p className="text-xs text-muted-foreground">
                Sự kiện Withdrawn ứng viên (chỉ để xem, không chứng minh thuộc lệnh này):{' '}
                {row.candidates.length === 0 ? 'không có' : row.candidates.map((c) => `${short(c.txHash)} (block ${c.blockNumber})`).join(', ')}
              </p>
              {canResolve && (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                  <input
                    aria-label={`Mã giao dịch xác nhận ${row.id}`}
                    placeholder="Mã giao dịch 0x…"
                    value={field(row.id).txHash}
                    onChange={(e) => setField(row.id, 'txHash', e.target.value)}
                    className={FIELD}
                  />
                  <Button type="button" disabled={busy} onClick={() => void resolve(row.id, 'COMPLETED')}>
                    Xác nhận hoàn tất
                  </Button>
                  <input
                    aria-label={`Lý do thất bại ${row.id}`}
                    placeholder="Lý do, ví dụ đã kiểm explorer"
                    value={field(row.id).reason}
                    onChange={(e) => setField(row.id, 'reason', e.target.value)}
                    className={`${FIELD} font-sans`}
                  />
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void resolve(row.id, 'FAILED')}>
                    Đánh dấu thất bại
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const PARAM_LABEL: Record<VaultConfigHistoryRow['param'], string> = {
  LOCK_MODE: 'Chế độ khoá',
  PERCENT_RATE: 'Tỷ lệ khoá',
  PENDING_PERCENT_RATE: 'Tỷ lệ chờ áp',
  FIXED_LOCK: 'Số khoá cố định',
  PAYOUT_WALLET: 'Ví nhận tiền rút',
};

const ROLE_LABEL: Record<string, string> = {
  CONTROLLER: 'Kiểm soát viên',
  TELLER: 'Giao dịch viên',
  SELLER: 'Người bán',
  INVESTOR: 'Nhà đầu tư',
};

function configValue(param: VaultConfigHistoryRow['param'], value: string | null): string {
  if (value === null) return 'Chưa có';
  if (param === 'LOCK_MODE') return MODE_LABEL[value as keyof typeof MODE_LABEL] ?? value;
  if (param === 'PERCENT_RATE' || param === 'PENDING_PERCENT_RATE') return percent(value);
  if (param === 'FIXED_LOCK') return `${amount(value)} VNDB`;
  return value;
}

const HISTORY_PAGE_SIZE = 10;

/**
 * "Lịch sử cấu hình" (BE-13 QĐ-C1): mỗi dòng một thay đổi đọc từ sự kiện trên chuỗi, mới nhất trước.
 * Thay đổi không do app gửi (ví dụ `vault-admin.js`) ghi người thao tác là "ngoài app".
 */
function VaultConfigHistoryCard({ chain, reloadKey }: { chain: ChainKey; reloadKey: number }) {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<{ key: string; data: VaultConfigHistoryPage | null; error: string | null } | null>(null);
  const key = `${chain}:${page}:${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    void getVaultConfigHistoryAction({ chain, page, pageSize: HISTORY_PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      setLoaded(result.ok ? { key, data: result.data, error: null } : { key, data: null, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [chain, page, key]);

  const data = loaded?.data ?? null;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Lịch sử cấu hình</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loaded?.error ? (
          <p role="alert" className="text-sm text-destructive">{loaded.error}</p>
        ) : data === null ? (
          <p className="text-sm text-muted-foreground">Đang đọc…</p>
        ) : data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Vault chưa có thay đổi cấu hình nào.</p>
        ) : (
          <Table aria-label="Lịch sử cấu hình">
            <TableHeader><TableRow>
              <TableHead>Block</TableHead><TableHead>Thời điểm</TableHead><TableHead>Tham số</TableHead>
              <TableHead>Giá trị cũ</TableHead><TableHead>Giá trị mới</TableHead><TableHead>Giao dịch</TableHead>
              <TableHead>Người thao tác</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.rows.map((row) => {
              const url = explorerTxUrl(chain, row.txHash);
              return <TableRow key={`${row.txHash}:${row.param}`} data-param={row.param}>
                <TableCell className="font-mono text-xs">{row.blockNumber}</TableCell>
                <TableCell className="text-xs">{new Date(row.timestamp * 1000).toLocaleString('vi-VN')}</TableCell>
                <TableCell>{PARAM_LABEL[row.param]}</TableCell>
                <TableCell className="font-mono text-xs">{configValue(row.param, row.oldValue)}</TableCell>
                <TableCell className="font-mono text-xs">{configValue(row.param, row.newValue)}</TableCell>
                <TableCell>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs underline">{short(row.txHash)}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <span className="font-mono text-xs" title={row.txHash}>{short(row.txHash)}</span>}</TableCell>
                <TableCell className="text-xs">
                  {row.actor.source === 'OUTSIDE_APP' ? 'Ngoài app' : `${ROLE_LABEL[row.actor.role] ?? row.actor.role}${row.actor.signer ? ` (ví ký ${short(row.actor.signer)})` : ''}`}
                </TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        )}
        {data && data.total > data.pageSize && (
          <nav className="flex items-center justify-between text-sm" aria-label="Phân trang lịch sử cấu hình">
            <span className="text-muted-foreground">Trang {data.page}/{pages}, {data.total} thay đổi</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trang trước</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Trang sau</Button>
            </div>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}

/** Trạng thái vault, lịch sử chốt kỳ, cấu hình khoá, lịch sử cấu hình và lệnh rút cần xem xét. */
export function VaultStatusPage() {
  const { chain } = useSelectedChain();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: VaultOverviewView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVaultOverviewAction({ chain }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: chain, data: result.data, error: null }
          : { key: chain, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, reloadKey]);

  const fresh = loaded?.key === chain ? loaded : null;
  const data = fresh?.data ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Vault thanh toán SPV</h1>
        <p className="text-sm text-muted-foreground">
          Trạng thái giữ WPT, VNDB và phần tiền bị khoá trên chain <span className="font-mono">{chain}</span>.
        </p>
      </header>

      {fresh === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Đang đọc trạng thái vault…
        </div>
      ) : fresh.error ? (
        <p role="alert" className="text-sm text-destructive">{fresh.error}</p>
      ) : data?.status === null ? (
        <Card><CardContent className="pt-6">Chain này chưa triển khai vault thanh toán SPV</CardContent></Card>
      ) : data?.status ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Trạng thái hiện tại</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Địa chỉ vault" value={data.status.address} />
                <Metric label="Chế độ khoá" value={MODE_LABEL[data.status.lockMode]} />
                <Metric label="Số dư WPT" value={`${amount(data.status.wptBalance)} WPT`} />
                <Metric label="Số dư VNDB" value={`${amount(data.status.vndbBalance)} VNDB`} />
                <Metric label="Khoá cố định" value={`${amount(data.status.fixedLockAmount)} VNDB`} />
                <Metric label="Tỷ lệ đang áp" value={percent(data.status.percentRateBps)} />
                <Metric
                  label="Tỷ lệ chờ áp"
                  value={data.status.pendingPercentRateBps === null ? 'Không có' : percent(data.status.pendingPercentRateBps)}
                />
                <Metric label="Thu ròng" value={`${amount(data.status.netProceeds)} VNDB`} />
                <Metric label="Đang khoá" value={`${amount(data.status.lockedAmount)} VNDB`} />
                <Metric label="Có thể rút" value={`${amount(data.status.withdrawable)} VNDB`} />
                <Metric label="Kỳ gần nhất" value={amount(data.status.lastPeriodRef)} />
                <Metric label="Đã chia kỳ trước" value={`${amount(data.status.lastDistributedPrev)} VNDB`} />
                <Metric label="Phần khoá theo kỳ" value={`${amount(data.status.percentLocked)} VNDB`} />
                <Metric label="Ví nhận tiền rút" value={data.status.payoutWallet ?? 'Chưa cấu hình'} />
                <Metric label="Trạng thái rút" value={data.status.withdrawalsPaused ? 'Đang tạm dừng' : 'Đang hoạt động'} />
              </dl>
            </CardContent>
          </Card>

          {data.config && (
            <VaultConfigCard
              key={chain}
              chain={chain}
              status={data.status}
              config={data.config}
              onSaved={() => setReloadKey((value) => value + 1)}
            />
          )}

          <VaultConfigHistoryCard key={`history:${chain}`} chain={chain} reloadKey={reloadKey} />

          <WithdrawReviewCard
            key={`review:${chain}`}
            chain={chain}
            canResolve={data.canResolveWithdrawals}
            onChanged={() => setReloadKey((value) => value + 1)}
          />

          <Card>
            <CardHeader><CardTitle className="text-base">Lịch sử chốt kỳ (10 lần gần nhất)</CardTitle></CardHeader>
            <CardContent>
              {data.historyError ? (
                <p role="alert" className="text-sm text-destructive">{data.historyError}</p>
              ) : data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có kỳ nào được chốt.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Kỳ</TableHead><TableHead className="text-right">Đã chia kỳ trước</TableHead>
                    <TableHead className="text-right">Tỷ lệ</TableHead><TableHead className="text-right">Phần khoá</TableHead>
                    <TableHead>Người đặt</TableHead><TableHead>Thời điểm</TableHead><TableHead>Giao dịch</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{data.history.map((row) => {
                    const url = explorerTxUrl(chain, row.txHash);
                    return <TableRow key={`${row.txHash}:${row.periodRef}`}>
                      <TableCell className="font-mono">{row.periodRef}</TableCell>
                      <TableCell className="text-right font-mono">{amount(row.distributedPrev)}</TableCell>
                      <TableCell className="text-right font-mono">{percent(row.rateBps)}</TableCell>
                      <TableCell className="text-right font-mono">{amount(row.percentLocked)}</TableCell>
                      <TableCell className="font-mono text-xs" title={row.operator}>{short(row.operator)}</TableCell>
                      <TableCell className="text-xs">{new Date(row.timestamp * 1000).toLocaleString('vi-VN')}</TableCell>
                      <TableCell>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs underline">{short(row.txHash)}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <span className="font-mono text-xs" title={row.txHash}>{short(row.txHash)}</span>}</TableCell>
                    </TableRow>;
                  })}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
