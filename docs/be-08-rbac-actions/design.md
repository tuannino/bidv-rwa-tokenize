# BE-08 — Bổ sung quyền RBAC: design

## 1. Quyết định thiết kế

### QĐ-1: Đặt tên hành động theo mẫu `đối tượng:động từ`

Giữ đúng mẫu đang dùng (`token:mint`, `investor:whitelist`). Nhóm mới dùng bốn tiền tố: `order:`, `distribution:`, `settlement:`, `treasury:`, cộng `reconcile:read` và `demo:mint-payment`.

Không đặt `token:redeem` cho luồng tất toán, vì luồng chốt (diagram P2) là ngân hàng điều phối và đốt, không phải nhà đầu tư tự đổi. Dùng `settlement:*` cho đúng nghiệp vụ, và tái dùng `token:burn` đã có cho hành động đốt.

### QĐ-2: Chức năng demo cần hai lớp chặn

RBAC một mình không đủ. Lý do: bảng quyền là mã nguồn, nếu ai đó gán nhầm vai `BANK_ADMIN` trên môi trường thật thì chức năng phát hành VNDB mở ra ngay. Cờ môi trường là lớp thứ hai, độc lập với mã nguồn.

Cờ đặt trong `lib/config/env.ts` cùng chỗ với các cờ `USE_MOCK_*`, mặc định tắt. Tên gợi ý `ENABLE_DEMO_PAYMENT_MINT`.

Thứ tự kiểm: cờ trước, quyền sau. Cờ tắt thì từ chối luôn, không cần đọc vai trò.

### QĐ-3: Tách nhóm quyền chỉ đọc

`reconcile:read` thêm vào nhóm `READ_ONLY` đang có, để `AUDITOR` và `COMPLIANCE` tự nhận được mà không phải liệt kê lại từng vai.

Lưu ý: `READ_ONLY` hiện có 3 quyền và được dùng cho cả 4 vai trừ `INVESTOR`. Thêm `reconcile:read` vào đây nghĩa là `BANK_ADMIN`, `COMPLIANCE`, `AUDITOR` đều có. Đúng ý định.

**Không** thêm `reconcile:read` cho `INVESTOR`: báo cáo đối soát là dữ liệu toàn hệ, nhà đầu tư chỉ được xem vị thế của mình.

## 2. Ma trận quyền sau khi sửa

| Hành động | BANK_ADMIN | COMPLIANCE | INVESTOR | AUDITOR |
|---|:--:|:--:|:--:|:--:|
| `token:mint` | có | không | không | không |
| `token:burn` | có | không | không | không |
| `token:freeze` | có | có | không | không |
| `token:clawback` | có | không | không | không |
| `investor:whitelist` | có | có | không | không |
| `kyc:approve` | có | có | không | không |
| `token:transfer` | không | không | có | không |
| `order:place` | không | không | **có** | không |
| `order:execute` | **có** | không | không | không |
| `distribution:snapshot` | **có** | không | không | không |
| `distribution:execute` | **có** | không | không | không |
| `settlement:initiate` | **có** | không | không | không |
| `settlement:set-nav` | **có** | không | không | không |
| `settlement:confirm` | không | không | **có** | không |
| `treasury:manage` | **có** | không | không | không |
| `reconcile:read` | **có** | **có** | không | **có** |
| `demo:mint-payment` | **có** (kèm cờ) | không | không | không |
| `balance:read`, `txn:read`, `audit:read` | có | có | 2 trong 3 | có |

`BANK_ADMIN` không có `order:place` và `settlement:confirm`, vì hai hành động đó là của nhà đầu tư. Ngân hàng khớp lệnh và chi trả, không đặt lệnh thay nhà đầu tư.

## 3. Tệp thay đổi

```
app/src/lib/rbac/permissions.ts   (sửa)  — thêm ACTIONS và ROLE_PERMISSIONS
app/src/lib/config/env.ts         (sửa)  — thêm cờ ENABLE_DEMO_PAYMENT_MINT
app/src/lib/config/flags.ts       (sửa)  — đưa cờ ra cấu hình công khai nếu giao diện cần ẩn nút
app/test/rbac.test.ts             (sửa)  — bổ sung test cho quyền mới
.env.example                      (sửa)  — ghi cờ mới, mặc định tắt, kèm cảnh báo
```

## 4. Điểm cần chú ý

- `ACTIONS` là mảng `as const`, thêm phần tử sẽ mở rộng kiểu `Action`. TypeScript sẽ tự bắt lỗi ở chỗ nào liệt kê thiếu, đó là điều tốt.
- Test `rbac.test.ts` hiện có 6 test. Bổ sung, không viết lại.
- Đừng đụng `can.ts`: hàm `can(role: unknown, ...)` nhận `unknown` có chủ ý để dữ liệu ngoài vào an toàn.
- Cờ demo phải ghi rõ trong `.env.example` kèm một dòng cảnh báo bằng tiếng Việt, để người triển khai không bật nhầm.
