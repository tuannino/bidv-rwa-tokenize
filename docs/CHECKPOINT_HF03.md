# Báo cáo bàn giao: HF-03 đọc sự kiện EVM qua RPC riêng, theo từng đoạn block

| | |
|---|---|
| Mã task | HF-03 |
| Nhánh | `fix/hf-03-doc-log-evm`, tạo từ `dev` (`268e5b3`, PR #65 đã merge) |
| Spec | `docs/hf-03-doc-log-evm/{requirements,design,tasks}.md` (Supervisor soạn, kèm bản sửa) |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | `hf-03-doc-log-evm.test.ts` ca 1 đến 3 xanh; bỏ chia đoạn hoặc đọc qua RPC chính thì đỏ | ✅ | mục 1 |
| 2 | Nút Hardhat thật ba tệp xanh với `EVM_LOG_BLOCK_CHUNK=3` và mặc định | ✅ | mục 2 |
| 3 | Mô phỏng job A xanh | ✅ | mục 3 |

**Kết luận:** 3 ✅, 0 🔶, 0 ❌. Chỉ đổi đường đọc sự kiện; không đổi đường ghi, quyền, dữ liệu, hợp đồng.

### 0.2 Việc cần Owner quyết

- Không có. Lưu ý vận hành: không đặt `RPC_EVM_LOGS` trỏ Alchemy gói miễn phí (chỉ 10 block mỗi lần quét);
  để trống là dùng RPC công khai `ethereum-sepolia-rpc.publicnode.com` (tối đa 50.000 block). Biến mới ghi ở
  runbook bước 9. Sau khi merge, mở lại `/vault` trên Sepolia để xác nhận hai khối lịch sử đọc được.

---

## 1. Kiểm thử và đột biến

Máy chủ JSON-RPC giả trong kiểm thử từ chối khoảng quét quá 10 block bằng đúng lỗi Alchemy (`-32600`), không gọi
mạng thật.

```text
$ (cd app && npx vitest --run test/hf-03-doc-log-evm.test.ts)
 ✓ test/hf-03-doc-log-evm.test.ts (3 tests) 161ms
      Tests  3 passed (3)
exit=0

# đột biến a: bỏ chia đoạn (chunk = latest - fromBlock + 1)
1
$ (cd app && npx vitest --run test/hf-03-doc-log-evm.test.ts)
   ✓ HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block > ca 1: evm đọc sự kiện qua RPC_EVM_LOGS; trống thì RPC công khai mặc định, không dùng RPC_EVM 5ms
   × HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block > ca 2: lịch sử cấu hình và lịch sử chốt kỳ quét theo đoạn không vượt giới hạn của RPC 68ms
   ✓ HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block > ca 3: một đoạn quá giới hạn thì báo lỗi LedgerError, không trả lịch sử rỗng giả 22ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 2 passed (3)
exit=1

# đột biến b: logsRpcUrlFor luôn trả rpcUrlFor (đọc sự kiện qua RPC chính)
1
$ (cd app && npx vitest --run test/hf-03-doc-log-evm.test.ts)
   × HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block > ca 1: evm đọc sự kiện qua RPC_EVM_LOGS; trống thì RPC công khai mặc định, không dùng RPC_EVM 11ms
   × HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block > ca 2: lịch sử cấu hình và lịch sử chốt kỳ quét theo đoạn không vượt giới hạn của RPC 1089ms
   ✓ HF-03: đọc sự kiện EVM qua RPC riêng, theo từng đoạn block > ca 3: một đoạn quá giới hạn thì báo lỗi LedgerError, không trả lịch sử rỗng giả  1065ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
      Tests  2 failed | 1 passed (3)
exit=1

$ git status --short   # hoàn nguyên: chỉ còn phần sửa của HF-03
 M .env.example
 M .kiro/task-status.json
 M app/src/lib/chains/registry.ts
 M app/src/lib/config/env.ts
 M app/src/lib/ledger/evm.adapter.ts
 M docs/TESTNET_SEPOLIA.md
 M docs/tech-report.md
?? app/test/hf-03-doc-log-evm.test.ts
?? docs/hf-03-doc-log-evm/
```

## 2. Nút Hardhat thật

Mỗi tệp một lệnh, reset chuỗi trước mỗi tệp, đoạn 3 block (ép chia nhiều đoạn) và mặc định 10.000:

```text
$ bash scripts/evm-local.sh reset; (cd app && EVM_LOG_BLOCK_CHUNK=3 TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts)
 Test Files  1 passed (1)
      Tests  10 passed (10)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && EVM_LOG_BLOCK_CHUNK=3 TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/be-13-vault-evm.test.ts)
 Test Files  1 passed (1)
      Tests  5 passed (5)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && EVM_LOG_BLOCK_CHUNK=3 TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-08-approval-evm.test.ts)
 Test Files  1 passed (1)
      Tests  8 passed (8)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && EVM_LOG_BLOCK_CHUNK=10000 TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/sc-06-distribution-evm.test.ts)
 Test Files  1 passed (1)
      Tests  10 passed (10)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && EVM_LOG_BLOCK_CHUNK=10000 TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/be-13-vault-evm.test.ts)
 Test Files  1 passed (1)
      Tests  5 passed (5)
exit=0
$ bash scripts/evm-local.sh reset; (cd app && EVM_LOG_BLOCK_CHUNK=10000 TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-08-approval-evm.test.ts)
 Test Files  1 passed (1)
      Tests  8 passed (8)
exit=0
$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút (pid 2510)
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
      Tests  1096 passed | 83 skipped (1179)
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
