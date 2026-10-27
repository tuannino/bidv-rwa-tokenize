# FIX-01: ví kết nối, định danh ví, ví nhận do Người bán chọn khi rút, yêu cầu

Nền: `dev` @ `c9163d5` (sau merge UIUX-01, PR #74). Người viết: giám sát. Nguồn: quyết định của chủ dự án ngày 27/10/2026 (bàn giao mục 3.2bt), góp ý Codex về bản nháp FIX-01 trước (giữ chỗ, khoá, kiểm thử đường tiền).

Bản này THAY toàn bộ bản nháp FIX-01 ngày 26/10 (đồng bộ ví nhận qua màn tài khoản): hướng đó đã bỏ.

## 1. Bối cảnh

- Hiện Nhà đầu tư và Người bán tự "liên kết ví" ở màn Thông tin tài khoản (OP-05 QĐ-I, bảng `ProfileWallet`, một ví mỗi hồ sơ mỗi chain). Máy chủ dùng liên kết này để biết ví nào thuộc hồ sơ nào khi đặt lệnh (`findInvestorProfileByWallet` ở `trade.service.ts`).
- Các phép đọc dữ liệu tài khoản của Nhà đầu tư (`getPortfolio`, `getWalletTransactions`, `listOrders`, `getOrderDetail`, `getTradeContext`) nhận địa chỉ ví từ trình duyệt và KHÔNG kiểm ví đó có thuộc phiên hay không. `placeOrder` cũng không kiểm.
- Ví nhận tiền rút của vault do Kiểm soát viên đặt ở biểu mẫu cấu hình vault.
- Định danh và whitelist ví chỉ làm được ở trang ẩn `/mint` (nút "KYC + Whitelist"), không gắn ví với hồ sơ nào.

## 2. Mục tiêu

1. Thông tin THUỘC VỀ TÀI KHOẢN của Nhà đầu tư và Người bán lấy theo ví đang kết nối. Màn Thông tin tài khoản không còn ô cấu hình ví.
2. Ngân hàng (Giao dịch viên) là bên duy nhất gắn ví cho hồ sơ, ở màn mới "Định danh ví": định danh trên chuỗi và gắn ví với hồ sơ trong cùng một thao tác.
3. Ví đang kết nối chưa được gắn cho hồ sơ của phiên thì mọi màn dữ liệu tài khoản báo "Ví chưa được định danh", máy chủ không trả dữ liệu của ví đó.
4. Người bán chọn ví nhận ngay ở lệnh rút (gõ ví mới hoặc dùng ví đang kết nối); ví chỉ cần hợp lệ và đã whitelist. Kiểm soát viên không còn đặt ví nhận.
5. Không tăng số server action khi mở các màn có sẵn.

## 3. Quyết định

- **QĐ-1: bảng mới `WalletBinding`** (ví đã gắn cho hồ sơ), một hồ sơ nhiều ví mỗi chain, một ví chỉ thuộc một hồ sơ mỗi chain (khoá chính `(chain, walletKey)`). Bảng `ProfileWallet` giữ nguyên trong lược đồ nhưng không còn được đọc hay ghi, và KHÔNG chép sang `WalletBinding`: ví cũ do người dùng tự khai, chưa được ngân hàng xác nhận, nên mọi ví phải được Giao dịch viên gắn lại (QĐ-7). Không xoá bảng cũ trong task này.
- **QĐ-2: chủ sở hữu ví** được xác định bởi một hàm duy nhất `resolveWalletOwner(chain, wallet)`: ví có trong `WalletBinding` thì là hồ sơ đó; không có, và chain là `mock` hoặc `hardhat-local`, thì là hồ sơ có ví mẫu trùng địa chỉ (`sample-wallets.json`); còn lại là không ai. Ví mẫu chỉ có hiệu lực trên hai chain thử nghiệm.
- **QĐ-3: chốt chặn ví của phiên ở máy chủ.** Hàm `assertOwnWallet({ role, chain, wallet })` ném lỗi mã mới `WALLET_NOT_BOUND`, câu "Ví chưa được định danh", khi vai là `INVESTOR` hoặc `SELLER` và `resolveWalletOwner` không trả đúng hồ sơ của phiên. Vai nhân viên (Giao dịch viên, Kiểm soát viên) không bị chặn bởi hàm này (họ đọc theo quyền `*:read:all` như hiện nay). Ví của hồ sơ khác cũng trả đúng câu này (không lộ ví đó thuộc ai).
- **QĐ-4: màn "Định danh ví"** (`/wallet-binding`, chỉ Giao dịch viên) thay cho phần "KYC + Whitelist" của `/mint`. `/mint` và `/kyc` giữ ẩn, không sửa.
- **QĐ-5: nhóm menu thu gọn "Nghiệp vụ ẩn"** chỉ ở menu Giao dịch viên, đặt cuối nhóm "Vận hành" (trước nhóm "Tài khoản"), gồm "Nạp VNDB" (chỉ khi cờ `ENABLE_DEMO_PAYMENT_MINT` bật, như hiện nay) rồi "Định danh ví" (luôn có). Mặc định thu gọn; tự mở khi trang đang xem nằm trong nhóm.
- **QĐ-6: ví nhận tiền rút chọn ở lệnh rút; đặt ví nhận là một bước TRONG vòng đời lệnh rút.** Hợp đồng chỉ rút về `payoutWallet` đã đặt trên vault, và đọc ví này TẠI LÚC giao dịch rút thực thi (`setPayoutWallet` cần DEFAULT_ADMIN và ví đã định danh). Vì vậy:
  - Lệnh rút được TẠO (giữ chỗ bền vững `clientRequestId`, số tiền, mục đích, ghi chú, ví nhận, người tạo) và lấy khoá vận hành `WITHDRAW` của chain TRƯỚC giao dịch đầu tiên, như luồng hiện có. Khoá giữ tới khi lệnh về trạng thái cuối, không bị tiếp quản theo thời gian (đúng cơ chế `WITHDRAW` hiện nay).
  - Khi ví chọn khác ví đang đặt, lệnh đi qua các trạng thái mới `PAYOUT_SENDING`, `PAYOUT_SENT`, `PAYOUT_SET` trước `SENDING`. Mã giao dịch đặt ví nhận lưu vào lệnh TRƯỚC khi chờ biên nhận.
  - Không gửi giao dịch rút khi giao dịch đặt ví nhận chưa có biên nhận `CONFIRMED`. Kết cục chưa rõ (mất mã, chưa có biên nhận quá lâu, ví trên vault không khớp) chuyển sang trạng thái riêng `PAYOUT_REVIEW` (tách khỏi `NEEDS_REVIEW` của bước rút để không đụng luồng xử lý mất mã rút hiện có); Kiểm soát viên chỉ chốt thất bại được khi ví ký ngân hàng không còn giao dịch nào đang chờ (QĐ-10).
  - Vì khoá `WITHDRAW` giữ suốt vòng đời và chỉ luồng này đổi ví nhận (Kiểm soát viên không còn đặt), không thể có giao dịch đặt ví nhận khác chen vào giữa lúc kiểm ví và lúc rút.
  - Quyền: dùng chính `vault:withdraw`. Không thêm quyền.
  - Ví nhận KHÔNG bắt buộc đã gắn cho hồ sơ Người bán (chủ dự án chốt): chỉ cần đúng dạng, khác địa chỉ 0, khác địa chỉ vault, không phải ví mẫu công khai của Hardhat trên chain thật, và đã whitelist.
- **QĐ-7: nâng lược đồ** theo cơ chế có sẵn ở `postgres.pool.ts`: thêm bảng vào `schema.prisma`, sinh lại `init.sql` và `init-sql.generated.ts`. Không có câu chép dữ liệu.
- **QĐ-8: Kiểm soát viên bỏ ô "Ví nhận tiền rút"** khỏi biểu mẫu cấu hình vault và khỏi `saveVaultConfig`, `VaultConfigTarget`, `planVaultConfig` (bước `setPayoutWallet` không còn ở đường của Kiểm soát viên). Bảng "Lịch sử cấu hình" giữ nguyên: sự kiện đổi ví nhận do app gửi sẽ hiện người thao tác là Người bán (vai ghi trong `Txn`).
- **QĐ-10: chốt thất bại khi còn giao dịch đang chờ là không an toàn.** Thêm hai phương thức ledger: `hasPendingSignerTx(): Promise<boolean>` (EVM: số nonce `pending` của ví ký máy chủ lớn hơn số nonce `latest`; mock: luôn `false`) và `txReceiptStatus(txHash): Promise<'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN'>` KHÔNG chờ (EVM: `getTransactionReceipt`; chưa có thì `getTransaction` còn thấy là `PENDING`, không thấy là `UNKNOWN`; mock: `CONFIRMED`); Stellar: `LedgerNotImplementedError` cho cả hai. `resolveWithdrawRequest` cho lệnh `PAYOUT_REVIEW` chỉ nhận kết cục `FAILED`, và từ chối khi `hasPendingSignerTx()` đúng: "Ví ký ngân hàng còn giao dịch đang chờ; chờ giao dịch đó có kết cục rồi chốt lại." Lệnh `NEEDS_REVIEW` (bước rút) giữ nguyên cách xử lý hiện có.
- **QĐ-11: phép đọc dữ liệu khách hàng phải có chain.** Với vai `INVESTOR`, `SELLER`, `listOrders` và `listTransactions` bắt buộc cả `chain` và ví; kiểm sở hữu và truy vấn dùng CHÍNH chain đó. Vai nhân viên giữ nguyên (chain tuỳ chọn, xem toàn hệ theo quyền).
- **QĐ-9: chain `mock` không có ví trình duyệt**, nên các màn Nhà đầu tư trên `mock` vẫn dùng ví mẫu của hồ sơ (`ownMockWallet`), nay chỉ trả ví mẫu (không đọc bảng liên kết cũ).

## 4. Ngoài phạm vi

- Gỡ gắn ví, sửa gắn ví (làm sau).
- Ký thông điệp chứng minh sở hữu ví (Sếp chốt không yêu cầu).
- Xoá bảng `ProfileWallet`.
- Màn `/kyc`, `/mint`; màn Rút VNDB của Nhà đầu tư (FE-23).
- Nhiều dự án trên một chain (nợ kỹ thuật 27/10).

## 5. Yêu cầu chức năng

### A. Gắn ví (máy chủ)

- **A1. `bindProfileWallet({ chain, actorId, wallet })`**, quyền `investor:whitelist` (qua `authorize`, có audit) và `kyc:approve` (như `onboardInvestor`; chỉ Giao dịch viên có). Thứ tự:
  1. Kiểm quyền (audit `DENIED` khi thiếu, như `authorize`). Kiểm dạng bằng `normalizeEvmAddress`; sai dạng: `VALIDATION`.
  2. `actorId` phải là hồ sơ khách hàng (`kind === 'CUSTOMER'`): hiện có `NDT001` (Nhà đầu tư), `NB001` (Người bán). Khác: `VALIDATION`.
  3. Ví là ví mẫu công khai của Hardhat (`PUBLIC_SAMPLE_WALLETS` có sẵn ở `@bidv/shared`) và chain không phải `mock`, `hardhat-local`: `VALIDATION` "Ví mẫu công khai của Hardhat không định danh được trên chain thật."
  4. Ví đã gắn cho hồ sơ KHÁC trên chain này, hoặc (trên `mock`, `hardhat-local`) là ví mẫu của hồ sơ KHÁC: `VALIDATION` "Ví đã được định danh cho hồ sơ khác." Không gửi gì.
  5. KYC qua `getKycProvider().verify` như `onboardInvestor`; từ chối: `PROVIDER`.
  6. `isWhitelisted(ví)` sai thì gửi `ledger.whitelist(ví)`, chờ biên nhận, lưu `Txn` (`operation: 'whitelist'`) như `onboardInvestor`. Biên nhận khác `CONFIRMED`: trả `LEDGER`, KHÔNG ghi gắn.
  7. Ghi `WalletBinding` (đã gắn đúng hồ sơ này thì giữ nguyên, trả kết quả như thành công). Ràng buộc duy nhất là trọng tài khi hai lần gắn tranh nhau: thua thì trả câu ở bước 4.
  8. Audit: `investor:whitelist` như hiện nay khi có giao dịch; `profile:wallet:bind` cho mọi kết cục từ bước 2 trở đi (SUCCESS hoặc FAILURE, kèm hồ sơ, ví, chain, mã tx nếu có).
- **A2. `listWalletBindings({ chain })`**, quyền `investor:whitelist` kiểm bằng `assertCan` (không ghi audit mỗi lần mở màn): mọi ví đã gắn trên chain, mới gắn trước, kèm tên hồ sơ, vai, người gắn, lúc gắn. CHỈ đọc DB, KHÔNG đọc trạng thái whitelist trên chuỗi cho từng dòng (tránh một action phát hàng trăm lời gọi RPC); whitelist đã được bảo đảm ở lúc gắn (A1 bước 6). Tối đa 200 dòng; đủ 200 thì câu "Hiện 200 ví gần nhất".

### B. Màn "Định danh ví" `/wallet-binding`

- **B1.** Trang `app/(ops)/wallet-binding/page.tsx`, cổng như `/demo-payment` nhưng theo quyền `investor:whitelist` (vai khác vào thẳng đường dẫn thì bị chặn như các trang vận hành khác). Breadcrumb "Vận hành / Nghiệp vụ ẩn / Định danh ví".
- **B2.** Một action khi mở: `listWalletBindingsAction({ chain })`. Đổi chain thì tải lại.
- **B3.** Biểu mẫu: chọn hồ sơ (danh sách hồ sơ khách hàng, hiện "Mã, tên, vai"), ô "Địa chỉ ví" (`0x…`), nút "Định danh và gắn ví". Đang gửi thì khoá nút. Kết quả: thành công hiện ví, hồ sơ, mã tx (hoặc "ví đã whitelist từ trước, không gửi giao dịch"); lỗi hiện câu máy chủ. Thành công thì tải lại danh sách bằng chính action B2.
- **B4.** Bảng "Ví đã định danh": Ví, Hồ sơ, Vai, Người gắn, Lúc gắn. Ghi chú dưới bảng: "Trên mock và hardhat-local, ví mẫu của hồ sơ được coi là đã định danh dù không có trong bảng."

### C. Menu

- **C1.** Thêm `collapsible?: boolean` vào `NavGroup`. Sidebar vẽ tiêu đề nhóm thu gọn là nút có `aria-expanded`, `aria-controls`; mặc định thu gọn; mở sẵn khi `pathname` khớp một mục trong nhóm.
- **C2.** Menu Giao dịch viên thêm nhóm `{ label: 'Nghiệp vụ ẩn', collapsible: true, items: [...] }` đặt sau nhóm "Vận hành": "Nạp VNDB" khi `canMintDemoPayment(role)`, rồi "Định danh ví" (`/wallet-binding`, biểu tượng mới `BadgeCheck`, phím tắt `I`). Bỏ việc ghép "Nạp VNDB" vào cuối nhóm đầu như hiện nay (`withDemoPayment` đổi theo).
- **C3.** Vai khác không có nhóm này.

### D. Chốt chặn ví của phiên (máy chủ)

- **D1.** Mã lỗi mới `WALLET_NOT_BOUND` trong `ErrorCode` (HTTP 403 ở `httpStatusFor`), lớp lỗi `WalletNotBoundError` được `toResult` chuyển sang mã này, câu "Ví chưa được định danh".
- **D2.** Gọi `assertOwnWallet` ngay sau kiểm quyền, CHẠY XONG rồi mới tới mọi phép đọc chuỗi hay DB khác (không chạy song song), ở: `getPortfolio`, `getWalletTransactions`, `listOrders` (khi vai không có `order:read:all`), `getOrderDetail` (qua `listOrders`), `previewPurchase` (nên `previewTrade` cũng bị chặn), `placeOrder`, `preparePermit`, và hai phép đọc của `/mint` mà vai khách hàng cũng có quyền: `listTransactions` (`txn:read`) và `readBalance` (`balance:read`) ở `mint.service.ts` (cùng `/api/txns`, `/api/balance`, `listTransactionsAction`, `readBalanceAction`): với vai `INVESTOR`, `SELLER` thì chain và ví là bắt buộc (`VALIDATION` khi thiếu, QĐ-11) và phải qua `assertOwnWallet`; truy vấn dùng đúng chain đã kiểm; vai nhân viên giữ nguyên. `listOrders` cũng vậy: vai không có `order:read:all` bắt buộc `chain` cùng `investorWallet`.
  - Audit: hàm đang dùng `authorize` (`getPortfolio`, `getWalletTransactions`, `listOrders`, `placeOrder`, `listTransactions`, `readBalance`) ghi thêm một dòng `DENIED` với action tương ứng và câu "Ví chưa được định danh" (không ghi hồ sơ chủ thật của ví). Vì `authorize` đã ghi `ALLOWED` trước đó, một lần bị chặn để lại cặp `ALLOWED` rồi `DENIED`: chấp nhận, ghi rõ trong checkpoint. Hàm cố ý dùng `assertCan` để không đổ sổ kiểm toán (`previewPurchase`, `preparePermit`, xem chú thích ở `purchase.service.ts`) thì KHÔNG ghi audit, giữ đúng chủ đích đó.
  - `getTradeContext` KHÔNG trả lỗi (để thông tin token vẫn hiện): trả thêm `walletBound: boolean`; khi `false` thì `balances` là `null` (kiểu đổi thành `{ wpt; vndb } | null`), `caps` của hai chiều là 0, và KHÔNG đọc số dư ví trên chuỗi.
- **D3.** `previewTrade`: điều kiện "Định danh" lấy hồ sơ bằng `resolveWalletOwner` và so bằng `actorId` (không so tham chiếu đối tượng như `ownProfile === investorProfile` hiện nay); bỏ nhánh câu "Ví không thuộc hồ sơ" vì D2 đã chặn trước. Điều kiện còn kiểm hồ sơ đã duyệt KYC và ví còn whitelist.
- **D4.** `findInvestorProfileByWallet`, `walletOfProfile`, `getProfileWallet`, `linkProfileWallet` bị gỡ (thay bằng `resolveWalletOwner`). `ownMockWallet` chỉ trả ví mẫu của hồ sơ phiên.

### E. Giao diện Nhà đầu tư

- **E1.** Khi một action trả `WALLET_NOT_BOUND` (hoặc `getTradeContext` trả `walletBound: false`), khối tương ứng (tài sản, lịch sử giao dịch, lệnh của tôi, chi tiết lệnh, khối đặt lệnh của `/trade`) hiện thành phần dùng chung `WalletNotBoundNotice` và khoá nút gửi lệnh: tiêu đề "Ví chưa được định danh", dòng phụ "Ví <rút gọn> chưa được ngân hàng định danh cho tài khoản này. Liên hệ ngân hàng hoặc kết nối ví khác." Không hiện số liệu cũ của ví trước.
- **E2.** Các phần thông tin chung (thông tin token, giá) vẫn hiện như hiện nay. Ở `/trade`, khi `walletBound` sai, lý do khoá ô số lượng là "Ví chưa được định danh".
- **E4.** Phạm vi tệp: `asset-summary.tsx`, `transaction-history-box.tsx`, `investor-orders.tsx`, `investor-order-detail.tsx`, `investor-trade.tsx`, `investor-token-detail.tsx` (gọi `getPortfolioAction`), `components/trading/trade-check-block.tsx` và `components/trading/gates.ts` (gọi `previewTradeAction`, `placeOrderAction`).
- **E6. Phản hồi lệch thứ tự.** Mọi khối gọi action theo ví hoặc chain giữ kết quả kèm khoá `chain|ví` của lần gọi (cùng mẫu `loaded.key === requestKey` đang dùng ở `approvals.tsx`); kết quả có khoá khác giá trị hiện tại bị bỏ, không ghi đè số liệu, nhãn "Đã định danh", hay trạng thái cho phép đặt lệnh của ví hoặc chain mới. Áp cho các tệp ở E4 và `account-wallet.tsx`.
- **E5.** `asset-summary.tsx` và `transaction-history-box.tsx` hiện dùng ví wagmi trên mọi chain (kể cả `mock`); giữ nguyên hành vi này. Trên `mock` mà trình duyệt có ví thật kết nối thì hai khối báo "Ví chưa được định danh": chấp nhận.
- **E3.** Không thêm action: thông báo dựa trên kết quả của action có sẵn.

### F. Màn Thông tin tài khoản (Nhà đầu tư, Người bán)

- **F1.** Bỏ khối nhập ví (ô "Dùng địa chỉ ví mới", nút "Dùng ví đang kết nối", nút "Lưu") và action `linkProfileWalletAction`.
- **F2.** Ô "Ví thanh toán" hiện:
  - chain `mock`: ví mẫu của hồ sơ, kèm nhãn "Đã định danh";
  - chain khác: ví đang kết nối (wagmi `useAccount`), kèm nhãn "Đã định danh" hoặc "Ví chưa được định danh"; chưa kết nối ví: "Chưa kết nối ví" và liên kết "Kết nối ví" tới `/wallet`.
- **F3.** Trạng thái lấy bằng MỘT action `getAccountWalletAction({ chain, wallet? })` trả `{ wallet: string | null; bound: boolean }` (`wallet` vắng trên `mock` thì máy chủ dùng ví mẫu). Gọi khi mở và khi ví kết nối hoặc chain đổi. Số action khi mở `/account` vẫn là 1.
- **F4.** Khối `[data-account-role]` của `AccountInfoPage` không có nút hay ô nhập (liên kết "Kết nối ví" là `<a>`, E2E `account-info.spec.ts` chỉ cấm nút và ô nhập; người làm kiểm lại khẳng định của tệp đó).

### G. Rút tiền của Người bán

- **G1. Ô "Ví nhận"** ở `/seller/withdraw` (nhãn đổi từ "Ví nhận (đặt bởi Kiểm soát viên)" thành "Ví nhận"): điền sẵn ví nhận hiện có trên vault (`wallet.payoutWallet` của tổng quan, có thể trống), sửa được. Nút "Dùng ví đang kết nối" điền ví wagmi (ẩn trên `mock`, khoá khi chưa kết nối). Câu nhỏ dưới ô khi ví khác ví hiện có trên vault: "Đổi ví nhận: hệ thống gửi thêm một giao dịch đặt ví nhận trước khi rút."
- **G2. Kiểm trước hộp mã một lần.** Bấm "Tạo lệnh rút" thì gọi `checkPayoutWalletAction({ chain, wallet })` (quyền `vault:withdraw` kiểm bằng `assertCan`, không ghi audit) trả `Result<{ wallet: string }>`; không đạt là `VALIDATION` với câu ở `fieldErrors.payoutWallet`, theo luật G5 bước 2 cộng phần ví của bước 5 (có vault, khác địa chỉ vault, đã whitelist; không kiểm tạm dừng hay số tiền); màn hiện câu dưới ô, không mở hộp mã. Đạt thì mở hộp mã, trong hộp ghi "Ví nhận: <ví> (đã whitelist)". Action này không chạy khi mở màn.
- **G2b.** Bỏ chặn phía màn khi vault chưa có ví nhận (`seller-withdraw.tsx`, câu "chưa có ví nhận"): ví nhận nay do chính lệnh rút đặt. Vault mới triển khai (mock khởi tạo `payoutWallet` rỗng) rút được ngay với ví Người bán chọn.
- **G3.** `createWithdrawRequest` nhận thêm `payoutWallet` (bắt buộc). Mã chống trùng so cả `payoutWallet` (`repeatedResult`): cùng mã, khác ví (hoặc khác nội dung khác) là `WITHDRAW_STATE`, ở MỌI trạng thái của lệnh cũ, kể cả khi lệnh cũ đang ở bước đặt ví nhận; trả trước mọi giao dịch mới.
- **G4. Trạng thái lệnh rút** (`WITHDRAW_STATUSES`, `WITHDRAW_TRANSITIONS` ở `vault.store.port.ts`):

| Từ | Sang | Khi |
|---|---|---|
| (tạo) | `PAYOUT_SENDING` | ví chọn khác ví đang đặt trên vault |
| (tạo) | `SENDING` | ví chọn bằng ví đang đặt (như hiện nay) |
| `PAYOUT_SENDING` | `PAYOUT_SENT` | đã có mã giao dịch đặt ví nhận (lưu vào cột mới `payoutTxHash`) |
| `PAYOUT_SENDING` | `FAILED` | chắc chắn chưa lên chuỗi: `LedgerError` có `reverted` (cùng cách phân loại `sendWithdraw` đang dùng) |
| `PAYOUT_SENDING` | `PAYOUT_REVIEW` | đối soát: quá thời gian chờ biên nhận mà vẫn không có mã (mất mã) |
| `PAYOUT_SENT` | `SENDING` | biên nhận `CONFIRMED` VÀ đọc lại `vaultStatus().payoutWallet` bằng ví của lệnh, trong cùng lần tạo lệnh (đường thẳng) |
| `PAYOUT_SENT` | `PAYOUT_SET` | biên nhận `CONFIRMED` VÀ ví khớp, phát hiện ở lần đối soát (chờ Người bán bấm gửi rút, G6) |
| `PAYOUT_SENT` | `FAILED` | biên nhận `FAILED` |
| `PAYOUT_SENT` | `PAYOUT_REVIEW` | biên nhận `CONFIRMED` nhưng ví trên vault khác ví của lệnh; hoặc đối soát thấy `txReceiptStatus` là `UNKNOWN` sau thời gian chờ biên nhận (giao dịch bị rơi hoặc bị thay) |
| `PAYOUT_SET` | `SENDING` | Người bán bấm gửi rút và kiểm lại đạt (G6) |
| `PAYOUT_SET` | `FAILED` | kiểm lại khi gửi rút không đạt (tạm dừng, vượt phần được rút, ví trên vault đã khác); hoặc huỷ (G6d) |
| `PAYOUT_REVIEW` | `FAILED` | Kiểm soát viên chốt, theo QĐ-10 |
| `NEEDS_REVIEW` | `COMPLETED`, `FAILED` | như hiện nay, không đổi |

  `PAYOUT_*` không phải trạng thái cuối: `activeChain` giữ, khoá `WITHDRAW` giữ; `WITHDRAW_TERMINAL_STATUSES` giữ `COMPLETED`, `FAILED`. Nhãn hiển thị: `PAYOUT_SENDING`, `PAYOUT_SENT` "Đang đặt ví nhận"; `PAYOUT_SET` "Đã đặt ví nhận, chờ gửi rút"; `PAYOUT_REVIEW` "Cần xem xét (đặt ví nhận)". Màn "Lệnh rút cần xem xét" của Kiểm soát viên (`listWithdrawReviews`) liệt kê cả `PAYOUT_REVIEW`, chỉ có nút đánh dấu thất bại.
- **G5. Thứ tự máy chủ của `createWithdrawRequest`** (thay mục tương ứng; phần không nhắc giữ nguyên):
  1. Kiểm quyền `vault:withdraw`; kiểm `otp` (mã không vào log, audit, câu lỗi); kiểm số tiền.
  2. Kiểm DẠNG ví nhận (hàm thuần dùng chung với G2): đúng dạng; khác địa chỉ 0; không phải ví trong `PUBLIC_SAMPLE_WALLETS` (`@bidv/shared`) khi chain không phải `mock`, `hardhat-local`. Từ chối đi qua `fail` (có audit).
  3. Tra `clientRequestId` (G3). Lần gửi lại cùng nội dung trả lệnh cũ ở trạng thái hiện tại, không gửi giao dịch.
  4. Lấy khoá `WITHDRAW` như hiện nay (không lấy được: `VAULT_BUSY` theo câu hiện có, bỏ chữ "Kiểm soát viên").
  5. Trong khoá: đọc `vaultStatus()`; không có vault, ví trùng địa chỉ vault, tạm dừng rút, vượt phần được rút: từ chối (câu như hiện nay, bỏ chữ "Kiểm soát viên"); `isWhitelisted(ví)` sai: "Ví nhận chưa whitelist trên chuỗi." Không còn chặn "vault chưa có ví nhận".
  6. Tạo bản ghi lệnh với `payoutWallet` là ví chọn; trạng thái đầu `PAYOUT_SENDING` nếu `status.payoutWallet` khác ví chọn (so không phân biệt hoa thường), ngược lại `SENDING`. Trùng `clientRequestId` do tranh chấp thì xử lý như hiện nay (trả lệnh thắng hoặc khác nội dung). Từ đây khoá thuộc lệnh.
  7. Nếu `PAYOUT_SENDING`: gửi `setVaultPayoutWallet(ví)`.
     - Ném `LedgerError` có `reverted`: `PAYOUT_SENDING` sang `FAILED`, nhả khoá, `LEDGER` kèm lý do.
     - Ném lỗi khác: giữ `PAYOUT_SENDING`, giữ khoá, `LEDGER` "Chưa rõ giao dịch đặt ví nhận đã lên chuỗi hay chưa; lệnh giữ để đối soát. Chưa rút tiền."
     - Có mã: chuyển `PAYOUT_SENT` kèm `payoutTxHash` TRƯỚC khi chờ biên nhận; lưu `Txn` (operation `vault:setPayoutWallet`, vai `SELLER`, `toWallet` là vault).
     - Chờ biên nhận (`waitReceipt` với `receiptTimeoutFor(chain)`, chỉ ở lần tạo lệnh): `PENDING` thì trả lệnh `PAYOUT_SENT` (thành công một phần, câu "Đang chờ biên nhận đặt ví nhận; mở lại màn sau ít phút để gửi rút."); `FAILED` thì `FAILED`, nhả khoá; `CONFIRMED` thì đọc lại `vaultStatus()`: ví khớp thì `SENDING` và đi tiếp bước 8, ví không khớp thì `PAYOUT_REVIEW`.
     - Audit `vault:payout:set` cho mọi kết cục từ lúc gửi (ví cũ, ví mới, mã tx nếu có).
  8. Nếu `SENDING`: luồng gửi rút hiện có (`sendWithdraw`, lưu mã trước khi chờ, chốt theo biên nhận). Trước khi gửi, đọc lại `vaultStatus()` lần cuối: ví khác ví của lệnh thì `FAILED` (chưa có giao dịch rút nào, khoá nhả), lý do "Ví nhận trên vault khác ví của lệnh; không gửi rút."
- **G6. Tiếp tục lệnh `PAYOUT_SET`.** Action mới `continueWithdrawRequestAction({ chain, id, otp })` (quyền `vault:withdraw`, chỉ người tạo lệnh): kiểm `otp`; lệnh phải `PAYOUT_SET`; đọc `vaultStatus()`: ví khớp ví lệnh, không tạm dừng, số tiền không vượt phần được rút; đạt thì `SENDING` rồi `sendWithdraw`; không đạt thì `FAILED` (nhả khoá) kèm lý do. Màn rút: dòng lệnh `PAYOUT_SET` trong bảng "Yêu cầu rút của tôi" có nút "Gửi lệnh rút" mở hộp mã một lần rồi gọi action này.
- **G6b. Đối soát** (`reconcileWithdrawRequests`, chạy khi mở màn rút và khi vận hành bấm đối soát) xét thêm `PAYOUT_SENDING`, `PAYOUT_SENT` theo bảng G4, đọc biên nhận bằng `txReceiptStatus` (KHÔNG dùng `waitReceipt`, để mở màn không bị chờ); KHÔNG tự gửi giao dịch rút (chỉ chuyển sang `PAYOUT_SET`). `resolveWithdrawRequest` xử lý `PAYOUT_REVIEW` theo QĐ-10.
- **G6d. Huỷ lệnh `PAYOUT_SET`.** Action mới `cancelWithdrawRequestAction({ chain, id })`: người tạo lệnh (quyền `vault:withdraw`) hoặc Kiểm soát viên (`vault:reconcile`) chuyển `PAYOUT_SET` sang `FAILED` lý do "Đã huỷ", nhả khoá. An toàn vì không còn giao dịch nào của lệnh đang chờ. Vault giữ ví nhận mới. Màn rút có nút "Huỷ" cạnh "Gửi lệnh rút".
- **G6c. Lược đồ:** `WithdrawRequest` thêm cột `payoutTxHash TEXT` (qua `ADDED_COLUMNS` ở `postgres.pool.ts` và `schema.prisma`; không thêm chỉ mục); cổng `createWithdrawRequest` nhận trạng thái đầu (`PAYOUT_SENDING` hoặc `SENDING`); `transitionWithdrawRequest` nhận thêm `payoutTxHash`. Cả hai bản cổng: bỏ giá trị `SENDING` viết cứng khi thêm lệnh (Postgres đang ghi hằng trong câu `INSERT`), ánh xạ `payoutTxHash` ở hàm chuyển dòng (`toWithdraw`) và bản ghi bộ nhớ; bảng `WITHDRAW_TRANSITIONS` đúng bảng G4.
- **G7.** Bỏ chữ "Kiểm soát viên" khỏi các câu chặn về ví nhận ở `withdraw.service.ts` và `seller-withdraw.tsx` (ví nhận nay do Người bán chọn).

### H. Cấu hình vault (Kiểm soát viên)

- **H1.** Bỏ ô "Ví nhận tiền rút" ở `vault-status.tsx`; bỏ `payoutWallet` khỏi `saveVaultConfigSchema`, `VaultConfigFormView`, `VaultConfigTarget`, `VaultConfigCurrent`; bỏ bước `setPayoutWallet` khỏi `VaultConfigStep`, `planVaultConfig`, `VAULT_CONFIG_STEP_LABELS`, `describeVaultConfigStep`, `sendConfigStep`; bỏ phần "Ví nhận đã/chưa đổi" ở `configFailure`. Đầu vào còn `payoutWallet` thì zod bỏ qua (không lỗi), nhưng không dùng.
- **H2.** Câu mô tả biểu mẫu thêm: "Ví nhận tiền rút do Người bán chọn khi tạo lệnh rút."

### I. Tài liệu

- `docs/USER_GUIDE.md`: màn Định danh ví, nhóm menu Nghiệp vụ ẩn, màn tài khoản (bỏ cấu hình ví), câu "Ví chưa được định danh" ở các màn Nhà đầu tư, màn Rút tiền (chọn ví nhận, hai giao dịch khi đổi ví), màn Vault (bỏ ô ví nhận).
- Ghi chú triển khai cho chủ dự án (checkpoint): sau khi deploy, mọi Nhà đầu tư, Người bán trên Sepolia thấy "Ví chưa được định danh" ở các màn dữ liệu tài khoản tới khi Giao dịch viên gắn ví ở màn Định danh ví (ví liên kết cũ không được chép).

## 6. Hiệu năng

Đo số server action khi mở, trên `mock`, trước (`c9163d5`) và sau: `/portfolio`, `/trade`, `/orders`, `/account` (Nhà đầu tư, Người bán), `/seller/withdraw`, `/vault`. Sau phải BẰNG trước. `/wallet-binding` đúng 1. Chốt chặn D2 thêm một truy vấn `WalletBinding` theo khoá chính mỗi action, chạy trước các phép đọc khác. Ghi bảng vào checkpoint.

## 7. Kiểm thử

Tệp mới `test/fix-01-wallet.test.ts` (chain `mock`, bộ nhớ) trừ khi ghi khác. Mọi ca dưới là điều kiện nghiệm thu.

| Ca | Nội dung |
|---|---|
| 1 | Gắn ví mới: whitelist trên ledger, có dòng `WalletBinding`, có audit `investor:whitelist` và `profile:wallet:bind` SUCCESS |
| 2 | Ví đã gắn cho hồ sơ khác: `VALIDATION`, không giao dịch, không đổi bảng |
| 3 | Gắn lại đúng hồ sơ cũ, ví đã whitelist: không giao dịch, kết quả thành công, bảng không thêm dòng |
| 4 | Ví mẫu công khai của Hardhat trên chain `evm` (ledger giả): `VALIDATION`, không giao dịch |
| 5 | Biên nhận whitelist `FAILED` và `PENDING` (giả lập): không ghi gắn, trả `LEDGER` |
| 6 | Vai Kiểm soát viên, Nhà đầu tư gọi gắn ví: `FORBIDDEN`, audit `DENIED` |
| 7 | Một hồ sơ hai ví: `resolveWalletOwner` trả cùng hồ sơ cho cả hai; ví mẫu chỉ có hiệu lực trên `mock`, `hardhat-local` |
| 8 | Nhà đầu tư gọi `getPortfolio`, `getWalletTransactions`, `listOrders`, `getOrderDetail` với: ví chưa gắn, ví của hồ sơ khác (đều `WALLET_NOT_BOUND`, câu "Ví chưa được định danh", có audit `DENIED`); ví đã gắn và ví mẫu trên `mock` (đều đạt). `getTradeContext` với ví chưa gắn: `ok`, `walletBound: false`, `balances` là `null`, không gọi `balanceOf`, `paymentBalanceOf` cho ví đó |
| 9 | `placeOrder`, `preparePermit`, `previewPurchase` với ví chưa gắn: `WALLET_NOT_BOUND`, không tạo lệnh, không gửi giao dịch |
| 10 | Giao dịch viên `listOrders` không truyền ví, không truyền chain: vẫn xem toàn bộ như hiện nay. Nhà đầu tư `listOrders`, `listTransactions` thiếu chain: `VALIDATION`. Cùng một địa chỉ gắn cho NDT001 trên `evm` giả và cho hồ sơ khác trên `hardhat-local`: NDT001 đọc với chain `hardhat-local` bị `WALLET_NOT_BOUND`, đọc với `evm` chỉ thấy dữ liệu `evm`. Nhà đầu tư gọi `listTransactions` không truyền ví: `VALIDATION`; truyền ví chưa gắn: `WALLET_NOT_BOUND`; `readBalance` với ví chưa gắn: `WALLET_NOT_BOUND` |
| 11 | Rút với ví khác ví đang đặt: lệnh qua `PAYOUT_SENDING`, `PAYOUT_SENT` (có `payoutTxHash`), `SENDING`, `SENT`, `COMPLETED`; có giao dịch đặt ví nhận rồi giao dịch rút; `Withdrawn` tới ví mới; audit `vault:payout:set` SUCCESS |
| 12 | Rút với đúng ví đang đặt: không có giao dịch đặt ví nhận, lệnh bắt đầu ở `SENDING` |
| 13 | Ví nhận chưa whitelist; ví 0; ví bằng địa chỉ vault; ví mẫu công khai trên `evm` giả: từ chối, không tạo lệnh, không giao dịch, có audit FAILURE. Vault mock chưa có ví nhận: rút được với ví hợp lệ (G2b) |
| 14 | Gửi đặt ví nhận ném `LedgerError` `reverted`: lệnh `FAILED`, khoá nhả. Ném lỗi khác (không mã): lệnh giữ `PAYOUT_SENDING`, khoá giữ, không gửi rút; đối soát sau thời gian chờ chuyển `PAYOUT_REVIEW` |
| 15 | Biên nhận đặt ví nhận `FAILED`: lệnh `FAILED`, khoá nhả, vault giữ ví cũ, không gửi rút |
| 16 | Biên nhận đặt ví nhận `PENDING` (`vi.spyOn` `waitReceipt` và `txReceiptStatus`, vì mock luôn trả `CONFIRMED`): lệnh `PAYOUT_SENT`, khoá giữ; một lệnh mới (mã khác) chọn chính ví đang hiện trên chuỗi trả `VAULT_BUSY`, KHÔNG gửi rút (tình huống "khoá quá hạn, giao dịch cũ còn chờ"); khi `txReceiptStatus` thành `CONFIRMED`, đối soát chuyển `PAYOUT_SET` (không gọi `waitReceipt`); `continueWithdrawRequest` gửi rút và lệnh `COMPLETED`. Biến thể: `txReceiptStatus` là `UNKNOWN` sau thời gian chờ: `PAYOUT_REVIEW` |
| 17 | Biên nhận đặt ví nhận `CONFIRMED` nhưng `vaultStatus()` đọc lại cho ví khác (`vi.spyOn` trên ledger do `getLedger` trả): `PAYOUT_REVIEW`, không gửi rút. Ở lần đọc cuối trước `sendWithdraw` ví khác: `FAILED`, không gửi rút, khoá nhả |
| 18 | `continueWithdrawRequest` khi vượt phần được rút hoặc đang tạm dừng: `FAILED`, khoá nhả, không gửi rút; người không tạo lệnh gọi: `WITHDRAW_STATE`; mã một lần sai: không giao dịch. `cancelWithdrawRequest` lệnh `PAYOUT_SET`: `FAILED`, khoá nhả; lệnh ở trạng thái khác: `WITHDRAW_STATE` |
| 19 | Mã một lần sai ở `createWithdrawRequest`: không giao dịch; không dòng audit nào chứa mã đã nhập |
| 20 | Cùng `clientRequestId`, khác `payoutWallet`, khi lệnh cũ đang `PAYOUT_SENT`: `WITHDRAW_STATE`, không giao dịch mới. Hai yêu cầu đồng thời cùng mã, cùng nội dung (`Promise.all`): đúng một lệnh, đúng một giao dịch đặt ví nhận, không rút thêm. Chạy trên bộ nhớ và Postgres (`TEST_DATABASE_URL`) |
| 20b | `resolveWithdrawRequest` `FAILED` cho lệnh `PAYOUT_REVIEW` khi `hasPendingSignerTx()` đúng (giả lập): từ chối; khi sai: chốt được, khoá nhả; `COMPLETED` cho lệnh `PAYOUT_REVIEW`: từ chối. Lệnh `NEEDS_REVIEW` thường (tạo thẳng `SENDING`, mất mã rút) vẫn chốt `COMPLETED` bằng mã giao dịch ứng viên như hiện nay (ca hồi quy) |
| 21 | `saveVaultConfig` không gửi `setPayoutWallet` dù đầu vào có `payoutWallet`; `planVaultConfig` không bao giờ trả bước đó |
| 22 | Menu: Giao dịch viên có nhóm "Nghiệp vụ ẩn" thu gọn được, chứa "Định danh ví", và "Nạp VNDB" đứng trước khi cờ bật; cờ tắt chỉ còn "Định danh ví"; ba vai khác không có nhóm |
| 23 | Postgres (`TEST_DATABASE_URL`, theo mẫu `be-13-postgres-upgrade.test.ts`, database riêng): database cũ có `ProfileWallet` 2 dòng, chưa có `WalletBinding`; sau khi khởi tạo pool có bảng mới (rỗng, có chỉ mục), `ProfileWallet` giữ nguyên 2 dòng |
| 24 | Postgres: hai lần gắn cùng ví cho hai hồ sơ chạy song song: đúng một thành công, lần kia trả câu ví thuộc hồ sơ khác; cùng hồ sơ hai ví: cả hai thành công |

Đột biến bắt buộc (ghi ca đỏ vào checkpoint): bỏ `assertOwnWallet` ở `getPortfolio`; bỏ ở `listTransactions`; bỏ ở `placeOrder`; bỏ bắt buộc chain cho vai khách hàng ở `listOrders`; `resolveWalletOwner` nhận ví mẫu trên mọi chain; bỏ kiểm whitelist ví nhận; cho `PAYOUT_SENT` sang `SENDING` khi biên nhận còn `PENDING`; đối soát dùng `waitReceipt` thay `txReceiptStatus` (bắt bằng ca 16 đo số lần gọi); bỏ kiểm ví trên vault trước `sendWithdraw`; bỏ so `payoutWallet` trong `repeatedResult`; bỏ kiểm `hasPendingSignerTx` khi chốt `FAILED`; ghi gắn khi whitelist chưa `CONFIRMED`. (Tổng 12 đột biến.)

Sửa test và E2E có sẵn bị vỡ (người làm chạy toàn bộ và bổ sung):

- Thêm trợ giúp test dùng chung `test/helpers/wallet-binding.ts`: `bindWalletForTest(chain, wallet, actorId)` ghi thẳng vào cổng `WalletBinding` (bộ nhớ hoặc Postgres theo môi trường test). Mọi test gọi hàm bị chặn với vai `INVESTOR` bằng ví KHÔNG phải ví mẫu trên `mock`, `hardhat-local`, hoặc trên chain `evm` giả, phải gắn ví trước bằng trợ giúp này; không sửa ý nghĩa ca.
- Đã biết bị ảnh hưởng bởi chốt chặn: `purchase-service`, `investor-trading`, `portfolio-service`, `fe-05-permit-order` (dòng 257 đang chờ lỗi cấu hình từ `preparePermit` trên `evm`, nay gặp `WALLET_NOT_BOUND` trước: gắn ví trước), `fe-05-permit-postgres`, `fe-08-approval`, `distribution-service`, `ops-transactions`, `demo-payment`, `store-constraints`, `be-05-recall`, `fe-07-price-config`.
- Ví liên kết cũ: `op-05-profile-wallet.test.ts`, `op-05-profile-wallet-store.test.ts` (bỏ, thay bằng ca 1 tới 7, 23, 24), `account-profile.test.ts`, `op-05-demo-cycle-evm.test.ts` (gắn ví bằng `bindProfileWallet`).
- Bỏ ví nhận ở cấu hình vault: các tệp `be-13-*`, `seller-*`, `vault.test.ts`, `uiux-01.test.ts`, `fe-08-approval-evm.test.ts` còn truyền `payoutWallet` cho `saveVaultConfig` (đặt ví nhận bằng `ledger.setVaultPayoutWallet` trực tiếp trong phần chuẩn bị); các tệp gọi `createWithdrawRequest` (thêm `payoutWallet`).
- Menu: `demo-payment.test.ts`, `four-roles-shell.test.ts`.
- E2E: `vault-withdraw.spec.ts` (tasks bước 8), `account-info.spec.ts`. Không thêm tệp E2E mới.

## 8. Điều kiện hoàn thành

- [ ] A1, A2, B1 tới B4, C1 tới C3, D1 tới D4, E1 tới E6, F1 tới F4, G1 tới G7 (gồm G2b, G6b), H1, H2 đã làm.
- [ ] Không còn đường nào để Nhà đầu tư, Người bán tự cấu hình ví; không còn đường nào để Kiểm soát viên đặt ví nhận.
- [ ] Không còn mã đọc hay ghi bảng `ProfileWallet` (lệnh quét tasks bước 9 rỗng).
- [ ] Vitest ca 1 tới 24 (gồm 20b) xanh (ca 20 phần Postgres, ca 23, 24 chạy với `TEST_DATABASE_URL`, ghi lệnh và kết quả vào checkpoint); 12 đột biến đều bị bắt.
- [ ] E6 (phản hồi lệch thứ tự) đã áp ở mọi tệp liệt kê; checkpoint liệt kê từng tệp và khoá dùng.
- [ ] Đo thời gian trả của `listWalletBindingsAction` và một lần gắn ví trên `hardhat-local`, ghi vào checkpoint.
- [ ] `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` (mock và hardhat) xanh; các tệp chạy trên nút Hardhat (`TEST_HARDHAT_RPC`) bị chạm đều chạy lại xanh.
- [ ] Bảng số action khi mở (mục 6) trước và sau, ghi trong checkpoint.
- [ ] Ảnh trên `mock` vào `docs/images/fix-01/`: màn Định danh ví (sau khi gắn một ví); menu Giao dịch viên nhóm Nghiệp vụ ẩn mở; `/account` Nhà đầu tư; một màn Nhà đầu tư báo "Ví chưa được định danh" (dựng bằng `hardhat-local` với ví chưa gắn, hoặc giả lập); `/seller/withdraw` có ô ví nhận và hộp mã một lần; biểu mẫu Vault không còn ô ví nhận.
- [ ] Diff không thêm dòng chứa ký tự mũi tên, gạch dài, chấm giữa (lệnh quét tasks bước 9).
- [ ] UserGuide, `docs/CHECKPOINT_FIX01.md` (gồm ghi chú triển khai mục I), `.kiro/task-status.json`.
