# FE-01 — Kênh nhà đầu tư: tasks

Nhánh: `feat/investor-channel`, tạo **từ `dev`** theo `.kiro/steering/branching.md`.

Chia commit nhỏ theo từng bước. Mỗi bước phải ở trạng thái build được.

---

## Bước 1: Tách cấu hình điều hướng ra khỏi Sidebar

- [ ] 1.1 Tạo `components/layout/nav-config.ts` với kiểu `NavItem`, `NavSection`.
- [ ] 1.2 Chuyển hằng số `NAV_ITEMS` và `MODULE_ITEMS` hiện có trong `sidebar.tsx` sang `BANK_NAV`, **sao y từng ký tự** gồm cả phím tắt.
- [ ] 1.3 Sửa `Sidebar` nhận `nav: NavSection` qua props, bỏ hằng số ghi cứng.
- [ ] 1.4 Sửa `AppLayout` nhận `nav` với giá trị mặc định `BANK_NAV`.
- [ ] 1.5 Chạy `npm run test:e2e`, xác nhận **không test nào gãy**. Nếu gãy là do nhãn sai, sửa lại cho khớp hiện trạng.

**Kiểm chứng:** giao diện kênh ngân hàng nhìn giống hệt trước khi sửa.

*Commit:* `refactor(layout): tách cấu hình điều hướng ra nav-config`

---

## Bước 2: Hỗ trợ mục menu vô hiệu hóa

- [ ] 2.1 Thêm cờ `disabled` vào `NavItem`.
- [ ] 2.2 Trong `NavLink`, mục `disabled` thì không bọc `Link`, hiển thị mờ, con trỏ không cho bấm, kèm chú thích "sắp có".
- [ ] 2.3 Bảo đảm mục vô hiệu hóa vẫn đọc được bằng trình đọc màn hình (dùng `aria-disabled`).

*Commit:* `feat(layout): hỗ trợ mục điều hướng chưa khả dụng`

---

## Bước 3: Định nghĩa menu kênh nhà đầu tư

- [ ] 3.1 Thêm `INVESTOR_NAV` vào `nav-config.ts` theo bảng trong `design.md` mục 4.
- [ ] 3.2 Tiêu đề nhóm: "Nghiệp vụ nhà đầu tư".
- [ ] 3.3 Ba mục `Mua WPT`, `Lợi nhuận`, `Tất toán` đặt `disabled: true`.
- [ ] 3.4 Kiểm nhãn dùng đúng **WPT** và **VNDB**, tiếng Việt đủ dấu.

*Commit:* `feat(layout): thêm menu kênh nhà đầu tư`

---

## Bước 4: Dựng route group `(client)`

- [ ] 4.1 Tạo `app/(client)/layout.tsx` bọc `ChannelGuard` với `channel="Nhà đầu tư"` và `requireAny={['balance:read']}`, bên trong là `AppLayout` với `nav={INVESTOR_NAV}`.
- [ ] 4.2 Tạo 4 trang chỗ trống: `portfolio`, `purchase`, `earnings`, `settlement`. Mỗi trang một dòng tiêu đề và ghi chú task nào sẽ thay thế.
- [ ] 4.3 Xác nhận không trùng đường dẫn với `(admin)` và `(audit)`.
- [ ] 4.4 Nếu gặp lỗi tuần tự hóa vì `icon` là hàm, xử lý theo `design.md` mục 7.

**Kiểm chứng:** vai INVESTOR vào `/portfolio` thấy khung đầy đủ; vai ngân hàng vào thì bị chặn.

*Commit:* `feat(client): dựng kênh nhà đầu tư với guard quyền`

---

## Bước 5: Bổ sung vai INVESTOR vào bộ chuyển vai

- [ ] 5.1 Kiểm `role-switcher.tsx` đã có INVESTOR chưa. Nếu có thì bỏ qua bước này.
- [ ] 5.2 Nếu chưa, bổ sung, giữ nguyên cách viết hiện tại.
- [ ] 5.3 Sau khi đổi sang INVESTOR, điều hướng về `/portfolio`.

*Commit:* `feat(layout): bổ sung vai nhà đầu tư vào bộ chuyển vai`

---

## Bước 6: Kiểm thử

- [ ] 6.1 Thêm `app/e2e/investor-channel.spec.ts`.
- [ ] 6.2 Ca thử: vai INVESTOR vào `/portfolio` thành công.
- [ ] 6.3 Ca thử: vai INVESTOR vào `/mint` bị chặn, thấy màn từ chối.
- [ ] 6.4 Ca thử: vai BANK_ADMIN vào `/portfolio` bị chặn.
- [ ] 6.5 Ca thử: menu kênh ngân hàng không chứa mục "Mua WPT".
- [ ] 6.6 Chạy `bash scripts/run-local-all.sh`, xanh toàn bộ.

*Commit:* `test(client): kiểm thử phân tách kênh nhà đầu tư`

---

## Bước 7: Cập nhật tài liệu

- [ ] 7.1 Cập nhật `tech-report.md`: cây thư mục mục 1.4, bảng kênh mục 1.1, bản đồ code phần components.
- [ ] 7.2 Cập nhật metadata đầu báo cáo.

*Commit:* `docs: cập nhật báo cáo công nghệ cho kênh nhà đầu tư`

---

## Việc KHÔNG được làm

- Không sửa `channel-guard.tsx`, `permissions.ts`, `can.ts`, `session.ts`.
- Không thêm quyền mới. Thiếu quyền thì ghi câu hỏi mở.
- Không làm nghiệp vụ cho 4 trang chỗ trống.
- Không thêm phụ thuộc mới.
- Không đổi nhãn menu kênh ngân hàng.

## Checkpoint phải nộp

`docs/CHECKPOINT_FE01.md`, gồm: kết quả chạy đầy đủ, ảnh chụp hai kênh, các deviation, câu hỏi mở (nhất là chuyện AUDITOR cũng vào được kênh nhà đầu tư), và sai lệch phát hiện được.
