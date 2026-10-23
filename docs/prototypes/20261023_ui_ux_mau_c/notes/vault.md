# vault.html (màn `/vault`, Vault thanh toán SPV)

Màn thật: `app/src/app/(ops)/vault/page.tsx` (breadcrumbs "Vận hành / Vault thanh toán SPV", cổng `vault:read`), `app/src/components/pages/vault-status.tsx`. Đã đối chiếu `lib/bank/vault.service.ts` (`config.canConfigure = can(role,'vault:configure')`, `canResolveWithdrawals = can(role,'vault:reconcile')`), `lib/bank/withdraw.service.ts` (câu lý do NEEDS_REVIEW, đối soát cho cả hai vai vận hành), `lib/rbac/permissions.ts`.
Vai: Kiểm soát viên (mặc định), Giao dịch viên. Tệp menu sáng: `vault.html`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề, câu phụ có tên chain | `VaultStatusPage` header, `useSelectedChain().chain` | |
| Nhóm "Trạng thái hiện tại" (15 ô) | Thẻ "Trạng thái hiện tại", `data.status` | Chia thành 5 ô KPI và hai thẻ con |
| Số dư VNDB (ô xanh lớn) | `status.vndbBalance` | |
| Có thể rút (ô vàng) | `status.withdrawable` | |
| Đang khoá | `status.lockedAmount` | |
| Số dư WPT | `status.wptBalance` | |
| Thu ròng | `status.netProceeds` | |
| Thẻ "Khoá theo kỳ": Chế độ khoá, Tỷ lệ đang áp, Tỷ lệ chờ áp, Khoá cố định, Phần khoá theo kỳ, Kỳ gần nhất | `MODE_LABEL[status.lockMode]`, `percent(status.percentRateBps)`, `status.pendingPercentRateBps` (null thì "Không có"), `status.fixedLockAmount`, `status.percentLocked`, `status.lastPeriodRef` | Tên thẻ con là nhóm trình bày mới |
| Thẻ "Ví và rút tiền": Địa chỉ vault, Ví nhận tiền rút, Đã chia kỳ trước, Trạng thái rút | `status.address`, `status.payoutWallet` (null thì "Chưa cấu hình"), `status.lastDistributedPrev`, `status.withdrawalsPaused` | Trạng thái rút thành nhãn màu |
| Thẻ "Cấu hình khoá": câu giải thích FIXED/PERCENT và câu theo kỳ | `VaultConfigCard`, `afterFirstPeriod = lastPeriodRef > 0` | Mẫu đã qua kỳ đầu nên hiện câu "tỷ lệ mới chỉ được ghi chờ..." |
| Câu "Chỉ Kiểm soát viên lưu được cấu hình; vai của bạn chỉ xem." | `!config.canConfigure` | Chỉ hiện với Giao dịch viên |
| Câu "Vault đang có thao tác khác (...)" | `config.busy` | Không hiện vì mẫu không có khoá vận hành |
| Ô Tỷ lệ khoá PERCENT (%), Số khoá cố định (VNDB, để trống được), Ví nhận tiền rút | `form.percent/.fixedLock/.payoutWallet` từ `config` | Giao dịch viên: cả ba ô `disabled` |
| Nút "Lưu cấu hình khoá" | `config.canConfigure` | Chỉ Kiểm soát viên |
| Kết quả lưu (câu và danh sách bước) | `result` sau `saveVaultConfigAction` | Bấm Lưu hiện câu NO_CHANGE mẫu |
| Thẻ "Lệnh rút cần xem xét", nút "Đối soát lệnh rút" | `WithdrawReviewCard`, `reconcileWithdrawRequestsAction` | Nút có ở cả hai vai như màn thật; thẻ nền vàng để nhấn việc cần xử lý |
| Mỗi lệnh: mã 8 ký tự, số VNDB, ví nhận rút gọn, thời điểm tạo, lý do, sự kiện Withdrawn ứng viên | `row.id`, `row.amount`, `row.payoutWallet`, `row.createdAt`, `row.reason`, `row.candidates` | |
| Ô Mã giao dịch, nút "Xác nhận hoàn tất", ô Lý do, nút "Đánh dấu thất bại" | `canResolve` (= `canResolveWithdrawals`), `resolveWithdrawRequestAction` | Chỉ Kiểm soát viên |
| Câu đối soát xong / rỗng "Không có lệnh rút nào cần xem xét." | `message`, `rows.length === 0` | Câu đối soát hiện khi bấm nút |
| Bảng "Lịch sử cấu hình": Block, Thời điểm, Tham số, Giá trị cũ, Giá trị mới, Giao dịch, Người thao tác | `VaultConfigHistoryCard`, `PARAM_LABEL`, `configValue`, `ROLE_LABEL`, `actor.source === 'OUTSIDE_APP'` thì "Ngoài app" | Phân trang chỉ hiện khi tổng lớn hơn 10 như màn thật (mẫu 6 dòng) |
| Bảng "Lịch sử chốt kỳ (10 lần gần nhất)": Kỳ, Đã chia kỳ trước, Tỷ lệ, Phần khoá, Người đặt, Thời điểm, Giao dịch | `data.history[]`: `periodRef`, `distributedPrev`, `rateBps`, `percentLocked`, `operator`, `timestamp`, `txHash` | |
| Trạng thái "Chain này chưa triển khai vault thanh toán SPV", "Chưa có kỳ nào được chốt.", "Vault chưa có thay đổi cấu hình nào.", đang đọc, lỗi | `VaultStatusPage`, các thẻ con | Không dựng vì chọn trạng thái có dữ liệu |

## Thay đổi chỉ là trình bày
- 15 ô trạng thái chia thành bento: ô xanh lớn Số dư VNDB, ô vàng Có thể rút, ba ô số; 10 ô còn lại vào hai thẻ con "Khoá theo kỳ" và "Ví và rút tiền" (tên nhóm mới, không phải trường mới).
- Cấu hình khoá và Lệnh rút cần xem xét đứng cạnh nhau; ô nhập có hậu tố % và VNDB.
- Thêm `<style>` cục bộ `[hidden]{display:none!important}`.

## Có đụng backend không
Không. Mọi trường có sẵn trong `getVaultOverviewAction`, `getVaultConfigHistoryAction`, `listWithdrawReviewsAction`.

## Lệch đã thấy
- Hàm rút gọn địa chỉ ở màn này lấy 8 ký tự đầu (`0x90F79b…93b906`), màn Chia lợi nhuận lấy 10 ký tự; nên thống nhất.
- Thời điểm dùng `toLocaleString('vi-VN')`, khác `formatDateTime` ở màn lập duyệt.
- Câu lý do NEEDS_REVIEW in đủ mã giao dịch 66 ký tự, dễ tràn khung hẹp (bản mới cho xuống dòng).
- Màn thật không có phân trang cho "Lệnh rút cần xem xét" (máy chủ giới hạn 20 dòng) và không nói khi chạm giới hạn.
