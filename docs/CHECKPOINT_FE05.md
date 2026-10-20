# Báo cáo bàn giao: FE-05: Nhà đầu tư ký `permit` bằng ví khi đặt lệnh trên chain thật

| | |
|---|---|
| Task | FE-05 |
| Nhánh | `feat/fe-05-ky-permit`, tạo từ `dev` @ `bf23cde` (PR #58, SC-06 đã merge) |
| Spec | `docs/fe-05-ky-permit/{requirements,tasks}.md` bản 2 |
| Mức kiểm chứng | Cao |
| Tiến độ | Bước 0 đến 5 xong. Chờ Supervisor nghiệm thu; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | QĐ-A đến QĐ-G, cấu hình CH-2 (ca 1 đến 12) | ✅ | mục 1, 2; chi tiết kiểm chứng mục 4, 5, 6 |
| 2 | Mock không đổi (ca 13). Giao diện QĐ-I, e2e QĐ-J (ca 14). Đột biến (ca 15) | ✅ | mục 2; chi tiết kiểm chứng mục 3, 7; chi tiết đột biến |
| 3 | Kiểm chứng chung (ca 16) | ✅ | mục 2; chi tiết kiểm chứng mục 1 đến 10 |
| 4 | `tech-report.md`: luồng ký, kiểm chữ ký, bảng nonce, hệ quả nonce, chữ ký nhạy cảm, chưa phải xác thực ví | ✅ | mục 4 |

**Kết luận:** 4 ✅, 0 🔶, 0 ❌. Có một quyết định của chủ dự án trong lúc làm (mục 3.1, cờ tất toán) và
một lỗi nền có từ SC-06 đã sửa vì ca 12 đòi (mục 3.2).

### 0.2 Việc cần Owner quyết/chạy

- Không có việc cần quyết. Supervisor chốt mức hai dòng nợ mới đề nghị ở tech-report 1.6.C (mục 3.4).

---

## 1. Kết quả chính

- **Dùng chung và cổng chuỗi (bước 1):** `buildPermitTypedData` bắt buộc `version`; ABI `eip712Domain`
  cho hai token, `buyWithPermit`/`sellWithPermit` cho `OrderSettlement`; cổng thêm
  `latestBlockTimestamp`, `permitDomain`, `permitNonce` và `SettlementOrder.permit`; khoá
  `order.permit_ttl_seconds` (1800), `order.permit_min_remaining_seconds` (120).
- **Máy chủ (bước 2):** `readPermitDomain` kiểm khuôn domain; `preparePermit` (service + action);
  `placeOrder` theo tám bước QĐ-D, cổng công khai trên chain thật bắt buộc chữ ký; bộ kiểm nhận nguồn
  ủy quyền do máy chủ suy ra (QĐ-F, schema chặt); quyết toán và phục hồi dùng chữ ký đã lưu khi còn dùng
  được (QĐ-G); cột `PurchaseOrder.permit` JSONB, khuôn JSON cố định, `ADDED_COLUMNS`.
- **Giao diện (bước 3):** hộp xác nhận nêu số, token, giờ hết hạn; nút ba trạng thái; huỷ ký quay lại
  hộp; ví sai mạng dùng `WrongChainBanner`/`canSign`; ký qua `createWalletSigner` (LUẬT #2).

## 2. Ca kiểm chứng và nơi chạy

| Ca | Nơi kiểm |
|---|---|
| 1 | `app/test/fe-05-permit-order.test.ts` (chuỗi giả); `fe-05-permit-evm.test.ts` ca 1 (nút thật) |
| 1b | `app/test/fe-05-permit-domain.test.ts` (9 ca) |
| 2, 3, 6a, 7a, 9, 10, 11 (xem trước), 13 | `app/test/fe-05-permit-order.test.ts` (25 ca, ví khoá ngẫu nhiên lúc chạy) |
| 4, 5, 6a, 6b, 7b, 8, 11 | `app/test/fe-05-permit-evm.test.ts` (8 ca, nút Hardhat ký qua `eth_signTypedData_v4`) |
| 10 (dòng hỏng), 12 | `app/test/fe-05-permit-postgres.test.ts` (Postgres thật, database riêng rồi xoá) |
| 13 | bộ mock cũ xanh (`purchase-service`, `investor-trading`, ...) |
| 14 | `app/e2e/permit-order.spec.ts` (project `hardhat`, chạy trong job C) |
| 15 | `docs/CHECKPOINT_FE05_MUTATIONS_DETAIL.md`: 15a đến 15f đều đỏ đúng ca, hoàn nguyên sạch |
| 16 | `docs/CHECKPOINT_FE05_VERIFICATION_DETAIL.md` mục 1 đến 10; bộ mặc định cuối task ở mục 13 |

Số đo chính (đầu ra nguyên văn ở chi tiết kiểm chứng): hợp đồng 156 passing (không đổi so với nền; chỉ sửa helper ký của hai test); job A 6 phần đạt, vitest 921 đạt, 53 bỏ qua, artifacts phục hồi; job C 4 PASS, E2E hardhat 19 đạt (16 cũ + 3 ca 14); E2E mock 58 đạt; nút thật chạy từng tệp: `evm-order-settlement` 10, `fe-05-permit-evm` 8, `evm-issuance` 13, `vault` 6, `sc-06-distribution-evm` 10 đều đạt; Postgres thật 1000 đạt, 44 bỏ qua; không còn marker `@pending`/`@blocked FE-05`; quét bí mật và quét khoá riêng sạch. Nền trước khi làm (chi tiết kiểm chứng mục 12): bộ mặc định 7 PASS, vitest 887.

Ca 7b trên nút thật rơi vào nhánh "có bản ghi": hai lệnh đều qua bước 6, lệnh khớp trước tiêu chữ ký,
lệnh sau bị hợp đồng từ chối khi gửi và kết thúc `FAILED` kèm câu "chữ ký ủy quyền đã hết hạn hoặc đã
dùng (đặt lệnh lại để ký mới)". Tiền và token chỉ chuyển một lần.

## 3. Sai lệch, lựa chọn khi làm và ca cũ phải sửa

### 3.1 Quyết định của chủ dự án trong lúc làm

`previewTrade` và bối cảnh màn giao dịch gọi `isSettlementMode()`, mà trên EVM hàm này còn chờ SC-04
(`@blocked SC-04`), nên màn `/trade` trên chain thật không bao giờ mở được nút xác nhận và ca 11, 14
không đạt được. Em hỏi, chủ dự án chốt ngày 20/10/2026: **tạm coi chưa tất toán**. Hiện thực ở
`settlementModeOrUnknown` (`trade.service.ts`): chỉ bắt `LedgerNotImplementedError`, điều kiện token
dựa vào trạng thái dự án (dự án `CLOSED` vẫn chặn), câu chi tiết ghi "chờ SC-04". Marker
`@blocked SC-04` giữ nguyên; `seller.service` (SC-07) đã có tiền lệ cùng cách.

### 3.2 Lỗi nền phát hiện qua ca 12 (có từ SC-06)

`schemaObjectsReady` của pool Postgres chỉ đếm bảng, kiểu, chỉ mục, ràng buộc. Database đang chạy đủ
những thứ đó nhưng thiếu cột mới bị coi là sẵn sàng, nên `addMissingColumns` không chạy. Tái hiện
trước khi sửa (ca 12 đỏ: `expected [] to deeply equal [ { data_type: 'jsonb' } ]`, chi tiết kiểm chứng
mục 11; bản ca lúc đó chỉ xoá cột `permit`), rồi sửa: phép kiểm đếm thêm mọi cột của `ADDED_COLUMNS`. Lỗi này cũng áp cho 6 cột
`DistributionPeriod` của SC-06 (không kèm chỉ mục nào), ca 12 kiểm luôn cột `vaultCloseStatus`.

### 3.3 Ca cũ đổi theo spec

| Tệp | Ca | Lý do |
|---|---|---|
| `packages/contracts-evm/test/sc-09-erc3643.test.js`, `sc-03-khop-lenh.test.js` | helper `signPermit` | QĐ-B: `version` bắt buộc, đọc từ `eip712Domain()` |
| `app/test/evm-order-settlement.test.ts` | "mua 100 rồi bán 40" ký bằng helper; cấp lại `approve` sau ca đó | QĐ-C; QĐ-H (permit ghi đè ủy quyền đã `approve` sẵn) |
| `app/test/evm-order-settlement.test.ts` | "bán thiếu allowance WPT bị chặn ở R4" | lệnh mới nay có chữ ký nên không thiếu ủy quyền lúc đặt; R4 kiểm ở quyết toán lệnh không chữ ký (lệnh cũ) |
| `app/test/purchase-service.test.ts` | "đường tự động chỉ quyết toán lệnh vừa tạo" | QĐ-F schema chặt: trường lạ `orderId` làm cả yêu cầu bị loại thay vì bị bỏ qua; lệnh nạn nhân không bị đụng, không gửi giao dịch |

### 3.4 Lựa chọn khi spec để ngỏ hoặc cần thêm để làm được

- **Ký trong test không cầm khoá riêng:** nút Hardhat ký hộ tài khoản mặc định qua
  `eth_signTypedData_v4` (`test/helpers/permit-signer.ts`); test không cần nút dùng khoá sinh ngẫu
  nhiên lúc chạy. Không khoá nào ngoài khoá #0 đã có sẵn trong repo (quét ở chi tiết kiểm chứng mục 10).
- **Hàng đợi gửi trong adapter EVM** (`inSendQueue`, theo chain và ví ký): ca 7b đỏ vì hai lệnh đồng
  thời lấy trùng nonce giao dịch của ví máy chủ; xếp hàng mô phỏng + gửi làm lệnh sau nhận lỗi nghiệp
  vụ. Lỗi `ERC20InsufficientAllowance` nhận diện theo selector để câu lỗi nói "ký lại". Hàng đợi chỉ
  trong một tiến trình: đề nghị dòng nợ P2 ở tech-report 1.6.C.
- **Ký ở giao diện qua `lib/signer/wallet-permit.ts`** dựng từ `createWalletSigner` (LUẬT #2), không
  dùng thẳng `useSignTypedData`. Marker `@pending` ở `wallet.signer.ts` chuyển sang FE-09 (FE-05 đã dùng).
- **E2E kết nối ví bằng cờ `injected.connected` của wagmi** (người dùng đã kết nối từ trước): hộp chọn ví
  RainbowKit không liệt kê connector `injected` khi chưa có WalletConnect projectId. Ví giả lập trả
  đúng tài khoản NDT001 (Hardhat #1) trong `eth_accounts` của nút. Spec đứng sau `mint.spec.ts` vì cần
  nguồn cung trong vault.
- **`preparePermit` kiểm quyền bằng `assertCan`** như `previewPurchase` (chỉ đọc); lần đặt lệnh ngay
  sau mới ghi sổ kiểm toán. Từ chối đặt lệnh vì chữ ký vẫn ghi audit FAILURE, câu lý do không chứa chữ ký.
- **Đột biến 15b** đỏ ở ca 3 (sai câu "giá đã đổi") và biến thể "value khác số lệnh" của ca 2: bỏ phép
  so `value` thì chữ ký vẫn bị từ chối ở bước kiểm chữ ký (typed data dựng bằng số tính lại), chỉ khác lý do.

### 3.5 Môi trường sandbox

`binaries.soliditylang.org` bị chặn nên lệnh Hardhat chạy với `USE_LOCAL_SOLC=1`; Playwright cần liên
kết `chromium_headless_shell-1243` sang bản 1194 như ghi chú bàn giao.

## 4. Tài liệu

`docs/tech-report.md` bản 4.19: đầu trang, đoạn tóm tắt FE-05, **mục mới 3.25** (luồng ký hai bước,
bảng kiểm tám bước, bảng phân loại nonce, hệ quả nonce QĐ-H, chữ ký là quyền chi nhạy cảm và chưa phải
xác thực ví AU-01, giao diện, cờ tất toán), 3.1 (47 method, hàng đợi gửi), 3.2, 3.4, 3.5, 3.13 (hai
khoá), 4.2, 4.5, nợ 1.6.C (hai dòng đề nghị), bài học 1.6.A; `.kiro/steering/lessons.md` thêm hai bài
học. Sơ đồ `purchase` và mục điểm cắm sinh lại bằng công cụ. `.kiro/task-status.json`: FE-05
`inProgress`; SC-06, SC-05 chuyển `done` (PR #58 đã merge).

## 5. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi lời gọi chuỗi qua `ILedgerPort` (domain, nonce, timestamp là method cổng; `verifyTypedData` là
  mật mã thuần ở `lib/bank/permit.ts`, không gọi chuỗi).
- [x] Mọi thao tác ký qua `ISigner` (`createWalletSigner` cho ví nhà đầu tư, `getBankSigner` cho giao dịch khớp).
- [x] Mọi kiểm quyền qua RBAC (`order:place` ở `preparePermit`, `authorize` ở `placeOrder`).
