# BE-08 — Bổ sung quyền RBAC: tasks

Nhánh `feat/rbac-actions`, tạo **từ `dev`**. Làm đầu tiên trong nhóm backend.

## Bước 1: Thêm hành động

- [ ] 1.1 Thêm 10 hành động mới vào `ACTIONS` trong `permissions.ts`, nhóm theo bình luận rõ ràng.
- [ ] 1.2 Thêm `reconcile:read` vào hằng số `READ_ONLY`.
- [ ] 1.3 Chạy `npm run typecheck`, xử lý các chỗ TypeScript báo thiếu.

*Commit:* `feat(rbac): thêm hành động cho ba luồng mint, burn, distribute`

## Bước 2: Gán quyền

- [ ] 2.1 Cập nhật `ROLE_PERMISSIONS` đúng theo ma trận ở `design.md` mục 2.
- [ ] 2.2 Đối chiếu lại: không vai trò nào mất quyền đang có.
- [ ] 2.3 Xác nhận `BANK_ADMIN` **không** có `order:place` và `settlement:confirm`.

*Commit:* `feat(rbac): gán quyền mới theo vai trò`

## Bước 3: Cờ cho chức năng demo

- [ ] 3.1 Thêm `ENABLE_DEMO_PAYMENT_MINT` vào `env.ts`, kiểu boolean, **mặc định false**.
- [ ] 3.2 Viết hàm kiểm tra dùng chung: cờ trước, quyền sau.
- [ ] 3.3 Ghi cờ vào `.env.example` kèm cảnh báo: chỉ dùng môi trường thử, bật trên môi trường thật là cho phép tự phát hành tiền.
- [ ] 3.4 Nếu giao diện cần ẩn nút, đưa cờ ra `publicConfig()` trong `flags.ts`.

*Commit:* `feat(config): cờ chặn chức năng phát hành VNDB demo`

## Bước 4: Kiểm thử

- [ ] 4.1 Bổ sung vào `app/test/rbac.test.ts`: mỗi hành động mới có test vai trò được phép và vai trò bị chặn.
- [ ] 4.2 Test: vai trò lạ quy về `AUDITOR`, không có quyền ghi nào.
- [ ] 4.3 Test: cờ demo tắt thì `BANK_ADMIN` cũng bị từ chối.
- [ ] 4.4 Test: `INVESTOR` không có `reconcile:read`.
- [ ] 4.5 Chạy `bash scripts/run-local-all.sh`.

*Commit:* `test(rbac): kiểm thử ma trận quyền mới`

## Bước 5: Tài liệu

- [ ] 5.1 Cập nhật `tech-report.md` mục 3.3, thay ma trận quyền rút gọn bằng bản mới.
- [ ] 5.2 Cập nhật metadata đầu báo cáo.

*Commit:* `docs: cập nhật ma trận quyền trong báo cáo công nghệ`

## Việc KHÔNG được làm

- Không sửa `can.ts`, `session.ts`, `FALLBACK_ROLE`.
- Không bỏ quyền nào đang có.
- Không viết logic nghiệp vụ dùng các quyền này.
- Không cho vai trò nào ngoài `BANK_ADMIN` có `demo:mint-payment`.

## Checkpoint

`docs/CHECKPOINT_BE08.md`: kết quả chạy, bảng ma trận quyền cuối cùng, deviation, câu hỏi mở.
