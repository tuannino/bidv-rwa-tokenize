# Kế hoạch đợt 5 tới đợt 8 (bản 3, chốt tối 07/10/2026)

> Thay toàn bộ các bản `GIAO_VIEC_DOT_5.md` trước. Tệp Excel đi kèm: `20261008_ke_hoach_v6.xlsx`
> (sheet "Task Plan" và "Nhật ký thay đổi v6"). Sheet "Tổng quan" của Excel cộng cả task đã xong trong đợt, nên đợt 5 ở đó là 34 điểm (gồm OP-02, BE-17, G-07 đã xong).
> Nền: `dev` @ `e4dd889` (BE-17 đã merge qua PR #40).

## 1. Mục tiêu từng đợt

| Đợt | Mục tiêu chủ dự án chốt | Mốc dự kiến | Điểm còn làm |
|---|---|---|---|
| **5** | Mint/Burn lập duyệt **chạy thật trên hardhat và Sepolia** | 08/10 tới 19/10 | 18 |
| **6** | **Mua bán chạy trên chuỗi**, ví thanh toán SPV là **vault**. Song song: **Fireblocks** ký Mint/Burn | 20/10 tới 07/11 | 39 |
| **7** | Rút VNDB, màn Cấu hình, luồng chia lợi nhuận mới trên vault chia lợi nhuận | 10/11 tới 28/11 | 51 |
| **8** | Xác thực thật, tất toán, đối soát, Indexer, nghiệm thu | 01/12 tới 19/12 | 107 |

Tốc độ đo được để làm căn cứ: đợt S4 (01/10 tới 07/10) nghiệm thu 7 task, 45 điểm, trong 5 ngày làm
việc. Đợt 8 có 107 điểm trong 15 ngày làm việc, tức khoảng 7 điểm mỗi ngày, thấp hơn mức đã đạt (9 điểm mỗi ngày) nhưng **không còn dư nhiều**, vì task hợp đồng khó hơn task giao diện; nếu trễ thì phần nên lùi là Indexer
(SC-08, IN-01, IN-02), không lùi xác thực và nghiệm thu.

## 2. Đợt 5: Mint/Burn trên hardhat và Sepolia

### 2.1. Hiện trạng đã đo (07/10, cây `e4dd889`)

```bash
grep -c "@blocked" app/src/lib/ledger/evm.adapter.ts          # 13
cd packages/contracts-evm && npx hardhat node &
npx hardhat run scripts/deploy.js --network localhost           # trien khai duoc, dia chi trung addresses.json
cd app && E2E_CHAIN=hardhat-local npx playwright test e2e/mint.spec.ts e2e/wallet-connect.spec.ts
# 12 xanh / 1 do; ca do gia dinh chain mac dinh la mock, loi cua ca test
```

| Luồng | `mock` | `hardhat-local` | Sepolia |
|---|---|---|---|
| Kết nối ví, số dư, whitelist | Chạy | Chạy | Bộ chọn chain đang khoá (Worker thiếu RPC) |
| Lập duyệt Mint/Burn | Chạy | Chặn, SC-02 | Chặn, SC-02; bộ hợp đồng cũ |
| Mua bán tự khớp | Chạy | Chặn, SC-03 | Chặn, SC-03 |
| Chia lợi nhuận, tất toán | Chạy | Chặn, SC-05, SC-04 | Chặn |

### 2.2. Các task

| Vòng | Mã | Tên | Điểm | Mức | Nhánh | Phụ thuộc |
|---|---|---|---|---|---|---|
| 1 | **OP-03** | Hardhat một lệnh, ví mẫu trên chuỗi, đầu cuối trên bản build, project `hardhat` | 5 | Vừa | `ops/03-evm-local` | |
| 1 | **SC-02** | Lập duyệt Mint/Burn trên EVM: `ProjectToken` giữ ví SPV và cờ lần đầu | 10 | Cao | `feat/sc-02-evm-issuance` | bước đầu cuối cần OP-03 |
| 2 | **OP-04** | Triển khai lại Sepolia bằng bytecode SC-02, mở bộ chọn chain Sepolia | 3 | Vừa | `ops/04-sepolia` | SC-02, OP-03 |

Ranh giới song song vòng 1: OP-03 không sửa hợp đồng, adapter, ABI; SC-02 không sửa
`run-local-all.sh`, CI, cấu hình Playwright. Cả hai sửa `deploy.js` (OP-03 phần ghi tệp, SC-02 phần
vai) và `task-status.json`; ai merge sau thì rebase.

OP-04 cần thứ chỉ chủ dự án có (khoá ví triển khai, ETH Sepolia, RPC có API key). Người viết mã chuẩn
bị script và runbook; chủ dự án chạy triển khai và đặt biến trên Cloudflare. Spec viết sau khi vòng 1
merge.

**Hết đợt 5:** trên hardhat và Sepolia chạy được kết nối ví, whitelist, nạp VNDB mô phỏng, lập duyệt
Mint và Burn vào ví thanh toán SPV (lúc này vẫn là ví thường), số liệu nguồn cung đọc từ chuỗi. Giao
dịch ký bằng khoá phía máy chủ.

## 3. Đợt 6: mua bán trên chuỗi với vault thanh toán, Fireblocks song song

### 3.1. Vì sao kéo vault thanh toán lên đợt này

- Hợp đồng khớp lệnh (SC-03) lấy WPT ra khỏi ví thanh toán và đưa VNDB vào ví đó. Làm SC-03 với ví
  thường thì ví phải cấp ủy quyền cho hợp đồng; chuyển sang vault sau đó là làm lại phần lõi.
- Ví SPV được ghi cố định vào `ProjectToken` ở lần Mint đầu (SC-02). Vault có sẵn trước khi chốt bộ
  hợp đồng Sepolia cuối thì không phải đổi ví SPV.
- Vault chia lợi nhuận **không** kéo lên, vì luồng chia (BE-18) chưa chốt.

### 3.2. Các task

| Làn | Mã | Tên | Điểm | Mức | Phụ thuộc |
|---|---|---|---|---|---|
| Chuỗi | **DS-01** | Ghi chú kiến trúc hợp đồng đợt 6. Supervisor viết, chủ dự án duyệt. Không vào `task-status.json` | 3 | | |
| Chuỗi | **SC-07** | Vault thanh toán SPV: giữ WPT chưa bán và VNDB thu về, cấp quyền cho hợp đồng khớp lệnh, luật khoá (mục 5), đường rút của SPV | 10 | Cao | DS-01, SC-02 |
| Chuỗi | **SC-03** | Hợp đồng khớp lệnh mua bán nguyên tử, làm việc với vault; gỡ 5 điểm chặn SC-03 | 13 | Cao | SC-07, BE-14 |
| Chuỗi | **FE-05** | Bước cấp ủy quyền VNDB của Nhà đầu tư khi chạy chain thật (phạm vi chốt ở DS-01) | 3 | Vừa | SC-03 |
| Chuỗi | **OP-05** | Triển khai lại Sepolia với vault và hợp đồng khớp lệnh, kiểm khói mua bán | 2 | Vừa | SC-03 |
| Fireblocks | **IN-03** | Nghiên cứu Fireblocks sandbox: cách gửi lời gọi hợp đồng, chính sách duyệt, theo dõi trạng thái | 3 | | |
| Fireblocks | **IN-04** | `ISigner` loại `fireblocks` ký giao dịch Mint/Burn; cấp vai trên hợp đồng cho địa chỉ Fireblocks; runbook | 5 | Cao | IN-03, SC-02 |

Hai làn đụng hai vùng mã khác nhau (hợp đồng và adapter, so với `lib/signer`), nên chạy song song
được. IN-04 dùng lại khung hardhat của OP-03 để thử trước khi lên Sepolia.

**Hết đợt 6:** mua bán tự khớp chạy trên hardhat và Sepolia, ví thanh toán SPV là vault. Mint/Burn ký
được qua Fireblocks sandbox.

## 4. Đợt 7: rút VNDB, màn Cấu hình, chia lợi nhuận

| Mã | Tên | Điểm | Phụ thuộc | Ghi chú |
|---|---|---|---|---|
| **BE-18** (mới) | Thiết kế lại nghiệp vụ chia lợi nhuận theo ý chủ dự án | 8 | DS-01 | Xem 6 |
| **SC-06** | Vault chia lợi nhuận: chỉ nạp vào, không rút ra | 8 | BE-18, SC-07 | `ProfitDistributor.sol` có `sweepDust` cho quản trị rút phần dư, trái luật "chỉ nạp vào". Phải xử lý |
| **SC-05** | `distributeBatch` mang mã kỳ | 3 | SC-06 | |
| **BE-13** | Nghiệp vụ rút VNDB trên vault (SPV rút có luật khoá; Nhà đầu tư rút) | 8 | SC-07 | Spec v1 (`20261007_spec_BE13_FE07_v1.zip`) **lỗi thời**, viết lại |
| **FE-07** | Màn Cấu hình: giá phát hành (Giao dịch viên), hạn mức khoá (Kiểm soát viên, đẩy xuống vault), tình trạng phát hành | 6 | BE-13 | Spec v1 lỗi thời |
| **FE-23** | Màn Rút VNDB của Nhà đầu tư | 5 | BE-13 | |
| **FE-08** | Màn Chia lợi nhuận, quyền đọc đủ cho Kiểm soát viên | 8 | BE-18, SC-06 | |
| **FE-09** | Màn lợi nhuận của Nhà đầu tư | 5 | FE-08 | |

## 5. Luật khoá ví thanh toán (chủ dự án chốt tối 07/10)

Áp cho **ví thanh toán** (VTT, nơi nhà đầu tư trả VNDB khi mua). Kiểm soát viên cấu hình. Chủ dự án
muốn về lâu dài cấu hình nằm trong hợp đồng; SC-07 lưu tham số trên vault, máy chủ đẩy xuống.

| Chế độ | Phần khoá của kỳ T | Được rút |
|---|---|---|
| `FIXED` | Một số VNDB cố định | Số dư VTT trừ phần khoá |
| `PERCENT` (phần trăm **khoá**) | P% nhân **số VNDB đã chia ở kỳ T trừ 1** (ví chia lợi nhuận). **Kỳ đầu:** P% nhân giá trị lượng token đã bán ra | Số dư VTT trừ phần khoá |

Ví dụ: P = 20, kỳ trước đã chia 29.217.000.000, kỳ này khoá 5.843.400.000.

Hệ quả cho thứ tự làm: ở đợt 6 chưa có kỳ chia nào trên chuỗi, nên `PERCENT` chỉ chạy với **công
thức kỳ đầu**; từ kỳ thứ hai cần số liệu chia của SC-06 ở đợt 7. `FIXED` chạy đủ ngay ở đợt 6.

**Còn phải xác nhận khi viết spec SC-07:** "giá trị lượng token đã bán ra" ở kỳ đầu là (a) số WPT
đang lưu hành nhân giá phát hành, hay (b) tổng VNDB ví thanh toán đã thu từ bán WPT trừ phần đã chi
mua lại.

## 6. Luồng chia lợi nhuận mới (tạm chốt, trao đổi chi tiết ở BE-18)

- Đầu mỗi kỳ, SPV nạp VNDB vào ví chia lợi nhuận. Kiểm soát viên duyệt để tạo kỳ chia.
- Lợi tức trên 1 token của kỳ = số VNDB ví chia lợi nhuận nhận được chia cho tổng WPT lưu hành.
- Luồng cũ trong mã (BE-06, BE-07) chưa theo ý này.

## 7. Thay đổi `.kiro/task-status.json` (OP-03 làm ở commit đầu)

Thêm **đúng chín mã** vào `planned`: `OP-03`, `OP-04`, `OP-05`, `SC-06`, `SC-07`, `SC-08`, `BE-18`,
`IN-03`, `IN-04`; rồi chuyển `OP-03` sang `inProgress`. Các mã của đợt 8 chưa có trong tệp (`FE-12`,
`FE-14`, `IN-05`, `QA-02`, `QA-03`) thêm khi đợt 8 bắt đầu. `DS-01` là việc của Supervisor, không vào
tệp này. SC-02 chỉ chuyển `SC-02` sang `inProgress`.

## 8. Đợt 8

`AU-01`, `AU-02`, `BE-05`, `SC-04`, `BE-10`, `BE-11`, `FE-10`, `FE-11`, `FE-12`, `FE-04`, `FE-14`,
`SC-08`, `IN-01`, `IN-02`, `IN-05`, `QA-02`, `QA-03`. Nội dung giữ như kế hoạch v5.

## 9. Việc nhỏ đã chốt, gắn vào OP-03

- Một dòng `console.error` ở nhánh `catch` của `autoSettleCreatedOrder`.
- Dòng nợ P2: lệnh kẹt ở `PLACED` không can thiệp được, chỉ được `expireStaleOrders` dọn.
- Đầu cuối chạy trên bản build thay vì `next dev`.
- Mục `vars` cho Worker với các biến công khai đọc lúc chạy.
