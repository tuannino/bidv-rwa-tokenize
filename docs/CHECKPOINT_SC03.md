# Báo cáo bàn giao — SC-03: Hợp đồng khớp lệnh mua bán WPT

| | |
|---|---|
| Mã task | SC-03 |
| Nhánh | `feat/sc-03-khop-lenh`, từ `dev` @ `725f2c1` |
| Spec | `docs/sc-03-khop-lenh/{requirements,tasks}.md` bản 2.1 |
| Mức kiểm chứng | Cao |
| Tiến độ | Hoàn tất local; chưa triển khai Sepolia (thuộc OP-05) |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `OrderSettlement` theo QĐ-A–QĐ-E; NatSpec ghi giả định QĐ-H; ca 1–15 | ✅ | mục 1 · 6.1 |
| 2 | Bộ cũ xanh; bảy đột biến đỏ đúng ca | ✅ | mục 2 · 6.1 |
| 3 | `orderRef`, deploy/công cụ QĐ-F/QĐ-G; tám địa chỉ cũ giữ nguyên | ✅ | mục 3 · 6.2 |
| 4 | App R1–R8, ca 19–23 và kiểm chứng chung ca 24 | ✅ | mục 4 · 6.3–6.7 |
| 5 | Tài liệu khớp lệnh, máy trạng thái BE-17 và nợ P2 đã cập nhật | ✅ | mục 5 |

**Kết luận:** 5 ✅ · 0 🔶 · 0 ❌. SC-03 hoàn tất local; OP-05 mới triển khai Sepolia.

### 0.2 Việc cần Owner quyết

- Không có. Phạm vi chưa làm đã chốt trong spec: FE-05 ký permit trên giao diện; OP-05 triển khai
  lại Sepolia; SC-04 cung cấp công tắc tất toán thật.

---

## 1. Hợp đồng và 15 ca SC-03

`OrderSettlement` đọc hai token từ vault, giữ giá công khai, chỉ cho operator mua/bán và chuyển hai
chân nguyên tử. Dấu chống trùng nằm ở vault; kiểm trùng đứng trước giá/permit/transfer. Bốn đường
lệnh đều có pause, vai và khóa reentrancy. Hai đường permit yêu cầu `value` đúng số lệnh nhưng bỏ qua
lỗi permit đã dùng để allowance có sẵn vẫn được dùng.

Lệnh đo số ca riêng:

```text
$ rg -c '^\s*it\("ca (?:[1-9]|1[0-5]):' packages/contracts-evm/test/sc-03-khop-lenh.test.js
15
```

NatSpec ghi ba giả định: operator chọn dữ liệu lệnh; price role đổi giá; một khóa máy chủ giữ các vai
trong PoC. Contract không giữ tài sản.

## 2. Bộ cũ và bảy đột biến

Nền SC-07 có 132 ca; SC-03 thêm đúng 15 ca, bộ cuối có 147 ca. Đầu ra toàn bộ ở mục 6.1.

Bảy đột biến được áp dụng độc lập, chạy đúng ca chỉ định, mỗi lệnh trả mã 1 rồi nguồn được hoàn
nguyên trước đột biến kế tiếp:

```text
17a bỏ PriceMismatch       -> 1 failing: ca 4
17b bỏ try/catch permit    -> 1 failing: ca 10
17c bỏ PermitValueMismatch -> 1 failing: ca 10
17d bỏ whenNotPaused sell  -> 1 failing: ca 12
17e kéo chân mua về matcher -> 1 failing: ca 2
17f bỏ kiểm trùng đầu hàm  -> 1 failing: ca 6
17g bỏ nonReentrant sell   -> 1 failing: ca 15
```

Bằng chứng nguồn đã phục hồi:

```text
$ git diff --exit-code 2078c39 -- packages/contracts-evm/contracts/OrderSettlement.sol packages/contracts-evm/test/sc-03-khop-lenh.test.js packages/contracts-evm/contracts/test/ReentrantSettlementModule.sol && echo 'nguồn hợp đồng/ca đột biến đã phục hồi đúng commit 2078c39'
nguồn hợp đồng/ca đột biến đã phục hồi đúng commit 2078c39
```

## 3. Mã lệnh, triển khai và công cụ

- `orderRefFromOrderId` đặt 16 byte UUID đầu `bytes32`; chiều ngược từ chối phần đuôi khác 0.
- `token-parameters.json` là nguồn chung của giá ban đầu 100.000 VNDB/WPT.
- Deploy giữ nguyên thứ tự tám hợp đồng có sẵn, thêm `OrderSettlement` thứ chín; vault chỉ cấp
  `MATCHER_ROLE` cho matcher. Verify kiểm bytecode, liên kết vault/token/giá và ba vai.
- Công cụ ước lượng gas tính cả matcher và các giao dịch cấp vai. Preflight OP-05 kiểm đủ chín địa chỉ.

Địa chỉ Hardhat local đo sau deploy; tám dòng trước giữ nguyên, chỉ thêm dòng thứ chín:

```text
$ jq -r '.chains["hardhat-local"].contracts | to_entries[] | "\(.key)=\(.value)"' packages/shared/src/addresses.json
ProjectToken=0x5FbDB2315678afecb367f032d93F642f64180aa3
VNDToken=0xe7f1725E7734CE288f8367e1Bb143E90bb3F0512
ProfitDistributor=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Redemption=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
IdentityRegistry=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
ModularCompliance=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
AllowAllModule=0x0165878A594ca255338adfa4d48449f69242Eb8F
SpvPaymentVault=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement=0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
```

Khóa `evm` không đổi; task không triển khai Sepolia.

## 4. Ứng dụng R1–R8

### 4.1 Cổng và adapter

- `SettlementOrder` mang `orderId`, ví, WPT và số VNDB đã chốt.
- `findOrderSettlement` có ba kết quả; EVM hỏi dấu trước, chỉ quét sự kiện khi đã quyết toán và
  chia đoạn từ `deployBlock`. `ORDER_SETTLEMENT_EVENT_BLOCK_CHUNK` mặc định 5.000.
- EVM nối giá, allowance VNDB/WPT, mua/bán và dịch lỗi. Mock giữ tập lệnh đã quyết toán, tương thích
  JSON cũ; Stellar báo chưa hỗ trợ rõ ràng.
- Chiều bán kiểm allowance WPT sau số dư WPT và trước thanh khoản VNDB của vault.

### 4.2 Chốt thất bại và phục hồi

Mọi nhánh sắp ghi `FAILED`/`REJECTED` đi qua một hàm đối soát. `SETTLED` chốt `COMPLETED` bằng tx
gốc; chưa tìm thấy sự kiện hoặc RPC lỗi giữ nguyên trạng thái. Lệnh `EXECUTING` mất tx chỉ quay lại
`CHECKING` bằng cập nhật có điều kiện sau khi chain xác nhận chưa quyết toán. Đây là cạnh quay lại
duy nhất của máy trạng thái.

### 4.3 Một nguồn giá

Chain có matcher dùng `OrderSettlement.price` làm giá hiệu lực; giá DB được trả riêng để cảnh báo
khi lệch. Mock giữ nguồn DB hiện tại. Runbook OP-05 có bước đối chiếu giá sau deploy/reset.

### 4.4 Marker và sơ đồ

```text
$ node scripts/scan-pending.mjs --json
summary: pending=18, blocked=5, flows=35, errors=0
byTask: không có SC-03

$ node scripts/gen-flow-diagram.mjs purchase
Đã cập nhật: docs/flows/purchase.md (12 bước)
```

## 5. Tài liệu và phạm vi

- `docs/tech-report.md` bản 4.17 có bảng hai chân, permit/nonce, pause tạm thay công tắc tất toán,
  quy trình thay matcher, biên tin cậy, cạnh phục hồi BE-17 và nợ P2 đã xử lý.
- `packages/contracts-evm/README.md` mô tả matcher thứ chín, vai và quy trình thay phiên bản.
- `docs/TESTNET_SEPOLIA.md` chuyển thành runbook OP-05, kiểm đủ chín hợp đồng và một nguồn giá R7.
- `.env.example` ghi cỡ đoạn sự kiện và hai biến địa chỉ mới; address book đã commit vẫn là nguồn
  được ưu tiên cho triển khai.

Không làm UI permit, không deploy Sepolia, không sửa vault hay các contract SC-09/SC-10, không làm
công tắc tất toán SC-04.

## 6. Kiểm chứng cuối

### 6.1 Toàn bộ hợp đồng

```text
$ cd packages/contracts-evm && npx hardhat test
...
  SC-03 - OrderSettlement
    ✔ ca 1: triển khai nối đúng vault, token, giá và matcher duy nhất
    ✔ ca 2: mua chuyển đủ hai chân, chỉ vault phát OrderSettled và matcher không giữ tiền
    ✔ ca 3: bán chuyển đủ hai chân và giảm thu ròng
    ✔ ca 4: giá đổi giữa đặt và khớp bị từ chối trước khi chuyển
    ✔ ca 5: đổi giá cần vai, cấm zero và phát đúng sự kiện
    ✔ ca 6: gửi lại mua, mua permit và bán đều báo OrderAlreadySettled đầu tiên
    ✔ ca 7: bốn lỗi chiều mua hoàn nguyên cả hai chân
    ✔ ca 8: bốn lỗi chiều bán hoàn nguyên cả hai chân
    ✔ ca 9: phần khoá lớn hơn số dư không chặn bán lại
    ✔ ca 10: permit VNDB chạy, ràng buộc value và bỏ qua permit đã dùng
    ✔ ca 11: permit WPT chạy và chữ ký gửi trước vẫn dùng được
    ✔ ca 12: pause chặn bốn đường lệnh nhưng không chặn giá hay vault
    ✔ ca 13: bốn đường lệnh và pause đều bị chặn đúng vai
    ✔ ca 14: thay phiên bản giữ dấu orderRef ở vault
    ✔ ca 15: module gọi lồng sell bị đúng ReentrancyGuardReentrantCall

  147 passing (2s)
```

### 6.2 Deploy/verify cục bộ

```text
$ bash scripts/evm-local.sh reset
[evm-local] nút sẵn sàng sau 1s
Nút mới, chưa có hợp đồng.
[evm-local] triển khai bộ hợp đồng
...
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
OrderSettlement      0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6
Địa chỉ không đổi, giữ nguyên ../shared/src/addresses.json
NDT001 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 vừa xác minh
NB001 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 vừa xác minh

$ cd packages/contracts-evm && npx hardhat run scripts/verify-deployment.js --network localhost
...
OK   MATCHER_ROLE chỉ cấp cho OrderSettlement
OK   OrderSettlement.vault khớp
OK   OrderSettlement.projectToken khớp
OK   OrderSettlement.paymentToken khớp
OK   OrderSettlement.price = 100000
OK   OPERATOR_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
OK   PRICE_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
OK   PAUSER_ROLE -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BẢN DEPLOY HỢP LỆ — ERC-3643/permit và vault hiện có đã nối đúng.
```

### 6.3 Bộ mặc định

```text
$ bash scripts/run-local-all.sh
...
Marker hợp lệ: 18 điểm cắm, 5 điểm chặn, 35 bước luồng. Không có lỗi.
ĐẠT     SC-03 · docs/CHECKPOINT_SC03.md
  mục 0: 18/60 dòng · bảng đối chiếu 5 dòng / 5 điều kiện · 5 ✅ 0 🔶 0 ❌
  147 passing (2s)
Test Files  43 passed | 2 skipped (45)
     Tests  864 passed | 33 skipped (897)
...
Phần đã chạy: arch markers checkpoint contracts app
Đạt:     7
Không đạt: 0
=> ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```

Ba cảnh báo kiến trúc là cảnh báo nền đã biết: hai chỗ đọc env có chủ đích, địa chỉ mẫu chỉ dùng
placeholder/Hardhat, và lệnh không đặt `BASE_REF`; không có cảnh báo mới của SC-03.

### 6.4 Mô phỏng Job A

```text
$ ( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts";
    trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT;
    bash scripts/run-local-all.sh arch markers checkpoint app )
$ test -d packages/contracts-evm/artifacts && echo "artifacts đã phục hồi"
...
Test Files  43 passed | 2 skipped (45)
     Tests  864 passed | 33 skipped (897)
Phần đã chạy: arch markers checkpoint app
Đạt:     6
Không đạt: 0
=> ĐẠT các phần đã chạy: arch markers checkpoint app
artifacts đã phục hồi
```

Lượt đầu bị phiên Codex ngắt giữa khi Vitest thu thập module nên một worker timeout; `trap` vẫn in
`artifacts đã phục hồi`. Lượt nguyên vẹn bên trên chạy lại cùng lệnh và xanh, là bằng chứng nghiệm thu.

### 6.5 App trên Hardhat thật

```text
$ cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts
✓ test/evm-issuance.test.ts (14 tests | 1 skipped) 4567ms
Test Files  1 passed (1)
     Tests  13 passed | 1 skipped (14)

$ TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-order-settlement.test.ts
✓ test/evm-order-settlement.test.ts (10 tests) 362ms
Test Files  1 passed (1)
     Tests  10 passed (10)

$ bash scripts/evm-local.sh down
[evm-local] đã dừng nút
```

### 6.6 Quét marker/checkpoint

```text
$ node scripts/check-checkpoint.mjs docs/CHECKPOINT_SC03.md docs/sc-03-khop-lenh/requirements.md
ĐẠT     docs/CHECKPOINT_SC03.md
  mục 0: 18/60 dòng · bảng đối chiếu 5 dòng / 5 điều kiện · 5 ✅ 0 🔶 0 ❌

$ node scripts/scan-pending.mjs | grep "SC-03" || echo "không còn điểm chặn SC-03"
không còn điểm chặn SC-03
```

### 6.7 Quét bí mật và trạng thái Git

```text
$ git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật trong commit"
không có bí mật trong commit

$ git diff | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" | grep -v ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 || echo "không có bí mật trong thay đổi chưa commit"
không có bí mật trong thay đổi chưa commit
```

### 6.8 Release build

```text
$ bash scripts/run-local-all.sh build
✓ Compiled successfully
✓ Generating static pages using 9 workers (32/32)
=> PASS: APP - BUILD BẢN PHÁT HÀNH

Phần đã chạy: build
Đạt:     1
Không đạt: 0
=> ĐẠT các phần đã chạy: build
```

Lượt chạy trong sandbox bị chặn khi tải Google Font; chạy lại cùng lệnh với quyền mạng đã xanh như
trên. Đây là giới hạn mạng của môi trường kiểm thử, không phải lỗi biên dịch hoặc TypeScript.
