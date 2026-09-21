---
inclusion: always
---

# Quy tắc viết checkpoint

Checkpoint là thứ **duy nhất** Supervisor dựa vào để nghiệm thu. Nó phải làm được hai việc mâu
thuẫn nhau: **đọc trọn trong một trang** để quyết được, và **giữ đủ vết** để lần lại sau này.

Cách giải: tách hai vai. **Mục 0** là bản để quyết. Mục 1 trở xuống là vết.

> Khuôn đầy đủ kèm ví dụ điền sẵn: `docs/CHECKPOINT_TEMPLATE.md`.
> Máy kiểm: `node scripts/check-checkpoint.mjs <checkpoint> <requirements>`.

---

## 1. Mục 0 là bắt buộc

Mọi checkpoint mở đầu bằng mục 0, đặt **ngay sau bảng thông tin task**, trước mọi mục chi tiết.

| # | Bắt buộc | Vì sao |
|---|---|---|
| 1 | Bảng đối chiếu **đủ** các điều kiện hoàn thành ở `requirements.md`, **không thêm không bớt** | Thiếu một dòng là một điều kiện không ai đối chiếu. Thêm dòng lạ là đổi phạm vi nghiệm thu mà không ai chốt |
| 2 | Mỗi dòng có **trạng thái** và **số mục chứa bằng chứng** | Supervisor nhảy thẳng tới chỗ cần kiểm |
| 3 | Dòng **kết luận** đếm theo từng trạng thái | Đọc một dòng là biết task ở đâu |
| 4 | Mục **việc cần Owner quyết**; không có thì ghi rõ "không có" | Để trống thì không phân biệt được "không có gì cần quyết" với "quên viết" |
| 5 | Mục 0 **không vượt 60 dòng** | Đúng một trang màn hình. Xem ngưỡng ở mục 3 |

Ba ký hiệu trạng thái **cố định**, script đếm theo đúng ba ký hiệu này:

| Ký hiệu | Nghĩa | Ràng buộc kèm theo |
|---|---|---|
| ✅ | đạt | có bằng chứng chạy được, không phải lời khẳng định |
| 🔶 | đạt một phần | **phải** nói rõ khoảng cách còn lại ở mục được trỏ tới |
| ❌ | không đạt | **phải** có dòng tương ứng ở mục "việc cần Owner quyết" |

**Cột bằng chứng ghi số mục, không ghi mô tả.** Viết "đã làm", "xong", "ok" là không ghi bằng
chứng — script báo `MISSING_EVIDENCE`. Lý do: "đã làm" trả lời đúng câu hỏi mà người review
đang muốn tự kiểm, nên nó lấy mất chính việc họ cần làm.

---

## 2. Con số phải kèm lệnh đo

Mọi con số dùng làm **bằng chứng** (số test, số tệp, số dòng, số method, số chỗ phải sửa) phải
kèm lệnh đã dùng để đo ra nó:

```
$ git grep -c "@pending" -- app/src
8
```

**Áp dụng cho cả spec do Supervisor viết, không riêng checkpoint của Kiro.** Đây là bài học có
thiệt hại thật ở MC-01: spec ghi 33 tệp, 27 export, 10 method — cả ba đều sai, và sai đó đi
được xa vì không con số nào kèm lệnh đo nên không ai kiểm lại được.

**Khi con số trong spec lệch số đo thật:** dùng **số đo thật**, ghi thành một mục sai lệch
trong checkpoint, và **không** làm theo số sai. Không im lặng sửa, cũng không im lặng làm theo.

Đo lại **trước khi lập kế hoạch**, không phải sau khi làm xong: kế hoạch dựng trên con số sai
thì mọi ước lượng trong đó đều sai theo.

Phần này **không có máy kiểm**, và cố ý không có: máy không phân biệt được đâu là con số làm
bằng chứng, đâu là con số trong câu văn bình thường. Nó là quy tắc cho người viết.

---

## 3. Hai ngưỡng

| Ngưỡng | Giá trị | Vì sao con số đó |
|---|---|---|
| Mục 0 | **60 dòng** | Một trang màn hình. Đủ cho bảng khoảng 15 điều kiện cộng kết luận và việc cần quyết. Đo trên tiền lệ: mục 0 của `CHECKPOINT_MC01.md` dài **43** dòng, nằm trong ngưỡng mà không phải cắt gì |
| Cả tệp, trước khi phải tách | **800 dòng** | Checkpoint lớn nhất hiện có ngoài MC-01 là **626** dòng (`CHECKPOINT_TEST_PACK.md`). Ngưỡng 800 không làm vướng task bình thường, chỉ chặn trường hợp như MC-01 (**5013** dòng) |

Lệnh đo hai con số trên:

```bash
# Độ dài mục 0 của một checkpoint (từ "## 0." tới trước "## 1.")
awk '/^## 0\./{f=1} /^## 1\./{if(f){print NR-s; exit}} f&&!s{s=NR}' docs/CHECKPOINT_MC01.md

# Độ dài toàn bộ các checkpoint
wc -l docs/CHECKPOINT_*.md | sort -n
```

**Khi cả tệp vượt 800 dòng:** tách phần chi tiết ra `docs/CHECKPOINT_<TASK>_DETAIL.md`, tệp
chính giữ mục 0 và các mục ngắn. Mục 0 của tệp chính phải **trỏ được** sang đúng mục trong tệp
chi tiết, nếu không thì việc tách chỉ làm bằng chứng khó tìm hơn.

Hai ngưỡng là **hằng số ở đầu `scripts/check-checkpoint.mjs`** (`MAX_SUMMARY_LINES`,
`MAX_FILE_LINES`). Cần đổi thì đổi ở đó và sửa bảng này trong cùng commit.

---

## 4. Máy kiểm và giới hạn của nó

```bash
# Kiểm một checkpoint cụ thể
node scripts/check-checkpoint.mjs docs/CHECKPOINT_MC02.md docs/mc-02-checkpoint-format/requirements.md

# Kiểm checkpoint của task đang làm, đọc từ .kiro/task-status.json
node scripts/check-checkpoint.mjs --in-progress
```

Năm phép kiểm, mỗi phép một mã lỗi:

| Mã | Khi nào đỏ |
|---|---|
| `NO_SUMMARY` | không có tiêu đề mục 0 |
| `SUMMARY_TOO_LONG` | mục 0 vượt 60 dòng |
| `DOD_COUNT_MISMATCH` | số dòng bảng đối chiếu khác số ô `- [ ]` ở mục điều kiện hoàn thành của `requirements.md` |
| `MISSING_EVIDENCE` | có dòng mà cột bằng chứng rỗng hoặc chỉ ghi "đã làm" |
| `NOT_SPLIT` | cả tệp vượt 800 dòng mà chưa có tệp `_DETAIL.md` |

`--in-progress` nằm trong `scripts/run-local-all.sh`. Nó **chỉ kiểm checkpoint của task đang
làm**, đọc từ `.kiro/task-status.json` mục `inProgress`.

**Checkpoint của task đã `done` thì script không chạm.** Đó là vết lịch sử, và sửa lại vết lịch
sử để vừa một quy tắc ra sau là làm sai chính thứ mà vết đó dùng để ghi. Kể cả
`CHECKPOINT_MC01.md` — nó **không** đạt ngưỡng 800 dòng, và đó là dữ liệu chứ không phải lỗi
cần vá.

Ba thứ máy **không** kiểm, nên chúng thuộc trách nhiệm người viết:

- **Con số có kèm lệnh đo hay không** — lý do ở mục 2.
- **Bằng chứng có thật hay không.** Script chỉ kiểm cột bằng chứng có nội dung; nội dung đó trỏ
  đúng mục hay không thì Supervisor đọc.
- **Trạng thái có đúng hay không.** Ghi ✅ cho một việc chưa xong thì script vẫn xanh.

Ba chỗ đó là nơi một checkpoint hợp khuôn vẫn có thể vô dụng. Máy kiểm chỉ dọn phần cơ học.

---

## 5. Quan hệ với các quy tắc khác

| Việc | Ở đâu |
|---|---|
| Vòng lặp Kiro ↔ Supervisor, quy tắc chống "kẹt" | `.kiro/steering/workflow.md` |
| Tự kiểm trước khi mở PR (§11), nền nhánh phải là `dev` | `.kiro/steering/branching.md` |
| Cập nhật `docs/tech-report.md` và `.kiro/task-status.json` | `docs/tech-report-maintenance.md` |
| Marker `@pending` / `@blocked` / `@flow` | `.kiro/steering/make-control.md` |

Checkpoint **không thay** những thứ trên. Nó là chỗ **trình bằng chứng** rằng chúng đã được làm.
