# FIX-04: thiết kế

## 1. Backend (B1, B2)

Supervisor đã dựng thử trên `dev` @ `34bf33a`: typecheck, lint sạch; chạy trên chain mock ra đúng `projectName` ("Dự án điện gió An Viên") và `paymentBalance`. Đoạn dưới để ĐỌC HIỂU và áp bằng tay (không dùng `git apply`); đổi gì thì ghi lý do vào checkpoint.

`lib/bank/portfolio.service.ts`:

```ts
// import: thêm getProjectStore
import { getProjectStore, getSettlementStore, getStore } from '@/lib/store';

// PortfolioView: thêm trường; XOÁ khối chú thích "KHÔNG có trường số dư VNDB..." (dòng 71-76)
  /** FIX-04 B1: số dư VNDB của ví; `null` khi lần đọc này lỗi (không kéo cả lời gọi đổ). */
  paymentBalance: string | null;

// getPortfolio: thêm phần tử cuối vào lô Promise.all đang có
const [balance, whitelisted, frozen, info, issuePriceVnd, recallPhase, paymentBalance] = await Promise.all([
  /* 6 lần đọc cũ giữ nguyên */
  orNull('paymentBalanceOf', () => ledger.paymentBalanceOf(wallet)),
]);
// ...trong object trả về:
  paymentBalance: paymentBalance === null ? null : paymentBalance.toString(),

// TokenSummary: thêm trường
  /** FIX-04 B2: tên dự án trong bảng dự án; `null` khi không có dòng hoặc đọc lỗi. */
  projectName: string | null;

// getTokenSummary: sau authorize
const chain = parsed.data;
const [info, issuePriceVnd] = await Promise.all([getLedger(chain).tokenInfo(), readEffectiveIssuePrice(chain)]);
const project = await orNull('findProject', () => getProjectStore().findProject({ tokenSymbol: info.symbol, chain }));
// ...trong object trả về:
  projectName: project?.name ?? null,

/** FIX-04 QĐ-3: lần đọc THÊM lỗi thì trả `null`; log chỉ ghi tên lỗi (nội dung có thể chứa địa chỉ RPC kèm khoá). */
async function orNull<T>(label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.error(`[portfolio] Không đọc được ${label}:`, error instanceof Error ? error.name : 'Error');
    return null;
  }
}
```

Ghi chú:

- `orNull` chỉ bọc các lần đọc THÊM. Lần đọc cũ (`balanceOf`, `tokenInfo`, giá...) giữ nguyên cách ném lỗi như trước.
- Không đổi cổng `authorize('portfolio:read', null, chain)`, không đổi `assertSessionWallet`.
- Không dùng `recallWallets` hay `listTokenWallets` (requirements mục 1: kéo Indexer ghi bộ đệm).

## 2. Hook dùng chung (F2)

Hai tệp: phần logic thuần (không React, không import action) để vitest gọi trực tiếp, và hook mỏng. Supervisor đã dựng thử: typecheck, lint sạch; hai lời gọi trùng chain bị reject thì `call` chạy một lần và cả hai nhận `LOAD_FAILED`; gọi lại sau đó chạy lần mới; `freshFor` bỏ kết quả chain cũ.

`app/src/components/investor/token-summary-state.ts`:

```ts
import type { TokenSummary } from '@/lib/bank/portfolio.service';

type ActionResult = { ok: true; data: TokenSummary } | { ok: false; error: string };
export type Loaded = { key: string; data: TokenSummary | null; error: string | null };

/** Câu an toàn khi lời gọi bị reject (lỗi mạng, phản hồi không đọc được): không lộ nội dung lỗi. */
export const LOAD_FAILED = 'Chưa đọc được thông tin token, thử tải lại trang.';

const inflight = new Map<string, Promise<unknown>>();

/**
 * FIX-04 F2: gộp lời gọi đang chạy theo khoá, để hai hộp của Tổng quan Nhà đầu tư chỉ tạo MỘT lời gọi
 * (HF-01 (hiệu năng mở màn): không tăng số lời gọi khi mở màn). Xong, kể cả bị reject, thì bỏ khỏi
 * bảng gộp: lần sau gọi lại được.
 */
export function shareInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const started = run().finally(() => inflight.delete(key));
  inflight.set(key, started);
  return started;
}

/** Luôn trả `Loaded`, KHÔNG reject: kết quả lỗi và lời gọi bị reject đều thành `error`. */
export async function loadTokenSummary(chain: string, call: (chain: string) => Promise<ActionResult>): Promise<Loaded> {
  try {
    const result = await shareInflight(`token-summary:${chain}`, () => call(chain));
    return result.ok ? { key: chain, data: result.data, error: null } : { key: chain, data: null, error: result.error };
  } catch {
    return { key: chain, data: null, error: LOAD_FAILED };
  }
}

/** Kết quả của chain cũ không được dùng cho chain đang chọn. */
export function freshFor(chain: string, loaded: Loaded | null): Loaded | null {
  return loaded?.key === chain ? loaded : null;
}

/** F4: tên dự án thật khi có; còn lại (đang tải, lỗi, `null`) thì tên mẫu kèm cờ "unverified". */
export function projectNameView(fresh: Loaded | null, sampleName: string): { text: string; unverified: boolean } {
  const name = fresh?.data?.projectName;
  return name ? { text: name, unverified: false } : { text: sampleName, unverified: true };
}
```

`app/src/components/investor/use-token-summary.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { getTokenSummaryAction } from '@/app/actions/portfolio';
import { freshFor, loadTokenSummary, type Loaded } from './token-summary-state';

export function useTokenSummary(chain: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTokenSummary(chain, getTokenSummaryAction).then((next) => {
      if (!cancelled) setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  // "Đang tải" suy ra từ khoá, không đặt state đồng bộ trong effect (cùng cách hộp cũ đang làm).
  const fresh = freshFor(chain, loaded);
  return { fresh, data: fresh?.data ?? null, error: fresh?.error ?? null, loading: fresh === null };
}
```

`issuance-status-box.tsx` thay khối `useState`/`useEffect` đang gọi `getTokenSummaryAction` (dòng 37 tới 64) bằng `const { data, error, loading } = useTokenSummary(chain);`, phần hiển thị giữ nguyên; bỏ import `useEffect`, `useState`, `getTokenSummaryAction`, `TokenSummary` nếu hết dùng (lint). `token-list-box.tsx` (đã là client) lấy `const { chain } = useSelectedChain();`, `const { fresh } = useTokenSummary(chain);`, rồi `projectNameView(fresh, project.name)` cho dòng token đã lên chuỗi: `unverified` thì hiện `<UnverifiedNote title="Tên mẫu, chưa đọc được tên dự án trong hệ thống" />` ngay cạnh tên.

## 3. `UnverifiedNote` (F8)

```tsx
import { cn } from '@/lib/utils';

/** FIX-04 QĐ-4: ghi chú chữ chìm cho số liệu chưa có nguồn thật trong hệ thống. */
export function UnverifiedNote({
  className,
  title = 'Chưa có nguồn dữ liệu thật trong hệ thống',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={cn('shrink-0 text-xs font-normal text-muted-foreground', className)}>
      unverified
    </span>
  );
}
```

## 4. Hiển thị (F1, F3 tới F7)

- Số dư VNDB (F1): dùng cùng hàm định dạng số dư WPT đang có trong `asset-summary.tsx`, đơn vị "VNDB".
- Số người nắm giữ (F4): giữ số mẫu, thêm `UnverifiedNote` ngay sau số.
- `Section` ở `account-info.tsx` (F7): `<CardTitle ... className="flex items-center gap-2">{title}{note}</CardTitle>`.
- Lệnh bán trong ngày (F6): đúng mẫu hai ô "mua" bên trái: `<Stat label="Số lượng bán" value={nf(data.today.sell.wpt)} unit="WPT" hint={`${data.today.sell.count} lệnh`} />` và `<Stat label="Tổng giá trị bán" value={nf(data.today.sell.vnd)} unit="VNDB" />`.
- Mọi chỗ trước dùng `MockBadge` đổi thành `UnverifiedNote` ở đúng vị trí đó; giữ `title` cũ nếu có.
