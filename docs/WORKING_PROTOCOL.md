# Quy trình làm việc: Owner ⇄ Kiro ⇄ Supervisor(Claude)

## Vai trò
- **Owner (Sếp):** quyết định, điều phối, chuyển tiếp giữa Kiro và Supervisor.
- **Kiro:** thực thi code theo `.kiro/specs/*` và `.kiro/steering/*`.
- **Supervisor (Claude):** giám sát chất lượng, review, viết code mẫu khi cần. Repo public → Supervisor clone/đọc/chạy trực tiếp.

## Nhịp mỗi phase
1. Kiro hoàn thành `tasks.md` của feature → mở **1 PR** → điền `CHECKPOINT_TEMPLATE.md`.
2. Owner gửi link PR (hoặc branch) cho Supervisor.
3. Supervisor: clone/chạy test/thử build → trả **review** theo `REVIEW_TEMPLATE.md` (ưu tiên P0/P1/P2, kèm "cách đúng + ví dụ").
4. Owner chuyển review cho Kiro → Kiro sửa → lặp tới khi **PASS hết DoD** → merge.

## Báo cáo chất lượng
Mỗi lần nhận output của Kiro, Supervisor báo Owner: mục DoD **đạt/chưa**, rủi ro kiến trúc (3 LUẬT), điểm tốt cần giữ, việc cần sửa (xếp ưu tiên).

## Chống "kẹt" (Owner được báo ngay)
- Kiro không hiểu ý → hỏi rõ trong checkpoint (2 cách hiểu + đề xuất), KHÔNG đoán bừa.
- Cùng một lỗi trượt **2 vòng review** → Supervisor viết patch mẫu HOẶC báo Owner ngay kèm chẩn đoán đơn giản.

## Tương lai
Khi vào guồng, chuyển checkpoint/review sang **Jira** để tạo bằng chứng (issue = task, comment = review, trạng thái = DoD).
