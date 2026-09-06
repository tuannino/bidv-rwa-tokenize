# Hướng dẫn viết và triển khai smart contract RWA năng lượng tái tạo trên EVM

Tài liệu kỹ thuật cho đội phát triển. Đi kèm bộ mã nguồn Solidity trong thư mục `rwa-evm/` gồm bốn hợp đồng: `ProjectToken` (SPT), `VNDToken` (tVND), `ProfitDistributor`, `Redemption`.

**Bài toán.** Token hóa quyền hưởng lợi nhuận của một dự án điện mặt trời (RWA), có mô hình **chia lợi nhuận định kỳ** cho nhà đầu tư, vai trò phát hành là **ngân hàng**. Tài liệu hướng dẫn viết từng dạng hợp đồng cho các quy trình mint, burn, transfer có kiểm soát, clawback, đóng băng, snapshot, tính lợi nhuận, chia lợi nhuận, mua lại (redeem); và hướng dẫn cài đặt, biên dịch, kiểm thử, triển khai lên cả hai nhánh mạng (public testnet và Hyperledger Besu permissioned) rồi chạy một chu kỳ đầu-cuối.

**Vì sao chọn EVM.** Cùng một mã Solidity chạy được trên public chain (Ethereum, các L2 như Base/Arbitrum/Polygon) lẫn mạng permissioned tương thích EVM (Hyperledger Besu). Ngân hàng tái dùng được toàn bộ công cụ, nhân sự Solidity, và có thể bắc cầu từ thử nghiệm nội bộ sang thị trường mà không viết lại hợp đồng. Đây là lý do trong các báo cáo trước, hệ EVM được đặt làm nhánh chính, với ERC-3643 (T-REX) là chuẩn token có kiểm soát mục tiêu ở sản xuất.

> **Quan hệ với bản Stellar.** Bộ này là bản EVM song song với bộ Soroban đã dựng trước đó. Mô hình nghiệp vụ giống hệt; chỉ khác nền tảng và cách hiện thực (Solidity/EVM thay cho Rust/Soroban, whitelist trong hợp đồng thay cho cờ tài sản tầng giao thức).

---

## 0. Phiên bản công cụ tham chiếu

Bộ mã này được biên dịch và kiểm thử với:

| Thành phần | Phiên bản |
|---|---|
| Node.js | v22.x |
| Hardhat | 2.29.x |
| @nomicfoundation/hardhat-toolbox | 5.0.x |
| OpenZeppelin Contracts | 5.6.x |
| Solidity (solc) | 0.8.28 |
| Mục tiêu EVM | `paris` (an toàn cho Besu và đa số testnet) |

Đây là những thứ dễ đổi theo thời gian; trước khi lên sản xuất nên kiểm lại phiên bản mới nhất của Hardhat/OpenZeppelin/solc.

---

## 1. Kiến trúc tổng thể

Bốn hợp đồng, chia hai nhóm:

**Nhóm token.**
- `ProjectToken` (ký hiệu SPT): token đại diện **quyền hưởng lợi nhuận** của dự án. Đây là token *có kiểm soát* — chỉ ví đã KYC mới nắm giữ được, ngân hàng đóng băng/thu hồi được. Chứa các quy trình: mint, burn, clawback, freeze, whitelist, snapshot.
- `VNDToken` (ký hiệu tVND): token **thanh toán** đại diện tiền gửi VND, dùng để chi trả lợi nhuận và hoàn vốn.

**Nhóm nghiệp vụ.**
- `ProfitDistributor`: **tính và chia lợi nhuận** định kỳ theo snapshot.
- `Redemption`: **mua lại/hoàn vốn** — đốt SPT đổi lấy VND theo tỷ giá.

Dòng chảy một chu kỳ:

```
Ngân hàng ──KYC──▶ nhà đầu tư
Ngân hàng ──mint SPT──▶ nhà đầu tư            (phát hành quyền hưởng)
Dự án phát điện → có lợi nhuận kỳ
Ngân hàng ──createDistribution(VND)──▶ ProfitDistributor   (chốt snapshot + nạp VND)
Nhà đầu tư ──claim()──▶ nhận VND theo tỷ lệ nắm giữ tại thời điểm chốt
... lặp lại theo từng kỳ ...
Kết thúc: nhà đầu tư ──redeem(SPT)──▶ Redemption ──trả VND──▶ nhà đầu tư   (đốt SPT, hoàn vốn)
```

**Phân quyền (dùng AccessControl của OpenZeppelin).** Mỗi hợp đồng có các vai trò riêng, mặc định gán hết cho ngân hàng lúc triển khai; sản xuất nên tách cho nhiều ví/khóa khác nhau (multisig):

| Vai trò | Ở hợp đồng | Làm được gì |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | tất cả | cấp/thu vai trò khác |
| `MINTER_ROLE` | ProjectToken, VNDToken | phát hành token |
| `AGENT_ROLE` | ProjectToken | whitelist, freeze, clawback, đốt cưỡng bức |
| `SNAPSHOT_ROLE` | ProjectToken | chốt snapshot (được cấp cho ProfitDistributor) |
| `PAUSER_ROLE` | ProjectToken | tạm dừng toàn hệ |
| `DISTRIBUTOR_ROLE` | ProfitDistributor | tạo kỳ chia, chia hộ, quét dư |
| `MANAGER_ROLE` | Redemption | đặt tỷ giá, pause, nạp/rút thanh khoản |

**Quy ước số thập phân.** Cả SPT và tVND để **0 số thập phân** để số học minh bạch theo góc ngân hàng (1 SPT = 1 phần quyền hưởng; 1 tVND = 1 VND). Đổi được qua tham số constructor. Ở sản xuất có thể chọn 18 cho SPT và 6 cho tVND nếu muốn theo thông lệ; khi đó nhớ nhân/chia hệ số tương ứng trong tỷ giá và số tiền.

---

## 2. Giải thích từng hợp đồng theo từng quy trình

Phần này đi qua đúng các "dạng smart contract cho từng loại quy trình" mà đề bài yêu cầu.

### 2.1. Nền tảng snapshot — `extensions/ERC20Snapshotable.sol`

Đây là cơ chế cốt lõi để **chia lợi nhuận công bằng**. Vấn đề: nếu chia theo số dư *hiện tại*, một người có thể mua thật nhiều SPT ngay trước lúc chia rồi bán ngay sau đó để "ăn" phần lợi nhuận không thuộc về mình. Snapshot giải quyết bằng cách **đóng băng bức tranh sở hữu tại đúng thời điểm chốt kỳ**.

Cách hoạt động: mỗi khi số dư biến động (mint/burn/transfer), hook `_update` ghi lại *giá trị trước biến động* dưới id snapshot hiện hành (chỉ ghi một lần cho mỗi id, tiết kiệm gas). Hàm `balanceOfAt(account, id)` và `totalSupplyAt(id)` tra cứu nhị phân để trả về số dư đúng tại thời điểm đó.

Cơ chế này chuyển thể từ `ERC20Snapshot` của OpenZeppelin v4 (đã bị gỡ ở v5) sang hook `_update` mới của v5. Thuật toán đã được kiểm chứng nhiều năm; ta chỉ port sang API mới.

Điểm mấu chốt trong hook: ghi snapshot *trước* rồi mới gọi `super._update` để đổi số dư, nên giá trị ghi lại luôn là số dư *cũ* — đúng semantics cần có.

```solidity
function _update(address from, address to, uint256 value) internal virtual override {
    if (from == address(0))      { _updateAccountSnapshot(to);   _updateTotalSupplySnapshot(); } // mint
    else if (to == address(0))   { _updateAccountSnapshot(from); _updateTotalSupplySnapshot(); } // burn
    else                         { _updateAccountSnapshot(from); _updateAccountSnapshot(to); }    // transfer
    super._update(from, to, value);
}
```

### 2.2. Token quyền hưởng — `tokens/ProjectToken.sol`

Kế thừa `ERC20Burnable` (có sẵn burn/burnFrom), `ERC20Snapshotable` (snapshot ở trên) và `AccessControl` (phân quyền).

**Mint (phát hành).** Chỉ `MINTER_ROLE`, và chỉ mint được cho ví đã whitelist:
```solidity
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) { _mint(to, amount); }
```
Ràng buộc "bên nhận phải KYC" nằm trong hook tuân thủ (2.2, phần cuối), nên không cần lặp lại ở đây.

**Burn (đốt).** Hai dạng:
- Nhà đầu tư tự đốt phần của mình: dùng `burn(amount)` / `burnFrom(account, amount)` có sẵn từ `ERC20Burnable` (burnFrom cần allowance — chính là cơ chế Redemption dùng).
- Ngân hàng đốt cưỡng bức khi thu hồi/hủy niêm yết, kể cả ví đã bị băng:
```solidity
function agentBurn(address from, uint256 amount) external onlyRole(AGENT_ROLE) {
    _forcedMove = true; _burn(from, amount); _forcedMove = false; emit AgentBurn(from, amount);
}
```

**Whitelist / KYC.** Cổng kiểm soát ai được nắm giữ. Trong sản xuất, đây là nơi ERC-3643 gắn ONCHAINID + module tuân thủ; ở bản này ta rút gọn thành một mapping do `AGENT_ROLE` quản:
```solidity
function setWhitelisted(address account, bool status) external onlyRole(AGENT_ROLE) { ... }
function batchSetWhitelisted(address[] calldata accounts, bool status) external onlyRole(AGENT_ROLE) { ... }
```

**Freeze (đóng băng).** Ví bị băng không gửi/nhận được (trừ clawback):
```solidity
function setFrozen(address account, bool status) external onlyRole(AGENT_ROLE) { ... }
```

**Snapshot.** Được `SNAPSHOT_ROLE` gọi (ta cấp vai trò này cho `ProfitDistributor` để nó tự chốt khi tạo kỳ chia):
```solidity
function snapshot() external onlyRole(SNAPSHOT_ROLE) returns (uint256) { return _snapshot(); }
```

**Clawback (chuyển cưỡng bức).** Thu hồi tài sản theo lệnh cơ quan quản lý, hoặc khi nhà đầu tư mất khóa/vi phạm. Bỏ qua trạng thái băng của bên gửi, nhưng bên nhận vẫn phải KYC:
```solidity
function forcedTransfer(address from, address to, uint256 amount) external onlyRole(AGENT_ROLE) {
    require(isWhitelisted[to], "clawback: to chua KYC");
    _forcedMove = true; _transfer(from, to, amount); _forcedMove = false;
    emit ForcedTransfer(from, to, amount);
}
```

**Hook tuân thủ.** Mọi chuyển động token đều đi qua `_update`; đây là nơi cưỡng chế toàn bộ luật:
```solidity
function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Snapshotable) {
    if (!_forcedMove) {                       // clawback/agentBurn bỏ qua khối này
        require(!paused, "token dang tam dung");
        if (from != address(0)) require(!isFrozen[from], "ben gui bi bang");
        if (to   != address(0)) require(!isFrozen[to],   "ben nhan bi bang");
        if (from != address(0) && to != address(0)) {     // transfer: hai đầu phải KYC
            require(isWhitelisted[from], "ben gui chua KYC");
            require(isWhitelisted[to],   "ben nhan chua KYC");
        } else if (from == address(0)) {                   // mint: bên nhận phải KYC
            require(isWhitelisted[to], "phat hanh cho vi chua KYC");
        }
    }
    super._update(from, to, value);            // -> ghi snapshot -> đổi số dư
}
```

> **Đường lên sản xuất — ERC-3643.** Bản rút gọn này diễn đạt đúng tinh thần token có kiểm soát nhưng tự quản whitelist. Ở sản xuất, thay bằng bộ **T-REX/ERC-3643** đầy đủ: danh tính on-chain (ONCHAINID), sổ đăng ký danh tính, sổ trusted issuers, và các **module tuân thủ tách rời** (giới hạn quốc gia, trần số nhà đầu tư, khóa thời gian…). Các khái niệm ánh xạ 1-1: whitelist ⇄ Identity Registry, freeze ⇄ address freeze của T-REX, clawback ⇄ forced transfer, agent ⇄ Agent role. Bộ T-REX là mã nguồn mở, kiểm toán kỹ, nên ưu tiên dùng lại thay vì tự viết khi lên thật.

### 2.3. Token thanh toán — `tokens/VNDToken.sol`

ERC-20 tối giản với `mint`/`burn` theo vai trò, đại diện tiền gửi VND on-chain do ngân hàng phát hành/thu hồi. Ở sản xuất, đây cũng nên là tiền gửi token hóa *có kiểm soát* (whitelist/tuân thủ như SPT); bản demo để đơn giản nhằm tập trung vào luồng chia lợi nhuận.

### 2.4. Tính & chia lợi nhuận — `ProfitDistributor.sol`

Áp dụng mô hình **"pull theo snapshot"** — chuẩn mực cho việc chia cổ tức/lợi nhuận trên EVM vì an toàn gas (không lặp qua toàn bộ holder trong một giao dịch) và kiểm toán được.

**Tạo kỳ chia (`createDistribution`).** Ngân hàng approve VND trước, rồi gọi hàm này. Nó chốt snapshot và kéo VND vào quỹ của kỳ:
```solidity
function createDistribution(uint256 amount, string calldata period)
    external onlyRole(DISTRIBUTOR_ROLE) nonReentrant returns (uint256 id)
{
    uint256 snapId = projectToken.snapshot();
    uint256 supply = projectToken.totalSupplyAt(snapId);
    require(supply > 0, "khong co SPT dang luu hanh");
    payoutToken.safeTransferFrom(msg.sender, address(this), amount);   // nạp VND
    id = distributions.length;
    distributions.push(Distribution({ snapshotId: snapId, amount: amount,
        supplyAtSnapshot: supply, claimed: 0, createdAt: uint64(block.timestamp), period: period }));
    emit DistributionCreated(id, snapId, amount, supply, period);
}
```

**Tính lợi nhuận (`entitlementOf` / `previewClaim`).** Không đổi trạng thái, dùng để hiển thị và đối soát. Công thức chia theo tỷ lệ nắm giữ tại thời điểm chốt:
```
phần_của_account = amount × balanceOfAt(account, snapshotId) ÷ totalSupplyAt(snapshotId)
```
`previewClaim` trả về 0 nếu đã nhận; `entitlementOf` trả về phần theo quyền bất kể đã nhận hay chưa.

**Chia lợi nhuận.** Ba cách, cùng một logic lõi `_claim`:
- `claim(id)` — nhà đầu tư tự nhận một kỳ.
- `claimMany(ids)` — nhận nhiều kỳ trong một giao dịch.
- `distributeTo(id, [ví...])` — ngân hàng chia hộ hàng loạt (mô hình "push"), tiện khi muốn tự động đẩy tiền cho nhà đầu tư.

Cờ `hasClaimed[id][account]` chống nhận hai lần; hàm dùng `nonReentrant` chống tái nhập; chuyển tiền bằng `SafeERC20`.

**Quét phần dư (`sweepDust`).** Sau `claimWindow` (mặc định 180 ngày), phần chưa ai nhận cộng phần lẻ do làm tròn được trả về ngân hàng. Nhờ vậy không có VND kẹt vĩnh viễn trong hợp đồng.

**Tính công bằng đã được test.** Trong `test/full-cycle.test.js`, sau khi tạo kỳ Q1 (chốt 6000/4000), nhà đầu tư A chuyển bớt SPT cho B; phần của kỳ Q1 vẫn giữ nguyên 180tr/120tr — đúng như kỳ vọng của cơ chế snapshot.

### 2.5. Mua lại / hoàn vốn — `Redemption.sol`

Cuối vòng đời (hoặc khi nhà đầu tư muốn thoát), họ đổi SPT lấy VND:
```solidity
function redeem(uint256 sptAmount) external nonReentrant returns (uint256 vndAmount) {
    require(!paused, "dang tam dung");
    require(projectToken.isWhitelisted(msg.sender), "chua KYC");
    vndAmount = quote(sptAmount);                                   // = sptAmount × rate
    require(payoutToken.balanceOf(address(this)) >= vndAmount, "thieu thanh khoan VND");
    projectToken.burnFrom(msg.sender, sptAmount);                   // đốt SPT (cần allowance)
    payoutToken.safeTransfer(msg.sender, vndAmount);               // trả VND
    emit Redeemed(msg.sender, sptAmount, vndAmount);
}
```
Ngân hàng nạp thanh khoản bằng `fund`, đặt tỷ giá bằng `setRate`, và có thể `setPaused(true)` để khóa khi cần. Vì `redeem` dùng `burnFrom`, nhà đầu tư phải `approve` SPT cho hợp đồng trước — đây chính là bước "đồng ý" của họ.

---

## 3. Cài đặt môi trường

### 3.1. Yêu cầu
- **Node.js 20 trở lên** (khuyến nghị 20 hoặc 22 LTS). Kiểm tra: `node --version`.
- **npm** (đi kèm Node) hoặc pnpm/yarn.
- Trình soạn thảo có gợi ý Solidity (VS Code + extension "Solidity" của Nomic/Juan Blanco).

### 3.2. Khởi tạo dự án (nếu dựng lại từ đầu)
Nếu Sếp dùng nguyên thư mục `rwa-evm/` đi kèm thì bỏ qua mục này, chỉ cần `npm install`. Nếu muốn dựng lại từ số 0:
```bash
mkdir rwa-evm && cd rwa-evm
npm init -y
npm install --save-dev hardhat@^2.22 @nomicfoundation/hardhat-toolbox@^5 dotenv
npm install @openzeppelin/contracts@^5
npx hardhat init      # chọn "Create an empty hardhat.config.js" rồi thay bằng config đi kèm
```

### 3.3. Cài phụ thuộc và biên dịch
```bash
npm install            # cài mọi thứ theo package.json
npx hardhat compile    # biên dịch, sinh artifacts/ và cache/
```

> **Lưu ý về trình biên dịch trong môi trường bị chặn mạng.** Mặc định Hardhat tải `solc` từ `binaries.soliditylang.org`. Nếu máy/mạng của Sếp chặn miền này (như môi trường dựng bộ code này), cài thêm gói `solc` từ npm và để đoạn override trong `hardhat.config.js` trỏ Hardhat dùng bản cục bộ:
> ```bash
> npm install --save-dev solc@0.8.28
> ```
> Trên máy internet bình thường, đoạn override vô hại và có thể giữ nguyên.

### 3.4. Chạy test và demo
```bash
npx hardhat test                         # 13 test đầu-cuối (8 gốc + 5 oracle)
npx hardhat run scripts/demo-cycle.js    # chu kỳ chia lợi nhuận nhập tay
npx hardhat run scripts/demo-oracle.js   # chu kỳ chia lợi nhuận lấy số từ oracle

# Kit ERC-3643 thật (project độc lập, xem mục 7):
cd trex && npm install && npx hardhat test   # 5 test T-REX
```

---

## 4. Triển khai — nhánh A: mạng public testnet (Sepolia)

Dùng để kiểm chứng khả năng bắc cầu ra thị trường công khai.

### 4.1. Chuẩn bị
1. Tạo ví triển khai (đại diện ngân hàng). **Không dùng ví có tài sản thật.**
2. Xin ETH testnet từ faucet Sepolia (ví dụ faucet của Alchemy/Infura).
3. Lấy một RPC URL Sepolia (Alchemy, Infura, hoặc RPC công cộng).
4. Tạo file cấu hình:
```bash
cp .env.example .env
```
   rồi điền `PRIVATE_KEY` và `SEPOLIA_RPC_URL`.

### 4.2. Triển khai
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
Script sẽ in ra bốn địa chỉ hợp đồng và tự cấp `SNAPSHOT_ROLE` cho `ProfitDistributor`. **Ghi lại bốn địa chỉ này.**

### 4.3. (Tùy chọn) Verify mã nguồn trên Etherscan
Điền `ETHERSCAN_API_KEY` vào `.env` rồi:
```bash
npx hardhat verify --network sepolia <ĐỊA_CHỈ_SPT> "Solar Project Token" "SPT" 0 <ĐỊA_CHỈ_NGÂN_HÀNG>
```
(làm tương tự cho các hợp đồng khác với đúng tham số constructor).

---

## 5. Triển khai — nhánh B: mạng permissioned (Hyperledger Besu)

Dùng cho thí điểm nội bộ có kiểm soát. Cùng mã hợp đồng, chỉ khác lớp mạng.

### 5.1. Dựng một node Besu dev nhanh (Docker)
Cách nhanh nhất để có một mạng Besu chạy thử là chế độ dev (một node, tự đào, gas = 0):
```bash
docker run -d --name besu-dev -p 8545:8545 \
  hyperledger/besu:latest \
  --network=dev \
  --rpc-http-enabled \
  --rpc-http-api=ETH,NET,WEB3,ADMIN \
  --rpc-http-cors-origins="*" \
  --rpc-http-host=0.0.0.0 \
  --host-allowlist="*" \
  --miner-enabled --miner-coinbase=0x0000000000000000000000000000000000000001
```
Chế độ `dev` nạp sẵn một số tài khoản có số dư lớn — lấy khóa riêng của một tài khoản dev từ tài liệu Besu để đặt vào `.env` (`PRIVATE_KEY`). Đặt `BESU_RPC_URL=http://127.0.0.1:8545` và `BESU_CHAIN_ID=1337` (chain id mặc định của network dev là 2018; kiểm tra bằng lệnh dưới và chỉnh lại `.env` cho khớp).
```bash
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

> Với thí điểm nghiêm túc (nhiều node, có kiểm soát thành viên), Besu hỗ trợ đồng thuận QBFT/IBFT 2.0 và cơ chế cho phép node/tài khoản theo danh sách. Đó là bước cấu hình mạng, không ảnh hưởng tới mã hợp đồng. Tham khảo tài liệu chính thức của Hyperledger Besu để dựng mạng QBFT nhiều node.

### 5.2. Triển khai lên Besu
```bash
npx hardhat run scripts/deploy.js --network besu
```
Vì `evmVersion` đặt là `paris` nên bytecode tương thích Besu; `gasPrice: 0` trong config khớp mạng dev free-gas.

---

## 6. Chạy một chu kỳ đầu-cuối trên testnet

Sau khi có bốn địa chỉ, mở Hardhat console trỏ vào mạng đã deploy để thao tác từng bước. Thay `<SPT>`, `<VND>`, `<DIST>`, `<RED>`, `<INV_A>` bằng địa chỉ thật.

```bash
npx hardhat console --network sepolia    # hoặc --network besu
```
Rồi trong console:
```js
const [bank] = await ethers.getSigners();
const spt  = await ethers.getContractAt("ProjectToken", "<SPT>");
const vnd  = await ethers.getContractAt("VNDToken", "<VND>");
const dist = await ethers.getContractAt("ProfitDistributor", "<DIST>");
const red  = await ethers.getContractAt("Redemption", "<RED>");

// 1) KYC nhà đầu tư
await (await spt.setWhitelisted("<INV_A>", true)).wait();

// 2) Phát hành SPT
await (await spt.mint("<INV_A>", 6000n)).wait();

// 3) Chốt kỳ Q1 và nạp 300.000.000 VND lợi nhuận
await (await vnd.mint(bank.address, 300000000n)).wait();
await (await vnd.approve("<DIST>", 300000000n)).wait();
await (await dist.createDistribution(300000000n, "2026-Q1")).wait();

// 4) Kiểm tra phần được chia (không tốn gas)
(await dist.previewClaim(0, "<INV_A>")).toString();   // -> phần của A

// 5) Chia hộ cho A (hoặc để A tự gọi dist.claim(0) từ ví của họ)
await (await dist.distributeTo(0, ["<INV_A>"])).wait();
(await vnd.balanceOf("<INV_A>")).toString();

// 6) Hoàn vốn: nạp thanh khoản, A approve SPT rồi redeem
await (await vnd.mint(bank.address, 2000000000n)).wait();
await (await vnd.approve("<RED>", 2000000000n)).wait();
await (await red.fund(2000000000n)).wait();
// (bước approve SPT phải do chính ví A ký; nếu test một mình, mint SPT cho ví bank đã KYC để tự diễn)
```

Toàn bộ chuỗi thao tác này đã được đóng gói và kiểm chứng trong `scripts/demo-cycle.js` (chạy trên mạng in-process). Trên testnet, chỉ khác là mỗi lệnh cần `.wait()` để chờ khối xác nhận, và các bước cần chữ ký của nhà đầu tư (approve, claim) phải do ví nhà đầu tư ký.

---

## 7. Nâng cấp 1 — Nâng SPT lên ERC-3643 thật (thư viện T-REX)

Token `ProjectToken` ở mục 2.2 là bản **rút gọn dễ đọc** theo tinh thần ERC-3643. Khi lên sản xuất, ngân hàng nên dùng bộ **T-REX** chính chủ của Tokeny (`@tokenysolutions/t-rex` + `@onchain-id/solidity`) — bộ này đã được kiểm toán và là hiện thực tham chiếu của chuẩn EIP-3643.

### 7.1. Vì sao để ở một project riêng (`trex/`)

T-REX **pin cứng** toolchain riêng: **solc 0.8.17 + OpenZeppelin v4** (dùng proxy/upgradeable), trong khi project chính dùng **solc 0.8.28 + OpenZeppelin v5**. Hai bản OpenZeppelin không thể cùng tồn tại trong một project Hardhat vì chuỗi import `@openzeppelin/contracts/...` chỉ trỏ được về một bản. Vì vậy bộ T-REX được đặt trong thư mục con `trex/` — một dự án Hardhat độc lập, cài phụ thuộc riêng. Đây là cách làm chuẩn trong ngành, không phải giải pháp chắp vá.

### 7.2. Kiến trúc T-REX

| Thành phần | Vai trò |
|---|---|
| `Token` (ERC-3643) | Token chứng khoán, ERC-20 tương thích + kiểm soát chuyển nhượng |
| `IdentityRegistry` | Sổ danh tính nhà đầu tư đủ điều kiện nắm giữ |
| `IdentityRegistryStorage` | Kho lưu danh tính (nhiều token dùng chung được) |
| `TrustedIssuersRegistry` | Danh sách tổ chức được tin cậy cấp claim (KYC/AML) |
| `ClaimTopicsRegistry` | Danh sách loại claim bắt buộc để nắm token |
| `ModularCompliance` | Bộ module luật giao dịch (trần sở hữu, hạn chế quốc gia…) |
| `TREXFactory` + `ImplementationAuthority` | Nhà máy triển khai chuẩn + quản lý phiên bản/upgrade |
| `ClaimIssuer` + `ONCHAINID` | Tổ chức KYC ký claim; danh tính on-chain của nhà đầu tư |

**Ánh xạ khái niệm** giữa bản pilot và T-REX: `isWhitelisted` ↔ `IdentityRegistry.isVerified` (dựa trên ONCHAINID + claim KYC); `setFrozen` ↔ `setAddressFrozen`/`freezePartialTokens`; `forcedTransfer` (clawback) ↔ `forcedTransfer`; kiểm tra tuân thủ trong `_update` ↔ `ModularCompliance` + `IdentityRegistry`. Nghĩa là nghiệp vụ giữ nguyên, chỉ thay lớp thực thi bằng bộ đã kiểm toán.

### 7.3. Cài đặt và chạy thử

```bash
cd trex
npm install
npx hardhat test        # deploy + onboard KYC + mint + freeze + forcedTransfer + burn
```

> Ghi chú offline: `trex/hardhat.config.js` có đoạn trỏ solc 0.8.17 về gói WASM cài qua npm (alias `solc-0817`), phục vụ môi trường chặn máy chủ tải solc. Trên máy internet bình thường **không cần** đoạn này.

Bộ kịch bản kiểm thử đã xác nhận đúng các quyền lực đặc thù của ERC-3643: chỉ ví đã KYC (`isVerified`) mới nhận được mint; chuyển sang ví chưa KYC bị chặn; agent đóng băng ví và thu hồi cưỡng bức; agent burn để phục vụ hoàn vốn.

### 7.4. Deploy lên mạng thật

```bash
cp trex/.env.example trex/.env      # điền PRIVATE_KEY, RPC
cd trex
npx hardhat run scripts/deploy-trex.js --network sepolia   # hoặc --network besu
```

Script triển khai đủ 6 thành phần + factory, ONCHAINID, ClaimIssuer, rồi gọi `deployTREXSuite(...)`; địa chỉ được lưu ở `trex/deployments/trex-<network>.json`.

### 7.5. Onboard nhà đầu tư (bắt buộc trước khi mint)

Khác với bản pilot (chỉ `setWhitelisted`), với T-REX mỗi nhà đầu tư cần một **ONCHAINID** mang **claim KYC** do tổ chức tin cậy ký. Quy trình (xem `trex/scripts/deploy-lib.js` → `onboardInvestor`):

```javascript
// 1) Tạo ONCHAINID cho ví nhà đầu tư
await idFactory.createIdentity(investor.address, "id-" + investor.address);
const identityAddr = await idFactory.getIdentity(investor.address);

// 2) ClaimIssuer ký claim KYC cho ONCHAINID đó
const data = ethers.hexlify(ethers.toUtf8Bytes("KYC-OK"));
const dataHash = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256", "bytes"], [identityAddr, KYC_TOPIC, data]
  )
);
const signature = await claimIssuerSigner.signMessage(ethers.getBytes(dataHash));

// 3) Ví nhà đầu tư thêm claim vào ONCHAINID của mình
await identity.connect(investor).addClaim(KYC_TOPIC, 1, claimIssuerAddr, signature, data, "");

// 4) Agent đăng ký identity vào IdentityRegistry
await identityRegistry.connect(agent).registerIdentity(investor.address, identityAddr, 704 /* VN */);
// => identityRegistry.isVerified(investor) == true, giờ mới mint được
```

### 7.6. Ghép với module lợi nhuận / hoàn vốn

Token T-REX là **ERC-20 tương thích** nên `ProfitDistributor`/`Redemption` vẫn dùng được, nhưng lưu ý: T-REX **không có snapshot on-chain** như `ProjectToken`. Do đó cách chia công bằng khác nhau:

| | Token pilot (`ProjectToken`) | Token T-REX |
|---|---|---|
| Chốt sở hữu | `snapshot()` on-chain, `balanceOfAt` | Chụp số dư theo **số block** qua indexer (The Graph) off-chain |
| Chia | Mô hình **pull** (nhà đầu tư tự claim) | Mô hình **push** (`distributeTo` theo suất chia tính off-chain) hoặc thêm module snapshot |
| Ưu điểm | Đơn giản, kiểm toán trọn on-chain | Chuẩn ERC-3643 đầy đủ, tuân thủ mạnh |

Nghĩa là: giữ `ProfitDistributor`/`ProfitDistributorOracle` cho **giai đoạn thí điểm** với token pilot; khi chuyển sang T-REX thì tính suất chia từ ảnh chụp số dư theo block (indexer) rồi dùng `distributeTo(...)` để đẩy VND.

---

## 8. Nâng cấp 2 — Oracle sản lượng điện cho công thức lợi nhuận

Ở bản gốc, ngân hàng **nhập tay** số lợi nhuận mỗi kỳ (`createDistribution(amount, ...)`). Nâng cấp này đưa **dữ liệu vận hành nhà máy** lên chuỗi để con số chia gắn với sản lượng điện thực tế, minh bạch và khó thao túng. Hai hợp đồng mới: `oracle/EnergyOracle.sol` và `ProfitDistributorOracle.sol`.

### 8.1. Công thức

```
doanh thu (gross)   = kWh × giá bán (VND/kWh)
lãi ròng   (net)    = max(gross − opex, 0)
lợi nhuận chia được = net × bankShareBps / 10000
```

`bankShareBps` là phần nhà đầu tư/ngân hàng được chia theo điểm cơ sở (bps); ví dụ `8000` = 80%. Tham số này cho phép mô hình phản ánh đúng thỏa thuận phân chia giữa nhà đầu tư và chủ dự án.

### 8.2. Cơ chế chống thao túng — đa reporter xác nhận

Các **reporter** (gateway đọc công-tơ/SCADA, đơn vị O&M, kiểm toán độc lập) đẩy số liệu mỗi kỳ. Một kỳ chỉ được **chốt** (finalized) khi đủ `requiredConfirmations` reporter đẩy **cùng một bộ số liệu**; reporter sau đẩy số lệch sẽ bị từ chối. Sau khi chốt, số liệu **bất biến**.

```javascript
// Yêu cầu 2 xác nhận: O&M + kiểm toán độc lập
await oracle.setRequiredConfirmations(2);
await oracle.grantRole(await oracle.REPORTER_ROLE(), oem.address);
await oracle.grantRole(await oracle.REPORTER_ROLE(), auditor.address);

await oracle.connect(oem).submitReading(202601, 1_000_000, 2_000, 200_000_000, 8000);
// chưa chốt (1/2). Kiểm toán xác nhận cùng số liệu:
await oracle.connect(auditor).submitReading(202601, 1_000_000, 2_000, 200_000_000, 8000);
// => isFinalized(202601) == true
```

Pilot có thể để `requiredConfirmations = 1`; sản xuất nên ≥ 2. Quản trị viên (`MANAGER_ROLE`) có thể `resetPending(periodId)` để sửa số liệu **chưa chốt**, nhưng **không** đụng được kỳ đã chốt.

### 8.3. Tạo đợt chia từ oracle

`ProfitDistributorOracle` kế thừa `ProfitDistributor` và thêm `createDistributionFromOracle(periodId)`: đọc số lợi nhuận đã chốt từ oracle, chốt snapshot SPT và nạp quỹ VND như thường lệ. Chống chia trùng một kỳ.

```javascript
const payout = await oracle.distributableProfitVnd(202601); // 1.440.000.000 VND
await vnd.mint(bank.address, payout);
await vnd.approve(distributorAddr, payout);
await distributor.createDistributionFromOracle(202601);
// suất chia theo snapshot: A (60%) = 864.000.000 ; B (40%) = 576.000.000
```

Kết quả demo (`scripts/demo-oracle.js`) với 1.000.000 kWh × 2.000 VND, opex 200 triệu, chia 80%:

```
Doanh thu (gross) : 2.000.000.000 VND
Lãi ròng   (net) : 1.800.000.000 VND
Chia được        : 1.440.000.000 VND (80%)
A (60%) nhận: 864.000.000 VND ; B (40%) nhận: 576.000.000 VND
```

### 8.4. Nguồn dữ liệu: push-oracle vs Chainlink

- **Mạng permissioned (Besu) / thí điểm:** dùng `EnergyOracle` dạng **push** như trên — các node của ngân hàng/đối tác (đã cấp `REPORTER_ROLE`) đẩy số liệu công-tơ. Đơn giản, kiểm soát được, hợp bối cảnh nội bộ.
- **Mạng public:** có thể thay bằng **Chainlink** — một external adapter/Chainlink Functions đọc API hệ thống đo đếm rồi ghi vào một consumer contract, hoặc dùng nhiều node tổng hợp trung vị. Giao diện đọc (`distributableProfitVnd`) giữ nguyên nên `ProfitDistributorOracle` không phải đổi.

### 8.5. Lưu ý đơn vị số

`EnergyOracle` dùng **số nguyên** (0 decimals) khớp với `VNDToken`. Nếu đổi decimals của VND, phải quy đổi `tariff`/`opex` về đơn vị nhỏ nhất cho khớp. Toàn bộ luồng oracle đã được kiểm chứng bằng 5 test trong `test/oracle-cycle.test.js` (công thức, đa xác nhận, chia đúng tỷ lệ, chặn chia khi chưa chốt/chia trùng, opex vượt doanh thu → chia = 0).

---

## 9. Danh mục kiểm tra trước khi lên thí điểm/thật

**An ninh hợp đồng.**
- [ ] Tách vai trò: MINTER/AGENT/SNAPSHOT/PAUSER/DISTRIBUTOR/MANAGER giao cho **multisig** khác nhau, không để một khóa nắm hết.
- [ ] Chuyển `DEFAULT_ADMIN_ROLE` sang multisig (ví dụ Safe) và cân nhắc timelock cho các thao tác nhạy cảm (đổi tỷ giá, đổi claimWindow).
- [ ] Kiểm toán độc lập bộ hợp đồng. Bản ERC-3643 đầy đủ (mục 7, thư mục `trex/`) dùng bộ T-REX đã kiểm toán của Tokeny — nên đây là hướng khuyến nghị khi lên sản xuất thay cho token pilot.
- [ ] Chạy phân tích tĩnh (Slither) và fuzzing (Foundry/Echidna) cho các bất biến: tổng phần chia ≤ amount mỗi kỳ; không ai nhận hai lần; số dư snapshot cộng lại = tổng cung tại kỳ.
- [ ] Rà soát tái nhập: đã dùng `nonReentrant` + `SafeERC20`; kiểm lại nếu token VND thật có hook chuyển nhượng.

**Nghiệp vụ & tuân thủ.**
- [x] Oracle cho công thức lợi nhuận theo sản lượng điện đã hiện thực (mục 8: `EnergyOracle` + `ProfitDistributorOracle`, cơ chế đa reporter xác nhận). Sản xuất: đặt `requiredConfirmations ≥ 2`, tách vai reporter (O&M / kiểm toán độc lập), hoặc thay bằng Chainlink cho mạng public.
- [ ] Quy trình KYC/AML ngoài chuỗi gắn với whitelist on-chain; nhật ký thao tác agent.
- [ ] Chính sách khóa/khôi phục khóa cho nhà đầu tư; quy trình clawback có phê duyệt.
- [ ] Đối chiếu ràng buộc pháp lý Việt Nam: phát hành dựa trên tài sản thực; trong cơ chế thí điểm chỉ mở cho nhà đầu tư đủ điều kiện; **thanh toán bằng Đồng Việt Nam** (đã phản ánh qua tVND); định danh và danh sách trắng bắt buộc.
- [ ] Kế hoạch nâng cấp: hợp đồng hiện không proxy-upgradeable (đơn giản, ít rủi ro). Nếu cần nâng cấp, cân nhắc mẫu UUPS/Transparent proxy của OpenZeppelin và quy trình quản trị đi kèm.

**Vận hành.**
- [ ] Sao lưu và quản lý khóa (HSM/KMS) cho ví ngân hàng.
- [ ] Giám sát sự kiện on-chain (DistributionCreated, Claimed, Redeemed, ForcedTransfer, ReadingFinalized, DistributionFromOracle) để đối soát với sổ sách.
- [ ] Kịch bản xử lý sự cố: tạm dừng (`setPaused`), đóng băng ví, dừng hoàn vốn.

---

## 10. Cấu trúc thư mục

```
rwa-evm/
├── contracts/
│   ├── extensions/
│   │   └── ERC20Snapshotable.sol       # nền tảng snapshot (chia lợi nhuận công bằng)
│   ├── tokens/
│   │   ├── ProjectToken.sol            # SPT pilot: mint/burn/clawback/freeze/whitelist/snapshot
│   │   └── VNDToken.sol                # tVND: token thanh toán
│   ├── oracle/
│   │   └── EnergyOracle.sol            # [MỚI] oracle sản lượng điện → công thức lợi nhuận
│   ├── ProfitDistributor.sol           # tính & chia lợi nhuận định kỳ (nhập tay)
│   ├── ProfitDistributorOracle.sol     # [MỚI] tạo đợt chia lấy số từ oracle
│   └── Redemption.sol                  # mua lại/hoàn vốn
├── scripts/
│   ├── deploy.js                       # triển khai bản gốc + cấp quyền
│   ├── deploy-oracle.js                # [MỚI] triển khai bản có oracle
│   ├── demo-cycle.js                   # chu kỳ minh họa (nhập tay)
│   └── demo-oracle.js                  # [MỚI] chu kỳ minh họa lấy số từ oracle
├── test/
│   ├── full-cycle.test.js              # 8 test đầu-cuối (bản gốc)
│   └── oracle-cycle.test.js            # [MỚI] 5 test luồng oracle
├── trex/                               # [MỚI] KIT ERC-3643 THẬT (T-REX) — project độc lập
│   ├── contracts/TREXImports.sol       # kéo đồ thị hợp đồng T-REX + ONCHAINID vào build
│   ├── scripts/
│   │   ├── deploy-lib.js               # deployFullSuite + onboardInvestor
│   │   └── deploy-trex.js              # deploy full suite lên mạng thật
│   ├── test/trex-suite.test.js         # 5 test: deploy + KYC + mint + freeze + forcedTransfer + burn
│   ├── hardhat.config.js               # solc 0.8.17 + OZ v4 (toolchain Tokeny)
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── hardhat.config.js                   # cấu hình solc + mạng (hardhat/sepolia/besu)
├── .env.example                        # mẫu biến môi trường
└── README.md
```

---

## Phụ lục: ánh xạ quy trình → hàm

| Quy trình (đề bài) | Hợp đồng | Hàm chính |
|---|---|---|
| Mint | ProjectToken / VNDToken | `mint` |
| Burn | ProjectToken | `burn`/`burnFrom` (tự đốt), `agentBurn` (cưỡng bức) |
| Clawback | ProjectToken | `forcedTransfer` |
| Freeze | ProjectToken | `setFrozen` |
| Whitelist/KYC | ProjectToken | `setWhitelisted`, `batchSetWhitelisted` |
| Snapshot | ProjectToken | `snapshot` |
| Tính lợi nhuận | ProfitDistributor | `entitlementOf`, `previewClaim` |
| Chia lợi nhuận | ProfitDistributor | `createDistribution`, `claim`, `claimMany`, `distributeTo` |
| Quét phần dư | ProfitDistributor | `sweepDust` |
| Redeem/Hoàn vốn | Redemption | `redeem`, `fund`, `setRate`, `setPaused` |
| **Đo sản lượng điện (oracle)** | EnergyOracle | `submitReading`, `setRequiredConfirmations`, `resetPending` |
| **Tính lợi nhuận từ oracle** | EnergyOracle | `grossRevenueVnd`, `netRevenueVnd`, `distributableProfitVnd` |
| **Chia lợi nhuận từ oracle** | ProfitDistributorOracle | `createDistributionFromOracle`, `previewDistributableFromOracle` |
| **KYC/danh tính (ERC-3643)** | IdentityRegistry / ONCHAINID | `registerIdentity`, `isVerified`, `addClaim` |
| **Kiểm soát chuyển nhượng (ERC-3643)** | Token (T-REX) | `setAddressFrozen`, `freezePartialTokens`, `forcedTransfer` |
| **Triển khai bộ ERC-3643** | TREXFactory | `deployTREXSuite` |

---

## Phụ lục B: tóm tắt hai nâng cấp

| | Nâng cấp 1 — ERC-3643 thật | Nâng cấp 2 — Oracle sản lượng điện |
|---|---|---|
| Vị trí | Thư mục `trex/` (project độc lập) | `contracts/oracle/` + `ProfitDistributorOracle.sol` (project chính) |
| Thư viện | `@tokenysolutions/t-rex`, `@onchain-id/solidity` | thuần OpenZeppelin (AccessControl) |
| Toolchain | solc 0.8.17 + OZ v4 | solc 0.8.28 + OZ v5 |
| Trạng thái kiểm thử | 5/5 test xanh | 5/5 test xanh (13/13 toàn project chính) |
| Giá trị | Token chứng khoán tuân thủ chuẩn, đã kiểm toán | Số lợi nhuận gắn dữ liệu vận hành, minh bạch, chống thao túng |
