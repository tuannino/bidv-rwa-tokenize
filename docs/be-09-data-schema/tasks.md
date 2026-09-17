# BE-09 — Mở rộng lược đồ dữ liệu: tasks

Nhánh `feat/data-schema`, tạo **từ `dev`**.

Làm **sau khi BE-02 đã chốt mô hình trạng thái lệnh mua**. Nếu BE-02 chưa chốt, làm bước 2 đến 5 trước (các bảng không phụ thuộc lệnh mua), để dành bước 1.

---

## Bước 1: Bảng lệnh mua

- [ ] 1.1 Thêm `PurchaseOrder` vào `schema.prisma` theo `design.md` mục 2.
- [ ] 1.2 Trạng thái lấy đúng theo mô hình BE-02 đã chốt, **không tự định nghĩa**.
- [ ] 1.3 Chỉ mục: `investorWallet`, `status`. Duy nhất: `txHash` khi không rỗng.

*Commit:* `feat(db): bảng lệnh mua WPT`

## Bước 2: Bảng kỳ chia lợi nhuận

- [ ] 2.1 Thêm `DistributionPeriod` với `periodKey` duy nhất.
- [ ] 2.2 Thêm `DistributionPayout` với duy nhất `(periodId, investorWallet)`.
- [ ] 2.3 Chỉ mục theo `investorWallet` để nhà đầu tư tra lịch sử của mình.

*Commit:* `feat(db): bảng kỳ chia và chi tiết chia lợi nhuận`

## Bước 3: Bảng tất toán

- [ ] 3.1 Thêm `SettlementRound`.
- [ ] 3.2 Thêm `SettlementCase` với đủ **bốn** cặp thời điểm và mã giao dịch theo diagram P2.
- [ ] 3.3 Duy nhất `(roundId, holderWallet)`.
- [ ] 3.4 Lưu `payoutAmount` tại thời điểm chốt, không tính lại từ `navRate`.

*Commit:* `feat(db): bảng đợt tất toán và hồ sơ người nắm giữ`

## Bước 4: Bảng mốc chạy tiến trình hẹn giờ

- [ ] 4.1 Thêm `KeeperRun` với duy nhất `(jobName, periodKey)`.

*Commit:* `feat(db): bảng mốc chạy tiến trình hẹn giờ`

## Bước 5: Sinh lại lược đồ SQL

- [ ] 5.1 `npx prisma validate` không lỗi.
- [ ] 5.2 Sinh lại `init.sql` bằng công cụ. **Không sửa tay.**
- [ ] 5.3 Xóa dữ liệu và chạy `docker compose up` từ đầu, xác nhận khởi tạo thành công.
- [ ] 5.4 Xác nhận không cột nào của bảng cũ bị sửa hay xóa.

*Commit:* `chore(db): sinh lại init.sql từ lược đồ`

## Bước 6: Bốn cổng lưu trữ mới

- [ ] 6.1 Định nghĩa 4 interface theo `design.md` mục QĐ-1.
- [ ] 6.2 Hiện thực bản Postgres, truy vấn **tham số hóa**, dùng `pg` thuần.
- [ ] 6.3 Hiện thực bản bộ nhớ, state trên `globalThis`.
- [ ] 6.4 Bản bộ nhớ **kiểm đủ ràng buộc duy nhất** và ném cùng loại lỗi với bản Postgres.
- [ ] 6.5 Cập nhật `lib/store/index.ts` xuất factory cho từng cổng, chọn theo `USE_MOCK_DB`.
- [ ] 6.6 Số tiền trả ra dạng chuỗi, không trả `Decimal` hay `bigint`.

*Commit:* `feat(store): bốn cổng lưu trữ cho ba luồng nghiệp vụ`

## Bước 7: Kiểm thử

- [ ] 7.1 Tạo `app/test/store-constraints.test.ts`.
- [ ] 7.2 Test: ghi trùng `(periodId, investorWallet)` bị từ chối ở **cả hai** bản.
- [ ] 7.3 Test: ghi trùng `(roundId, holderWallet)` bị từ chối ở cả hai bản.
- [ ] 7.4 Test: ghi trùng `(jobName, periodKey)` bị từ chối ở cả hai bản.
- [ ] 7.5 Test: mở cùng một `periodKey` hai lần bị từ chối.
- [ ] 7.6 Test: chỉ giá trị trạng thái hợp lệ được ghi.
- [ ] 7.7 Chạy `bash scripts/run-local-all.sh`.

*Commit:* `test(store): kiểm thử ràng buộc duy nhất ở cả hai bản lưu trữ`

## Bước 8: Tài liệu

- [ ] 8.1 Cập nhật `tech-report.md` mục 3.5 với bốn cổng mới và bảng dữ liệu.
- [ ] 8.2 Cập nhật metadata.

*Commit:* `docs: cập nhật báo cáo công nghệ cho lược đồ mới`

---

## Việc KHÔNG được làm

- Không sửa hay xóa cột của bảng đang có.
- Không sửa `init.sql` bằng tay.
- Không dùng Prisma Client lúc chạy.
- Không để bản bộ nhớ dễ tính hơn bản Postgres.
- Không viết logic nghiệp vụ đọc ghi các bảng này.
- Không nối chuỗi vào câu truy vấn SQL.

## Checkpoint

`docs/CHECKPOINT_BE09.md`: kết quả chạy, danh sách bảng và ràng buộc đã thêm, kết quả `docker compose up` từ cơ sở dữ liệu rỗng, deviation, câu hỏi mở.
