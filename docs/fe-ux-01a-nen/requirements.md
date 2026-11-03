# FE-UX-01a: nền giao diện (màu, font, mặc định Sáng, thành phần dùng chung, thay `font-mono`)

| | |
|---|---|
| Nhánh | `feat/fe-ux-01a-nen` từ `release/ui-v2` (nhánh tích hợp của đợt giao diện) |
| Điều kiện bắt đầu (Cổng 0) | Chỉ tạo nhánh khi đủ cả 5: (1) PR chuẩn bị (nhánh `docs/ui-ux-ban-chot-v2` @ `bb8f5b5`: bản chốt, thứ tự ưu tiên nguồn, CI cho `release/ui-v2`, mã FE-UX trong task-status) đã merge vào **`release/ui-v2`** (KHÔNG vào `dev`; các thay đổi này vào `dev` cùng cả đợt ở giai đoạn phát hành); (2) `release/ui-v2` chứa commit `bb8f5b5`; (3) CI đã chạy và xanh trên chính PR chuẩn bị đó; (4) bật bảo vệ nhánh cho `release/ui-v2` (bắt buộc PR, bắt buộc CI xanh, cấm push thẳng); (5) chủ dự án thông báo đóng băng task frontend nghiệp vụ. Staging và danh sách người thử từng vai cần trước Cổng 3, không chặn task này |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Chỉ frontend. Không đổi backend, database, hợp đồng, cấu hình triển khai; không thêm gói npm |
| Mức kiểm thử | **B**, cộng e2e đầy đủ một lần vì PR chạm mọi màn (tasks bước 7) |
| Nguồn | Kế hoạch nâng cấp giao diện 03/11 (Claude Doc `20261103_ke_hoach_nang_cap_giao_dien`); `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 2, 3, 4.1 đến 4.3, 7; `docs/prototypes/20261101_ui_ux_ban_chot/assets/c.css` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `dev` @ `2308509`, rồi tài liệu bàn giao, cuối cùng là bản xem thử. Riêng chuyển động nâng cao và gói `lenis`, `motion` trong tài liệu bàn giao: KHÔNG làm (chuyển FE-UX-08 hoặc đã loại) |

## 1. Mục tiêu

Đổi phần chung để cả 28 đường dẫn (23 màn chính, 5 màn ngoài menu, liệt kê ở design mục 6) đổi màu, font, độ bo theo bản chốt mà KHÔNG sửa bố cục hay câu chữ của từng màn:

1. Token màu Sáng và Tối theo bản chốt (xanh ngọc, vàng).
2. Font Roboto cho chữ, Roboto Condensed cho mã kỹ thuật; sửa lỗi UX-01 (đang hiện font có chân).
3. Mặc định Sáng (UX-03).
4. Thay `font-mono` theo quy tắc UX-02 ở 160 dòng trong 37 tệp ngoài `components/layout` (4 dòng trong `components/layout` để FE-UX-01b làm cùng khung).
5. Kiểu dáng các thành phần nền đang được dùng trong `components/ui` (bo góc, màu) theo bản chốt, không đổi API.

Không làm trong PR này: khung (thanh bên, thanh đầu, ngăn kéo, logo: FE-UX-01b), màu nhấn ví RainbowKit (hằng số nằm trong `lib/brand.ts`, xử lý ở FE-UX-01b sau khi Sếp duyệt), chuyển động và nền trôi (FE-UX-01c), bố cục và câu chữ từng màn, biến thể mới chưa có màn dùng.

## 2. Quyết định (QĐ)

- **QĐ-1. Giữ cơ chế theme.** `next-themes` giữ `attribute="class"` (lớp `.dark`). Bản xem thử dùng `[data-theme="dark"]`; token Tối đặt dưới `.dark`, KHÔNG đổi sang `data-theme`.
- **QĐ-2. Chỉ đổi giá trị token shadcn đang có, không đổi tên, không thêm token chưa có người dùng.** Bảng ánh xạ ở design mục 1. Token mới duy nhất: `--font-code`. KHÔNG đổi `--radius` (đổi sẽ kéo theo 102 chỗ `rounded-*` ở 48 tệp, kể cả khung); độ bo mới đặt trực tiếp trên từng thành phần nền (design mục 3).
- **QĐ-3. Font qua `next/font/google`.** Roboto 300, 400, 500, 700 (kiểu thường), Roboto Condensed 400, 500; subsets `latin`, `vietnamese`; `display: 'swap'`. Bỏ Geist Mono. Không nạp kiểu nghiêng (mã không dùng `italic`). Lớp `font-semibold` (66 chỗ) sẽ hiện thành 700 vì không nạp 600: đúng ý bản chốt, không sửa. Nếu build trên CI hỏng vì không tải được font: DỪNG và báo Supervisor, KHÔNG tự chuyển sang tệp font cục bộ (font cục bộ chỉ đưa vào khi lỗi thật xảy ra, có nguồn tệp font rõ ràng và chủ dự án duyệt).
- **QĐ-4. Quy tắc thay `font-mono` (UX-02), chỉ thay tên lớp, không đổi gì khác trên dòng:**
  - Số tiền, số lượng, phần trăm, ngày giờ, số khối, ô nhập số: `tabular-nums`.
  - Địa chỉ ví, mã băm, UUID, mã yêu cầu, mã lệnh, mã quyền, mã chain, mã OTP: `font-code`.
  - Ký hiệu token đứng riêng (`WPT`, `VNDB`): bỏ `font-mono`, không thêm lớp.
  - Một lớp dùng chung cho nội dung lẫn số và mã (prop `mono` ở `token-info-block.tsx:82`, `approval-detail.tsx:339`, `investor-trade.tsx:482`): `font-code`.
  - Dòng `layout.tsx:9` là tên biến font, mất khi bỏ Geist Mono.
- **QĐ-5. Mặc định Sáng.** `defaultTheme="light"`; nhánh trước khi mount của `RainbowWithTheme` dùng `LIGHT_WALLET_THEME` để lần vẽ đầu khớp nền Sáng (thẩm mỹ, không phải sửa lệch hydrate). Không đổi `LIGHT_WALLET_THEME`, `DARK_WALLET_THEME`. Nút đổi Sáng Tối ở thanh đầu giữ nguyên.
- **QĐ-6. Thành phần nền chỉ đổi kiểu dáng.** Chỉ sửa thành phần đang có màn dùng và đã có chuỗi class để sửa: `Card`, `Badge`, `Button`, `Table`, `Dialog`, `DropdownMenu`, `Skeleton`. Không sửa `AmountInput` (chưa có chuỗi class nền; muốn bo góc phải thêm ghép `className`, để PR màn có ô nhập làm), `Select`, `Separator` (không màn nào dùng), `Tooltip` (đã theo token). Không đổi props, tên biến thể, thứ tự phần tử, `data-slot`. Không dùng mã màu cứng (quy ước `.kiro/steering/frontend.md`): mọi màu qua token.
- **QĐ-7. Chữ hiển thị:** chỉ sửa ký tự cấm (gạch dài, chấm giữa, mũi tên) trong `globals.css`, `layout.tsx` (ví dụ `metadata.title`), `providers.tsx`, `components/ui/*`. Trong 37 tệp thay `font-mono`, KHÔNG đổi chữ, kể cả chữ thay thế gạch dài (e2e `maker-checker.spec.ts:142` dựa vào chữ này); việc đổi chữ màn làm ở PR màn. Chuỗi do máy chủ trả về giữ nguyên (BE-UX-1).

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/app/globals.css` | Token, `--font-sans`, `--font-code` |
| `app/src/app/layout.tsx` | Nạp font, `metadata`; KHÔNG đổi `ConfigProvider`, `publicConfig()` |
| `app/src/components/providers.tsx` | Chỉ `defaultTheme`, nhánh trước khi mount, chú thích; KHÔNG đổi Wagmi, QueryClient, cấu hình ví |
| `app/src/components/ui/{card,badge,button,table,dialog,dropdown-menu,skeleton}.tsx` | Kiểu dáng (QĐ-6) |
| 37 tệp có `font-mono` ngoài `components/layout` (danh sách ở tasks bước 3) | Chỉ thay tên lớp (QĐ-4) |
| `app/e2e/fix-05-tong-quan.spec.ts` | Dòng 46 tìm `.font-mono`: đổi sang lớp mới theo QĐ-4, giữ nguyên điều kiện kiểm |
| `app/e2e/fe-ux-01a-nen.spec.ts` (mới) | Kiểm tự động chính thay đổi của task (design mục 8), chạy trong project mock |
| `docs/fe-ux-01a-nen/*` (chép spec này), `docs/CHECKPOINT_FEUX01A.md` (mới, theo `docs/CHECKPOINT_TEMPLATE.md`), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Mọi tệp khác là cấm; lệnh kiểm danh sách trắng ở tasks bước 8 phải rỗng. Ảnh trước và sau KHÔNG commit vào repo.

## 4. Điều kiện hoàn thành

- [ ] Token Sáng, Tối đúng bảng design mục 1; 8 cặp tương phản ở design mục 1.3 đạt ngưỡng ghi trong bảng.
- [ ] Roboto và Roboto Condensed nạp thật: `getComputedStyle(document.body).fontFamily` bắt đầu bằng tên font Roboto do `next/font` sinh; chữ có dấu tiếng Việt đúng ở 300, 400, 500, 700; lớp `font-code` có trong CSS xuất ra.
- [ ] `grep -rn "font-mono" app/src --include=*.tsx | grep -v "components/layout/"` trả 0 dòng; bảng phân loại 160 dòng theo QĐ-4 có trong checkpoint.
- [ ] Mở trang lần đầu (xoá dữ liệu trang) ra giao diện Sáng; nút đổi Sáng Tối vẫn chạy và lựa chọn còn sau khi tải lại; cảnh báo hydrate vẫn là 0 ở 28 đường dẫn (mốc trên `dev` là 0).
- [ ] `app/e2e/fe-ux-01a-nen.spec.ts` có đủ 6 ca ở design mục 8 và xanh; ca nào cũng có phép kiểm cụ thể (không chỉ mở trang).
- [ ] Diff `components/ui/*` chỉ là chuỗi class; không đổi props, tên biến thể; không mã màu cứng.
- [ ] Trong 37 tệp thay `font-mono`, diff chỉ là tên lớp; không tệp màn nào khác bị sửa.
- [ ] Số server action khi mở màn không đổi ở cả 28 đường dẫn (so với mốc design mục 6).
- [ ] Dung lượng JS phía trình duyệt của `/`, `/portfolio`, `/trade`, `/approvals` không tăng quá 10 KB nén so với mốc.
- [ ] Ảnh trước và sau 28 đường dẫn (Sáng, Tối; 1440 px, 390 px; chụp hết chiều cao nội dung bằng script mốc) gửi kèm báo cáo; ở 390 px chỉ yêu cầu không tệ hơn trước (khung đổi ở 01b).
- [ ] Không còn ký tự cấm ở dòng thêm mới trong `globals.css`, `layout.tsx`, `providers.tsx`, `components/ui/*` (lệnh ở tasks bước 9).
- [ ] Lệnh danh sách trắng rỗng; `bash scripts/run-local-all.sh arch markers checkpoint contracts app build e2e evm` đạt toàn bộ, kèm log; không nới bước kiểm nào.
- [ ] Không mã dư thừa: khối màu cũ trong `globals.css` xoá hẳn; không biến CSS, lớp, import nào còn lại mà không dùng.
- [ ] Checkpoint ghi "Phạm vi: chỉ frontend", danh sách tệp, bảng `font-mono`, số đo trước và sau, kết quả kiểm thử.
