# GIAO VIỆC: Tiếp nhận và hoàn thiện bộ test nghiệm thu spec P4 / P7 / P12

## Bối cảnh

Bạn nhận được gói `20260910_test_pack_spec_p4_p7_p12.zip` gồm bộ test kiểm chứng
acceptance criteria của 6 spec hợp đồng thông minh (3 spec EVM + 3 spec Stellar).

Bộ test này do Supervisor viết dựa trên việc đọc trực tiếp mã nguồn contract trong
repo, không phải viết theo phỏng đoán. Trạng thái kiểm chứng hiện tại:

| Phần | Đã chạy thật | Kết quả |
|---|---|---|
| Lớp 3 - luật kiến trúc (bash) | Có | Chạy được, phát hiện 2 nợ P1 |
| Lớp 1 - EVM (Hardhat) | Có | 53 test xanh, 1 skip có chủ đích |
| Lớp 1 - Soroban (Cargo) | **Chưa** | Chưa biên dịch thử lần nào |
| Lớp 2 - testnet | **Chưa** | Cần khóa ví và ETH/XLM test |

Nhiệm vụ của bạn là đưa bộ test vào repo, làm nó chạy được toàn bộ, và báo cáo
kết quả thật.

---

## PHẠM VI CÔNG VIỆC

### Task 1. Cài bộ test vào repo

Giải nén và trộn vào gốc repo theo đúng đường dẫn trong `README.md` của gói.
Không đổi tên file, không đổi cấu trúc thư mục.

Thêm **hai dòng** vào cuối `src/lib.rs` của ba crate `spt_token`,
`profit_distributor_pull`, `redemption`:

```rust
#[cfg(test)]
mod spec_tests;
```

Đây là thay đổi **duy nhất** được phép thực hiện với contract trong task này.

### Task 2. Làm cho 40 test Soroban biên dịch và chạy được

Chạy `cd packages/contracts-stellar && cargo test`.

Ba file `spec_tests.rs` được viết bám sát API test đang có trong repo
(`env.register`, `Client::new`, `mock_all_auths`, `try_*`), nhưng chưa từng được
biên dịch. Dự kiến cần sửa lỗi nhỏ về import hoặc lifetime.

Nếu vướng lifetime ở struct `Ctx`: cách gọn nhất là bỏ struct, khai báo biến rời
trong từng test.

**Bắt buộc:** ghi lại **chính xác đã sửa gì** ở mỗi file, để Supervisor biết bộ
test đã đúng API hay chưa. Đây là thông tin có giá trị, không được bỏ qua.

### Task 3. Chạy đủ ba lớp và ghi lại kết quả thật

```bash
bash scripts/run-local-all.sh
```

Dán **nguyên văn** output vào checkpoint, bao gồm cả phần FAIL. Không tóm tắt,
không làm đẹp số liệu.

### Task 4. Sửa 2 nợ P1 mà lớp 3 đang phát hiện

**4a. Lock file chưa commit.** `app/package-lock.json` bị `app/.gitignore` chặn
trong khi `Dockerfile` dùng `npm ci` (bắt buộc có lock). Hệ quả: clone sạch rồi
chạy `docker compose up` sẽ fail ở bước `COPY`.

- Bỏ dòng `package-lock.json` khỏi `app/.gitignore`
- `cd app && npm install`
- Commit `app/package-lock.json`

**4b. Đổi tên token chưa đồng bộ.** Còn **264 chỗ** dùng ký hiệu cũ. Đổi toàn bộ:

- `SPT` → `WPT` (Wind Project Token)
- `tVND` → `VNDB`

Phạm vi: `app/src`, `app/e2e`, `app/test`, `packages/` (gồm cả symbol trong
`VNDToken.sol` và contract Soroban), và tài liệu trong `docs/`.

**Cảnh báo quan trọng:** đổi nhãn giao diện sẽ **làm gãy selector trong
`app/e2e/`** (test đang bám đúng chuỗi `Số lượng SPT`, `Số dư SPT`). Phải sửa e2e
cùng lúc, không để lại cho vòng sau.

Sau khi đổi xong, bật test theo dõi món nợ này:

```bash
cd packages/contracts-evm && EXPECT_TOKEN_SYMBOLS=1 npx hardhat test
```

### Task 5. Cập nhật tài liệu

Theo quy tắc trong `.kiro/steering/tech-report-maintenance.md`:

- Xóa hai mục nợ P1 vừa sửa khỏi bảng 1.6.C của `tech-report.md`
- Cập nhật metadata đầu báo cáo (phiên bản, commit, ngày)
- Nếu quá trình sửa phát sinh bài học mới, thêm vào 1.6.A hoặc 1.6.B **và**
  `.kiro/steering/lessons.md`

---

## RÀNG BUỘC CỨNG

1. **Không sửa contract để test xanh.** Contract đã pass test là chuẩn. Nếu một
   test đỏ, nghĩa là test sai hoặc spec sai. Báo trong checkpoint kèm phân tích,
   **không** lặng lẽ đổi logic contract cho khớp test.

2. **Không xóa test.** Đặc biệt 5 test sau, chúng bắt đúng lỗi tốn tiền:
   - `P7-6` (EVM): thiếu `SNAPSHOT_ROLE` thì tạo kỳ chia thất bại
   - `P7-8` / `p7_8`: mua token sau khi chốt kỳ thì không được chia kỳ đó
   - `P12-12` / `p12_11`: kho thiếu tiền thì từ chối và **không** đốt token
   - `P12-13` so với `p12_7`: EVM cần approve, Soroban không cần
   - `p7_15` (Soroban): tua ledger 60 ngày rồi claim vẫn phải chạy được

3. **Ba luật kiến trúc không được vi phạm** trong mọi thay đổi.

4. **Chia commit nhỏ theo mục tiêu**, Conventional Commits, mỗi commit ở trạng
   thái build được. Gợi ý tách: cài bộ test / sửa biên dịch Soroban / fix lock
   file / đổi tên token / cập nhật tài liệu.

5. **Không sửa mò quá 2 lần** cho cùng một triệu chứng. Quá 2 lần thì dừng, ghi
   câu hỏi vào checkpoint.

---

## DEFINITION OF DONE

- [ ] Bộ test đã ở đúng đường dẫn trong repo
- [ ] `cargo test` xanh toàn bộ (40 test Soroban)
- [ ] `npx hardhat test` xanh toàn bộ (53 test EVM + 13 test cũ)
- [ ] `EXPECT_TOKEN_SYMBOLS=1 npx hardhat test` xanh (gồm cả P4-15)
- [ ] `bash scripts/verify-arch-rules.sh` không còn FAIL nào
- [ ] `app`: `npm run typecheck`, `npx eslint .`, `npm test`, `npm run test:e2e` đều xanh
- [ ] `docker compose up --build` chạy được từ một bản clone sạch
- [ ] `grep -rniE "\bSPT\b|tVND" app/src app/e2e app/test packages/ docs/` cho kết quả rỗng
- [ ] `tech-report.md` đã cập nhật, hai nợ P1 đã xóa khỏi 1.6.C
- [ ] Checkpoint đã viết đầy đủ theo mẫu dưới

---

## MẪU CHECKPOINT PHẢI NỘP

Đặt tại `docs/CHECKPOINT_TEST_PACK.md`:

```markdown
# Checkpoint: Tiếp nhận bộ test spec P4/P7/P12

## 1. Kết quả chạy (dán nguyên văn output)
### 3 luật kiến trúc
### cargo test
### hardhat test
### app: typecheck / lint / vitest / e2e
### docker compose up từ clone sạch

## 2. Sửa gì để Soroban biên dịch được
| File | Lỗi gặp | Đã sửa thế nào |
|---|---|---|

## 3. Đổi tên token
- Số chỗ đã đổi:
- File e2e đã sửa selector:
- Test P4-15 đã xanh: có/không

## 4. DEVIATION (làm khác yêu cầu)
Mỗi mục: làm khác gì, vì sao, hệ quả.

## 5. Câu hỏi mở
Mỗi mục: câu hỏi, hai cách hiểu khả dĩ, phương án bạn đề xuất.

## 6. Sai lệch phát hiện được
Chỗ nào test và contract/spec không khớp nhau.
```

---

## KHI KHÔNG CHẮC

Áp dụng quy tắc chống "kẹt" trong `.kiro/steering/workflow.md`: **dừng lại, không
đoán ý**. Ghi câu hỏi vào mục 5 của checkpoint kèm hai cách hiểu khả dĩ và phương
án bạn đề xuất.

Riêng với bộ test: nếu bạn cho rằng một test viết **sai** so với spec, đừng sửa
test rồi đi tiếp. Ghi vào mục 6, nêu rõ test nói gì, contract làm gì, spec yêu cầu
gì, rồi chờ Supervisor xác nhận.
