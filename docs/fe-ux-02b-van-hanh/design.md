# FE-UX-02b: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/draft.html`, `config.html`, `recall.html`, `assets/c.css` (`.inner` 158, `.checks`, `.steps`, `.kv-grid`, `.alert` 269 tới 274, `.empty` 277 tới 280). Thành phần: dùng nguyên API của FE-UX-02a (`components/ui/{kpi,alert,empty-state,card,badge}.tsx`, `ui/field.ts`).

## 1. Bố cục

| Màn | Bố cục (1440 px; dưới 1100 px một cột) |
|---|---|
| `/draft` | `h1` "Lập lệnh" và `TokenScopeSelect` trên một hàng. Lưới 12 cột: 2 `Kpi` 6 cột mỗi ô; lỗi số liệu `Alert bad` (không `role`, như hiện tại) 12 cột; 2 thẻ biểu mẫu 6 cột mỗi thẻ (giữ `aria-label` "Thẻ tạo token", "Thẻ huỷ token", có `CardTitleIcon`). Trong thẻ: khối thông tin token và khối kiểm tra dạng ô nền nhạt bo 18 px (`bg-muted/60`), giữ cặp `dt`/`dd`; khối kiểm tra là danh sách, mỗi dòng biểu tượng đạt hoặc không đạt, giữ `data-check`, `data-passed`, dấu cách giữa nhãn và kết quả; ô nhập `fieldClass`; nút Gửi `Button` mặc định. Thẻ "Yêu cầu đã lập" 12 cột, `CardTitleIcon` (lịch sử), 2 bảng, nhãn trạng thái có sắc, rỗng và đang tải dùng `EmptyState` |
| `/config` | `h1` và ô chọn token. Lưới 12 cột: cột trái 6 (thẻ "Giá phát hành" có `Kpi au` giá áp dụng đầu thẻ rồi các dòng còn lại; dưới là thẻ "Đổi giá" nếu `canEdit`); cột phải 6 (thẻ "Tình trạng phát hành" có `Kpi hl` "Tổng cung trên chuỗi" đầu thẻ rồi các dòng còn lại, nút sao chép giữ). Thẻ "Lịch sử đổi giá" 12 cột. Tiêu đề thẻ `h2` kèm `CardTitleIcon`. Hai hộp thoại giữ nguyên nội dung, chỉ đổi kiểu theo `Dialog` sẵn có |
| `/recall` | Nhánh đang tải, lỗi: chỉ `EmptyState` (không `h1`, như hiện tại). Khi có dữ liệu: `h1` và ô chọn token; thẻ bước 12 cột (`.steps`: chấm tròn nối đường, `done` xanh, `current` viền vàng, `pending` mờ; theo `data-tone`); thẻ "Tình trạng đợt thu hồi" 12 cột: hàng nhãn giai đoạn và trạng thái (`Badge` sắc) ở đầu, lưới thông tin 4 cột từ 1100 px (2 cột dưới đó), các khối hổ phách thành `Alert warn` giữ `role`, vùng nút có viền trên, nút có biểu tượng; thẻ hồ sơ 12 cột, bảng với nhãn trạng thái có sắc, rỗng dùng `EmptyState` |

Biểu tượng tiêu đề thẻ (lucide): biểu mẫu tạo `Plus` hoặc `CirclePlus`, huỷ `Flame`, yêu cầu đã lập `History`, giá `Coins`, đổi giá `PencilLine`, phát hành `Gauge`, lịch sử `History`, tình trạng thu hồi `Undo2`, hồ sơ `Users`. Dev được chọn biểu tượng tương đương, ghi trong checkpoint.

## 2. Ánh xạ sắc

| Đối tượng | Giá trị | Sắc |
|---|---|---|
| Yêu cầu token | `PENDING` / `EXECUTING` / `COMPLETED` / `REJECTED` / `FAILED` | `warn` / `info` / `ok` / `bad` / `bad` |
| Hồ sơ thu hồi | `NOTIFIED` / `CONFIRMED` / `PAID` / `BURNING` / `BURNED` / `FAILED` / `PREVIEW` (dòng "Dự kiến") | `warn` / `info` / `info` / `info` / `ok` / `bad` / `info` |
| Badge đợt (`round-info.tsx`) | "Chế độ PoC" / "Đã huỷ" / "Token trên chuỗi" đã đóng băng / chưa | `outline` / `bad` / `warn` / `outline` |
| Giai đoạn đợt | mọi giá trị | `info` |
| Bước thu hồi | `done` / `current` / `pending` | `ok` / `warn` / `muted` |

Khoá kiểu: `SettlementCaseStatus | 'PREVIEW'`, `RecallPhaseKind`; trạng thái bước theo `RecallSteps` hiện có (dev ghi tên thật trong checkpoint).

## 3. Kiểm thử mới

`app/test/fe-ux-02b.test.ts` (môi trường `node`, `react-dom/server` `renderToStaticMarkup` như `fe-ux-02a.test.ts`):

1. `case-tone.ts`: mọi trạng thái hồ sơ và giai đoạn trả đúng bảng mục 2.
2. Dựng `RequestCheckBlock` với dữ liệu giả có một điều kiện không đạt (`cap`): HTML có `data-check="cap"`, `data-passed="false"`, và chữ hiển thị (bỏ thẻ) chứa "Không vượt trần còn lại Không đạt" với đúng một dấu cách giữa. Dựng `StatusBadge` 5 trạng thái: có `data-status` và `data-variant` đúng bảng mục 2.
3. Dựng `RecallSteps` với `current` lần lượt 1, 2, 3, 4: đủ 4 `li`; các `li` trước `current` có `data-state="done"` `data-tone="ok"`, `li` bằng `current` có `data-state="current"` `data-tone="warn"` và `aria-current="step"`, các `li` sau `data-state="pending"` `data-tone="muted"`; dựng với `current` rỗng thì không có `li` (như hiện tại).

`app/e2e/fe-ux-02b-van-hanh.spec.ts`:

| Ca | Kiểm |
|---|---|
| 1 | `/draft` (teller): 2 `[data-kpi]` `data-tone="default"`, giữ `aria-label`. `/config` (teller): `[data-kpi]` có chữ "Giá áp dụng" `data-tone="au"`, `[data-kpi]` có chữ "Tổng cung trên chuỗi" `data-tone="hl"`; `getByTestId('effective-price')` không phải phần tử `[data-kpi]` và có chữ kết thúc bằng ` VNDB` |
| 2 | Đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` TRONG `main` sau khi màn tải xong ở `/draft`, `/config`, `/recall` (vai teller; `/recall` thêm vai controller): bằng hằng số dev đo trên `release/ui-v2` @ `27a52ad` trước khi sửa, đo TRONG lần chạy e2e mock đầy đủ cùng thứ tự (chép tạm spec mới vào nhánh mốc, không đo trên máy chủ mới, vì spec chạy trước như `fe-07` để lại dữ liệu), ghi trong test và checkpoint |
| 3 | 390 px: `document.documentElement.scrollWidth <= 390` ở 3 màn; 1440 và 390 không có lỗi console, không cảnh báo hydrate |

Không tạo dữ liệu trong spec mới (không mở đợt thu hồi, không lập yêu cầu) để không đổi dữ liệu của spec chạy sau; luồng có dữ liệu do `maker-checker.spec.ts`, `recall.spec.ts`, `fe-07-price-config.spec.ts` phủ. Bước thu hồi kiểm ở unit test (mock mới chưa có đợt nên không có bước nào hiện).
