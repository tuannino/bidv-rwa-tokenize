# Báo cáo bàn giao — SC-07: Vault thanh toán SPV

| | |
|---|---|
| Task | SC-07 |
| Nhánh | `feat/sc-07-vault-thanh-toan`, từ `dev` @ `3342c2e` (PR #55) |
| Spec | `docs/sc-07-vault-thanh-toan/{requirements,tasks}.md` bản 2.1; DS-01 bản 4 |
| Mức kiểm chứng | Cao |
| Tiến độ | Hoàn tất; tag K4 đã xác minh trên `origin`; hot fix CI đã xanh trên PR #56 |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện hoàn thành | Trạng thái | Bằng chứng |
|---|---|---|---|
| 1 | `SpvPaymentVault` theo QĐ-A đến QĐ-H, NatSpec ghi giả định tin cậy, ca 1–20 | ✅ | mục 1 · 2.1 · chi tiết kiểm chứng mục 1 |
| 2 | Bộ cũ xanh; 12 đột biến đỏ đúng ca | ✅ | mục 2.1 · chi tiết đột biến mục 1–2 |
| 3 | Triển khai, `deployBlock`, công cụ; 7 địa chỉ hardhat-local cũ không đổi | ✅ | mục 2.2 · chi tiết kiểm chứng mục 2–3 |
| 4 | Ứng dụng R1–R6; Job A, Hardhat thật, quét bí mật | ✅ | mục 3 · 4 · chi tiết kiểm chứng mục 4–8 |
| 5 | K1 đến K4 và ca 25 | ✅ | mục 2.3 · 5 · Phụ lục A |
| 6 | `tech-report.md` ghi công thức, vai, tin cậy, khác biệt FE-21 và điểm khôi phục | ✅ | mục 5 |
| 7 | Owner tạo/push tag K4; xác nhận lịch sử bền OP-06 nếu đóng task | ✅ | mục 7 |

**Kết luận:** 7 ✅ · 0 🔶 · 0 ❌. SC-07 hoàn tất; không triển khai Sepolia trong task.

### 0.2 Việc cần Owner quyết/chạy

- Không có. Tag K4 đã xác minh trên `origin`; OP-06 đã được Sếp xác nhận lịch sử bền và chuyển `done`.

## 1. Kết quả chính và giao diện khóa cho SC-03

`SpvPaymentVault` giữ WPT/VNDB, mặc định `UNSET` khoá toàn bộ, hỗ trợ FIXED/PERCENT, chốt kỳ,
rút về một ví xác minh và quyết toán hai chiều với dấu chống trùng `orderRef`. `MATCHER_ROLE` không
được cấp khi deploy. NatSpec ghi đủ biên tin cậy của admin/withdrawer, matcher, agent/burner và số
`distributedPrev` ngoài chuỗi.

Bản 2.1 khóa sáu phụ thuộc của SC-03: `projectToken()`, `paymentToken()`,
`isOrderSettled(bytes32)`, `MATCHER_ROLE()`, `OrderAlreadySettled(bytes32)` và `OrderSettled` với
`orderRef` indexed đầu tiên. Contract đã đúng; hot fix bổ sung khóa hồi quy ở ca 1, ABI tối giản và
đối chiếu chỉ mục sự kiện với artifact.

## 2. Hợp đồng, triển khai và việc kèm

### 2.1 Ca hợp đồng và đột biến

Nền `dev @ 3342c2e` có 108 ca; sau SC-07 có 132 ca, tăng đúng 24 ca mới đo bằng `git diff` và lệnh
Hardhat ở chi tiết kiểm chứng mục 1. Ca 1–20 phủ luật khoá, nguyên tử hai chân, danh tính, lợi nhuận,
đường agent và gọi lồng; bốn ca còn lại thuộc K2/K3.
Mười hai đột biến 22a–22l đều exit 1 và nguồn được hoàn nguyên; đầu ra ở
[CHECKPOINT_SC07_MUTATIONS_DETAIL.md](CHECKPOINT_SC07_MUTATIONS_DETAIL.md).

### 2.2 Deploy và công cụ

Vault được deploy thứ tám, đăng ký `IdentityRegistry`, cấp CONFIG/WITHDRAWER/PAUSER, giữ matcher
trống. Address book lưu `deployBlock`; bảy địa chỉ hardhat-local cũ và toàn bộ khóa `evm` không đổi.
`verify-deployment.js`, `vault-admin.js`, `fund-sepolia.js` và chặn P4 cũ đã chạy trên Hardhat local.

### 2.3 K1–K4

SC-09/SC-10 đóng bằng bằng chứng Sepolia ở Phụ lục A; OP-06 đóng sau xác nhận của Sếp. P4 cũ từ
chối trước giao dịch nếu chưa Mint đầu; công cụ cấp phí phân loại lỗi mà không in bí mật. Điểm khôi
phục, địa chỉ và giao dịch cũ được ghi trong `tech-report.md`; tag do Owner tạo sau merge.

## 3. Ứng dụng

`ILedgerVault` đọc trạng thái và `PeriodClosed` từ `deployBlock`; mock/Stellar trả chưa triển khai.
TELLER/CONTROLLER có `vault:read` và màn chỉ đọc `/vault`; INVESTOR/SELLER không có quyền/menu.
Tổng quan Người bán ưu tiên dữ liệu on-chain và địa chỉ vault. Hai điểm nghiệp vụ lập/thực hiện Mint
đầu đều chặn đích khác vault; adapter thấp vẫn giữ trung tính và đường test trực tiếp không bị đổi.

Lệnh tìm điểm gọi sản xuất:

```text
$ rg -n "mintInitialSupply" app/src packages/contracts-evm/scripts --glob '!**/test/**'
app/src/lib/bank/issuance.service.ts:270:    : await ledger.mintInitialSupply(spvWallet, amount);
packages/contracts-evm/scripts/fund-sepolia.js:109:  const initial = await token.mintInitialSupply.estimateGas(spv.address, 1000n);
packages/contracts-evm/scripts/fund-sepolia.js:110:  await (await token.mintInitialSupply(spv.address, 1000n)).wait();
```

`issuance.service.ts` kiểm ở lúc lập yêu cầu và kiểm lại ngay trước khi gửi. `fund-sepolia.js` chỉ
dựng nút in-process để ước lượng gas, không phải đường nghiệp vụ/testnet và luôn dùng vault vừa deploy.

## 4. Kiểm chứng cuối

Đầu ra nguyên văn và mã thoát ở
[CHECKPOINT_SC07_VERIFICATION_DETAIL.md](CHECKPOINT_SC07_VERIFICATION_DETAIL.md): hợp đồng, bộ mặc
định, mô phỏng Job A có phục hồi artifacts, adapter vault/phát hành trên Hardhat thật, marker,
checkpoint và quét bí mật.

### 4.1 Hot fix CI — Mint đầu vào vault trên hardhat-local

`app/e2e/mint.spec.ts` giữ NB001 cho chain mock, nhưng khi chạy `hardhat-local` đọc
`SpvPaymentVault` từ `packages/shared/src/addresses.json`. Kết quả chạy lại đúng lệnh CI được yêu
cầu (lượt trong sandbox trước đó không tính vì bị chặn mạng khi Next.js tải Google Fonts):

```text
$ bash scripts/run-local-all.sh build evm
...
PASS: APP - BUILD BẢN PHÁT HÀNH
PASS: EVM - BUILD BẢN HARDHAT
...
SpvPaymentVault      0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
PASS: EVM - DỰNG CHUỖI MỚI
...
[SC-02] MINT tx=0xcbc4bdd288a43ae7b6bd0933f027cf72a6ce4591ffb8062078de636571153f11 receipt=0x1 block=19
[SC-02] MINT tx=0x341bcdf0b527052ed38db0f329b31e3e87198f80d8c8ca5da43b406d2b20ceda receipt=0x1 block=20
[SC-02] BURN tx=0x65602f7e126f7f726125c4a3ba4656f5aa2366246e813b753e5a4b6023a450f8 receipt=0x1 block=21
  2 skipped
  16 passed (13.1s)
  => PASS: EVM - E2E PROJECT HARDHAT
...
########## TỔNG KẾT ##########
  Phần đã chạy: build evm
  Đạt:     4
    PASS  APP - BUILD BẢN PHÁT HÀNH
    PASS  EVM - BUILD BẢN HARDHAT
    PASS  EVM - DỰNG CHUỖI MỚI
    PASS  EVM - E2E PROJECT HARDHAT
  Không đạt: 0
  => ĐẠT các phần đã chạy: build evm
```

## 5. Tài liệu, trạng thái và sai lệch

`tech-report.md` bản 4.16 và README hợp đồng đã cập nhật; sơ đồ luồng sinh lại sau khi dòng mã thay
đổi. Spec 2.1 từ ZIP được chép đúng nội dung. Sau khi đủ bảy điều kiện, `SC-07` chuyển sang `done`.

Sai lệch nền: `run-local-all.sh` trên commit nền có một ca `evm-issuance` để sót address book sau khi
xóa biến môi trường. Commit nhận task sửa teardown xóa cả hai nguồn cấu hình; không đổi production.
Không có sai lệch chức năng so với QĐ-A–QĐ-H hay phần “Không làm”.

## 6. Bất biến và phạm vi không làm

- Không sửa bảy hợp đồng có sẵn, không thêm thư viện, giữ OpenZeppelin 5.6.1 và không deploy Sepolia.
- Không gỡ năm marker chặn SC-03; không làm hợp đồng khớp lệnh, giao diện ghi vault hoặc mock vault.
- Nghiệp vụ vẫn qua `ILedgerPort`, quyền qua `can()`; task không thêm đường ký nên không đi vòng `ISigner`.

## 7. Xác nhận Owner và tag K4

Sếp xác nhận OP-06 hoàn tất và tag K4 đã có trên remote. Đối chiếu trực tiếp `origin`:

```bash
$ git ls-remote --tags origin refs/tags/poc-spv-vi-thuong-20261019
3342c2e2de0bed06856a9a1060b3ce91890df87d	refs/tags/poc-spv-vi-thuong-20261019
```

OP-05, sau SC-03, triển khai lại chain `evm`: đăng ký vault, Mint đầu vào vault, đặt payout wallet
và cấu hình khoá. Không dùng `dod-verify-sepolia.js` P4 cũ trên bộ trình diễn.

## Phụ lục A. Bằng chứng Sepolia trước SC-07

Nguồn: Supervisor đọc trực tiếp trên chuỗi ngày 19/10/2026. ProjectToken
`0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62`, IdentityRegistry
`0xA1Fb6C6831a4C1A66D6CE0090D2790Cd37a4b950`; cap 20.000.000, ví SPV
`0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd` đã xác minh.

| Lượt | Mã giao dịch | Block | Kết quả |
|---|---|---:|---|
| Mint đầu | `0xaa529aa41b03174d3b494eec254fb0876a7f44b1657253d18eef08e3f62f6f20` | 11947924 | 1.000 WPT vào SPV |
| Burn | `0x6b68b7571b93a37a738b99e9966e6cebb2b2bc0b1ee4edfaee96143f025257d8` | 11947952 | 1.000 WPT bị huỷ |
| Mint bổ sung | `0x246804b1bc59a9d263b73a25b4f82ed1443d880c990a5c4d0f0ae2be0980f6aa` | 11947989 | tổng cung và số dư SPV về 1.000 WPT |
