# Báo cáo bàn giao — SC-10: Vá hợp đồng và cap WPT

| | |
|---|---|
| Task | SC-10 |
| Nhánh | `fix/sc-10-va-hop-dong`, từ `dev` @ `ecc3450` (PR #52) |
| Spec | `docs/sc-10-va-hop-dong/{requirements,tasks}.md`; DS-01 bản 3 |
| Mức kiểm chứng | Cao |
| Tiến độ | Hoàn tất; bộ hợp đồng và Mint/Burn Sepolia sau PR #55 đã được đối chiếu |

## 0. Tóm tắt nghiệm thu

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | ProfitDistributor QĐ-1, chặn lỗi tái hiện, ca 1–6 | ✅ | mục 1.1 · 3.1 |
| 2 | Cưỡng chế báo bộ luật, không canTransfer, ca 7–9 | ✅ | mục 1.2 · 3.1 |
| 3 | Bộ cũ xanh, không nới điều kiện, ca 10 | ✅ | mục 3.1 |
| 4 | Đột biến đỏ đúng ca, ca 11 | ✅ | mục 2 |
| 5 | App/Job A/Hardhat thật xanh, bí mật sạch, ca 12 | ✅ | mục 3.2–3.4 |
| 6 | Tài liệu và task-status cập nhật | ✅ | mục 4 |
| 7 | Owner deploy lại Sepolia, đăng ký SPV, deploy Worker, Mint đầu | ✅ | Phụ lục A |

**Kết luận:** 7 ✅ · 0 🔶 · 0 ❌. `SC-10` chuyển sang `done` trong task SC-07.

**Việc Owner quyết/chạy:** CH-1 đã chốt có trần 20.000.000 WPT ngày 19/10/2026. Sau merge,
chạy runbook SC-09/SC-10 một lần và gửi mã giao dịch Mint đầu để đóng điều kiện 7 (và SC-09).

## 1. Thay đổi và quyết định

### 1.1 Quỹ kỳ

Lưu claimDeadline/closed. Kiểm đóng kỳ/hết hạn trước hasClaimed để cả lần nhận lại vào kỳ đóng
cũng revert. Bất biến claimed + amount <= amount của kỳ đặt trước ghi dấu/chuyển VNDB.
Sweep đóng được kỳ đã chi hết; chỉ phát DustSwept khi có chuyển, luôn phát DistributionClosed.
claimWindow mới chỉ áp cho kỳ tạo sau. Không sửa công thức entitlement/snapshot hoặc lớp Oracle.
Solidity không cho error/event cùng tên trong một scope: error DistributionClosed đặt trong
interface IProfitDistributorErrors ngay trong file; ABI vẫn có error và event đúng tên theo spec,
không thêm thư viện. Giữ lỗi chuỗi trước hạn của sweep để bộ cũ không bị nới/đổi ý nghĩa.

### 1.2 Callback cưỡng chế

Chỉ đọc compliance bắt buộc, super._update rồi transferred/destroyed; không gọi canTransfer hoặc
isVerified bên gửi. forcedTransfer vẫn giữ kiểm bên nhận. HolderCountModule chỉ dùng test, gắn
trước mint, action chỉ compliance cấu hình được gọi. deploy.js không triển khai module test.

### 1.3 CH-1 Owner duyệt

cap immutable, tham số cuối constructor, đơn vị nhỏ nhất. Deployment hiện decimals 0, cap
20.000.000 WPT từ shared/src/token-parameters.json; app WPT_TOTAL_SUPPLY và script/fixture dùng
cùng nguồn. Mọi mint kiểm tổng cung hiện tại, không phải tổng mint suốt đời; burn không reset
initialSupplyMinted và chỉ được mint bù trong cap. Không setter cap. Cập nhật constructor ở script
triển khai/demo, ước phí và fixture; verify đọc cap; địa chỉ hardhat-local giữ nguyên thứ tự deploy.

## 2. Đột biến

Các nhóm 11a–11f đều đỏ đúng ca; nhóm e chạy riêng thiếu transferred và thiếu destroyed.
Hoàn nguyên nguồn sau mỗi lần bằng finally, git status sạch ngay sau đột biến. Nguồn script và
đầu ra đầy đủ ở [CHECKPOINT_SC10_MUTATIONS_DETAIL.md](CHECKPOINT_SC10_MUTATIONS_DETAIL.md), mục 1–3.

## 3. Kiểm chứng

### 3.1 Đo trước, đỏ trước sửa và xanh sau sửa

[CHECKPOINT_SC10_TEST_DETAIL.md](CHECKPOINT_SC10_TEST_DETAIL.md) mục 1–4: số đo nền, baseline, lỗi A chi 200/100 lấy hết B,
profit/callback/cap đỏ trước sửa, bộ hợp đồng cũ + mới xanh, ABI khớp. Không đổi assert bộ cũ;
các fixture/script cũ chỉ thêm cap constructor theo CH-1.

### 3.2 Bộ mặc định và Job A

Bằng chứng nguyên văn tại [CHECKPOINT_SC10_VERIFICATION_DETAIL.md](CHECKPOINT_SC10_VERIFICATION_DETAIL.md) mục 5–6; cả hai lượt exit 0.

### 3.3 Adapter trên Hardhat thật

Bằng chứng tại [CHECKPOINT_SC10_VERIFICATION_DETAIL.md](CHECKPOINT_SC10_VERIFICATION_DETAIL.md) mục 7; dùng nút/cổng riêng, không reset nút Owner.

### 3.4 Bí mật

Quét sạch các commit mã/ABI: [CHECKPOINT_SC10_VERIFICATION_DETAIL.md](CHECKPOINT_SC10_VERIFICATION_DETAIL.md) mục 8; không đưa credential ngoài máy vào repo. Khóa trong test/script là
account Hardhat công khai. Không dùng private key hay RPC testnet để kiểm task.

## 4. Tài liệu và trạng thái

DS-01 bản 3 và spec từ zip đã nhập, CH-1 ghi nhận trong requirements. tech-report cập nhật cùng
các commit theo mục tiêu; shared ABI có cap/lỗi và deadline/closed/error/event mới. README hợp đồng
và runbook Sepolia ghi constructor cap, giữ quy trình SC-09 và triển khai lại một lần sau merge.
SC-09/SC-10 đều giữ inProgress tới bằng chứng Owner. Không thêm marker chờ SC-10.

## 5. Owner sau merge

Chưa triển khai testnet trong task. Chạy TESTNET_SEPOLIA.md: preflight/cấp phí/deploy/verify,
đăng ký ví SPV, commit địa chỉ evm mới, deploy Worker, duyệt Mint đầu, gửi hash/receipt/block.
Chỉ khi có bằng chứng này mới đổi điều kiện 7 sang ✅ và đóng SC-10 cùng SC-09.

## Phụ lục A. Bằng chứng Sepolia sau PR #55 — 19/10/2026

Nguồn: Supervisor đọc trực tiếp trên chuỗi. ProjectToken
`0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62`, IdentityRegistry
`0xA1Fb6C6831a4C1A66D6CE0090D2790Cd37a4b950`; `cap = 20000000`; ví SPV
`0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd` đã xác minh.

| Lượt | Mã giao dịch | Block | Kết quả |
|---|---|---:|---|
| Mint đầu | `0xaa529aa41b03174d3b494eec254fb0876a7f44b1657253d18eef08e3f62f6f20` | 11947924 | Thành công; 1.000 WPT vào SPV |
| Burn | `0x6b68b7571b93a37a738b99e9966e6cebb2b2bc0b1ee4edfaee96143f025257d8` | 11947952 | Thành công; 1.000 WPT bị huỷ |
| Mint bổ sung | `0x246804b1bc59a9d263b73a25b4f82ed1443d880c990a5c4d0f0ae2be0980f6aa` | 11947989 | Thành công; tổng cung và số dư SPV sau đó 1.000 WPT |
