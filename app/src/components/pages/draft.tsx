'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, History, Loader2, PlusCircle, Send, TriangleAlert } from 'lucide-react';
import type { ChainKey } from '@bidv/shared';
import { Alert } from '@/components/ui/alert';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { fieldClass } from '@/components/ui/field';
import { Kpi } from '@/components/ui/kpi';
import { RequestCheckBlock } from '@/components/maker-checker/request-check-block';
import { RequestTable } from '@/components/maker-checker/request-table';
import { TokenInfoBlock } from '@/components/maker-checker/token-info-block';
import { fetchTokenInfo, tokenInfoReadErrorMessage } from '@/components/maker-checker/token-info-read';
import {
  BURN_SOURCE_LABELS,
  burnAmountShown,
  burnSourceEffect,
  describeInvalid,
  submitBlockReason,
  type BurnSource,
  type PreviewState,
} from '@/components/maker-checker/gates';
import {
  createTokenRequestAction,
  getDraftStatsAction,
  listTokenRequestsAction,
  previewTokenRequestAction,
} from '@/app/actions/token-request';
import type { DraftStatsView, TokenInfoView } from '@/lib/bank/token-request.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount } from '@/lib/format';
import type { TokenRequestRecord, TokenRequestType } from '@/lib/store/token-request.store.port';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

/**
 * Màn **Lập lệnh** — vai Giao dịch viên (FE-22 việc 1–7).
 *
 * Component này KHÔNG gọi chuỗi và KHÔNG tự tính điều kiện nào: thông tin token, khối kiểm tra, số
 * liệu và danh sách đều do server action trả (`app/actions/token-request.ts` → `token-request.service`).
 * Nút gửi bị khoá theo đúng kết quả khối kiểm tra máy chủ trả; chốt chặn thật vẫn ở service vì server
 * action gọi được bằng POST trực tiếp.
 *
 * FE-UX-02b: hai ô số liệu `Kpi` (sắc thường, giữ `aria-label`), hai thẻ biểu mẫu có biểu tượng tiêu
 * đề, ô nhập `fieldClass`, cảnh báo và phản hồi dùng `Alert` giữ đúng `role`; bảng yêu cầu hiện khung
 * đang tải khi chưa có dữ liệu. Không đổi hook, handler, điều kiện khoá.
 */
const KPI_VALUE = (value: number | null) => (value === null ? '–' : formatAmount(value));

/** Chờ người dùng gõ xong rồi mới hỏi máy chủ — không thì mỗi ký tự là một lượt gọi. */
const LOOKUP_DEBOUNCE_MS = 300;

/** Một phép đọc bị kẹt không được giữ giao diện ở trạng thái loading vô hạn. */
const READ_TIMEOUT_MS = 15_000;

class DraftReadTimeoutError extends Error {}

function withReadTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new DraftReadTimeoutError()), READ_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

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
  const loadKey = `${chain}|${revision}`;
  const [stats, setStats] = useState<{ key: string; data: DraftStatsView | null; error: string | null } | null>(null);
  const [mine, setMine] = useState<{
    key: string;
    mint: TokenRequestRecord[];
    burn: TokenRequestRecord[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void withReadTimeout(
      Promise.all([
        getDraftStatsAction(chain),
        listTokenRequestsAction({ chain, mine: true, type: 'MINT', limit: MY_REQUESTS_LIMIT }),
        listTokenRequestsAction({ chain, mine: true, type: 'BURN', limit: MY_REQUESTS_LIMIT }),
      ]),
    )
      .then(([statsResult, mintResult, burnResult]) => {
        if (cancelled) return;
        setStats(
          statsResult.ok
            ? { key: loadKey, data: statsResult.data, error: null }
            : { key: loadKey, data: null, error: statsResult.error },
        );
        setMine({
          key: loadKey,
          mint: mintResult.ok ? mintResult.data : [],
          burn: burnResult.ok ? burnResult.data : [],
          error: !mintResult.ok ? mintResult.error : !burnResult.ok ? burnResult.error : null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof DraftReadTimeoutError
          ? 'Không đọc được dữ liệu từ máy chủ sau 15 giây. Vui lòng thử tải lại trang.'
          : 'Không kết nối được máy chủ để đọc danh sách yêu cầu. Vui lòng thử tải lại trang.';
        setStats({ key: loadKey, data: null, error: message });
        setMine({
          key: loadKey,
          mint: [],
          burn: [],
          error: message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [chain, loadKey, revision]);

  const freshStats = stats?.key === loadKey ? stats : null;
  const freshMine = mine?.key === loadKey ? mine : null;

  const onSubmitted = useCallback(() => {
    setRevision((value) => value + 1);
    // Số việc chờ cạnh menu do `AppLayout` (Server Component) dựng — làm mới để nó đọc lại.
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6" data-chain={chain}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Lập lệnh</h1>
        <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
      </header>

      <div className="grid gap-4 min-[1100px]:grid-cols-2">
        <Kpi
          aria-label="Yêu cầu tạo token đang chờ"
          label="Yêu cầu tạo token đang chờ"
          value={KPI_VALUE(freshStats?.data?.pendingMint ?? null)}
          icon={<PlusCircle />}
        />
        <Kpi
          aria-label="Yêu cầu huỷ token đang chờ"
          label="Yêu cầu huỷ token đang chờ"
          value={KPI_VALUE(freshStats?.data?.pendingBurn ?? null)}
          icon={<Flame />}
        />
      </div>
      {freshStats?.error && <Alert tone="bad">{freshStats.error}</Alert>}

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-2">
        <RequestForm type="MINT" chain={chain} revision={revision} onSubmitted={onSubmitted} />
        <RequestForm type="BURN" chain={chain} revision={revision} onSubmitted={onSubmitted} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <CardTitleIcon>
              <History />
            </CardTitleIcon>
            Yêu cầu đã lập
          </CardTitle>
          <CardDescription>
            Yêu cầu do chính bạn lập, mới nhất trước. Trạng thái cập nhật sau mỗi lần gửi hoặc tải lại trang.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {freshMine?.error && <Alert tone="bad">{freshMine.error}</Alert>}
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Yêu cầu tạo token</h3>
            <RequestTable
              caption="Yêu cầu tạo token đã lập"
              rows={freshMine?.mint ?? []}
              emptyText={freshMine ? 'Chưa lập yêu cầu tạo token nào.' : 'Đang tải…'}
              loading={!freshMine}
            />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Yêu cầu huỷ token</h3>
            <RequestTable
              caption="Yêu cầu huỷ token đã lập"
              rows={freshMine?.burn ?? []}
              emptyText={freshMine ? 'Chưa lập yêu cầu huỷ token nào.' : 'Đang tải…'}
              loading={!freshMine}
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
  const [lookupRevision, setLookupRevision] = useState(0);
  const [loadedInfo, setLoadedInfo] = useState<{
    key: string;
    revision: number;
    data: TokenInfoView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!infoKey) return;
    const [keyChain, keySymbol] = infoKey.split('|');
    const controller = new AbortController();
    const readId = crypto.randomUUID();
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchTokenInfo(keyChain, keySymbol, readId, controller.signal)
        .then((result) => {
          if (cancelled) return;
          setLoadedInfo(
            result.ok
              ? { key: infoKey, revision: lookupRevision, data: result.data, error: null }
              : { key: infoKey, revision: lookupRevision, data: null, error: `${result.error} Mã tra cứu: ${readId}` },
          );
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setLoadedInfo({
            key: infoKey, revision: lookupRevision,
            data: null,
            error: tokenInfoReadErrorMessage(error, readId),
          });
        });
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [infoKey, lookupRevision]);

  const infoFresh = infoKey !== null && loadedInfo?.key === infoKey && loadedInfo.revision === lookupRevision ? loadedInfo : null;
  const info = infoFresh?.data ?? null;

  /**
   * Ví đích của Mint: ví thanh toán SPV máy chủ đã trả. Chưa phát hành lần nào thì chuỗi chưa ghi
   * ví SPV — lúc đó mới cho nhập tay, và khối kiểm tra của máy chủ quyết định ví đó có hợp lệ không.
   */
  const effectiveWallet = info?.spvWallet ?? wallet.trim();

  // ---- Khối kiểm tra: hỏi máy chủ mỗi khi nội dung đổi ----
  // FIX-02 C1: Burn "Toàn bộ nguồn cung" luôn lấy tổng cung hiện tại, không lấy số đã gõ.
  const amountShown = burnAmountShown(type, burnSource, amount, info?.totalSupply ?? null);
  const payload =
    info && amountShown.trim() !== ''
      ? {
          type,
          chain,
          tokenSymbol: info.tokenSymbol,
          amount: amountShown.trim(),
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

  const fullSupplyAmount = type === 'BURN' && burnSource === 'TOTAL_SUPPLY';

  const chooseSource = (source: BurnSource) => {
    setBurnSource(source);
    setConfirmed(false);
    if (source === 'UNDISTRIBUTED') setAmount('');
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>{type === 'MINT' ? <PlusCircle /> : <Flame />}</CardTitleIcon>
          {text.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field id={id('symbol')} label="Mã hoặc ký hiệu token">
          <input
            id={id('symbol')}
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="WPT"
            spellCheck={false}
            className={`${fieldClass} uppercase`}
          />
        </Field>

        <TokenInfoBlock
          info={info}
          error={infoFresh?.error ?? null}
          loading={infoKey !== null && infoFresh === null}
        />
        {infoFresh?.error && (
          <Button type="button" variant="outline" onClick={() => setLookupRevision((value) => value + 1)}>
            Thử đọc lại thông tin token
          </Button>
        )}

        {type === 'MINT' ? (
          <Field
            id={id('wallet')}
            label="Ví đích (ví thanh toán SPV)"
            hint={
              info?.spvWallet
                ? 'Đã có ví thanh toán trên chuỗi, yêu cầu tạo token chỉ vào đúng ví này.'
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
              className={`${fieldClass} font-code`}
            />
          </Field>
        ) : (
          <Field id={id('source')} label="Nguồn huỷ">
            <select
              id={id('source')}
              value={burnSource}
              onChange={(event) => chooseSource(event.target.value as BurnSource)}
              className={fieldClass}
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
          <Alert
            tone="bad"
            role="alert"
            icon={<TriangleAlert className="mt-px size-[18px] shrink-0" aria-hidden="true" />}
          >
            <p>{sourceEffect.warning}</p>
            <label className="mt-2 flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Tôi xác nhận huỷ toàn bộ nguồn cung
            </label>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={id('amount')}
            label="Số lượng"
            hint={
              fullSupplyAmount
                ? info
                  ? 'Tự điền bằng tổng cung hiện tại, không sửa được.'
                  : 'Nhập mã token để hệ thống điền tổng cung.'
                : undefined
            }
          >
            <AmountInput
              id={id('amount')}
              value={amountShown}
              onValueChange={setAmount}
              readOnly={fullSupplyAmount}
              className={`${fieldClass} read-only:bg-muted read-only:text-muted-foreground tabular-nums`}
            />
          </Field>
          <Field id={id('effective')} label="Ngày hiệu lực">
            <input
              id={id('effective')}
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
        <Field id={id('reason')} label="Lý do">
          <input
            id={id('reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field id={id('document')} label="Chứng từ">
          <input
            id={id('document')}
            value={documentRef}
            onChange={(event) => setDocumentRef(event.target.value)}
            placeholder="Số quyết định, số hồ sơ…"
            className={fieldClass}
          />
        </Field>
        <Field id={id('note')} label="Ghi chú">
          <textarea
            id={id('note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className={fieldClass}
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
          <Alert tone={feedback.tone === 'success' ? 'ok' : 'bad'} role="status">
            {feedback.message}
          </Alert>
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
