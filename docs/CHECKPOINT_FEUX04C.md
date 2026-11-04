# Báo cáo bàn giao: FE-UX-04c Quản lý lệnh, Chi tiết lệnh, Ví của tôi

| | |
|---|---|
| Mã task | FE-UX-04c |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/**`, `components/ui/**`, `components/investor/**`, `components/trading/**`, `components/layout/**`; không gói npm mới; không đổi câu chữ (trừ QĐ-7), trường, thứ tự trường, cột, nút, liên kết, điều kiện hiện, lời gọi server action, số action khi mở màn |
| Nhánh | `feat/fe-ux-04c-lenh-vi`, tạo từ `release/ui-v2` @ `e6604d0` (sau merge PR #94 FE-UX-04b; đã gồm FE-UX-04a). **Merge-base dùng để đo mốc: `e6604d0`**. Nhánh tạo sau khi 04b merge nên không phải rebase; mọi mốc (JS, CSS, action, lỗi, `role`, ảnh trước) và cả bộ kiểm thử mục 5 chạy trên merge-base này |
| Spec | `docs/fe-ux-04c-lenh-vi/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `428944b`; e2e nháp `22aed9f`; ba màn, unit 5 nhóm `129f701`; UserGuide, task-status `c48b46d`; sửa điều kiện chờ, ca 3 `433279e`; số `role` mốc `e9d3906`; ca 2 chọn chain ở 1440 px `3c1c277`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Ba màn đúng bố cục bản chốt trừ "Không làm"; bảng đối chiếu từng dòng ba notes | ✅ | mục 2.2, 7 |
| 2 | Bố cục, thành phần đúng QĐ-3 đến QĐ-5; `/orders` một `role="note"`; `/wallet` mô phỏng không `role="alert"` | ✅ | mục 1.2 (ca 1, 2), 2.2 |
| 3 | Không còn `amber-*`, `*-destructive`, `FIELD` trong tệp phạm vi | ✅ | mục 6 (6b), 1.3 nhóm 1 |
| 4 | Chữ chỉ đổi đúng QĐ-7 (6d đúng kỳ vọng); không đổi trường, cột, nút, liên kết, điều kiện hiện | ✅ | mục 6 |
| 5 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, effect, `switch`, điều kiện nhánh | ✅ | mục 2.3 |
| 6 | Action đúng QĐ-2 (ca 5), 28 đường dẫn không đổi; JS, CSS trong trần (byte bốn trang); lỗi ba màn 0 | ✅ | mục 1.2, 4 |
| 7 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 8 | Ảnh 1440, 390, Sáng, Tối, trước và sau, 5 cảnh, tiến trình mock mới mỗi lượt, đủ env | ✅ | mục 5 |
| 9 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 10 | `fe-ux-04c-lenh-vi.spec.ts` đủ 5 ca, `fe-ux-04c.test.ts` đủ 5 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 11 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh (gồm `wallet-connect`, `permit-order`) | ✅ | mục 1.1 |
| 12 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 13 | Ảnh Sáng và Tối đọc được: ba nút trên thẻ xanh, ô vàng số dư, `Alert bad` sai mạng, bảng lệnh | ✅ | mục 5 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip so bản mốc build riêng: `/orders` +760 B, `/orders/[id]` +249 B, `/wallet` +858 B (trần 3 KB mỗi trang), `/trade` -34 B (trần 1 KB); trang khác lệch -28 đến +67 B, đã so chunk: cùng kích thước thô (mục 4); CSS +43 B; action khớp 28/28; `hydration`, `consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; số `role` trong `main` bằng mốc. Mức rủi ro: thấp (chỉ đổi vỏ; điều kiện nhánh, effect,
`switch` không đổi; trạng thái ví đã kết nối, sai mạng khoá bằng unit test vì Playwright không có ví thật).

UserGuide: "Chốt tại"; 3.1.3, 3.1.4, 3.3.1 thêm "Bố cục"; dòng mã L-38, L-63, L-65 theo tệp mới (cả Phụ lục C).

### 0.2 Việc cần Owner quyết

- Không có. Hai chỗ em chỉnh so với chữ của design mục 3 ở e2e (điều kiện chờ tải bỏ qua ô `select`; ca 2 chọn
  chain ở 1440 px) ghi ở mục 8.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-04c` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), Postgres
bật, trên HEAD `3c1c277` cộng checkpoint chưa commit. Nhánh tạo từ `e6604d0` (đã có FE-UX-04b), nên lượt này là lượt
trên merge-base cuối, không cần chạy lại sau rebase.

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     FE-UX-04c, docs/CHECKPOINT_FEUX04C.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1594 passed | 74 skipped (1668)   # mốc 1573 + 21 ca mới của fe-ux-04c.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
FE-UX-04c role counts /orders: {"status":0,"note":1,"alert":0}
FE-UX-04c role counts /wallet: {"status":0,"note":0,"alert":0}
      135 passed, 7 skipped (4.1m)            # project mock đầy đủ: 130 ca cũ + 5 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (41.4s)            # toàn bộ project Hardhat, có wallet-connect.spec.ts, permit-order.spec.ts
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Log gửi kèm (không commit): `20261105_feux04c_run_local_all.log` (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã
che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết: `20261105_feux04c_evm_e2e.log`. Không chạy `contracts`.

### 1.2 e2e mới `app/e2e/fe-ux-04c-lenh-vi.spec.ts` (project mock, vai Nhà đầu tư; không đặt lệnh)

Chờ tải như nhau ở mốc và sau: `networkidle`, rồi `main` không còn chữ khớp `/Đang (tải|kiểm tra)/` khi đọc chữ
của `main` đã bỏ các phần tử `select` (mục 8).

| Ca | Kiểm | Mốc `e6604d0` | Sau |
|---|---|---|---|
| 1 | `/orders` 1440 px: đếm `role` trước; một `h1` "Quản lý lệnh"; trong `main` một `[role="note"]`, là `[data-slot="alert"][role="note"]`, chứa "Không cần kết nối ví trình duyệt"; 5 ô lọc lệch đỉnh dưới 4 px; 390 px một cột (ô sau dưới ô trước, cùng lề trái); nhập mã giả thì `[data-slot="empty-state"]` chứa "Không có lệnh nào khớp bộ lọc."; `role` bằng hằng số | đỏ (dòng mô phỏng là `p`) | xanh |
| 2 | `/wallet` 1440 px, mock: đếm `role` trước; heading "Đang ở chế độ mô phỏng"; `main` không `[role="alert"]`; `[data-slot="alert"]` "chỉ dùng cho thao tác của nhà đầu tư" không có thuộc tính `role`; `main` không U+00B7, U+2014; 390 px: khung ghi chú dưới thẻ mô phỏng, độ rộng lệch dưới 4 px; chọn `hardhat-local`: heading "Chưa có ví trong trình duyệt" | đỏ (ghi chú là `p`) | xanh |
| 3 | `/wallet` có `window.ethereum` tối giản, `hardhat-local`: heading "Chưa kết nối ví"; thẻ đó 3 `li`, `li` đầu bắt đầu "Bước này chỉ đọc địa chỉ ví"; nút "Kết nối ví" trong `main` | đỏ (`li` bắt đầu bằng chấm giữa) | xanh |
| 4 | `/orders`, `/orders/<mã giả>`, `/wallet`, 1440 và 390 px, ngữ cảnh mới: `main.scrollWidth <= main.clientWidth`; 0 lỗi console, 0 `pageerror`, 0 cảnh báo hydrate | xanh | xanh |
| 5 | Số action khi mở màn: `/orders` 1, `/orders/<mã giả>` 1, `/wallet` 0 (`toBe`) | xanh | xanh |

Hằng số `role` đo trên bản build mốc `e6604d0` bằng chính ca 1, ca 2 trong lượt e2e mock đầy đủ trên máy chủ mới:
`/orders` `{ status: 0, note: 1, alert: 0 }`, `/wallet` `{ status: 0, note: 0, alert: 0 }` (lượt đó 132 ca đạt, 3
ca đỏ đúng cột Mốc). Lượt sau cho đúng số đó.

### 1.3 Unit test mới `app/test/fe-ux-04c.test.ts` (môi trường `node`, 21 ca)

Nhóm 1 (mã nguồn): `investor-orders.tsx` 1 `listOrdersAction(`, 1 `useEffect(`; `investor-order-detail.tsx` 1
`getOrderDetailAction(`, 1 `useEffect(` (số mốc xác nhận trên `e6604d0` trước khi viết: 1, 1; 1, 1);
`wallet-connect.tsx` và ba tệp `components/wallet/*` trong phạm vi không có `Action(`; `investor-orders.tsx` không
`const FIELD`, có `orderStatusTone(`; `wallet-connect.tsx` có `export function UnsupportedChainNotice`, không dòng nào
(ngoài dòng chú thích bắt đầu bằng `*`, `//`, `/*`, `{/*`) chứa U+00B7, U+2014 (trong mã test viết bằng escape).

Nhóm 2 (`WrongChainBanner`, "chain ID 1", "Hardhat Local"): `role="alert"`, `data-slot="alert"`, chữ, hai nhãn, nút
"Chuyển ví sang Hardhat Local" không có thuộc tính `disabled`; `switching` thì có `disabled` và "Đang chờ ví…";
`error` thì `p role="status"` chứa câu lỗi; `children` được dựng.

Nhóm 3 (`WalletStatusCard`, `vi.mock('@/lib/hooks/use-native-balance')`, địa chỉ 42 ký tự): có số dư thì
`[data-kpi]` `data-tone="gold"` chứa số và ký hiệu; đang đọc "đang đọc…"; lỗi có câu lỗi; không số dư "chưa có";
`evm` và `hardhat-local`: `data-tone="hl"`, `title` bằng địa chỉ đầy đủ, `sr-only` "Địa chỉ đầy đủ: …", nút sao
chép có `aria-label`, "Ngắt kết nối", câu Tổng quan, khung `min-[1100px]:grid-cols-12`, thẻ
`min-[1100px]:col-span-7`, `[data-kpi]` `min-[1100px]:col-span-5`, không lớp `col-span-` nào thiếu tiền tố; `evm` có
`<a target="_blank">`, `hardhat-local` không `<a`.

Nhóm 4 (`NoWalletGuide`): heading, hai liên kết MetaMask, Rabby đều có "(mở tab mới)", `ol` đúng 3 `li` cấp một,
"Tải lại trang này".

Nhóm 5 (`UnsupportedChainNotice`, "Stellar"): heading, "Stellar", ba nhãn mạng của `CHAINS`. Nhập
`wallet-connect.tsx` trong môi trường `node` chạy được không cần `vi.mock` RainbowKit hay hook ví.

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| Bỏ `role="note"` của dòng mô phỏng ở `/orders` (bản build riêng `.next-mut`, e2e trên máy chủ mới) | `fe-ux-04c-lenh-vi` ca 1 đỏ (không `[data-slot="alert"][role="note"]`); `investor-channel` "Quản lý lệnh ở mock cũng dùng ví hồ sơ…" đỏ (`getByRole('note')` không thấy) |
| Thêm `role="alert"` cho `WalletScopeNote` (bản build riêng, e2e trên máy chủ mới) | `fe-ux-04c-lenh-vi` ca 2 đỏ (`main` có `[role="alert"]`); `wallet-connect` "chế độ mock: … KHÔNG cảnh báo sai mạng" đỏ |
| `WalletStatusCard` bỏ đoạn `sr-only` địa chỉ đầy đủ | nhóm 3 đỏ ở hai ca `evm`, `hardhat-local` |
| Thêm một lời gọi `listOrdersAction(` vào trang | nhóm 1 ca `listOrdersAction(` đỏ (2 thay vì 1) |

## 2. Thay đổi

### 2.2 Màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| `/orders` đầu màn | `h1` `text-2xl font-semibold tracking-tight`; dòng mô phỏng `Alert tone="info" role="note"`, ví `font-code break-all` |
| `/orders` Bộ lọc | `CardTitleIcon` `Filter`; `form role="search"` `grid gap-3 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-5`; 5 ô `fieldClass`, giữ `aria-label`, `placeholder`, `value`, `onChange`, `type`, thứ tự; ô Mã lệnh bọc `div relative`, `Search` `absolute left-3.5` `pointer-events-none` `aria-hidden`, ô `pl-10`; `FIELD` xoá |
| `/orders` bảng | Thẻ không tiêu đề; hàng tiêu đề `bg-muted/60`; nút cột chữ nhỏ đậm, giữ `type`, `onClick`, `aria-label`, `SortIcon`; trạng thái `Badge variant={orderStatusTone(order.status)}`; "Chi tiết" thêm `ChevronRight` `aria-hidden` |
| `/orders` nhánh | Đang tải `EmptyState loading`; lỗi `Alert bad` không `role`; rỗng `EmptyState`; `WalletNotBoundNotice` giữ; chưa kết nối ví (trả về sớm) `EmptyState` `Wallet`, hai câu |
| `/orders/[id]` | Chưa kết nối ví `EmptyState` `Wallet` (chữ đúng "Chưa kết nối ví"); đang tải `EmptyState loading`; lỗi `Alert bad` không `role` (điều kiện `fresh.error \|\| !fresh.data` giữ); `OrderDetailContent` giữ |
| `/wallet` đầu màn | `h1` `text-2xl font-semibold tracking-tight` |
| Mô phỏng, mạng chưa hỗ trợ, chưa kết nối, chưa có ví | `CardTitle role="heading" aria-level={2}` giữ; biểu tượng cũ vào `CardTitleIcon`; ba ý chưa kết nối `list-disc pl-5` |
| `WalletScopeNote` | `Alert info` không `role`, biểu tượng `ShieldCheck` |
| `WrongChainBanner` | `Alert bad role="alert"`, biểu tượng `TriangleAlert`; hai đoạn chữ, nút chuyển (chữ theo `switching`, `disabled`, `Loader2`), `children`, câu lỗi `role="status"` `text-bad-ink` |
| `WalletStatusCard` | Khung `grid gap-6 min-[1100px]:grid-cols-12`; `Card tone="hl"` `min-[1100px]:col-span-7` cộng lớp `--card`, `--border`; `CardTitleIcon` `Wallet`; địa chỉ rút gọn `font-code text-3xl`, `title`, `sr-only`; ba nút `variant="outline"` cộng lớp nền, chữ theo thẻ; `Kpi tone="gold"` `min-[1100px]:col-span-5` đặt sau thẻ trong DOM, `label` dạng JSX, `value` số dư (`unit` ký hiệu) hoặc `span` nội dòng "đang đọc…" hoặc "chưa có"; câu lỗi `text-bad-ink` và câu "Đây là đồng của …" trong `children` |
| `WalletSkeleton` | Giữ `aria-busy`, chữ `sr-only`; hai khối cùng khung lưới (`col-span-7`, `col-span-5` kèm `min-[1100px]:`) |

### 2.3 Đoạn đổi gần hook, effect, `switch`, điều kiện nhánh (QĐ-1, QĐ-2)

Không đổi: state, `query`, `requestKey`, effect, `fresh`, `rows`, `set`, `toggleSort`, `COLUMNS`, `SortIcon` ở
`/orders`; state, `requestKey`, effect, bốn nhánh trả về và thứ tự ở `/orders/[id]`; `useWalletStatus`, `switch`
trong `renderStatus` và props truyền xuống, `UseWalletChainButton`; `useNativeBalance`, `explorerAddressUrl`,
`CopyAddressButton` và state của nó; props, điều kiện `switching`, `error`, `children` của `WrongChainBanner`. Các
đoạn có đụng:

- Điều kiện trả về sớm `!wallet || (chain !== 'mock' && !isConnected)` ở hai trang lệnh: giữ ký tự; chỉ đổi phần tử
  trả về (`div` thành `EmptyState`).
- Chuỗi nhánh của thẻ bảng (`fresh === null`, `notBound`, `error`, `rows.length === 0`, `rows`): giữ; đổi phần tử.
- `/orders/[id]`: `if (fresh.error || !fresh.data) return …` giữ; `p` thành `Alert`.
- `renderStatus`: không đổi dòng nào; chỉ sửa chữ trong chú thích JSX ở nhánh `chain-mismatch` (QĐ-7).
- `WalletStatusCard`: `explorerUrl &&` giữ; ba nhánh số dư (`balance.loading`, `balance.amount`, còn lại) giữ thứ tự,
  chuyển thành biểu thức `value` của `Kpi`; `unit` chỉ khi không đang đọc và có số dư (như chữ ký hiệu đi kèm số cũ);
  `balance.error &&` giữ.
- `CopyAddressButton`: thêm `className`, không đổi `copy`, state, `role="status"`.
- `UnsupportedChainNotice`: thêm `export` (QĐ-6).

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Đã chạy riêng trên bản sau (máy chủ mới): `fe-ux-04c-lenh-vi`, `wallet-connect`,
`investor-channel`, `ops-transactions`, `uiux-02-dau-man` (45 ca đạt); unit `uiux-02-dau-man.test.ts`,
`four-roles-shell.test.ts`, `wallet-status.test.ts`, `fe-ux-04c.test.ts` (81 ca). Cả bộ trong 1.1, gồm toàn bộ
project Hardhat (`wallet-connect`, `permit-order`).

### 2.5 Mã dư thừa

Đã xoá: `FIELD`; `Loader2` ở hai trang lệnh (khối đang tải thành `EmptyState`); lớp `*-destructive`; `p` tự viết của
ghi chú phạm vi. `Loader2` còn dùng ở `WalletStatusCard` (đang đọc số dư) và `WrongChainBanner` (nút đang chuyển).
Lint đạt, không import thừa.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300 (đủ `webServer.env`), tạo dữ liệu bằng
`maker-checker`, `ops-transactions`, `permit-order`, `recall` (gồm `ops-transactions` trước khi đo như tasks bước 2);
đo bằng `tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/trade,/approvals,/orders,DYN:/orders,/wallet`; `DYN:/orders` tìm được liên kết ở cả hai
lượt (28 dòng mỗi lượt). Tiến trình đo khác tiến trình chụp ảnh. JS theo byte: script riêng cộng gzip mọi script khi
mở trang (cùng cách cộng của công cụ), máy chủ mới cổng 3500 sau `ops-transactions`, mỗi trang đo hai lần, bằng nhau.

| Mục | Mốc `e6604d0` | Sau `3c1c277` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/orders` 1, `/orders/[id]` 1, `/wallet` 0 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` (cộng 4 biến thể) | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | ba màn 0, khác không tăng |
| JS gzip (công cụ) `/orders`; `/orders/[id]`; `/wallet`; `/trade` | 535,8; 452,3; 455,1; 480,0 KB | 536,5; 452,5; 456,0; 480,0 KB | |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.360 B | 19.403 B (+43 B) | +2 KB |
| `role` trong `main` (ca 1, ca 2) | `/orders` note 1; `/wallet` 0 | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc của lượt e2e đầy đủ build đúng mã `e6604d0` (nhánh lúc đó chỉ thêm spec và e2e); bản mốc
build riêng build lại `e6604d0` sau bản cuối, cùng phiên (`NEXT_DIST_DIR=.next-moc`, đã xoá):

| Trang | Mốc (lượt e2e) | Mốc build riêng | Sau `3c1c277` | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/orders` | 548.654 | 548.655 | 549.415 | +760 | +3.072 |
| `/orders/[id]` | 463.133 | 463.132 | 463.381 | +249 | +3.072 |
| `/wallet` | 466.050 | 466.049 | 466.907 | +858 | +3.072 |
| `/trade` | 491.568 | 491.567 | 491.533 | -34 | +1.024 |
| `/portfolio` | 467.846 | 467.845 | 467.817 | -28 | không tăng |
| `/tokens/WPT` | 463.073 | 463.074 | 463.059 | -15 | không tăng |
| `/withdraw` | 484.033 | 484.030 | 484.028 | -2 | không tăng |
| `/` | 571.628 | 571.626 | 571.628 | +2 | không tăng |
| `/approvals` | 466.105 | 466.106 | 466.103 | -3 | không tăng |
| `/distribution` | 479.584 | 479.580 | 479.647 | +67 | không tăng |
| `/vault` | 469.542 | 469.544 | 469.544 | 0 | không tăng |

Hai trang ngoài phạm vi tăng (`/distribution` +67 B, `/` +2 B): đã lưu và so từng chunk của `/distribution`, `/`,
`/trade` giữa bản mốc build riêng và bản sau (`chunk_diff.txt` gửi kèm). Ở `/distribution`, chunk khác tên có cùng
kích thước thô (55.043 B và 55.043 B; chunk chung 178.700 B và 178.700 B), khác ở mã số module, thứ tự module, mã
tham chiếu server action; không thêm mã. Ở `/`, chunk 384.038 B và 384.038 B. Lệch gzip là nhiễu nén; công cụ đo báo
bằng nhau. Ở `/trade`, chunk của trang giảm từ 89.412 B xuống 89.220 B thô (`WrongChainBanner` dùng `Alert` có sẵn
trong bundle thay khối tự viết).

CSS mốc lấy từ bản build mốc sạch (19.360 B). Bản mốc build riêng cho 19.402 B vì build lúc `.next-moc` nằm trong
`app/` (Tailwind quét thư mục chưa ignore); so cách đó thì +1 B.

## 5. Ảnh (gửi kèm, không commit)

- Năm cảnh vai Nhà đầu tư, 1440 và 390, Sáng và Tối, trước (`moc/anh/`) và sau (`sau/anh/`): `/orders` có dòng;
  `/orders/<mã dòng đầu>`; `/wallet` mô phỏng; `/wallet` chọn `hardhat-local` (chưa có ví); `/wallet` có
  `window.ethereum` tối giản (chép khối `wallet-connect.spec.ts:133-148`) chọn `hardhat-local` (chưa kết nối). Mỗi
  lượt một tiến trình mock MỚI cổng 3400: `npx next start --port 3400` với đủ biến của `webServer.env`
  (`NEXT_PUBLIC_DEFAULT_CHAIN`, `USE_MOCK_KYC`, `USE_MOCK_DB`, `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`,
  `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat, `RPC_HARDHAT`); `E2E_BASE_URL=…
  npx playwright test e2e/ops-transactions.spec.ts` (2 ca đạt); chụp; tắt. Mốc (bản build `e6604d0`): bật 18:52:25Z,
  tắt 18:53:45Z. Sau (bản build `3c1c277`): bật 19:16:46Z, tắt 19:18:06Z (04/11/2026, UTC). Ô chọn chain nằm trong
  ngăn kéo menu ở 390 px nên script chọn chain ở 1440 px rồi trả bề rộng. `main` không tràn ngang, 0 lỗi console ở
  cả 20 ảnh mỗi lượt.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (9 trạng thái): `WalletStatusCard` có số dư Hardhat (không explorer), có số
  dư Sepolia (có explorer), đang đọc, lỗi đọc; `WrongChainBanner` thường, đang chuyển, có lỗi, lệch mạng có
  `children` (nút "Hoặc xem trang theo …"); `UnsupportedChainNotice`. HTML dựng bằng `renderToStaticMarkup` với dữ
  liệu giả (`vi.mock` hook số dư; test tạm, xoá ngay, không commit), CSS bản build tương ứng, `page.setContent`, font
  hệ thống, Sáng và Tối, 1440 (khung 760 px) và 390 (`anh_tinh_moc/`, `anh_tinh_sau/`). Trước dùng mã `e6604d0` (thêm
  tạm `export` cho `UnsupportedChainNotice` để dựng được) và CSS bản mốc; sau dùng mã cuối và CSS bản sau. Ở 390 px
  thẻ ví và ô số dư xếp dọc, rộng bằng nhau.
- Kiểm đọc được (Sáng và Tối): ba nút trên thẻ xanh (Sao chép, Xem trên Etherscan, Ngắt kết nối) nền mờ chữ trắng;
  ô vàng số dư; `Alert bad` sai mạng; bảng lệnh có nhãn "Hoàn tất" sắc `ok`.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...|-destructive\b' <ba trang> app/src/components/wallet/           # rỗng
6c $ comm -13 /tmp/feux04c-del.txt /tmp/feux04c-add.txt | rg -n '...ký tự cấm...'        # rỗng
6d $ comm -23 <(ext /tmp/feux04c-del.txt) <(ext /tmp/feux04c-add.txt)
Mua WPT, nhận lợi nhuận và tất toán đều thực hiện được ngay ở chế độ này <gạch dài> kết quả là
R4.1/R4.2 <gạch dài> lệch mạng có HAI cách sửa và người dùng được chọn. Hệ thống không tự
Task 2.5 <gạch dài> ghi nhãn rõ. Đây là phí giao dịch của mạng, KHÔNG phải VNDB và không
nối ví cũng chưa phải đăng nhập <gạch dài> vai trò hiện tại vẫn lấy từ phiên demo.
tiếng Việt, nhưng hộp thoại chọn ví vẫn là của RainbowKit <gạch dài> không dựng lại phần
<chấm giữa> Bước này chỉ đọc địa chỉ ví, không lấy được tiền và không ký gì.
<chấm giữa> Mỗi giao dịch sau này đều phải bạn tự xác nhận trong ví.
<chấm giữa> Ngắt kết nối được bất cứ lúc nào.
6e $ rg -n '...ký tự cấm...' <ba trang> app/src/components/wallet/ <test> <e2e> | rg -v '<dòng chú thích>'   # rỗng
```

("<gạch dài>", "<chấm giữa>" thay cho U+2014, U+00B7 lệnh in ra, vì tài liệu không dùng hai ký tự đó.) Chạy trên HEAD
`3c1c277`, `LC_ALL=C`. 6d đúng 8 dòng, đúng các vị trí QĐ-7: `wallet-connect.tsx:143` (thành dấu phẩy),
`:87` (chú thích JSX, thành dấu hai chấm), `:203` (chú thích JSX, thành dấu hai chấm), `:246` (thành dấu phẩy),
`:196`, `:197`, `:198` (bỏ chấm giữa, danh sách `list-disc pl-5`), `wallet-status-card.tsx:98` (chú thích JSX, thành
dấu hai chấm). Không mảnh chữ nào khác. `docs/tech-report.md` không đổi (marker không nằm trong tệp đã sửa).

## 7. Đối chiếu notes

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

### 7.1 `notes/orders.md`

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề, câu mô tả | Làm tiêu đề; không câu mô tả (requirements mục 1, test cấm câu phụ) |
| Dòng chế độ mô phỏng thành alert | Làm: `Alert info` giữ `role="note"` |
| Thẻ "Bộ lọc" | Làm: `CardTitleIcon` `Filter`, `form role="search"` giữ |
| Ô Mã lệnh có biểu tượng kính lúp | Làm: `Search` trang trí trong khung ô |
| Dropdown Chiều, Trạng thái; hai ô ngày (không nhãn hiện) | Giữ `aria-label`, placeholder, không nhãn hiện (requirements mục 1) |
| Thẻ bảng không tiêu đề, `aria-label` cho trình đọc | Giữ không tiêu đề; không thêm `aria-label` bảng (requirements mục 1) |
| 8 cột sắp xếp được | Giữ `COLUMNS`, `toggleSort`, `SortIcon`; nút tiêu đề chữ nhỏ đậm, hàng tiêu đề `bg-muted/60` |
| Giá trị từng ô | Giữ |
| Liên kết "Chi tiết" | Làm: thêm `ChevronRight` |
| "Không có lệnh nào khớp bộ lọc." | Làm: `EmptyState` |
| Chưa kết nối ví | Làm: `EmptyState` `Wallet`; không thêm tiêu đề màn (requirements mục 1) |
| Thanh "Trạng thái xem thử" | Không làm: không phải khối màn thật |
| Thông báo "Ví chưa được định danh" | Giữ `WalletNotBoundNotice` |
| Đang tải, lỗi | Làm: `EmptyState loading`; `Alert bad` không `role` |
| Kiểu cục bộ `.sortbtn`, `#flt` lưới 5 cột (2 cột ở ≤1180px) | Làm theo design mục 1 (5 cột từ 1100 px, 2 cột từ 640 px, 1 cột hẹp hơn) |
| Thay đổi trình bày: trạng thái có màu theo nghĩa | Làm: `Badge variant={orderStatusTone(...)}` |
| Mục "Lệch đã thấy" (3 dòng) | Không làm: logic hoặc chữ (requirements mục 1) |

### 7.2 `notes/order-detail.md`

| Dòng notes | Kết quả |
|---|---|
| Liên kết "Quản lý lệnh", tiêu đề, badge, ba ô KPI, thẻ Thông tin lệnh, Tiến trình, Nhật ký | Giữ `OrderDetailContent` (đã làm ở FE-UX-02a, requirements mục 1) |
| Thanh "Trạng thái xem thử", hàng "Lệnh mẫu" | Không làm: không phải khối màn thật |
| Thông báo "Ví chưa được định danh" | Giữ |
| "Chưa kết nối ví" | Làm: `EmptyState` `Wallet`, chữ đúng |
| "Đang tải lệnh…" | Làm: `EmptyState loading` |
| Câu lỗi "Không tìm thấy lệnh …" | Làm: `Alert bad` không `role` (ca 4 mở mã giả thấy khối này) |
| Mục "Lệch đã thấy" (4 dòng) | Không làm: logic hoặc chữ |

### 7.3 `notes/wallet.md`

| Dòng notes | Kết quả |
|---|---|
| Tiêu đề, câu mô tả | Làm tiêu đề; không câu mô tả |
| Thanh "Trạng thái xem thử" | Không làm: không phải khối màn thật; trạng thái kiểm bằng unit test, e2e và ảnh dựng tĩnh |
| Thẻ xanh "Ví đã kết nối" + nhãn mạng | Làm: `Card tone="hl"` 7 cột, `CardTitleIcon` `Wallet` |
| Địa chỉ rút gọn, đủ ở `title` | Làm: `font-code text-3xl`, `title`, `sr-only` giữ |
| Nút Sao chép | Giữ hành vi; nền, chữ theo thẻ xanh |
| Nút "Xem trên Etherscan" (ẩn ở hardhat-local) | Giữ điều kiện; nền, chữ theo thẻ xanh |
| Ô vàng "Số dư ETH" và câu "Đây là đồng của …" | Làm: `Kpi tone="gold"` 5 cột, câu trong `children` |
| "Số WPT đang giữ …" + nút "Ngắt kết nối" | Giữ, dòng cuối kẻ trên |
| Tab Chế độ mô phỏng (gạch dài thành phẩy) | Làm (QĐ-7) |
| Tab Chưa kết nối (3 ý đổi chấm giữa thành biểu tượng) | Làm: `list-disc pl-5` (QĐ-7) |
| Tab Chưa có ví | Giữ nội dung; tiêu đề `CardTitleIcon` |
| Tab Sai mạng, Lệch mạng (`alert bad` với nút `danger`) | Làm `Alert bad`; nút chuyển giữ `variant` mặc định như cũ (QĐ-5 giữ nút chuyển; không đổi sang `destructive`) |
| Tab Mạng chưa hỗ trợ | Giữ nội dung; `CardTitleIcon` |
| Tab Đang kiểm tra (khung chờ, câu `sr-only`) | Làm: hai khối cùng lưới 7/5, giữ `aria-busy`, `sr-only` |
| Khung cuối "Ví ở trang này …" (gạch dài thành phẩy) | Làm: `Alert info` không `role`, `ShieldCheck` (QĐ-5, QĐ-7) |
| Nút "Sao chép" `aria-label` kèm địa chỉ | Giữ |
| Kiểu cục bộ: nút viền trong thẻ hero nền trắng mờ | Làm bằng `bg-(--tile-hl-chip)`, chữ `--tile-hl-ink` (QĐ-5) |
| Thay đổi trình bày: bento 7/5 | Làm |

## 8. Nợ và DEVIATION

- **Điều kiện chờ tải e2e (lệch chữ design mục 3).** Design ghi "chờ `main` không còn chữ khớp
  `/Đang (tải|kiểm tra)/`". `innerText` của `main` ở `/orders` có cả lựa chọn "Đang kiểm tra" của ô lọc Trạng thái
  (nhãn trạng thái lệnh), nên điều kiện không bao giờ đạt, cả ở mốc. Em đọc chữ của `main` sau khi bỏ các phần tử
  `select` (`433279e`); vẫn dùng được cho cả mốc và sau, đúng ý "chờ khối đang tải biến mất".
- **Ca 2 chọn chain ở 1440 px.** Ô chọn chain nằm trong ngăn kéo menu ở 390 px nên `selectOption` không thấy phần tử;
  ca 2 trả bề rộng 1440 px sau phần kiểm 390 px rồi mới chọn `hardhat-local` (`3c1c277`).
- **Ca 3 lọc thẻ theo heading:** bản nháp dùng locator gốc `main` trong `has`, không khớp; sửa dùng locator gốc trang.
- **Nút chuyển mạng:** bản chốt ghi nút `danger`; QĐ-5 giữ nút chuyển như cũ nên em không đổi `variant` sang
  `destructive`, nút giữ biến thể mặc định trong `Alert bad`.
- **Lượt đo bản sau bị chạy chồng:** lượt đầu em chạy riêng e2e mới song song với bước chụp của pipeline, hai lượt
  Playwright tranh thư mục `test-results` nên cả hai hỏng. Em huỷ lượt đó (`sau_huy/`, không dùng số nào), chạy lại
  toàn bộ bản sau trên tiến trình mới, không chạy gì song song; số trong mục 4, 5 là lượt sạch.
- **Chưa làm theo requirements mục 1 "Không làm":** câu phụ dưới tiêu đề; `aria-label` bảng lệnh; tiêu đề màn ở nhánh
  chưa kết nối ví của `/orders`; nhãn hiện cho 5 ô lọc; `OrderDetailContent`, `SettlementProgress`; minh hoạ, hiệu ứng
  (FE-UX-08); lệch trong notes (ô lọc UUID đủ 36 ký tự, nhãn ngày).

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi.
