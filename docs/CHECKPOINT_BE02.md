# Báo cáo bàn giao — BE-02: Quản lý lệnh mua WPT

| | |
|---|---|
| Nhánh | `feat/purchase-orders`, tạo từ `dev` @ `fdb7b55` |
| Spec giao việc | `docs/be-02-purchase-orders/` |
| Spec Kiro làm việc | `.kiro/specs/be-02-purchase-orders/` |
| Số commit | 10, mỗi bước một commit |
| Kiểm chứng cục bộ | `bash scripts/run-local-all.sh` → **ĐẠT 6/6**, 176 test |

---

## 1. Đã làm

Nghiệp vụ lệnh mua WPT: nhà đầu tư đặt lệnh → hệ thống kiểm số dư VNDB, ủy quyền, tồn WPT →
chuyển VNDB và chuyển WPT trong **cùng một** giao dịch.

| Commit | Nội dung |
|---|---|
| `2098763` | Mô hình trạng thái lệnh mua (7 trạng thái) + 19 test |
| `377ed2f` | 4 schema, 5 mã lỗi, 5 quyền `order:*` |
| `f3e06aa` | `IOrderStore` + bản bộ nhớ + bản Postgres + `PurchaseOrder` |
| `8d28c9d` | `ILedgerPort.spvWallet()` trên cả 3 adapter |
| `ab09c9d` | `placeOrder` |
| `55850e0` | `executeOrder` theo đúng 11 bước |
| `50fbdb1` | `listOrders` + `expireStaleOrders` |
| `a1887b3` | Server action + route handler |
| `8f42f69` | **Sửa lỗi cũ**: `amountSchema` ném `SyntaxError` thô (ảnh hưởng cả mint) |
| `59ad280` | 32 test nghiệp vụ |

24 file thay đổi, không file nào trong `components/` (BE-02 không làm giao diện).

### Sơ đồ trạng thái cuối cùng đã hiện thực

```
PLACED ──► CHECKING ──► EXECUTING ──► COMPLETED
   │           │            │
   │           │            └──► FAILED
   │           └──► REJECTED
   └──► EXPIRED
```

Đúng bảng của `design.md` mục 1, không thêm không bớt. 6 cặp chuyển tiếp hợp lệ trên tổng 49
cặp có thể; 43 cặp còn lại bị từ chối, có test đếm lại con số này.

**Không có trạng thái "đã trả tiền nhưng chưa nhận token".** Được chốt bằng máy kiểm
(`findPaidPendingDeliveryStatuses()`) chứ không bằng ghi chú: thêm một trạng thái tên
`PAID_*`/`AWAITING_TOKEN`/`PENDING_DELIVERY`/`*PARTIAL*` sẽ làm `purchase-state.test.ts` đỏ ngay.

Ba tính chất được chứng minh bằng test, không bằng hình vẽ:
- **Một chiều:** mọi chuyển tiếp hợp lệ đều tăng `ORDER_RANK`.
- **Trạng thái kết thúc suy ra từ bảng**, không khai lại — khai hai chỗ thì sửa một chỗ sẽ để
  lệnh treo mãi trong hàng đợi BE-07.
- **`EXECUTABLE_ORDER_STATUSES` không chứa `EXECUTING`** — chạy lại từ đó là nguy cơ gửi hai lần.

---

## 2. Đối chiếu DoD

| # | DoD (`requirements.md` mục 5) | Đạt? | Bằng chứng |
|---|---|---|---|
| 1 | Đặt lệnh, tính đúng số VNDB phải trả | ✅ | test `placeOrder` kiểm `vndAmount === 7 × 100.000` |
| 2 | Thiếu số dư / ủy quyền / tồn WPT → từ chối **trước khi** gửi tx | ✅ | 3 test, mỗi test kiểm cả `sendCount === 0` và số dư không đổi |
| 3 | Khớp thành công: WPT tăng đúng, VNDB giảm đúng | ✅ | kiểm cả **bốn** số dư (WPT + VNDB của cả hai bên) |
| 4 | Khớp thất bại: **không bên nào** đổi số dư | ✅ | 2 test: lỗi khi gửi, và biên nhận FAILED |
| 5 | Gọi khớp hai lần chỉ gửi **một** giao dịch | ✅ | 2 test: tuần tự và `Promise.all` đồng thời, đếm `sendCount === 1` |
| 6 | Chuyển trạng thái sai bị từ chối, có test | ✅ | `purchase-state.test.ts` 19 test |
| 7 | Nhà đầu tư không xem được lệnh của ví khác, có test | ⚠️ **Một phần** | Đạt "không lẫn ví khác" + thiếu ví là lỗi validate. **Không** ràng buộc được ví ↔ phiên — xem câu hỏi mở (c) |
| 8 | Sổ kiểm toán có bản ghi cho cả lần bị chặn | ✅ | test đếm 3 bản ghi DENIED cho `order:place` và 3 cho `order:execute` |
| 9 | `bash scripts/run-local-all.sh` xanh toàn bộ | ✅ | 6/6, log nguyên văn ở mục 3 |

### Bảng 9 ca kiểm thử ở bước 7

| Ca | Yêu cầu | Số test | Trạng thái |
|---|---|---|---|
| 7.1 | `test/purchase-service.test.ts` chạy với mock adapter | — | ✅ 32 test |
| 7.2 | Thiếu số dư VNDB → `REJECTED`, không gửi tx | 1 (+1 thứ tự kiểm) | ✅ |
| 7.3 | Thiếu ủy quyền → `REJECTED` | 1 | ✅ |
| 7.4 | Ví SPV thiếu WPT → `REJECTED` | 1 (+1 chưa phát hành nguồn cung) | ✅ |
| 7.5 | Khớp thành công, số dư hai bên đổi đúng | 3 | ✅ |
| 7.6 | Khớp thất bại, không bên nào đổi số dư | 3 | ✅ |
| 7.7 | Gọi hai lần chỉ gửi một giao dịch | 4 | ✅ |
| 7.8 | Nhà đầu tư không xem lệnh ví khác | 5 | ✅ |
| 7.9 | Vai không có `order:execute` bị chặn + có audit | 2 | ✅ |
| 7.10 | `run-local-all.sh` | — | ✅ ĐẠT 6/6 |

Ba ca ngoài danh sách, thêm vì là chỗ dễ sai: **thứ tự kiểm** (thiếu cả tiền lẫn ủy quyền phải
báo thiếu tiền trước), **giá đổi giữa lúc đặt và khớp**, **khớp trên chain khác chain đã đặt**.

Nguyên tắc áp cho mọi ca từ chối: kiểm cả "**trạng thái không đổi**", không chỉ "có ném lỗi".
Riêng ba ca 7.2/7.3/7.4 còn kiểm `executePurchase` **không được gọi** — nếu chỉ kiểm mã lỗi thì
test vẫn xanh khi ai đó xoá hết bốn phép kiểm và để hợp đồng tự từ chối, tức là mất đúng mục
đích của chúng (không đốt phí).

---

## 3. Cách chạy / kiểm thử

```bash
# Toàn bộ kiểm chứng cục bộ
bash scripts/run-local-all.sh

# Chỉ nghiệp vụ lệnh mua
cd app && npx vitest --run test/purchase-state.test.ts test/purchase-service.test.ts
```

Luồng mua chạy trên chain `mock` (mặc định `USE_MOCK_DB=true`, không cần Postgres, không cần RPC).

### Kết quả nguyên văn

```
########## LỚP 3 - 3 LUẬT KIẾN TRÚC + CẤU TRÚC REPO ##########
  PASS: 20   FAIL: 0   WARN: 6
  => ĐẠT nhưng có 6 cảnh báo cần xác nhận có chủ đích.
  => PASS có cảnh báo: luật kiến trúc

########## LỚP 1 - SPEC TEST CONTRACT EVM ##########
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM

########## LỚP 1 - SPEC TEST CONTRACT SOROBAN ##########
test result: ok. 16 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s
  => PASS: LỚP 1 - SPEC TEST CONTRACT SOROBAN

########## APP - TYPECHECK ##########
> tsc --noEmit
  => PASS: APP - TYPECHECK

########## APP - LINT ##########
/Users/anbinh/workSpace/bidv-rwa-tokenize/app/src/empty.ts
  16:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export
✖ 1 problem (0 errors, 1 warning)
  => PASS: APP - LINT

########## APP - VITEST ##########
 RUN  v3.2.4 /Users/anbinh/workSpace/bidv-rwa-tokenize/app
 ✓ test/purchase-state.test.ts (19 tests) 7ms
 ✓ test/rbac.test.ts (11 tests) 4ms
 ✓ test/evm-address-env.test.ts (5 tests) 5ms
 ✓ test/abi-contract-sync.test.ts (8 tests) 6ms
 ✓ test/env-private-key.test.ts (5 tests) 35ms
 ✓ test/wallet-status.test.ts (30 tests) 37ms
 ✓ test/mock-ledger.test.ts (49 tests) 11ms
 ✓ test/receipt-timeout.test.ts (5 tests) 1ms
 ✓ test/portfolio-service.test.ts (12 tests) 7ms
 ✓ test/purchase-service.test.ts (32 tests) 14ms
 Test Files  10 passed (10)
      Tests  176 passed (176)
  => PASS: APP - VITEST

########## TỔNG KẾT ##########
  Đạt:     6
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  LỚP 1 - SPEC TEST CONTRACT SOROBAN
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0
  => ĐẠT toàn bộ kiểm chứng cục bộ.
```

**6 cảnh báo và 1 lint warning đều CÓ TỪ TRƯỚC BE-02**, đã đối chiếu từng mục: `process.env`
ở `signer/index.ts`, hai địa chỉ EVM trong `components/pages/mint.tsx`, chưa đặt `BASE_REF`,
ba spec Stellar chưa tới lượt, và `src/empty.ts`. Không mục nào liên quan tới 24 file của BE-02.

---

## 4. DEVIATION so với spec

Bốn mục. Ba mục đầu là **làm trước việc của task khác**, không phải làm khác spec — không có
chúng thì BE-02 không hiện thực được. Xin Supervisor xác nhận hình dạng để BE-08/BE-09 tiếp nhận.

### D1 — Khai trước 5 quyền `order:*` (phạm vi BE-08)

`git grep "order:place"` trên `dev` → 0 kết quả. Đã thêm vào `lib/rbac/permissions.ts`:

| Quyền | Vai được cấp | Vì sao tách như vậy |
|---|---|---|
| `order:place` | INVESTOR | |
| `order:execute` | BANK_ADMIN | **Điểm quan trọng nhất.** Giao dịch khớp lệnh do ví ngân hàng/SPV ký và chuyển WPT **ra khỏi** ví SPV. Gộp với `order:place` thì ai đặt được lệnh cũng tự khớp lệnh của mình, tức tự rút token khỏi ví SPV theo ý mình |
| `order:expire` | BANK_ADMIN | Dọn lệnh treo là thao tác ghi |
| `order:read` | cả 4 vai | |
| `order:read:all` | 3 vai ngân hàng | Thứ phân biệt R5.1 với R5.2 **mà không cần so sánh tên vai** |

`order:read` + `order:read:all` đặt trong `READ_ONLY`; đã kiểm lại cảnh báo trong
`permissions.ts` — cảnh báo đó nhắm quyền dùng làm **cổng kênh**, hai quyền này không phải.

### D2 — Khai trước bảng lệnh mua (phạm vi BE-09)

`git grep "PurchaseOrder"` trên `dev` → 0 kết quả. Đã thêm `IOrderStore` (6 method), bản bộ
nhớ, bản Postgres, model Prisma + `init.sql` (sinh lại bằng `npm run db:sql`, không viết tay).

Hai chi tiết đáng để Supervisor xem:

- **`transitionOrder` đưa điều kiện trạng thái vào chính câu `UPDATE`** và trả `null` khi không
  dòng nào khớp (QĐ-1). Bản bộ nhớ viết y hệt kể cả nhánh `null` — Node một luồng nên không bị
  chen ngang, nhưng đó là hệ quả môi trường chứ không phải thiết kế.
- **`ensurePurchaseOrderTable()`** cho volume Postgres dựng **trước** BE-02: `init.sql` chỉ chạy
  khi bảng `Txn` chưa có, nên DB cũ sẽ không bao giờ nhận bảng mới, và lỗi lộ ra là
  `relation "PurchaseOrder" does not exist` giữa lúc đặt lệnh. DDL trong hàm này **lặp lại**
  `init.sql` — món nợ có ý thức, đúng cùng lý do `migrateTimestampColumns` đang lặp kiểu cột.
  Cả hai hàm phải biến mất khi BE-09 dựng migration thật.

### D3 — Thêm `spvWallet()` vào `ILedgerPort` (phạm vi BE-01)

QĐ-2 buộc kiểm "ví SPV còn đủ WPT" bằng `balanceOf`, nhưng `ILedgerPort` **không có** đường lấy
địa chỉ ví đó: `executePurchase` biết mà không trả ra, và không có getter nào. Hai lối duy nhất:
thêm một method đọc, hoặc bỏ hẳn một trong bốn phép kiểm.

Đã kiểm lại rằng đây **không** phải lặp lại lỗi `holdersAt`: `holdersAt` bị từ chối vì ERC-20
không lưu danh sách người nắm giữ nên **không adapter nào** hiện thực đúng được. Địa chỉ ví SPV
thì hợp đồng phát hành một lần giữ, chuỗi trả lời được. mock trả từ state; evm/stellar ném
`LedgerNotImplementedError` nêu rõ chờ SC-02.

**Không** nối tạm vào ví ngân hàng đang ký: hai vai khác nhau, trong một lần dựng demo có thể
trùng nên nối tạm sẽ "chạy" và không ai phát hiện, tới lúc tách vai thì phép kiểm đo số dư ví sai.

### D4 — Sửa một lỗi có từ trước, ngoài phạm vi BE-02

`amountSchema` (dùng bởi **cả `mintTokens`**) đặt `.refine(v => BigInt(v) > 0n)` **sau**
`.regex(/^\d+$/)`. Zod 4 vẫn chạy các refine còn lại sau khi một check trước đó đã trượt, nên
`"1.5"` và `"abc"` làm `BigInt()` ném `SyntaxError` **thô** ra khỏi `safeParse`.

Vì `safeParse` được gọi **ngoài** khối `try` của mọi service, lỗi đó **không** thành `Result` mã
`VALIDATION` — nó nổ thẳng ra server action, và ở production Next che message thành "An error
occurred". Người dùng nhập `1.5` thấy một lỗi hệ thống vô nghĩa.

Sửa bằng cách đổi thứ tự: `.transform()` **trước** `.refine()`. Đã đo lại cả 6 đầu vào
(`1.5` / `abc` / `0` / `-1` / `7` / rỗng), nay đều ra `VALIDATION` hoặc parse đúng.

Đề nghị đưa vào `lessons.md` — mẫu này sẽ tái diễn ở mọi schema có refine phải chuyển đổi kiểu.

### Hai chỗ khác spec ở mức chi tiết, đã cân nhắc

- **`attachOrderTxHash()` riêng thay vì `transitionOrder(EXECUTING → EXECUTING)`**: tự chuyển về
  chính mình **không có** trong bảng chuyển tiếp. Cho phép nó thì bảng không còn là mô tả đầy đủ
  của mô hình, mà đó là giá trị duy nhất của việc tách `purchase.state.ts` ra.
- **`PRICE_CHANGED` so khớp chính xác, ngưỡng = 0**: spec nói "lệch giá quá ngưỡng". Giá bán WPT
  là tham số do ngân hàng ấn định (`issuance.ts`), không phải giá thị trường dao động, nên mọi
  thay đổi đều có chủ ý. Biên dung sai chỉ để lọc nhiễu, mà ở đây không có nhiễu — có biên thì
  chỉ tạo một dải giá mà hệ thống âm thầm thu khác số đã báo.

---

## 5. Câu hỏi mở

### (a) `canTransfer` trượt trả mã `LEDGER` → HTTP **502**, mà lẽ ra phải là 409

Phép kiểm thứ 4 là hàm **đọc**, trượt nghĩa là từ chối **trước khi** gửi giao dịch (ví bị đóng
băng, chưa KYC, đang giai đoạn tất toán). Nhưng `design.md` mục 5 chỉ cho 5 mã mới, không mã nào
tả tình huống này, nên đã dùng `LEDGER` — và `httpStatusFor.LEDGER = 502`, tức nói với người gọi
"lỗi phía trên, thử lại sau", trong khi thực tế là điều kiện người dùng phải tự sửa và gửi lại y
nguyên sẽ vẫn trượt.

**Đề xuất:** thêm mã thứ 6 `NOT_TRANSFERABLE` → 409. Không tự thêm vì spec đã chốt danh sách 5 mã.

### (b) `design.md` mục 6 đặt kiểm quyền **sau** khi đọc lệnh — rò trạng thái lệnh

Đã làm theo đúng thứ tự spec (bước 1 đọc lệnh, bước 2 kiểm quyền). Hệ quả: caller **chưa có
quyền** `order:execute` vẫn nhận về `ORDER_STATE` kèm trạng thái thật của lệnh (`"Lệnh X đang ở
trạng thái COMPLETED"`), tức dò được sự tồn tại và tiến độ của lệnh bất kỳ.

Ở PoC mức độ nhẹ, nhưng là mẫu sai nếu nhân bản sang service khác.

**Hai cách hiểu:** (1) thứ tự này có chủ ý để lệnh đã xử lý trả `ORDER_STATE` nhất quán bất kể
vai, giúp thử lại tự nhiên hơn; (2) chỉ là thứ tự liệt kê, không phải ràng buộc.

**Đề xuất:** đảo bước 1 và 2 — kiểm quyền trước, đọc lệnh sau. Chưa tự đảo vì task 4.1 ghi rõ
"theo **đúng 11 bước**".

### (c) R5.1 chỉ đạt một phần: chưa ràng buộc được ví ↔ phiên

Giống giới hạn đã ghi ở `portfolio.service.ts`: chưa có SIWE (AU-01) nên server **không biết** ví
nào thuộc phiên đăng nhập; ví chỉ tồn tại ở client qua wagmi.

Đã đạt: danh sách trả về **không lẫn** lệnh của ví khác, và vai không có `order:read:all` mà
thiếu ví thì nhận **lỗi validate** chứ không phải toàn bộ sổ lệnh.

Chưa đạt: một nhà đầu tư chủ động truyền ví người khác vào vẫn xem được lệnh của ví đó.

**Đề xuất:** đóng ở AU-01; khi có phiên mang ví, `listOrders` bỏ qua `investorWallet` từ input và
lấy từ phiên. Chữ ký hàm không phải đổi.

### (d) Luồng mua chưa chạy được trên chain thật

`quotePurchase`, `paymentAllowanceOf`, `executePurchase`, `spvWallet` đều ném
`LedgerNotImplementedError` ở `evm.adapter` — nợ SC-02 (hợp đồng phát hành một lần) và SC-03
(hợp đồng khớp lệnh), đã có từ BE-01.

Nghiệp vụ đã xong và chạy đủ trên `mock`; nối chuỗi thật **không** phải sửa service. Nhưng nghĩa
là DoD "khớp lệnh thành công thì số dư tăng đúng" chỉ được nghiệm thu trên `mock`, chưa trên
`hardhat-local`. Xin xác nhận đây là mức nghiệm thu chấp nhận được cho BE-02, hay phải chờ SC-03.

---

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **LUẬT #1 — mọi tương tác chain qua `ILedgerPort`.** `purchase.service.ts` chỉ gọi
  `getLedger(chain)`; không import `viem`. `verify-arch-rules.sh` luật #1: PASS 3/3.
- [x] **LUẬT #2 — mọi thao tác ký qua `ISigner`.** Chữ ký giao dịch nằm trong
  `ledger.executePurchase()`; service chỉ gọi `getBankSigner(chain).getAddress()` để ghi cột đối
  soát, và bọc `try/catch` trả `null` — thiếu custody **không** được làm sập một lần khớp lệnh đã
  thành công trên chuỗi. Không đọc `SERVER_SIGNER_PRIVATE_KEY` ở đâu trong 24 file.
- [x] **LUẬT #3 — mọi kiểm quyền qua RBAC.** 4 hàm nghiệp vụ đều mở đầu bằng `authorize(...)`.
  Phân biệt phạm vi đọc bằng `can(role, 'order:read:all')`, **không** so sánh tên vai.
  `git grep "authorize|assertCan|can("` trong `actions/purchase.ts` và `api/purchase/` → **0 kết
  quả**, đúng chủ đích: guard chỉ ở service nên thêm transport mới không thể lỡ mất.

### Tự kiểm "việc KHÔNG được làm"

| Điều cấm | Kiểm bằng | Kết quả |
|---|---|---|
| Trạng thái trả tiền chưa nhận token | `findPaidPendingDeliveryStatuses()` + 3 test | ✅ rỗng |
| Gọi `viem` trực tiếp | `verify-arch-rules.sh` | ✅ PASS |
| Guard quyền ở transport | `git grep` hai tệp transport | ✅ 0 |
| Tính lại số VNDB khi khớp | `runPurchaseChecks` chỉ **so sánh**; `sendAndSettle` đọc `order.vndAmount` | ✅ |
| Ghi số dư WPT vào bảng lệnh | `grep -iE "balance\|holding"` trong model `PurchaseOrder` | ✅ 0 |
| Dựng lịch tự động | `git grep -E "setInterval\|setTimeout\|cron"` trong `lib/bank/` | ✅ 0 |
| Làm giao diện | `git diff --name-only dev...HEAD \| grep components/` | ✅ 0 |
