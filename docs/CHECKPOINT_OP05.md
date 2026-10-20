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
| 1 | PR A: ca 1 đến 9, `CHECKPOINT_OP05.md` phần coder, mục "Kết quả chạy Sepolia" để trống | ✅ | mục 2; chi tiết kiểm chứng mục 1 đến 10; mục 6 để trống |
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
| 9 | `run-local-all.sh`, job A, job C, nút thật từng tệp, quét bí mật | xem số đo dưới |

Số đo chính (đầu ra nguyên văn ở `docs/CHECKPOINT_OP05_VERIFICATION_DETAIL.md`): VERIFY_SUMMARY

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
