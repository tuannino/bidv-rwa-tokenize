# transactions.html (màn `/transactions`, Giao dịch)

Màn thật: `app/src/app/(ops)/transactions/page.tsx` (breadcrumbs "Vận hành", "Giao dịch"), `app/src/components/pages/ops-transactions.tsx` (`OpsTransactionsPage`, `SupplyMetric`, `StatusBadge`, `shortWallet`, `stepStateLabel`, `pageSummary`). Đã đọc thêm `components/trading/gates.ts` (`SIDE_LABELS`, `ORDER_STATUS_LABELS`), `lib/bank/ops-transactions.service.ts` (`OpsOrderPage`, `interventionOf`, `currentStepOf`), `lib/bank/settlement-steps.ts`. Vai: Giao dịch viên, Kiểm soát viên.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Giao dịch toàn hệ thống", câu phụ, "Chain đang xem: mock." | header `OpsTransactionsPage`, `useSelectedChain` | |
| Ghi chú "Vai trò Kiểm soát viên chỉ có quyền xem. Màn hình không cung cấp hành động can thiệp." | `data.mayExecute === false` | Chỉ hiện với `?role=controller` (`UI.role`) |
| Ba ô Tổng cung, Chưa phân phối, Đang lưu hành (WPT) | `SupplyMetric`, `listOpsOrdersAction().supply` (`totalSupply`, `undistributed`, `circulating`) | Thành ô bento: xanh, vàng, trắng. Màn thật ẩn cả khối khi `supply = null` |
| Ô tìm "Tìm mã lệnh hoặc nhà đầu tư…" | `filters.q` (trễ 300 ms) | Thêm nhãn hiển thị "Tìm kiếm"; màn thật chỉ có `sr-only` |
| Dropdown "Nhà đầu tư": Tất cả nhà đầu tư + ví rút gọn | `filters.investorWallet`, `data.investors`, `shortWallet` | Nhãn hiển thị lấy từ `aria-label` |
| Dropdown "Chiều lệnh": Mọi chiều, Mua, Bán | `filters.side`, `ORDER_SIDES`, `SIDE_LABELS` | |
| Dropdown "Trạng thái": Mọi trạng thái + 7 trạng thái | `filters.status`, `ORDER_STATUSES`, `ORDER_STATUS_LABELS` | |
| Từ ngày, Đến ngày | `filters.fromDate`, `filters.toDate` | |
| Thông báo kết quả can thiệp | `feedback` sau `executeOrderAction` | Bấm "Tiếp tục quyết toán" hoặc "Đối soát giao dịch" để xem câu đúng như màn thật |
| Bảng: Mã lệnh (liên kết), Nhà đầu tư, Chiều, WPT, VNDB, Bước hiện tại (nhãn + trạng thái bước), Trạng thái, Tạo lúc, Cập nhật, Hành động | `data.rows` (`OpsOrderRow`: `id`, `investorWallet`, `side`, `wptAmount`, `vndAmount`, `currentStep.label/state`, `status`, `createdAt`, `updatedAt`, `canExecute`, `intervention`) | Cột Hành động chỉ có với Giao dịch viên (`mayExecute`). Mã lệnh mở `transaction-detail.html`; cả dòng bấm được |
| Ô Hành động: "Tiếp tục quyết toán" (CHECKING), "Đối soát giao dịch" (EXECUTING có tx), "Cần đối soát tay" (EXECUTING chưa có tx), "–" | `intervention`, `canExecute` | |
| "Hiển thị 1–12 / 27 bản ghi", nút Trang trước/Trang sau, "1 / 3" | `pageSummary(data)`, `data.page`, `data.totalPages`, `PAGE_SIZE = 12` | Trang trước khoá ở trang 1 |
| Trạng thái tải "Đang tải giao dịch…", lỗi, rỗng "Không có lệnh nào khớp bộ lọc." | nhánh `fresh === null`, `fresh.error`, `rows.length === 0` | Không dựng ở trạng thái có dữ liệu; dùng `.empty` khi cần |

Lớp cục bộ: `<style>` trong trang gồm `[hidden]`, thu đệm ô bảng 8px và cho nút can thiệp xuống dòng (bảng 10 cột vừa khung 1440), và bố cục bộ lọc 1 hoặc 2 cột ở màn hẹp.

## Thay đổi chỉ là trình bày
Số liệu nguồn cung thành ô bento có biểu tượng; bộ lọc và bảng gộp vào một thẻ; Chiều tô xanh (Mua) và vàng (Bán) như `text-primary`/`text-chart-4`; nhãn trạng thái có màu theo nhóm; Tạo lúc và Cập nhật tách hai dòng ngày, giờ; cả dòng bấm được sang chi tiết (màn thật chỉ mã lệnh là liên kết).

## Có đụng backend không
Không.

## Lệch đã thấy
- Màn thật hiện mã lệnh bằng `order.id.slice(0, 8)` của UUID. Bộ dữ liệu chung dùng mã `ORD-2026-xxxx`; cắt 8 ký tự sẽ ra "ORD-2026" cho mọi dòng, nên trang mẫu hiện đủ mã. Khi chuyển sang mã có tiền tố cần đổi cách cắt.
- Lệnh PLACED: `currentStepOf` trả bước "Tạo lệnh, Đã xong" vì không có bước `current` (PLACED có `next: 'pending'`), nên bảng không cho thấy lệnh đang chờ được nhận xử lý.
- `stepStateLabel` (Đã xong, Dừng tại đây) khác `STEP_STATE_LABELS` ở màn chi tiết (Xong, Dừng ở bước này) cho cùng trạng thái bước.
