# Spec P4 - Mint trên Ethereum testnet (Sepolia)

Đọc kèm `#steering-testnet`. Đây là spec nền: nó sở hữu phần bring-up dùng chung (deploy +
địa chỉ + verify) mà P7 và P12 phụ thuộc.

## Mục tiêu

Đưa luồng phát hành token WPT (P4) chạy thật trên Sepolia. Cán bộ ngân hàng whitelist một
nhà đầu tư rồi mint WPT cho ví đó trên chain thật, giao dịch lên block và xem được trên
Etherscan. Contract giữ nguyên (`ProjectToken` đã pass test); phần việc là deploy, cấu hình
địa chỉ, và kiểm chứng adapter EVM trên testnet.

## User story

Là BANK_ADMIN, tôi muốn mint một lượng WPT cho một nhà đầu tư đã KYC trên Sepolia, để bản
demo chứng minh luồng phát hành hoạt động trên một mạng công khai thật, có thể tra soát
độc lập bằng explorer.

## Acceptance criteria (EARS)

Bring-up (nền cho P4/P7/P12):

1. WHEN chạy `scripts/deploy.js` với `--network sepolia` AND `.env` có RPC + PRIVATE_KEY hợp lệ,
   THE system SHALL deploy ProjectToken, VNDToken, ProfitDistributor, Redemption lên Sepolia
   và ghi địa chỉ vào nguồn sự thật cho chainKey `evm`.
2. WHEN deploy xong AND đã đặt env `NEXT_PUBLIC_ADDR_EVM_*` (hoặc commit addresses.json "evm"),
   THE app SHALL cấp đúng địa chỉ cho chain `evm` qua `getContractAddress('evm', ...)`.
3. THE system SHALL verify được bốn contract trên Etherscan bằng `hardhat verify`.

Luồng mint trên testnet:

4. WHEN BANK_ADMIN whitelist một ví trên chain `evm`, THE system SHALL gọi
   `ILedgerPort.whitelist` (setWhitelisted=true), chờ receipt CONFIRMED, và `isWhitelisted`
   trả về true.
5. WHEN BANK_ADMIN mint amount > 0 cho ví đã whitelist trên chain `evm`, THE system SHALL
   gọi `ILedgerPort.mint`, ghi giao dịch PENDING vào sổ, chờ receipt tới CONFIRMED, rồi cập
   nhật số dư hiển thị.
6. IF ví CHƯA whitelist, THE system SHALL từ chối trước khi gửi tx (nhờ `simulateContract`)
   và trả lỗi đọc được, KHÔNG tạo tx thất bại tốn gas.
7. IF amount <= 0 hoặc sai định dạng, THE system SHALL trả lỗi validation, không gọi chain.
8. WHERE role khác BANK_ADMIN, THE system SHALL chặn qua `assertCan(role, 'token:mint')`,
   không hard-code role.
9. WHILE chờ receptt trên Sepolia, THE system SHALL poll tới CONFIRMED/FAILED hoặc timeout
   (chain `evm` dùng timeout dài hơn mặc định, đề xuất 90s), và KHÔNG coi timeout là FAILED
   chắc chắn (tx có thể vào block sau).
10. WHEN mint CONFIRMED, THE system SHALL để `balanceOf(investor)` trên Sepolia phản ánh
    đúng số vừa mint, và cung cấp link `https://sepolia.etherscan.io/tx/<hash>`.

## Ngoài phạm vi (P4)

Chia lợi tức (P7), tất toán (P12), KYC thật, maker-checker, Stellar, Fireblocks. Việc gán
vai reporter/oracle chỉ chuẩn bị ở bring-up nếu P7 cần, không thuộc nghiệm thu P4.
