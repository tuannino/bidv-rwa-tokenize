# BE-09 — Mở rộng lược đồ dữ liệu: design

## 1. Quyết định thiết kế

### QĐ-1: Tách cổng lưu trữ theo nghiệp vụ, không dồn vào `ITxnStore`

`ITxnStore` hiện có 5 hàm cho giao dịch và sổ kiểm toán. Nếu nhồi thêm 4 nhóm bảng nữa thì interface phình lên khoảng 20 hàm, mỗi lần thêm nghiệp vụ lại phải sửa cả hai bản hiện thực.

Cách làm: giữ `ITxnStore` nguyên, thêm ba cổng mới trong cùng thư mục `lib/store/`:

```
IOrderStore         — lệnh mua WPT
IDistributionStore  — kỳ chia và chi tiết từng lần chia
ISettlementStore    — đợt tất toán và hồ sơ từng người nắm giữ
IKeeperStore        — mốc chạy tiến trình hẹn giờ
```

Mỗi cổng có hai hiện thực bộ nhớ và Postgres, chọn bằng cùng cờ `USE_MOCK_DB` đang dùng. `lib/store/index.ts` xuất ra factory cho từng cổng.

### QĐ-2: Ràng buộc duy nhất là cách chống chia trùng và chi trả trùng

Đây là điểm quan trọng nhất của task. Ba ràng buộc bắt buộc:

| Bảng | Ràng buộc duy nhất | Chặn điều gì |
|---|---|---|
| Kỳ chia | mã kỳ | mở cùng một kỳ hai lần |
| Chi tiết chia | (kỳ, ví) | chia trùng cho một nhà đầu tư |
| Hồ sơ tất toán | (đợt, ví) | chi trả hoặc đốt trùng |
| Mốc hẹn giờ | (tên công việc, kỳ) | tiến trình chạy trùng |

Không dựa vào kiểm tra trong mã trước khi ghi, vì hai tiến trình chạy song song có thể cùng vượt qua kiểm tra rồi cùng ghi. Ràng buộc ở cơ sở dữ liệu là chốt chặn thật.

### QĐ-3: Bản bộ nhớ phải nghiêm ngặt ngang bản Postgres

Bản bộ nhớ cũng phải kiểm ràng buộc duy nhất và ném cùng loại lỗi. Đây là nguyên tắc đã áp dụng cho `mock.adapter.ts`: mock dễ tính hơn bản thật sẽ sinh lỗi chỉ xuất hiện khi chạy Postgres, rất khó tìm.

Bản bộ nhớ đặt state trên `globalThis` như `memory.store.ts` hiện có, để không mất khi Next nạp lại module.

### QĐ-4: Trạng thái lưu dạng chuỗi có kiểm soát, không dùng enum của Prisma

`Txn` hiện dùng enum `TxStatus`, nhưng các bảng mới có nhiều trạng thái và sẽ còn thay đổi trong quá trình làm. Dùng `String` ở cơ sở dữ liệu, kiểu hợp union ở TypeScript. Tránh phải sinh lại lược đồ mỗi lần thêm một trạng thái.

Đổi lại phải có test xác nhận chỉ các giá trị hợp lệ được ghi.

## 2. Bảng cần thêm

### PurchaseOrder — lệnh mua WPT

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | String, khóa chính | uuid |
| investorWallet | String | có chỉ mục |
| wptAmount | Decimal(78,0) | số lượng WPT |
| paymentAmount | Decimal(78,0) | số VNDB phải trả |
| status | String | có chỉ mục |
| txHash | String, cho phép rỗng | duy nhất khi không rỗng |
| failureReason | String, cho phép rỗng | |
| chain | String | |
| createdAt, updatedAt, executedAt | Timestamptz(3) | |

`txHash` duy nhất là cách chống gửi giao dịch hai lần cho cùng một lệnh.

### DistributionPeriod và DistributionPayout

Kỳ chia: `id`, `periodKey` (duy nhất), `snapshotId`, `totalAmount`, `totalSupplyAt`, `status`, `chain`, `openedAt`, `completedAt`.

Chi tiết chia: `id`, `periodId` (khóa ngoài), `investorWallet`, `balanceAt`, `amount`, `status`, `txHash`, `batchNo`, thời gian. Duy nhất `(periodId, investorWallet)`.

### SettlementRound và SettlementCase

Đợt tất toán: `id`, `snapshotId`, `navRate`, `status`, `initiatedAt`, `completedAt`, `chain`.

Hồ sơ từng người: `id`, `roundId`, `holderWallet`, `wptAmount`, `payoutAmount`, `status`, và bốn cặp thời điểm cùng mã giao dịch: `notifiedAt`, `confirmedAt`, `paidAt`, `paidTxHash`, `burnedAt`, `burnTxHash`. Duy nhất `(roundId, holderWallet)`.

Lưu `payoutAmount` tại thời điểm chốt thay vì tính lại từ `navRate`, để nếu giá NAV bị sửa thì hồ sơ đã chốt không đổi theo.

### KeeperRun — mốc chạy tiến trình hẹn giờ

`id`, `jobName`, `periodKey`, `startedAt`, `finishedAt`, `status`, `error`. Duy nhất `(jobName, periodKey)`.

## 3. Tệp thay đổi

```
app/prisma/schema.prisma                (sửa)  — thêm 6 bảng
app/prisma/init.sql                     (sinh lại, KHÔNG sửa tay)
app/src/lib/store/order.store.port.ts         (mới)
app/src/lib/store/distribution.store.port.ts  (mới)
app/src/lib/store/settlement.store.port.ts    (mới)
app/src/lib/store/keeper.store.port.ts        (mới)
app/src/lib/store/memory.*.store.ts           (mới, 4 tệp)
app/src/lib/store/postgres.*.store.ts         (mới, 4 tệp)
app/src/lib/store/index.ts              (sửa)  — factory cho từng cổng
app/test/store-constraints.test.ts      (mới)  — test ràng buộc duy nhất
```

## 4. Điểm cần chú ý

- **Sinh lại `init.sql` bằng công cụ**, không sửa tay. Có hai nguồn DDL là nguồn lỗi khó tìm.
- Mọi truy vấn Postgres phải tham số hóa, giữ đúng cách `postgres.store.ts` hiện có.
- Không dùng Prisma Client lúc chạy. Prisma chỉ để sinh lược đồ, vì Prisma Client nặng khoảng 22 MB và sẽ phá giới hạn gói khi triển khai dạng worker.
- Số tiền đọc ra từ `Decimal` phải chuyển sang chuỗi trước khi qua biên máy chủ sang trình duyệt, giống cách `TxnRecord.amount` đang làm.
- Bảng tất toán có bốn trạng thái theo diagram P2. Đừng rút gọn còn hai, vì màn hình FE-10 cần theo dõi đủ bốn.
