# transactions.html (màn `/transactions`, Giao dịch)

Màn thật: `app/src/app/(ops)/transactions/page.tsx`, `app/src/components/pages/ops-transactions.tsx` (`OpsTransactionsPage`, `SupplyMetric`, `StatusBadge`, `shortWallet`, `stepStateLabel`, `pageSummary`). Đã đọc thêm `components/trading/gates.ts` (`SIDE_LABELS`, `ORDER_STATUS_LABELS`), `lib/bank/ops-transactions.service.ts` (`OpsOrderPage`, `interventionOf`, `currentStepOf`, `mayExecute = can(role, 'order:execute')`), `lib/bank/settlement-steps.ts` (`PROGRESS`, năm bước), `lib/store/memory.order.store.ts` (tìm theo mã lệnh hoặc ví, `listOrderInvestors` sắp theo chuỗi), `lib/bank/purchase.service.ts` (`RECEIPT_UNKNOWN_MESSAGE`). Vai: Giao dịch viên (có cột Hành động), Kiểm soát viên (chỉ xem).

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Giao dịch toàn hệ thống", câu phụ, "Chain đang xem: mock." | header `OpsTransactionsPage` | |
| Thanh "Trạng thái xem thử": Có dữ liệu, Đang tải, Lỗi tải, Không khớp bộ lọc | Không có trên màn thật | Mặc định "Có dữ liệu" |
| Ghi chú "Vai trò Kiểm soát viên chỉ có quyền xem. Màn hình không cung cấp hành động can thiệp." | `data && !data.mayExecute` | Chỉ Kiểm soát viên, chỉ khi đã có dữ liệu |
| Ba ô Tổng cung, Chưa phân phối, Đang lưu hành (WPT) | `SupplyMetric`, `data.supply` | Can thiệp thành công lệnh mua thì "Chưa phân phối" giảm, "Đang lưu hành" tăng đúng số WPT, như câu "cập nhật số liệu nguồn cung" |
| Ô tìm, gợi ý "Tìm mã lệnh hoặc nhà đầu tư…", nhãn ẩn "Tìm mã lệnh hoặc nhà đầu tư" | `filters.q`, trễ 300 ms; `<span className="sr-only">` (ops-transactions.tsx:166) | Lọc thật: mã lệnh hoặc ví chứa chuỗi gõ, không phân biệt hoa thường |
| Chọn "Nhà đầu tư" (Tất cả nhà đầu tư + ví rút gọn), "Chiều lệnh" (Mọi chiều, Mua, Bán), "Trạng thái" (Mọi trạng thái + 7 trạng thái), "Từ ngày", "Đến ngày" | `filters.*`, `aria-label` | Không hiện nhãn trên màn như dev (chỉ `aria-label`). Lọc thật trên dữ liệu mẫu; ngày so theo ngày tạo, gồm hai đầu; đổi bộ lọc về trang 1 |
| Thông báo can thiệp thành công "Đã tiếp tục quyết toán lệnh xxxxxxxx và cập nhật số liệu nguồn cung." hoặc "Đã đối soát giao dịch của lệnh xxxxxxxx; không phát lại giao dịch." | `feedback` tone success (ops-transactions.tsx:121-131) | `.alert ok` |
| Phản hồi lỗi sau can thiệp "Giao dịch đã gửi, chưa có xác nhận. Lệnh giữ trạng thái đang quyết toán, ngân hàng sẽ đối soát." | `feedback` tone error, `result.error` (ops-transactions.tsx:132-135, 194-199) | `.alert bad` có biểu tượng x; mô phỏng ở lệnh `bd9c66b3` (nút "Đối soát giao dịch"), lệnh `972a8469` đối soát thành công |
| "Đang tải giao dịch…" | `fresh === null` (ops-transactions.tsx:203-207) | `.empty` có biểu tượng loader; tab "Đang tải" |
| Lỗi tải | `fresh.error` (ops-transactions.tsx:208-209) | `.alert bad` với câu dự phòng của `toResult`: "Lỗi không xác định."; tab "Lỗi tải" |
| "Không có lệnh nào khớp bộ lọc." | `data.rows.length === 0` (ops-transactions.tsx:210-211) | `.empty`; tab "Không khớp bộ lọc" hoặc lọc ra rỗng |
| Bảng: Mã lệnh, Nhà đầu tư, Chiều, WPT, VNDB, Bước hiện tại (nhãn + trạng thái bước), Trạng thái, Tạo lúc, Cập nhật, Hành động | `data.rows` | Mã lệnh là UUID, hiện `id.slice(0, 8)`, `title` là UUID đầy đủ; liên kết tới `transaction-detail.html?id=<UUID>` (cả dòng bấm được) nên mỗi dòng mở đúng lệnh của nó. Cột Hành động chỉ có khi `mayExecute` |
| Ô Hành động: "Tiếp tục quyết toán" (CHECKING), "Đối soát giao dịch" (EXECUTING có tx), "Cần đối soát tay" (EXECUTING chưa có tx), "–" | `interventionOf`, `canExecute` | Đang chạy: nút có biểu tượng quay, các nút khác khoá (`workingId`) |
| "Hiển thị 1–12 / 28 bản ghi", Trang trước, Trang sau, "1 / 3" | `pageSummary`, `PAGE_SIZE = 12` | Chạy thật theo dữ liệu đã lọc; "0 bản ghi" khi rỗng |

Dữ liệu mẫu: 28 lệnh (UUID cố định), sáu ví nhà đầu tư mẫu, giá 100.000 VNDB mỗi WPT, đủ bảy trạng thái; nguồn cung 10.000.000 = 6.587.500 chưa phân phối + 3.412.500 đang lưu hành (khớp `draft.html`, `vault.html`). Cùng một bộ dữ liệu chép vào `transaction-detail.html`.

## Thay đổi so với bản chốt (dev mới)
Đã rà `git diff f164939 67ece1e` cho `app/src/app/(ops)/transactions/page.tsx`, `components/pages/ops-transactions.tsx`, `lib/bank/ops-transactions.service.ts`, `lib/bank/settlement-steps.ts`, `components/trading/gates.ts`: các tệp màn và dịch vụ của màn này không đổi (`gates.ts` chỉ thêm lý do khoá cho màn Giao dịch của Nhà đầu tư, FIX-01, FE-10). Các sửa sau là theo rà soát độc lập (khớp lại dev, không do commit mới):
- Mã lệnh đổi sang UUID, hiện 8 ký tự đầu như dev, `title` là UUID đầy đủ; mỗi dòng dẫn tới chi tiết đúng lệnh qua `?id=` (trước đây mọi dòng mở cùng một lệnh Hoàn tất).
- Bảng, bộ lọc, phân trang dựng bằng script từ dữ liệu mẫu; bộ lọc lọc thật.
- Thêm trạng thái tải, lỗi tải, rỗng và phản hồi lỗi sau can thiệp, chữ đúng như dev.
- Bỏ tiêu đề thẻ "Lệnh mua và bán" (dev không có); bỏ nhãn hiện "Tìm kiếm" và các nhãn bộ lọc (dev chỉ có nhãn ẩn và `aria-label`).

Breadcrumb ("Vận hành / Giao dịch") không vẽ: chủ dự án đã bỏ dòng phụ trên tiêu đề; khung trang là `assets/shell.js`.

## Trạng thái giữ theo dev, chưa vẽ
- Khối nguồn cung ẩn khi `supply = null` (chưa có dự án hoặc không đọc được chuỗi): ops-transactions.tsx:149, ops-transactions.service.ts:117-119.
- Phân trang khi trang yêu cầu vượt tổng (máy chủ kẹp về trang cuối): ops-transactions.service.ts:109.

## Có đụng backend: Không

## Lệch đã thấy
- Lệnh PLACED: `currentStepOf` trả bước "Tạo lệnh, Đã xong" vì không có bước `current` (PLACED có `next: 'pending'`), nên bảng không cho thấy lệnh đang chờ được nhận xử lý.
- `stepStateLabel` (Đã xong, Dừng tại đây) khác `STEP_STATE_LABELS` ở màn chi tiết (Xong, Dừng ở bước này) cho cùng trạng thái bước.
- Ô Hành động trống ở dev in gạch dài; bản xem thử in gạch ngắn "–" theo quy tắc ký tự.
