# FE-UX-03a: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/approvals.html`, `approval-detail.html`, `assets/c.css` (`.alert` 269 tới 274, `.empty` 277 tới 280, `.timeline` 284 tới 293). Thành phần: dùng nguyên API của FE-UX-02a, 02b.

## 1. Bố cục

| Màn | Bố cục (1440 px; dưới 1100 px một cột) |
|---|---|
| `/approvals` | `h1` "Phê duyệt lệnh" và `TokenScopeSelect` trên một hàng (như `/draft`). Lưới 12 cột: 3 `Kpi` 4 cột mỗi ô (biểu tượng `Clock`, `ShieldCheck`, `ShieldX`); lỗi số liệu `Alert bad` 12 cột. Thẻ "Hàng chờ tạo token", "Hàng chờ huỷ token" 12 cột, `CardTitleIcon` (`CirclePlus`, `Flame`), câu mô tả giữ nguyên dưới tiêu đề thẻ; hàng bộ lọc: ô tìm co giãn, ô chọn trạng thái rộng khoảng 220 px từ 640 px (một cột dưới 640 px); bảng `RequestTable` (đã có nhãn sắc, rỗng và đang tải bằng `EmptyState`). Thẻ lịch sử duyệt 12 cột, `CardTitleIcon` (`History`), câu "Hiện 50…" giữ nguyên |
| `/approvals/[id]` | Đầu màn: liên kết "Về danh sách" có biểu tượng mũi tên trái, `h1` "Chi tiết yêu cầu", mã đầy đủ `font-code`. Thẻ "Khối hành động" 12 cột: `StatusBadge` ở góc trên phải; bên trái cột khoảng 420 px gồm khung lý do khoá (`Alert warn`, biểu tượng `Lock`), ô lý do từ chối, cảnh báo duyệt (`Alert warn`, `role="alert"`); bên phải 3 nút cao 48 px (`size="lg"` cộng lớp `h-12`; Chấp nhận `Button` mặc định, Từ chối `destructive`, Đối soát `outline`), xếp dọc; dưới là dòng `reject-block-reason` và phản hồi `Alert`. Dưới 1100 px mọi thứ xếp dọc, nút trải ngang. Lưới 12 cột: "Khối thông tin token" 6 cột (giữ `TokenInfoBlock`), "Khối nội dung yêu cầu" 6 cột (danh sách nhãn trái, giá trị phải; giá trị mã `font-code`, số `tabular-nums`; dòng "Thực hiện qua" giữ nguyên chữ máy chủ), cao bằng nhau. Thẻ "Nhật ký" 12 cột dạng `.timeline`: cột thời gian 150 px `tabular-nums`, chấm tròn `bg-primary` có vòng `ok-bg`, đường nối `bg-border`, tên bước đậm, người thao tác sau dấu phẩy, chi tiết xuống dòng `break-all` |

Các thẻ có `aria-label` giữ đúng chuỗi QĐ-8; tiêu đề hiển thị của thẻ có thể khác chuỗi `aria-label` như hiện tại.

## 2. Trạng thái khoá ở chi tiết (để đối chiếu, không đổi)

| Trạng thái | Ô lý do | Chấp nhận | Từ chối | Đối soát |
|---|---|---|---|---|
| Có `decisionBlock` (đã quyết định, không phải người duyệt hợp lệ...) | khoá | khoá | khoá | ẩn, trừ khi `canReconcile` |
| Đã quyết định, `EXECUTING`, có `canReconcile` | khoá | khoá | khoá | mở (khoá khi `working`) |
| Chờ duyệt, có cảnh báo duyệt | mở | khoá (`approveBlockReason`) | theo `rejectBlock` (lý do) | ẩn |
| Chờ duyệt, không cảnh báo, lý do rỗng | mở | mở | khoá (`rejectBlock`) | ẩn |
| Chờ duyệt, không cảnh báo, đã nhập lý do | mở | mở | mở | ẩn |
| Đang gửi (`working`, mọi trạng thái) | như trước | khoá | khoá | khoá |

Dòng `reject-block-reason` hiện khi `!decisionBlock && rejectBlock && !working` (`approval-detail.tsx:251`). Dev xác nhận bảng này bằng mã hiện có (sửa bảng nếu mã khác), ghi trong checkpoint trước và sau.

## 3. Kiểm thử mới

`app/test/fe-ux-03a.test.ts` (môi trường `node`, `react-dom/server` `renderToStaticMarkup`, dữ liệu giả kiểu `TokenRequestDetailView` chỉ gồm trường cần): với mỗi trạng thái, gọi `actionBlocks(detail, working, rejectReason)` rồi dựng `ApprovalActions` với kết quả đó, kiểm thuộc tính `disabled` của nút theo tên, có hay không có nút Đối soát, `data-testid` hiện ra.

| Trạng thái giả | Chấp nhận | Từ chối | Đối soát | Khác |
|---|---|---|---|---|
| `PENDING`, có `approveWarning`, lý do đã nhập, không `working` | khoá | mở | không có | có `approve-warning` (`role="alert"`), không có `reject-block-reason` |
| `PENDING`, có `approveWarning`, lý do rỗng | khoá | khoá | không có | có `reject-block-reason` |
| `EXECUTING`, `canReconcile: true`, không `working` | khoá | khoá | mở | có `decision-block-reason`, ô lý do khoá |
| `EXECUTING`, `canReconcile: true`, `working: true` | khoá | khoá | khoá | không có `reject-block-reason` |

Lỗi có chủ đích "bỏ điều kiện cảnh báo khỏi nút Chấp nhận" phải làm hỏng dòng 1 (lý do đã nhập nên không thể đạt nhờ lý do rỗng).

`app/e2e/fe-ux-03a-kiem-soat.spec.ts`:

| Ca | Kiểm |
|---|---|
| 1 | `/approvals` (controller): TRƯỚC khi kiểm giao diện, `expect.poll` tới khi giá trị cả 3 ô là số đã định dạng (`/^\d{1,3}(\.\d{3})*$/`, nhận cả `0`), thay cho mốc chờ cũ đã mất ý nghĩa ở `maker-checker.spec.ts:142`; sau đó 3 `[data-kpi]` `data-tone="default"`, `aria-label` đúng 3 chuỗi QĐ-3 |
| 2 | Mock mới khởi động không có yêu cầu nào (kho bộ nhớ không có dữ liệu mẫu), nên ca này TỰ TẠO dữ liệu rồi dọn như `fe-ux-01c-chuyen-dong.spec.ts:207-220`: Giao dịch viên lập một yêu cầu tạo token (chép bước, không import spec cũ); Kiểm soát viên mở `/approvals` và chi tiết yêu cầu đó (từ hàng chờ tạo token); đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` TRONG `main` ở cả hai màn; cuối ca Kiểm soát viên TỪ CHỐI đúng yêu cầu vừa tạo (theo `requestId` lấy từ `data-request-id` ngay sau khi lập), đặt trong `finally` (hoặc `afterEach` dùng `requestId` đã lưu) để vẫn dọn khi kiểm bố cục hay ảnh thất bại. "Tải xong" xác định giống nhau ở mốc và nhánh mới: chờ `networkidle`, rồi chờ có `[data-request-id]` (hoặc chữ "Không có yêu cầu nào khớp.") ở `/approvals`, chờ thẻ "Khối hành động" ở chi tiết; không dựa vào `[data-loading]` (mốc không có). Số đếm bằng hằng số dev đo trên `release/ui-v2` @ `7b3216d` bằng chính ca này (chép tạm vào nhánh mốc), ghi trong test và checkpoint. Nếu việc lập rồi từ chối làm spec chạy sau đổi kết quả thì dừng và báo |
| 3 | GỘP trong cùng ca 2 (không phụ thuộc dữ liệu giữa các test), trước bước từ chối: ở 1440 px và 390 px, `scrollWidth` không vượt bề rộng ở `/approvals` và chi tiết; không lỗi console, không cảnh báo hydrate. Ca 2 và ca 3 có thể là một `test` duy nhất; khi đó tệp có 2 `test`, checkpoint ghi rõ |

Luồng chấp nhận và từ chối có dữ liệu do `maker-checker.spec.ts`, `mint.spec.ts`, `ops-transactions.spec.ts`, `recall.spec.ts` phủ trên mock; trên Hardhat chỉ `mint.spec.ts` (luồng Chấp nhận) và `chain-scope.spec.ts`. Không e2e nào kiểm trạng thái có cảnh báo duyệt hay nút Đối soát: hai trạng thái này kiểm bằng `fe-ux-03a.test.ts` với dữ liệu giả.
