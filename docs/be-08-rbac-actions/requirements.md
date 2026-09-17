# BE-08 — Bổ sung quyền RBAC cho ba luồng: requirements

| | |
|---|---|
| Mã task | BE-08 |
| Nhóm | Backend |
| Sprint | S1, due 19/09 |
| Điểm | 2 |
| Ưu tiên | P0 |
| Phụ thuộc | không |
| Nhánh | `feat/rbac-actions`, tạo **từ `dev`** |

Làm **đầu tiên** trong nhóm backend, vì BE-01 và BE-02 đều cần các quyền này để đặt guard.

## 1. Mục tiêu

Bổ sung các hành động mới vào bảng quyền để ba luồng mint, burn, distribute có chỗ đặt guard. Task này **chỉ sửa bảng dữ liệu**, không viết logic nghiệp vụ.

## 2. Hiện trạng

`lib/rbac/permissions.ts` có 4 vai trò và 10 hành động. Cấu trúc đã đúng: bảng dữ liệu thuần, thêm quyền là sửa bảng chứ không sửa logic. `can()` và `assertCan()` giữ nguyên chữ ký.

Hiện thiếu hành động cho: khớp lệnh mua, chốt quyền chia lợi nhuận, thực hiện chia, khởi tạo tất toán, đặt giá NAV, đối soát, và chức năng demo phát hành VNDB.

## 3. Yêu cầu chức năng

### R1 — Hành động mới

Hệ thống PHẢI bổ sung các hành động sau vào `ACTIONS`:

| Hành động | Ý nghĩa |
|---|---|
| `order:place` | Nhà đầu tư đặt lệnh mua WPT |
| `order:execute` | Ngân hàng khớp lệnh: chuyển VNDB và WPT trong một giao dịch |
| `distribution:snapshot` | Chốt quyền, chụp danh sách nắm giữ |
| `distribution:execute` | Thực hiện chia lợi nhuận |
| `settlement:initiate` | Khởi tạo quy trình đóng quỹ |
| `settlement:set-nav` | Đặt giá hoàn vốn theo NAV cuối kỳ |
| `settlement:confirm` | Nhà đầu tư xác nhận thu hồi và hoàn vốn |
| `treasury:manage` | Quản trị hai ví SPV và ví chia lợi nhuận |
| `reconcile:read` | Xem báo cáo đối soát |
| `demo:mint-payment` | **Chỉ môi trường thử**: cán bộ ngân hàng phát hành VNDB vào ví chỉ định |

### R2 — Gán quyền theo vai trò

- **R2.1** `BANK_ADMIN` PHẢI có: `order:execute`, `distribution:snapshot`, `distribution:execute`, `settlement:initiate`, `settlement:set-nav`, `treasury:manage`, `reconcile:read`, `demo:mint-payment`, cùng toàn bộ quyền hiện có.
- **R2.2** `COMPLIANCE` PHẢI có `reconcile:read`, và KHÔNG được có `order:execute`, `distribution:execute`, `settlement:set-nav`. Lý do: tuân thủ giám sát chứ không thực hiện giao dịch tiền.
- **R2.3** `INVESTOR` PHẢI có `order:place` và `settlement:confirm`, cùng quyền hiện có.
- **R2.4** `AUDITOR` PHẢI có `reconcile:read` và KHÔNG được có bất kỳ hành động ghi nào.
- **R2.5** KHÔNG vai trò nào ngoài `BANK_ADMIN` được có `demo:mint-payment`.

### R3 — Chốt chặn cho chức năng demo

- **R3.1** `demo:mint-payment` PHẢI bị chặn bởi **hai lớp**: quyền RBAC và cờ môi trường.
- **R3.2** Hệ thống PHẢI có cờ môi trường riêng cho chức năng này, mặc định **tắt**.
- **R3.3** KHI cờ tắt, hệ thống PHẢI từ chối ngay cả với vai `BANK_ADMIN`.
- **R3.4** Chỉ có quyền RBAC mà không có cờ là KHÔNG đủ. Nếu chức năng này lọt sang môi trường thật thì cán bộ ngân hàng tự phát hành được tiền.

### R4 — Tính toàn vẹn của bảng quyền

- **R4.1** Hệ thống PHẢI giữ nguyên chữ ký của `can()` và `assertCan()`.
- **R4.2** Hệ thống KHÔNG được sửa `FALLBACK_ROLE`. Vai trò lạ vẫn quy về `AUDITOR`.
- **R4.3** Hệ thống KHÔNG được bỏ bất kỳ quyền nào đang có của vai trò nào.
- **R4.4** Mỗi hành động mới PHẢI có ít nhất một test xác nhận vai trò nào được và vai trò nào bị chặn.

## 4. Ngoài phạm vi

- Logic nghiệp vụ dùng các quyền này (thuộc BE-02 đến BE-07).
- Chuyển bảng quyền sang cơ sở dữ liệu (thuộc AU-02).
- Chức năng phát hành VNDB thật (thuộc spec riêng, task mới theo chốt Q1).

## 5. Điều kiện hoàn thành

- [ ] 10 hành động mới có trong `ACTIONS`.
- [ ] Ma trận quyền đúng theo R2, có test cho từng dòng.
- [ ] `demo:mint-payment` bị chặn khi cờ tắt, kể cả với `BANK_ADMIN`.
- [ ] Không quyền nào đang có bị mất.
- [ ] `bash scripts/run-local-all.sh` xanh toàn bộ.
- [ ] `tech-report.md` mục 3.3 cập nhật ma trận quyền.
