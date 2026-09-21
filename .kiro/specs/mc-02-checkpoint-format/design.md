# MC-02 — Khuôn checkpoint có mục tóm tắt bắt buộc: design

## 1. Khuôn mục 0

```markdown
## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ requirements.md mục DoD) | | Bằng chứng |
|---|---|---|---|
| 1 | ... | ✅ | mục 3.2 |
| 2 | ... | 🔶 | mục 4, SL-1 |

**Kết luận:** 5 ✅ · 1 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có.
```

Ba ký hiệu trạng thái cố định: `✅` đạt, `🔶` đạt một phần, `❌` không đạt. Script đếm theo đúng ba ký hiệu này.

Cột bằng chứng ghi **số mục**, không ghi mô tả. Mục đích là người review nhảy thẳng tới chỗ cần kiểm.

## 2. Vì sao chọn các ngưỡng

| Ngưỡng | Giá trị | Lý do |
|---|---|---|
| Mục 0 | 60 dòng | Một trang màn hình. Đủ cho bảng khoảng 15 điều kiện cộng kết luận và việc cần quyết |
| Cả tệp trước khi phải tách | 800 dòng | Checkpoint lớn nhất hiện có ngoài MC-01 là 626 dòng. Ngưỡng 800 không làm vướng các task bình thường, chỉ chặn trường hợp như MC-01 |

Đặt hai ngưỡng làm hằng số ở đầu script để đổi được.

## 3. Script kiểm

```
scripts/check-checkpoint.mjs <đường-dẫn-checkpoint> <đường-dẫn-requirements>
scripts/check-checkpoint.mjs --in-progress     # đọc task-status.json, kiểm task đang làm
```

Năm phép kiểm, mỗi phép một mã lỗi để dễ đọc:

| Mã | Khi nào đỏ |
|---|---|
| `NO_SUMMARY` | không có tiêu đề mục 0 |
| `SUMMARY_TOO_LONG` | mục 0 vượt 60 dòng |
| `DOD_COUNT_MISMATCH` | số dòng bảng khác số ô `- [ ]` trong mục điều kiện hoàn thành của `requirements.md` |
| `MISSING_EVIDENCE` | có dòng bảng mà cột bằng chứng rỗng hoặc chỉ ghi "đã làm" |
| `NOT_SPLIT` | cả tệp vượt 800 dòng mà chưa có tệp `_DETAIL.md` |

Viết theo cùng kiểu với `scan-pending.mjs` của MC-01: mã lỗi, tệp, dòng, và câu giải thích cách sửa.

Chế độ `--in-progress` đọc `.kiro/task-status.json` mục `inProgress`, suy ra tên tệp checkpoint và tệp requirements tương ứng. Không có task nào đang làm thì bỏ qua, không đỏ.

## 4. Quy tắc con số kèm lệnh đo

Ghi vào steering, dạng:

```markdown
Mọi con số dùng làm bằng chứng phải kèm lệnh đo, ví dụ:

    $ git grep -c "@pending" -- app/src
    8

Áp dụng cho cả spec của Supervisor. Số trong spec lệch với số đo thật thì
dùng số đo thật và ghi thành mục sai lệch.
```

Phần này **không** có máy kiểm, vì không phân biệt được bằng máy đâu là con số làm bằng chứng. Nó là quy tắc cho người viết.

## 5. Tệp thay đổi

```
docs/CHECKPOINT_TEMPLATE.md            (sửa)  — thêm mục 0 và ví dụ
.kiro/steering/checkpoint.md           (mới)  — quy tắc checkpoint và con số kèm lệnh đo
scripts/check-checkpoint.mjs           (mới)
scripts/run-local-all.sh               (sửa)  — gọi --in-progress
app/test/check-checkpoint.test.ts      (mới)  — năm ca đỏ, một ca xanh, chạy trên tệp mẫu
```

Test chạy trên **tệp mẫu tạo trong thư mục tạm**, không chạy trên checkpoint thật, để không phụ thuộc trạng thái repo. Đây là cách MC-01 đã sửa ở SL-6.

## 6. Điểm cần chú ý

- Script đọc Markdown bằng quy tắc đơn giản: tiêu đề, dòng bắt đầu bằng `|`, ô `- [ ]`. Không cần thư viện phân tích Markdown, tránh thêm phụ thuộc.
- Đếm điều kiện hoàn thành trong `requirements.md` phải lấy **đúng mục** điều kiện hoàn thành, không đếm mọi ô `- [ ]` trong tệp.
- Checkpoint của chính MC-02 phải đạt quy tắc mới. Đây là phép thử đầu tiên cho khuôn.
