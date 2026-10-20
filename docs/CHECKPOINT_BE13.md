# Báo cáo bàn giao: BE-13: Người bán rút VNDB từ vault qua hệ thống, Kiểm soát viên cấu hình khoá vault

| | |
|---|---|
| Task | BE-13 |
| Nhánh | `feat/be-13-rut-vault`, tạo từ `dev` @ `15a5d9a` (PR #59, FE-05 đã merge) |
| Spec | `docs/be-13-rut-vault/{requirements,tasks}.md` bản 2.1 (bản 2 lúc nhận task; bản 2.1 thêm QĐ-C1 và ca 5b khi đang làm) |
| Mức kiểm chứng | Cao |
| Tiến độ | Bước 0 đến 7 xong, cộng QĐ-C1. Chờ Supervisor nghiệm thu; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | QĐ-A đến QĐ-I, QĐ-C1 (ca 1 đến 15, 5b). Đột biến (ca 16). Kiểm chứng chung (ca 17) | ✅ | mục 1, 2; chi tiết kiểm chứng mục 1 đến 13; chi tiết đột biến |
| 2 | `tech-report.md`, `packages/contracts-evm/README.md`, `docs/guide.md` | ✅ | mục 4 |

**Kết luận:** 2 ✅, 0 🔶, 0 ❌. Spec đổi sang bản 2.1 khi đang làm (QĐ-C1, ca 5b), đã làm thêm thành
một commit riêng (mục 3.1). Không sửa hợp đồng (chi tiết kiểm chứng mục 13).

### 0.2 Việc cần Owner quyết/chạy

- Không có việc bắt buộc. Supervisor chốt mức các dòng nợ QĐ-J ghi "đề nghị" ở tech-report 1.6.C, và
  xem các lựa chọn khi spec để ngỏ ở mục 3.3 (đáng chú ý nhất: đích FIXED không gửi tỷ lệ; ví nhận
  trên mock không điền sẵn NB001; người thao tác trong lịch sử cấu hình là vai, chưa phải tài khoản).

---

## 1. Kết quả chính

- **RBAC đóng (bước 1, QĐ-A, QĐ-B):** vai lạ không có quyền nào, `ForbiddenError` ghi `UNKNOWN`; gỡ
  `FALLBACK_ROLE`; ba quyền `vault:configure`, `vault:reconcile` (CONTROLLER), `vault:withdraw` (SELLER).
- **Cổng chuỗi, vault mock (bước 2, QĐ-G):** `ILedgerVault` thêm bốn setter cấu hình,
  `withdrawFromVault`, `findVaultWithdrawals`, `vaultWithdrawalReceipt`, `vaultConfigEvents`; `ILedgerRead`
  thêm `latestBlockNumber`. ABI thêm `withdraw`, `Withdrawn`, bốn sự kiện cấu hình, `EnforcedPause`.
  Vault mock ở `MOCK_VAULT_ADDRESS`, hàm thuần `vault-lock.ts`, R6 áp mock qua `vaultAddressFor`.
- **Cấu hình khoá (bước 3, QĐ-C, QĐ-D):** bảng `VaultOperationLock`; `saveVaultConfig` theo bảng chuyển
  tiếp; khoá `vault.default_percent_bps`; mục "Cấu hình khoá" trên `/vault`.
- **Lệnh rút (bước 4, QĐ-E, QĐ-F):** bảng `WithdrawRequest`; `createWithdrawRequest`,
  `reconcileWithdrawRequests`, `resolveWithdrawRequest`; không bao giờ tự gửi lại.
- **Gỡ FE-21, màn hình (bước 5, QĐ-H, QĐ-I):** màn rút thật, bảng "Yêu cầu rút của tôi", `SellerTxnRow`
  union, "Lệnh rút cần xem xét" trên `/vault`; `docs/guide.md`.
- **Lịch sử cấu hình (QĐ-C1, spec 2.1):** `getVaultConfigHistory` từ sự kiện trên chuỗi, mục "Lịch sử
  cấu hình" trên `/vault`; dòng không do app gửi ghi "ngoài app".

## 2. Ca kiểm chứng và nơi chạy

| Ca | Nơi kiểm |
|---|---|
| 1 | `app/test/rbac.test.ts` "BE-13 ca 1"; phần service ở `be-13-vault-config.test.ts`, `be-13-withdraw.test.ts` |
| 2, 3, 4, 5, 6 | `app/test/be-13-vault-config.test.ts` (bọc cổng ghi thứ tự giao dịch thực gửi và trạng thái sau từng giao dịch; hợp đồng khoá chạy bộ nhớ và Postgres) |
| 5b | `be-13-vault-config.test.ts` (mock) và `be-13-vault-evm.test.ts` (nút thật, đổi bằng `vault-admin.js` thật) |
| 7 | `app/test/be-13-vault-evm.test.ts` (nút Hardhat thật) |
| 8, 9, 10, 11 | `app/test/be-13-withdraw.test.ts` (bộ ràng buộc chạy cả Postgres thật) |
| 12 | `app/test/be-13-mock-vault.test.ts`, `packages/contracts-evm/test/be-13-vault-lock-parity.test.js` (cùng bảng số `test/fixtures/be13-vault-lock-table.json`), `mock-ledger-state-store.test.ts` (dòng JSONB cũ trên Postgres), `sc-06-distribution-flow.test.ts` (chốt kỳ trên mock) |
| 13, 14 | `app/test/be-13-seller.test.ts`, `seller-channel.test.ts` |
| 15 | `app/e2e/vault-withdraw.spec.ts` (project `mock` và `hardhat`) |
| 16 | `docs/CHECKPOINT_BE13_MUTATIONS_DETAIL.md`: 16a đến 16g đều đỏ đúng ca, hoàn nguyên sạch |
| 17 | `docs/CHECKPOINT_BE13_VERIFICATION_DETAIL.md`; nâng lược đồ cả bằng `be-13-postgres-upgrade.test.ts` |

Số đo chính (đầu ra ở chi tiết kiểm chứng): hợp đồng 158 passing (156 nền cộng 2 ca bảng số khoá);
`run-local-all.sh` 7 PASS, vitest 1020 đạt, 66 bỏ qua; job A 6 phần đạt, artifacts phục hồi; job C 4
PASS, E2E hardhat 23 đạt; E2E mock 62 đạt; nút thật từng tệp: `vault` 6, `sc-06-distribution-evm` 10,
`evm-order-settlement` 10, `fe-05-permit-evm` 8, `evm-issuance` 13 (1 bỏ qua), `be-13-vault-evm` 5 đều
đạt; database dựng theo `init.sql` của `dev` (17 bảng, chưa có bảng BE-13) chạy 5 tệp Postgres của nhánh
289 đạt và được nâng thêm `VaultOperationLock`, `WithdrawRequest`, khoá `vault.default_percent_bps`;
Postgres thật toàn bộ 1107 đạt, 49 bỏ qua; quét bí mật sạch; không còn điểm chờ BE-13; hợp đồng không
bị sửa so với `origin/dev`. Nền trước khi làm (chi tiết kiểm chứng mục 13): 7 PASS, hợp đồng 156, vitest 921.

## 3. Sai lệch, lựa chọn khi làm và ca cũ phải sửa

### 3.1 Spec bản 2.1 đến khi đang làm

Owner gửi bản 2.1 (thêm QĐ-C1 lịch sử cấu hình, ca 5b) khi bước 5 đang làm. Em hoàn tất bước 5, rồi
làm QĐ-C1 thành commit `4dc19a9`; bản 2.1 thay bản 2 trong `docs/be-13-rut-vault/`.

### 3.2 Ca cũ đổi theo spec (không xoá ca nào)

| Tệp | Ca | Lý do |
|---|---|---|
| `app/test/rbac.test.ts` | khối "FALLBACK_ROLE (FE-20)" thành "BE-13 ca 1"; "role lạ bị quy về quyền thấp nhất"; "vai trò lạ quy về FALLBACK_ROLE: không quyền GHI"; "SELLER không có quyền GHI nào; CONTROLLER chỉ có order:approve" | QĐ-A, QĐ-B |
| `token-request`, `maker-checker-ui`, `issuance-service`, `investor-trading`, `ops-transactions`, `seller-channel`, `demo-payment` (ca 8) `.test.ts` | hằng ví Mint đầu `NB001` thành `MOCK_VAULT_ADDRESS` | QĐ-G: R6 áp mock |
| `app/e2e/maker-checker.spec.ts`, `mint.spec.ts` (nhánh mock), `ops-transactions.spec.ts` | như trên | QĐ-G |
| `mock-ledger-state-store.test.ts` | "whitelist + lập ở A, duyệt ở B" (Postgres): ví đích là vault, vẫn kiểm whitelist ví hồi quy ở B | QĐ-G |
| `issuance-service.test.ts` | "ví SPV chưa whitelist thì ledger từ chối": vault whitelist từ đầu, nay đóng băng vault để ledger từ chối cùng chỗ | QĐ-G |
| `vault.test.ts` | "mock và stellar công khai trạng thái chưa triển khai", "service trả null trên mock": mock nay có vault UNSET | QĐ-G |
| `seller-channel.test.ts` | ca 1 khối ví (khoá theo vault, không còn `withdrawFeeVnd`); ca 3 `quoteWithdraw` không phí; ca 4 khoá cấu hình FE-21 không tác dụng, khoá theo setter vault; "phần khoá không vượt số dư" thành luật hợp đồng | QĐ-G, QĐ-H |
| `distribution-service`, `distribution-trigger`, `sc-06-distribution-mock`, `mock-ledger`, `mock-ledger-factory` | không đổi, vẫn đạt: không ca nào khẳng định mock không có vault; mint thẳng qua adapter (R6 là luật tầng nghiệp vụ) | spec liệt kê "ít nhất" |

### 3.3 Lựa chọn khi spec để ngỏ

- **Bảng số OP-05 của ca 12:** repo chưa có bảng số nào mang tên OP-05; em dựng bảng từ chính tham số
  của ca 12 (PERCENT 20%, mua 100, bán 40, chốt kỳ 1.000.000, rút 50%, giá 100.000) thành tệp
  `be13-vault-lock-table.json`, cộng một kịch bản làm tròn, tỷ lệ chờ và `netProceeds` chặn ở 0. Hợp
  đồng thật, hàm thuần và vault mock chạy cùng tệp đó.
- **Đích FIXED không gửi `setPercentRate`:** đúng hai giao dịch của dòng `UNSET`/PERCENT sang FIXED ở
  bảng QĐ-C. Ô tỷ lệ vẫn được kiểm dạng; tỷ lệ chỉ lên chuỗi khi đích là PERCENT (màn có câu giải thích).
- **Ví nhận trên mock không điền sẵn NB001:** vault mock khởi tạo giống hợp đồng (chưa có ví nhận),
  Kiểm soát viên đặt ví trên màn; NB001 là ví nhận dùng trong hướng dẫn và e2e. Nếu Owner muốn ô ví
  nhận điền sẵn NB001 trên mock thì chỉ là một dòng ở `getVaultOverview`.
- **Người thao tác trong lịch sử cấu hình là VAI và ví ký** (từ `Txn`), chưa phải mã tài khoản: bảng
  `Txn` không có cột tài khoản; khi có phiên thật (AU-01) thì bổ sung.
- **Lỗi giữa chừng khi lưu cấu hình** trả `LEDGER` kèm `fieldErrors.completedSteps`, `failedStep`,
  `payoutChanged` (kiểu `Result` không mang dữ liệu ở nhánh lỗi), câu lỗi nêu đủ bước đã xong, bước lỗi
  và ví nhận đã đổi hay chưa.
- **Giao dịch rút lỗi không phải revert** (ví dụ RPC rớt sau khi gửi) giữ `SENDING`, không ghi `FAILED`:
  không chắc chưa lên chuỗi, đối soát sẽ chuyển người xem. Biên nhận cấu hình hết thời gian chờ thì giữ
  khoá `CONFIG` cho lần sau tiếp quản.
- **Đối soát lệnh rút** chạy được bằng `vault:read` (vai vận hành) hoặc `vault:withdraw` (Người bán mở màn).
- **Vai lạ ở tầng service:** `currentRole()` giữ nguyên (QĐ-A) nên giá trị vai hỏng trong cookie hay env
  lùi về vai mặc định TELLER; ca service với "UNKNOWN" vì vậy kiểm vai mặc định, còn `can` với vai lạ kiểm
  ở `rbac.test.ts`.
- **`latestBlockNumber` trên EVM dùng `cacheTime: 0`:** viem mặc định đệm số block vài giây, ca nút thật
  bắt được lỗi này.
- **Câu lỗi `EnforcedPause` của rút vault** là "Vault đang tạm dừng rút." (tên lỗi trùng với hợp đồng
  khớp lệnh, câu cũ nói về khớp lệnh).
- **README `vault-admin.js`** ghi tham số vị trí trong khi script đọc biến môi trường; em sửa theo script.

### 3.4 Môi trường sandbox

`binaries.soliditylang.org` bị chặn nên lệnh Hardhat chạy với `USE_LOCAL_SOLC=1`; Playwright cần liên
kết `chromium_headless_shell-1243` sang bản 1194 như ghi chú bàn giao.

## 4. Tài liệu

`docs/tech-report.md` bản 4.20: đầu trang, đoạn tóm tắt BE-13, **mục mới 3.26** (cấu hình khoá và bảng
chuyển tiếp, lịch sử cấu hình, khoá vận hành, máy trạng thái rút, `NEEDS_REVIEW`, vault mock, màn hình),
RBAC đóng ở 3.3, bảng method cổng ở 3.1, 3.4 (`withdraw-limit.ts`), 3.13 (khoá mới, ba khoá FE-21 gỡ),
3.16, 3.23, bốn dòng nợ QĐ-J ở 1.6.C. `packages/contracts-evm/README.md`: đường chính là `/vault`, cảnh
báo script, sửa cú pháp `vault-admin.js` (script đọc biến môi trường, README cũ ghi tham số vị trí).
`docs/guide.md`: dữ liệu mock (vault là địa chỉ logic, NB001 là ví nhận), mục 7 Kiểm soát viên cấu hình
rồi Người bán rút. Sơ đồ `issue`, `purchase` và mục điểm cắm sinh lại bằng công cụ.

## 5. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi lời gọi chuỗi qua `ILedgerPort` (vault mock nằm trong adapter mock; service không gọi viem).
- [x] Mọi thao tác ký qua `ISigner` (adapter EVM ký bằng signer ngân hàng; mock nhận địa chỉ người ký từ factory).
- [x] Mọi kiểm quyền qua RBAC (`authorize` ở mọi service mới; vai lạ không có quyền nào).
