# MC-02 — Khuôn checkpoint có mục tóm tắt bắt buộc: requirements

| | |
|---|---|
| Mã task | MC-02 |
| Nhóm | Make Control |
| Điểm | 2 |
| Ưu tiên | P1 |
| Phụ thuộc | MC-01 (đã merge) |
| Nhánh | `mc/02-checkpoint-format`, tạo **từ `dev`** |

## 1. Vì sao có task này

Checkpoint là thứ Supervisor dựa vào để nghiệm thu. Độ dài hiện tại, đo bằng `wc -l docs/CHECKPOINT_*.md`:

| Checkpoint | Số dòng |
|---|---|
| BE-01, BE-02, BE-08, BE-09, FE-01 v2, FE-02 | 278 đến 525 |
| **MC-01** | **5.013** |
| Khuôn `CHECKPOINT_TEMPLATE.md` | 25, gồm 6 mục, **không có mục tóm tắt** |

Chi tiết dài có giá trị làm vết, nhưng quá dài để review trọn. Checkpoint MC-01 review được nhờ **mục 0** mà Kiro tự thêm: hai bảng đối chiếu điều kiện hoàn thành, mỗi dòng trỏ tới mục chứa bằng chứng. Đọc mục 0 là biết cần kiểm chỗ nào.

Task này biến cách làm đó thành **quy tắc bắt buộc**, có máy kiểm.

## 2. Yêu cầu chức năng

### R1 — Mục 0 bắt buộc

- **R1.1** Mọi checkpoint PHẢI mở đầu bằng mục 0 tóm tắt, đặt ngay sau bảng thông tin task.
- **R1.2** Mục 0 PHẢI có bảng đối chiếu **đủ** các điều kiện hoàn thành trong `requirements.md` của task, không thêm không bớt.
- **R1.3** Mỗi dòng bảng PHẢI có: trạng thái (đạt, đạt một phần, không đạt) và **số mục** chứa bằng chứng. KHÔNG ghi "đã làm" thay cho bằng chứng.
- **R1.4** Mục 0 PHẢI có dòng kết luận đếm số điều kiện theo từng trạng thái.
- **R1.5** Mục 0 PHẢI có danh sách **việc cần Owner quyết**, nếu có. Để trống thì ghi rõ "không có".
- **R1.6** Mục 0 KHÔNG được vượt quá **60 dòng**, tương đương một trang màn hình.

### R2 — Con số phải kèm lệnh đo

- **R2.1** Mọi con số dùng làm bằng chứng trong checkpoint PHẢI kèm lệnh đã dùng để đo ra nó.
- **R2.2** Quy tắc này áp dụng cho **cả spec do Supervisor viết**, không riêng checkpoint của Kiro. Bài học từ MC-01: spec ghi 33 tệp, 27 export, 10 method, cả ba đều sai vì không kèm lệnh đo nên không ai kiểm lại được.
- **R2.3** KHI con số trong spec lệch với số đo thật, Kiro PHẢI dùng số đo thật và ghi thành mục sai lệch, KHÔNG làm theo số sai.

### R3 — Phần chi tiết

- **R3.1** Phần chi tiết đặt sau mục 0, giữ nguyên các mục hiện có của khuôn.
- **R3.2** KHI toàn bộ checkpoint vượt **800 dòng**, phần chi tiết PHẢI tách ra tệp riêng `CHECKPOINT_<TASK>_DETAIL.md`, tệp chính chỉ giữ mục 0 và các mục ngắn.
- **R3.3** Mục 0 của tệp chính PHẢI trỏ được sang đúng mục trong tệp chi tiết.

### R4 — Máy kiểm

- **R4.1** Hệ thống PHẢI có script kiểm một checkpoint theo R1 và R3.
- **R4.2** Script PHẢI báo đỏ khi: thiếu mục 0, mục 0 vượt 60 dòng, số dòng bảng đối chiếu khác số điều kiện hoàn thành trong `requirements.md`, có dòng thiếu cột bằng chứng, hoặc tệp vượt 800 dòng mà chưa tách.
- **R4.3** Script PHẢI được gọi trong `run-local-all.sh`, **chỉ kiểm checkpoint của task đang làm**, đọc từ `.kiro/task-status.json` mục `inProgress`.
- **R4.4** Script KHÔNG được kiểm checkpoint của task đã hoàn thành. Đó là vết lịch sử, không sửa lại.

### R5 — Khuôn và quy tắc

- **R5.1** `CHECKPOINT_TEMPLATE.md` PHẢI cập nhật có mục 0 theo R1, kèm ví dụ điền sẵn.
- **R5.2** Quy tắc PHẢI ghi vào `.kiro/steering/`.

## 3. Ngoài phạm vi

- Sửa các checkpoint đã có, kể cả MC-01. Chúng là vết lịch sử.
- Đổi quy trình nghiệm thu của Supervisor.

## 4. Điều kiện hoàn thành

- [ ] `CHECKPOINT_TEMPLATE.md` có mục 0 với ví dụ điền sẵn.
- [ ] Quy tắc có trong `.kiro/steering/`, gồm cả quy tắc con số kèm lệnh đo.
- [ ] Script kiểm checkpoint chạy được, báo đỏ đúng năm trường hợp ở R4.2.
- [ ] Script được gọi trong `run-local-all.sh`, chỉ kiểm task `inProgress`.
- [ ] Kiểm chứng bằng đột biến: cả năm trường hợp ở R4.2 đều làm script đỏ.
- [ ] Checkpoint của chính MC-02 đạt quy tắc mới.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
