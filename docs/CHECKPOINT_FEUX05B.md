# Báo cáo bàn giao: FE-UX-05b Thông tin tài khoản

| | |
|---|---|
| Mã task | FE-UX-05b |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/actions`, `app/api`, `app/src/app/**` (gồm `account/page.tsx`), `components/ui/*`, `components/layout/*`, `globals.css`; không gói npm mới; không đổi câu chữ, giá trị, nhãn trạng thái, liên kết, điều kiện hiện, lời gọi server action, số action khi mở màn. Trường chỉ dời đúng QĐ-4 |
| Nhánh | `feat/fe-ux-05b-tai-khoan`, tạo từ `release/ui-v2` @ `d5e6b0e` (sau merge PR #97 FE-UX-05a). **Merge-base dùng để đo mốc: `d5e6b0e`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm nên không phải rebase; mọi mốc và cả bộ kiểm thử mục 5 chạy trên merge-base này |
| Spec | `docs/fe-ux-05b-tai-khoan/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `c5337a7`; e2e nháp `cc08ace`; **dời** (QĐ-3) `f015f9e`; màn `f3db954`; e2e số `role` mốc `3e67b74`; UserGuide, task-status `f89968c`; khôi phục hai tệp mã `e468f17` (mục 8); tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn đúng bố cục bản chốt cho bốn vai trừ "Không làm"; bảng đối chiếu từng dòng `notes/account.md` | ✅ | mục 2.1, 7 |
| 2 | Bố cục, trường, thành phần đúng QĐ-4, QĐ-5; trường chỉ dời, không mất trường | ✅ | mục 2.1, 2.2; unit nhóm 3 so thứ tự `dt` |
| 3 | `PaymentWalletContent` dời đúng QĐ-3, commit riêng; đoạn trước và sau | ✅ | mục 3 |
| 4 | Không `*-destructive`, màu cứng trong tệp phạm vi; sắc nhãn đúng QĐ-8 | ✅ | mục 6 (6b), 1.3 nhóm 1, 3, 4 |
| 5 | Không đổi chữ (6d đúng kỳ vọng); không đổi giá trị, nhãn, liên kết, điều kiện hiện | ✅ | mục 6 (6d rỗng), 2.3 |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, effect, điều kiện hiện | ✅ | mục 2.3 |
| 7 | Action đúng QĐ-2 bốn vai (ca 4), 28 đường dẫn không đổi; JS, CSS trong trần QĐ-10; lỗi `/account` 0 | ✅ | mục 4: `/account` +29 B so build mốc riêng (trần 1 KB), CSS +47 B |
| 8 | Mốc test QĐ-9 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, bốn vai, tiến trình mock mới, đủ env | ✅ | mục 5 |
| 10 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-05b-tai-khoan.spec.ts` đủ 4 ca, `fe-ux-05b.test.ts` đủ 4 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip `/account` (ba vai đo đều ra cùng số) 457.856 B, so bản mốc build riêng
457.827 B là +29 B (trần 1 KB); mười bốn trang khác lệch -4 đến +6 B so build mốc riêng và **bằng từng byte** bản mốc
của lượt e2e (nhiễu build, mục 4). CSS +47 B (trần 2 KB). Action khớp 28/28; `hydration`, `consoleErrors`, `pageErrors` 0
ở mọi đường dẫn cả mốc lẫn sau; số `role` trong `main` của Nhà đầu tư, Người bán, Giao dịch viên bằng mốc (0, 0, 0).
Mức rủi ro: thấp (một màn chỉ đọc, thành phần máy chủ; ô ví chỉ dời phần dựng).

Một sự cố quy trình đã sửa trước khi đo lại: commit tài liệu `f89968c` lẫn hai tệp mã ở trạng thái `f015f9e` (mục 8);
`e468f17` khôi phục, `git diff f3db954 HEAD -- app/src` rỗng; mọi số đo, ảnh và kiểm thử "sau" chạy trên `e468f17`.

UserGuide: "Chốt tại"; 3.3.2 thêm "Bố cục (FE-UX-05b)"; bảng trường (ô xanh, Trạng thái, cán bộ); dòng mã L-06 theo
`account-info.tsx:225`. task-status: `FE-UX-05b` xong; thêm `FE-UX-05c` (planned, Tạo lệnh rút của Người bán).

### 0.2 Việc cần Owner quyết

- Không có.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

KẾT_QUẢ_BỘ_KIỂM

### 1.2 e2e mới `app/e2e/fe-ux-05b-tai-khoan.spec.ts` (project mock; không đổi dữ liệu; vai đặt bằng cookie)

Chờ tải như nhau ở mốc và sau: `networkidle`; vai khách hàng chờ thêm `[data-payment-wallet]` hiện.

| Ca | Kiểm | Mốc `d5e6b0e` | Sau |
|---|---|---|---|
| 1 | Nhà đầu tư 1440 px: đếm `role` trước; một `h1` "Thông tin tài khoản"; `[data-account-hero]` chứa "Nguyễn Văn An", "NDT001", "Nhà đầu tư", "NA"; ô xanh và thẻ "Thông tin cá nhân" cùng hàng (lệch đỉnh dưới 4 px, ô xanh bên trái, cao lệch dưới 2 px); thẻ "Thông tin tài khoản" và "Hồ sơ định danh và rủi ro" cùng hàng; ba ô đầu thẻ rủi ro cùng hàng; ô Hạn mức có `tile-gold`; `[data-wallet-bound="true"]` hiện; 390 px bốn khối một cột, cùng `x`, cùng rộng, ô xanh trên cùng; `role` bằng hằng số | đỏ (không có ô xanh) | xanh |
| 2 | Đếm `role` của Người bán và Giao dịch viên TRƯỚC mọi phép kiểm; Người bán: ô xanh "Tên pháp nhân", "Công ty Cổ phần Điện gió An Viên", "NB001", "AV"; thẻ "Thông tin pháp nhân" chứa "Người liên hệ", "Trần Thị Bình". Giao dịch viên: ô xanh "Lê Minh Cường", "Giao dịch viên", "LC"; thẻ "Thông tin cán bộ" chứa "GDV001", cùng hàng ô xanh; không `[data-payment-wallet]`; `role` hai vai bằng hằng số | đỏ (không có ô xanh) | xanh |
| 3 | Bốn vai, 1440 và 390 px, ngữ cảnh mới: `main.scrollWidth <= main.clientWidth`; 0 lỗi console, `pageerror`, cảnh báo hydrate | xanh | xanh |
| 4 | Mở `/account` mỗi vai (ngữ cảnh mới, `networkidle` cộng 1 giây): Nhà đầu tư 1, Người bán 1, Giao dịch viên 0, Kiểm soát viên 0 action | xanh | xanh |

Hằng số `role` đo trên bản build mốc `d5e6b0e` bằng chính ca 1, ca 2 trong lượt e2e mock đầy đủ trên máy chủ mới (145 ca
đạt, 2 ca đỏ đúng cột Mốc): Nhà đầu tư, Người bán `{ status: 0, note: 0, alert: 0 }`. Bản nháp đầu của ca 2 kiểm Người
bán trước rồi mới mở Giao dịch viên, nên ở bản mốc ca 2 đỏ trước khi đếm được Giao dịch viên. Em sửa ca 2 đếm cả hai vai
trước mọi phép kiểm (`3e67b74`), chạy lại riêng ca 2 trên cùng bản build mốc với một máy chủ mới: Giao dịch viên
`{ status: 0, note: 0, alert: 0 }` (log `moc/e2e_ca2_teller.log`, ca vẫn đỏ đúng cột Mốc sau khi đếm). Lượt sau cho đúng
các số đó ở cả ba vai.

### 1.3 Unit test mới `app/test/fe-ux-05b.test.ts` (môi trường `node`, 43 ca)

`next/link` dựng được trong môi trường `node` bằng `renderToStaticMarkup` (ra thẻ `a` giữ `href`), nên không cần
`vi.mock('next/link')`. Ký tự cấm viết bằng escape.

| Nhóm | Kiểm |
|---|---|
| 1 Mã nguồn | `account-wallet.tsx` đúng 1 `getAccountWalletAction(`, 1 `useEffect(`, có `export function PaymentWalletValue` và nguyên văn `<PaymentWalletContent state={useContext(AccountWalletContext)} />`, không `text-destructive`; `account-info.tsx`, `payment-wallet-content.tsx`, `initials.ts` không `Action(`, `useEffect(`, `useState(`; hai tệp mới không `wagmi`; `account-info.tsx` không `'use client'`, `-destructive`, `'destructive'`, đúng 4 `note={<UnverifiedNote` và 1 `<UnverifiedNote` khác, 1 `function ProfileHero`, 2 `<ProfileHero`, mọi `col-span-` có tiền tố mốc; câu `import` từ `@/lib/bank/` trong hai tệp mới đều là `import type` (regex nhiều dòng của design) |
| 2 `initialsOf` | NA, AV, LC, PD, "đỗ hùng" thành "ĐH", "  An  " thành "A", rỗng thành rỗng |
| 3 `AccountInfoPage` | Bốn hồ sơ: 1 `data-account-hero`, 1 `<h1`, không thẻ điều khiển, không `bg-destructive`, `text-destructive`, chữ viết tắt trong `aria-hidden="true"`, ô xanh không `role="heading"`; Nhà đầu tư: thứ tự `dt` ô xanh và ba thẻ, thứ tự tiêu đề, "unverified" 4 lần, Hạn mức `tile-gold`, Ví `col-span-full`, 3 heading, ba ô dòng `justify-between` không `bg-muted/60`; Người bán: "Tên pháp nhân", Người liên hệ trước Số điện thoại, Ví `col-span-2`, không "Họ và tên"; hai cán bộ: thứ tự `dt`, "unverified" 2 lần, 1 heading, không "Ví thanh toán"; `LOCKED` (khách hàng, cán bộ) "Đã khoá" `bg-bad-bg`; định danh `APPROVED`, `PENDING`, `REJECTED` đúng sắc, ở thẻ rủi ro là chữ trơn; rủi ro `LOW`, `MEDIUM`, `HIGH` đúng sắc |
| 4 `PaymentWalletContent` | Bảy `state` của design mục 3: `null`; `evm` chưa kết nối (liên kết `/wallet` "Kết nối ví"); `mock` đang đọc; lỗi trong `text-bad-ink`, không `role`; `wallet: null` không liên kết; `bound` true `bg-ok-bg`, false `bg-bad-bg` |

Số có sẵn xác nhận trên bản mốc `d5e6b0e` (`orig_wallet.tsx`, `orig_info.tsx`): `getAccountWalletAction(` 1, `useEffect(`
1 ở `account-wallet.tsx`; `note={<UnverifiedNote` 4 ở `account-info.tsx`.

Tự gây lỗi mức unit (4 điểm của Supervisor, trên bản sao làm việc `e468f17`, hoàn lại bằng `git checkout`): bỏ
`highlight` ở ô Hạn mức (mất `tile-gold`): 1 ca đỏ (nhóm 3 Nhà đầu tư); đảo sắc nhãn ví `bound ? 'bad' : 'ok'`: 2 ca đỏ
(nhóm 4 `bound` true, false); ô xanh `col-span-4` không tiền tố: 1 ca đỏ (nhóm 1 tiền tố); thêm một lời gọi
`getAccountWalletAction(` trong effect: 1 ca đỏ (nhóm 1 đếm lời gọi).

## 2. Thay đổi

### 2.1 Màn (bố cục theo QĐ-4, QĐ-5)

| Khối | Đổi |
|---|---|
| Đầu màn | `header` `flex flex-wrap items-center gap-2.5`; `h1` `text-2xl font-semibold tracking-tight`; "Chỉ đọc" giữ `Badge variant="outline"`; gốc giữ `data-account-role` |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12` cho cả hai nhánh |
| `ProfileHero` | Một hàm, gọi ở hai nhánh. `Card tone="hl"` `data-account-hero` `min-[1100px]:col-span-4`; vòng tròn `size-16` `tile-gold` `aria-hidden="true"` chữ `initialsOf(fullName, organization)`; `dl` `flex flex-wrap gap-x-7 gap-y-4`, mỗi cặp là `div` con trực tiếp: tên (`basis-full`, `dt` `flex items-center gap-1.5` chứa nhãn rồi `UnverifiedNote`, `dd` `text-2xl font-semibold`), Mã người dùng (`font-code`, chỉ khách hàng), Vai trò. Tên không là heading |
| Khách hàng | Thẻ "Thông tin cá nhân/pháp nhân" (`col-span-8`, `User`): Người liên hệ (khi có), Số điện thoại, Thư điện tử, Trạng thái định danh `Badge`, Ví thanh toán (`full` cá nhân, `wide` tổ chức). Thẻ "Thông tin tài khoản" (`col-span-4`, `UserCog`, dạng dòng): Trạng thái, Ngày tạo, Hoạt động gần nhất. Thẻ "Hồ sơ định danh và rủi ro" (`col-span-8`, `ShieldCheck`): Loại khách hàng, Trạng thái định danh (chữ), Xếp hạng rủi ro `Badge`, Phòng chống rửa tiền, Hạn mức (`wide`, `highlight`) |
| Cán bộ | Thẻ "Thông tin cán bộ" (`col-span-8`, `UserCog`): Mã cán bộ, Trạng thái, Số điện thoại, Thư điện tử (`wide`), Hoạt động gần nhất (ô thường) |
| `Section` | Thêm `icon` (`CardTitleIcon` trong `CardTitle`, trước chữ; giữ `role="heading" aria-level={2}`, chữ rồi `note`), `layout` `tiles` (`grid gap-3 min-[640px]:grid-cols-2 min-[1180px]:grid-cols-3`) hoặc `rows` (`divide-y divide-border`), `className`; bỏ `border-b` ở `CardHeader` |
| `Field` | `variant` `tile` (`min-w-0 rounded-[14px] bg-muted/60 px-4 py-3.5`, `dt` `text-xs`, `dd` `mt-1 text-base font-medium [overflow-wrap:anywhere]`) hoặc `row` (`flex items-baseline justify-between gap-4 py-2.5`); `span` `wide`/`full` thay `wide?: boolean`; `highlight` dùng `relative isolate overflow-hidden tile-gold`, `dd` thêm `text-[22px] tabular-nums` |
| Sắc nhãn (QĐ-8) | Ba bảng `ACCOUNT_STATUS_TONES`, `IDENTITY_TONES`, `RISK_TONES` cạnh bảng nhãn, kiểu cục bộ `BadgeVariant`; `AccountStatusBadge({ status })`; ví `bound ? 'ok' : 'bad'`; lỗi đọc ví `text-bad-ink` |

### 2.2 Trường dời (QĐ-4)

| Trường | Trước | Sau |
|---|---|---|
| Họ và tên / Tên pháp nhân | ô rộng đầu thẻ cá nhân/pháp nhân; ô đầu thẻ cán bộ | ô xanh (cặp tên) |
| Mã người dùng | thẻ Thông tin tài khoản | ô xanh |
| Vai trò | thẻ Thông tin tài khoản; thẻ cán bộ | ô xanh |
| Mọi trường còn lại | giữ thẻ, giữ thứ tự | giữ thẻ, giữ thứ tự (unit nhóm 3 so `dt`) |

### 2.3 Đoạn đổi gần hook, effect, điều kiện hiện (QĐ-1, QĐ-2)

Không đổi ký tự: `AccountWalletProvider` (state, effect, mảng phụ thuộc, khoá `chain|ví`, `useAccount`,
`useSelectedChain`, lời gọi `getAccountWalletAction`), `AccountWalletContext`, `IDENTITY_LABELS`, `RISK_LABELS`,
`AML_LABELS`, chuỗi nhánh của `PaymentWalletContent` (`!state`, `chain !== 'mock' && !connected`, `!state.result`,
`!state.result.ok`, `!wallet`). Các đoạn có đụng:

- `PaymentWalletValue`: `const state = useContext(AccountWalletContext);` cộng thân thành một dòng
  `return <PaymentWalletContent state={useContext(AccountWalletContext)} />;` (QĐ-3). Vẫn một `useContext` gọi vô điều
  kiện ở đầu hàm, đúng luật hook; `PaymentWalletContent` không có hook.
- `customer ? … : …`, `customer.contactPerson &&`, `customerType === 'ORGANIZATION' ? … : …` (tiêu đề),
  `customerType === 'INDIVIDUAL' ? … : …` giữ ký tự. `ProfileHero` tính lại `customer` bằng đúng biểu thức của trang
  (`profile.kind === 'CUSTOMER' ? profile : null`), nhãn tên theo `organization` (`customerType === 'ORGANIZATION'`,
  cùng điều kiện cũ), `{customer && …}` cho Mã người dùng (cán bộ không có trường này, như cũ).
- `span` của ô Ví: `customerType === 'ORGANIZATION' ? 'wide' : 'full'` (chỉ chọn lớp, cùng điều kiện tiêu đề).
- Ba toán tử chọn sắc cũ (`active ? 'default' : 'destructive'`, `identityStatus === 'APPROVED' ? …`, `riskRating === 'HIGH'
  ? …`) thay bằng ba bảng QĐ-8; chữ nhãn giữ toán tử `status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khoá'` (trước là
  `active ? …`, `active` là `status === 'ACTIVE'` ở nơi gọi: cùng giá trị).

### 2.4 Mốc test QĐ-9

Không sửa tệp test có sẵn. `account-info.spec.ts` (e2e), `account-info.test.ts`, `fix-04-noi-du-lieu-that` (e2e, unit),
`uiux-02-dau-man` (e2e, unit), `four-roles-*.test.ts` đạt (mục 1.1; lượt liên quan sau khi sửa: 27 ca e2e đạt).
`fix-04-noi-du-lieu-that.test.ts:281` vẫn đếm đúng 4 `note={<UnverifiedNote`; tên heading "Thông tin cá nhân" vẫn
khớp `/^Thông tin cá nhân/` vì `CardTitleIcon` là `aria-hidden`. Không thêm câu phụ dưới tiêu đề.

### 2.5 Mã dư thừa

Đã xoá: `wide?: boolean` của `Field`; prop `active` của `AccountStatusBadge`; `border-b` của `CardHeader`; import `Link`,
`Badge`, `ChainKey` ở `account-wallet.tsx` (hết chỗ dùng sau khi dời); `interface AccountWalletState` ở `account-wallet.tsx`
(nay nhập kiểu từ tệp mới). Lint, typecheck đạt; không import thừa.

## 3. Dời nguyên văn (`f015f9e`, QĐ-3)

Trước (`account-wallet.tsx` @ `d5e6b0e`, `:21-27` và `:62-87`):

```tsx
interface AccountWalletState {
  chain: ChainKey;
  /** Ví đang kết nối (chain khác `mock`); `undefined` khi chưa kết nối. */
  connected: string | undefined;
  /** `null` khi đang đọc trạng thái của đúng `chain|ví` hiện tại. */
  result: Result<AccountWalletView> | null;
}
…
export function PaymentWalletValue() {
  const state = useContext(AccountWalletContext);
  if (!state) return <span className="text-muted-foreground">Đang đọc…</span>;
  if (state.chain !== 'mock' && !state.connected) {
    return (
      <span className="text-muted-foreground">
        Chưa kết nối ví.{' '}
        <Link href="/wallet" prefetch={false} className="text-primary underline-offset-4 hover:underline">
          Kết nối ví
        </Link>
      </span>
    );
  }
  if (!state.result) return <span className="text-muted-foreground">Đang đọc…</span>;
  if (!state.result.ok) return <span className="text-destructive">{state.result.error}</span>;
  const { wallet, bound } = state.result.data;
  if (!wallet) return <span className="text-muted-foreground">Chưa kết nối ví.</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="break-all font-code text-xs" data-payment-wallet>{wallet}</span>
      <Badge variant={bound ? 'default' : 'destructive'} data-wallet-bound={bound}>
        {bound ? 'Đã định danh' : 'Ví chưa được định danh'}
      </Badge>
    </span>
  );
}
```

Sau (`components/account/payment-wallet-content.tsx` @ `f015f9e`):

```tsx
import Link from 'next/link';
import type { ChainKey } from '@bidv/shared';
import { Badge } from '@/components/ui/badge';
import type { AccountWalletView } from '@/lib/bank/account-profile.service';
import type { Result } from '@/lib/bank/result';

/** Phần dựng ô "Ví thanh toán" của màn tài khoản, dời nguyên văn từ `account-wallet.tsx` (FE-UX-05b QĐ-3). */

export interface AccountWalletState {
  …(7 dòng giống hệt đoạn trước, thêm `export`)…
}

export function PaymentWalletContent({ state }: { state: AccountWalletState | null }) {
  …(23 dòng `:64-86` giống hệt đoạn trước)…
}
```

và `account-wallet.tsx` @ `f015f9e`:

```tsx
import { PaymentWalletContent, type AccountWalletState } from '@/components/account/payment-wallet-content';
…
/** Ô "Ví thanh toán" (F2). Không có provider (dựng ở máy chủ, test) thì "Đang đọc…". */
export function PaymentWalletValue() {
  return <PaymentWalletContent state={useContext(AccountWalletContext)} />;
}
```

So bằng `diff` (script ngoài repo): khối interface khác đúng một chữ `export`; thân `:64-86` và thân `PaymentWalletContent`
giống từng ký tự. Ba import `Link`, `Badge`, `ChainKey` dời theo; `AccountWalletView`, `Result` giữ ở `account-wallet.tsx`
(`useState` còn dùng). Commit này chưa đổi kiểu: e2e `account-info`, `fix-04-noi-du-lieu-that` trên bản build riêng của
`f015f9e` (máy chủ mới) đạt 16 ca. Commit sau (`f3db954`) mới đổi đúng hai chỗ ở tệp mới: `text-destructive` thành
`text-bad-ink`, `'default' : 'destructive'` thành `'ok' : 'bad'` (QĐ-8).

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`maker-checker`, `ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js` (sha256
`6079a0d6…` khớp spec) với `JS_PAGES=/,/portfolio,/trade,/approvals,/account`; 28 dòng mỗi lượt, không dòng
`khong tim thay lien ket`. Tiến trình đo khác tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi mở
trang, máy chủ mới cổng 3500.

| Mục | Mốc `d5e6b0e` | Sau `e468f17` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/account` Nhà đầu tư 1 | Khớp 28/28 | không đổi |
| Action `/account` bốn vai (e2e ca 4) | 1, 1, 0, 0 | 1, 1, 0, 0 | QĐ-2 |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | `/account` 0, khác không tăng |
| JS gzip (công cụ) `/account`; `/`; `/portfolio`; `/trade`; `/approvals` | 447,1; 558,3; 456,9; 480,0; 455,2 KB | giống hệt | |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.446 B | 19.493 B (+47 B) | +2 KB |
| `role` trong `main` (ca 1, ca 2) | 0, 0, 0 ba vai | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc của lượt e2e build đúng mã `d5e6b0e`; bản mốc build riêng build lại `d5e6b0e` sau bản cuối,
cùng phiên (`NEXT_DIST_DIR=.next-moc`, gỡ tạm `components/account/` khi build, đã xoá thư mục). `/account` đo ở cả ba vai
khách hàng và cán bộ đều cùng số nên ghi một dòng:

| Trang | Mốc (lượt e2e) | Mốc build riêng | Sau `e468f17` | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/portfolio` | 467824 | 467818 | 467824 | +6 | bằng mốc |
| `/tokens/WPT` | 463029 | 463024 | 463029 | +5 | bằng mốc |
| `/trade` | 491515 | 491513 | 491515 | +2 | bằng mốc |
| `/orders` | 549475 | 549471 | 549475 | +4 | bằng mốc |
| `/orders/[id]` | 463365 | 463363 | 463365 | +2 | bằng mốc |
| `/withdraw` | 485768 | 485765 | 485768 | +3 | bằng mốc |
| `/` | 571656 | 571651 | 571656 | +5 | bằng mốc |
| `/approvals` | 466112 | 466108 | 466112 | +4 | bằng mốc |
| `/distribution` | 479620 | 479616 | 479620 | +4 | bằng mốc |
| `/vault` | 469567 | 469566 | 469567 | +1 | bằng mốc |
| `/wallet` | 466913 | 466910 | 466913 | +3 | bằng mốc |
| `/seller` | 468070 | 468066 | 468070 | +4 | bằng mốc |
| `/seller/transactions` | 549631 | 549628 | 549631 | +3 | bằng mốc |
| `/seller/withdraw` | 476994 | 476998 | 476994 | -4 | bằng mốc |
| `/account` | 457830 | 457827 | 457856 | +29 | +1.024 |

Mười bốn trang ngoài `/account` có số **sau bằng từng byte số mốc của lượt e2e** (cùng mã `d5e6b0e`); lệch -4 đến +6 B so
bản build mốc riêng là nhiễu giữa hai lần build cùng một mã (mốc lượt e2e so mốc build riêng cũng lệch đúng các số đó),
không do thay đổi. `/account` +29 B so build riêng (+26 B so mốc lượt e2e): `PaymentWalletContent` thành module riêng
trong gói máy khách (QĐ-3); biểu tượng của `AccountInfoPage` không vào gói máy khách vì trang là thành phần máy chủ.

CSS mốc lấy từ bản build mốc sạch (19.446 B). Bản mốc build riêng cho 19.507 B vì build lúc `.next-moc` nằm trong `app/`
(Tailwind quét thêm); không dùng số đó.

## 5. Ảnh (gửi kèm, không commit)

- `/account` bốn vai, 1440 và 390, Sáng và Tối, trước (`moc/anh/`) và sau (`sau/anh/`), 16 ảnh mỗi lượt. Mỗi lượt một
  tiến trình mock MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env` (`NEXT_PUBLIC_DEFAULT_CHAIN`,
  `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`, `ENABLE_DEMO_PAYMENT_MINT`,
  `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`); màn chỉ đọc hồ sơ mẫu nên không chuẩn bị dữ liệu. Mốc
  (bản build `d5e6b0e`): bật 06:30:48Z, tắt 06:31:27Z. Sau (bản build `e468f17`): bật 06:44:53Z, tắt 06:45:33Z
  (05/11/2026, UTC). `main` không tràn ngang, 0 lỗi console ở cả 16 ảnh mỗi lượt.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (7 trạng thái): ô ví chưa kết nối (kèm liên kết), đang đọc, lỗi đọc ví, ví chưa
  được định danh; Nhà đầu tư `LOCKED` cộng `PENDING` cộng `MEDIUM`; Nhà đầu tư `REJECTED` cộng `HIGH`; Giao dịch viên
  `LOCKED`. HTML dựng bằng `renderToStaticMarkup` (test tạm, xoá ngay, không commit): bốn trạng thái ví là
  `PaymentWalletContent` với `state` tương ứng đặt trong một ô cùng lớp ô thẻ; ba trạng thái hồ sơ là `AccountInfoPage`
  với hồ sơ mẫu đổi trường (ô ví trong đó "Đang đọc…" vì không có provider); CSS bản build tương ứng, `page.setContent`, Sáng và Tối, 1440
  và 390 (`static_moc/`, `static_sau/`). Trước dùng mã `f015f9e` (đúng mã `d5e6b0e` sau khi dời) và CSS bản mốc; sau dùng
  mã cuối và CSS bản sau.
- Kiểm đọc được (Sáng và Tối): chữ trên ô xanh `hl`; chữ viết tắt trên vòng tròn vàng; ô Hạn mức `tile-gold`; nhãn
  `Badge` ok, warn, bad, secondary; câu lỗi `text-bad-ink`.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
FE-UX-05b tasks bước 6, HEAD e468f17, base origin/release/ui-v2 d5e6b0e
== 6a      # tệp ngoài danh sách trắng; tệp bị xoá: rỗng
== 6b      # màu cứng, *-destructive trong bốn tệp mã phạm vi: rỗng
== 6c      # ký tự cấm ở dòng thêm mới: rỗng
== 6d      # chữ bị bỏ không có lại ở dòng thêm mới: rỗng
== 6e      # ký tự cấm trong tệp phạm vi, test, e2e: rỗng
== hết
```

Cả năm lệnh rỗng, đúng kỳ vọng (6d rỗng: không đổi chữ nào). `docs/tech-report.md` không đổi (không marker trong các tệp
đã sửa).

## 7. Đối chiếu notes `notes/account.md`

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề "Thông tin tài khoản", nhãn "Chỉ đọc", câu phụ | Làm tiêu đề, nhãn; Không làm câu phụ (requirements mục 1, test `uiux-02` cấm) |
| Vai nhân viên: `Section "Thông tin cán bộ"`, không ví thanh toán | Giữ (unit nhóm 3, e2e ca 2) |
| Ô xanh cán bộ: chữ viết tắt, Họ và tên, Vai trò | Làm (QĐ-4, QĐ-6) |
| Thẻ "Thông tin cán bộ": Mã cán bộ, Trạng thái, Số điện thoại, Thư điện tử, Hoạt động gần nhất | Làm (Thư điện tử rộng 2 cột, Hoạt động gần nhất ô thường) |
| Ô xanh khách hàng: chữ viết tắt, Họ và tên / Tên pháp nhân, Mã người dùng, Vai trò | Làm |
| Thẻ cá nhân/pháp nhân: Người liên hệ (tổ chức), Số điện thoại, Thư điện tử, Trạng thái định danh | Làm; Trạng thái định danh `Badge` sắc QĐ-8 |
| Ô "Ví thanh toán": ví kèm "Đã định danh" (xanh) hoặc "Ví chưa được định danh" (đỏ) | Làm (`ok`/`bad`); cá nhân hết hàng, tổ chức rộng 2 cột |
| Trạng thái xem thử "Ví chưa được định danh" | Làm ở unit nhóm 4, ảnh tĩnh |
| Trạng thái xem thử "Chưa kết nối ví" kèm liên kết | Giữ liên kết `a` (không nút); unit nhóm 4, ảnh tĩnh |
| Trạng thái xem thử "Đang đọc" | Giữ; unit nhóm 4, ảnh tĩnh |
| Trạng thái xem thử "Lỗi đọc ví" | Làm `text-bad-ink`, không `role`; unit nhóm 4, ảnh tĩnh |
| Nhánh "Chưa kết nối ví." không liên kết | Giữ (không dựng trong luồng thường như notes ghi); unit nhóm 4 phủ |
| Thẻ "Thông tin tài khoản": Trạng thái, Ngày tạo, Hoạt động gần nhất | Làm dạng dòng (QĐ-5) |
| Thẻ "Hồ sơ định danh và rủi ro" (ô Hạn mức vàng) | Làm; Xếp hạng rủi ro `Badge` sắc QĐ-8; Hạn mức `tile-gold` rộng 2 cột |
| Trạng thái xem thử "Lỗi đọc hồ sơ" | Không làm: nhánh ở `page.tsx` (tệp route ngoài phạm vi); nợ FE-UX-06 (mục 8) |
| Lớp cục bộ `.kv-grid.c3`, `.wide`, `.full`, `.goldtile`, `.who` | Làm bằng `layout`, `span`, `highlight`, `ProfileHero` |
| Thay đổi: bỏ thẻ "Ví liên kết trên chain" | Giữ (đã bỏ từ FIX-01) |
| Thay đổi: nhãn "Ví thanh toán", ví theo chain | Giữ |
| Thay đổi: thanh "Trạng thái xem thử" | Không làm (chỉ có ở bản xem thử) |
| Thay đổi: ví mẫu Người bán, `ROLE_LABELS`, trạng thái lỗi, hồ sơ mẫu của dev | Giữ (dữ liệu và chữ của dev) |
| Lệch: tên hồ sơ khác bộ dữ liệu chung; thư điện tử Bạc Liêu; hai cán bộ cùng số điện thoại; "Hoạt động gần nhất" tĩnh | Không làm: dữ liệu, ngoài phạm vi frontend |
| Lệch: "Trạng thái định danh" hai lần, gần chữ "Đã định danh" của ví | Không làm: đổi chữ cấm (requirements mục 1); nay phân biệt bằng sắc (thẻ đầu `Badge`, thẻ rủi ro chữ trơn) |
| Lệch: trên `mock` ví luôn "Đã định danh" | Không làm: logic máy chủ |

## 8. Nợ và DEVIATION

- **Sự cố commit `f89968c` (đã sửa ở `e468f17`).** Em commit UserGuide và task-status trong lúc một script đo nền (bước 3,
  dựng bản build của `f015f9e`) đã chạy `git checkout f015f9e -- app/src`. Lệnh đó ghi cả vào chỉ mục, nên `f89968c` kéo
  theo `account-info.tsx` và `payment-wallet-content.tsx` ở trạng thái `f015f9e` (mất phần đổi kiểu). Phát hiện khi rà
  diff; em dừng lượt đo "sau" đang chạy, `git checkout f3db954 -- <hai tệp>`, kiểm `git diff f3db954 -- app/src` rỗng,
  commit `e468f17`, xoá kết quả đo dở, chạy lại toàn bộ lượt đo, chụp, e2e liên quan trên `e468f17`. Không có số đo nào
  lấy từ trạng thái lỗi. Từ nay không commit khi script nền còn đụng `app/src`.
- **Nhánh lỗi đọc hồ sơ ở `page.tsx`** còn `text-destructive` (tệp route, ngoài phạm vi): nợ cho FE-UX-06 như
  requirements mục 1.
- **Số `role` mốc của Giao dịch viên** lấy từ lượt chạy riêng ca 2 trên bản build mốc với máy chủ mới (mục 1.2), không từ
  lượt e2e mock đầy đủ (bản nháp ca 2 đỏ trước khi đếm vai này).
- **`next/link` dựng không cần mock** trong unit `node` (design mục 3 cho phép mock nếu cần; không cần).
- **Chưa làm theo requirements mục 1 "Không làm":** câu phụ dưới tiêu đề; thanh "Trạng thái xem thử"; ảnh tua-bin nền
  ô xanh và hiệu ứng (FE-UX-08); thẻ `<wbr>` sau `@`; bo góc ô 18 px của bản chốt (giữ 14 px như các màn từ 04a, QĐ-5).

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
