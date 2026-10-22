# Hướng dẫn nghiệp vụ (UserGuide): BIDV RWA Tokenize

| | |
|---|---|
| Dự án | Token hoá Nhà máy điện gió An Viên, bản thử nghiệm (PoC) |
| Chốt tại | nhánh `fix/hf-05-giao-dich-chua-xac-nhan` @ `8359009` (HF-05, từ `dev` @ `4d17bc9`), ngày 22/10/2026 |
| Nơi đặt trong repo | `docs/USER_GUIDE.md`, cùng thư mục với runbook `docs/TESTNET_SEPOLIA.md` |
| Người cập nhật | Người viết mã cập nhật trong commit tài liệu cuối của mỗi task, như `docs/tech-report.md` (xem mục 0) |
| Nguồn | Đọc mã nguồn tại commit trên, tài liệu bàn giao, DS-01 bản 5, các spec đã chốt. Mọi khẳng định về màn hình có đường dẫn tệp để kiểm lại |

Tài liệu này trả lời ba câu hỏi: nghiệp vụ nào đã chốt ra sao (Phần 1); màn nào đã dùng được, cho vai nào, trên chain nào (Phần 2); trên từng màn, mỗi con số lấy từ đâu và dùng để làm gì (Phần 3). Mục "Lệch" ở Phần 3 ghi những chỗ giao diện chưa khớp logic nghiệp vụ, để đưa vào task sửa.

## Mục lục

- [0. Quy tắc cập nhật tài liệu](#0-quy-tắc-cập-nhật-tài-liệu)
- [Phần 1. Nghiệp vụ và quyết định đã chốt](#phần-1-nghiệp-vụ-và-quyết-định-đã-chốt)
- [Phần 2. Bảng tổng hợp màn hình](#phần-2-bảng-tổng-hợp-màn-hình)
- [Phần 3. Chi tiết từng màn hình](#phần-3-chi-tiết-từng-màn-hình)
- [Phụ lục A. Trạng thái và nhãn](#phụ-lục-a-trạng-thái-và-nhãn)
- [Phụ lục B. Tham số cấu hình (SystemConfig)](#phụ-lục-b-tham-số-cấu-hình-systemconfig)
- [Phụ lục C. Danh sách lệch cần đưa vào task](#phụ-lục-c-danh-sách-lệch-cần-đưa-vào-task)

---

## 0. Quy tắc cập nhật tài liệu

Áp dụng cho mọi task có đổi màn hình, quyền, luồng nghiệp vụ hoặc nguồn dữ liệu của một trường hiển thị:

1. **Phần 1:** thêm hoặc sửa dòng quyết định khi chủ dự án chốt (ghi mã QĐ, ngày, task thực hiện). Không xoá quyết định cũ đã bị thay; ghi "Thay bởi ..." để giữ vết.
2. **Phần 2:** sửa dòng của màn bị đổi: trạng thái, số action khi mở, task còn chờ. Màn mới thì thêm dòng.
3. **Phần 3:** sửa bảng trường của màn bị đổi, kể cả nguồn dữ liệu (hàm service, bảng, cột, hàm hợp đồng). Lệch đã sửa thì xoá khỏi mục "Lệch" và khỏi Phụ lục C, ghi task đã sửa vào lịch sử cuối tài liệu.
4. Dòng "Chốt tại" ở đầu tệp ghi commit mới.
5. Không dùng các ký tự: dấu chấm giữa dòng, gạch ngang dài, mũi tên, dấu nhân. Viết "nhân", "sang", hoặc dấu ">" cho đường dẫn điều hướng.
6. Checkpoint của task ghi một dòng "UserGuide: đã cập nhật mục ..." hoặc "UserGuide: không ảnh hưởng (lý do)".

---

## Phần 1. Nghiệp vụ và quyết định đã chốt

Ký hiệu trạng thái: **Đã chạy** (có trên `dev`, đã kiểm trên chuỗi thật nếu là nghiệp vụ chuỗi), **Một phần**, **Chưa làm**, **Hoãn**.

### 1.1. Vai, kênh và nguyên tắc kiểm soát

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Bốn vai | Nhà đầu tư (INVESTOR), Người bán (SELLER, pháp nhân SPV ngoài ngân hàng), Giao dịch viên (TELLER), Kiểm soát viên (CONTROLLER). Mỗi vai một kênh, menu suy từ vai | FE-20 | Đã chạy |
| Chọn vai bản thử | Vai và kênh lấy từ cookie, chọn ở bộ chọn "Vai trò" trên đầu trang. Chưa có đăng nhập thật | Nợ AU-01 (P1) | Một phần |
| Lập duyệt (maker-checker) | Giao dịch viên lập yêu cầu Mint/Burn, Kiểm soát viên duyệt hoặc từ chối. Người lập không được tự duyệt hay tự từ chối | BE-12, FE-22 | Đã chạy |
| Không ai Mint/Burn thẳng | Quyền `token:mint`, `token:burn` không thuộc vai nào; lập duyệt là đường duy nhất | FE-22 | Đã chạy |
| Người bán chỉ đọc, trừ rút tiền | Người bán không có quyền vận hành; quyền ghi duy nhất là `vault:withdraw` | FE-21, BE-13 | Đã chạy |
| Kiểm soát viên không đặt giá | Giá phát hành do Giao dịch viên đặt. Ngoại lệ: Kiểm soát viên cấu hình khoá vault và duyệt chia lợi nhuận | Chốt 07/10, 20/10 | Đã chạy |
| Hai vai vận hành không kết nối ví | Giao dịch của ngân hàng ký bằng ví máy chủ; chỉ Nhà đầu tư và Người bán có `wallet:connect` | FE-02 | Đã chạy |
| Sổ kiểm toán | Mọi thao tác ghi, và cả nhiều thao tác đọc, ghi một dòng `AuditLog` | Kiến trúc | Đã chạy (xem lệch L-01) |
| Lịch sử cấu hình | Mọi tham số Kiểm soát viên cấu hình phải có lịch sử từng lần đổi. `SystemConfig` tự ghi `SystemConfigHistory`; cấu hình vault dựng lịch sử từ sự kiện trên chuỗi | Chốt 20/10, BE-13 bản 2.1 | Đã chạy |
| Hiệu năng là điều kiện nghiệm thu | Mỗi màn gọi tối đa một server action khi mở; liên kết tắt tải trước; đọc chuỗi gom lô; quét sự kiện có mốc block | Chốt 21/10, HF-01 | Đã chạy (còn `/vault`, PERF-01) |

### 1.2. Chuỗi (chain) và môi trường

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Bốn chain trong bộ chọn | `mock` (mô phỏng, mặc định), `hardhat-local` (nút cục bộ), `evm` (Sepolia), `stellar` (không chọn được) | OP-02, OP-03 | Đã chạy |
| Một chain thật duy nhất có vault | Chỉ chạy phương án vault trên `evm`. Điểm khôi phục phương án ví SPV thường: tag `poc-spv-vi-thuong-20261019` | Chốt 19/10 | Đã chạy |
| Bộ hợp đồng Sepolia hiện hành | 9 hợp đồng, triển khai 21/10/2026, block 11959727 (ProjectToken `0x257E…05D7`, vault `0x0da9…6861`, OrderSettlement `0x6D98…fD27`) | OP-05 PR B (#64) | Đã chạy |
| Database và Hyperdrive | Neon vùng Singapore (`ap-southeast-1`), database `rwa-bid-vault`; Hyperdrive tắt cache | OP-05, chốt 21/10 | Đã chạy |
| RPC | Ghi và đọc trạng thái qua `RPC_EVM` (Alchemy). Đọc sự kiện qua `RPC_EVM_LOGS`, mặc định RPC công khai publicnode, quét theo đoạn 10.000 block | HF-03, HF-04 | Đã chạy |
| Chain mock dùng chung database | Trạng thái chain mock lưu Postgres một dòng mỗi chain, hai trình duyệt thấy như nhau | OP-07 | Đã chạy |
| Stellar | Tạm dừng ở khâu kiểm chứng | OP-01 | Hoãn |

### 1.3. Định danh, danh sách được phép và ví

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| KYC mô phỏng | KYC tự duyệt (`USE_MOCK_KYC`), hồ sơ khách hàng là dữ liệu mẫu trong mã | PoC | Một phần |
| Danh sách được phép trên chuỗi | WPT theo ERC-3643 phương án C: `IdentityRegistry` rút gọn trả lời "ví đã xác minh", `ModularCompliance` với module mặc định cho phép tất cả, không ONCHAINID | QĐ-9, SC-09 | Đã chạy |
| Đăng ký ví | Làm ở màn `/mint` (nút "KYC + Whitelist"), ví được ghi vào `IdentityRegistry` | BE-02 | Đã chạy |
| Liên kết ví vào hồ sơ | Người dùng tự nhập ví của mình ở `/account`, app so ví đang kết nối khi đặt lệnh. Trên Sepolia bắt buộc liên kết; ví mẫu Hardhat bị từ chối. Chưa ký chứng minh sở hữu (nợ) | QĐ-I OP-05, CH-2 | Đã chạy |
| Ủy quyền bằng chữ ký | VNDB và WPT có `permit` (EIP-2612); nhà đầu tư ký, ví máy chủ gửi và trả phí | QĐ-10, FE-05 | Đã chạy |

### 1.4. Phát hành và huỷ token (Mint, Burn)

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Trần nguồn cung | 20.000.000 WPT, cố định trên hợp đồng (`cap`), WPT không có phần thập phân | SC-10 CH-1 | Đã chạy |
| Mint luôn vào ví thanh toán SPV | Lần đầu `mintInitialSupply` ghi ví SPV vĩnh viễn; các lần sau chỉ Mint vào đúng ví đó | SC-02 | Đã chạy |
| Ví thanh toán SPV là vault (R6) | Chain có `SpvPaymentVault` thì mọi lần Mint phải đích là địa chỉ vault | SC-07 R6 | Đã chạy |
| Burn | Chỉ đốt phần WPT chưa phân phối trong ví SPV (vault); chọn "Toàn bộ nguồn cung" khi không còn WPT lưu hành | SC-02, BE-12 | Đã chạy |
| Một yêu cầu Mint đang chờ mỗi lúc | Đang có yêu cầu Mint PENDING hoặc EXECUTING thì không lập yêu cầu Mint mới | BE-12 | Đã chạy (xem lệch L-12) |
| Giá phát hành | Mặc định 100.000 VNDB mỗi WPT, mỗi chain một giá (`wpt.issue_price_vnd.<chain>`), Giao dịch viên đặt; giá trên hợp đồng `OrderSettlement.price` là giá chốt lệnh | BE-04, FE-27 | Một phần (màn cấu hình giá ở FE-07) |
| Phát hành thẳng dữ liệu thử | Chỉ trên `mock`, sau hai lớp chặn (cờ `ENABLE_DEMO_TOKEN_MINT` mặc định tắt, rồi quyền) | FE-22 | Đã chạy |

### 1.5. Tiền VNDB và nạp trình diễn

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| VNDB | 1 VNDB bằng 1 VND, token thanh toán trên chuỗi | PoC | Đã chạy |
| Nạp trình diễn | Giao dịch viên nạp VNDB cho ví đã đăng ký hoặc ví Người bán, sau hai lớp chặn (cờ `ENABLE_DEMO_PAYMENT_MINT` bật cho bản thử, rồi quyền `demo:mint-payment`); trần một lần mặc định 1.000.000.000 | BE-16, CH-6 OP-05 | Đã chạy |
| Trước triển khai thật | Tắt cờ nạp và gỡ màn nạp | Nợ P1 | Chưa làm |

### 1.6. Mua bán token

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Tự khớp | Lệnh hợp lệ tự quyết toán, không chờ người bấm | BE-17 | Đã chạy |
| Quyết toán nguyên tử trên chuỗi | `OrderSettlement` chuyển VNDB và WPT trong một giao dịch, tiền vào thẳng vault; kiểm `vndb = wpt nhân giá hiện tại` | SC-03, QĐ-15 | Đã chạy |
| Chống trùng hai tầng | Ngoài chuỗi: `clientRequestId` duy nhất theo ví. Trên chuỗi: `orderRef` (mã lệnh) đã dùng thì hợp đồng từ chối | BE-17, SC-03 QĐ-17 | Đã chạy |
| Ký permit khi đặt lệnh | Trên chain EVM, nhà đầu tư ký cho phép chi đúng số tiền hoặc số token của lệnh, hạn 30 phút; máy chủ kiểm chữ ký, nonce, hạn | FE-05 | Đã chạy |
| Điều kiện trước lệnh | Năm điều kiện: Tài khoản, Định danh, Ví, Token được phép giao dịch, Rủi ro | BE-14, FE-05 | Đã chạy |
| Lệnh kẹt | Giao dịch viên can thiệp: CHECKING được gửi tiếp; EXECUTING có mã giao dịch chỉ đối soát; EXECUTING chưa có mã thì tra chuỗi, không gửi lại mù | BE-17, SC-03 R5 | Một phần (xem lệch L-14) |
| Quét lệnh kẹt tự động | Chưa có tiến trình tự quét; lệnh kẹt ở PLACED chỉ được dọn khi hết hạn | Nợ P2 | Chưa làm |
| Phí giao dịch | Hiển thị theo cấu hình, không trừ ở đâu (mặc định 0) | PoC | Một phần |

### 1.7. Vault thanh toán SPV và Người bán rút tiền

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Vault là hợp đồng | Tiền bán WPT vào `SpvPaymentVault`; luật khoá ép trên chuỗi | PA-02, SC-07 | Đã chạy |
| Hai chế độ khoá | FIXED: khoá một số VNDB cố định. PERCENT: trước kỳ chia đầu khoá tỷ lệ nhân thu ròng; từ kỳ đầu khoá tỷ lệ nhân số đã chia kỳ trước. Hợp đồng khởi tạo UNSET (khoá toàn bộ) | DS-01 QĐ-13 bản 5, QĐ-25 | Đã chạy |
| Ưu tiên và mặc định | Kiểm soát viên nhập số cố định thì chuyển FIXED (ưu tiên); để trống thì PERCENT, mặc định 20%, cấu hình được | CH-1 OP-05, chốt 20/10 | Đã chạy |
| Tỷ lệ mới | Trước kỳ đầu áp ngay; sau đó ghi "chờ áp", áp ở lần chốt kỳ kế tiếp. FIXED áp ngay | Chốt 19/10 | Đã chạy |
| Ví nhận tiền rút | Do Kiểm soát viên đặt, phải đã đăng ký trên chuỗi, khác địa chỉ vault; tiền rút luôn về ví này | CH-3 SC-07, BE-13 | Đã chạy |
| Rút tiền | Người bán tạo lệnh, xác nhận mã một lần sáu số, hoàn tất ngay, không qua duyệt, không thu phí; mỗi chain một lệnh rút đang dở | URD III.5, BE-13 | Đã chạy |
| Mã một lần | Bản thử chỉ kiểm định dạng sáu chữ số, chưa gửi mã thật | Nợ AU-01 | Một phần |
| Mất mã giao dịch khi rút | Không tự gửi lại; lệnh chuyển "Cần Kiểm soát viên xem" (NEEDS_REVIEW), Kiểm soát viên xác nhận bằng mã giao dịch hoặc đánh dấu thất bại. Không sửa vault trong PoC | Chốt 20/10 | Đã chạy (nợ sửa hợp đồng) |
| Hạn mức và phí của FE-21 | Đã gỡ | BE-13 QĐ-H | Đã chạy |

### 1.8. Chia lợi nhuận

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Quỹ chia là hợp đồng | `ProfitDistributor` chỉ nhận vào, không có đường rút; phần dư kỳ trả về quỹ khi đóng kỳ | PA-04, SC-06 | Đã chạy |
| Mẫu số | Chia theo tổng cung tại ảnh chụp; phần của WPT chưa bán (nằm trong vault) trả vào vault | QĐ-12 (thay QĐ-8), SC-06 | Đã chạy |
| Kiểm soát viên duyệt tổng số | Duyệt đúng số VNDB chưa phân bổ; bấm duyệt thì hệ thống mở kỳ, chốt kỳ vault rồi chia ngay. Danh sách và tỷ lệ chỉ là dự kiến | CH-5 OP-05, FE-08 | Đã chạy |
| Số trên chuỗi khác số duyệt | Dừng ở AMOUNT_CHANGED, không chốt vault, không trả; Kiểm soát viên duyệt lại số thực tế | FE-08 CH-2 | Đã chạy |
| Chỉ trả khi vault đã chốt kỳ | Chốt kỳ vault (`closePeriod`) xong (DONE) mới gửi lô | FE-08 QĐ-D | Đã chạy |
| Một kỳ hoạt động mỗi chain | Cột `activeChain` duy nhất | FE-08 QĐ-B | Đã chạy |
| Trả theo lô | Ngân hàng trả theo lô (`distributeTo`); hợp đồng giữ sẵn `claim` cho nhà đầu tư tự nhận sau này | QĐ-14 | Đã chạy |
| Tiến trình tự động | API keeper giữ để tự động hoá; keeper không tự mở kỳ, chỉ tiếp tục kỳ đã duyệt; OP-05 không dùng lịch | FE-08 QĐ-E, nợ QĐ-H | Một phần |
| Tiền lợi nhuận vào quỹ | Bản thử Mint VNDB thẳng vào quỹ (bước tay); tự phát hiện tiền vào bằng sự kiện ở IN-02 | OP-05 lượt 13.6 | Một phần |
| Nhà đầu tư xem kỳ chia và lợi tức | Chưa có màn | FE-09 | Chưa làm |

### 1.9. Nhà đầu tư rút VNDB, tất toán

| Quyết định | Nội dung | Nguồn | Trạng thái |
|---|---|---|---|
| Nhà đầu tư rút VNDB | Hoàn tất ngay, không mã một lần, không qua Giao dịch viên hay Kiểm soát viên | URD, CH-3 BE-13 | Chưa làm (FE-23) |
| Tất toán (mua lại WPT theo NAV) | Khác Burn: thu hồi WPT của nhà đầu tư, trả VNDB theo NAV, trong chế độ tất toán ngừng mua bán. Chưa chốt cờ tất toán và giá NAV | SC-04, BE-05, FE-10 | Chưa làm |
| Công tắc tạm dừng trên EVM | Tạm thời dùng `pause` của `OrderSettlement` | SC-03 | Đã chạy |

### 1.10. Kết quả kiểm chứng trên Sepolia (OP-05, 21/10/2026)

Vòng nghiệp vụ chạy đủ trên Sepolia: Mint đầu vào vault, liên kết ví, nạp VNDB, mua 100 rồi bán 40 WPT bằng chữ ký permit, nạp lợi nhuận 1.000.000 VNDB, Kiểm soát viên duyệt và chia (Nhà đầu tư 6 VNDB, vault 999.994 VNDB vì tổng cung 10.000.000 WPT), Người bán rút 3.399.997 VNDB. Số dư cuối khớp bảng kỳ vọng tính lại (chi tiết `docs/CHECKPOINT_OP05.md` mục 6).

---

## Phần 2. Bảng tổng hợp màn hình

### 2.1. Ma trận vai và menu

| Route | Nhà đầu tư | Người bán | Giao dịch viên | Kiểm soát viên |
|---|---|---|---|---|
| `/portfolio` | Tổng quan (E) | | | |
| `/trade` | Giao dịch token (G) | | | |
| `/orders` | Quản lý lệnh (Q) | | | |
| `/withdraw` | Rút VNDB (R) | | | |
| `/seller` | | Tổng quan (E) | | |
| `/seller/transactions` | | Danh sách giao dịch (D) | | |
| `/seller/withdraw` | | Tạo lệnh rút (R) | | |
| `/wallet` | Kết nối ví (V) | Kết nối ví (V) | | |
| `/account` | Thông tin tài khoản (T) | Thông tin tài khoản (T) | Thông tin tài khoản (T) | Thông tin tài khoản (T) |
| `/` | | | Bảng điều khiển (E) | Bảng điều khiển (E) |
| `/draft` | | | Lập lệnh (L) | |
| `/transactions` | | | Giao dịch (G) | Giao dịch (G) |
| `/distribution` | | | Chia lợi nhuận (chỉ xem) (C) | Chia lợi nhuận (C) |
| `/vault` | | | Vault thanh toán SPV (K) | Vault thanh toán SPV (K) |
| `/approvals` | | | | Phê duyệt lệnh (P) |
| `/demo-payment` | | | Nạp VNDB (trình diễn) (N), khi cờ bật | |
| Không trong menu | `/orders/[id]`, `/tokens/[symbol]` | | `/mint`, `/kyc`, `/assets`, `/audit`, `/reconciliation`, `/transactions/[id]` | `/approvals/[id]`, `/transactions/[id]`, `/mint`, `/kyc`, `/assets`, `/audit`, `/reconciliation` |

Chữ trong ngoặc là phím tắt hiển thị cạnh menu. Hiện chỉ là nhãn, bấm phím chưa chuyển màn (`components/layout/sidebar.tsx:204`).

### 2.2. Trạng thái từng màn

Cột "Chain": **M** = mock, **H** = hardhat-local, **S** = Sepolia (`evm`). Stellar không chọn được nên không ghi. "Action khi mở" là số server action gọi khi mở màn (mục tiêu tối đa 1). "Ghi chuỗi" là màn có thao tác gửi giao dịch lên chuỗi.

| Route | Tên | Vai | Nghiệp vụ | Chain | Trạng thái | Action khi mở | Ghi chuỗi | Còn chờ |
|---|---|---|---|---|---|---|---|---|
| `/portfolio` | Tổng quan nhà đầu tư | Nhà đầu tư | Danh mục | M H S | Một phần: thiếu số dư VNDB, dự án và số nhà đầu tư là dữ liệu mẫu; trên mock vẫn đòi ví trình duyệt | 3 (1 khi chưa có ví) | Không | FE-04 |
| `/trade` | Giao dịch token | Nhà đầu tư | Mua bán token | M H S | Dùng được; ô chọn token chưa có tác dụng | 1 | Có (mua, bán) | SC-04 (cờ tất toán EVM) |
| `/orders` | Quản lý lệnh | Nhà đầu tư | Mua bán token | M H S | Dùng được; tối đa 200 lệnh, không phân trang | 1 | Không | |
| `/orders/[id]` | Chi tiết lệnh | Nhà đầu tư | Mua bán token | M H S | Dùng được; nhật ký chỉ quét 500 dòng gần nhất | 1 | Không | |
| `/tokens/[symbol]` | Chi tiết token dự án | Nhà đầu tư | Danh mục | M H S | Một phần: chỉ WPT có số thật, hai dự án khác là mẫu | 0 hoặc 1 | Không | |
| `/withdraw` | Rút VNDB | Nhà đầu tư | Rút VNDB | | Chỗ trống | 0 | | FE-23 |
| `/seller` | Tổng quan Người bán | Người bán | Tổng quan, vault | M H S | Một phần: hai ô "bán" gắn cứng dấu gạch | 1 | Không | |
| `/seller/transactions` | Danh sách giao dịch | Người bán | Sổ giao dịch | M H S | Dùng được; lọc trong bộ nhớ trên 500 dòng gần nhất | 1 | Không | |
| `/seller/withdraw` | Tạo lệnh rút | Người bán | Rút tiền SPV | M H S | Dùng được (cần Kiểm soát viên cấu hình vault trước) | 2 | Có (rút) | AU-01 (mã một lần thật) |
| `/wallet` | Kết nối ví | Nhà đầu tư, Người bán | Ví | H S (mock không cần ví) | Dùng được | 0 | Không | |
| `/account` | Thông tin tài khoản | Cả bốn vai | Hồ sơ, liên kết ví | M H S | Một phần: hồ sơ là dữ liệu mẫu; liên kết ví dùng được | 0 (nhân viên), 1 (khách hàng) | Không | AU-01 |
| `/` | Bảng điều khiển | Giao dịch viên, Kiểm soát viên | Tổng quan dự án | | Chỗ trống: toàn bộ số mẫu | 0 | Không | |
| `/draft` | Lập lệnh | Giao dịch viên | Mint, Burn (lập) | M H S | Dùng được | 2 | Không (chỉ lập) | |
| `/approvals` | Phê duyệt lệnh | Kiểm soát viên | Mint, Burn (duyệt) | M H S | Dùng được | 1 + 1 mỗi hàng chờ | Không | |
| `/approvals/[id]` | Chi tiết yêu cầu | Kiểm soát viên | Mint, Burn (duyệt, đối soát) | M H S | Dùng được; giao dịch chưa có biên nhận giữ Đang thực hiện, có nút Đối soát (HF-05) | 1 | Có (mint, burn) | |
| `/transactions` | Giao dịch | Giao dịch viên, Kiểm soát viên | Lệnh mua bán, can thiệp lệnh kẹt | M H S | Một phần: thiếu nút cho lệnh EXECUTING mất mã | 1 | Có (can thiệp) | |
| `/transactions/[id]` | Chi tiết lệnh | Giao dịch viên, Kiểm soát viên | Lệnh mua bán | M H S | Dùng được (chỉ xem) | 1 | Không | |
| `/vault` | Vault thanh toán SPV | Giao dịch viên (xem), Kiểm soát viên | Cấu hình khoá, đối soát rút | M H S | Dùng được; mở màn 3 action nối tiếp | 3 | Có (cấu hình) | PERF-01 |
| `/distribution` | Chia lợi nhuận | Giao dịch viên (xem), Kiểm soát viên | Chia lợi nhuận | M H S | Dùng được | 1 | Có (mở kỳ, chốt vault, chia) | FE-09, IN-02 |
| `/demo-payment` | Nạp VNDB (trình diễn) | Giao dịch viên | Nạp trình diễn | M H S | Dùng được (chỉ bản thử) | 1 | Có (mint VNDB) | |
| `/mint` | Phát hành WPT (dữ liệu thử) | Giao dịch viên, Kiểm soát viên | KYC, danh sách được phép; phát hành thử | M H S (phát hành thử chỉ M) | Một phần: KYC dùng được, phát hành thử tắt mặc định | 1 hoặc 2 | Có (đăng ký ví) | |
| `/kyc` | Nhà đầu tư và KYC | Giao dịch viên, Kiểm soát viên | KYC | | Chỗ trống | 0 | | |
| `/assets` | Dự án điện gió | Giao dịch viên, Kiểm soát viên | Danh mục dự án | | Chỗ trống (số mẫu) | 0 | | |
| `/audit` | Sổ kiểm toán | Giao dịch viên, Kiểm soát viên | Kiểm toán | M H S | Dùng được: 100 dòng gần nhất, không lọc | 0 (đọc trong Server Component) | | |
| `/reconciliation` | Đối soát doanh thu điện | Giao dịch viên, Kiểm soát viên | Đối soát | | Chỗ trống | 0 | | |

### 2.3. Tóm tắt theo nghiệp vụ

| Nghiệp vụ | Màn chính | Đi trọn trên Sepolia | Còn thiếu |
|---|---|---|---|
| Phát hành, huỷ token | `/draft`, `/approvals` | Có | Màn cấu hình giá (FE-07) |
| Đăng ký ví, liên kết ví | `/mint`, `/account` | Có | Màn KYC thật (`/kyc`), ký chứng minh sở hữu ví |
| Nạp VNDB trình diễn | `/demo-payment` | Có | |
| Mua bán token | `/trade`, `/orders`, `/transactions` | Có | Nút cho lệnh EXECUTING mất mã; quét lệnh kẹt tự động |
| Cấu hình vault, Người bán rút | `/vault`, `/seller/withdraw` | Có | Mã một lần thật |
| Chia lợi nhuận | `/distribution` | Có | Màn của Nhà đầu tư (FE-09); tự phát hiện tiền vào (IN-02) |
| Nhà đầu tư rút VNDB | `/withdraw` | Chưa | FE-23 |
| Tất toán | chưa có | Chưa | SC-04, BE-05, FE-10 |
| Tổng quan, báo cáo | `/`, `/portfolio`, `/assets`, `/reconciliation` | Một phần | Số liệu thật thay dữ liệu mẫu |

---

## Phần 3. Chi tiết từng màn hình

Quy ước chung cho Phần 3:

- **Nguồn dữ liệu** ghi theo chuỗi: server action > hàm service > bảng và cột database, hoặc hàm adapter > hàm đọc của hợp đồng. "SystemConfig `khoá`" là tham số cấu hình trong database. "Tính" là giá trị máy chủ hoặc trình duyệt tính ra.
- Đường dẫn tệp tính từ `app/src/` trừ khi ghi khác.
- **Sổ kiểm toán:** hàm nào dùng `authorize()` (`lib/bank/authorize.ts`) đều ghi một dòng `AuditLog` mỗi lần gọi, kể cả khi chỉ đọc. Hàm dùng `assertCan()` không ghi.
- **Ví hồ sơ trên mock:** màn nhà đầu tư trên `mock` dùng ví đã liên kết, chưa có thì ví mẫu (NDT001), không cần ví trình duyệt. Trên Sepolia phải liên kết ví ở `/account`.
- Số dư "trên chuỗi" của `mock` là sổ cái mô phỏng (bảng `MockLedgerState`), của `hardhat-local` và Sepolia là hàm đọc hợp đồng.
- Viết tắt ở mục 3.4: `S` = `lib/bank/token-request.service.ts`, `I` = `lib/bank/issuance.service.ts`.
- **Người thao tác:** lấy từ `DEMO_ACTOR`, trống thì theo vai: GDV001 (Giao dịch viên), KSV001 (Kiểm soát viên), NB001 (Người bán), NDT001 (Nhà đầu tư) (`lib/rbac/session.ts:50`).
- **Vault mock mới dựng** ở trạng thái `UNSET` (khoá toàn bộ, chưa có ví nhận). Người bán chỉ rút được sau khi Kiểm soát viên cấu hình ở `/vault`.
- Mỗi màn có khối **Lệch**: chỗ mã hoặc giao diện khác ý nghiệp vụ. Mã `L-xx` tra ở Phụ lục C. Nội dung Phần 3 dựng từ đọc mã nguồn tại `24f3b7c`, đối chiếu với kết quả chạy Sepolia của OP-05.

### 3.1. Nhà đầu tư

#### 3.1.1. `/portfolio` Tổng quan

- **Vai:** INVESTOR. Menu "Tổng quan", phím tắt E. Đây là màn mặc định của kênh nhà đầu tư.
- **Chain:**
  - Trên mọi chain đều cần ví trình duyệt (wagmi `useAccount`), kể cả mock: màn này không dùng ví hồ sơ (`components/investor/asset-summary.tsx:34`, `components/investor/transaction-history-box.tsx:109`).
  - Không có thao tác nào cần ký.
  - Hộp "Trạng thái phát hành" đọc được khi chưa kết nối ví.
- **Trạng thái:** Dùng được một phần. Số dư VNDB không hiển thị. Thông tin dự án, danh sách dự án và số nhà đầu tư nắm giữ là dữ liệu mẫu (`MOCK_PROJECTS`, `MOCK_WIND_STATS` trong `lib/mock-data.ts`). Không có marker @pending/@blocked.
- **Nghiệp vụ:** Danh mục (vị thế đầu tư).
- **Action khi mở:**
  - 3 action khi đã kết nối ví: `getPortfolioAction`, `getWalletTransactionsAction`, `getTokenSummaryAction`.
  - 1 action khi chưa kết nối (chỉ `getTokenSummaryAction`).
  - Gọi lại khi đổi chain hoặc đổi ví.
  - Cả 3 đều qua `authorize('portfolio:read')`, nên mỗi lần mở ghi 3 dòng `AuditLog`.
  - Khi người dùng thao tác: 0 action (màn này chỉ có liên kết).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Tổng quan nhà đầu tư (tiêu đề) | Tên màn | Văn bản cố định | Chỉ hiển thị |
| **Hộp "Tài sản đã đầu tư"** (nhãn on-chain) | Vị thế của ví đang kết nối | `getPortfolioAction` > `portfolio.service.getPortfolio` | Hiện câu mời kết nối nếu chưa có ví |
| Chưa kết nối ví / liên kết "Ví của tôi" | Mời kết nối ví | Trạng thái wagmi | Liên kết sang /wallet |
| WPT đang giữ | Số WPT ví đang giữ | On-chain `ledger.balanceOf(wallet)` | Chỉ hiển thị; dùng để tính giá trị quy đổi |
| Giá trị theo giá phát hành | Số dư nhân giá phát hành | Tính toán: `wptToVnd(balance, issuePrice)`. Giá lấy từ SystemConfig khoá `wpt.issue_price_vnd.<chain>`, thiếu thì dùng mặc định trong mã (`readIssuePriceVnd`) | Chỉ hiển thị |
| Quy đổi theo giá phát hành ... ₫/WPT | Giá phát hành đang dùng để quy đổi | SystemConfig như dòng trên | Chỉ hiển thị |
| đã KYC / chưa KYC | Ví có trong danh sách được phép không | On-chain `ledger.isWhitelisted` (trên evm là `IdentityRegistry.isVerified`) | Chỉ hiển thị |
| đang đóng băng | Ví bị đóng băng | On-chain `ledger.isFrozen` | Chỉ hiện khi đúng |
| Địa chỉ ví rút gọn | Ví đang xem | Địa chỉ wagmi | Chỉ hiển thị |
| Số dư VNDB chưa hiển thị được... | Câu báo thiếu số dư VNDB | Văn bản cố định | Chỉ hiển thị (xem phần Lệch) |
| **Hộp "Trạng thái phát hành"** | Thông số token trên chain đang chọn | `getTokenSummaryAction` > `getTokenSummary` | Không cần ví |
| Ký hiệu token (on-chain) | Ký hiệu token | On-chain `ledger.tokenInfo().symbol` | Chỉ hiển thị |
| Tổng cung đã phát hành (on-chain) | Tổng cung | On-chain `tokenInfo().totalSupply` | Chỉ hiển thị |
| Giá phát hành | Giá phát hành | SystemConfig `wpt.issue_price_vnd.<chain>` | Chỉ hiển thị |
| Dự án (dữ liệu mẫu) | Tên dự án | `MOCK_PROJECTS` (dự án có `onChain: true`) | Chỉ hiển thị |
| Trạng thái vận hành (dữ liệu mẫu) | Vận hành / bảo trì | `MOCK_PROJECTS.status` | Chỉ hiển thị |
| **Hộp "Giao dịch gần đây"** (on-chain) | 20 giao dịch gần nhất của ví | `getWalletTransactionsAction` > `getWalletTransactions` > `store.listTxns` (bảng `Txn`, lọc theo `toWallet` hoặc `fromWallet`, `limit` 20) | Chỉ hiển thị |
| Thời điểm | Lúc ghi giao dịch | `Txn.createdAt` | Chỉ hiển thị |
| Nghiệp vụ | Loại giao dịch | `Txn.operation` (mã thô như `purchase`, `sale`) | Chỉ hiển thị |
| Số lượng | Số WPT | `Txn.amount` | Chỉ hiển thị |
| Trạng thái | Trạng thái giao dịch | `Txn.status` (mã thô như `CONFIRMED`, `FAILED`) | Chỉ hiển thị |
| Tra cứu | Mã giao dịch, có liên kết Etherscan trên Sepolia | `Txn.txHash` + `explorerTxUrl` | Mở trình khám phá khối; mock và hardhat chỉ hiện chữ |
| Chưa có giao dịch nào | Trạng thái rỗng | Văn bản cố định | Chỉ hiển thị |
| **Hộp "Token dự án điện gió"** | Danh sách dự án | `MOCK_PROJECTS` (3 dự án, mã trong source) | Bấm một dòng để mở /tokens/[symbol] |
| Ký hiệu + nhãn on-chain / dữ liệu mẫu | Token đã lên chuỗi hay chưa | `MOCK_PROJECTS.onChain` | Chỉ hiển thị |
| Tên, vùng, trạng thái | Thông tin dự án | `MOCK_PROJECTS`, `REGION_LABELS`, `PROJECT_STATUS_LABELS` | Chỉ hiển thị |
| nhà đầu tư nắm giữ | Số nhà đầu tư | `MOCK_WIND_STATS.whitelistedInvestors` (128, mã trong source). Dự án chưa lên chuỗi hiện dấu gạch ngang | Chỉ hiển thị, có nhãn dữ liệu mẫu |


**Lệch** (tra mã ở Phụ lục C)

- **L-03.** Trên chain mock, màn này đòi ví trình duyệt, trong khi /trade, /orders và /tokens/[symbol] dùng ví hồ sơ và ghi "Không cần kết nối ví trình duyệt". `app/(investor)/portfolio/page.tsx:14` không truyền `mockWallet` xuống; `components/investor/asset-summary.tsx:86` và `components/investor/transaction-history-box.tsx:155` chặn khi chưa có ví wagmi. Hệ quả: cùng một người dùng mock thấy vị thế trên /tokens/WPT nhưng thấy "Chưa kết nối ví" ở /portfolio.
- **L-29.** Câu "tầng ledger chưa có phương thức đọc số dư token thanh toán (chờ BE-01)" ở `components/investor/asset-summary.tsx:147-148` đã cũ. `ledger.paymentBalanceOf` đã có và màn /trade đang dùng nó để hiện "Số dư VNDB" (`lib/bank/trade.service.ts:136`). Chú thích ở `lib/bank/portfolio.service.ts:91-95` xác nhận phần này chuyển sang FE-04.
- **L-02.** "Giá phát hành" và "Giá trị theo giá phát hành" lấy từ SystemConfig (`lib/bank/portfolio.service.ts:122` và `:216`). Giá dùng để chốt lệnh trên evm lại là `OrderSettlement.price` on-chain (`lib/ledger/evm.adapter.ts:837-841`). Bình thường hai số được đồng bộ qua `setIssuePrice`, nhưng chính hệ thống có cảnh báo "giá trên hợp đồng khác giá đã cấu hình" cho trường hợp lệch (`lib/bank/config.service.ts:97-104`), và cảnh báo đó không hiển thị trên màn nhà đầu tư.
- **L-30.** Huy hiệu ghi "đã KYC" nhưng thực chất đọc danh sách được phép on-chain, không đọc hồ sơ định danh (`components/investor/asset-summary.tsx:132-134`).
- **L-31.** Cột "Nghiệp vụ" và "Trạng thái" hiện mã tiếng Anh thô (`components/investor/transaction-history-box.tsx:197` và `:209`).
- **L-32.** Câu trạng thái rỗng "sau khi ngân hàng phát hành WPT về ví này" (`:175`) bỏ sót trường hợp ví có giao dịch mua hoặc bán.
- **L-33.** Liên kết ghi "Ví của tôi" trong khi menu gọi là "Kết nối ví" (`components/investor/asset-summary.tsx:93`).


#### 3.1.2. `/trade` Giao dịch token

- **Vai:** INVESTOR. Menu "Giao dịch token", phím tắt G. Các action còn kiểm quyền `order:place` ở service.
- **Chain:**
  - **mock:** dùng ví hồ sơ (`ownMockWallet`: ví đã liên kết, không có thì ví mẫu NDT001), không cần extension, không ký. Phép kiểm ủy quyền dùng số ủy quyền thực tế trong ledger mock, được cộng khi nạp VNDB mô phỏng (`lib/ledger/mock.adapter.ts:614-622`).
  - **hardhat-local và Sepolia:** cần ví trình duyệt đã kết nối, đúng mạng (`useWalletStatus().canSign`), và phải ký permit EIP-2612. Mua thì ký trên VNDB, bán thì ký trên WPT. Bên được chi là địa chỉ `OrderSettlement`; thiếu địa chỉ này thì báo lỗi (`lib/bank/permit.ts:118-129`).
  - **Sepolia:** ví phải liên kết trong hồ sơ, nếu không điều kiện "Định danh" trượt với câu "Ví không thuộc hồ sơ nhà đầu tư đang đăng nhập".
  - **Cờ tất toán trên evm:** `@blocked SC-04` (`lib/ledger/evm.adapter.ts:1164-1166`), nên trạng thái tất toán dựa vào bảng `Project`.
- **Trạng thái:** Dùng được. Riêng ô "Token" chưa có tác dụng, và cờ tất toán trên evm chờ SC-04.
- **Nghiệp vụ:** Mua bán token (mua WPT từ ví SPV của người bán, bán lại cho ví SPV).
- **Action khi mở:**
  - 1 action: `getTradeContextAction`.
- **Action khi thao tác:**
  - `previewTradeAction`: mỗi lần đổi chiều hoặc số lượng hợp lệ, trễ 400 ms.
  - `preparePermitAction`: khi mở hộp xác nhận, chỉ trên evm.
  - `placeOrderAction`: khi bấm gửi.
  - `listOrdersAction`: hỏi lại mỗi 3 giây tới khi lệnh có kết cục.
  - `getTradeContextAction`: gọi lại sau khi đặt lệnh và sau khi có kết cục.
  - Một lần đặt lệnh điển hình: 4 action trên mock; 5 action trở lên trên evm (thêm `preparePermitAction`), cộng các lần hỏi lại 3 giây.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Chế độ mô phỏng đang dùng ví trong hồ sơ... | Ví đang dùng trên mock | `ownMockWallet()` (server, bảng `ProfileWallet` hoặc ví mẫu) | Chỉ hiện trên mock |
| Chưa kết nối ví | Chặn màn khi thiếu ví | wagmi | Liên kết sang /wallet |
| **Đặt lệnh** | Khung nhập lệnh | | |
| Token (ô chọn) | Token của lệnh | `getTradeContext` > `projectStore.listProjects({chain})` (bảng `Project`: `tokenSymbol`, `name`) | Bị khoá khi chỉ có 1 token. Không gửi đi đâu, xem phần Lệch |
| Mua / Bán | Chiều lệnh | State giao diện | Gửi kèm `side` trong preview, preparePermit, placeOrder; quyết định trần áp dụng |
| Số lượng | Số WPT | Người dùng nhập. Kiểm ở giao diện: số nguyên > 0 và ≤ `caps[side].max` (`components/trading/gates.ts:52-64`). Kiểm ở server: `amountSchema`, chuỗi `^\d+$` và > 0 (`lib/bank/schemas.ts:52-57`) | Gửi làm `wptAmount` |
| Câu trần (Tối đa ... token: ...) | Giới hạn đang ràng buộc | Tính trong `quantityCaps` (`lib/bank/trade.service.ts:97-115`). Mua: min(số dư VNDB / giá, số chưa phân phối). Bán: số WPT đang giữ | Chặn ô số lượng |
| Giá (VNDB / token, chỉ để xem) | Đơn giá dùng để chốt lệnh | On-chain `ledger.quotePurchase(1n)` (evm: `OrderSettlement.price`; mock: giá trong state ledger) | Chỉ hiển thị; cũng là mẫu số khi tính trần mua |
| Tổng giá trị dự kiến | Số VNDB dự kiến | `previewTradeAction` > `previewPurchase` > `runOrderChecks` > `quotePurchase(amount)` | Chỉ hiển thị. Số chốt thật được tính lại trong `placeOrder` |
| **Kiểm tra trước lệnh** | Năm điều kiện | `previewTrade` (`lib/bank/trade.service.ts:280-348`) | Nút xác nhận chỉ mở khi cả năm điều kiện đạt |
| Tài khoản | Có quyền đặt lệnh | `can(role,'order:place')` | Điều kiện 1 |
| Định danh | Hồ sơ KYC đã duyệt, ví thuộc hồ sơ của phiên, ví có trong danh sách được phép | Hồ sơ mẫu viết cứng (`SAMPLE_ACCOUNT_PROFILES.identityStatus`), `findInvestorProfileByWallet` (bảng `ProfileWallet`), on-chain `isWhitelisted` | Điều kiện 2 |
| Ví | Ví không bị đóng băng | On-chain `isFrozen` | Điều kiện 3 |
| Token được phép giao dịch | Token đã phát hành, chưa tất toán | Bảng `Project.status`, on-chain `spvWallet()`, `isSettlementMode()` (evm: chờ SC-04) | Điều kiện 4 |
| Rủi ro | AML đạt, hạng rủi ro không cao, đạt các phép kiểm số dư | Hồ sơ mẫu (`amlStatus`, `riskRating`) và `runOrderChecks`. Mua: số dư VNDB, ủy quyền, tồn WPT của SPV, khả năng chuyển. Bán: số WPT đang giữ, ủy quyền WPT, VNDB của SPV, khả năng chuyển | Điều kiện 5 |
| Xác nhận lệnh mua/bán (nút) | Mở hộp đối chiếu | Mở khi `confirmBlockReason` trả null | Trên evm gọi thêm `preparePermitAction` |
| Câu lý do khoá / lỗi gửi | Vì sao nút bị khoá; lỗi từ server | gates hoặc kết quả `placeOrder` | Chỉ hiển thị |
| **Tóm tắt lệnh** | | | |
| Loại lệnh / Số lượng / Giá / Tổng giá trị dự kiến | Lặp lại số đang nhập | Như các dòng trên | Chỉ hiển thị |
| Token đang giữ | WPT của ví | On-chain `balanceOf(wallet)` | Chỉ hiển thị; là trần khi bán |
| Số dư VNDB | VNDB của ví | On-chain `paymentBalanceOf` (evm: `VNDToken.balanceOf`) | Chỉ hiển thị; dùng tính trần khi mua |
| **Thông tin token** | | `tokenInfoOf` | |
| Dự án | Tên dự án | Bảng `Project.name` (dòng đầu tiên) | Chỉ hiển thị |
| Trần phát hành | Trần cung | Bảng `Project.totalSupply` | Chỉ hiển thị |
| Giá phát hành | Giá cấu hình | SystemConfig `wpt.issue_price_vnd.<chain>` | Chỉ hiển thị |
| Trạng thái token | Chưa phát hành / Đã phát hành / Đã đóng | Bảng `Project.status` | Chỉ hiển thị |
| Trạng thái giao dịch | Đang mở / Tạm dừng (tất toán) | On-chain `isSettlementMode` (evm luôn null) | Chỉ hiển thị |
| Số chưa phân phối | WPT còn trong ví SPV | On-chain `balanceOf(spvWallet())` | Chỉ hiển thị; là một trần khi mua |
| Tuổi thọ còn lại / Lợi tức mục tiêu / Phí giao dịch | Điều khoản token | SystemConfig `wpt.remaining_lifetime_years`, `wpt.annual_yield_percent`, `wpt.trading_fee_percent` (mặc định 15 năm / 5,8 / 0) | Chỉ hiển thị; phí không được trừ ở đâu cả |
| **Hộp "Đối chiếu lệnh lần cuối"** | Xác nhận lần cuối | | |
| Loại lệnh, Số lượng, Giá, Tổng giá trị | Như trên | Như trên | Chỉ hiển thị |
| Bạn sẽ ký cho phép hệ thống chi đúng ... (chỉ evm) | Nội dung permit và hạn hiệu lực | `preparePermitAction` > `preparePermit`: `quotePurchase`, `permitNonce`, `latestBlockTimestamp` + SystemConfig `order.permit_ttl_seconds` (mặc định 1800) | Typed data đưa cho ví ký |
| Dải sai mạng / lý do không ký được | Ví sai chain hoặc chưa sẵn sàng | `useWalletStatus` | Khoá nút ký; có nút chuyển mạng |
| Quay lại | Đóng hộp | | Không gọi action |
| Gửi lệnh (mock) / Ký và đặt lệnh (evm) | Đặt lệnh | `placeOrderAction` > `placeOrder`. Schema `placeOrderSchema`, strict, có `clientRequestId` dạng UUID và `permit` gồm `value`, `deadline`, `nonce`, `signature` 65 byte | Quyền `order:place` (authorize). Ghi `AuditLog` (`order:place`), tạo dòng `PurchaseOrder`, rồi tự quyết toán: trạng thái PLACED > CHECKING > EXECUTING > COMPLETED/FAILED/REJECTED. Gửi tx on-chain `OrderSettlement.buy/sell` (evm dùng `buyWithPermit/sellWithPermit`), ký bằng ví ngân hàng. Ghi dòng `Txn` (`purchase`/`sale`) và `AuditLog` `order:auto-execute` |
| **Lệnh mua/bán vừa gửi: <trạng thái>** | Theo dõi lệnh | Kết quả `placeOrder`, rồi `listOrdersAction` mỗi 3 giây | Liên kết "Xem chi tiết" sang /orders/[id] |
| Mã giao dịch (mô phỏng) | Tx hash | `PurchaseOrder.txHash` | Chỉ hiển thị |
| Lý do | Lý do trượt | `PurchaseOrder.reason` | Chỉ hiển thị |
| Tiến trình 5 bước + bốn bút toán | Tạo lệnh, Kiểm tra, Đối chiếu số dư, Quyết toán, Hoàn tất | Ánh xạ từ `status` và các mốc `checkingAt`, `reconciledAt`, `settlingAt`, `completedAt` (`lib/bank/settlement-steps.ts`) | Chỉ hiển thị |


**Lệch** (tra mã ở Phụ lục C)

- **L-04.** Ô "Token" không có `onChange` (`components/pages/investor-trade.tsx:289`). Server luôn lấy `projects[0]` (`lib/bank/trade.service.ts:145`), và `placeOrder` không nhận trường token. Chọn token khác không có tác dụng.
- **L-02.** Ô "Giá" đọc on-chain `quotePurchase(1n)` (`lib/bank/trade.service.ts:138`). "Giá phát hành" trong thẻ Thông tin token đọc SystemConfig (`:139` và `:175`). Lời giới thiệu ở `components/pages/investor-trade.tsx:262` nói giao dịch "theo giá phát hành do ngân hàng cấu hình". Trên evm, nếu hai nguồn lệch nhau thì màn hình hiện hai giá khác nhau, và lệnh được chốt theo giá on-chain.
- **L-05.** "Trạng thái giao dịch" được tính là `settling !== true` (`lib/bank/trade.service.ts:146`). Giá trị này bỏ qua `Project.status`, và trên evm `settling` luôn null, nên huy hiệu hiện "Đang mở" kể cả khi dự án CLOSED. Trong khi đó điều kiện 4 lại trượt ("đang ở giai đoạn tất toán hoặc đã đóng", `:380-386`).
- **L-06.** Điều kiện "Tài khoản" chỉ kiểm quyền (`lib/bank/trade.service.ts:310-315`), không kiểm `AccountStatus` (ACTIVE/LOCKED). Hạn mức `dailyTransactionLimitVnd` hiện trên màn tài khoản nhưng không được kiểm ở đâu khi đặt lệnh (chỉ được đọc ở `components/pages/account-info.tsx:119`).
- **L-34.** Định danh, AML và hạng rủi ro lấy từ hồ sơ mẫu viết cứng (`lib/bank/account-profile.service.ts:55-114`), không lấy từ DB.
- **L-01.** Vòng hỏi lại 3 giây gọi `listOrders`, hàm này dùng `authorize` (`lib/bank/purchase.service.ts:1710`), nên mỗi lần hỏi ghi một dòng `AuditLog` `order:read`. Điều này ngược với lý do ghi ở `lib/bank/trade.service.ts:35-37` (không ghi sổ kiểm toán cho lần đọc lặp lại).
- **L-35.** "Phí giao dịch" chỉ để hiển thị; không có phép trừ phí nào trong `placeOrder`.
- **L-36.** Chiều bán dùng cùng đơn giá `quotePurchase` với chiều mua.
- **L-37.** Trần khi bán chỉ xét số WPT đang giữ. Thanh khoản VNDB của người bán chỉ lộ ra ở điều kiện "Rủi ro".


#### 3.1.3. `/orders` Quản lý lệnh

- **Vai:** INVESTOR. Menu "Quản lý lệnh", phím tắt Q. Service kiểm thêm `order:read`. INVESTOR không có `order:read:all`, nên bắt buộc phải lọc theo ví.
- **Chain:** mock dùng ví hồ sơ. hardhat-local và Sepolia dùng ví wagmi đang kết nối, và chỉ thấy lệnh của ví đó. Không có thao tác ký.
- **Trạng thái:** Dùng được.
- **Nghiệp vụ:** Mua bán token (tra cứu lệnh).
- **Action khi mở:**
  - 1 action: `listOrdersAction`.
- **Action khi thao tác:**
  - 1 `listOrdersAction` cho mỗi thay đổi ô lọc, gọi theo từng ký tự gõ, không có độ trễ.
  - Sắp xếp và bấm "Chi tiết": 0 action.
  - Mỗi lần gọi ghi một dòng `AuditLog` `order:read`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Chế độ mô phỏng đang lọc theo ví... | Ví đang lọc | `ownMockWallet()` | Chỉ hiện trên mock |
| **Bộ lọc** | | `orderQueryOf` (`components/trading/gates.ts:121-132`), luôn kèm `investorWallet` và `limit` 200 | Gửi lên `listOrdersAction` |
| Mã lệnh (UUID) | Lọc theo mã | Người dùng nhập. `orderIdSchema` đòi UUID (`lib/bank/schemas.ts:181-184`) | Tham số `orderId` |
| Chiều (Mọi chiều / Mua / Bán) | Lọc theo chiều | `ORDER_SIDES` | Tham số `side` |
| Trạng thái (Mọi trạng thái / 7 trạng thái) | Lọc theo trạng thái | `ORDER_STATUSES` với nhãn Đã đặt, Đang kiểm tra, Đang quyết toán, Hoàn tất, Bị từ chối, Thất bại, Hết hạn | Tham số `status` |
| Từ ngày / Đến ngày | Khoảng ngày tạo, tính theo giờ Việt Nam, gồm cả hai đầu | `z.iso.date`; kiểm thêm từ ngày ≤ đến ngày (`lib/bank/schemas.ts:209-216`) | `createdFrom`/`createdTo` (`orderCreatedRange`) |
| **Bảng** (bấm tiêu đề cột để sắp xếp) | Danh sách lệnh | `listOrders` > `orderStore.listOrders` (bảng `PurchaseOrder`) | Sắp xếp ngay trên trình duyệt (`sortOrders`) |
| Mã lệnh | 8 ký tự đầu; di chuột xem đủ | `PurchaseOrder.id` | Chỉ hiển thị |
| Thời điểm tạo | | `createdAt` | Chỉ hiển thị |
| Chiều | Mua / Bán | `side` | Chỉ hiển thị |
| Số lượng | WPT | `wptAmount` | Chỉ hiển thị |
| Giá | Đơn giá đã chốt | Tính toán: `vndAmount / wptAmount`, chia lấy phần nguyên (`gates.ts:135-138`) | Chỉ hiển thị |
| Giá trị | VNDB đã chốt lúc đặt lệnh | `vndAmount` | Chỉ hiển thị |
| Trạng thái | | `status` | Chỉ hiển thị |
| Cập nhật | | `updatedAt` | Chỉ hiển thị |
| Chi tiết | Liên kết | | Mở /orders/[id] |
| Không có lệnh nào khớp bộ lọc | Trạng thái rỗng | | Chỉ hiển thị |


**Lệch** (tra mã ở Phụ lục C)

- **L-38.** Gõ dở một mã lệnh (chưa đủ UUID) làm server trả "Dữ liệu không hợp lệ.", và câu này thay chỗ bảng (`components/pages/investor-orders.tsx:118` và `:148-149`). Không có thông báo nằm ngay cạnh ô nhập. Chọn "Từ ngày" sau "Đến ngày" cũng bị như vậy.
- **L-01.** Mỗi ký tự gõ là một lời gọi server và một dòng `AuditLog`.
- **L-39.** Mỗi lần chỉ tải tối đa 200 lệnh (`components/trading/gates.ts:130`), không có phân trang. Sắp xếp chỉ áp dụng trên 200 dòng đó.


#### 3.1.4. `/orders/[id]` Chi tiết lệnh

Không có mục menu, mở từ nút "Chi tiết" hoặc "Xem chi tiết".

- **Vai:** INVESTOR. Breadcrumb: Nhà đầu tư > Quản lý lệnh > 8 ký tự đầu của mã.
- **Chain:** như /orders. Lệnh của ví khác trả về "Không tìm thấy lệnh ... trong phạm vi được xem."
- **Trạng thái:** Dùng được. Nhật ký kiểm toán có giới hạn, xem phần Lệch.
- **Nghiệp vụ:** Mua bán token.
- **Action khi mở:**
  - 1 action: `getOrderDetailAction` > `trade.service.getOrderDetail` > `listOrders` (authorize `order:read`, ghi 1 dòng `AuditLog`) rồi `store.listAudit({limit:500})`.
  - Khi người dùng thao tác: 0 action.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Lệnh mua/bán <8 ký tự> + huy hiệu trạng thái | Tiêu đề | `PurchaseOrder.side`, `id`, `status` | Chỉ hiển thị |
| **Thông tin lệnh** | | Bảng `PurchaseOrder` | |
| Mã lệnh | UUID đầy đủ | `id` | Chỉ hiển thị |
| Chiều | Mua / Bán | `side` | Chỉ hiển thị |
| Số lượng | WPT | `wptAmount` | Chỉ hiển thị |
| Giá | Đơn giá đã chốt | Tính toán `vndAmount / wptAmount` | Chỉ hiển thị |
| Giá trị | VNDB đã chốt | `vndAmount` | Chỉ hiển thị |
| Ví | Ví đặt lệnh | `investorWallet` | Chỉ hiển thị |
| Thời điểm tạo / Cập nhật | | `createdAt` / `updatedAt` | Chỉ hiển thị |
| Mã giao dịch | Tx hash, hoặc "chưa có" | `txHash` | Chỉ hiển thị, không có liên kết |
| Lý do | Lý do bị từ chối hoặc thất bại, hoặc "không có" | `reason` | Chỉ hiển thị |
| **Tiến trình quyết toán** | 5 bước kèm mốc thời gian, bốn bút toán, kết cục | `toSettlementSteps` / `toSettlementView` (`lib/bank/settlement-steps.ts:71-171`) | Chỉ hiển thị |
| **Nhật ký kiểm toán của lệnh** | Các dòng sổ kiểm toán có nhắc mã lệnh | Bảng `AuditLog`: `createdAt`, `action`, `actorRole`, `outcome`, `detail`. Lọc bằng `detail.includes(orderId)` trong 500 dòng mới nhất | Chỉ hiển thị |
| Chưa có dòng nhật ký nào gắn với lệnh này | Trạng thái rỗng | | Chỉ hiển thị |


**Lệch** (tra mã ở Phụ lục C)

- **L-40.** Nhật ký chỉ quét 500 dòng `AuditLog` mới nhất (`lib/bank/trade.service.ts:424-425`, có ghi chú `ponytail`). Mọi lần đọc qua `authorize` (/portfolio ghi 3 dòng mỗi lần mở, /orders ghi 1 dòng mỗi ký tự, /trade ghi 1 dòng mỗi 3 giây) đều chiếm chỗ trong 500 dòng này. Vì vậy lệnh không cũ lắm vẫn có thể hiện "Chưa có dòng nhật ký nào".
- **L-41.** Các lần đặt lệnh bị từ chối trước khi tạo bản ghi không có mã lệnh trong `detail` (`lib/bank/purchase.service.ts:238-245`), nên không xuất hiện ở đây.
- **L-42.** Nhật ký hiện mã thô `action`, `actorRole` và `outcome` (ví dụ `order:auto-execute`, `INVESTOR`, `SUCCESS`) (`components/trading/order-detail-content.tsx:67-69`).
- **L-43.** Bước quyết toán tự động ghi `actorRole` là INVESTOR, dù tx do ví ngân hàng ký.
- **L-44.** "Mã giao dịch" không có liên kết sang trình khám phá khối và không ghi "mô phỏng" như màn /trade.


#### 3.1.5. `/tokens/[symbol]` Chi tiết token dự án

Không có mục menu, mở từ hộp "Token dự án điện gió" ở `/portfolio`.

- **Vai:** INVESTOR. Breadcrumb: Nhà đầu tư > Tổng quan > ký hiệu token. Ký hiệu không có trong `MOCK_PROJECTS` thì ra trang 404 (`app/(investor)/tokens/[symbol]/page.tsx:22-25`).
- **Chain:** mock dùng ví hồ sơ. hardhat-local và Sepolia dùng ví wagmi. Không có thao tác ký.
- **Trạng thái:** Dùng được một phần. Chỉ dự án WPT (`onChain: true`) có số liệu thật; WPT-PQY và WPT-NTH là dữ liệu mẫu hoàn toàn.
- **Nghiệp vụ:** Danh mục (thông tin dự án và vị thế).
- **Action khi mở:**
  - 1 action (`getPortfolioAction`, ghi 1 dòng `AuditLog`) khi dự án đã lên chuỗi và có ví; ngược lại 0 action.
  - Phía server còn đọc trực tiếp, không qua server action: `readTokenTerms()` (SystemConfig) và `ownMockWallet()`.
  - Khi người dùng thao tác: 0 action.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Tên dự án, ký hiệu, nhãn on-chain / "chưa triển khai trên chuỗi" | Tiêu đề | `MOCK_PROJECTS` | Chỉ hiển thị |
| Vùng, địa điểm, trạng thái | | `MOCK_PROJECTS` | Chỉ hiển thị |
| **Thông tin dự án** (dữ liệu mẫu) | Mã dự án, Công suất đặt, Số tổ máy, Giá bán điện (PPA), Vận hành từ, Đơn vị vận hành | `MOCK_PROJECTS` | Chỉ hiển thị |
| **Tình hình vận hành** (dữ liệu mẫu) | Sản lượng luỹ kế, Hệ số công suất, Sản lượng theo kỳ | `MOCK_PROJECTS`, `MOCK_GENERATION_SERIES`; ghi rõ sẽ do EnergyOracle cấp | Chỉ hiển thị |
| **Thông tin token** (nhãn on-chain nếu đã lên chuỗi) | | | |
| Ký hiệu | | `MOCK_PROJECTS.tokenSymbol` | Chỉ hiển thị |
| Tuổi thọ còn lại / Lợi tức mục tiêu / Phí giao dịch | Điều khoản | SystemConfig `wpt.remaining_lifetime_years`, `wpt.annual_yield_percent`, `wpt.trading_fee_percent` | Chỉ hiển thị, giống nhau cho mọi dự án |
| Tên token / Tổng cung (dự án đã lên chuỗi) | | On-chain `tokenInfo().name` / `.totalSupply` | Chỉ hiển thị |
| Giá phát hành (dự án đã lên chuỗi) | | SystemConfig `wpt.issue_price_vnd.<chain>` | Chỉ hiển thị |
| WPT dự kiến phát hành (dự án chưa lên chuỗi, hoặc chưa tải xong) | | `MOCK_PROJECTS.wptIssued` | Chỉ hiển thị |
| **Vị thế của bạn** | | `getPortfolioAction` | |
| Đang giữ | WPT ví đang giữ | On-chain `balanceOf` | Chỉ hiển thị |
| Giá trị theo giá phát hành | Số dư nhân giá cấu hình | Tính toán từ SystemConfig | Chỉ hiển thị |
| Kết nối ví ở góc trên phải... / Chưa có token trên chuỗi... | Trạng thái chặn | | Chỉ hiển thị |


**Lệch** (tra mã ở Phụ lục C)

- **L-45.** Thẻ "Thông tin token" mang nhãn on-chain (`components/pages/investor-token-detail.tsx:165`), nhưng Tuổi thọ, Lợi tức, Phí (`:172-178`) và Giá phát hành (`:186-189`) đều đọc từ SystemConfig, không đọc từ chuỗi.
- **L-46.** Trang tra dự án trong `MOCK_PROJECTS` viết cứng (`app/(investor)/tokens/[symbol]/page.tsx:22`), không tra bảng `Project` mà /trade dùng. Hai màn có thể hiện tên dự án khác nhau.
- **L-47.** Khi dự án đã lên chuỗi nhưng `getPortfolioAction` lỗi hoặc chưa trả về, thẻ thông tin token hiện dòng mẫu "WPT dự kiến phát hành" (`:180-196`) mà không báo là đang tải hay đã lỗi.
- **L-03.** Ở chế độ mock, màn này hiện vị thế bằng ví hồ sơ, còn /portfolio đòi ví trình duyệt (xem mục /portfolio).


#### 3.1.6. `/withdraw` Rút VNDB

- **Vai:** INVESTOR (vẫn qua cổng `portfolio:read`). Menu "Rút VNDB", phím tắt R.
- **Chain:** không phụ thuộc chain, vì không đọc dữ liệu gì.
- **Trạng thái:** Chỗ trống (chưa làm). Marker `// @pending FE-23 | ... nghiệp vụ rút chưa có ở tầng backend` (`app/(investor)/withdraw/page.tsx:4`).
- **Nghiệp vụ:** Rút VNDB (nhà đầu tư chuyển VNDB trong ví về tài khoản ngân hàng).
- **Action khi mở:** 0 action. Khi người dùng thao tác: 0 action.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Rút VNDB + huy hiệu "chờ FE-23" | Tiêu đề, task sẽ thay trang | Props cố định truyền vào `PlaceholderPage` | Chỉ hiển thị |
| Nhà đầu tư chuyển VNDB trong ví về tài khoản ngân hàng của mình. | Mục đích màn | Văn bản cố định | Chỉ hiển thị |
| Màn hình chưa dựng | Thông báo chỗ trống | `components/pages/placeholder.tsx` | Chỉ hiển thị |
| Đã sẵn (2 dòng) | Đường dẫn, cổng quyền, `useWalletStatus().canSign` | Văn bản cố định | Chỉ hiển thị |
| Lưu ý (2 dòng) | Backend chưa có service và quyền; mã FE-23 do FE-20 đặt trước | Văn bản cố định | Chỉ hiển thị |


**Lệch** (tra mã ở Phụ lục C)

- **L-48.** `app/actions/withdraw.ts` và `lib/bank/withdraw.service.ts` đã có, nhưng đó là luồng rút vault SPV của **Người bán**, dùng quyền `vault:withdraw` chỉ cấp cho SELLER (`lib/rbac/permissions.ts:213-214` và `:283-291`). Màn này không dùng chúng. Câu "chưa có quyền RBAC" là đúng với vai INVESTOR.
- **L-49.** Câu lưu ý "Khác với ba màn kia" (`app/(investor)/withdraw/page.tsx:17`) là văn bản từ lúc dựng khung; ba màn kia nay đã có phần thân.


### 3.2. Người bán

#### 3.2.1. `/seller` Tổng quan

- **Vai:** chỉ Người bán (SELLER). Cổng `seller:read` (`app/(seller)/layout.tsx`, `lib/rbac/area-gates.ts`); service kiểm lại `seller:read` (`lib/bank/seller.service.ts:115`). Menu "Tổng quan", phím tắt E.
- **Chain:**
  - mock: chạy đủ, số liệu vault mô phỏng tính bằng `lib/ledger/vault-lock.ts`.
  - hardhat-local, evm: số đọc trực tiếp từ getter của `SpvPaymentVault` (`lib/ledger/evm.adapter.ts:1183-1240`).
  - stellar: màn báo lỗi vì `spvWallet()` và `profitPoolBalance()` ném `LedgerNotImplementedError` (`lib/ledger/stellar.adapter.ts:77,131`) trong `Promise.all` (`seller.service.ts:118-128`).
- **Trạng thái:** Dùng được một phần.
  - Stellar là Chỗ trống, chờ Phase 7 Soroban (SC-02).
  - Hai ô "bán" bị gắn cứng (xem phần Lệch).
  - Trên EVM, "Trạng thái giao dịch" luôn là "Đang mở bán": `isSettlementMode` mang marker `@blocked SC-04` (`evm.adapter.ts:1164`), service bắt lỗi và coi như false (`seller.service.ts:39-46`).
- **Nghiệp vụ:** Tổng quan Người bán (chỉ đọc).
- **Action khi mở:** 1 action `getSellerOverviewAction({chain})` > `getSellerOverview`. Ghi 1 dòng AuditLog `seller:read`. Đổi chain thì gọi lại. Không có action khi tương tác; hai nút chỉ là liên kết.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Chain đang xem | Chain đang chọn | `useSelectedChain()` phía trình duyệt | Biết số liệu thuộc chain nào |
| Danh sách giao dịch (nút) | Lối tắt | Link `/seller/transactions` | Điều hướng |
| Tạo lệnh rút (nút) | Lối tắt | Link `/seller/withdraw` | Điều hướng |
| **Khối Token khớp lệnh trong ngày** | | | |
| Số lượng mua (WPT), gợi ý "N lệnh" | WPT của lệnh mua đã khớp trong ngày giờ VN | `orderDailyStats` > `OrderStore.summarizeCompleted`: bảng `PurchaseOrder`, `status=COMPLETED`, theo `completedAt`, `side=BUY`, SUM(`wptAmount`), COUNT (`lib/store/postgres.order.store.ts:248`) | Theo dõi bán trong ngày |
| Tổng giá trị mua (VNDB) | VNDB của các lệnh trên | Như trên, SUM(`vndAmount`) | Như trên |
| Số lượng bán | Gắn cứng dấu gạch ngang dài, gợi ý "Hệ thống chưa có lệnh bán lại." | Hằng số trong JSX (`seller-overview.tsx:157`) | Xem phần Lệch |
| Tổng giá trị bán | Như trên | Hằng số (`seller-overview.tsx:158`) | Xem phần Lệch |
| **Khối Thông tin nguồn cung** (chỉ token đầu tiên `tokens[0]`) | | | |
| Trần phát hành | Số token tối đa | DB: `Project.totalSupply` (`issuance.service.ts:119`) | Giới hạn phát hành |
| Số còn được phát hành | Trần trừ tổng cung, không âm | Tính: `Project.totalSupply` trừ `tokenInfo().totalSupply` trên chuỗi | Biết còn mint được bao nhiêu |
| Tổng cung hiện tại | Token đang tồn tại | Chuỗi: `ledger.tokenInfo()` > `totalSupply()` | |
| Chưa phân phối | WPT còn ở ví thanh toán | Chuỗi: `ledger.balanceOf(paymentWallet)`; `paymentWallet` = địa chỉ vault, không có vault thì lấy `spvWallet()` (`seller.service.ts:131,140`) | Tồn kho chưa bán |
| Đang lưu hành | WPT đã ở ví nhà đầu tư | Tính: tổng cung trừ chưa phân phối | |
| **Khối Thông tin token** | | | |
| Mã token / Dự án | Ký hiệu, tên dự án | DB: `Project.tokenSymbol`, `Project.name` | |
| Trần phát hành | Như trên | DB: `Project.totalSupply` | |
| Giá phát hành (VNDB) | Giá 1 WPT | DB: `SystemConfig` khoá `wpt.issue_price_vnd.<chain>` (`readIssuePriceVnd`) | Xem phần Lệch |
| Tuổi thọ còn lại | Số năm | DB: `SystemConfig` `wpt.remaining_lifetime_years`, mặc định 15 | Điều khoản |
| Lợi tức mục tiêu | %/năm | DB: `SystemConfig` `wpt.annual_yield_percent`, mặc định 5.8 | Điều khoản |
| Phí giao dịch | %, bằng 0 thì hiện "Không tính" | DB: `SystemConfig` `wpt.trading_fee_percent`, mặc định 0 | Điều khoản, không dùng ở luồng nào khác |
| Trạng thái token | Chưa phát hành / Đã phát hành / Đã tất toán | DB: `Project.status` (DRAFT/ISSUED/CLOSED) | |
| Trạng thái giao dịch | Đang mở bán / Ngừng bán (đang tất toán) | Chuỗi: `ledger.isSettlementMode()`; lỗi chưa hiện thực thì coi như false | Xem phần Trạng thái |
| **Bảng Tồn kho token** | Mỗi dòng là một `Project` của chain, 5 cột như khối nguồn cung | DB `Project` + chuỗi | Xem phần Lệch |
| **Khối Tài sản trong ví thanh toán** | | | |
| Token chưa phân phối (WPT) | Như "Chưa phân phối", gợi ý "Không rút qua kênh này, lệnh rút chỉ áp cho VNDB." | Như trên | |
| VNDB | Số dư VNDB của vault | Chuỗi: `VNDToken.balanceOf(vault)` (`vaultStatus().vndbBalance`); không có vault thì `paymentBalanceOf(spvWallet)` | |
| VNDB đã khoá | Phần khoá | Chuỗi: getter vault `lockedAmount()` | |
| VNDB còn rút được | Phần vượt khoá | Chuỗi: getter vault `withdrawable()` | |
| Ví thanh toán: <địa chỉ> | Địa chỉ vault, hoặc ví SPV | `vault.address` hoặc `spvWallet()` | |
| Cảnh báo đỏ | "Ví SPV trên chuỗi không phải vault: ..." | Tính: `spvWallet()` khác `vault.address` (`seller.service.ts:159-162`) | Đối soát cấu hình |
| "Chưa phát hành lần nào nên chưa có ví thanh toán." | | `paymentWallet === null` | |
| **Khối Số dư ví** | | | |
| VNDB ví thanh toán | Trùng ô "VNDB" ở trên | Như trên | |
| VNDB ví chia lợi nhuận | Quỹ chia lợi nhuận | Chuỗi: `profitPoolBalance()` = `VNDToken.balanceOf(ProfitDistributor)` (`evm.adapter.ts:1067`) | |
| Phần khoá | Trùng "VNDB đã khoá" | `lockedAmount()` | |
| Hạn mức còn rút được | Trùng "VNDB còn rút được" | `withdrawable()` | Xem phần Lệch |
| Dòng chú thích luật khoá | Câu mô tả theo `lockMode` | `describePolicy()` (`seller-overview.tsx:31-40`) đọc `lockMode`, `fixedLockAmount`, `percentRateBps`, `netProceeds`, `percentLocked` của vault | Xem phần Lệch |


**Lệch** (tra mã ở Phụ lục C)

- **L-07.** `seller-overview.tsx:157-158`: hai ô bán gắn cứng dấu gạch ngang dài, kèm câu "Hệ thống chưa có lệnh bán lại." Trong khi đó service đã trả `today.sell` (count/wpt/vnd) từ BE-14 (`seller.service.ts:171-175`), và màn Danh sách giao dịch có loại "Bán".
- **L-08.** Chú thích chế độ PERCENT (`seller-overview.tsx:36-39`) in cả "thu ròng" lẫn "phần khoá kỳ gần nhất" nhưng không nói số nào đang áp dụng. Theo hợp đồng (`packages/contracts-evm/contracts/SpvPaymentVault.sol:106-113`):
   - Chưa chốt kỳ nào (`lastPeriodRef == 0`): khoá = `netProceeds` nhân tỷ lệ. Lúc này `percentLocked` hiện ra là 0, dễ hiểu nhầm.
   - Đã chốt kỳ: khoá = `percentLocked`, tức tỷ lệ nhân `distributedPrev` (lợi nhuận đã chia kỳ trước, `SpvPaymentVault.sol:159`), không còn tính trên thu ròng.
   - `SellerWithdrawPolicy` không mang `lastPeriodRef` và tỷ lệ chờ (`pendingPercentRateBps`) (`seller.service.ts:62-69`), nên màn không giải thích được đúng.
- **L-09.** "Hạn mức còn rút được" (`seller-overview.tsx:273`) dùng chữ "hạn mức" của mô hình FE-21 đã bị gỡ (BE-13 QĐ-H, `seller.service.ts:58-61`). Giá trị thật là `withdrawable()` của vault, giống hệt ô "VNDB còn rút được".
- **L-02.** "Giá phát hành" đọc `SystemConfig` trong DB. Trên EVM, giá khớp lệnh thật là `OrderSettlement.price()` trên chuỗi (`evm.adapter.ts:837-839`), nên hai bên có thể khác nhau.
- **L-50.** Bảng Tồn kho lặp một dòng cho mỗi `Project`, nhưng mọi dòng đọc chung một `tokenInfo()` và `balanceOf` của chain. Có nhiều dự án trên một chain thì các dòng ra cùng số.
- **L-51.** Định nghĩa "Chưa phân phối" ghi "ví thanh toán của Người bán", thực chất là số dư WPT của vault SPV.
- **L-52.** `payoutWallet` và `withdrawalsPaused` có trong dữ liệu trả về nhưng màn này không hiển thị.


#### 3.2.2. `/seller/transactions` Danh sách giao dịch

- **Vai:** chỉ SELLER (cổng `seller:read`, service kiểm lại ở `seller.service.ts:296`). Phím tắt D.
- **Chain:** chỉ đọc kho DB, không đọc chuỗi, nên chạy được trên cả 4 chain. Trên stellar thường rỗng.
- **Trạng thái:** Dùng được. Ghi chú kỹ thuật `ponytail` (`seller.service.ts:35`): lọc và phân trang làm trong bộ nhớ, trên tối đa 500 lệnh và 500 lệnh rút mới nhất.
- **Nghiệp vụ:** Tổng quan Người bán (sổ giao dịch).
- **Action khi mở:** 1 action `listSellerTransactionsAction` > `listSellerTransactions`. Mỗi lần đổi bộ lọc hoặc đổi trang gọi thêm 1 lần. Ô tìm kiếm gọi theo từng phím gõ, không có debounce. Mỗi lần gọi ghi 1 dòng AuditLog `seller:read`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Ô "Mã lệnh hoặc ví nhà đầu tư" | Tìm chuỗi con, không phân biệt hoa thường | Service lọc `PurchaseOrder.id` / `investorWallet`; với lệnh rút lọc `WithdrawRequest.id` / `payoutWallet` / `txHash` (`seller.service.ts:319-333`) | Tìm lệnh |
| Loại: Mọi loại / Mua / Bán / Rút | Lọc loại | `type`: BUY và SELL lọc `PurchaseOrder.side`; WITHDRAW lấy bảng `WithdrawRequest` | |
| Trạng thái | Danh sách đổi theo loại; ở "Mọi loại", trạng thái chỉ có ở lệnh rút mang hậu tố "(rút)" | `ORDER_STATUSES` / `WITHDRAW_STATUSES`. Server từ chối trạng thái không thuộc loại (`seller.service.ts:287-294`). Đổi loại thì xoá trạng thái không hợp lệ | |
| Từ ngày / Đến ngày | Lọc theo ngày tạo, giờ Việt Nam | `createdAt` đổi sang ngày Asia/Ho_Chi_Minh (`seller.service.ts:32,320`) | |
| Mã lệnh | 8 ký tự đầu, rê chuột thấy mã đủ | `PurchaseOrder.id` / `WithdrawRequest.id` | |
| Nhà đầu tư / ví nhận | Ví rút gọn | `PurchaseOrder.investorWallet`, hoặc `WithdrawRequest.payoutWallet` (ảnh chụp lúc tạo lệnh) | |
| Loại | Mua / Bán / Rút | `PurchaseOrder.side` hoặc hằng WITHDRAW | |
| Số token | WPT; để trống với lệnh rút | `PurchaseOrder.wptAmount` | |
| Số VNDB | | `PurchaseOrder.vndAmount` / `WithdrawRequest.amount` | |
| Bước hiện tại | Lệnh: "1. Đặt lệnh" đến "4. Đã giao token". Lệnh rút: **mục đích** | `STEP_LABELS[status]` hoặc `WithdrawRequest.purpose` (`seller-transactions.tsx:195`) | Xem phần Lệch |
| Trạng thái | Nhãn badge | Lệnh: PLACED...EXPIRED. Lệnh rút: SENDING "Đang gửi", SENT "Đã gửi, chờ biên nhận", COMPLETED, FAILED, NEEDS_REVIEW "Cần Kiểm soát viên xem" | |
| Tạo lúc / Cập nhật | Giờ máy người dùng (vi-VN) | `createdAt` / `updatedAt` | |
| Dòng phân trang | "{tổng} giao dịch", dấu chấm giữa, "trang x/y"; cỡ trang 20 | `total` tính sau khi lọc trong bộ nhớ | |
| Trang trước / Trang sau | | `page` gửi lên server | |


**Lệch** (tra mã ở Phụ lục C)

- **L-53.** Cột "Bước hiện tại" hiện mục đích rút cho lệnh rút (`seller-transactions.tsx:175,195`), không phải một bước.
- **L-54.** `STEP_LABELS` mô tả luồng mua ("4. Đã giao token", `seller-transactions.tsx:36-44`) nhưng áp cả cho lệnh Bán.
- **L-55.** Placeholder chỉ nói "Mã lệnh hoặc ví nhà đầu tư" (`seller-transactions.tsx:133`), trong khi server còn tìm theo ví nhận và txHash của lệnh rút.
- **L-56.** Sổ vượt 500 dòng thì `total` và phân trang thiếu dòng cũ (`seller.service.ts:35-36`).
- **L-57.** Lệnh rút có `txHash` nhưng bảng này không hiện cột mã giao dịch.


#### 3.2.3. `/seller/withdraw` Tạo lệnh rút

- **Vai:** chỉ SELLER. Cổng khu vực `seller:read`; tạo lệnh và đọc "Yêu cầu rút của tôi" cần `vault:withdraw`, quyền ghi duy nhất của SELLER (`lib/rbac/permissions.ts:214`). Phím tắt R.
- **Chain:**
  - mock: rút trên vault logic.
  - hardhat-local, evm: ví ký phía máy chủ gọi `SpvPaymentVault.withdraw(amount)`, cần `WITHDRAWER_ROLE` (`evm.adapter.ts:1342-1344`).
  - stellar: khối tính toán báo lỗi (overview lỗi), `withdrawFromVault` là `todoNeeds` (`stellar.adapter.ts:201`). Bảng "Yêu cầu rút của tôi" vẫn tải được.
- **Trạng thái:** Dùng được trên mock, hardhat-local, evm, với điều kiện Kiểm soát viên đã đặt ví nhận và luật khoá trên `/vault`. Stellar là Chỗ trống (Phase 7 Soroban).
- **Nghiệp vụ:** Rút tiền SPV.
- **Action khi mở:** 2 action.
  - `getSellerOverviewAction`: ghi AuditLog `seller:read`.
  - `reconcileAndListMyWithdrawRequestsAction` (`app/actions/withdraw.ts:360-363`): đối soát rồi đọc danh sách trong một lượt. Ghi AuditLog `vault:read` và `vault:withdraw`.
- **Action khi bấm Xác nhận:** 1 action `createWithdrawRequestAction`, sau đó tự gọi lại 2 action khi mở.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Số tiền rút (VNDB) | Số nguyên VNDB | Người dùng nhập. Màn kiểm bằng `quoteWithdraw` (`lib/bank/withdraw-limit.ts`). Server kiểm `^\d+$` và > 0 (`withdraw.service.ts:176`) | |
| "Vượt phần được rút: chỉ rút được tối đa X VNDB." | Cảnh báo ngay khi gõ | So với `withdrawable()` đọc lúc mở màn | Chặn nút |
| Mạng | Chỉ đọc | Nhãn chain từ public config | |
| Ví nhận (đặt bởi Kiểm soát viên) | Chỉ đọc; "Chưa đặt" khi null | Chuỗi: getter vault `payoutWallet()`; địa chỉ 0x0 coi là null | Tiền luôn về ví này |
| Mục đích | Bắt buộc, tối đa 200 ký tự | Ghi vào `WithdrawRequest.purpose` | |
| Ghi chú | Tuỳ chọn, tối đa 500 ký tự | Ghi vào `WithdrawRequest.note` | |
| Dòng chặn | "Chain này chưa có vault...", "Vault chưa có ví nhận tiền rút...", "Vault đang tạm dừng rút." | `withdrawableVnd`, `payoutWallet`, `withdrawalsPaused` (getter `paused()`) | Tắt nút |
| **Tạo lệnh rút** (nút) | Mở hộp OTP | Bật khi: không có dòng chặn, số hợp lệ, không vượt, có mục đích. Mỗi lần mở hộp sinh một `clientRequestId` (UUID) mới | |
| Hộp "Xác nhận mã một lần" | Nhập 6 chữ số; ghi rõ "Bản thử: chưa gửi mã thật..." | Chỉ kiểm dạng `^\d{6}$`, cả ở màn lẫn server (`withdraw.service.ts:173`). Mã không lưu, không vào log | |
| **Xác nhận** (nút) | Gửi lệnh | `createWithdrawRequest`, xem luồng bên dưới | |
| Dòng kết quả | COMPLETED: "Đã rút X VNDB về ví ...". Trạng thái khác: "Lệnh rút đang ở trạng thái: ..." | Kết quả action | |
| **Khối Hệ thống tính** | | | |
| Số dư VNDB của vault | | Chuỗi: `VNDToken.balanceOf(vault)` | |
| Phần khoá | | Chuỗi: `lockedAmount()` | |
| Phần được rút | | Chuỗi: `withdrawable()` | |
| Số tiền nhận được | Bằng số rút (PoC không thu phí) | Tính: `quoteWithdraw` | |
| Chú thích luật khoá | Giống `/seller` | `describePolicy()` | Xem Lệch mục 2 của `/seller` |
| "Phí ngân hàng ngoài chuỗi: chưa áp dụng (POC)." | | Hằng số | |
| **Bảng Yêu cầu rút của tôi** (50 lệnh, chỉ của người đang thao tác) | | `listMyWithdrawRequests`: `WithdrawRequest` lọc theo `chain` và `createdBy` = actor | |
| Mã / Số tiền / Ví nhận / Mục đích | | `id` (8 ký tự), `amount`, `payoutWallet`, `purpose` | |
| Trạng thái | Badge; rê chuột thấy `reason` | `WithdrawRequest.status`, `reason` | |
| Giao dịch | txHash rút gọn. Có link explorer chỉ trên evm (Etherscan Sepolia) | `WithdrawRequest.txHash`, `explorerTxUrl` | |
| Thời điểm | | `createdAt` | |

**Luồng "Tạo lệnh rút"** (`withdraw.service.ts:151-366`):
1. Kiểm dữ liệu vào bằng zod.
2. `authorize('vault:withdraw')`: ghi AuditLog ALLOWED hoặc DENIED.
3. Kiểm OTP sáu số, rồi kiểm số tiền. Sai thì ghi AuditLog FAILURE "Từ chối trước khi gửi".
4. Chống trùng: cùng `clientRequestId` và cùng nội dung thì trả lại lệnh cũ; khác nội dung thì từ chối.
5. Lấy khoá `VaultOperationLock` (chain, kind=WITHDRAW). Đang có thao tác khác thì báo VAULT_BUSY: "Kiểm soát viên đang lưu cấu hình khoá" hoặc "đã có lệnh rút đang dở".
6. Đọc `vaultStatus()` ngay lúc này rồi kiểm: có vault, có `payoutWallet`, ví nhận không trùng địa chỉ vault, không tạm dừng, `amount <= withdrawable()`.
7. Ghi `WithdrawRequest` trạng thái SENDING, kèm `claimedBlock` và `activeChain` (mỗi chain chỉ một lệnh dở).
8. Gọi `withdrawFromVault`:
   - Revert: chuyển FAILED và nhả khoá.
   - Lỗi chưa rõ đã lên chuỗi hay chưa: giữ SENDING, không gửi lại.
9. Có txHash thì chuyển SENT, ghi `Txn` (`operation=vault:withdraw`, `status=PENDING`, `toWallet=payoutWallet`).
10. Chờ biên nhận (30 giây, riêng evm 90 giây):
    - Thành công và có sự kiện `Withdrawn` đúng ví nhận, đúng số tiền: COMPLETED.
    - Revert: FAILED.
    - Thành công nhưng không có sự kiện khớp: NEEDS_REVIEW.
    - Có kết cục thì cập nhật `Txn.status` và ghi AuditLog. Về trạng thái cuối thì nhả khoá.
    - Chưa có biên nhận: giữ SENT.

**Luồng đối soát** khi mở lại màn (`withdraw.service.ts:404-436`):
- Lệnh SENT: chốt theo biên nhận như trên.
- Lệnh SENDING quá hạn chờ: luôn chuyển NEEDS_REVIEW, kèm danh sách sự kiện ứng viên. Không bao giờ tự kết luận COMPLETED.
- Kiểm soát viên xử lý lệnh NEEDS_REVIEW trên `/vault` qua `resolveWithdrawRequest` (`vault:reconcile`).


**Lệch** (tra mã ở Phụ lục C)

- **L-58.** Lệnh về SENT (đã gửi, chờ biên nhận) vẫn hiện bằng giọng lỗi màu đỏ (`seller-withdraw.tsx:114`).
- **L-18.** Đối soát kiểm quyền bằng `anyOf(['vault:read','vault:withdraw'])` nhưng `authorize` ghi sổ với tên `vault:read` (`withdraw.service.ts:409`). Vì vậy AuditLog có dòng SELLER + `vault:read` + ALLOWED, dù SELLER không có quyền `vault:read` trong bảng quyền.
- **L-59.** Đối soát chỉ quét 20 lệnh SENDING/SENT (`withdraw.service.ts:412`). Bảng "Yêu cầu rút của tôi" giới hạn 50 dòng.
- **L-60.** Màn tính "Số tiền nhận được" trên chuỗi chưa trim (`seller-withdraw.tsx:76`), còn server trim. Số có khoảng trắng thì màn hiện dấu gạch ngang dài và tắt nút, dù server sẽ nhận.
- **L-61.** Số dư và "Phần được rút" trên màn chỉ là ảnh chụp lúc mở màn. Giới hạn thật được đọc lại trên chuỗi khi gửi lệnh (bước 6), nên màn có thể chấp nhận một số mà server từ chối.


### 3.3. Màn dùng chung cho khách hàng

#### 3.3.1. `/wallet` Kết nối ví

- **Vai:** INVESTOR và SELLER, cổng `wallet:connect` (`app/(wallet)/layout.tsx`). Phím tắt V, có ở cả hai menu.
- **Chain** (`lib/wallet/wallet-status.ts:101-162`):
  - mock: thẻ "Đang ở chế độ mô phỏng", không cần ví.
  - stellar: "Chưa hỗ trợ ví cho mạng này".
  - hardhat-local, evm: dùng ví trình duyệt qua RainbowKit/wagmi.
- **Trạng thái:** Dùng được trên hardhat-local và evm. Stellar là Chỗ trống (ví trình duyệt chỉ hỗ trợ họ EVM).
- **Nghiệp vụ:** Liên kết ví (kết nối ví trình duyệt, không lưu vào hồ sơ).
- **Action khi mở:** 0 server action. Số dư đọc `eth_getBalance` qua wagmi từ trình duyệt (`lib/hooks/use-native-balance.ts`).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Ví của tôi (tiêu đề) | | Tĩnh | |
| Chưa có ví trong trình duyệt | Hướng dẫn cài MetaMask hoặc Rabby, 3 bước | Không dò thấy ví được tiêm | |
| Chưa kết nối ví + nút **Kết nối ví** | Mở hộp thoại chọn ví của RainbowKit | wagmi `isConnected=false` | |
| Ví đang ở mạng khác + nút "Chuyển ví sang <mạng>" | Ví ở chainId ngoài danh sách cho phép, hoặc lệch với chain của trang | wagmi `chainId` so với `CHAINS[appChain].chainId` | Người dùng tự bấm chuyển, không tự đổi |
| Nút "Hoặc xem trang theo <mạng>" | Đổi chain của trang theo chain của ví | Chỉ hiện khi chain đó chọn được | |
| Ví đã kết nối, nhãn badge tên mạng | | `CHAINS[chainKey].label` | |
| Địa chỉ ví + nút **Sao chép** | Địa chỉ rút gọn; nút chép địa chỉ đầy đủ | wagmi `address`, `navigator.clipboard` | |
| Xem trên Etherscan | Chỉ có trên evm | `explorerAddressUrl` | |
| Số dư ETH | Đồng trả phí mạng, không phải VNDB | wagmi `useBalance` | |
| **Ngắt kết nối** (nút) | | `disconnect()` của wagmi | |
| Dòng ghi chú cuối trang | Ví chỉ dùng cho thao tác của nhà đầu tư; thao tác của ngân hàng ký phía máy chủ | Tĩnh | |


**Lệch** (tra mã ở Phụ lục C)

- **L-62.** Breadcrumb là "Nhà đầu tư > Ví của tôi" (`app/(wallet)/wallet/page.tsx:16`), nhưng Người bán cũng vào được trang này. Tiêu đề "Ví của tôi" khác nhãn menu "Kết nối ví".
- **L-63.** Mọi câu chữ đều nói về nhà đầu tư, ví dụ "Ví ở trang này chỉ dùng cho thao tác của nhà đầu tư" (`wallet-connect.tsx:248`). Với SELLER, không màn Người bán nào dùng ví trình duyệt: lệnh rút ký phía máy chủ.
- **L-64.** Kết nối ví ở đây không ghi gì vào hồ sơ. Muốn liên kết vào hồ sơ thì làm ở `/account`.
- **L-65.** "Số WPT đang giữ xem ở trang Tổng quan" (`wallet-status-card.tsx:113`): với SELLER, trang Tổng quan hiện số của vault, không phải số của ví đang kết nối.


#### 3.3.2. `/account` Thông tin tài khoản

- **Vai:** cả 4 vai, cổng `balance:read` (`app/(account)/layout.tsx`). Phím tắt T.
  - Khối "Ví liên kết trên chain" chỉ hiện với vai khách hàng (INVESTOR, SELLER) (`app/(account)/account/page.tsx:15`). Service kiểm lại `wallet:connect` (`account-profile.service.ts:208`).
- **Chain:** phần hồ sơ không phụ thuộc chain. Khối ví liên kết theo chain đang chọn:
  - mock, hardhat-local: chưa liên kết thì dùng ví mẫu; nhận cả ví mẫu.
  - evm: bắt buộc tự liên kết; ví mẫu công khai của Hardhat bị từ chối.
  - stellar: chỉ nhận định dạng EVM `0x` + 40 hex.
- **Trạng thái:** Dùng được một phần. Hồ sơ là dữ liệu mẫu cố định trong mã (`SAMPLE_ACCOUNT_PROFILES`, `account-profile.service.ts:55-114`), chờ AU-01 thay bằng phiên đăng nhập thật. Khối liên kết ví thì dùng được.
- **Nghiệp vụ:** Hồ sơ, và Liên kết ví (OP-05 QĐ-I).
- **Action khi mở:**
  - Vai nhân viên: 0 server action. `getOwnAccountProfile()` được gọi thẳng trong Server Component, không ghi AuditLog.
  - Vai khách hàng: thêm 1 action `getProfileWalletAction({chain})`, không ghi AuditLog. Đổi chain thì gọi lại.
  - Bấm Lưu: 1 action `linkProfileWalletAction`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Thông tin tài khoản + badge "Chỉ đọc" | | Tĩnh | Xem phần Lệch |
| **Khách hàng: Thông tin cá nhân / Thông tin pháp nhân** | | | |
| Họ và tên / Tên pháp nhân | | Hồ sơ mẫu `fullName` (NDT001, NB001) | |
| Người liên hệ | Chỉ với tổ chức | `contactPerson` | |
| Số điện thoại / Thư điện tử | | `phone` / `email` | |
| Trạng thái định danh | Đã xác minh / Đang xác minh / Không đạt | `identityStatus` | Hiện hai lần trên màn |
| Địa chỉ ví / Ví thanh toán (tổ chức) | | `SAMPLE_WALLETS.NDT001` hoặc `.NB001` (`packages/shared/src/index.ts:23`) | Xem phần Lệch |
| **Khách hàng: Thông tin tài khoản** | | | |
| Mã người dùng / Vai trò / Trạng thái | | `actorId`, `role`, `status` (Đang hoạt động / Đã khoá) | |
| Ngày tạo / Hoạt động gần nhất | | `createdAt` / `lastActiveAt`, chuỗi cố định | |
| **Khách hàng: Hồ sơ định danh và rủi ro** | | | |
| Loại khách hàng | Cá nhân / Tổ chức | `customerType` | |
| Xếp hạng rủi ro / Phòng chống rửa tiền | | `riskRating` / `amlStatus` | Màn Giao dịch token đọc hai trường này khi kiểm tra trước lệnh (`trade.service.ts:245-253`) |
| Hạn mức giao dịch mỗi ngày | VNDB | `dailyTransactionLimitVnd` | Xem phần Lệch |
| **Nhân viên: Thông tin cán bộ** | Mã cán bộ, Họ và tên, Vai trò, Trạng thái, SĐT, Email, Hoạt động gần nhất | Hồ sơ mẫu GDV001, KSV001 | |
| **Khối Ví liên kết trên chain <nhãn chain>** | | | |
| Ví đang liên kết | Ví đã liên kết, hoặc "chưa liên kết (đang dùng ví mẫu X)", hoặc "chưa liên kết" | DB: `ProfileWallet.wallet` theo (`actorId`, `chain`); ví mẫu chỉ áp trên mock và hardhat-local | |
| Cập nhật lúc | | `ProfileWallet.updatedAt` | |
| Ô Địa chỉ ví | Placeholder "0x…" | Người dùng nhập | |
| **Dùng ví đang kết nối** (nút) | Điền địa chỉ của ví đang kết nối | wagmi `address`; tắt khi chưa kết nối | |
| **Lưu** (nút) | Liên kết ví vào hồ sơ | `linkProfileWallet`, xem luồng bên dưới | |
| Dòng ghi chú | "Liên kết chỉ ghi ví vào hồ sơ để app so với ví bạn kết nối khi đặt lệnh. Ví vẫn phải được ngân hàng đưa vào danh sách được phép trên chuỗi." | Tĩnh | |
| Thông báo kết quả | "Đã liên kết ví ... trên chain ...", hoặc câu lỗi | Kết quả action | |

**Luồng "Lưu"** (`account-profile.service.ts:242-278`):
1. zod kiểm `^0x[0-9a-fA-F]{40}$` (`lib/bank/schemas.ts:16-19`).
2. Kiểm `wallet:connect` và hồ sơ khách hàng. Không đạt thì ghi AuditLog DENIED.
3. Chuẩn hoá checksum EVM.
4. Không phải mock hoặc hardhat-local mà ví nằm trong `PUBLIC_SAMPLE_WALLETS`: ghi AuditLog FAILURE, trả lỗi "Ví ... là ví mẫu công khai của Hardhat...".
5. Upsert `ProfileWallet` (`actorId`, `chain`, `wallet`, `walletKey` viết thường, `updatedBy`).
6. Ví đã thuộc hồ sơ khác trên cùng chain (ràng buộc duy nhất `chain` + `walletKey`): ghi AuditLog FAILURE, báo "Ví này đã liên kết với một hồ sơ khác trên chain này."
7. Thành công: ghi AuditLog `profile:wallet:link` SUCCESS, kèm ví cũ và ví mới.
8. Không whitelist trên chuỗi, không ký chứng minh quyền sở hữu ví (nợ AU-01).


**Lệch** (tra mã ở Phụ lục C)

- **L-10.** Badge "Chỉ đọc" và câu "Mọi thay đổi cần được ngân hàng xác minh" (`account-info.tsx:71-74`), nhưng cùng trang có form ghi ví liên kết. Form lưu ngay, không qua bước xác minh nào của ngân hàng.
- **L-10.** Trường "Địa chỉ ví" / "Ví thanh toán" luôn hiện ví mẫu cố định (`account-info.tsx:93-95`), không theo chain và không theo ví đã liên kết. Trên evm, chính ví mẫu đó bị từ chối liên kết. Với SELLER, nhãn "Ví thanh toán" dễ nhầm với ví thanh toán SPV (vault) trên `/seller`.
- **L-06.** "Hạn mức giao dịch mỗi ngày" chỉ để hiển thị. Không service nào kiểm trường `dailyTransactionLimitVnd`.
- **L-66.** Sai định dạng địa chỉ bị chặn ở zod trước khi ghi sổ (`account-profile.service.ts:244`), nên không có dòng AuditLog. Điều này trái với chú thích "Mọi kết cục vào sổ kiểm toán" (`account-profile.service.ts:238`).
- **L-67.** Stellar: chú thích nói "bắt buộc liên kết" (`account-profile.service.ts:136-138`), nhưng schema và `normalizeEvmAddress` chỉ nhận địa chỉ EVM, nên không liên kết được địa chỉ Stellar nào.
- **L-68.** Ví liên kết chỉ có tác dụng nghiệp vụ với nhà đầu tư cá nhân: `findInvestorProfileByWallet` chỉ duyệt `INVESTOR_PROFILES` (`account-profile.service.ts:125-168`), dùng ở `trade.service.ts:298`. Với SELLER, câu "để app so với ví bạn kết nối khi đặt lệnh" không đúng, vì Người bán không đặt lệnh.


### 3.4. Giao dịch viên và Kiểm soát viên: phát hành, phê duyệt, lệnh

#### 3.4.1. `/` Bảng điều khiển

**Thông tin chung**
- **Vai:** Giao dịch viên, Kiểm soát viên. Menu: "Bảng điều khiển", phím E.
- **Chain:** không phụ thuộc chain. Toàn bộ số là hằng trong `lib/mock-data.ts`.
- **Trạng thái:** **Chỗ trống**. Giao diện chạy được nhưng 100% số liệu mẫu tĩnh. Không có marker hay mã task.
- **Nghiệp vụ:** Tổng quan danh mục điện gió.
- **Action khi mở:** không có. Component client đọc trực tiếp `MOCK_PROJECTS`, `MOCK_WIND_STATS`, `MOCK_GENERATION_SERIES` (`components/pages/dashboard.tsx:17`).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Tổng quan điện gió (tiêu đề), "Cập nhật hh:mm dd/mm/yyyy" | Tiêu đề, giờ trình duyệt | đồng hồ máy khách | Hiển thị |
| Phát hành WPT (nút) | Liên kết | `href="/mint"` | Dẫn sang màn dữ liệu thử, không phải màn Lập lệnh |
| WPT đã phát hành | Tổng cung | `MOCK_WIND_STATS.wptIssued` = 335.000 | Hiển thị (số mẫu) |
| Nhà đầu tư whitelisted | Số ví đã KYC | mock = 128 | Hiển thị |
| Sản lượng luỹ kế | MWh | mock | Hiển thị |
| Lợi tức đã chia | tỷ VND, số kỳ | mock | Hiển thị |
| Sản lượng & lợi tức theo kỳ (biểu đồ, nhãn "6 kỳ gần nhất") | Sản lượng (MWh) và lợi tức (tỷ VND) | `MOCK_GENERATION_SERIES` | Hiển thị |
| Phân bổ WPT theo dự án (nhãn "Tổng cung") | Tỷ lệ % WPT từng dự án | `MOCK_PROJECTS[].wptIssued` | Hiển thị |
| Thẻ dự án: Công suất đặt, Sản lượng luỹ kế, Hệ số công suất | Thông số tổ máy | mock | Hiển thị |


**Lệch** (tra mã ở Phụ lục C)

- **L-69.** Breadcrumb ghi "Tổng quan điện gió" (`app/(ops)/page.tsx:6`), không khớp nhãn menu "Bảng điều khiển".
- **L-26.** Nút "Phát hành WPT" dẫn tới `/mint` (`dashboard.tsx:62-68`). Từ FE-22, phát hành chính thức là `/draft` kèm Kiểm soát viên duyệt. Kiểm soát viên cũng thấy nút này.
- **L-70.** Số mẫu (335.000 WPT, 3 dự án) không khớp dữ liệu thật: trần 20.000.000 WPT trong `token-parameters.json`, chỉ 1 dự án "Dự án điện gió An Viên" (`lib/store/seed-data.ts:115`).


#### 3.4.2. `/draft` Lập lệnh

**Thông tin chung**
- **Vai:** chỉ Giao dịch viên (cổng `ops:draft:read`). Quyền thao tác thật là `order:draft`, kiểm trong service.
- **Menu:** "Lập lệnh", phím L. Có badge "số việc chờ" = số yêu cầu PENDING do chính mình lập (`S:675`).
- **Chain:** đọc theo chain đang chọn. Dự án chỉ có trên mock và hardhat-local, cộng evm nếu bật cờ. Luật R6 áp cho ví đích Mint.
- **Trạng thái:** **Dùng được**.
- **Nghiệp vụ:** Phát hành và huỷ token (người lập trong mô hình lập duyệt Mint/Burn).
- **Action khi mở:**
  - `getDraftStatsAction(chain)`
  - `listTokenRequestsAction({chain, mine:true, type:'MINT'|'BURN', limit:50})`
  - Khi gõ ký hiệu token (chờ 300 ms): `GET /api/token-info` gọi `getTokenInfo`
- **Action khi tương tác:**
  - Mỗi lần nội dung đổi: `previewTokenRequestAction`
  - Bấm gửi: `createTokenRequestAction`

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Yêu cầu tạo token đang chờ / Yêu cầu huỷ token đang chờ | Số yêu cầu PENDING của chính mình, theo loại | `getDraftStats` > `TokenRequest` đếm theo `status=PENDING, makerId, type, chain` (`S:790`) | Theo dõi việc đã gửi |
| Thẻ "Tạo token" / "Huỷ token" | 2 form cùng khuôn | | |
| Mã hoặc ký hiệu token | Ký hiệu, tự viết hoa, mẫu "WPT" | tra `Project` theo `(tokenSymbol, chain)` | Chọn token; chỉ tra được theo ký hiệu |
| Khối "Thông tin token": Dự án | Tên dự án | `Project.name` | Đối chiếu |
| Hợp đồng | Địa chỉ hợp đồng | `Project.contractAddress`, trống thì hiện "chưa ghi trong bảng dự án" | Đối chiếu |
| Trần phát hành | Trần | `Project.totalSupply` | Giới hạn Mint |
| Số còn được phát hành | Trần trừ tổng cung, không âm | `I:115` `remainingIssuanceCap` | Điều kiện Mint |
| Tổng cung hiện tại | Tổng cung | `ledger.tokenInfo().totalSupply` (on-chain) | |
| Số chưa phân phối | WPT còn trong ví SPV | `ledger.balanceOf(spvWallet)` | Điều kiện Burn |
| Số đang lưu hành | Tổng cung trừ chưa phân phối | `readSupplyMetrics` (`I:145`) | Điều kiện Burn toàn bộ |
| Mã người bán | Mã người bán | hằng `SAMPLE_ACCOUNTS.seller` = NB001 (`S:778`) | Hiển thị |
| Ví thanh toán | Ví SPV trên chuỗi; nếu chưa có thì "chưa có (chưa phát hành lần nào)" | `ledger.spvWallet()` | Ví đích Mint / ví bị đốt khi Burn |
| Phát hành lần đầu | Mốc phát hành đầu | `Project.issuedAt` | |
| Thử đọc lại thông tin token (nút) | Đọc lại khi lỗi | `/api/token-info` | |
| Ví đích (ví thanh toán SPV), chỉ thẻ Mint | Đã có ví SPV thì khoá ô và tự điền; chưa có thì nhập tay "0x…" | `spvWallet` | Vào `TokenRequest.wallet` |
| Nguồn huỷ, chỉ thẻ Burn | "Phần chưa phân phối" / "Toàn bộ nguồn cung" | `BURN_SOURCE_LABELS` (`components/maker-checker/gates.ts:87`) | Chọn toàn bộ thì tự điền số lượng = tổng cung, khoá ô, hiện cảnh báo |
| Tôi xác nhận huỷ toàn bộ nguồn cung (ô tích) | Xác nhận lại | trạng thái máy khách | Bắt buộc mới gửi được |
| Số lượng | Số nguyên lớn hơn 0 | `amountSchema` | `TokenRequest.amount` |
| Ngày hiệu lực | YYYY-MM-DD, tuỳ chọn | | `TokenRequest.effectiveDate` |
| Lý do | Bắt buộc, 1 đến 500 ký tự | | `TokenRequest.reason` |
| Chứng từ | Tuỳ chọn, tối đa 120 ký tự | | `documentRef` |
| Ghi chú | Tuỳ chọn, tối đa 1000 ký tự | | `note` |
| Kiểm tra trước khi lập | Danh sách điều kiện, mỗi dòng "Đạt" hoặc "Không đạt: chi tiết" | `previewTokenRequest` (`S:276`). Mint: quyền lập, Dự án tồn tại, Không vượt trần còn lại, Ví đích hợp lệ (whitelist, không đóng băng, đúng vault R6, đúng ví SPV), Không có yêu cầu Mint khác đang chờ (PENDING hoặc EXECUTING). Burn: quyền lập, Dự án tồn tại, Có ví SPV, Không vượt phần chưa phân phối, Không còn token lưu hành (chỉ khi chọn toàn bộ) | Khoá nút gửi nếu trượt; không ghi gì |
| Gửi yêu cầu tạo token / Gửi yêu cầu huỷ token (nút), dòng "Chưa gửi được: ..." | Lập yêu cầu | `createTokenRequest` (`S:305`): `authorize('order:draft')` ghi AuditLog ALLOWED/DENIED; đánh giá lại điều kiện; ghi `TokenRequest` PENDING; AuditLog `order:draft` SUCCESS/FAILURE | Chưa đổi gì trên chuỗi |
| Bảng "Yêu cầu đã lập" (2 bảng con: tạo / huỷ) | Yêu cầu của chính mình, mới nhất trước, tối đa 50 | `listTokenRequests` với `mine` | Không có liên kết sang chi tiết |
| Cột bảng: Mã yêu cầu (8 ký tự), Thời điểm lập, Token (chain), Số lượng, Nguồn (chỉ khi có Burn), Người lập, Lý do, Trạng thái, Kết quả | | các cột `TokenRequest` | "Kết quả" theo trạng thái: lý do từ chối kèm người duyệt; lý do thất bại; "Đã gửi tx..., chờ kết cục"; người duyệt kèm tx |
| Badge trạng thái | PENDING = Chờ duyệt; EXECUTING = Đang xử lý; COMPLETED = Hoàn tất; REJECTED = Từ chối; FAILED = Thất bại | `STATUS_LABELS` (`gates.ts:17`) | Chỉ đi một chiều: PENDING sang EXECUTING hoặc REJECTED; EXECUTING sang COMPLETED hoặc FAILED |


**Lệch** (tra mã ở Phụ lục C)

- **L-11.** **Ngày hiệu lực chỉ được lưu, không ràng buộc.** Lúc duyệt hệ thống thực hiện ngay, không so ngày (`S:350`, không có chỗ dùng nào khác).
- **L-12.** **Yêu cầu Mint kẹt chặn mọi Mint mới.** Một yêu cầu Mint kẹt ở EXECUTING (đã gửi tx nhưng chưa biết kết cục, `S:524-549`) làm điều kiện "Không có yêu cầu Mint khác đang chờ" trượt vĩnh viễn (`S:179-199`). Không có màn hay action nào để đối soát hoặc đóng yêu cầu kẹt.
- **L-71.** **Vault không hiện trên màn.** Khi chưa có ví SPV, ô ví đích bắt nhập tay, nhưng màn không hiện địa chỉ vault mà R6 bắt buộc. Người dùng chỉ thấy địa chỉ vault trong câu lỗi của khối kiểm tra (`draft.tsx:395-413`).
- **L-72.** **Nhãn "Mã hoặc ký hiệu token" gây hiểu nhầm.** Hệ thống chỉ tra theo `tokenSymbol` (`lib/bank/schemas.ts` `tokenInfoQuerySchema`).
- **L-73.** **"Mã người bán" là hằng NB001**, không đọc từ dữ liệu dự án (`S:729-732`).
- **L-01.** **Mỗi lần tải danh sách ghi một dòng AuditLog ALLOWED.** `listTokenRequests` dùng `authorize`, trái với chú thích ở `S:707-709` ("phép đọc dùng assertCan, không ghi sổ") (`S:659`).


#### 3.4.3. `/approvals` Phê duyệt lệnh

**Thông tin chung**
- **Vai:** chỉ Kiểm soát viên (cổng `ops:approve:read`). Menu nhóm "Kiểm soát", nhãn "Phê duyệt lệnh", phím P.
- **Badge số chờ:** số yêu cầu PENDING do người khác lập (`S:685`).
- **Chain:** chỉ thấy yêu cầu của chain đang chọn.
- **Trạng thái:** **Dùng được**.
- **Nghiệp vụ:** Phát hành và huỷ token (người duyệt).
- **Action khi mở:**
  - `getApprovalStatsAction(chain)`
  - `listTokenRequestsAction({chain, type, status, limit:200})` cho mỗi hàng chờ; gọi lại khi đổi bộ lọc trạng thái

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Đang chờ duyệt | PENDING do người khác lập | `countPendingWork` (`S:675`) | Bằng số trên menu |
| Đã duyệt hôm nay | Đã quyết duyệt từ 00:00 giờ VN, gồm EXECUTING, COMPLETED, FAILED | `TokenRequest.decidedAt >= startOfVietnamDay` (`S:835`) | Không phân biệt người duyệt |
| Đã từ chối hôm nay | REJECTED từ 00:00 giờ VN | như trên | |
| Hàng chờ tạo token / Hàng chờ huỷ token | 2 bảng theo loại | `listTokenRequests` (`type` = MINT/BURN) | |
| Tìm kiếm | Lọc chữ trên các dòng đã tải: mã, người lập, lý do, token, chứng từ | chỉ lọc ở máy khách | Không gửi lên máy chủ |
| Trạng thái (bộ lọc) | Mặc định "Chờ duyệt"; có "Tất cả trạng thái" và đủ 5 trạng thái | gửi lên máy chủ | |
| Dòng báo "Đang hiện 200 yêu cầu mới nhất..." | Báo chạm ngưỡng | `QUEUE_LIMIT` = 200 | Không có phân trang |
| Bảng: cùng cột với màn /draft; "Mã yêu cầu" là liên kết `/approvals/<id>` | | `components/maker-checker/request-table.tsx` | Mở chi tiết để quyết |


**Lệch** (tra mã ở Phụ lục C)

- **L-74.** Thẻ số liệu chỉ đếm theo chain đang chọn.
- **L-01.** Tải danh sách cũng ghi AuditLog ALLOWED, giống màn /draft (`S:659`).


#### 3.4.4. `/approvals/[id]` Chi tiết yêu cầu

**Thông tin chung**
- **Vai:** Kiểm soát viên. Không có trong menu; mở từ liên kết trong hàng chờ.
- **Chain:** yêu cầu khác chain đang chọn thì báo lỗi "thuộc chain X, không phải chain đang chọn Y" (`S:1191`).
- **Trạng thái:** **Dùng được**.
- **Nghiệp vụ:** Phát hành và huỷ token (duyệt, từ chối, đối soát yêu cầu đang thực hiện).
- **Action khi mở:** `getTokenRequestDetailAction({requestId, chain})`. Một action (đo lại ở HF-05, vai Kiểm soát viên; vai Giao dịch viên gặp màn chặn quyền, 0 action).
- **Action khi tương tác:** `approveTokenRequestAction`, `rejectTokenRequestAction`, `reconcileTokenRequestAction` (HF-05, chỉ khi bấm "Đối soát"). Sau mỗi thao tác thì đọc lại toàn bộ.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Chi tiết yêu cầu, mã UUID, "Về danh sách" | | URL | |
| Khối "Hành động", badge trạng thái | 5 trạng thái như ở /draft | `TokenRequest.status` | |
| Hộp lý do khoá nút | Yêu cầu không còn PENDING: "Yêu cầu đang ở trạng thái ..."; người xem là người lập: "Bạn (...) đã lập yêu cầu này nên không được duyệt hay từ chối nó" | `selfApprovalReason` (`S:1209`): so `makerId` với mã người đang xem | Luật lập duyệt: người lập không tự duyệt, không tự từ chối |
| Lý do từ chối | Bắt buộc khi từ chối, 1 đến 500 ký tự | | `TokenRequest.rejectReason` |
| Chấp nhận (nút) | Duyệt | `approveTokenRequest` (`S:418`), chi tiết bên dưới bảng | |
| Từ chối (nút) | Từ chối | `rejectTokenRequest` (`S:831`): `authorize('order:approve')`; chặn tự từ chối; PENDING sang REJECTED; AuditLog SUCCESS. Thiếu lý do thì ghi AuditLog FAILURE | Không tác động chuỗi |
| Đối soát (nút, HF-05) | Chốt yêu cầu đang thực hiện theo biên nhận thật của giao dịch đã gửi | Chỉ hiện khi yêu cầu EXECUTING, có mã giao dịch, và vai có quyền duyệt: cờ `canReconcile` tính ở máy chủ trong cùng lần đọc chi tiết (`S:1213`), không thêm action khi mở. Bấm thì gọi `reconcileTokenRequest` (`S:743`), chi tiết bên dưới bảng | Không gửi giao dịch mới |
| Thông báo sau thao tác | Xanh: "Đã chấp nhận. Yêu cầu đã thực hiện xong trên chuỗi." (chỉ khi COMPLETED). Vàng (HF-05): "Đã gửi lên chuỗi nhưng chưa có xác nhận sau N giây. Yêu cầu giữ trạng thái Đang thực hiện; bấm Đối soát sau ít phút." (N = thời gian chờ biên nhận của chain: 30 giây hardhat, mock; 90 giây Sepolia). Đỏ: lỗi, hoặc đối soát thấy giao dịch thất bại | `outcomeFeedback` (`components/pages/approval-detail.tsx:60`) theo `status` của yêu cầu trả về | |
| Khối "Thông tin token" | Như ở /draft, số đọc tại thời điểm xem | `readTokenInfo` | |
| Khối "Nội dung yêu cầu": Loại, Token, Số lượng, Nguồn, Ví tác động, Lý do, Chứng từ, Ngày hiệu lực, Ghi chú, Người lập, Thời điểm lập, Mã giao dịch | | các cột `TokenRequest` | |
| Nhật ký | Mốc thời gian, nhãn ("Lập yêu cầu, chờ duyệt"; "Từ chối"; "Chấp nhận, hoàn tất trên chuỗi"; "Chấp nhận, thất bại khi thực hiện"; "Chấp nhận, đang xử lý trên chuỗi"), người, chi tiết | `timelineOf` (`S:1136`), dựng từ các mốc lưu trên chính yêu cầu | Không đọc AuditLog |

**Các bước khi bấm "Chấp nhận"** (`approveTokenRequest`, `S:418`):
1. `authorize('order:approve')`, ghi AuditLog ALLOWED.
2. Chặn tự duyệt. Nếu người duyệt là người lập: AuditLog DENIED, lỗi `SELF_APPROVAL`.
3. Kiểm lại toàn bộ điều kiện và kiểm ví tác động không đổi. Nếu trượt: AuditLog FAILURE, yêu cầu giữ nguyên PENDING.
4. Chiếm quyền thực hiện: PENDING sang EXECUTING bằng câu `UPDATE` có điều kiện.
5. Thực hiện trên chuỗi:
   - Mint: `executeIssuance` (`I:209`), gọi `mintInitialSupply` (lần đầu) hoặc `mint` (các lần sau) vào ví SPV/vault.
   - Burn: `executeBurn` (`S:578`), `ledger.burn(spv)`.
6. Ghi sổ giao dịch: `Txn` lưu PENDING trước khi chờ biên nhận, gắn `txHash` vào `TokenRequest`, sau đó cập nhật trạng thái `Txn` theo biên nhận.
7. Chốt theo biên nhận (HF-05):
   - **CONFIRMED:** đọc tổng cung (Mint) rồi gọi thao tác lưu trữ `finalizeTokenRequest` (`finalizeConfirmed`, `S:624`): trong MỘT transaction, EXECUTING sang COMPLETED, ghi `Project.issuedAt` nếu chưa có (Mint), ghi AuditLog `token:mint` hoặc `token:burn` SUCCESS và `order:approve` SUCCESS. Đọc tổng cung lỗi hoặc transaction lỗi: không ghi gì, yêu cầu giữ EXECUTING, màn báo "đã xác nhận trên chuỗi, chưa chốt được, bấm Đối soát lại". Biên nhận CONFIRMED không bao giờ dẫn tới FAILED.
   - **FAILED:** EXECUTING sang FAILED, AuditLog `token:mint` hoặc `token:burn` FAILURE.
   - **PENDING** (hết thời gian chờ biên nhận: 30 giây hardhat, 90 giây Sepolia): yêu cầu giữ EXECUTING kèm mã giao dịch; không ghi `issuedAt`, không ghi sổ SUCCESS cho thao tác token; AuditLog `order:approve` SUCCESS với chi tiết "đã gửi, chưa có biên nhận, cần đối soát". Màn báo vàng.
   - Chờ biên nhận ném lỗi sau khi đã gửi: giữ EXECUTING (như trước HF-05), AuditLog `order:approve` FAILURE "cần đối soát".

**Các bước khi bấm "Đối soát"** (`reconcileTokenRequest`, `S:743`, HF-05):
1. `authorize('order:approve')`. Yêu cầu phải EXECUTING, có `txHash`, đúng chain đang chọn; không thì báo lỗi, không ghi gì.
2. Đọc biên nhận MỘT lần, chờ tối đa 1 giây (cùng mức `RECHECK_RECEIPT_TIMEOUT_MS` của luồng chia). Đọc lỗi thì coi như còn chờ.
3. Cập nhật `Txn` theo `(chain, txHash)` (`syncTxnFromReceipt`, `S:708`): có dòng thì sang CONFIRMED hoặc FAILED (PENDING giữ nguyên); không có dòng thì tạo một dòng, không tạo trùng.
4. CONFIRMED: chốt như bước 7 của "Chấp nhận". Lượt khác đã chốt trước thì báo "đã được chốt ở lượt khác", không ghi thêm.
5. FAILED: trong MỘT transaction, EXECUTING sang FAILED kèm lý do và AuditLog `order:approve` FAILURE.
6. PENDING: không đổi gì, màn báo vàng "Chưa có biên nhận cho giao dịch...".
7. Không bao giờ gửi giao dịch mới.

Yêu cầu EXECUTING **không có** mã giao dịch (tiến trình chết trước khi gắn mã): không có nút Đối soát, như trước HF-05; để task xử lý yêu cầu kẹt.


**Lệch** (tra mã ở Phụ lục C)

- **L-15.** **Không có hộp xác nhận trước khi Chấp nhận.** Bấm một lần là thực hiện ngay trên chuỗi.
- **L-15.** **Yêu cầu EXECUTING kẹt không có thao tác xử lý.** Nhật ký ghi "cần đối soát" nhưng không có nút nào.


#### 3.4.5. `/transactions` Giao dịch

**Thông tin chung**
- **Vai:** Giao dịch viên và Kiểm soát viên (`ops:read`, `order:read`, `order:read:all`). Menu "Giao dịch", phím G.
- **Can thiệp:** chỉ vai có `order:execute`, tức Giao dịch viên. Kiểm soát viên thấy dòng "Vai trò Kiểm soát viên chỉ có quyền xem...".
- **Chain:** lọc theo chain đang chọn. Can thiệp lệnh EXECUTING mất mã tx chỉ an toàn trên chain có khoá chống trùng (mock, hoặc chain có `OrderSettlement`) (`lib/bank/purchase.service.ts:1378`).
- **Trạng thái:** **Dùng được một phần**. Danh sách dùng được; một nhánh can thiệp không có nút (xem phần lệch).
- **Nghiệp vụ:** Giao dịch và can thiệp lệnh kẹt.
- **Action khi mở:** `listOpsOrdersAction({chain, q, investorWallet, side, status, fromDate, toDate, page, pageSize:12})` (`lib/bank/ops-transactions.service.ts:81`).
- **Action khi tương tác:** `executeOrderAction({chain, orderId})`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Tổng cung / Chưa phân phối / Đang lưu hành | Số liệu nguồn cung (WPT) | `readSupplyMetrics(chain, projects[0])` | Cập nhật sau khi khớp lệnh |
| Tìm mã lệnh hoặc nhà đầu tư… | Tìm một phần mã lệnh hoặc ví (chờ 300 ms) | lọc `search` ở cổng lưu trữ | |
| Tất cả nhà đầu tư (ô chọn) | Các ví đã từng đặt lệnh | `listOrderInvestors({chain})` | |
| Mọi chiều | Mua / Bán | `ORDER_SIDES` | |
| Mọi trạng thái | 7 trạng thái lệnh: PLACED = Đã đặt; CHECKING = Đang kiểm tra; EXECUTING = Đang quyết toán; COMPLETED = Hoàn tất; REJECTED = Bị từ chối; FAILED = Thất bại; EXPIRED = Hết hạn | `components/trading/gates.ts:21` | |
| Từ ngày / Đến ngày | Khoảng ngày tạo lệnh, theo giờ VN | `orderCreatedRange` | |
| Cột: Mã lệnh (liên kết chi tiết), Nhà đầu tư, Chiều, WPT, VNDB, Bước hiện tại (nhãn bước kèm "Đã xong" / "Đang xử lý" / "Dừng tại đây" / "Chưa tới"), Trạng thái, Tạo lúc, Cập nhật | Bảng `PurchaseOrder` | `toOrderView` kèm `currentStepOf`. 5 bước: Tạo lệnh, Kiểm tra, Đối chiếu số dư, Quyết toán, Hoàn tất (`lib/bank/settlement-steps.ts`) | |
| Hành động (cột, chỉ khi có quyền) | CHECKING: nút "Tiếp tục quyết toán"; EXECUTING có tx: nút "Đối soát giao dịch"; EXECUTING không tx: chữ "Cần đối soát tay"; trạng thái khác: dấu gạch ngang | `interventionOf` (`ops-transactions.service.ts:64`) | Nút gọi `executeOrder` (`purchase.service.ts:1079`): `authorize('order:execute')`; CHECKING thì chạy lại kiểm tra rồi gửi tx (`Txn`); có tx thì chỉ hỏi biên nhận, không phát lại; AuditLog `order:intervene` |
| "Hiển thị a đến b / n bản ghi", "Trang trước" / "Trang sau", "x / y" | Phân trang, 12 dòng mỗi trang | `total`, `totalPages` | |


**Lệch** (tra mã ở Phụ lục C)

- **L-14.** **Thiếu nút cho lệnh EXECUTING mất mã tx.** Máy chủ đã hỗ trợ phục hồi trường hợp này qua `recoverExecutingWithoutTx`: tra `OrderSettled` trên chuỗi rồi chốt, hoặc đưa về CHECKING (`purchase.service.ts:1122,1442`). Giao diện lại chặn và chỉ hiện "Cần đối soát tay" (`ops-transactions.tsx:113,248-260`; `ops-transactions.service.ts:129-130`).
- **L-14.** **Lệnh kẹt ở PLACED không can thiệp được** (`INTERVENTION_ORDER_STATUSES` = CHECKING, EXECUTING).
- **L-75.** **Nguồn cung chỉ tính cho dự án đầu tiên của chain** (`ops-transactions.service.ts:117`).


#### 3.4.6. `/transactions/[id]` Chi tiết lệnh

**Thông tin chung**
- **Vai:** như /transactions. Không có trong menu.
- **Trạng thái:** **Dùng được**. Chỉ xem, không có nút can thiệp.
- **Nghiệp vụ:** Giao dịch.
- **Action khi mở:** `getOpsOrderDetailAction({chain, orderId})`: kiểm `ops:read`, rồi gọi `getOrderDetail` (`lib/bank/trade.service.ts:434`).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Lệnh mua/bán + mã 8 ký tự, badge trạng thái | | `PurchaseOrder` | |
| Thông tin lệnh: Mã lệnh, Chiều, Số lượng, Giá (VNDB), Giá trị, Ví, Thời điểm tạo, Cập nhật, Mã giao dịch ("chưa có"), Lý do ("không có") | | cột lệnh, `unitPriceOf` | |
| Tiến trình quyết toán: Bước 1 đến 5, trạng thái ("Xong", "Đang xử lý", "Chưa tới", "Dừng ở bước này"), mốc thời gian | | `toSettlementSteps` | |
| Quy tắc, Kết cục ("cả bốn bút toán đã ghi" / "không bút toán nào được ghi..." / "chưa có kết cục"), 4 bút toán Nhà đầu tư/Người bán WPT/VNDB | | `settlement` | |
| Nhật ký kiểm toán của lệnh: thời điểm, hành động, vai, kết quả, chi tiết | | AuditLog: 500 dòng mới nhất, lọc dòng có `detail` chứa mã lệnh | |
| Về danh sách giao dịch | | | |


**Lệch** (tra mã ở Phụ lục C)

- **L-40.** Nhật ký chỉ quét 500 dòng AuditLog mới nhất (`trade.service.ts:425,447`), nên lệnh cũ có thể mất nhật ký.
- **L-76.** Không có nút can thiệp ở màn chi tiết; can thiệp chỉ làm được ở danh sách.


#### 3.4.7. `/demo-payment` Nạp VNDB (trình diễn)

**Thông tin chung**
- **Vai:** chặn 2 lớp, kiểm cờ trước, quyền sau: cờ `ENABLE_DEMO_PAYMENT_MINT` (mặc định `true`, `env.ts:134`; `wrangler.json` và `docker-compose` đều `true`), rồi quyền `demo:mint-payment` (chỉ Giao dịch viên).
- **Menu:** mục được ghép vào cuối nhóm "Vận hành" khi qua cả 2 lớp (`components/layout/nav-config.ts:230-245`), nhãn "Nạp VNDB (trình diễn)", phím N.
- **Vai khác hoặc cờ tắt:** trang hiện "Chức năng nạp VNDB mô phỏng không khả dụng" (`app/(ops)/demo-payment/page.tsx:17`).
- **Chain:** `ledger.mintPayment` chạy trên mock, hardhat-local, evm.
- **Trạng thái:** **Dùng được** (chỉ cho trình diễn).
- **Nghiệp vụ:** Nạp tiền trình diễn.
- **Action khi mở:** `demoPaymentContextAction({chain})` (kiểm 2 lớp, không ghi sổ).
- **Action khi tương tác:** `mintDemoPaymentAction`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Hộp cảnh báo "chỉ dùng cho bản trình diễn", chuỗi đang dùng | | | |
| Ví đích, danh sách gợi ý ("Ví người bán" / "Đã nạp trước đó"), nút địa chỉ ví người bán | Ví nhận VNDB | `spvWallet` cùng các ví trong lịch sử | Chỉ nhận ví đã whitelist hoặc ví người bán (SPV) |
| Số VNDB | Số nguyên lớn hơn 0 | | |
| Gợi ý nhanh: "Nhà đầu tư mẫu: 500.000.000", "Ví người bán: 1.000.000.000" | Điền nhanh số tiền | `DEMO_PAYMENT_QUICK_AMOUNTS`, lọc bỏ mức vượt trần | |
| Tối đa một lần: X VNDB | Trần một lần nạp | SystemConfig `demo.payment_mint_max_vnd`; trống thì mặc định 1.000.000.000 | |
| Nạp VNDB (nút) | Phát hành VNDB | `mintDemoPayment`: `authorize` (DENIED nếu bị chặn); vượt trần hoặc ví không hợp lệ thì AuditLog FAILURE; `ledger.mintPayment`; `Txn` (`operation=payment-mint`) PENDING rồi cập nhật; AuditLog `demo:mint-payment`; đọc lại `paymentBalanceOf` | Tạo tiền để luồng mua chạy được |
| Lịch sử các lần nạp: Thời điểm, Ví đích, Số VNDB, Trạng thái, Vai trò | | 200 `Txn` mới nhất của chain, lọc `payment-mint` | |


**Lệch** (tra mã ở Phụ lục C)

- **L-28.** **Chú thích mặc định của cờ mâu thuẫn nhau.** `lib/rbac/permissions.ts:437` ghi cờ "mặc định tắt", nhưng thực tế mặc định bật (`env.ts:134`) và `demo-payment.service.ts:23` cũng ghi "mặc định bật".
- **L-77.** **Lịch sử có thể thiếu.** Lần nạp cũ hơn 200 giao dịch không hiện (`lib/bank/demo-payment.service.ts:178-180`).


#### 3.4.8. `/mint` Phát hành WPT (dữ liệu thử)

**Thông tin chung**
- **Vai:** Giao dịch viên và Kiểm soát viên vào được (`ops:read`). **Không có trong menu**, chỉ vào bằng URL hoặc nút "Phát hành WPT" ở Bảng điều khiển (`app/(ops)/layout.tsx:17-19`).
- **Quyền nút:** nút KYC cần `kyc:approve` và `investor:whitelist` (chỉ Giao dịch viên). Nút phát hành cần cờ `ENABLE_DEMO_TOKEN_MINT` (mặc định `false`, `lib/config/env.ts:143`) VÀ quyền `demo:mint-token` (kiểm cờ trước, quyền sau).
- **Chain:** phát hành trực tiếp chỉ chạy trên `mock`, chain khác bị từ chối và ghi AuditLog FAILURE (`lib/bank/mint.service.ts:175`). KYC/whitelist chạy trên mọi chain đã hiện thực.
- **Trạng thái:** **Dùng được một phần**. KYC/whitelist chạy được; phát hành bị tắt mặc định.
- **Nghiệp vụ:** KYC/whitelist và dữ liệu thử phát hành.
- **Action khi mở và khi đổi ví:** `listTransactionsAction({chain, limit:20})`; khi ví hợp lệ thì thêm `readBalanceAction`.
- **Action khi tương tác:** `onboardInvestorAction`, `mintAction` (gọi `mintToInvestorDirect`).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Hộp chú thích trỏ tới "Lập lệnh" | Phát hành chính thức nằm ở /draft | | |
| Ví nhà đầu tư | Địa chỉ 0x + 40 ký tự hex | | |
| Số lượng WPT | Số nguyên, mặc định 100 | | |
| Nút "1 KYC + Whitelist" (trên màn có dấu chấm giữa sau số 1) | KYC mock tự duyệt, rồi whitelist on-chain | `onboardInvestor`: KYC provider; `ledger.whitelist`; `Txn` (`operation=whitelist`); AuditLog `investor:whitelist` | Mở điều kiện nắm giữ WPT và nạp VNDB |
| Nút "2 Phát hành dữ liệu thử" (cùng dấu chấm giữa) | Mint thẳng vào ví nhà đầu tư | `mintToInvestorDirect`: chặn nếu ví chưa whitelist; `ledger.mint`; `Txn` PENDING rồi cập nhật trạng thái; AuditLog `token:mint` | Không qua lập duyệt |
| Trạng thái on-chain: Số dư WPT, Whitelist ("đã KYC" / "chưa KYC"), Đóng băng ("đang băng" / "bình thường") | | `ledger.balanceOf`, `isWhitelisted`, `isFrozen` | |
| Lịch sử giao dịch (chain): Thời điểm, Nghiệp vụ, Ví nhận, Số lượng, Trạng thái (CONFIRMED / FAILED / PENDING), Vai trò | 20 giao dịch mới nhất của mọi loại | bảng `Txn` | |


**Lệch** (tra mã ở Phụ lục C)

- **L-01.** Mỗi lần tải và mỗi lần gõ ví đều ghi AuditLog ALLOWED, vì `readBalance` và `listTransactions` dùng `authorize` (`mint.service.ts:266,286`).
- **L-78.** Cột Thời điểm chỉ hiện giờ, không có ngày (`components/pages/mint.tsx:321`).
- **L-79.** Đây là nơi duy nhất làm KYC/whitelist; trang `/kyc` là chỗ trống.


### 3.5. Giao dịch viên và Kiểm soát viên: vault và chia lợi nhuận

#### 3.5.1. `/vault` Vault thanh toán SPV

**Vai:** Giao dịch viên (TELLER) và Kiểm soát viên (CONTROLLER). Menu cho cả hai vai là "Vault thanh toán SPV" (phím tắt K), trong `components/layout/nav-config.ts:165` và `:185`. Cổng vào trang là `assertCan('vault:read')` ở `app/(ops)/vault/page.tsx:7`.

Quyền nằm trong `lib/rbac/permissions.ts`:
- `vault:read` thuộc READ_ONLY nên cả hai vai đều có (`:255`).
- `vault:configure` và `vault:reconcile` chỉ CONTROLLER có (`:344-345`).

**Chain** (đi theo chain đang chọn, qua `useSelectedChain`):
- **mock:** vault logic. `vaultStatus()` không bao giờ trả `null`. Sự kiện cấu hình, chốt kỳ và rút đọc từ bộ nhớ mô phỏng (`lib/ledger/mock.adapter.ts:913-1086`). Không có explorer nên mã giao dịch chỉ là chữ, không có link.
- **hardhat-local và evm (Sepolia):** đọc qua `lib/ledger/evm.adapter.ts`. Nếu address book không có `SpvPaymentVault` thì `vaultStatus` trả `null` (`:1184`).
  - Sự kiện (`PeriodClosed`, `LockModeChanged`, `FixedLockSet`, `PercentRateSet`, `PayoutWalletSet`, `Withdrawn`) quét từ `deployBlock` qua `scanLogs`. Mỗi đoạn quét dài `EVM_LOG_BLOCK_CHUNK` block, mặc định 10000 (`:260`).
  - Với evm, sự kiện đọc qua `RPC_EVM_LOGS`. Để trống thì dùng RPC công khai mặc định (`lib/chains/registry.ts:37`).
  - Thiếu `deployBlock` thì báo lỗi riêng cho từng phần lịch sử, trạng thái hiện tại vẫn hiện.
  - Chỉ Sepolia có link Etherscan.
- **stellar:** `vaultStatus` trả `null` (`lib/ledger/stellar.adapter.ts:175`). Màn hiện "Chain này chưa triển khai vault thanh toán SPV" và không có card nào khác.

**Trạng thái:** đã chạy đầu cuối (BE-13, SC-07). Màn này và các service vault/rút không có marker `@pending` hay `@blocked`.

**Nghiệp vụ:**
- Xem số dư và phần bị khoá của vault.
- Kiểm soát viên đặt chế độ khoá FIXED hoặc PERCENT và ví nhận tiền rút.
- Xem lịch sử cấu hình đọc từ sự kiện trên chuỗi.
- Xem lịch sử chốt kỳ.
- Đối soát lệnh rút và chốt lệnh `NEEDS_REVIEW`.

**Action khi mở:** tổng 3 server action, chạy nối tiếp. Mỗi action gọi `authorize()` nên ghi 1 dòng audit ALLOWED (`lib/bank/authorize.ts:35`).
1. `getVaultOverviewAction` > `getVaultOverview`.
2. Chỉ khi vault tồn tại thì mới mount thêm `getVaultConfigHistoryAction({page:1,pageSize:10})` và `listWithdrawReviewsAction`.

Trên stellar chỉ có action 1.

**Action khi thao tác:**

| Thao tác | Action gọi | Sau đó tải lại |
|---|---|---|
| Lưu cấu hình | `saveVaultConfigAction` | overview và lịch sử cấu hình |
| Đối soát | `reconcileWithdrawRequestsAction` | danh sách rút cần xem xét, overview, lịch sử cấu hình |
| Chốt lệnh rút | `resolveWithdrawRequestAction` | như Đối soát |
| Đổi trang lịch sử | `getVaultConfigHistoryAction` | |

##### Card "Trạng thái hiện tại"
Nguồn chung: `getVaultOverviewAction` > `vault.service.getVaultOverview` > `ledger.vaultStatus()`. Getter là của contract `SpvPaymentVault`, trừ khi ghi khác.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng để |
|---|---|---|---|
| Địa chỉ vault | Địa chỉ hợp đồng vault | address book (mock: địa chỉ mô phỏng) | Đối chiếu |
| Chế độ khoá | UNSET "Chưa cấu hình, khoá toàn bộ"; FIXED "Khoá số tiền cố định"; PERCENT "Khoá theo tỷ lệ kỳ" | `lockMode()` | Biết cách tính phần khoá |
| Số dư WPT | WPT vault đang giữ (chưa bán) | `ProjectToken.balanceOf(vault)` | Vault cũng được chia lợi nhuận |
| Số dư VNDB | VNDB trong vault | `VNDToken.balanceOf(vault)` | |
| Khoá cố định | Số khoá ở chế độ FIXED | `fixedLockAmount()` | Hiện ở mọi chế độ, kể cả khi không áp |
| Tỷ lệ đang áp | Tỷ lệ PERCENT hiện hành | `percentRateBps()` / 100 | |
| Tỷ lệ chờ áp | Tỷ lệ mới, áp ở lần chốt kỳ kế tiếp; không có thì "Không có" | `pendingPercentRateBps()` khi `hasPendingRate()` | |
| Thu ròng | Tiền bán WPT thuần | `netProceeds()` | Cơ sở khoá PERCENT trước kỳ đầu |
| Đang khoá | Phần không được rút | `lockedAmount()`: UNSET = toàn bộ số dư; FIXED = fixedLock; PERCENT = netProceeds nhân tỷ lệ trước kỳ đầu, `percentLocked` từ kỳ đầu | |
| Có thể rút | Số dư trừ phần khoá, thấp nhất 0 | `withdrawable()` | Hạn mức rút của Người bán |
| Kỳ gần nhất | Mã kỳ vault đã chốt | `lastPeriodRef()` | 0 = chưa qua kỳ nào |
| Đã chia kỳ trước | Số đã chia ở lần chốt gần nhất | `lastDistributedPrev()` | |
| Phần khoá theo kỳ | Số đã chia kỳ trước nhân tỷ lệ | `percentLocked()` | |
| Ví nhận tiền rút | Ví nhận khi rút; địa chỉ 0 hiện "Chưa cấu hình" | `payoutWallet()` | |
| Trạng thái rút | "Đang tạm dừng" hoặc "Đang hoạt động" | `paused()` | |

##### Card "Cấu hình khoá"
`components/pages/vault-status.tsx:52-157`

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng để |
|---|---|---|---|
| Câu giải thích | Chưa qua kỳ chia nào: tỷ lệ mới có hiệu lực ngay. Đã qua kỳ đầu: tỷ lệ mới chỉ ghi chờ | `status.lastPeriodRef > 0` | |
| "Chỉ Kiểm soát viên lưu được cấu hình; vai của bạn chỉ xem." | Vai TELLER thấy câu này | `config.canConfigure = can(role,'vault:configure')` | Teller thấy ô nhưng bị khoá, không có nút |
| "Vault đang có thao tác khác (lệnh rút đang dở / lần lưu cấu hình khác) từ ..." | Khoá vận hành của chain đang bị giữ | `VaultOperationLock` (kind, acquiredAt) | |
| Tỷ lệ khoá PERCENT (%) | Ô nhập tỷ lệ | Điền sẵn: UNSET dùng `vault.default_percent_bps` (mặc định 2000 = 20%); chế độ khác dùng tỷ lệ chờ, không có thì tỷ lệ đang áp; bằng 0 thì về mặc định | Lớn hơn 0, tối đa 100, tối đa 2 chữ số thập phân (`vault-config.ts:13`) |
| Số khoá cố định (VNDB, để trống được) | Có giá trị thì đích là FIXED, trống thì đích là PERCENT | Chỉ điền sẵn khi đang FIXED | Số nguyên lớn hơn 0 |
| Ví nhận tiền rút | Ô nhập ví | `status.payoutWallet` | Hợp lệ khi: 0x + 40 hex, khác địa chỉ 0, khác địa chỉ vault, đã whitelist (`vault.service.ts:252-295`) |
| Nút "Lưu cấu hình khoá" | Chỉ Kiểm soát viên thấy | `saveVaultConfigAction` > `saveVaultConfig` | Kiểm quyền `vault:configure`, kiểm dạng, lấy khoá CONFIG, đọc chuỗi, lập các bước rồi gửi lần lượt từng giao dịch |
| Kết quả: "Đã lưu cấu hình lên chuỗi." kèm danh sách bước | Mỗi bước: nhãn ("Đặt ví nhận tiền", "Đặt số khoá cố định", "Đặt tỷ lệ khoá", "Đổi chế độ khoá"), cũ sang mới, mã giao dịch | `planVaultConfig` (`vault-config.ts:87`) | |
| Kết quả: "Chuỗi đã đúng cấu hình này, không gửi giao dịch nào." | outcome NO_CHANGE | | |
| Lỗi | "Cấu hình khoá chưa hợp lệ." kèm lỗi từng ô; VAULT_BUSY; LEDGER: "Lưu cấu hình dừng ở bước ...: ... Đã xong: ... Ví nhận đã/chưa đổi. Lưu lại để gửi phần còn thiếu." | `vault.service.ts:344-356` | Khi lỗi LEDGER thì màn tải lại |

Thứ tự giao dịch khi lưu:
1. `setPayoutWallet`, nếu ví khác.
2. Đích FIXED: `setFixedLock` (nếu khác) rồi `setLockMode(FIXED)`.
3. Đích PERCENT: `setPercentRate` (nếu khác tỷ lệ chờ, không có thì tỷ lệ đang áp) rồi `setLockMode(PERCENT)`.

##### Card "Lịch sử cấu hình"
Nguồn: `getVaultConfigHistoryAction` > `getVaultConfigHistory` > `ledger.vaultConfigEvents()`, mới nhất trước, 10 dòng mỗi trang.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu |
|---|---|---|
| Block | Block của sự kiện | `blockNumber` của log |
| Thời điểm | Thời gian của block | `getBlock().timestamp` |
| Tham số | "Chế độ khoá", "Tỷ lệ khoá", "Tỷ lệ chờ áp", "Số khoá cố định", "Ví nhận tiền rút" | `LockModeChanged`, `PercentRateSet(pending=false/true)`, `FixedLockSet`, `PayoutWalletSet` |
| Giá trị cũ | Suy ra từ sự kiện trước đó cùng tham số. Ban đầu: UNSET, 0, "Chưa có" | `INITIAL_CONFIG_VALUE` (`vault.service.ts:370`) |
| Giá trị mới | Giá trị trong sự kiện | |
| Giao dịch | Mã giao dịch, có link explorer nếu chain có explorer | `txHash` |
| Người thao tác | "Kiểm soát viên (ví ký 0x...)", hoặc "Ngoài app" nếu bảng `Txn` không có giao dịch này | `store.findTxnByHash` > `Txn.actorRole`, `actorAddress` |
| Phân trang | "Trang x/y, N thay đổi", nút "Trang trước" / "Trang sau" | Chỉ hiện khi tổng số dòng lớn hơn 10 |

##### Card "Lệnh rút cần xem xét"
Nguồn: `listWithdrawReviewsAction` > `listWithdrawReviews`. Kiểm `vault:read`; lấy `WithdrawRequest` có status `NEEDS_REVIEW`, tối đa 20 lệnh.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng để |
|---|---|---|---|
| Nút "Đối soát lệnh rút" | Hai vai đều bấm được | `reconcileWithdrawRequests`: lệnh `SENT` thì chốt theo biên nhận; lệnh `SENDING` quá thời gian chờ biên nhận thì chuyển `NEEDS_REVIEW` | Kết quả: "Đã đối soát các lệnh rút chưa kết thúc." |
| Dòng lệnh | Mã 8 ký tự: số VNDB tới ví, tạo lúc ... | `WithdrawRequest.id`, `amount`, `payoutWallet`, `createdAt` | |
| Lý do | Vì sao lệnh cần xem xét | `WithdrawRequest.reason` | |
| "Sự kiện Withdrawn ứng viên (chỉ để xem, không chứng minh thuộc lệnh này)" | Các tx kèm block | `ledger.findVaultWithdrawals` lọc từ `claimedBlock`, đúng ví, đúng số, đúng ví ký | Chỉ để tham khảo |
| Ô "Mã giao dịch 0x..." và nút "Xác nhận hoàn tất" | Chỉ Kiểm soát viên thấy (`canResolveWithdrawals`) | `resolveWithdrawRequest(outcome=COMPLETED)`. Điều kiện: mã dạng 0x + 64 hex, chưa gán cho lệnh khác, biên nhận CONFIRMED và có `Withdrawn` khớp ví và số | Chuyển COMPLETED, thêm `Txn` nếu chưa có, nhả khoá vận hành |
| Ô "Lý do, ví dụ đã kiểm explorer" và nút "Đánh dấu thất bại" | Chỉ Kiểm soát viên thấy | `resolveWithdrawRequest(outcome=FAILED)`, bắt buộc có lý do | Chuyển FAILED, nhả khoá |
| Thông báo | "Lệnh rút xxxxxxxx đã chốt: hoàn tất/thất bại." hoặc câu lỗi | | |

Trạng thái lệnh rút (`vault.store.port.ts:64`): SENDING, SENT, COMPLETED, FAILED, NEEDS_REVIEW. Màn chỉ hiện NEEDS_REVIEW.

##### Card "Lịch sử chốt kỳ (10 lần gần nhất)"
Nguồn: overview > `ledger.vaultPeriodCloses(10)`, sự kiện `PeriodClosed`. Lỗi đọc hiện riêng trong card (`historyError`).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu |
|---|---|---|
| Kỳ | periodRef | `PeriodClosed.periodRef` |
| Đã chia kỳ trước | Số kỳ chia đã đẩy vào vault | `distributedPrev` |
| Tỷ lệ | Tỷ lệ áp lúc chốt (đã gồm tỷ lệ chờ) | `rateBps` |
| Phần khoá | Phần khoá chốt cho kỳ | `percentLocked` |
| Người đặt | Ví ký gọi `closePeriod` | `operator` |
| Thời điểm | | timestamp của block |
| Giao dịch | | `txHash` |


**Lệch** (tra mã ở Phụ lục C)

- **L-80.** Tên quyền đúng là `vault:configure`, không có `vault:config`; tài liệu nào ghi `vault:config` là ghi sai (`permissions.ts:212`).
- **L-16.** Mở màn ghi 3 dòng audit ALLOWED và gọi 3 action nối tiếp. Màn /distribution đã gom về một action (HF-01), màn này chưa (`vault-status.tsx:384`, `:313`, `:178`).
- **L-17.** `closePeriod` áp tỷ lệ chờ mà không phát `PercentRateSet` (`SpvPaymentVault.sol:153-157`; mock tương tự ở `mock.adapter.ts:948`). Vì vậy "Lịch sử cấu hình" không có dòng "Tỷ lệ khoá" cho lần áp này; giá trị cũ của lần đặt sau suy theo sự kiện PERCENT_RATE trước đó.
- **L-18.** Giao dịch viên bấm được "Đối soát lệnh rút" (quyền `vault:read` hoặc `vault:withdraw`). Dòng audit chuyển `NEEDS_REVIEW` khi đó ghi action `vault:reconcile` dưới vai TELLER (`withdraw.service.ts:409`, `:428`), dù TELLER không có quyền `vault:reconcile`.
- **L-81.** Giao dịch viên thấy toàn bộ form cấu hình nhưng bị khoá kèm câu giải thích. Nút lưu ẩn (`vault-status.tsx:106`, `:131`).
- **L-82.** "Kỳ gần nhất" được định dạng như số tiền, có dấu chấm nghìn (`vault-status.tsx:437`). Cột "Kỳ" ở lịch sử chốt kỳ thì hiện số thô.
- **L-83.** "Khoá cố định" vẫn hiện số cũ khi đang ở chế độ PERCENT, dễ hiểu nhầm là đang áp (`:428`).
- **L-84.** Card "Lệnh rút cần xem xét" không tải lại khi lưu cấu hình. Nó chỉ tải lại khi chính nó thao tác (`:458-463`).


#### 3.5.2. `/distribution` Chia lợi nhuận

Menu Kiểm soát viên: "Chia lợi nhuận". Menu Giao dịch viên: "Chia lợi nhuận (chỉ xem)".

**Vai:**
- Menu theo vai: TELLER thấy "Chia lợi nhuận (chỉ xem)" (`nav-config.ts:158-163`), CONTROLLER thấy "Chia lợi nhuận" (`:184`), cùng phím tắt C.
- Cổng trang là `assertCan('reconcile:read')` (`app/(ops)/distribution/page.tsx:8`). Không có quyền tên `distribution:read`; các hàm đọc đều kiểm `reconcile:read`, thuộc READ_ONLY nên cả hai vai có.
- Ghi (duyệt, duyệt lại, tiếp tục) cần `distribution:approve`, chỉ CONTROLLER có (`permissions.ts:90`, `:347`).
- TELLER còn `distribution:snapshot` và `distribution:execute`, nhưng không server action nào dùng chúng (`actions/distribution.ts:23-26`).

**Chain:** được hỗ trợ khi `vaultStatus() !== null`, tức mock, và hardhat-local/evm có SpvPaymentVault.
- Nguồn quỹ trên EVM: `VNDToken.balanceOf(ProfitDistributor)`, `ProfitDistributor.totalReserved()`, `unallocatedBalance()` (`evm.adapter.ts:1067-1079`). Mock dùng `profitPool`, `totalReserved`, `unallocated(s)`.
- Stellar: `supported=false`. Màn hiện card "Chain "stellar" không có vault thanh toán nên không hỗ trợ luồng chia đã duyệt."; lịch sử kỳ và lịch chạy vẫn hiện.
- Chốt kỳ vault trên EVM đối soát sự kiện `PeriodClosed` qua RPC log. Nếu RPC log trễ thì đọc từ biên nhận của `vaultCloseTxHash` (HF-04, `evm.adapter.ts:1273`).

**Trạng thái:** đã chạy đầu cuối (FE-08). Marker liên quan:
- `@pending FE-09` ở `getDistributionPeriodAction` (`actions/distribution.ts:76`). Màn không gọi action này; nó dành cho màn theo dõi kỳ.
- `@pending IN-02` ở `decideCycle` của keeper (`distribution-trigger.service.ts:302`). Hiện keeper phát hiện tiền mới bằng cách hỏi định kỳ; IN-02 sẽ đổi sang sự kiện `Transfer` qua Indexer.
- Nợ QĐ-H: keeper chạy dưới vai mặc định bản demo.

**Nghiệp vụ:**
- Kiểm soát viên duyệt **tổng số** VNDB chưa phân bổ của kỳ, không duyệt danh sách hay tỷ lệ.
- Hệ thống giữ chỗ kỳ (mỗi chain tối đa một kỳ hoạt động), mở kỳ trên chuỗi, rồi so số thực tế:
  - Khớp: APPROVED, chốt kỳ vault (`closePeriod`), rồi chia lô (tối đa `max_batches_per_run` lô mỗi lượt).
  - Khác: AMOUNT_CHANGED, dừng chờ duyệt lại.

**Action khi mở:** đúng 1 action, `getDistributionPageAction({chain,page:1,pageSize:10,runLimit:20})`. Nó chạy song song ba phần: `getDistributionOverview`, `listDistributionPeriods`, `listDistributionRuns` (`distribution-approval.service.ts:796`). Cả ba dùng `assertCan`, nên đọc không ghi audit.

**Action khi thao tác:**
- `approveDistributionAction`, `reapproveDistributionAction`, `continueDistributionAction`. Sau mỗi action, màn gọi lại `getDistributionPageAction`.
- Đổi trang lịch sử từ trang 2 trở đi: `listDistributionPeriodsAction`.
- "Xem hồ sơ" và đổi trang hồ sơ: `listDistributionPayoutsAction`.

**Tham số SystemConfig** (mặc định ở `lib/config/issue-terms.ts:159-231`, đọc ở `lib/store/config-values.ts`):

| Khóa | Mặc định | Ghi chú |
|---|---|---|
| `distribution.min_new_balance` | 1000 | Ngưỡng tối thiểu |
| `distribution.batch_size` | 50 | Tối đa 500 |
| `distribution.max_batches_per_run` | 5 | Tối đa 100 |
| `distribution.stuck_after_runs` | 3 | |
| `distribution.dust_wallet` | không có | Chỉ ghi nhận, không chuyển tiền |
| `distribution.last_settled_balance` | | Mốc hiển thị |

##### Card "Quỹ chia"
Ẩn khi chain không hỗ trợ. Nguồn: overview > `getDistributionOverview`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng để |
|---|---|---|---|
| Số dư quỹ | Tổng VNDB trong quỹ chia | `ledger.profitPoolBalance()` | Đối chiếu với dự trữ |
| Tổng dự trữ các kỳ | Phần còn nợ của các kỳ chưa đóng | `ledger.reservedProfit()` | |
| Chưa phân bổ | Tiền mới, chưa thuộc kỳ nào | `ledger.unallocatedProfit()` | Chính là số được duyệt |
| Ngưỡng tối thiểu | Dưới ngưỡng thì không duyệt được | `distribution.min_new_balance` | |

##### Card "Dự kiến (tham khảo)"

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng để |
|---|---|---|---|
| Câu "Theo số dư WPT hiện tại trên tổng cung X WPT ... Tổng dự kiến Y VNDB, phần dư làm tròn Z VNDB." | X = tổng cung, Y = tổng các phần, Z = chưa phân bổ trừ Y | `ledger.tokenInfo().totalSupply` | Chỉ tham khảo; quyền hưởng chốt theo ảnh chụp lúc mở kỳ |
| "Danh sách người nhận bị cắt nên không đầy đủ; nút duyệt bị khoá." | Khi danh sách chạm `MAX_RECIPIENT_SCAN` = 5000 ví | `collectRecipients().truncated` | |
| Ví | Ví nhận; ví vault thêm "(vault)" | `collectRecipients`: ví có lệnh mua COMPLETED trên chain, cộng ví đã có hồ sơ chia ở kỳ trước, cộng `spvWallet()` | |
| WPT hiện tại | Số dư hiện tại, không phải ảnh chụp | `ledger.balanceOf(wallet)` | |
| Phần dự kiến (VNDB) | Phần của ví | `shareOf(unallocated, balance, totalSupply)` = unallocated nhân balance chia totalSupply, làm tròn xuống (`distribution.service.ts:250`; `distribution-approval.service.ts:630`) | |

##### Card "Duyệt chia"
Chỉ hiện khi `viewerCanApprove`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng để |
|---|---|---|---|
| Danh sách "Lý do chưa duyệt được" | Các câu: "Đang có kỳ hoạt động "<key>"."; "Quỹ không có phần chưa phân bổ."; "Phần chưa phân bổ X VNDB dưới ngưỡng Y VNDB."; "Tổng cung WPT bằng 0."; "Danh sách người nhận chạm giới hạn quét 5000 ví, không đầy đủ."; với chain không hỗ trợ là câu chain không hỗ trợ | `approveBlockers` (`distribution-approval.service.ts:655-664`) | |
| Nút "Duyệt chia X VNDB" | X = Chưa phân bổ | Bị khoá khi đang chạy, khi còn lý do chặn, hoặc khi không có dữ liệu quỹ | Mở hộp xác nhận |

##### Hộp xác nhận
Dùng cho cả duyệt và duyệt lại, không dùng cho "Tiếp tục chia". `distribution-approval.tsx:48-50`, `:110-143`, `:504-514`.

| Tên trên màn | Nội dung |
|---|---|
| Tiêu đề | "Duyệt chia X VNDB", hoặc "Duyệt lại số thực tế X VNDB" |
| Mô tả, giữ nguyên văn theo QĐ-F | "Kiểm soát viên duyệt tổng số VNDB của kỳ; danh sách và tỷ lệ chỉ là dự kiến. Quyền hưởng cuối cùng chốt theo ảnh chụp trên chuỗi lúc mở kỳ." |
| Cảnh báo đỏ | "Lưu ý: bấm duyệt sẽ chuyển tiền." |
| Nút "Huỷ" | Đóng hộp |
| Nút "Duyệt và chia" | Duyệt: gọi `approveDistribution({expectedAmount})`. Duyệt lại: gọi `reapproveDistribution({periodId, amount: totalAmount})` |

Máy chủ kiểm lại khi duyệt (`approveDistribution`, `:276`):
- Số duyệt phải bằng `unallocatedProfit`; khác thì từ chối "Số trong quỹ đã đổi, xem lại rồi duyệt ...".
- Phải từ ngưỡng trở lên.
- Tổng cung phải lớn hơn 0.
- Không có kỳ hoạt động.
- Danh sách không bị cắt.

Đạt thì làm tiếp:
1. Giữ chỗ OPENING với mã kỳ `<chain>:<ngày UTC>-NN`.
2. Mở kỳ trên chuỗi (`openDistribution`).
3. So số thực tế với số duyệt (`decideApproval`): khớp thì APPROVED, khác thì AMOUNT_CHANGED.
4. Nếu APPROVED: chạy `reconcileChainPeriods`, rồi `runApprovedPeriod(MANUAL)`.

Thông báo kết quả = câu theo outcome cộng message của máy chủ:

| Outcome | Câu hiển thị |
|---|---|
| DISTRIBUTED | "Kỳ đã chia xong." |
| PARTIAL | "Đã chia một phần; bấm Tiếp tục chia để chia nốt." |
| AMOUNT_CHANGED | "Số trên chuỗi khác số đã duyệt; không chia gì, cần duyệt lại số thực tế." |
| VAULT_PENDING | "Đang chốt kỳ vault; chưa gửi lô nào." |
| VAULT_CONFLICT | "Kỳ vault CONFLICT, cần xử lý tay; không gửi lô nào." |
| PERIOD_ENDED | "Kỳ đã hết hạn nhận hoặc đã đóng trên chuỗi." |
| ALREADY_RUNNING | "Một lượt khác đang chạy cho kỳ này; tải lại sau." |

##### Card "Kỳ hoạt động"
Hiện khi chain có kỳ OPENING, OPEN hoặc DISTRIBUTING. Nguồn: `store.findActivePeriod`, bảng `DistributionPeriod`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu |
|---|---|---|
| Mã kỳ | | `periodKey` |
| Trạng thái | OPENING "Đang mở trên chuỗi"; OPEN "Đã mở"; DISTRIBUTING "Đang chia"; COMPLETED "Hoàn tất"; EXPIRED "Hết hạn nhận"; CLOSED "Đã đóng" | `status` |
| Trạng thái duyệt | APPROVED "Đã duyệt"; AMOUNT_CHANGED "Số đổi, chờ duyệt lại"; null "Chưa có kết luận duyệt" | `approvalStatus` |
| Số đã duyệt | Số được duyệt có hiệu lực (HF-05). Có `approvedAmount`: "X VNDB". `approvalStatus` rỗng mà có `expectedAmount` (kỳ đang so số): "Đang so số: X VNDB". AMOUNT_CHANGED: "Chưa có (lần duyệt X VNDB lệch số trên chuỗi)". Còn lại: "chưa có" | `approvedAmountLabel(period, 'cell')` (`components/pages/distribution-amount-label.ts`), đọc `approvedAmount`, `approvalStatus`, `expectedAmount` |
| Số thực tế trên chuỗi | Số kỳ lấy trên chuỗi; khi OPENING hiện "chưa đọc được" | `totalAmount` (ghi từ `findDistribution` lúc mở) |
| Chốt kỳ vault | PENDING "Đã giữ chỗ"; SENT "Đã gửi, đang đối soát"; DONE "Đã chốt"; CONFLICT "CONFLICT, cần xử lý tay"; null "Chưa chốt" | `vaultCloseStatus` |
| Đã trả | "X VNDB (n hồ sơ)" | tổng `DistributionPayout.amount` có status PAID |
| Còn phải chi / lỗi | outstanding / failed | outstanding = PENDING + SENT + FAILED |
| Ghi chú | Câu do máy chủ dựng | `describeActive().note` (`:528-579`) |
| "Đã gửi lên chuỗi, đang đối soát (mở kỳ tx) (chốt vault tx)." | Khi có giao dịch chưa có kết luận | `pendingOnChain`: OPENING có `openTxHash`, hoặc vault SENT, hoặc có hồ sơ SENT |
| Nút "Duyệt lại số thực tế X VNDB" | Chỉ Kiểm soát viên; khi nextAction REAPPROVE và status khác OPENING | Mở hộp xác nhận > `reapproveDistribution`: số phải bằng `distributionState(id).amount` và bằng `totalAmount`; ghi APPROVED, `approvedAmount`, `approvedBy`, `approvedAt`, `reapprovedFrom = expectedAmount`, rồi chia |
| Nút "Tiếp tục chia" | Chỉ Kiểm soát viên; khi nextAction CONTINUE; **không qua hộp xác nhận** | `continueDistribution`: phục hồi OPENING, kỳ phải APPROVED, `runApprovedPeriod(MANUAL)` |

Giá trị `nextAction` (`describeActive`):

| nextAction | Khi nào |
|---|---|
| CONTINUE | Kỳ OPENING. Hoặc APPROVED mà vault chưa DONE. Hoặc vault CONFLICT nhưng sự kiện chốt trên chuỗi khớp số (HF-04). Hoặc vault DONE mà còn hồ sơ phải chi hay chưa lập hồ sơ nào |
| REAPPROVE | `approvalStatus` là AMOUNT_CHANGED, hoặc null với kỳ không ở OPENING (kỳ cũ chưa từng duyệt) |
| MANUAL_REVIEW | Vault CONFLICT không khớp số. Không có nút; ghi chú "Kỳ vault CONFLICT: cần xử lý tay, khoá chia." |
| NONE | APPROVED, vault DONE, hết hồ sơ phải chi. Không có nút |

##### Card "Lịch sử kỳ chia"
Nguồn: `listDistributionPeriods`, 10 kỳ mỗi trang, theo chain.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu |
|---|---|---|
| Mã kỳ, Trạng thái | Như card Kỳ hoạt động | `periodKey`, `status` |
| Duyệt | Nhãn duyệt; null hiện "Chưa duyệt" | `approvalStatus` |
| Người duyệt | Mã tài khoản, không phải tên | `approvedBy` (`currentActorId`: `DEMO_ACTOR` hoặc tài khoản mẫu) |
| Thời điểm duyệt | | `approvedAt` |
| Số duyệt | Cùng luật với ô "Số đã duyệt" (HF-05); số không kèm đơn vị như cột "Số thực tế", trường hợp còn lại hiện "không có" | `approvedAmountLabel(period, 'table')` |
| Số thực tế | | `totalAmount` |
| Duyệt lại từ | Số cũ; không có hiện "không" | `reapprovedFrom` |
| Nguồn kích hoạt | "Kiểm soát viên" (MANUAL) hoặc "Keeper"; chưa có lượt nào hiện "chưa chạy" | `KeeperRun.triggerSource` của các dòng có tiền tố `<periodKey>#` |
| Nút "Xem hồ sơ" / "Ẩn hồ sơ" | Mở bảng hồ sơ trả từng ví | |
| Phân trang | "Trang x/y (N kỳ)" | `countPeriods` |

##### Bảng "Hồ sơ trả từng ví"
Nguồn: `listDistributionPayouts`, bảng `DistributionPayout`, 10 ví mỗi trang, gồm cả ví được chia 0.

| Tên trên màn | Nguồn dữ liệu |
|---|---|
| Ví | `investorWallet` |
| WPT tại ảnh chụp | `balanceAt` (`balanceOfAt(snapshotId)`) |
| Số chia (VNDB) | `amount`, tính bằng `shareOf(totalAmount, balanceAt, totalSupplyAt)` |
| Trạng thái | PENDING "Chờ gửi"; SENT "Đã gửi, đang đối soát"; PAID "Đã trả"; FAILED "Lỗi, chờ chia lại"; EXPIRED "Hết hạn" |
| Giao dịch | `txHash`; null hiện "không có" (hồ sơ phần 0 được ghi PAID mà không có giao dịch) |

##### Bảng "Lịch chạy (20 lượt gần nhất)"
Nguồn: `listDistributionRuns({limit:20})`, bảng `KeeperRun` với `jobName='distribution-trigger'`.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu |
|---|---|---|
| Kỳ | Mã kỳ tách từ `<periodKey>#<n>`; khoá `idle#...` hiện "vòng rỗng" | `KeeperRun.periodKey` |
| Vòng | Số vòng của kỳ; vòng rỗng là 0 | |
| Nguồn | "Kiểm soát viên" hoặc "Keeper" | `triggerSource` |
| Kết quả | Hiện mã thô RUNNING, SUCCESS, FAILED | `status` |
| Bắt đầu | | `startedAt` |
| Lỗi | Chỉ có khi FAILED (lõi chia trả lỗi, VAULT_CONFLICT, kỳ treo, quỹ hụt) | `error` |


**Lệch** (tra mã ở Phụ lục C)

- **L-19.** **Dự kiến tính trên phần chưa phân bổ, không phải trên kỳ đang chạy.** `shareOf(unallocated, ...)` ở `distribution-approval.service.ts:630`. Khi Chưa phân bổ bằng 0, hoặc khi đã có kỳ hoạt động vừa lấy hết tiền, mọi dòng "Phần dự kiến" hiện 0 trong khi kỳ vẫn đang chia. Card không có câu nào giải thích (`distribution-approval.tsx:440-464`).
- **L-85.** **"Phần dư làm tròn" thật ra gồm cả phần của ví ngoài danh sách.** Mẫu số là tổng cung hiện tại, còn danh sách lấy từ cơ sở dữ liệu, có thể sót ví chỉ nhận WPT bằng chuyển trực tiếp (`distribution.service.ts:331`).
- **L-21.** **Lịch chạy không lọc theo chain.** `listDistributionRuns({ limit: runLimit })` không có tham số chain (`distribution-approval.service.ts:805`, `distribution-trigger.service.ts:790`), nên bảng trộn lượt của mọi chain. Vòng rỗng (khoá `idle#...`) không mang chain.
- **L-21.** **Bảng lịch chạy che mất lý do của lượt thành công.**
   - Cột "Kết quả" hiện mã thô RUNNING/SUCCESS/FAILED, không dịch (`distribution-approval.tsx:338`).
   - Cột "Lỗi" chỉ có nội dung khi FAILED (`closeRun`, `distribution-trigger.service.ts:429-439`), nên các lượt SUCCESS mà không chia gì để trống: AWAITING_APPROVAL, VAULT_PENDING, BELOW_MIN_NEW_BALANCE.
   - Lượt AWAITING_APPROVAL gắn với một kỳ vẫn hiện "vòng rỗng", vì khoá là `idle#` (`:682`).
- **L-22.** **Kết quả PARTIAL và VAULT_PENDING hiện như lỗi.** Mọi outcome khác DISTRIBUTED đều được hiện với `role="alert"` màu đỏ (`distribution-approval.tsx:384`), kể cả hai trường hợp bình thường này.
- **L-23.** **"Tiếp tục chia" chuyển tiền mà không qua hộp xác nhận** (`:496`). Hộp xác nhận chỉ dùng cho duyệt và duyệt lại.
- **L-24.** **Giao dịch viên chỉ xem:** không có card "Duyệt chia", không có nút trong card Kỳ hoạt động. Nhưng:
   - Ghi chú vẫn bảo người xem làm việc họ không làm được, ví dụ "Tiếp tục để phục hồi.", "Duyệt lại số thực tế để chia." (`describeActive`, `:541`, `:555`).
   - Câu "nút duyệt bị khoá" vẫn hiện với Giao dịch viên (`distribution-approval.tsx:449`).
   - Màn không có câu nói rõ vai này chỉ xem; chỉ nhãn menu nói điều đó.
- **L-86.** **Cổng trang là `reconcile:read`, không có `distribution:read`** (`page.tsx:8`).
- **L-87.** **Chain không hỗ trợ:** Kiểm soát viên vẫn thấy card "Duyệt chia" với nút "Duyệt chia 0 VNDB" bị khoá (`:468-482`; khối này nằm ngoài nhánh `supported`).
- **L-25.** **nextAction NONE có thể làm kẹt chain.** Nếu một kỳ còn ở OPEN/DISTRIBUTING mà hết hồ sơ phải chi (ví dụ lượt trước dừng trước bước ghi COMPLETED), kỳ vẫn giữ chỗ hoạt động và chặn duyệt kỳ mới, nhưng màn không có nút nào (`distribution-approval.service.ts:576-578`).
- **L-25.** **MANUAL_REVIEW** (vault CONFLICT không khớp số): màn không có đường xử lý; phải xử lý tay ngoài app.
- **L-88.** **"Còn phải chi / lỗi" hiện 0 / 0 trước khi vault DONE**, vì hồ sơ chỉ được lập sau khi chốt vault, trong khi nextAction vẫn là CONTINUE.
- **L-89.** **"Người duyệt" là mã tài khoản thô**, không phải tên hay vai (`:298`). `approvedAt` của lần duyệt đầu là thời điểm giữ chỗ, không phải lúc so số xong.


### 3.6. Màn chỗ trống và màn tra cứu

#### 3.6.1. `/kyc` Nhà đầu tư và KYC

**Thông tin chung**
- **Vai:** Giao dịch viên và Kiểm soát viên. Không có trong menu.
- **Trạng thái:** **Chỗ trống**, ghi "Phase 4", không có mã task (`components/pages/kyc.tsx:7-11`).
- **Nghiệp vụ:** KYC/whitelist.
- **Action:** không có.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Tổng nhà đầu tư / Đã whitelist / Chờ duyệt KYC / Đang đóng băng | Thẻ số liệu | hằng "0" | Không có dữ liệu |
| Tìm theo tên, CCCD hoặc địa chỉ ví... | Ô tìm kiếm | chỉ trạng thái máy khách | Không lọc gì |
| Cấp KYC (Tất cả, Level 1, Level 2, VIP); Trạng thái (Tất cả, Hoạt động, Chờ duyệt, Đóng băng) | Nút lọc | trạng thái máy khách | Không lọc gì |
| Cột: Nhà đầu tư, CCCD, Cấp KYC, Khẩu vị RR, Địa chỉ ví, WPT nắm giữ, Trạng thái, Đăng ký | Tiêu đề bảng rỗng | | Câu hướng dẫn trỏ sang /mint |
| Làm mới; Trang trước / Trang sau | | không có xử lý; 2 nút phân trang bị khoá | |


#### 3.6.2. `/assets` Dự án điện gió

**Thông tin chung**
- **Vai:** Giao dịch viên và Kiểm soát viên. Không có trong menu.
- **Trạng thái:** **Chỗ trống**, dữ liệu mẫu `MOCK_PROJECTS`.
- **Nghiệp vụ:** Danh mục dự án.
- **Action:** không có.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Làm mới; Thêm dự án (3 loại vùng) | | không có xử lý | |
| Dự án điện gió, Tổng công suất đặt, WPT đã phát hành, Sản lượng luỹ kế | Thẻ số liệu | mock | |
| Vùng (Tất cả; Trên bờ Cao nguyên; Trên bờ Ven biển; Gần bờ); Trạng thái (Đang phát điện, Chạy thử nghiệm thu, Bảo trì) | Nút lọc | lọc trên mock | |
| Cột: Mã & Tên dự án, Vùng, Công suất, WPT phát hành, Sản lượng luỹ kế, Trạng thái, Vận hành từ, TX Hash | | mock; TX Hash dựng liên kết explorer theo chain đang chọn | Mã tx là giả |


#### 3.6.3. `/audit` Sổ kiểm toán

**Thông tin chung**
- **Vai:** Giao dịch viên và Kiểm soát viên (`ops:read` cộng `audit:read`). Không có trong menu.
- **Trạng thái:** **Dùng được**. Chỉ đọc, 100 dòng mới nhất, không lọc, không phân trang.
- **Nghiệp vụ:** Kiểm toán.
- **Action khi mở:** gọi thẳng `listAuditLog(100)` từ Server Component (`app/(ops)/audit/page.tsx:19`, `lib/bank/audit.service.ts`).

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Thời điểm | | `AuditLog.createdAt` | |
| Vai trò | | `actorRole` | |
| Hành động | ví dụ `order:draft`, `order:approve`, `token:mint`, `token:burn`, `demo:mint-payment`, `order:intervene`, `investor:whitelist` | `action` | |
| Đối tượng | Luôn cắt còn 10 ký tự rồi thêm dấu "…" | `target` | |
| Kết quả (badge) | ALLOWED, SUCCESS: màu thường; DENIED, FAILURE: màu đỏ | `outcome` | |
| Chi tiết | | `detail` | |


**Lệch** (tra mã ở Phụ lục C)

- **L-26.** Câu khi trống còn ghi "Thử phát hành token ở trang /mint" (`audit/page.tsx:40`), đã lỗi thời từ FE-22.
- **L-90.** Không hiện cột chain.
- **L-01.** Sổ bị lấp bởi các dòng ALLOWED của phép đọc (xem /draft, /mint), nên 100 dòng mới nhất dễ không còn thao tác thật.


#### 3.6.4. `/reconciliation` Đối soát doanh thu điện

**Thông tin chung**
- **Vai:** Giao dịch viên và Kiểm soát viên. Không có trong menu.
- **Trạng thái:** **Chỗ trống**, ghi "Phase 3", không có mã task.
- **Nghiệp vụ:** Đối soát.
- **Action:** không có.

| Tên trên màn | Ý nghĩa | Nguồn dữ liệu | Dùng ở đâu / để làm gì |
|---|---|---|---|
| Làm mới dữ liệu | | không có xử lý | |
| SCADA nhà máy / Hoá đơn EVN / On-chain | Thẻ mô tả 3 nguồn số liệu | hằng | |
| Kỳ đã đối soát khớp (6) / Sản lượng đã đối soát / Kỳ lệch chờ xử lý (0) | Thẻ số liệu | `MOCK_WIND_STATS` | |
| Dự án (Tất cả và các dự án mẫu) | Nút lọc | mock | Không lọc gì |
| Cột: Kỳ, Dự án, SCADA (MWh), EVN (MWh), On-chain (MWh), Lệch, Kết quả | Bảng luôn rỗng | `periods = []` | |


**Lệch** (tra mã ở Phụ lục C)

- **L-27.** Thẻ "Kỳ đã đối soát khớp" báo 6 kỳ trong khi bảng báo 0 kỳ (`components/pages/reconciliation.tsx:39,70-88`).


---

## Phụ lục A. Trạng thái và nhãn

Cột `status` trong database là `String`, không phải enum Postgres. Chốt chặn giá trị nằm trong mã (`assertStatus`), nên thêm trạng thái mới phải sửa hằng số ở tệp nguồn ghi dưới đây.

### A.1. Lệnh mua bán (`PurchaseOrder.status`, `lib/store/order.store.port.ts:36`)

| Mã | Nghĩa | Kết thúc | Ghi chú |
|---|---|---|---|
| PLACED | Đã đặt, chưa kiểm | Không | Sang CHECKING hoặc EXPIRED. Giao dịch viên chưa can thiệp được (L-14) |
| CHECKING | Đang kiểm số dư VNDB, uỷ quyền, tồn WPT của vault; chưa gửi giao dịch | Không | Sang EXECUTING hoặc REJECTED. Can thiệp được: gửi tiếp |
| EXECUTING | Đã chiếm quyền gửi giao dịch, có thể đã tốn phí | Không | Sang COMPLETED, FAILED, hoặc về CHECKING khi phục hồi. Có mã giao dịch: chỉ đối soát. Mất mã: máy chủ có đường phục hồi, giao diện chưa có nút (L-14) |
| COMPLETED | Đã chuyển VNDB và WPT trong cùng một giao dịch | Có | |
| REJECTED | Bị từ chối trước khi gửi chuỗi | Có | |
| FAILED | Chuỗi từ chối giao dịch | Có | |
| EXPIRED | Hết hạn khi còn ở PLACED | Có | |

Không có trạng thái "đã trả tiền chưa nhận token": hai chiều chuyển nằm trong một giao dịch (`ILedgerPort.executePurchase`). Chiều lệnh `side`: BUY, SELL, chung bảng và chung bảy trạng thái.

Năm bước hiển thị (`lib/bank/settlement-steps.ts:47`): Tạo lệnh, Kiểm tra, Đối chiếu số dư, Quyết toán, Hoàn tất. Mốc giờ: CHECKING ghi `checkingAt`, EXECUTING ghi `reconciledAt`, COMPLETED ghi `completedAt`; `settlingAt` ghi khi gắn mã giao dịch.

### A.2. Yêu cầu phát hành, huỷ (`TokenRequest.status`, `lib/store/token-request.store.port.ts:44`)

| Mã | Nghĩa | Chuyển tiếp |
|---|---|---|
| PENDING | Giao dịch viên đã lập, chờ duyệt | sang EXECUTING (chấp nhận) hoặc REJECTED |
| EXECUTING | Kiểm soát viên đã chấp nhận, đang gửi chuỗi; hoặc đã gửi mà chưa có biên nhận (HF-05), chờ bấm Đối soát | sang COMPLETED hoặc FAILED, chỉ theo biên nhận thật |
| COMPLETED | Chuỗi đã thực hiện (biên nhận CONFIRMED) | Kết thúc |
| REJECTED | Kiểm soát viên từ chối | Kết thúc |
| FAILED | Chuỗi từ chối | Kết thúc |

### A.3. Lệnh rút của Người bán (`WithdrawRequest.status`, `lib/store/vault.store.port.ts:64`)

| Mã | Nghĩa | Kết thúc |
|---|---|---|
| SENDING | Đã tạo bản ghi, đang gửi; không chắc đã gửi thì giữ nguyên chờ đối soát, không gửi lại | Không |
| SENT | Đã gửi, chờ biên nhận | Không (màn đang hiện màu đỏ như lỗi) |
| COMPLETED | Có biên nhận thành công, có sự kiện `Withdrawn` | Có |
| FAILED | Chuỗi từ chối | Có |
| NEEDS_REVIEW | Đối soát không kết luận được, Kiểm soát viên chốt tay ở `/vault` | Không |

Khoá vận hành vault (`VaultOperationLock.kind`): CONFIG (một lần lưu cấu hình), WITHDRAW (một lệnh rút đang dở). Mỗi chain một khoá.

Chế độ khoá của vault: UNSET (khoá toàn bộ), FIXED (khoá một số cố định), PERCENT (khoá theo tỷ lệ, phần vạn). Chi tiết cách tính ở mục 1.7.

### A.4. Chia lợi nhuận (`lib/store/distribution.store.port.ts`)

**Kỳ chia** (`DistributionPeriod.status`, dòng 36):

| Mã | Nghĩa | Kỳ hoạt động |
|---|---|---|
| OPENING | Đang mở kỳ trên chuỗi | Có |
| OPEN | Đã mở, chờ duyệt hoặc chờ chốt vault | Có |
| DISTRIBUTING | Đang gửi lô chia | Có |
| COMPLETED | Đã chia hết | Không |
| EXPIRED | Hết hạn nhận trên chuỗi | Không |
| CLOSED | Đã đóng trên chuỗi | Không |

Mỗi chain tối đa một kỳ hoạt động (cột `activeChain`). Kỳ không có trạng thái FAILED: lỗi nằm ở từng hồ sơ trả.

**Kết luận duyệt** (`approvalStatus`): APPROVED; AMOUNT_CHANGED (số trên chuỗi khác số đã duyệt, phải duyệt lại).

**Chốt kỳ vault** (`vaultCloseStatus`, dòng 95): rỗng, sang PENDING (giữ chỗ mã kỳ), sang SENT, sang DONE (sự kiện `PeriodClosed` khớp số). PENDING hoặc SENT có thể sang CONFLICT (mã kỳ đã bị chốt bằng số khác). Từ HF-04: CONFLICT sang DONE chỉ khi đối soát lại bằng biên nhận thấy đúng số.

**Hồ sơ trả từng ví** (`DistributionPayout.status`): PENDING, SENT, PAID, FAILED, EXPIRED.

**Kết cục một lượt chia** (`lib/bank/distribution-trigger.service.ts:119` và `:447`):

| Mã | Nghĩa | Màn đang hiện |
|---|---|---|
| NO_NEW_FUNDS | Không có phần chưa phân bổ, không có kỳ dở | |
| BELOW_MIN_NEW_BALANCE | Có tiền mới nhưng dưới ngưỡng `distribution.min_new_balance` | Lịch chạy để trống cột lỗi (L-21) |
| ALREADY_RUNNING | Lượt khác đang giữ đúng kỳ và vòng này | |
| AWAITING_APPROVAL | Cần Kiểm soát viên duyệt hoặc duyệt lại | Lịch chạy ghi "vòng rỗng" (L-21) |
| VAULT_PENDING | Chốt kỳ vault chưa xong, lượt sau đối soát | Màu đỏ như lỗi (L-22) |
| VAULT_CONFLICT | Kỳ vault CONFLICT, khoá chia, xử lý tay | |
| DISTRIBUTED | Đã chia, kỳ hoàn tất | |
| PARTIAL | Đã chia một phần, lượt sau chia tiếp | Màu đỏ như lỗi (L-22) |
| PERIOD_ENDED | Kỳ đã hết hạn hoặc đóng trên chuỗi | |
| AMOUNT_CHANGED | (chỉ khi duyệt) Số trên chuỗi khác số duyệt | |

**Việc tiếp theo của kỳ hoạt động** (`nextAction`, `distribution-approval.service.ts:113`): REAPPROVE, CONTINUE, MANUAL_REVIEW, NONE. NONE và MANUAL_REVIEW chưa có đường xử lý trên màn (L-25).

**Lượt chạy keeper** (`KeeperRun.status`): RUNNING, SUCCESS, FAILED.

### A.5. Khác

| Nhóm | Giá trị | Nguồn |
|---|---|---|
| Dự án (`Project.status`) | DRAFT, ISSUED, CLOSED | `lib/store/project.store.port.ts:28` |
| Giao dịch chuỗi (`TxStatus`) | PENDING, CONFIRMED, FAILED | `packages/shared/src/types.ts:17` |
| Kết cục sổ kiểm toán (`AuditOutcome`) | ALLOWED, DENIED (kiểm quyền); SUCCESS, FAILURE (kết quả thao tác) | `app/prisma/schema.prisma` |
| Tài khoản (`AccountStatus`) | ACTIVE, LOCKED. Chưa được kiểm khi đặt lệnh (L-06) | `lib/bank/account-profile.service.ts:13` |
| Định danh (`IdentityStatus`) | APPROVED, PENDING, REJECTED. Dữ liệu mẫu viết cứng | như trên, dòng 14 |
| AML (`AmlStatus`) | CLEARED, REVIEW, FLAGGED. Dữ liệu mẫu viết cứng | như trên, dòng 16 |

---

## Phụ lục B. Tham số cấu hình (SystemConfig)

Khoá khai ở `CONFIG_KEYS` (`lib/config/issue-terms.ts:95`). Bảng chưa có dòng thì dùng giá trị mặc định trong mã. Hiện chưa có màn nào để sửa các tham số này (màn cấu hình giá là FE-07); người vận hành sửa bằng script hoặc SQL.

| Khoá | Ý nghĩa | Mặc định | Màn hiển thị hoặc dùng |
|---|---|---|---|
| `wpt.issue_price_vnd.<chain>` | Giá phát hành 1 WPT theo từng chain | 100.000 VNDB (`token-parameters.json`) | `/portfolio`, `/trade`, `/seller`, `/tokens/[symbol]`. Trên EVM giá chốt lệnh thật là `OrderSettlement.price` (L-02) |
| `wpt.price_change_threshold` | Ngưỡng cảnh báo đổi giá, phần trăm | 2 | Dịch vụ cấu hình giá |
| `wpt.remaining_lifetime_years` | Tuổi thọ còn lại của dự án, năm | 15 | `/tokens/[symbol]`, `/trade` |
| `wpt.annual_yield_percent` | Lợi tức dự kiến mỗi năm, phần trăm | 5,8 | `/tokens/[symbol]`, `/trade` |
| `wpt.trading_fee_percent` | Phí giao dịch, phần trăm | 0 | Chỉ hiển thị, không trừ khi đặt lệnh |
| `order.permit_ttl_seconds` | Thời hạn chữ ký permit khi đặt lệnh trên EVM | 1.800 giây | `/trade` |
| `order.permit_min_remaining_seconds` | Thời gian còn lại tối thiểu của chữ ký khi đặt và trước khi gửi | 120 giây | `/trade`, tiến trình quyết toán |
| `distribution.batch_size` | Số ví mỗi lô chia | 50 (tối đa 500) | Tiến trình chia |
| `distribution.max_batches_per_run` | Số lô tối đa mỗi lượt | 5 (tối đa 100) | Tiến trình chia |
| `distribution.min_new_balance` | Mức tiền mới tối thiểu để coi là có tiền chia | 1.000 VNDB | `/distribution` (Quỹ chia) |
| `distribution.stuck_after_runs` | Số vòng tối đa trước khi coi kỳ là treo | 3 | Tiến trình chia |
| `distribution.dust_wallet` | Ví nhận phần dư làm tròn | không | Tiến trình chia |
| `distribution.last_settled_balance` | Số dư ví lợi nhuận đã xử lý xong, mốc để nhận ra tiền mới | không | Tiến trình chia tự ghi |
| `vault.default_percent_bps` | Tỷ lệ PERCENT điền sẵn khi vault UNSET, phần vạn | 2.000 (20%) | `/vault` |
| `demo.payment_mint_max_vnd` | Số VNDB tối đa một lần nạp trình diễn | 1.000.000.000 | `/demo-payment`. Bật tắt bằng biến môi trường `ENABLE_DEMO_PAYMENT_MINT`, không bằng khoá này |

Ba khoá `seller.withdraw_limit_mode`, `seller.withdraw_limit_value`, `seller.withdraw_fee_vnd` của FE-21 đã bị gỡ ở BE-13 (QĐ-H). Dòng cũ trong database để yên, không mã nào đọc.

---

## Phụ lục C. Danh sách lệch cần đưa vào task

Mức: **Cao** (có thể làm sai số tiền, sai trạng thái, hoặc kẹt nghiệp vụ), **Vừa** (người dùng hiểu sai, phải xử lý tay), **Thấp** (chữ, nhãn, hiển thị). Cột "Đề xuất" là task nên nhận lệch; mã task mới là đề xuất, chờ Sếp chốt.

### C.1. Lệch chính

| Mã | Màn | Nội dung | Mức | Đề xuất |
|---|---|---|---|---|
| L-01 | Nhiều màn | Phép đọc dùng `authorize()` nên ghi `AuditLog` mỗi lần: `/portfolio` 3 dòng mỗi lần mở, `/orders` 1 dòng mỗi phím gõ, `/trade` 1 dòng mỗi 3 giây, `/draft`, `/approvals`, `/mint`, `/vault`. Sổ bị lấp, nên `/orders/[id]` (quét 500 dòng) và `/audit` (100 dòng) mất nhật ký thật | Cao | PERF-01 hoặc task riêng: đổi phép đọc sang `assertCan()` |
| L-02 | `/portfolio`, `/trade`, `/seller`, `/tokens/[symbol]` | Giá hiển thị đọc SystemConfig, giá chốt lệnh trên EVM là `OrderSettlement.price`. Lệch thì màn hiện hai giá, cảnh báo lệch không hiện cho khách hàng | Cao | FE-07 (R7) |
| L-03 | `/portfolio` | Trên mock vẫn đòi ví trình duyệt, trong khi `/trade`, `/orders`, `/tokens/[symbol]` dùng ví hồ sơ | Vừa | FE-04 |
| L-04 | `/trade` | Ô chọn Token không có tác dụng; máy chủ luôn lấy dự án đầu tiên | Vừa | Khi có dự án thứ hai trên cùng chain |
| L-05 | `/trade` | Huy hiệu "Trạng thái giao dịch" bỏ qua `Project.status`; dự án CLOSED vẫn hiện "Đang mở" trong khi điều kiện 4 trượt | Vừa | SC-04 |
| L-06 | `/trade`, `/account` | Đặt lệnh không kiểm `AccountStatus` (ACTIVE, LOCKED) và hạn mức ngày; `dailyTransactionLimitVnd` chỉ hiển thị | Vừa | AU-01 |
| L-07 | `/seller` | Hai ô "bán" gắn cứng dấu gạch, dù service đã trả số lệnh bán trong ngày (BE-14) | Thấp | FE-28 (đề xuất) |
| L-08 | `/seller`, `/seller/withdraw` | Chú thích chế độ PERCENT in cả "thu ròng" lẫn "phần khoá kỳ gần nhất" mà không nói số nào đang áp; trước kỳ đầu khoá theo thu ròng, sau đó theo lợi nhuận đã chia kỳ trước | Vừa | FE-28 (đề xuất) |
| L-09 | `/seller` | Nhãn "Hạn mức còn rút được" là chữ của mô hình FE-21 đã gỡ; giá trị thật là `withdrawable()` của vault | Thấp | FE-28 (đề xuất) |
| L-10 | `/account` | Badge "Chỉ đọc" nhưng có form ghi ví lưu ngay; trường "Địa chỉ ví" luôn hiện ví mẫu cố định, không theo chain hay ví đã liên kết | Vừa | AU-01 |
| L-11 | `/draft` | Ngày hiệu lực chỉ được lưu; duyệt là thực hiện ngay, không so ngày | Vừa | Chờ Sếp chốt: bỏ trường hay ràng buộc |
| L-12 | `/draft` | Một yêu cầu Mint kẹt ở EXECUTING chặn mọi yêu cầu Mint mới, không có màn hay action đối soát | Cao | Task mới: đối soát yêu cầu phát hành kẹt |
| L-14 | `/transactions` | Lệnh EXECUTING mất mã giao dịch chỉ hiện "Cần đối soát tay" dù máy chủ có `recoverExecutingWithoutTx`; lệnh PLACED không can thiệp được | Vừa | Task mới (cùng nhóm BE-17) |
| L-15 | `/approvals/[id]` | Không có hộp xác nhận trước "Chấp nhận" (gửi chuỗi ngay); yêu cầu EXECUTING kẹt không có nút xử lý | Vừa | Gộp với L-12 |
| L-16 | `/vault` | Mở màn gọi 3 action nối tiếp, ghi 3 dòng sổ | Vừa | PERF-01 |
| L-17 | `/vault` | `closePeriod` áp tỷ lệ chờ mà không phát `PercentRateSet`, nên "Lịch sử cấu hình" thiếu dòng cho lần áp này | Thấp | Ghi nhận; sửa hợp đồng khi có đợt nâng cấp |
| L-18 | `/vault`, `/seller/withdraw` | Giao dịch viên bấm được "Đối soát lệnh rút"; sổ ghi `vault:reconcile` dưới vai TELLER và `vault:read` dưới vai SELLER dù hai vai không có quyền đó | Vừa | Task phân quyền (đề xuất gộp vào PERF-01 khi sửa L-01) |
| L-19 | `/distribution` | "Dự kiến" tính trên phần chưa phân bổ, không phải kỳ đang chạy; đã có kỳ lấy hết tiền thì mọi dòng hiện 0 | Vừa | FE-09 |
| L-21 | `/distribution` | Lịch chạy không lọc theo chain, kết quả là mã thô, lượt SUCCESS không chia gì để trống lý do, lượt AWAITING_APPROVAL ghi "vòng rỗng" | Vừa | FE-09 |
| L-22 | `/distribution` | PARTIAL và VAULT_PENDING là kết cục bình thường nhưng hiện màu đỏ như lỗi | Thấp | FE-09 |
| L-23 | `/distribution` | "Tiếp tục chia" chuyển tiền không qua hộp xác nhận | Vừa | FE-09 |
| L-24 | `/distribution` | Giao dịch viên (chỉ xem) vẫn đọc ghi chú bảo "Tiếp tục để phục hồi", "Duyệt lại số thực tế"; không có câu nói rõ vai chỉ xem | Thấp | FE-09 |
| L-25 | `/distribution` | `nextAction` NONE có thể giữ chỗ kỳ hoạt động mãi và chặn kỳ mới; MANUAL_REVIEW (vault CONFLICT khác số) không có đường xử lý trên màn | Cao | Task mới: xử lý kỳ kẹt |
| L-26 | `/`, `/audit` | Nút "Phát hành WPT" ở Bảng điều khiển dẫn tới `/mint`; câu trống ở `/audit` vẫn bảo thử phát hành ở `/mint`. Từ FE-22 phát hành chính thức là `/draft` | Thấp | FE-28 (đề xuất) |
| L-27 | `/reconciliation` | Thẻ báo 6 kỳ khớp trong khi bảng 0 kỳ | Thấp | Khi làm màn đối soát thật |
| L-28 | `/demo-payment` | Chú thích cờ `ENABLE_DEMO_PAYMENT_MINT` ghi "mặc định tắt" ở `permissions.ts:437`, thực tế mặc định bật | Thấp | FE-28 (đề xuất) |

### C.2. Lệch nhỏ theo từng màn

Gom vào một đợt dọn giao diện (đề xuất mã FE-28) trừ khi ghi khác ở Phần 3.

| Mã | Màn | Nội dung |
|---|---|---|
| L-29 | `/portfolio` | Câu "tầng ledger chưa có phương thức đọc số dư token thanh toán (chờ BE-01)" ở `components/investor/asset-summary.tsx:147-148` đã cũ. |
| L-30 | `/portfolio` | Huy hiệu ghi "đã KYC" nhưng thực chất đọc danh sách được phép on-chain, không đọc hồ sơ định danh (`components/investor/asset-summary.tsx:132-134`). |
| L-31 | `/portfolio` | Cột "Nghiệp vụ" và "Trạng thái" hiện mã tiếng Anh thô (`components/investor/transaction-history-box.tsx:197` và `:209`). |
| L-32 | `/portfolio` | Câu trạng thái rỗng "sau khi ngân hàng phát hành WPT về ví này" (`:175`) bỏ sót trường hợp ví có giao dịch mua hoặc bán. |
| L-33 | `/portfolio` | Liên kết ghi "Ví của tôi" trong khi menu gọi là "Kết nối ví" (`components/investor/asset-summary.tsx:93`). |
| L-34 | `/trade` | Định danh, AML và hạng rủi ro lấy từ hồ sơ mẫu viết cứng (`lib/bank/account-profile.service.ts:55-114`), không lấy từ DB. |
| L-35 | `/trade` | "Phí giao dịch" chỉ để hiển thị; không có phép trừ phí nào trong `placeOrder`. |
| L-36 | `/trade` | Chiều bán dùng cùng đơn giá `quotePurchase` với chiều mua. |
| L-37 | `/trade` | Trần khi bán chỉ xét số WPT đang giữ; thanh khoản VNDB của vault chỉ lộ ra ở điều kiện "Rủi ro". |
| L-38 | `/orders` | Gõ dở một mã lệnh (chưa đủ UUID) làm server trả "Dữ liệu không hợp lệ.", và câu này thay chỗ bảng (`components/pages/investor-orders.tsx:118` và `:148-149`). |
| L-39 | `/orders` | Mỗi lần chỉ tải tối đa 200 lệnh (`components/trading/gates.ts:130`), không có phân trang. |
| L-40 | `/orders/[id]` | Nhật ký chỉ quét 500 dòng `AuditLog` mới nhất (`lib/bank/trade.service.ts:424-425`, có ghi chú `ponytail`). |
| L-41 | `/orders/[id]` | Các lần đặt lệnh bị từ chối trước khi tạo bản ghi không có mã lệnh trong `detail` (`lib/bank/purchase.service.ts:238-245`), nên không xuất hiện ở đây. |
| L-42 | `/orders/[id]` | Nhật ký hiện mã thô `action`, `actorRole` và `outcome` (ví dụ `order:auto-execute`, `INVESTOR`, `SUCCESS`) (`components/trading/order-detail-content.tsx:67-69`). |
| L-43 | `/orders/[id]` | Bước quyết toán tự động ghi `actorRole` là INVESTOR, dù tx do ví ngân hàng ký. |
| L-44 | `/orders/[id]` | "Mã giao dịch" không có liên kết sang trình khám phá khối và không ghi "mô phỏng" như màn /trade. |
| L-45 | `/tokens/[symbol]` | Thẻ "Thông tin token" mang nhãn on-chain (`components/pages/investor-token-detail.tsx:165`), nhưng Tuổi thọ, Lợi tức, Phí (`:172-178`) và Giá phát hành (`:186-189`) đều đọc từ SystemConfig, không đọc từ chuỗi. |
| L-46 | `/tokens/[symbol]` | Trang tra dự án trong `MOCK_PROJECTS` viết cứng (`app/(investor)/tokens/[symbol]/page.tsx:22`), không tra bảng `Project` mà /trade dùng. |
| L-47 | `/tokens/[symbol]` | Khi dự án đã lên chuỗi nhưng `getPortfolioAction` lỗi hoặc chưa trả về, thẻ thông tin token hiện dòng mẫu "WPT dự kiến phát hành" (`:180-196`) mà không báo là đang tải hay đã lỗi. |
| L-48 | `/withdraw` | `app/actions/withdraw.ts` và `lib/bank/withdraw.service.ts` đã có, nhưng đó là luồng rút vault SPV của Người bán, dùng quyền `vault:withdraw` chỉ cấp cho SELLER (`lib/rbac/permissions.ts:213-214` và `:283-291`). |
| L-49 | `/withdraw` | Câu lưu ý "Khác với ba màn kia" (`app/(investor)/withdraw/page.tsx:17`) là văn bản từ lúc dựng khung; ba màn kia nay đã có phần thân. |
| L-50 | `/seller` | Bảng Tồn kho lặp một dòng cho mỗi `Project`, nhưng mọi dòng đọc chung một `tokenInfo()` và `balanceOf` của chain. |
| L-51 | `/seller` | Định nghĩa "Chưa phân phối" ghi "ví thanh toán của Người bán", thực chất là số dư WPT của vault SPV. |
| L-52 | `/seller` | `payoutWallet` và `withdrawalsPaused` có trong dữ liệu trả về nhưng màn này không hiển thị. |
| L-53 | `/seller/transactions` | Cột "Bước hiện tại" hiện mục đích rút cho lệnh rút (`seller-transactions.tsx:175,195`), không phải một bước. |
| L-54 | `/seller/transactions` | `STEP_LABELS` mô tả luồng mua ("4. Đã giao token") nhưng áp cả cho lệnh Bán (`seller-transactions.tsx:36-44`). |
| L-55 | `/seller/transactions` | Placeholder chỉ nói "Mã lệnh hoặc ví nhà đầu tư" (`seller-transactions.tsx:133`), trong khi server còn tìm theo ví nhận và txHash của lệnh rút. |
| L-56 | `/seller/transactions` | Sổ vượt 500 dòng thì `total` và phân trang thiếu dòng cũ (`seller.service.ts:35-36`). |
| L-57 | `/seller/transactions` | Lệnh rút có `txHash` nhưng bảng này không hiện cột mã giao dịch. |
| L-58 | `/seller/withdraw` | Lệnh về SENT (đã gửi, chờ biên nhận) vẫn hiện bằng giọng lỗi màu đỏ (`seller-withdraw.tsx:114`). |
| L-59 | `/seller/withdraw` | Đối soát chỉ quét 20 lệnh SENDING/SENT (`withdraw.service.ts:412`). |
| L-60 | `/seller/withdraw` | Màn tính "Số tiền nhận được" trên chuỗi chưa trim (`seller-withdraw.tsx:76`), còn server trim. |
| L-61 | `/seller/withdraw` | Số dư và "Phần được rút" là ảnh chụp lúc mở màn; giới hạn thật đọc lại trên chuỗi khi gửi, nên màn có thể nhận số mà máy chủ từ chối. |
| L-62 | `/wallet` | Breadcrumb là "Nhà đầu tư > Ví của tôi" (`app/(wallet)/wallet/page.tsx:16`), nhưng Người bán cũng vào được trang này. |
| L-63 | `/wallet` | Mọi câu chữ đều nói về nhà đầu tư, ví dụ "Ví ở trang này chỉ dùng cho thao tác của nhà đầu tư" (`wallet-connect.tsx:248`). |
| L-64 | `/wallet` | Kết nối ví ở `/wallet` không ghi vào hồ sơ; liên kết ví làm ở `/account`. |
| L-65 | `/wallet` | Câu "Số WPT đang giữ xem ở trang Tổng quan" sai với Người bán: Tổng quan của Người bán hiện số của vault (`wallet-status-card.tsx:113`). |
| L-66 | `/account` | Sai định dạng địa chỉ bị chặn ở zod trước khi ghi sổ (`account-profile.service.ts:244`), nên không có dòng AuditLog. |
| L-67 | `/account` | Chú thích nói Stellar "bắt buộc liên kết" nhưng schema chỉ nhận địa chỉ EVM, nên không liên kết được địa chỉ Stellar (`account-profile.service.ts:136-138`). |
| L-68 | `/account` | Ví liên kết chỉ có tác dụng với Nhà đầu tư cá nhân; câu "so với ví bạn kết nối khi đặt lệnh" không đúng với Người bán (`account-profile.service.ts:125-168`). |
| L-69 | `/` | Breadcrumb ghi "Tổng quan điện gió" (`app/(ops)/page.tsx:6`), không khớp nhãn menu "Bảng điều khiển". |
| L-70 | `/` | Số mẫu (335.000 WPT, 3 dự án) không khớp dữ liệu thật: trần 20.000.000 WPT, 1 dự án An Viên. |
| L-71 | `/draft` | Vault không hiện trên màn: khi chưa có ví SPV, người lập phải nhập tay ví đích, địa chỉ vault mà R6 bắt buộc chỉ lộ ra trong câu lỗi (`draft.tsx:395-413`). |
| L-72 | `/draft` | Nhãn "Mã hoặc ký hiệu token" gây hiểu nhầm: hệ thống chỉ tra theo `tokenSymbol`. |
| L-73 | `/draft` | "Mã người bán" là hằng NB001, không đọc từ dữ liệu dự án (`S:729-732`). |
| L-74 | `/approvals` | Thẻ số liệu chỉ đếm theo chain đang chọn. |
| L-75 | `/transactions` | Nguồn cung chỉ tính cho dự án đầu tiên của chain (`ops-transactions.service.ts:117`). |
| L-76 | `/transactions/[id]` | Không có nút can thiệp ở màn chi tiết; can thiệp chỉ làm được ở danh sách. |
| L-77 | `/demo-payment` | Lịch sử nạp có thể thiếu: lần nạp cũ hơn 200 giao dịch không hiện (`lib/bank/demo-payment.service.ts:178-180`). |
| L-78 | `/mint` | Cột Thời điểm chỉ hiện giờ, không có ngày (`components/pages/mint.tsx:321`). |
| L-79 | `/mint` | Đây là nơi duy nhất làm KYC/whitelist; trang `/kyc` là chỗ trống. |
| L-80 | `/vault` | Tên quyền đúng là `vault:configure`, không có `vault:config`; tài liệu nào ghi `vault:config` là ghi sai (`permissions.ts:212`). |
| L-81 | `/vault` | Giao dịch viên thấy toàn bộ form cấu hình nhưng bị khoá, nút lưu ẩn (`vault-status.tsx:106`, `:131`). |
| L-82 | `/vault` | "Kỳ gần nhất" được định dạng như số tiền, có dấu chấm nghìn (`vault-status.tsx:437`). |
| L-83 | `/vault` | "Khoá cố định" vẫn hiện số cũ khi đang ở chế độ PERCENT, dễ hiểu nhầm là đang áp (`:428`). |
| L-84 | `/vault` | Card "Lệnh rút cần xem xét" không tải lại khi lưu cấu hình (`vault-status.tsx:458-463`). |
| L-85 | `/distribution` | "Phần dư làm tròn" gồm cả phần của ví ngoài danh sách: mẫu số là tổng cung, danh sách lấy từ database (`distribution.service.ts:331`). |
| L-86 | `/distribution` | Cổng trang là `reconcile:read`, không có `distribution:read` (`page.tsx:8`). |
| L-87 | `/distribution` | Chain không hỗ trợ: Kiểm soát viên vẫn thấy card "Duyệt chia" với nút "Duyệt chia 0 VNDB" bị khoá. |
| L-88 | `/distribution` | "Còn phải chi / lỗi" hiện 0 / 0 trước khi vault DONE, vì hồ sơ chỉ được lập sau khi chốt vault, trong khi nextAction vẫn là CONTINUE. |
| L-89 | `/distribution` | "Người duyệt" là mã tài khoản thô, không phải tên hay vai (`:298`). |
| L-90 | `/audit` | Không hiện cột chain. |

---

## Lịch sử cập nhật

| Ngày | Commit | Người | Nội dung |
|---|---|---|---|
| 21/10/2026 | `24f3b7c` | Giám sát (Claude) | Bản đầu: Phần 1 tới Phần 3, Phụ lục A, B, C. Dựng từ đọc mã và kết quả OP-05 trên Sepolia |
| 22/10/2026 | `8359009` | Dev (Claude) | HF-05: tệp vào repo. Sửa L-13 (giao dịch phát hành, huỷ chưa có biên nhận giữ Đang thực hiện; nút Đối soát ở `/approvals/[id]`), L-20 (`/distribution` hiện số đã duyệt `approvedAmount`), L-91 (lệnh mua bán chưa có biên nhận, tra chuỗi chưa thấy `OrderSettled`: giữ Đang quyết toán, không ghi Thất bại; áp cả gửi lần đầu và đối soát ở `/transactions`). Sửa mục 3.4.4, 3.5.2, Phần 2, Phụ lục A.2, C |

