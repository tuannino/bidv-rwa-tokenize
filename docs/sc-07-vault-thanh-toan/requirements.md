# SC-07: Vault thanh toán SPV

| | |
|---|---|
| Nhánh | `feat/sc-07-vault-thanh-toan`, từ `dev` @ `3342c2e` (PR #55, địa chỉ Sepolia sau SC-10) |
| Điểm | 10,5 (gồm khoảng 0,5 cho việc kèm K1 đến K4) |
| Mức kiểm chứng | **Cao** (hợp đồng giữ tiền và token của SPV) |
| Trạng thái spec | **Bản 2, ngày 19/10/2026**: chủ dự án chốt CH-1 đến CH-6 và phương án một chain; đã xử lý góp ý review của Codex (mục cuối) |
| Thứ tự | Sau SC-10 (xong). Trước SC-03 (hợp đồng khớp lệnh gọi vào vault) |
| Căn cứ | DS-01 bản 3: QĐ-1, QĐ-2, QĐ-5, QĐ-6, QĐ-12, QĐ-13, QĐ-15 đến QĐ-17, QĐ-19. Các chốt mới ghi vào DS-01 bản 4 |

## Mục tiêu

1. Có hợp đồng `SpvPaymentVault` giữ WPT chưa bán và VNDB thu về của SPV, là **ví SPV** đăng ký trong
   `ProjectToken` (QĐ-2).
2. Luật khoá chạy trên chuỗi: SPV chỉ rút được phần vượt phần khoá; phần khoá tính theo `FIXED` hoặc
   `PERCENT` đúng công thức QĐ-19 và CH-1; chốt kỳ `PERCENT` bằng số đẩy từ ngoài chuỗi (QĐ-13).
3. Vault cung cấp sẵn **hai hàm quyết toán** (`settleBuy`, `settleSell`) cho hợp đồng khớp lệnh SC-03 gọi,
   kèm dấu chống trùng `orderRef` và sự kiện `OrderSettled` (QĐ-17). SC-07 chưa có hợp đồng khớp lệnh thật.
4. Ứng dụng **đọc** được trạng thái vault và hiển thị công khai cho Giao dịch viên và Kiểm soát viên
   (QĐ-13). Không có thao tác ghi vault nào từ giao diện ở task này.

## Phương án trình diễn (chủ dự án chốt 19/10/2026)

- Dự án chỉ chạy **một** phương án: ví SPV là **vault**. Giữ một chain `evm` như hiện tại; OP-05 triển khai
  lại `evm` với vault và ghi đè bộ địa chỉ hiện tại.
- Phương án cũ "Mint/Burn thẳng vào ví SPV thường" **không** duy trì song song. Điểm khôi phục được ghi lại
  (K4) để khi cần thì checkout đúng trạng thái `dev` ngày 19/10/2026.
- Lý do kỹ thuật: mỗi bộ `ProjectToken` chỉ có một ví SPV, ghi ở lần Mint đầu và không đổi được (SC-02),
  nên hai phương án không thể cùng chạy trên một bộ hợp đồng.

## Hiện trạng đã đo (Supervisor, `dev` @ `3342c2e`)

```bash
grep -n "CONTRACT_NAMES" -A9 packages/shared/src/types.ts
# 7 hợp đồng: ProjectToken, VNDToken, ProfitDistributor, Redemption, IdentityRegistry, ModularCompliance, AllowAllModule
grep -n "deployContract" packages/contracts-evm/scripts/deploy.js
# thứ tự triển khai kết thúc ở AllowAllModule (dòng 122); vault thêm sau cùng để địa chỉ hardhat-local cũ không đổi
grep -n "deployedAt" packages/shared/src/addresses.json
# address book chỉ lưu thời điểm, KHÔNG lưu số block triển khai
grep -n "computeWithdrawLimit\|readSellerWithdrawPolicy" app/src/lib/bank/seller.service.ts
# Tổng quan Người bán tính phần khoá NGOÀI chuỗi theo cấu hình FE-21 (dòng 103, 122)
grep -n "mode: 'PERCENT'" app/src/lib/bank/withdraw-limit.ts
# PERCENT của FE-21 = phần trăm SỐ DƯ lúc rút, làm tròn lên, chặn bằng số dư. KHÁC nghĩa PERCENT của DS-01
grep -n "@pending BE-13" app/src/components/pages/seller-withdraw.tsx
# màn rút của Người bán chạy trên dữ liệu tạm, chưa có nghiệp vụ rút ở backend (BE-13, đợt 7)
grep -n "TELLER_NAV\|CONTROLLER_NAV" app/src/components/layout/nav-config.ts
# menu theo vai; mỗi mục có href, label, icon, shortcut
grep -n "OP-06\|OP-07\|SC-09\|SC-10" .kiro/task-status.json
# OP-07 đã ở done; OP-06, SC-09, SC-10 ở inProgress
grep -n "🔶" docs/CHECKPOINT_OP06.md docs/CHECKPOINT_SC09.md docs/CHECKPOINT_SC10.md
# ba checkpoint còn điều kiện chờ bằng chứng Sepolia
```

- Bộ hợp đồng: 108 ca kiểm thử xanh trên `dev`.
- Sepolia (chain `evm`) đang chạy bộ 7 hợp đồng triển khai ngày 19/10/2026, ví SPV là ví thường
  `0x5a5B…c4fd`. **SC-07 không đụng Sepolia**; vault lên Sepolia ở OP-05.

## Quyết định thiết kế

### QĐ-A. Giao diện hợp đồng `SpvPaymentVault`

Tệp `packages/contracts-evm/contracts/SpvPaymentVault.sol`. Kế thừa `AccessControlEnumerable`, `Pausable`,
`ReentrancyGuard` của OpenZeppelin 5.6.1; dùng `Math.mulDiv` cho phép nhân rồi chia. Không proxy (QĐ-7).

**Constructor:** `constructor(address projectToken_, address paymentToken_, address admin)`. Ba địa chỉ
khác 0, lưu `immutable`. Cấp `DEFAULT_ADMIN_ROLE` cho `admin`. Không cấp vai nào khác trong constructor.

**Vai** (QĐ-6, thêm `PAUSER_ROLE` theo CH-2). Dùng `AccessControlEnumerable` để đếm được người giữ vai
(`getRoleMemberCount`), phục vụ kiểm "không ai giữ `MATCHER_ROLE`" ở R8.

| Vai | Hàm | Ai giữ trong bản thử |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | cấp, thu vai; `setPayoutWallet` | khoá ký máy chủ |
| `MATCHER_ROLE` | `settleBuy`, `settleSell` | **chỉ** hợp đồng khớp lệnh (SC-03). `deploy.js` không cấp cho ai |
| `CONFIG_ROLE` | `setLockMode`, `setFixedLock`, `setPercentRate`, `closePeriod` | khoá ký máy chủ, thay Kiểm soát viên |
| `WITHDRAWER_ROLE` | `withdraw` | khoá ký máy chủ |
| `PAUSER_ROLE` | `pauseWithdrawals`, `unpauseWithdrawals` | khoá ký máy chủ |

**Trạng thái:**

| Biến | Kiểu | Ý nghĩa |
|---|---|---|
| `lockMode` | `enum LockMode { UNSET, FIXED, PERCENT }` | khởi tạo `UNSET`; đã rời `UNSET` thì không quay lại |
| `fixedLockAmount` | `uint256` | số khoá của `FIXED` |
| `percentRateBps` | `uint256` | tỷ lệ đang hiệu lực, đơn vị phần vạn, `<= 10000` |
| `pendingPercentRateBps`, `hasPendingRate` | `uint256`, `bool` | tỷ lệ chờ áp ở lần chốt kỳ kế tiếp |
| `netProceeds` | `uint256` | tổng VNDB thu ròng từ bán WPT (thu khi bán trừ chi khi mua lại); không âm |
| `lastPeriodRef` | `uint256` | mã kỳ đã chốt gần nhất; 0 khi chưa chốt kỳ nào |
| `lastDistributedPrev` | `uint256` | số đã chia đẩy lên ở lần chốt gần nhất |
| `percentLocked` | `uint256` | phần khoá `PERCENT` tính và **lưu** ở lần chốt gần nhất |
| `settledOrders` | `mapping(bytes32 => bool)` | dấu chống trùng `orderRef` (QĐ-17) |
| `payoutWallet` | `address` | ví duy nhất nhận tiền rút (CH-3); 0 khi chưa đặt |

### QĐ-B. Phần khoá và số rút được (QĐ-5, QĐ-13, QĐ-19, CH-1)

`lockedAmount()` (view), với `B` là số dư VNDB hiện tại của vault:

| `lockMode` | Chưa chốt kỳ nào (`lastPeriodRef == 0`) | Đã chốt ít nhất một kỳ |
|---|---|---|
| `UNSET` | `B` (khoá toàn bộ, CH-5) | `B` |
| `FIXED` | `fixedLockAmount` | `fixedLockAmount` |
| `PERCENT` | `mulDiv(netProceeds, percentRateBps, 10000)` (kỳ đầu, CH-1) | `percentLocked` |

- **Kỳ đầu (CH-1):** phần khoá bằng tỷ lệ nhân giá trị token đã bán ra đang lưu hành ngoài thị trường,
  tức **tổng VNDB vault đã thu ròng** (`netProceeds`). Cập nhật sau từng lệnh. Tỷ lệ dùng là tỷ lệ đang
  hiệu lực tại thời điểm đọc: trước lần chốt đầu, `setPercentRate` có hiệu lực ngay.
- `netProceeds` là tiền thật đã vào vault, không nhân lại theo giá hiện hành. Giá hiện cố định nên hai
  cách bằng nhau (CH-1 của DS-01).
- Làm tròn **xuống** (`Math.mulDiv`). Ghi rõ trong NatSpec.
- `withdrawable()` = `B - lockedAmount()` nếu `B > lockedAmount()`, ngược lại 0. Không để phép trừ revert.
- `lockedAmount()` có thể lớn hơn `B` (sau lệnh mua lại lớn). Đây là trạng thái hợp lệ.

**Đổi tham số:**

| Hàm | Điều kiện | Hiệu lực |
|---|---|---|
| `setLockMode(LockMode m)` | `m != UNSET` | ngay |
| `setFixedLock(uint256 amount)` | không | ngay (QĐ-19) |
| `setPercentRate(uint256 bps)` | `bps <= 10000` | chưa chốt kỳ nào: **ngay**. Đã chốt: lưu vào `pending`, áp ở `closePeriod` kế tiếp (QĐ-19). Gọi lại trước khi chốt thì ghi đè `pending` |
| `closePeriod(uint256 periodRef, uint256 distributedPrev)` | `periodRef == lastPeriodRef + 1` (kỳ đầu là 1) | áp `pending` nếu có, rồi `percentLocked = mulDiv(distributedPrev, percentRateBps, 10000)`; lưu `lastPeriodRef`, `lastDistributedPrev` |

- `closePeriod` chạy được ở **mọi** `lockMode`: kỳ là nghiệp vụ chia lợi nhuận, không phụ thuộc chế độ khoá.
  `percentLocked` chỉ được dùng khi chế độ là `PERCENT`.
- `distributedPrev` là số VNDB đã nạp quỹ kỳ trước, **gồm phần SPV** (QĐ-19). Vault không kiểm số này
  (QĐ-13, giả định tin cậy).
- **`periodRef` là bộ đếm độc lập trên chuỗi** (1, 2, 3…), không phải `periodKey` dạng chuỗi trong
  database (ví dụ `2026-Q1`). SC-07 không lưu ánh xạ; ánh xạ `periodKey` sang `periodRef` thuộc SC-06 khi
  nối luồng chia lợi nhuận. Script R7 in cả hai nếu người chạy nhập nhãn, nhãn không lên chuỗi.
- Không có hàm sửa hay chốt lại kỳ cũ.

### QĐ-C. Quyết toán (cho SC-03 gọi)

```solidity
enum Side { BUY, SELL }
function settleBuy(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount, uint256 price)
  external onlyRole(MATCHER_ROLE) nonReentrant;
function settleSell(bytes32 orderRef, address investor, uint256 wptAmount, uint256 vndbAmount, uint256 price)
  external onlyRole(MATCHER_ROLE) nonReentrant;
function isOrderSettled(bytes32 orderRef) external view returns (bool);
```

Kiểm chung cho cả hai, theo thứ tự: `orderRef != 0`; `!settledOrders[orderRef]`; `investor != 0`;
`wptAmount > 0`; **`price > 0`**; `vndbAmount == wptAmount * price` (WPT và VNDB cùng 0 số thập phân,
`price` là VNDB cho 1 WPT). Ghi `settledOrders[orderRef] = true` **trước** khi chuyển token.

- `settleBuy`: vault chuyển `wptAmount` WPT cho `investor` bằng `transfer` thường (đi qua `isVerified`,
  `canTransfer`, đóng băng của `ProjectToken`); `netProceeds += vndbAmount`.
- `settleSell`: vault trả `vndbAmount` VNDB cho `investor`; **không** kiểm phần khoá (CH-2 của DS-01);
  `netProceeds = netProceeds > vndbAmount ? netProceeds - vndbAmount : 0`.
- Cả hai phát `OrderSettled(orderRef, investor, side, wptAmount, vndbAmount, price)`.
- `pauseWithdrawals` **không** chặn quyết toán (CH-2): nhà đầu tư bán lại không bị kẹt. Tạm dừng quyết
  toán đặt ở hợp đồng khớp lệnh (SC-03).

**Chân vào và biên tin cậy (CH-4).** Theo QĐ-15, hợp đồng khớp lệnh là bên được nhà đầu tư ủy quyền, tự
kéo VNDB (mua) hoặc WPT (bán) từ nhà đầu tư vào vault trong cùng giao dịch. **Vault không tự chứng minh
chân vào.** `MATCHER_ROLE` là **biên tin cậy đặc quyền**: ai giữ vai này lấy được WPT (`settleBuy`) và VNDB
(`settleSell`) ra khỏi vault theo số mình khai. Lý do không thêm bước kiểm: muốn vault tự đối chiếu số dư
trước và sau chân vào thì hoặc phải gọi ngược sang hợp đồng khớp lệnh giữa chừng (mẫu gọi lại, thêm rủi
ro gọi lồng), hoặc phải đổi bên được ủy quyền thành vault (đổi QĐ-15, FE-05 ký `permit` cho vault). Cả hai
không còn là việc nhỏ, nên giữ phương án tin `MATCHER` theo chốt của chủ dự án. SC-07 dựng hợp đồng kiểm
thử `TestMatcher` làm đủ hai chân để chứng minh tính nguyên tử; SC-03 kiểm lại với hợp đồng thật.

### QĐ-D. Rút tiền của SPV (CH-3)

```solidity
function withdraw(uint256 amount) external onlyRole(WITHDRAWER_ROLE) whenNotPaused nonReentrant;
function setPayoutWallet(address wallet) external onlyRole(DEFAULT_ADMIN_ROLE);
function pauseWithdrawals() external onlyRole(PAUSER_ROLE);
function unpauseWithdrawals() external onlyRole(PAUSER_ROLE);
```

- `withdraw`: `payoutWallet != 0`, `amount > 0`, `amount <= withdrawable()`. Chuyển VNDB tới `payoutWallet`;
  hàm **không** nhận địa chỉ đích làm tham số.
- `setPayoutWallet`: `wallet != 0` và **đã xác minh** trong sổ danh tính của token
  (`projectToken.identityRegistry().isVerified(wallet)`), sai thì revert `PayoutWalletNotVerified`. Cách đưa
  ví vào danh sách giống cách đăng ký ví SPV hiện nay (runbook: `registerIdentity` rồi `setPayoutWallet`).
- Vault **không** có hàm rút WPT, không có hàm rút token bất kỳ, không nhận ETH.
- **Giới hạn bảo vệ (ghi nguyên văn ý này vào NatSpec và `tech-report.md`):** trong bản thử, một khoá ký máy
  chủ giữ cả `DEFAULT_ADMIN_ROLE` và `WITHDRAWER_ROLE`. `payoutWallet` chỉ **ngăn nhập nhầm đích**; nó
  **không** bảo vệ khi khoá máy chủ bị lộ, vì người có khoá gọi được `setPayoutWallet` rồi `withdraw`. Tách
  khoá admin và khoá rút, hoặc đổi ví nhận theo hai bước có thời gian chờ, là việc của giai đoạn sau.

### QĐ-E. Sự kiện và lỗi

Sự kiện: `OrderSettled(bytes32 indexed orderRef, address indexed investor, Side side, uint256 wptAmount,
uint256 vndbAmount, uint256 price)`; `LockModeChanged(LockMode mode)`; `FixedLockSet(uint256 amount)`;
`PercentRateSet(uint256 bps, bool pending)`; `PeriodClosed(uint256 indexed periodRef, uint256
distributedPrev, uint256 rateBps, uint256 percentLocked, address indexed operator)`;
`Withdrawn(address indexed to, uint256 amount, address indexed operator)`; `PayoutWalletSet(address
wallet)`; `Paused` / `Unpaused` của `Pausable`; `RoleGranted` / `RoleRevoked` của OpenZeppelin.

Lỗi tuỳ biến (tên cố định, ứng dụng dịch trong `evm.adapter.ts`): `ZeroAddress`, `ZeroAmount`,
`ZeroPrice`, `ZeroOrderRef`, `OrderAlreadySettled(bytes32)`, `AmountPriceMismatch(uint256 wpt, uint256 vndb,
uint256 price)`, `InvalidLockMode`, `RateTooHigh(uint256)`, `InvalidPeriodRef(uint256 expected, uint256
got)`, `PayoutWalletNotSet`, `PayoutWalletNotVerified(address)`, `ExceedsWithdrawable(uint256 requested,
uint256 available)`.

### QĐ-F. Đăng ký danh tính, triển khai, address book

- `deploy.js` triển khai vault **sau cùng** (sau `AllowAllModule`), rồi: `identityRegistry.registerIdentity(
  vault, 704)`; cấp `CONFIG_ROLE`, `WITHDRAWER_ROLE`, `PAUSER_ROLE` cho `admin`. **Không** cấp
  `MATCHER_ROLE`, **không** đặt `payoutWallet`, **không** cấu hình khoá (vault ở `UNSET`).
- Thứ tự bảy hợp đồng cũ giữ nguyên nên địa chỉ hardhat-local cũ không đổi; `addresses.json` thêm
  `SpvPaymentVault` cho `hardhat-local`. Khoá `evm` **giữ nguyên** 7 hợp đồng cho tới OP-05.
- **Address book thêm `deployBlock`** (số block của giao dịch triển khai hợp đồng đầu tiên trong bộ) cho mỗi
  chain mà `deploy.js` ghi. Kiểu `DeploymentRecord` thêm trường tuỳ chọn `deployBlock?: number`. Mọi phép
  đọc sự kiện (R1, R8) quét từ `deployBlock`, **không** quét từ block 0; khi thiếu `deployBlock` (bộ `evm`
  hiện tại) thì báo rõ "thiếu block triển khai" thay vì quét từ 0.
- `CONTRACT_NAMES` thêm `SpvPaymentVault`. Thiếu địa chỉ vault trên một chain **không** chặn các thao tác
  khác (khác lớp chặn SC-09 cho `IdentityRegistry`).

### QĐ-G. Giả định tin cậy (ghi vào NatSpec đầu hợp đồng và `tech-report.md`)

1. Người giữ khoá ký máy chủ chạm được tài sản trong vault qua `AGENT_ROLE` của `ProjectToken`
   (`forcedTransfer`, `burn` của agent) và `BURNER_ROLE` của `VNDToken`. Luật khoá chặn SPV, không chặn
   quản trị ngân hàng (CH-5 của DS-01). Đường Burn lập duyệt (SC-02) dùng `burn` của agent trên vault,
   **phải** tiếp tục chạy.
2. `MATCHER_ROLE` là biên tin cậy đặc quyền; vault không tự chứng minh chân vào (CH-4).
3. `DEFAULT_ADMIN_ROLE` cấp được mọi vai, kể cả `MATCHER_ROLE`.
4. Một khoá máy chủ giữ cả admin và rút; `payoutWallet` chỉ ngăn nhập nhầm đích (CH-3).
5. Vault tin số `distributedPrev` đẩy lên (QĐ-13).

### QĐ-H. Vì sao vault khởi tạo ở `UNSET` (CH-5)

Giữa lúc triển khai và lúc Kiểm soát viên cấu hình có một khoảng trống (OP-05: triển khai, Mint đầu, rồi
mới cấu hình). Nếu mặc định là "không khoá" thì trong khoảng đó người giữ khoá rút rút được toàn bộ tiền
thu; nếu mặc định là một con số cụ thể thì con số đó là quyết định nghiệp vụ bị viết cứng trong mã. Khởi
tạo `UNSET` (khoá toàn bộ) làm cho lỗi quên cấu hình rơi về phía an toàn: không ai rút được, mua bán vẫn
chạy. Cách này cũng giữ đúng luật đã có ở FE-21: chưa cấu hình thì không rút được.

## Yêu cầu phía ứng dụng

**R1. Cổng đọc vault trong `ILedgerPort`.** Thêm nhóm `ILedgerVault`:

```ts
vaultStatus(): Promise<VaultStatus | null>; // null khi chain không có vault (mock, stellar, evm hiện tại)
vaultPeriodCloses(limit: number): Promise<VaultPeriodClose[]>; // sự kiện PeriodClosed từ deployBlock, mới nhất trước
```

`VaultStatus` gồm: địa chỉ vault, số dư WPT, số dư VNDB, `lockMode`, `fixedLockAmount`, `percentRateBps`,
`pendingPercentRateBps` (null khi không có), `netProceeds`, `lockedAmount`, `withdrawable`,
`lastPeriodRef`, `lastDistributedPrev`, `percentLocked`, `payoutWallet` (null khi chưa đặt),
`withdrawalsPaused`. `VaultPeriodClose` gồm: `periodRef`, `distributedPrev`, `rateBps`, `percentLocked`,
`operator`, `txHash`, `blockNumber`, thời điểm block. Số tiền là `bigint` trong cổng, chuỗi ở biên máy
chủ và trình duyệt. `mock.adapter.ts` và `stellar.adapter.ts` trả `null` và mảng rỗng (CH-6).

**R2. Quyền `vault:read`.** Thêm vào `ACTIONS`, cấp cho `TELLER` và `CONTROLLER`. Không cấp `INVESTOR`,
`SELLER` (Người bán thấy số khoá qua R4).

**R3. Màn công khai trạng thái vault** (QĐ-13).
- Đường dẫn `/vault`, trong nhóm route `(ops)`, kiểm `vault:read` ở máy chủ.
- Menu: mục "Vault thanh toán SPV" trong nhóm "Vận hành" của `TELLER_NAV` và `CONTROLLER_NAV` (sau mục
  "Chia lợi nhuận"), phím tắt `K`; nếu `K` trùng trong menu của vai đó thì chọn chữ chưa dùng và ghi vào
  checkpoint.
- Khi `vaultStatus()` là `null`: một dòng "Chain này chưa triển khai vault thanh toán SPV".
- Khi có: các số ở R1; chế độ khoá bằng chữ (`UNSET` hiển thị "Chưa cấu hình, khoá toàn bộ"); tỷ lệ theo
  phần trăm (2000 phần vạn hiển thị 20%); tỷ lệ chờ áp nếu có; trạng thái tạm dừng rút.
- Bảng lịch sử chốt kỳ (10 lần gần nhất): kỳ, số đã chia kỳ trước, tỷ lệ, phần khoá, người đặt (địa chỉ
  ví gửi giao dịch), thời điểm, mã giao dịch có liên kết trình duyệt khối khi chain có trình duyệt khối.
  Thiếu `deployBlock` thì hiện thông báo thay cho bảng.
- Không có nút ghi nào.

**R4. Tổng quan Người bán đọc khoá trên chuỗi khi có vault.**
- Không tái sử dụng nguyên trạng `WithdrawPolicy`. Khai kiểu phân biệt nguồn:
  `{ source: 'config'; policy: WithdrawPolicy }` (FE-21: phần trăm số dư, làm tròn lên, chặn bằng số dư)
  và `{ source: 'on-chain'; lockMode; fixedLockAmount; percentRateBps; netProceeds; percentLocked }`
  (vault: làm tròn xuống, có thể khoá lớn hơn số dư). Màn hiển thị ghi rõ nguồn.
- Khi `vaultStatus()` khác `null`: ví thanh toán là **địa chỉ vault**, kể cả khi `ProjectToken.spvWallet()`
  còn `null` (vault đã triển khai, chưa Mint đầu); `paymentVnd`, `lockedVnd`, `withdrawableVnd` lấy từ vault.
  Nếu `spvWallet()` khác `null` và khác địa chỉ vault, hiện cảnh báo "ví SPV trên chuỗi không phải vault".
- Khi `null`: giữ nguyên cách tính FE-21 (mock). Việc gỡ PERCENT kiểu FE-21 và mô phỏng khoá DS-01 trên
  mock thuộc BE-13 (chủ dự án chốt theo DS-01, gộp vào task liên quan).

**R5. Dịch lỗi vault** trong `REVERT_MESSAGES` của `evm.adapter.ts` cho đủ các lỗi ở QĐ-E.

**R6. Chặn Mint đầu sai đích.** Trong luồng phát hành lần đầu (`issuance.service.ts`, cả lúc lập yêu cầu và
lúc thực hiện sau duyệt) và đường dữ liệu thử `demo:mint-token` nếu nó gọi được `mintInitialSupply`: nếu
address book của chain có `SpvPaymentVault` thì ví nhận **phải** bằng địa chỉ vault, sai thì trả lỗi nghiệp
vụ trước khi gửi giao dịch. Chain không có vault: giữ nguyên hành vi. Liệt kê trong checkpoint mọi đường gọi
`mintInitialSupply` tìm được bằng `grep` và đường nào đã chặn.

**R7. Script cấu hình vault** `packages/contracts-evm/scripts/vault-admin.js`, chạy bằng `npx hardhat run`
với biến môi trường chọn lệnh: `status`, `set-mode`, `set-fixed`, `set-rate`, `close-period`, `set-payout`,
`pause`, `unpause`. Mặc định **chỉ in** giao dịch sẽ gửi; cần `VAULT_ADMIN_CONFIRM=yes` mới gửi. In mã giao
dịch, không in khoá hay URL RPC. Đường cấu hình tạm cho tới FE-07.

**R8. Công cụ triển khai đồng bộ.** `verify-deployment.js` kiểm vault khi address book có vault: có bytecode,
hai địa chỉ token khớp, `isVerified(vault)` là `true`, `admin` giữ ba vai cấu hình,
`getRoleMemberCount(MATCHER_ROLE) == 0`, `lockMode == UNSET` ngay sau triển khai. `fund-sepolia.js`
(`measureLocalGas`) cộng gas triển khai vault, đăng ký danh tính và cấp ba vai vào ước lượng `deploy`.

## Việc kèm (chủ dự án đồng ý gộp ngày 19/10)

- **K1. Trạng thái task theo bằng chứng.**
  - `SC-07` vào `inProgress`. `OP-07` đã ở `done`, không đụng.
  - `CHECKPOINT_SC09.md` điều kiện 11 và `CHECKPOINT_SC10.md` điều kiện 7: thêm bằng chứng ở Phụ lục A
    (Supervisor đã đọc trên chuỗi), đổi 🔶 thành ✅, rồi chuyển `SC-09`, `SC-10` sang `done`.
  - `CHECKPOINT_OP06.md` điều kiện 7 còn yêu cầu "lịch sử bền sau đóng mở trình duyệt" trên bản Neon. Chỉ
    đổi ✅ và chuyển `OP-06` sang `done` khi chủ dự án xác nhận mục này; nếu chưa có xác nhận thì giữ 🔶,
    chỉ thêm bằng chứng giao dịch ở Phụ lục A.
- **K2.** `dod-verify-sepolia.js`: từ chối chạy nhánh P4 khi `initialSupplyMinted()` là `false` (nhánh này
  gọi `mintInitialSupply` vào ví ngân hàng, khoá ví SPV vĩnh viễn), báo rõ lý do, không gửi giao dịch nào.
  Ghi đầu tệp: không dùng script này trên bộ hợp đồng trình diễn.
- **K3.** `fund-sepolia.js`: thông báo lỗi cho biết **loại** lỗi (RPC, ước lượng gas cục bộ, thiếu
  `FUNDER_PRIVATE_KEY`, số dư tài khoản tổng), vẫn không in URL, khoá hay thân lỗi gốc. Thêm ca vào
  `test/fund-sepolia.test.js`.
- **K4. Điểm khôi phục phương án ví SPV thường.** Thêm mục vào `docs/tech-report.md` (mục lịch sử phương án):
  commit `3342c2e` trên `dev` (sau PR #55) là trạng thái cuối hỗ trợ Mint/Burn thẳng vào ví SPV thường trên
  EVM; bộ địa chỉ Sepolia của trạng thái đó; mã giao dịch ở Phụ lục A; cách khôi phục
  (`git checkout 3342c2e` hoặc tag bên dưới, dùng bộ địa chỉ trong `addresses.json` của commit đó). Ghi rõ:
  chain mock vẫn chạy kiểu ví thường vì chưa mô phỏng vault (CH-6). **[Chủ dự án]** tạo tag
  `poc-spv-vi-thuong-20261019` tại `3342c2e` và push (coder không push tag).

## Ràng buộc

- Không sửa `ProjectToken`, `VNDToken`, `ProfitDistributor`, `Redemption`, `IdentityRegistry`,
  `ModularCompliance`, `AllowAllModule`. Nếu buộc phải sửa, dừng lại hỏi Supervisor.
- Không thêm thư viện ngoài OpenZeppelin 5.6.1 đã có. Không triển khai Sepolia. Không commit khoá riêng hay
  URL RPC có khoá.
- Không gỡ lớp chặn SC-03 nào trong `evm.adapter.ts` (`executePurchase`, `executeSale`…).
- Luật kiến trúc giữ nguyên: nghiệp vụ gọi chuỗi qua `ILedgerPort`, kiểm quyền qua `can()`.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy (`efficiency.md`).

## Mức kiểm chứng: Cao

Số trong các ca dùng giá 100.000 VNDB một WPT, tỷ lệ 20% (2000 phần vạn) trừ khi ghi khác.

| Ca | Kiểm |
|---|---|
| 1 | Triển khai: ba địa chỉ khác 0; `lockMode == UNSET`; `lockedAmount == B`; `withdrawable == 0`; chỉ admin có vai; `getRoleMemberCount(MATCHER_ROLE) == 0` |
| 2 | **Kỳ đầu PERCENT cập nhật sau từng lệnh:** đặt tỷ lệ 20%, chế độ `PERCENT`. Mua 1.000 WPT (100.000.000 VNDB): `netProceeds = 100.000.000`, khoá 20.000.000. Bán lại 300 WPT (30.000.000): `netProceeds = 70.000.000`, khoá 14.000.000, rút được = số dư trừ 14.000.000 |
| 3 | **Thu ròng dừng ở 0:** sau ca 2, nạp thêm VNDB cho vault rồi bán lại 800 WPT (80.000.000): `netProceeds = 0`, khoá 0, không revert |
| 4 | **Phần khoá không chặn chi bán lại; số dư dưới phần khoá:** `FIXED` 50.000.000, số dư 60.000.000; bán lại 200 WPT (20.000.000) vẫn chạy; số dư 40.000.000 < khoá; `withdrawable == 0`; `withdraw(1)` revert `ExceedsWithdrawable`; mua tiếp đưa số dư lên thì rút được đúng phần vượt |
| 5 | **Chốt kỳ:** `closePeriod(1, 50.000.000)` ở 20%: khoá 10.000.000 và **không đổi** khi có thêm lệnh mua sau đó. Sự kiện `PeriodClosed` đủ trường |
| 6 | **Tỷ lệ mới áp từ kỳ kế tiếp:** sau ca 5, `setPercentRate(3000)`: khoá vẫn 10.000.000, `pending = 3000`; `closePeriod(2, 40.000.000)`: khoá 12.000.000, tỷ lệ hiệu lực 3000, hết `pending` |
| 7 | **Trước lần chốt đầu, tỷ lệ có hiệu lực ngay (CH-1):** chưa chốt, `netProceeds = 100.000.000`, đổi 20% sang 10%: khoá đổi ngay từ 20.000.000 sang 10.000.000 |
| 8 | **FIXED có hiệu lực ngay;** chuyển qua lại `FIXED` và `PERCENT` dùng đúng số của từng chế độ; `setLockMode(UNSET)` revert `InvalidLockMode` |
| 9 | **Mã kỳ:** `closePeriod(2, …)` khi chưa có kỳ 1 revert `InvalidPeriodRef(1, 2)`; chốt lại kỳ 1 revert; `closePeriod` chạy được ở `UNSET` và `FIXED` |
| 10 | `setPercentRate(10001)` revert `RateTooHigh`; `10000` được. Số lớn: `closePeriod(1, 2^255)` ở tỷ lệ 10000 không tràn số, khoá bằng `2^255` (`mulDiv`) |
| 11 | **Chống trùng `orderRef`:** cùng mã dùng cho mua rồi bán (hoặc mua hai lần) revert `OrderAlreadySettled`; `orderRef = 0` revert `ZeroOrderRef`; `isOrderSettled` đúng trước và sau |
| 12 | **Giá và số lượng:** `price = 0` (kèm `vndbAmount = 0`) revert `ZeroPrice` ở cả `settleBuy` và `settleSell`, không WPT nào rời vault; `vndbAmount != wptAmount * price` revert `AmountPriceMismatch`; `wptAmount = 0` revert |
| 13 | **Vai:** ví không có vai gọi `settleBuy`, `settleSell`, `setLockMode`, `setFixedLock`, `setPercentRate`, `closePeriod`, `withdraw`, `pauseWithdrawals`, `setPayoutWallet` đều revert lỗi vai của OpenZeppelin |
| 14 | **Rút:** chưa đặt ví nhận revert `PayoutWalletNotSet`; `setPayoutWallet` ví chưa xác minh revert `PayoutWalletNotVerified`; tiền chỉ tới `payoutWallet`; vượt `withdrawable` revert; sự kiện `Withdrawn` đúng |
| 15 | **Tạm dừng rút:** `pauseWithdrawals` chặn `withdraw` nhưng `settleBuy`, `settleSell`, `closePeriod` vẫn chạy; `unpause` mở lại |
| 16 | **Nguyên tử hai chân với `TestMatcher`:** (a) nhà đầu tư chưa xác minh: mua revert cả giao dịch, VNDB của nhà đầu tư không đổi, `orderRef` chưa ghi; (b) vault thiếu VNDB: bán lại revert, WPT của nhà đầu tư không đổi; (c) ca thành công: số dư hai bên khớp, `OrderSettled` phát một lần |
| 17 | **Vault phải đăng ký danh tính:** vault chưa đăng ký thì `mintInitialSupply(vault, …)` revert và chân vào WPT của lệnh bán revert |
| 18 | **Lợi nhuận phần SPV vào vault (QĐ-12):** `ProfitDistributor.distributeTo(id, [vault])` tăng số dư VNDB và `withdrawable` (ở `FIXED`), `netProceeds` **không đổi** |
| 19 | **Đường agent vẫn chạy (QĐ-G):** `burn` của agent trên WPT của vault và `forcedTransfer` từ vault chạy; `BURNER_ROLE` đốt được VNDB của vault (ca ghi nhận giả định tin cậy, không phải tính năng) |
| 20 | **Gọi lồng qua bộ luật:** hợp đồng kiểm thử `ReentrantModule` (module compliance, được cấp `MATCHER_ROLE` trong kiểm thử) gọi lại `settleBuy` cùng `orderRef` trong `moduleTransferAction`; giao dịch gốc revert, không WPT nào chuyển hai lần |
| 21 | Bộ cũ xanh, không nới điều kiện; số ca tăng đúng bằng số ca mới |
| 22 | **Đột biến**, dán đầu ra đỏ rồi hoàn nguyên: (a) bỏ kiểm `settledOrders`, ca 11 đỏ; (b) `settleSell` kiểm phần khoá, ca 4 đỏ; (c) `netProceeds` trừ không chặn 0, ca 3 đỏ; (d) `setPercentRate` sau chốt áp ngay, ca 6 đỏ; (e) kỳ đầu dùng `percentLocked` thay cho `netProceeds`, ca 2 đỏ; (f) `withdrawable` không chặn 0, ca 4 đỏ; (g) `whenNotPaused` đặt lên `settleSell`, ca 15 đỏ; (h) bỏ kiểm `periodRef == lastPeriodRef + 1`, ca 9 đỏ; (i) bỏ `nonReentrant` **và** ghi dấu `orderRef` sau khi chuyển token, ca 20 đỏ; (j) bỏ kiểm `price > 0`, ca 12 đỏ; (k) `setPayoutWallet` bỏ kiểm xác minh, ca 14 đỏ; (l) trước lần chốt đầu `setPercentRate` vào `pending`, ca 7 đỏ |
| 23 | **App:** `vaultStatus()` trên nút Hardhat thật trả đúng số sau một chuỗi lệnh dựng bằng script kiểm thử; `vaultPeriodCloses` đọc từ `deployBlock`; mock và stellar trả `null`; `getSellerOverview` trả `source: 'on-chain'` và ví thanh toán là vault khi có vault (cả khi `spvWallet()` còn `null`), `source: 'config'` khi không; R6 chặn Mint đầu sai đích ở mọi đường đã liệt kê, cho qua khi đích là vault, không đổi hành vi trên chain không có vault; `vault:read` có ở `TELLER`, `CONTROLLER`, không có ở `INVESTOR`, `SELLER`; menu `/vault` hiện đúng vai |
| 24 | Đồng bộ ABI xanh; `run-local-all.sh` xanh; **mô phỏng job A** (tasks.md bước 6, có `trap` phục hồi) xanh; `evm-issuance.test.ts` và ca vault trên nút Hardhat thật xanh; quét bí mật sạch |
| 25 | K2: chạy P4 trên bộ chưa Mint đầu bị từ chối trước khi gửi giao dịch nào (nút Hardhat cục bộ); K3: ca kiểm thử mới của `fund-sepolia` xanh |

## Điều kiện hoàn thành

- [ ] `SpvPaymentVault` theo QĐ-A đến QĐ-H; giả định tin cậy QĐ-G ghi trong NatSpec (ca 1 đến 20).
- [ ] Bộ cũ xanh không nới điều kiện (ca 21). Đột biến đỏ đúng ca (ca 22).
- [ ] Triển khai, address book (`deployBlock`) và công cụ theo QĐ-F, R7, R8; địa chỉ hardhat-local của 7 hợp
      đồng cũ không đổi.
- [ ] Ứng dụng R1 đến R6 (ca 23); job A, nút Hardhat thật, quét bí mật (ca 24).
- [ ] Việc kèm K1 đến K4 (ca 25).
- [ ] `tech-report.md`: mục vault (công thức khoá, bảng vai, giả định tin cậy, khác biệt với PERCENT của
      FE-21) và mục điểm khôi phục (K4).
- [ ] **[Chủ dự án]** tạo và push tag K4; xác nhận mục "lịch sử bền" của OP-06 nếu muốn đóng OP-06.

## Quyết định đã chốt (chủ dự án, 19/10/2026)

| Mã | Câu hỏi | Chốt |
|---|---|---|
| Phương án | Giữ song song Mint thẳng ví SPV thường và vault? | **Không.** Chỉ chạy vault, một chain `evm`. Ghi điểm khôi phục (K4) |
| CH-1 | Phần khoá `PERCENT` trước lần chốt kỳ đầu | Tỷ lệ nhân giá trị token đã bán đang lưu hành (số token nhân giá), tức **tổng VNDB đã thu về** (`netProceeds`). Tỷ lệ đang hiệu lực áp ngay |
| CH-2 | Tạm dừng | Chỉ chặn rút tiền của SPV |
| CH-3 | Ví nhận tiền rút | Một ví cố định, phải được xác minh trong sổ danh tính như ví SPV. PoC giữ một khoá máy chủ cho cả admin và rút: giả định tin cậy, `payoutWallet` chỉ ngăn nhập nhầm đích |
| CH-4 | Vault kiểm chân vào | Kiểm tra không đơn giản (QĐ-C), nên giữ QĐ-15; ghi rõ `MATCHER_ROLE` là biên tin cậy đặc quyền |
| CH-5 | Khởi tạo `UNSET` | Đồng ý; lý do ở QĐ-H |
| CH-6 | Mock chưa mô phỏng vault | Đồng ý; mô phỏng và gỡ PERCENT kiểu FE-21 thuộc BE-13 |
| FE-21 | Lệch nghĩa PERCENT | Chốt theo DS-01 |
| K1 đến K4 | Gộp việc kèm | Đồng ý |

## Đã xử lý góp ý review (Codex, 19/10/2026)

| # | Góp ý | Xử lý |
|---|---|---|
| 1 | Câu "lộ khoá máy chủ cũng không rút được về ví lạ" sai khi admin và rút cùng một khoá | Bỏ câu đó. Chọn phương án giữ một khoá và ghi rõ giả định tin cậy (QĐ-D, QĐ-G mục 4) |
| 2 | `settleBuy` cho mua giá 0 | Thêm `price > 0`, lỗi `ZeroPrice`, ca 12, đột biến 22j |
| 3 | Không chứng minh được "không ai giữ `MATCHER_ROLE`"; đọc sự kiện cần block triển khai | Dùng `AccessControlEnumerable`, kiểm `getRoleMemberCount` (R8, ca 1); thêm `deployBlock` vào address book (QĐ-F) |
| 4 | K1 không khớp trạng thái repo | Viết lại K1: OP-07 đã `done`; đóng SC-09, SC-10 kèm bằng chứng Phụ lục A; OP-06 chờ chủ dự án xác nhận mục lịch sử bền |
| 5 | R4 không nên dùng nguyên `WithdrawPolicy` | Kiểu phân biệt `source: 'config' \| 'on-chain'` (R4) |
| 6 | `spvWallet` trước Mint đầu | Ví thanh toán là địa chỉ vault khi có vault; cảnh báo khi lệch (R4) |
| 7 | Route và menu màn vault | `/vault`, nhóm Vận hành, phím tắt `K` (R3) |
| 8 | `periodRef` và `periodKey` | Bộ đếm độc lập; ánh xạ thuộc SC-06 (QĐ-B) |
| 9 | Tràn số trước phép chia | `Math.mulDiv` (QĐ-A, QĐ-B, ca 10) |
| 10 | Đột biến 21i không được chấp nhận "có thể không đỏ" | Thêm `ReentrantModule`, ca 20, đột biến 22i bắt buộc đỏ |
| 11 | Dời `artifacts` có thể làm mất thư mục | `mktemp -d` và `trap` phục hồi (tasks.md bước 6) |

## Không làm

- Hợp đồng khớp lệnh, gỡ lớp chặn SC-03, `permit` (SC-03, FE-05).
- Nghiệp vụ rút từ giao diện, mã một lần, phí rút; gỡ PERCENT kiểu FE-21; mô phỏng vault trên mock (BE-13).
- Màn cấu hình khoá cho Kiểm soát viên (FE-07); SC-07 chỉ có script.
- Nối luồng chia lợi nhuận EVM, ánh xạ `periodKey`, `distributeTo` phần SPV từ ứng dụng (SC-06).
- Triển khai Sepolia (OP-05). Tách khoá admin và khoá rút (giai đoạn sau).

## Phụ lục A. Bằng chứng Sepolia (Supervisor đọc trên chuỗi ngày 19/10/2026)

Bộ hợp đồng `evm` (`deployedAt 2026-10-19T10:25:33.221Z`, PR #55): ProjectToken
`0x995c29ff422483Ddbc7C6A671ECEC5A5f38C3d62`, IdentityRegistry `0xA1Fb6C6831a4C1A66D6CE0090D2790Cd37a4b950`.
Đọc lúc kiểm: `cap = 20000000`, ví SPV `0x5a5B0Ab8613bA0F16e257228e4109A8F611Ec4fd` đã xác minh.

| Lượt | Mã giao dịch | Block | Kết quả đọc từ biên nhận |
|---|---|---|---|
| Mint đầu | `0xaa529aa41b03174d3b494eec254fb0876a7f44b1657253d18eef08e3f62f6f20` | 11947924 | thành công; `InitialSupplyMinted` 1.000 WPT vào SPV; người gửi `0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076` |
| Burn | `0x6b68b7571b93a37a738b99e9966e6cebb2b2bc0b1ee4edfaee96143f025257d8` | 11947952 | thành công; `Transfer` 1.000 WPT từ SPV về địa chỉ 0 |
| Mint bổ sung | `0x246804b1bc59a9d263b73a25b4f82ed1443d880c990a5c4d0f0ae2be0980f6aa` | 11947989 | thành công; hàm `mint` (`0x40c10f19`); `Transfer` 1.000 WPT vào SPV; sau đó tổng cung và số dư SPV 1.000 |

Coder chép bảng này vào checkpoint, ghi nguồn "Supervisor đọc trên chuỗi", có thể đối chiếu lại bằng trình
duyệt khối Sepolia. Không cần khoá hay RPC riêng để đối chiếu.
