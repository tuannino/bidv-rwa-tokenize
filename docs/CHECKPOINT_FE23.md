# Báo cáo bàn giao: FE-23 Nhà đầu tư rút VNDB ra ví ngoài

| | |
|---|---|
| Mã task | FE-23 |
| Nhánh | `feat/fe-23-rut-vndb`, tạo từ `dev` (`a7151b8`) |
| Spec | `docs/fe-23-rut-vndb/{requirements,design,tasks}.md` (chép nguyên từ gói spec) |
| Commit | mã `017ec56`, tài liệu là commit kế tiếp trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 8) | | Bằng chứng |
|---|---|---|---|
| 1 | A1 tới A7, B, C1 tới C7, D đã làm; `/withdraw` không còn `PlaceholderPage` và `@pending FE-23` | ✅ | mục 5; `placeholder.tsx` đã xoá (C7); quét marker mục 6 |
| 2 | Vitest ca 1 tới 14 (gồm 12b, 12c, 12d) xanh, ca 13 với `TEST_DATABASE_URL`, ca 14 với `TEST_HARDHAT_RPC`; 14 đột biến đều bị bắt | ✅ | mục 1.1, 1.3 |
| 3 | `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` mock và hardhat, `arch markers checkpoint` xanh | ✅ | mục 1.2, 2 |
| 4 | Mở `/withdraw` đúng 1 action; màn khác không đổi | ✅ | mục 3 |
| 5 | Ảnh trên `mock` trong `docs/images/fe-23/`; ảnh `hardhat-local` lúc chờ ký | ✅ | mục 4 (4 ảnh; ảnh hardhat là phía app, xem mục 8.3) |
| 6 | Diff không thêm dòng có mũi tên, gạch dài, chấm giữa | ✅ | mục 6 (một dòng do script sinh, có từ trước) |
| 7 | `docs/USER_GUIDE.md`, `docs/tech-report.md`, checkpoint này, `.kiro/task-status.json` (FE-23 sang `done`) | ✅ | mục 7 |

**Kết luận:** 7 ✅, 0 🔶, 0 ❌. Không đổi hợp đồng, không thêm thư viện. Lược đồ thêm bảng
`PaymentWithdrawRequest` (tự tạo khi áp lại `init.sql`); `ILedgerPort` thêm `ILedgerPaymentTransfer`
(ba phương thức đọc và `mockTransferPayment?` chỉ ở mock); quyền mới `payment:withdraw` chỉ cho INVESTOR.

UserGuide: đã cập nhật Phần 1 mục 1.9; Phần 2; Phần 3 mục 3.1.6 (viết lại); Phụ lục A (A.3b mới), C;
Lịch sử cập nhật.

### 0.2 Việc cần Owner quyết

- Không có. Nợ kỹ thuật theo spec mục 3: hạn mức ngày (`dailyTransactionLimitVnd`), rút về tài khoản
  ngân hàng, ví Fireblocks thay ví trình duyệt. Các chỗ làm khác chữ spec ghi ở mục 8.

---

## 1. Vitest

### 1.1 Tệp mới `app/test/fe-23-payment-withdraw.test.ts`

```text
$ bash scripts/evm-local.sh reset
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa \
            TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/fe-23-payment-withdraw.test.ts)
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

Không có hai biến môi trường thì 27 ca chạy, ca 13 và ca 14 bỏ qua. Ca 13 dựng database riêng
`bidv_fe23_<pid>` rồi xoá. Chain `evm` dùng chuỗi giả trong tệp (bọc `getLedger` bằng `vi.mock`): test
tự phát giao dịch với người gửi, dữ liệu gọi, log, kết cục tuỳ ý; ba phương thức đọc của chuỗi giả theo
đúng luật của adapter EVM.

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Mock: A1 tạo `CREATED`, chưa trừ tiền; A8 trả `txRequest: null`, lệnh `COMPLETED` có `completedTxHash`; ví gửi 1.000 xuống 750, ví nhận tăng 250; audit SUCCESS có dòng hoàn tất |
| 2 | Ví gửi chưa gắn cho hồ sơ: `WALLET_NOT_BOUND`, không lệnh nào của ví đó |
| 3 | `evm`: chưa whitelist, bằng ví gửi, địa chỉ 0, địa chỉ VNDB, vault của chain, ví mẫu công khai; `mock`: vault mock, quỹ chia mock. Mọi ca `VALIDATION` ở ô `toWallet`, không lệnh, audit FAILURE |
| 4 | Vượt số dư: "Số dư VNDB không đủ."; mã `98765`: `VALIDATION`, không dòng audit nào chứa mã, không lệnh |
| 5 | A1 không có khoá `txRequest`; A8 trả `chainId` 11155111, `to` là VNDB, `data` bỏ 32 byte cuối giải ra `transfer(RECEIVER, 100)`, 32 byte cuối bằng `paymentTag(id)`; A8 lần hai: `WITHDRAW_STATE` đúng câu, không dữ liệu; A1 gọi lại cùng mã: trả lệnh `SENDING`, không có `txRequest` |
| 6 | Mã do ví khác gửi: `WITHDRAW_STATE`, lệnh giữ `SENDING`; mã nút chưa thấy: `SUBMITTED` |
| 7 | Biên nhận đúng, có thêm một log `Transfer` khác: `COMPLETED`, `completedTxHash` đúng mã, `activeWallet` NULL |
| 8 | Năm biến thể (sai số, sai ví nhận, sai người gửi, sai nhãn, log của hợp đồng khác): `FAILED`, `completedTxHash` NULL |
| 9 | Biên nhận `FAILED`: `FAILED`; `PENDING`: giữ `SUBMITTED`; quá 30 phút chuỗi không biết mã: có giao dịch thay thế cùng nhãn thì `COMPLETED` bằng mã thay thế, không có thì `FAILED` |
| 10 | NDT002 gọi A8, A2, A3 lệnh của NDT001: `WITHDRAW_STATE`, lệnh giữ `CREATED`. Huỷ có `walletRejected` khi giao dịch đã lên chuỗi: `COMPLETED`. Huỷ không thấy: `CANCELLED` lý do "Trình duyệt báo người dùng từ chối ký"; giao dịch cùng nhãn vào khối sau: lần mở màn chuyển `COMPLETED` |
| 11 | Lệnh đang dở chặn lệnh thứ hai đúng câu; cùng mã cùng nội dung trả lệnh cũ; khác nội dung `WITHDRAW_STATE`; bảng chỉ một lệnh |
| 12 | `SENDING` mất mã: A1 gọi lại không có `txRequest`, A8 bị từ chối; 31 phút sau lần mở màn vẫn quét thấy và `COMPLETED` (một giao dịch duy nhất mang nhãn); lệnh `SENDING` khác quá 30 phút không thấy: `EXPIRED` |
| 12b | R1 `EXPIRED`, R2 `SENDING` cùng ví nhận, cùng số, cùng `createdBlock`; giao dịch nhãn R1 vào khối sau: R1 `COMPLETED`, R2 giữ `SENDING`, không nhận |
| 12c | R2 huỷ sau khi gửi tới ví; R1 khai mã T (nút chưa thấy, `SUBMITTED`); T là giao dịch nhãn R2: R2 `COMPLETED` bằng T, R1 `FAILED` |
| 12d | Mock, lỗi cố ý sau `mockTransferPayment`: lệnh `SENDING`, số dư 1.000 xuống 700; lần mở màn `COMPLETED`; gọi lại `mockTransferPayment` cùng nhãn: số dư vẫn 700 |
| 13 | Postgres: hai lần tạo đồng thời cùng ví: một thành công, một `WITHDRAW_STATE`; hai lần A8 đồng thời: đúng một lần có `txRequest`; báo mã rồi `COMPLETED`; lệnh khác cùng chain chốt cùng mã: `UniqueConstraintError` |
| 14 | Nút Hardhat: whitelist NB001, nạp 1.000 VNDB cho NDT001 bằng `mintPayment`; A1, A8, gửi `txRequest` (calldata có nhãn) bằng `walletClient` viem: biên nhận `success`, NDT001 giảm 100, NB001 tăng 100 (VNDB chấp nhận byte thừa); báo mã: `COMPLETED`; lệnh thứ hai gửi mà không báo mã: lần mở màn tìm theo nhãn và `COMPLETED` |
| Hàm thuần | `matchesTransfer`: đủ ba điều kiện mới đạt; thiếu người gửi, nhãn hoặc số đều không đạt |

### 1.2 Toàn bộ `typecheck`, `lint`, `vitest`

```text
$ (cd app && npm run typecheck && npm run lint)
exit=0 (0 lỗi, 0 cảnh báo)
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  67 passed | 10 skipped (77)
      Tests  1373 passed | 71 skipped (1444)
```

Test có sẵn đã sửa: `test/rbac.test.ts` (bảng `FE23_ACTIONS` đưa vào `it.each` và tập `covered`,
`payment:withdraw` vào `ALL_WRITE_ACTIONS`); `test/pending-markers.test.ts` xanh sau khi sinh lại khối
điểm cắm (`node scripts/scan-pending.mjs --write-report`). `fe-10-recall-ui.test.ts` không phải sửa vì
không thêm nhãn vào `txn-labels.ts`. Bảng mới không thêm vào `NEW_TABLES` của `store-constraints.test.ts`
(mục 8.5).

### 1.3 Đột biến (14/14 bị bắt)

Mỗi đột biến sửa mã, chạy `test/fe-23-payment-withdraw.test.ts` có `TEST_DATABASE_URL`, rồi trả mã về
nguyên. Kịch bản ngoài repo: `scratchpad/fe23/mutate.py`.

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | Bỏ chốt chặn ví gửi (`assertSessionWallet` ở A1) | ca 2 |
| 2 | Bỏ kiểm whitelist ví nhận ở A1 | ca 3 "chưa whitelist" |
| 3 | Bỏ danh sách địa chỉ hệ thống | ca 3: địa chỉ VNDB, vault `evm`, vault mock, quỹ chia mock (4) |
| 4 | Chốt `COMPLETED` không kiểm `Transfer` | ca 8 sai số, sai ví nhận, log hợp đồng khác; hàm thuần (4) |
| 5 | Bỏ kiểm `txFrom` | ca 8 sai người gửi; hàm thuần (2) |
| 6 | Bỏ kiểm nhãn trong `input` | ca 8 sai nhãn, ca 12c, hàm thuần (3) |
| 7 | A8 trả giao dịch cả khi lệnh đã `SENDING` | ca 5, ca 12 (2) |
| 8 | A1 trả giao dịch khi gọi lại | ca 5, ca 12 (2) |
| 9 | Quét loại ứng viên theo `submittedTxHash` của lệnh khác | ca 12c |
| 10 | `mockTransferPayment` không kiểm nhãn đã có | ca 12d |
| 11 | Bỏ quét trước `EXPIRED` | ca 12 |
| 12 | A3 huỷ từ `SENDING` không quét | ca 10 |
| 13 | Bỏ quét lại 24 giờ | ca 10, 12b, 12c (3) |
| 14 | Bỏ chặn lệnh đang dở (phép kiểm ở A1 và ràng buộc `activeWallet` của bản bộ nhớ) | ca 11 |

## 2. Bản dựng, e2e, job A

```text
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh build e2e evm > run-all.txt 2>&1; echo EXIT=$?
EXIT=0
$ grep -E "passed \(|ĐẠT" run-all.txt
  77 passed (1.2m)      # project mock (trước task 75; thêm 2 ca của investor-withdraw.spec.ts)
  26 passed (34.0s)     # project hardhat
  => ĐẠT các phần đã chạy: build e2e evm
```

`e2e/investor-withdraw.spec.ts` (mới, chỉ project mock): Giao dịch viên gắn NB001 và ví mẫu NDT001 ở
`/wallet-binding`, nạp 1.000 VNDB cho NDT001 ở `/demo-payment` (cờ tắt thì `test.skip` có lý do); Nhà đầu tư
rút 1 VNDB tới NB001, hộp mã một lần có "Ví nhận: ... (đã whitelist)", mã 5 số khoá nút, dòng đầu bảng
`COMPLETED`, "Hoàn tất". Tệp tự dựng dữ liệu, không phụ thuộc thứ tự tệp.

Mô phỏng job A (cất `packages/contracts-evm/artifacts`):

```text
$ bash scripts/run-local-all.sh arch markers checkpoint app; echo EXIT=$?
    PASS  luật kiến trúc (có cảnh báo)     # 3 cảnh báo có từ trước, không tệp nào của FE-23
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST        # 1266 ca đạt, 95 bỏ qua (không có Postgres, nút Hardhat)
EXIT=0
```

## 3. Số server action khi mở (mock, `next start`, đếm header `next-action`)

| Màn | Vai | Trước (`a7151b8`) | Sau |
|---|---|---|---|
| `/withdraw` | Nhà đầu tư | 0 (trang chờ) | 1 |
| `/portfolio` | Nhà đầu tư | 1 | 1 |
| `/trade` | Nhà đầu tư | 1 | 1 |
| `/orders` | Nhà đầu tư | 1 | 1 |
| `/seller/withdraw` | Người bán | 2 | 2 |
| `/vault` | Kiểm soát viên | 3 | 3 |
| `/vault` | Giao dịch viên | 3 | 3 |
| `/account` | Người bán | 1 | 1 |
| `/account` | Nhà đầu tư | 1 | 1 |

## 4. Ảnh (`docs/images/fe-23/`)

| Tệp | Nội dung |
|---|---|
| `20261028_rut_vndb.png` | Mock: màn rút có dữ liệu (số dư 4.750.000, rút 1.200.000, số dư sau rút 3.550.000), ví gửi có nhãn "Đã định danh", bảng có một lệnh |
| `20261028_rut_vndb_otp.png` | Mock: hộp mã một lần, dòng "Ví nhận: 0x15d3...6A65 (đã whitelist)" |
| `20261028_rut_vndb_hoan_tat.png` | Mock: câu "Đã rút 250.000 VNDB tới ví ...", bảng có dòng "Hoàn tất" kèm mã giao dịch |
| `20261028_rut_vndb_hardhat_cho_ky.png` | hardhat-local: sau "Xác nhận", màn ở "Đang chờ ký trong ví…" (ví giả lập giữ yêu cầu `eth_sendTransaction`); có câu phí gas |

## 5. Yêu cầu và nơi làm

| Mã | Nơi làm |
|---|---|
| A1 tới A8 | `lib/bank/payment-withdraw.service.ts` (`createPaymentWithdraw`, `beginPaymentSend`, `submitPaymentWithdrawTx`, `cancelPaymentWithdraw`, `getPaymentWithdrawPage`, `checkPaymentWithdrawTarget`, đối soát `reconcileOne`, quét `scanByTag`; hàm thuần `paymentTag`, `paymentTransferCalldata`, `paymentTargetError`, `matchesTransfer`); `app/actions/payment-withdraw.ts` (sáu action) |
| Lưu trữ | `prisma/schema.prisma` model `PaymentWithdrawRequest`, `init.sql` sinh lại; `lib/store/payment-withdraw.store.port.ts`, `memory.payment-withdraw.store.ts`, `postgres.payment-withdraw.store.ts`; ba ràng buộc ở `store.errors.ts` |
| B | `ledger.port.ts` (`ILedgerPaymentTransfer`); `evm.adapter.ts` (`getTransaction`, `getTransactionReceipt`, `getLogs` theo `evmLogBlockChunk`); `mock.adapter.ts` và `mock-state.store.ts` (trường bền `paymentTransfers`, giải mã trạng thái cũ thiếu trường ra rỗng); `stellar.adapter.ts` (`LedgerNotImplementedError`) |
| RBAC | `payment:withdraw` vào `ACTIONS` và INVESTOR |
| C1 tới C7 | `components/pages/investor-withdraw.tsx`; `app/(investor)/withdraw/page.tsx`; `lib/signer/wallet-transfer.ts` (`assertWalletReady`, `sendPaymentTransferWithWallet`); `components/withdraw/labels.ts`; xoá `components/pages/placeholder.tsx` (không còn trang nào dùng) |
| D | `docs/USER_GUIDE.md`, `docs/tech-report.md` (khối điểm cắm sinh lại, bảng quyền, bảng cổng ledger 32h tới 32k, dòng cây thư mục và bảng tệp về trang chờ) |

## 6. Quét

```text
$ grep -rn "@pending FE-23\|PlaceholderPage" app/src        # không ra dòng nào
$ node scripts/scan-pending.mjs --check-report              # Khớp marker
$ git diff a7151b8 | python3 (lọc dòng thêm có mũi tên, gạch dài, chấm giữa)
(ra đúng một dòng: dòng tiêu đề "4 điểm cắm, 2 điểm chặn" của khối điểm cắm trong docs/tech-report.md)
```

Dòng duy nhất là dòng `scan-pending.mjs --write-report` tự sinh trong `docs/tech-report.md`, ngăn hai số
bằng dấu chấm giữa; dòng này có từ trước (khi đó là 5 điểm cắm), FE-23 chỉ đổi số. Sửa ký tự ở đây thì
lần sinh sau ghi đè lại.

## 7. Tài liệu

- `docs/USER_GUIDE.md`: như dòng UserGuide ở mục 0.1. Bỏ L-48, L-49 (trang chờ đã thay).
- `docs/tech-report.md`: mục D ở mục 5.
- `.kiro/task-status.json`: FE-23 từ `planned` sang `done`.

## 8. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Ca 14 không dùng khoá Hardhat #1.** Nút Hardhat mở khoá sẵn các tài khoản mẫu, nên test gửi bằng
   `walletClient` với account `json-rpc` của NDT001 (nút ký), không đưa khoá riêng nào ngoài khoá #0 vào
   repo. Giao dịch, calldata có nhãn và kết quả giống hệt cách ký bằng khoá #1.
2. **Thêm `noteReason` vào cổng lưu trữ** (ngoài danh sách hàm ở design mục 1), để "va ràng buộc
   `(chain, completedTxHash)` thì giữ trạng thái cũ, ghi lý do" (QĐ-11) không phải dùng một lần chuyển
   trạng thái giả.
3. **Ảnh hardhat-local là phía app.** Cửa sổ ký của MetaMask không dựng được trong Chromium không giao
   diện; ảnh dùng ví giả lập (cách của `e2e/permit-order.spec.ts`) giữ yêu cầu `eth_sendTransaction`, nên
   màn dừng đúng ở "Đang chờ ký trong ví…". Bảng chưa hiện dòng lệnh vì màn tải lại sau khi ví trả lời.
4. **A8 đọc lại không đạt trả `ok` với lệnh `CANCELLED`** (kèm lý do, `txRequest: null`) thay vì mã lỗi,
   để màn hiện đúng câu "Lệnh rút đã huỷ: ..." từ trạng thái lệnh.
5. **`NEW_TABLES` của `store-constraints.test.ts` không thêm bảng mới**: ba ràng buộc đã kiểm trực tiếp
   ở ca 13 trên Postgres và ở ca 11, 13 trên bộ nhớ; spec để ngỏ việc này.
6. **Đột biến 14** sửa cả phép kiểm ở A1 và ràng buộc `activeWallet` của bản bộ nhớ: chỉ bỏ phép kiểm ở
   A1 thì ràng buộc duy nhất vẫn chặn và trả đúng câu đó (ràng buộc là trọng tài, đúng thiết kế), nên đột
   biến một chỗ không đổi hành vi quan sát được.
7. **Lệnh `SUBMITTED` không huỷ được** (A3 trả `WITHDRAW_STATE`): bảng chuyển mục 4 chỉ có
   `CREATED` và `SENDING` sang `CANCELLED`; lệnh đã báo mã chờ đối soát.
