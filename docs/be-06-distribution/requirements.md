# BE-06 — Nghiệp vụ chia lợi nhuận

| | |
|---|---|
| Nhánh | `feat/distribution-service`, từ `dev` sau khi BE-04 đã merge |
| Điểm | 8 |
| Mức kiểm chứng | **Cao** (chia tiền cho nhà đầu tư) |

## Mục tiêu

Theo luồng P7 đã chốt: SPV nạp VNDB vào ví chia lợi nhuận, hệ thống chốt quyền tại một thời điểm, rồi chia toàn bộ số dư trong ví đó cho người nắm giữ WPT **theo tỷ lệ tại thời điểm chốt**.

Nền đã sẵn: `IDistributionStore` (BE-09), `takeSnapshot`, `balanceOfAt`, `totalSupplyAt`, `profitPoolBalance`, `distributeBatch` trong `ILedgerPort` (BE-01), quyền `distribution:snapshot` và `distribution:execute` (BE-08). Task này ghép lại thành nghiệp vụ.

## Việc cần làm

1. `lib/bank/distribution.service.ts` với bốn hàm: mở kỳ, xem trước phân bổ, chia theo lô, đọc trạng thái kỳ.
2. **Mở kỳ** (`openPeriod`): kiểm quyền `distribution:snapshot`; đọc `profitPoolBalance`, không đủ tiền thì từ chối; gọi `takeSnapshot`; đọc `totalSupplyAt`, bằng 0 thì từ chối; lưu kỳ với mã kỳ, mã snapshot, tổng tiền, tổng cung tại snapshot. Mã kỳ trùng thì từ chối.
3. **Danh sách người nhận** lấy từ cơ sở dữ liệu, KHÔNG từ chuỗi: ví có lệnh mua ở trạng thái hoàn tất, cộng ví đã nhận chia ở kỳ trước. Chuỗi không liệt kê được người nắm giữ (xem `design.md` của BE-01).
4. **Xem trước phân bổ** (`previewDistribution`): với mỗi ví, đọc `balanceOfAt`, tính phần chia theo công thức ở mục Ràng buộc. Hàm đọc, không ghi.
5. **Chia theo lô** (`distributePeriod`): kiểm quyền `distribution:execute`; tạo bản ghi chi tiết chia ở trạng thái chờ **trước khi** gửi giao dịch; gọi `distributeBatch` từng lô; cập nhật trạng thái theo kết quả; ghi sổ kiểm toán.
6. Kích thước lô đọc từ tham số hệ thống, khóa `distribution.batch_size`, mặc định 50. Không viết cứng.
7. **Chạy lại phần còn thiếu**: gọi lại `distributePeriod` chỉ chia cho ví chưa nhận, không chia trùng.
8. Ghi `@flow distribute:<n>` cho cả luồng, gắn `@pending FE-08` và `@pending FE-09` cho các action, gỡ `@pending BE-06` ở `lib/store/index.ts`.
9. Thêm hai mục nợ kỹ thuật vào `tech-report.md`:
   - `isConfig` đang đọc từ bảng hằng số trong mã, cột `Role.isConfig` trong cơ sở dữ liệu chưa ai đọc. Chờ **AU-01** và **AU-02**.
   - `SystemConfigHistory` chưa có thứ tự tuyệt đối khi hai lần ghi trùng mốc phần nghìn giây. Thêm cột số thứ tự khi làm task đụng bảng này.

## Ràng buộc tính toán

- Phần chia của một ví: `tổng tiền × số dư tại snapshot / tổng cung tại snapshot`. **Nhân trước, chia sau.**
- Phần dư do làm tròn dồn về ví chỉ định, đọc từ tham số hệ thống `distribution.dust_wallet`. Không có thì giữ lại trong ví chia lợi nhuận.
- Tổng đã chia không được vượt tổng tiền của kỳ.
- Ví mua WPT **sau** thời điểm chốt được chia 0.

## Tác động

| | Tệp |
|---|---|
| Mới | `lib/bank/distribution.service.ts`, `app/actions/distribution.ts`, `app/test/distribution-service.test.ts` |
| Sửa | `lib/store/index.ts` (gỡ marker), `lib/config/issue-terms.ts` hoặc nơi khai mặc định tham số, `lib/bank/schemas.ts` |
| Đọc, không sửa | `lib/store/distribution.store.port.ts`, `lib/store/order.store.port.ts`, `lib/ledger/ledger.port.ts` |
| Test bị ảnh hưởng | `store-constraints` (nếu đụng cổng), `config-service` (nếu thêm khóa tham số) |

Đo bằng:

```
grep -rn "@pending BE-06" app/src
grep -E "^  [a-zA-Z]+\(" app/src/lib/store/distribution.store.port.ts
```

## Mức kiểm chứng: Cao

Trong lúc làm:

```
cd app && npx vitest run test/distribution-service.test.ts
cd app && npx vitest run test/config-service.test.ts test/store-constraints.test.ts
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Chia đúng tỷ lệ: hai ví 70 và 30 phần trăm nhận đúng số tiền |
| 2 | **Ví mua sau thời điểm chốt được chia 0** |
| 3 | Tổng đã chia bằng tổng tiền của kỳ, phần dư về ví chỉ định |
| 4 | Ví chia lợi nhuận không đủ tiền thì không mở được kỳ |
| 5 | Mã kỳ trùng thì từ chối |
| 6 | Chia theo lô: 120 ví với lô 50 thì gọi `distributeBatch` ba lần, không ví nào bị sót |
| 7 | Chạy lại sau khi một lô lỗi: chỉ chia cho ví chưa nhận, không chia trùng |
| 8 | Vai không có `distribution:execute` bị chặn, có bản ghi kiểm toán |

Đột biến, **chỉ hai chỗ**:

- Một lô ném lỗi giữa chừng: các ví trong lô đó **không** bị đánh dấu đã nhận, và chạy lại chia đúng cho họ.
- Đổi `distribution.batch_size` thành số khác: số lần gọi `distributeBatch` đổi theo, kết quả chia không đổi.

## Điều kiện hoàn thành

- [ ] Mở kỳ chốt được snapshot, từ chối khi ví lợi nhuận thiếu tiền, tổng cung bằng 0, hoặc mã kỳ trùng.
- [ ] Xem trước phân bổ đúng tỷ lệ, không ghi gì vào cơ sở dữ liệu.
- [ ] Ví mua sau thời điểm chốt được chia 0.
- [ ] Tổng đã chia bằng tổng tiền kỳ, phần dư xử lý đúng.
- [ ] Chia theo lô không sót ví, kích thước lô đọc từ tham số hệ thống.
- [ ] Lô lỗi giữa chừng không đánh dấu nhầm; chạy lại không chia trùng.
- [ ] Hai mục nợ kỹ thuật đã ghi vào `tech-report.md`.
- [ ] `run-local-all.sh` xanh.

## Không làm

- **Không thêm method liệt kê người nắm giữ vào `ILedgerPort`.** Chuỗi không cung cấp được; danh sách lấy từ cơ sở dữ liệu.
- Không tự chia lô bên trong adapter. Tầng nghiệp vụ quyết định kích thước lô.
- Không viết cứng kích thước lô.
- Không làm tiến trình hẹn giờ. Việc đó thuộc **BE-07**.
- Không làm giao diện. Thuộc FE-08 và FE-09.
- Không sửa `distribution.store.port.ts` trừ khi thiếu hàm thật sự; nếu phải sửa thì ghi vào checkpoint.
