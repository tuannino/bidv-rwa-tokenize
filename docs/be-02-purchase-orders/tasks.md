# BE-02 — Quản lý lệnh mua WPT: tasks

Nhánh `feat/purchase-orders`, tạo **từ `dev`**.

Phụ thuộc BE-08, BE-09, BE-01. Nếu chưa đủ, làm bước 1 và 2 trước, vì mô hình trạng thái không cần cơ sở dữ liệu lẫn interface. **Chốt mô hình trạng thái ở bước 1 rồi báo ngay**, vì BE-09 chờ nó để dựng bảng.

---

## Bước 1: Mô hình trạng thái

- [ ] 1.1 Tạo `lib/bank/purchase.state.ts` với 7 trạng thái theo `design.md` mục 1.
- [ ] 1.2 Viết hàm kiểm chuyển tiếp hợp lệ, dựa trên bảng chuyển tiếp.
- [ ] 1.3 Xác nhận **không có** trạng thái nào mô tả đã trả tiền mà chưa nhận token.
- [ ] 1.4 Tạo `app/test/purchase-state.test.ts`, phủ mọi chuyển tiếp hợp lệ và một số chuyển tiếp sai.
- [ ] 1.5 **Báo mô hình đã chốt** để BE-09 dựng bảng.

*Commit:* `feat(purchase): mô hình trạng thái lệnh mua WPT`

## Bước 2: Schema và mã lỗi

- [ ] 2.1 Thêm schema đặt lệnh và khớp lệnh vào `lib/bank/schemas.ts`, số lượng nhận **chuỗi** rồi chuyển sang `bigint`.
- [ ] 2.2 Thêm 5 mã lỗi mới vào `result.ts` theo `design.md` mục 5.
- [ ] 2.3 Cập nhật `httpStatusFor` cho mã mới.
- [ ] 2.4 Giữ nguyên toàn bộ mã lỗi đang có.

*Commit:* `feat(purchase): schema và mã lỗi cho lệnh mua`

## Bước 3: Đặt lệnh

- [ ] 3.1 Hiện thực `placeOrder` trong `lib/bank/purchase.service.ts`.
- [ ] 3.2 Kiểm quyền `order:place`, ghi sổ kiểm toán cho **cả hai** kết cục.
- [ ] 3.3 Tính và **lưu** số VNDB phải trả tại thời điểm đặt.
- [ ] 3.4 Trả `Result<OrderView>` với số lượng và số tiền dạng chuỗi.

*Commit:* `feat(purchase): đặt lệnh mua WPT`

## Bước 4: Khớp lệnh

- [ ] 4.1 Hiện thực `executeOrder` theo **đúng 11 bước** ở `design.md` mục 6.
- [ ] 4.2 Bốn lần kiểm đọc theo thứ tự ở QĐ-2, dừng ở lần trượt đầu tiên.
- [ ] 4.3 Cập nhật có điều kiện sang `EXECUTING`, kiểm số dòng bị ảnh hưởng. Không đổi được thì trả `ORDER_STATE`.
- [ ] 4.4 Lưu mã giao dịch **ngay khi có**, trước khi chờ biên nhận.
- [ ] 4.5 Sau khi hoàn tất, đọc lại số dư WPT từ chuỗi.
- [ ] 4.6 Ghi sổ kiểm toán cho kết quả thành công và thất bại.

*Commit:* `feat(purchase): khớp lệnh mua trong một giao dịch`

## Bước 5: Truy vấn và hết hạn

- [ ] 5.1 Hiện thực `listOrders`, lọc theo ví ở **tầng nghiệp vụ**.
- [ ] 5.2 Vai nhà đầu tư chỉ xem được lệnh của ví mình, kể cả khi truyền ví khác vào.
- [ ] 5.3 Hiện thực `expireStaleOrders`, chỉ cung cấp hàm, không dựng lịch.

*Commit:* `feat(purchase): truy vấn lệnh và xử lý lệnh quá hạn`

## Bước 6: Tầng vận chuyển

- [ ] 6.1 Tạo `app/actions/purchase.ts`, vỏ mỏng, chỉ chuyển tiếp.
- [ ] 6.2 Tạo `app/api/purchase/route.ts` cho kịch bản demo và kiểm thử đầu cuối.
- [ ] 6.3 Route handler map mã lỗi sang trạng thái HTTP qua `httpStatusFor`.
- [ ] 6.4 Xác nhận **không** có guard quyền nào nằm ở tầng này.

*Commit:* `feat(purchase): server action và route handler`

## Bước 7: Kiểm thử nghiệp vụ

- [ ] 7.1 Tạo `app/test/purchase-service.test.ts`, chạy với mock adapter.
- [ ] 7.2 Test: thiếu số dư VNDB thì `REJECTED`, **không** gửi giao dịch.
- [ ] 7.3 Test: thiếu ủy quyền thì `REJECTED`.
- [ ] 7.4 Test: ví thanh toán SPV thiếu WPT thì `REJECTED`.
- [ ] 7.5 Test: khớp thành công thì số dư hai bên đổi đúng.
- [ ] 7.6 Test: khớp thất bại thì **không bên nào** đổi số dư.
- [ ] 7.7 Test: gọi `executeOrder` hai lần cho cùng lệnh chỉ gửi **một** giao dịch.
- [ ] 7.8 Test: nhà đầu tư không xem được lệnh của ví khác.
- [ ] 7.9 Test: vai không có `order:execute` bị chặn và có bản ghi kiểm toán.
- [ ] 7.10 Chạy `bash scripts/run-local-all.sh`.

*Commit:* `test(purchase): kiểm thử nghiệp vụ lệnh mua`

## Bước 8: Tài liệu

- [ ] 8.1 Cập nhật `tech-report.md` mục 3.4 với service mới, và Phần 4 với bản đồ luồng mua WPT.
- [ ] 8.2 Bản đồ luồng ghi rõ đi qua file nào, hàm nào, theo thứ tự nào, ai ký.
- [ ] 8.3 Cập nhật metadata.

*Commit:* `docs: cập nhật báo cáo công nghệ cho luồng mua WPT`

---

## Việc KHÔNG được làm

- Không thêm trạng thái mô tả việc đã trả tiền mà chưa nhận token.
- Không gọi `viem` trực tiếp. Mọi thứ qua `ILedgerPort`.
- Không đặt guard quyền ở server action hay route handler.
- Không tính lại số VNDB phải trả khi khớp lệnh.
- Không ghi số dư WPT vào bảng lệnh làm nguồn sự thật.
- Không dựng lịch tự động. Việc đó thuộc BE-07.
- Không làm giao diện. Thuộc FE-05 và FE-06.

## Checkpoint

`docs/CHECKPOINT_BE02.md`, gồm:

1. Kết quả chạy đầy đủ, dán nguyên văn.
2. Sơ đồ trạng thái cuối cùng đã hiện thực.
3. Bảng: 9 ca kiểm thử ở bước 7, ca nào đã phủ.
4. Deviation, câu hỏi mở, sai lệch phát hiện được.
