# Báo cáo bàn giao — BE-01: Mở rộng ILedgerPort cho ba luồng

| | |
|---|---|
| Nhánh | `feat/ledger-port-3flows`, tạo từ `dev` tại `2e1daa9` |
| Spec | `docs/be-01-ledger-port/{requirements,design,tasks}.md` |
| Số commit | 8 |
| Phạm vi | 14 file, +2015 / −39 dòng |

## 1. Đã làm

Tám commit, mỗi commit một mục tiêu và đều ở trạng thái build được:

| Commit | Mục tiêu |
|---|---|
| `bac0da3` | `refactor(ledger)`: tách `ILedgerPort` theo nghiệp vụ + thêm chữ ký ba luồng |
| `3939665` | `feat(ledger)`: stellar adapter ném lỗi rõ ràng cho method mới |
| `a196a1a` | `feat(ledger)`: mock adapter hiện thực đầy đủ ba luồng |
| `397d05f` | `test(ledger)`: phủ toàn bộ ràng buộc của mock adapter |
| `248757a` | `feat(shared)`: giao diện hợp đồng cho chốt quyền và chia lợi nhuận |
| `40e71cf` | `fix(shared)`: thêm mục `error` của OZ v5 vào ABI tối giản |
| `251ad4c` | `feat(ledger)`: evm adapter hiện thực phần không chờ hợp đồng mới |
| `e73e801` | `docs`: cập nhật báo cáo công nghệ cho `ILedgerPort` mở rộng |

Nội dung chính:

- `ILedgerPort` tách thành **7 interface con** theo nghiệp vụ trong cùng `ledger.port.ts`, hợp lại bằng kế thừa kiểu. Tên giữ nguyên nên **không lời gọi hiện tại nào phải sửa** (kiểm bằng typecheck: sau khi tách, lỗi duy nhất là ở ba adapter vì chưa hiện thực method mới — không có lỗi nào ở tầng nghiệp vụ hay component).
- Thêm **16 method** mới + hai kiểu `TransferCheck`, `SnapshotResult`. `ILedgerPort` đi từ 11 lên **27 method**.
- `mock.adapter`: hiện thực **16/16**, giữ đủ bảng ràng buộc ở `design.md` mục 3.
- `stellar.adapter`: **16/16** ném `LedgerNotImplementedError`, gợi ý nêu đúng thứ còn thiếu, không trả giá trị giả.
- `evm.adapter`: **6/16** hiện thực thật (xem mục 4 — DEVIATION), 10 method còn lại ném lỗi nêu rõ đang chờ gì.
- `packages/shared`: bổ sung `snapshot`/`balanceOfAt`/`totalSupplyAt`/`getCurrentSnapshotId` + event `Snapshot` vào `projectTokenAbi`, `allowance` vào `vndTokenAbi`, thêm `profit-distributor.ts` và `redemption.ts`, và thêm mục `error` của OZ v5 vào cả 4 ABI.
- Test mock ledger: **11 → 48 test**. Test toàn app: **50 → 91 test**.

## 2. Bảng 16 method: hiện thực ở adapter nào

✅ hiện thực · ⏳ ném `LedgerNotImplementedError`

| # | Nhóm | Method | mock | evm | stellar | evm còn nợ vì |
|---|---|---|---|---|---|---|
| 1 | Compliance | `canTransfer` | ✅ | ✅ | ⏳ | — |
| 2 | Issuance | `mintInitialSupply` | ✅ | ⏳ | ⏳ | chưa có contract phát hành một lần (SC-02) |
| 3 | Issuance | `isInitialSupplyMinted` | ✅ | ⏳ | ⏳ | chưa có contract phát hành một lần (SC-02) |
| 4 | Purchase | `quotePurchase` | ✅ | ⏳ | ⏳ | giá bán nằm trong contract khớp lệnh (SC-03) |
| 5 | Purchase | `paymentBalanceOf` | ✅ | ✅ | ⏳ | — |
| 6 | Purchase | `paymentAllowanceOf` | ✅ | ⏳ | ⏳ | `spender` phải là địa chỉ contract khớp lệnh (SC-03) |
| 7 | Purchase | `executePurchase` | ✅ | ⏳ | ⏳ | chưa có contract khớp lệnh (SC-03) |
| 8 | Snapshot | `takeSnapshot` | ✅ | ✅ | ⏳ | — |
| 9 | Snapshot | `balanceOfAt` | ✅ | ✅ | ⏳ | — |
| 10 | Snapshot | `totalSupplyAt` | ✅ | ✅ | ⏳ | — |
| 11 | Distribution | `profitPoolBalance` | ✅ | ✅ | ⏳ | — |
| 12 | Distribution | `distributeBatch` | ✅ | ⏳ | ⏳ | `distributeTo` nhận `distributionId`, không nhận `snapshotId` (xem mục 5, câu hỏi 2) |
| 13 | Settlement | `setSettlementMode` | ✅ | ⏳ | ⏳ | chưa contract nào có cờ tất toán đúng nghĩa (mục 5, câu hỏi 3) |
| 14 | Settlement | `isSettlementMode` | ✅ | ⏳ | ⏳ | như trên |
| 15 | Settlement | `setNavRate` | ✅ | ⏳ | ⏳ | chưa rõ NAV có phải `Redemption.rate` (mục 5, câu hỏi 4) |
| 16 | Settlement | `navRate` | ✅ | ⏳ | ⏳ | như trên |

**Tổng: mock 16/16 · evm 6/16 · stellar 0/16 (đúng chủ đích, Phase 7).**

Nợ này đã ghi vào `docs/tech-report.md` mục 1.6.C ở mức **P1**.

## 3. Bảng ràng buộc mock: từng dòng ở `design.md` mục 3

| Tình huống | Mock phải | Test | Tên test |
|---|---|---|---|
| Phát hành lần hai | từ chối | ✅ | `CHẶN phát hành lần hai và không làm phình tổng cung` |
| Khớp lệnh khi nhà đầu tư thiếu VNDB | từ chối, không chuyển WPT | ✅ | `CHẶN khớp lệnh khi nhà đầu tư thiếu VNDB, và KHÔNG chuyển WPT` |
| Khớp lệnh khi thiếu ủy quyền | từ chối | ✅ | `CHẶN khớp lệnh khi thiếu ủy quyền VNDB dù số dư đủ` |
| Khớp lệnh khi ví SPV thiếu WPT | từ chối, không trừ VNDB | ✅ | `CHẶN khớp lệnh khi ví SPV thiếu WPT, và KHÔNG trừ VNDB` |
| Chuyển nhượng khi đang tất toán | từ chối | ✅ | `đang tất toán thì chuyển nhượng bị chặn, đốt vẫn chạy` |
| Đốt khi đang tất toán | cho phép | ✅ | cùng test trên (nửa sau) |
| Chia khi ví lợi nhuận thiếu tiền | từ chối trước khi chuyển cho ai | ✅ | `CHẶN chia khi quỹ thiếu tiền, TRƯỚC khi chuyển cho bất kỳ ai` |
| Đọc số dư tại mã snapshot không tồn tại | từ chối với lý do rõ | ✅ | `CHẶN đọc tại mã snapshot không tồn tại, lý do nêu mã hợp lệ hiện có` |
| Số lượng bằng 0 hoặc âm | từ chối, dùng `assertPositiveAmount` | ✅ | 5 test: `mintInitialSupply`, `quotePurchase`, `executePurchase`, `canTransfer`, `setNavRate` |

Ba test riêng theo `tasks.md` mục 4.2–4.4:

| Yêu cầu | Test |
|---|---|
| 4.2 khớp lệnh thất bại thì **không** bên nào đổi số dư | `khớp lệnh thất bại thì KHÔNG bên nào đổi số dư (WPT lẫn VNDB)` — so sánh cả 6 đại lượng trước/sau bằng một `toEqual` |
| 4.3 mua WPT sau khi chốt quyền thì `balanceOfAt` mã cũ không đổi | `mua WPT sau khi chốt quyền thì balanceOfAt ở mã snapshot cũ KHÔNG đổi` |
| 4.4 đang tất toán: chặn chuyển nhượng, cho đốt | `đang tất toán thì chuyển nhượng bị chặn, đốt vẫn chạy` |

**Mọi ca từ chối đều kiểm luôn "trạng thái không đổi"**, không chỉ kiểm có ném lỗi — vì lỗi vẫn ném mà số dư đã bị trừ mới là hỏng thật.

### 3.1. Chứng minh test không rỗng (đột biến trên mock)

Test xanh không chứng minh được gì nếu nó xanh cả khi ràng buộc bị bỏ. Đã thử ba đột biến, khôi phục nguyên trạng sau mỗi lần (`git status` sạch):

| Đột biến | Kết quả |
|---|---|
| Bỏ `requireNotSettling('transfer')` | **2 test đỏ** (46 passed) |
| Trừ VNDB **trước** khi kiểm tồn WPT của ví SPV | **2 test đỏ** (46 passed) |
| Cho phép phát hành lần hai (`if (s.initialSupplyMinted && false)`) | **1 test đỏ** (47 passed) |

## 4. Đối chiếu DoD

### 4.1. DoD ở `requirements.md` mục 5

| DoD | Đạt? | Bằng chứng |
|---|---|---|
| Mọi method mới có ở cả ba adapter | ✅ | Typecheck sạch. TypeScript bắt buộc: thiếu một method là `TS2740`, không thể lọt |
| `mock.adapter` từ chối đúng mọi ca hợp đồng thật từ chối, có test từng ca | ✅ | Bảng mục 3, 9/9 dòng có test; đột biến mục 3.1 chứng minh test bắt được |
| `stellar.adapter` ném lỗi rõ ràng, không trả giá trị giả | ✅ | 16/16 method ném `LedgerNotImplementedError`; không method nào có `return 0n`/`false`/`[]` |
| Không có kiểu `viem` lọt ra interface | ✅ | `ledger.port.ts` không `import` gì từ `viem`; địa chỉ là `string`, số lượng là `bigint` |
| `grep -rnE "from '(viem\|ethers)'" app/src/ \| grep -v "src/lib/"` rỗng | ✅ | Đã chạy, rỗng. `verify-arch-rules.sh` cũng PASS mục này |
| Test mock ledger mở rộng, phủ toàn bộ method mới | ✅ | 11 → 48 test |
| `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | 6/6 PASS, 0 FAIL — nguyên văn ở mục 5 |
| `tech-report.md` mục 3.1 cập nhật bảng method | ✅ | Bảng 27 method / 7 nhóm + cột trạng thái từng adapter |

### 4.2. DoD theo yêu cầu chức năng

| Yêu cầu | Đạt? | Ghi chú |
|---|---|---|
| R1 phát hành một lần | ✅ | `mintInitialSupply` + `isInitialSupplyMinted`; lần hai bị từ chối (R1.3) |
| R2 khớp lệnh | ✅ mock / ⏳ evm | 4 method; `quotePurchase` chỉ nhân giá, **không** gọi nguồn tỷ giá nào (R2.6) |
| R3 kiểm trước khi gửi | ✅ | `canTransfer` trả `TransferCheck` có lý do tiếng Việt; hàm đọc, không tốn phí (R3.2) |
| R4 chốt quyền | ✅ | `takeSnapshot`/`balanceOfAt`/`totalSupplyAt`. **Không có** method liệt kê người nắm giữ (R4.4) — lý do viết ngay trong `ledger.port.ts`, `tech-report.md` 3.1 và `lessons.md` |
| R5 chia lợi nhuận | ✅ mock / ⏳ evm | `distributeBatch` nhận sẵn danh sách ví, **không** tự chia lô (R5.3) |
| R6 tất toán | ✅ mock / ⏳ evm | Dùng `burn` đã có, không thêm method đốt mới (R6.4) |
| R7 hiện thực ở ba adapter | ⚠️ | mock 16/16, stellar 16/16 ném lỗi, evm 6/16 — theo `design.md` mục 5. Xem mục 6 |
| R8 ranh giới kiến trúc | ✅ | `viem` chỉ trong `lib/`; ABI và địa chỉ chỉ ở `packages/shared`; không kiểu `viem` ở biên interface |

## 5. Cách chạy / kiểm thử

```bash
# Toàn bộ kiểm chứng cục bộ (không cần mạng, không cần node)
bash scripts/run-local-all.sh

# Chỉ test mock ledger (48 test phủ bảng ràng buộc)
cd app && npx vitest --run test/mock-ledger.test.ts

# DoD R8 — phải rỗng
grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"

# Nghiệm thu evm.adapter trên hardhat-local (xem mục 5.2)
cd packages/contracts-evm && npx hardhat node          # cửa sổ 1
npx hardhat run scripts/deploy.js --network localhost   # cửa sổ 2
```

### 5.1. `run-local-all.sh` — kết quả nguyên văn

```
  PASS  viem/ethers không xuất hiện ngoài app/src/lib
  PASS  @stellar/stellar-sdk không xuất hiện ngoài app/src/lib
  PASS  Không có lời gọi contract trực tiếp trong components/ và app/
  PASS  SERVER_SIGNER_PRIVATE_KEY chỉ đọc ở env.ts và server.signer.ts
  PASS  Không có app/.env trong cây làm việc
  PASS  Không có private key dạng hex 64 ký tự nhúng trong mã nguồn
  PASS  Không có so sánh role cứng ngoài lib/rbac
  PASS  actions/bank.ts có 5 server action (guard nằm ở tầng service, xem lớp 1)
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
  => ĐẠT nhưng có 6 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc
  67 passing (893ms)
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
  => PASS: LỚP 1 - SPEC TEST CONTRACT SOROBAN
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
 Test Files  7 passed (7)
      Tests  91 passed (91)
  => PASS: APP - VITEST
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ. Bước tiếp: nghiệm thu DoD trên testnet.
```

**6 cảnh báo đều có trước BE-01, không do nhánh này sinh ra:** `process.env.SIGNER_KIND` đọc ở `lib/signer/index.ts`, hai địa chỉ ví mẫu trong placeholder của `mint.tsx`, `BASE_REF` chưa đặt, và ba spec Stellar chưa tới lượt làm.

Đã kiểm riêng là nhánh này **không sửa contract**:

```
$ BASE_REF=origin/dev bash scripts/verify-arch-rules.sh
  PASS  Contract không bị sửa so với origin/dev
```

### 5.2. Nghiệm thu `evm.adapter` trên hardhat-local (bước 6.6)

Chạy bằng một test tạm trên node hardhat có contract đã deploy, **8/8 mục đạt**. Test tạm **đã xoá** sau khi lấy kết quả (giữ lại sẽ làm `run-local-all.sh` đỏ khi không có node chạy). Kết quả nguyên văn:

```
  balanceOf(INVESTOR) = 100n
  canTransfer(hợp lệ)      = {"allowed":true}
  canTransfer(chưa KYC)    = {"allowed":false,"reason":"Bên nhận chưa KYC/whitelist: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"}
  canTransfer(thiếu số dư) = {"allowed":false,"reason":"Số dư WPT không đủ: cần 10000, ví 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 chỉ có 100."}
  takeSnapshot -> CONFIRMED snapshotId = 1
  balanceOfAt(1) = 100n  totalSupplyAt(1) = 100n
  sau khi mint thêm 50: balanceOf = 150n nhưng balanceOfAt vẫn = 100n
  takeSnapshot lần 2 -> snapshotId = 2
  lý do mã 9999: Mã snapshot chưa tồn tại trên chuỗi. Mã phải lấy từ kết quả takeSnapshot().
  paymentBalanceOf(BANK) = 0n  profitPoolBalance() = 0n
  mint ví chưa KYC -> Không phát hành được cho ví chưa KYC/whitelist.
  mint bằng ví thiếu role -> Ví ký giao dịch không có quyền on-chain cho thao tác này (thiếu role).
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

10 method còn nợ đều ném `LedgerNotImplementedError` với gợi ý nêu đúng thứ đang thiếu, ví dụ:

```
  executePurchase: "executePurchase" chưa hiện thực cho chain "hardhat-local".
    Chờ hợp đồng khớp lệnh (SC-03). Hiện dùng chain "mock" để phát triển;
    xem docs/CHECKPOINT_BE01.md mục nợ.
```

`addresses.json` bị deploy script ghi lại timestamp trong lúc nghiệm thu; đã `git checkout` trả về nguyên trạng (địa chỉ hardhat-local là tất định nên không đổi).

## 6. DEVIATION so với spec

### D1. Hiện thực 6/16 method ở `evm.adapter` thay vì bỏ qua cả bước 6

`tasks.md` bước 6 nói: nếu SC-02 và SC-03 chưa merge vào `dev` thì **bỏ qua bước này**, để `evm.adapter` ném `LedgerNotImplementedError` tạm thời.

**Đã kiểm: SC-02 và SC-03 chưa có trên `dev`.** `git grep` toàn repo cho `mintInitialSupply`, `executePurchase`, `PrimarySale`, `PurchaseMatcher`, `settlementMode`, `navRate` — không kết quả. Contract hiện có chỉ gồm `ProjectToken`, `VNDToken`, `ProfitDistributor`, `ProfitDistributorOracle`, `Redemption`, `EnergyOracle`. Cũng không có spec `docs/sc-02*` hay `docs/sc-03*`.

**Làm khác:** hiện thực 6 method **không cần contract mới**, vì `ProjectToken` và `VNDToken` đã có sẵn đủ hàm và đã deploy: `canTransfer`, `takeSnapshot`, `balanceOfAt`, `totalSupplyAt`, `paymentBalanceOf`, `profitPoolBalance`.

**Lý do:**

1. `requirements.md` R7.1 nói *mọi* method mới phải có hiện thực ở cả ba adapter. Ném lỗi ở những method mà contract đã hỗ trợ là tạo nợ giả — BE-06 sẽ bị chặn trên `hardhat-local` mà không có nguyên nhân kỹ thuật nào.
2. Mục đích của lối đi tắt ở `design.md` mục 5 là "cho các task khác bắt đầu được ngay". Sáu method này không chờ gì cả, hiện thực chúng đúng theo mục đích đó.
3. Không có phần nào phải đoán: mỗi method ánh xạ 1–1 vào một hàm đã tồn tại trong contract, và đã nghiệm thu trên hardhat-local (mục 5.2).

**Nếu Supervisor không đồng ý:** đổi 6 method này sang `pendingContract(...)` là việc một chỗ trong `evm.adapter.ts`, không ảnh hưởng mock/stellar/test.

### D2. Không thêm tên contract mới vào `CONTRACT_NAMES` / `addresses.json`

`tasks.md` bước 5.2: "Thêm địa chỉ hợp đồng mới vào `addresses.ts`, giữ quy tắc biến môi trường thắng tệp."

**Đã kiểm:** `CONTRACT_NAMES` đã có đủ 4 contract đang tồn tại (`ProjectToken`, `VNDToken`, `ProfitDistributor`, `Redemption`), và `addresses.json` đã có địa chỉ của cả 4 cho cả `hardhat-local` và `evm`. **Không có contract mới nào để thêm địa chỉ**, vì contract khớp lệnh (SC-03) chưa tồn tại.

**Làm khác:** không thêm gì. Thêm một tên đoán trước (ví dụ `PrimarySale`) sẽ tạo một mục mà `getContractAddress` luôn ném lỗi, `deploy.js` không bao giờ ghi vào, và phải đổi tên lại nếu SC-03 đặt tên khác.

Quy tắc "env thắng file" giữ nguyên, đã kiểm: `addresses.ts:45` vẫn là `readEnv(envKey(chain, contract)) ?? addressBook[chain]?.contracts?.[contract]`. Khi SC-03 xong, thêm địa chỉ chỉ cần một dòng trong `CONTRACT_NAMES` — quy ước biến môi trường tự áp dụng, không phải sửa gì thêm.

### D3. Bước 5.1 làm một phần: thêm ABI ví lợi nhuận, chưa thêm ABI hợp đồng khớp lệnh

`tasks.md` bước 5.1: "Thêm mô tả giao diện hợp đồng khớp lệnh và ví chia lợi nhuận vào `src/abi/`."

- **Ví chia lợi nhuận: đã làm.** Thêm `profit-distributor.ts` và `redemption.ts`, cả hai dựng từ contract thật và được `abi-contract-sync.test.ts` đối chiếu với artifact.
- **Hợp đồng khớp lệnh: chưa làm.** Contract chưa tồn tại nên mọi chữ ký viết ra đều là phỏng đoán, không đối chiếu được với artifact nào, và sẽ phải viết lại khi SC-03 xong. Repo này có quy ước "ABI tối giản luôn được đối chiếu với artifact thật"; một ABI không có artifact sẽ phá quy ước đó và trở thành nguồn sự thật giả.

### D4. Sửa một lỗi sẵn có ngoài phạm vi giao việc

Trong lúc nghiệm thu bước 6.6 phát hiện `fail()` trong `evm.adapter` đọc revert reason **sai thứ tự**, làm mất sạch lý do của mọi lỗi tuân thủ. Chi tiết ở mục 7.2. Đã sửa vì `tasks.md` bước 6.3 yêu cầu "bổ sung mã lỗi mới vào `fail()` để dịch thành câu tiếng Việt đọc được" — không sửa thứ tự thì bảng dịch mới thêm vào cũng không bao giờ được dùng tới.

## 7. Sai lệch phát hiện được

### 7.1. `design.md` nói 17 method, thực tế danh sách chữ ký có 16

`design.md` QĐ-1 viết "Thêm 17 method thì `ILedgerPort` lên khoảng 28 method". Đếm lại danh sách chữ ký cụ thể ở `design.md` mục 2:

| Nhóm | Số method |
|---|---|
| Phát hành một lần | 2 |
| Khớp lệnh mua | 4 |
| Kiểm tra trước | 1 |
| Chốt quyền | 3 |
| Chia lợi nhuận | 2 |
| Tất toán | 4 |
| **Tổng** | **16** |

Vậy `ILedgerPort` là **11 + 16 = 27** method, không phải 28. Đã theo danh sách chữ ký (thứ cụ thể, kiểm chứng được) và **không** tự thêm method thứ 17 cho khớp con số. `tasks.md` các bước 1.4, 3.1, 6.1 cũng nói "17" — đề nghị Supervisor sửa spec cho khớp.

### 7.2. Lỗi sẵn có trên `dev`: mọi revert reason của contract đều hiện thành "Contract từ chối: Error"

**Triệu chứng.** `fail()` trong `evm.adapter` (đã có trước BE-01) đọc:

```ts
const reason = reverted.data?.errorName ?? reverted.reason ?? reverted.shortMessage;
```

**Nguyên nhân.** Đo thật trên hardhat-local với contract đã deploy:

| Dạng revert | `data.errorName` | `reason` |
|---|---|---|
| `require(cond, "phat hanh cho vi chua KYC")` | `"Error"` | `"phat hanh cho vi chua KYC"` |
| `require(cond, "Snapshot: id chua ton tai")` | `"Error"` | `"Snapshot: id chua ton tai"` |
| Custom error `AccessControlUnauthorizedAccount` | `undefined` (ABI thiếu mục `error`) | `undefined` |

`Error(string)` là error **dựng sẵn** của Solidity, nên viem đặt `data.errorName = "Error"` và để chuỗi thật ở `reason`. Ưu tiên `errorName` khiến **mọi** lỗi tuân thủ ra đúng một câu vô nghĩa: `Contract từ chối: Error`. Đây là đường lỗi mà người dùng ngân hàng gặp thường xuyên nhất khi mint (chưa KYC, ví bị băng, token đang tạm dừng), và nó chưa từng hoạt động.

Custom error thì hỏng theo cách khác: ABI tối giản chỉ có `function` và `event`, không có mục `error`, nên viem không giải mã được và chỉ trả 4 byte selector → message thành `The contract function "mint" reverted with the following signature: 0xe2517d3f`.

**Đã sửa.** Thứ tự đúng là `reason` → `data.errorName` → `signature`, cộng bảng `REVERT_MESSAGES` dịch sang tiếng Việt có dấu, cộng mục `error` của OZ v5 trong cả 4 ABI. Kết quả đo lại:

| Trước | Sau |
|---|---|
| `Contract từ chối: Error` | `Không phát hành được cho ví chưa KYC/whitelist.` |
| `...reverted with the following signature: 0xe2517d3f` | `Ví ký giao dịch không có quyền on-chain cho thao tác này (thiếu role).` |

### 7.3. `tech-report-maintenance.md` trỏ sai đường dẫn tài liệu

Dòng đầu ghi *"Tài liệu được duy trì: `.kiro/steering/tech-report.md`"*, nhưng file thật là `docs/tech-report.md` (`.kiro/steering/` không có `tech-report.md`). Đã cập nhật đúng file thật. **Chưa sửa** đường dẫn trong `tech-report-maintenance.md` vì đó là tài liệu quy trình của Supervisor — đề nghị Supervisor sửa một dòng.

## 8. Câu hỏi mở

### Câu hỏi 1 — `seedMockLedger()` có phải chỗ đúng để nạp VNDB và mức ủy quyền?

`ILedgerPort` chỉ **đọc** VNDB (`paymentBalanceOf`), mức ủy quyền (`paymentAllowanceOf`) và quỹ lợi nhuận (`profitPoolBalance`) — không có method nào tạo ra chúng, và theo phạm vi BE-01 thì cũng không nên có. Nhưng mock cần một đường nạp, nếu không thì không test được và demo `mock` không chạy được luồng mua.

Đã thêm `seedMockLedger()` trong `mock.adapter.ts`, ghi rõ "chỉ cho test/demo, không gọi từ nghiệp vụ", và **không** đưa vào `ILedgerPort`.

Hai cách hiểu:
- **(a)** Đúng như đang làm: nạp là việc của test/demo runner; ở chain thật `VNDToken.mint` và `approve` lo phần này.
- **(b)** BE-02 sẽ cần phát hành VNDB cho nhà đầu tư trong demo `mock`, nên `ILedgerPort` phải có `mintPayment`/`approvePayment`.

**Đề nghị (a)**, để BE-02 quyết khi biết rõ luồng nạp tiền. Nếu chọn (b) thì phải sửa interface — đúng thứ task này muốn tránh làm hai lần, nên cần chốt sớm.

### Câu hỏi 2 — `distributeBatch(snapshotId, wallets)`: ai giữ mapping sang `distributionId`?

`ProfitDistributor.distributeTo(id, accounts)` nhận **`distributionId`**, không nhận `snapshotId`: một kỳ chia gắn với một snapshot **và** một số tiền đã chốt (`createDistribution` chốt cả hai trong một tx). Chữ ký `ILedgerPort` chỉ có `snapshotId`.

Ba cách:
- **(a)** Nghiệp vụ (BE-06) đọc event `DistributionCreated` rồi lưu mapping `snapshotId → distributionId` vào cơ sở dữ liệu, truyền `snapshotId` xuống, adapter tra mapping qua một cổng khác.
- **(b)** Đổi chữ ký thành `distributeBatch(distributionId, wallets)` — sát contract hơn nhưng lộ khái niệm riêng của EVM ra interface, mock/stellar phải bắt chước.
- **(c)** Adapter tự dò bằng cách quét `distributions(i)` tìm `snapshotId` khớp.

**Đề nghị (a)**, và đây là lý do `evm.adapter.distributeBatch` đang ném lỗi. **(c) là sai** — nhét logic nghiệp vụ vào tầng chuyển đổi, tốn N lời gọi RPC, và đúng thứ `tasks.md` cấm.

Trong mock đã dựng theo (a): `takeSnapshot()` chốt luôn quỹ chia của kỳ (= số dư ví lợi nhuận tại thời điểm chốt), nên mã snapshot là đủ để tra. Nếu Supervisor chọn (b) thì mock phải sửa theo.

### Câu hỏi 3 — "giai đoạn tất toán" nối vào contract nào?

R6.3 yêu cầu: bật tất toán thì **chuyển nhượng thông thường phải thất bại, `burn` phải hoạt động**. Không contract nào đang phơi ra cờ tất toán riêng. Hai ứng viên:

- **`ProjectToken.paused`** — khớp R6.3 **chính xác**: `_update` chặn mọi chuyển nhượng khi `paused`, còn `agentBurn` đặt `_forcedMove = true` nên bỏ qua kiểm tra và vẫn đốt được. Nhưng `paused` mang nghĩa "tạm dừng toàn hệ khi có sự cố", trộn hai khái niệm vào một cờ sẽ làm audit không phân biệt được "dừng vì sự cố" với "dừng vì đang tất toán".
- **`Redemption.paused`** — **ngược hướng**: `true` nghĩa là *tắt* hoàn vốn, tức bật cờ này lại chặn đúng việc cần làm khi tất toán.

**Đề nghị:** thêm cờ `settlementMode` riêng vào `ProjectToken` ở SC-02, tách khỏi `paused`. Chưa có xác nhận nên `evm.adapter` đang ném lỗi thay vì chọn bừa — nối sai cho ra hệ thống chạy được nhưng **làm ngược**, và không ai phát hiện tới lúc chạy thật.

### Câu hỏi 4 — `navRate` có phải là `Redemption.rate`?

`Redemption.rate` là "số VNDB trả cho mỗi 1 WPT khi hoàn vốn", đọc lên giống NAV. Nhưng:
- `rate` dùng cho hoàn vốn lẻ trong lúc dự án **đang chạy**, còn NAV là giá chốt khi **tất toán** toàn bộ. Nhập hai giá vào một biến là mất khả năng đặt giá tất toán khác giá hoàn vốn.
- `Redemption.setRate` yêu cầu `MANAGER_ROLE`; chưa rõ vai đặt NAV có phải cùng vai đó.

**Đề nghị:** giữ tách, đặt NAV ở contract tất toán của SC-02. Chờ xác nhận.

### Câu hỏi 5 — mock có nên chặn `mint` và `forcedTransfer` khi đang tất toán?

R6.3 chỉ nói "chuyển nhượng thông thường". Đã chọn:
- **Chặn:** `transfer`, `executePurchase` (đều là chuyển nhượng; mua vào lúc thanh lý là vô nghĩa).
- **Không chặn:** `burn` (R6.3 nói rõ), `forcedTransfer` (clawback là cơ chế ngoại lệ mà ngân hàng cần đúng lúc xử lý sự vụ — chặn lại là tự bịt đường thoát), `mint`/`mintInitialSupply` (spec không nêu; cố ý **không** thêm ràng buộc ngoài yêu cầu để không chặn oan BE-02…BE-07).

Nếu Supervisor muốn chặn cả `mint` khi tất toán thì nói rõ, sửa mock một dòng và thêm một test.

## 9. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`.** `grep -rnE "from '(viem|ethers)'" app/src/ | grep -v "src/lib/"` rỗng. `verify-arch-rules.sh` PASS cả ba mục của Luật 1 (viem/ethers, stellar-sdk, và không có `writeContract`/`readContract`/`simulateContract` trong `components/` hay `app/`). Không kiểu nào của `viem` xuất hiện trong chữ ký `ledger.port.ts`.
- [x] **Mọi ký qua `ISigner`.** Không sửa gì ở `lib/signer`. `evm.adapter` vẫn nhận `signer: ISigner` qua tham số và chỉ gọi `getAccount()`/`getAddress()`. `verify-arch-rules.sh` PASS: `SERVER_SIGNER_PRIVATE_KEY` chỉ đọc ở `env.ts` và `server.signer.ts`; không có private key hex 64 ký tự trong mã nguồn.
- [x] **Mọi kiểm quyền qua RBAC.** BE-01 không chạm `lib/rbac` và không thêm kiểm quyền nào ở tầng ledger (phân quyền on-chain do contract giữ, adapter chỉ dịch lỗi thiếu role thành câu đọc được). `verify-arch-rules.sh` PASS: không có so sánh role cứng ngoài `lib/rbac`.

Bổ sung — **một nguồn sự thật:** ABI và địa chỉ chỉ nằm ở `packages/shared`; `verify-arch-rules.sh` PASS "Không có ABI nhúng trong `app/src`". `abi-contract-sync.test.ts` mở rộng từ 2 lên 4 contract nên ABI tối giản mới cũng bị đối chiếu với artifact thật.

## 10. Việc còn lại cho task sau

| Việc | Chờ | Thuộc |
|---|---|---|
| `evm.adapter`: `mintInitialSupply`, `isInitialSupplyMinted` | contract phát hành một lần | SC-02 |
| `evm.adapter`: `quotePurchase`, `paymentAllowanceOf`, `executePurchase` | contract khớp lệnh | SC-03 |
| `evm.adapter`: `setSettlementMode`, `isSettlementMode`, `setNavRate`, `navRate` | trả lời câu hỏi 3 và 4 | SC-02 |
| `evm.adapter`: `distributeBatch` | trả lời câu hỏi 2 | BE-06 |
| `stellar.adapter`: hiện thực thật | contract Soroban | Phase 7 |
| Thêm địa chỉ contract khớp lệnh vào `CONTRACT_NAMES` | SC-03 xong | SC-03 |

Khi contract xong, bổ sung `evm.adapter` trong **commit riêng** theo `design.md` mục 5 điểm 5.
