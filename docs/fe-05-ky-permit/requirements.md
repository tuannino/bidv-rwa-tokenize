# FE-05: Nhà đầu tư ký `permit` bằng ví khi đặt lệnh trên chain thật

| | |
|---|---|
| Nhánh | `feat/fe-05-ky-permit`, từ `dev` **sau khi PR #58 (SC-06) merge** |
| Điểm | 6 (kế hoạch ghi 3; thêm cho kiểm chữ ký phía máy chủ, bỏ đường không chữ ký ở cổng công khai, sửa preview, lưu chữ ký và migration Neon, e2e có ví giả lập) |
| Mức kiểm chứng | **Cao** (chữ ký cho phép chi token của nhà đầu tư) |
| Trạng thái spec | **Bản 2, ngày 20/10/2026**: đã nhận góp ý của Codex (5 điểm bắt buộc, kết quả thử Hardhat), CH-1 đến CH-4 chốt theo mục cuối |
| Thứ tự | Sau SC-03, SC-06. Trước OP-05 |
| Căn cứ | DS-01: QĐ-10 (permit cho VNDB và WPT), QĐ-16 (giới hạn của permit); spec SC-03 QĐ-C (hệ quả nonce) |

## Mục tiêu

1. Trên chain thật (`hardhat-local`, `evm`), khi Nhà đầu tư xác nhận lệnh mua hoặc bán, ví trình duyệt ký một
   `permit` ERC-2612 **đúng bằng số của lệnh** (VNDB khi mua, WPT khi bán), không cần ETH, không cần `approve`
   trước.
2. Máy chủ **kiểm chữ ký** trước khi tạo lệnh, rồi gửi lệnh bằng `buyWithPermit` hoặc `sellWithPermit` của
   `OrderSettlement`.
3. Trên chain thật, **mọi** lệnh mới đi qua cổng công khai (server action, `POST /api/purchase`) bắt buộc có chữ
   ký. Không còn đường "đã approve sẵn nên khỏi ký" ở cổng công khai.
4. Chữ ký được lưu cùng lệnh để đường phục hồi của SC-03 dùng lại trong thời hạn; chữ ký không bao giờ ra khỏi
   máy chủ.
5. Chain mock giữ nguyên hành vi.

## Hiện trạng đã đo (Supervisor, `dev` @ `bb02cd6`, kiểm lại sau góp ý Codex)

```bash
sed -n 6,22p packages/shared/src/permit.js
# buildPermitTypedData viết cứng version: '1'; hai test hợp đồng (sc-09, sc-03) đang gọi hàm này
grep -n "'allowance'" app/src/lib/bank/purchase.service.ts
# runOrderChecks đòi ủy quyền VNDB (mua) / WPT (bán) đủ; previewPurchase dùng chung bộ kiểm này
grep -n "canConfirm" app/src/lib/bank/trade.service.ts
# previewTrade: một phép kiểm trượt thì canConfirm = false, nên ủy quyền 0 sẽ khoá nút xác nhận
grep -n "placeOrder" app/src/app/api/purchase/route.ts app/src/app/actions/purchase.ts
# hai cổng công khai cùng gọi placeOrder; investorWallet do người gọi gửi, chưa gắn với phiên (AU-01)
grep -n "ADDED_COLUMNS" -A8 app/src/lib/store/postgres.pool.ts
# database Neon đang chạy chỉ nhận cột mới qua danh sách ALTER này
grep -n "testMatch" app/playwright.config.ts
# project hardhat chỉ chạy mint, wallet-connect, chain-scope
grep -n "autoSettleCreatedOrder" app/src/lib/bank/purchase.service.ts
# placeOrder tự quyết toán ngay sau khi tạo lệnh (BE-17)
```

Codex đã thử trên nút Hardhat hiện tại: `eth_signTypedData_v4` chạy ổn, trả chữ ký 65 byte; `eth_requestAccounts`
không được hỗ trợ (mã `-32004`).

## Quyết định thiết kế

### QĐ-A. Luồng hai bước trên chain thật

1. **Chuẩn bị:** Nhà đầu tư bấm xác nhận. Trình duyệt gọi action mới `preparePermitAction({ chain, investorWallet,
   side, wptAmount })`. Máy chủ trả typed data đầy đủ (domain, types, message), `deadline`, `nonce` và số sẽ ký.
2. **Ký:** trình duyệt gọi `signTypedData` qua ví đã kết nối (wagmi), nhận chữ ký.
3. **Đặt lệnh:** trình duyệt gọi `placeOrderAction` như hiện nay, thêm trường
   `permit: { value, deadline, nonce, signature }` (ba số dạng chuỗi thập phân, chữ ký 65 byte hex). Máy chủ tách
   `v, r, s`.

- Chain mock: bỏ qua bước 1, 2; `placeOrderAction` không có `permit` (hành vi cũ). Gửi `permit` trên mock thì
  `VALIDATION`.
- Không có nút "approve" riêng. Không tự gửi giao dịch nào từ ví Nhà đầu tư.

### QĐ-B. Máy chủ dựng typed data (`preparePermit`)

- Kiểm quyền `order:place` và chain thật có `OrderSettlement` (thiếu thì lỗi cấu hình rõ ràng).
- `value`: mua là `quotePurchase(wptAmount)` hiện tại (số VNDB); bán là `wptAmount`.
- `token`: mua là `VNDToken`, bán là `ProjectToken`, lấy từ address book. `spender` = địa chỉ `OrderSettlement`.
  Không nhận ba giá trị này từ trình duyệt.
- `nonce` đọc `token.nonces(investorWallet)` trên chuỗi.
- `deadline` = timestamp của **block mới nhất** cộng `order.permit_ttl_seconds` (CH-2).
- **Domain** đọc qua hàm mới `readPermitDomain(chain, token)`:
  - gọi `token.eip712Domain()` (ERC-5267); thêm `eip712Domain` vào ABI dùng chung của hai token, kiểm đồng bộ ABI;
  - chỉ chấp nhận khuôn chuẩn đang hỗ trợ: `fields = 0x0f` (name, version, chainId, verifyingContract), `salt`
    bằng 0, `extensions` rỗng; `chainId` bằng chainId cấu hình của chain; `verifyingContract` bằng địa chỉ token
    trong address book. Lệch bất kỳ điều nào thì lỗi cấu hình "domain permit của token không đúng khuôn hỗ trợ",
    không dựng typed data;
  - **không** dùng `ProjectToken.version()` (đó là phiên bản nghiệp vụ `4.1.6-poc`, không phải version EIP-712).
- `buildPermitTypedData` trong `packages/shared` nhận thêm `version` **bắt buộc** (bỏ giá trị viết cứng `'1'`,
  thiếu thì ném lỗi). Cập nhật `permit.d.ts` và hai test hợp đồng đang gọi hàm này.
- Trả thêm `vndAmount` (mua) hoặc `wptAmount` (bán) để màn hình hiện lại số sẽ ký.

### QĐ-C. Cổng công khai trên chain thật bắt buộc có chữ ký

- `placeOrder` (service mà cả server action và `POST /api/purchase` gọi) trên chain thật **không có** `permit` thì
  trả `VALIDATION` "lệnh trên chain thật cần chữ ký ủy quyền từ ví", **không** tạo lệnh.
- Không thêm cờ, tham số hay hàm xuất khẩu nào cho phép đặt lệnh mới không chữ ký trên chain thật. Đường không
  chữ ký chỉ còn ở: adapter (`buy`/`sell`, dùng khi phục hồi lệnh cũ không có `permit`), test hợp đồng SC-03, và
  phục hồi lệnh đã tồn tại.
- Các test app SC-03 đang đặt lệnh không chữ ký trên nút Hardhat (`evm-order-settlement.test.ts`) chuyển sang ký
  bằng helper kiểm thử dùng khoá tài khoản Hardhat mặc định (khoá công khai).

### QĐ-D. Kiểm chữ ký khi đặt lệnh mới

Thứ tự trong `placeOrder` khi chain thật:

1. Kiểm khuôn `permit` bằng schema chặt (`value`, `deadline`, `nonce` là chuỗi thập phân; `signature` là `0x` cộng
   130 ký tự hex).
2. Tính **lại** số của lệnh (mua: `quotePurchase`; bán: `wptAmount`). `permit.value` khác thì `VALIDATION` "giá đã
   đổi hoặc số lệnh đã đổi, ký lại".
3. Dựng lại typed data: domain theo `readPermitDomain`, `token`/`spender` theo chiều lệnh, `owner = investorWallet`,
   `value` vừa tính, `nonce` và `deadline` **lấy từ payload** (số đã ký). Kiểm bằng `verifyTypedData` (viem). Sai thì
   `VALIDATION` "chữ ký không khớp ví hoặc nội dung lệnh, ký lại".
4. Tra `clientRequestId` như BE-17: đã có lệnh thì trả lệnh đó (gửi lại cùng một yêu cầu không bị từ chối chỉ vì
   chữ ký đã được dùng ở lần đầu).
5. `deadline` phải còn ít nhất `order.permit_min_remaining_seconds` so với timestamp block mới nhất; không thì
   `VALIDATION` "chữ ký sắp hết hạn, ký lại".
6. Đọc `nonces(investorWallet)` và ủy quyền hiện tại cho `OrderSettlement`, phân loại:

   | Nonce đã ký so với nonce hiện tại | Ủy quyền hiện tại | Kết quả |
   |---|---|---|
   | Bằng | bất kỳ | Chữ ký chưa dùng: **nhận** |
   | Nhỏ hơn | đủ số lệnh | Chữ ký đã bị gửi trước (hoặc ủy quyền đã có sẵn): **nhận** |
   | Nhỏ hơn | thiếu | Chữ ký đã cũ: `VALIDATION` "chữ ký đã được dùng, ký lại" |
   | Lớn hơn | bất kỳ | `VALIDATION` "chữ ký không hợp lệ" |

7. Chạy `runOrderChecks` với nguồn ủy quyền là "chữ ký đã kiểm" (QĐ-F): phép kiểm ủy quyền đạt theo kết quả bước 6.
8. Tạo lệnh, lưu `permit` (QĐ-E), tự quyết toán như BE-17.

### QĐ-E. Lưu chữ ký: khuôn JSON, migration, không lộ ra ngoài

- `PurchaseOrder` thêm cột `permit` kiểu `JSONB`, cho phép null (lệnh mock và lệnh cũ). Cập nhật `schema.prisma`,
  `init.sql`, `npm run db:embed-sql`, **và** thêm vào `ADDED_COLUMNS` của `postgres.pool.ts`:
  `ALTER TABLE IF EXISTS "PurchaseOrder" ADD COLUMN IF NOT EXISTS "permit" JSONB` để database Neon đang chạy nhận
  cột mới. Cổng lưu trữ bộ nhớ và Postgres đều đọc ghi trường này.
- Khuôn JSON cố định: `token`, `spender`, `r`, `s` là chuỗi hex chữ thường; `value`, `deadline`, `nonce` là chuỗi
  thập phân; `v` là số. Không lưu `bigint` trực tiếp. Khi đọc từ database, kiểm lại bằng schema rồi mới đổi sang
  `bigint`; dữ liệu hỏng thì coi như lệnh không có `permit` và ghi lỗi (không ghi nội dung chữ ký).
- Chữ ký không phải khoá riêng nhưng là **quyền chi còn hiệu lực**. Không ghi vào nhật ký kiểm toán, log, thông báo
  lỗi; không đưa vào `OrderView`, phản hồi API, dữ liệu hydrate phía client. Kiểm thử ca 10 khẳng định điều này.

### QĐ-F. Nguồn ủy quyền của bộ kiểm (`runOrderChecks`)

Bộ kiểm nhận thêm một tham số **do máy chủ tự suy ra**, không nhận từ client (schema đầu vào preview và đặt lệnh
không có trường này; client gửi kèm trường lạ thì bị loại bởi schema chặt):

| Ngữ cảnh | Nguồn ủy quyền | Phép kiểm `allowance` / `wptAllowance` |
|---|---|---|
| Mock (mọi ngữ cảnh) | Ủy quyền thực tế | Như hiện nay |
| Preview trên chain thật | "Sẽ cấp bằng chữ ký" | **Đạt**, chi tiết "sẽ cấp bằng chữ ký ví khi đặt lệnh"; không khoá `canConfirm` |
| Đặt lệnh mới trên chain thật | "Chữ ký đã kiểm" | Theo kết quả bước 6 QĐ-D |
| Quyết toán, phục hồi lệnh đã tồn tại | Chữ ký đã lưu hoặc ủy quyền thực tế | Theo QĐ-G |

Các phép kiểm khác (giá, số dư, nguồn cung, nắm giữ, thanh khoản, chuyển nhượng) giữ nguyên ở mọi ngữ cảnh. Chỉ chữ
ký đã kiểm mới thay thế ủy quyền khi đặt lệnh.

### QĐ-G. Quyết toán và phục hồi lệnh đã tồn tại

- `SettlementOrder` của cổng thêm `permit?: { value: bigint; deadline: bigint; v: number; r: Hex; s: Hex }`. Adapter
  EVM: có `permit` thì gọi `buyWithPermit` / `sellWithPermit`, không có thì `buy` / `sell`. Mock bỏ qua. Stellar
  không đổi.
- Trước khi gửi (quyết toán ngay sau đặt, hoặc gửi lại qua `CHECKING`), phép kiểm ủy quyền **đạt** khi:
  ủy quyền thực tế đủ số lệnh, **hoặc** lệnh có `permit` với nonce đã ký bằng nonce hiện tại và `deadline` còn ít
  nhất `order.permit_min_remaining_seconds` so với timestamp block mới nhất. Ngược lại báo thiếu ủy quyền, thông
  báo thêm "chữ ký ủy quyền đã hết hạn hoặc đã dùng, đặt lệnh lại để ký mới"; lệnh đi tiếp theo máy trạng thái
  SC-03 (không đổi máy trạng thái).
- Lệnh cũ không có `permit` (trước FE-05) chỉ dựa vào ủy quyền thực tế.

### QĐ-H. Hệ quả nonce (ghi rõ trên màn và trong `tech-report.md`)

- `permit` **ghi đè** mức ủy quyền, nonce dùng theo thứ tự. BE-17 tự quyết toán ngay sau khi đặt nên thường không
  có hai chữ ký chồng nhau.
- Ca hai tab, ủy quyền ban đầu bằng 0, hai lệnh ký cùng nonce N:
  - **Tuần tự** (lệnh 1 đã hoàn tất rồi mới đặt lệnh 2): lệnh 2 rơi vào dòng "nhỏ hơn, thiếu" của bước 6, trả
    `VALIDATION` "ký lại", **không tạo bản ghi**.
  - **Đồng thời** (cả hai qua bước 6 khi nonce N chưa dùng): cả hai tạo bản ghi; lệnh khớp trước tiêu chữ ký, lệnh
    sau trượt phép kiểm QĐ-G và kết thúc theo máy trạng thái SC-03 với thông báo "ký lại".
  - Cả hai trường hợp: tiền và token chỉ chuyển **một lần**. Không làm hàng đợi nonce ở FE-05.

### QĐ-I. Giao diện

- Hộp xác nhận lệnh của `investor-trade.tsx` (chain thật): "Bạn sẽ ký cho phép hệ thống chi đúng `<số>`
  `<VNDB|WPT>` cho lệnh này, hiệu lực đến `<giờ>`; không tốn phí giao dịch". Nút "Ký và đặt lệnh".
- Trạng thái nút: đang chuẩn bị, đang chờ ký trong ví, đang gửi lệnh. Người dùng từ chối ký (lỗi 4001) thì quay lại
  hộp xác nhận, thông báo "Bạn đã huỷ ký", không gửi gì.
- Ví sai mạng (khác `chainId` của domain): chặn nút, dùng lại `wrong-chain-banner` và `useWalletStatus().canSign`.
- `clientRequestId` giữ nguyên qua các lần thử lại như BE-17; ký lại không đổi `clientRequestId` của cùng một ý định.
- Không hiện chữ ký, nonce hay huy hiệu permit ở màn chi tiết lệnh trong FE-05.
- Không đổi giao diện chain mock.

### QĐ-J. Kiểm thử đầu cuối với ví giả lập

- Tệp e2e mới (ví dụ `e2e/permit-order.spec.ts`), **thêm vào `testMatch` của project `hardhat`** trong
  `playwright.config.ts`; thiếu bước này thì job C không chạy ca 11.
- `window.ethereum` giả lập:
  - `eth_requestAccounts` ánh xạ sang `eth_accounts` của nút Hardhat;
  - chỉ chuyển tiếp `eth_accounts`, `eth_chainId`, `eth_signTypedData_v4`; phương thức khác trả lỗi rõ ràng;
  - chế độ "người dùng huỷ": `eth_signTypedData_v4` trả lỗi mã `4001`.

## Cấu hình (CH-2)

| Khoá `SystemConfig` | Hằng mặc định trong mã | Giá trị | Ý nghĩa |
|---|---|---|---|
| `order.permit_ttl_seconds` | `ORDER_PERMIT_TTL_SECONDS` | 1800 | Thời hạn chữ ký tính từ timestamp block mới nhất lúc chuẩn bị |
| `order.permit_min_remaining_seconds` | `ORDER_PERMIT_MIN_REMAINING_SECONDS` | 120 | Thời gian còn lại tối thiểu khi đặt lệnh và trước khi gửi |

Khai trong `CONFIG_KEYS` theo mẫu các khoá `distribution.*`. Không dùng biến môi trường. Timestamp block lấy qua
method cổng mới `latestBlockTimestamp()` (EVM đọc block `latest`; mock trả giờ máy chủ).

## Ràng buộc

- Không sửa hợp đồng. Không đổi máy trạng thái lệnh (SC-03 đã chốt).
- Vùng mã: `investor-trade.tsx`, `purchase.service.ts`, `trade.service.ts` (chỉ phần preview), `ledger.port.ts` và
  adapter (nhóm khớp lệnh, `latestBlockTimestamp`), action `purchase.ts`, lưu trữ lệnh, ABI hai token,
  `packages/shared/src/permit.*`, `playwright.config.ts`. Giữ nguyên mọi thay đổi SC-06 ở `ledger.port.ts`,
  `evm.adapter.ts`, `.kiro/task-status.json`, `tech-report.md`.
- Không thêm thư viện. Không triển khai Sepolia. Không commit khoá riêng (khoá tài khoản Hardhat mặc định là khoá
  công khai, được phép trong kiểm thử).
- Luật kiến trúc giữ nguyên. Checkpoint dán nguyên văn đầu ra lệnh đã chạy.

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | **`preparePermit`:** mua 100 WPT giá 100.000 trả `value = 10.000.000`, `spender` = `OrderSettlement`, `verifyingContract` = `VNDToken`, `nonce` đúng `nonces(ví)`, domain khớp `eip712Domain()`, `deadline` = timestamp block mới nhất cộng 1800; bán 40 WPT trả `value = 40`, `verifyingContract` = `ProjectToken`; mock, chain thiếu `OrderSettlement`, vai không có `order:place` bị chặn |
| 1b | **`readPermitDomain`:** domain giả có `fields` khác `0x0f`, `salt` khác 0, `extensions` không rỗng, `chainId` lệch, `verifyingContract` lệch đều báo lỗi cấu hình; `buildPermitTypedData` thiếu `version` ném lỗi |
| 2 | **Kiểm chữ ký:** chữ ký đúng tạo lệnh; chữ ký của ví khác, `value` khác số lệnh, `nonce` trong payload khác nonce đã ký, `deadline` khác số đã ký, sai `spender`, sai token, khuôn payload sai đều `VALIDATION` và **không** tạo lệnh (đếm bảng lệnh không đổi) |
| 3 | **Giá đổi giữa chuẩn bị và đặt:** ký theo 100.000, đổi giá 110.000, đặt lệnh bị từ chối "giá đã đổi..., ký lại"; không tạo lệnh |
| 4 | **Nút Hardhat thật, mua không cần `approve`:** ủy quyền ban đầu 0; ký bằng khoá tài khoản Hardhat; `placeOrder` về `COMPLETED`; số dư đúng; giao dịch gọi `buyWithPermit` |
| 5 | **Bán không cần `approve`:** như ca 4 với `sellWithPermit` |
| 6 | **Chữ ký bị gửi trước:** (a) bên khác gửi `permit` bằng chữ ký đó **trước khi đặt lệnh**: bước 6 rơi vào dòng "nhỏ hơn, đủ", lệnh tạo và `COMPLETED`; (b) gửi trước **sau khi tạo lệnh, trước khi quyết toán** (dựng bằng lệnh `EXECUTING` mất mã như ca 8): phục hồi về `COMPLETED` |
| 7 | **Hai tab cùng nonce, ủy quyền ban đầu 0:** (a) tuần tự: lệnh 2 `VALIDATION`, số bản ghi không đổi; (b) đồng thời (`Promise.all` hai `placeOrder`): đúng một lệnh `COMPLETED`; lệnh còn lại hoặc `VALIDATION` không bản ghi, hoặc có bản ghi kết thúc kèm thông báo ký lại; số dư VNDB và WPT chỉ đổi một lần |
| 8 | **Phục hồi dùng chữ ký đã lưu:** lệnh `EXECUTING` mất mã, chưa quyết toán, `permit` còn hạn, nonce chưa dùng: qua `CHECKING` rồi `COMPLETED`; tua thời gian quá hạn và ủy quyền 0: bị từ chối kèm thông báo ký lại |
| 9 | **Cổng công khai không chữ ký trên chain thật:** gọi server action và `POST /api/purchase` trên `hardhat-local` không có `permit` (kể cả khi ví đã `approve` đủ): `VALIDATION`, số bản ghi không đổi; gửi `permit` trên mock: `VALIDATION` |
| 10 | **Không lộ chữ ký:** sau ca 4, chuỗi JSON của `OrderView`, phản hồi `GET`/`POST /api/purchase`, các dòng audit của lệnh không chứa `r`, `s` hay chuỗi chữ ký; đọc dòng `permit` hỏng từ database coi như không có `permit` |
| 11 | **Preview không khoá luồng ký:** trên nút Hardhat, ủy quyền 0, các điều kiện khác đủ: `previewTrade` trả `canConfirm = true`, phép kiểm ủy quyền có chi tiết "sẽ cấp bằng chữ ký"; thiếu số dư VNDB thì vẫn `canConfirm = false`; mock preview không đổi |
| 12 | **Migration:** database Postgres thiếu cột `permit` được thêm cột khi khởi tạo pool; ghi và đọc lại `permit` đúng khuôn JSON |
| 13 | **Mock không đổi:** mua và bán trên mock không hỏi ký; kiểm thử mock hiện có xanh |
| 14 | **E2E Playwright project `hardhat`** (QĐ-J): đặt lệnh mua và bán trên `/trade`, thấy hộp ký đúng số, lệnh hoàn tất; ca huỷ ký (4001) quay lại hộp xác nhận, không tạo lệnh |
| 15 | **Đột biến**, dán đầu ra đỏ rồi hoàn nguyên: (a) bỏ so địa chỉ khôi phục với `investorWallet`, ca 2 đỏ; (b) bỏ kiểm `value` bằng số lệnh, ca 2 hoặc 3 đỏ; (c) adapter luôn gọi `buy` bỏ qua `permit`, ca 4 đỏ; (d) bộ kiểm QĐ-G coi ủy quyền đạt chỉ vì có `permit`, ca 7b hoặc 8 đỏ (ghi rõ ca); (e) `placeOrder` cho đi tiếp khi thiếu `permit` trên chain thật, ca 9 đỏ; (f) kiểm chữ ký bằng nonce hiện tại thay vì nonce đã ký, ca 6a đỏ |
| 16 | Đồng bộ ABI xanh; `run-local-all.sh` xanh; job A (có `trap`) xanh; **job C** (`run-local-all.sh build evm`) xanh gồm ca 14; kiểm thử nút thật chạy **từng tệp một lệnh** xanh; quét bí mật sạch; `@pending FE-05` ở `wallet.signer.ts` gỡ hoặc cập nhật; sơ đồ `purchase` sinh lại nếu điểm cắm đổi dòng |

Ca chạy trên nút thật mà gọi script hoặc tua thời gian thì đặt ngưỡng thời gian riêng (ví dụ `30_000`), không dựa vào
ngưỡng 5 giây mặc định (bài học SC-06 ca 18).

## Điều kiện hoàn thành

- [ ] QĐ-A đến QĐ-G, cấu hình CH-2 (ca 1 đến 12).
- [ ] Mock không đổi (ca 13). Giao diện QĐ-I, e2e QĐ-J (ca 14). Đột biến (ca 15).
- [ ] Kiểm chứng chung (ca 16).
- [ ] `tech-report.md`: luồng ký `permit`, kiểm chữ ký phía máy chủ, bảng phân loại nonce, hệ quả nonce (QĐ-H),
      chữ ký là quyền chi nhạy cảm không trả ra ngoài, chữ ký là bằng chứng đồng ý chi nhưng chưa phải xác thực ví
      (AU-01).

## Câu hỏi đã chốt

| Mã | Nội dung | Chốt |
|---|---|---|
| CH-1 | Lưu chữ ký cùng lệnh | **Có**, coi là quyền chi nhạy cảm, không trả ra ngoài (QĐ-E) |
| CH-2 | Thời hạn | **30 phút**, từ chối khi còn dưới **2 phút**, tính theo timestamp block mới nhất, khoá cấu hình ở mục "Cấu hình" |
| CH-3 | Luôn ký trên chain thật | **Có**, bỏ đường không chữ ký khỏi cổng công khai (QĐ-C) |
| CH-4 | Song song SC-06 | Không còn cần: SC-06 merge trước, FE-05 tạo nhánh từ `dev` sau merge |
| (góp ý) | Hiện permit ở chi tiết lệnh | **Không** trong FE-05 |

## Không làm

- Xác thực ví khi đăng nhập (AU-01). Lệnh ký EIP-712 có giá và chiều (tăng cường về sau).
- Hàng đợi nonce cho nhiều lệnh mở cùng lúc. Huy hiệu permit ở chi tiết lệnh.
- Màn `approve` riêng. Triển khai Sepolia (OP-05). Hiển thị giá một nguồn (FE-07).
