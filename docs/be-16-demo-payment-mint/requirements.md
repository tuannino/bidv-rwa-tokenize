# BE-16 — Nạp VNDB mô phỏng cho bản trình diễn

| | |
|---|---|
| Nhánh | `feat/demo-payment-mint`, từ `dev` sau khi BE-15 đã merge |
| Điểm | 6 |
| Mức kiểm chứng | **Cao** (tạo ra tiền trong hệ thống) |
| Thứ tự | **task đầu tiên của đợt 4**; làm ngay vì luồng mua đang bị chặn |
| Phạm vi | gồm **cả nghiệp vụ và màn hình**, vì màn chỉ là một biểu mẫu ba trường |

## Mục tiêu

Nhà đầu tư hiện có số dư VNDB bằng không, nên không đặt được lệnh mua: màn báo trần mua là 0 token. Hệ thống **chưa có đường nào nạp VNDB**.

Chọn cách làm một chức năng nạp có kiểm soát, thay vì tạo sẵn số dư trong dữ liệu khởi tạo. Lý do: số dư tạo sẵn sẽ **lệch ngay khi chuyển sang mạng thử**, vì lúc đó số dư thật nằm trên chuỗi; còn chức năng có kiểm soát thì tắt được bằng một cờ.

## Hiện trạng đã đo

```
quyền demo:mint-payment: đã có, cấp cho Giao dịch viên VÀ Người bán
cờ ENABLE_DEMO_PAYMENT_MINT: đã có, mặc định tắt
tầng cổng chuỗi: chỉ có paymentBalanceOf, paymentAllowanceOf — KHÔNG có phương thức nạp
tầng nghiệp vụ: không có tệp nào
màn hình: không có
hợp đồng VNDToken: đã có hàm phát hành và vai phát hành
```

BE-08 đã dựng quyền và hai lớp chặn, nhưng phần việc thật chưa ai làm.

## Việc cần làm

**Tầng cổng chuỗi**

1. Thêm phương thức nạp VNDB vào ví chỉ định. Hiện thực ở cả ba bản: bản mô phỏng cập nhật số dư, bản chuỗi thật gọi hàm phát hành của hợp đồng VNDB, bản Stellar ném lỗi rõ ràng.
2. Bản chuỗi thật cần vai phát hành trên hợp đồng VNDB. Nếu ví vận hành chưa có vai đó thì **báo lỗi nêu rõ thiếu vai gì**, không ném lỗi chung chung.

**Nghiệp vụ**

3. Nghiệp vụ nạp VNDB: nhận ví đích và số tiền, trả về số dư sau khi nạp.
4. **Hai lớp chặn**, theo đúng cách đã làm ở BE-08: kiểm cờ môi trường trước, kiểm quyền sau. Cờ tắt thì từ chối ngay, kể cả vai có quyền.
5. Giới hạn số tiền mỗi lần nạp, đọc từ cấu hình, để tránh gõ nhầm số không.
6. Ghi sổ kiểm toán mọi lần nạp **và** mọi lần bị chặn, ghi rõ ai nạp, nạp cho ví nào, bao nhiêu.
7. Lưu giao dịch vào bảng giao dịch như các nghiệp vụ khác, để màn đối soát và lịch sử thấy được.

**Quyền**

8. **Gỡ quyền nạp VNDB khỏi vai Người bán.** Người bán là pháp nhân bên ngoài ngân hàng, không có lý do tạo ra tiền. Chỉ Giao dịch viên giữ quyền này.
9. Việc gỡ tương tự cho quyền nạp token mô phỏng nếu vai Người bán cũng đang có.

**Màn hình**

10. Một màn trong khu vực vận hành, dành cho Giao dịch viên: chọn ví đích, nhập số tiền, nút nạp, bảng lịch sử các lần nạp.
11. Màn **chỉ hiện khi cờ đang bật**. Cờ tắt thì mục menu không xuất hiện, và vào bằng đường dẫn thì bị chặn.
12. Màn hiện cảnh báo rõ ràng rằng đây là chức năng chỉ dùng cho bản trình diễn, sẽ tắt khi lên môi trường thật.
13. Gợi ý nhanh số tiền theo tài liệu yêu cầu, ví dụ 500 triệu cho nhà đầu tư mẫu, để người trình diễn không phải gõ tay.

## Ràng buộc

- **Hai lớp chặn là bắt buộc**, không được bỏ lớp nào. Nếu chức năng này lọt sang môi trường thật thì cán bộ ngân hàng tự tạo được tiền.
- Cờ mặc định **tắt**. Bật bằng biến môi trường, không bật bằng cấu hình trong cơ sở dữ liệu, để người có quyền quản trị cấu hình cũng không tự bật được.
- Không nạp cho ví chưa có trong danh sách nhà đầu tư, trừ ví của Người bán.
- Mọi số tiền truyền dạng chuỗi.

## Tác động

| | Tệp |
|---|---|
| Sửa | `lib/ledger/ledger.port.ts` và ba adapter, `lib/rbac/permissions.ts`, `lib/config/env.ts` và `flags.ts`, `nav-config.ts`, dữ liệu khởi tạo cấu hình |
| Mới | `lib/bank/demo-payment.service.ts`, `app/actions/demo-payment.ts`, màn nạp VNDB, kiểm thử |
| Bị ảnh hưởng | kiểm thử bảng quyền, kiểm thử tầng cổng chuỗi, kiểm thử bốn vai trò |

## Mức kiểm chứng: Cao

Trong lúc làm:

```
cd app && npx vitest run test/demo-payment.test.ts test/rbac.test.ts
cd app && npx vitest run test/mock-ledger.test.ts
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

| Ca | Kiểm |
|---|---|
| 1 | Cờ bật, vai Giao dịch viên nạp thành công, số dư tăng đúng |
| 2 | **Cờ tắt thì từ chối, kể cả vai có quyền** |
| 3 | **Người bán không nạp được**, dù trước đây có quyền |
| 4 | Nhà đầu tư và Kiểm soát viên không nạp được |
| 5 | Vượt giới hạn mỗi lần thì bị từ chối |
| 6 | Mọi lần nạp và lần bị chặn đều có bản ghi kiểm toán |
| 7 | Cờ tắt thì mục menu không hiện, vào bằng đường dẫn bị chặn |
| 8 | Sau khi nạp, nhà đầu tư đặt được lệnh mua, trần mua tính đúng theo số dư mới |

Đột biến, **chỉ hai chỗ**:

- Bỏ lớp kiểm cờ, chỉ còn kiểm quyền: ca 2 phải đỏ.
- Trả lại quyền nạp cho vai Người bán: ca 3 phải đỏ.

## Điều kiện hoàn thành

- [ ] Phương thức nạp có ở cả ba bản của tầng cổng chuỗi.
- [ ] Bản chuỗi thật báo rõ nếu thiếu vai phát hành.
- [ ] Hai lớp chặn hoạt động, cờ tắt thì từ chối cả vai có quyền.
- [ ] Người bán không còn quyền nạp VNDB và nạp token mô phỏng.
- [ ] Giới hạn mỗi lần nạp đọc từ cấu hình.
- [ ] Sổ kiểm toán ghi đủ cả lần bị chặn.
- [ ] Giao dịch nạp vào bảng giao dịch, lịch sử thấy được.
- [ ] Cờ tắt thì mục menu ẩn và đường dẫn bị chặn.
- [ ] **Sau khi nạp, luồng mua chạy được đầu cuối.**
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không bỏ lớp kiểm cờ.
- Không cho bật cờ qua cấu hình trong cơ sở dữ liệu.
- Không tạo sẵn số dư trong dữ liệu khởi tạo.
- Không cho vai nào ngoài Giao dịch viên nạp.
- Không nạp token WPT trong task này; chức năng đó đã có đường riêng.
