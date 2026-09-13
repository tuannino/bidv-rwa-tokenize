# Báo cáo bàn giao — Phase/Feature: <tên>  (Kiro điền)

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
