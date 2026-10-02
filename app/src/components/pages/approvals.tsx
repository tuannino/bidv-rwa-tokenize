'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestTable } from '@/components/maker-checker/request-table';
import { INPUT_CLASS, StatCard } from '@/components/maker-checker/stat-card';
import { STATUS_LABELS } from '@/components/maker-checker/gates';
import { getApprovalStatsAction, listTokenRequestsAction } from '@/app/actions/token-request';
import type { ApprovalStatsView } from '@/lib/bank/token-request.service';
import {
  TOKEN_REQUEST_STATUSES,
  type TokenRequestRecord,
  type TokenRequestStatus,
  type TokenRequestType,
} from '@/lib/store/token-request.store.port';

/**
 * Màn **Phê duyệt lệnh** — vai Kiểm soát viên (FE-22 việc 8, 9).
 *
 * Ba thẻ số liệu và hai hàng chờ (tạo token, huỷ token). Duyệt / từ chối làm ở màn chi tiết
 * `/approvals/<mã>`, nơi có đủ khối thông tin token và nhật ký để quyết.
 *
 * Bộ lọc trạng thái gửi lên máy chủ; ô tìm kiếm chỉ lọc các dòng ĐÃ tải về theo chữ — nó không
 * quyết định gì về nghiệp vụ, chỉ giúp tìm một dòng trong bảng.
 */

/** Đủ rộng cho hàng chờ của một PoC; chạm ngưỡng thì màn hình nói ra, không cắt lặng lẽ. */
const QUEUE_LIMIT = 200;

export function ApprovalsPage() {
  const [stats, setStats] = useState<{ data: ApprovalStatsView | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getApprovalStatsAction().then((result) => {
      if (cancelled) return;
      setStats(result.ok ? { data: result.data, error: null } : { data: null, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Phê duyệt lệnh</h1>
        <p className="text-sm text-muted-foreground">
          Xem yêu cầu Giao dịch viên đã lập rồi chấp nhận hoặc từ chối. Chấp nhận thì hệ thống kiểm lại
          điều kiện và thực hiện ngay trên chuỗi.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Đang chờ duyệt" value={stats?.data?.pending ?? null} />
        <StatCard label="Đã duyệt hôm nay" value={stats?.data?.approvedToday ?? null} />
        <StatCard label="Đã từ chối hôm nay" value={stats?.data?.rejectedToday ?? null} />
      </div>
      {stats?.error && <p className="text-sm text-destructive">{stats.error}</p>}

      <Queue type="MINT" title="Hàng chờ tạo token" />
      <Queue type="BURN" title="Hàng chờ huỷ token" />
    </div>
  );
}

/** `ALL` = không lọc trạng thái. */
type StatusFilter = TokenRequestStatus | 'ALL';

function Queue({ type, title }: { type: TokenRequestType; title: string }) {
  const prefix = type === 'MINT' ? 'mint' : 'burn';
  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState<{
    key: StatusFilter;
    rows: TokenRequestRecord[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listTokenRequestsAction({
      type,
      status: status === 'ALL' ? undefined : status,
      limit: QUEUE_LIMIT,
    }).then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { key: status, rows: result.data, error: null }
          : { key: status, rows: [], error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [type, status]);

  const fresh = loaded?.key === status ? loaded : null;
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
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Bấm mã yêu cầu để xem chi tiết và quyết định.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-1.5">
            <label htmlFor={`${prefix}-search`} className="text-sm font-medium">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                id={`${prefix}-search`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mã yêu cầu, người lập, lý do, chứng từ…"
                className={`${INPUT_CLASS} pl-9`}
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
              className={INPUT_CLASS}
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

        {fresh?.error && <p className="text-sm text-destructive">{fresh.error}</p>}
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
        />
      </CardContent>
    </Card>
  );
}
