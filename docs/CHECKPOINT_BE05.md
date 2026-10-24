# Báo cáo bàn giao — BE-05: thu hồi WPT khi dự án hết hạn

| | |
|---|---|
| Mã task | BE-05 |
| Nhánh | `feat/be-05-fe-10-thu-hoi`, tạo từ `dev` (`c35fa17`) |
| Spec | `docs/be-05-fe-10-thu-hoi/{requirements,design,tasks}.md` bản 2 |
| Phạm vi | Backend BE-05; FE-10 không thực hiện trong lượt này |
| Tiến độ | Đã bổ sung sau nghiệm thu lần 1: đủ ca máy chủ được yêu cầu, 15/15 đột biến bị bắt và ba thiếu sót mã đã sửa; chờ Supervisor nghiệm thu lại |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành BE-05

| # | Điều kiện | | Bằng chứng |
|---|---|---|---|
| 1 | Lược đồ, cổng kho và hai hiện thực memory/Postgres đủ trạng thái thu hồi | ✅ | mục 1.1 · 3.2 |
| 2 | Quyền mở/thu hồi chỉ Kiểm soát viên, từ chối có audit | ✅ | mục 1.2 · 3.1 |
| 3 | Pha ngày Việt Nam chặn mua/bán, Mint và chia đúng thời điểm | ✅ | mục 1.3 · 3.1 |
| 4 | Đóng/mở đóng băng có khoá chain, lưu hash trước receipt và phục hồi | ✅ | mục 1.4 · 3.1 · 3.3 |
| 5 | Burn theo lô 10, loại SPV, đối soát treo và đóng dự án nguyên tử | ✅ | mục 1.5 · 3.1 · 3.3 |
| 6 | Tổng quan và dữ liệu portfolio không thêm action/audit đọc | ✅ | mục 1.6 · 2 |
| 7 | Mock và EVM nối pause/unpause, burn ví bị băng, `isTransactionKnown` | ✅ | mục 1.4 · 3.3 |
| 8 | Tài liệu, runbook, trạng thái task và marker cập nhật | ✅ | mục 1.8 · 3.4 |
| 9 | Các ca 3, 5–7, 9–16, 18–20, 22, 25–26, 28–30 và 15 đột biến của spec có bằng chứng | ✅ | mục 3.1 · 3.3 · 3.5 |

**Kết luận:** 9 ✅ · 0 🔶 · 0 ❌. Nghiệm thu lần 1 phát hiện phần kiểm chứng quá mỏng; lượt sửa
này tăng 30 ca Vitest, mở rộng ca Hardhat và chạy đủ bảng đột biến ở mục 3.5.

### 0.2 Việc cần Owner quyết

- Chỉ chạy thu hồi trên Sepolia sau quyết định riêng của Sếp. Sau giao dịch đốt đầu tiên, chức
  năng này không thể đảo ngược.
- FE-10 vẫn ở `planned`: backend đã có actions/dữ liệu nhưng chưa có màn `/recall` hay hộp thông
  báo/nhãn giao diện.

## 1. Đã làm

### 1.1 Dữ liệu và kho

- Mở rộng `SettlementRound`, `SettlementCase`; thêm `activeChain` duy nhất.
- Thêm đầy đủ thao tác mở/sửa/huỷ, đóng/mở băng, lập bổ sung/chiếm/gắn hash/chốt hồ sơ và hoàn tất
  đợt; hoàn tất đổi Project sang `CLOSED` trong cùng transaction.
- `VaultOperationLock` có loại `RECALL` và mốc tiếp quản riêng.

### 1.2 Quyền

- Chuyển `settlement:initiate` từ TELLER sang CONTROLLER.
- Thêm `settlement:recall`, chỉ CONTROLLER. Teller vẫn được đọc qua `ops:read`.
- Đây là ngoại lệ maker-checker có chủ đích theo quyết định của Sếp trong spec.

### 1.3 Pha và chốt chặn nghiệp vụ

- Một nguồn `recall-phase.ts` tính `SCHEDULED`, `NOTICE`, `FROZEN`, `CLOSED` theo ngày Việt Nam.
- Chặn xem trước/đặt lệnh mua bán và Mint từ NOTICE; chặn mở/duyệt/tiếp tục chia từ FROZEN/CLOSED.
- `getPortfolio`, `getTradeContext`, tổng quan Người bán dùng cùng phép quyết định.

### 1.4 Chuỗi và phục hồi

- EVM nối `pause`, `unpause`, `paused`, `getTransaction`; mock giữ cùng luật lỗi.
- Tách `submitTxn`: luôn lưu `Txn` PENDING và gắn hash nghiệp vụ trước khi chờ receipt.
- Đóng/mở băng giữ dấu khi mất kết nối; lần sau đối soát hoặc gửi lại an toàn.

### 1.5 Thu hồi

- Danh sách từ Indexer, loại vault SPV và số dư 0; mỗi lượt tối đa 10 hồ sơ.
- Burn được ví đang bị đóng băng riêng; BURNING/FAILED có đường phục hồi, không gửi lại mù khi đã
  có hash.
- Lỗi gửi burn không phải revert được trả về theo từng `{ wallet, reason }`; dấu BURNING được giữ
  để lượt sau đối soát thay vì tự kết luận giao dịch chưa phát.
- Chỉ đóng đợt khi mọi hồ sơ BURNED và nguồn cung ngoài vault bằng 0.

### 1.6 API đọc

- Thêm bảy server actions backend trong `app/actions/recall.ts`.
- `getRecallOverview` dùng `assertCan('ops:read')`, không ghi audit; portfolio dùng action sẵn có.
- `burnedAmount` của tổng quan và portfolio đọc `amount` từ dòng `Txn` loại `recall` khớp
  `burnTxHash`, không dùng số dư chụp lúc lập hồ sơ.

### 1.7 Sổ kiểm toán

- Mở đợt ghi dòng `SUCCESS` nguyên tử cùng đợt, gồm `maturityDate`, `recallFrom`, số ngày báo trước
  và lý do. Bản Postgres đặt cả hai lệnh trong cùng transaction.

### 1.8 Tài liệu

- Lưu spec bản 2; cập nhật UserGuide, tech-report, runbook và task-status chỉ cho BE-05.

## 2. Hiệu năng và phạm vi

- Không thêm action khi mở `/portfolio`, `/trade` hay tổng quan Người bán; các service hiện hữu đọc
  thêm pha trong cùng action.
- Một `recallBatch` cắt danh sách ở `RECALL_BATCH_SIZE=10`; các receipt vừa gửi được chờ song song
  với một hạn chung.
- FE-10 chưa làm nên chưa đo action của `/recall`; action tổng quan backend đã được gom thành một
  lời gọi để FE-10 dùng sau.

## 3. Kiểm chứng

### 3.1 Toàn bộ app trên memory

```text
$ (cd app && npx vitest --run)
Test Files 61 passed | 14 skipped (75)
Tests      1184 passed | 90 skipped (1274)
```

Riêng `be-05-recall.test.ts` có 37 ca và `token-request.test.ts` có 35 ca. Các ca máy chủ Supervisor
yêu cầu bổ sung đã được gắn số ngay trong tên test: 3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16,
18, 19, 20, 22, 25, 26, 28 và 29.

### 3.2 PostgreSQL 16 thật, database trống cô lập

```text
$ TEST_DATABASE_URL=postgresql://…/bidv_be05_recheck npx vitest --run
Test Files 65 passed | 10 skipped (75)
Tests      1290 passed | 70 skipped (1360)

$ TEST_DATABASE_URL=postgresql://…/bidv_rwa npx vitest --run test/be-05-recall-postgres.test.ts
Test Files 1 passed; Tests 2 passed
```

Ca riêng kiểm cột/index, audit mở đợt, 1.001 hồ sơ chia lô, tranh claim chỉ một bên thắng, claim
lại xoá hash cũ, chặn unfreeze sau burn và đóng Project cùng SettlementRound. Database
`bidv_be05_recheck` đã xoá sau phép đo.

### 3.3 Hardhat thật

```text
$ TEST_HARDHAT_RPC=http://127.0.0.1:18545 npx vitest --run test/be-05-recall-evm.test.ts
Test Files 1 passed; Tests 1 passed
```

Ca 24 và 30: phát hành vào ví SPV, chuyển cho hai nhà đầu tư, đóng băng riêng một ví, pause toàn
token và chứng minh transfer revert; sau đó unpause, chứng minh transfer chạy lại, pause lần hai,
burn hai ví, nguồn cung ngoài SPV về 0 và Project CLOSED.

### 3.4 Kiểm kiểu và hợp đồng

```text
$ (cd app && npm run typecheck)
exit=0
$ (cd app && npm run build)
Compiled successfully; TypeScript và 33 route hoàn tất, exit=0.
$ (cd app && npm run lint)
exit=0
$ (cd packages/contracts-evm && npx hardhat compile)
Compiled 58 Solidity files successfully (evm target: cancun).
$ bash scripts/run-local-all.sh arch markers checkpoint app
6/6 phép kiểm đạt; 3 cảnh báo tồn tại từ trước.
```

### 3.5 Đột biến

Mỗi đột biến dưới đây được áp dụng riêng, chạy ca hẹp, xác nhận đỏ rồi hoàn nguyên trước đột biến
tiếp theo. Sau cùng `git diff --check` và phép quét mẫu đột biến đều sạch.

| # | Đột biến đã chạy | Ca đỏ |
|---:|---|---|
| 1 | Bỏ chặn thu hồi trong `placeOrder` | `be-05-recall` ca 5 |
| 2 | Bỏ chặn duyệt Mint | `token-request` ca 5 |
| 3 | Gắn `burnTxHash` sau khi chờ receipt | `be-05-recall` ca 14 |
| 4 | Gắn `freezeTxHash` sau khi chờ receipt | `be-05-recall` ca 10 |
| 5 | Bỏ khoá thao tác chain trong `recallBatch` | `be-05-recall` ca 16 |
| 6 | Claim hồ sơ không xoá hash cũ | `be-05-recall` ca 15; bản SQL cũng đỏ `be-05-recall-postgres` |
| 7 | Hoàn tất mà không kiểm tổng cung ngoài vault | `be-05-recall` ca 18 |
| 8 | Bỏ chặn lệnh đang xử lý và kỳ chia khi đóng băng | `be-05-recall` ca 7 |
| 9 | Không loại ví SPV khỏi danh sách | `be-05-recall`: đóng băng loại ví SPV |
| 10 | Service cho huỷ sau khi đã ghi `freezeRequestedAt` | `be-05-recall` ca 11/12 |
| 11 | Xoá dấu đóng băng khi lỗi gửi không phải revert | `be-05-recall` ca 11/12 |
| 12 | Tổng quan dùng `authorize` thay `assertCan` | `be-05-recall` ca 22 |
| 13 | Cho mở đóng băng khi đã BURNING/BURNED | `be-05-recall` ca 28 |
| 14 | Cờ demo cho phép ngày hết hạn quá khứ | `be-05-recall` ca 25 |
| 15 | Không chặn thu hồi khi đang mở đóng băng | `be-05-recall` ca 29 |

**Kết quả:** 15/15 đột biến làm ít nhất một ca đỏ; không còn đột biến sống trong danh sách mục 8
của `requirements.md`.

## 4. DEVIATION so với spec

- User yêu cầu BE-05 nên không triển khai FE-10, không chuyển FE-10 sang `done`, không chạy E2E UI
  ca 31 và không đo action của màn `/recall` chưa tồn tại.
- Spec gộp BE-05/FE-10 không có mục `Điều kiện hoàn thành` dạng checkbox, nên checkpoint này đối
  chiếu tám nhóm yêu cầu BE-05 thay vì chạy được phép đếm DoD tự động của khuôn MC-02.
- Không thay hợp đồng: `ProjectToken` đã có pause/unpause và agent burn đúng điều kiện.
- Khi cập nhật tài liệu sau nghiệm thu, phát hiện ma trận RBAC trong `tech-report.md` còn ghi 32
  action và gán `settlement:initiate` cho TELLER dù mã hiện có 38 action và BE-05 đã chuyển quyền
  này sang CONTROLLER. Đã sửa ma trận theo `ACTIONS`/`ROLE_PERMISSIONS`; không đổi mã quyền.

## 5. Câu hỏi mở / nợ kỹ thuật

- SC-04: chi trả VNDB theo NAV và hợp đồng tất toán đầy đủ.
- Không mở đóng băng sau lần đốt đầu tiên; không mở lại Project đã CLOSED.
- WPT còn trong vault SPV tiếp tục qua Burn maker-checker BE-12.
- Trước 5.000 ví cần phân trang Indexer thay vì từ chối khi `truncated`.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] Mọi call chain qua `ILedgerPort`.
- [x] Mọi ký qua `ISigner`; service không giữ private key.
- [x] Mọi kiểm quyền ghi qua RBAC/`authorize`; đọc tổng quan dùng `assertCan`.
