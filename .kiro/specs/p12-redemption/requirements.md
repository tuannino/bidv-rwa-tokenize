# Spec P12 - Tất toán / Hoàn vốn trên Ethereum testnet (Sepolia)

Đọc kèm `#steering-testnet`. Tiền đề: Phase 0 của spec P4 đã xong (contract deploy + verify,
địa chỉ chain `evm` đã nạp; trong đó có `Redemption`).

## Mục tiêu

Đưa luồng tất toán (P12) chạy trên Sepolia. Cuối vòng đời hoặc khi hoàn vốn, ngân hàng nạp
thanh khoản VND vào hợp đồng `Redemption` và đặt tỷ giá; nhà đầu tư đưa WPT vào để nhận VND,
hợp đồng đốt WPT tương ứng. Contract giữ nguyên (`Redemption` đã pass test); phần việc là mở
rộng `ILedgerPort`, adapter EVM, nguồn sự thật, RBAC và UI.

## User story

Là BANK_ADMIN, tôi muốn nạp quỹ VND và đặt tỷ giá hoàn vốn, để nhà đầu tư có thể tất toán
phần nắm giữ WPT của mình lấy lại VND on-chain.

Là INVESTOR đã KYC, tôi muốn đổi một lượng WPT lấy VND theo tỷ giá công bố, và WPT của tôi
bị đốt tương ứng.

## Acceptance criteria (EARS)

Chuẩn bị (ngân hàng):

1. WHEN BANK_ADMIN đặt tỷ giá qua `setRate(newRate)` với newRate > 0, THE system SHALL cập
   nhật `rate` (số VND cho 1 WPT).
2. WHEN BANK_ADMIN nạp quỹ qua `fund(amount)` sau khi approve VND, THE system SHALL kéo VND
   vào hợp đồng và tăng thanh khoản khả dụng.
3. WHERE BANK_ADMIN tạm dừng, THE system SHALL cho `setPaused(true)` để chặn redeem, và
   `setPaused(false)` để mở lại.

Tất toán (nhà đầu tư):

4. WHEN INVESTOR đã KYC approve WPT cho hợp đồng rồi gọi redeem(wptAmount) với wptAmount > 0
   AND hợp đồng đủ thanh khoản VND, THE system SHALL đốt WPT (`burnFrom`) và chuyển
   `quote(wptAmount) = wptAmount * rate` VND cho nhà đầu tư.
5. IF nhà đầu tư CHƯA KYC (whitelist), THE system SHALL từ chối (contract revert "chua KYC").
6. IF hợp đồng thiếu thanh khoản VND, THE system SHALL từ chối (revert "thieu thanh khoan VND")
   và trả lỗi đọc được, không đốt WPT.
7. IF đang paused, THE system SHALL từ chối redeem.
8. WHEN redeem CONFIRMED, THE system SHALL để số dư WPT của nhà đầu tư giảm đúng wptAmount,
   tổng cung WPT giảm tương ứng, và số dư VND của nhà đầu tư tăng đúng số quote.

Quyền và chain:

9. WHERE role không phù hợp, THE system SHALL chặn qua RBAC: setRate/fund/withdraw/setPaused
   cần quyền cấu hình tất toán (ngân hàng); redeem là quyền nhà đầu tư cho chính ví mình.
10. WHILE chạy trên chain `evm`, mọi giao dịch ghi SHALL đi qua `ILedgerPort` và ký qua
    `ISigner`; giao dịch lên block Sepolia và tra được trên Etherscan.

## Ngoài phạm vi (P12)

Chia lợi tức (P7), maker-checker nhiều mắt, tính tỷ giá theo NAV động (dùng tỷ giá cố định do
ngân hàng đặt), Stellar. `withdraw` phần VND dư đưa vào task tùy chọn.
