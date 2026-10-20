# BE-13: Người bán rút VNDB từ vault qua hệ thống, Kiểm soát viên cấu hình khoá vault

| | |
|---|---|
| Nhánh | `feat/be-13-rut-vault` từ `dev` @ `15a5d9a` (FE-05 đã merge) hoặc mới hơn |
| Điểm | 10 (cấu hình khoá có khoá vận hành bền 3; lệnh rút, chống trùng, đối soát 3; mô phỏng vault trên mock, gỡ hạn mức và phí FE-21 3; RBAC đóng, tài liệu, kiểm thử chung 1) |
| Mức kiểm chứng | **Cao** (chuyển tiền ra khỏi vault) |
| Trạng thái spec | **Bản 2.1, ngày 20/10/2026** (bổ sung QĐ-C1 lịch sử cấu hình, ca 5b, theo chủ dự án khi task đang làm). **Bản 2**: chốt CH-1 đến CH-4 với chủ dự án; nhận góp ý Codex trên bản nháp 1 (mục cuối). Thay bản `docs/be-13-withdraw-service/` ngày 07/10 |
| Thứ tự | Trước FE-08; cả hai trước OP-05 |
| Căn cứ | DS-01 QĐ-5, QĐ-13 bản 5, QĐ-25, QĐ-26; chủ dự án chốt 07/10 (Người bán tự rút, không phí) và 20/10 (FIXED ưu tiên rồi PERCENT, PERCENT mặc định 20% và cấu hình được; rút phải qua hệ thống; **không sửa `SpvPaymentVault`**) |

## Mục tiêu

1. **Kiểm soát viên** cấu hình khoá vault trên app: tỷ lệ PERCENT (mặc định 20%), số khoá cố định (đặt thì ưu tiên),
   ví nhận tiền.
2. **Người bán** tạo lệnh rút VNDB ở `/seller/withdraw`; hệ thống gọi `withdraw` của vault, tiền về ví nhận. App
   **không bao giờ tự gửi lại** một lệnh; ca không xác định được thì chuyển người xem, không đoán.
3. Chain mock cư xử như chain có vault (cùng công thức khoá, cùng luồng rút), thay cho hạn mức và phí kiểu FE-21.

## Các quyết định đã chốt

| Mã | Chốt |
|---|---|
| CH-1 | Mô phỏng vault trên mock làm trong BE-13 (QĐ-G) |
| CH-2 | Mã một lần theo URD: chỉ kiểm đúng sáu chữ số, không lưu, không sinh mã; nợ P1 đóng ở AU-01 |
| CH-3 | Nhà đầu tư rút VNDB tách khỏi BE-13, làm cùng FE-23 (cần chữ ký của Nhà đầu tư trên chain thật) |
| CH-4 | Kiểm soát viên đặt ví nhận tiền trên màn cấu hình |
| 07/10 | Người bán tự rút, không qua Giao dịch viên hay Kiểm soát viên duyệt; không thu phí trong PoC |
| 20/10 | **Không sửa hợp đồng `SpvPaymentVault`**: chấp nhận cam kết "không tự gửi lại" thay cho "đúng một lần chứng minh được trên chuỗi" (QĐ-E), ghi nợ kỹ thuật |

## Quan hệ với bản 07/10 (`be-13-withdraw-service`, chưa từng giao làm)

| Nội dung bản 07/10 | Ở bản này |
|---|---|
| Người bán tự rút, không duyệt; không phí; chống trùng `clientRequestId` kiểu BE-17; một lệnh đang dở bằng ràng buộc database | **Giữ** |
| Q3: PERCENT là phần trăm **được rút** của quỹ đầu kỳ | **Bị thay** bởi DS-01 bản 2 đến 5: PERCENT là phần trăm **khoá** do hợp đồng tính |
| Địa chỉ nhận tự nhập; `evm.adapter` đặt `@blocked SC-07` | **Bị thay**: vault chỉ chuyển tới `payoutWallet`; SC-07 đã xong, nối thật |
| Nhà đầu tư rút | Tách (CH-3) |
| Khối hạn mức rút ở màn cấu hình FE-07 | **Chuyển** vào BE-13 trên `/vault`; FE-07 bỏ khối này khi làm |

## Hiện trạng đã đo (Supervisor, `dev` @ `15a5d9a`)

```bash
sed -n 106,215p packages/contracts-evm/contracts/SpvPaymentVault.sol
# UNSET khoá toàn bộ; FIXED = fixedLockAmount; PERCENT trước kỳ đầu = netProceeds x rate, sau đó percentLocked;
# setPercentRate sau kỳ đầu chỉ ghi chờ; setLockMode/setFixedLock/setPercentRate cần CONFIG_ROLE;
# setPayoutWallet cần DEFAULT_ADMIN_ROLE, ví khác 0 và đã whitelist (vault cũng đã whitelist, nên hợp đồng KHÔNG chặn
# payoutWallet == vault); withdraw(amount) cần WITHDRAWER_ROLE, chặn khi tạm dừng;
# event Withdrawn(to indexed, amount, operator indexed) KHÔNG mang mã lệnh
sed -n 21,32p app/src/lib/rbac/can.ts; grep -n "FALLBACK_ROLE: Role" app/src/lib/rbac/permissions.ts
# can(), assertCan(), permissionsOf() quy MỌI vai lạ về quyền của SELLER
grep -n "@pending BE-13" -A2 app/src/components/pages/seller-withdraw.tsx
# confirm tạo dòng TAM-n trong trình duyệt; ô "mạng" và "địa chỉ nhận" tự nhập
grep -n "withdraw_limit_mode\|withdraw_limit_value\|withdraw_fee_vnd" app/src/lib/config/issue-terms.ts
# ba khoá cấu hình FE-21: chế độ hạn mức, giá trị, phí
grep -n "export interface SellerTxnRow" -A8 app/src/lib/bank/seller.service.ts
# status kiểu OrderStatus; SELLER_TXN_TYPES chỉ BUY, SELL
sed -n 840,858p app/src/lib/ledger/mock.adapter.ts
# mock: vaultStatus() null, closeVaultPeriod từ chối
```

## Quyết định thiết kế

### QĐ-A. RBAC đóng cho vai lạ (làm trước mọi quyền ghi mới)

- `can(vai lạ, …)` trả `false`; `permissionsOf(vai lạ)` trả danh sách rỗng; `assertCan(vai lạ, …)` ném `ForbiddenError`
  ghi vai là `UNKNOWN`. Không quy vai lạ về `SELLER` hay vai thật nào khác (cả bốn vai đều đã có quyền ghi).
- Áp cùng nguyên tắc ở `config-role.ts`, `demo-payment.ts` (đang dùng `FALLBACK_ROLE`). `currentRole()` không đổi
  (thiếu cookie vẫn lấy vai mặc định của bản demo như hiện nay).
- Gỡ `FALLBACK_ROLE` nếu không còn chỗ dùng.

### QĐ-B. Quyền mới

| Quyền | Vai | Dùng cho |
|---|---|---|
| `vault:configure` | `CONTROLLER` | Lưu cấu hình khoá và ví nhận (QĐ-C) |
| `vault:withdraw` | `SELLER` | Tạo lệnh rút (QĐ-D) |
| `vault:reconcile` | `CONTROLLER` | Xử lý lệnh `NEEDS_REVIEW` (QĐ-E) |

Vai vận hành đọc lệnh rút và cấu hình bằng `vault:read` sẵn có. Không cấp quyền ghi nào khác.

### QĐ-C. Cấu hình khoá vault (Kiểm soát viên)

- Màn: mục "Cấu hình khoá" trên `/vault` (vai khác chỉ xem). Ba ô:
  - **Tỷ lệ PERCENT**: phần trăm, tối đa hai chữ số thập phân, **lớn hơn 0 và không quá 100**, đổi sang phần vạn bằng
    xử lý chuỗi (không dùng số thực). Vault đang `UNSET` thì ô điền sẵn khoá cấu hình `vault.default_percent_bps`
    (seed 2000).
  - **Số khoá cố định**: VNDB, số nguyên **lớn hơn 0**, để trống được.
  - **Ví nhận tiền**: địa chỉ hợp lệ, khác 0, **khác địa chỉ vault**, đã whitelist (kiểm trước khi gửi).
- **Quy tắc ưu tiên:** có số khoá cố định thì chế độ đích là FIXED; để trống thì PERCENT.
- **Thứ tự giao dịch theo chuyển tiếp** (máy chủ đọc trạng thái chuỗi, chỉ gửi giao dịch còn khác):

  | Từ | Đến | Thứ tự |
  |---|---|---|
  | `UNSET` | PERCENT | `setPercentRate`, rồi `setLockMode(PERCENT)` |
  | `UNSET` | FIXED | `setFixedLock`, rồi `setLockMode(FIXED)` |
  | PERCENT | FIXED | `setFixedLock`, rồi `setLockMode(FIXED)` |
  | FIXED | PERCENT | `setPercentRate` (nếu khác), rồi `setLockMode(PERCENT)`; **không** gửi `setFixedLock(0)` (giá trị cũ để yên, chế độ PERCENT không dùng nó) |
  | Giữ chế độ | Giữ chế độ | Chỉ setter của giá trị đổi |

  `setPayoutWallet` độc lập, gửi trước các bước trên. Không bao giờ có thời điểm chế độ hiện hành mang giá trị 0
  hoặc giá trị chưa lên chuỗi.
- Lỗi giữa chừng: dừng, trả danh sách bước đã xong và bước lỗi (gồm ví nhận đã đổi hay chưa); lần lưu sau đọc lại chuỗi
  và chỉ gửi phần còn thiếu.
- Sau kỳ chia đầu (`lastPeriodRef > 0`), tỷ lệ mới chỉ có hiệu lực ở lần chốt kỳ kế tiếp: màn hiện "tỷ lệ đang áp" và
  "tỷ lệ chờ áp", câu giải thích rõ.
- Mỗi giao dịch lưu `Txn` trước khi chờ biên nhận; audit ghi ai, giá trị cũ, giá trị mới, tx.
- Cổng chuỗi, nhóm `ILedgerVault`: `setVaultPercentRate`, `setVaultFixedLock`, `setVaultLockMode`,
  `setVaultPayoutWallet`.

### QĐ-C1. Lịch sử mọi lần thay đổi cấu hình vault (bổ sung bản 2.1)

Chủ dự án chốt: mọi tham số Kiểm soát viên cấu hình được phải có lịch sử cho mọi lần thay đổi. Tham số trong
`SystemConfig` đã có lịch sử tự động (`setConfig` ghi `SystemConfigHistory`, gồm `vault.default_percent_bps`). Cấu hình
vault nằm **trên hợp đồng** nên cần lịch sử riêng:

- Mục "Lịch sử cấu hình" trên `/vault` (hai vai vận hành xem), mỗi dòng một thay đổi: thời điểm (block), tham số (chế độ,
  tỷ lệ, tỷ lệ chờ áp, số cố định, ví nhận), giá trị cũ, giá trị mới, mã giao dịch, **người thao tác**.
- Nguồn sự thật là **sự kiện trên chuỗi** (`LockModeChanged`, `PercentRateSet`, `FixedLockSet`, `PayoutWalletSet`, đọc từ
  `deployBlock`); giá trị cũ suy ra từ sự kiện trước đó cùng tham số. Người thao tác lấy từ `Txn`/audit theo mã giao
  dịch; không tìm thấy thì ghi **"ngoài app"** (ví dụ chạy `vault-admin.js`), để thay đổi bằng script cũng hiện ra.
- Cổng chuỗi: `vaultConfigEvents({ fromBlock })` (mock trả từ danh sách sự kiện bền trong state).
- Phân trang, mới nhất trước.

### QĐ-D. Khoá vận hành vault bền theo chain

- Bảng mới `VaultOperationLock`: `chain` (khoá chính), `kind` (`CONFIG` hoặc `WITHDRAW`), `refId`, `acquiredAt`,
  `actor`. Lấy khoá bằng một câu `INSERT` (trùng khoá thì thua), nhả bằng `DELETE` có điều kiện theo `refId`.
- Mỗi lần lưu cấu hình và mỗi lệnh rút phải giữ khoá này trong suốt các giao dịch của nó. Vì vậy:
  - hai Kiểm soát viên lưu cùng lúc không xen kẽ giao dịch;
  - không đổi ví nhận hay khoá trong lúc một lệnh rút đang dở;
  - hai lệnh rút không cùng chạy.
- Khoá `CONFIG` treo quá thời gian chờ biên nhận của chain thì lần lưu cấu hình kế tiếp được tiếp quản (cấu hình gửi lại
  an toàn vì chỉ gửi phần còn khác). Khoá `WITHDRAW` **không** tự hết hạn: chỉ nhả khi lệnh về trạng thái cuối.
- `vault-admin.js` giữ cho trường hợp khẩn cấp; README ghi: không chạy khi app đang giữ khoá vận hành, và lệnh rút bằng
  script sẽ làm đối soát của app phải chuyển người xem.

### QĐ-E. Lệnh rút

- Bảng mới `WithdrawRequest`: `id`, `chain`, `clientRequestId`, `amount`, `purpose`, `note`, `payoutWallet` (chụp lúc
  tạo), `status`, `activeChain` (`String?` duy nhất), `claimedBlock`, `txHash`, `reason`, `createdBy`, các mốc thời gian.
  Có trong `schema.prisma`, `init.sql`, `npm run db:embed-sql`, `schemaObjectsReady`, cổng lưu trữ bộ nhớ và Postgres.
- **Một lệnh đang dở mỗi chain** bằng `activeChain`: lệnh chưa kết thúc mang `activeChain = chain`, mọi chuyển sang
  trạng thái cuối đặt `activeChain = null` trong cùng câu cập nhật. Postgres cho nhiều dòng `NULL` nhưng chỉ một dòng
  mỗi chain. Ánh xạ lỗi trùng của ràng buộc này trong `store.errors.ts`. (Cùng tác dụng với khoá QĐ-D; giữ cả hai vì
  `activeChain` là chốt chặn ở chính bảng lệnh.)
- **Chống trùng như BE-17:** duy nhất `(chain, clientRequestId)`; cùng mã cùng nội dung trả lệnh cũ, không gửi lần
  hai; cùng mã khác nội dung từ chối. `clientRequestId` sinh một lần cho mỗi lần xác nhận trên màn.
- Trạng thái (bảng chuyển tiếp trong mã):

  | Từ | Sang | Khi |
  |---|---|---|
  | (tạo) | `SENDING` | qua mọi phép kiểm, giữ được khoá QĐ-D |
  | `SENDING` | `SENT` | đã có mã giao dịch |
  | `SENDING` | `FAILED` | mô phỏng revert hoặc RPC từ chối **trước khi** gửi, chắc chắn chưa lên chuỗi |
  | `SENDING` | `NEEDS_REVIEW` | tiến trình mất mã giao dịch (xem dưới) |
  | `SENT` | `COMPLETED` | biên nhận `status = 1` **và** biên nhận chứa đúng sự kiện `Withdrawn(to = payoutWallet, amount)` |
  | `SENT` | `FAILED` | biên nhận revert |
  | `SENT` | `NEEDS_REVIEW` | biên nhận thành công nhưng không có sự kiện khớp |
  | `NEEDS_REVIEW` | `COMPLETED` / `FAILED` | Kiểm soát viên xử lý (QĐ-F) |

- **Tạo lệnh** `createWithdrawRequest({ chain, amount, purpose, note, otp, clientRequestId })`:
  1. Kiểm quyền `vault:withdraw`; kiểm `otp` đúng sáu chữ số (CH-2). Mã không lưu, không vào log, audit, lỗi.
  2. Tra `clientRequestId`.
  3. Lấy khoá QĐ-D (`WITHDRAW`); không được thì báo "vault đang có thao tác khác".
  4. Chain có vault hoặc mô phỏng vault; `amount` nguyên dương; `payoutWallet` đã đặt, khác vault; không tạm dừng;
     `amount <= withdrawable` đọc **trên chuỗi** ngay lúc này.
  5. Tạo bản ghi `SENDING` với `claimedBlock` (method cổng mới `latestBlockNumber()`).
  6. Gửi `withdraw(amount)`, lưu `txHash` (`SENT`) **trước** khi chờ biên nhận; chốt theo bảng trên; nhả khoá khi về
     trạng thái cuối.
  7. Audit cả bốn kết cục.
- **Không tự gửi lại:** app không bao giờ gửi lại một lệnh đã ở `SENDING`.
- **Mất mã giao dịch** (`SENDING` không có `txHash` sau thời gian chờ biên nhận của chain): `reconcileWithdrawRequest`
  luôn chuyển `NEEDS_REVIEW`, kèm danh sách **sự kiện ứng viên** (`Withdrawn` từ `claimedBlock` có `to`, `amount` khớp,
  `operator` là ví ký máy chủ) để Kiểm soát viên xem. **Không tự kết luận `COMPLETED`** từ bộ `to + amount + operator`:
  sự kiện không mang mã lệnh nên không chứng minh được thuộc lệnh nào (QĐ-H).
- `reconcileWithdrawRequest` chạy khi vai vận hành bấm đối soát và khi Người bán mở lại màn; idempotent (chạy nhiều lần
  không tạo thêm dòng `Txn` hay audit trùng).
- Cổng chuỗi: `withdrawFromVault(amount)`, `findVaultWithdrawals({ fromBlock, to, amount })`, `latestBlockNumber()`.

### QĐ-F. Xử lý `NEEDS_REVIEW` (Kiểm soát viên)

- `resolveWithdrawRequest({ id, outcome, txHash?, reason })`, quyền `vault:reconcile`, trên `/vault` mục "Lệnh rút cần
  xem xét":
  - `COMPLETED` cần `txHash`: máy chủ đọc biên nhận, kiểm thành công và chứa sự kiện `Withdrawn` khớp `to`, `amount`;
    mã đó chưa được gán cho lệnh rút nào khác. Đạt thì ghi `txHash`, bổ sung `Txn` và audit (idempotent).
  - `FAILED` cần `reason` (ví dụ "đã kiểm explorer, không có giao dịch").
  - Không gửi giao dịch nào ở bước này. Nhả khoá QĐ-D khi xong.

### QĐ-G. Mô phỏng vault trên chain mock (CH-1)

- **Vault mock là một địa chỉ logic riêng** (hằng số trong `packages/shared`, không phải ví nào có khoá), tồn tại ngay
  từ khi chain mock khởi tạo; Mint đầu trên mock vào địa chỉ này (cùng luật R6 như chain thật). `NB001` là **ví nhận**
  mặc định của Người bán trên mock. Ca kiểm thử khẳng định hai địa chỉ khác nhau.
- `vaultStatus()` trên mock trả trạng thái lưu trong `MockLedgerState`: chế độ, tỷ lệ, tỷ lệ chờ, số cố định,
  `netProceeds`, `lastPeriodRef`, `lastDistributedPrev`, `percentLocked`, ví nhận, tạm dừng; số dư WPT, VNDB của địa chỉ
  vault mock. Có danh sách sự kiện rút và chốt kỳ bền trong state, có số "block" tăng dần để `claimedBlock` và
  `findVaultWithdrawals` dùng được.
- **Bộ giải mã `MockLedgerState` tương thích dòng cũ** thiếu toàn bộ trường vault (dữ liệu JSONB đang có trên Neon):
  thiếu thì dựng mặc định `UNSET`, không lỗi.
- Công thức khoá và `withdrawable` là **một hàm thuần dùng chung**, theo đúng hợp đồng (làm tròn như `Math.mulDiv`);
  ca kiểm thử so với hợp đồng trên cùng bộ số.
- Mua và bán trên mock đi qua vault mock và cộng trừ `netProceeds` như `settleBuy`/`settleSell`; `closeVaultPeriod`,
  `findVaultPeriodClose`, `vaultPeriodCloses` chạy thật trên mock, nên SC-06 QĐ-G nay áp cả mock.
- Kiểm thử phải đổi theo (liệt kê từng ca trong checkpoint, không xoá ca): ít nhất `vault.test.ts` (ca "mock không có
  vault"), `distribution-service.test.ts`, `distribution-trigger.test.ts`, `sc-06-distribution-flow.test.ts`, kiểm thử
  mint mock và e2e mock dùng đích Mint là `NB001`, ca phụ thuộc số giao dịch giả.

### QĐ-H. Gỡ hạn mức và phí kiểu FE-21

- Bỏ qua ba khoá `seller.withdraw_limit_mode`, `seller.withdraw_limit_value`, `seller.withdraw_fee_vnd`: gỡ đường đọc
  (`readSellerWithdrawPolicy`, `readSellerWithdrawFee`), `computeWithdrawLimit`, phần phí trong `quoteWithdraw`, nhánh
  `source: 'config'` của `seller.service`, mọi chỗ khoá nút vì chưa cấu hình phí. Dòng cấu hình cũ trong database để yên.
- Kết quả: số nhận bằng số rút; màn hiện "Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC)".

### QĐ-I. Màn Người bán

- `/seller/withdraw`: thay thân `confirm` (marker `@pending BE-13`) bằng server action; bỏ dòng tạm, nhãn dữ liệu tạm.
  Ô "mạng" và "địa chỉ nhận" chỉ đọc (chain đang chọn, `payoutWallet`). Chưa đặt ví nhận thì khoá nút, hướng dẫn liên
  hệ Kiểm soát viên. Ô mã một lần kiểm sáu chữ số, ghi rõ "bản thử: chưa gửi mã thật".
- Bảng "Yêu cầu rút của tôi" đọc từ database theo chain, có trạng thái, số tiền, ví nhận, mã giao dịch, liên kết explorer
  chỉ trên chain thật.
- `/seller/transactions`: `SellerTxnRow` đổi thành union phân biệt theo `type`
  (`BUY`/`SELL` mang `OrderStatus`; `WITHDRAW` mang trạng thái rút). Gộp lệnh mua bán với lệnh rút, sắp theo thời điểm
  tạo giảm dần, rồi `id` để phân trang ổn định; bộ lọc trạng thái nhận đúng tập trạng thái của loại đang lọc.

### QĐ-J. Nợ kỹ thuật ghi vào `tech-report.md`

| Nợ | Nội dung | Hướng trả |
|---|---|---|
| Đúng một lần chưa chứng minh được trên chuỗi | `Withdrawn` không mang mã lệnh; mất mã giao dịch thì phải người xem | Khi có đợt sửa hợp đồng (trước production): `withdraw(requestRef, expectedPayout, amount)`, sự kiện có `requestRef`, `processedWithdrawals`, kiểm ví nhận ngay lúc thực thi |
| Mã một lần chỉ kiểm dạng (P1) | URD cho phép | AU-01 |
| Rút bằng script ngoài app | `vault-admin.js` vẫn rút được nếu có khoá | Gỡ vai rút khỏi ví dùng cho script khi có Fireblocks (IN-04) |
| Token chỉ là token thử | Không duyệt, OTP giả: chỉ chấp nhận được với tiền thử | AU-01, OTP thật trước khi dùng tiền thật |

## Ràng buộc

- **Không sửa hợp đồng.** Không đổi máy trạng thái lệnh mua bán, kỳ chia.
- Vùng mã: RBAC, cổng chuỗi nhóm vault, adapter EVM và mock, `mock-state.store`, `vault.service`, `seller.service`,
  service rút mới, lưu trữ, `vault-status.tsx`, `seller-withdraw.tsx`, `seller-transactions.tsx`, `withdraw-limit.ts`,
  `packages/shared` (địa chỉ vault mock). Không chạm màn chia lợi nhuận (FE-08).
- Không thêm thư viện. Không triển khai Sepolia. Không commit khoá riêng.
- Luật kiến trúc giữ nguyên. Checkpoint dán nguyên văn đầu ra lệnh đã chạy.

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | **RBAC đóng:** vai `UNKNOWN`, chuỗi rỗng, `null`, số, cookie hỏng: `can` sai với mọi quyền, `permissionsOf` rỗng, gọi tạo lệnh rút bị `FORBIDDEN`; chỉ `CONTROLLER` cấu hình và xử lý `NEEDS_REVIEW`; chỉ `SELLER` tạo lệnh rút |
| 2 | **Ưu tiên FIXED:** đặt số cố định thì `lockMode = FIXED`; bỏ thì về PERCENT với đúng tỷ lệ đã lưu |
| 3 | **Thứ tự theo chuyển tiếp:** đủ năm dòng của bảng QĐ-C, đọc thứ tự giao dịch thực gửi; FIXED sang PERCENT không có `setFixedLock(0)`; lỗi ở giao dịch đổi chế độ thì chế độ cũ còn nguyên, lần lưu sau chỉ gửi phần thiếu; đọc trạng thái chuỗi sau **từng** giao dịch: chế độ hiện hành không bao giờ mang giá trị 0 |
| 4 | **Kiểm đầu vào:** tỷ lệ 0, trên 100, ba chữ số thập phân, chuỗi lạ; số cố định 0 hoặc âm; ví nhận bằng 0, bằng vault, chưa whitelist: đều từ chối trước khi gửi |
| 5 | **Tỷ lệ chờ áp:** sau một lần chốt kỳ, đổi tỷ lệ thì màn hiện "chờ áp", `lockedAmount` chưa đổi; sau lần chốt kế tiếp thì áp |
| 5b | **Lịch sử cấu hình:** sau ba lần lưu (UNSET sang PERCENT 20%, đổi 25%, sang FIXED) và một lần đổi bằng `vault-admin.js`: lịch sử đủ từng thay đổi, giá trị cũ và mới đúng, người thao tác đúng, dòng script ghi "ngoài app"; chạy trên nút thật và mock |
| 6 | **Khoá vận hành:** hai lần lưu cấu hình đồng thời chỉ một bên gửi giao dịch; đang có lệnh rút dở thì lưu cấu hình bị chặn và ngược lại; khoá `CONFIG` treo quá hạn được tiếp quản; khoá `WITHDRAW` không tự hết hạn |
| 7 | **Rút trên nút Hardhat thật:** PERCENT 20%, sau một lệnh mua 100 WPT (`withdrawable = 8.000.000`), rút 3.000.000: `COMPLETED`, ví nhận tăng đúng 3.000.000, `withdrawable` giảm đúng, `Txn` và audit có dòng, khoá đã nhả |
| 8 | **Chặn trước khi gửi:** vượt `withdrawable` 1 đồng; chưa đặt ví nhận; tạm dừng; đã có lệnh dở; mã một lần sai dạng: đều từ chối, nonce ví ký không đổi, audit có dòng |
| 9 | **Chống trùng và song song:** cùng `clientRequestId` cùng nội dung trả lệnh cũ, không gửi lần hai; khác nội dung bị từ chối; hai lệnh song song (`Promise.all`) mỗi lệnh dưới `withdrawable` nhưng cộng lại vượt: đúng một lệnh được tạo; bộ ràng buộc chạy cả trên Postgres thật |
| 10 | **Mất mã giao dịch:** chặn bước lưu `txHash` sau khi gửi: đối soát chuyển `NEEDS_REVIEW` kèm đúng một sự kiện ứng viên, **không** tự `COMPLETED`, không gửi lại; lệnh mới bị chặn; Kiểm soát viên xử lý `COMPLETED` bằng mã đúng thì đạt (bổ sung `Txn`, audit đúng một lần dù xử lý gọi hai lần), bằng mã của giao dịch khác thì bị từ chối; `FAILED` cần lý do |
| 11 | **Biên nhận không có sự kiện khớp:** dựng biên nhận thành công mà không có `Withdrawn` khớp: `NEEDS_REVIEW`, không `COMPLETED` |
| 12 | **Mock:** vault mock khác `NB001`; cấu hình được trước Mint; dòng `MockLedgerState` cũ thiếu trường vault đọc được (trả `UNSET`); công thức khoá mock ra cùng số với hợp đồng trên bảng số của OP-05 (PERCENT 20%, mua 100, bán 40, chốt kỳ 1.000.000, rút 50%); rút và chốt kỳ chạy trên mock |
| 13 | **Gỡ FE-21:** ba khoá cũ có giá trị trong database không ảnh hưởng gì; màn không khoá nút vì thiếu phí; số nhận bằng số rút |
| 14 | **Danh sách giao dịch Người bán:** lệnh rút xuất hiện đúng loại, trạng thái, thứ tự; phân trang ổn định khi hai bản ghi cùng thời điểm; lọc theo trạng thái rút |
| 15 | **Màn hình:** e2e mock và e2e hardhat: Kiểm soát viên lưu cấu hình, thấy `/vault` cập nhật; Người bán tạo lệnh rút, thấy `COMPLETED` |
| 16 | **Đột biến**, dán đầu ra đỏ rồi hoàn nguyên: (a) `can` quy vai lạ về `SELLER`, ca 1 đỏ; (b) bỏ kiểm `withdrawable`, ca 8 đỏ; (c) bỏ `activeChain` ở bản bộ nhớ, ca 9 đỏ; (d) FIXED sang PERCENT gửi `setFixedLock(0)` trước, ca 3 đỏ; (e) đối soát tự `COMPLETED` khi có một sự kiện ứng viên, ca 10 đỏ; (f) bỏ khoá vận hành, ca 6 đỏ; (g) mock tính khoá theo số dư thay cho `netProceeds`, ca 12 đỏ |
| 17 | `run-local-all.sh` xanh; job A (có `trap`) xanh; **job C** xanh; kiểm thử nút thật chạy từng tệp xanh; **nâng lược đồ trên database Postgres có sẵn** (dựng theo `init.sql` của `dev`, rồi chạy nhánh) xanh; quét bí mật sạch; gỡ marker `@pending BE-13` |

Ca chạy nhiều giao dịch hoặc tua thời gian trên nút thật đặt ngưỡng thời gian riêng.

## Điều kiện hoàn thành

- [ ] QĐ-A đến QĐ-I, QĐ-C1 (ca 1 đến 15, 5b). Đột biến (ca 16). Kiểm chứng chung (ca 17).
- [ ] `tech-report.md`: RBAC đóng, cấu hình khoá và bảng chuyển tiếp, khoá vận hành, máy trạng thái rút, `NEEDS_REVIEW`,
      vault mock, gỡ FE-21, bảng nợ QĐ-J. `packages/contracts-evm/README.md`: đường chính là màn `/vault`, cảnh báo
      script. `docs/guide.md`: Kiểm soát viên cấu hình rồi Người bán rút.

## Góp ý Codex trên bản nháp 1 và cách xử lý

| # | Góp ý | Xử lý |
|---|---|---|
| 1 | "Đúng một lần" chưa chứng minh được; đề xuất sửa hợp đồng | Chủ dự án chốt **không sửa hợp đồng**; nhận phương án hạ cam kết của chính Codex (QĐ-E, QĐ-J) |
| 2 | Thứ tự cấu hình theo chuyển tiếp, kiểm đầu vào, ví nhận khác vault, khoá cấu hình bền | Nhận (QĐ-C, QĐ-D) |
| 3 | Vòng đời OTP hai bước, hộp thư mô phỏng, băm | Không còn áp dụng: CH-2 chốt theo URD, không lưu mã |
| 4 | RBAC fallback | Nhận (QĐ-A) |
| 5 | Mock trộn vault và ví nhận | Nhận phương án địa chỉ vault logic riêng (QĐ-G) |
| 6 | Ràng buộc một lệnh đang dở với Prisma | Nhận `activeChain` (QĐ-E) |
| 7 | Đối soát chặt hơn, backfill idempotent, `latestBlockNumber`, sự kiện bền trên mock, quyền riêng cho `NEEDS_REVIEW` | Nhận (QĐ-E, QĐ-F, QĐ-G) |
| 8 | Gỡ hết phí | Nhận (QĐ-H) |
| 9 | `SellerTxnRow` union | Nhận (QĐ-I) |
| 10 | Ảnh hưởng SC-06 và JSONB mock cũ | Nhận (QĐ-G) |

## Không làm

- Sửa hợp đồng. Kênh OTP thật. Phí rút. Nhà đầu tư rút VNDB và màn FE-23. Màn chia lợi nhuận (FE-08). Triển khai
  Sepolia (OP-05).
