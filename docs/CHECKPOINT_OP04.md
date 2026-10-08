# Báo cáo bàn giao — OP-04: triển khai lại Sepolia sau SC-02

| | |
|---|---|
| Mã task | OP-04 |
| Nhánh | `ops/04-sepolia`, từ `dev` @ `dd015a1` (SC-02, PR #42) |
| Spec | `docs/op-04-sepolia/{requirements,tasks}.md`, gói 20261008_spec_OP04_IN03_DS01.zip |
| Mức kiểm chứng | Vừa |
| Tiến độ | Đã chuẩn bị Bước 0–2; Bước 3–5 chờ chủ dự án; giữ `inProgress`, chưa mở PR |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | Script cấp phí, đúng ca 1, có kiểm thử | ✅ | mục 2.1; chi tiết 2 |
| 2 | Preflight kiểm phí ví ký và in lệnh cấp phí | ✅ | mục 2.2; chi tiết 2, 3 |
| 3 | Sepolia triển khai lại, địa chỉ evm đã commit, verify trạng thái đầu | 🔶 | mục 3.1 |
| 4 | Ví SPV thử riêng Sepolia, không dùng ví mẫu | 🔶 | mục 3.2 |
| 5 | Ba giao dịch Mint/Mint/Burn trên Sepolia có Etherscan | 🔶 | mục 3.3 |
| 6 | Bản deploy chọn Sepolia, smoke xanh, thử lập–duyệt được ghi lại | 🔶 | mục 3.4 |
| 7 | Runbook Sepolia và bảng biến Cloudflare đúng hiện trạng | ✅ | mục 2.3 |
| 8 | Không bí mật trong lịch sử commit nhánh | ✅ | mục 4.2 |
| 9 | Bộ kiểm chứng mặc định xanh | ✅ | mục 4.1 |

**Kết luận:** 5 ✅ · 4 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết / thực hiện

- Chủ dự án chạy các bước có khóa và Cloudflare theo runbook, trả output không chứa bí mật.
- Owner xác nhận giữ ví 0xCa49…9076 làm deployer/signer; cần Owner tạo và gửi địa chỉ SPV riêng, không nhận bí mật qua chat.
- Không đổi DB khi gặp isolate; ghi kết quả thử và đề xuất theo spec. Bước 5 thực hiện sau merge.

## 1. Phạm vi và hiện trạng đo lại

Đã tiếp nhận nguyên văn spec OP-04, kế hoạch giao việc bản 4 và quyết định kiến trúc DS-01 từ gói đính kèm.
Chỉ thực thi OP-04; không thực hiện IN-03 hay xây vault/khớp lệnh.
Commit đầu chuyển đúng OP-04 sang `inProgress`.

Địa chỉ Sepolia trong tệp vẫn là bộ ngày 10/09/2026. RPC công khai đọc selector
`initialSupplyMinted()` trả revert, xác nhận phải triển khai lại. Chưa sửa tay địa chỉ hay ABI.
Lệnh đo và đầu ra nguyên văn ở [chi tiết mục 1](CHECKPOINT_OP04_DETAIL.md#1-đo-lại-hiện-trạng).

## 2. Phần chuẩn bị đã thực hiện

### 2.1 Cấp phí

`fund-sepolia.js` chạy bằng Node, nhận địa chỉ và một trong số dư ETH cần có hoặc tên thao tác.
Chỉ bù chênh lệch, không gửi khi đủ, không tạo signer khi dry-run; chặn sai chain và ví mẫu
trong nguồn chung cộng Hardhat #0. Dùng ethers/transport RPC hiện có, không thêm thư viện.

Gas được đo từ bytecode trên Hardhat nội bộ trong tiến trình riêng cưỡng chế network hardhat;
không gửi giao dịch Sepolia để ước lượng. Giá trần lấy lúc chạy, dự phòng 20%, tính BigInt và làm
tròn lên. Có deploy, whitelist, mint-initial, mint, burn, cycle. Đo nội bộ không ghi địa chỉ shared.

Đã thử đơn vị và dry-run RPC thật với **địa chỉ deployer cũ công khai**, không dùng hay xin khóa.
Đó chỉ là kiểm công cụ, không xác nhận ví ký cho triển khai OP-04. Lượt đầu ethers kết nối trực tiếp
không qua proxy bị lỗi; đã dùng transport sẵn có của Hardhat và dry-run chạy được.
Lệnh và output ở [chi tiết mục 2](CHECKPOINT_OP04_DETAIL.md#2-kiểm-cấp-phí-và-tính-toán).

### 2.2 Preflight

Kiểm hai khóa triển khai/ví ký có cùng địa chỉ và không phải mẫu; kiểm số dư ví ký đủ bốn constructor,
cấp vai, whitelist và Mint/Mint/Burn. Thiếu thì in lệnh cấp số dư cần có để công cụ chỉ bù phần thiếu.
Unit kiểm cả đủ/thiếu và đối chiếu chính lệnh cấp phí in ra. Preflight chạy trên Sepolia thật đã đọc
đúng chain, nhưng báo thiếu hai biến khóa trong môi trường hiện tại, mã 1 đúng chủ ý.
Output ở [chi tiết mục 3](CHECKPOINT_OP04_DETAIL.md#3-preflight-sepolia-thật).

### 2.3 Runbook và kiểm khói

Runbook thay luồng mint cũ bằng lập–duyệt, cấp phí từng bước, SPV riêng, commit địa chỉ cách B,
whitelist, chạy bản build local một tiến trình, ghi receipt và quy trình Cloudflare sau merge.
Bảng biến xác định RPC_EVM và khóa ký là runtime Secret; NEXT_PUBLIC_RPC_EVM chỉ dùng RPC công khai.
Không đưa khóa tổng lên Worker. Báo cáo công nghệ cập nhật metadata, cây thư mục, bảng công cụ và mục 4.3.

Kiểm khói dùng đường GET token có sẵn đi qua ledger EVM, kiểm thêm WPT/decimals/tổng cung khi chain evm.
Đã kiểm CLI bằng HTTP giả lập cho dữ liệu đúng/sai, xác nhận chỉ GET. **Đây không phải bằng chứng
Cloudflare hay ứng dụng đã đọc Sepolia thật.** Kết quả thật còn chờ mục 3.4.
Output fixture ở [chi tiết mục 4](CHECKPOINT_OP04_DETAIL.md#4-kiểm-cli-smoke-bằng-fixture).

## 3. Bước chưa chạy và bàn giao chủ dự án

### 3.1 Triển khai và verify

Chưa triển khai Sepolia, chưa commit bộ địa chỉ mới, chưa có output verify trạng thái đầu.
Theo spec tasks Bước 3: **“[Chủ dự án]”**, **“Gửi lại cho người viết mã: đầu ra nguyên văn của
preflight, deploy, verify (không kèm khoá), và địa chỉ ví SPV thử.”** Môi trường này không có khóa.
Thực hiện [runbook mục 1–3](TESTNET_SEPOLIA.md#1-chuẩn-bị-ví-và-biến-bí-mật-chủ-dự-án) rồi trả output an toàn.

### 3.2 Ví SPV

Chủ dự án đã chốt giữ 0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076 làm deployer/signer, tạo SPV riêng.
Chưa có địa chỉ SPV mới được gửi lại. Không dùng NB001 hay tự ghi địa chỉ giả.
Chủ dự án tạo ví, ghi public address vào runbook và whitelist theo mục 4.

### 3.3 Ba giao dịch

Chưa có giao dịch/receipt OP-04; không tái dùng tx Hardhat SC-02 hay dựng tx hash.
Chủ dự án/người giữ khóa chạy app bản build và lập–duyệt Mint/Mint/Burn theo runbook mục 5,
trả mã yêu cầu, tx hash, receipt và số dư sau từng bước.

### 3.4 Cloudflare

Chưa đặt secret hay triển khai Worker. Chủ dự án đã cung cấp URL Cloudflare;
đã đọc metadata bản hiện hành dd015a1 và chạy kiểm khói trước cấu hình OP-04 (chi tiết mục 4).
Kết quả đó chưa phải kiểm bản OP-04 sau merge.
Theo spec tasks Bước 5, cần nhánh đã merge để Workers Builds dựng từ dev; điều kiện 6 chỉ chuyển
✅ sau khi kiểm khói và ghi kết quả lập–duyệt, kể cả khi hỏng do isolate. Không sửa DB trong OP-04.
Không chuyển task sang done hoặc tuyên bố nghiệm thu khi các bằng chứng này chưa có.

## 4. Kiểm chứng và lịch sử

### 4.1 Bộ mặc định

Bộ mặc định mã 0: 84 ca contract, 790 ca app đạt; 10 ca RPC SC-02 bỏ qua trong bộ mặc định.
Typecheck, lint, arch, marker, checkpoint đều đạt. Lệnh và toàn bộ đầu ra ở chi tiết mục 5.

### 4.2 Bí mật

Đã kiểm mẫu bí mật trong lịch sử commit nhánh theo spec, không có kết quả khớp.
Đây là phép quét mẫu được spec chỉ định, không phải kiểm chứng mọi loại bí mật có thể có.
Lệnh và đầu ra ở chi tiết mục 6.
Không nhận hay đưa khóa/API key/email vào spec, mã, log hoặc checkpoint.

### 4.3 Khuôn checkpoint

Kiểm đủ 9 dòng điều kiện, giữ các bằng chứng Sepolia/Cloudflare còn thiếu ở trạng thái 🔶.
Output kiểm khuôn ở chi tiết mục 7.
