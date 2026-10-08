# Hướng dẫn demo trọn luồng BIDV RWA Tokenize

Tài liệu này dùng cho bản PoC hiện tại, với cấu hình mặc định **Mock → Giao dịch viên → memory
DB**. Luồng Mint/Burn chính thức luôn đi qua **Giao dịch viên lập lệnh → Kiểm soát viên duyệt**;
không dùng nút phát hành WPT trực tiếp hay `scripts/demo-mint.mjs`. Lệnh mua/bán của Nhà đầu tư
được hệ thống tự quyết toán; Giao dịch viên chỉ can thiệp khi lệnh bị kẹt.

Các bước 2–7 và bảng ví mẫu bên dưới dùng cho **Mock**. Mint/Burn trên **Sepolia** theo mục 1.1; mua/bán trên Sepolia còn chờ SC-03.

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

Chạy app trên chuỗi hardhat cục bộ thay vì `mock`, và chạy kiểm thử đầu cuối trên đó: xem
[EVM_LOCAL.md](EVM_LOCAL.md).

Nếu cổng 3000 đã bận, Next.js in URL thực tế trong terminal; dùng đúng URL đó. Nếu trình duyệt từng
chọn một vai khác, cookie của trình duyệt được ưu tiên: chọn lại **Giao dịch viên · GDV001** ở góc
trên phải. Hai trình duyệt lưu cookie độc lập, nhưng một trình duyệt sạch luôn bắt đầu ở GDV.

### 1.1. Mint/Burn trên Sepolia (OP-04)

Dùng bản đã triển khai hợp đồng SC-02. Chuẩn bị/cấp phí/whitelist theo
[runbook Sepolia](TESTNET_SEPOLIA.md); dùng ví SPV thử riêng, không dùng ví mẫu ở bảng Mock.

Đặt trong `app/.env.local` bằng trình soạn thảo:

```dotenv
NEXT_PUBLIC_DEFAULT_CHAIN=evm
RPC_EVM=
SERVER_SIGNER_PRIVATE_KEY_EVM=
USE_MOCK_DB=true
ENABLE_SEPOLIA_DEMO_PROJECT=true
ENABLE_DEMO_TOKEN_MINT=false
ENABLE_DEMO_PAYMENT_MINT=false
```

Điền RPC Sepolia và khóa ví ngân hàng đã deploy `0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076` vào hai dòng trống.
Cờ `ENABLE_SEPOLIA_DEMO_PROJECT` đăng ký dự án WPT trong ứng dụng, không tự mint.
Cờ nạp VNDB đang tắt vì lượt này chỉ kiểm WPT. Không đặt `NEXT_PUBLIC_ADDR_EVM_*`;
địa chỉ hợp đồng lấy từ nguồn shared đã commit. Không commit `.env.local`.

Từ thư mục `app`, dựng bản phát hành và chạy:

```bash
npm run build
npm start
```

Máy có HTTP(S) proxy, gặp lỗi đọc RPC timeout: dùng `npm run start:proxy` thay `npm start`,
không cần dựng lại. Lệnh này giúp Node fetch dùng proxy môi trường và bỏ qua localhost.
Đo nhanh một tiến trình có thể giữ `USE_MOCK_DB=true`. Muốn kiểm đúng chế độ bền OP-06, đổi thành
`USE_MOCK_DB=false`, đặt `DATABASE_URL` và chạy `docker compose up -d db`; khi đó có thể restart app
mà lịch sử vẫn còn.

Trên giao diện chọn **EVM Testnet (Sepolia)**:

1. Giao dịch viên → **Lập lệnh**, nhập `WPT`, ví SPV
   `0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd`, số lượng `1000`, điền lý do/ngày hiệu lực theo biểu mẫu rồi gửi yêu cầu.
2. Kiểm soát viên → **Phê duyệt lệnh**, mở đúng yêu cầu và chấp nhận. Chờ **Hoàn tất**, lưu mã giao dịch.
3. Lặp lập–duyệt Mint bổ sung `2000` vào cùng SPV.
4. Lập–duyệt Burn `300`, nguồn **Phần chưa phân phối**.

Nếu bắt đầu với hợp đồng chưa phát hành và không có giao dịch khác xen vào, tổng cung/số dư SPV
lần lượt là **1.000 → 3.000 → 2.700 WPT**. Vòng local ngày 08/10/2026 đã chạy đúng kết quả này;
receipt và trạng thái từng block ở [checkpoint giao dịch](CHECKPOINT_OP04_TXS.md).
Hợp đồng hiện đã phát hành: lần Mint tiếp theo là bổ sung, không đặt lại trạng thái hoặc deploy lại
để lặp lượt đầu. Hai vai ngân hàng dùng server signer, không cần nối ví trình duyệt để lập–duyệt.

Để xem trong MetaMask, chọn mạng **Sepolia**, tài khoản SPV, rồi **Import tokens → Custom token**:

| Trường | Giá trị |
|---|---|
| Địa chỉ WPT | `0xB8e9Add2A9A4968f7BD5c1a8BfB43a55761E6A02` |
| Ký hiệu | `WPT` |
| Decimals | `0` |

Ví ngân hàng ký giao dịch trả phí; WPT nằm ở ví SPV. Xem số dư và lịch sử tại
[Etherscan của SPV/WPT](https://sepolia.etherscan.io/token/0xB8e9Add2A9A4968f7BD5c1a8BfB43a55761E6A02?a=0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd).
Địa chỉ ở đây là bộ demo OP-04; khi deploy bộ khác, đối chiếu lại `packages/shared/src/addresses.json`.

Cloudflare: `RPC_EVM` và `SERVER_SIGNER_PRIVATE_KEY_EVM` là **runtime Secrets**;
`USE_MOCK_DB=false`, `ENABLE_SEPOLIA_DEMO_PROJECT=true` và các cờ demo lấy từ `wrangler.json`.
`NEXT_PUBLIC_DEFAULT_CHAIN=evm` đặt ở **build**;
`NEXT_PUBLIC_RPC_EVM` tùy chọn, chỉ dùng RPC công khai cho ví trình duyệt.
Không đặt khóa deploy/cấp phí lên Worker. Bảng đầy đủ và bước kiểm sau merge ở
[runbook mục 6](TESTNET_SEPOLIA.md#6-cloudflare-chủ-dự-án-đặt-secret-chạy-sau-merge).
Lịch sử nghiệp vụ lưu trong Neon qua Hyperdrive và phải còn sau khi đóng/mở trình duyệt hoặc Worker
đổi isolate. Chain `mock` vẫn giữ số dư trong RAM, nên kiểm deploy bền phải chọn `evm` (Sepolia).

### 1.2. Thiết lập Neon + Cloudflare Hyperdrive (OP-06)

Phần này chỉ làm một lần cho mỗi môi trường deploy. Không gửi hoặc commit mật khẩu/connection string.

1. Trong Neon, mở project → **Roles** → **New Role**, tạo role riêng như `hyperdrive-user` và lưu
   mật khẩu. Role cần quyền tạo bảng ở lần chạy đầu.
2. Mở **Connection Details**, chọn đúng branch, database và role vừa tạo. Sao chép chuỗi **Direct
   connection** (không chọn pooled connection).
3. Cloudflare Dashboard → **Storage & Databases → Hyperdrive → Create configuration**; dán chuỗi
   Neon, tạo cấu hình.
4. Mở cấu hình vừa tạo. Chuỗi 32 ký tự hiển thị ở trường **ID** là Hyperdrive ID; đây không phải
   secret. Có thể đối chiếu bằng:

   ```bash
   cd app
   npx wrangler login
   npx wrangler hyperdrive list
   ```

5. Điền ID vào `app/wrangler.json`, binding phải tên `HYPERDRIVE`. Repo hiện dùng
   `bf7828b9f4bb42de9f65123d0f00e4a3`. Không điền Neon URL vào tệp này.
6. `wrangler.json` phải giữ `USE_MOCK_DB=false`, `ENABLE_SEPOLIA_DEMO_PROJECT=true`; signer và RPC
   có API key đặt dạng **Secret** trên đúng Worker. Build/deploy lại từ `dev`.
7. Kiểm sau deploy: Giao dịch viên lập một yêu cầu, Kiểm soát viên duyệt trong lượt/trình duyệt khác,
   đóng rồi mở lại trang chi tiết. Trạng thái và lịch sử phải còn.

Chạy Worker local với Postgres thường (không chạm Neon):

```bash
docker compose up -d db
bash scripts/evm-local.sh up
cd app
NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local npm run cf:build
set -a
source ../.env.example
set +a
npx wrangler dev --port 8787 \
  --var USE_MOCK_DB:false \
  --var NEXT_PUBLIC_DEFAULT_CHAIN:hardhat-local \
  --var RPC_HARDHAT:http://127.0.0.1:8545 \
  --var SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL:$SERVER_SIGNER_PRIVATE_KEY
```

Khóa trong lệnh cuối là khóa test công khai của Hardhat account #0 trong `.env.example`, tuyệt đối
không thay bằng khóa mạng thật. `localConnectionString` trong `wrangler.json` trỏ DB local. Nếu
Hardhat do một terminal ngắn hạn dựng bị dừng theo terminal, giữ `npx hardhat node` chạy ở một cửa
sổ riêng rồi deploy/seed như `scripts/evm-local.sh`; lỗi `HTTP request failed` khi đọc WPT thường là
nút RPC đã dừng, không phải lỗi Hyperdrive.

Hạn Workers Free hiện là 100.000 câu lệnh Hyperdrive/ngày. Cách đổi Neon sang Supabase/Postgres tự
dựng, sao lưu/khôi phục và nguồn tài liệu chính nằm ở [DEPLOYMENT.md](DEPLOYMENT.md#cơ-sở-dữ-liệu-bền-qua-hyperdrive-op-06).

### Dữ liệu Mock dùng xuyên suốt

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

## 5. Nhà đầu tư đặt mua và hệ thống tự quyết toán

### 5.1 Nhà đầu tư đặt lệnh mua

1. Đổi sang **Nhà đầu tư · NDT001**.
2. Mở **Giao dịch token** (`/trade`). Ở chain Mock, trang ghi rõ đang dùng ví trong hồ sơ NDT001;
   không cần MetaMask hay nút **Kết nối ví**.
3. Chọn tab **Mua**, nhập **Số lượng** `2`.
4. Chờ năm điều kiện trong **Kiểm tra trước lệnh** đều đạt. Tổng dự kiến phải là `200.000 VNDB`.
5. Bấm **Xác nhận lệnh mua**, đối chiếu hộp **Đối chiếu lệnh lần cuối**, rồi bấm **Gửi lệnh**.
6. Ở khối **Lệnh mua vừa gửi**, ghi lại mã lệnh (có thể bấm **Xem chi tiết**). Trên Mock, kết quả
   đúng xuất hiện ngay trong chính lần gửi: **Hoàn tất**, có **Mã giao dịch mô phỏng** và đủ năm
   bước quyết toán. Không cần đổi vai hay bấm thêm nút nào.

### 5.2 Giao dịch viên theo dõi và chỉ can thiệp lệnh kẹt

1. Đổi về **Giao dịch viên · GDV001** → mở **Giao dịch** (`/transactions`).
2. Tìm theo tám ký tự đầu mã lệnh hoặc chọn Nhà đầu tư tương ứng.
3. Kiểm tra chiều **Mua**, `2 WPT`, `200.000 VNDB`, trạng thái **Hoàn tất**. Dòng hoàn tất không
   có nút hành động.
4. Bấm mã lệnh để xem **Tiến trình quyết toán** năm bước và mã giao dịch mô phỏng.

Sau khi tự quyết toán: NDT001 có `2 WPT` và `800.000 VNDB`; số WPT chưa phân phối giảm còn
`19.999.998`.
Đổi sang **Kiểm soát viên** và mở cùng trang để trình diễn chế độ chỉ đọc: KSV thấy toàn bộ lệnh
nhưng không có hành động can thiệp.

Chỉ khi tiến trình bị gián đoạn, cột **Hành động** mới đổi theo tình trạng an toàn:

- **Đang kiểm tra**: nút **Tiếp tục quyết toán** chạy lại bộ kiểm rồi mới được phát giao dịch.
- **Đang xử lý** và đã có mã giao dịch: nút **Đối soát giao dịch** chỉ đọc biên nhận, không phát lại.
- **Đang xử lý** nhưng chưa có mã giao dịch: hiện **Cần đối soát tay** và không có nút phát lại,
  vì giao dịch có thể đã lên chuỗi trước khi tiến trình mất kết nối.

### 5.3 Nhà đầu tư đối chiếu lệnh của mình

1. Đổi sang **Nhà đầu tư · NDT001** → **Quản lý lệnh** (`/orders`).
2. Dòng vừa tạo phải có chiều **Mua** và trạng thái **Hoàn tất**.
3. Bấm **Chi tiết** để đối chiếu tiến trình và mã giao dịch. Mở lại **Giao dịch token** để đối chiếu
   số dư `2 WPT` và `800.000 VNDB` ở khối **Tóm tắt lệnh**.

## 6. Luồng bán WPT ngược lại cho SPV

1. Vẫn ở **Nhà đầu tư**, mở **Giao dịch token** và chọn tab **Bán**.
2. Nhập `1`. Khối kiểm tra phải đạt vì Nhà đầu tư đang giữ `2 WPT` và ví SPV đã nhận `200.000 VNDB`
   từ lệnh mua.
3. Bấm **Xác nhận lệnh bán** → **Gửi lệnh**; ghi mã lệnh mới. Khối lệnh vừa gửi phải hiện
   **Hoàn tất** và mã giao dịch ngay, giống chiều mua.
4. Mở **Quản lý lệnh** và xác nhận lệnh bán **Hoàn tất**. Có thể đổi sang Giao dịch viên để đối
   chiếu cùng lệnh ở màn **Giao dịch**, nhưng không cần bấm hành động nào.

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
| Sepolia báo chưa có dự án WPT | Bật `ENABLE_SEPOLIA_DEMO_PROJECT=true`, dựng/khởi động lại app trước vòng giao dịch đầu. |
| Đọc WPT báo `The request took too long to respond` trên máy có proxy | Dừng app và chạy `npm run start:proxy`; giữ cấu hình RPC Sepolia. |
| MetaMask chưa hiện WPT | Chọn Sepolia và đúng tài khoản SPV; import hợp đồng WPT với decimals 0 theo mục 1.1. |
| Nút gửi Mint/Burn bị khóa | Đọc dòng **Chưa gửi được** và điều kiện không đạt; thường do chưa whitelist SPV, thiếu lý do, vượt số còn phát hành/chưa phân phối. |
| Lệnh mua không đạt | Phải whitelist NDT001, nạp VNDB, phát hành WPT vào SPV và dùng đúng ví hồ sơ ở bảng đầu tài liệu. |
| Lệnh ở **Đang xử lý** nhưng không có mã giao dịch | Không bấm hay gọi lại đường phát giao dịch. Giao dịch có thể đã lên chuỗi; màn Vận hành sẽ hiện **Cần đối soát tay**. |
| Hai trình duyệt thấy dữ liệu khác nhau sau deploy serverless | Memory DB/mock ledger gắn với từng tiến trình. Demo nhiều người ổn định phải dùng một instance hoặc Postgres/chain dùng chung. |
| Đổi chain trên bản deploy sang Hardhat Local rồi báo thiếu khóa ký | Đây là đúng hành vi: chain thật cần khóa ký. Mock không cần khóa; trên Cloudflare muốn dùng chain thật phải cấu hình secret signer và RPC truy cập được. |

## 9. Chuyển sang môi trường thật

Chain `mock` không cần khóa ký; bản trình diễn mặc định chạy được mà không cấu hình khóa.
Chain thật (`hardhat-local`, `evm`) vẫn cần khóa ký theo chain: `SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL` /
`SERVER_SIGNER_PRIVATE_KEY_EVM` (hoặc khóa chung `SERVER_SIGNER_PRIVATE_KEY`); trên Cloudflare phải đặt
biến này làm **secret của Worker**, không đưa vào source hay biến công khai.

Guide này không phải runbook production. Tối thiểu phải đặt:

```dotenv
ENABLE_DEMO_PAYMENT_MINT=false
ENABLE_DEMO_TOKEN_MINT=false
USE_MOCK_DB=false
```

Sau đó cấu hình `DATABASE_URL`, signer/RPC theo chain, thay `DEMO_ROLE` và cookie PoC bằng phiên xác
thực (AU-01). SC-02 đã hoàn tất và Mint/Burn Sepolia đã được kiểm chứng local trong OP-04;
mua/bán trên Sepolia vẫn cần SC-03. Các kết quả testnet này chưa thay thế nghiệm thu production.
