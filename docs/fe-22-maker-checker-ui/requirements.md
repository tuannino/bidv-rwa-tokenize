# FE-22 — Màn Lập lệnh, Phê duyệt lệnh, và đóng đường đi vòng

| | |
|---|---|
| Nhánh | `feat/maker-checker-ui`, từ `dev` sau khi BE-12 đã merge |
| Điểm | 10 (tăng từ 8 vì thêm phần đóng đường đi vòng) |
| Mức kiểm chứng | **Cao** (đóng đường đi vòng liên quan tạo và huỷ token) |
| Làm | sau BE-12; trọng tâm của đợt 1 |

## Mục tiêu

Hai màn theo tài liệu yêu cầu mục III.1 và III.2, cộng một việc quan trọng phát hiện khi nghiệm thu BE-12.

## Vì sao có phần đóng đường đi vòng

```
$ python3 -c "... đọc permissions.ts ..."
TELLER: [... 'token:burn', 'token:mint', ...]
```

Giao dịch viên **vẫn tạo và huỷ token trực tiếp được**, vì hai quyền cũ chưa gỡ. Nghĩa là tồn tại một đường đi vòng qua quy trình lập và duyệt, làm mất ý nghĩa của BE-12. Màn `/mint` cũ vẫn đi đường đó.

Task này đóng lại, vì nó đụng đúng hai màn liên quan.

## Những gì BE-12 đã để sẵn

```
app/src/app/actions/token-request.ts
    previewTokenRequestAction   createTokenRequestAction
    approveTokenRequestAction   rejectTokenRequestAction
    listTokenRequestsAction
app/src/lib/bank/token-request.service.ts
    countPendingWork
trạng thái: PENDING, EXECUTING, COMPLETED, REJECTED, FAILED
```

Giao diện **chỉ gọi**, không tự tính lại.

## Việc cần làm

**A. Màn Lập lệnh, vai Giao dịch viên**

1. Hai thẻ số liệu: số yêu cầu tạo token đang chờ, số yêu cầu huỷ token đang chờ.
2. Thẻ tạo token: nhập mã hoặc ký hiệu token, hệ thống tự đổ khối thông tin token gồm dự án, hợp đồng, trần phát hành, số còn được phát hành, tổng cung hiện tại, số chưa phân phối, số đang lưu hành, mã người bán, địa chỉ ví thanh toán.
3. Nhập số lượng, lý do, chứng từ, ngày hiệu lực, ghi chú.
4. Khối kiểm tra trước khi lập: hiện từng điều kiện kèm trạng thái, lấy từ hàm xem trước của BE-12. Có điều kiện trượt thì **khoá nút gửi** và hiện lý do.
5. Thẻ huỷ token: như trên, thêm ô chọn nguồn gồm phần chưa phân phối hoặc toàn bộ nguồn cung. Chọn toàn bộ nguồn cung thì tự điền số lượng và **hiện cảnh báo yêu cầu xác nhận lại**.
6. Thẻ yêu cầu đã lập: hai bảng theo dõi trạng thái yêu cầu do chính người này lập.
7. Gửi xong thì hiện thông báo, yêu cầu chuyển sang chờ duyệt, số việc chờ của Kiểm soát viên tăng.

**B. Màn Phê duyệt lệnh, vai Kiểm soát viên**

8. Ba thẻ số liệu: đang chờ duyệt, đã duyệt hôm nay, đã từ chối hôm nay.
9. Hai hàng chờ, mỗi hàng có ô tìm kiếm và bộ lọc trạng thái.
10. Màn chi tiết: khối hành động với hai nút chấp nhận và từ chối, khối thông tin token, khối nội dung yêu cầu, nhật ký.
11. Từ chối **bắt buộc nhập lý do**, chưa nhập thì khoá nút.
12. Chấp nhận xong thì trạng thái chuyển hoàn tất, số liệu nguồn cung đổi theo, nhật ký thêm một dòng.
13. **Hiển thị đủ năm trạng thái** của BE-12. Hai trạng thái trung gian hiện dưới dạng đang xử lý và thất bại, không giấu đi.

**C. Đóng đường đi vòng**

14. Gỡ hai quyền tạo và huỷ token trực tiếp khỏi vai Giao dịch viên.
15. Chuyển màn tạo token cũ sang dùng quy trình lập và duyệt, hoặc gỡ hẳn nếu màn Lập lệnh đã thay thế hoàn toàn. Chọn cách nào thì ghi rõ lý do vào báo cáo bàn giao.
16. Rà các nơi còn gọi nghiệp vụ tạo token trực tiếp, chuyển sang quy trình mới.
17. Giữ nguyên đường tạo token trực tiếp dành cho **dữ liệu thử**, nhưng phải sau hai lớp chặn như chức năng tạo VNDB mô phỏng đã làm ở BE-08: một quyền riêng và một cờ môi trường mặc định tắt.

**D. Dùng chung**

18. Số việc đang chờ cạnh menu lấy số thật từ BE-12. Gỡ điểm cắm mà FE-20 để lại.
19. Số lượng hiển thị có phân cách hàng nghìn; mốc thời gian hiện đủ ngày và giờ.

## Ràng buộc

- Giao dịch viên **không thấy** màn phê duyệt; Kiểm soát viên **không thấy** màn lập lệnh.
- Yêu cầu do chính mình lập thì nút duyệt phải bị khoá kèm lý do. Backend đã chặn, giao diện phải báo trước để người dùng không bấm rồi mới thấy lỗi.
- Khối kiểm tra **đọc kết quả từ backend**, không tự tính lại.
- Không gọi chuỗi trực tiếp từ thành phần giao diện.

## Tác động

| | Tệp |
|---|---|
| Mới | màn lập lệnh, màn phê duyệt, màn chi tiết yêu cầu, thành phần khối thông tin token và khối kiểm tra |
| Sửa | hai trang chỗ trống của FE-20, `permissions.ts`, màn tạo token cũ, `nav-config.ts` |
| Bị ảnh hưởng | kiểm thử bảng quyền, kiểm thử bốn vai trò, kiểm thử đầu cuối |

## Mức kiểm chứng: Cao

Trong lúc làm:

```
cd app && npx vitest run test/rbac.test.ts test/four-roles-shell.test.ts
cd app && npx vitest run
node scripts/scan-pending.mjs --check
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Nhập ký hiệu token thì khối thông tin token tự đổ đủ chỉ tiêu |
| 2 | Số lượng vượt trần còn lại thì nút gửi bị khoá, hiện đúng lý do |
| 3 | Gửi xong thì số việc chờ của Kiểm soát viên tăng |
| 4 | Chọn nguồn toàn bộ nguồn cung thì có cảnh báo xác nhận lại |
| 5 | Duyệt thì trạng thái chuyển hoàn tất, số liệu nguồn cung đổi |
| 6 | Từ chối không nhập lý do thì nút bị khoá |
| 7 | Guard hai chiều giữa hai vai vẫn đúng |
| 8 | Yêu cầu do chính mình lập thì nút duyệt bị khoá kèm lý do |
| 9 | **Giao dịch viên không còn quyền tạo và huỷ token trực tiếp** |
| 10 | **Không còn nơi nào gọi nghiệp vụ tạo token ngoài quy trình lập và duyệt**, trừ đường dữ liệu thử có hai lớp chặn |

Đột biến, **chỉ hai chỗ**:

- Trả lại quyền tạo token trực tiếp cho Giao dịch viên: ca 9 phải đỏ.
- Bật cờ đường dữ liệu thử ở môi trường thật: phải bị từ chối.

## Điều kiện hoàn thành

- [ ] Hai màn đúng bố cục tài liệu, thay hết trang chỗ trống.
- [ ] Khối kiểm tra hiện từng điều kiện và khoá nút khi có điều kiện trượt.
- [ ] Nguồn toàn bộ nguồn cung có cảnh báo xác nhận lại.
- [ ] Từ chối bắt buộc có lý do.
- [ ] Người lập không duyệt được yêu cầu của mình, giao diện báo trước.
- [ ] Hiển thị đủ năm trạng thái.
- [ ] **Giao dịch viên không còn quyền tạo và huỷ token trực tiếp.**
- [ ] **Không còn đường đi vòng**, trừ đường dữ liệu thử có hai lớp chặn.
- [ ] Số việc chờ lấy số thật, điểm cắm của FE-20 đã gỡ.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không tự tính lại điều kiện ở giao diện.
- Không nới guard giữa hai vai.
- Không giấu hai trạng thái trung gian.
- Không để đường tạo token trực tiếp mà chỉ có một lớp chặn.
- Không gọi chuỗi trực tiếp từ thành phần giao diện.
- Không làm màn giao dịch, chia lợi nhuận, rút tiền.
