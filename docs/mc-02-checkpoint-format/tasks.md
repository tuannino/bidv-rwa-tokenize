# MC-02 — Khuôn checkpoint có mục tóm tắt bắt buộc: tasks

Nhánh `mc/02-checkpoint-format`, tạo **từ `dev`**.

## Bước 1: Khuôn và quy tắc

- [x] 1.1 Sửa `docs/CHECKPOINT_TEMPLATE.md`: thêm mục 0 theo `design.md` mục 1, kèm ví dụ điền sẵn.
- [x] 1.2 Tạo `.kiro/steering/checkpoint.md` với `inclusion: always`: mục 0 bắt buộc, hai ngưỡng, quy tắc con số kèm lệnh đo.
- [x] 1.3 Ghi rõ quy tắc con số áp dụng cho cả spec của Supervisor.

*Commit:* `docs(mc): khuôn checkpoint có mục tóm tắt bắt buộc`

## Bước 2: Script kiểm

- [x] 2.1 Tạo `scripts/check-checkpoint.mjs` với năm mã lỗi theo `design.md` mục 3.
- [x] 2.2 Hai ngưỡng đặt làm hằng số ở đầu script.
- [x] 2.3 Chế độ `--in-progress` đọc `.kiro/task-status.json`, không có task đang làm thì bỏ qua.
- [x] 2.4 Đếm điều kiện hoàn thành lấy **đúng mục** điều kiện hoàn thành trong `requirements.md`.
- [x] 2.5 Cắm vào `run-local-all.sh`.

*Commit:* `feat(mc): script kiểm khuôn checkpoint`

## Bước 3: Kiểm thử

- [x] 3.1 Tạo `app/test/check-checkpoint.test.ts`, chạy trên tệp mẫu trong thư mục tạm.
- [x] 3.2 Năm ca đỏ, mỗi ca một mã lỗi. Một ca xanh.
- [x] 3.3 **Kiểm chứng bằng đột biến**: cả năm trường hợp đều làm script đỏ. Ghi kết quả vào checkpoint.
- [x] 3.4 Xác nhận script **không** kiểm checkpoint của task đã hoàn thành.

*Commit:* `test(mc): kiểm thử script kiểm checkpoint`

## Bước 4: Hoàn tất

- [x] 4.1 Viết checkpoint của chính MC-02 theo khuôn mới, chạy script trên nó, phải xanh.
- [x] 4.2 Cập nhật `tech-report.md` mục quy trình và `tech-report-maintenance.md`.
- [x] 4.3 Cập nhật `.kiro/task-status.json`.
- [x] 4.4 Chạy `bash scripts/run-local-all.sh`.

*Commit:* `docs(mc): checkpoint MC-02 và cập nhật báo cáo`

## Việc KHÔNG được làm

- Không sửa checkpoint đã có, kể cả MC-01.
- Không kiểm checkpoint của task đã hoàn thành.
- Không thêm thư viện phân tích Markdown.
- Không cố máy kiểm quy tắc con số kèm lệnh đo. Đó là quy tắc cho người viết.

## Checkpoint

`docs/CHECKPOINT_MC02.md`, **theo đúng khuôn mới**, và phải qua được script do chính task này tạo.
