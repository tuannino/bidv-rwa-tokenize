# Hướng dẫn viết và triển khai smart contract RWA năng lượng tái tạo trên Stellar

Tài liệu kỹ thuật cho dev. Đi kèm bộ mã nguồn Soroban trong thư mục `rwa-contracts/` (ba hợp đồng: `wpt_token`, `profit_distributor`, `redemption`).

Bài toán: token hóa quyền hưởng lợi nhuận của một dự án điện mặt trời (RWA), có mô hình **chia lợi nhuận định kỳ** cho nhà đầu tư, vai trò phát hành là **ngân hàng**. Tài liệu này hướng dẫn viết từng dạng hợp đồng cho các quy trình mint, burn, transfer, clawback, đóng băng, tính lợi nhuận, chia lợi nhuận, mua lại (redeem); và hướng dẫn cài đặt, build, triển khai lên testnet chạy một chu kỳ đầu-cuối.

---

## 1. Tổng quan kiến trúc

Hai loại tài sản trong hệ thống:

- **WPT (Wind Power Token)** — token quyền hưởng, đại diện tỷ lệ sở hữu dòng tiền dự án. Có kiểm soát người nắm giữ (chỉ nhà đầu tư đã KYC).
- **VND token** — phương tiện chi trả (tiền gửi token hóa hoặc stablecoin VND). Dùng để trả lợi nhuận và hoàn vốn.

Ba hợp đồng:

| Hợp đồng | Chịu trách nhiệm | Quy trình |
|---|---|---|
| `wpt_token` | Token WPT: SEP-41 + phần quản trị + snapshot | `mint`, `burn`, `transfer`, `clawback`, `set_authorized` (whitelist/đóng băng), `set_admin`, `snapshot`, `balance_at` |
| `profit_distributor` | Chia lợi nhuận định kỳ (mô hình push) | `preview_share` (tính), `distribute` (chia), `register_holder` |
| `redemption` | Mua lại / hoàn vốn | `redeem`, `set_rate`, `set_paused` |
| `revenue_oracle` | Đưa doanh thu kỳ lên chuỗi (tách nguồn) | `report`, `finalize`, `get`, `set_reporter` |
| `profit_distributor_pull` | Chia lợi nhuận mô hình pull + snapshot (nhiều nhà đầu tư) | `open_period` (chốt snapshot), `claim`, `preview_claim` |

Ngoài ra, `cach_a_classic_sac.sh` minh họa **Cách A** (classic asset + SAC, không viết hợp đồng token) để đối chiếu chi phí, xem mục 13.

Luồng một chu kỳ:

```
   Doanh thu dự án (kỳ N)                    (1) admin nạp VND vào kho HĐ phân phối
            │                                          │
            ▼                                          ▼
   Oracle / admin ── total_revenue ──►  profit_distributor.distribute(N, revenue)
                                                       │  đọc số dư WPT từng holder
                                                       │  share_i = revenue * bal_i / supply
                                                       ▼
                                        chuyển VND cho từng nhà đầu tư theo tỷ lệ

   Khi nhà đầu tư muốn thoát:  redemption.redeem(wpt_amount)
        → đốt WPT của họ (giảm cung) → trả lại vốn bằng VND theo tỷ giá
```

Nguyên tắc kiểm soát của ngân hàng được cài trong `wpt_token`:

- **Danh sách trắng KYC**: chỉ địa chỉ có `authorized = true` mới nắm giữ/nhận WPT. Đây là cổng tuân thủ.
- **Đóng băng**: `set_authorized(addr, false)` khóa một địa chỉ.
- **Thu hồi cưỡng chế (clawback)**: admin lấy lại token kể cả khi chủ sở hữu không đồng ý (lệnh cơ quan quản lý, vi phạm tuân thủ).

---

## 2. Hai cách kiểm soát tài sản trên Stellar — chọn cái nào

Trên Stellar có **hai con đường** để có được token có kiểm soát. Hiểu rõ để chọn đúng:

**Cách A — Classic asset + cờ giao thức + SAC (không cần viết hợp đồng token).**
Phát hành một "classic asset", bật ba cờ trên tài khoản phát hành: `AUTH_REQUIRED` (buộc ủy quyền/whitelist), `AUTH_REVOCABLE` (cho đóng băng), `CLAWBACK_ENABLED` (cho thu hồi). Mint/freeze/clawback là **thao tác gốc của giao thức**, không phải hàm hợp đồng. Khi cần dùng trong Soroban thì "bọc" bằng **Stellar Asset Contract (SAC)** — bản dựng sẵn triển khai đúng giao diện SEP-41 và có thêm `mint`, `clawback`, `set_authorized`, `set_admin`. SAC rẻ và nhanh hơn token tự viết đáng kể.

**Cách B — Token Soroban tự viết (chính là `wpt_token` trong bộ này).**
Tự cài toàn bộ logic bằng Rust. Linh hoạt nhất: có thể thêm quy tắc riêng (ví dụ giới hạn nắm giữ, khóa theo thời gian, tổng cung để tính chia lợi nhuận), tự đặt tên hàm, tự phát sự kiện theo ý.

**Khuyến nghị:**
- Nếu chỉ cần token có kiểm soát tiêu chuẩn (whitelist, freeze, clawback) → dùng **Cách A** cho token VND và cả WPT ở production. Ít mã, ít rủi ro, phí thấp.
- Nếu WPT cần logic đặc thù (ví dụ hợp đồng phân phối cần đọc `total_supply`, hoặc cần luật nắm giữ riêng) → **Cách B**.

Bộ mã này dùng **Cách B** cho WPT để minh họa đầy đủ việc "viết từng smart contract cho từng quy trình" theo đúng yêu cầu, và để hợp đồng phân phối gọi được `total_supply`. Phần triển khai bên dưới dùng chính `wpt_token` cho cả WPT lẫn VND (cho gọn khi thử nghiệm); ở production nên cân nhắc chuyển VND sang Cách A.

> Ánh xạ với báo cáo/playbook trước: đây là "nhánh public Stellar (B2.C)". Kiểm soát nắm giữ và thu hồi trên Stellar đơn giản hơn EVM vì có sẵn ở giao thức (Cách A); nhưng logic chia lợi nhuận theo công thức vẫn cần một hợp đồng Soroban (Rust).

---

## 3. Chuẩn bị môi trường

### 3.1. Cài Rust và target WASM

Soroban chỉ hỗ trợ **một** target duy nhất là `wasm32v1-none`, có từ **Rust 1.84+**. Không dùng `wasm32-unknown-unknown` (từ Rust 1.82 target này bật tính năng WASM mà Soroban không nhận).

```bash
# Cài rustup (nếu chưa có)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Đảm bảo Rust >= 1.84
rustup update
rustc --version    # >= 1.84.0

# Thêm target WASM cho Soroban
rustup target add wasm32v1-none
```

### 3.2. Cài Stellar CLI

```bash
# macOS
brew install stellar-cli

# Cargo (mọi nền tảng) — cài đúng dòng ổn định
cargo install --locked stellar-cli

stellar --version
```

> Build hợp đồng luôn bằng `stellar contract build`, **không** dùng `cargo build`. Lệnh này tự nhắm `wasm32v1-none` và áp đúng cấu hình runtime yêu cầu.

### 3.3. Cấu hình testnet và tạo ví

```bash
# Chọn testnet làm mạng mặc định
stellar network use testnet

# Tạo và nạp XLM (qua Friendbot) cho các danh tính cần dùng
stellar keys generate admin    --network testnet --fund
stellar keys generate investorA --network testnet --fund
stellar keys generate investorB --network testnet --fund

# Xem địa chỉ công khai (bắt đầu bằng G...)
stellar keys address admin
stellar keys address investorA
stellar keys address investorB
```

RPC testnet: `https://soroban-testnet.stellar.org`, network passphrase: `Test SDF Network ; September 2015`.

---

## 4. Cấu trúc workspace

```
rwa-contracts/
├── Cargo.toml                       # workspace, ghim soroban-sdk = "26"
├── README.md
├── cach_a_classic_sac.sh            # Cách A: classic asset + SAC (đối chiếu chi phí)
└── contracts/
    ├── wpt_token/
    │   └── src/lib.rs               # WPT: mint/burn/transfer/clawback/freeze + snapshot
    ├── profit_distributor/
    │   └── src/lib.rs               # chia lợi nhuận (push)
    ├── redemption/
    │   └── src/lib.rs               # redeem / hoàn vốn
    ├── revenue_oracle/
    │   └── src/lib.rs               # đưa doanh thu kỳ lên chuỗi
    └── profit_distributor_pull/
        └── src/lib.rs               # chia lợi nhuận (pull + snapshot)
```

Điểm cần biết:
- `crate-type = ["cdylib", "rlib"]`: `cdylib` để build ra WASM; `rlib` để hợp đồng khác **dùng lại client sinh tự động** (`WptTokenClient`) khi gọi chéo.
- `profit_distributor` và `redemption` khai báo `wpt-token = { path = "../wpt_token" }` để gọi hàm `balance`, `transfer`, `burn` của token qua `WptTokenClient` — không cần tự viết lại giao diện.

---

## 5. Giải thích từng hợp đồng và từng quy trình

### 5.1. Hợp đồng token WPT (`wpt_token`)

Tuân thủ **SEP-41** (giao diện token chuẩn của Soroban: `allowance/approve/balance/transfer/transfer_from/burn/burn_from/decimals/name/symbol`) và mở rộng phần quản trị.

**Lưu trữ và TTL.** Soroban thu phí "thuê" cho mỗi ô lưu trữ và sẽ lưu trữ hóa (archive) dữ liệu hết hạn. Vì vậy mỗi lần đụng tới số dư, ta gọi `extend_ttl` để gia hạn. Ba loại lưu trữ: `instance` (cấu hình, admin, tổng cung), `persistent` (số dư, cờ authorized), `temporary` (hạn mức allowance, tự hết hạn theo ledger).

**Quy trình: khởi tạo.**
```rust
pub fn initialize(env, admin, decimals, name, symbol) -> Result<(), Error>
```
Đặt admin và metadata, chỉ chạy một lần (lần sau trả `AlreadyInitialized`).

**Quy trình: whitelist / đóng băng (cổng KYC).**
```rust
pub fn set_authorized(env, id: Address, authorize: bool)   // chỉ admin
pub fn authorized(env, id: Address) -> bool
```
`authorize=true` đưa địa chỉ vào danh sách trắng (đã KYC, được nắm giữ). `false` đóng băng. `transfer` và `mint` đều kiểm tra cờ này — địa chỉ chưa được whitelist sẽ bị chặn.

**Quy trình: phát hành (mint).**
```rust
pub fn mint(env, to: Address, amount: i128)   // chỉ admin
```
Chỉ admin gọi (`require_auth`). Bên nhận phải đã whitelist, nếu không trả `HolderNotAuthorized`. Tăng số dư `to` và `total_supply`, phát sự kiện `mint`.

**Quy trình: chuyển nhượng (transfer).**
```rust
pub fn transfer(env, from, to, amount)              // from ký
pub fn transfer_from(env, spender, from, to, amount) // spender ký, tiêu allowance
```
Kiểm tra **cả hai** bên đã whitelist (cổng tuân thủ ở mọi lần chuyển). `transfer_from` đi kèm `approve`/`allowance` chuẩn SEP-41 để ủy quyền cho hợp đồng khác chi tiêu.

**Quy trình: đốt (burn).**
```rust
pub fn burn(env, from, amount)                 // from tự đốt
pub fn burn_from(env, spender, from, amount)   // đốt qua allowance
```
Giảm số dư và `total_supply`. Hợp đồng `redemption` dùng `burn` để "rút" WPT khi nhà đầu tư hoàn vốn.

**Quy trình: thu hồi cưỡng chế (clawback).**
```rust
pub fn clawback(env, from: Address, amount: i128)   // chỉ admin
```
Admin lấy lại token từ một địa chỉ **không cần địa chỉ đó đồng ý**. Giảm số dư và `total_supply`. Đây là quyền then chốt cho ngân hàng khi có lệnh cơ quan quản lý hoặc vi phạm tuân thủ. Trên Stellar quyền này có sẵn ở tầng giao thức (Cách A); ở đây ta cài lại trong hợp đồng (Cách B).

**Quản trị khác.** `set_admin` chuyển quyền; `total_supply` để hợp đồng phân phối biết mẫu số.

### 5.2. Hợp đồng tính & chia lợi nhuận (`profit_distributor`)

**Mô hình chia.** Mỗi kỳ, doanh thu ròng (đã quy ra VND token) chia theo tỷ lệ nắm giữ WPT:

```
share_i = total_revenue * balance_i / registered_supply     (làm tròn xuống)
```

`registered_supply` là tổng WPT của các nhà đầu tư **đã đăng ký**. Phần dư do làm tròn nằm lại trong kho hợp đồng, cộng dồn sang kỳ sau (hoặc rút thủ công).

**Vì sao cần "đăng ký holder"?** Soroban **không** cho phép duyệt toàn bộ số dư của một token (không có vòng lặp qua mọi tài khoản). Nên hợp đồng giữ một danh sách địa chỉ nhà đầu tư (`register_holder` / `remove_holder`, đồng bộ với danh sách KYC). Khi chia, hợp đồng đọc số dư WPT hiện tại của từng địa chỉ trong danh sách.

**Quy trình: tính lợi nhuận (chỉ đọc).**
```rust
pub fn preview_share(env, total_revenue, investor) -> i128
pub fn registered_supply(env) -> i128
```
`preview_share` tính trước phần một nhà đầu tư nhận, tách riêng khỏi việc chuyển tiền để **kiểm thử công thức độc lập**.

**Quy trình: chia lợi nhuận.**
```rust
pub fn distribute(env, period_id: u32, total_revenue: i128) -> PeriodRecord   // chỉ admin
```
Các bước bên trong: kiểm tra kỳ chưa chia (chống chia trùng) → tính mẫu số → duyệt danh sách holder, tính `share_i`, chuyển VND từ **kho của chính hợp đồng** sang từng người → ghi lại `PeriodRecord` (doanh thu, đã trả, số holder) → phát sự kiện.

Điểm quan trọng về ủy quyền: VND được chuyển **từ địa chỉ của hợp đồng phân phối**. Một hợp đồng tự ủy quyền cho các lời gọi con của chính nó, nên `distribute` **không cần chữ ký ngoài** ngoài chữ ký admin. Do đó admin phải **nạp trước VND vào địa chỉ hợp đồng** (mint hoặc transfer VND tới địa chỉ `C...` của distributor).

**Push vs Pull.** Bộ này dùng **push** (hợp đồng chủ động trả cho từng người) — phù hợp số nhà đầu tư tổ chức vừa phải. Mỗi giao dịch Soroban có giới hạn tài nguyên; nếu có hàng nghìn holder, mỗi lần `distribute` sẽ vượt giới hạn. Khi đó chuyển sang **pull**: `distribute` chỉ ghi `total_revenue` của kỳ; mỗi nhà đầu tư tự gọi `claim(period_id)` để nhận phần của mình (dựa trên số dư đã chốt tại thời điểm chia — cần cơ chế snapshot). Đây là hướng nâng cấp khi mở rộng.

### 5.3. Hợp đồng mua lại / hoàn vốn (`redemption`)

**Quy trình: redeem.**
```rust
pub fn redeem(env, investor: Address, wpt_amount: i128) -> i128   // investor ký (là source)
```
Nhà đầu tư trả lại `wpt_amount` WPT để nhận vốn bằng VND:
- Tính `vnd_out = wpt_amount * rate / SCALE` (SCALE = 1e7 để tỷ giá biểu diễn được phần lẻ).
- **Đốt** WPT của nhà đầu tư (giảm tổng cung — cổ phần rút khỏi dự án).
- Chuyển VND từ kho hợp đồng cho nhà đầu tư.

Ủy quyền: `investor` phải là **bên ký giao dịch** (source account) để ủy quyền cho việc đốt WPT của chính họ. Việc trả VND từ kho hợp đồng là lời gọi con của hợp đồng nên tự ủy quyền.

**Quản trị.** `set_rate` cập nhật tỷ giá mua lại; `set_paused` tạm dừng khi cần (ví dụ thiếu thanh khoản VND). `preview` xem trước số VND nhận được.

### 5.4. Hợp đồng oracle doanh thu (`revenue_oracle`)

Ở bản đầu, `distribute` nhận `total_revenue` trực tiếp từ admin. Rủi ro: một khóa đơn tự đặt doanh thu. Hợp đồng oracle tách nguồn số liệu ra riêng, với hai vai và một trạng thái khóa:

- `report(period_id, revenue)` do vai `reporter` ký. Reporter nên là ví multisig hoặc quy trình ký nhiều bên của ngân hàng (đồng hồ đo sản lượng, hệ thống ghi nhận doanh thu). Khi kỳ chưa khóa, có thể điều chỉnh lại số liệu.
- `finalize(period_id)` do admin ký, khóa số liệu. Sau khi khóa thì bất biến, không sửa được nữa.
- `get(period_id)`, `is_finalized(period_id)` để hợp đồng chia đọc.
- `set_reporter` cho phép admin luân chuyển vai reporter (ví dụ đổi sang ví multisig mới).

Tác dụng: quyền "đặt doanh thu" (reporter) tách khỏi quyền "khóa số liệu" (admin) và khỏi quyền "chia tiền" (distributor), đúng nguyên tắc phân tách nhiệm vụ mà kiểm toán ngân hàng yêu cầu.

### 5.5. Chia lợi nhuận mô hình pull + snapshot (`profit_distributor_pull` + snapshot ở token)

Bản `profit_distributor` (mục 5.2) dùng mô hình **push**: hợp đồng duyệt danh sách holder và trả cho từng người trong một giao dịch. Đơn giản nhưng chi phí tăng theo số holder và sẽ vượt giới hạn tài nguyên khi có hàng nghìn nhà đầu tư. Bản pull giải quyết bằng hai ý tưởng ghép lại:

Thứ nhất, **token hỗ trợ snapshot** (đã bổ sung vào `wpt_token`). Cơ chế checkpoint kiểu "lazy" của OpenZeppelin: token giữ một bộ đếm snapshot; hàm `snapshot()` (admin) tăng bộ đếm và trả về `snapshot_id`. Mỗi khi số dư một địa chỉ sắp đổi lần đầu trong một kỳ snapshot, token ghi lại giá trị CŨ kèm `snapshot_id`. Nhờ vậy `balance_at(addr, snapshot_id)` và `total_supply_at(snapshot_id)` tra được số dư đúng tại thời điểm snapshot, dù về sau số dư có đổi. Chi phí: mỗi địa chỉ tích lũy một checkpoint cho mỗi kỳ snapshot có phát sinh giao dịch; với chia theo quý (4 lần/năm) và số holder tổ chức, khối lượng nhỏ, cần lưu ý gia hạn TTL.

Thứ hai, hợp đồng **pull**:
- `open_period(period_id)` do admin gọi: đọc doanh thu đã `finalize` từ oracle, gọi `wpt.snapshot()` để chốt số dư mọi người, lưu `snapshot_id`, `total_revenue`, và `total_supply` tại snapshot. Không cần danh sách holder.
- `claim(period_id, investor)` để từng nhà đầu tư tự nhận: phần chia tính theo `balance_at(investor, snapshot_id)` chia cho `total_supply` tại snapshot, nên **không thể gian lận** bằng cách mua thêm WPT sau khi mở kỳ. Mỗi người `claim` đúng một lần (đánh dấu trước khi chuyển tiền).
- `preview_claim` xem trước phần của một người.

Chi phí mỗi giao dịch `claim` là cố định, không phụ thuộc tổng số holder, nên mô hình mở rộng tốt.

Lưu ý về ủy quyền: `open_period` phải do **admin của token** ký, vì bên trong gọi `wpt.snapshot()` (chỉ admin). Trong hệ này, dùng chung một khóa admin cho token và distributor, hoặc để admin token đồng ký. Việc trả VND lấy từ kho của chính hợp đồng pull (nạp trước), tự ủy quyền như bản push.

**Chọn bản nào?** Ít nhà đầu tư tổ chức, muốn đơn giản, muốn trả tự động một lần: dùng `profit_distributor` (push). Nhiều nhà đầu tư, cần chống gian lận theo số dư và mở rộng: dùng `profit_distributor_pull` + oracle.

---

## 6. Build và test

```bash
cd rwa-contracts

# Chạy toàn bộ unit test (chạy trên máy, không cần mạng)
cargo test

# Build ra WASM cho cả ba hợp đồng
stellar contract build
# → target/wasm32v1-none/release/wpt_token.wasm
#   target/wasm32v1-none/release/profit_distributor.wasm
#   target/wasm32v1-none/release/redemption.wasm
```

Tối ưu kích thước WASM (khuyến nghị trước khi deploy):
```bash
stellar contract optimize --wasm target/wasm32v1-none/release/wpt_token.wasm
stellar contract optimize --wasm target/wasm32v1-none/release/profit_distributor.wasm
stellar contract optimize --wasm target/wasm32v1-none/release/redemption.wasm
```

---

## 7. Triển khai lên testnet — chạy một chu kỳ đầu-cuối

Ta sẽ deploy **bốn thực thể hợp đồng**: token WPT, token VND (dùng lại `wpt_token.wasm`), distributor, redemption. Rồi chạy: whitelist → mint WPT → đăng ký holder → nạp VND → chia lợi nhuận → redeem → clawback.

Đặt sẵn biến địa chỉ ví để dễ đọc:
```bash
ADMIN=$(stellar keys address admin)
INVA=$(stellar keys address investorA)
INVB=$(stellar keys address investorB)
```

### 7.1. Deploy và khởi tạo hai token

```bash
# --- Token WPT ---
WPT=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/wpt_token.wasm \
  --source-account admin --network testnet --alias wpt)
echo "WPT=$WPT"

stellar contract invoke --id "$WPT" --source-account admin --network testnet -- \
  initialize --admin "$ADMIN" --decimals 7 \
  --name "Wind Power Token" --symbol "WPT"

# --- Token VND (dùng lại cùng WASM) ---
VND=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/wpt_token.wasm \
  --source-account admin --network testnet --alias vnd)
echo "VND=$VND"

stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  initialize --admin "$ADMIN" --decimals 7 \
  --name "Tokenized VND" --symbol "VND"
```

### 7.2. Deploy và khởi tạo distributor + redemption

```bash
DIST=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/profit_distributor.wasm \
  --source-account admin --network testnet --alias dist)
echo "DIST=$DIST"

stellar contract invoke --id "$DIST" --source-account admin --network testnet -- \
  initialize --admin_addr "$ADMIN" --wpt_token "$WPT" --vnd_token "$VND"

REDEEM=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/redemption.wasm \
  --source-account admin --network testnet --alias redeem)
echo "REDEEM=$REDEEM"

# rate: 1 WPT-unit đổi 10.000 VND-unit → rate = 10000 * 1e7 = 100000000000
stellar contract invoke --id "$REDEEM" --source-account admin --network testnet -- \
  initialize --admin_addr "$ADMIN" --wpt_token "$WPT" --vnd_token "$VND" \
  --rate 100000000000
```

### 7.3. KYC / whitelist (bắt buộc trước khi giữ token)

Whitelist trên **cả** WPT và VND cho: hai nhà đầu tư, địa chỉ distributor (giữ VND để chia), địa chỉ redemption (giữ VND để trả).

```bash
for ID in "$WPT" "$VND"; do
  for A in "$INVA" "$INVB" "$DIST" "$REDEEM"; do
    stellar contract invoke --id "$ID" --source-account admin --network testnet -- \
      set_authorized --id "$A" --authorize true
  done
done
```

### 7.4. Phát hành WPT và đăng ký holder

```bash
# Phát hành: A = 700, B = 300 (đơn vị unit; nhân 1e7 nếu muốn theo stroop)
stellar contract invoke --id "$WPT" --source-account admin --network testnet -- \
  mint --to "$INVA" --amount 700
stellar contract invoke --id "$WPT" --source-account admin --network testnet -- \
  mint --to "$INVB" --amount 300

# Đăng ký holder vào distributor
stellar contract invoke --id "$DIST" --source-account admin --network testnet -- \
  register_holder --investor "$INVA"
stellar contract invoke --id "$DIST" --source-account admin --network testnet -- \
  register_holder --investor "$INVB"
```

### 7.5. Nạp VND vào kho các hợp đồng

```bash
# Kho VND cho distributor để chia lợi nhuận
stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  mint --to "$DIST" --amount 1000000

# Kho VND cho redemption để hoàn vốn
stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  mint --to "$REDEEM" --amount 5000000
```

### 7.6. Chia lợi nhuận kỳ 1

```bash
# Xem trước phần của A với doanh thu 1.000.000
stellar contract invoke --id "$DIST" --source-account admin --network testnet -- \
  preview_share --total_revenue 1000000 --investor "$INVA"
# → 700000

# Thực hiện chia kỳ 1
stellar contract invoke --id "$DIST" --source-account admin --network testnet -- \
  distribute --period_id 1 --total_revenue 1000000

# Kiểm tra số dư VND sau chia
stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  balance --id "$INVA"     # → 700000
stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  balance --id "$INVB"     # → 300000
```

### 7.7. Nhà đầu tư mua lại (redeem)

```bash
# investorA hoàn 100 WPT (investorA là source để ủy quyền đốt WPT của mình)
stellar contract invoke --id "$REDEEM" --source-account investorA --network testnet -- \
  redeem --investor "$INVA" --wpt_amount 100
# → trả về 1000000 (100 * 10.000)

stellar contract invoke --id "$WPT" --source-account admin --network testnet -- \
  balance --id "$INVA"     # → 600  (đã đốt 100)
```

### 7.8. Thu hồi cưỡng chế (clawback)

```bash
# Ngân hàng thu hồi 50 WPT từ investorB (không cần B đồng ý)
stellar contract invoke --id "$WPT" --source-account admin --network testnet -- \
  clawback --from "$INVB" --amount 50

stellar contract invoke --id "$WPT" --source-account admin --network testnet -- \
  balance --id "$INVB"     # → 250
```

Xong một chu kỳ đầy đủ trên testnet.

---

## 8. Ghi chú vận hành cho production

- **Nguồn doanh thu (oracle).** `total_revenue` mỗi kỳ phải đến từ nguồn tin cậy: đồng hồ đo sản lượng, hệ thống ngân hàng, rồi đưa lên chuỗi qua một oracle hoặc quy trình ký nhiều bên (multisig). Không để một khóa đơn tự do đặt doanh thu. Đã hiện thực hóa ở `revenue_oracle` (mục 5.4) với tách vai reporter/admin và bước finalize; ở production nên gắn reporter vào ví multisig.
- **SEP-8 / SEP-12.** Ở production nên đặt một **approval server** theo SEP-8 (duyệt từng giao dịch chuyển nhượng theo quy tắc tuân thủ) và **SEP-12** cho luồng KYC, khai báo trong `stellar.toml`. Danh sách trắng trong hợp đồng đồng bộ với kết quả KYC.
- **Custody.** Khóa admin của token là tài sản tối quan trọng: dùng lưu ký tổ chức (Anchorage, Fireblocks) hoặc multisig, không giữ khóa trần.
- **Lưu trữ hóa (state archival).** Số dư và bản ghi kỳ có TTL; hợp đồng đã tự gia hạn khi ghi, nhưng cần theo dõi và `restore` nếu một entry bị archive sau thời gian dài không dùng.
- **Phí và tài nguyên.** Mỗi `distribute` tốn tài nguyên tỷ lệ số holder. Ước lượng và đặt trần holder mỗi lần chia; cân nhắc pull-model khi mở rộng.
- **VND ở production.** Cân nhắc chuyển VND sang classic asset + SAC (Cách A) thay vì token tự viết, để rẻ và chuẩn hơn.

---

## 9. Checklist an ninh & tuân thủ

- [ ] Mọi hàm quản trị (`mint`, `clawback`, `set_authorized`, `set_admin`, `distribute`, `set_rate`) đều gọi `require_auth` của đúng vai trò.
- [ ] Khóa admin dùng multisig/custody, có quy trình luân chuyển khóa.
- [ ] `total_revenue` vào từ nguồn được kiểm soát (oracle/multisig), có nhật ký.
- [ ] Chống chia trùng kỳ (đã có: `PeriodAlreadyDistributed`).
- [ ] Kiểm tra tràn số ở các phép nhân (đã có `checked_mul`); cân nhắc `I256` nếu giá trị rất lớn.
- [ ] KYC/whitelist bật cho **mọi** địa chỉ giữ token, kể cả địa chỉ hợp đồng.
- [ ] Kịch bản khẩn cấp: `set_paused` cho redemption; `set_authorized(false)` để đóng băng.
- [ ] Kiểm toán mã độc lập trước khi lên mainnet.
- [ ] Rà soát pháp lý: token cho hưởng lợi nhuận định kỳ có thể bị coi là chứng khoán — xác định phạm vi trước khi phát hành thật.

---

## 10. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `error: wasm32-unknown-unknown ...` | Build sai target | Dùng `stellar contract build`, đã `rustup target add wasm32v1-none`, Rust ≥ 1.84 |
| `HolderNotAuthorized` khi mint/transfer | Địa chỉ chưa whitelist | Gọi `set_authorized --id <addr> --authorize true` trên đúng token |
| `distribute` báo thiếu VND / transfer lỗi | Chưa nạp VND vào kho distributor, hoặc distributor chưa được whitelist trên VND | Whitelist địa chỉ distributor trên VND, rồi `mint`/transfer VND cho nó |
| `redeem` lỗi ủy quyền | Không lấy nhà đầu tư làm `--source-account` | Ký bằng chính nhà đầu tư: `--source-account investorA` |
| `PeriodAlreadyDistributed` | Kỳ đã chia | Dùng `period_id` mới |
| Giao dịch hết hạn / phí | Nghẽn testnet | Chạy lại; kiểm tra RPC `https://soroban-testnet.stellar.org` |
| Đọc trạng thái sau thời gian dài lỗi | Entry bị archive | `stellar contract restore ...` rồi thử lại |

---

## 11. Ánh xạ EVM ↔ Stellar (nối với báo cáo/playbook)

| Cấu phần | Cách làm trên EVM | Cách làm trong bộ này (Stellar) |
|---|---|---|
| Token có kiểm soát người nắm giữ | ERC-3643 (T-REX) | `wpt_token` (Cách B) hoặc classic asset + cờ giao thức (Cách A) |
| Định danh, whitelist, tuân thủ | ONCHAINID + Compliance | `set_authorized` + (production) SEP-8 approval server, SEP-12 |
| Đóng băng, thu hồi | Hàm trong ERC-3643 | `set_authorized(false)`, `clawback` (có sẵn ở giao thức với Cách A) |
| Kho lợi tức & phân phối | ERC-4626 + hợp đồng phân phối | `profit_distributor` (Soroban/Rust) |
| Giao diện token | ERC-20 | SEP-41 + Stellar Asset Contract (SAC) |
| Chi trả VND | Token tiền gửi ERC-20 nội bộ | `vnd` token (Cách B thử nghiệm; Cách A ở production) |

---

## 12. Triển khai mô hình pull + oracle trên testnet

Tiếp nối biến ở mục 7 (`ADMIN`, `INVA`, `INVB`, `WPT`, `VND`). Ở đây `ADMIN` đồng thời là admin của token và reporter của oracle (để test gọn).

```bash
# 12.1. Deploy oracle doanh thu và distributor pull
ORACLE=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/revenue_oracle.wasm \
  --source-account admin --network testnet --alias oracle)

stellar contract invoke --id "$ORACLE" --source-account admin --network testnet -- \
  initialize --admin_addr "$ADMIN" --reporter_addr "$ADMIN"

DPULL=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/profit_distributor_pull.wasm \
  --source-account admin --network testnet --alias dpull)

stellar contract invoke --id "$DPULL" --source-account admin --network testnet -- \
  initialize --admin_addr "$ADMIN" --wpt_token "$WPT" --vnd_token "$VND" --oracle "$ORACLE"

# 12.2. Whitelist địa chỉ distributor pull trên VND và nạp kho VND
stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  set_authorized --id "$DPULL" --authorize true
stellar contract invoke --id "$VND" --source-account admin --network testnet -- \
  mint --to "$DPULL" --amount 1000000

# 12.3. Oracle: báo cáo và khóa doanh thu kỳ 2
stellar contract invoke --id "$ORACLE" --source-account admin --network testnet -- \
  report --period_id 2 --revenue 1000000
stellar contract invoke --id "$ORACLE" --source-account admin --network testnet -- \
  finalize --period_id 2

# 12.4. Mở kỳ (chốt snapshot). admin phải là admin token để cho phép snapshot.
stellar contract invoke --id "$DPULL" --source-account admin --network testnet -- \
  open_period --period_id 2

# 12.5. Từng nhà đầu tư tự claim (mỗi người là source của chính giao dịch mình)
stellar contract invoke --id "$DPULL" --source-account investorA --network testnet -- \
  claim --period_id 2 --investor "$INVA"
stellar contract invoke --id "$DPULL" --source-account investorB --network testnet -- \
  claim --period_id 2 --investor "$INVB"
```

Điểm khác biệt so với bản push: không nạp danh sách holder, không có vòng lặp trả tiền; mỗi `claim` là một giao dịch độc lập chi phí cố định. Nếu sau khi `open_period` mà nhà đầu tư giao dịch WPT, phần chia vẫn tính theo số dư đã chốt tại snapshot.

---

## 13. Cách A: classic asset + SAC, và đối chiếu chi phí

Script `cach_a_classic_sac.sh` (ở gốc workspace) hiện thực Cách A đầu-cuối: bật cờ `AUTH_REQUIRED` / `AUTH_REVOCABLE` / `CLAWBACK_ENABLED` trên tài khoản phát hành, triển khai SAC cho tài sản, lập trustline, whitelist, rồi mint / freeze / clawback / burn qua SAC. Chạy:

```bash
chmod +x cach_a_classic_sac.sh
./cach_a_classic_sac.sh
```

Khác biệt cốt lõi về cơ chế: ở Cách A, mint/freeze/clawback là thao tác gốc của giao thức (hoặc hàm của SAC dựng sẵn), còn người nắm giữ phải **lập trustline** trước khi nhận (một khoản base reserve). Ở Cách B, token là hợp đồng WASM ta tự nạp và tự quản lý số dư.

### 13.1. Các yếu tố cấu thành chi phí

| Yếu tố chi phí | Cách A (classic + SAC) | Cách B (token Soroban tự viết) |
|---|---|---|
| Nạp mã hợp đồng token (WASM) | Không có; SAC là hợp đồng dựng sẵn của giao thức | Có; phí một lần theo kích thước WASM (càng nhiều tính năng, snapshot... càng lớn) |
| Tạo thực thể hợp đồng token | Không (dùng SAC dùng chung) | Có, tạo instance |
| Lưu số dư người nắm giữ | Trustline (tài khoản) hoặc contract storage (địa chỉ hợp đồng) | Contract storage cho mọi số dư, cờ authorized, checkpoint |
| Base reserve khi nhận token | Có: mỗi holder lập trustline tốn base reserve | Không có trustline; nhưng tốn "thuê" lưu trữ cho mỗi entry số dư |
| Thuê lưu trữ / TTL định kỳ | Ít với balance ở trustline | Có cho mọi entry (số dư, authorized, checkpoint); phải gia hạn |
| Bảo trì và rủi ro mã | Thấp (không có mã token để bảo trì/audit) | Cao hơn (phải audit, cập nhật, quản lý TTL) |
| Logic chia lợi nhuận (Soroban) | Vẫn cần hợp đồng Soroban riêng | Vẫn cần hợp đồng Soroban riêng |

Kết luận về chi phí: với riêng phần TOKEN, **Cách A rẻ hơn và ít bảo trì hơn** (không nạp WASM, không tự quản lý storage số dư, không cần audit mã token). Cách B chỉ đáng chi thêm khi token cần logic đặc thù không có sẵn ở SAC (ví dụ cần `total_supply`, cần snapshot ở tầng token, hoặc quy tắc nắm giữ riêng). Phần logic chia lợi nhuận theo công thức thì cả hai cách đều cần một hợp đồng Soroban như nhau.

### 13.2. Cách đo chi phí thực tế

Không nên đoán số tuyệt đối; hãy đo trên testnet. Mỗi lần `stellar contract invoke` / gửi giao dịch, CLI hiển thị phí tài nguyên (resource fee). Để ước lượng trước khi gửi, dùng chế độ dựng và mô phỏng:

```bash
# Xem phí ước lượng mà không gửi (mô phỏng), ví dụ với một lệnh invoke:
stellar contract invoke --id "$WPT" --source-account admin --network testnet \
  --sim -- mint --to "$INVA" --amount 100

# Với giao dịch classic, có thể dựng rồi xem trước:
stellar tx new set-options --source issuer --network testnet \
  --set-required --set-revocable --set-clawback-enabled --build-only \
  | stellar tx simulate
```

Đo cùng một kịch bản (phát hành cho N nhà đầu tư, chia một kỳ, một lần clawback) trên cả hai cách rồi so tổng phí. Với dự án của ngân hàng, cân nhắc cả chi phí "ẩn": công sức audit, bảo trì mã, quản lý TTL của Cách B so với việc dùng thành phần dựng sẵn của Cách A.

---

## 14. Nguồn tham chiếu

- Stellar Docs — Token Interface (SEP-41), Stellar Asset Contract, Control Asset Access, State Archival, Getting Started (build/deploy/invoke).
- SEP-41 (Soroban Token Interface), SEP-8 (Regulated Assets), SEP-12 (KYC), SEP-56 (Tokenized Vault).
- soroban-sdk (crates.io/docs.rs), stellar-cli (Stellar CLI Manual).

> Phiên bản ghim tại thời điểm soạn: `soroban-sdk = "26"`, stellar-cli 27.x, Rust ≥ 1.84, target `wasm32v1-none`. Kiểm tra lại phiên bản mới nhất trước khi chạy.
