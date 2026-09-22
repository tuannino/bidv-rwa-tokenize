# BE-04 — Phát hành một lần và giá cấu hình được

| | |
|---|---|
| Nhánh | `feat/issuance-and-config`, từ `dev` sau khi `efficiency.md` đã merge |
| Điểm | 10 |
| Mức kiểm chứng | **Cao** (đụng giá bán, tức tiền của nhà đầu tư) |

## Mục tiêu

1. Giá phát hành WPT và tổng cung lưu trong cơ sở dữ liệu, cán bộ ngân hàng cấu hình được, không viết cứng.
2. Phát hành đúng mô hình đã chốt: **một lần** toàn bộ nguồn cung vào ví thanh toán SPV.
3. Giá hiển thị và giá khớp lệnh **luôn bằng nhau**.

Điểm 3 là rủi ro chính. Giá khớp lệnh nằm trong ledger (`state().wptPriceVnd` ở mock, hợp đồng khớp lệnh ở chuỗi thật), nhưng `ILedgerPort` chưa có cách đặt giá xuống. Chỉ ghi giá vào cơ sở dữ liệu thì nhà đầu tư thấy một giá, bị trừ tiền theo giá khác.

## Việc cần làm

**Dữ liệu**

1. Bảng `SystemConfig` (khóa, giá trị, kiểu, người và thời điểm cập nhật) và `SystemConfigHistory` (khóa, giá trị cũ, giá trị mới, người đổi, thời điểm, lý do).
2. Bảng `Project` (mã token, tên, tổng cung `Decimal(78,0)`, trạng thái, chuỗi, địa chỉ hợp đồng, thời điểm phát hành).
3. Cột `Role.isConfig`, mặc định `false`.
4. Dữ liệu khởi tạo: `wpt.issue_price_vnd = 100000`, `wpt.price_change_threshold = 2`, dự án WPT tổng cung 20.000.000, vai BANK_ADMIN `isConfig = true`. Sinh tệp khởi tạo bằng công cụ.
5. Cổng lưu trữ cấu hình và dự án, mỗi cổng hai bản, theo mẫu các cổng đã có.

**Giá**

6. Thêm `setPurchasePrice(pricePerWpt)` vào `ILedgerPurchase`. Mock cập nhật state; evm gắn `@blocked SC-03`; stellar ném lỗi.
7. `setIssuePrice`: kiểm quyền, kiểm giá dương và ngưỡng, **đẩy xuống ledger trước**, thành công mới ghi cơ sở dữ liệu và lịch sử. Ghi cơ sở dữ liệu thất bại thì đẩy lại giá cũ xuống ledger.
8. `getIssuePrice`: đọc cơ sở dữ liệu, trống thì dùng mặc định trong `lib/config/issue-terms.ts`.
9. Ledger mô phỏng khởi tạo giá từ cấu hình. Đặt việc này trong factory `getLedger`, không để mock phụ thuộc tầng lưu trữ.
10. Chuyển `issuance.ts` và `portfolio.service.ts` sang đọc qua `getIssuePrice`.

**Quyền**

11. `assertCanConfigure`: `assertCan(role, 'treasury:manage')` rồi kiểm `isConfig`. Giữ cả hai lớp.

**Phát hành**

12. `issueInitialSupply`: tổng cung lấy từ `Project`, từ chối nếu đã phát hành, lưu giao dịch chờ trước khi đợi biên nhận, đọc lại tổng cung từ chuỗi sau khi xong, cập nhật `Project.issuedAt`. Gắn `@flow issue:<n>`.
13. Đổi `mintTokens` thành `mintToInvestorDirect`, ghi rõ là đường nền cho bản trình diễn. Giữ tên `mintAction`.

**Điểm cắm và trạng thái**

14. Thêm `FE-07` vào `planned` trong `.kiro/task-status.json` **trước** khi gắn marker.
15. Action đặt giá và phát hành gắn `@pending FE-07`.
16. Gỡ giá viết cứng trong test: dùng giá làm dữ liệu thì đọc nguồn chung; test chủ đích kiểm giá mặc định thì giữ, thêm chú thích.

## Tác động

| | Tệp |
|---|---|
| Sửa | `prisma/schema.prisma`, `prisma/init.sql` (sinh), `lib/ledger/ledger.port.ts`, cả ba adapter, `lib/ledger/index.ts`, `lib/store/index.ts`, `lib/bank/mint.service.ts`, `lib/bank/issuance.ts`, `lib/bank/portfolio.service.ts`, `app/actions/bank.ts`, `app/api/mint/route.ts` |
| Mới | cổng cấu hình, cổng dự án, `lib/bank/config.service.ts`, `app/actions/config.ts` |
| Test bị ảnh hưởng | `mock-ledger`, `issue-price-single-source`, `portfolio-service`, `purchase-service`, `store-constraints` |

Đo bằng:

```
grep -rlnE "issue-terms|WPT_ISSUE_PRICE_VND" app/src app/test
grep -rcE "100_000|100000" app/test/*.ts | grep -v ":0"     # 9 chỗ trên 4 tệp
grep -rln "mintTokens" app/src app/test app/e2e             # 3 tệp
```

## Mức kiểm chứng: Cao

Trong lúc làm, chạy test của phần đang sửa:

```
cd app && npx vitest run test/mock-ledger.test.ts test/store-constraints.test.ts
cd app && npx vitest run test/config-service.test.ts test/issuance-service.test.ts
```

Cuối task: `bash scripts/run-local-all.sh` một lần.

Ca kiểm thử:

| Ca | Kiểm |
|---|---|
| 1 | Sau khi đặt giá, `getIssuePrice()` bằng `ledger.quotePurchase(1)` |
| 2 | Giá âm hoặc 0 bị từ chối; lệch quá ngưỡng mà không xác nhận thì bị từ chối |
| 3 | Lệnh đã đặt giữ giá cũ sau khi đổi giá |
| 4 | Phát hành đúng tổng cung từ `Project`; lần hai bị từ chối |
| 5 | Đổi giá mặc định thành số khác, toàn bộ test vẫn xanh trừ test chủ đích kiểm mặc định |

Đột biến, **chỉ hai chỗ**:

- `setPurchasePrice` ném lỗi thì cơ sở dữ liệu **không đổi**.
- Tắt `isConfig` thì bị từ chối **dù có** `treasury:manage`.

## Điều kiện hoàn thành

- [ ] Ba bảng mới và cột `isConfig` có trong lược đồ; dựng lại cơ sở dữ liệu từ đầu thành công.
- [ ] Sau khi đặt giá, giá trong cơ sở dữ liệu bằng giá `quotePurchase` trả về.
- [ ] Đẩy giá xuống ledger thất bại thì cơ sở dữ liệu không đổi.
- [ ] Tắt `isConfig` thì từ chối dù vai có `treasury:manage`.
- [ ] Phát hành một lần đúng tổng cung lấy từ `Project`; lần hai bị từ chối.
- [ ] Không còn 20.000.000 viết cứng; không nơi nào đọc hằng số giá trực tiếp ngoài `getIssuePrice`.
- [ ] Đổi giá mặc định, test vẫn xanh.
- [ ] `run-local-all.sh` xanh.

## Không làm

- **Không ghi cơ sở dữ liệu trước khi đẩy giá xuống ledger.**
- Không bỏ lớp RBAC khi kiểm quyền cấu hình.
- Không đệm giá xuyên yêu cầu: đổi giá phải có hiệu lực ngay.
- Không xóa `mintTokens`, chỉ đổi tên.
- Không chuyển màn danh sách token sang đọc `Project`; chỉ để `@pending`.
- Không chuyển toàn bộ phân quyền sang cơ sở dữ liệu (thuộc AU-02).
