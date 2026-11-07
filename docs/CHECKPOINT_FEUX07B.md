# Báo cáo bàn giao: FE-UX-07b thanh đầu theo bản chốt, nhãn chain "Private Chain"

| | |
|---|---|
| Mã task | FE-UX-07b |
| Phạm vi | **Frontend**: `components/layout/header.tsx` (viết lại `Header`, `ShellMain` giữ nguyên), `header-progress.ts`, `header-wallet-button.tsx` (mới); một dòng ở `app-layout.tsx` (prop `logo`); 7 token `--hdr-*` ở `globals.css`; một dòng nhãn ở `packages/shared/src/chains.ts`. Không `lib/**`, `app/actions/**`, `app/api/**`, `components/ui/**`; không gói npm mới |
| Nhánh | `feat/fe-ux-07b-thanh-dau`, tạo từ `release/ui-v2` @ `73b57db` (đã gồm FE-UX-07a). **Merge-base dùng để đo mốc: `73b57db`**. `git fetch` trước khi mở PR: `origin/release/ui-v2` vẫn `73b57db`, không phải rebase |
| Spec | `docs/fe-ux-07b-thanh-dau/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `5cd5239`; nhãn chain, câu UserGuide, unit nhóm 4 `a0e30a7`; thanh đầu, unit nhóm 1 đến 3, e2e 5 ca `a75d715`; e2e ca 5 ghép nhãn cũ từ mảnh (lệnh 6f) `98fe661`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Kích thước, vị trí, lề đúng QĐ-1 ở 1440, 1100, 1099, 390 px; bảng số đo bản chốt và app | ✅ | mục 3.1, 1.2 ca 1 |
| 2 | Tiến độ cuộn đúng QĐ-2 (`ref`, không `setState`, làm mượt, giảm chuyển động, đổi trang); hàm thuần có unit | ✅ | mục 2.1, 1.3 nhóm 1, 2; 1.2 ca 3 |
| 3 | Nền, bóng, đường chân trời đúng QĐ-3; `[data-horizon]` giữ animation và giảm chuyển động | ✅ | mục 3.1, 3.3, 1.2 ca 2, 3 |
| 4 | Tên màn đúng QĐ-4, QĐ-5 | ✅ | mục 3.1, 1.2 ca 2 |
| 5 | Nút ví đúng QĐ-6 ở bốn trạng thái, mở hộp thoại RainbowKit; dưới 640 px chỉ biểu tượng có `aria-label` | ✅ | mục 1.3 nhóm 3, 1.2 ca 4, 2.5 ý 6 |
| 6 | Nút Sáng Tối, nút menu đúng QĐ-7; `title` giữ | ✅ | mục 3.1, 1.3 nhóm 1, 1.2 ca 4 |
| 7 | Logo nhỏ dưới 1100 px đúng QĐ-8, không chồng chữ ở mọi `--hp` | ✅ | mục 1.2 ca 4, 5, 2.5 ý 5 |
| 8 | Token đúng QĐ-9; không mã màu trong `.tsx` phạm vi | ✅ | mục 2.1, 6 (6b), 1.3 nhóm 1 |
| 9 | Nhãn "Private Chain" đúng QĐ-10; checkpoint liệt kê mọi chỗ hiển thị | ✅ | mục 3.2, 6 (6a, 6f), 1.3 nhóm 4, 1.2 ca 5 |
| 10 | Logic giữ (QĐ-11); không sửa test có sẵn | ✅ | mục 2.4, 6 (6a) |
| 11 | JS, CSS trong trần QĐ-12; 28 đường dẫn không tăng lỗi | ✅ | mục 4 |
| 12 | Ảnh `/portfolio`, `/transactions` 1440, 390 Sáng Tối, `--hp` 0 và 1, cạnh bản chốt; 390 ở 0,5; ô chọn chain | ✅ | mục 5, 2.5 ý 4 |
| 13 | E2e 5 ca, unit 4 nhóm xanh; kiểm thử mục 5 kèm log, "EVM - E2E PROJECT HARDHAT" xanh; lệnh bước 6 đúng | ✅ | mục 1.1, 1.2, 1.3, 6 |
| 14 | Không mã dư thừa; không thêm gói npm | ✅ | mục 2.3 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Đo trên bản build cuối `98fe661` so mốc `73b57db`: action khớp 28/28; `hydration`,
`consoleErrors`, `pageErrors` 0 ở cả 28 đường dẫn, mốc lẫn sau. JS gzip mọi trang có khung +1.196 đến +1.207 B so bản build
mốc riêng (trần +1.536 B), cùng số tệp script; chỉ chunk khung đổi (+4.128 B thô, +1.197 B gzip: tiến độ cuộn, nút ví tự dựng
bằng `ConnectButton.Custom`), mục 4.2. CSS dùng chung gzip +943 B (trần 1.024 B), mục 4.1. Thanh đầu trùng mép nội dung ở cả
bốn bề rộng (lệch 0 px), cao, đỉnh, bo, đệm, nền, bóng, chữ tên màn khớp bản chốt (mục 3.1). Bốn điểm gây lỗi của Supervisor
đều làm unit đỏ (mục 1.3). Mức rủi ro: thấp (một thành phần khung, không đổi quyền, dữ liệu, action; nhãn chain chỉ là chữ).

UserGuide: "Chốt tại"; Phần 3 mục 3.0 (đoạn "Thanh đầu": hai trạng thái khi cuộn, bốn trạng thái nút ví; đoạn "Đáy": câu
"Private Chain"); dòng lịch sử 07/11/2026. task-status: FE-UX-07b `done`. `docs/tech-report.md` không đổi (không marker nào
dời dòng).

### 0.2 Việc cần Owner quyết

- Không có. Lưu ý: tên màn trên thanh vẫn là phần tử cuối của `breadcrumbs` ("Tổng quan"), không phải chữ `h1` ("Tổng quan nhà
  đầu tư") như bản chốt (QĐ-5). Muốn đúng chữ `h1` thì làm task riêng.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-07b` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), Postgres bật.

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
(điền sau khi chạy)
```

Log đầy đủ (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết gửi
kèm, không commit.

### 1.2 E2E `fe-ux-07b-thanh-dau.spec.ts` (project mock, 5 ca)

Chạy riêng trên bản build nhánh: 5 ca đạt (47,9 giây). Cùng bản build: `fe-ux-01b-khung`, `fe-ux-01c-chuyen-dong`,
`wallet-connect`, `fe-ux-04c-lenh-vi`, `uiux-02-dau-man` 32 ca đạt; sau bước 3 (nhãn chain) `wallet-connect`, `fe-ux-04c-lenh-vi`
14 ca đạt. Bộ đầy đủ ở mục 1.1 cũng chạy cả 5 ca.

| Ca | Kiểm | Kết quả |
|---|---|---|
| 1 | Giao dịch viên `/vault` (2.5 ý 3): 1440, 1100, 1099, 390 px mép trái, phải `header` lệch mép nội dung `main` không quá 1 px; cao 44 hoặc 46, bo 18 hoặc 16; cuộn 600 px (`scrollTop >= 600` khẳng định trước) đỉnh 10 hoặc 8 px | Đạt |
| 2 | 1440 Sáng: đầu trang `--hp` 0, tên màn và `[data-horizon]` `opacity` 0; cuộn 500 px: `--hp` 1, `data-on`, tên màn trắng 14 px 700 `opacity` 1, nền `rgba(3, 46, 45, 0.9)` `opacity` 1; cuộn về 0 thì `--hp` 0. Tối: nền `rgba(2, 30, 29, 0.92)`. 390 Sáng đầu trang: lớp nền `opacity` 0,044 | Đạt |
| 3 | `reducedMotion: 'reduce'`: cuộn 500 px, hai khung hình rồi đọc một lần: `--hp` 1; `::after` của `[data-horizon]` `animationName` `none` | Đạt |
| 4 | 1440: nút "Kết nối ví" cao 30, chữ 13 px; nút Sáng Tối 30 x 30; 390: nút ví rộng 38, tên truy cập "Kết nối ví"; bấm mở `[role="dialog"]` RainbowKit, `Escape` đóng; logo nhỏ (`role="img"` "BIDV") `opacity` 1 ở đầu trang, 0 khi cuộn, hộp bao không giao tên màn ở `--hp` 1 | Đạt |
| 5 | `#chain-selector option[value="hardhat-local"]` chữ "Private Chain"; trang không còn nhãn cũ; `/`, `/portfolio`, `/seller`, `/approvals`, `/wallet` đúng vai ở 1440 và 390: 0 lỗi console, 0 `pageerror`, 0 thông điệp hydrate | Đạt |

### 1.3 Unit `fe-ux-07b.test.ts` (4 nhóm, 15 ca) và gây lỗi có chủ đích

Nhóm 1 mã nguồn (5 ca): `header.tsx` 0 `useState(` (không `useState` nào khác), có `setProperty("--hp"`,
`requestAnimationFrame(`, `cancelAnimationFrame(`, trình nghe `scroll` `passive: true` và gỡ; lớp QĐ-1 so theo ranh giới token,
không `top-0`, không `bg-card/80`; giữ `inert={open}`, `id={MENU_BUTTON_ID}`, `data-horizon`, `title` nút Sáng Tối; không còn
`<ConnectButton`, có `<HeaderWalletButton />`; 7 token QĐ-9 (`--hdr-on`, `--hdr-shadow` ở cả `:root` và `.dark`); không mã màu.
Nhóm 2 hàm thuần (2 ca), nhóm 3 `HeaderWalletButtonView` bốn trạng thái và không ký tự cấm (5 ca), nhóm 4 nhãn chain, khoá,
`chainId`, RPC giữ và `resolveWalletStatus` `chain-mismatch`, `wrong-chain` (3 ca). Tên lớp trong test ghép từ mảnh (Tailwind quét `app/test`). `wallet-status`, `fe-ux-04c`,
`fix-08` (unit) đạt sau bước 3 và trong bộ đầy đủ.

Bốn điểm gây lỗi của Supervisor, mỗi điểm sửa trên bản đã commit rồi trả lại bằng `git checkout`, chạy `fe-ux-07b`:

| Điểm | Ca đỏ |
|---|---|
| Bỏ `min-[1100px]:mx-6` | 1 (nhóm 1, lớp QĐ-1) |
| `stepProgress` khi giảm chuyển động vẫn nội suy | 1 (nhóm 2, `reduce` trả thẳng đích) |
| Bỏ `aria-label` của nút ví | 1 (nhóm 3, `disconnected`) |
| `--hp` đổi sang `useState` | 1 (nhóm 1, không `useState(`) |

---

## 2. Thay đổi

### 2.1 Tệp mới, tệp có sẵn

- `header-progress.ts`: `headerProgress`, `progressRange`, `stepProgress` (QĐ-2, design mục 2), hằng 60, 100, 30, 0,2, 0,002.
- `header-wallet-button.tsx` (`"use client"`): `HeaderWalletButtonView` thuần (bốn trạng thái, viên nang 30 px, không `<p>`) và
  `HeaderWalletButton` dùng `ConnectButton.Custom` (`!mounted` giữ chỗ; chưa có tài khoản hoặc chain mở `openConnectModal`;
  `chain.unsupported` mở `openChainModal`; còn lại `account.displayName`, `openAccountModal`). `providers.tsx` không đổi.
- `header.tsx`: một `useEffect([pathname])` trên vùng cuộn (cha của `header`): trình nghe `scroll` thụ động, `resize` trên
  `window`, `requestAnimationFrame` làm mượt, ghi `--hp` (3 chữ số) và `data-on` qua `ref`; gỡ cả hai trình nghe và huỷ khung hình
  khi dọn. Lớp theo QĐ-1, QĐ-3, QĐ-4, QĐ-7; lớp nền `[data-header-bg]`; `[data-horizon]` cao 2 px, `inset-x-5`, `opacity-(--hp)`;
  vùng giữa `relative` chứa logo `absolute` và tên màn. Prop mới `logo`.
- `app-layout.tsx`: 1 dòng: `<Header breadcrumbs={breadcrumbs} logo={<BidvLogo variant="compact" />} />` (dựng ở máy chủ).
- `globals.css`: 13 thêm, 0 xoá: `:root` (sau `--lp-deep`) chú thích và 7 token; `.dark` chú thích và `--hdr-on`, `--hdr-shadow`.
  Giá trị đúng bảng QĐ-9.
- `chains.ts`: đúng dòng `label` (6a).

### 2.2 Kiểm thử mới

`app/test/fe-ux-07b.test.ts` (15 ca, mục 1.3), `app/e2e/fe-ux-07b-thanh-dau.spec.ts` (5 ca, mục 1.2). Không sửa test có sẵn.

### 2.3 Không mã dư thừa

`npx eslint .` 0 lỗi (một cảnh báo có từ trước ở `test/helpers/fake-fireblocks.ts`); `npx tsc --noEmit` sạch. Import
`ConnectButton` ở `header.tsx` đã gỡ; mọi hằng, hàm của `header-progress.ts` đều dùng. Không thêm gói npm.

### 2.4 QĐ-11: diff ngoài vỏ JSX, lớp, tiến độ cuộn, nút ví, prop `logo`

`useDrawerOpen`, `inert={open}`, nút menu (`id`, `aria-label`, `aria-expanded`, `aria-controls`, `openDrawer(pathname)`),
`toggleTheme`, `useIsMounted` và `ShellMain` giữ nguyên từng ký tự (`--numstat` `header.tsx` 97 thêm, 47 xoá). Phần khác:

1. Import: thêm `useEffect`, `useRef`, ba hàm của `header-progress`, `HeaderWalletButton`; bỏ `ConnectButton`.
2. Chú thích đầu `Header` thêm đoạn FE-UX-07b; chú thích cũ về nút ví (nhãn trung tính, `ISigner`, FE-02 R7.2) chuyển sang chú
   thích của `HeaderWalletButton`, viết lại không ký tự U+2014 (tasks bước 4). Câu "Màu vàng của nút đặt ở `providers.tsx`" bỏ vì
   nút tự dựng nay lấy màu từ token `--hdr-gold-*`. Đây là các dòng 6d in (mục 6).
3. Biểu tượng Sáng Tối: `<Sun className="h-4 w-4" />` thành `<Sun />`, cỡ 15 px đặt bằng `[&_svg]:size-[15px]` ở nút (chỉ lớp).
4. Nút Sáng Tối bỏ `hover:bg-muted hover:text-foreground` và `border-border bg-background` (thay bằng lớp QĐ-7); giữ hiệu ứng xoay.

### 2.5 DEVIATION

1. **Nền thanh và vạch màu là phần tử `span` thật, không là `::before`** (QĐ-3, QĐ-4): lớp nền `[data-header-bg]`
   (`absolute inset-0 -z-10 rounded-[inherit] bg-(--hdr-on)`, `opacity` theo công thức QĐ-3) và vạch `span` trong `p`. Lý do QĐ-12:
   các biến thể `before:` sinh thêm khối CSS riêng; bản đầu CSS dùng chung +1.094 B (vượt trần 1.024 B), đổi sang `span` cùng mờ
   nền, bóng viết bằng thuộc tính tuỳ ý (`[backdrop-filter:…]`, `[box-shadow:…]`) thay tiện ích ghép còn +943 B. Hình như nhau
   (mục 3.1: màu nền, `opacity` khớp).
2. **Bóng nút ví** dùng `var(--hdr-gold-to)` (vàng) và khi `data-on` dùng `var(--hdr-on)` (xanh tối), không mã `rgba` đen như bản
   chốt (`rgba(168,122,9,.8)`, `rgba(0,0,0,.6)`): không mã màu trong `.tsx` (QĐ-9, 6b). Khác biệt màu bóng rất nhỏ trên ảnh.
3. **E2e ca 1 đến 4 cuộn trên `/vault` (Giao dịch viên)**, không `/transactions` (design mục 3): ở 1440 x 900 `/transactions`
   không cuộn được (nội dung ngắn hơn vùng cuộn khi chạy riêng), `/approvals` chỉ cuộn 380 px, chưa tới 600 px. `/vault` đủ dài ở
   cả bốn bề rộng; ca 1 khẳng định `scrollTop >= 600` trước khi đo.
4. **Ảnh 1440 khi cuộn chụp ở cửa sổ cao 600 px** (`_cao600`): `/portfolio`, `/transactions` ở 1440 x 900 không cuộn đủ 500 px
   nên `--hp` không tới 1. Cửa sổ thấp hơn cho cùng màn cuộn được, `--hp` 1. Ảnh bản chốt cùng trạng thái chụp ở 900.
5. **Logo nhỏ trượt lên 28 px trong lúc mờ** (`translateY(calc(var(--hp) * -28px))`), ngoài `opacity` của QĐ-8: tên màn trượt
   lên từ dưới, logo trượt lên ra khỏi thanh nên hai hộp bao không giao nhau ở mọi `--hp` (e2e ca 4, ảnh `_giua`).
6. **`aria-label="Kết nối ví"` luôn có ở nút chưa kết nối**, không riêng dưới 640 px: chữ chỉ ẩn bằng `max-[640px]:sr-only`, tên
   truy cập như nhau ở mọi bề rộng.
7. **Nút ví chỉ `transition-colors`**, không chuyển bóng: bóng đổi theo `data-on` là bước nhảy (một lớp `transition` ít CSS hơn).
8. **Nút menu ở đầu trang giữ màu `text-muted-foreground` hiện có**; chỉ khi `data-on` chữ `--tile-hl-ink` (QĐ-7). Bản chốt ở
   đầu trang dùng màu chính (`rgb(17, 93, 92)`), không nằm trong QĐ.
9. **Nhánh và QĐ-8 khác nhau về biến thể logo**: dòng "Nhánh" ghi `variant="inline"`, QĐ-8 ghi `variant="compact"` (cao 16, một
   dòng chữ 10 px). Làm theo QĐ-8 (mô tả chi tiết hơn và khớp bản chốt).

---

## 3. Bản chốt và app

### 3.1 Bảng số đo (`getComputedStyle`, `getBoundingClientRect`; bản chốt `portfolio.html`, app `/portfolio` Nhà đầu tư)

Bản chốt đo bằng `tools/20261106_do_thanh_dau_ban_chot.js` qua `file://`; app đo bằng script ngoài repo cùng cách, trên tiến trình
mock mới (mốc `73b57db` cổng 3500, sau `98fe661` cổng 3500). "Mép" là `x` trái đến mép phải; nội dung `main` 1440: 318 đến 1416,
1100: 318 đến 1076, 1099: 338 đến 1087, 390: 12 đến 378.

| Phần | Bản chốt | App mốc `73b57db` | App sau `98fe661` |
|---|---|---|---|
| Mép thanh 1440 / 1100 / 1099 / 390 | 1440: 294 đến 1416 (nội dung bản chốt 294 đến 1416); 390: 12 đến 378 | 306 đến 1428 / 306 đến 1088 / 338 đến 1087 / 12 đến 378 (lệch 12 px từ 1100) | 318 đến 1416 / 318 đến 1076 / 338 đến 1087 / 12 đến 378 (lệch 0) |
| Cao, đỉnh khi cuộn | 1440: 44, 10; 390: 46, 8 | 56, 12 (390: 48, 0 khi cuộn) | từ 1100: 44, 10; dưới: 46, 8 |
| Bo, đệm | 18, `0 8 0 20`; 390: 16, `0 8 0 12` | 22, `0 20` (dưới 1100: `0 12`) | 18, `0 8 0 20`; dưới 1100: 16, `0 8 0 12` |
| Nền `--hp` 0 / 1, Sáng | trong suốt / `rgba(3,46,45,.9)`; 390 Sáng 4% | thẻ trắng 80% cố định | lớp nền `rgba(3,46,45,.9)` `opacity` 0 / 1; dưới 1100 Sáng 0,0444 (4%) |
| Nền Tối `--hp` 1 | `rgba(2,30,29,.92)` | thẻ tối 80% cố định | `rgba(2,30,29,.92)` `opacity` 1 |
| Bóng `--hp` 1 | Sáng `0 10 28 -18` `rgba(1,40,39,.9)`; Tối `0 1 0` trắng 6% | không | Sáng `0 10 28 -18` `--hdr-shadow` 90%; Tối `0 1 0` trắng 6% |
| Tên màn `--hp` 0 / 1 | `opacity` 0 / 1, trắng, 14 px, 700 | `opacity` 1 cố định, chữ thường 16 px 500 | `opacity` 0 / 1, `rgb(255,255,255)`, 14 px, 700; dịch 14 px |
| Đường chân trời | `opacity` 0 / 1, cao 2, cách mép 20 | `opacity` 0,7 cố định | `opacity` 0 / 1, cao 2, `inset-x-5` |
| Nút ví (chưa kết nối) | 30 x 103, 13 px 500, gradient `#e0b44a` sang `#c9971c`; 390: 30 x 38 | RainbowKit cao 40, 16 px đậm | 30 px, 13 px 500, gradient token `--hdr-gold-*`; 390: 38 px chỉ biểu tượng |
| Nút Sáng Tối | 30 x 30, trắng 70%; `data-on` trắng 12%, viền 20% | 36 x 36 | 30 x 30, `bg-card/70`; `data-on` 12%, viền 20%, chữ trắng |
| Logo nhỏ (390) | `opacity` 1 / 0 | không có | `opacity` 1 / 0 (công thức `1 - --hp * 1,4`) |

Bản chốt rộng nội dung 1440 là 294 đến 1416 vì thanh bên bản chốt hẹp hơn; trùng mép nội dung của chính nó như app. Tên màn khác
chữ ("Tổng quan nhà đầu tư" của bản chốt, "Tổng quan" của app) theo QĐ-5.

### 3.2 Chỗ hiển thị nhãn chain `hardhat-local` (QĐ-10)

Grep `CHAINS[`, `.label`, `chainLabel` trong `app/src`. Mọi chỗ đọc `label`, không tệp nào trong danh sách bị sửa:

| Chỗ | Hiển thị |
|---|---|
| `components/layout/chain-selector.tsx:61` (qua `lib/config/flags.ts:94`) | chữ `option` của ô chọn chain; `:32-33` `title`, `aria-label` khi thanh bên thu gọn |
| `lib/wallet/wallet-status.ts:36`, `:114`, `:145`, `:153-154` | thông báo sai mạng, chain mong đợi, chain của ví |
| `components/wallet/wallet-connect.tsx:155`, `:183` | câu hướng dẫn đổi mạng |
| `components/wallet/wallet-status-card.tsx:51`, `:131` | huy hiệu tên mạng, câu trạng thái (ngoài danh sách của spec, grep bổ sung) |
| `lib/wagmi.ts:28` | tên mạng trong hộp thoại chọn mạng RainbowKit |
| `lib/hooks/use-wallet-status.ts:129`, `:144` | `chainName` của `wallet_addEthereumChain` (MetaMask hiện "Private Chain") |
| `components/maker-checker/request-table.tsx:109` | tên chain trong bảng yêu cầu |
| `lib/chains/registry.ts:75` | `name` của `defineChain` (viem) |
| `seller-withdraw.tsx:54`, `:247`; `investor-withdraw.tsx:68`, `:327` | ô "Mạng" của lệnh rút (đọc `publicConfig.chains`; ngoài danh sách của spec, grep bổ sung) |

Không thông báo máy chủ nào dùng nhãn này. `README.md:49`, `docs/guide.md` mô tả công cụ, ngoài phạm vi. Test có sẵn truyền chữ
cũ làm tham số (`fe-ux-04c.test.ts:67-83`, `wallet-status.test.ts:278-302`), giữ nguyên, vẫn đạt.

### 3.3 Cách làm bóng (QĐ-3, dev chọn)

Chọn `color-mix(in oklab, var(--hdr-shadow) calc(var(--hp) * 90%), transparent)` trong `box-shadow` của `header` (Tối
`0 1px 0` với 6%), không lớp riêng: một khai báo, không thêm phần tử. Số đo: `--hp` 1 Sáng ra `oklab(0.2506 -0.0412 -0.0089 /
0.9)` (bằng `rgb(1 40 39 / .9)`), Tối `oklab(0.99999 … / 0.06)`; `--hp` 0 trong suốt.

---

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo). Mốc: bản build `73b57db`, sau: bản build `98fe661`. Mỗi lượt đo một tiến trình
`next start` MỚI với đủ biến `webServer.env` (cổng 3300), tạo dữ liệu bằng `E2E_BASE_URL=… npx playwright test
e2e/ops-transactions.spec.ts` (2 ca đạt mọi lượt), rồi `tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/seller,/approvals,/account`; 28 dòng mỗi lượt, đủ 3 dòng `DYN:`. Tiến trình đo khác tiến trình chụp ảnh.

### 4.1 Tổng hợp

| Mục | Mốc `73b57db` | Sau `98fe661` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 | 0 ở cả 28 | không tăng |
| JS gzip (công cụ) `/`; `/portfolio`; `/seller`; `/approvals`; `/account` | 558,3; 456,9; 457,1; 455,3; 447,2 KB | 559,5; 458,1; 458,3; 456,4; 448,4 KB | mục 4.2 |
| CSS dùng chung gzip (tệp CSS lớn của `.next/static/chunks`, gzip mức 9) | 20.296 B | 21.239 B (+943) | +1.024 B |

CSS riêng `/gioi-thieu` (module của 07a) 1.357 B, không đổi.

### 4.2 JS theo byte (cộng gzip mọi script khi mở, 1440 Sáng)

Mốc lượt đầu; mốc build riêng (build lại `73b57db` sau bản cuối trong `git worktree` ở thư mục tạm ngoài repo, `node_modules` liên
kết cứng, đã xoá); sau; chênh so mốc build riêng; số tệp script mốc riêng / sau.

| Trang | Mốc | Mốc build riêng | Sau | Chênh | Tệp |
|---|---|---|---|---|---|
| `/` | 571.716 | 571.720 | 572.919 | +1.199 | 20 / 20 |
| `/draft` | 470.903 | 470.906 | 472.109 | +1.203 | 19 / 19 |
| `/transactions` | 552.374 | 552.375 | 553.574 | +1.199 | 20 / 20 |
| `/distribution` | 479.662 | 479.670 | 480.866 | +1.196 | 20 / 20 |
| `/vault` | 469.641 | 469.641 | 470.845 | +1.204 | 19 / 19 |
| `/recall` | 482.101 | 482.100 | 483.307 | +1.207 | 20 / 20 |
| `/config` | 477.489 | 477.489 | 478.690 | +1.201 | 20 / 20 |
| `/wallet-binding` | 462.987 | 462.986 | 464.186 | +1.200 | 19 / 19 |
| `/demo-payment` | 463.652 | 463.653 | 464.854 | +1.201 | 19 / 19 |
| `/mint` | 464.805 | 464.803 | 466.002 | +1.199 | 19 / 19 |
| `/assets` | 487.577 | 487.577 | 488.778 | +1.201 | 21 / 21 |
| `/kyc` | 462.555 | 462.555 | 463.756 | +1.201 | 19 / 19 |
| `/audit` | 456.644 | 456.644 | 457.845 | +1.201 | 19 / 19 |
| `/reconciliation` | 463.572 | 463.572 | 464.773 | +1.201 | 19 / 19 |
| `/transactions/[id]` | 462.686 | 462.688 | 463.889 | +1.201 | 19 / 19 |
| `/approvals` | 466.178 | 466.182 | 467.383 | +1.201 | 19 / 19 |
| `/approvals/[id]` | 466.517 | 466.520 | 467.721 | +1.201 | 19 / 19 |
| `/portfolio` | 467.870 | 467.869 | 469.067 | +1.198 | 19 / 19 |
| `/trade` | 491.545 | 491.551 | 492.749 | +1.198 | 20 / 20 |
| `/orders` | 549.481 | 549.481 | 550.685 | +1.204 | 20 / 20 |
| `/orders/[id]` | 463.423 | 463.422 | 464.624 | +1.202 | 19 / 19 |
| `/withdraw` | 485.802 | 485.802 | 487.004 | +1.202 | 20 / 20 |
| `/tokens/WPT` | 463.097 | 463.096 | 464.294 | +1.198 | 19 / 19 |
| `/wallet` | 467.000 | 467.000 | 468.201 | +1.201 | 19 / 19 |
| `/account` | 457.918 | 457.919 | 459.120 | +1.201 | 19 / 19 |
| `/seller` | 468.074 | 468.073 | 469.275 | +1.202 | 19 / 19 |
| `/seller/transactions` | 549.700 | 549.701 | 550.903 | +1.202 | 20 / 20 |
| `/seller/withdraw` | 478.827 | 478.824 | 480.026 | +1.202 | 20 / 20 |

Mọi trang có khung +1.196 đến +1.207 B, cùng số tệp. So từng tệp: chỉ chunk khung đổi, +4.128 B thô, +1.197 B gzip (vòng lặp
cuộn, ba hàm `header-progress`, `HeaderWalletButton` và `HeaderWalletButtonView` bốn nhánh, lớp mới); các tệp khác giống từng
byte.

---

## 5. Ảnh (gửi kèm, không commit)

Mốc (bản build `73b57db`, tiến trình mock mới cổng 3400) và sau (bản build `98fe661`, tiến trình mock mới cổng 3400, ngày
07/11/2026 UTC), mỗi lượt 19 ảnh: `/portfolio` (Nhà đầu tư) và `/transactions` (Giao dịch viên) ở 1440 và 390 px, Sáng và Tối,
đầu trang và cuộn 500 px (1440 cuộn: cửa sổ cao 600, 2.5 ý 4); 390 Sáng `--hp` khoảng 0,5 (`_giua`); ô chọn chain mở danh sách có
"Private Chain". Ảnh bản chốt cùng màn, cùng trạng thái (18 ảnh, `file://`), và 4 ảnh ghép bản chốt cạnh app (1440, 390; đầu
trang, cuộn). 0 lỗi console ở cả lượt.

---

## 6. Lệnh kiểm tasks bước 6

Chạy trên HEAD `98fe661` (mã cuối), bash, `LC_ALL=C`:

- 6a: hai lệnh đầu rỗng; `--numstat`: `globals.css` 13 0, `chains.ts` 1 1; dòng bốn đúng `-    label: 'Hardhat Local',` và
  `+    label: 'Private Chain',`.
- 6b: rỗng. 6c: rỗng. 6e: rỗng.
- 6d: 9 dòng, đều là mảnh của chú thích cũ về nút ví ở `header.tsx` (khối `{/* … */}` mà dòng bên trong không bắt đầu bằng `*`
  hay `//` nên lệnh không lọc): "Nhãn trung tính, KHÔNG nói", "Thanh trên dùng chung cho cả ba kênh, …", "NHÀ ĐẦU TƯ: thao tác đặc
  quyền …", "(FE-02 R7.2). Nhãn cũ", "Kết nối ví Admin", "mời cán bộ ngân hàng …", "của ngân hàng <gạch dài> đúng ngược với thiết
  kế.", "Chi tiết trạng thái ví và xử lý sai mạng ở", ". Màu vàng của nút đặt ở". Chú thích được viết lại ở
  `header-wallet-button.tsx` (mục 2.4 ý 2). Không chuỗi giao diện nào mất: "Kết nối ví", "Chuyển sang Light mode", "Chuyển sang
  Dark mode", "Mở menu" vẫn có.
- 6f: dòng đầu đúng một dòng `label: 'Hardhat Local',`; dòng hai rỗng.

---

## 7. Ba luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi (task không chạm `lib/`).
- [x] Mọi ký qua ISigner: không đổi; nút ví vẫn chỉ mở hộp thoại RainbowKit.
- [x] Mọi kiểm quyền qua RBAC: không đổi; thanh đầu không đọc vai.
