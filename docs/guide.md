# Hướng dẫn demo trọn luồng BIDV RWA Tokenize

Tài liệu này dùng cho bản PoC hiện tại, với cấu hình mặc định **Mock → Giao dịch viên → memory
DB**. Luồng chính thức luôn đi qua **Giao dịch viên lập lệnh → Kiểm soát viên duyệt**; không dùng
nút phát hành WPT trực tiếp hay `scripts/demo-mint.mjs`.

## 1. Chạy bản demo

Yêu cầu: Node.js 20+ và npm. Chain `mock` không cần Docker, Postgres, Hardhat hay ví trình duyệt.

```bash
git clone <repository-url>
cd bidv-rwa-tokenize
cp .env.example app/.env.local
cd app
npm install
npm run dev
```

Mở <http://localhost:3000>. Trạng thái đúng khi mới mở:

- Chain: **Mock (không cần chain)**.
- Vai trò: **Giao dịch viên · GDV001**.
- Trang **Bảng điều khiển** hiện ra, không có thông báo “Không có quyền vào kênh Vận hành”.
- Menu có **Bảng điều khiển**, **Lập lệnh**, **Giao dịch**, **Chia lợi nhuận**, **Thông tin tài khoản** và **Nạp VNDB (trình diễn)** (khi cờ trình diễn bật).

Nếu cổng 3000 đã bận, Next.js in URL thực tế trong terminal; dùng đúng URL đó. Nếu trình duyệt từng
chọn một vai khác, cookie của trình duyệt được ưu tiên: chọn lại **Giao dịch viên · GDV001** ở góc
trên phải. Hai trình duyệt lưu cookie độc lập, nhưng một trình duyệt sạch luôn bắt đầu ở GDV.

### Dữ liệu dùng xuyên suốt

| Đối tượng | Giá trị |
|---|---|
| Ví thanh toán SPV | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
| Ví Nhà đầu tư NDT001 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Token | `WPT` |
| Trần phát hành | `20.000.000 WPT` |
| Giá mặc định | `100.000 VNDB/WPT` |

Mock ledger và memory DB sống trong tiến trình web. Muốn chạy lại từ trạng thái trắng, dừng
`npm run dev` bằng `Ctrl+C`, chạy lại lệnh và tải lại trang. Đừng chạy hai tiến trình web cùng lúc:
chúng có hai bộ dữ liệu mock khác nhau.

## 2. Whitelist ví SPV và Nhà đầu tư

Thực hiện khi đang ở vai **Giao dịch viên** và chain **Mock**:

1. Vào trực tiếp đường dẫn `/mint`. Đây là màn dữ liệu thử, chủ ý không nằm trong menu theo tài liệu yêu cầu.
2. Nhập ví SPV ở bảng trên vào ô **Ví nhà đầu tư**.
3. Bấm **1 · KYC + Whitelist**.
4. Chờ thông báo có `whitelist=true` và trạng thái ví bên phải hiện **Đã whitelist**.
5. Thay bằng ví Nhà đầu tư NDT001 rồi lặp lại hai bước trên.

Thao tác này lặp lại được. Không bấm **2 · Phát hành dữ liệu thử**: nút đó mặc định bị khóa vì đi
vòng qua bước Kiểm soát viên duyệt.

Nếu KYC thất bại ngay ở local, kiểm `app/.env.local` có `USE_MOCK_DB=true`, dừng và chạy lại server
sau khi sửa. `USE_MOCK_DB=false` chỉ dùng khi đã có Postgres và `DATABASE_URL` hoạt động.

## 3. Phát hành toàn bộ WPT vào ví SPV

### 3.1 Giao dịch viên lập yêu cầu Mint

1. Chọn **Giao dịch viên · GDV001** → menu **Lập lệnh**.
2. Trong thẻ **Tạo token**, nhập `WPT` vào **Mã hoặc ký hiệu token**.
3. Chờ khối thông tin token tải xong. Ở lần phát hành đầu, nhập ví SPV vào **Ví đích (ví thanh toán
   SPV)**.
4. Nhập **Số lượng** bằng **Số còn được phát hành**. Trạng thái trắng là `20000000`.
5. Nhập **Lý do**, ví dụ `Phát hành toàn bộ nguồn cung để demo`.
6. Chờ mọi dòng trong **Khối kiểm tra trước khi lập** đạt; nút **Gửi yêu cầu tạo token** sẽ mở.
7. Bấm nút và ghi lại tám ký tự đầu của mã yêu cầu. Kết quả đúng là trạng thái **Chờ duyệt**.

Nếu server đã có nguồn cung, không nhập lại `20000000`; dùng đúng số **Số còn được phát hành** đang
hiển thị. Nếu số này bằng 0 thì nguồn cung đã chạm trần, bỏ qua Mint hoặc khởi động lại mock.

### 3.2 Kiểm soát viên duyệt Mint

1. Đổi vai ở góc trên phải sang **Kiểm soát viên · KSV001**.
2. Mở **Phê duyệt lệnh**. Trong **Hàng chờ tạo token**, tìm mã vừa ghi.
3. Bấm mã yêu cầu để mở **Chi tiết yêu cầu**; đối chiếu loại `MINT`, ví SPV, số lượng và lý do.
4. Bấm **Chấp nhận**.
5. Chờ thông báo **Đã chấp nhận**, trạng thái **Hoàn tất** và nhật ký có dòng **Chấp nhận, hoàn tất
   trên chuỗi**.

Kết quả trên trạng thái trắng: Tổng cung = Chưa phân phối = `20.000.000 WPT`, Đang lưu hành = `0`.
GDV không vào được màn phê duyệt và KSV không vào được màn lập lệnh; đây là maker–checker có chủ ý.

## 4. Nạp VNDB cho Nhà đầu tư

1. Đổi về **Giao dịch viên · GDV001**.
2. Mở menu **Nạp VNDB (trình diễn)** (`/demo-payment`).
3. Nhập ví NDT001 vào **Ví đích**.
4. Nhập `1000000` vào **Số VNDB** rồi bấm **Nạp VNDB**.
5. Chờ thông báo bắt đầu bằng **Đã nạp**, có số dư mới `1.000.000 VNDB` và trạng thái giao dịch.

Trên chain mock, lần nạp này đồng thời chuẩn bị mức ủy quyền cần cho lệnh mua. Đây là tiền mô phỏng,
không có tiền gửi thật đứng sau. Production bắt buộc đặt `ENABLE_DEMO_PAYMENT_MINT=false`.

## 5. Nhà đầu tư đặt mua và GDV khớp lệnh

### 5.1 Nhà đầu tư đặt lệnh mua

1. Đổi sang **Nhà đầu tư · NDT001**.
2. Mở **Giao dịch token** (`/trade`). Ở chain Mock, trang ghi rõ đang dùng ví trong hồ sơ NDT001;
   không cần MetaMask hay nút **Kết nối ví**.
3. Chọn tab **Mua**, nhập **Số lượng** `2`.
4. Chờ năm điều kiện trong **Kiểm tra trước lệnh** đều đạt. Tổng dự kiến phải là `200.000 VNDB`.
5. Bấm **Xác nhận lệnh mua**, đối chiếu hộp **Đối chiếu lệnh lần cuối**, rồi bấm **Gửi lệnh**.
6. Ở khối **Lệnh mua vừa gửi**, ghi lại mã lệnh (có thể bấm **Xem chi tiết**). Trạng thái lúc này
   là **Đã đặt** và đang chờ ngân hàng khớp.

### 5.2 Giao dịch viên khớp lệnh mua

1. Đổi về **Giao dịch viên · GDV001** → mở **Giao dịch** (`/transactions`).
2. Tìm theo tám ký tự đầu mã lệnh hoặc chọn Nhà đầu tư tương ứng.
3. Kiểm tra chiều **Mua**, `2 WPT`, `200.000 VNDB`, trạng thái **Đã đặt**.
4. Bấm **Khớp lệnh** và chờ thông báo thành công; dòng chuyển sang **Hoàn tất**.
5. Bấm mã lệnh để xem **Tiến trình quyết toán** năm bước và mã giao dịch mô phỏng.

Sau khi khớp: NDT001 có `2 WPT` và `800.000 VNDB`; số WPT chưa phân phối giảm còn `19.999.998`.
Đổi sang **Kiểm soát viên** và mở cùng trang để trình diễn chế độ chỉ đọc: KSV thấy toàn bộ lệnh
nhưng không có nút **Khớp lệnh**.

### 5.3 Nhà đầu tư đối chiếu lệnh của mình

1. Đổi sang **Nhà đầu tư · NDT001** → **Quản lý lệnh** (`/orders`).
2. Dòng vừa tạo phải có chiều **Mua** và trạng thái **Hoàn tất**.
3. Bấm **Chi tiết** để đối chiếu tiến trình, mã giao dịch và số dư sau giao dịch.

## 6. Luồng bán WPT ngược lại cho SPV

1. Vẫn ở **Nhà đầu tư**, mở **Giao dịch token** và chọn tab **Bán**.
2. Nhập `1`. Khối kiểm tra phải đạt vì Nhà đầu tư đang giữ `2 WPT` và ví SPV đã nhận `200.000 VNDB`
   từ lệnh mua.
3. Bấm **Xác nhận lệnh bán** → **Gửi lệnh**; ghi mã lệnh mới.
4. Đổi sang **Giao dịch viên**, mở **Giao dịch**, tìm mã và bấm **Khớp lệnh**.
5. Đổi lại **Nhà đầu tư**, mở **Quản lý lệnh** và xác nhận lệnh bán **Hoàn tất**.

Sau hai lệnh: NDT001 có `1 WPT` và `900.000 VNDB`; chưa phân phối là `19.999.999 WPT`. Số VNDB
còn lại ở SPV là `100.000`, đủ phản ánh dòng tiền ròng của một WPT còn lưu hành.

## 7. Huỷ một phần token chưa phân phối

### 7.1 Giao dịch viên lập yêu cầu Burn

1. Đổi sang **Giao dịch viên** → **Lập lệnh**.
2. Trong thẻ **Huỷ token**, nhập `WPT` và chờ thông tin token tải xong.
3. Chọn nguồn **Phần chưa phân phối**, nhập số lượng `100`.
4. Nhập lý do `Huỷ phần token chưa phân phối sau demo`.
5. Chờ mọi điều kiện đạt rồi bấm **Gửi yêu cầu huỷ token**; ghi mã yêu cầu.

Không chọn **Toàn bộ nguồn cung** khi còn `1 WPT` lưu hành: lựa chọn đó chỉ hợp lệ khi không còn
token ở ví Nhà đầu tư và còn yêu cầu đánh dấu xác nhận phá hủy toàn bộ.

### 7.2 Kiểm soát viên duyệt Burn

1. Đổi sang **Kiểm soát viên** → **Phê duyệt lệnh**.
2. Tìm mã trong **Hàng chờ huỷ token**, mở chi tiết và bấm **Chấp nhận**.
3. Chờ trạng thái **Hoàn tất**.

Kết quả cuối theo đúng số liệu của hướng dẫn: Tổng cung `19.999.900 WPT`, Chưa phân phối
`19.999.899 WPT`, Đang lưu hành `1 WPT`.

## 8. Các lỗi thường gặp

| Hiện tượng | Nguyên nhân và cách xử lý |
|---|---|
| “Vai trò hiện tại là SELLER” ở trình duyệt cũ | Cookie cũ còn hiệu lực; chọn **Giao dịch viên** ở góc trên phải hoặc xóa hai cookie `bidv_role`, `bidv_channel`. Trình duyệt sạch tự vào TELLER. |
| KYC/whitelist báo lỗi kết nối DB | Local đang đặt `USE_MOCK_DB=false` nhưng Postgres chưa chạy. Đặt `true` và khởi động lại web. |
| Không thấy **Nạp VNDB (trình diễn)** | Server production-like đã đặt `ENABLE_DEMO_PAYMENT_MINT=false`, hoặc vai không phải TELLER. Bản PoC từ `.env.example` đặt `true`. |
| Nút gửi Mint/Burn bị khóa | Đọc dòng **Chưa gửi được** và điều kiện không đạt; thường do chưa whitelist SPV, thiếu lý do, vượt số còn phát hành/chưa phân phối. |
| Lệnh mua không đạt | Phải whitelist NDT001, nạp VNDB, phát hành WPT vào SPV và dùng đúng ví hồ sơ ở bảng đầu tài liệu. |
| Hai trình duyệt thấy dữ liệu khác nhau sau deploy serverless | Memory DB/mock ledger gắn với từng tiến trình. Demo nhiều người ổn định phải dùng một instance hoặc Postgres/chain dùng chung. |

| Đổi chain trên bản deploy sang Hardhat Local rồi báo thiếu khóa ký | Đây là đúng hành vi: chain thật cần khóa ký. Mock không cần khóa; trên Cloudflare muốn dùng chain thật phải cấu hình secret signer và RPC truy cập được. |

## 9. Chuyển sang môi trường thật

Chain `mock` không cần khóa ký; bản trình diễn mặc định chạy được mà không cấu hình khóa.
Chain thật (`hardhat-local`, `evm`) vẫn cần `SERVER_SIGNER_PRIVATE_KEY`; trên Cloudflare phải đặt
biến này làm **secret của Worker**, không đưa vào source hay biến công khai.

Guide này không phải runbook production. Tối thiểu phải đặt:

```dotenv
ENABLE_DEMO_PAYMENT_MINT=false
ENABLE_DEMO_TOKEN_MINT=false
USE_MOCK_DB=false
```

Sau đó cấu hình `DATABASE_URL`, signer/RPC theo chain, thay `DEMO_ROLE` và cookie PoC bằng phiên xác
thực (AU-01), và hoàn tất SC-02/SC-03 trước khi chạy Mint/Burn và mua/bán trên EVM thật.
