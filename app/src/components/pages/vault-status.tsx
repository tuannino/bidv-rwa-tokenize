'use client';

import { useEffect, useState } from 'react';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { CalendarCheck, ExternalLink, History, KeyRound, Landmark, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { getVaultConfigHistoryAction, getVaultOverviewAction, saveVaultConfigAction } from '@/app/actions/vault';
import {
  listWithdrawReviewsAction,
  reconcileWithdrawRequestsAction,
  resolveWithdrawRequestAction,
} from '@/app/actions/withdraw';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClass } from '@/components/ui/field';
import { Kpi } from '@/components/ui/kpi';
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
import { formatDateTime } from '@/lib/format';
import { TokenScopeSelect } from '@/components/token/token-scope-select';
import { amount, short } from '@/components/vault/display';
import { WithdrawReviewItem } from '@/components/vault/withdraw-review-item';

const percent = (bps: string) => `${Number(bps) / 100}%`;

const MODE_LABEL = {
  UNSET: 'Chưa cấu hình, khoá toàn bộ',
  FIXED: 'Khoá số tiền cố định',
  PERCENT: 'Khoá theo tỷ lệ kỳ',
} as const;

/** Tiêu đề thẻ có biểu tượng tròn (FE-UX-03c QĐ-7); `CardTitle` là `div`, không phải heading. */
function CardHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base">
      <CardTitleIcon>{icon}</CardTitleIcon>
      {children}
    </CardTitle>
  );
}

/** Ô khoá và giá trị của thẻ "Trạng thái hiện tại" (thay `Metric`): nhãn nhỏ trên, giá trị dưới. */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="space-y-1.5 rounded-[14px] bg-muted/60 px-3.5 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={className ?? 'text-sm font-semibold tabular-nums [overflow-wrap:anywhere]'}>{children}</dd>
    </div>
  );
}

/** Mã giao dịch có liên kết explorer (gộp hai link viết tay của hai bảng lịch sử; cắt 8 ký tự như `short`). */
function TxHashLink({ chain, txHash }: { chain: ChainKey; txHash: string }) {
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

/** Ô nhập có hậu tố trang trí ("%", "VNDB") nằm trong khung ô, ngoài `input` nên không đổi nhãn. */
function Suffixed({ suffix, children }: { suffix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

const CONFIG_MODES = [
  { value: 'PERCENT', label: 'Theo tỷ lệ %' },
  { value: 'FIXED', label: 'Khoá số cố định' },
] as const;

/**
 * Mục "Cấu hình khoá" (BE-13 QĐ-C, UIUX-01 C1 tới C5). Người dùng chọn MỘT chế độ, màn chỉ hiện và
 * chỉ gửi ô của chế độ đó; máy chủ kiểm lại, đọc trạng thái chuỗi và chỉ gửi giao dịch còn khác.
 */
function VaultConfigCard({
  chain,
  config,
  onSaved,
}: {
  chain: ChainKey;
  config: VaultConfigFormView;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<VaultConfigFormView['mode']>(config.mode);
  const [form, setForm] = useState({ percent: config.percent, fixedLock: config.fixedLock });
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
  const effectNote =
    mode === 'PERCENT' && config.percentApplies === 'NEXT_PERIOD'
      ? 'Tỷ lệ mới áp từ lần chốt kỳ tiếp theo.'
      : 'Có hiệu lực ngay khi lưu.';

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setResult(null);
    const saved = await saveVaultConfigAction({
      chain,
      mode,
      percent: mode === 'PERCENT' ? form.percent : '',
      fixedLock: mode === 'FIXED' ? form.fixedLock : '',
    });
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
      <CardHeader><CardHeading icon={<KeyRound />}>Cấu hình khoá</CardHeading></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chọn một chế độ khoá: theo tỷ lệ % trên thu ròng của kỳ, hoặc khoá đúng một số VNDB cố định. Ví nhận
          tiền rút do Người bán chọn khi tạo lệnh rút.
        </p>
        {!config.canConfigure && (
          <Alert tone="info">Chỉ Kiểm soát viên lưu được cấu hình; vai của bạn chỉ xem.</Alert>
        )}
        {config.busy && (
          <Alert tone="info" role="status">
            Vault đang có thao tác khác ({config.busy.kind === 'WITHDRAW' ? 'lệnh rút đang dở' : 'lần lưu cấu hình khác'}) từ{' '}
            {new Date(config.busy.acquiredAt).toLocaleString('vi-VN')}.
          </Alert>
        )}
        <form onSubmit={save} className="grid gap-4 min-[640px]:grid-cols-2" aria-label="Biểu mẫu cấu hình khoá">
          {/* Nút chuyển (QĐ-4): radio gốc phủ toàn ô, trong suốt; ô đang chọn, tiêu điểm bàn phím, khoá theo trạng thái radio. */}
          <div
            role="radiogroup"
            aria-label="Chế độ khoá"
            className="inline-flex w-fit flex-wrap gap-1 rounded-full bg-muted p-1 min-[640px]:col-span-2"
          >
            {CONFIG_MODES.map((option) => (
              <label
                key={option.value}
                className="relative cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  type="radio"
                  name="vault-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  disabled={disabled}
                  className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
                />
                {option.label}
              </label>
            ))}
          </div>
          {mode === 'PERCENT' ? (
            <div className="space-y-1.5">
              <label htmlFor="vault-percent" className="text-sm font-medium">Tỷ lệ khoá (%)</label>
              <Suffixed suffix="%">
                <input id="vault-percent" inputMode="decimal" value={form.percent} onChange={set('percent')} disabled={disabled} className={`${fieldClass} pr-10 font-code`} />
              </Suffixed>
              {fieldError('percent') && <p role="alert" className="text-xs text-destructive">{fieldError('percent')}</p>}
              <p role="note" className="text-xs text-muted-foreground">{effectNote}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="vault-fixed" className="text-sm font-medium">Số khoá cố định (VNDB)</label>
              <Suffixed suffix="VNDB">
                <AmountInput
                  id="vault-fixed"
                  value={form.fixedLock}
                  onValueChange={(raw) => setForm((current) => ({ ...current, fixedLock: raw }))}
                  disabled={disabled}
                  className={`${fieldClass} pr-16 font-code`}
                />
              </Suffixed>
              {fieldError('fixedLock') && <p role="alert" className="text-xs text-destructive">{fieldError('fixedLock')}</p>}
              <p role="note" className="text-xs text-muted-foreground">{effectNote}</p>
            </div>
          )}
          {/* Lỗi "chỉ nhập một trong hai" gắn vào ô của chế độ kia, ô đó đang ẩn nên hiện ở đây. */}
          {fieldError(mode === 'PERCENT' ? 'fixedLock' : 'percent') && (
            <p role="alert" className="text-xs text-destructive min-[640px]:col-span-2">
              {fieldError(mode === 'PERCENT' ? 'fixedLock' : 'percent')}
            </p>
          )}
          {config.canConfigure && (
            <div className="min-[640px]:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Lưu cấu hình khoá
              </Button>
            </div>
          )}
        </form>
        {result && (
          <Alert
            tone={result.tone === 'error' ? 'bad' : 'ok'}
            role={result.tone === 'error' ? 'alert' : 'status'}
            aria-label="Kết quả lưu cấu hình"
          >
            <p>{result.message}</p>
            {result.tone === 'ok' && result.steps.length > 0 && (
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                {result.steps.map((step) => (
                  <li key={step.txHash}>
                    {step.label}: {step.detail} <span className="font-code text-xs">({short(step.txHash)})</span>
                  </li>
                ))}
              </ol>
            )}
          </Alert>
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
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardHeading icon={<TriangleAlert />}>Lệnh rút cần xem xét</CardHeading>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void reconcile()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Đối soát lệnh rút
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {message && (
          <Alert tone={message.tone === 'error' ? 'bad' : 'ok'} role={message.tone === 'error' ? 'alert' : 'status'}>
            {message.text}
          </Alert>
        )}
        {rows === null ? (
          <EmptyState loading>Đang đọc…</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>Không có lệnh rút nào cần xem xét.</EmptyState>
        ) : (
          rows.map((row) => (
            <WithdrawReviewItem
              key={row.id}
              row={row}
              canResolve={canResolve}
              busy={busy}
              txHash={field(row.id).txHash}
              reason={field(row.id).reason}
              onChange={(key, value) => setField(row.id, key, value)}
              onResolve={(outcome) => void resolve(row.id, outcome)}
            />
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
      <CardHeader><CardHeading icon={<History />}>Lịch sử cấu hình</CardHeading></CardHeader>
      <CardContent className="space-y-3">
        {loaded?.error ? (
          <Alert tone="bad" role="alert">{loaded.error}</Alert>
        ) : data === null ? (
          <EmptyState loading>Đang đọc…</EmptyState>
        ) : data.rows.length === 0 ? (
          <EmptyState>Vault chưa có thay đổi cấu hình nào.</EmptyState>
        ) : (
          <Table aria-label="Lịch sử cấu hình">
            <TableHeader><TableRow>
              <TableHead>Block</TableHead><TableHead>Thời điểm</TableHead><TableHead>Tham số</TableHead>
              <TableHead>Giá trị cũ</TableHead><TableHead>Giá trị mới</TableHead><TableHead>Giao dịch</TableHead>
              <TableHead>Người thao tác</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.rows.map((row) => (
              <TableRow key={`${row.txHash}:${row.param}`} data-param={row.param}>
                <TableCell className="tabular-nums text-xs">{row.blockNumber}</TableCell>
                <TableCell className="text-xs">{new Date(row.timestamp * 1000).toLocaleString('vi-VN')}</TableCell>
                <TableCell>{PARAM_LABEL[row.param]}</TableCell>
                <TableCell className="tabular-nums text-xs">{configValue(row.param, row.oldValue)}</TableCell>
                <TableCell className="tabular-nums text-xs">{configValue(row.param, row.newValue)}</TableCell>
                <TableCell><TxHashLink chain={chain} txHash={row.txHash} /></TableCell>
                <TableCell className="text-xs">
                  {row.actor.source === 'OUTSIDE_APP' ? 'Ngoài app' : `${ROLE_LABEL[row.actor.role] ?? row.actor.role}${row.actor.signer ? ` (ví ký ${short(row.actor.signer)})` : ''}`}
                </TableCell>
              </TableRow>
            ))}</TableBody>
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

/** Ngày cấu hình hiện hành có hiệu lực (UIUX-01 D4), viết cho người đọc. */
function configEffectiveText(
  effective: VaultOverviewView['configEffective'],
  error: string | null,
): string {
  if (error !== null || effective === null) return 'Không đọc được';
  if (effective.unknown) return 'Không xác định được';
  if (effective.at === null) return 'Chưa cấu hình';
  return formatDateTime(new Date(effective.at * 1000).toISOString());
}

/**
 * Khối "Trạng thái hiện tại" (UIUX-01 D1, D2): đúng 11 trường nghiệp vụ cần, đúng thứ tự; tỷ lệ áp
 * chỉ hiện khi khoá theo tỷ lệ, mức khoá cố định chỉ hiện khi khoá số cố định.
 */
function VaultStatusMetrics({
  status,
  configEffective,
  configEffectiveError,
}: {
  status: VaultStatusView;
  configEffective: VaultOverviewView['configEffective'];
  configEffectiveError: string | null;
}) {
  // 4 trường đầu là ô số liệu (QĐ-3), 7 trường còn lại ở thẻ ngay dưới; thứ tự và điều kiện hiện giữ nguyên.
  return (
    <>
      <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
        <Kpi label="Số dư VNDB" value={amount(status.vndbBalance)} unit="VNDB" tone="au" size="lg" />
        <Kpi label="Số VNDB đang khoá" value={amount(status.lockedAmount)} unit="VNDB" />
        <Kpi label="Số dư WPT" value={amount(status.wptBalance)} unit="WPT" />
        <Kpi label="VNDB có thể rút" value={amount(status.withdrawable)} unit="VNDB" tone="gold" />
      </div>
      <Card>
        <CardHeader><CardHeading icon={<Landmark />}>Trạng thái hiện tại</CardHeading></CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
            <Field label="Chế độ khoá">{MODE_LABEL[status.lockMode]}</Field>
            {status.lockMode === 'PERCENT' && <Field label="Tỷ lệ áp">{percent(status.percentRateBps)}</Field>}
            {status.lockMode === 'FIXED' && (
              <Field label="Mức khoá cố định">{`${amount(status.fixedLockAmount)} VNDB`}</Field>
            )}
            <Field label="Lợi nhuận chia quý trước">{`${amount(status.lastDistributedPrev)} VNDB`}</Field>
            <Field label="Ngày cấu hình có hiệu lực">
              <span title={configEffectiveError ?? undefined}>{configEffectiveText(configEffective, configEffectiveError)}</span>
            </Field>
            <Field label="Địa chỉ vault" className="break-all font-code text-sm font-semibold">{status.address}</Field>
            <Field label="Trạng thái rút">
              <Badge variant={status.withdrawalsPaused ? 'warn' : 'ok'}>{status.withdrawalsPaused ? 'Đang tạm dừng' : 'Đang hoạt động'}</Badge>
            </Field>
          </dl>
          {status.pendingPercentRateBps !== null && (
            <Alert tone="info" role="note">
              Tỷ lệ {percent(status.pendingPercentRateBps)} đã lưu, áp từ lần chốt kỳ tiếp theo.
            </Alert>
          )}
        </CardContent>
      </Card>
    </>
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Vault thanh toán SPV</h1>
        <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
      </header>

      {fresh === null ? (
        <EmptyState loading>Đang đọc trạng thái vault…</EmptyState>
      ) : fresh.error ? (
        <Alert tone="bad" role="alert">{fresh.error}</Alert>
      ) : data?.status === null ? (
        <EmptyState icon={<Landmark />}>Chain này chưa triển khai vault thanh toán SPV</EmptyState>
      ) : data?.status ? (
        <>
          <VaultStatusMetrics
            status={data.status}
            configEffective={data.configEffective}
            configEffectiveError={data.configEffectiveError}
          />

          {data.config && (
            <VaultConfigCard
              key={chain}
              chain={chain}
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
            <CardHeader><CardHeading icon={<CalendarCheck />}>Lịch sử chốt kỳ (10 lần gần nhất)</CardHeading></CardHeader>
            <CardContent>
              {data.historyError ? (
                <Alert tone="bad" role="alert">{data.historyError}</Alert>
              ) : data.history.length === 0 ? (
                <EmptyState>Chưa có kỳ nào được chốt.</EmptyState>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Kỳ</TableHead><TableHead className="text-right">Đã chia kỳ trước</TableHead>
                    <TableHead className="text-right">Tỷ lệ</TableHead><TableHead className="text-right">Phần khoá</TableHead>
                    <TableHead>Người đặt</TableHead><TableHead>Thời điểm</TableHead><TableHead>Giao dịch</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{data.history.map((row) => (
                    <TableRow key={`${row.txHash}:${row.periodRef}`}>
                      <TableCell className="font-code">{row.periodRef}</TableCell>
                      <TableCell className="text-right tabular-nums">{amount(row.distributedPrev)}</TableCell>
                      <TableCell className="text-right tabular-nums">{percent(row.rateBps)}</TableCell>
                      <TableCell className="text-right tabular-nums">{amount(row.percentLocked)}</TableCell>
                      <TableCell className="font-code text-xs" title={row.operator}>{short(row.operator)}</TableCell>
                      <TableCell className="text-xs">{new Date(row.timestamp * 1000).toLocaleString('vi-VN')}</TableCell>
                      <TableCell><TxHashLink chain={chain} txHash={row.txHash} /></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
