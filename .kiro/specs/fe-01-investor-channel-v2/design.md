# FE-01 v2 — Kênh nhà đầu tư và trang tổng quan: design

## 1. Mô hình kênh và vai

### QĐ-1: Kênh là lựa chọn tường minh, vai suy ra từ kênh

```
Kênh "Nhà đầu tư"    → vai ép về INVESTOR, ẩn bộ chọn vai
Kênh "Admin console" → chọn vai trong ba vai: BANK_ADMIN, COMPLIANCE, AUDITOR
```

Hai cookie độc lập:

```
bidv_channel = 'investor' | 'admin'                            (mới, mặc định 'admin')
bidv_role    = BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR     (đã có, giữ nguyên)
```

Không suy vai từ kênh mỗi lần đọc, vì `currentRole()` và toàn bộ `lib/bank/` đã dùng cookie vai —
đổi cách đọc sẽ lan rộng. Cookie kênh chỉ phục vụ **hiển thị**.

**Ràng buộc bất biến:** `setChannel` đặt **cả hai** cookie trong một lần gọi.

| Hành động | `bidv_channel` | `bidv_role` |
|---|---|---|
| Chọn kênh Nhà đầu tư | `investor` | `INVESTOR` |
| Chọn kênh Admin console | `admin` | `BANK_ADMIN` nếu đang là `INVESTOR`, ngược lại giữ nguyên |
| Đổi vai trong Admin console | không đổi | vai được chọn |

### QĐ-2: Cookie kênh KHÔNG phải cơ sở phân quyền

Cookie do người dùng đặt được. Guard vẫn dùng `ChannelGuard` + `can(role, action)` với action mới:

```ts
// ACTIONS: thêm
'portfolio:read',
// ROLE_PERMISSIONS: chỉ INVESTOR
INVESTOR: ['token:transfer', 'portfolio:read', 'balance:read', 'txn:read'],
```

**Không** đưa `portfolio:read` vào `READ_ONLY` — đó chính là lý do v1 thất bại: `READ_ONLY` được
spread vào `BANK_ADMIN`, `COMPLIANCE`, `AUDITOR`, nên `balance:read` có ở cả bốn vai và guard của v1
không chặn được ai.

Không sửa `can.ts`, `channel-guard.tsx`, `currentRole()`. Chỉ sửa bảng dữ liệu — đúng LUẬT #3.

### QĐ-3: `lib/bank/` không đọc cookie kênh

Tầng nghiệp vụ chỉ đọc vai qua `currentRole()`. Cookie kênh chỉ dùng ở tầng giao diện.

### QĐ-4: `publicConfig()` thành async và đọc cookie

Hiện `role: env.demoRole` nên giao diện hiển thị sai vai sau khi đổi vai (requirements §3.1).
`publicConfig()` chỉ có **một** call site (`src/app/layout.tsx`, đã là `async`), nên chuyển sang
async là thay đổi cục bộ:

```ts
export async function publicConfig(): Promise<PublicConfig>   // + role từ currentRole(), + channel
```

Thêm `channel` vào `PublicConfig` để `Header` quyết định hiện/ẩn bộ chọn vai mà không phải tự đọc
cookie ở client.

Lợi ích kèm theo: `can(config.role, 'token:mint')` trong `mint.tsx` gate đúng vai từ đây.

## 2. Điều hướng theo kênh — cạm bẫy tuần tự hóa

**Đây là chỗ v1 vấp lỗi thật, không phải rủi ro lý thuyết.** `AppLayout` được dùng **trong từng
page** (Server Component) còn `Sidebar` là `'use client'`, nên `NavSection` đi qua biên
server → client. Đặt `icon` là component gây:

```
Error: Functions cannot be passed directly to Client Components ... render: function UserCheck
```

Cách xử lý (theo v1, đã kiểm chứng): `nav-config.ts` là **dữ liệu thuần**, `icon` là **tên dạng
chuỗi**, tra sang component qua bảng `NAV_ICONS` đặt trong `sidebar.tsx` (phía client).

Không chọn cách thêm `'use client'` vào `nav-config.ts`: prop vẫn phải tuần tự hóa khi qua biên, và
nó buộc `AppLayout` thành Client Component, mất khả năng render server của mọi trang.

### Đặt `AppLayout` ở đâu

Theo hiện trạng repo: `AppLayout` nằm **trong từng page**, `layout.tsx` của group chỉ chứa
`ChannelGuard`. Giữ đúng vậy để không lồng hai lần.

### Đường dẫn

Route group không tạo phân đoạn đường dẫn, nên trùng tên là trùng route. Đang dùng:
`/` `/mint` `/assets` `/reconciliation` `/kyc` `/audit`. Kênh nhà đầu tư dùng:

```
/portfolio          trang tổng quan
/tokens/[symbol]    chi tiết dự án token
/purchase           FE-05 — nav ở trạng thái chưa khả dụng, KHÔNG tạo trang
/earnings           FE-09 — nav ở trạng thái chưa khả dụng, KHÔNG tạo trang
/settlement         FE-11 — nav ở trạng thái chưa khả dụng, KHÔNG tạo trang
```

Ba mục cuối `disabled` nên không bọc `Link`, không điều hướng được → không cần trang chỗ trống.

## 3. Cấu trúc tệp

```
SỬA
  app/src/lib/rbac/permissions.ts          + action portfolio:read, cấp cho INVESTOR
  app/src/lib/config/flags.ts              publicConfig() async, + role từ cookie, + channel
  app/src/app/layout.tsx                   await publicConfig()
  app/src/app/actions/session.ts           + setChannel
  app/src/components/layout/sidebar.tsx    nhận nav qua props, + bảng NAV_ICONS
  app/src/components/layout/app-layout.tsx nhận nav, mặc định BANK_NAV
  app/src/components/layout/header.tsx     + ChannelSwitcher, ẩn RoleSwitcher theo kênh
  app/src/components/layout/role-switcher.tsx  bỏ INVESTOR, còn ba vai
  app/src/lib/mock-data.ts                 + tokenSymbol, onChain cho WindProject
  app/src/lib/bank/mint.service.ts         dùng authorize() đã tách ra
  app/test/rbac.test.ts                    + ca cho portfolio:read

MỚI
  app/src/lib/session/channel.ts           đọc cookie kênh, server-only
  app/src/lib/bank/authorize.ts            tách authorize() dùng chung
  app/src/lib/bank/issuance.ts             hằng giá phát hành (điều khoản, không phải giá thị trường)
  app/src/lib/bank/portfolio.service.ts    getPortfolio, getWalletTransactions
  app/src/app/actions/portfolio.ts         server action, vỏ mỏng
  app/src/components/layout/nav-config.ts  BANK_NAV, INVESTOR_NAV — dữ liệu thuần
  app/src/components/layout/channel-switcher.tsx
  app/src/app/(client)/layout.tsx          ChannelGuard requireAny=['portfolio:read']
  app/src/app/(client)/portfolio/page.tsx
  app/src/app/(client)/tokens/[symbol]/page.tsx
  app/src/components/investor/asset-summary.tsx
  app/src/components/investor/issuance-status-box.tsx
  app/src/components/investor/transaction-history-box.tsx
  app/src/components/investor/token-list-box.tsx
  app/src/components/investor/mock-badge.tsx        nhãn dữ liệu mẫu dùng chung
  app/src/components/pages/investor-portfolio.tsx
  app/src/components/pages/investor-token-detail.tsx
  app/test/portfolio-service.test.ts
  app/e2e/investor-channel.spec.ts
```

### Tách `authorize()`

`authorize()` đang private trong `mint.service.ts` (assertCan + ghi audit cho cả ALLOWED và DENIED).
`portfolio.service.ts` cần đúng hành vi đó. Tách sang `lib/bank/authorize.ts` và cho cả hai import,
thay vì sao chép — hai đường ghi audit khác nhau là mầm lệch số về sau.

`toResult()` cũng tách theo, cùng lý do.

## 4. Nguồn dữ liệu bốn hộp

Quy tắc: **thật và mẫu không trộn trong cùng một con số**; mẫu phải có nhãn trên giao diện.

| Hộp | Số liệu | Nguồn | Nhãn mẫu |
|---|---|---|---|
| Tài sản | số dư WPT | `ILedgerPort.balanceOf` | không |
| | giá trị quy đổi | số dư × giá phát hành (hằng cấu hình) | không, ghi rõ "theo giá phát hành" |
| | số dư VNDB | **ẩn** — chưa có phương thức đọc, chờ BE-01 | — |
| Trạng thái phát hành | tổng cung, ký hiệu, decimals | `ILedgerPort.tokenInfo` | không |
| | giá phát hành | hằng cấu hình | không |
| | trạng thái vận hành dự án | `MOCK_PROJECTS` | **có** |
| Lịch sử giao dịch | danh sách | `ITxnStore.listTxns` lọc theo ví | không |
| Danh sách token | 3 dự án | `MOCK_PROJECTS` | **có**, trừ dự án đã lên chuỗi |
| | số nhà đầu tư đang giữ | `MOCK_WIND_STATS` | **có** |

### Ánh xạ dự án → token

Hệ thống chỉ triển khai **một** token trên chuỗi. Thêm hai trường vào `WindProject`:

```ts
tokenSymbol: string;   // dùng làm tham số route /tokens/[symbol]
onChain: boolean;      // true = số liệu đọc từ chuỗi; false = dữ liệu mẫu
```

Dự án đầu tiên `onChain: true`, ký hiệu lấy theo token thật (`WPT`). Hai dự án còn lại
`onChain: false`, có nhãn "chưa triển khai trên chuỗi", không có số dư, nhưng trang chi tiết vẫn mở
được. Đây là mở rộng `MOCK_PROJECTS` — vẫn **một** nguồn, không phải nguồn thứ hai.

### Hộp trạng thái phát hành: giới hạn phải tôn trọng

Chưa có thị trường thứ cấp → **không có giá giao dịch**. Hộp này hiển thị trạng thái *phát hành và
vận hành*, nên đặt tên `issuance-status-box`, không phải `market-status-box`: tên gợi ý "thị trường"
là trình bày sai bản chất cho người xem là ngân hàng.

Không hiển thị biến động giá theo phần trăm, khối lượng giao dịch, biểu đồ nến.

## 5. Ví ở client, số dư đọc ở server

`balanceOf` là server-only (`ILedgerPort`), còn địa chỉ ví chỉ có ở client (wagmi). Nên:

```
Client Component (useAccount → address)
   → server action app/actions/portfolio.ts
      → portfolio.service.ts  (assertCan + audit + lọc ví)
         → ILedgerPort / ITxnStore
```

Đúng pattern `mint.tsx` đang dùng. Component **không** nhập `viem`/`ethers` (R10.4).

Hệ quả cho R10.5 (bốn hộp độc lập): mỗi hộp là một component tự gọi server action của mình và tự
giữ trạng thái lỗi. Một hộp lỗi không làm sập hộp khác vì không dùng chung một lời gọi.

Hai hộp không phụ thuộc ví (trạng thái phát hành, danh sách token) vẫn cần server action để đọc
`tokenInfo()`.

## 6. Service đọc vị thế

```ts
getPortfolio(input: { wallet: string; chain: ChainKey }): Promise<Result<PortfolioView>>
getWalletTransactions(input: { wallet: string; chain: ChainKey; limit?: number }): Promise<Result<TxnView[]>>
```

Bắt buộc:

- Kiểm quyền `portfolio:read` **trong service** qua `authorize()`, ghi audit cả hai kết cục.
- Lọc theo ví **trong service**: luôn truyền `wallet` xuống `listTxns`, không bao giờ gọi không lọc.
- Số lượng và số tiền trả ra dạng **chuỗi** (bigint không qua được biên server → client).
- Validate input bằng Zod tái dùng `walletSchema`/`chainSchema` trong `schemas.ts`.

Giới hạn đã biết: không ràng buộc được ví ↔ phiên khi chưa có SIWE (requirements §3.2).

## 7. Điểm cần chú ý

- `refresh()` từ `next/cache` phải gọi sau khi đặt cookie, giống `setDemoRole`, để server kết xuất lại.
- Giá trị lạ truyền vào `setChannel` thì bỏ qua im lặng, giống `setDemoRole`.
- Cookie giữ `httpOnly: false` như hiện trạng, và giữ nguyên ghi chú rằng đây là lỗ hổng có chủ ý sẽ
  đóng ở AU-01.
- `rbac.test.ts` có mảng `writeActions` cứng; `portfolio:read` là quyền đọc nên không phá test cũ,
  nhưng phải thêm ca khẳng định chỉ `INVESTOR` có nó.
- `explorerTxUrl` đã có trong `@bidv/shared`, dùng cho R7.2, không tự dựng URL.
- Màu và spacing chỉ dùng theme token (`var(--chart-*)`, `bg-card`, `text-foreground`...), không
  hardcode hex — theo `frontend.md`.
