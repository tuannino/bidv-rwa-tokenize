# Báo cáo bàn giao: BE-17 — Tự khớp lệnh mua và bán

| | |
|---|---|
| Mã task | BE-17 |
| Nhánh | `feat/auto-settle`, từ `dev` @ `456ab54` |
| Spec | `docs/be-17-auto-settle/{requirements,tasks}.md` |
| Tiến độ | Bước 6/6 hoàn tất; chờ Supervisor nghiệm thu, Codex không merge vào `dev` |

> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE17.md docs/be-17-auto-settle/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Lệnh mua và bán hợp lệ tự quyết toán, không cần người bấm | ✅ | mục 3.2, 3.5 |
| 2 | Đường tự động chỉ chạm lệnh vừa tạo, có test và đột biến | ✅ | mục 3.2, 3.4 |
| 3 | Đường tự động chạy đúng bộ kiểm của đường tay | ✅ | mục 3.2, 3.4 |
| 4 | `order:execute` vẫn chỉ ở `TELLER`; bảng quyền không đổi | ✅ | mục 3.3, 6 |
| 5 | Quyết toán trượt giữ lệnh; GDV can thiệp được | ✅ | mục 3.2, 3.3 |
| 6 | Nút Khớp lệnh chỉ còn cho lệnh kẹt | ✅ | mục 3.3, 3.5 |
| 7 | Sổ kiểm toán phân biệt tự động và can thiệp | ✅ | mục 3.3 |
| 8 | Khóa chống trùng đúng ba tình huống ở hai bản lưu trữ | ✅ | mục 3.1, 3.2 |
| 9 | Can thiệp đúng ba nhánh; `EXECUTING` thiếu mã không gửi lại | ✅ | mục 3.3, 3.4 |
| 10 | `docs/guide.md` đã sửa và đi lại từ bản sạch | ✅ | mục 3.5 |
| 11 | `docs/flows/purchase.md` sinh lại bằng script | ✅ | mục 3.6 |
| 12 | `run-local-all.sh` xanh | ✅ | mục 7 |

**Kết luận:** 12 ✅ · 0 🔶 · 0 ❌.

### 0.2 Việc cần Owner quyết

- Không có.

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `42bc5ac` | Tiếp nhận spec, mở trạng thái BE-17 |
| `6c2e04b` | Tách lõi quyết toán dùng chung, chưa đổi hành vi |
| `a524a3a` | Khóa chống trùng theo cặp ví và mã yêu cầu |
| `277408e` | Tự quyết toán đúng lệnh vừa tạo |
| `464aa6c` | Ba nhánh can thiệp an toàn và audit phân biệt hai đường |
| `272defd` | UI hiện kết quả cuối, chỉ cho can thiệp lệnh kẹt |
| `6f89cc6` | Sửa guide và sinh lại sơ đồ purchase |
| `db1d88e` | Cập nhật bộ hồi quy cũ theo luồng tự khớp |
| `23a1069` | Nâng volume PostgreSQL cũ với `clientRequestId` |
| (commit bàn giao) | Báo cáo kỹ thuật, checkpoint và trạng thái task |

Hai tệp HTML không theo dõi có sẵn trong worktree không thuộc BE-17 và không được thêm vào commit.

## 2. Đối chiếu các bước trong `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | Đo nền, chuyển BE-17 sang đang làm | ✅ | 93/93 test đích xanh trước sửa; `42bc5ac` |
| 1 | Tách lõi, không đổi hành vi | ✅ | `6c2e04b` |
| 1b | Chống trùng cả schema/store/service/UI | ✅ | `a524a3a`, `23a1069` |
| 2 | Tự quyết toán và giữ lỗi trong lệnh | ✅ | `277408e` |
| 3 | Can thiệp, receipt-only, audit | ✅ | `464aa6c` |
| 4 | Giao diện tối thiểu | ✅ | `272defd` |
| 5 | Guide và flow sinh từ marker | ✅ | `6f89cc6` |
| 6 | Kiểm chứng và bàn giao | ✅ | mục 3, 7 |

## 3. Cách chạy và bằng chứng

### 3.1 Lược đồ và khóa chống trùng

`clientRequestId` là UUID bắt buộc ở biên đặt lệnh. Cơ sở dữ liệu có unique
`(investorWallet, clientRequestId)`; memory store mô phỏng cùng lỗi unique. `ensureSchema()` thêm
cột có default UUID trước khi áp `init.sql`, nên volume cũ nâng được mà không phá dòng hiện hữu.

```text
$ cd app && npx vitest run test/store-constraints.test.ts
 Test Files  1 passed (1)
      Tests  119 passed (119)
```

### 3.2 Tự quyết toán và test nghiệp vụ

- Retry cùng mã/cùng nội dung trả lệnh cũ, không chạy quyết toán lần hai.
- Cùng mã/khác nội dung trả lỗi rõ ràng; hai lời gọi song song chỉ một lần tạo và một lần gửi.
- `autoSettleCreatedOrder` nhận `OrderRecord` vừa tạo, không nhận `orderId` ở input.
- Sau lần kiểm trước khi lưu, lõi vẫn chạy lại `runOrderChecks`; lỗi sau khi lưu được phản ánh bằng
  trạng thái/lý do của chính lệnh thay vì làm mất lệnh.

```text
$ cd app && npx vitest run test/purchase-service.test.ts test/purchase-state.test.ts \
    test/ops-transactions.test.ts test/store-constraints.test.ts
 Test Files  4 passed (4)
      Tests  225 passed (225)
```

Số nền trước sửa đo bằng ba file theo spec là **93/93**; sau sửa riêng ba file đó là **107/107**,
không giảm ca. Hai test hồi quy cũ buộc đổi kỳ vọng vì trước đó tự gọi `executeOrder`; lý do là
chính hành vi thủ công mà BE-17 thay thế, không phải nới assertion.

### 3.3 Đường can thiệp và quyền

| Trạng thái | Hành vi |
|---|---|
| `CHECKING` | GDV chạy lại kiểm, chiếm `EXECUTING`, được gửi |
| `EXECUTING` có `txHash` | Tìm `Txn`, chỉ chờ receipt và chốt; không phát lại |
| `EXECUTING` thiếu `txHash` | Trả `MANUAL_RECONCILIATION`, UI cảnh báo; không có nút gửi |

`executeOrder` vẫn gọi `authorize('order:execute')`; test RBAC giữ quyền này chỉ ở `TELLER`.
Audit dùng `order:auto-execute` và `order:intervene`, không thêm vai hệ thống giả.

### 3.4 Ba phép đột biến đã chạy thật

| Đột biến | Test đỏ quan sát được | Kết quả sau hoàn nguyên |
|---|---|---|
| Cho tự động nhận `orderId` ngoài thay cho bản ghi vừa tạo | ca bảo mật “chỉ quyết toán lệnh vừa tạo” đỏ | xanh |
| Bỏ lần `runOrderChecks` tự động sau khi lưu | ca hạ số dư giữa hai lần kiểm đỏ | xanh |
| Cho `EXECUTING` thiếu `txHash` gửi lại | ca không phát lại giao dịch không rõ kết quả đỏ | xanh |

Mỗi đột biến chỉ tồn tại cục bộ để chạy test, đã hoàn nguyên ngay; `git diff` cuối không chứa mã
đột biến.

### 3.5 Giao diện và đi lại guide

Đã đi luồng sạch trên mock đúng trình tự trong `docs/guide.md`: whitelist SPV + nhà đầu tư → GDV
lập Mint → KSV duyệt → nạp VNDB → nhà đầu tư mua tự khớp → bán tự khớp → xem hai màn chi tiết →
Burn maker-checker. `ops-transactions.spec.ts` thực hiện chuỗi này qua UI thật; hai file E2E đích:

```text
$ E2E_BASE_URL=http://localhost:3000 npx playwright test \
    e2e/investor-channel.spec.ts e2e/ops-transactions.spec.ts
  24 passed (4.7m)
```

UI vận hành dùng nhãn “Can thiệp”/“Đối soát biên nhận”; lệnh hoàn tất không có nút. Nhà đầu tư nhận
ngay trạng thái cuối và mã giao dịch, không còn hướng dẫn chờ ngân hàng khớp.

### 3.6 Sơ đồ và marker

```text
$ node scripts/gen-flow-diagram.mjs
$ node scripts/check-pending-markers.mjs
Marker hợp lệ: 18 điểm cắm, 13 điểm chặn, 35 bước luồng. Không có lỗi.
```

Luồng `purchase` có 12 bước, gồm `autoSettleCreatedOrder`, `settleStoredOrder` và `sendAndSettle`.

## 4. Deviation / giới hạn đã biết

### DV-1 — Lượt gate đầu phát hiện test lịch sử còn mô hình tay

Lượt `run-local-all.sh` đầu sau code có 782 xanh, 7 đỏ ở `demo-payment.test.ts` và
`investor-trading.test.ts`: các test vẫn đặt lệnh rồi gọi tay `executeOrder`. Đã sửa kỳ vọng theo
luồng tự khớp, thêm fixture `CHECKING` trực tiếp cho ca lọc trạng thái, rồi chạy lại toàn bộ xanh
790/790. Không đổi code sản phẩm để chiều theo test cũ.

### DV-2 — Lượt E2E qua server demo đang mở không phải cấu hình test

Lượt đầu dùng `E2E_BASE_URL=http://localhost:3000` đạt 51/54; ba ca `/mint` legacy timeout vì server
demo đúng chủ đích để `ENABLE_DEMO_TOKEN_MINT=false`. Đã dừng tạm server, chạy `npx playwright test`
để Playwright dựng server sạch với cờ test theo `playwright.config.ts`: **54/54 xanh**, rồi bật lại
server cổng 3000. Đây là khác biệt môi trường, không phải lỗi BE-17.

## 5. Nợ kỹ thuật / đề xuất tiếp theo

| Mức | Khoản nợ | Nơi xử lý đề xuất |
|---|---|---|
| P2 | Chưa có tiến trình tự quét/cảnh báo lệnh `CHECKING`/`EXECUTING` kẹt | Gom vào tiến trình định kỳ BE-07; không tự gửi lại lệnh không rõ kết quả |
| P2 | Có khoảng trống giữa broadcast và lưu `txHash` | SC-03 tách ký khỏi phát, lưu nhận dạng giao dịch trước broadcast |

Hai dòng đã được ghi vào `docs/tech-report.md`; không mở rộng BE-17 sang scheduler hay ledger thật.

## 6. Tự đánh giá ba luật kiến trúc

- [x] Mọi call chain qua `ILedgerPort`; không thêm lời gọi chain ở UI/service ngoài port.
- [x] Mọi ký qua `ISigner`; BE-17 không thêm đường ký.
- [x] Mọi kiểm quyền qua RBAC; `order:execute` giữ nguyên chỉ ở `TELLER`.

## 7. Kết quả kiểm cuối

```text
$ bash scripts/run-local-all.sh
Đạt: 7
  PASS  luật kiến trúc (3 cảnh báo có sẵn/có chủ đích)
  PASS  marker
  PASS  checkpoint (bỏ qua khi chưa tạo file)
  PASS  contract EVM — 67 passing
  PASS  typecheck
  PASS  lint
  PASS  Vitest — 30 tệp, 790 test
Không đạt: 0

$ cd app && npx playwright test
  54 passed (45.6s)
```

Ba cảnh báo kiến trúc không do BE-17 sinh ra: `SIGNER_KIND` ngoài config, địa chỉ ví mẫu bị bộ quét
địa chỉ nhận diện, và lượt chạy không đặt `BASE_REF`. Không có thay đổi contract.
