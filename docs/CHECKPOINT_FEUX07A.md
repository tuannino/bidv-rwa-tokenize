# Báo cáo bàn giao: FE-UX-07a trang giới thiệu công khai, nút về đầu trang, lối vào từ thanh bên Nhà đầu tư

| | |
|---|---|
| Mã task | FE-UX-07a |
| Phạm vi | **Frontend**: nhóm route `(public)` và trang `/gioi-thieu`; `components/landing/*` (mới); `components/layout/intro-link.tsx` (mới) và một dòng chèn ở `sidebar.tsx`; biến thể logo `inline`, `compact`; token `--lp-deep`; 13 ảnh 3D tạm; `four-roles-routes.test.ts` theo QĐ-2; `investor-channel.spec.ts` một số đếm. Không `lib/**`, `app/actions/**`, `app/api/**`, `components/ui/**`; không gói npm mới |
| Nhánh | `feat/fe-ux-07a-gioi-thieu`, tạo từ `release/ui-v2` @ `29c5708` (đã gồm 05b, 05c, 06a, 06b, FIX-08). **Merge-base dùng để đo mốc: `29c5708`**. Không có PR nào merge vào `release/ui-v2` trong lúc làm (kiểm lại bằng `git fetch` trước khi mở PR) nên không phải rebase |
| Spec | `docs/fe-ux-07a-gioi-thieu/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec, task-status `bc79753`; liên kết thanh bên `8da02ec`; `(public)`, ảnh 3D, `--lp-deep`, logo `9503e29`; trang `0fe266b`; dời trang trí sang CSS module `88abbc4`; tách client khỏi module dùng chung `ce3e211`; UserGuide, unit `inert`, task-status `72cb1b6`; checkpoint bản đầu `d124638`; liên kết thanh bên kiểm vai qua RBAC (luật 3, theo quyết định chủ dự án) `908863e`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | `/gioi-thieu` đủ 8 khối đúng thứ tự bản chốt, không khối "Sơ đồ trang xem thử"; bảng khối bản chốt và phần dựng | ✅ | mục 3, 1.3 nhóm 3 |
| 2 | Trang công khai: không cần cookie vai, không thanh bên, không `ChannelGuard`; `four-roles-routes.test.ts` sửa đúng QĐ-2 và xanh | ✅ | mục 2.2, 1.2 ca 1, 1.3 nhóm 5 |
| 3 | Bốn câu chữ đổi đúng QĐ-5, câu khác nguyên văn bản chốt; không ký tự cấm | ✅ | mục 3, 6 (6c, 6d, 6e), 1.3 nhóm 1 |
| 4 | Nút vào khu vực đúng bảng QĐ-4 (unit nhóm 2, e2e ca 4 vào thật bốn khu vực) | ✅ | mục 1.2 ca 4, 1.3 nhóm 2 |
| 5 | Nút về đầu trang đúng QĐ-8 | ✅ | mục 1.2 ca 3, 5 |
| 6 | Thanh trên đúng QĐ-10: cùng mép khung ở 1440, 1280, 390 px; ẩn, hiện kể cả cuộn chậm 2 px | ✅ | mục 1.2 ca 2, 1.3 nhóm 2 |
| 7 | Liên kết "Giới thiệu dự án" đúng QĐ-9; `sidebar.tsx` chỉ thêm import và một dòng; ảnh thanh bên | ✅ | mục 2.1, 1.2 ca 6, 5 |
| 8 | Không mã màu trong tệp phạm vi; `globals.css` chỉ thêm `--lp-deep`; `bidv-logo.tsx` chỉ thêm `inline`, `compact` | ✅ | mục 2.1, 6 (6a, 6b), 1.3 nhóm 1, 4 |
| 9 | Mở `/gioi-thieu` 0 server action; số mẫu đọc từ hằng, có `UnverifiedNote`; video đúng QĐ-13 ở hai chế độ | ✅ | mục 1.2 ca 1, 5; 1.3 nhóm 3; 3.2 |
| 10 | JS, CSS, ảnh trong trần QĐ-15; `/gioi-thieu` 0 lỗi; đường dẫn khác không tăng lỗi | ✅ | mục 4 |
| 11 | Ảnh `/gioi-thieu` 1440, 1100, 390 Sáng Tối, ảnh nút về đầu trang; tiến trình mock mới, đủ `webServer.env` | ✅ | mục 5 |
| 12 | `fe-ux-07a-gioi-thieu.spec.ts` đủ 6 ca, `fe-ux-07a.test.ts` đủ 5 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 13 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh; lệnh bước 6 đúng kỳ vọng | ✅ | mục 1.1, 6 |
| 14 | Không mã dư thừa; không thêm gói npm | ✅ | mục 2.3 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. Đo trên bản build cuối `908863e` so mốc `29c5708`: action khớp 28/28; `hydration`,
`consoleErrors`, `pageErrors` 0 ở cả 28 đường dẫn, mốc lẫn sau. JS gzip mọi trang có khung -5 đến -41 B so bản build mốc riêng
(`/mint` -342 B; trần +256 B), cùng số tệp script; riêng chunk khung +569 B (liên kết và bảng quyền RBAC), bù bởi module
`next-themes` dời sang chunk khác nén tốt hơn (-653 B), mục 4.2. `/gioi-thieu` 397.331 B, `/account` 457.918 B. CSS dùng chung +1.195 B (trần 1.536 B), CSS riêng của trang 1.357 B (trần 4 KB),
ảnh 52.156 B (trần 60 KB). Bốn điểm gây lỗi của Supervisor đều làm unit đỏ (mục 1.3). Lệch số QĐ-12: ô "Lợi tức đã chia" 5,8 tỷ,
6 kỳ (theo `mock-data`, khớp `/assets`), khác 86,4 tỷ vẽ tay của bản chốt. Mức rủi ro: thấp (trang mới tách nhóm route;
thanh bên chỉ thêm một liên kết cho Nhà đầu tư; không đổi quyền, dữ liệu, action).

UserGuide: "Chốt tại"; Phần 2 mục 2.1, 2.2 (dòng `/gioi-thieu`); Phần 3 mục 3.0 (đáy thanh bên), 3.7 mới "Trang giới thiệu".
task-status: `FE-UX-07` thay bằng `FE-UX-07a`, `FE-UX-07b`; FE-UX-07a `done`. `docs/tech-report.md` không đổi (không marker nào
dời dòng: `scan-pending --write-report` không sinh khác biệt).

### 0.2 Việc cần Owner quyết

- Đã quyết trong lúc làm (chủ dự án, 06/11): dòng QĐ-9 `config.role === "INVESTOR"` trượt luật 3 kiến trúc (cấm so sánh vai cứng
  ngoài `lib/rbac`, CI job A chạy luật này). Chọn kiểm qua RBAC: `IntroLink` tự hiện khi `can()` qua cổng `AREA_GATES.investor`;
  `sidebar.tsx` vẫn đúng hai dòng thêm. DEVIATION 9 (mục 2.4). Điểm gây lỗi thứ nhất của Supervisor đổi theo (mục 1.3).
- Lưu ý cho FE-UX-07b: biến thể logo `compact` đã có (unit nhóm 4), chưa dùng ở đâu.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-07a` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), Postgres bật, trên
HEAD `908863e`, 17:17:57Z đến 17:29:42Z (06/11/2026, UTC).

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  PASS: 20   FAIL: 0   WARN: 3          (luật kiến trúc; 3 cảnh báo có từ trước, không thuộc tệp của task)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
  => PASS: LỚP 3 - KHUÔN CHECKPOINT     (FE-UX-07a, mục 0: 36/60 dòng, 14 dòng / 14 điều kiện)
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT                   (1 cảnh báo có từ trước ở test/helpers/fake-fireblocks.ts)
 Test Files  90 passed | 11 skipped (101)
      Tests  1811 passed | 74 skipped (1885)
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  169 passed (7.9m)
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
  26 passed (43.0s)
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Lần chạy đầu trên HEAD `d124638` (16:22:14Z đến 16:34:32Z): mọi phần đạt (vitest 1810, e2e 169, Hardhat 26) trừ luật kiến trúc
FAIL ở dòng QĐ-9 của `sidebar.tsx` (so sánh vai cứng). Sửa ở `908863e` (mục 0.2), chạy lại toàn bộ như trên. Log đầy đủ (dòng khoá
ký Hardhat #0 trong env máy chủ cục bộ đã che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết gửi kèm, không commit.

### 1.2 E2E `fe-ux-07a-gioi-thieu.spec.ts` (project mock, 6 ca)

Chạy trên bản build cuối `908863e`: 6 ca đạt; dòng log ca 5:
`FE-UX-07a JS gzip: /gioi-thieu 397331 B, /account 457918 B`. Cùng lượt: `investor-channel` (số liên kết 8), `fe-ux-01b-khung`,
`fix-08-thanh-ben`, `uiux-02-dau-man` đạt, tổng 44 ca. Bộ đầy đủ ở mục 1.1 cũng chạy cả 6 ca.

| Ca | Kiểm | Kết quả |
|---|---|---|
| 1 | Ngữ cảnh không cookie: 200, một `h1` chữ MỚI, không `#app-sidebar`, không `[data-page-enter]`, 0 POST `next-action`, 0 lỗi console, `pageerror`, hydrate | Đạt |
| 2 | Mép thanh trên lệch khung nội dung không quá 1 px ở 1440, 1280, 390; bấm "Dự án" thì đỉnh `#du-an` dưới đáy thanh; 450 lần cuộn 2 px thì thanh `opacity` 0; 20 lần cuộn lên 2 px thì hiện lại | Đạt |
| 3 | Đầu trang: `opacity` 0, có `inert`, Tab qua toàn trang không vào nút; quá 80%: hết `inert`, `opacity` 0,5 đến 0,7, rê chuột 1; 1440: cách mép phải khung từ 8 px, cách mép cửa sổ từ 12 px; 390: đỉnh 84 px; bấm: `scrollY` về 0, tiêu điểm ở logo | Đạt |
| 4 | Sáu nút, mỗi nút một ngữ cảnh mới: đúng trang đích, đúng `bidv_channel`, `bidv_role` | Đạt |
| 5 | 1440, 1100, 390 Sáng Tối: không cuộn ngang, 0 lỗi; video thường có `iframe`; giảm chuyển động 0 yêu cầu YouTube trong 2 giây, không `iframe`, bấm nút phát thì có; JS trang không vượt `/account` | Đạt |
| 6 | Nhà đầu tư: một liên kết trong `aside`, không trong `aside nav`, trên ô chain; bấm tới trang; thu gọn còn tên, rộng không quá 64 px; 390 ngăn kéo bấm tới trang; ba vai khác 0 liên kết | Đạt |

### 1.3 Unit `fe-ux-07a.test.ts` (5 nhóm, 24 ca) và gây lỗi có chủ đích

Nhóm 1 mã nguồn (8 ca), nhóm 2 `LANDING_ROLES`, `landingChromeState` ca (a) đến (f) (6 ca), nhóm 3 dựng `LandingPage`
(5 ca), nhóm 4 `BidvLogo` (3 ca), nhóm 5 nhóm route (2 ca). Nhóm 4: HTML `full`, `icon` so bằng sha256 của chuỗi dựng trên
bản mốc `29c5708` (hằng trong test), không chép chuỗi 16.515 ký tự. `four-roles-routes.test.ts` 25 ca đạt.

Bốn điểm gây lỗi của Supervisor, mỗi điểm sửa rồi trả lại bằng `git checkout`, chạy `fe-ux-07a` cùng `four-roles-routes`:

| Điểm | Ca đỏ |
|---|---|
| Điều kiện hiện liên kết đảo ngược. Sau DEVIATION 9 điều kiện là `can()` ở `intro-link.tsx`; đột biến tương đương: bỏ dấu `!` của `if (!AREA_GATES.investor.some(...)) return null` (trước khi đổi, đột biến nguyên văn `!== "INVESTOR"` ở `sidebar.tsx` cũng làm đỏ 1 ca) | 1 (nhóm 1, `intro-link.tsx`); e2e ca 6 kiểm ba vai khác 0 liên kết |
| "Vào khu người bán" đổi khu vực thành `investor` | 1 (nhóm 2, bảng QĐ-4) |
| Bỏ `inert` của nút về đầu trang | 1 (nhóm 1, `landing-chrome.tsx`); e2e ca 3 cũng kiểm thuộc tính này |
| Thêm `ChannelGuard` vào `(public)/layout.tsx` | 2 (nhóm 1 và `four-roles-routes` ca layout không cổng) |

---

## 2. Thay đổi

### 2.1 Tệp có sẵn

- `sidebar.tsx`: `--numstat` 2 thêm, 0 xoá: `import { IntroLink } from "./intro-link";` và dòng
  `<IntroLink collapsed={collapsed} onNavigate={closeDrawer} />` là phần tử đầu của khối đáy, ngay trên `CustodyToggle` (vai Nhà
  đầu tư không có công tắc này) và `ChainSelector`. Điều kiện chỉ Nhà đầu tư nằm trong `intro-link.tsx` (DEVIATION 9).
- `globals.css`: 3 thêm, 0 xoá trong `:root`: dòng trống, chú thích một dòng, `--lp-deep: #115d5c;`. Không khai báo trong `.dark`.
- `bidv-logo.tsx`: thêm hàm `Wordmark` (hình chữ và bông mai, tuỳ chọn khai báo `<symbol>`), hai nhánh `inline`, `compact`, kiểu
  `variant` thêm hai giá trị. Thân hai nhánh `icon`, `full` giữ nguyên từng ký tự; HTML dựng giống hệt mốc (unit nhóm 4).
- `four-roles-routes.test.ts` (diff dưới): hằng `PUBLIC_DIR`; phép kiểm tập nhóm cộng đúng `(public)`; thêm `describe` ba ca.
- `investor-channel.spec.ts:205-206`: chú thích và số liên kết 7 thành 8.

```diff
@@ const AREA_DIR
+/** FE-UX-07a QĐ-2: nhóm route công khai duy nhất (trang giới thiệu), không thuộc khu vực nào. */
+const PUBLIC_DIR = '(public)';
@@ it('khu vực của vai trò Kiểm toán cũ đã gỡ'
-    expect(groups.sort()).toEqual(AREAS.map((area) => AREA_DIR[area]).sort());
+    // FE-UX-07a QĐ-2: cộng đúng một nhóm công khai `(public)`.
+    expect(groups.sort()).toEqual([...AREAS.map((area) => AREA_DIR[area]), PUBLIC_DIR].sort());
+describe('FE-UX-07a: nhóm công khai chỉ chứa trang giới thiệu', () => {
+  it('các trang trong (public) đúng bằng /gioi-thieu'           routesIn(PUBLIC_DIR) bằng ['/gioi-thieu']
+  it('layout của (public) không gắn cổng nào'                  không ChannelGuard, không AREA_GATES
+  it('không đường dẫn nào của (public) trùng ... có cổng'       không nằm trong ALL_ROUTES
```

### 2.2 Tệp mới

- `app/(public)/layout.tsx` (trả `children`, chú thích nhóm công khai), `app/(public)/gioi-thieu/page.tsx` (`metadata` QĐ-1).
- `components/landing/`: `landing-page.tsx` (server, 8 khối), `landing-chrome.tsx` (client, thanh trên, nút về đầu trang),
  `hero-video.tsx` (client, QĐ-13), `turbine-scene.tsx` (server, `scene()` của `ui.js:119-139`), `enter-channel-form.tsx`,
  `landing-data.ts` (`LANDING_VIDEO_ID`, `LANDING_ROLES`, `landingChromeState`), `landing.module.css`.
- `components/layout/intro-link.tsx`; `public/landing/3d/` 13 tệp `.webp` và `LICENSE.txt` chép nguyên từ bản chốt.

### 2.3 Không mã dư thừa

`npx eslint .` 0 lỗi (một cảnh báo có từ trước ở `test/helpers/fake-fireblocks.ts`); `npx tsc --noEmit` sạch. Không hằng, hàm,
import, lớp không dùng: lớp `group` thừa ở nút phát đã gỡ khi dời hiệu ứng sang CSS module. Không thêm gói npm.

### 2.4 DEVIATION

1. **`enter-channel-form.tsx` không có `'use client'`.** Design xếp tệp này vào nhóm client. Không cần: form gọi server action dùng
   được ở Server Component; sau mục 4 chỉ còn `landing-page.tsx` (server) dùng. Hành vi kiểm bằng e2e ca 4.
2. **Prop `LandingChrome` là `enter` (form "Vào hệ thống" dựng ở server) và `toTopIcon`, thay `enterIcon` và nhập `ArrowUp`.**
   Lý do QĐ-15: khi phần client của trang nhập `lucide-react`, `cva` (`buttonVariants`), `cn` hoặc server action, Turbopack tách
   thêm chunk dùng chung và JS gzip MỌI trang có khung tăng 975 đến 1.032 B dù không thêm mã (đo ở mục 4.2). Nút "Vào hệ thống"
   dùng lớp viết thẳng (nền chính, chữ trắng), không có vệt sáng quét ngang của `Button`.
3. **Một số lớp trong design dời sang `landing.module.css` với giá trị tương đương**: kính mờ và trạng thái ẩn của thanh trên
   (`bg-card/75`, `backdrop-blur-md`), nút về đầu trang (`bg-card/40`, `ring-border/60`, hai trạng thái), viền 8 px và bóng của bong
   bóng năm chặng, đường ray và chữ chân trang gradient (`from-primary to-accent`), phóng to nút phát. Lý do: CSS dùng chung lúc đầu
   +1.763 B (trần 1.536 B); sau khi dời +1.195 B. Đường cong lò xo viết thẳng `cubic-bezier(.34, 1.4, .64, 1)` vì `--ease-spring`
   ở `@theme inline` không có biến CSS lúc chạy.
4. **Chấm chạy năm chặng dịch bằng `translate`** của một lớp rộng bằng đường ray (chỉ `translate`, `opacity`, theo quy tắc chuyển
   động của FE-UX-01c), thay `left` của bản chốt; đường ray `overflow-x: clip` để lớp dịch không làm trang cuộn ngang (e2e ca 5
   bắt lỗi này ở bản đầu: tràn 521 px).
5. **Thanh trên đang ẩn hiện lại khi Tab vào** (để tiêu điểm không nằm ngoài màn hình). Bản chốt không có; không đổi hành vi chuột.
6. **Ô số liệu**: giá trị 23 px không xuống dòng (bản chốt `.stats .kpi`) đặt bằng lớp `[&>p]` ở nơi dùng, không sửa `Kpi`.
7. **Nhãn góc thẻ dự án đặt ngoài khối ảnh** (vẫn nằm trên ảnh): utility `tile-hl` đặt lại `--foreground` thành trắng cho mọi phần
   tử con, `Badge` `outline` đặt trong khối ảnh sẽ chữ trắng trên nền trắng.
8. **Sóng biển trong cảnh tua-bin đứng yên** (bản chốt `c.css:590` có `sea`; design mục 2 không liệt kê keyframes này).
9. **Điều kiện "chỉ Nhà đầu tư" không viết `config.role === "INVESTOR"` ở `sidebar.tsx`** (QĐ-9): dòng đó trượt luật 3 của
   `scripts/verify-arch-rules.sh` (cấm so sánh vai cứng ngoài `lib/rbac`). Theo quyết định chủ dự án (mục 0.2): `intro-link.tsx`
   thêm `"use client"`, đọc `usePublicConfig()` và `return null` khi vai không qua cổng `AREA_GATES.investor` bằng `can()`; chỉ
   INVESTOR qua cổng này (`four-roles-routes.test.ts` khoá `EXPECTED_ACCESS.investor`). `sidebar.tsx` chèn `<IntroLink ... />`
   không điều kiện. Hành vi không đổi (e2e ca 6, `investor-channel`). Bảng quyền `can()` nay nằm trong chunk khung (mục 4.2).

---

## 3. Khối bản chốt và phần dựng

### 3.1 Bảng khối (thứ tự DOM, dòng ở `docs/prototypes/20261101_ui_ux_ban_chot/index.html`)

| # | Khối bản chốt | Phần dựng | Chữ đổi so bản chốt |
|---|---|---|---|
| 1 | Thanh trên `.lp-nav` (159-166) | `LandingChrome`: `header` cố định, viên nang, logo `BidvLogo variant="inline"`, `nav` bốn neo (từ 760 px), nút Sáng Tối, form "Vào hệ thống" | Không. Rộng `min(1200px, 100% - 48px)` thay `100% - 28px` (QĐ-10); ẩn, hiện theo `landingChromeState` |
| 2 | Màn đầu `.hero` (169-183) | `section` utility `tile-hl`, cảnh `TurbineScene` 9 tua-bin, `h1`, câu dẫn, `HeroVideo`, nút "Khám phá dự án" và form "Tôi là nhà đầu tư", gợi ý cuộn | `h1` MỚI (QĐ-5) |
| 3 | Sáu ô `.stats` (185-194) | Sáu `Kpi` sắc `hl`, `leaf`, `default`, `leaf`, `gold`, `au`, nhãn kèm `UnverifiedNote` | Số đọc từ hằng; "Lợi tức đã chia" 5,8 tỷ, 6 kỳ (QĐ-12) |
| 4 | `#cach-hoat-dong` (196-208) | Tiêu đề khối, đường ray, ba chấm chạy, năm chặng ảnh 3D | Chặng "Gió", "Doanh thu" MỚI (QĐ-5) |
| 5 | `#du-an` (210-219) | Ba `article` theo `MOCK_PROJECTS`, không là liên kết (QĐ-4) | Câu phụ MỚI (QĐ-5); dòng phụ thẻ theo `mock-data` (design khối 5) |
| 6 | `#vai-tro` (221-231) | Bốn `EnterChannelForm` theo `LANDING_ROLES`, bấm cả thẻ | Không |
| 7 | `#minh-bach` (233-243) | Bốn `Card` ảnh 3D | Không |
| 8 | Khối kết (245-254) và `footer.lp-foot` (275-280) | Khối `tile-hl` với hai form ("Vào Bảng điều khiển", "Vào khu nhà đầu tư"); chân trang chữ lớn gradient và hai câu | Không |
| Bỏ | "Sơ đồ trang xem thử" (256-272), câu cho trình xem artifact (297), `lenis` (281) | Không dựng (unit nhóm 1 khoá) | |

### 3.2 Số liệu, video

QĐ-12: sáu ô và hai thẻ dự án mẫu kèm "unverified"; ô "Lợi tức mục tiêu" có `title` "Hằng mặc định, chưa đọc cấu hình đang
hiệu lực". Số lấy từ `MOCK_PROJECTS`, `MOCK_WIND_STATS`, `WPT_ANNUAL_YIELD_PERCENT`, không chép lại số. Lệch bản chốt: "Lợi tức đã
chia" 5,8 tỷ, "VND, 6 kỳ" (bản chốt 86,4 tỷ); dòng phụ thẻ dự án theo `REGION_LABELS`, `PROJECT_STATUS_LABELS` ("Gần bờ, Đang phát
điện"; "Trên bờ, Ven biển, Đang phát điện"; "Trên bờ, Ven biển, Bảo trì"). QĐ-13: HTML máy chủ không có `iframe` (unit nhóm 3);
`useSyncExternalStore` với `getServerSnapshot` trả "giảm chuyển động"; e2e ca 5 đếm yêu cầu tới YouTube trong trình xử lý route.

---

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo). Mốc: bản build `29c5708`, sau: bản build `908863e`. Mỗi lượt đo một tiến trình
`next start` MỚI với đủ biến `webServer.env`, tạo dữ liệu bằng `E2E_BASE_URL=… npx playwright test e2e/ops-transactions.spec.ts`
(2 ca đạt mọi lượt), rồi `tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp spec) với
`JS_PAGES=/,/portfolio,/seller,/approvals,/account`; 28 dòng mỗi lượt, không dòng `khong tim thay lien ket`. Tiến trình đo khác
tiến trình chụp ảnh.

### 4.1 Tổng hợp

| Mục | Mốc `29c5708` | Sau `908863e` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` | 0 ở cả 28 | 0 ở cả 28 | không tăng |
| JS gzip (công cụ) `/`; `/portfolio`; `/seller`; `/approvals`; `/account` | 558,3; 456,9; 457,1; 455,3; 447,2 KB | 558,3; 456,9; 457,1; 455,3; 447,2 KB | mục 4.2 |
| JS gzip `/gioi-thieu` (e2e ca 5) | 404 khi chưa có trang | 397.331 B, `/account` 457.918 B | không vượt `/account` |
| CSS dùng chung gzip (`.next/static/chunks/*.css`, gzip mức 9) | 19.111 B | 20.306 B (+1.195) | +1.536 B |
| CSS riêng `/gioi-thieu` (module) gzip | | 1.357 B | 4.096 B |
| Ảnh `public/landing/3d/*.webp` | | 52.156 B | 61.440 B |

### 4.2 JS theo byte (cộng gzip mọi script khi mở, 1440 Sáng)

Mốc lượt đầu; mốc build riêng (build lại `29c5708` sau bản cuối trong `git worktree` ở thư mục tạm ngoài repo, `node_modules` liên
kết cứng, đã xoá; CSS bản này 19.111 B như mốc); sau; chênh so mốc build riêng; số tệp script mốc riêng / sau.

| Trang | Mốc | Mốc build riêng | Sau | Chênh | Tệp |
|---|---|---|---|---|---|
| `/` | 571.739 | 571.738 | 571.716 | -22 | 20 / 20 |
| `/draft` | 470.919 | 470.922 | 470.902 | -20 | 19 / 19 |
| `/transactions` | 552.396 | 552.398 | 552.376 | -22 | 20 / 20 |
| `/distribution` | 479.691 | 479.691 | 479.668 | -23 | 20 / 20 |
| `/vault` | 469.657 | 469.661 | 469.641 | -20 | 19 / 19 |
| `/recall` | 482.126 | 482.126 | 482.104 | -22 | 20 / 20 |
| `/config` | 477.513 | 477.514 | 477.487 | -27 | 20 / 20 |
| `/wallet-binding` | 463.009 | 463.001 | 462.991 | -10 | 19 / 19 |
| `/demo-payment` | 463.665 | 463.666 | 463.653 | -13 | 19 / 19 |
| `/mint` | 465.143 | 465.145 | 464.803 | -342 | 19 / 19 |
| `/assets` | 487.594 | 487.593 | 487.577 | -16 | 21 / 21 |
| `/kyc` | 462.575 | 462.574 | 462.555 | -19 | 19 / 19 |
| `/audit` | 456.650 | 456.649 | 456.644 | -5 | 19 / 19 |
| `/reconciliation` | 463.591 | 463.590 | 463.572 | -18 | 19 / 19 |
| `/transactions/[id]` | 462.705 | 462.706 | 462.688 | -18 | 19 / 19 |
| `/approvals` | 466.200 | 466.200 | 466.178 | -22 | 19 / 19 |
| `/approvals/[id]` | 466.541 | 466.540 | 466.517 | -23 | 19 / 19 |
| `/portfolio` | 467.889 | 467.886 | 467.869 | -17 | 19 / 19 |
| `/trade` | 491.580 | 491.576 | 491.556 | -20 | 20 / 20 |
| `/orders` | 549.497 | 549.496 | 549.481 | -15 | 20 / 20 |
| `/orders/[id]` | 463.444 | 463.443 | 463.424 | -19 | 19 / 19 |
| `/withdraw` | 485.826 | 485.824 | 485.802 | -22 | 20 / 20 |
| `/tokens/WPT` | 463.114 | 463.112 | 463.095 | -17 | 19 / 19 |
| `/wallet` | 467.023 | 467.022 | 467.000 | -22 | 19 / 19 |
| `/account` | 457.937 | 457.938 | 457.918 | -20 | 19 / 19 |
| `/seller` | 468.116 | 468.115 | 468.074 | -41 | 19 / 19 |
| `/seller/transactions` | 549.718 | 549.715 | 549.700 | -15 | 20 / 20 |
| `/seller/withdraw` | 478.844 | 478.848 | 478.826 | -22 | 20 / 20 |

Mọi trang có khung -5 đến -41 B, `/mint` -342 B, cùng số tệp. So từng tệp (trang `/account`, `/mint`, theo kích thước thô): chunk
khung 178.891 thành 180.761 B thô (+569 B gzip): module thanh bên, `intro-link` và bảng quyền `can()` (DEVIATION 9; `/mint` vốn đã
dùng `can()` nên chunk trang của nó giảm 267 B gzip); module `next-themes` (3,4 KB thô) dời từ chunk thư viện ví (343.418 thành
340.005 B) sang chunk dùng chung với trang giới thiệu (61.514 thành 64.956 B), vì `LandingChrome` dùng `useTheme`, nén tốt hơn ở
chỗ mới (-653 B gzip); một tệp nhỏ +55 B. Không module nào của khung bị mất. Các lần đo trung gian: bản chỉ có liên kết thanh
bên (điều kiện ở `sidebar.tsx`) +207 đến +236 B; bản đầu của trang +975 đến +1.032 B (thêm hai tệp script mỗi trang, mã thô chỉ
+394 B, mục 2.4 ý 2); bản `ce3e211` -377 đến -415 B.

---

## 5. Ảnh (gửi kèm, không commit)

Mốc (bản build `29c5708`, tiến trình mock mới cổng 3400, bật 15:14:18Z, tắt 15:14:45Z): thanh bên Nhà đầu tư `/portfolio` 1440
mở rộng và thu gọn, Sáng và Tối. Sau (bản build `908863e`, tiến trình mock mới cổng 3400, bật 17:16:45Z, tắt 17:17:49Z, ngày
06/11/2026 UTC): cùng bốn ảnh thanh bên (liên kết "Giới thiệu dự án" ngay trên ô Chain; thu gọn chỉ còn mũi tên); `/gioi-thieu` cả
trang 1440, 1100, 390 Sáng và Tối (ngữ cảnh `reducedMotion: 'reduce'`, video là ảnh nền có nút phát); nút về đầu trang đang hiện ở
1440 (trong lề phải) và 390 (đè mép nội dung, thấy chữ dưới nút). 0 lỗi console, 0 yêu cầu YouTube ở cả lượt.

---

## 6. Lệnh kiểm tasks bước 6

Chạy trên HEAD `908863e` (mã cuối), bash, `LC_ALL=C`:

- 6a: hai lệnh đầu rỗng; dòng `--numstat`: `investor-channel.spec.ts` 2 2, `globals.css` 3 0, `sidebar.tsx` 2 0.
- 6b: rỗng. 6c: rỗng. 6d: rỗng. 6e: rỗng.

---

## 7. Ba luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi (task không chạm `lib/`).
- [x] Mọi ký qua ISigner: không đổi.
- [x] Mọi kiểm quyền qua RBAC: không đổi; trang công khai không đọc vai, vào khu vực vẫn qua `setChannel` và `ChannelGuard` của khu vực đích.
