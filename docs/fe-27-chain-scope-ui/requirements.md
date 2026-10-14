# FE-27: Giao diện đồng bộ theo chain đang chọn và rà phạm vi chain của dữ liệu

| | |
|---|---|
| Nhánh | `feat/fe-27-chain-scope`, từ `dev` sau khi OP-07 merge |
| Điểm | 5 (3 ban đầu, thêm 2 cho giá phát hành theo chain) |
| Mức kiểm chứng | Vừa |
| Thứ tự | Sau OP-07 (dùng chung các màn có dữ liệu mock; làm sau để kiểm trên trạng thái mock đã bền) |

## Mục tiêu

Đổi chain trên giao diện thì mọi số liệu tải lại đúng chain mới: trạng thái ledger, lịch sử, dự án, yêu
cầu Mint/Burn, số liệu tổng hợp. Phản hồi chậm của chain cũ không được ghi đè dữ liệu chain mới. Mọi dữ
liệu nghiệp vụ trong database được lọc theo chain.

## Hiện trạng đã đo (Supervisor, `dev` @ `615c7ef`)

```bash
grep -rln "useSelectedChain" app/src/components | wc -l          # 19 tep giao dien doc chain dang chon
grep -L "useSelectedChain" app/src/components/pages/*.tsx         # cac man KHONG doc chain dang chon
grep -n "chain" app/src/components/maker-checker/request-table.tsx # bang yeu cau hien cot chain, khong loc
```

- Chain đang chọn nằm phía trình duyệt (`lib/chains/chain-store.ts`); màn nào tự đọc thì tự lọc.
- Màn Duyệt (`approvals.tsx`, `approval-detail.tsx`) không đọc chain đang chọn: danh sách hiện yêu cầu của
  mọi chain kèm cột chain.
- Bảng có cột `chain`: `Txn`, `AuditLog`, `PurchaseOrder`, `DistributionPeriod`, `SettlementRound`,
  `Project`, `TokenRequest`. Bảng con theo chain qua khoá ngoại: `DistributionPayout`, `SettlementCase`.
  Không có chain: `Investor` (KYC là hồ sơ người, không theo chain), `SystemConfig` (có giá phát hành),
  `KeeperRun`, `Role`, `Permission`.

## Việc cần làm

1. **Rà soát** từng màn trong `components/pages/` và khối dữ liệu dùng chung: màn nào đọc dữ liệu theo
   chain, có lọc theo chain đang chọn chưa, có huỷ hoặc bỏ qua phản hồi cũ khi đổi chain chưa. Kết quả là
   một bảng trong checkpoint (màn, nguồn dữ liệu, trước, sau).
2. **Sửa theo một khuôn chung:** mọi lượt đọc theo chain gắn khoá `chain` vào khoá tải lại; khi chain
   đổi thì huỷ lượt cũ (`AbortController` hoặc cờ huỷ như `draft.tsx` đang làm) và chỉ nhận kết quả có
   `chain` khớp chain hiện tại. Không tự viết lại màn đã đúng.
3. **Màn Duyệt** (`approvals.tsx`, `approval-detail.tsx`): lọc theo chain đang chọn (CH-1 đã chốt). Mở chi tiết một yêu cầu của chain khác qua đường dẫn trực tiếp thì báo rõ yêu cầu thuộc chain nào, không duyệt nhầm chain.
4. **Phía máy chủ:** mọi hàm đọc danh sách trong `lib/bank` nhận `chain` và truyền xuống store; store
   Postgres lọc theo chain. Bổ sung kiểm thử cho hàm nào còn thiếu.
5. **Giá phát hành theo chain** (CH-2 đã chốt): mỗi chain một giá, cấu hình được theo chain, giá khởi tạo
   của mọi chain là **100.000 VNDB** (bằng `WPT_ISSUE_PRICE_VND` hiện có).
   - Khoá cấu hình gắn chain (ví dụ `issuePriceVnd` kèm chain trong khoá, hoặc thêm cột chain; người làm
     chọn cách không phải đổi chữ ký nhiều nhất và ghi lý do). Seed tạo giá 100.000 cho mọi chain có trong
     `CHAIN_ORDER`.
   - `readIssuePriceVnd(chain)`, `setIssuePrice` ghi đúng giá của chain đang chọn và đẩy xuống đúng chain đó
     (giữ thứ tự BE-04: đẩy xuống chuỗi trước, ghi database sau). Với chain chưa đẩy được giá (EVM còn
     chặn SC-03) thì giữ hành vi hiện tại của chain đó, ghi rõ.
   - Màn hiển thị giá (vị thế nhà đầu tư, lệnh mua, Cấu hình nếu có) đọc giá của chain đang chọn.
   - Database cũ: không cần chuyển dữ liệu vì database sẽ được làm mới (OP-07 QĐ-6).
6. Kiểm thử đầu cuối: đổi chain giữa `mock` và `hardhat-local` trên các màn Lập lệnh, Duyệt, Giao dịch,
   Tổng quan người bán; dữ liệu đúng chain; làm chậm giả lập phản hồi chain cũ và xác nhận không ghi đè.

## Điều kiện hoàn thành

- [ ] Bảng rà soát đủ các màn trong `components/pages/`.
- [ ] Mọi màn đọc theo chain tải lại khi đổi chain và bỏ phản hồi cũ.
- [ ] Màn Duyệt lọc theo chain đang chọn, không duyệt nhầm chain.
- [ ] Hàm đọc danh sách phía máy chủ lọc theo chain, có kiểm thử.
- [ ] Giá phát hành theo chain, khởi tạo 100.000 cho mọi chain, đặt giá chain này không đổi giá chain khác (có kiểm thử).
- [ ] Đầu cuối đổi chain xanh, gồm ca phản hồi chậm.
- [ ] Bộ mặc định xanh.

## Câu hỏi cho chủ dự án (đã trả lời 14/10)

| Mã | Câu hỏi | Chủ dự án chốt |
|---|---|---|
| CH-1 | Màn Duyệt lọc theo chain đang chọn hay xem tất cả? | **Lọc theo chain đang chọn** để nhất quán chế độ xem |
| CH-2 | Giá phát hành một giá chung hay mỗi chain một giá? | **Mỗi chain một giá**, cấu hình được theo chain, tạm thời mọi chain 100.000 |
