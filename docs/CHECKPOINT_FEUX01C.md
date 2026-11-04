# Báo cáo bàn giao: FE-UX-01c Chuyển động nhẹ bằng CSS và nền trôi

| | |
|---|---|
| Mã task | FE-UX-01c |
| Phạm vi | **Frontend thuần.** Không `lib/`, không gói npm mới, không JS chuyển động; không đổi bố cục, câu chữ, logic, số lời gọi máy chủ |
| Nhánh | `feat/fe-ux-01c-chuyen-dong`, tạo từ `release/ui-v2` (`5e381bd`, sau merge PR #85 FE-UX-01b) |
| Spec | `docs/fe-ux-01c-chuyen-dong/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `e9c3a96`; mã `79ac7d2`; e2e `8e1f045`, dọn dữ liệu ca 4 `1ca3bec`; tài liệu: commit cuối trên nhánh |
| Tiến độ | Xong. PR base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Nền trôi đúng QĐ-3 ở mọi màn có khung, Sáng và Tối; không che, không chặn bấm; không màu cứng | ✅ | mục 1.2 (ca 1), 2.2, 5 |
| 2 | Vào trang chạy `rise` một lần mỗi lần đổi màn; thanh bên giữ thu gọn; nền không giật; kết quả kiểm `key` | ✅ | mục 1.2 (ca 2), 4 |
| 3 | Rê chuột đúng QĐ-5 (nút chính, biểu tượng menu, nút theme); nút khoá không nhấc | ✅ | mục 1.2 (ca 3), 2.3 |
| 4 | Đường chân trời và vòng sáng số việc chờ khác 0 đúng QĐ-6 (chỉ `translate`, `scale`, `opacity`); số 0 đứng yên | ✅ | mục 1.2 (ca 4), 2.3 |
| 5 | Giảm chuyển động: không animation, transition; quầng không `will-change`; nội dung hiện ngay | ✅ | mục 1.2 (ca 5), 2.1 |
| 6 | Utility `lift`, `nudge-x` có trong `globals.css`, chưa áp vào màn nào | ✅ | mục 2.1 |
| 7 | Action không đổi 28 đường dẫn; JS, CSS trong trần; CPU đứng yên trung vị dưới 3%; hydrate, lỗi console 0 | ✅ | mục 3 |
| 8 | `fe-ux-01c-chuyen-dong.spec.ts` đủ 5 ca design mục 4, xanh | ✅ | mục 1.2 |
| 9 | Kiểm thử đúng mục 5, kèm log; e2e mock 3 lần liên tiếp không ca nào chập chờn | ✅ | mục 1.1 |
| 10 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 7) rỗng | ✅ | mục 5 |
| 11 | Không mã dư thừa: không keyframes, utility, biến ngoài QĐ; không gói npm mới | ✅ | mục 2.1, 5 |
| 12 | Checkpoint ghi phạm vi, tệp, số đo trước và sau, kết quả QĐ-4; quay màn hình (Sáng, Tối) gửi kèm | ✅ | đầu tệp, mục 3, 4, 6 |

**Kết luận:** 12 ✅, 0 🔶, 0 ❌. Lớp chuyển động chỉ bằng CSS chạy ở mọi màn có khung, tắt hết khi bật giảm
chuyển động; CPU đứng yên 0,16% (`/`) và 0,10% (`/portfolio`); JS tăng dưới 0,4 KB mỗi trang, CSS tăng 1,4 KB. Mức
rủi ro: thấp.

UserGuide: Phần 3 mục 3.0 thêm đoạn "Chuyển động" (gồm cách tắt bằng thiết lập giảm chuyển động của hệ điều
hành); "Chốt tại"; Lịch sử.

### 0.2 Việc cần Owner quyết

- **Ca 4 lập thêm yêu cầu làm spec cũ đổi kết quả (design mục 4 dặn "dừng và báo"):** bản đầu của ca 4 để lại một
  yêu cầu tạo token đang chờ duyệt; e2e đầy đủ hai lần đều đỏ đúng một ca cũ `investor-channel.spec.ts:241` (kiểm
  số việc chờ của Giao dịch viên là `0`, nhận `1`). Không sửa spec cũ. Đề xuất đã làm và kiểm (mục 6): cuối ca 4,
  Kiểm soát viên **từ chối** yêu cầu vừa lập (yêu cầu bị từ chối không còn tính là việc chờ), rồi kiểm số việc chờ
  về `0` và vòng sáng tắt. Sau đó e2e đầy đủ 3 lần liên tiếp đều xanh. Supervisor xác nhận cách này, hoặc chọn
  cách khác (ví dụ chuyển ca 4 sang tệp chạy cuối).

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1478 passed | 74 skipped (1552)   # như mốc
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  => ĐẠT các phần đã chạy: arch markers checkpoint app build

$ (cd app && npx playwright test)     # project mock đầy đủ, 3 lần liên tiếp, máy chủ mới mỗi lần
  lần 1: 107 passed (2.9m)
  lần 2: 107 passed (2.7m)
  lần 3: 107 passed (2.7m)              # 102 ca cũ + 5 ca mới; 0 ca chập chờn, 0 lần thử lại
```

Log gửi kèm: `20261104_feux01c_run_local_all.log`, `20261104_feux01c_e2e_mock_lan1.log`, `lan2`, `lan3`. Không
chạy `contracts`, `evm`, e2e Hardhat (theo mục 5: không đổi chain hay luồng tiền).

### 1.2 e2e mới `app/e2e/fe-ux-01c-chuyen-dong.spec.ts` (project mock, 1440 px, vai Giao dịch viên)

| Ca | Kiểm | Kết quả |
|---|---|---|
| 1 | `[data-bgfx]` có `aria-hidden="true"`, `position: fixed`, `pointer-events: none`, 3 con; con đầu `animation-name` `drift`, giao khung nhìn; nền gốc khung (cha `aside`) và `html` là `rgba(0, 0, 0, 0)`; liên kết dạng nút "Phát hành WPT" trong `main` bấm được (`click({ trial: true })`); gắn dấu vào `[data-bgfx]`, đổi màn bằng menu "Lập lệnh": vẫn đúng phần tử có dấu | ✅ |
| 2 | Thanh bên thu gọn (`bidv-rail=1`); bộ nghe `animationstart` (pha capture) gắn trước khi bấm; đánh dấu `[data-page-enter]` cũ. `/` sang `/draft` rồi `/draft` sang `/transactions` bằng menu: mỗi lần đúng MỘT sự kiện `rise` từ `[data-page-enter]`; phần tử cũ không còn (DOM đã thay); `animation-iteration-count` `1`, `animation-duration` `0.5s`; `opacity` về `1`, `transform` về `none`; `aside` vẫn `data-rail="collapsed"` | ✅ |
| 3 | `/draft` sau khi điền thẻ tạo token để nút "Gửi yêu cầu tạo token" (Button mặc định) mở: trước khi rê `::after` `translate` x âm; rê: `translate` của nút khác `none`, `::after` x dương. Rời chuột rồi gắn `aria-disabled="true"`, rê, chờ 800 ms: `translate` `none`, `::after` x âm. Rê mục menu "Giao dịch": vòng biểu tượng `rotate` khác `none`. Rê nút Sáng Tối: `rotate` khác `none` | ✅ |
| 4 | `[data-horizon]::after` `animation-name` `horizon`, `animation-iteration-count` `infinite`. Viên số việc chờ chữ `0`: không `data-beacon`, `::after` `animation-name` `none`. Lập một yêu cầu tạo token (bước chép maker-checker ca 1 đến 3): viên của "Lập lệnh" khác `0`, có `data-beacon`, `::after` `animation-name` `beacon`. Dọn dữ liệu: Kiểm soát viên từ chối yêu cầu đó (thấy thông báo "Đã từ chối yêu cầu"), viên về `0`, không còn `data-beacon` (mục 0.2) | ✅ |
| 5 | Context `reducedMotion: 'reduce'`, ở `/` và `/draft`: quầng đầu, `[data-page-enter]`, `[data-horizon]::after` `animation-name` `none`; quầng đầu `will-change` `auto`; `[data-page-enter]` `opacity` `1` ngay sau khi tải; Button mặc định `transition-duration` `0s` | ✅ |

Thứ tự trong tệp: 1, 2, 3, 5, 4 (ca 4 lập dữ liệu nên đặt cuối).

## 2. Thay đổi

### 2.1 `app/src/app/globals.css`

- `@theme inline`: `--ease-wind: cubic-bezier(.16, 1, .3, 1)`, `--ease-spring: cubic-bezier(.34, 1.4, .64, 1)` (lớp
  `ease-wind`, `ease-spring`; biến `--ease-wind` có trong CSS xuất ra vì `[data-page-enter]` dùng `var()`).
- `@keyframes drift` (transform), `rise` (chỉ `from`: opacity 0, translateY 12 px), `horizon` (`translate: -50% 0`),
  `beacon` (`scale` 1 lên 1,6, `opacity` 0,55 về 0).
- `@utility lift`, `@utility nudge-x` (hover bọc `@media (hover: hover)`); chưa áp vào màn nào nên Tailwind chưa sinh
  CSS cho hai lớp này (kiểm trong CSS xuất ra: không có `.lift`, `.nudge-x`).
- `[data-page-enter] { animation: rise .5s var(--ease-wind) backwards; }`.
- `@media (prefers-reduced-motion: reduce)`: `*, *::before, *::after { animation: none !important; transition: none
  !important; }` và `[data-bgfx] > * { will-change: auto !important; }`.

### 2.2 Nền trôi

- `app/src/components/motion/background-fx.tsx` (mới, không `"use client"`): `div[data-bgfx]` `aria-hidden`,
  `pointer-events-none fixed inset-0 -z-10 overflow-hidden`, ba `<i>` `absolute rounded-full will-change-transform
  opacity-50 dark:opacity-28`:
  - Quầng 1: 620 px, phải -160 px, trên -260 px, `--chart-3` 45%, 26 s. Chọn `--chart-3` (xanh ngọc sáng: Sáng
    `#1e8886`, Tối `#7cc7c6`) vì design cho "`--chart-2` hoặc tông xanh ngọc sáng" mà `--chart-2` là vàng, trùng
    quầng 2.
  - Quầng 2: 520 px, trái 18%, dưới -320 px, `--accent` 38%, 32 s.
  - Quầng 3: 420 px, trái -160 px, trên 30%, `--primary` 18%, 38 s.
  - Mỗi quầng `radial-gradient(circle, color-mix(in oklab, var(--token) X%, transparent), transparent 65%)`, không
    `filter`; `animate-[drift_Ns_ease-in-out_infinite_alternate]`. Dưới 1100 px cỡ và độ lệch nhân 0,6.
- `app/src/app/layout.tsx`: thêm `import` và `<BackgroundFx />` trong `body`, trước `ConfigProvider` (bọc `Providers`).
- `app-layout.tsx`: gốc khung bỏ `bg-background` (thêm một dòng chú thích).

### 2.3 Khung và `Button` (chỉ lớp, thuộc tính, phần tử bọc; không đổi hook, state, handler, điều kiện)

| Tệp | Đoạn đổi |
|---|---|
| `header.tsx` | Trong `header`: thêm `span[data-horizon]` `aria-hidden` (`pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full opacity-70`), `after:` rộng 200%, gradient lặp hai chu kỳ `--primary`, `--accent`, `animate-[horizon_8s_linear_infinite]` |
| `header.tsx` | Nút Sáng Tối: `transition-colors` thành `transition-[rotate,background-color,color] duration-300 ease-spring hover:-rotate-12` |
| `header.tsx` | `ShellMain`: bọc `children` trong `<div data-page-enter>`; KHÔNG `key` (mục 4). Sửa chú thích "(QĐ-4)" thành "(FE-UX-01b QĐ-4)" cho rõ nguồn |
| `sidebar.tsx` | `NavLink` `Link`: thêm lớp `group` |
| `sidebar.tsx` | Vòng biểu tượng: thêm `transition-[rotate,scale] duration-500 ease-spring group-hover:-rotate-10 group-hover:scale-112` |
| `sidebar.tsx` | Viên số việc chờ: thêm `data-beacon` khi khác 0; khi khác 0 thêm `relative isolate after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-full after:bg-accent after:animate-[beacon_2.4s_ease-out_infinite]` (khi thu gọn lớp `absolute` đứng sau nên vẫn là `absolute`). `aria-label`, chữ số giữ nguyên |
| `button.tsx` | Biến thể `default`: thêm `relative overflow-hidden not-disabled:not-aria-disabled:hover:-translate-y-px` và giả phần tử `after:` quét sáng (`after:-translate-x-[120%]`, gradient `--primary-foreground` 35%, `after:transition-[translate] after:duration-700 after:ease-wind`, `not-disabled:not-aria-disabled:hover:after:translate-x-[120%]`). Giữ `transition-all` của lớp gốc |

## 3. Đo trước và sau

Cùng máy, cùng phiên. Mốc: `release/ui-v2` @ `5e381bd` (sau #85). CPU đo trên máy chủ mới khởi động, chưa tạo dữ
liệu; số action, JS đo sau khi tạo dữ liệu bằng 3 tệp e2e (maker-checker, ops-transactions, permit-order). Hai
script ở ngoài repo, sha256 khớp spec.

| Mục | Mốc | Sau | Trần |
|---|---|---|---|
| CPU đứng yên `/` (teller), 3 lượt x 5 s | 0,02; 0,01; 0,00. Trung vị **0,01%** | 0,16; 0,13; 0,17. Trung vị **0,16%** | 3% |
| CPU đứng yên `/portfolio` (investor) | 0,02; 0,01; 0,00. Trung vị **0,01%** | 0,11; 0,10; 0,09. Trung vị **0,10%** | 3% |
| Số action khi mở màn | 28 đường dẫn | Khớp từng dòng 28/28 | không đổi |
| Cảnh báo hydrate | 0 | 0 | 0 |
| JS gzip `/` | 554,0 KB | 554,3 KB (+0,3) | +1 KB |
| JS gzip `/approvals` | 452,8 KB | 453,1 KB (+0,3) | +1 KB |
| JS gzip `/portfolio` | 455,6 KB | 455,9 KB (+0,3) | +1 KB |
| JS gzip `/trade` | 478,0 KB | 478,4 KB (+0,4) | +1 KB |
| CSS gzip toàn ứng dụng (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 16.324 B | 17.766 B (+1.442 B) | +3 KB |

Lỗi console: ca 1 của `fe-ux-01b-khung.spec.ts` (thu mọi lỗi console, lỗi trang ở `/` qua lần mở và tải lại) xanh
trong cả 3 lần e2e; script dò ở `/`, `/draft`, `/config`, `/vault`, `/demo-payment`, `/wallet-binding`, `/mint`: 0 lỗi.

## 4. Kết quả kiểm `key` (QĐ-4)

| Cặp | Cách | Sự kiện `rise` mới từ `[data-page-enter]` | DOM vùng nội dung | `key` |
|---|---|---|---|---|
| `/` sang `/draft` (teller, thu gọn) | e2e ca 2 | 1 | thay (phần tử đánh dấu không còn) | không cần |
| `/draft` sang `/transactions` (teller, thu gọn) | e2e ca 2 | 1 | thay | không cần |
| `/portfolio` sang `/trade` (investor) | script thử tay, bấm menu | 1 | thay | không cần |

Kết luận: mỗi trang tự gọi `AppLayout` nên đổi màn dựng lại khung, `rise` chạy đúng một lần; không thêm `key`.
Nền trôi đặt ở layout gốc nên giữ nguyên phần tử khi đổi màn (ca 1), không chạy lại từ đầu.

## 5. Lệnh kiểm (tasks bước 7)

```text
$ git diff --name-only origin/release/ui-v2...HEAD | grep -vE '^(...danh sách trắng...)$'
                                    # rỗng
$ rg -n '\b(bg|text|border|ring|fill|stroke|from|to|via)-(white|black|(slate|...|rose)-[0-9]{2,3})\b|#[0-9a-fA-F]{3,8}\b|rgba?\(' app/src/components/layout app/src/components/motion
                                    # rỗng
$ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e'
                                    # rỗng
```

Tệp đổi: `app/src/app/globals.css`, `app/src/app/layout.tsx`, `app/src/components/motion/background-fx.tsx` (mới),
`app/src/components/layout/{app-layout,header,sidebar}.tsx`, `app/src/components/ui/button.tsx`,
`app/e2e/fe-ux-01c-chuyen-dong.spec.ts` (mới), `docs/fe-ux-01c-chuyen-dong/*` (mới), `docs/CHECKPOINT_FEUX01C.md`
(mới), `docs/USER_GUIDE.md`, `.kiro/task-status.json` (`FE-UX-01c` từ `planned` sang `done`). Không đổi
`package.json`, `package-lock.json`, `app/test`, `lib/`, tệp màn, e2e cũ.

## 6. DEVIATION so với spec

- **Ca 4 dọn dữ liệu** (mục 0.2): thêm bước Kiểm soát viên từ chối yêu cầu vừa lập ở cuối ca 4, kiểm số việc chờ về
  `0`. Chỉ sửa tệp e2e mới.
- **Ca 3 dùng nút "Gửi yêu cầu tạo token" sau khi điền form:** mọi Button mặc định ở `/draft` (và `/config`,
  `/demo-payment`, `/wallet-binding`, `/mint`) đều khoá khi mới mở. Ca 3 điền thẻ tạo token (kèm bước KYC + whitelist
  ví SPV ở `/mint` như maker-checker) để có nút đang bật; ca 3 chỉ rê, không gửi.
- **Ca 1 "một nút trong `main` bấm được":** màn `/` không có `Button`; dùng liên kết dạng nút "Phát hành WPT" với
  `click({ trial: true })` (kiểm không bị phủ, không điều hướng).
- **Quầng 1 dùng `--chart-3`** (mục 2.2).

Ảnh động gửi kèm (không commit): `20261104_feux01c_chuyen_dong_light.mp4`, `..._dark.mp4` và bản `.gif`, mỗi bản
khoảng 20 s: đứng yên ở `/` (nền trôi, đường chân trời), rê mục menu, rê nút Sáng Tối, bấm "Lập lệnh" (vào màn),
điền form, rê nút chính hai lần (nhấc, quét sáng), về "Bảng điều khiển".

## 7. Câu hỏi mở

- Mục 0.2.
- Trong quá trình kiểm, một máy chủ e2e cũ (cổng 3100) còn chạy từ lần chạy bị dừng làm hai lần thử sai kết quả;
  đã tắt và chạy lại trên máy chủ mới, các log gửi kèm là của máy chủ mới.

## 8. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; luật kiến trúc PASS.
