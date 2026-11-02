# FIX-05: thiết kế

## 1. Backend (B1 tới B3)

Supervisor đã dựng thử `getOpsOverview` trên `dev` @ `34bf33a` (chain mock, vai Giao dịch viên): typecheck, lint sạch; trả đủ 4 trường; vai Nhà đầu tư nhận `FORBIDDEN`. `partOf` ở `config.service.ts:447` trả `Result` nên cố ý không dùng lại; `readOrNull` trả `null` theo QĐ-3. Đoạn dưới là bản gốc, áp bằng tay; đổi gì thì ghi lý do vào checkpoint.

`lib/bank/read-or-null.ts` (B3, chuyển từ `orNull` của FIX-04):

```ts
/**
 * Lần đọc THÊM lỗi thì trả `null` và ghi log, không làm cả lời gọi thất bại (FIX-04 QĐ-3, FIX-05 QĐ-3).
 * Log chỉ ghi tên lỗi: nội dung lỗi có thể chứa địa chỉ RPC kèm khoá.
 */
export async function readOrNull<T>(scope: string, label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.error(`[${scope}] Không đọc được ${label}:`, error instanceof Error ? error.name : 'Error');
    return null;
  }
}
```

`portfolio.service.ts`: xoá hàm `orNull`, thêm `import { readOrNull } from './read-or-null';`, đổi mỗi `orNull('x', ...)` thành `readOrNull('portfolio', 'x', ...)`.

`lib/bank/overview.service.ts` (B1):

```ts
import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { getDistributionStore, getProjectStore, getWalletBindingStore } from '@/lib/store';
import { findCustomerProfile } from './account-profile.service';
import { readOrNull } from './read-or-null';
import { assertCan } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { toResult } from './authorize';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';

/** FIX-05: giới hạn đọc mỗi nguồn; chạm giới hạn thì báo `truncated`, không đọc thêm. */
export const OVERVIEW_PERIOD_LIMIT = 100;
export const OVERVIEW_BINDING_LIMIT = 200;
/** Số kỳ gần nhất trên biểu đồ lợi tức. */
export const OVERVIEW_SERIES_LENGTH = 6;

export interface OpsOverview {
  chain: ChainKey;
  /** Số dự án đã phát hành token trên chain (`status = ISSUED`); `null` khi đọc lỗi. */
  issuedProjects: number | null;
  /** Tổng cung token trên chuỗi; `null` khi đọc lỗi. */
  supply: { symbol: string; totalSupply: string } | null;
  /** Số hồ sơ nhà đầu tư có ít nhất một ví đã gắn; `null` khi đọc lỗi. */
  investors: { count: number; truncated: boolean } | null;
  /** Kỳ chia đã hoàn tất (`COMPLETED`): tổng VNDB, số kỳ, 6 kỳ gần nhất (cũ trước); `null` khi đọc lỗi. */
  profit: {
    totalAmount: string;
    periods: number;
    truncated: boolean;
    series: Array<{ periodKey: string; amount: string }>;
  } | null;
}

/** FIX-05: số liệu tổng hợp cho màn Tổng quan. Chỉ đọc; mỗi nguồn lỗi thì trường đó `null`. */
export async function getOpsOverview(chain: unknown): Promise<Result<OpsOverview>> {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  try {
    // Đọc khi mở màn: assertCan, KHÔNG authorize (authorize ghi sổ kiểm toán mỗi lần, lệch L-01).
    assertCan(await currentRole(), 'ops:read');
    const key = parsed.data;
    const [projects, info, bindings, periods] = await Promise.all([
      readOrNull('overview', 'listProjects', () => getProjectStore().listProjects({ chain: key, status: 'ISSUED' })),
      readOrNull('overview', 'tokenInfo', () => getLedger(key).tokenInfo()),
      readOrNull('overview', 'walletBindings', () => getWalletBindingStore().list(key, OVERVIEW_BINDING_LIMIT)),
      readOrNull('overview', 'listPeriods', () =>
        getDistributionStore().listPeriods({ chain: key, status: 'COMPLETED', limit: OVERVIEW_PERIOD_LIMIT }),
      ),
    ]);
    return ok({
      chain: key,
      issuedProjects: projects ? projects.length : null,
      supply: info ? { symbol: info.symbol, totalSupply: info.totalSupply.toString() } : null,
      investors: bindings
        ? {
            count: new Set(
              bindings
                .filter((row) => findCustomerProfile(row.actorId)?.role === 'INVESTOR')
                .map((row) => row.actorId),
            ).size,
            truncated: bindings.length >= OVERVIEW_BINDING_LIMIT,
          }
        : null,
      profit: periods
        ? {
            totalAmount: periods.reduce((sum, row) => sum + BigInt(row.totalAmount), 0n).toString(),
            periods: periods.length,
            truncated: periods.length >= OVERVIEW_PERIOD_LIMIT,
            series: periods
              .slice(0, OVERVIEW_SERIES_LENGTH)
              .reverse()
              .map((row) => ({ periodKey: row.periodKey, amount: row.totalAmount })),
          }
        : null,
    });
  } catch (error) {
    return toResult(error);
  }
}
```

`app/actions/overview.ts` (B2):

```ts
'use server';

import { getOpsOverview } from '@/lib/bank/overview.service';

/** FIX-05: vỏ mỏng; kiểm quyền `ops:read` nằm TRONG service (action gọi được bằng POST trực tiếp). */
export async function getOpsOverviewAction(chain: unknown) {
  return getOpsOverview(chain);
}
```

## 2. Màn Tổng quan (F1)

Tải dữ liệu: khoá theo chain, không đặt state đồng bộ trong effect, có nhánh bắt lời gọi bị reject (cùng nguyên tắc `use-token-summary.ts` của FIX-04; màn chỉ một nơi gọi nên không cần gộp lời gọi). Kiểu nhập bằng `import type { OpsOverview } from '@/lib/bank/overview.service'` (tệp có `server-only`):

```ts
const { chain } = useSelectedChain();
const [loaded, setLoaded] = useState<{ key: string; data: OpsOverview | null; error: string | null } | null>(null);
useEffect(() => {
  let cancelled = false;
  getOpsOverviewAction(chain)
    .then((result) => (result.ok ? { key: chain, data: result.data, error: null } : { key: chain, data: null, error: result.error }))
    .catch(() => ({ key: chain, data: null, error: 'Chưa đọc được số liệu tổng quan, thử tải lại trang.' }))
    .then((next) => {
      if (!cancelled) setLoaded(next);
    });
  return () => {
    cancelled = true;
  };
}, [chain]);
const fresh = loaded?.key === chain ? loaded : null;
```

Bố cục (giữ `KpiCard`, màu theo token theme như hiện tại):

| Vị trí | Nhãn | Giá trị | Dòng phụ |
|---|---|---|---|
| Đầu màn | Tiêu đề "Tổng quan", nút "Phát hành WPT" | giữ nguyên | |
| Thẻ 1 | "Dự án đang triển khai" | `issuedProjects` | "Đã phát hành token trên chain đang chọn" |
| Thẻ 2 (nổi bật) | "Tổng cung token" | `formatAmount(supply.totalSupply)` + ` ${supply.symbol}` | Hai thanh ngang theo loại token: thanh thứ nhất nhãn `supply.symbol` (thanh đầy, số tổng cung); TCC: "–" và `<UnverifiedNote title="Chưa hỗ trợ token TCC" />`, không vẽ thanh |
| Thẻ 3 | "Nhà đầu tư đã định danh" | `investors.count` (thêm `+` khi `truncated`) | "Hồ sơ đã gắn ví" |
| Thẻ 4 | "Sản lượng luỹ kế" | `MOCK_WIND_STATS.cumulativeGenerationMwh` + " MWh" | `<UnverifiedNote title="Chưa có nguồn sản lượng thật" />` |
| Thẻ 5 | "Lợi tức đã chia" | `formatAmount(profit.totalAmount)` + " VNDB" | `${profit.periods} kỳ đã hoàn tất` (thêm `+` sau số kỳ khi `truncated`) |
| Hàng dưới | Khung "Sản lượng và lợi tức theo kỳ" | Hai biểu đồ cạnh nhau (xếp dọc trên màn hẹp) | |
| Biểu đồ trái | "Lợi tức theo kỳ" | `BarChart` (recharts), trục X `periodKey`, giá trị `Number(amount)`, đơn vị VNDB trong tooltip | `series` rỗng: "Chưa có kỳ chia nào hoàn tất." |
| Biểu đồ phải | "Sản lượng theo tháng" + `<UnverifiedNote />` | `AreaChart` dữ liệu `MOCK_GENERATION_SERIES` (chỉ trường `generationMwh`) | |

Trạng thái ô: đang tải thì "Đang đọc"; trường `null` hoặc cả lời gọi lỗi thì "Chưa đọc được"; cả lời gọi lỗi thì thêm một dòng `text-sm text-destructive` dưới tiêu đề với `error`. Lưới thẻ: `grid gap-4 sm:grid-cols-2 xl:grid-cols-5`.

Bỏ: import `MOCK_PROJECTS`, `ProjectBar`, `ProjectCard`, `Row` nếu hết dùng, mọi chữ "EnergyOracle", "ProfitDistributor", "whitelisted".

## 3. Ghi chú dữ liệu mẫu (F2, F3)

```tsx
/** FIX-05: ghi chú sau tiêu đề màn đang hiển thị toàn bộ dữ liệu mẫu. */
export function SampleDataNote() {
  return <span className="text-sm font-normal text-muted-foreground">(đang hiển thị dữ liệu mẫu)</span>;
}
```

Ở 3 màn, khối tiêu đề hiện là `<div><HoverHint ...><h1 ...>...</h1></HoverHint></div>`. Đổi `div` bọc ngoài thành `<div className="flex flex-wrap items-baseline gap-2">` và thêm `<SampleDataNote />` ngay sau `HoverHint`.
