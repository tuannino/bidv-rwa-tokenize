# Yêu cầu nâng cấp UI/UX (bản 3: ý tưởng "Gió hoá dòng tiền", chuyển động mềm): bàn giao cho Supervisor

| | |
|---|---|
| Ngày | 23/10/2026 |
| Mốc mã nguồn | nhánh `dev` @ `f164939` (khảo sát), bản mẫu cập nhật sau `f11f1ae` |
| Loại tài liệu | Kết quả thử nghiệm và requirement. Session thử nghiệm KHÔNG sửa mã sản phẩm, KHÔNG merge |
| Bản xem thử | `docs/prototypes/20261023_ui_ux_mau_c/` (HTML tĩnh, mở `index.html`, 21 trang của 4 vai, Sáng và Tối). Ghi chú ánh xạ từng trang ở `notes/` cùng thư mục |
| Thay thế | Bản 1 của tài liệu này và bản mẫu `docs/prototypes/20261023_ui_ux/` (đã gỡ). Bản 1 đổi nội dung màn hình, trái nguyên tắc giữ feature bên dưới |

---

## 0. Quyết định của chủ dự án (đã chốt)

| Mã | Quyết định |
|---|---|
| QĐ-UX-1 | Light là giao diện mặc định; Dark là ưu tiên thứ hai |
| QĐ-UX-2 | Phong cách **mẫu C "Bento mềm"**: hiện đại, có animation và nền đẹp, giữ tông chủ đạo lục và vàng BIDV |
| QĐ-UX-3 | Không dùng ký hiệu mũi tên dạng ký tự. Mũi tên nếu có phải là icon đẹp, hợp màu, có hiệu ứng |
| QĐ-UX-4 | Được sắp xếp lại vị trí nhưng **không thay đổi feature**: mọi biểu đồ, lịch sử, trường thông tin, bộ lọc, nút, nhãn nguồn dữ liệu của màn hiện tại phải có đủ ở giao diện mới. Vai trò và Chain giữ dạng dropdown |
| QĐ-UX-5 | **Chỉ sửa frontend**, dữ liệu ánh xạ 1-1 với dữ liệu đang hiển thị, hoàn toàn độc lập với backend. Chỗ nào buộc phải đụng backend thì giải trình lý do và báo chủ dự án duyệt trước khi làm |
| QĐ-UX-6 | Ý tưởng chủ đạo **"Gió hoá dòng tiền"** (mục 3.0): chuyển động theo hướng gió, màu có nghĩa (xanh là token và năng lượng, vàng là tiền), sidebar "trụ tua-bin", header "đường chân trời" |
| QĐ-UX-7 | Demo trình bày cho cả lãnh đạo và đội vận hành: cân bằng giữa ấn tượng và rõ ràng |
| QĐ-UX-8 | Logo, ảnh, video trong bản xem thử là tạm để thử giao diện, chủ dự án thay sau (mục 3.6) |
| QĐ-UX-9 | Trang giới thiệu dự án là **một trang riêng** như bản xem thử, sẽ cải thiện ở đợt sau (FE-UX-X5) |
| QĐ-UX-10 | Hệ thống phải "mượt": chuyển động mềm theo kiểu lò xo (spring), có vi tương tác khi rê chuột và bấm, icon đẹp hơn (mục 3.3, 3.4) |

---

## 1. Phạm vi code tác động (bắt buộc tuân thủ)

### 1.1. Được sửa: lớp trình bày

| Nhóm | Tệp | Được làm | Không được làm |
|---|---|---|---|
| Hệ màu, font | `app/src/app/globals.css`, `app/src/app/layout.tsx` | Thay token màu Light, Dark; nạp font qua `next/font/google` | Đổi `ConfigProvider`, `publicConfig()` |
| Theme | `app/src/components/providers.tsx` | `defaultTheme="light"`, màu theme RainbowKit | Đổi Wagmi, QueryClient, cấu hình ví |
| Thành phần nền | `app/src/components/ui/*` | Kiểu dáng (class), biến thể mới chỉ về hình thức | Đổi API props đang dùng |
| Khung | `app/src/components/layout/*` | Markup, class, vị trí; sidebar gập trên điện thoại | Đổi logic `ChannelSwitcher`, `ChainSelector` (vẫn `<select>`), `NAV_BY_ROLE`, `withDemoPayment`, cách đọc số việc chờ, `ChannelGuard` |
| Màn hình | `app/src/components/pages/*.tsx`, `components/investor/*`, `components/maker-checker/*.tsx`, `components/trading/*.tsx`, `components/wallet/*.tsx`, `components/bidv-logo.tsx` | Bố cục JSX, class, biểu đồ recharts (màu, kiểu, animation), icon, hiệu ứng | Đổi lời gọi server action hoặc API (tên, tham số, số lần gọi khi mở màn), đổi state nghiệp vụ, đổi điều kiện khoá nút |
| Chữ hiển thị trong frontend | chuỗi JSX trong các tệp trên | Đổi dấu chấm giữa thành dấu phẩy, sửa chính tả | Đổi nghĩa câu, bỏ câu hướng dẫn |
| Chuyển động | `app/src/components/motion/*` (thư mục mới) | Hook lò xo, thành phần số lăn, viên nang trượt, tách chữ tiêu đề | Gọi dữ liệu, đổi state nghiệp vụ |
| Ảnh tĩnh | `app/public/3d/*` (chỉ khi FE-DEP-3 được duyệt) | Thêm ảnh icon 3D | |
| Kiểm thử e2e | `app/e2e/*` | Sửa selector khi markup đổi | Bỏ bước kiểm, nới điều kiện |

### 1.2. Không được sửa (backend và logic dùng chung)

`app/src/app/actions/*`, `app/src/app/api/*`, `app/src/lib/**` (bank, ledger, signer, rbac, store, session, config, chains, providers, wallet, hooks, nav, format), `app/src/components/maker-checker/gates.ts`, `components/trading/gates.ts`, `app/src/components/maker-checker/token-info-read.ts`, `app/prisma/*`, `packages/*`, `scripts/*`, `docker-compose.yml`, `app/wrangler.json`. Ba LUẬT (`ILedgerPort`, `ISigner`, `can()`) và luật hiệu năng HF-01 (mỗi màn tối đa một server action khi mở) giữ nguyên.

`lib/format.ts` là định dạng hiển thị nhưng dùng chung với máy chủ; nếu cần định dạng khác thì viết hàm mới trong `components/`, không sửa hàm cũ.

### 1.3. Phụ thuộc

Mặc định không thêm gói npm. Font Be Vietnam Pro nạp qua `next/font/google` (có sẵn trong Next). Biểu đồ giữ `recharts`, chỉ đổi kiểu.

Toàn bộ chuyển động mềm của bản 3 **làm được mà không cần gói mới**: đường cong lò xo viết bằng CSS `linear()` (token ở mục 3.3) và một hook lò xo nhỏ (khoảng 20 dòng, đặt ở `app/src/components/motion/`, không đặt trong `lib/`). Bản xem thử cũng tự viết như vậy (`spring()` trong `ui.js`).

Ba hạng mục dưới đây chỉ là **tuỳ chọn**, đều thuộc frontend, không đụng backend, nhưng vẫn **cần chủ dự án duyệt** trước khi thêm:

| Mã | Hạng mục | Giấy phép | Dùng để | Nếu không duyệt |
|---|---|---|---|---|
| FE-DEP-1 | Gói `motion` (Motion for React, trước là Framer Motion) | MIT | Viên nang menu và tab chuyển giữa các mục bằng `layoutId`, hiệu ứng ra vào `AnimatePresence` với ít mã hơn | Dùng hook lò xo tự viết và CSS `linear()`, kết quả nhìn tương đương |
| FE-DEP-2 | Gói `lenis` | MIT | Cuộn mượt có quán tính, **chỉ ở trang giới thiệu** (bản xem thử nhúng sẵn `assets/vendor/lenis.min.js`). Trang nghiệp vụ giữ cuộn gốc để thao tác bảng nhanh, chính xác | Trang giới thiệu dùng cuộn gốc |
| FE-DEP-3 | Ảnh icon 3D Fluent Emoji (21 tệp webp, tổng 116 KB, chép vào `app/public/3d/`, không phải gói npm) | MIT (Microsoft Fluent UI Emoji, bản đóng gói của LobeHub) | Icon cạnh tiêu đề trang, các chặng, vai và thẻ minh bạch ở trang giới thiệu | Bỏ icon 3D, giữ icon nét lucide |

### 1.4. Ánh xạ dữ liệu 1-1

Mỗi trang của bản xem thử có tệp `notes/<trang>.md` gồm: tệp component đã đọc, bảng "trường trên giao diện mới | nguồn trong màn thật (component, biến, action)", phần chỉ đổi trình bày, kết luận đụng backend và lệch đã thấy. Kiro dùng các bảng này làm checklist: **mỗi trường trên giao diện mới phải trỏ được về một trường đang hiển thị**, không thêm, không bớt.

Kết luận của 21 trang: **không trang nào cần sửa backend.**

### 1.5. Hạng mục ngoài phạm vi, cần chủ dự án duyệt trước khi làm

| Mã | Nội dung | Vì sao không làm trong đợt UI | Đề xuất |
|---|---|---|---|
| BE-UX-1 | Chuỗi do máy chủ dựng có gạch ngang dài, số không dấu nghìn, mã trạng thái tiếng Anh thô (`lib/bank/*`: câu điều kiện, câu dự kiến chia, nhật ký kiểm toán, lịch sử nạp VNDB) | Nằm ở backend; sửa là đổi dữ liệu trả về | Giữ nguyên hiển thị trong đợt này; nếu duyệt thì làm task backend riêng |
| BE-UX-2 | Số mẫu bảng điều khiển phi lý: 86,4 tỷ lợi tức cho 335.000 WPT giá 100.000 VNDB (`lib/mock-data.ts`) | Không phải UI, đổi số liệu | Task dữ liệu mẫu riêng |
| BE-UX-3 | Rút VNDB của nhà đầu tư (`/withdraw`) hiện là màn chờ FE-23; nghiệp vụ chưa có service, chưa có quyền | Cần backend mới | Giữ màn chờ, chỉ đổi giao diện |
| FE-UX-X1 | Tổng quan Người bán luôn in "–" cho số liệu bán, trong khi backend đã trả số bán trong ngày | Là sửa lỗi hiển thị, đổi dữ liệu người dùng thấy (không đụng backend) | Cần chủ dự án quyết có gộp vào đợt UI không |
| FE-UX-X2 | "Kết nối ví" hiện cả với Giao dịch viên, Kiểm soát viên, trái quyết định FE-02 | Đổi feature hiển thị theo vai | Bản xem thử giữ nguyên như hiện tại; chờ chủ dự án quyết |
| FE-UX-X3 | Dải "Video giới thiệu dự án" ở đầu Tổng quan Nhà đầu tư (bản xem thử gắn nhãn "Đề xuất bổ sung") | Nội dung mới, không có trong màn hiện tại; chỉ frontend (nhúng video, không dữ liệu) | Chờ chủ dự án duyệt và cung cấp video chính thức |
| FE-UX-X4 | Nút thu gọn sidebar thành thanh icon | Hành vi giao diện mới, không đổi menu | Chờ duyệt; nếu không duyệt thì bỏ nút, giữ sidebar đầy đủ |
| FE-UX-X5 | Trang chủ giới thiệu dự án (landing): video ở giữa màn hình, số liệu dự án, năm chặng "Gió hoá dòng tiền", ba dự án, bốn vai, minh bạch và kiểm soát | Trang mới, chưa có trong app; chỉ frontend, số liệu lấy từ `lib/mock-data.ts` và cấu hình phát hành đang có | Chủ dự án đã yêu cầu dựng thử (23/10/2026); cần chốt đường dẫn (ví dụ `/gioi-thieu` hoặc trang trước đăng nhập) và nội dung chính thức |

---

## 2. Lỗi nền phải sửa trước (P0)

| Mã | Lỗi | Bằng chứng | Cách sửa (frontend) |
|---|---|---|---|
| UX-01 | Toàn bộ app hiển thị bằng Times New Roman: `--font-sans: var(--font-sans)` tự trỏ vào chính nó | `app/src/app/globals.css:10-11`, `layout.tsx` chỉ nạp Geist Mono | Nạp Be Vietnam Pro (subsets latin, vietnamese) qua `next/font/google`, gán biến `--font-sans`. Đã thử cách sửa tương tự trên bản local, đạt |
| UX-02 | Khi font được sửa, khoảng 160 chỗ `font-mono` ở 36 tệp sẽ hiện thật thành chữ đơn cách | quét `lint` | Số liệu dùng `tabular-nums` của font chính; mono chỉ cho mã yêu cầu, địa chỉ ví, mã giao dịch |
| UX-03 | Mặc định Dark | `providers.tsx:29-31, 45` | `defaultTheme="light"`, sửa nhánh trước khi mount của RainbowKit |
| UX-04 | Điện thoại: sidebar 240 px không gập, tiêu đề vỡ 4 dòng ở 390 px | `app-layout.tsx`, `sidebar.tsx` (`w-60`) | Sidebar thành ngăn kéo dưới 900 px, nút menu; thanh trên xuống dòng |

---

## 3. Hệ thiết kế mẫu C

Nguồn chuẩn: `docs/prototypes/20261023_ui_ux_mau_c/assets/c.css` (token, thành phần; phần "BẢN 2" ở cuối tệp ghi đè phần đầu) và `assets/ui.js` (khung, minh hoạ SVG, biểu đồ, biên đạo chuyển động). Kiro chuyển sang Tailwind v4 và token shadcn trong `globals.css`; khung và hiệu ứng viết thành component React trong `components/layout` và `components/ui`.

### 3.0. Ý tưởng chủ đạo: "Gió hoá dòng tiền"

Sản phẩm biến gió ở An Viên thành điện, điện thành doanh thu, doanh thu thành lợi tức về ví nhà đầu tư. Giao diện lấy chính hành trình này làm ngôn ngữ:

- **Chuyển động theo hướng gió:** khối không xuất hiện đồng loạt mà lướt vào như một cơn gió qua hàng tua-bin (trái trước, phải sau, trên trước, dưới sau). Số "chảy" vào ô. Mở trang có một cơn gió quét qua. Cánh quạt quay là nhịp sống của hệ thống.
- **Màu có nghĩa:** xanh BIDV là token và năng lượng (WPT, sản lượng, dự án); vàng BIDV là tiền (VNDB, lợi tức, hạn mức). Mỗi màn có tối đa một ô nổi bật xanh và một ô nổi bật vàng.
- **Sidebar "trụ tua-bin"** (rộng 252 px, hàng 36 px, chữ 13 px): mục đang mở là viên nang mực có icon vàng, có vệt sáng chạy; viên nang mờ trượt theo chuột (đàn hồi); số việc chờ có nhịp sáng; chân sidebar có cụm tua-bin quay. Thu gọn được thành thanh icon (FE-UX-X4).
- **Header "đường chân trời":** thanh nổi có nền chuyển sắc trắng sang xanh rất nhạt và bóng mềm để tách khỏi nền nội dung; viền dưới chuyển màu lục vàng có vệt sáng chạy; nút tua-bin trước breadcrumb. **Ẩn khi cuộn xuống, hiện lại khi cuộn lên.** Chain và Vai trò là nút viên hai dòng (nhãn và giá trị) mở **menu xổ xuống phía dưới header** (listbox tự dựng, có bàn phím: mũi tên, Enter, Esc), không dùng menu gốc của hệ điều hành vì trên macOS menu gốc mở đè lên header. Vẫn đủ lựa chọn như dropdown hiện tại, Stellar vẫn hiện nhưng không chọn được.
- **Không khí theo vai:** Giao dịch viên, Kiểm soát viên là "phòng điều khiển" (số liệu trước); Nhà đầu tư là "cửa sổ nhìn ra cánh đồng gió" (minh hoạ, video); Người bán là "nhà máy" (sản lượng và dòng tiền về vault).

### 3.1. Màu

| Vai trò | Light | Dark | Token shadcn |
|---|---|---|---|
| Nền trang | `#f1f4ef` | `#080f0b` | `--background` |
| Thẻ | `#ffffff` | `#0f1a13` | `--card`, `--popover`, `--sidebar` |
| Nền phụ (ô nhập, hàng tiêu đề bảng) | `#f4f7f3` | `#142219` | `--muted`, `--input` (nền) |
| Đường kẻ | `#e2e8e1` / `#eef2ed` | `#1f3226` / `#18291f` | `--border` |
| Chữ chính, phụ | `#0f1d15`, `#56675c` | `#edf5ef`, `#a2b4a8` | `--foreground`, `--muted-foreground` |
| Xanh BIDV (nút chính gradient, dữ liệu chính) | `#1a6b3c` sang `#22844a` | `#3ba366` | `--primary`, `--chart-1` |
| Xanh đậm (ô nổi bật) | gradient tròn `#22844a`, `#145a32`, `#0b3d22` | như Light | lớp tiện ích riêng |
| Vàng BIDV (Kết nối ví, số việc chờ, chuỗi thứ hai biểu đồ) | `#e0b44a` sang `#c9971c` | `#e0b44a` | `--accent`, `--chart-2` |
| Ô vàng nhạt | `#fbf1d6` | `#241d0b` | lớp tiện ích riêng |
| Nhãn trạng thái tốt, chờ, xấu, thông tin | `#e2f2e7`/`#0e4524`, `#fdf1d3`/`#6e4b00`, `#fde8e6`/`#8a1c13`, `#e6eef8`/`#1d3f6b` | `#15281c`/`#7dd6a0`, `#2a2212`/`#ecc06a`, `#2c1716`/`#f5a199`, `#142133`/`#9cc2f0` | biến thể Badge |

Mục menu đang chọn: nền mực, icon vàng (Light); nền vàng, chữ đen (Dark). Mọi chữ đạt tương phản 4,5:1.

### 3.2. Chữ, hình khối, khoảng cách

- Font **Be Vietnam Pro** 400, 500, 600, 700 (thiết kế cho tiếng Việt). Tiêu đề màn 28 px/700; tiêu đề thẻ 16 px/600; số KPI 28 px/700, ô nổi bật 48 px; chữ thường 14 px; nhãn phụ 12 px. Không chữ dưới 11 px. Không chữ hoa giãn chữ.
- Bo góc: thẻ 28 px (điện thoại 22 px), khối trong 18 px, ô nhập 14 px, nút và dropdown bo tròn hoàn toàn.
- Lưới bento 12 cột, khe 16 px, lề trang 32 px (điện thoại 16 px). Mỗi màn có một ô nổi bật xanh (con số chính) và tối đa một ô vàng nhạt.
- Bề mặt phẳng, không viền thẻ; bóng chỉ khi rê chuột và cho lớp nổi (menu, hộp thoại).

### 3.3. Biên đạo chuyển động (bản 3, chuyển động mềm)

Bản 2 dùng một đường cong `cubic-bezier` cho mọi thứ nên khối hiện ra nhanh, dừng gắt, cảm giác "cứng". Bản 3 đổi sang **lò xo**: vật có đà, về đích hơi lố một chút rồi lắng lại; độ mờ chỉ dịu dần, không nảy. Tham khảo cách làm của Motion, Motion Primitives, Kinetics (lò xo), MicroKit UI (vi tương tác), Anime.js; không chép mã của các thư viện đó.

**Token đường cong** (sinh từ phương trình lò xo tắt dần, xem `--sp-*` trong `assets/c.css`):

| Token | Hệ số tắt dần | Vượt đích | Dùng cho |
|---|---|---|---|
| `--sp-soft` | 0,85 | khoảng 0,6% | Nội dung vào trang, số lăn, thanh tiến độ, vòng đo, thanh trên |
| `--sp-gentle` | 0,72 | khoảng 4% | Điều khiển: dropdown, viên nang chuyển trang, cột biểu đồ, thẻ nhấc lên |
| `--sp-bounce` | 0,55 | khoảng 12% | Phản hồi bấm: nút bật lại, icon nảy, điểm biểu đồ, dấu tích đã chép |
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` | không | Độ mờ, nhoè, ánh sáng |

Lò xo vật lý trong JS (`spring({ k, c })`) dùng cho thứ đi theo con trỏ: khi đích đổi giữa chừng vẫn giữ vận tốc, nên lướt nhanh qua nhiều mục vẫn liền một dải.

| Đối tượng | Hiệu ứng | Thông số |
|---|---|---|
| Tiêu đề trang, tiêu đề mục trang giới thiệu | Hiện **từng từ**: thấp, nhoè, mờ rồi rõ dần | `--sp-soft` 1,1 s, cách nhau 55 ms mỗi từ |
| Chữ nhấn ở tiêu đề trang giới thiệu | Ánh kim chạy qua chữ vàng | 4,5 s, lặp |
| Icon 3D cạnh tiêu đề | Nảy ra rồi bồng bềnh nhẹ | `--sp-bounce` 1 s; trôi 5 s |
| Ô nổi bật xanh, vàng | Màn mở trái sang phải, cả khối phóng nhẹ, nội dung và minh hoạ vào sau | mở 1,3 s; khối `--sp-soft` 1,5 s; nội dung trễ 0,3 s |
| Ô số liệu thường | "Cơn gió": lướt từ trái, nghiêng nhẹ | chuyển động `--sp-soft` 1,4 s, độ hiện 0,9 s |
| Thẻ nội dung | Nhấc lên 22 px, thu nhỏ 3% rồi về | chuyển động `--sp-soft` 1,25 s, độ hiện 0,8 s |
| Hàng trong bảng, danh sách | Lần lượt sau thẻ chứa, nhô lên 10 px | trễ 0,3 s rồi 45 ms mỗi hàng, tối đa 16 hàng |
| Thứ tự trong một đợt, kích hoạt | Giữ như bản 2: khối trái và trên tới trước; chỉ chạy khi cuộn tới (ngưỡng 8%) | 0,06 đến 0,9 s |
| Số liệu | **Số lăn** (odometer): mỗi chữ số một cột cuộn qua ít nhất một vòng rồi dừng bằng lò xo, cột bên phải dừng trước | `--sp-soft` 1,9 s, lệch 70 ms mỗi cột; đọc màn hình đọc số cuối qua `aria-label` |
| Thanh tiến độ, vòng đo | Chạy tới giá trị, lắng nhẹ | `--sp-soft` 1,6 s và 1,9 s |
| Biểu đồ đường, vùng | Nét đường **tự vẽ** từ trái; vùng dâng lên; điểm nảy ra khi nét vẽ tới | 1,8 s; vùng `--sp-soft` 1,6 s; điểm `--sp-bounce` 0,8 s |
| Biểu đồ cột | Cột mọc từ đáy, lệch nhau | `--sp-gentle` 1,2 s, 70 ms mỗi cột |
| Chú giải biểu đồ | Đường dóng và hộp chú giải **trượt** sang kỳ mới thay vì nhảy | lò xo k 300, c 30 |
| Menu bên trái | Viên nang đậm (mục đang mở) và viên nang mờ (rê chuột) chạy bằng lò xo vật lý, **kéo giãn theo vận tốc** như giọt nước; icon nảy khi rê, nhún khi bấm. Khi đổi trang, viên nang đậm **trượt từ mục cũ sang mục mới** (View Transitions, `view-transition-name: navpill`) | lò xo k 210 đến 320; chuyển trang `--sp-gentle` 0,7 s |
| Nhóm nút chuyển (Mua, Bán) và tab | Viên nang chỉ mục đang chọn **trượt** sang mục mới (như "animated background") | lò xo k 260, c 26 |
| Thẻ, ô số liệu khi rê chuột | Ánh sáng theo con trỏ trễ mềm; ô số liệu nghiêng tối đa 5 đến 6 độ; nhấc 4 px bằng lò xo; thả ra về chậm | lò xo k 120 đến 140 |
| Nút | Nhích lên khi rê; **nhún 5%** khi bấm rồi bật lại; nút chính có **lực hút nhẹ** theo con trỏ (magnetic) | `--sp-bounce` 0,7 s; hút 22% đến 30% độ lệch |
| Icon nét | Khi rê chuột, nét icon **vẽ lại** từ đầu (menu, nút, ô số liệu, liên kết "Xem thêm") | 0,75 s, nét sau trễ 80 ms |
| Dropdown Chain, Vai trò | Mở bằng lò xo, các dòng lần lượt; chevron xoay nảy | `--sp-gentle` 0,6 s |
| Thanh trên | Ẩn khi cuộn xuống, hiện khi cuộn lên bằng lò xo | `--sp-soft` 0,8 s |
| Nút sao chép (Ví của tôi) | Icon chép đổi thành dấu tích nảy ra | `--sp-bounce` 0,7 s |
| Đổi Sáng, Tối | **Vòng tròn lan ra từ nút** đổi giao diện (View Transitions); trình duyệt chưa hỗ trợ thì đổi ngay | 0,8 s |
| Chuyển trang | Nội dung cũ mờ, thu nhẹ; nội dung mới nhô lên bằng lò xo; sidebar và thanh trên đứng yên | 0,3 s ra; `--sp-soft` 0,8 s vào |
| Trang giới thiệu | Cuộn mượt có quán tính (FE-DEP-2); cảnh tua-bin màn đầu trôi chậm hơn nội dung (thị sai, CSS scroll-driven); ảnh dự án trượt nhẹ khi cuộn qua | theo cuộn |
| Nền, mở trang | Giữ như bản 2 (quầng sáng trôi chậm, cơn gió quét qua khi mở trang) | |
| Giảm chuyển động | `prefers-reduced-motion` tắt toàn bộ, số hiện ngay, không tách chữ, không cuộn mượt | |

Nguyên tắc: chỉ động vào `transform`, `opacity`, `filter`, `clip-path` (và `translate`, `scale` tách riêng); không chặn thao tác trong lúc chạy; không hiệu ứng nào kéo dài thời gian chờ dữ liệu; mỗi màn chỉ một nhịp vào trang.

**Cách làm trong Next.js (không cần gói mới):**

| Phần | Cách làm |
|---|---|
| Token `--sp-*` | Thêm vào `globals.css` cùng nhóm token màu; dùng qua class Tailwind tuỳ ý (`ease-[var(--sp-soft)]`) |
| Hook `useSpring` | `components/motion/use-spring.ts`: cập nhật bằng `requestAnimationFrame`, ghi thẳng vào `style` qua ref (không `setState` mỗi khung hình) |
| `<NavPill>`, `<SegIndicator>` | Đo vị trí mục đang chọn bằng ref, đẩy vào `useSpring`. Nếu FE-DEP-1 được duyệt thì thay bằng `motion.span layoutId` |
| `<Odometer value>` | Định dạng bằng `lib/format.ts` có sẵn rồi tách thành cột; `aria-label` là chuỗi đã định dạng |
| `<WordReveal>` | Tách chữ tiêu đề thành từ ở phía client, không đổi nội dung |
| recharts | Dùng `isAnimationActive`, `animationDuration`, `animationEasing` có sẵn; điểm và cột nảy bằng `shape` tuỳ biến hoặc CSS trên class |
| Đổi theme | Bọc `setTheme` của next-themes trong `document.startViewTransition` khi trình duyệt hỗ trợ |
| Chuyển trang | CSS `@view-transition` hoặc `unstable_ViewTransition` của React khi bản Next đang dùng hỗ trợ; không thì bỏ, không ảnh hưởng chức năng |

### 3.4b. Ô theo ngữ nghĩa

| Lớp | Dùng cho | Hình thức |
|---|---|---|
| `kpi hl` | Con số token hoặc năng lượng chính của màn | Gradient xanh đậm, sọc gió mảnh, minh hoạ cánh đồng gió |
| `kpi au` | Con số tiền chính của màn | Gradient vàng đậm có vệt sáng chạy, cột đồng xu VNDB (ô lớn) |
| `kpi leaf` | Token hoặc năng lượng phụ | Xanh nhạt, sọc gió ở góc |
| `kpi gold` | Tiền phụ | Vàng nhạt, vân vành đồng xu ở góc |
| `kpi` | Số đếm, trạng thái | Trắng |

Ví dụ ô "Tối đa một lần" ở màn Nạp VNDB: ô vàng đậm, cột đồng xu ở giữa, con số đặt chính giữa ô.

### 3.4. Biểu tượng và mũi tên

Bộ lucide hiện có, nét 1,7, có hiệu ứng **vẽ lại nét** khi rê chuột (mục 3.3). Icon 3D (FE-DEP-3, cần duyệt) chỉ dùng ở chỗ trang trí: ô cạnh tiêu đề mỗi trang (Bảng điều khiển lá gió, Lập lệnh giấy bút, Giao dịch sổ cái, Chia lợi nhuận túi tiền, Vault toà nhà, Phê duyệt cán cân, Ví thẻ, ...) và các chặng, vai, thẻ minh bạch ở trang giới thiệu. Menu, nút, ô số liệu vẫn dùng icon nét để gọn và đồng bộ. Mũi tên chỉ là icon: liên kết "Xem thêm" có mũi tên trượt sang phải khi rê chuột, "Về danh sách" trượt sang trái; breadcrumb dùng chevron mờ. Không dùng ký tự mũi tên, chấm giữa, gạch ngang dài trong chữ hiển thị.

### 3.5. Minh hoạ

Minh hoạ vẽ bằng SVG trong `ui.js` (không dùng ảnh): `scene` (cánh đồng gió ven biển có đồi, biển, mặt trời, tua-bin quay ở nhiều độ xa, luồng gió), `coins` (cột đồng xu VNDB rơi lần lượt), `emblem` (huy hiệu WPT lục giác), `turbine` (tua-bin nhỏ). Kiro chuyển thành component React thuần SVG, không thêm thư viện.

### 3.6. Tài sản hình ảnh tạm, chủ dự án thay sau

Môi trường thử nghiệm không truy cập được các kho ảnh và logo bên ngoài, nên bản xem thử dùng tạm như sau:

| Tài sản | Đang dùng tạm | Cần thay bằng | Vị trí |
|---|---|---|---|
| Logo BIDV | Logo SVG có sẵn trong dự án (`components/bidv-logo.tsx`) | Bộ logo SVG chính thức (ngang, biểu tượng, nền sáng và tối), màu và font thương hiệu | Sidebar, trang lối vào |
| Ảnh dự án điện gió | Minh hoạ SVG `scene` | 3 đến 5 ảnh thật 16:9 từ 2400 px (toàn cảnh flycam, cận cánh quạt, bình minh) | Ô WPT ở Bảng điều khiển, Tổng quan và Chi tiết token của Nhà đầu tư, trang lối vào |
| Ảnh từng dự án | Tua-bin SVG | Ảnh vuông từ 800 px của An Viên, Phú Quý, Ninh Thuận | Thẻ dự án, danh sách token |
| Icon 3D | Fluent Emoji 3D (MIT), 21 tệp webp trong `assets/3d/` | Bộ icon 3D theo nhận diện BIDV (nếu có), cùng tên tệp để thay thẳng | Cạnh tiêu đề trang, trang giới thiệu |
| Video giới thiệu | YouTube `M52hkUDVe5w` (clip chủ dự án gửi), nhúng `youtube-nocookie` ở giữa trang chủ. Trình xem artifact chặn khung nhúng ngoài nên ở đó hiện ảnh nền và nút phát mở YouTube; mở tệp trên máy hoặc trong app thì phát tại chỗ | Video chính thức (MP4 tự lưu trữ để không phụ thuộc YouTube và CSP, hoặc kênh BIDV) | Trang chủ (FE-UX-X5); dải đề xuất ở Tổng quan Nhà đầu tư (FE-UX-X3) |

---

## 4. Bố cục từng màn (21 trang trong bản xem thử)

| Vai | Trang | Màn thật | Điểm chính của bố cục mới |
|---|---|---|---|
| GDV, KSV | `dashboard.html` | `/` | Ô WPT đã phát hành lớn bên trái, 3 KPI bento, biểu đồ hai trục, phân bổ WPT, 3 thẻ dự án có vòng đo hệ số công suất |
| GDV | `draft.html` | `/draft` | 2 ô chờ (xanh, vàng), hai thẻ Tạo và Huỷ cạnh nhau, bảng yêu cầu đã lập |
| GDV, KSV | `transactions.html` | `/transactions` | 3 ô nguồn cung, 6 bộ lọc, bảng đủ cột, cột Hành động chỉ GDV, phân trang |
| GDV, KSV | `transaction-detail.html` | `/transactions/[id]` | 3 ô Giá trị, Số lượng, Giá; tiến trình 5 bước; bút toán; nhật ký dạng dòng thời gian |
| KSV, GDV | `distribution.html` | `/distribution` | Quỹ chia bento, thẻ Duyệt chia chỉ KSV, dự kiến, kỳ hoạt động, lịch sử kỳ, hồ sơ trả từng ví, lịch chạy |
| KSV, GDV | `vault.html` | `/vault` | 15 ô trạng thái chia 3 nhóm, cấu hình khoá (KSV sửa, GDV chỉ xem), lệnh rút cần xem xét, hai bảng lịch sử |
| GDV | `demo-payment.html` | `/demo-payment` | Cảnh báo trình diễn, form nạp, ô trần một lần nạp màu vàng, lịch sử |
| Mọi vai | `account.html` | `/account` | Thẻ hồ sơ xanh, các mục theo vai, thẻ ví liên kết chỉ NĐT và NB |
| KSV | `approvals.html` | `/approvals` | 3 ô thống kê, hai hàng chờ mỗi hàng có tìm kiếm và dropdown trạng thái, bảng đủ 9 cột |
| KSV | `approval-detail.html` | `/approvals/[id]` | Khối Hành động trên cùng, nội dung yêu cầu 12 trường, thông tin token, nhật ký |
| NĐT | `portfolio.html` | `/portfolio` | Ô tài sản xanh, trạng thái phát hành, giao dịch gần đây, danh sách token, giữ nhãn ON-CHAIN và DỮ LIỆU MẪU |
| NĐT | `token-detail.html` | `/tokens/[symbol]` | Vị thế, thông tin dự án, thông tin token, tình hình vận hành 6 kỳ |
| NĐT | `trade.html` | `/trade` | Form đặt lệnh, nút Mua và Bán, 5 điều kiện, tóm tắt lệnh nền xanh, thông tin token |
| NĐT | `orders.html` | `/orders` | 5 bộ lọc, bảng 8 cột sắp xếp được |
| NĐT | `order-detail.html` | `/orders/[id]` | Như chi tiết giao dịch, phía nhà đầu tư |
| NĐT | `withdraw.html` | `/withdraw` | Giữ đúng màn chờ FE-23 |
| NĐT, NB | `wallet.html` | `/wallet` | Thẻ ví xanh, số dư ETH ô vàng, 8 trạng thái ví |
| NB | `seller.html` | `/seller` | 4 ô khớp lệnh, nguồn cung, thông tin token, tồn kho, tài sản ví thanh toán, số dư ví |
| NB | `seller-transactions.html` | `/seller/transactions` | 5 bộ lọc, bảng 9 cột, phân trang; điện thoại mỗi giao dịch một thẻ |
| NB | `seller-withdraw.html` | `/seller/withdraw` | Form rút, khối hệ thống tính với ô số tiền nhận được nổi bật, bảng yêu cầu, hộp mã một lần |
| | `index.html` | (trang mới, FE-UX-X5) | Trang chủ giới thiệu dự án có video; cuối trang có "Sơ đồ trang xem thử" chỉ để duyệt |

Một số trang có thêm thanh "Trạng thái xem thử" hoặc thẻ "Xem thử" để chủ dự án xem các trạng thái khác của cùng màn (chưa kết nối ví, rỗng, lỗi). Phần này **không đưa vào app**.

---

## 5. Lệch phát hiện trong màn hiện tại (không tự sửa trong đợt UI)

Chi tiết ở mục "Lệch đã thấy" của từng `notes/*.md`. Các điểm đáng chú ý:

1. Tổng quan Nhà đầu tư nói chưa đọc được số dư VNDB ("chờ BE-01"), trong khi màn Giao dịch token đã hiện số dư (L-29 UserGuide).
2. Tổng quan Nhà đầu tư trên chain mock chỉ dùng ví trình duyệt, các màn khác dùng ví hồ sơ (L-03 UserGuide).
3. Mã lệnh, mã yêu cầu cắt còn 8 ký tự ở bảng và breadcrumb; ô lọc "Mã lệnh (UUID)" khó dùng.
4. Định dạng thời gian không thống nhất (`toLocaleString` và `formatDateTime`); số trong câu máy chủ dựng không có dấu nghìn; mã trạng thái tiếng Anh thô ở vài bảng.
5. Cùng một trạng thái bước quyết toán có hai nhãn khác nhau ở màn Giao dịch và màn chi tiết.
6. Màn Ví của Người bán vẫn ghi breadcrumb "Nhà đầu tư"; tên menu "Kết nối ví" khác tiêu đề "Ví của tôi".
7. Nhãn ON-CHAIN ở thẻ Thông tin token (chi tiết token) phủ cả trường đọc từ cấu hình.
8. Rút gọn địa chỉ không thống nhất (8 hoặc 10 ký tự) giữa các màn.

Các điểm 3 đến 8 sửa được thuần frontend nhưng làm đổi chữ hoặc dữ liệu người dùng thấy, nên cần chủ dự án duyệt từng điểm.

---

## 6. Điều kiện nghiệm thu

1. Đối chiếu từng màn với `notes/<trang>.md`: đủ mọi trường, không thêm, không bớt.
2. Diff chỉ chạm các tệp ở mục 1.1. `git diff --stat` của PR không có tệp ở mục 1.2.
3. Mỗi màn tối đa một server action khi mở (HF-01), đo như checkpoint HF-01.
4. `npm run typecheck`, `npm test`, `npm run test:e2e` xanh.
5. Ảnh chụp Light và Dark, 1440 và 390 px cho mỗi màn đã làm; không tràn ngang ở 390 px; font Be Vietnam Pro nạp thật.
6. Không còn ký tự mũi tên, chấm giữa, gạch ngang dài trong chữ do frontend dựng.
7. UserGuide cập nhật Phần 2, 3 cho màn bị đổi giao diện.
8. Chuyển động: đúng token và thông số mục 3.3; bật "giảm chuyển động" của hệ điều hành thì mọi nội dung hiện ngay; không giật khung hình khi cuộn ở 1440 px (Performance của Chrome không có khung đỏ kéo dài); số lăn đọc được bằng trình đọc màn hình.

---

## 7. Đề xuất chia task

| Thứ tự | Task | Gồm |
|---|---|---|
| 1 | FE-UX-01 Nền | UX-01 đến UX-04, token màu, font, khung (sidebar, thanh trên, dropdown), thành phần `components/ui` |
| 2 | FE-UX-02 Vận hành | dashboard, draft, transactions, transaction-detail, demo-payment |
| 3 | FE-UX-03 Kiểm soát | approvals, approval-detail, distribution, vault |
| 4 | FE-UX-04 Nhà đầu tư | portfolio, token-detail, trade, orders, order-detail, withdraw, wallet |
| 5 | FE-UX-05 Người bán và tài khoản | seller, seller-transactions, seller-withdraw, account |

Mỗi task một PR, checkpoint ghi "Phạm vi: chỉ frontend" kèm danh sách tệp đã sửa.

---

## 8. Câu hỏi cần chủ dự án chốt

- Q1. Có gộp FE-UX-X1 (số bán ở Tổng quan Người bán) vào đợt UI không?
- Q2. FE-UX-X2: giữ hay ẩn "Kết nối ví" với hai vai vận hành?
- Q3. Duyệt từng điểm lệch 3 đến 8 ở mục 5 (sửa trong đợt UI hay để task riêng).
- Q4. BE-UX-1, BE-UX-2: có mở task backend hoặc dữ liệu mẫu riêng không.
- Q5. FE-UX-X3 (dải video giới thiệu ở Tổng quan Nhà đầu tư) và FE-UX-X4 (thu gọn sidebar): duyệt hay bỏ.
- Q6. Cung cấp logo SVG chính thức, ảnh thật dự án và video chính thức theo mục 3.6.
- Q7. Duyệt hay không FE-DEP-1 (`motion`), FE-DEP-2 (`lenis`, chỉ trang giới thiệu), FE-DEP-3 (icon 3D) ở mục 1.3. Không duyệt thì vẫn làm được toàn bộ chuyển động mềm bằng CSS và hook tự viết.
