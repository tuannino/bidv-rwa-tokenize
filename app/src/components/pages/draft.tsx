'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Flame, Loader2, PlusCircle, Send, XCircle } from 'lucide-react';
import type { ChainKey } from '@bidv/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestCheckBlock } from '@/components/maker-checker/request-check-block';
import { RequestTable } from '@/components/maker-checker/request-table';
import { INPUT_CLASS, StatCard } from '@/components/maker-checker/stat-card';
import { TokenInfoBlock } from '@/components/maker-checker/token-info-block';
import {
  BURN_SOURCE_LABELS,
  burnSourceEffect,
  describeInvalid,
  submitBlockReason,
  type BurnSource,
  type PreviewState,
} from '@/components/maker-checker/gates';
import {
  createTokenRequestAction,
  getDraftStatsAction,
  getTokenInfoAction,
  listTokenRequestsAction,
  previewTokenRequestAction,
} from '@/app/actions/token-request';
import type { DraftStatsView, TokenInfoView } from '@/lib/bank/token-request.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount } from '@/lib/format';
import type { TokenRequestRecord, TokenRequestType } from '@/lib/store/token-request.store.port';

/**
 * Màn **Lập lệnh** — vai Giao dịch viên (FE-22 việc 1–7).
 *
 * Component này KHÔNG gọi chuỗi và KHÔNG tự tính điều kiện nào: thông tin token, khối kiểm tra, số
 * liệu và danh sách đều do server action trả (`app/actions/token-request.ts` → `token-request.service`).
 * Nút gửi bị khoá theo đúng kết quả khối kiểm tra máy chủ trả; chốt chặn thật vẫn ở service vì server
 * action gọi được bằng POST trực tiếp.
 */

/** Chờ người dùng gõ xong rồi mới hỏi máy chủ — không thì mỗi ký tự là một lượt gọi. */
const LOOKUP_DEBOUNCE_MS = 300;

/** Số dòng mỗi bảng "yêu cầu đã lập". */
const MY_REQUESTS_LIMIT = 50;

interface Feedback {
  tone: 'success' | 'error';
  message: string;
}

export function DraftPage() {
  const { chain } = useSelectedChain();
  const router = useRouter();

  /** Tăng sau mỗi lần gửi thành công — khoá nạp lại số liệu và bảng. */
  const [revision, setRevision] = useState(0);
  const [stats, setStats] = useState<{ key: number; data: DraftStatsView | null; error: string | null } | null>(null);
  const [mine, setMine] = useState<{
    key: number;
    mint: TokenRequestRecord[];
    burn: TokenRequestRecord[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      getDraftStatsAction(),
      listTokenRequestsAction({ mine: true, type: 'MINT', limit: MY_REQUESTS_LIMIT }),
      listTokenRequestsAction({ mine: true, type: 'BURN', limit: MY_REQUESTS_LIMIT }),
    ]).then(([statsResult, mintResult, burnResult]) => {
      if (cancelled) return;
      setStats(
        statsResult.ok
          ? { key: revision, data: statsResult.data, error: null }
          : { key: revision, data: null, error: statsResult.error },
      );
      setMine({
        key: revision,
        mint: mintResult.ok ? mintResult.data : [],
        burn: burnResult.ok ? burnResult.data : [],
        error: !mintResult.ok ? mintResult.error : !burnResult.ok ? burnResult.error : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const onSubmitted = useCallback(() => {
    setRevision((value) => value + 1);
    // Số việc chờ cạnh menu do `AppLayout` (Server Component) dựng — làm mới để nó đọc lại.
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Lập lệnh</h1>
        <p className="text-sm text-muted-foreground">
          Lập yêu cầu tạo hoặc huỷ token. Yêu cầu chỉ có hiệu lực sau khi Kiểm soát viên chấp nhận;
          trước đó token không thay đổi. Chuỗi đang dùng: <span className="font-mono">{chain}</span>
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Yêu cầu tạo token đang chờ" value={stats?.data?.pendingMint ?? null} />
        <StatCard label="Yêu cầu huỷ token đang chờ" value={stats?.data?.pendingBurn ?? null} />
      </div>
      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <RequestForm type="MINT" chain={chain} revision={revision} onSubmitted={onSubmitted} />
        <RequestForm type="BURN" chain={chain} revision={revision} onSubmitted={onSubmitted} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yêu cầu đã lập</CardTitle>
          <CardDescription>
            Yêu cầu do chính bạn lập, mới nhất trước. Trạng thái cập nhật sau mỗi lần gửi hoặc tải lại trang.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mine?.error && <p className="text-sm text-destructive">{mine.error}</p>}
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Yêu cầu tạo token</h3>
            <RequestTable
              caption="Yêu cầu tạo token đã lập"
              rows={mine?.mint ?? []}
              emptyText={mine ? 'Chưa lập yêu cầu tạo token nào.' : 'Đang tải…'}
            />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Yêu cầu huỷ token</h3>
            <RequestTable
              caption="Yêu cầu huỷ token đã lập"
              rows={mine?.burn ?? []}
              emptyText={mine ? 'Chưa lập yêu cầu huỷ token nào.' : 'Đang tải…'}
            />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

const TYPE_TEXT: Record<TokenRequestType, { title: string; verb: string; idPrefix: string }> = {
  MINT: { title: 'Tạo token', verb: 'tạo', idPrefix: 'mint' },
  BURN: { title: 'Huỷ token', verb: 'huỷ', idPrefix: 'burn' },
};

/**
 * Thẻ tạo token / huỷ token. Hai thẻ cùng một khuôn vì cùng một schema lập yêu cầu ở máy chủ, chỉ
 * khác ví đích (Mint) và nguồn (Burn).
 */
function RequestForm({
  type,
  chain,
  revision,
  onSubmitted,
}: {
  type: TokenRequestType;
  chain: ChainKey;
  revision: number;
  onSubmitted: () => void;
}) {
  const text = TYPE_TEXT[type];
  const id = (field: string) => `${text.idPrefix}-${field}`;

  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [burnSource, setBurnSource] = useState<BurnSource>('UNDISTRIBUTED');
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [documentRef, setDocumentRef] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, startSubmit] = useTransition();

  // ---- Khối thông tin token: tra theo ký hiệu đã gõ ----
  const infoKey = symbol.trim() ? `${chain}|${symbol.trim()}|${revision}` : null;
  const [loadedInfo, setLoadedInfo] = useState<{
    key: string;
    data: TokenInfoView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!infoKey) return;
    const [keyChain, keySymbol] = infoKey.split('|');
    let cancelled = false;
    const timer = setTimeout(() => {
      void getTokenInfoAction({ chain: keyChain, tokenSymbol: keySymbol }).then((result) => {
        if (cancelled) return;
        setLoadedInfo(
          result.ok
            ? { key: infoKey, data: result.data, error: null }
            : { key: infoKey, data: null, error: result.error },
        );
      });
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [infoKey]);

  const infoFresh = infoKey !== null && loadedInfo?.key === infoKey ? loadedInfo : null;
  const info = infoFresh?.data ?? null;

  /**
   * Ví đích của Mint: ví thanh toán SPV máy chủ đã trả. Chưa phát hành lần nào thì chuỗi chưa ghi
   * ví SPV — lúc đó mới cho nhập tay, và khối kiểm tra của máy chủ quyết định ví đó có hợp lệ không.
   */
  const effectiveWallet = info?.spvWallet ?? wallet.trim();

  // ---- Khối kiểm tra: hỏi máy chủ mỗi khi nội dung đổi ----
  const payload =
    info && amount.trim() !== ''
      ? {
          type,
          chain,
          tokenSymbol: info.tokenSymbol,
          amount: amount.trim(),
          ...(type === 'MINT' ? { wallet: effectiveWallet } : { burnSource }),
          reason,
          documentRef,
          effectiveDate: effectiveDate || undefined,
          note,
        }
      : null;
  const payloadKey = payload ? JSON.stringify({ payload, revision }) : null;

  const [checked, setChecked] = useState<{ key: string; state: PreviewState } | null>(null);
  useEffect(() => {
    if (!payloadKey) return;
    const { payload: body } = JSON.parse(payloadKey) as { payload: unknown };
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewTokenRequestAction(body).then((result) => {
        if (cancelled) return;
        setChecked({
          key: payloadKey,
          state: result.ok
            ? { kind: 'checked', checks: result.data.checks, allPassed: result.data.allPassed }
            : { kind: 'invalid', message: describeInvalid(result.error, result.fieldErrors) },
        });
      });
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payloadKey]);

  const preview: PreviewState = !payloadKey
    ? { kind: 'idle' }
    : checked?.key === payloadKey
      ? checked.state
      : { kind: 'loading' };

  const sourceEffect = type === 'BURN' ? burnSourceEffect(burnSource, info?.totalSupply ?? null) : null;
  const blockReason = submitting
    ? 'Đang gửi…'
    : submitBlockReason(preview, Boolean(sourceEffect?.needsConfirmation) && !confirmed);

  const chooseSource = (source: BurnSource) => {
    setBurnSource(source);
    setConfirmed(false);
    const effect = burnSourceEffect(source, info?.totalSupply ?? null);
    if (effect.amount !== null) setAmount(effect.amount);
  };

  const submit = () => {
    if (!payload || blockReason) return;
    setFeedback(null);
    startSubmit(async () => {
      const result = await createTokenRequestAction(payload);
      if (!result.ok) {
        setFeedback({ tone: 'error', message: describeInvalid(result.error, result.fieldErrors) });
        return;
      }
      const request = result.data.request;
      setFeedback({
        tone: 'success',
        message:
          `Đã gửi yêu cầu ${text.verb} ${formatAmount(request.amount)} ${request.tokenSymbol} ` +
          `(mã ${request.id.slice(0, 8)}). Yêu cầu đang chờ Kiểm soát viên duyệt.`,
      });
      setAmount('');
      setReason('');
      setDocumentRef('');
      setEffectiveDate('');
      setNote('');
      setConfirmed(false);
      setBurnSource('UNDISTRIBUTED');
      onSubmitted();
    });
  };

  return (
    <Card aria-label={`Thẻ ${text.title.toLowerCase()}`}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{text.title}</CardTitle>
        {type === 'MINT' ? (
          <PlusCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Flame className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Field id={id('symbol')} label="Mã hoặc ký hiệu token">
          <input
            id={id('symbol')}
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="WPT"
            spellCheck={false}
            className={`${INPUT_CLASS} font-mono uppercase`}
          />
        </Field>

        <TokenInfoBlock
          info={info}
          error={infoFresh?.error ?? null}
          loading={infoKey !== null && infoFresh === null}
        />

        {type === 'MINT' ? (
          <Field
            id={id('wallet')}
            label="Ví đích (ví thanh toán SPV)"
            hint={
              info?.spvWallet
                ? 'Đã có ví thanh toán trên chuỗi — yêu cầu tạo token chỉ vào đúng ví này.'
                : 'Chưa phát hành lần nào: nhập ví thanh toán SPV sẽ nhận token.'
            }
          >
            <input
              id={id('wallet')}
              value={info?.spvWallet ?? wallet}
              onChange={(event) => setWallet(event.target.value)}
              readOnly={Boolean(info?.spvWallet)}
              spellCheck={false}
              placeholder="0x…"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
        ) : (
          <Field id={id('source')} label="Nguồn huỷ">
            <select
              id={id('source')}
              value={burnSource}
              onChange={(event) => chooseSource(event.target.value as BurnSource)}
              className={INPUT_CLASS}
            >
              {(Object.keys(BURN_SOURCE_LABELS) as BurnSource[]).map((source) => (
                <option key={source} value={source}>
                  {BURN_SOURCE_LABELS[source]}
                </option>
              ))}
            </select>
          </Field>
        )}

        {sourceEffect?.warning && (
          <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>{sourceEffect.warning}</span>
            </p>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Tôi xác nhận huỷ toàn bộ nguồn cung
            </label>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id('amount')} label="Số lượng">
            <input
              id={id('amount')}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              readOnly={type === 'BURN' && burnSource === 'TOTAL_SUPPLY'}
              inputMode="numeric"
              className={`${INPUT_CLASS} font-mono`}
            />
          </Field>
          <Field id={id('effective')} label="Ngày hiệu lực">
            <input
              id={id('effective')}
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
        <Field id={id('reason')} label="Lý do">
          <input
            id={id('reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field id={id('document')} label="Chứng từ">
          <input
            id={id('document')}
            value={documentRef}
            onChange={(event) => setDocumentRef(event.target.value)}
            placeholder="Số quyết định, số hồ sơ…"
            className={INPUT_CLASS}
          />
        </Field>
        <Field id={id('note')} label="Ghi chú">
          <textarea
            id={id('note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </Field>

        <RequestCheckBlock preview={preview} />

        <div className="space-y-2">
          <Button type="button" onClick={submit} disabled={blockReason !== null} title={blockReason ?? undefined}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Gửi yêu cầu {text.verb} token
          </Button>
          {blockReason && (
            <p className="text-xs text-muted-foreground" data-testid={`${text.idPrefix}-block-reason`}>
              Chưa gửi được: {blockReason}
            </p>
          )}
        </div>

        {feedback && (
          <div
            role="status"
            className={
              feedback.tone === 'success'
                ? 'flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm'
                : 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'
            }
          >
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
