# BE-12 — Nghiệp vụ lập lệnh và phê duyệt Mint, Burn

| | |
|---|---|
| Nhánh | `feat/maker-checker`, từ `dev` sau khi FE-20 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Cao** (tạo và huỷ token, tức tài sản của nhà đầu tư) |
| Làm | trước FE-22; hai màn của FE-22 đều dựa vào task này |

## Mục tiêu

Theo tài liệu yêu cầu: **Giao dịch viên lập, Kiểm soát viên duyệt**. Hiện backend chỉ có một bước, ai có quyền thì thực hiện ngay. Đây là phần mới hoàn toàn.

Kèm theo: sửa phát hành từ **một lần** sang **nhiều lần theo trần còn lại**, vì tài liệu có khái niệm trần phát hành và số còn được phát hành.

## Hiện trạng đã đo

```
$ python3 -c "... đếm ACTIONS ..."      31 quyền, không có quyền lập hay duyệt
$ grep isInitialSupplyMinted app/src/lib/bank/issuance.service.ts   phát hành một lần: True
$ grep '^model' app/prisma/schema.prisma   15 bảng, không có bảng yêu cầu Mint/Burn
```

## Việc cần làm

**Dữ liệu**

1. Bảng yêu cầu Mint và Burn: mã yêu cầu, loại, mã token, số lượng, nguồn (với Burn: phần chưa phân phối hoặc toàn bộ nguồn cung), lý do, chứng từ, ngày hiệu lực, ghi chú, người lập, người duyệt, trạng thái, lý do từ chối, mã giao dịch, thời điểm từng mốc.
2. Trạng thái: chờ duyệt, hoàn tất, từ chối. Chuyển trạng thái một chiều, có kiểm trạng thái nguồn.
3. Cổng lưu trữ cho bảng này, hai bản như các cổng đã có.

**Quyền**

4. Thêm quyền lập yêu cầu và quyền duyệt yêu cầu. Giao dịch viên có quyền lập, Kiểm soát viên có quyền duyệt. **Không vai nào có cả hai.**

**Nghiệp vụ lập**

5. Lập yêu cầu Mint: kiểm trần còn lại, ví đích hợp lệ, không có yêu cầu nào đang chờ cho cùng token, người lập có quyền. Trả về danh sách điều kiện kèm trạng thái từng điều kiện, để giao diện hiện khối kiểm tra trước.
6. Lập yêu cầu Burn: kiểm nguồn hợp lệ, số lượng không vượt phần chưa phân phối, và **chặn nguồn toàn bộ nguồn cung khi còn token đang lưu hành**.
7. Yêu cầu lập xong ở trạng thái chờ duyệt, chưa tác động tới token.

**Nghiệp vụ duyệt**

8. Duyệt: **kiểm lại toàn bộ điều kiện** tại thời điểm duyệt, không tin kết quả lúc lập. Đạt thì thực hiện ngay trên ví thanh toán của người bán, ghi mã giao dịch, chuyển sang hoàn tất.
9. Từ chối: bắt buộc có lý do, chuyển sang từ chối, không tác động token.
10. **Người lập không được duyệt yêu cầu của chính mình**, kể cả khi có đủ quyền.
11. Ghi sổ kiểm toán cho mọi bước: lập, duyệt, từ chối, và cả lần bị chặn.

**Phát hành nhiều lần**

12. Bỏ chốt chặn phát hành một lần. Thay bằng kiểm **số lượng không vượt trần còn lại**, tính bằng trần trừ tổng cung hiện tại.
13. Giữ nguyên nguồn trần phát hành là bảng dự án, không viết cứng.

**Số việc đang chờ**

14. Hàm đếm số yêu cầu đang chờ theo vai trò, để giao diện hiện số cạnh menu. Gỡ điểm cắm tương ứng mà FE-20 để lại.

## Ràng buộc

- Yêu cầu đang chờ không được tác động tới số dư token. Chỉ khi duyệt mới tác động.
- Hai người cùng duyệt một yêu cầu: chỉ một lần tác động token. Dùng cập nhật có điều kiện ở cơ sở dữ liệu, không kiểm trong mã.
- Duyệt mà điều kiện đã đổi so với lúc lập thì từ chối và nêu rõ điều kiện nào.
- Mọi số lượng truyền dạng chuỗi.

## Tác động

| | Tệp |
|---|---|
| Mới | `lib/bank/token-request.service.ts`, cổng lưu trữ yêu cầu, `app/actions/token-request.ts`, kiểm thử tương ứng |
| Sửa | `prisma/schema.prisma` và tệp khởi tạo, `lib/rbac/permissions.ts`, `lib/bank/issuance.service.ts`, `lib/store/index.ts` |
| Bị ảnh hưởng | kiểm thử bảng quyền, kiểm thử phát hành, kiểm thử ràng buộc lưu trữ |

## Mức kiểm chứng: Cao

Trong lúc làm:

```
cd app && npx vitest run test/token-request.test.ts test/rbac.test.ts
cd app && npx vitest run test/issuance-service.test.ts test/store-constraints.test.ts
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Lập yêu cầu vượt trần còn lại thì bị chặn, nêu đúng điều kiện trượt |
| 2 | Yêu cầu đang chờ **không** làm đổi tổng cung |
| 3 | Duyệt thì tổng cung tăng đúng, mã giao dịch được ghi |
| 4 | Từ chối không có lý do thì bị chặn; từ chối hợp lệ không đổi tổng cung |
| 5 | **Người lập không duyệt được yêu cầu của mình** |
| 6 | Burn nguồn toàn bộ nguồn cung bị chặn khi còn token lưu hành |
| 7 | Phát hành **nhiều lần** tới khi chạm trần, lần vượt trần bị chặn |
| 8 | Số việc đang chờ đếm đúng theo vai trò |

Đột biến, **chỉ hai chỗ**:

- Hai lần duyệt đồng thời cùng một yêu cầu: chỉ một lần tác động token, tổng cung tăng đúng một lần.
- Điều kiện đổi giữa lúc lập và lúc duyệt, ví dụ token khác đã mint chạm trần: duyệt phải bị chặn.

## Điều kiện hoàn thành

- [ ] Bảng yêu cầu và cổng lưu trữ hoạt động ở cả hai bản.
- [ ] Giao dịch viên lập được, Kiểm soát viên duyệt được, không vai nào có cả hai quyền.
- [ ] Yêu cầu chờ duyệt không tác động token; duyệt mới tác động.
- [ ] Người lập không duyệt được yêu cầu của chính mình.
- [ ] Duyệt kiểm lại điều kiện tại thời điểm duyệt.
- [ ] Hai lần duyệt đồng thời chỉ tác động một lần.
- [ ] Phát hành nhiều lần theo trần còn lại; không còn chốt chặn một lần.
- [ ] Số việc đang chờ đếm đúng, điểm cắm của FE-20 đã gỡ.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không làm giao diện. Thuộc FE-22.
- Không bỏ kiểm tra lại điều kiện lúc duyệt.
- Không cho phép gộp quyền lập và duyệt vào một vai.
- Không viết cứng trần phát hành.
- Không đụng nghiệp vụ mua bán, chia lợi nhuận, rút tiền.
