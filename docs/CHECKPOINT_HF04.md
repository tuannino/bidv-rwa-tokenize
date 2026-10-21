# Báo cáo bàn giao: HF-04 đối soát chốt kỳ vault khi RPC đọc log đi sau

| | |
|---|---|
| Mã task | HF-04 |
| Nhánh | `fix/hf-04-doi-soat-chot-ky`, tạo từ `dev` (`e2a6b98`, PR #66 đã merge) |
| Spec | `docs/hf-04-doi-soat-chot-ky/{requirements,design,tasks}.md` (Supervisor soạn, kèm bản sửa) |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `fe-08-approval.test.ts` HF-04 ca 1, 2 xanh, đỏ với mã cũ; ca 5 CONFLICT thật vẫn khoá | ✅ | mục 1 |
| 2 | `hf-04-chot-ky-evm.test.ts` ca 3 xanh trên nút Hardhat, đỏ khi bỏ đường đọc biên nhận | ✅ | mục 2 |
| 3 | Nút Hardhat: `sc-06-distribution-evm`, `fe-08-approval-evm`, `be-13-vault-evm` xanh | ✅ | mục 2 |
| 4 | Mô phỏng job A xanh | ✅ | mục 3 |

**Kết luận:** 4 ✅, 0 🔶, 0 ❌. Không đổi hợp đồng, quyền, lược đồ; không sửa database production.

### 0.2 Việc cần Owner quyết

- Không có. Sau khi deploy: Kiểm soát viên mở `/distribution`, kỳ `evm:2026-10-21-01` hiện nút tiếp tục; bấm thì
  đối soát lại (sự kiện `PeriodClosed` kỳ 1 khớp 1.000.000) rồi chia, rồi làm tiếp lượt 13.8 của runbook.

---

## 1. Kiểm thử mock và đối chứng mã cũ

Ca 5 (FE-08, CONFLICT thật: mã kỳ bị chốt bằng số khác) nằm trong bộ `-t "HF-04|ca 5"` và vẫn khoá.

```text
$ (cd app && npx vitest --run test/fe-08-approval.test.ts test/hf-03-doc-log-evm.test.ts)
 ✓ test/hf-03-doc-log-evm.test.ts (3 tests) 83ms
 ✓ test/fe-08-approval.test.ts (40 tests) 108ms
 Test Files  2 passed (2)
      Tests  43 passed (43)
exit=0

$ (cd app && npx vitest --run test/fe-08-approval.test.ts -t "HF-04|ca 5")   # bản sửa: HF-04 ca 1, 2 và ca 5 (CONFLICT thật vẫn khoá)
 Test Files  1 passed (1)
      Tests  5 passed | 35 skipped (40)
exit=0

# đối chứng 1: distribution.service.ts lấy lại bản dev e2a6b98 (mã cũ)
$ git show origin/dev:app/src/lib/bank/distribution.service.ts > app/src/lib/bank/distribution.service.ts
$ (cd app && npx vitest --run test/fe-08-approval.test.ts -t "HF-04|ca 5")
   × HF-04: đối soát chốt kỳ vault khi RPC đọc log đi sau > ca 1: giao dịch chốt của kỳ vào khối mà quét log chưa thấy: DONE qua biên nhận, chia đủ, không CONFLICT 12ms
   × HF-04: đối soát chốt kỳ vault khi RPC đọc log đi sau > ca 2: kỳ đã lỡ thành CONFLICT dù sự kiện của chính nó khớp số: màn cho tiếp tục, đối soát lại thì DONE và chia 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  2 failed | 3 passed | 35 skipped (40)
exit=1

# đối chứng 2: distribution-approval.service.ts lấy lại bản dev (màn khoá mọi CONFLICT)
$ (cd app && npx vitest --run test/fe-08-approval.test.ts -t "HF-04|ca 5")
   × HF-04: đối soát chốt kỳ vault khi RPC đọc log đi sau > ca 2: kỳ đã lỡ thành CONFLICT dù sự kiện của chính nó khớp số: màn cho tiếp tục, đối soát lại thì DONE và chia 15ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  1 failed | 4 passed | 35 skipped (40)
exit=1

$ git diff --stat   # hoàn nguyên: chỉ còn phần sửa của HF-04
 .kiro/task-status.json                            |  1 +
 app/src/lib/bank/distribution-approval.service.ts | 25 +++++++++-
 app/src/lib/bank/distribution.service.ts          | 29 ++++++++----
 app/src/lib/ledger/evm.adapter.ts                 | 34 +++++++++++++-
 app/src/lib/ledger/ledger.port.ts                 |  6 ++-
 app/test/fe-08-approval.test.ts                   | 56 +++++++++++++++++++++++
 docs/flows/distribute.md                          | 10 ++--
 docs/flows/purchase.md                            |  4 +-
 docs/tech-report.md                               |  1 +
 9 files changed, 145 insertions(+), 21 deletions(-)
```

## 2. Nút Hardhat thật

Mỗi tệp một lệnh, reset chuỗi trước mỗi tệp. `hf-04-chot-ky-evm.test.ts` chen một máy chủ giữa app và nút, trả
`eth_getLogs` rỗng như RPC đọc log chưa thấy khối mới.

```text
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/hf-04-chot-ky-evm.test.ts)
 Test Files  1 passed (1)
      Tests  1 passed (1)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts)
 Test Files  1 passed (1)
      Tests  10 passed (10)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-08-approval-evm.test.ts)
 Test Files  1 passed (1)
      Tests  8 passed (8)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/be-13-vault-evm.test.ts)
 Test Files  1 passed (1)
      Tests  5 passed (5)
exit=0

# đột biến: bỏ đường đọc biên nhận trong findVaultPeriodClose
$ sed -i 's/if (!found \&\& hintTxHash) {/if (false \&\& !found \&\& hintTxHash) {/' app/src/lib/ledger/evm.adapter.ts
1
$ bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/hf-04-chot-ky-evm.test.ts)
   × HF-04: tra chốt kỳ vault qua biên nhận khi quét log chưa thấy > ca 3: không gợi ý thì null (log trễ); gợi ý đúng giao dịch thì ra số thật; sai mã kỳ thì null 156ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  1 failed (1)
exit=1
$ git status --short   # hoàn nguyên
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 3014)
```

## 3. Mô phỏng job A

```text
$ ( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"; trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT; bash scripts/run-local-all.sh arch markers checkpoint app )
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 7 server action (guard nằm ở tầng service, xem lớp 1)
  PASS  Bảng quyền không teo lại so với origin/dev (37 -> 37 hành động)
  PASS  Không có ABI nhúng trong app/src (chỉ dùng từ packages/shared)
  PASS  Không có contract ID Stellar hardcode trong app/src
  PASS  Contract chính không import từ trex/ (toolchain tách biệt)
  PASS  Không còn tham chiếu Polygon/Amoy/Mumbai (ngoài comment)
  PASS  Không còn ký hiệu cũ SPT / tVND
  PASS  Có .kiro/steering
  PASS  Có .kiro/specs
  PASS  Có docs
  PASS  spec p4-mint-testnet đủ 3 file
  PASS  spec p7-profit-distribution đủ 3 file
  PASS  spec p12-redemption đủ 3 file
  PASS  app/package-lock.json đã được commit (npm ci trong Docker chạy được)
  PASS: 20   FAIL: 0   WARN: 3
  => ĐẠT nhưng có 3 cảnh báo cần xác nhận có chủ đích.
ĐẠT     OP-05 · docs/CHECKPOINT_OP05.md
      Tests  1098 passed | 84 skipped (1182)
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
   6  app/src/lib/bank/distribution.service.ts:556           mở kỳ trên chuỗi bằng nhãn dùng một lần, lưu mã giao dịch trước khi chờ, tra kỳ trên chuỗi để hoàn tất hoặc phục hồi  ::driveOpening
  10  app/src/app/actions/distribution.ts:55                 nhận yêu cầu tiếp tục kỳ đã duyệt: phục hồi, đối soát vault, chia lô còn lại  ::continueDistributionAction
  11  app/src/lib/bank/distribution-approval.service.ts:467  kiểm quyền distribution:approve, phục hồi kỳ OPENING, kỳ phải APPROVED, chạy một lượt chia có ghi nguồn MANUAL  ::continueDistribution
  => ĐẠT các phần đã chạy: arch markers checkpoint app
jobA exit=0
artifacts đã phục hồi
```

## 4. Góp ý khi áp bản sửa

- Thêm chú thích sơ đồ trạng thái chốt kỳ vault ở `app/src/lib/store/distribution.store.port.ts`: `CONFLICT` có
  đường ra `CONFLICT ──► DONE` chỉ khi sự kiện đúng mã kỳ khớp số. Bản gốc vẫn mô tả `CONFLICT` là trạng thái
  cuối, lệch với mã sau HF-04. Chỉ đổi chú thích.
- Đã rà các chỗ khác đọc sự kiện qua RPC đọc log (HF-03): `findOrderSettlement` (lệnh mất mã) đọc trạng thái
  `isOrderSettled` qua RPC chính trước, log chậm chỉ dẫn tới `SETTLED_TX_UNKNOWN` giữ nguyên trạng thái;
  ứng viên lệnh rút mất mã (`findVaultWithdrawals`) luôn chuyển `NEEDS_REVIEW` cho người xem. Cả hai không ghi
  sai tiền khi log đi sau, nên không sửa trong HF-04; lệnh rút mất mã có thể hiện thiếu ứng viên vài giây.
