# Nợ kỹ thuật: hỗ trợ nhiều loại token và nhiều dự án

| | |
|---|---|
| Ngày | 02/11/2026 |
| Mốc mã | `dev` @ `67ece1e` |
| Người lập | Supervisor |
| Trạng thái | Ghi nhận, CHƯA làm. PoC chỉ vận hành WPT của dự án Điện gió An Viên |
| Nơi trỏ tới | `docs/tech-report.md` mục 1.6.C |

## 1. Mục tiêu đã chốt

1. Hệ thống hỗ trợ **nhiều loại token** (ví dụ WPT, Wind Project Token; TCC, Tokenized Carbon Credit).
2. Mỗi loại token có **nhiều dự án**. Mỗi dự án là **một token riêng** cùng loại, ký hiệu theo dạng `<loại>-<mã dự án>`, ví dụ `WPT-AVN` (Điện gió An Viên), `WPT-PQY` (Điện gió Phú Quý).
3. Mỗi dự án triển khai **một bộ hợp đồng riêng** từ cùng một mẫu hợp đồng của loại token (ProjectToken, SpvPaymentVault, OrderSettlement, ProfitDistributor, Redemption). Trần phát hành của mỗi dự án độc lập, không dùng chung một hợp đồng rồi chắp vá ràng buộc giữa các dự án.
4. Sổ danh tính KYC (`IdentityRegistry`) dùng chung được giữa các dự án. Bộ luật tuân thủ thì KHÔNG dùng chung một bản: `ModularCompliance` hiện chỉ gắn MỘT token (`_tokenBound`; `bindToken` từ chối khi đã gắn; các hàm gọi lại chỉ nhận token đã gắn, `compliance/ModularCompliance.sol:12, 29-37`). Mỗi ProjectToken có một bản `ModularCompliance` riêng, tái sử dụng được mẫu luật; module luật có trạng thái phải đánh giá riêng khả năng dùng chung.

## 2. Hiện trạng (vì sao là nợ)

Hệ thống ngầm định **một token dự án trên mỗi chain**:

| Tầng | Hiện trạng | Bằng chứng |
|---|---|---|
| Hợp đồng | Đã đúng mục tiêu: mỗi hợp đồng nghiệp vụ giữ `projectToken` dạng `immutable`; trần `cap` cố định lúc triển khai | `OrderSettlement.sol:57-59`, `ProfitDistributor.sol:44-45`, `SpvPaymentVault.sol:47-48`, `ProjectToken.sol:45` |
| Sổ địa chỉ | Theo chain, mỗi tên hợp đồng một địa chỉ | `packages/shared/src/addresses.ts:15`, `types.ts:27-37` |
| Ledger | `getLedger(chain)`; mọi hàm không có tham số token | `app/src/lib/ledger/ledger.port.ts`, `evm.adapter.ts` |
| Database | `Project` duy nhất theo (`tokenSymbol`, `chain`). `PurchaseOrder`, `DistributionPeriod`, `Txn` chỉ có cột `chain` nên không biết thuộc token nào. `PaymentWithdrawRequest` (rút VNDB) cũng chỉ có `chain`, nhưng đây là tài sản thanh toán dùng chung, không thuộc dự án | `app/prisma/schema.prisma` |
| Cấu hình | Khoá chung `wpt.issue_price_vnd`, `wpt.annual_yield_percent`, `wpt.trading_fee_percent`, `wpt.remaining_lifetime_years`, `wpt.price_change_threshold` | `app/src/lib/config/issue-terms.ts:96-100` |
| Service | Lấy "dự án đầu tiên của chain": `const [project] = await listProjects({ chain })` | `config.service.ts:456`, `trade.service.ts:162`, `seller.service.ts:126`, `ops-transactions.service.ts:106`, `recall.service.ts:59` |
| Hằng, kiểu | `WPT_TOKEN_SYMBOL = 'WPT'`; kiểu `'WPT' \| 'VNDB'`; chain mock khai `symbol: 'WPT'` | `issue-terms.ts:257`, `settlement-steps.ts:120,154-156`, `purchase.service.ts:480,548,1015`, `mock.adapter.ts:61` |
| Giao diện | Chữ "WPT" ghi cứng ở 22 tệp; từ UIUX-02 (đầu màn: ô chọn token, bỏ dòng mô tả, gợi ý trên menu) 10 màn nghiệp vụ thao tác trên token dự án có ô chọn token, hiện chỉ chọn được token đang chạy | `app/src/components/**` |

## 3. Danh mục nợ

Khi nhắc tới các mã dưới đây ở tài liệu khác, luôn ghi kèm nội dung ngắn trong ngoặc, ví dụ "MT-02 (ledger nhận dự án)".

| Mã | Nội dung | Việc cần làm | Phụ thuộc | Mức |
|---|---|---|---|---|
| MT-01 | Sổ địa chỉ theo dự án | Sổ địa chỉ theo (chain, mã token); kịch bản triển khai một bộ hợp đồng cho một dự án từ mẫu (gồm một bản `ModularCompliance` riêng cho token đó), dùng chung `IdentityRegistry` | | Lớn |
| MT-02 | Ledger nhận dự án | `getLedger(chain, tokenSymbol)` hoặc tham số dự án ở mọi hàm; mock adapter giữ trạng thái theo token | MT-01 | Lớn |
| MT-03 | Bảng dữ liệu biết token | Phân biệt hai nhóm. (a) Nghiệp vụ của một dự án (lệnh mua, kỳ chia, thu hồi, giao dịch Mint, Burn): BẮT BUỘC định danh dự án; thêm cột dự án cho `PurchaseOrder`, `DistributionPeriod` và các dòng `Txn` của token dự án; migration gán dữ liệu cũ về WPT của An Viên (`SettlementRound` đã có `projectId`). (b) Thanh toán VNDB dùng chung (rút VNDB, chuyển VNDB, các dòng `Txn` của VNDB): định danh theo chain và tài sản thanh toán; dự án chỉ là thông tin TUỲ CHỌN khi có căn cứ; KHÔNG gán bắt buộc dữ liệu cũ về một dự án (tránh sai lệch kế toán) | | Trung bình |
| MT-04 | Cấu hình theo dự án | Giá phát hành, lợi tức, phí, vòng đời, ngưỡng đổi giá, cấu hình vault theo từng token | | Trung bình |
| MT-05 | Bỏ chọn dự án ngầm | Mọi action nhận mã token; bỏ "dự án đầu tiên của chain"; ô chọn token ở giao diện (đã có từ UIUX-02) gửi mã token lên action | MT-02 | Trung bình |
| MT-06 | Chỉ mục và chia lợi nhuận theo token | Chỉ mục sự kiện, danh sách người nắm giữ, kỳ chia lợi nhuận, thu hồi theo từng token | MT-02, MT-03 | Trung bình |
| MT-07 | Thực thể loại token | Danh mục loại token (WPT, TCC...) với mẫu hợp đồng, quy ước ký hiệu, điều khoản riêng; mở lựa chọn TCC trên ô chọn token khi có hợp đồng | MT-01 tới MT-06 | Lớn |

Rủi ro chung: **cao** (đụng lược đồ, ledger, toàn bộ service). Không trộn với các đợt giao diện.

## 4. Lộ trình đề xuất

| Giai đoạn | Gồm | Kết quả |
|---|---|---|
| 1 | MT-03 (bảng dữ liệu biết token), MT-04 (cấu hình theo dự án) | Dữ liệu và cấu hình sẵn sàng cho nhiều token; hành vi vẫn một token |
| 2 | MT-01 (sổ địa chỉ theo dự án), MT-02 (ledger nhận dự án) | Chạy được hai dự án WPT trên hardhat cục bộ |
| 3 | MT-05 (bỏ chọn dự án ngầm), MT-06 (chỉ mục và chia lợi nhuận theo token) | Giao diện chọn dự án thật; chia lợi nhuận, thu hồi theo dự án |
| 4 | MT-07 (thực thể loại token) | Mở loại TCC |

## 5. Quy tắc giao diện tạm thời (từ UIUX-02)

- Ô chọn token có gõ lọc ở đầu 10 màn nghiệp vụ thao tác trên token dự án (danh sách ở spec UIUX-02 mục 3); dòng TCC kèm thẻ "(chưa hỗ trợ)" chữ mờ, không chọn được.
- Không thêm lời gọi dữ liệu, không gửi mã token lên action cho tới MT-05 (bỏ chọn dự án ngầm).
