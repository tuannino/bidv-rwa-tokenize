# BỘ TEST NGHIỆM THU SPEC P4 / P7 / P12 (EVM + STELLAR)

Bộ script kiểm chứng các spec hợp đồng thông minh của dự án BIDV RWA điện gió.
Dùng cho cả Kiro (tự kiểm trước khi nộp) và Supervisor (nghiệm thu checkpoint).

## Ba lớp kiểm chứng

| Lớp | Nội dung | Cần mạng | Chi phí |
|---|---|---|---|
| **1** | Test chức năng theo acceptance criteria của spec | Không | Vài giây |
| **2** | Nghiệm thu DoD trên testnet thật (số dư, link tx) | Có | Tiêu ETH/XLM test |
| **3** | 3 luật kiến trúc + cấu trúc repo + ký hiệu token | Không | Tức thì |

## Cài đặt

Giải nén và **trộn thẳng vào gốc repo** `bidv-rwa-tokenize`. Cấu trúc:

```
scripts/
  verify-arch-rules.sh                          # lớp 3
  run-local-all.sh                              # chạy tất cả lớp 1 + 3
packages/contracts-evm/
  test/helpers/spec-fixture.js
  test/spec-p4-mint.test.js                     # lớp 1 - EVM
  test/spec-p7-profit-distribution.test.js
  test/spec-p12-redemption.test.js
  scripts/dod-verify-sepolia.js                 # lớp 2 - EVM
packages/contracts-stellar/
  contracts/spt_token/src/spec_tests.rs         # lớp 1 - Soroban
  contracts/profit_distributor_pull/src/spec_tests.rs
  contracts/redemption/src/spec_tests.rs
  scripts/dod-verify-testnet.sh                 # lớp 2 - Stellar
```

### Bước bắt buộc cho phần Soroban

Rust không tự nạp file test rời, nên phải khai báo module. Thêm **hai dòng** vào
cuối `src/lib.rs` của ba crate `spt_token`, `profit_distributor_pull`, `redemption`:

```rust
#[cfg(test)]
mod spec_tests;
```

Đây là thay đổi duy nhất cần với contract, **không sửa logic**, nên không vi phạm
ràng buộc "giữ nguyên contract đã pass test".

## Cách chạy

### Chạy tất cả (khuyến nghị trước mỗi checkpoint)

```bash
bash scripts/run-local-all.sh
```

### Từng lớp

```bash
# Lớp 3 - luật kiến trúc
bash scripts/verify-arch-rules.sh
BASE_REF=<commit-nền> bash scripts/verify-arch-rules.sh   # kèm kiểm contract không bị sửa

# Lớp 1 - EVM
cd packages/contracts-evm && npx hardhat test
npx hardhat test test/spec-p7-profit-distribution.test.js   # chạy riêng một spec

# Lớp 1 - Soroban
cd packages/contracts-stellar && cargo test
cargo test -p profit-distributor-pull                        # chạy riêng một crate

# Lớp 2 - Sepolia
cd packages/contracts-evm
npx hardhat run scripts/dod-verify-sepolia.js --network sepolia
ONLY=p7 npx hardhat run scripts/dod-verify-sepolia.js --network sepolia

# Lớp 2 - Stellar testnet
cd packages/contracts-stellar
DEPLOY=1 bash scripts/dod-verify-testnet.sh                  # deploy bộ mới rồi nghiệm thu
WPT_ID=C... VNDB_ID=C... DIST_ID=C... REDEMPTION_ID=C... ORACLE_ID=C... \
  bash scripts/dod-verify-testnet.sh                         # dùng bộ đã deploy
```

## Biến môi trường cho lớp 2

**EVM (Sepolia)** trong `packages/contracts-evm/.env`:

```
SEPOLIA_RPC_URL=
PRIVATE_KEY=                     # ví ngân hàng, phải có ETH test
ADDR_PROJECT_TOKEN=
ADDR_VND_TOKEN=
ADDR_PROFIT_DISTRIBUTOR=
ADDR_REDEMPTION=
ADDR_ENERGY_ORACLE=              # tùy chọn, để chạy nhánh oracle
INVESTOR_A=
INVESTOR_B=                      # tùy chọn
```

**Stellar testnet** truyền qua biến môi trường khi chạy: `ADMIN_KEY`, `INVESTOR_KEY`,
và các contract ID. Mặc định `ADMIN_KEY=bank`, `INVESTOR_KEY=inv1`.

## Ánh xạ test sang acceptance criteria

Mỗi test mang mã `P<luồng>-<số>` để khi đỏ là biết ngay tiêu chí nào chưa đạt.

### EVM

| Nhóm | Số test | Trọng tâm |
|---|---|---|
| P4 Mint | 15 | Whitelist, mint, đóng băng, tạm dừng, clawback, forcedTransfer |
| P7 Chia lợi tức | 23 | Snapshot, pull, push, nhánh oracle, quét phần dư |
| P12 Tất toán | 16 | Tỷ giá, quote, thanh khoản, approve, các ca bị chặn |

### Soroban

| Crate | Số test | Trọng tâm |
|---|---|---|
| `spt_token` | 12 | Authorize, mint, transfer, clawback, snapshot, metadata |
| `profit_distributor_pull` | 15 | Oracle, mở kỳ, claim theo snapshot, TTL |
| `redemption` | 13 | Tỷ giá SCALE, redeem, kho VNDB, tạm dừng |

## Những test đáng chú ý nhất

Đây là các test bắt đúng lỗi hay xảy ra, đừng xóa khi refactor:

- **P7-6 (EVM)**: thiếu `SNAPSHOT_ROLE` thì tạo kỳ chia thất bại. Đây là lỗi
  triển khai testnet phổ biến nhất.
- **P7-8 (EVM) và p7_8 (Soroban)**: mua token **sau** khi chốt kỳ thì không được
  chia kỳ đó. Đây là bản chất nghiệp vụ của snapshot, hỏng là sai tiền.
- **P12-13 (EVM)**: thiếu `approve` thì tất toán thất bại. Bản EVM cần approve,
  bản Soroban không cần, dev dễ nhầm giữa hai chain.
- **P12-12 (EVM) và p12_11 (Soroban)**: kho thiếu tiền thì từ chối và **không**
  đốt token. Nếu test này đỏ nghĩa là nhà đầu tư có thể mất token mà không nhận tiền.
- **p7_15 (Soroban)**: tua ledger 60 ngày rồi claim vẫn phải chạy. Loại test này
  bên EVM không cần, Soroban bắt buộc vì dữ liệu có TTL và kỳ chia kéo dài hàng quý.

## Test đang tắt có chủ đích

`P4-15` (EVM) kiểm ký hiệu token là `WPT` và `VNDB`. Hiện **skip** vì việc đổi tên
chưa đồng bộ trong mã nguồn (nợ P1). Bật khi Kiro đã đổi xong:

```bash
EXPECT_TOKEN_SYMBOLS=1 npx hardhat test
```

Script lớp 3 cũng đang báo FAIL cho ký hiệu cũ `SPT` / `tVND` để theo dõi món nợ này.

## Trạng thái kiểm chứng của chính bộ test

| Phần | Đã chạy thật | Kết quả |
|---|---|---|
| Lớp 3 (bash) | Có | Chạy được, bắt đúng 2 nợ P1 |
| Lớp 1 EVM (hardhat) | Có | **53 test xanh**, 1 skip có chủ đích |
| Lớp 1 Soroban (cargo) | **Chưa** | Chưa cài được Rust, xem cảnh báo dưới |
| Lớp 2 (testnet) | **Chưa** | Cần khóa ví và ETH/XLM test |

⚠️ **Ba file `spec_tests.rs` chưa được biên dịch thử.** Chúng viết bám sát API test
đang có trong repo (`env.register`, `Client::new`, `mock_all_auths`, `try_*`), nhưng
lần chạy `cargo test` đầu tiên có thể cần sửa vài lỗi biên dịch nhỏ (import, lifetime).
Nếu gặp lỗi ở struct `Ctx` với lifetime, cách gọn nhất là bỏ struct và khai báo biến
rời trong từng test.

Nếu muốn assert đúng **mã lỗi** thay vì chỉ `is_err()`, dùng:

```rust
assert_eq!(c.try_mint(&inv, &1), Err(Ok(Error::HolderNotAuthorized)));
```

## Nguyên tắc khi mở rộng bộ test

1. Mỗi tiêu chí trong `requirements.md` phải có **ít nhất một** test mang mã tương ứng.
2. Ca lỗi quan trọng hơn ca thành công: luôn kiểm **trạng thái không bị thay đổi sai**
   khi giao dịch thất bại.
3. Thêm method vào `ILedgerPort` thì thêm test ở **cả** EVM và Soroban, để lộ ra chỗ
   một chain không có tương đương.
4. Không sửa contract để test xanh. Contract đã pass test là chuẩn; test đỏ nghĩa là
   spec hoặc test sai, phải báo trong checkpoint.
