# FE-UX-01c: chuyển động nhẹ bằng CSS và nền trôi

| | |
|---|---|
| Nhánh | `feat/fe-ux-01c-chuyen-dong` từ `release/ui-v2` sau khi PR #85 (FE-UX-01b) đã merge |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần. Không `lib/`, không thêm gói npm, không JS chuyển động (hook lò xo, số lăn, tách chữ, viên nang trượt, thanh đầu co theo cuộn, View Transitions: FE-UX-08) |
| Mức kiểm thử | **B**, phạm vi ở mục 5 |
| Nguồn | Kế hoạch 03/11 (dòng FE-UX-01c); `docs/prototypes/20261101_ui_ux_ban_chot/assets/c.css` (khối "Gió hoá dòng tiền": `--wind`, `--spring`, `.bgfx`, `rise`, `horizon`, `beacon`, các `:hover`, `prefers-reduced-motion`) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` sau #85, rồi tài liệu bàn giao, cuối cùng là bản xem thử |

## 1. Mục tiêu

Thêm lớp chuyển động nhẹ, chỉ bằng CSS, cho khung và thành phần dùng chung; tắt toàn bộ khi người dùng chọn giảm chuyển động. Không đổi bố cục, câu chữ, logic, số lời gọi máy chủ.

Không làm: hiệu ứng riêng của từng màn (thẻ nổi khi rê, mũi tên "xem thêm", thanh tiến độ: làm cùng màn ở FE-UX-02 tới 05), lớp quét sáng trên mục menu đang mở, đường gió nét đứt của nền, mọi thứ cần JS đo vị trí hoặc theo cuộn.

## 2. Quyết định (QĐ)

- **QĐ-1. Chỉ CSS.** Keyframes, easing, utility đặt trong `globals.css`. Không thêm JS (trừ `key` nếu QĐ-4 cho thấy cần).
- **QĐ-2. Easing dùng chung:** `--ease-wind: cubic-bezier(.16, 1, .3, 1)`, `--ease-spring: cubic-bezier(.34, 1.4, .64, 1)` khai báo trong `@theme` để có lớp `ease-wind`, `ease-spring` của Tailwind. Thời lượng: rê chuột 200 đến 300 ms, vào trang 500 ms.
- **QĐ-3. Nền trôi:** component server `components/motion/background-fx.tsx` (không `"use client"`), đặt một lần trong `app/src/app/layout.tsx` (trong `body`, trước `Providers`) để không dựng lại khi đổi màn (mỗi trang tự gọi `AppLayout` nên khung dựng lại sau mỗi lần điều hướng). Ba quầng sáng trôi chậm 26 s, 32 s, 38 s, `alternate`; màu lấy từ token (`--primary`, `--accent`, `--chart-*`) qua `color-mix`, không mã màu cứng; độ mờ Tối thấp hơn Sáng. `aria-hidden`, `pointer-events-none`, `position: fixed`, nằm dưới mọi nội dung. Quầng là `radial-gradient` mờ dần sẵn, KHÔNG dùng `filter: blur`. Chỉ animate `transform`. Dưới 1100 px giảm cỡ quầng còn khoảng 60%. Gốc khung trong `AppLayout` bỏ `bg-background` (nền đã có ở `body`) để quầng hiện ra. Màn từ chối quyền (`ChannelGuard`) cũng có nền, chấp nhận.
- **QĐ-4. Vào trang:** phần tử bọc nội dung trong `main` có `data-page-enter`, chạy `rise` (mờ sang rõ, dịch lên 12 px) 500 ms một lần mỗi lần vào màn. Theo đọc mã, điều hướng giữa hai màn đã dựng lại cả khung (mỗi trang tự gọi `AppLayout`, nhiều nhóm route), nên mặc định KHÔNG thêm `key`. Bằng chứng bắt buộc là sự kiện `animationstart` (design mục 4 ca 2): nếu ở cặp màn nào không có đúng một sự kiện `rise` mới sau điều hướng thì thêm `key={pathname}` trong `ShellMain`; checkpoint ghi kết quả từng cặp (DOM có được thay không, có `key` không). Thanh bên, thanh đầu không chạy hiệu ứng vào trang. Đường chân trời (QĐ-6) chạy lại từ đầu khi đổi màn: chấp nhận.
- **QĐ-5. Rê chuột và nhấn (thành phần dùng chung):**
  - `Button` biến thể `default`: nhấc 1 px khi rê, lớp quét sáng chạy ngang khi rê (giả phần tử `after`, `overflow-hidden`; rời chuột thì quét ngược lại như bản chốt, chấp nhận); không áp khi `disabled` hoặc `aria-disabled` (design mục 3). Giữ `transition-all` sẵn có.
  - Mục menu thanh bên: biểu tượng trong vòng tròn xoay -10 độ, phóng 1,12 khi rê (`ease-spring`).
  - Nút Sáng Tối: xoay -12 độ khi rê.
  - Hàng bảng (`TableRow`) giữ `transition-colors` sẵn có, không thêm.
  - Dropdown, Dialog, Tooltip đã có hiệu ứng mở của `tw-animate-css`: giữ, chỉ kiểm tắt được khi giảm chuyển động.
- **QĐ-6. Chuyển động nền của khung:**
  - Đường chân trời ở mép dưới thanh đầu: dải gradient xanh vàng cao 2 px chạy ngang 8 s (`horizon`). Làm bằng một `span` `aria-hidden` cắt tràn trong `header`, giả phần tử `after` của nó rộng 200% dịch bằng `translate` (không animate `background-position`).
  - Số việc chờ khác 0: vòng sáng vàng tỏa ra 2,4 s (`beacon`) bằng giả phần tử `after` của viên, animate `scale` và `opacity` (không animate `box-shadow`). Số 0: không chuyển động.
- **QĐ-7. Utility cho các PR màn sau:** khai báo bằng `@utility` (không sinh CSS khi chưa dùng): `lift` (nhấc 3 px và bóng khi rê, dùng cho thẻ bấm được, ô KPI), `nudge-x` (mũi tên dịch 4 px khi rê cha `group`). PR này KHÔNG áp vào màn nào.
- **QĐ-8. Giảm chuyển động:** một khối `@media (prefers-reduced-motion: reduce)` trong `globals.css` tắt mọi `animation`, `transition` (`*, *::before, *::after`) và bỏ `will-change` của quầng (`[data-bgfx] > * { will-change: auto !important; }`) để không giữ lớp compositor vô ích. Phần tử `data-page-enter` tự ở trạng thái cuối (rõ, không dịch). Quầng sáng đứng yên nhưng vẫn hiện.
- **QĐ-9. Hiệu năng:** chuyển động dài hạn (nền, đường chân trời, vòng số việc chờ) chỉ animate `transform`/`translate`/`rotate`/`scale` và `opacity`. Không `filter: blur`, không animate `background-position`, `box-shadow`; `will-change` chỉ trên quầng sáng. CPU đứng yên đo bằng `tools/20261104_do_cpu_dung_yen.js` gửi kèm (cách đo khoá ở mục 5): trung vị sau khi sửa không quá 3% ở cả `/` (vai teller) và `/portfolio` (vai investor); vượt thì báo Supervisor trước khi mở PR. JS gzip 4 trang (`/`, `/approvals`, `/portfolio`, `/trade`) không tăng quá 1 KB; CSS gzip toàn ứng dụng không tăng quá 3 KB; số server action khi mở màn không đổi.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/app/globals.css` | Easing, keyframes, utility, khối giảm chuyển động |
| `app/src/app/layout.tsx` | Chỉ thêm `<BackgroundFx />` |
| `app/src/components/motion/background-fx.tsx` (mới) | QĐ-3 |
| `app/src/components/layout/{app-layout,header,sidebar}.tsx` | Gắn nền, `data-page-enter`, `horizon`, `beacon`, hover biểu tượng menu, nút theme. Chỉ thêm lớp, thuộc tính, phần tử bọc; không đổi hook, state, handler, điều kiện |
| `app/src/components/ui/button.tsx` | QĐ-5, chỉ chuỗi lớp |
| `app/e2e/fe-ux-01c-chuyen-dong.spec.ts` (mới) | Design mục 4 |
| `docs/fe-ux-01c-chuyen-dong/*` (chép spec này), `docs/CHECKPOINT_FEUX01C.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Mọi tệp khác là cấm, gồm `app/test/**`, `lib/**`, tệp màn, e2e cũ, `package.json`, `package-lock.json`.

## 4. Điều kiện hoàn thành

- [ ] Nền trôi đúng QĐ-3 ở mọi màn có khung, Sáng và Tối; không che, không chặn bấm nội dung; không có mã màu cứng.
- [ ] Vào trang chạy `rise` một lần mỗi lần đổi màn, kể cả điều hướng bằng menu; thanh bên giữ trạng thái thu gọn khi đổi màn; nền trôi không giật khi đổi màn; kết quả kiểm `key` ghi trong checkpoint (QĐ-4).
- [ ] Rê chuột đúng QĐ-5 (nút chính, biểu tượng menu, nút theme); nút `disabled` không nhấc.
- [ ] Đường chân trời ở thanh đầu và vòng sáng số việc chờ khác 0 đúng QĐ-6 (chỉ `translate`, `scale`, `opacity`); số 0 đứng yên.
- [ ] Bật giảm chuyển động: không còn animation, transition nào chạy, quầng không còn `will-change`; nội dung hiện ngay ở trạng thái cuối.
- [ ] Utility `lift`, `nudge-x` có trong `globals.css`, chưa áp vào màn nào (QĐ-7).
- [ ] Số server action khi mở màn không đổi ở 28 đường dẫn; JS và CSS tăng trong trần QĐ-9; CPU đứng yên trung vị không quá 3% theo QĐ-9 và mục 5; cảnh báo hydrate và lỗi console vẫn 0.
- [ ] `app/e2e/fe-ux-01c-chuyen-dong.spec.ts` đủ 5 ca design mục 4, xanh.
- [ ] Kiểm thử theo đúng mục 5, đạt, kèm log; e2e mock chạy 3 lần liên tiếp không ca nào chập chờn.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 7) rỗng.
- [ ] Không mã dư thừa: không keyframes, utility, biến nào ngoài QĐ; không gói npm mới.
- [ ] Checkpoint ghi phạm vi, tệp, số đo trước và sau (action, JS, CSS), kết quả QĐ-4, quay màn hình hoặc ảnh động ngắn của nền, vào trang, rê nút (Sáng, Tối) gửi kèm.

## 5. Phạm vi kiểm thử (giữ ngắn, đủ rủi ro)

PR không đổi logic, backend, chain; rủi ro là e2e chập chờn do hiệu ứng (R3) và nặng trang (R4). Vì vậy:

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build`; e2e project mock đầy đủ (`cd app && npx playwright test`) 3 lần liên tiếp, lưu log cả 3; đo số action, JS bằng `tools/20261103_do_moc_measure.js`, CSS theo tasks bước 2, CPU bằng `tools/20261104_do_cpu_dung_yen.js` | `contracts`, `evm`, e2e hardhat (không đổi chain hay luồng tiền) |
| Supervisor | Đọc diff 7 tệp mã; build; chạy `fe-ux-01c-chuyen-dong`, `fe-ux-01b-khung`, `maker-checker`; gây lỗi có chủ đích 3 điểm (bỏ khối giảm chuyển động, đổi `rise` sang chạy vô hạn, bỏ lớp `beacon`); chạy script CPU một lần; xem ảnh động | Full suite |

E2e hardhat đầy đủ chạy gộp một lần sau FE-UX-02 (theo kế hoạch: e2e đầy đủ sau mỗi 2 đến 3 PR).

Cách đo CPU (khoá để hai người đo ra cùng kết quả):

- Script `tools/20261104_do_cpu_dung_yen.js` (sha256 `a64096b0890b8c32000bd1c637ce2d8e97adb2279dd965091e215eb7cb87a506`), chạy `node 20261104_do_cpu_dung_yen.js <baseURL> <đường dẫn> <vai>` trên `next start` với env e2e mock (`playwright.config.ts`).
- Cố định: Chromium của Playwright trong repo, headless, 1440 x 900, theme Sáng, thanh bên mở rộng, dữ liệu mock mới khởi động, không thao tác.
- Sau khi tải xong (`networkidle`) chờ 2 s cho hiệu ứng vào trang kết thúc, rồi đo 3 lượt x 5 s, lấy trung vị.
- Chỉ số: tỷ lệ main thread bận = mức tăng `TaskDuration` (CDP `Performance.getMetrics`) chia thời gian thực của cửa sổ, tính phần trăm.
- Đo mốc và đo sau cùng máy, cùng phiên. Supervisor đã thử trên `release/ui-v2` sau #85: trung vị 0% ở `/`; thêm một dải `background-position` chạy liên tục toàn màn thì lên 3%, tức script nhạy với vẽ lại liên tục.
- Script mốc `tools/20261103_do_moc_measure.js` (sha256 `ca67480e9e837446fc18ed0c2c63a2ea363d52be020acfc4c1b8cc56d19555b5`, chạy `node 20261103_do_moc_measure.js <baseURL> <thư mục ra>`, dữ liệu seed như giai đoạn 0: chạy e2e maker-checker, ops-transactions, permit-order trước) cho số action, JS, ảnh 28 đường dẫn. Hai script để ngoài repo, không commit.
