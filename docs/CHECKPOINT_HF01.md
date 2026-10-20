# Báo cáo bàn giao: HF-01 hotfix hiệu năng

| | |
|---|---|
| Mã task | HF-01 |
| Nhánh | `fix/hf-01-hieu-nang`, tạo từ `dev` (`dd00e12`) |
| Spec | `docs/hf-01-hieu-nang/{requirements,design,tasks}.md` |
| Tiến độ | Bước 2/2 xong. Supervisor tự làm theo chỉ định của chủ dự án ngày 21/10/2026; chờ Owner duyệt và merge |

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Bốn việc có trong mã, kiểm bởi `hf-01-hieu-nang.test.ts` ca 1 đến 4 | ✅ | mục 1, mục 2 |
| 2 | Kiểm thử EVM xanh trên nút Hardhat thật, từng tệp | ✅ | mục 3 |
| 3 | `bash scripts/run-local-all.sh` xanh | ✅ | mục 4 |
| 4 | `/seller/withdraw` trên bản dựng nhánh: action 4 xuống 2, không còn prefetch RSC | ✅ | mục 5 |
| 5 | `tech-report.md` mục 1.6 A có bài học, mục C có nợ PERF-01 và khởi động nguội | ✅ | mục 6 |

**Kết luận:** 5 ✅, 0 🔶, 0 ❌

### 0.2 Việc cần Owner quyết

- Không có. Ghi chú: `sc-06-distribution-evm` ca 18 có lần đỏ vì vượt 5 giây (5.638 ms), chạy lại 2 lần xanh (4.722 ms, 4.782 ms); trên `dev` cũng sát ngưỡng. Đây là lỗi đã biết, FE-08 sửa (mục "Việc kèm" của FE-08).

---

## 1. Đã làm

- `sidebar.tsx`: chỉ gọi `getPendingWorkAction` khi chain đang chọn khác chain mặc định; chain mặc định dùng số do `AppLayout` đọc ở mỗi lần kết xuất.
- 12 tệp có `next/link`: mọi `Link` đặt `prefetch={false}`.
- `actions/withdraw.ts`: thêm `reconcileAndListMyWithdrawRequestsAction`; `seller-withdraw.tsx` gọi một action khi mở thay cho hai.
- `evm.adapter.ts`: client đọc dùng `http(rpcUrl, { batch: { batchSize: RPC_READ_BATCH_SIZE } })`, `RPC_READ_BATCH_SIZE = 20`; client ghi giữ nguyên.
- Lô JSON-RPC trên RPC công cộng đang dùng, chạy thật:

```
$ curl ... -d '[{eth_blockNumber},{eth_chainId},{eth_gasPrice}]' https://ethereum-sepolia-rpc.publicnode.com
[{"jsonrpc":"2.0","id":1,"result":"0xb673e5"},{"jsonrpc":"2.0","id":2,"result":"0xaa36a7"},{"jsonrpc":"2.0","id":3,"result":"0xf4251"}]
```

## 2. Kiểm thử chặn quay lại và đột biến

```
$ (cd app && npx vitest --run test/hf-01-hieu-nang.test.ts test/be-13-withdraw.test.ts test/seller-vault.test.ts test/four-roles-shell.test.ts test/op07-chain-scope.test.ts)
 Test Files  5 passed (5)
      Tests  58 passed | 4 skipped (62)
```

Đột biến (mỗi lần sửa một chỗ, chạy `test/hf-01-hieu-nang.test.ts`, rồi `git checkout`):

```
== a_prefetch_hang: Tests  1 failed | 3 passed (4)
== b_goi_lai_menu: Tests  1 failed | 3 passed (4)
== c_hai_action: Tests  1 failed | 3 passed (4)
== d_bo_lo: Tests  1 failed | 3 passed (4)
git sạch: 0
```

## 3. Kiểm thử EVM trên nút Hardhat thật (sau commit `202912f`, phần adapter không đổi sau đó)

```
evm-issuance           Tests  13 passed | 1 skipped (14)
be-13-vault-evm        Tests  5 passed (5)
evm-order-settlement   Tests  10 passed (10)
fe-05-permit-evm       Tests  8 passed (8)
sc-06-distribution-evm Tests  1 failed | 9 passed (10)   (ca 18: 5638ms)
sc-06-distribution-evm Tests  10 passed (10)             (chạy lại: ca 18 4722ms)
sc-06-distribution-evm Tests  10 passed (10)             (chạy lại: ca 18 4782ms)
vault                  Tests  6 passed (6)
```

## 4. Bộ cục bộ (sau commit `7b2d8a6`)

```
$ bash scripts/run-local-all.sh        # exit=0
      Tests  1024 passed | 66 skipped (1090)
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
$ bash scripts/run-local-all.sh build e2e   # exit=0
  62 passed (1.7m)
  => ĐẠT các phần đã chạy: build e2e
$ (cd app && npm run cf:build)          # exit=0
OpenNext build complete.
```

## 5. Đo số lượt gọi Worker khi mở trang (Playwright, vai Người bán, đếm yêu cầu có `next-action` và yêu cầu `_rsc`)

```
--- nhánh fix/hf-01 (bản dựng cục bộ):
/seller/withdraw {"ACTION":2}
/seller {"ACTION":1}
/seller/transactions {"ACTION":1}
--- production dev @ dd00e12:
/seller/withdraw {"ACTION":4,"RSC":9} RSC /account, RSC /wallet, RSC /seller/transactions, RSC /seller, RSC /account, RSC /seller/withdraw, RSC /seller/transactions, RSC /seller, RSC /wallet
/seller {"ACTION":2,"RSC":9} RSC /seller/withdraw, RSC /seller/transactions, RSC /account, RSC /wallet, RSC /seller/withdraw, RSC /seller/transactions, RSC /wallet, RSC /seller, RSC /account
/seller/transactions {"ACTION":2,"RSC":9} RSC /account, RSC /wallet, RSC /seller/withdraw, RSC /seller, RSC /account, RSC /wallet, RSC /seller/withdraw, RSC /seller/transactions, RSC /seller
```

## 6. Tài liệu

- `docs/tech-report.md` mục 1.6 A: 4 dòng bài học HF-01. Mục C: nợ P1 PERF-01 (`/vault` 3 action, `investor-trade` 2 đến 3), nợ P2 khởi động nguội 1,1 đến 1,5 giây.
- Mục điểm cắm sinh lại bằng `node scripts/scan-pending.mjs --write-report` (số dòng `evm.adapter.ts` dịch).
- `.kiro/task-status.json`: `HF-01` vào `done`.
