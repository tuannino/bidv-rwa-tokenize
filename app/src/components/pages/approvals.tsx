'use client';

import { useEffect, useState } from 'react';
import { CirclePlus, Clock, Flame, History, Search, ShieldCheck, ShieldX } from 'lucide-react';
import type { ChainKey } from '@bidv/shared';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { fieldClass } from '@/components/ui/field';
import { Kpi } from '@/components/ui/kpi';
import { RequestTable } from '@/components/maker-checker/request-table';
import { STATUS_LABELS } from '@/components/maker-checker/gates';
import { getApprovalStatsAction, listTokenRequestsAction } from '@/app/actions/token-request';
import type { ApprovalStatsView } from '@/lib/bank/token-request.service';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { formatAmount } from '@/lib/format';
import {
  APPROVAL_HISTORY_LIMIT,
  TOKEN_REQUEST_STATUSES,
  type TokenRequestRecord,
  type TokenRequestStatus,
  type TokenRequestType,
} from '@/lib/store/token-request.store.port';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

/**
 * Màn **Phê duyệt lệnh** — vai Kiểm soát viên (FE-22 việc 8, 9).
 *
 * Ba thẻ số liệu, hai hàng chờ (tạo token, huỷ token) và lịch sử phê duyệt (UIUX-01). Duyệt /
 * từ chối làm ở màn chi tiết `/approvals/<mã>`, nơi có đủ khối thông tin token và nhật ký để quyết.
 *
 * Bộ lọc trạng thái gửi lên máy chủ; ô tìm kiếm chỉ lọc các dòng ĐÃ tải về theo chữ — nó không
 * quyết định gì về nghiệp vụ, chỉ giúp tìm một dòng trong bảng.
 *
 * FE-UX-03a: 3 ô số liệu `Kpi` sắc thường (giữ `aria-label`, chưa có số thì "–"); thẻ có biểu tượng tiêu
 * đề; lỗi là `Alert bad` không `role`; bảng chưa có dữ liệu hiện khung đang tải (`RequestTable loading`).
 */

/** Đủ rộng cho hàng chờ của một PoC; chạm ngưỡng thì màn hình nói ra, không cắt lặng lẽ. */
const QUEUE_LIMIT = 200;

/** Giá trị ô số liệu: chưa đọc được là "–", không phải 0. */
const kpiValue = (value: number | null) => (value === null ? '–' : formatAmount(value));

export function ApprovalsPage() {
  const { chain } = useSelectedChain();
  const [stats, setStats] = useState<{
    chain: ChainKey;
    data: ApprovalStatsView | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getApprovalStatsAction(chain).then((result) => {
      if (cancelled) return;
      setStats(
        result.ok
          ? { chain, data: result.data, error: null }
          : { chain, data: null, error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  const freshStats = stats?.chain === chain ? stats : null;

  return (
    <div className="space-y-6" data-chain={chain}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Phê duyệt lệnh</h1>
        <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
      </header>

      <div className="grid gap-4 min-[1100px]:grid-cols-3">
        <Kpi
          aria-label="Đang chờ duyệt"
          label="Đang chờ duyệt"
          value={kpiValue(freshStats?.data?.pending ?? null)}
          icon={<Clock />}
        />
        <Kpi
          aria-label="Đã duyệt hôm nay"
          label="Đã duyệt hôm nay"
          value={kpiValue(freshStats?.data?.approvedToday ?? null)}
          icon={<ShieldCheck />}
        />
        <Kpi
          aria-label="Đã từ chối hôm nay"
          label="Đã từ chối hôm nay"
          value={kpiValue(freshStats?.data?.rejectedToday ?? null)}
          icon={<ShieldX />}
        />
      </div>
      {freshStats?.error && <Alert tone="bad">{freshStats.error}</Alert>}

      <Queue chain={chain} type="MINT" title="Hàng chờ tạo token" />
      <Queue chain={chain} type="BURN" title="Hàng chờ huỷ token" />
      <ApprovalHistory stats={freshStats} />
    </div>
  );
}

/**
 * Thẻ "Lịch sử phê duyệt" (UIUX-01 A3): đọc `history` đi kèm action thẻ số liệu, không gọi thêm
 * action. Lỗi đọc dùng chung câu lỗi của thẻ số liệu.
 */
function ApprovalHistory({
  stats,
}: {
  stats: { data: ApprovalStatsView | null; error: string | null } | null;
}) {
  const title = 'Lịch sử phê duyệt';
  const rows = stats?.data?.history ?? [];
  return (
    <Card aria-label={title}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>
            <History />
          </CardTitleIcon>
          {title}
        </CardTitle>
        <CardDescription>Các yêu cầu đã được duyệt hoặc từ chối trên chain này, mới quyết định trước.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats?.error ? (
          <Alert tone="bad">{stats.error}</Alert>
        ) : (
          <RequestTable
            variant="history"
            caption={title}
            rows={rows}
            detailHref={(id) => `/approvals/${id}`}
            emptyText={stats ? 'Chưa có quyết định nào.' : 'Đang tải…'}
            loading={!stats}
          />
        )}
        {rows.length >= APPROVAL_HISTORY_LIMIT && (
          <p className="text-xs text-muted-foreground">Hiện {APPROVAL_HISTORY_LIMIT} quyết định gần nhất.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** `ALL` = không lọc trạng thái. */
type StatusFilter = TokenRequestStatus | 'ALL';

function Queue({ chain, type, title }: { chain: ChainKey; type: TokenRequestType; title: string }) {
  const prefix = type === 'MINT' ? 'mint' : 'burn';
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [search, setSearch] = useState('');
  const requestKey = `${chain}|${status}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: TokenRequestRecord[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listTokenRequestsAction({
      chain,
      type,
      status: status === 'ALL' ? undefined : status,
      limit: QUEUE_LIMIT,
    }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: requestKey, rows: result.data, error: null }
          : { key: requestKey, rows: [], error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [chain, requestKey, status, type]);

  const fresh = loaded?.key === requestKey ? loaded : null;
  const needle = search.trim().toLowerCase();
  const rows = (fresh?.rows ?? []).filter(
    (row) =>
      needle === '' ||
      [row.id, row.makerId, row.reason, row.tokenSymbol, row.documentRef ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle),
  );

  return (
    <Card aria-label={title}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <CardTitleIcon>{type === 'MINT' ? <CirclePlus /> : <Flame />}</CardTitleIcon>
          {title}
        </CardTitle>
        <CardDescription>Bấm mã yêu cầu để xem chi tiết và quyết định.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 min-[640px]:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-1.5">
            <label htmlFor={`${prefix}-search`} className="text-sm font-medium">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id={`${prefix}-search`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mã yêu cầu, người lập, lý do, chứng từ…"
                className={`${fieldClass} pl-10`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${prefix}-status`} className="text-sm font-medium">
              Trạng thái
            </label>
            <select
              id={`${prefix}-status`}
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className={fieldClass}
            >
              <option value="ALL">Tất cả trạng thái</option>
              {TOKEN_REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {fresh?.error && <Alert tone="bad">{fresh.error}</Alert>}
        {fresh && fresh.rows.length >= QUEUE_LIMIT && (
          <p className="text-xs text-muted-foreground">
            Đang hiện {QUEUE_LIMIT} yêu cầu mới nhất. Lọc theo trạng thái để thu hẹp.
          </p>
        )}
        <RequestTable
          caption={title}
          rows={rows}
          detailHref={(id) => `/approvals/${id}`}
          emptyText={fresh ? 'Không có yêu cầu nào khớp.' : 'Đang tải…'}
          loading={!fresh}
        />
      </CardContent>
    </Card>
  );
}
