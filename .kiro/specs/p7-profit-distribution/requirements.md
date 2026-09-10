# Spec P7 - Chia lợi tức trên Ethereum testnet (Sepolia)

Đọc kèm `#steering-testnet`. Tiền đề: Phase 0 của spec P4 đã xong (contract đã deploy +
verify trên Sepolia, địa chỉ đã nạp cho chain `evm`).

## Mục tiêu

Đưa luồng chia lợi tức (P7) chạy trên Sepolia. Ngân hàng chốt một kỳ chia: chốt snapshot số
dư WPT, nạp quỹ VND vào hợp đồng, sau đó nhà đầu tư nhận phần theo tỷ lệ sở hữu tại thời
điểm chốt. Hỗ trợ hai đường tạo kỳ: nhập tay số lợi nhuận, và lấy số lợi nhuận từ oracle sản
lượng điện (minh bạch theo dữ liệu vận hành). Contract giữ nguyên; phần việc là mở rộng
`ILedgerPort`, adapter EVM, nguồn sự thật ABI/địa chỉ, RBAC và UI.

## User story

Là BANK_ADMIN, tôi muốn tạo một kỳ chia lợi tức và nạp quỹ VND, để nhà đầu tư nắm giữ WPT
tại thời điểm chốt nhận đúng phần của mình bằng VND on-chain, minh bạch và không phụ thuộc
một thao tác nhập tay khi dùng oracle.

Là INVESTOR, tôi muốn xem phần mình được nhận của từng kỳ và tự nhận (claim) về ví.

## Acceptance criteria (EARS)

Tạo kỳ chia (nhập tay):

1. WHEN BANK_ADMIN tạo kỳ chia với amount > 0 AND đã approve đủ VND cho hợp đồng phân phối,
   THE system SHALL gọi `createDistribution(amount, period)`, chốt snapshot, kéo VND vào quỹ,
   và trả về distributionId.
2. IF tổng cung WPT tại thời điểm chốt = 0, THE system SHALL từ chối (contract revert
   "khong co WPT dang luu hanh") và trả lỗi đọc được.
3. IF ngân hàng chưa approve đủ VND, THE system SHALL báo lỗi rõ trước hoặc khi gửi tx, không
   để giao dịch treo mập mờ.

Tạo kỳ chia (từ oracle):

4. WHEN reporter đẩy số liệu kỳ qua `submitReading(periodId, kWh, tariff, opex, bankShareBps)`
   đủ `requiredConfirmations`, THE system SHALL để kỳ đó `isFinalized` = true và tính được
   `distributableProfitVnd(periodId)`.
5. WHEN BANK_ADMIN gọi tạo kỳ chia từ oracle cho một periodId đã finalized, chưa dùng, số > 0
   AND đã approve đủ VND, THE system SHALL gọi `createDistributionFromOracle(periodId)` và
   tạo kỳ chia với đúng số lợi nhuận oracle tính.
6. IF periodId chưa finalized hoặc đã tạo kỳ chia trước đó, THE system SHALL từ chối tạo trùng.

Nhận lợi tức:

7. WHEN INVESTOR xem một kỳ, THE system SHALL hiển thị phần được nhận qua
   `previewClaim(id, account)` (0 nếu đã nhận).
8. WHEN INVESTOR claim một kỳ chưa nhận có phần > 0, THE system SHALL gọi `claim(id)`, chuyển
   VND về ví, đánh dấu đã nhận, và số dư VND của nhà đầu tư tăng đúng phần được chia.
9. WHERE BANK_ADMIN chia hộ hàng loạt, THE system SHALL gọi `distributeTo(id, accounts)` để
   chi cho danh sách ví, mỗi ví nhận đúng một lần.

Quyền và chain:

10. WHERE role không có quyền tương ứng, THE system SHALL chặn qua RBAC: tạo kỳ / chia hộ /
    quét dư cần quyền phân phối (ngân hàng); claim là quyền của nhà đầu tư cho chính ví mình.
11. WHILE chạy trên chain `evm`, mọi giao dịch ghi SHALL đi qua `ILedgerPort` và ký qua
    `ISigner`; giao dịch lên block Sepolia và tra được trên Etherscan.

## Ngoài phạm vi (P7)

Tất toán/redeem (P12), maker-checker nhiều mắt, gateway SCADA thật (dùng reporter thủ công
để mô phỏng), Stellar. `sweepDust` (quét phần dư sau hạn) đưa vào task tùy chọn, không bắt
buộc để nghiệm thu P7.
