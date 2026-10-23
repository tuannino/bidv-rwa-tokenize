# Yêu cầu nâng cấp UI/UX: bàn giao cho Supervisor

| | |
|---|---|
| Ngày | 23/10/2026 |
| Mốc mã nguồn | nhánh `dev` @ `f164939` |
| Loại tài liệu | Kết quả thử nghiệm và requirement. Session thử nghiệm KHÔNG sửa mã sản phẩm, KHÔNG merge |
| Công cụ | skill `design-taste-frontend` (taste-skill v2): bộ đo `inspect.mjs` chạy Chrome thật ở 1440, 768, 390 px; `lint.mjs` quét mã nguồn |
| Bản mẫu | `docs/prototypes/20261023_ui_ux/` (HTML tĩnh, mở `index.html`). Ba màn: Bảng điều khiển (Kiểm soát viên), Phê duyệt lệnh, Tài sản (Nhà đầu tư). Có nút đổi Light/Dark ở chân sidebar |
| Quyết định của Owner đã nhận | Light là giao diện mặc định; Dark là ưu tiên thứ hai |

Tài liệu này kế tiếp `docs/UI_REDESIGN_BRIEF.md` (đồng bộ chủ đề điện gió, đã xong phần lớn). Brief cũ lo nội dung; tài liệu này lo chất lượng giao diện: chữ, màu, khung, bố cục từng màn, điện thoại.

---

## 1. Tóm tắt cho Supervisor

Ba việc tác động lớn nhất, xếp theo thứ tự nên làm:

1. **Sửa lỗi font (P0, sửa trong vài dòng).** Toàn bộ app đang hiển thị bằng Times New Roman. Đã thử cách sửa trên bản local: Geist nạp đúng, có bộ chữ tiếng Việt.
2. **Light mặc định và giao diện điện thoại (P0).** App mặc định Dark; trên điện thoại sidebar 240 px không gập, chiếm 62% bề ngang 390 px, tiêu đề vỡ 4 dòng.
3. **Làm lại ba màn làm việc chính theo bản mẫu (P1).** Mỗi màn trả lời một câu hỏi trước, có một nút cho việc thường làm nhất, số liệu căn phải và cộng khớp.

Mọi yêu cầu bên dưới chỉ đụng giao diện. **Không đổi** logic mint/burn, chia lợi nhuận, audit và 3 LUẬT (`ILedgerPort`, `ISigner`, `can()`). Giữ luật hiệu năng HF-01: **mỗi màn tối đa một server action khi mở**.

---

## 2. Hiện trạng đo được (before)

Ảnh chụp 18 màn theo 4 vai, 1440 và 390 px: thư mục ảnh "before" gửi kèm. Số đo `inspect.mjs --app` trên `/` (Giao dịch viên):

| Hạng mục | Kết quả đo | Mức |
|---|---|---|
| Font hiển thị | `Times New Roman` 99% chữ trên màn | FAIL |
| Chữ dưới 11 px | "Điện gió" 9 px (logo), nhóm menu "Vận hành", "Tài khoản" 10 px | FAIL |
| Icon trong ô màu | 4 ô KPI có icon trong ô tô màu, 3 màu khác nhau | FAIL |
| Nút có bóng/viền phát sáng | nút "Kết nối ví" (RainbowKit) | FAIL |
| Tiêu đề ở 390 px | "Tổng quan điện gió" vỡ 4 dòng; sidebar không gập | FAIL |
| Tiêu đề khu vực | 0 thẻ `h2`: tiêu đề card là `div` (`components/ui/card.tsx:36`) | Khả năng tiếp cận |
| Tương phản | "BIDV" 3,1:1; nhãn phụ 4,4:1 (cần 4,5:1) | WARN |
| Viền thẻ | viền xanh 4,9:1 trên nền, nặng hơn mức 1,2 đến 1,5:1 | WARN |

`lint.mjs --app app/src`: 16 FAIL, 174 WARN. Nhóm chính: 14 nhãn chữ hoa giãn chữ cỡ nhỏ, `font-mono` 160 chỗ ở 36 tệp, `backdrop-blur` ở header, `transition-all` ở `button.tsx` và `badge.tsx`, `animate-ping` ở sidebar.

Quan sát trên ảnh, theo vai:

- **Mọi vai:** thanh trên chứa bộ chọn chain dài 280 px, bộ chọn vai, nút giao diện và nút "Kết nối ví" xanh đậm là thứ nổi nhất màn hình. Badge phím tắt (E, L, G...) cạnh mọi mục menu. Màu xanh BIDV phủ lên khung (mục menu đang chọn, viền thẻ, nút), không còn chỗ để nhấn dữ liệu.
- **Giao dịch viên, Kiểm soát viên:** nút "Kết nối ví" hiện cả với hai vai vận hành, trái quyết định FE-02 "Hai vai vận hành không kết nối ví" (`components/layout/header.tsx` render `ConnectButton` không điều kiện).
- **Kiểm soát viên, Phê duyệt lệnh:** hai thẻ hàng chờ (tạo, huỷ) mỗi thẻ có ô tìm kiếm và bộ lọc riêng; phải sang trang chi tiết mới thấy điều kiện và nút duyệt.
- **Vault:** 15 ô số liệu cùng một kiểu thẻ, không thứ bậc; địa chỉ vault tràn hai dòng.
- **Nhà đầu tư, Tổng quan:** nhãn "ON-CHAIN", "DỮ LIỆU MẪU" dạng chữ hoa nhỏ lặp nhiều lần; hai khối lớn chỉ có dòng "Chưa kết nối ví" (lệch L-03 trong UserGuide).
- **Dữ liệu mẫu bảng điều khiển phi lý:** "Lợi tức đã chia 86,4 tỷ" cho 335.000 WPT giá 100.000 VNDB, tức khoảng 258.000 VNDB mỗi WPT trong 6 kỳ, gấp hơn 2 lần giá token. Mục tiêu dự án 5,8%/năm.

---

## 3. Quyết định thiết kế (đề xuất áp dụng toàn app)

Hệ thiết kế rút từ skill: **"Achromatic ledger"** (sổ cái không màu), ánh xạ sang nhận diện BIDV. Lý do chọn: app là công cụ ngân hàng, cán bộ làm việc nhiều giờ, nội dung là tiền và số lượng. Khung giao diện trung tính để màu dành cho dữ liệu và trạng thái.

### 3.1. Nguyên tắc

1. **Màu nằm trên dữ liệu, không nằm trên khung.** Xanh BIDV `#1a6b3c` chỉ dùng cho: phần tử dữ liệu chính của màn (cột kỳ hiện tại, phần chia cho nhà đầu tư), tiêu điểm bàn phím, logo. Vàng BIDV chỉ trong logo.
2. **Một nút chính mỗi màn**, màu mực (`--primary`). Nút phụ: nền trắng viền xám. Xem câu hỏi Q1 ở mục 7.
3. **Số là chữ, không là thẻ.** KPI là nhãn xám trên con số; không icon trong ô màu, không sparkline.
4. **Bề mặt phẳng.** Thẻ trắng viền 1 px rất nhạt trên nền xám nhạt; không bóng đổ (trừ menu, hộp thoại).
5. **Bảng là căn lề.** Số căn phải, chữ số đều độ rộng (`tabular-nums`), tiêu đề cột 12 px chữ thường, không sọc vằn.
6. **Màu thay đổi nói tốt hay xấu,** không nói tăng hay giảm. Sản lượng giảm là xấu cho nhà đầu tư nên tô đỏ.
7. **Trạng thái thật thà.** Số 0 in là 0 (màu xám); thiếu dữ liệu là dấu gạch xám; khối rỗng giữ khung và một câu.

### 3.2. Token màu (thay `app/src/app/globals.css`)

Light là mặc định. Dark dùng nền đen trung tính, bỏ sắc xanh hiện tại (`oklch(0.13 0.01 145)`).

| Vai trò | Light | Dark | Ánh xạ shadcn hiện tại |
|---|---|---|---|
| Nền trang | `#f6f7f6` | `#0b0c0b` | `--background` |
| Bề mặt thẻ | `#ffffff` | `#141614` | `--card`, `--popover` |
| Nền phụ, hover | `#f2f4f2` | `#1d201d` | `--muted`, `--secondary` |
| Mục menu đang chọn | `#e8ebe8` | `#262a26` | `--sidebar-accent` |
| Viền thẻ | `#e3e6e3` | `#252825` | `--border` |
| Kẻ dòng bảng | `#eef0ee` | `#1d201d` | mới: `--rule` |
| Viền ô nhập | `#ccd2cd` | `#444a45` | `--input` |
| Chữ chính | `#101a14` | `#f4f6f4` | `--foreground` |
| Chữ phụ | `#545d57` | `#b4bab5` | `--muted-foreground` |
| Nút chính | `#101a14` chữ trắng | `#f4f6f4` chữ đen | `--primary` |
| Dữ liệu chính, tiêu điểm | `#1a6b3c` | `#4fb878` | `--chart-1`, `--ring` |
| Dữ liệu phụ trong biểu đồ | `#c9cfca` | `#3d433e` | mới: `--chart-muted` |
| Tích cực | `#1a6b3c` | `#4fb878` | (accent là xanh lá nên dùng chung) |
| Tiêu cực | `#b42318` | `#f07068` | `--destructive` |
| Nhãn trạng thái tốt | nền `#e2f1e7` chữ `#0e3d22` | nền `#15281c` chữ `#6fd096` | Badge |
| Nhãn trạng thái xấu | nền `#fdecea` chữ `#7a1a12` | nền `#2c1716` chữ `#f39a93` | Badge |
| Nhãn chờ, cảnh báo | nền `#fff7e0` chữ `#7a4a00` | nền `#2a2212` chữ `#e9b65a` | Badge |

Mọi chữ đạt tương phản 4,5:1 trên nền nó đứng (đã đo trong bản mẫu). `--chart-2` đến `--chart-5` chỉ dùng khi biểu đồ thật sự cần hơn một chuỗi; mặc định một biểu đồ một màu.

### 3.3. Chữ

- **Geist** cho toàn bộ chữ, `subsets: ['latin', 'vietnamese']`. **Geist Mono** chỉ cho mã yêu cầu, địa chỉ ví, mã giao dịch.
- Cỡ: tiêu đề màn 24 px/600; tiêu đề khối 16 px/600; số KPI 24 px/500; số tổng tài sản 32 px/700; chữ thường 14 px; nhãn phụ 12 px. Không chữ nào dưới 11 px.
- Chữ thường kiểu câu; bỏ mọi nhãn chữ hoa giãn chữ.
- Đậm 700 chỉ cho số tiền dẫn đầu màn.

### 3.4. Khung (shell)

- **Bỏ thanh trên cùng.** Sidebar 232 px cùng nền trang, ngăn bằng 1 viền.
- Đầu sidebar: logo và tên "BIDV RWA, Điện gió An Viên"; ngay dưới là hai ô phạm vi **Vai trò** và **Chain** (thay hai `select` ở header).
- Mục menu: icon 16 px nét mảnh xám, nhãn 14 px; mục đang chọn là nền xám nhạt (không xanh). Số việc chờ là chấm tròn mực có số, chỉ ở mục có hàng chờ.
- Chân sidebar: nút "Giao diện tối/sáng" và dòng người dùng (tên, vai).
- **"Kết nối ví" chỉ hiện với Nhà đầu tư và Người bán**, đặt trong màn Ví hoặc chân sidebar, không ở mọi trang.
- Badge phím tắt: xem câu hỏi Q2.
- **Điện thoại và máy tính bảng (dưới 860 px):** sidebar gập thành thanh trên 52 px (logo, nút menu 44 px); menu mở thành tấm toàn màn hình. Lề 16 px. Bảng dưới 640 px chuyển thành dòng hai tầng (định danh và số chính ở tầng 1, trường phụ ở tầng 2), không bỏ trường nào.

---

## 4. Danh sách yêu cầu

Mỗi yêu cầu có mã `UX-xx` để Supervisor tách task cho Kiro. Cột "Bằng chứng" là vị trí trong mã tại `f164939`.

### P0: làm ngay, một PR nhỏ

| Mã | Yêu cầu | Bằng chứng | Điều kiện đạt |
|---|---|---|---|
| UX-01 | Sửa font. Trong `layout.tsx` nạp thêm `Geist` (biến `--font-geist-sans`, subsets latin và vietnamese); đổi biến Geist Mono sang `--font-geist-mono`; trong `globals.css` đặt `--font-sans: var(--font-geist-sans)`. Hai dòng `--font-sans: var(--font-sans)` và `--font-mono: var(--font-geist-mono)` hiện đang tự trỏ hoặc trỏ vào biến không tồn tại | `app/src/app/globals.css:10-11`, `app/src/app/layout.tsx:2-11` | `getComputedStyle(document.body).fontFamily` bắt đầu bằng `Geist`; chữ tiếng Việt có dấu hiển thị đúng. **Đã thử trên bản local, đạt** |
| UX-02 | Đi kèm UX-01: khi font được sửa, 160 chỗ `font-mono` sẽ hiện thật thành chữ đơn cách (trước đây bị Times che). Thay `font-mono` trên số liệu bằng `tabular-nums`; chỉ giữ mono cho mã, địa chỉ, hash | `lint`: 160 chỗ ở 36 tệp; ảnh thử nghiệm sau sửa font cho thấy KPI thành chữ đơn cách | Không còn `font-mono` trên số tiền, số lượng, phần trăm |
| UX-03 | Light mặc định: `defaultTheme="light"`; sửa nhánh trước khi mount của RainbowKit (đang mặc định dark) | `app/src/components/providers.tsx:29-31, 45` | Phiên mới không cookie mở ra Light; không nháy Dark lúc tải |
| UX-04 | Điện thoại: sidebar gập dưới 860 px như mục 3.4; header không tràn | `app/src/components/layout/app-layout.tsx` (khung `flex h-screen` không có breakpoint), `sidebar.tsx` (`w-60` cố định) | `inspect.mjs` ở 390 px: sidebar không chiếm quá 30% bề ngang, tiêu đề không quá 2 dòng, không cuộn ngang |
| UX-05 | Ẩn "Kết nối ví" với Giao dịch viên và Kiểm soát viên | `app/src/components/layout/header.tsx` (ConnectButton không điều kiện) | Vai TELLER, CONTROLLER không thấy nút; INVESTOR, SELLER vẫn kết nối được |

### P1: hệ thiết kế và khung

| Mã | Yêu cầu | Bằng chứng | Điều kiện đạt |
|---|---|---|---|
| UX-06 | Thay token màu Light và Dark theo bảng 3.2 | `app/src/app/globals.css:60-150` | Không còn sắc xanh trên nền Dark; xanh BIDV không còn trên khung (menu, viền thẻ, nút) |
| UX-07 | Khung mới theo 3.4: bỏ header, đưa Vai trò và Chain lên đầu sidebar, bỏ `backdrop-blur`, bỏ `animate-ping` ở trạng thái mạng | `header.tsx:22`, `sidebar.tsx:258` | Giữ nguyên logic `ChannelSwitcher`, `ChainSelector`, số việc chờ (HF-01) |
| UX-08 | Chữ: bỏ 19 chỗ `uppercase` nhãn nhỏ, 6 chỗ `text-[9px]`/`text-[10px]`; `CardTitle` render `h2` (hoặc nhận prop `as`) | `sidebar.tsx` nhóm menu, `bidv-logo.tsx` "Điện gió", `components/ui/card.tsx:36` | `lint` không còn `micro-label`; `inspect` không còn `tiny-text`; mỗi khối có tiêu đề `h2` |
| UX-09 | Thành phần: bỏ icon trong ô màu ở KPI; `transition-all` đổi sang thuộc tính cụ thể; nút không bóng; Badge theo cặp nền nhạt chữ đậm cùng sắc | `dashboard.tsx`, `ui/button.tsx:7`, `ui/badge.tsx:8` | `inspect` không còn `icon-chips`, `button-fx` |

### P1: ba màn làm lại theo bản mẫu

Bản mẫu là hướng bố cục và cách trình bày; số liệu trong bản mẫu là MẪU (mục 8). Khi làm, dữ liệu lấy từ service hiện có và **gom trong một server action mỗi màn** (luật HF-01).

**UX-10. Bảng điều khiển vận hành `/` (Kiểm soát viên, Giao dịch viên)**

- Câu hỏi của màn: *"Kỳ chia này đã sẵn sàng chưa, và việc gì đang chờ tôi?"*
- Hàng tiêu đề: `h1` "Bảng điều khiển"; một câu phát hiện ngay dưới (ví dụ "Kỳ 09/2026 đã chốt vault, chờ bạn duyệt chia 4.800.000.000 VNDB. 3 yêu cầu đang chờ, cũ nhất 3 giờ 2 phút"); mốc "Cập nhật hh:mm"; một nút chính "Duyệt chia kỳ ..." (chỉ Kiểm soát viên; Giao dịch viên thấy nút "Lập lệnh").
- **Khối đặc trưng "Kỳ ... chia thế nào"**: Sản lượng (MWh, EnergyOracle) sang Lợi nhuận nạp quỹ sang Mỗi WPT nhận sang hai phần: Nhà đầu tư (WPT đang lưu hành) và Vault SPV (WPT chưa bán). Đây là quy tắc QĐ-12 hiện chỉ nằm trong tài liệu; đưa lên màn để cán bộ kiểm trước khi duyệt. Hai phần phải cộng đúng bằng quỹ.
- Khối "Sáu kỳ gần nhất": 3 KPI làm tab cho một biểu đồ cột (Sản lượng, Mỗi WPT nhận, Lợi nhuận nạp quỹ); cột kỳ hiện tại màu xanh BIDV, các kỳ khác xám; bảng so sánh với kỳ trước, thay đổi tính từ đúng hai số đang hiện.
- Khối "Chờ bạn xử lý": duyệt chia kỳ, yêu cầu Mint/Burn (cũ nhất trước, quá 2 giờ tô đỏ), lệnh rút NEEDS_REVIEW; nút "Mở hàng chờ duyệt".
- Khối "Lịch sử kỳ chia" (6 dòng) và "Nguồn cung và vault SPV" (tổng cung trên trần, đang lưu hành, chưa bán, người nắm giữ, số dư, đang khoá, người bán rút được).
- Nguồn dữ liệu gợi ý: `getDistributionOverview()` và `listDistributionPeriods()` (`lib/bank/distribution-approval.service.ts`), `pendingWorkCounts()` (`lib/nav/pending-work.ts`), dịch vụ vault (`lib/bank/vault.service.ts`). Sản lượng theo kỳ: EnergyOracle hoặc dữ liệu mẫu có gắn nhãn.

**UX-11. Phê duyệt lệnh `/approvals` (Kiểm soát viên)**

- Câu hỏi: *"Yêu cầu nào đang chờ tôi, cái nào cũ nhất, có an toàn để duyệt không?"*
- Một danh sách chung thay hai thẻ hàng chờ: tab "Chờ duyệt n" và "Đã xử lý hôm nay n"; một ô tìm (mã, người lập, lý do, chứng từ); cột Loại (Tạo hoặc Huỷ) thay cho hai bảng tách.
- **Danh sách và chi tiết trên cùng màn** (khung chi tiết 400 px bên phải, dính khi cuộn): số lượng, người lập, ví đích hoặc nguồn huỷ, ngày hiệu lực, chứng từ, lý do; "Tổng cung sau khi duyệt"; danh sách điều kiện hệ thống đã kiểm (đã có trong `request-check-block.tsx`); nút "Chấp nhận và phát hành/huỷ" và "Từ chối" (bắt buộc nhập lý do).
- Giữ `/approvals/[id]` cho liên kết trực tiếp; chọn dòng cập nhật `#id` trên địa chỉ.
- Điện thoại: danh sách dòng hai tầng, chọn dòng thì cuộn tới chi tiết.

**UX-12. Tổng quan Nhà đầu tư `/portfolio`**

- Câu hỏi: *"Tôi đang có bao nhiêu, và lợi tức kỳ này đã về chưa?"*
- Câu phát hiện dưới tiêu đề (lợi tức kỳ gần nhất về ngày nào, bao nhiêu).
- Thẻ tổng tài sản (WPT theo giá phát hành cộng VNDB), một dòng tổng lợi tức đã nhận.
- Bốn thao tác: Mua WPT, Bán WPT, Rút VNDB, Lệnh của tôi.
- Bảng "Token và tiền trong ví": WPT và VNDB, số lượng và giá trị căn phải.
- Cột phải: "Lợi tức đã nhận" theo kỳ (kỳ gần nhất màu xanh) và mức tương đương %/năm so với mục tiêu 5,8%; "Hoạt động gần đây".
- "Dự án bạn đang nắm giữ": công suất, sản lượng kỳ, lợi tức mỗi WPT, phần của bạn trên tổng cung.
- Phụ thuộc: sửa lệch L-03 (màn này cần dùng ví hồ sơ trên chain mock như `/trade`).

### P2: rà các màn còn lại theo cùng hệ

| Mã | Yêu cầu | Phạm vi |
|---|---|---|
| UX-13 | Bỏ ký tự chấm giữa dòng (U+00B7) trong chữ hiển thị (khoảng 27 chỗ trong `.tsx`), theo quy tắc 0.5 của UserGuide; thay bằng dấu phẩy | toàn `components`, `app` |
| UX-14 | Trạng thái rỗng, 0, đang tải, lỗi theo nguyên tắc 3.1 mục 7: khối rỗng giữ khung và một câu; đang tải là thanh xám đúng kích thước, không nhấp nháy; lỗi nằm trong khối lỗi, có "Thử lại" | mọi màn |
| UX-15 | Màn Vault: nhóm 15 ô thành 3 nhóm (Số dư, Khoá, Rút), địa chỉ rút gọn kèm nút chép | `components/pages/vault-status.tsx` |
| UX-16 | Màn Lập lệnh, Chia lợi nhuận, Giao dịch, Người bán, Mua bán: áp token, chữ, bảng, nút chính theo mục 3 | các màn còn lại |
| UX-17 | Thay bộ số mẫu của bảng điều khiển cũ bằng bộ số khớp mô hình token (mục 8) | `app/src/lib/mock-data.ts` |

---

## 5. Điều kiện nghiệm thu chung

1. `node <skill>/scripts/inspect.mjs <url> --app` ở 1440, 768, 390 px: **0 FAIL** cho mọi màn đã làm. Mỗi WARN còn lại có một câu giải thích trong checkpoint.
2. Ảnh chụp cả Light và Dark cho mỗi màn đã làm, ở 1440 và 390 px.
3. `npm run typecheck`, `npm test`, `npm run test:e2e` vẫn xanh (e2e có thể phải sửa selector khi bỏ header; không sửa logic).
4. 3 LUẬT không đổi; mỗi màn tối đa một server action khi mở (HF-01).
5. UserGuide cập nhật Phần 2 và 3 cho màn bị đổi.

Kết quả bản mẫu theo cùng điều kiện: 0 FAIL ở cả ba màn. Còn 1 WARN `ragged-row` ở hai màn: Phê duyệt (khung chi tiết dài hơn danh sách 3 dòng là chủ ý, khung chi tiết dính khi cuộn) và Tài sản (bộ đo so thẻ tổng tài sản với thẻ lợi tức; hai cột thực tế kết thúc lệch khoảng 10 px).

---

## 6. Đề xuất chia task

| Thứ tự | Task | Gồm | Ước lượng quy mô |
|---|---|---|---|
| 1 | FE-UX-01 Sửa nhanh | UX-01 đến UX-05 | nhỏ, 1 PR |
| 2 | FE-UX-02 Hệ thiết kế và khung | UX-06 đến UX-09 | vừa; chạm `globals.css`, `components/ui`, `components/layout` |
| 3 | FE-UX-03 Bảng điều khiển | UX-10, UX-17 | vừa; cần một action gom dữ liệu |
| 4 | FE-UX-04 Phê duyệt lệnh | UX-11 | vừa |
| 5 | FE-UX-05 Tổng quan Nhà đầu tư | UX-12 (sau L-03) | vừa |
| 6 | FE-UX-06 Rà các màn còn lại | UX-13 đến UX-16 | lớn, có thể tách theo vai |

---

## 7. Câu hỏi cần Owner chốt

- **Q1. Màu nút chính.** Bản mẫu dùng màu mực (gần đen) để xanh BIDV chỉ đánh dấu dữ liệu. Nếu Owner muốn nút chính màu xanh BIDV vì nhận diện, chỉ đổi một token `--primary`; khi đó cột kỳ hiện tại trong biểu đồ nên chuyển sang mực để không trùng nghĩa.
- **Q2. Badge phím tắt** (E, L, G... cạnh mục menu). Đề xuất bỏ khỏi menu, đưa vào chú thích khi rê chuột. Cần xác nhận phím tắt có đang được dùng không.
- **Q3. Màn Kiểm soát viên và Giao dịch viên dùng chung `/`.** Bản mẫu dựng cho Kiểm soát viên; đề xuất Giao dịch viên cùng bố cục, nút chính đổi sang "Lập lệnh" và khối việc chờ chỉ gồm yêu cầu của chính họ.
- **Q4. Có đưa bản mẫu vào repo** (`docs/prototypes/20261023_ui_ux/`) để Kiro tham chiếu không.

---

## 8. Phụ lục

### 8.1. Dữ liệu mẫu trong bản mẫu (phải thay bằng dữ liệu thật)

Tất cả nằm trong `docs/prototypes/20261023_ui_ux/data.js`; mọi tổng cộng từ dòng, có `console.assert` kiểm.

- Token WPT: giá phát hành 100.000 VNDB, trần 20.000.000, tổng cung 10.000.000, đang lưu hành 3.412.500, chưa bán 6.587.500, 128 người nắm giữ.
- Sáu kỳ 04/2026 đến 09/2026: sản lượng 24.180 đến 34.720 MWh; mỗi WPT nhận 350 đến 502 VNDB (khoảng 5,2%/năm trên giá phát hành, gần mục tiêu 5,8%). Quỹ kỳ = mỗi WPT nhân tổng cung.
- Kỳ 09/2026: quỹ 4.800.000.000 VNDB; nhà đầu tư 1.638.000.000; vault 3.162.000.000.
- Ba yêu cầu chờ duyệt (mã `7f3a21c0`, `91bd0e44`, `c02f9a17`), người lập GDV001, GDV002, số chứng từ "QĐ 128/2026/QĐ-BIDV" và các số khác là giả định.
- Vault: số dư 41.250.000.000 VNDB, khoá 20%; địa chỉ `0x0da9…6861` lấy từ UserGuide, ví nhận tiền rút `0x41c2…9e07` là giả định.
- Nhà đầu tư mẫu "Trần Minh Khoa" NDT001, 150 WPT, lợi tức 6 kỳ 393.000 VNDB.

### 8.2. Ghi chú quy trình skill

- Hệ: `achromatic-ledger`, seed 628031900, giữ bảng màu thương hiệu (`--keep palette`).
- Đổi khung một lần: khung được chia là "icon rail" (thanh icon không nhãn); đổi sang "open plane" (sidebar có nhãn) vì mỗi vai có 6 đến 7 mục nghiệp vụ mà icon không diễn đạt được ("Vault thanh toán SPV", "Chia lợi nhuận").
- Bản sắc chọn: xanh BIDV trên phần tử dữ liệu chính của mỗi màn. Phần tử đặc trưng: khối "Kỳ ... chia thế nào".
- Kiểm `mono` của lint được chấp nhận cho mã yêu cầu và địa chỉ ví.
- Bản mẫu không dùng ảnh ngoài.
