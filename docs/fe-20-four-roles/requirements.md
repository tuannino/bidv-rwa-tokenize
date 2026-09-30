# FE-20 — Khung bốn vai trò theo URD

| | |
|---|---|
| Nhánh | `feat/four-roles-shell`, từ `dev` sau khi OP-01 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Vừa** |
| Làm | **đầu tiên** của đợt 1; mọi màn hình sau đều đặt lên khung này |

## Mục tiêu

Chuyển hệ thống từ mô hình hai kênh hiện tại sang **bốn vai trò theo tài liệu yêu cầu người sử dụng**: Nhà đầu tư, Người bán, Giao dịch viên, Kiểm soát viên. Mỗi vai trò có menu riêng, guard riêng, và trang chỗ trống cho các màn sẽ làm ở task sau.

Task này **chỉ dựng khung**, không làm nghiệp vụ.

## Hiện trạng đã đo

```
$ grep -n "ROLES\s*=" app/src/lib/rbac/permissions.ts
11: export const ROLES = ['BANK_ADMIN', 'COMPLIANCE', 'INVESTOR', 'AUDITOR']

$ ls -d app/src/app/\(*\)
(admin) (audit) (client)

$ grep -nE "^export const [A-Z_]+_NAV" app/src/components/layout/nav-config.ts
62: BANK_NAV      82: INVESTOR_NAV
```

Hai vai trò hiện có **không còn trong tài liệu yêu cầu**: Tuân thủ và Kiểm toán. Hai vai trò mới **chưa có**: Người bán và Kiểm soát viên. Vai trò ngân hàng hiện tại tương ứng Giao dịch viên nhưng khác quyền.

Cơ chế kênh và bộ chọn đã có sẵn từ FE-01 phiên bản hai: cookie kênh, cookie vai, `ChannelGuard`, `channel-switcher`, `role-switcher`, `nav-config`. Task này **mở rộng** chúng, không viết lại.

## Việc cần làm

1. Đổi danh sách vai trò thành bốn giá trị mới, đặt tên theo tài liệu yêu cầu. Giữ nguyên cơ chế `can` và `assertCan`.
2. Thêm quyền tối thiểu để dựng menu và guard cho từng vai trò. **Không** thêm quyền nghiệp vụ lập và duyệt, việc đó thuộc task backend của đợt 1.
3. Đổi bộ chọn kênh từ hai lựa chọn thành **bốn vai trò**, đúng tên trong tài liệu, kèm mã tài khoản mẫu.
4. Bỏ bộ chọn vai cũ, vì nay chọn vai chính là chọn kênh.
5. Thêm hai nhóm menu mới cho Người bán và Kiểm soát viên; sửa hai nhóm hiện có cho khớp tài liệu.
6. Thêm route group cho Người bán; đổi tên nhóm hiện có nếu cần cho khớp vai trò mới.
7. Gỡ route group của vai trò Kiểm toán cũ, vì vai trò đó không còn.
8. Tạo trang chỗ trống cho mọi màn chưa làm, mỗi trang ghi rõ task nào sẽ thay thế.
9. Giữ nguyên các màn đã có và còn dùng: tổng quan nhà đầu tư, chi tiết token, kết nối ví.
10. Hiển thị **số việc đang chờ** cạnh mục menu, theo tài liệu: mục lập lệnh của Giao dịch viên và mục phê duyệt của Kiểm soát viên. Giai đoạn này lấy số 0, để lại điểm cắm cho task backend nối số thật.
11. Gắn điểm cắm cho các màn sẽ làm sau, nêu rõ màn nào chờ task nào.

## Menu theo tài liệu yêu cầu

| Vai trò | Menu |
|---|---|
| Nhà đầu tư | Tổng quan, Giao dịch token, Quản lý lệnh, Rút VNDB, Kết nối ví, Thông tin tài khoản |
| Người bán | Tổng quan, Danh sách giao dịch, Tạo lệnh rút, Kết nối ví, Thông tin tài khoản |
| Giao dịch viên | Vận hành: Bảng điều khiển, Lập lệnh, Giao dịch, Chia lợi nhuận. Tài khoản: Thông tin tài khoản |
| Kiểm soát viên | Vận hành: Bảng điều khiển, Giao dịch, Chia lợi nhuận chỉ xem. Kiểm soát: Phê duyệt lệnh. Tài khoản: Thông tin tài khoản |

Mục **Kết nối ví** không có trong bản tài liệu hiện tại nhưng đã làm ở FE-02 và Owner đã xác nhận giữ. Tài liệu sẽ được bổ sung sau.

## Tác động

| | Tệp |
|---|---|
| Sửa | `lib/rbac/permissions.ts`, `lib/session/channel.ts`, `app/actions/session.ts`, `components/layout/channel-switcher.tsx`, `components/layout/nav-config.ts`, `components/layout/header.tsx` |
| Xóa | `components/layout/role-switcher.tsx`, route group của vai trò Kiểm toán |
| Mới | route group cho Người bán, các trang chỗ trống |
| Bị ảnh hưởng | mọi tệp kiểm thử có nhắc vai trò cũ |

Đo bằng:

```
grep -rln "COMPLIANCE\|AUDITOR" app/src app/test app/e2e
grep -rn "@pending FE-" app/src
```

## Mức kiểm chứng: Vừa

Trong lúc làm:

```
cd app && npx vitest run test/rbac.test.ts
cd app && npx vitest run
node scripts/scan-pending.mjs --check
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Bốn vai trò mới có trong danh sách, hai vai trò cũ không còn |
| 2 | Mỗi vai trò vào được menu của mình |
| 3 | **Nhà đầu tư bị chặn khỏi khu vực vận hành**, và ngược lại |
| 4 | Kiểm soát viên vào được mục phê duyệt, Giao dịch viên thì không |
| 5 | Giao dịch viên vào được mục lập lệnh, Kiểm soát viên thì không |
| 6 | Đổi vai trò thì điều hướng về trang mặc định của vai đó |
| 7 | Các màn đã có vẫn chạy: tổng quan nhà đầu tư, chi tiết token, kết nối ví |

## Điều kiện hoàn thành

- [ ] Bốn vai trò mới thay thế bốn vai trò cũ, cơ chế `can` giữ nguyên.
- [ ] Bộ chọn có đủ bốn vai trò kèm mã tài khoản mẫu; bộ chọn vai cũ đã gỡ.
- [ ] Bốn nhóm menu đúng tài liệu yêu cầu.
- [ ] Mỗi vai trò chỉ vào được khu vực của mình, có kiểm thử cho cả hai chiều.
- [ ] Mọi màn chưa làm đều có trang chỗ trống ghi rõ task sẽ thay thế.
- [ ] Số việc đang chờ hiển thị cạnh menu, có điểm cắm chờ backend nối số thật.
- [ ] Ba màn đã có vẫn chạy bình thường.
- [ ] Không còn tệp nào nhắc hai vai trò cũ.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không thêm quyền nghiệp vụ lập và duyệt. Thuộc task backend của đợt 1.
- Không làm nghiệp vụ cho các màn chỗ trống.
- Không sửa `channel-guard.tsx`, `can.ts`.
- Không xóa mã của bảng điều khiển hiện có; nó sẽ được dùng lại ở task bảng điều khiển vận hành.
- Không đụng `lib/bank`, `lib/ledger`, `lib/store`.
- Không thêm phụ thuộc mới.
