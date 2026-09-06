---
inclusion: always
---
# Cách làm việc giữa Kiro (thực thi) và Supervisor (Claude)

Con người (Owner) là cầu nối chuyển tiếp giữa hai bên. Repo public → Supervisor đọc/chạy trực tiếp được.

## Vòng lặp mỗi phase/feature
1. Kiro làm theo `.kiro/specs/<feature>/tasks.md`, mở **1 PR/phase**, điền `docs/CHECKPOINT_TEMPLATE.md`.
2. Supervisor review (chạy test/thử build), trả feedback theo `docs/REVIEW_TEMPLATE.md`: mỗi mục có **Vấn đề → Vì sao → Cách đúng + ví dụ → Tham chiếu → điều kiện "đã xong"**, gán ưu tiên **P0 (chặn) / P1 / P2**.
3. Kiro sửa, push commit mới, cập nhật checkpoint. Lặp tới khi PASS hết DoD.

## Định nghĩa "xong" (DoD)
Mỗi task/phase có DoD trong spec. Chưa đạt DoD thì chưa merge. Cổng P1 (mint) bắt buộc kiểm 3 LUẬT kiến trúc (ILedgerPort/ISigner/RBAC).

## QUY TẮC CHỐNG "KẸT" (quan trọng)
- Nếu Kiro **không hiểu ý** một yêu cầu: DỪNG đoán, ghi câu hỏi rõ ràng vào checkpoint (mục "Câu hỏi mở"), nêu 2 cách hiểu khả dĩ + phương án đề xuất.
- Nếu **cùng một lỗi/DoD trượt qua 2 vòng review**: coi là "kẹt". Kiro DỪNG vá lẻ, tổng hợp: đã thử gì, lỗi gì, giả thuyết nguyên nhân. Supervisor sẽ (a) viết code mẫu/patch tham chiếu, hoặc (b) **báo Owner ngay** rằng có khoảng cách hiểu, kèm chẩn đoán bằng ngôn ngữ đơn giản.
- Không "sửa mò" quá 2 lần cho cùng một triệu chứng.

## Bài học
Lỗi/thói quen sai lặp lại → được nâng thành rule trong `lessons.md` (nạp always) để không tái phạm.

## ⚠️ Next.js 16
Đọc `node_modules/next/dist/docs/` + `app/AGENTS.md` trước khi sửa `app/`. Đây là nguồn lỗi hay gặp.
