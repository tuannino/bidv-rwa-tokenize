# SC-07 — chi tiết kiểm chứng

Tệp này giữ đầu ra dài theo `.kiro/steering/efficiency.md`. Mọi đầu ra dưới đây là từ lệnh đã chạy;
mã thoát ghi ngay dưới từng khối.

## 1. Hợp đồng

```text
$ cd packages/contracts-evm && npx hardhat test
...
  132 passing (2s)
exit 0
```

Số ca mới so với nền:

```text
$ git diff --unified=0 3342c2e -- packages/contracts-evm/test | rg '^\+\s*(it|test)\(' | wc -l
      24
exit 0
```

20 ca vault + 1 ca chặn P4 + 3 ca phân loại lỗi cấp phí đúng bằng 24 ca tăng từ nền 108 lên 132.

## 2. Address book

```text
$ git diff 3342c2e -- packages/shared/src/addresses.json
@@ -4,7 +4,8 @@
     "hardhat-local": {
       "chainId": 31337,
       "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
-      "deployedAt": "2026-10-15T15:24:38.330Z",
+      "deployedAt": "2026-10-19T14:58:50.757Z",
+      "deployBlock": 1,
       "contracts": {
@@ -12,7 +13,8 @@
         "IdentityRegistry": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
         "ModularCompliance": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
-        "AllowAllModule": "0x0165878A594ca255338adfa4d48449f69242Eb8F"
+        "AllowAllModule": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
+        "SpvPaymentVault": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"
       }
     },
     "evm": {
exit 0
```

Bảy địa chỉ cũ không đổi; `evm` không có dòng diff. Vault là địa chỉ thứ tám và `deployBlock = 1`.

## 3. Marker và ABI

```text
$ node scripts/scan-pending.mjs --check
Marker hợp lệ: 18 điểm cắm, 10 điểm chặn, 35 bước luồng. Không có lỗi.
exit 0

$ cd app && npx vitest --run test/abi-contract-sync.test.ts
 ✓ test/abi-contract-sync.test.ts (14 tests) 4ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
exit 0
```

## 4. Bộ mặc định

```text
$ bash scripts/run-local-all.sh
...
 Test Files  42 passed | 1 skipped (43)
      Tests  849 passed | 23 skipped (872)
...
########## TỔNG KẾT ##########
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
exit 0
```

Ba cảnh báo kiến trúc là các cảnh báo nền có chủ đích: hai lần đọc biến môi trường công khai,
placeholder/ví giả lập Hardhat, và lượt chạy không đặt `BASE_REF`; không có FAIL.

## 5. Job A

```text
$ (
>   set -e
>   BAK="$(mktemp -d)"
>   mv packages/contracts-evm/artifacts "$BAK/artifacts"
>   trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
>   bash scripts/run-local-all.sh arch markers checkpoint app
> )
> test -d packages/contracts-evm/artifacts && echo "artifacts đã phục hồi"
...
########## TỔNG KẾT ##########
  Phần đã chạy: arch markers checkpoint app
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
...
artifacts đã phục hồi
exit 0
```

## 6. Hardhat thật

`evm-local.sh reset` đã deploy/seed đúng tám địa chỉ, nhưng tiến trình nền bị môi trường chạy lệnh
thu hồi khi lệnh kết thúc. Lượt test đầu chỉ có `ECONNREFUSED`, không phải lỗi assertion nghiệp vụ:

```text
$ TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts
 Test Files  1 failed (1)
      Tests  12 failed | 1 passed | 1 skipped (14)
Caused by: Error: connect ECONNREFUSED 127.0.0.1:8545
exit 1
```

Giữ `npx hardhat node` trong phiên, rồi chạy đúng `evm-local.sh up` để deploy/seed. Đầu ra triển khai:

```text
[evm-local] nút đã chạy ở http://127.0.0.1:8545
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
ProjectToken         0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken             0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ProfitDistributor    0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption           0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance    0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule       0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
exit 0
```

Hai lượt nghiệp vụ thành công:

```text
$ TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts
 ✓ test/evm-issuance.test.ts (14 tests | 1 skipped) 4610ms

 Test Files  1 passed (1)
      Tests  13 passed | 1 skipped (14)
exit 0

$ TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/vault.test.ts
 ✓ test/vault.test.ts (6 tests) 68ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
exit 0

$ bash scripts/evm-local.sh down
[evm-local] không có nút nào do script này dựng
exit 0
```

Nút giữ phiên đã được dừng bằng SIGINT trước lệnh `down`; không còn tiến trình/cổng local.

## 7. Checkpoint

```text
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_SC07.md docs/sc-07-vault-thanh-toan/requirements.md
ĐẠT     docs/CHECKPOINT_SC07.md
  mục 0: 21/60 dòng · bảng đối chiếu 7 dòng / 7 điều kiện · 6 ✅ 1 🔶 0 ❌ · cả tệp 135/800 dòng
exit 0
```

## 8. Quét bí mật

```text
$ git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật"
không có bí mật
exit 0
```
