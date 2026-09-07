# Spec: MINT FLOW — Requirements

## Mục tiêu
Cán bộ ngân hàng phát hành (mint) token điện gió cho nhà đầu tư đã được cấp phép, chạy end-to-end trên codebase hiện có, trên chain chọn được (mặc định hardhat-local), với tích hợp KYC ở chế độ mock.

## User story
Là **BANK_ADMIN**, tôi muốn phát hành một lượng token WPT cho một nhà đầu tư đã whitelist, để nhà đầu tư sở hữu phần quyền hưởng tương ứng, và thao tác được ghi nhận.

## Acceptance criteria (EARS)
1. WHEN BANK_ADMIN mint cho investor đã whitelist AND amount > 0, THE system SHALL gọi `ILedgerPort.mint`, chờ receipt `CONFIRMED`, lưu giao dịch, và cập nhật balance hiển thị.
2. IF investor CHƯA whitelist, THE system SHALL từ chối (không gửi tx) và báo lỗi rõ ràng.
3. IF amount ≤ 0 hoặc sai định dạng, THE system SHALL trả lỗi validation.
4. WHILE chờ receipt, THE system SHALL poll đến CONFIRMED/FAILED hoặc timeout (mặc định 30s).
5. WHERE role ≠ BANK_ADMIN, THE system SHALL chặn (kiểm qua RBAC, không hard-code).
6. WHERE người dùng đổi chain trên UI, THE system SHALL dùng adapter tương ứng qua `getLedger(chain)`; chọn `mock` thì luồng chạy KHÔNG cần chain thật.
7. THE system SHALL để `balanceOf(investor)` phản ánh đúng số dư sau mint CONFIRMED.

## Ngoài phạm vi (mint flow)
DvP, chia lợi tức, redeem, Fireblocks, Stellar, KYC thật, maker-checker.
