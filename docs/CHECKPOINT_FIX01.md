# Báo cáo bàn giao: FIX-01 định danh ví và ví nhận tiền rút

| | |
|---|---|
| Mã task | FIX-01 |
| Nhánh | `fix/fix-01-vi-ket-noi`, tạo từ `dev` (`c9163d5`) |
| Spec | `docs/fix-01-vi-ket-noi/{requirements,design,tasks}.md` (chép nguyên từ gói spec) |
| Commit | mã `9d87e22`, tài liệu là commit kế tiếp trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 8) | | Bằng chứng |
|---|---|---|---|
| 1 | A1, A2, B1 tới B4, C1 tới C3, D1 tới D4, E1 tới E6, F1 tới F4, G1 tới G7 (gồm G2b, G6b), H1, H2 đã làm | ✅ | mục 5 (bảng từng yêu cầu), ảnh mục 4 |
| 2 | Khách hàng không còn đường tự cấu hình ví; Kiểm soát viên không còn đường đặt ví nhận | ✅ | mục 5 (F1, H1), ca 21, e2e `account-info`, `vault-withdraw` |
| 3 | Không còn mã đọc hay ghi bảng `ProfileWallet` | ✅ | mục 6.1 (chỉ còn tên hàm spec A1 bắt buộc) |
| 4 | Vitest ca 1 tới 24 (gồm 20b) xanh, phần Postgres chạy với `TEST_DATABASE_URL`; 12 đột biến đều bị bắt | ✅ | mục 1.1, 1.3 |
| 5 | E6 áp ở mọi tệp liệt kê, có danh sách tệp và khoá | ✅ | mục 5.2 |
| 6 | Đo thời gian trả của `listWalletBindingsAction` và một lần gắn ví trên `hardhat-local` | ✅ | mục 3.2 |
| 7 | `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` mock và hardhat xanh; tệp chạy trên nút Hardhat chạy lại xanh | ✅ | mục 1.2, 2 |
| 8 | Bảng số action khi mở trước và sau | ✅ | mục 3.1 (bằng nhau; `/wallet-binding` 1) |
| 9 | Ảnh trên `mock` trong `docs/images/fix-01/` | ✅ | mục 4 (7 ảnh) |
| 10 | Diff không thêm dòng có mũi tên, gạch dài, chấm giữa | ✅ | mục 6.2 |
| 11 | UserGuide, checkpoint này (gồm ghi chú triển khai mục I), `.kiro/task-status.json` | ✅ | mục 0.2, 7 |

**Kết luận:** 11 ✅, 0 🔶, 0 ❌. Không đổi hợp đồng, không thêm thư viện. Lược đồ database thêm bảng
`WalletBinding` và cột `WithdrawRequest.payoutTxHash` (nâng bằng cơ chế sẵn có, QĐ-7); `ILedgerPort`
thêm `hasPendingSignerTx`, `txReceiptStatus` (QĐ-10).

UserGuide: đã cập nhật Phần 1 mục 1.3, 1.7; Phần 2; Phần 3 quy ước chung, mục 3.1.2, 3.2.3, 3.3.1,
3.3.2, 3.4.7, 3.4.8, 3.4.9 (mới), 3.5.1; Phụ lục A.3, C; Lịch sử cập nhật.

### 0.2 Ghi chú triển khai cho Owner (requirements mục I)

- Sau khi deploy, mọi Nhà đầu tư, Người bán trên Sepolia thấy **"Ví chưa được định danh"** ở các màn dữ
  liệu tài khoản (tài sản, lịch sử, lệnh, đặt lệnh) tới khi Giao dịch viên gắn ví ở màn **Định danh
  ví** (`/wallet-binding`). Ví liên kết cũ trong `ProfileWallet` **không** được chép (QĐ-1).
- Ví nhận tiền rút đang đặt trên vault Sepolia giữ nguyên; Người bán thấy ví đó điền sẵn ở ô "Ví nhận".
- Bảng `ProfileWallet` còn trong lược đồ, không đọc, không ghi; xoá bảng là việc của task sau.

### 0.3 Việc cần Owner quyết

- Không có. Các chỗ làm khác chữ spec hoặc spec để ngỏ ghi ở mục 8.

---

## 1. Vitest

### 1.1 Tệp mới `app/test/fix-01-wallet.test.ts`

```text
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run test/fix-01-wallet.test.ts)
 ✓ test/fix-01-wallet.test.ts (45 tests)
 Test Files  1 passed (1)
      Tests  45 passed (45)
```

Không có `TEST_DATABASE_URL` thì 42 ca chạy, 3 ca Postgres bỏ qua (`describe.skipIf`). Postgres 16 cục
bộ, mỗi lần chạy dựng database riêng `bidv_fix01_<pid>` rồi xoá.

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Gắn ví mới: một lần `whitelist` đúng ví, `isWhitelisted` đúng, có dòng `WalletBinding` (NDT001, `boundBy` GDV001), audit `investor:whitelist` SUCCESS, `profile:wallet:bind` SUCCESS |
| 2 | Ví đã gắn cho NB001: `VALIDATION` "Ví đã được định danh cho hồ sơ khác.", không `whitelist`, bảng vẫn 1 dòng; ví mẫu của NB001 trên mock cũng bị từ chối |
| 3 | Gắn lại đúng hồ sơ cũ: `created: false`, `txHash: null`, không giao dịch, bảng 1 dòng |
| 4 | Ví mẫu công khai trên `evm`: `VALIDATION` đúng câu, không lời gọi ledger nào |
| 5 | Biên nhận `FAILED` và `PENDING`: `LEDGER`, không có dòng gắn, audit `profile:wallet:bind` FAILURE |
| 6 | CONTROLLER, INVESTOR: `FORBIDDEN`, không lời gọi ledger, audit `investor:whitelist` DENIED |
| 7 | Hai ví một hồ sơ cùng chủ (kể cả viết thường); ví mẫu có hiệu lực trên `mock`, `hardhat-local`, không trên `evm`, `stellar` |
| 8 | `getPortfolio`, `getWalletTransactions`, `listOrders`, `getOrderDetail`: ví chưa gắn và ví của NB001 đều `WALLET_NOT_BOUND` "Ví chưa được định danh", hai dòng DENIED, không dòng nào nhắc NB001; gắn xong thì ví đó và ví mẫu đạt. `getTradeContext` ví chưa gắn: `walletBound: false`, `balances: null`, trần 0, không `balanceOf`/`paymentBalanceOf` cho ví đó |
| 9 | `placeOrder`, `preparePermit`, `previewPurchase`: `WALLET_NOT_BOUND`, số lệnh không đổi, không lời gọi ledger; chỉ `placeOrder` ghi DENIED (hai hàm kia dùng `assertCan`) |
| 10 | TELLER `listOrders({})` thấy 2 lệnh; INVESTOR thiếu chain hoặc ví: `VALIDATION`; ví gắn NDT001 trên `evm`, NB001 trên `hardhat-local`: đọc `hardhat-local` bị chặn, đọc `evm` chỉ ra dữ liệu `evm`; `readBalance` ví chưa gắn bị chặn |
| 11 | Trạng thái qua đúng `PAYOUT_SENDING, PAYOUT_SENT, SENDING, SENT, COMPLETED`; `payoutTxHash` có; `setVaultPayoutWallet` trước `withdrawFromVault`; VNDB ví mới tăng 100; `Withdrawn` tới ví mới; audit `vault:payout:set` SUCCESS; khoá nhả |
| 12 | Cùng ví đang đặt (khác hoa thường): bắt đầu `SENDING`, không `setVaultPayoutWallet`, `payoutTxHash` null |
| 13 | Chưa whitelist, ví 0, ví bằng vault, ví mẫu trên `evm`: `VALIDATION` ở ô `payoutWallet`, không lệnh, không giao dịch, audit FAILURE, không khoá. G2b: vault chưa có ví nhận rút được |
| 14 | `reverted`: `FAILED`, khoá nhả. Lỗi khác: `PAYOUT_SENDING`, khoá giữ, không rút; đối soát trong hạn giữ, quá hạn sang `PAYOUT_REVIEW` |
| 15 | Biên nhận `FAILED`: `FAILED`, `payoutTxHash` có, khoá nhả, vault giữ NB001, không rút |
| 16 | `PENDING`: `PAYOUT_SENT`, khoá giữ; lệnh mới chọn ví đang hiện trên chuỗi: `VAULT_BUSY`, không rút; `txReceiptStatus` PENDING giữ; CONFIRMED: `PAYOUT_SET`, **0** lần `waitReceipt`, 1 lần `txReceiptStatus`; `continueWithdrawRequest` ra `COMPLETED`, khoá nhả. Biến thể `UNKNOWN` quá hạn: `PAYOUT_REVIEW` |
| 17 | CONFIRMED nhưng vault đọc lại ra ví khác: `PAYOUT_REVIEW`, không rút, khoá giữ. Lần đọc cuối trước rút ra ví khác: `FAILED` đúng câu, không rút, khoá nhả |
| 18 | `continueWithdrawRequest` vượt phần được rút, đang tạm dừng: `FAILED`, khoá nhả, không rút; NB002 gọi: `WITHDRAW_STATE`; mã một lần sai: không giao dịch. `cancelWithdrawRequest` lệnh `PAYOUT_SET`: `FAILED` "Đã huỷ", khoá nhả; gọi lại: `WITHDRAW_STATE` |
| 19 | Mã `98765`: `VALIDATION`, không giao dịch, không dòng audit nào chứa mã |
| 20 | Cùng mã, khác ví khi lệnh cũ `PAYOUT_SENT`: `WITHDRAW_STATE`, không giao dịch mới. Hai yêu cầu đồng thời: một lệnh, một `setVaultPayoutWallet`, một `withdrawFromVault`. Chạy trên bộ nhớ và Postgres |
| 20b | `PAYOUT_REVIEW`: `COMPLETED` bị từ chối; `FAILED` khi `hasPendingSignerTx` đúng bị từ chối (khoá giữ), khi sai chốt được, khoá nhả. Hồi quy: lệnh tạo thẳng `SENDING` mất mã rút vẫn chốt `COMPLETED` bằng mã ứng viên |
| 21 | `saveVaultConfig` có `payoutWallet`: bước chỉ `setPercentRate`, `setLockMode`, không `setVaultPayoutWallet`, vault vẫn chưa có ví nhận; `planVaultConfig` mọi tổ hợp không có bước đặt ví nhận |
| 22 | Cờ bật: TELLER có nhóm `collapsible`, "Nạp VNDB" rồi "Định danh ví", nhóm đứng ngay sau "Vận hành"; ba vai khác không có nhóm. Cờ tắt: chỉ `/wallet-binding` |
| 23 | Database cũ (bỏ `WalletBinding`, `ProfileWallet` 2 dòng): khởi tạo pool tạo lại bảng rỗng, đủ 3 chỉ mục (`pkey`, `chain_actorId`, `chain_boundAt`), `ProfileWallet` giữ 2 dòng |
| 24 | Hai lần gắn cùng ví cho NDT001, NB001 song song: đúng một thành công, lần kia câu ví thuộc hồ sơ khác. Cùng hồ sơ hai ví song song: cả hai thành công |

### 1.2 Toàn bộ `typecheck`, `lint`, `vitest`

```text
$ (cd app && npm run typecheck && npm run lint)
exit=0 (0 lỗi, 0 cảnh báo)
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  66 passed | 10 skipped (76)
      Tests  1338 passed | 70 skipped (1408)
```

Tệp bị bỏ qua là các tệp chỉ chạy khi có `TEST_HARDHAT_RPC` (mục 2.2).

### 1.3 Đột biến (12/12 bị bắt)

Mỗi đột biến sửa một chỗ trong `app/src`, chạy `test/fix-01-wallet.test.ts` có `TEST_DATABASE_URL`, rồi
trả mã về nguyên. Kịch bản: `scratchpad/fix01/mutate.py` (ngoài repo).

| # | Đột biến | Kết quả | Ca đỏ |
|---|---|---|---|
| 1 | Bỏ `assertSessionWallet` ở `getPortfolio` | 1 đỏ | ca 8 `getPortfolio` |
| 2 | Bỏ ở `listTransactions` | 1 đỏ | ca 10 |
| 3 | Bỏ ở `placeOrder` | 1 đỏ | ca 9 |
| 4 | Bỏ bắt buộc chain cho vai khách hàng ở `listOrders` | 1 đỏ | ca 10 |
| 5 | `resolveWalletOwner` nhận ví mẫu trên mọi chain | 1 đỏ | ca 7 |
| 6 | Bỏ kiểm whitelist ví nhận trong `createWithdrawRequest` | 1 đỏ | ca 13 "chưa whitelist" |
| 7 | `PAYOUT_SENT` sang `SENDING` khi biên nhận đặt ví nhận còn `PENDING` | 8 đỏ | ca 16 (2), 18 (4), 20 (bộ nhớ, Postgres) |
| 8 | Đối soát `PAYOUT_SENT` dùng `waitReceipt` thay `txReceiptStatus` | 3 đỏ | ca 16 (2, đếm lời gọi), 20 Postgres |
| 9 | Bỏ kiểm ví trên vault trước `withdrawFromVault` | 1 đỏ | ca 17 "lần đọc cuối" |
| 10 | Bỏ so `payoutWallet` trong `repeatedResult` | 2 đỏ | ca 20 (bộ nhớ, Postgres) |
| 11 | Bỏ kiểm `hasPendingSignerTx` khi chốt `FAILED` | 1 đỏ | ca 20b |
| 12 | Ghi gắn khi whitelist chưa `CONFIRMED` | 2 đỏ | ca 5 (`FAILED`, `PENDING`) |

## 2. Bản dựng, e2e, nút Hardhat

### 2.1 `build`, e2e mock, e2e hardhat

```text
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh build e2e evm > run-all.txt 2>&1; echo EXIT=$?
EXIT=0
$ grep -E "passed \(|skipped|ĐẠT" run-all.txt
  7 skipped
  75 passed (1.3m)      # project mock
  2 skipped
  26 passed (39.3s)     # project hardhat
  => ĐẠT các phần đã chạy: build e2e evm
```

Số ca bỏ qua bằng trước task. `vault-withdraw.spec.ts` (sửa theo tasks bước 8) xanh trên cả hai project;
`account-info.spec.ts` (chỉ project mock) xanh.

Mô phỏng job A của CI (cất `packages/contracts-evm/artifacts` sang chỗ khác rồi chạy):

```text
$ bash scripts/run-local-all.sh arch markers checkpoint app; echo EXIT=$?
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST        # 62 tệp đạt, 14 bỏ qua; 1232 ca đạt, 93 bỏ qua (không có Postgres)
EXIT=0
```

### 2.2 Tệp vitest chạy trên nút Hardhat

Mỗi tệp chạy sau `USE_LOCAL_SOLC=1 bash scripts/evm-local.sh reset`, với `TEST_HARDHAT_RPC=http://127.0.0.1:8545`.

| Tệp | Kết quả | Ghi chú |
|---|---|---|
| `op-05-demo-cycle-evm.test.ts` (sửa) | 8/8 | lượt 13.2 gắn ví bằng `bindProfileWallet`; 13.8 truyền `payoutWallet` |
| `be-13-vault-evm.test.ts` (sửa) | 5/5 | ca 5b: lịch sử có dòng ví nhận do Người bán đặt (mục 8.4) |
| `fe-08-approval-evm.test.ts` (sửa) | 8/8 | |
| `be-05-recall-evm`, `evm-issuance`, `evm-order-settlement`, `fe-05-permit-evm`, `fe-07-price-evm`, `hf-03-doc-log-evm`, `hf-04-chot-ky-evm`, `sc-06-distribution-evm`, `evm-indexer`, `evm-address-env` | 1, 13 (+1 bỏ qua), 10, 8, 1, 3, 1, 10, 1, 5: tất cả đạt | chạy lại để chắc chốt chặn ví không làm vỡ |

## 3. Hiệu năng

### 3.1 Số server action khi mở (mock, `next start`, đếm header `next-action`)

| Màn | Vai | Trước (`c9163d5`) | Sau |
|---|---|---|---|
| `/portfolio` | Nhà đầu tư | 1 | 1 |
| `/trade` | Nhà đầu tư | 1 | 1 |
| `/orders` | Nhà đầu tư | 1 | 1 |
| `/seller/withdraw` | Người bán | 2 | 2 |
| `/wallet-binding` | Giao dịch viên | 404 | 1 |
| `/vault` | Kiểm soát viên | 3 | 3 |
| `/vault` | Giao dịch viên | 3 | 3 |
| `/account` | Người bán | 1 | 1 |
| `/account` | Nhà đầu tư | 1 | 1 |

`/portfolio` là 1 vì trình duyệt đo không có ví (chỉ `getTokenSummaryAction`). Chốt chặn D2 thêm một
truy vấn `WalletBinding` theo khoá chính trong mỗi action đọc của khách hàng, không thêm action.

### 3.2 Thời gian trả trên `hardhat-local`

Máy chủ `next start` bản `.next-hardhat`, nút Hardhat mới reset, Playwright vai Giao dịch viên.

| Thao tác | Số lần | Nhỏ nhất | Trung vị | Lớn nhất |
|---|---|---|---|---|
| `listWalletBindingsAction` khi mở `/wallet-binding` (gửi tới nhận xong phản hồi) | 5 | 5 ms | 13 ms | 19 ms |
| Một lần gắn ví mới (bấm "Định danh và gắn ví" tới khi màn hiện kết quả; gồm KYC, `whitelist`, chờ biên nhận, ghi bảng) | 5 | 123 ms | 130 ms | 254 ms |

Lần gắn đầu chậm hơn vì máy chủ còn khởi động client RPC. Trên Sepolia thời gian gắn chủ yếu là thời
gian chờ biên nhận `whitelist` (một block).

## 4. Ảnh (mock, `docs/images/fix-01/`)

| Tệp | Nội dung |
|---|---|
| `20261027_dinh_danh_vi.png` | Màn Định danh ví sau khi gắn NB001 và một ví mới cho NDT001: câu kết quả có mã giao dịch, bảng hai dòng, menu "Nghiệp vụ ẩn" mở |
| `20261027_menu_nghiep_vu_an.png` | Menu Giao dịch viên ở `/transactions`, nhóm "Nghiệp vụ ẩn" bấm mở: "Nạp VNDB", "Định danh ví" |
| `20261027_account_nha_dau_tu.png` | `/account` Nhà đầu tư: ô "Ví thanh toán" có ví mẫu và nhãn "Đã định danh"; không còn khối nhập ví |
| `20261027_vi_chua_dinh_danh.png` | `/portfolio` với ví trình duyệt giả lập chưa gắn: hai khối báo "Ví chưa được định danh", thông tin phát hành vẫn hiện |
| `20261027_rut_tien_vi_nhan.png` | `/seller/withdraw`: ô "Ví nhận" nhập NB001, dòng "Đổi ví nhận: hệ thống gửi thêm một giao dịch đặt ví nhận trước khi rút." |
| `20261027_rut_tien_vi_nhan_otp.png` | Hộp mã một lần có dòng "Ví nhận: 0x15d3...6A65 (đã whitelist)" |
| `20261027_vault_khong_o_vi_nhan.png` | `/vault` Kiểm soát viên: biểu mẫu chỉ còn chế độ khoá, câu H2; kết quả lưu hai bước, không có bước đặt ví nhận |

Ảnh "Ví chưa được định danh" dựng trên mock bằng `window.ethereum` giả lập chỉ trả một địa chỉ chưa gắn
(cách của `e2e/wallet-connect.spec.ts`), spec cho phép giả lập.

## 5. Bảng từng yêu cầu

### 5.1 Yêu cầu và nơi làm

| Mã | Nơi làm |
|---|---|
| A1, A2 | `lib/store/wallet-binding.store.port.ts`, `memory.wallet-binding.store.ts`, `postgres.wallet-binding.store.ts` (một câu `INSERT ... ON CONFLICT DO NOTHING`, khác hồ sơ ném `UniqueConstraintError`); `prisma/schema.prisma` model `WalletBinding`; `lib/bank/wallet-binding.service.ts` (`bindProfileWallet`, `listWalletBindings`) |
| B1 tới B4 | `app/(ops)/wallet-binding/page.tsx` (chặn theo `investor:whitelist`), `components/pages/wallet-binding.tsx`, `app/actions/wallet-binding.ts` |
| C1 tới C3 | `components/layout/nav-config.ts` (`WALLET_BINDING_NAV_ITEM`, `HIDDEN_OPS_GROUP_LABEL`, `withHiddenOps`), `sidebar.tsx` (`CollapsibleGroup`, `aria-expanded`, tự mở khi chứa màn đang xem), `app-layout.tsx` |
| D1 tới D4 | `lib/bank/wallet-owner.ts` (`resolveWalletOwner`, `assertOwnWallet`, `assertSessionWallet`, `WalletNotBoundError`); mã `WALLET_NOT_BOUND` (`result.ts`, `authorize.ts`); gọi ở `portfolio.service.ts`, `purchase.service.ts`, `trade.service.ts`, `mint.service.ts` |
| E1 tới E6 | `components/investor/wallet-not-bound-notice.tsx` và các tệp mục 5.2 |
| F1 tới F4 | `components/pages/account-wallet.tsx` (`AccountWalletProvider`, `PaymentWalletValue`), `account-info.tsx`, `app/(account)/account/page.tsx`, `getAccountWallet` trong `account-profile.service.ts`, `app/actions/account.ts` |
| G1 tới G7 | `lib/bank/payout-wallet.ts`, `withdraw.service.ts` (`sendPayoutChange`, `reconcilePayoutSent`, `continueWithdrawRequest`, `cancelWithdrawRequest`, `resolvePayoutReview`), `vault.store.port.ts` (bốn trạng thái, bảng chuyển), hai bản lưu trữ, cột `payoutTxHash` (`postgres.pool.ts` `ADDED_COLUMNS`), `ledger.port.ts`, `evm.adapter.ts`, `mock.adapter.ts`, `stellar.adapter.ts`; màn `seller-withdraw.tsx`, `seller-transactions.tsx`, `vault-status.tsx` (thẻ xem xét) |
| H1, H2 | `vault-config.ts`, `vault.service.ts`, `vault-status.tsx` |

### 5.2 E6: tệp và khoá

| Tệp | Khoá của lần gọi |
|---|---|
| `components/investor/asset-summary.tsx` | `` `${chain}\|${address}` `` |
| `components/investor/transaction-history-box.tsx` | `` `${chain}\|${address}` `` |
| `components/pages/investor-orders.tsx` | `JSON.stringify(query)` gồm chain, ví, bộ lọc |
| `components/pages/investor-order-detail.tsx` | `` `${chain}\|${wallet}\|${orderId}` `` |
| `components/pages/investor-token-detail.tsx` | `` `${chain}\|${wallet}` `` |
| `components/pages/investor-trade.tsx` | ngữ cảnh `` `${chain}\|${wallet}\|${contextTick}` ``; xem trước `` `${chain}\|${wallet}\|${side}\|${amount}\|${contextTick}` ``; permit đã chuẩn bị `` `${chain}\|${ví}\|${side}\|${amount}` `` |
| `components/trading/trade-check-block.tsx`, `components/trading/gates.ts` | không tự gọi action; nhận dữ liệu đã lọc theo khoá của `investor-trade.tsx` |
| `components/pages/account-wallet.tsx` | `` `${chain}\|${wallet}` `` (mock: ví vắng, máy chủ dùng ví mẫu) |

## 6. Quét

### 6.1 `ProfileWallet`

```text
$ grep -rn "ProfileWallet\|profile-wallet" app/src --include=*.ts --include=*.tsx | grep -v init-sql.generated.ts
src/components/pages/wallet-binding.tsx:9:  import { bindProfileWalletAction, listWalletBindingsAction } ...
src/components/pages/wallet-binding.tsx:67: const result = await bindProfileWalletAction(...)
src/app/actions/wallet-binding.ts:3:        import { bindProfileWallet, listWalletBindings } ...
src/app/actions/wallet-binding.ts:10:       export async function bindProfileWalletAction(input: unknown) {
src/app/actions/wallet-binding.ts:11:       return bindProfileWallet(input);
src/lib/bank/wallet-binding.service.ts:94:  export async function bindProfileWallet(input: unknown) ...
```

Sáu dòng còn lại đều là TÊN hàm `bindProfileWallet` và `bindProfileWalletAction` mà spec A1, B3 đặt;
chuỗi con "ProfileWallet" khớp mẫu quét. Không dòng nào đọc hay ghi bảng `ProfileWallet`: kho, cổng,
bản bộ nhớ và Postgres của `ProfileWallet` đã xoá. `init-sql.generated.ts` còn `CREATE TABLE
"ProfileWallet"` vì bảng giữ trong lược đồ (QĐ-1).

### 6.2 Ký tự cấm và marker

```text
$ git diff c9163d5 | python3 (lọc dòng thêm có mũi tên, gạch dài, chấm giữa)   # không ra dòng nào
$ node scripts/scan-pending.mjs --check-report                       # Khớp marker
$ node scripts/gen-flow-diagram.mjs purchase --check                 # Khớp (sinh lại, 12 bước)
$ node scripts/gen-flow-diagram.mjs issue --check                    # Khớp
```

## 7. Tài liệu

- `docs/USER_GUIDE.md`: như dòng UserGuide ở mục 0.1; dòng Lịch sử cập nhật 27/10/2026. Sửa L-10, L-66,
  L-67, L-68 (luồng tự liên kết ví đã bỏ), cập nhật L-64, L-79.
- `docs/flows/purchase.md`, `docs/tech-report.md`: sinh lại bằng script (đường đặt lệnh có thêm chốt chặn ví).
- `.kiro/task-status.json`: FIX-01 vào `done`.
- `scripts/op05-db-check.sql`: truy vấn kiểm `WithdrawRequest` nhận thêm bốn trạng thái `PAYOUT_*`.

## 8. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Cặp audit ALLOWED rồi DENIED.** Hàm dùng `authorize` ghi ALLOWED trước, rồi chốt chặn ví ghi
   DENIED "Ví chưa được định danh" (không ghi hồ sơ chủ thật của ví): một lần bị chặn để lại hai dòng,
   đúng như requirements D2 đã chấp nhận. `previewPurchase`, `preparePermit`, `getTradeContext` dùng
   `assertCan` nên không ghi.
2. **Ca 20, hai yêu cầu đồng thời.** Yêu cầu đến sau khi khoá đang giữ nhận `VAULT_BUSY`; đến sau khi
   lệnh đã có thì nhận lại chính lệnh đó. Test khẳng định đúng điều spec đòi (một lệnh, một giao dịch
   đặt ví nhận, một lần rút) và yêu cầu thua chỉ được là một trong hai kết quả này.
3. **Đột biến 7** dựng bằng cách cho nhánh `PENDING` của `sendPayoutChange` chuyển `PAYOUT_SENT` sang
   `SENDING` và gửi rút; đột biến 12 bằng cách bỏ điều kiện `CONFIRMED` trước khi ghi gắn.
4. **`be-13-vault-evm.test.ts` ca 5b:** lịch sử cấu hình trên chuỗi nay có dòng "Ví nhận tiền rút" do
   lệnh rút của Người bán ở ca 7 đặt, người thao tác "Người bán". Khẳng định cũ (ví nhận do Kiểm soát
   viên đặt khi lưu cấu hình) đổi theo QĐ-8.
5. **Ô "Ví thanh toán" trên `mock`** luôn là ví mẫu, nhãn "Đã định danh" (F2), không đọc ví trình duyệt.
6. **Ảnh "Ví chưa được định danh"** dựng bằng ví trình duyệt giả lập trên mock (mục 4).
7. **Test có sẵn sửa thêm ngoài danh sách spec:** `investor-trading.test.ts` (kiểu `balances` nay có
   thể `null`). Các tệp spec liệt kê mà không phải sửa (`portfolio-service`, `fe-05-permit-postgres`,
   `fe-08-approval`, `distribution-service`, `ops-transactions`, `store-constraints`, `be-05-recall`,
   `fe-07-price-config`, `vault`, `seller-*`, `four-roles-shell`) vẫn xanh vì dùng ví mẫu hoặc không
   gọi hàm bị chặn.
