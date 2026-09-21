# Báo cáo bàn giao — Task/Phase: <mã + tên>  (Kiro điền)

| | |
|---|---|
| Mã task | <MC-02, BE-03, …> |
| Nhánh | `<loại>/<tên>`, tạo **từ `dev`** (`<sha nền>`) |
| Spec | `docs/<tên-spec>/{requirements,design,tasks}.md` |
| Tiến độ | <Bước x/y xong. Chờ Supervisor nghiệm thu — Kiro **không** merge vào `dev`> |

> **Quy tắc viết checkpoint:** `.kiro/steering/checkpoint.md`.
> Kiểm bằng máy trước khi nộp: `node scripts/check-checkpoint.mjs <checkpoint> <requirements>`.

---

## 0. Tóm tắt nghiệm thu

<!-- BẮT BUỘC. Đây là mục Supervisor đọc đầu tiên và có thể đọc TRỌN trong một trang màn
     hình (≤ 60 dòng). Mọi thứ dài hơn thuộc phần chi tiết từ mục 1 trở xuống. -->

### 0.1 Đối chiếu điều kiện hoàn thành

Lấy **đủ** các ô `- [ ]` ở mục "Điều kiện hoàn thành" của `requirements.md`, **không thêm không
bớt**. Cột bằng chứng ghi **số mục của checkpoint này**, không ghi "đã làm".

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | <nguyên văn, rút gọn> | ✅ | mục 3.2 |
| 2 | <nguyên văn, rút gọn> | 🔶 | mục 4, SL-1 |

**Kết luận:** 5 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có.

---

## 1. Đã làm
- <tóm tắt thay đổi chính, PR/branch: link>

## 2. Đối chiếu DoD
| Task | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| T.. | .. | ✅/❌ | .. |

## 3. Cách chạy/kiểm thử
```
<lệnh để Supervisor tái hiện: docker compose up / npm test / demo runner>
```

## 4. DEVIATION so với spec (nếu có)
- <mục>: <làm khác gì> — <lý do>

## 5. Câu hỏi mở / chỗ chưa chắc
- <nếu không hiểu ý: nêu 2 cách hiểu + phương án đề xuất>

## 6. Tự đánh giá 3 LUẬT kiến trúc
- [ ] Mọi call chain qua ILedgerPort
- [ ] Mọi ký qua ISigner
- [ ] Mọi kiểm quyền qua RBAC

---

# Ví dụ điền sẵn mục 0

> Phần dưới **không thuộc khuôn**, chỉ là mẫu đã điền để thấy ba ký hiệu trạng thái và cột bằng
> chứng dùng thế nào. Lấy từ một task giả có 4 điều kiện hoàn thành.

```markdown
## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Cổng `IRedemptionStore` có bản bộ nhớ và bản Postgres | ✅ | mục 1 (Bước 2) · 3.3 |
| 2 | Ràng buộc `(roundId, holderWallet)` duy nhất, có test | ✅ | mục 3.4 (12 test) · 5 (đột biến 2) |
| 3 | `evm.adapter` nối được cờ "đang tất toán" | ❌ | mục 5 (SC-04 chưa chốt) · 0.2 |
| 4 | `bash scripts/run-local-all.sh` xanh toàn bộ | 🔶 | mục 3.9 — 7 PASS / 0 FAIL, **bỏ qua** Soroban vì máy chưa có cargo |

**Kết luận:** 2 ✅ · 1 🔶 · 1 ❌

### 0.2 Việc cần Owner quyết

- **SC-04 — cờ "đang tất toán" nằm ở contract nào.** Hai ứng viên hiện có ngược hướng nhau
  (`Redemption.paused` là "tạm dừng", không phải "bật tất toán"). Đề xuất: thêm hàm riêng ở
  `Redemption`. Chi tiết ở mục 5.
```

Ba ký hiệu **cố định**, script đếm theo đúng ba ký hiệu này:

| Ký hiệu | Nghĩa | Khi nào dùng |
|---|---|---|
| ✅ | đạt | làm đủ điều kiện, có bằng chứng chạy được |
| 🔶 | đạt một phần | làm được phần lớn nhưng còn khoảng cách — **phải** nói rõ khoảng cách ở mục được trỏ tới |
| ❌ | không đạt | chưa làm, hoặc bị chặn — **phải** có dòng tương ứng ở 0.2 |

**Con số phải kèm lệnh đo.** Mọi con số dùng làm bằng chứng (số test, số tệp, số dòng) phải kèm
lệnh đã dùng để đo ra nó, ví dụ:

```
$ git grep -c "@pending" -- app/src
8
```

Số không có lệnh đo thì Supervisor không kiểm lại được, và nó đã sai thật ở MC-01. Quy tắc đầy
đủ: `.kiro/steering/checkpoint.md`.
