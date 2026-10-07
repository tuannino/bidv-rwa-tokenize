# OP-02 — các bước

> Trước khi bắt đầu: đọc `.kiro/steering/efficiency.md`, `branching.md`, `checkpoint.md`.
> Chuyển `OP-02` sang `inProgress` trong `.kiro/task-status.json` ở commit đầu.

## Bước 1 — Nhận nhánh và đo lại hiện trạng

Tạo `ops/02-demo-unblock` từ `dev` @ `abd1ceb`. Chạy ba lệnh đo ở mục "Hiện trạng đã đo" của
`requirements.md`. Số đo lệch spec thì **dùng số đo thật** và ghi vào checkpoint mục sai lệch.

## Bước 2 — Bỏ đòi khóa ký ở chain mock

Sửa `lib/signer/server.signer.ts`. Viết kiểm thử trước hoặc cùng lúc, phủ ca 1 và ca 2.
Ca 2 là ca quan trọng nhất của task: nó chứng minh việc nới chỉ áp cho `mock`.

Commit: `fix(signer): chain mock không đòi khóa ký, các chain khác giữ nguyên`

## Bước 3 — Mã commit vào bản dựng Cloudflare

Đặt `BUILD_COMMIT_SHA` và tên nhánh trong luồng dựng bản cho Cloudflare. Kiểm bằng cách dựng cục bộ
rồi gọi `/api/version`, dán kết quả thật vào checkpoint.

Commit: `fix(build): truyền mã commit vào bản dựng Cloudflare`

## Bước 4 — Sửa hướng dẫn trình diễn

Bốn mục 6 tới 9 của `requirements.md`. Đọc lại `nav-config.ts` để lấy đúng nhãn, **không chép từ
trí nhớ**. Sau khi sửa, tự đi lại toàn bộ `guide.md` từ bản sạch một lượt: mỗi bước bấm được thật
thì mới đánh dấu xong.

Commit: `docs(guide): sửa menu và bổ sung biến bí mật cần cho bản deploy`

## Bước 4b — Vá hai màn chi tiết ở chain mock

Mục E của `requirements.md`, ba việc 14 tới 16. Chép đúng khuôn ở `investor-orders.tsx` dòng 49 tới
78, **không nghĩ cách mới**: mục đích là làm hai màn giống hai màn kia, không phải thiết kế lại.

Ca 8 quan trọng ngang ca 6 và 7: nới cho `mock` không được làm mất lời mời kết nối ví ở chain thật.

Commit: `fix(investor): hai màn chi tiết chạy được ở chain mock không cần ví`

## Bước 5 — Dọn tài liệu

Bốn mục 10 tới 13. Xoá thư mục bằng `git rm -r`, không xoá tay.

Commit: `docs: dọn metadata báo cáo, chốt nguồn spec, ghi nợ cờ nạp VNDB`

## Bước 6 — Kiểm chứng và bàn giao

```bash
bash scripts/run-local-all.sh
```

Viết `docs/CHECKPOINT_OP02.md` theo `docs/CHECKPOINT_TEMPLATE.md`, mở đầu bằng mục 0 đối chiếu đủ
6 điều kiện hoàn thành kèm số mục chứa bằng chứng. Dán kết quả thật của phép đột biến.
Chuyển `OP-02` sang `done`. Cập nhật `docs/tech-report.md` theo
`docs/tech-report-maintenance.md`.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP02.md docs/op-02-demo-unblock/requirements.md
```
