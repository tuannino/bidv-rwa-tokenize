'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { explorerTxUrl, type ChainKey } from '@bidv/shared';
import { Check, Coins, Copy, ExternalLink, Gauge, History, Loader2, PencilLine } from 'lucide-react';
import { getPriceConfigOverviewAction, setIssuePriceAction } from '@/app/actions/config';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitleIcon } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClass } from '@/components/ui/field';
import { Kpi } from '@/components/ui/kpi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  IssuanceOverview,
  IssuePriceView,
  PriceConfigOverview,
  PriceHistoryRow,
} from '@/lib/bank/config.service';
import type { Result } from '@/lib/bank/result';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

/**
 * Màn "Giá và phát hành" (FE-07).
 *
 * Hiệu năng: mở màn gọi ĐÚNG MỘT server action (`getPriceConfigOverviewAction`), bốn khối có kết
 * quả riêng; `canEdit` do máy chủ tính nên màn không gọi thêm gì để biết có hiện khối "Đổi giá".
 * Đổi giá xong thì tải lại bằng chính action đó.
 *
 * Mọi con số do máy chủ trả; màn chỉ định dạng. Đổi giá có hai lớp xác nhận: hộp "từ X sang Y"
 * luôn hiện; vượt ngưỡng thì máy chủ trả `fieldErrors.confirmLargeChange` và màn mở hộp thứ hai
 * bắt đánh dấu "Tôi đã kiểm số chữ số" rồi mới gửi lại với `confirmLargeChange: true`.
 *
 * FE-UX-02b: giá áp dụng là ô số liệu vàng (`Kpi au`) đầu thẻ "Giá phát hành", tổng cung trên chuỗi là
 * ô xanh đậm (`Kpi hl`) đầu thẻ "Tình trạng phát hành"; `effective-price` nằm TRONG giá trị của ô (test
 * so đúng chữ "X VNDB"). Cảnh báo, lỗi từng khối, phản hồi đổi giá dùng `Alert` giữ đúng `role`.
 */

const vnd = (value: string) => BigInt(value).toLocaleString('vi-VN');
const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;
const when = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : 'chưa có');

const ROLE_LABEL: Record<string, string> = {
  TELLER: 'Giao dịch viên',
  CONTROLLER: 'Kiểm soát viên',
  INVESTOR: 'Nhà đầu tư',
  SELLER: 'Người bán',
};

const PRICE_PATTERN = /^\d+$/;
const REASON_MIN = 5;
const REASON_MAX = 200;

function BlockTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold">
      <CardTitleIcon>{icon}</CardTitleIcon>
      {children}
    </h2>
  );
}

/** Một dòng nhãn và giá trị; số căn phải, chữ số đều độ rộng. */
function Row({ label, children, numeric }: { label: string; children: React.ReactNode; numeric?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={numeric ? 'text-right tabular-nums' : 'text-right'}>{children}</dd>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={() => void copy()} aria-label={`Sao chép ${value}`}>
      {state === 'copied' ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      <span>{state === 'copied' ? 'Đã sao chép' : state === 'failed' ? 'Chưa sao chép được' : 'Sao chép'}</span>
    </Button>
  );
}

function PriceCard({ price, thresholdTimes }: { price: Result<IssuePriceView>; thresholdTimes: number }) {
  return (
    <Card aria-label="Giá phát hành">
      <CardHeader>
        <BlockTitle icon={<Coins />}>Giá phát hành</BlockTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!price.ok && (
          <Alert tone="bad" role="alert">
            {price.error}
          </Alert>
        )}
        {price.ok && (
          <>
            <Kpi
              tone="au"
              label={price.data.onChain ? 'Giá áp dụng cho lệnh mới (trên hợp đồng)' : 'Giá áp dụng cho lệnh mới'}
              value={<span data-testid="effective-price">{vnd(price.data.priceVnd)} VNDB</span>}
            />
            <dl>
              <Row label="Giá đã cấu hình" numeric>
                <span data-testid="configured-price">{vnd(price.data.configuredPriceVnd)} VNDB</span>
              </Row>
              <Row label="Đặt gần nhất">
                {price.data.updatedBy
                  ? `${ROLE_LABEL[price.data.updatedBy] ?? price.data.updatedBy}, ${when(price.data.updatedAt)}`
                  : 'Chưa ai đặt, đang dùng giá mặc định của dự án'}
              </Row>
              <Row label="Ngưỡng cảnh báo đổi giá" numeric>
                {thresholdTimes.toLocaleString('vi-VN')} lần
              </Row>
            </dl>
            {price.data.warning && (
              <Alert tone="warn" role="status">
                Giá trên hợp đồng khác giá đã cấu hình. Giao dịch viên đặt lại đúng giá mong muốn để hai
                nơi khớp.
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'confirm' }
  | { kind: 'confirm-large'; message: string };

function ChangePriceCard({
  chain,
  currentPrice,
  inFlight,
  onChanged,
}: {
  chain: ChainKey;
  currentPrice: string | null;
  inFlight: PriceConfigOverview['inFlightOrders'];
  onChanged: () => void;
}) {
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [busy, startWork] = useTransition();

  const inFlightTotal = inFlight.PLACED + inFlight.CHECKING + inFlight.EXECUTING;
  const trimmedReason = reason.trim();
  const blockReason =
    inFlightTotal > 0
      ? `Còn ${inFlightTotal} lệnh đang xử lý (Đã đặt ${inFlight.PLACED}, Đang kiểm tra ${inFlight.CHECKING}, Đang quyết toán ${inFlight.EXECUTING}). Xử lý ở màn Giao dịch trước khi đổi giá.`
      : !PRICE_PATTERN.test(price) || BigInt(price) <= 0n
        ? 'Nhập giá mới là số nguyên dương, đơn vị VNDB.'
        : trimmedReason.length < REASON_MIN || trimmedReason.length > REASON_MAX
          ? `Lý do bắt buộc, từ ${REASON_MIN} tới ${REASON_MAX} ký tự.`
          : null;

  const submit = (confirmLargeChange: boolean) =>
    startWork(async () => {
      const result = await setIssuePriceAction({ chain, priceVnd: price, reason: trimmedReason, confirmLargeChange });
      if (!result.ok && result.code === 'VALIDATION' && result.fieldErrors?.confirmLargeChange) {
        setChecked(false);
        setStage({ kind: 'confirm-large', message: result.error });
        return;
      }
      setStage({ kind: 'idle' });
      if (result.ok) {
        setFeedback({
          tone: 'success',
          message: `Đã đổi giá phát hành từ ${vnd(result.data.previousPriceVnd)} sang ${vnd(result.data.priceVnd)} VNDB; chuỗi đã xác nhận (tx ${short(result.data.txHash)}).`,
        });
        setPrice('');
        setReason('');
        onChanged();
      } else {
        setFeedback({
          tone: result.code === 'LEDGER' && /chưa có xác nhận/.test(result.error) ? 'warning' : 'error',
          message: result.error,
        });
        onChanged();
      }
    });

  return (
    <Card aria-label="Đổi giá">
      <CardHeader>
        <BlockTitle icon={<PencilLine />}>Đổi giá</BlockTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="new-price" className="text-sm font-medium">
            Giá mới (VNDB cho 1 WPT)
          </label>
          <input
            id="new-price"
            inputMode="numeric"
            value={price}
            onChange={(event) => setPrice(event.target.value.trim())}
            className={`${fieldClass} text-right tabular-nums`}
            placeholder={currentPrice ?? ''}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="price-reason" className="text-sm font-medium">
            Lý do
          </label>
          <textarea
            id="price-reason"
            rows={2}
            value={reason}
            maxLength={REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
            placeholder="Bắt buộc: căn cứ đổi giá, ví dụ số quyết định."
          />
        </div>
        {blockReason && (
          <p className="text-xs text-muted-foreground" data-testid="change-price-block">
            {blockReason}
          </p>
        )}
        <Button onClick={() => { setFeedback(null); setStage({ kind: 'confirm' }); }} disabled={busy || blockReason !== null}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Đổi giá
        </Button>
        {feedback && (
          <Alert
            tone={feedback.tone === 'success' ? 'ok' : feedback.tone === 'warning' ? 'warn' : 'bad'}
            role="status"
            data-tone={feedback.tone}
          >
            {feedback.message}
          </Alert>
        )}
      </CardContent>

      <Dialog open={stage.kind === 'confirm'} onOpenChange={(next) => (next ? undefined : setStage({ kind: 'idle' }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận đổi giá</DialogTitle>
            <DialogDescription>
              Đổi giá phát hành từ {currentPrice ? vnd(currentPrice) : 'giá hiện tại'} sang{' '}
              {PRICE_PATTERN.test(price) ? vnd(price) : price} VNDB. Áp dụng ngay cho mọi lệnh mới.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Lý do: {trimmedReason}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStage({ kind: 'idle' })} disabled={busy}>
              Huỷ
            </Button>
            <Button onClick={() => submit(false)} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Xác nhận đổi giá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stage.kind === 'confirm-large'} onOpenChange={(next) => (next ? undefined : setStage({ kind: 'idle' }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Giá mới lệch lớn so với giá hiện tại</DialogTitle>
            <DialogDescription>{stage.kind === 'confirm-large' ? stage.message : ''}</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            Tôi đã kiểm số chữ số
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStage({ kind: 'idle' })} disabled={busy}>
              Huỷ
            </Button>
            <Button onClick={() => submit(true)} disabled={busy || !checked}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Vẫn đổi giá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function IssuanceCard({ issuance }: { issuance: Result<IssuanceOverview | null> }) {
  return (
    <Card aria-label="Tình trạng phát hành">
      <CardHeader>
        <BlockTitle icon={<Gauge />}>Tình trạng phát hành</BlockTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!issuance.ok && (
          <Alert tone="bad" role="alert">
            {issuance.error}
          </Alert>
        )}
        {issuance.ok && !issuance.data && <EmptyState>Chain này chưa có dự án nào.</EmptyState>}
        {issuance.ok && issuance.data && (
          <>
            <Kpi
              tone="hl"
              label="Tổng cung trên chuỗi"
              value={`${vnd(issuance.data.supply)} ${issuance.data.tokenSymbol}`}
            />
            <dl>
              <Row label="Trần phát hành (bảng dự án)" numeric>
                {vnd(issuance.data.cap)} {issuance.data.tokenSymbol}
              </Row>
              <Row label="Còn được phát hành" numeric>
                {vnd(issuance.data.remaining)} {issuance.data.tokenSymbol}
              </Row>
              <Row label="Mốc phát hành lần đầu">{when(issuance.data.issuedAt)}</Row>
              <Row label="Ví thanh toán SPV">
                {issuance.data.spvWallet ? (
                  <span className="flex items-center justify-end gap-2">
                    <span className="font-code text-xs">{short(issuance.data.spvWallet)}</span>
                    <CopyButton value={issuance.data.spvWallet} />
                  </span>
                ) : (
                  'chưa có (chưa phát hành lần đầu)'
                )}
              </Row>
            </dl>
            {issuance.data.overCap && (
              <Alert tone="warn" role="status">
                Tổng cung trên chuỗi vượt trần trong bảng dự án. Cần đối soát trước khi phát hành thêm.
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ chain, rows }: { chain: ChainKey; rows: PriceHistoryRow[] }) {
  return (
    <Card aria-label="Lịch sử đổi giá">
      <CardHeader>
        <BlockTitle icon={<History />}>Lịch sử đổi giá</BlockTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState>Chưa có lần đổi giá nào. Giá đang dùng là giá mặc định của dự án.</EmptyState>
        ) : (
          <Table aria-label="Bảng lịch sử đổi giá">
            <TableHeader>
              <TableRow>
                <TableHead>Thời điểm</TableHead>
                <TableHead>Vai</TableHead>
                <TableHead className="text-right">Giá cũ</TableHead>
                <TableHead className="text-right">Giá mới</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Mã giao dịch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const url = row.txHash ? explorerTxUrl(chain, row.txHash) : null;
                return (
                  <TableRow key={`${row.changedAt}-${row.newValue}`}>
                    <TableCell className="text-xs">{when(row.changedAt)}</TableCell>
                    <TableCell>{ROLE_LABEL[row.changedBy] ?? row.changedBy}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.oldValue ? vnd(row.oldValue) : 'không có'}</TableCell>
                    <TableCell className="text-right tabular-nums">{vnd(row.newValue)}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-sm">{row.reason ?? 'không ghi'}</TableCell>
                    <TableCell className="font-code text-xs">
                      {!row.txHash ? (
                        'không có'
                      ) : url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {short(row.txHash)}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        short(row.txHash)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function PriceConfigPage() {
  const { chain } = useSelectedChain();
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ chain: ChainKey; result: Result<PriceConfigOverview> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPriceConfigOverviewAction({ chain }).then((result) => {
      if (!cancelled) setLoaded({ chain, result });
    });
    return () => {
      cancelled = true;
    };
  }, [chain, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  // Tải lại sau khi đổi giá vẫn giữ số cũ trên màn tới khi có số mới: gỡ cả khối "Đổi giá" ra rồi
  // dựng lại sẽ làm mất thông báo kết quả vừa hiện. Đổi chain thì bỏ số của chain cũ ngay.
  const result = loaded?.chain === chain ? loaded.result : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Giá và phát hành</h1>
        <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
      </header>

      {!result && <EmptyState loading>Đang tải…</EmptyState>}
      {result && !result.ok && (
        <Alert tone="bad" role="alert">
          {result.error}
        </Alert>
      )}
      {result?.ok && (
        <>
          <div className="grid items-start gap-6 min-[1100px]:grid-cols-2">
            <div className="min-w-0 space-y-6">
              <PriceCard price={result.data.price} thresholdTimes={result.data.thresholdTimes} />
              {result.data.canEdit && (
                <ChangePriceCard
                  chain={chain}
                  currentPrice={result.data.price.ok ? result.data.price.data.priceVnd : null}
                  inFlight={result.data.inFlightOrders}
                  onChanged={reload}
                />
              )}
            </div>
            <div className="min-w-0">
              <IssuanceCard issuance={result.data.issuance} />
            </div>
          </div>
          <HistoryCard chain={chain} rows={result.data.history} />
        </>
      )}
    </div>
  );
}
