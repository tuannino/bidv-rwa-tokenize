# Bàn giao nâng cấp UI/UX cho Supervisor: bản chốt đồng bộ dev `67ece1e`

| | |
|---|---|
| Ngày | 01/11/2026 |
| Mốc mã nguồn | nhánh `dev` @ `67ece1e` (Merge PR #78, IN-04 Fireblocks). Bản xem thử đã đồng bộ với mọi thay đổi giao diện từ `f164939` đến `67ece1e` (35 commit gồm 26 commit nội dung và 9 merge: FE-07, IN-01, BE-05, FE-10, UIUX-01, FIX-01, FE-23, FIX-02, IN-04) |
| Loại tài liệu | Requirement bàn giao. Session thử nghiệm **không sửa mã sản phẩm, không merge**. Toàn bộ kết quả là tài liệu và bản xem thử HTML tĩnh |
| Bản xem thử | `docs/prototypes/20261101_ui_ux_ban_chot/` (mở `index.html`; 23 màn của 4 vai và trang giới thiệu; Sáng và Tối; máy tính và điện thoại). Ghi chú ánh xạ 1-1 từng màn ở `notes/<màn>.md` cùng thư mục |
| Thay thế | `docs/20261023_UI_UX_UPGRADE_REQUIREMENT.md` (nhật ký các vòng thử, giữ để tra cứu) và bản 1 của tài liệu đó đang nằm trên `dev` (commit `f11f1ae`, bản mẫu `docs/prototypes/20261023_ui_ux/`), đã lỗi thời |
| Bản mẫu trung gian | Mẫu C, bản 3.2, bản 12 (`docs/prototypes/20261023_ui_ux_mau_c`, `20261101_ui_ux_ban_3_2`, `20261101_ui_ux_ban_12`) chỉ nằm trên nhánh `docs/ui-ux-mau-c` @ `ac5c313`, không đưa vào `dev`; trên `dev` chỉ có bản chốt `docs/prototypes/20261101_ui_ux_ban_chot/` |
| Phạm vi | **Chỉ frontend.** Không màn nào cần sửa backend để đạt giao diện này (mục 2.4) |

Tài liệu này đủ để Kiro hiện thực mà không cần đọc lịch sử các vòng thử. Thứ tự đọc: mục 1 (quyết định), mục 2 (phạm vi mã, bắt buộc), mục 4 và 5 (hệ thiết kế, khung), mục 6 (danh sách màn), mục 8 (nghiệm thu).

---

## 1. Quyết định của chủ dự án (đã chốt)

| Mã | Quyết định |
|---|---|
| QĐ-1 | Light là giao diện mặc định; Dark là ưu tiên thứ hai |
| QĐ-2 | **Không thay đổi feature**: mọi biểu đồ, lịch sử, trường, bộ lọc, nút, câu chữ, nhãn nguồn dữ liệu, điều kiện theo vai của màn hiện tại phải có đủ. Chỉ sắp xếp và trình bày lại. Vai trò và Chain giữ dạng dropdown |
| QĐ-3 | **Chỉ sửa frontend**, dữ liệu ánh xạ 1-1, độc lập với backend. Chỗ nào buộc phải đụng backend thì giải trình và báo chủ dự án duyệt trước khi làm |
| QĐ-4 | Màu thương hiệu **xanh ngọc** của logo BIDV (`#016B69`), vàng bông mai (`#FEC629`); tông lục cũ đổi hết sang xanh ngọc |
| QĐ-5 | Font **Roboto** (300, 400, 500, 700, nghiêng) cho toàn bộ; **Roboto Condensed** cho địa chỉ ví, mã băm, mã kỹ thuật |
| QĐ-6 | Logo BIDV giữ nguyên hình; **phương án A** (logo, vạch mảnh, "RWA" trên "Tokenize Platform") cho trang giới thiệu, tài liệu, slide; **phương án C** (logo trên, "RWA Tokenize Platform" dưới) cho ứng dụng; dưới 40 px chỉ giữ bông mai trên ô xanh ngọc (favicon, thanh thu gọn) |
| QĐ-7 | **Bản chốt** = nội dung, thẻ, màu, nền, minh hoạ, biểu tượng, hiệu ứng của **bản 3.2** (bản 3 tông xanh ngọc), kết hợp **thanh bên và thanh đầu của bản 12** |
| QĐ-8 | Không dùng ký tự mũi tên, chấm giữa, gạch dài trong chữ do frontend dựng; mũi tên nếu có phải là biểu tượng |
| QĐ-9 | Trang giới thiệu dự án là một trang riêng (sẽ cải thiện sau); video tạm `M52hkUDVe5w` |
| QĐ-10 | Logo, ảnh, video, icon 3D trong bản xem thử là tạm để thử giao diện, chủ dự án thay sau (mục 9) |
| QĐ-11 | Khung theo bản 12: Vai trò ở đầu thanh bên, Chain ở đáy thanh bên, "Kết nối ví" và nút sáng tối ở góc phải thanh đầu; thanh đầu giữ khi cuộn, co lại còn tên màn trên nền xanh trầm; **bỏ dòng phụ phía trên tiêu đề** (crumb nhóm như "Vận hành", "Nhà đầu tư"), chỉ để tiêu đề chính |
| QĐ-12 | Thanh bên thu gọn được (nút chỉ biểu tượng, không khung, ở đáy bên phải); mọi dropdown và chuyển rộng hẹp chuyển động mượt (lò xo) |
| QĐ-13 | Nền theo bản 3.2: vầng gradient mờ xanh ngọc và vàng trôi rất chậm, đường gió đứt nét rất nhạt; không hiệu ứng cực quang, không nhiễu hạt |

---

## 2. Phạm vi mã tác động (bắt buộc tuân thủ)

### 2.1. Được sửa: lớp trình bày

| Nhóm | Tệp (theo `dev` @ `67ece1e`) | Được làm | Không được làm |
|---|---|---|---|
| Màu, font | `app/src/app/globals.css`, `app/src/app/layout.tsx` | Thay token màu Light, Dark (mục 4.2); nạp Roboto, Roboto Condensed qua `next/font/google` | Đổi `ConfigProvider`, `publicConfig()` |
| Theme | `app/src/components/providers.tsx` | `defaultTheme="light"`, màu theme RainbowKit | Đổi Wagmi, QueryClient, cấu hình ví |
| Thành phần nền | `app/src/components/ui/*` (kể cả `amount-input.tsx`) | Kiểu dáng (class), biến thể mới chỉ về hình thức | Đổi API props, đổi cách parse số của `AmountInput` |
| Khung | `app/src/components/layout/*`: `app-layout.tsx`, `sidebar.tsx`, `header.tsx`, `custody-toggle.tsx`, `chain-selector.tsx`, `channel-switcher.tsx`, `channel-guard.tsx`, `bidv-logo.tsx` | Markup, class, vị trí, chuyển động (mục 5) | Đổi `NAV_BY_ROLE`, `withHiddenOps`, `roleHomeHref`, cách đọc số việc chờ, `setFireblocksCustodyAction`, `custodyNotes`, điều kiện `custody:toggle`, `investor:whitelist`, `canMintDemoPayment`, logic `ChannelGuard` |
| Màn hình | `app/src/components/pages/*.tsx`, `components/investor/*`, `components/maker-checker/*.tsx`, `components/trading/*.tsx` (trừ `gates.ts`, `sides.ts`), `components/recall/*.tsx` (trừ `gates.ts`), `components/wallet/*.tsx`, `components/withdraw/*` (chỉ phần JSX) | Bố cục JSX, class, biểu đồ recharts (màu, kiểu, animation), icon, hiệu ứng | Đổi lời gọi server action hoặc API (tên, tham số, số lần gọi khi mở màn), đổi state nghiệp vụ, đổi điều kiện khoá nút, đổi câu chữ lấy từ `labels.ts`, `gates.ts` |
| Chữ hiển thị trong JSX | chuỗi JSX trong các tệp trên | Đổi dấu chấm giữa, gạch dài thành dấu phẩy; sửa chính tả | Đổi nghĩa câu, bỏ câu hướng dẫn |
| Chuyển động | `app/src/components/motion/*` (thư mục mới) | Hook lò xo, số lăn, viên nang trượt, tách chữ tiêu đề, hiệu ứng vào trang | Gọi dữ liệu, đổi state nghiệp vụ |
| Ảnh tĩnh | `app/public/brand/*`, `app/public/3d/*` | Logo vector, favicon, icon 3D tạm | |
| Kiểm thử e2e | `app/e2e/*` | Sửa selector khi markup đổi | Bỏ bước kiểm, nới điều kiện |

### 2.2. Không được sửa (backend và logic dùng chung)

`app/src/app/actions/*`, `app/src/app/api/*`, `app/src/lib/**` (bank, ledger, signer, rbac, store, session, config, chains, providers, wallet, hooks, format, `txn-labels.ts`, `role-labels.ts`, `mock-data.ts`), mọi tệp `gates.ts` (`maker-checker`, `trading`, `recall`), `components/trading/sides.ts`, `components/withdraw/labels.ts`, `components/maker-checker/token-info-read.ts`, `app/prisma/*`, `packages/*`, `scripts/*`, `docker-compose.yml`, `app/wrangler.json`, `.env*`. Ba LUẬT (`ILedgerPort`, `ISigner`, `can()`) và luật hiệu năng HF-01 (mỗi màn tối đa một server action khi mở) giữ nguyên.

`lib/format.ts` là định dạng hiển thị nhưng dùng chung với máy chủ; cần định dạng khác thì viết hàm mới trong `components/`, không sửa hàm cũ.

### 2.3. Phụ thuộc

Không thêm gói npm. Roboto, Roboto Condensed nạp qua `next/font/google` (có sẵn trong Next), subsets `latin`, `vietnamese`. Biểu đồ giữ `recharts`. Chuyển động viết bằng CSS (`linear()` cho đường cong lò xo, View Transitions) và một hook lò xo nhỏ trong `components/motion/` (bản xem thử: hàm `spring()` trong `assets/ui.js`, `assets/shell.js`).

Tuỳ chọn, **cần chủ dự án duyệt** nếu muốn dùng (đều chỉ frontend):

| Mã | Hạng mục | Giấy phép | Nếu không duyệt |
|---|---|---|---|
| FE-DEP-1 | Gói `motion` (cho viên nang menu, tab bằng `layoutId`) | MIT | Hook lò xo tự viết, kết quả tương đương |
| FE-DEP-2 | Gói `lenis` (cuộn mượt, chỉ trang giới thiệu) | MIT | Cuộn gốc |
| FE-DEP-3 | 21 ảnh icon 3D Fluent Emoji (116 KB, `app/public/3d/`, không phải gói npm) | MIT | Bỏ icon 3D cạnh tiêu đề trang |

### 2.4. Kết luận đụng backend

**Không có hạng mục nào của đợt UI cần sửa backend.** Đã rà từng màn (mục "Có đụng backend" trong 23 ghi chú `notes/*.md`) và rà soát độc lập (mục 10). Mọi trường trên giao diện mới trỏ về một trường dev đang hiển thị.

Các điểm dưới đây là **lỗi hoặc lệch hiển thị nằm ở backend**, phát hiện khi đồng bộ; bản xem thử **không** đổi hành vi, chỉ thay ký tự cấm khi hiển thị. Nếu chủ dự án muốn sửa thì mở task backend riêng, không gộp vào đợt UI:

| Mã | Nội dung | Nơi phát sinh |
|---|---|---|
| BE-UX-1 | Chuỗi do máy chủ dựng còn gạch dài, chấm giữa, số không dấu nghìn, mã trạng thái tiếng Anh thô (câu điều kiện, nhật ký kiểm toán, lịch sử nạp VNDB, câu thành công Nạp VNDB, bước lưu cấu hình vault) | `lib/bank/*` |
| BE-UX-2 | Câu cảnh báo đổi giá vượt ngưỡng in số thô và đơn vị "VND" (màn dùng "VNDB") | `lib/bank` dịch vụ cấu hình giá |
| BE-UX-3 | Số mẫu bảng điều khiển phi lý: 86,4 tỷ lợi tức cho 335.000 WPT giá 100.000 VNDB | `lib/mock-data.ts` |
| BE-UX-4 | "Lý do" của đợt thu hồi vẫn là lý do lúc mở đợt sau khi Sửa mốc hoặc Huỷ đợt (lý do mới chỉ ghi vào nhật ký kiểm toán) | dịch vụ thu hồi |

---

## 3. Lỗi nền phải sửa trước (P0)

Kiểm lại trên `dev` @ `67ece1e`: cả bốn lỗi vẫn còn.

| Mã | Lỗi | Bằng chứng (dev `67ece1e`) | Cách sửa (frontend) |
|---|---|---|---|
| UX-01 | Toàn app hiển thị bằng font mặc định có chân (Times): `--font-sans: var(--font-sans)` tự trỏ vào chính nó | `app/src/app/globals.css:10`; `layout.tsx` chỉ nạp `Geist_Mono` | Nạp **Roboto** (300, 400, 500, 700, nghiêng; `latin`, `vietnamese`) và **Roboto Condensed** (400, 500) qua `next/font/google`, gán `--font-sans` và `--font-code`; bỏ Geist Mono |
| UX-02 | Sửa xong UX-01 thì 173 chỗ `font-mono` ở 41 tệp sẽ hiện thật thành chữ đơn cách | quét `grep -rn font-mono --include=*.tsx` | Số tiền, số lượng, ngày giờ: Roboto với `tabular-nums`. Roboto Condensed chỉ cho địa chỉ ví, mã băm, UUID, mã kỹ thuật (`order:place`, `ETH_TEST5`) |
| UX-03 | Mặc định Dark | `components/providers.tsx:29, 45` (`defaultTheme="dark"`) | `defaultTheme="light"`, sửa nhánh trước khi mount của RainbowKit cho khớp |
| UX-04 | Điện thoại: thanh bên 240 px không gập, tiêu đề vỡ dòng ở 390 px | `components/layout/sidebar.tsx:126` (`w-60`) | Thanh bên thành ngăn kéo dưới 1100 px, nút mở menu ở thanh đầu (mục 5.1, 5.2) |

---

## 4. Hệ thiết kế

Nguồn chuẩn trong bản xem thử: `assets/c.css` (token, thẻ, bảng, nút, ô số liệu, hiệu ứng nội dung), `assets/ui.js` (minh hoạ SVG, biểu đồ, số lăn, chuyển động), `assets/shell.css` và `assets/shell.js` (thanh bên, thanh đầu), `assets/logo.js` (logo BIDV vector hoá, tạm). Kiro chuyển sang Tailwind v4 và token shadcn trong `globals.css`; khung và hiệu ứng viết thành component React.

### 4.1. Ý tưởng

"Gió hoá dòng tiền": gió thành điện, điện thành doanh thu, doanh thu thành lợi tức về ví nhà đầu tư. **Xanh ngọc** là token và năng lượng (WPT, sản lượng, dự án); **vàng** là tiền (VNDB, lợi tức, hạn mức). Mỗi màn có một điểm trọng tâm rõ (ô số liệu chính), các khối còn lại nhẹ, thẻ trắng trên nền có vầng màu rất nhạt.

### 4.2. Màu (token của `c.css`, đã đổi tông lục sang xanh ngọc)

| Vai trò | Light | Dark | Token shadcn |
|---|---|---|---|
| Nền trang | `#eff4f4` | `#080f0f` | `--background` |
| Thẻ | `#ffffff` | `#0f1a1a` | `--card`, `--popover` |
| Nền phụ (ô nhập, tiêu đề bảng) | `#f3f7f7` | tương ứng trong `c.css` | `--muted`, `--input` |
| Đường kẻ | `#e1e8e8` | tương ứng trong `c.css` | `--border` |
| Chữ chính, chữ phụ | `#0e1e1d`, `#556867` | `#edf5f5`, `#a2b4b4` | `--foreground`, `--muted-foreground` |
| Thương hiệu xanh ngọc (logo) | `#016B69` | `#016B69` | `--brand` (mới) |
| Xanh ngọc giao diện (nút chính, dữ liệu chính) | `#176e6d`, `#1e8886`, `#37a7a5` | như Light, sáng hơn một bậc | `--primary`, `--chart-1` |
| Vàng (Kết nối ví, việc chờ, chuỗi thứ hai biểu đồ) | `#c9971c`, `#e0b44a`; bông mai `#FEC629` | như Light | `--accent`, `--chart-2` |
| Nhãn trạng thái tốt, chờ, xấu, thông tin (nền/chữ) | `#e2f2f2`/`#0c4746`, `#fdf1d3`/`#6e4b00`, `#fde8e6`/`#8a1c13`, `#e6eef8`/`#1d3f6b` | xem `c.css` phần dark | biến thể `Badge` |

Mọi chữ đạt tương phản 4,5:1 trên nền của nó. Giá trị đầy đủ (kể cả Dark) lấy trực tiếp từ `:root` và `[data-theme="dark"]` trong `assets/c.css`; biến riêng của khung ở đầu `assets/shell.css`.

### 4.3. Chữ, hình khối, khoảng cách

- Roboto 300, 400, 500, 700 (không dùng 600, 800, 900). Tiêu đề màn 26 đến 28 px/700; tiêu đề thẻ 16 px/500; số KPI 28 px/700, ô trọng tâm 44 đến 56 px; chữ thường 14 px; nhãn phụ 12 px; không chữ dưới 11 px. Giãn chữ âm tối đa -0,02 em.
- Roboto Condensed 500 cho địa chỉ ví, mã băm, UUID, mã kỹ thuật (lớp `.mono` trong bản xem thử); đủ 42 ký tự địa chỉ trên một dòng.
- Bo góc: thẻ 22 đến 28 px, khối trong 18 px, ô nhập 14 px, nút và dropdown bo tròn hoàn toàn.
- Lưới 12 cột (`span-N`), khe 16 px, lề trang 24 px (điện thoại 16 px).

### 4.4. Ô số liệu theo ngữ nghĩa

| Lớp | Dùng cho | Hình thức |
|---|---|---|
| `kpi hl` | Con số token hoặc năng lượng chính của màn (tối đa một ô) | Gradient xanh ngọc đậm, sọc gió mảnh, minh hoạ cánh đồng gió |
| `kpi au` | Con số tiền chính của màn | Gradient vàng đậm có vệt sáng chạy, cột đồng xu VNDB (ô lớn) |
| `kpi leaf` | Token hoặc năng lượng phụ | Xanh ngọc nhạt, sọc gió ở góc |
| `kpi gold` | Tiền phụ | Vàng nhạt, vân đồng xu ở góc |
| `kpi` | Số đếm, trạng thái | Trắng |

### 4.5. Biểu tượng, minh hoạ, nền

- Bộ lucide hiện có, nét 1,7, đặt trong vòng tròn nhạt cạnh tiêu đề thẻ; khi rê chuột nét **vẽ lại**. Mũi tên chỉ là biểu tượng, không dùng ký tự.
- Minh hoạ SVG thuần (`ui.js`): cánh đồng gió, cột đồng xu VNDB, huy hiệu WPT, tua-bin nhỏ. Chuyển thành component React thuần SVG.
- Nền (`.bgfx` trong `c.css`, `ui.js`): ba vầng gradient mờ (xanh ngọc `#37a7a5`, vàng `#e0b44a`, xanh ngọc đậm) trôi rất chậm 26 đến 38 s, đường gió đứt nét độ mờ 7%; Dark giảm độ đậm. Không cực quang, không nhiễu hạt. Lớp nền cố định, không bắt sự kiện chuột.
- Icon 3D cạnh tiêu đề trang (FE-DEP-3, cần duyệt).

### 4.6. Chuyển động


Một đường cong `cubic-bezier` chung cho mọi thứ làm khối dừng gắt, cảm giác "cứng". Bản chốt dùng **lò xo**: vật có đà, về đích hơi lố một chút rồi lắng lại; độ mờ chỉ dịu dần, không nảy. Tham khảo cách làm của Motion, Motion Primitives, Kinetics (lò xo), MicroKit UI (vi tương tác), Anime.js; không chép mã của các thư viện đó.

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
| Thứ tự trong một đợt, kích hoạt | Khối trái và trên tới trước; chỉ chạy khi cuộn tới (ngưỡng 8%) | 0,06 đến 0,9 s |
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
| Thanh đầu | Giữ khi cuộn; co lại theo tiến độ cuộn, tiêu đề lớn mờ dần, tên màn hiện trên nền xanh trầm (mục 5.2) | nội suy mỗi khung hình, hệ số 0,2 |
| Nút sao chép (Ví của tôi) | Icon chép đổi thành dấu tích nảy ra | `--sp-bounce` 0,7 s |
| Đổi Sáng, Tối | **Vòng tròn lan ra từ nút** đổi giao diện (View Transitions); trình duyệt chưa hỗ trợ thì đổi ngay | 0,8 s |
| Chuyển trang | Nội dung cũ mờ, thu nhẹ; nội dung mới nhô lên bằng lò xo; sidebar và thanh trên đứng yên | 0,3 s ra; `--sp-soft` 0,8 s vào |
| Trang giới thiệu | Cuộn mượt có quán tính (FE-DEP-2); cảnh tua-bin màn đầu trôi chậm hơn nội dung (thị sai, CSS scroll-driven); ảnh dự án trượt nhẹ khi cuộn qua | theo cuộn |
| Nền, mở trang | Theo bản 3.2 (vầng gradient trôi chậm, đường gió nhạt; cơn gió quét qua khi mở trang) | |
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


---

## 5. Khung: thanh bên và thanh đầu (theo bản 12)

Nguồn: `assets/shell.js`, `assets/shell.css`. Trong app: `components/layout/sidebar.tsx`, `header.tsx`, `app-layout.tsx`, `chain-selector.tsx`, `channel-switcher.tsx`, `custody-toggle.tsx`. **Chỉ đổi markup, class, vị trí, chuyển động**; dữ liệu và logic giữ nguyên (mục 2.1).

### 5.1. Thanh bên

| Phần | Bản chốt | Nguồn dev giữ nguyên |
|---|---|---|
| Khung | Thẻ nổi bo tròn, kính mờ, rộng 270 px; thu gọn còn 88 px | `sidebar.tsx` |
| Logo | Logo C (logo BIDV trên, "**RWA** Tokenize Platform" dưới); thu gọn còn bông mai trên ô xanh ngọc | `bidv-logo.tsx` (thay hình) |
| Vai trò | Dropdown ở đầu, nhãn hai dòng ("Vai trò, GDV001" và tên vai), chọn là đổi khu vực như hiện tại | `ChannelSwitcher` (chuyển từ thanh đầu sang thanh bên) |
| Menu | Đúng `NAV_BY_ROLE` và `withHiddenOps` của dev, cùng nhãn, thứ tự, nhóm. Nhóm "Nghiệp vụ ẩn" gập được (tự mở khi đang ở màn trong nhóm), "Nạp VNDB" chỉ có khi bật `ENABLE_DEMO_PAYMENT_MINT` và có quyền `demo:mint-payment`, "Định danh ví" khi có `investor:whitelist` | `nav-config.ts`, `app-layout.tsx:394-397` |
| Mục menu | Biểu tượng, nhãn, số việc chờ (hiện cả số 0: nền xám; khác 0: nền vàng có nhịp sáng; `aria-label="N việc đang chờ"`), ô phím tắt (`shortcut`) bên phải | `sidebar.tsx:240-280` |
| Viên nang | Mục đang mở: viên nang xanh ngọc đậm; rê chuột: viên nang xám trượt theo, kéo giãn theo vận tốc (lò xo); không chồng lên mục đang mở | trình bày |
| Lưu ký Fireblocks | Chỉ GDV, KSV (`custody:toggle`): dòng có biểu tượng, nhãn, công tắc; dưới là các dòng chữ của `custodyNotes()` (đủ 4 câu, câu "Không áp dụng cho chain này" theo chain đang chọn, bất kể bật tắt), khoá khi chưa cấu hình (title "Chưa cấu hình Fireblocks"), dòng lỗi action | `custody-toggle.tsx` (giữ nguyên hàm `custodyNotes`, `setFireblocksCustodyAction`) |
| Chain | Dropdown ở đáy (mở lên trên), dòng chính là nhãn chain của dev ("Mock (không cần chain)"), dòng phụ là `{chain}, vai trò {ROLE}` (thay cho khối `NetworkStatus`, dấu chấm giữa đổi thành dấu phẩy); Stellar hiện nhưng không chọn được | `chain-selector.tsx`, `NetworkStatus` trong `sidebar.tsx` |
| Thu gọn | Nút chỉ biểu tượng ở bên phải Chain, không khung; nhớ lựa chọn bằng `localStorage`; khi thu gọn mọi biểu tượng nằm trên một trục giữa, rê chuột hiện tên mục | mới (QĐ-12) |
| Điện thoại (dưới 1100 px) | Thanh bên thành ngăn kéo, mở bằng nút menu ở thanh đầu, đóng bằng nút X hoặc chạm ra ngoài | sửa UX-04 |

### 5.2. Thanh đầu

| Phần | Bản chốt | Nguồn dev |
|---|---|---|
| Vị trí | Sticky, thẳng mép trái phải với nội dung bên dưới, bo tròn | `header.tsx` |
| Bên phải | "Kết nối ví" (nút vàng, `ConnectButton` của RainbowKit, giữ cho mọi vai như dev, xem FE-UX-X2) và nút sáng tối | giữ nguyên |
| Tiêu đề | Chỉ hiện tên màn (crumb cuối của `breadcrumbs`); **bỏ dòng phụ phía trên** (QĐ-11). Màn chi tiết có liên kết quay lại trong nội dung | `breadcrumbs` của từng `page.tsx` (không đổi dữ liệu truyền vào) |
| Co theo cuộn | Tiến độ `p` từ 0 đến 1 khi cuộn qua hàng tiêu đề, làm mượt mỗi khung hình: tiêu đề lớn mờ dần, nhoè, thu nhẹ; thanh đầu cao 44 px hiện tên màn trên nền xanh ngọc trầm (độ mờ từ 0 lên khoảng 90%), vạch gradient xanh ngọc sang vàng ở chân | trình bày |
| Điện thoại | Cao 46 đến 56 px, nút menu, logo C nhỏ, tên màn khi cuộn, nút ví chỉ còn biểu tượng | sửa UX-04 |

### 5.3. Dropdown

Mọi dropdown của khung và ô chọn trong màn: khung xổ bằng lò xo (từ 94% và nhoè về rõ), các dòng hiện lần lượt cách 35 ms, dòng đang chọn nền xanh ngọc nhạt có dấu tích, bàn phím mũi tên, Enter, Esc. Giá trị và sự kiện `change` vẫn đi qua `select` hoặc state hiện có; không đổi lời gọi dữ liệu.

---

## 6. Danh sách màn (23 màn và trang giới thiệu)

Mỗi màn có ghi chú `notes/<trang>.md`: tệp dev đã đọc, bảng "khối hoặc trường trên giao diện mới | nguồn trong màn thật | ghi chú", mục "Thay đổi so với bản chốt (dev mới)", mục "Trạng thái giữ theo dev, chưa vẽ" (nếu có) và kết luận "Có đụng backend: Không". **Đây là checklist nghiệm thu của Kiro.**

| Vai | Trang xem thử | Màn dev | Component chính | Thay đổi do dev mới (`f164939` đến `67ece1e`) |
|---|---|---|---|---|
| GDV, KSV | `dashboard.html` | `/` | `pages/dashboard.tsx` | Không đổi nội dung |
| GDV | `draft.html` | `/draft` | `pages/draft.tsx`, `maker-checker/*` | Nhiều dòng mint, huỷ toàn bộ nguồn cung, nguồn huỷ |
| GDV, KSV | `transactions.html` | `/transactions` | `pages/ops-transactions.tsx` | Không đổi nội dung |
| GDV, KSV | `transaction-detail.html` | `/transactions/[id]` | `pages/ops-order-detail.tsx` | Không đổi nội dung |
| KSV, GDV (chỉ xem) | `distribution.html` | `/distribution` | `pages/distribution-approval.tsx` | Không đổi nội dung |
| KSV, GDV | `vault.html` | `/vault` | `pages/vault-status.tsx` | 11 trường, một chế độ cấu hình, các bước lưu |
| KSV, GDV | `config.html` (mới) | `/config` | `pages/price-config.tsx` | Màn mới BE-05, FE-10: giá và phát hành |
| KSV, GDV (chỉ xem) | `recall.html` (mới) | `/recall` | `pages/recall.tsx`, `recall/*` | Màn mới: thu hồi token |
| GDV | `demo-payment.html` | `/demo-payment` | `pages/demo-payment.tsx` | Nằm trong nhóm "Nghiệp vụ ẩn" |
| GDV | `wallet-binding.html` (mới) | `/wallet-binding` | `pages/wallet-binding.tsx` | Màn mới: định danh ví |
| KSV | `approvals.html` | `/approvals` | `pages/approvals.tsx` | Bảng lịch sử duyệt |
| KSV | `approval-detail.html` | `/approvals/[id]` | `pages/approval-detail.tsx` | Cảnh báo duyệt, dòng "Thực hiện qua" (Fireblocks, IN-04) |
| Mọi vai | `account.html` | `/account` | `pages/account-info.tsx`, `account-wallet.tsx` | Hồ sơ mẫu theo `SAMPLE_ACCOUNT_PROFILES` |
| NĐT | `portfolio.html` | `/portfolio` | `pages/investor-portfolio.tsx`, `investor/*` | Định dạng số UIUX-01 |
| NĐT | `token-detail.html` | `/tokens/[symbol]` | `pages/investor-token-detail.tsx` | Biến thể dự án chưa lên chuỗi |
| NĐT | `trade.html` | `/trade` | `pages/investor-trade.tsx`, `trading/*` | Chỉ còn Mua (FIX-02), trạng thái ví chưa định danh |
| NĐT | `orders.html` | `/orders` | `pages/investor-orders.tsx` | Mã lệnh 8 ký tự đầu của UUID |
| NĐT | `order-detail.html` | `/orders/[id]` | `pages/investor-order-detail.tsx` | Như trên |
| NĐT | `withdraw.html` | `/withdraw` | `pages/investor-withdraw.tsx`, `withdraw/*` | Màn rút thật FE-23 (thay màn chờ) |
| NĐT, NB | `wallet.html` | `/wallet` | `pages/wallet-connect.tsx`, `wallet/*` | Không đổi nội dung |
| NB | `seller.html` | `/seller` | `pages/seller-overview.tsx` | Ví nhận tiền của người bán |
| NB | `seller-transactions.html` | `/seller/transactions` | `pages/seller-transactions.tsx` | Mã lệnh 8 ký tự |
| NB | `seller-withdraw.html` | `/seller/withdraw` | `pages/seller-withdraw.tsx` | Ví nhận mặc định, lý do cần xem xét |
| | `index.html` | (trang mới, FE-UX-X5) | | Trang giới thiệu dự án, logo A, video tạm |

Màn **có ở dev nhưng không nằm trong menu và không có bản xem thử**: `/mint`, `/assets`, `/kyc`, `/audit`, `/reconciliation`. Áp dụng hệ thiết kế chung (token, thẻ, bảng, nút) khi đổi khung, không đổi nội dung; nút "Phát hành WPT" ở Bảng điều khiển vẫn dẫn tới `/mint`.

**Thanh "Trạng thái xem thử"** trên nhiều trang chỉ để chủ dự án xem từng trạng thái của cùng màn (rỗng, đang tải, lỗi, chưa kết nối ví, chỉ xem...). **Không đưa vào app.** Công tắc Fireblocks xem trạng thái bằng tham số `?custody=on|locked|unreadable|noconfig|badscope`. Trạng thái nào chưa vẽ thì vẫn phải giữ đúng câu chữ và điều kiện của dev (ghi trong notes).

---

## 7. Hướng dẫn hiện thực trong Next.js

### 7.1. Nguyên tắc bắt buộc: thay đổi lớn, mã ít nhất, an toàn nhất

Chủ dự án yêu cầu: đây là thay đổi lớn nên phải làm **tối ưu nhất, hiệu quả nhất, an toàn nhất, không tạo mã dư thừa**. Cụ thể:

1. **Đổi tập trung trước, đổi từng màn sau.** Phần lớn giao diện mới phải đến từ token (`globals.css`), font (`layout.tsx`), thành phần nền (`components/ui/*`) và khung (`components/layout/*`). Làm xong task 1 (mục 11) thì các màn đã đổi phần lớn; task màn chỉ chỉnh bố cục JSX và class còn thiếu.
2. **Tái dùng, không nhân bản.** Biến thể mới viết bằng `cva` trên component đang có (ví dụ `Card` có `tone: default | hl | au | leaf | gold`; `Badge` có `ok | warn | bad | info`). Không tạo component riêng cho từng màn, không sao chép một khối JSX sang nhiều tệp; khối dùng từ hai màn trở lên thì tách một lần vào `components/ui` hoặc `components/<nhóm>`.
3. **Không chép mã bản xem thử.** `c.css`, `ui.js`, `shell.js` là đặc tả hình ảnh và thông số. Thanh "Trạng thái xem thử", dữ liệu mẫu, đoạn mô phỏng hành vi, tham số `?st=`, `?custody=` chỉ để duyệt, **không đưa vào app**.
4. **CSS trước, JS sau.** Chuyển động dùng `transition`, `@keyframes`, `linear()`; JS chỉ cho thứ phải đi theo con trỏ hoặc đổi giữa chừng (viên nang menu, viên nang tab, số lăn, tách chữ tiêu đề), dùng chung một hook `useSpring`. Không thêm gói npm (trừ FE-DEP được duyệt).
5. **Không đụng dữ liệu và logic.** Không đổi props, không thêm state nghiệp vụ, không đổi lời gọi action; diff mỗi màn chủ yếu là `className` và vỏ JSX. Không đổi `data-testid`, `aria-label` đang được e2e dùng.
6. **Ít phần tử thừa.** Trang trí (vầng màu, sọc gió, vạch chân thanh đầu) dùng `::before`, `::after` hoặc nền CSS, không thêm `div` rỗng. Minh hoạ SVG viết một lần thành component.
7. **Dọn trong cùng PR.** Class, biến CSS, component, import không còn dùng sau khi đổi thì xoá ngay trong PR đó; không để hai kiểu giao diện song song. `font-mono` thay bằng một lớp tiện ích dùng chung (ví dụ `font-code`), không viết style tại chỗ.
8. **An toàn khi giao.** Mỗi task một PR nhỏ; trước khi mở PR chạy `typecheck`, `test`, `test:e2e`; kèm ảnh trước và sau (Light, Dark, 1440, 390); `git diff --stat` không có tệp ở mục 2.2. Màn nào khó thì tách PR, không gộp cho nhanh.

### 7.2. Các bước

1. **Token:** chép biến màu Light, Dark của `c.css` vào `globals.css` theo bảng 4.2; thêm `--sp-soft`, `--sp-gentle`, `--sp-bounce`, `--ease-out` (mục 4.6). Không đổi tên token shadcn đang có, chỉ đổi giá trị.
2. **Font:** `layout.tsx` nạp `Roboto` và `Roboto_Condensed` bằng `next/font/google`, gán `variable`; `globals.css` trỏ `--font-sans`, `--font-code` vào đó (sửa UX-01). Thay `font-mono` theo quy tắc UX-02.
3. **Khung:** viết lại JSX của `sidebar.tsx`, `header.tsx`, `app-layout.tsx` theo mục 5; giữ nguyên props, `NAV_BY_ROLE`, `withHiddenOps`, `roleHomeHref`, cách đọc số việc chờ, `CustodyToggle` state, `ChannelSwitcher`, `ChainSelector` logic. Thu gọn dùng `localStorage` khoá `bidv-rail`.
4. **Thành phần nền** (`components/ui/*`): `Card` (bo tròn, kính mờ, vầng màu theo ngữ nghĩa), `Badge` (4 sắc), `Button` (primary xanh ngọc, gold, outline), `Select` (dropdown mục 5.3), `Table` (hàng hiện lần lượt, vạch trái khi rê), ô KPI (`hl`, `au`, `leaf`, `gold`). Không đổi API props.
5. **Chuyển động:** `components/motion/` gồm `use-spring.ts`, `Odometer`, `WordReveal`, `NavPill`, `SegIndicator` (mục 4.6). Ghi thẳng vào `style` qua ref, không `setState` mỗi khung hình. Tôn trọng `prefers-reduced-motion`.
6. **Màn:** mỗi màn sửa JSX theo bản xem thử và notes; mọi câu chữ, điều kiện, lời gọi action, số lần gọi khi mở màn giữ nguyên (HF-01). Biểu đồ recharts chỉ đổi màu, kiểu, animation.
7. **Chữ hiển thị:** chuỗi JSX có dấu chấm giữa, gạch dài, ký tự mũi tên đổi thành dấu phẩy hoặc biểu tượng; chuỗi do máy chủ dựng giữ nguyên (BE-UX-1).

---

## 8. Điều kiện nghiệm thu

1. Đối chiếu từng màn với `notes/<trang>.md`: đủ mọi trường, cột, bộ lọc, nút, câu chữ, trạng thái; không thêm, không bớt.
2. `git diff --stat` của PR chỉ có tệp ở mục 2.1, không có tệp ở mục 2.2.
3. Mỗi màn tối đa một server action khi mở (HF-01).
4. `npm run typecheck`, `npm test`, `npm run test:e2e` xanh.
5. Ảnh chụp Light và Dark, 1440 và 390 px cho mỗi màn; không tràn ngang ở 390 px; Roboto và Roboto Condensed nạp thật, chữ có dấu đúng ở cả bốn độ đậm.
6. Không còn dấu chấm giữa, gạch dài, ký tự mũi tên trong chữ do frontend dựng.
7. Chuyển động đúng mục 4.6; bật "giảm chuyển động" thì nội dung hiện ngay; cuộn ở 1440 px không giật.
8. UserGuide cập nhật phần mô tả giao diện cho màn đã đổi.
9. Checkpoint mỗi PR ghi rõ "Phạm vi: chỉ frontend" và danh sách tệp đã sửa.
10. Không mã dư thừa (mục 7.1): không component trùng chức năng, không CSS hoặc JS không dùng, không gói mới ngoài FE-DEP được duyệt, không mã của thanh "Trạng thái xem thử". Người duyệt PR kiểm điểm này.

---

## 9. Tài sản tạm, chủ dự án thay sau

| Tài sản | Đang dùng tạm | Cần thay bằng |
|---|---|---|
| Logo BIDV | `assets/logo.js`: logo vector hoá từ ảnh chủ dự án gửi | Bộ SVG chính thức (ngang, biểu tượng, nền sáng và tối) |
| Logo sản phẩm A, C | Dựng từ logo trên và chữ Roboto | Bản thiết kế chính thức nếu có |
| Ảnh dự án | Minh hoạ SVG cánh đồng gió, tua-bin | Ảnh thật 16:9 từ 2400 px; ảnh vuông từng dự án |
| Icon 3D | Fluent Emoji 3D (MIT), 21 tệp `assets/3d/` | Bộ icon theo nhận diện BIDV, cùng tên tệp |
| Video | YouTube `M52hkUDVe5w` | Video chính thức (MP4 tự lưu trữ hoặc kênh BIDV) |

---

## 10. Kết quả rà soát độc lập

Rà soát do các trợ lý độc lập (không tham gia dựng) thực hiện: đọc mã dev `67ece1e` của từng màn (kể cả thành phần con và câu chữ trong `lib/**`), đối chiếu từng trường, nút, câu chữ, điều kiện theo vai, trạng thái với bản xem thử và notes. Chỉ báo cáo, không sửa.

| Vòng | Phạm vi | Cao | Trung bình | Thấp | Xử lý |
|---|---|---|---|---|---|
| 1 | 23 màn và khung | 1 | 32 | khoảng 70 | Sửa toàn bộ Cao và Trung bình; Thấp sửa phần lớn, còn lại ghi notes |
| 2 | 23 màn và khung (sau sửa) | 0 | 11 | khoảng 35 | Sửa toàn bộ Trung bình; Thấp sửa phần lớn |

Các điểm chính đã sửa sau vòng 1 và 2:

- **Mã lệnh:** mọi màn dùng UUID như dev, hiện 8 ký tự đầu, ô chi tiết hiện đủ (trước đó dùng dạng `ORD-2026-xxxx` mà dev không có).
- **Chi tiết token:** ba dòng Tên token, Tổng cung, Giá phát hành chỉ hiện khi đã đọc được từ chuỗi; thêm biến thể dự án chưa lên chuỗi (lỗi mức Cao duy nhất).
- **Khung:** số việc chờ hiện cả số 0; ô phím tắt cạnh mục menu; dòng `{chain}, vai trò {ROLE}`; công tắc Fireblocks đủ 4 câu của `custodyNotes()` và trạng thái khoá; trang nghe đổi Chain qua ô `#chain`.
- **Trạng thái:** thêm tab đang tải, lỗi, rỗng cho các màn; trạng thái hiếm không vẽ thì liệt kê đúng câu chữ kèm tệp:dòng ở mục "Trạng thái giữ theo dev, chưa vẽ" của notes.
- **Câu chữ và dữ liệu mẫu:** lý do "cần xem xét" của lệnh rút, hồ sơ tài khoản theo `SAMPLE_ACCOUNT_PROFILES`, ví NB001, địa chỉ vault mock `MOCK_VAULT_ADDRESS`, luồng rút VNDB (kiểm lệnh dở sau bước mã một lần), biểu mẫu mở ra rỗng như dev, số liệu nhất quán trong từng màn.
- **Mã thừa trong bản xem thử:** gỡ phần khung cũ trong `ui.js` (menu, chain, thanh trên của bản 3) vì mọi màn đã dùng `shell.js`.

Kiểm tra kỹ thuật cuối (01/11/2026): 24 trang, mỗi vai được phép, khổ 1440 Sáng và 390 Tối, bấm qua mọi tab trạng thái: **70 tổ hợp, 0 lỗi JS, 0 tràn ngang**; không còn dấu chấm giữa, gạch dài, ký tự mũi tên trong mọi tệp của bản xem thử; bản sao dev và repo không có thay đổi ngoài thư mục tài liệu.

**Còn lại, mức Thấp (không ảnh hưởng hiện thực):** vài số liệu mẫu giữa các màn khác nhau (số dư VNDB của nhà đầu tư giữa Tổng quan và Giao dịch token; số dư vault ở Tạo lệnh rút chưa trừ phần đã rút); đồng xu trang trí ở ô "Lợi tức đã chia" in chữ "VNDB" trong khi dữ liệu mẫu dev ghi đơn vị "VND" (BE-UX-3); nút "Kết nối ví" ở thanh đầu bản xem thử luôn ở trạng thái chưa kết nối (trong app là `ConnectButton` thật); dòng vùng và trạng thái dự án ở danh sách token, dev ngăn bằng chấm giữa, bản xem thử đổi thành dấu phẩy theo QĐ-8.

**Cần backend (cả hai vòng, 3 nhóm rà soát): Không có.** Hai điểm vòng 1 từng nêu (mã lệnh dạng `ORD-…`, kiểm lệnh rút dở trước bước mã) đã xử lý bằng cách sửa bản xem thử về đúng hành vi dev, không cần backend. Dải video "Đề xuất bổ sung" xem Q4 mục 12.

---

## 11. Đề xuất chia task

| Thứ tự | Task | Gồm |
|---|---|---|
| 1 | FE-UX-01 Nền và khung | UX-01 đến UX-04; token màu, font; `components/ui/*`; `components/motion/*`; thanh bên, thanh đầu, dropdown, công tắc Fireblocks (mục 5) |
| 2 | FE-UX-02 Vận hành | dashboard, draft, transactions, transaction-detail, demo-payment, wallet-binding, config, recall |
| 3 | FE-UX-03 Kiểm soát | approvals, approval-detail, distribution, vault |
| 4 | FE-UX-04 Nhà đầu tư | portfolio, token-detail, trade, orders, order-detail, withdraw, wallet |
| 5 | FE-UX-05 Người bán và tài khoản | seller, seller-transactions, seller-withdraw, account |
| 6 | FE-UX-06 Màn ngoài menu | `/mint`, `/assets`, `/kyc`, `/audit`, `/reconciliation`: chỉ áp hệ thiết kế chung |
| 7 | FE-UX-07 Trang giới thiệu | `index.html` (FE-UX-X5), sau khi chốt đường dẫn và nội dung |

Mỗi task một PR, checkpoint ghi "Phạm vi: chỉ frontend" kèm danh sách tệp đã sửa. Task 1 làm trước; task 2 đến 5 song song được.

---

## 12. Câu hỏi cần chủ dự án chốt

- Q1. FE-UX-X2: "Kết nối ví" hiện cả với Giao dịch viên, Kiểm soát viên (như dev hiện tại, trái FE-02). Giữ hay ẩn?
- Q2. BE-UX-1 đến BE-UX-4 (mục 2.4): có mở task backend hoặc dữ liệu mẫu riêng không.
- Q3. FE-UX-X5 trang giới thiệu: đường dẫn (ví dụ `/gioi-thieu` hoặc trang trước khi chọn vai) và nội dung chính thức.
- Q4. Dải video "Đề xuất bổ sung" ở Tổng quan Nhà đầu tư: bản xem thử nhúng cứng mã video; làm thật thì cần chỗ lưu đường dẫn video (cấu hình frontend là đủ nếu chấp nhận cố định; muốn đổi theo dự án thì cần backend).
- Q5. FE-DEP-1 (`motion`), FE-DEP-2 (`lenis`), FE-DEP-3 (icon 3D): duyệt hay không. Không duyệt vẫn làm được toàn bộ bằng CSS và hook tự viết.
- Q6. Cung cấp logo SVG chính thức, ảnh thật dự án, video chính thức (mục 9).
- Q7. Commit cũ `f11f1ae` trên `dev` (tài liệu bản 1 và `docs/prototypes/20261023_ui_ux/`) đã lỗi thời: đề nghị Supervisor gỡ hoặc ghi chú "đã thay bằng tài liệu này" khi nhận bàn giao.
