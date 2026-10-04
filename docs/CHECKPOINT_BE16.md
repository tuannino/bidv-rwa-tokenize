# Báo cáo bàn giao — Task BE-16: Nạp VNDB mô phỏng cho bản trình diễn

| | |
|---|---|
| Mã task | BE-16 |
| Nhánh | `feat/demo-payment-mint`, tạo từ `dev` `bfb01b3` (= `origin/dev`, sau FE-25 PR #34) |
| Spec | `docs/be-16-demo-payment-mint/{requirements,tasks}.md` — không có `design.md` |
| Tiến độ | Bước 6/6 xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev` |

> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_BE16.md docs/be-16-demo-payment-mint/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Phương thức nạp có ở cả ba bản của tầng cổng chuỗi | ✅ | mục 3.1 |
| 2 | Bản chuỗi thật báo rõ nếu thiếu vai phát hành | ✅ | mục 3.1 |
| 3 | Hai lớp chặn hoạt động, cờ tắt thì từ chối cả vai có quyền | ✅ | mục 3.2 ca 2 · 3.3 đột biến 1 |
| 4 | Người bán không còn quyền nạp VNDB và nạp token mô phỏng | ✅ | mục 3.2 ca 3 · 3.3 đột biến 2 · 4 DV-2 |
| 5 | Giới hạn mỗi lần nạp đọc từ cấu hình | ✅ | mục 3.2 ca 5 |
| 6 | Sổ kiểm toán ghi đủ cả lần bị chặn | ✅ | mục 3.2 ca 6 |
| 7 | Giao dịch nạp vào bảng giao dịch, lịch sử thấy được | 🔶 | mục 3.2 ca 1 · 3.4 · 5 CH-3 |
| 8 | Cờ tắt thì mục menu ẩn và đường dẫn bị chặn | ✅ | mục 3.2 ca 7 · 3.4 |
| 9 | Sau khi nạp, luồng mua chạy được đầu cuối | ✅ | mục 3.2 ca 8 · 3.4 · 4 DV-4 |
| 10 | `run-local-all.sh` xanh | ✅ | mục 7 |

**Kết luận:** 9 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- **CH-1 — ĐÃ QUYẾT trong phiên, ghi lại cho Supervisor.** Sau khi nạp, lệnh mua vẫn chết ở phép kiểm
  ủy quyền VNDB (mock không có đường approve, chuỗi thật `@blocked SC-03`). Owner chọn: **mock
  `mintPayment` cộng kèm mức ủy quyền bằng số vừa nạp** — lệch `VNDToken.mint` có chủ ý. Mục 4 DV-4.
- **CH-2 — Phạm vi lời giao việc.** Owner giao "bắt đầu với task BE-14", nhưng tệp đính kèm chỉ có
  BE-16, FE-06, FE-24 và BE-14 đã `done`. Em hiểu là BE-16 (spec ghi "task đầu tiên của đợt 4").
  Owner xác nhận, hoặc chỉ ra BE-14 cần làm lại phần nào.
- **CH-3 — Màn đối soát chưa đọc bảng `Txn`.** `/reconciliation` là dữ liệu mẫu tĩnh
  (`MOCK_PROJECTS`), nên giao dịch nạp chỉ thấy ở bảng lịch sử màn nạp và lịch sử giao dịch chung ở
  `/mint`. Nối màn đối soát với dữ liệu thật là việc của task khác; Owner chọn task.

---

## 1. Đã làm

| Commit | Mục tiêu |
|---|---|
| `cdf7859` | Spec vào repo, BE-16 sang `inProgress` |
| `ec2ac1d` | `ILedgerPort.mintPayment` ở ba adapter; evm dịch thiếu `MINTER_ROLE` thành câu nêu ví, vai, hợp đồng |
| `1e4daa7` | Mock cộng kèm mức ủy quyền (Owner chốt, DV-4) |
| `78aac91` | `demo-payment.service.ts`, `app/actions/demo-payment.ts`, khoá `demo.payment_mint_max_vnd`, mã lỗi `PAYMENT_MINT_LIMIT` |
| `431c948` | Ca 3, 4 ở `rbac.test.ts` và `demo-payment.test.ts` |
| `d7f2685` | Màn `/demo-payment`, mục menu có điều kiện, sinh lại sơ đồ `purchase` và bảng điểm cắm |
| `a1cf0d0` | Ca 8 luồng mua đầu cuối |
| (cuối) | Báo cáo công nghệ 3.2, checkpoint này, kết quả `run-local-all.sh`, BE-16 sang `done` |

## 2. Đối chiếu DoD theo `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | BE-16 thêm vào `inProgress`, `scan-pending --check` xanh | ✅ | `cdf7859` |
| 1 | Việc 1, 2 cùng một commit; `mock-ledger.test.ts` | ✅ | mục 3.1 |
| 2 | Việc 3–7; ca 1, 2, 5, 6; đột biến bỏ lớp cờ | ✅ | mục 3.2, 3.3 |
| 3 | Việc 8, 9; ca 3, 4; đột biến trả quyền cho Người bán | ✅ | mục 3.2, 3.3, DV-2 |
| 4 | Việc 10–13; ca 7; `npx vitest run` | ✅ | mục 3.2, 3.4, 3.5 |
| 5 | Ca 8, các bước đã bấm | ✅ | mục 3.2, 3.4 |
| 6 | Báo cáo công nghệ, xoá nợ đường nạp VNDB, `done`, checkpoint, `run-local-all.sh` | ✅ | mục 6, 7 |

## 3. Cách chạy / kiểm thử

Chạy từ `app/`. Mức kiểm chứng **Cao**: đủ tám ca, đột biến **chỉ** hai chỗ spec chỉ định.

### 3.1 Tầng cổng chuỗi — `test/mock-ledger.test.ts` (4 test mới, tổng 61)

```
$ npx vitest run test/mock-ledger.test.ts
 Tests  61 passed (61)
```

Mock: cộng đúng số dư (kèm ủy quyền, DV-4), không đụng WPT/tổng cung; số tiền ≤ 0 bị chặn, số dư giữ.
Stellar: `LedgerNotImplementedError` nêu "token thanh toán VNDB bản Soroban". Chuỗi thật: thay
`simulateContract` của viem bằng một lần revert `AccessControlUnauthorizedAccount(ví, MINTER_ROLE)` mã
hoá thật (`encodeErrorResult`), kiểm câu lỗi chứa `<ví> thiếu vai MINTER_ROLE trên hợp đồng VNDToken
(<địa chỉ hardhat-local>)`.

### 3.2 Tám ca — `test/demo-payment.test.ts` (19 test) và `test/rbac.test.ts` (3 test mới, tổng 60)

```
$ npx vitest run test/rbac.test.ts test/demo-payment.test.ts test/mock-ledger.test.ts
 ✓ test/rbac.test.ts (60 tests)
 ✓ test/mock-ledger.test.ts (61 tests)
 ✓ test/demo-payment.test.ts (19 tests)
 Tests  140 passed (140)
```

| Ca | `describe` | Kiểm cả "không đổi"? |
|---|---|---|
| 1 | `ca 1` (3): số dư tăng đúng, trả số dư sau nạp, dòng `Txn` `payment-mint` `CONFIRMED`; lịch sử màn nạp thấy; ví chưa KYC bị từ chối | Có: ví lạ số dư 0, không dòng `Txn` |
| 2 | `ca 2` (4): cờ chưa đặt / `false` / `0` → `FORBIDDEN` dù `can(TELLER)` = true; màn không đọc được dữ liệu | Có: số dư 0, không dòng `Txn` |
| 3, 4 | `ca 3, 4` (3) + `rbac.test.ts` `BE-16` (3): SELLER, INVESTOR, CONTROLLER bị từ chối khi cờ bật; bảng quyền chỉ `TELLER` giữ hai quyền | Có: số dư 0, không `Txn`, một dòng `DENIED` |
| 5 | `ca 5` (2): `MAX + 1` chặn, `MAX` qua; hạ trần trong `SystemConfig` xuống 1000 thì 1001 bị chặn | Có |
| 6 | `ca 6` (3): `ALLOWED` + `SUCCESS` có vai, ví, số tiền; cờ tắt → `DENIED`; vượt trần và ví lạ → `FAILURE` có ai, ví nào, bao nhiêu | — |
| 7 | `ca 7` (3): cờ tắt không vai nào thấy mục; cờ bật chỉ TELLER thấy, ở nhóm Vận hành; trang và `AppLayout` dùng `canMintDemoPayment(role)` (đọc tệp thật) | — |
| 8 | `ca 8` (1): trần mua 0 → nạp 500 triệu → trần = số dư / giá; đặt lệnh, Giao dịch viên khớp; WPT nhà đầu tư, VNDB hai bên đúng | — |

### 3.3 Hai đột biến — ĐÃ CHẠY THẬT, cả hai đỏ

| Đột biến | Sửa tạm | Kết quả |
|---|---|---|
| 1. Bỏ lớp kiểm cờ, chỉ còn kiểm quyền | `demo-payment.service.ts`: `authorize(...)` bỏ `assertCanMintDemoPayment` (về `assertCan`), `demoPaymentContext` dùng `assertCan` | **5 failed / 7 passed** — đủ bốn ca 2 và `ca 6 > bị chặn vì cờ tắt` |
| 2. Trả `demo:mint-payment`, `demo:mint-token` cho `SELLER` | `permissions.ts` | **11 failed / 64 passed** — gồm `ca 3, 4 > SELLER ...` và ba ca `BE-16` ở `rbac.test.ts` |

Chép lại bản sao rồi chạy lại: 12/12 và 75/75.

### 3.4 Chạy thử ứng dụng thật (ca 7, ca 8 phần giao diện)

Chuỗi `mock`, bộ nhớ, `next dev`. Các bước đã bấm:

1. Cờ **tắt**, vai TELLER: menu sáu đường dẫn, không có `/demo-payment`; mở `/demo-payment` ra khối
   "Chức năng nạp VNDB mô phỏng không khả dụng".
2. Cờ **bật**, vai TELLER: menu có "Nạp VNDB (trình diễn)" ở nhóm Vận hành; màn có cảnh báo, gợi ý
   "Nhà đầu tư mẫu: 500.000.000", "Ví người bán: 1.000.000.000", trần 1.000.000.000.
3. Nạp 500 triệu cho `0x7099…79C8` chưa KYC → "không có trong danh sách nhà đầu tư".
4. `/mint` → "1 · KYC + Whitelist" ví đó → `whitelist=true`.
5. Nạp 1.000.000.001 → "vượt trần một lần nạp"; bấm gợi ý 500 triệu, "Nạp VNDB" → "Đã nạp
   500.000.000 VNDB … số dư mới 500.000.000 VNDB (CONFIRMED)", bảng lịch sử có dòng.
6. `/mint` → lịch sử giao dịch chung có `payment-mint … 500000000 CONFIRMED TELLER`.
7. Vai CONTROLLER, cờ bật: menu không có mục, `/demo-payment` bị chặn.

Phần đặt lệnh và khớp lệnh **không bấm được trên trình duyệt**: màn nhà đầu tư cần ví trình duyệt
(`injected`), trình duyệt thử không có tiện ích ví; màn khớp lệnh là FE-06. Phần đó chạy ở ca 8 mục 3.2,
qua đúng các hàm mà server action gọi.

### 3.5 Bộ kiểm toàn bộ

```
$ npx tsc --noEmit -p . && npx vitest run
 Test Files  26 passed (26)
      Tests  739 passed (739)
```

## 4. DEVIATION so với spec

- **DV-1. Nền nhánh.** Spec ghi "từ `dev` sau khi BE-15 đã merge"; không có BE-15 ở đâu
  (`git grep -n "BE-15" dev -- .` rỗng, không có trong `task-status.json`). Dùng `dev` `bfb01b3` = `origin/dev`.
- **DV-2. Việc 8, 9 không cần sửa mã.** Spec ghi quyền "cấp cho Giao dịch viên VÀ Người bán"; đo thật
  `git grep -n "^  SELLER:" dev -- app/src/lib/rbac/permissions.ts` → `SELLER` chỉ có
  `seller:read, wallet:connect, balance:read, txn:read, order:read, order:read:all`. Dùng số đo thật:
  chỉ thêm test chốt (ca 3, đột biến 2), không sửa `permissions.ts`.
- **DV-3. `env.ts`, `flags.ts` không sửa** dù nằm trong mục Tác động: cờ và `PublicConfig.demoPaymentMint`
  đã có từ BE-08. Mục menu dùng thẳng `canMintDemoPayment(role)` ở `AppLayout` (máy chủ).
- **DV-4. Mock cộng kèm mức ủy quyền** (Owner chốt, CH-1). Không có thì DoD 9 không đạt.
- **DV-5. "Danh sách nhà đầu tư" = ví đã KYC/whitelist trên chuỗi**, vì bảng `Investor` chưa có lời
  gọi nào đọc (`git grep -n "Investor\b" -- app/src/lib/store` chỉ ra ba dòng khai cột thời gian ở `postgres.pool.ts`, không có cổng đọc). Ngoại lệ ví người bán
  = `spvWallet()`; trên mock ví người bán luôn đã whitelist nên nhánh ngoại lệ không tách được bằng test.

## 5. Câu hỏi mở

- **CH-3.** Màn đối soát — xem 0.2.
- **CH-5. Lịch sử màn nạp lọc trong 200 giao dịch mới nhất** (`ponytail:` ở service) vì `listTxns` chưa
  lọc theo thao tác. Đề xuất thêm `operation?` vào `ITxnStore.listTxns` khi lịch sử cần đầy đủ.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort`: thêm `mintPayment`, service chỉ gọi `getLedger()`; component
  không nhập `viem`
- [x] Mọi ký qua `ISigner`: evm ký qua `signer.getAccount()` sẵn có; service chỉ đọc địa chỉ người ký
  bằng `signerAddressOrNull` (export lại từ `issuance.service.ts`, không viết bản thứ ba)
- [x] Mọi kiểm quyền qua RBAC: `authorize(..., assertCanMintDemoPayment)`; menu và trang dùng
  `canMintDemoPayment`, không `if (role === ...)`

Báo cáo công nghệ 3.2: metadata, đoạn "3.1 sang 3.2", cây 1.4, 3.1 (bảng 31 method + đoạn
`mintPayment`), 3.3 (nợ "`demo:mint-payment` chưa có nghiệp vụ gọi" đã xoá), 3.4, 3.6, 3.13, mục mới
3.19. 3.10 và `docs/flows/purchase.md` sinh lại bằng công cụ.

## 7. Kết quả `run-local-all.sh`

Chạy **đúng một** lần, cuối task, trước commit chuyển `done`: **mã thoát 0, cả năm phần PASS**.

```
$ bash scripts/run-local-all.sh
  => PASS có cảnh báo: luật kiến trúc   (PASS 20, WARN 3 — cả ba có từ trước: SIGNER_KIND ở
                                        signer/index.ts, địa chỉ mẫu ở mint.tsx, thiếu BASE_REF)
                                        Bảng quyền không teo lại so với origin/dev (32 -> 32 hành động)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)    21 điểm cắm, 13 điểm chặn, 35 bước luồng
  => PASS: LỚP 3 - KHUÔN CHECKPOINT     mục 0: 31/60 dòng, 10 dòng / 10 điều kiện
  => PASS: LỚP 1 - SPEC TEST CONTRACT EVM   67 passing
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
  => PASS: APP - VITEST                 26 tệp, 739 test
  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```
