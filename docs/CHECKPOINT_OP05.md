# Báo cáo bàn giao: OP-05: Triển khai lại Sepolia lần hai và chạy trọn một vòng nghiệp vụ

| | |
|---|---|
| Task | OP-05 (PR A, phần coder) |
| Nhánh | `feat/op-05-runbook`, tạo từ `dev` @ `7d058de` (PR #61, FE-08 đã merge; BE-13 đã merge ở PR #60) |
| Spec | `docs/op-05-sepolia-lan-hai/{requirements,tasks}.md` bản 3 (CH-1 đến CH-7 đã chốt) |
| Mức kiểm chứng | Vừa |
| Tiến độ | Bước 0 đến 5 của PR A xong. Còn phần Sếp chạy theo runbook (PR B, Sepolia, PR C). Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | PR A: ca 1 đến 9, `CHECKPOINT_OP05.md` phần coder, mục "Kết quả chạy Sepolia" để trống | ✅ | mục 2; chi tiết kiểm chứng mục 1 đến 12; mục 6 để trống |
| 2 | PR B merge; kiểm khói và kiểm database mới đạt (bước 10, 11) | ❌ | mục 0.2; runbook bước 4 đến 11 |
| 3 | Vòng nghiệp vụ khớp bảng số dư kỳ vọng; Supervisor đọc chuỗi Sepolia xác nhận; PR C chuyển `done` | ❌ | mục 0.2; runbook bước 12 đến 14; ca 4 đã khớp trên Hardhat (mục 2) |

**Kết luận:** 1 ✅, 0 🔶, 2 ❌. Hai điều kiện ❌ là việc của Sếp và Supervisor theo spec (coder không triển khai
Sepolia, không giữ khoá); phần coder đã sẵn để chạy. Không sửa hợp đồng; thay đổi app chỉ ở QĐ-I. Bảng số dư kỳ
vọng của spec khớp **từng ô** trên nút Hardhat, không có lệch nào phải báo.

### 0.2 Việc cần Owner quyết/chạy

- **Sếp** chạy `docs/TESTNET_SEPOLIA.md` bước 0 đến 14: database Neon mới và Hyperdrive mới (bước 4), deploy
  (bước 5 đến 7), mở và merge PR B (bước 8), Cloudflare (bước 9), rồi vòng nghiệp vụ (bước 12, 13).
- **Supervisor** soát diff PR B, đọc chuỗi đối chiếu bảng số dư, soạn mục 6 và PR C (OP-05 sang `done`).

---

## 1. Kết quả chính

- **Liên kết ví trong hồ sơ (QĐ-I, CH-2):** bảng `ProfileWallet` (khoá `(actorId, chain)`, duy nhất
  `(chain, walletKey)` với `walletKey` viết thường) ở `schema.prisma`, `init.sql`, cổng bộ nhớ và Postgres,
  `UNIQUE_CONSTRAINTS`. `linkProfileWalletAction({ chain, wallet })` lấy hồ sơ từ phiên, quyền `wallet:connect`
  (chỉ Nhà đầu tư và Người bán), chuẩn hoá địa chỉ, từ chối ví mẫu công khai trên chain khác
  `mock`/`hardhat-local` (`PUBLIC_SAMPLE_WALLETS`, cùng danh sách với `fund-sepolia.js` qua
  `sample-wallets.json`), ghi sổ kiểm toán `profile:wallet:link` cho mọi kết cục (ai, chain, ví cũ, ví mới).
  `findInvestorProfileByWallet(chain, wallet)`: ví liên kết thắng; ví mẫu chỉ trên `mock`/`hardhat-local`;
  `evm` không có ví mặc định. Trang `/account` có khối "Ví liên kết trên chain" (một action khi mở). Nợ kỹ thuật
  ở tech-report 3.28 và một dòng P1 ở 1.6.C.
- **Ước phí (QĐ-E):** `fund-sepolia.js` chạy thật cả vòng trên Hardhat nội bộ và trả gas cùng **số giao dịch đo
  được** cho từng thao tác; `demo-cycle` là tổng; bảng in ví gửi; mô phỏng từ chối nếu ví Nhà đầu tư gửi giao
  dịch. Bỏ `cycle`, `mint`, `burn`. Preflight cộng `deploy`, `whitelist`, `demo-cycle`.
- **Chặn `dod-verify-sepolia.js` (QĐ-J, CH-7):** đầu `main`, trước khi lấy signer: chain có `SpvPaymentVault`
  trong address book thì thoát lỗi "bộ hợp đồng có vault, dùng runbook OP-05".
- **Runbook (QĐ-A đến QĐ-H):** `docs/TESTNET_SEPOLIA.md` viết lại một mạch bước 0 đến 14, cột "Ai", ba tên địa
  chỉ, năm thao tác QĐ-D kèm "phải thấy gì", bảng ước phí, PR B ba nhóm tệp, biến QĐ-G, vòng nghiệp vụ và bảng
  số dư, lượt 13.6 là bước tay duy nhất, đường lùi. Kiểm chỉ đọc QĐ-F: `scripts/op05-db-check.sql`.
  `docs/DEPLOYMENT.md` thêm `KEEPER_SECRET`, CH-6 và Hyperdrive mới cho thế hệ hợp đồng mới.

## 2. Ca kiểm chứng và nơi chạy

| Ca | Nơi kiểm | Kết quả |
|---|---|---|
| 1 | Runbook: chi tiết kiểm chứng mục 2 (15 dòng bước 0 đến 14, cột Ai, 5 "phải thấy" ở QĐ-D, ba tên địa chỉ, không còn `cycle` hay Mint vào ví SPV, có đường lùi) | đạt |
| 2 | `packages/contracts-evm/test/fund-sepolia.test.js` "OP-05 ca 2" | đạt; `deploy` 22, `whitelist` 2, `vault-config` 3, `mint-initial` 1, `payment-mint` 1, `trade` 2, `profit-mint` 1, `distribute` 3, `withdraw` 1, `demo-cycle` 12 |
| 3 | `app/test/op-05-profile-wallet.test.ts`, `op-05-profile-wallet-store.test.ts` (bộ nhớ và Postgres) | đạt, 17 ca (10 nghiệp vụ, 7 cổng lưu trữ) |
| 4 | `app/test/op-05-demo-cycle-evm.test.ts` trên nút Hardhat vừa dựng lại | đạt, khớp từng ô bảng số dư |
| 5 | `test/sc-07-scripts.test.js` "OP-05 ca 5" và ca 5 trong `op-05-demo-cycle-evm.test.ts` (chạy script thật, nonce không đổi); diễn tập | đạt |
| 6 | `scripts/op05-db-check.sql` trên Postgres cục bộ: database mới, bản có một lệnh rút dở, câu ghi bị từ chối; `op-05-db-check-sql.test.ts` | đạt |
| 7 | Diễn tập QĐ-K: deploy, verify, giá R7, whitelist hai ví, mint lợi nhuận, chặn script cũ; `git status --short` rỗng | đạt |
| 8 | tech-report 3.28 đủ năm ý, bảng nợ 1.6.C có dòng P1 | đạt |
| 9 | `run-local-all.sh`, job A, job C, E2E mock (`build e2e`), nút thật từng tệp, quét bí mật | xem số đo và mục 2.1 |

Số đo chính (đầu ra nguyên văn ở `docs/CHECKPOINT_OP05_VERIFICATION_DETAIL.md`): `run-local-all.sh` 7 PASS, hợp đồng
162 passing (nền 158, thêm 4 ca), vitest 1093 đạt, 83 bỏ qua (nền 1075 đạt); job A đạt, artifacts phục hồi; job
C 4 PASS, E2E hardhat 26 đạt; E2E mock 69 đạt, 7 bỏ qua (mục 2.1); nút thật `op-05-demo-cycle-evm` 8 đạt; quét bí mật sạch; diễn tập xong thì
`git status --short` rỗng; không sửa hợp đồng.

### 2.1 Ca 9: E2E mock sau ghi chú Supervisor

**Thiếu sót lần trước:** lần bàn giao đầu chỉ chạy job C (E2E project `hardhat`), **thiếu kiểm thử đầu cuối trên
chuỗi giả** (`bash scripts/run-local-all.sh build e2e`, project `mock`). `e2e/account-info.spec.ts` chỉ chạy ở
project `mock`, nên hai ca FE-24 (INVESTOR, SELLER, dòng 35 cũ) đỏ trên CI mà không lộ ra ở máy: khối "Ví liên
kết" thêm ô nhập và nút vào `/account`, còn ca cũ khẳng định cả `main` không có `button, input, textarea, select`.

**Sửa ca theo phạm vi mới, không đổi mã app:** phép kiểm "chỉ đọc" khoanh vào khối hồ sơ FE-24 (phần tử có
`data-account-role`), không phải cả `main`; thêm ca vai khách hàng (INVESTOR, SELLER) thấy khối ví liên kết
(tiêu đề, ô "Địa chỉ ví", nút "Dùng ví đang kết nối", "Lưu"), vai nhân viên (TELLER, CONTROLLER) không thấy khối
đó. Đầu ra nguyên văn (bỏ mã màu):

```text
$ bash scripts/run-local-all.sh build e2e

########## APP - BUILD BẢN PHÁT HÀNH ##########

> app@0.1.0 build
> next build

▲ Next.js 16.2.7 (Turbopack)
- Experiments (use with caution):
  · staticGenerationMaxConcurrency: 2
  · staticGenerationMinPagesPerWorker: 50

  Creating an optimized production build ...
✓ Compiled successfully in 30.8s
  Running TypeScript ...
  Finished TypeScript in 19.1s ...
  Collecting page data using 3 workers ...
  Generating static pages using 3 workers (0/32) ...
  Generating static pages using 3 workers (8/32) 
  Generating static pages using 3 workers (16/32) 
  Generating static pages using 3 workers (24/32) 
✓ Generating static pages using 3 workers (32/32) in 727ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /account
├ ƒ /api/balance
├ ƒ /api/investors
├ ƒ /api/keeper/distribution
├ ƒ /api/mint
├ ƒ /api/purchase
├ ƒ /api/token
├ ƒ /api/token-info
├ ƒ /api/txns
├ ƒ /api/version
├ ƒ /approvals
├ ƒ /approvals/[id]
├ ƒ /assets
├ ƒ /audit
├ ƒ /demo-payment
├ ƒ /distribution
├ ƒ /draft
├ ƒ /kyc
├ ƒ /mint
├ ƒ /orders
├ ƒ /orders/[id]
├ ƒ /portfolio
├ ƒ /reconciliation
├ ƒ /seller
├ ƒ /seller/transactions
├ ƒ /seller/withdraw
├ ƒ /tokens/[symbol]
├ ƒ /trade
├ ƒ /transactions
├ ƒ /transactions/[id]
├ ƒ /vault
├ ƒ /wallet
└ ƒ /withdraw


ƒ  (Dynamic)  server-rendered on demand

  => PASS: APP - BUILD BẢN PHÁT HÀNH

########## APP - E2E (PLAYWRIGHT) ##########

Running 76 tests using 1 worker

  ✓   1 [mock] › e2e/account-info.spec.ts:34:9 › FE-24 — Thông tin tài khoản › INVESTOR mở được hồ sơ của chính mình; khối hồ sơ chỉ đọc (2.8s)
  ✓   2 [mock] › e2e/account-info.spec.ts:47:9 › FE-24 — Thông tin tài khoản › INVESTOR thấy khối ví liên kết (OP-05 QĐ-I) (373ms)
  ✓   3 [mock] › e2e/account-info.spec.ts:34:9 › FE-24 — Thông tin tài khoản › SELLER mở được hồ sơ của chính mình; khối hồ sơ chỉ đọc (391ms)
  ✓   4 [mock] › e2e/account-info.spec.ts:47:9 › FE-24 — Thông tin tài khoản › SELLER thấy khối ví liên kết (OP-05 QĐ-I) (367ms)
  ✓   5 [mock] › e2e/account-info.spec.ts:34:9 › FE-24 — Thông tin tài khoản › TELLER mở được hồ sơ của chính mình; khối hồ sơ chỉ đọc (342ms)
  ✓   6 [mock] › e2e/account-info.spec.ts:47:9 › FE-24 — Thông tin tài khoản › TELLER không thấy khối ví liên kết (OP-05 QĐ-I) (345ms)
  ✓   7 [mock] › e2e/account-info.spec.ts:34:9 › FE-24 — Thông tin tài khoản › CONTROLLER mở được hồ sơ của chính mình; khối hồ sơ chỉ đọc (373ms)
  ✓   8 [mock] › e2e/account-info.spec.ts:47:9 › FE-24 — Thông tin tài khoản › CONTROLLER không thấy khối ví liên kết (OP-05 QĐ-I) (358ms)
  ✓   9 [mock] › e2e/account-info.spec.ts:65:7 › FE-24 — Thông tin tài khoản › Nhà đầu tư thấy KYC, rủi ro và ví của mình (399ms)
  ✓  10 [mock] › e2e/account-info.spec.ts:76:7 › FE-24 — Thông tin tài khoản › Người bán thấy pháp nhân, liên hệ và ví thanh toán (407ms)
  ✓  11 [mock] › e2e/account-info.spec.ts:87:9 › FE-24 — Thông tin tài khoản › TELLER không thấy hồ sơ đầu tư và địa chỉ ví (384ms)
  ✓  12 [mock] › e2e/account-info.spec.ts:87:9 › FE-24 — Thông tin tài khoản › CONTROLLER không thấy hồ sơ đầu tư và địa chỉ ví (330ms)
  ✓  13 [mock] › e2e/chain-scope.spec.ts:23:5 › FE-27 — Lập lệnh, Duyệt, Giao dịch và Tổng quan người bán đổi theo chain (1.4s)
  ✓  14 [mock] › e2e/chain-selector.spec.ts:12:5 › dropdown chain có đúng các chain đã chốt, KHÔNG có Polygon (366ms)
  ✓  15 [mock] › e2e/chain-selector.spec.ts:28:5 › đổi chain rồi mint vẫn chạy, và số dư tính theo từng chain (623ms)
  ✓  16 [mock] › e2e/investor-channel.spec.ts:45:7 › Cổng quyền vào kênh nhà đầu tư › INVESTOR vào được /portfolio và thấy đủ bốn hộp (384ms)
  ✓  17 [mock] › e2e/investor-channel.spec.ts:68:9 › Cổng quyền vào kênh nhà đầu tư › vai SELLER KHÔNG vào được khu vực nhà đầu tư (279ms)
  ✓  18 [mock] › e2e/investor-channel.spec.ts:68:9 › Cổng quyền vào kênh nhà đầu tư › vai TELLER KHÔNG vào được khu vực nhà đầu tư (297ms)
  ✓  19 [mock] › e2e/investor-channel.spec.ts:68:9 › Cổng quyền vào kênh nhà đầu tư › vai CONTROLLER KHÔNG vào được khu vực nhà đầu tư (305ms)
  ✓  20 [mock] › e2e/investor-channel.spec.ts:79:7 › Cổng quyền vào kênh nhà đầu tư › chưa kết nối ví thì MỜI kết nối, không hiện số 0 (300ms)
  ✓  21 [mock] › e2e/investor-channel.spec.ts:89:7 › Bộ chọn vai trò › có đủ bốn vai kèm mã tài khoản mẫu, và KHÔNG còn bộ chọn vai riêng (706ms)
  ✓  22 [mock] › e2e/investor-channel.spec.ts:116:9 › Bộ chọn vai trò › đổi sang INVESTOR thì về trang mặc định của vai và menu đổi theo (678ms)
  ✓  23 [mock] › e2e/investor-channel.spec.ts:116:9 › Bộ chọn vai trò › đổi sang SELLER thì về trang mặc định của vai và menu đổi theo (603ms)
  ✓  24 [mock] › e2e/investor-channel.spec.ts:116:9 › Bộ chọn vai trò › đổi sang CONTROLLER thì về trang mặc định của vai và menu đổi theo (762ms)
  ✓  25 [mock] › e2e/investor-channel.spec.ts:131:7 › Bộ chọn vai trò › đổi từ Nhà đầu tư về Giao dịch viên thì vai và menu đều theo (612ms)
  ✓  26 [mock] › e2e/investor-channel.spec.ts:149:7 › Điều hướng theo vai trò › menu Nhà đầu tư không lẫn mục vận hành (386ms)
  ✓  27 [mock] › e2e/investor-channel.spec.ts:161:7 › Điều hướng theo vai trò › menu Giao dịch viên không lẫn mục khách hàng, và có mục Lập lệnh (497ms)
  ✓  28 [mock] › e2e/investor-channel.spec.ts:171:7 › Điều hướng theo vai trò › menu Kiểm soát viên có ba nhóm và mục Phê duyệt, KHÔNG có Lập lệnh (596ms)
  ✓  29 [mock] › e2e/investor-channel.spec.ts:195:7 › Điều hướng theo vai trò › mọi mục menu đều là liên kết bấm được, không còn mục mờ (329ms)
  ✓  30 [mock] › e2e/investor-channel.spec.ts:209:7 › Điều hướng theo vai trò › bấm mục Giao dịch token ở mock thì dùng ví hồ sơ, không đòi kết nối ví (464ms)
  ✓  31 [mock] › e2e/investor-channel.spec.ts:227:7 › Điều hướng theo vai trò › Quản lý lệnh ở mock cũng dùng ví hồ sơ mà không cần extension (358ms)
  ✓  32 [mock] › e2e/investor-channel.spec.ts:241:7 › Điều hướng theo vai trò › số việc đang chờ hiện cạnh hai mục tài liệu chỉ định (634ms)
  ✓  33 [mock] › e2e/investor-channel.spec.ts:263:7 › Trang chi tiết dự án token › bấm một dòng trong danh sách token thì mở được trang chi tiết (445ms)
  ✓  34 [mock] › e2e/investor-channel.spec.ts:279:7 › Trang chi tiết dự án token › dự án đã lên chuỗi hiển thị phần vị thế và nhãn on-chain (367ms)
  ✓  35 [mock] › e2e/investor-channel.spec.ts:292:7 › Trang chi tiết dự án token › mã token không tồn tại thì ra trang không tìm thấy (299ms)
  ✓  36 [mock] › e2e/investor-channel.spec.ts:303:7 › Nhãn dữ liệu mẫu › số liệu chưa có nguồn thật đều có nhãn (421ms)
  ✓  37 [mock] › e2e/investor-channel.spec.ts:312:7 › Nhãn dữ liệu mẫu › KHÔNG hiển thị biến động giá hay khối lượng giao dịch (495ms)
  ✓  38 [mock] › e2e/maker-checker.spec.ts:39:7 › Lập lệnh và Phê duyệt lệnh › chuẩn bị: whitelist ví SPV bằng màn KYC có sẵn (451ms)
  ✓  39 [mock] › e2e/maker-checker.spec.ts:46:7 › Lập lệnh và Phê duyệt lệnh › ca 1, 2, 3 — Giao dịch viên lập yêu cầu tạo token (1.8s)
  ✓  40 [mock] › e2e/maker-checker.spec.ts:105:7 › Lập lệnh và Phê duyệt lệnh › ca 4 — chọn nguồn toàn bộ nguồn cung thì có cảnh báo xác nhận lại (742ms)
  ✓  41 [mock] › e2e/maker-checker.spec.ts:122:7 › Lập lệnh và Phê duyệt lệnh › ca 7 — guard hai chiều: Giao dịch viên không vào được Phê duyệt (386ms)
  ✓  42 [mock] › e2e/maker-checker.spec.ts:130:7 › Lập lệnh và Phê duyệt lệnh › ca 7 — guard hai chiều: Kiểm soát viên không vào được Lập lệnh (270ms)
  ✓  43 [mock] › e2e/maker-checker.spec.ts:136:7 › Lập lệnh và Phê duyệt lệnh › ca 5, 6 — Kiểm soát viên từ chối phải có lý do; chấp nhận thì hoàn tất (725ms)
  ✓  44 [mock] › e2e/maker-checker.spec.ts:177:7 › Lập lệnh và Phê duyệt lệnh › việc 13 — bộ lọc trạng thái có đủ năm trạng thái (372ms)
  ✓  45 [mock] › e2e/mint.spec.ts:56:7 › Phát hành token điện gió › KYC + whitelist rồi mint 100 WPT thì số dư thành 100 (621ms)
  ✓  46 [mock] › e2e/mint.spec.ts:89:7 › Phát hành token điện gió › mint cho ví chưa whitelist bị từ chối kèm lý do rõ ràng (488ms)
  -  47 [mock] › e2e/mint.spec.ts:101:7 › Phát hành token điện gió › hardhat: đường /mint bị từ chối trước khi gửi giao dịch
  ✓  48 [mock] › e2e/mint.spec.ts:115:7 › Phát hành token điện gió › vai Nhà đầu tư không vào được khu vực Vận hành (261ms)
  ✓  49 [mock] › e2e/mint.spec.ts:127:7 › Phát hành token điện gió › Kiểm soát viên vào được Vận hành nhưng không phát hành được (598ms)
  -  50 [mock] › e2e/mint.spec.ts:241:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần đầu vào vault qua Giao dịch viên và Kiểm soát viên
  -  51 [mock] › e2e/mint.spec.ts:252:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Mint lần hai cùng vault; vượt trần bị chặn trước khi gửi
  -  52 [mock] › e2e/mint.spec.ts:278:7 › SC-02 — lập duyệt Mint/Burn trên hardhat › Burn phần chưa phân phối qua cùng luồng lập duyệt
  ✓  53 [mock] › e2e/ops-transactions.spec.ts:26:5 › FE-06 / OP-02 — xử lý giao dịch và hai màn chi tiết Mock không cần ví (8.0s)
  ✓  54 [mock] › e2e/ops-transactions.spec.ts:212:5 › OP-02 — hai màn chi tiết vẫn mời kết nối ví trên chain thật (613ms)
  -  55 [mock] › e2e/permit-order.spec.ts:153:7 › FE-05 ca 14: ký permit trên /trade › mua: hộp ký nêu đúng số VNDB, ký trong ví, lệnh hoàn tất
  -  56 [mock] › e2e/permit-order.spec.ts:166:7 › FE-05 ca 14: ký permit trên /trade › bán: hộp ký nêu đúng số WPT, lệnh hoàn tất
  -  57 [mock] › e2e/permit-order.spec.ts:176:7 › FE-05 ca 14: ký permit trên /trade › huỷ ký (4001): quay lại hộp xác nhận, không tạo lệnh
  ✓  58 [mock] › e2e/token-info-read.spec.ts:4:5 › tra cứu WPT vẫn chạy khi hàng chờ Server Action bị giữ (1.2s)
  ✓  59 [mock] › e2e/token-info-read.spec.ts:23:5 › lỗi mạng có nút thử lại và lần sau đọc được, giữ nội dung biểu mẫu (1.6s)
  ✓  60 [mock] › e2e/token-info-read.spec.ts:40:5 › phản hồi chậm của chain cũ không ghi đè dữ liệu chain mới (1.8s)
  ✓  61 [mock] › e2e/vault-withdraw.spec.ts:23:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › chuẩn bị: whitelist ví nhận NB001 bằng màn KYC có sẵn (524ms)
  ✓  62 [mock] › e2e/vault-withdraw.spec.ts:31:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › Kiểm soát viên lưu cấu hình, /vault cập nhật (523ms)
  ✓  63 [mock] › e2e/vault-withdraw.spec.ts:50:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › vai khác chỉ xem cấu hình (412ms)
  ✓  64 [mock] › e2e/vault-withdraw.spec.ts:57:7 › BE-13 ca 15: cấu hình khoá vault và rút qua màn hình › Người bán tạo lệnh rút, thấy COMPLETED (1.2s)
  ✓  65 [mock] › e2e/wallet-connect.spec.ts:37:7 › Trang Ví của tôi › có trong menu nhà đầu tư và mở được (528ms)
  ✓  66 [mock] › e2e/wallet-connect.spec.ts:58:7 › Trang Ví của tôi › chế độ mock: nói rõ không cần ví, KHÔNG cảnh báo sai mạng (443ms)
  ✓  67 [mock] › e2e/wallet-connect.spec.ts:91:7 › Trang Ví của tôi › không có ví trong trình duyệt: hiện hướng dẫn cài, không lỗi kỹ thuật (406ms)
  ✓  68 [mock] › e2e/wallet-connect.spec.ts:127:7 › Trang Ví của tôi › có ví nhưng chưa kết nối: mời kết nối, không đòi cài ví (449ms)
  ✓  69 [mock] › e2e/wallet-connect.spec.ts:169:7 › Trang Ví của tôi › mạng Stellar bị disable trong bộ chọn nên không vào được trạng thái ví Stellar (349ms)
  ✓  70 [mock] › e2e/wallet-connect.spec.ts:182:7 › Trang Ví của tôi › không có lỗi lệch kết xuất khi tải trang (1.4s)
  ✓  71 [mock] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai TELLER KHÔNG vào được trang kết nối ví (299ms)
  ✓  72 [mock] › e2e/wallet-connect.spec.ts:218:9 › Trang Ví của tôi › vai CONTROLLER KHÔNG vào được trang kết nối ví (276ms)
  ✓  73 [mock] › e2e/wallet-connect.spec.ts:230:7 › Trang Ví của tôi › vai Người bán VÀO ĐƯỢC trang kết nối ví (318ms)
  ✓  74 [mock] › e2e/zz-distribution-approval.spec.ts:31:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › chuẩn bị: SPV nạp 1.000.000 VNDB vào quỹ chia qua màn có sẵn (754ms)
  ✓  75 [mock] › e2e/zz-distribution-approval.spec.ts:45:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Giao dịch viên xem quỹ và dự kiến, không thấy nút duyệt (372ms)
  ✓  76 [mock] › e2e/zz-distribution-approval.spec.ts:54:7 › FE-08 ca 13: Kiểm soát viên duyệt chia trên màn hình › Kiểm soát viên duyệt: hộp xác nhận nói rõ phạm vi, kỳ hoàn tất, lịch sử có người duyệt (786ms)

  7 skipped
  69 passed (1.1m)
  => PASS: APP - E2E (PLAYWRIGHT)

########## TỔNG KẾT ##########
  Phần đã chạy: build e2e
  Đạt:     2
    PASS  APP - BUILD BẢN PHÁT HÀNH
    PASS  APP - E2E (PLAYWRIGHT)
  Không đạt: 0

ĐIỂM CẮM ĐANG CHỜ

AU-01  (1 điểm cắm)
  [cắm]   app/src/app/actions/session.ts:34  setDemoRole đã sẵn: đặt cookie vai rồi refresh, KHÔNG điều hướng — dùng được để nối phiên SIWE mà giữ người dùng ở lại trang đang mở

BE-05  (1 điểm cắm)
  [cắm]   app/src/lib/store/index.ts:226  cổng đợt tất toán đã sẵn ở cả hai bản (bộ nhớ + Postgres): hồ sơ có bốn trạng thái, `(roundId, holderWallet)` duy nhất chặn một ví vào hai hồ sơ trong cùng đợt. Thứ tự bốn bước CỐ Ý để cho nghiệp vụ quyết, cổng chỉ giữ tập giá trị hợp lệ

FE-07  (4 điểm cắm)
  [cắm]   app/src/app/actions/bank.ts:41    đã sẵn đầu cuối ở `issueInitialSupply` NHƯNG từ FE-22 chỉ là đường dữ liệu thử sau hai lớp chặn (`demo:mint-token` + cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt); phát hành chính thức đã có ở màn Lập lệnh qua `createTokenRequestAction` + Kiểm soát viên duyệt. Phần đã sẵn: NHIỀU LẦN trong trần còn lại (trần đọc từ bảng dự án), lần sau chỉ vào đúng ví SPV chuỗi đã ghi, lưu giao dịch chờ trước khi đợi biên nhận, ghi mốc phát hành lần đầu bằng khoá lạc quan, đọc lại tổng cung từ chuỗi
  [cắm]   app/src/app/actions/bank.ts:49    đã sẵn đầu cuối ở `getIssuanceStatus`: trả SONG SONG trần trong bảng dự án, tổng cung thật trên chuỗi và trần còn lại, kèm mốc phát hành và ví SPV. Hai con số lệch nhau là tín hiệu cần đối soát, nên màn hình phải hiện cả hai chứ đừng chọn một
  [cắm]   app/src/app/actions/config.ts:19  đã sẵn đầu cuối ở `setIssuePrice`: validate Zod, guard HAI LỚP (`treasury:manage` rồi cờ `isConfig` của vai), kiểm ngưỡng đổi giá, ĐẨY GIÁ XUỐNG LEDGER TRƯỚC rồi mới ghi cơ sở dữ liệu + lịch sử, ghi bảng thất bại thì tự hoàn nguyên giá cũ trên ledger, ghi sổ kiểm toán cả bốn kết cục. Màn cấu hình chỉ cần gọi và hiển thị `Result`. FE-07 PHẢI hiện hộp xác nhận khi `Result` trả mã `VALIDATION` kèm thông báo lệch ngưỡng, rồi gọi lại với `confirmLargeChange: true` — service CỐ Ý không coi lần gọi thứ hai là xác nhận, vì lần gọi lại không chứng tỏ người dùng đã đọc cảnh báo
  [cắm]   app/src/app/actions/config.ts:26  đã sẵn đầu cuối ở `getIssuePrice`: trả giá đang có hiệu lực kèm vai đã đặt, thời điểm đặt, và cờ `configured` phân biệt "ngân hàng đã cấu hình" với "đang dùng mặc định trong mã". Màn cấu hình dùng đúng ba trường đó để hiện trạng thái hiện tại trước khi cho sửa; KHÔNG kiểm quyền vì giá phát hành là con số hiển thị công khai cho nhà đầu tư

FE-09  (2 điểm cắm)
  [cắm]   app/src/app/actions/distribution.ts:76  đã sẵn đầu cuối ở `getDistributionPeriod`: tra kỳ theo `periodKey` hoặc `periodId`, trả trạng thái kỳ kèm số hồ sơ theo từng trạng thái, tổng đã chi và số hồ sơ còn phải chi. Kiểm quyền `reconcile:read` nên hai vai vận hành đọc được và nhà đầu tư thì không. Hàm chỉ đọc và KHÔNG ghi sổ kiểm toán, nên màn theo dõi gọi lại theo chu kỳ được mà không nhấn chìm sổ
  [cắm]   app/src/lib/signer/wallet.signer.ts:10  đã sẵn: `ISigner` dựng từ provider EIP-1193 của ví, account dạng `json-rpc` nên KHÔNG giữ khóa, thiếu ví thì ném `SignerUnavailableError` có hướng dẫn. FE-05 đã dùng hàm này để ký permit (`wallet-permit.ts`); FE-09 và FE-11 dùng lại đúng hàm này cho nút ký của họ

FE-23  (1 điểm cắm)
  [cắm]   app/src/app/(investor)/withdraw/page.tsx:4  đường dẫn /withdraw, cổng portfolio:read và mục menu "Rút VNDB" đã chạy — FE-23 dựng phần thân; nghiệp vụ rút chưa có ở tầng backend

IN-02  (1 điểm cắm)
  [cắm]   app/src/lib/bank/distribution-trigger.service.ts:302  đã sẵn đầu cuối cách phát hiện bằng hỏi định kỳ: đọc `unallocatedProfit` của quỹ, có chặn ngưỡng tối thiểu và phát hiện quỹ hụt so với dự trữ ở `runDistributionCycle`. IN-02 chỉ cần đổi NGUỒN tín hiệu sang sự kiện `Transfer` vào quỹ do Indexer đọc được; kết cục vẫn là `AWAITING_APPROVAL` cho tới khi Kiểm soát viên duyệt

SC-04  (4 điểm chặn)
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1118  thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1124  thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1129  thiếu quyết định giá NAV có phải `Redemption.rate` hay không
  [chặn]  app/src/lib/ledger/evm.adapter.ts:1135  thiếu quyết định giá NAV có phải `Redemption.rate` hay không

LUỒNG NGHIỆP VỤ (marker @flow)

distribute  (24 bước)
   1  app/src/app/actions/distribution.ts:39                 nhận yêu cầu mở màn chia: tổng quan, trang lịch sử và lịch chạy trong một lượt  ::getDistributionPageAction
   2  app/src/lib/bank/distribution-approval.service.ts:579  kiểm quyền reconcile:read, đọc quỹ, dự kiến theo shareOf trên số dư hiện tại, kỳ hoạt động và lý do chưa duyệt được  ::getDistributionOverview
   3  app/src/app/actions/distribution.ts:45                 nhận lần duyệt chia của Kiểm soát viên kèm số VNDB đã xem trên màn  ::approveDistributionAction
   4  app/src/lib/bank/distribution-approval.service.ts:274  kiểm quyền distribution:approve, chain phải có vault, số duyệt phải bằng phần chưa phân bổ, giữ chỗ kỳ OPENING một kỳ hoạt động mỗi chain, mở trên chuỗi rồi so số thực tế  ::approveDistribution
   5  app/src/lib/bank/distribution.service.ts:335           dựng danh sách người nhận từ cơ sở dữ liệu cộng ví SPV vì chuỗi không liệt kê được người nắm giữ  ::collectRecipients
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
   7  app/src/lib/bank/distribution.service.ts:472           so số thực tế của kỳ trên chuỗi với số đã duyệt: đúng thì APPROVED, khác thì AMOUNT_CHANGED và dừng  ::decideApproval
   8  app/src/app/actions/distribution.ts:50                 nhận lần duyệt lại số thực tế trên chuỗi của kỳ AMOUNT_CHANGED hoặc kỳ cũ chưa duyệt  ::reapproveDistributionAction
   9  app/src/lib/bank/distribution-approval.service.ts:395  kiểm quyền distribution:approve, kỳ AMOUNT_CHANGED hoặc chưa duyệt, số duyệt lại phải bằng đúng số trên chuỗi, ghi APPROVED rồi chia  ::reapproveDistribution
  10  app/src/app/actions/distribution.ts:55                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:467  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
  12  app/src/lib/bank/distribution-trigger.service.ts:479   chiếm số vòng KeeperRun kèm nguồn MANUAL hoặc KEEPER, chạy lõi một lượt chia, đóng vòng và ghi sổ  ::runApprovedPeriod
  13  app/src/lib/bank/distribution.service.ts:1169          lõi một lượt chia: kỳ phải APPROVED, chốt kỳ vault phải DONE rồi mới lập hồ sơ chờ, đối soát đã trả và gửi từng lô  ::runDistributionRound
  14  app/src/lib/bank/distribution.service.ts:804           đẩy số đã dành cho kỳ vào closePeriod của vault đúng một lần: giữ chỗ mã kỳ vault, đối soát PeriodClosed trước khi gửi lại  ::syncVaultClose
  15  app/src/lib/bank/distribution.service.ts:261           đọc số dư từng ví tại ảnh chụp, tính phần chia nhân trước chia sau  ::allocate
  16  app/src/lib/bank/distribution-trigger.service.ts:382   ghi mốc số dư đã xử lý sau khi kỳ chia xong trọn vẹn  ::settleBalanceMark
  17  app/src/lib/bank/distribution-trigger.service.ts:603   chạy một vòng keeper: dọn kỳ OPENING và phần vault, đọc quỹ, chỉ tiếp tục kỳ đã APPROVED, không bao giờ mở kỳ  ::runDistributionCycle
  18  app/src/lib/bank/distribution-trigger.service.ts:303   đọc kỳ hoạt động và phần chưa phân bổ: chỉ tiếp tục kỳ APPROVED, còn lại AWAITING_APPROVAL, không bao giờ mở kỳ  ::decideCycle
  19  app/src/app/actions/distribution.ts:60                 nhận yêu cầu xem trang lịch sử kỳ chia  ::listDistributionPeriodsAction
  20  app/src/lib/bank/distribution-approval.service.ts:674  kiểm quyền reconcile:read, trang lịch sử kỳ kèm người duyệt, số duyệt, số thực tế, duyệt lại và nguồn kích hoạt  ::listDistributionPeriods
  21  app/src/app/actions/distribution.ts:65                 nhận yêu cầu xem trang hồ sơ trả từng ví của một kỳ  ::listDistributionPayoutsAction
  22  app/src/lib/bank/distribution-approval.service.ts:711  kiểm quyền reconcile:read, trang hồ sơ trả từng ví của một kỳ gồm ví được chia 0  ::listDistributionPayouts
  23  app/src/app/actions/distribution.ts:70                 nhận yêu cầu xem lịch chạy, mới nhất trước  ::listDistributionRunsAction
  24  app/src/lib/bank/distribution-trigger.service.ts:777   kiểm quyền reconcile:read, đọc lịch chạy KeeperRun kèm nguồn kích hoạt MANUAL hoặc KEEPER  ::listDistributionRuns

issue  (9 bước)
   1  app/src/app/actions/bank.ts:40            nhận yêu cầu phát hành vào ví SPV từ giao diện, chuyển tiếp sang service  ::issueInitialSupplyAction
   2  app/src/lib/bank/issuance.service.ts:368  validate, kiểm hai lớp chặn dữ liệu thử (quyền demo:mint-token và cờ ENABLE_DEMO_TOKEN_MINT), đọc trần phát hành từ bảng dự án  ::issueInitialSupply
   3  app/src/lib/bank/issuance.service.ts:270  gửi giao dịch phát hành vào ví SPV: lần đầu qua mintInitialSupply, các lần sau qua mint  ::pending
   4  app/src/lib/bank/issuance.service.ts:88   lưu giao dịch ở trạng thái chờ, TRƯỚC khi đợi biên nhận  ::saved
   5  app/src/lib/bank/issuance.service.ts:103  đợi biên nhận theo timeout của chuỗi, rồi cập nhật trạng thái giao dịch  ::receipt
   6  app/src/lib/bank/issuance.service.ts:301  lần đầu: ghi mốc phát hành vào bảng dự án bằng khoá lạc quan  ::marked
   7  app/src/lib/bank/issuance.service.ts:330  đọc lại tổng cung từ chuỗi làm sự thật cuối cùng  ::after
   8  app/src/app/actions/bank.ts:48            nhận yêu cầu xem trạng thái phát hành, chuyển tiếp sang service  ::issuanceStatusAction
   9  app/src/lib/bank/issuance.service.ts:429  đọc trạng thái phát hành: con số dự kiến trong bảng dự án đứng cạnh tổng cung thật trên chuỗi  ::getIssuanceStatus

purchase  (12 bước)
   1  app/src/app/actions/purchase.ts:39         nhận yêu cầu xem trước điều kiện mua, trước khi có lệnh nào  ::previewPurchaseAction
   2  app/src/lib/bank/purchase.service.ts:163   kiểm quyền order:place, báo giá, chạy bộ kiểm, KHÔNG ghi gì vào cơ sở dữ liệu  ::previewPurchase
   3  app/src/app/actions/purchase.ts:46         một trong hai đường vận chuyển: nhận yêu cầu đặt lệnh; đường kia là POST /api/purchase  ::placeOrderAction
   4  app/src/lib/bank/purchase.service.ts:219   validate Zod, kiểm quyền order:place, kiểm điều kiện, lưu đúng một lệnh rồi tự quyết toán chính lệnh vừa tạo  ::placeOrder
   5  app/src/lib/ledger/ledger.port.ts:232      chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh  ::quotePurchase
   6  app/src/lib/bank/purchase.service.ts:542   hệ thống nhận đúng bản ghi vừa tạo và tự quyết toán, không nhận orderId tùy ý  ::autoSettleCreatedOrder
   7  app/src/lib/bank/purchase.service.ts:1134  PLACED sang CHECKING, chạy lại bộ kiểm và chiếm EXECUTING chống gửi hai lần  ::settleStoredOrder
   8  app/src/lib/bank/purchase.service.ts:751   kiểm giá đã chốt rồi các phép đọc theo chiều lệnh (mua bốn, bán bốn), dừng ở lần trượt đầu tiên  ::runOrderChecks
   9  app/src/lib/bank/purchase.service.ts:1513  gửi giao dịch mua hoặc bán theo chiều lệnh, lưu mã tx trước khi chờ, chốt COMPLETED hoặc FAILED  ::sendAndSettle
  10  app/src/lib/ledger/ledger.port.ts:299      chuyển VNDB và WPT trong cùng một giao dịch  ::executePurchase
  11  app/src/app/actions/purchase.ts:65         một trong hai đường vận chuyển: nhận yêu cầu xem sổ lệnh; đường kia là GET /api/purchase  ::listOrdersAction
  12  app/src/lib/bank/purchase.service.ts:1700  kiểm order:read và order:read:all, lọc theo ví ở tầng service, lọc thêm chiều, mã lệnh, khoảng ngày  ::listOrders


Tổng: 10 điểm cắm · 4 điểm chặn · 45 bước luồng

  => ĐẠT các phần đã chạy: build e2e
exit=0
```

## 3. Sai lệch, lựa chọn khi làm

### 3.1 Lựa chọn khi spec để ngỏ

- **Quyền liên kết ví** dùng `wallet:connect` có sẵn (đúng hai vai khách hàng), không thêm quyền mới vào RBAC.
  Sổ kiểm toán dùng nhãn `profile:wallet:link`.
- **Khoá duy nhất "ví viết thường"**: Prisma không khai được chỉ mục theo biểu thức, nên lưu thêm cột
  `walletKey` (viết thường) và đặt `@@unique([chain, walletKey])`.
- **Ví trùng hồ sơ khác** trả mã `VALIDATION` kèm `fieldErrors.wallet` (người dùng sửa được bằng ví khác),
  không thêm mã lỗi mới.
- **Khối "Ví liên kết"** gắn ở `app/(account)/account/page.tsx`, không trong `AccountInfoPage`: thành phần đó
  được kiểm bằng kết xuất tĩnh không có provider ví; phần chỉ đọc của FE-24 giữ nguyên.
- **Các màn Nhà đầu tư trên `mock`** lấy ví qua `ownMockWallet()` (ví liên kết, chưa có thì ví mẫu) để cùng
  nguồn với điều kiện "Định danh".
- **Ước phí** đo bằng cách chạy thật cả vòng trên Hardhat nội bộ, nên số giao dịch là số đo, không phải số gõ
  tay; bảng QĐ-E chỉ nằm trong kiểm thử ca 2 để đối chiếu.
- **Kiểm database QĐ-F** là một tệp SQL dùng biến `psql` (`chain`, `token`) để Sếp chạy nguyên văn ở bước 3 và
  11; tập trạng thái được kiểm khớp mã bằng `op-05-db-check-sql.test.ts`.
- **`.env.example`** đổi `SPV_SEPOLIA_ADDRESS` (không còn ai đọc) thành `PAYOUT_WALLET`, `INVESTOR_WALLET`
  mà đoạn console bước 7 dùng.
- **Ca 4** dùng hai tài khoản mở sẵn của nút (#2 làm `INVESTOR_WALLET`, #6 làm `PAYOUT_WALLET`), không dùng ví
  mẫu `NDT001`/`NB001`, để kiểm đúng đường liên kết ví.

### 3.2 Môi trường sandbox

`binaries.soliditylang.org` bị chặn nên lệnh Hardhat chạy với `USE_LOCAL_SOLC=1`; Postgres 16 cục bộ.
Diễn tập gõ đoạn console của runbook vào `npx hardhat console` qua pty (`script`), vì console nhận stdin không
phải terminal sẽ đánh giá cả khối như một module và lỗi ở `require` cùng `await`; khi Sếp gõ tay không gặp.

## 4. Tài liệu

`docs/TESTNET_SEPOLIA.md` (viết lại), `docs/DEPLOYMENT.md` (`KEEPER_SECRET`, CH-6, Hyperdrive mới),
`docs/tech-report.md` bản 4.22 (đầu trang, nhật ký, mục mới 3.28, ghi chú ở 3.21, dòng nợ P1 ở 1.6.C),
`scripts/op05-db-check.sql`, `.kiro/task-status.json` (FE-08 sang `done`, OP-05 `inProgress`).

## 5. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi lời gọi chuỗi qua `ILedgerPort` (liên kết ví không chạm chuỗi; `previewTrade` vẫn qua `getLedger`).
- [x] Mọi thao tác ký qua `ISigner` (không thêm đường ký nào trong app; script vận hành giữ nguyên cách ký).
- [x] Mọi kiểm quyền qua RBAC (`assertCan(role, 'wallet:connect')`; không so tên vai).

## 6. Kết quả chạy Sepolia

(Để trống. Supervisor điền ở PR C từ đầu ra Sếp gửi theo runbook bước 14.)
