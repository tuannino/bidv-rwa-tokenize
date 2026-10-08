---
inclusion: always
---

# Làm việc hiệu quả

Mục tiêu là xong việc đúng và nhanh. Làm thừa cũng là lãng phí như làm thiếu.

**Khi tệp này mâu thuẫn với steering khác về mức kiểm chứng hay độ dài checkpoint, tệp này thắng.**

## 1. Làm đúng mức spec ghi, không tự thêm

Mỗi spec ghi **mức kiểm chứng** và **lệnh cần chạy**. Làm đúng chừng đó.

| Mức | Dùng cho | Kiểm chứng |
|---|---|---|
| **Cao** | tiền, quyền, dữ liệu người dùng, hợp đồng | test chức năng đầy đủ; đột biến chỉ cho chỗ spec chỉ định |
| **Vừa** | nghiệp vụ không đụng tiền, giao diện | test chức năng cho phần đã sửa |
| **Thấp** | công cụ nội bộ, quy trình, tài liệu | test cơ bản hoặc chạy thử một lần |

- Spec không ghi mức thì mặc định **vừa**.
- **Không tự thêm** đột biến, ca kiểm thử ngoài danh sách, hay tầng kiểm tra mới.
- Thấy rủi ro mà spec bỏ sót thì **ghi câu hỏi mở**, không tự làm thêm.

## 2. Chạy test theo mục Tác động

- Trong lúc làm: chỉ chạy test mà mục **Tác động** của spec chỉ ra.
- Cuối task: chạy `bash scripts/run-local-all.sh` **đúng một lần**.
- Không chạy toàn bộ sau mỗi bước.

## 3. Code ngắn gọn, không viết cứng

| Loại giá trị | Đặt ở đâu |
|---|---|
| Tham số nghiệp vụ: giá, tổng cung, ngưỡng, hạn mức | cơ sở dữ liệu, qua `SystemConfig` hoặc `Project` |
| Hằng số kỹ thuật: thời gian chờ, kích thước lô | hằng số có tên, ở đầu tệp hoặc trong `lib/config` |
| Giá trị trong test | đọc từ nguồn chung, không gõ lại số |

- Không lặp logic. Thấy logic đã có thì tái dùng.
- Không dựng lớp trừu tượng khi mới có một chỗ dùng.
- Viết phần cần thiết cho yêu cầu, không viết trước cho nhu cầu tương lai.

## 4. Checkpoint gọn

- Mục 0 theo `checkpoint.md` là bắt buộc.
- Theo chỉ định Owner ngày 08/10/2026: mọi lệnh ghi trong checkpoint phải là lệnh **đã chạy**;
  đầu ra phải **dán nguyên văn**, kèm mã thoát. Không thay đầu ra bằng chú thích hoặc số liệu gõ lại.
- Nhật ký dài tách sang `CHECKPOINT_<TASK>_DETAIL.md` theo `checkpoint.md`; tệp chính trỏ đúng mục.
- Không mô tả lại những gì đã rõ trong diff.

## 5. Đọc spec thế nào

Spec gồm:

- `requirements.md`: **Mục tiêu, Việc cần làm, Tác động, Mức kiểm chứng, Điều kiện hoàn thành, Không làm**.
- `tasks.md`: các bước, mỗi bước ghi test cần chạy.
- `design.md`: **chỉ có khi** có quyết định dễ bị hiểu sai. Không có tệp này là bình thường.

Mục "Điều kiện hoàn thành" giữ đúng tên vì `scripts/check-checkpoint.mjs` đếm ô `- [ ]` trong mục đó.
