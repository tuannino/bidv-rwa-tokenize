# FE-UX-03b: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/distribution.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a, 02b, 03a.

## 1. Bố cục (1440 px; dưới 1100 px một cột)

| Khối | Bố cục |
|---|---|
| Đầu màn | `h1` "Chia lợi nhuận" và `TokenScopeSelect` một hàng; kết quả thao tác (`Alert`) ngay dưới |
| Quỹ chia | Lưới 12 cột. Phần tử `aria-label="Quỹ chia"` CHỈ bọc 4 ô số liệu (không bọc thẻ Duyệt chia), dựng lưới lồng: phần tử này chiếm 8 cột (Giao dịch viên: 12 cột) và bên trong là lưới 2 cột: "Số dư quỹ" `Kpi au lg` cao 2 hàng; "Chưa phân bổ" `Kpi gold`; "Tổng dự trữ các kỳ"; "Ngưỡng tối thiểu" (Giao dịch viên: trải rộng phần còn lại). Thẻ "Duyệt chia" (Kiểm soát viên) 4 cột cạnh phần tử đó, kéo giãn, giữ vùng nhãn "Duyệt chia" như hiện tại, danh sách lý do chặn có biểu tượng (lớp tiện ích), nút ở đáy thẻ. Chain không hỗ trợ: thẻ thông báo 12 cột, và thẻ Duyệt chia (Kiểm soát viên) VẪN hiện, đứng riêng 12 cột với nút khoá và lý do chặn như hiện tại |
| Dự kiến (tham khảo) | `Card tone="tint"` 12 cột, câu mô tả, `Alert warn` khi danh sách bị cắt, bảng "Người nhận dự kiến" cuộn dọc tối đa 280 px (lớp nhắm `[data-slot=table-container]`, requirements QĐ-6), đầu bảng dính |
| Kỳ hoạt động | Thẻ 12 cột (khi có), lưới khoá giá trị tự chia cột tối thiểu 190 px (thay `Metric`), giá trị số `tabular-nums`, mã giao dịch `font-code` qua `TxLink` sẵn có; nhãn trạng thái kỳ, trạng thái duyệt, trạng thái chốt vault dạng `Badge` sắc; ghi chú `Alert info` giữ `role`; nút Duyệt lại, Tiếp tục chia ở đáy thẻ |
| Lịch sử kỳ chia | Thẻ 12 cột: bảng "Danh sách kỳ chia" (nhãn trạng thái sắc), phân trang; khi bấm "Xem hồ sơ": khung hồ sơ trả bên trong thẻ (bảng "Hồ sơ trả từng ví", nhãn sắc, phân trang 10 ví) |
| Lịch chạy | Thẻ riêng 12 cột (do `HistoryCard` trả cùng Fragment), bảng kết quả sắc, rỗng dùng `EmptyState` |
| Hộp xác nhận | `Dialog` sẵn có; hai câu xác nhận giữ nguyên; câu lưu ý chuyển tiền trong `Alert bad` không `role`; nút "Duyệt và chia" mặc định, nút huỷ `outline` |

Biểu tượng tiêu đề thẻ (lucide, dev được chọn tương đương, ghi checkpoint): Quỹ chia `Landmark`, Duyệt chia `ShieldCheck`, Dự kiến `Users`, Kỳ hoạt động `CalendarClock`, Lịch sử `History`, Lịch chạy `Timer`.

## 2. Ánh xạ sắc

Theo requirements QĐ-4. Kết quả thao tác: `ok` khi `message.tone === 'ok'`, `bad` khi `error` (giữ nguyên quy tắc hiện có).

## 3. Kiểm thử mới

`app/test/fe-ux-03b.test.ts` (môi trường `node`):

1. Mọi giá trị của `DISTRIBUTION_PERIOD_STATUSES`, `DISTRIBUTION_APPROVAL_STATUSES`, `DISTRIBUTION_PAYOUT_STATUSES`, `KEEPER_RUN_STATUSES`, `VAULT_CLOSE_STATUSES` trả đúng bảng QĐ-4; giá trị lạ trả `info`.
2. Dựng `ActivePeriodCard` bằng `renderToStaticMarkup` với `ActivePeriodView` giả (chỉ trường cần), kiểm nút theo tên và thuộc tính `disabled`:

| Trạng thái giả | Kỳ vọng |
|---|---|
| `nextAction: 'REAPPROVE'`, `status: 'OPEN'`, `canApprove: true`, `busy: false` | có nút "Duyệt lại số thực tế … VNDB" mở; không có "Tiếp tục chia" |
| `nextAction: 'CONTINUE'`, `canApprove: true`, `busy: false` | có nút "Tiếp tục chia" mở, không có biểu tượng quay; không có nút Duyệt lại |
| `nextAction: 'REAPPROVE'`, `status: 'OPENING'`, `pendingOnChain: true`, có `openTxHash` | KHÔNG có nút Duyệt lại; có câu "Đã gửi lên chuỗi, đang đối soát" và liên kết mã giao dịch mở kỳ; "Số thực tế trên chuỗi" là "chưa đọc được" |
| `busy: true` với lần lượt `REAPPROVE` (`OPEN`) và `CONTINUE` | nút tương ứng có `disabled`; nút Tiếp tục chia có biểu tượng quay |
| `canApprove: false` với `REAPPROVE` và `CONTINUE` | không có nút thao tác nào |

Mọi trạng thái: phần tử gốc có `aria-label="Kỳ hoạt động"`, ghi chú `role="status"` `aria-label="Ghi chú kỳ hoạt động"`.

`app/e2e/fe-ux-03b-chia-loi-nhuan.spec.ts` (chỉ chạy trên project mock; CHỈ ĐỌC, không nạp quỹ, không duyệt; lúc chạy theo thứ tự tên tệp, quỹ mock bằng 0, lịch sử rỗng):

| Ca | Kiểm |
|---|---|
| 1 | Hai vai (controller, teller): trong `getByLabel('Quỹ chia')` có 4 `[data-kpi]`; ô có chữ "Số dư quỹ" `data-tone="au"`, "Chưa phân bổ" `gold`, hai ô còn lại `default`; Giao dịch viên vẫn không có nút `/^Duyệt chia/` |
| 2 | Đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` TRONG `main` sau khi màn tải xong (chờ `networkidle` rồi chờ `getByLabel('Quỹ chia')` hiện), hai vai: bằng hằng số dev đo trên `release/ui-v2` @ `baf0fd4` bằng chính ca này (chép tạm vào nhánh mốc, chạy trong lần e2e mock đầy đủ cùng thứ tự), ghi trong test và checkpoint |
| 3 | 1440 và 390 px, hai vai: `scrollWidth` không vượt bề rộng; không lỗi console, không cảnh báo hydrate |

Luồng duyệt, chia, lịch sử, hồ sơ trả có dữ liệu do `zz-distribution-approval.spec.ts` phủ trên mock và Hardhat.
