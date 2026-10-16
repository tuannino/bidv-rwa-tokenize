# SC-09: Tầng token theo ERC-3643 (phương án C) và `permit` cho VNDB, WPT

| | |
|---|---|
| Nhánh | `feat/sc-09-erc3643-permit`, từ `dev` @ `945c833` (PR #51) |
| Điểm | 10,5 (ERC-3643 phần lõi 8, `permit` VNDB 2, `permit` WPT 0,5) |
| Mức kiểm chứng | **Cao** (sửa hợp đồng giữ tài sản, đổi bytecode, triển khai lại Sepolia) |
| Thứ tự | Task đầu tiên của đợt 6, **trước SC-07** (vault phải được đăng ký vào sổ danh tính mới) |
| Căn cứ | DS-01 bản 2: QĐ-9, QĐ-10, QĐ-11 (chủ dự án chốt 15/10/2026) |

## Mục tiêu

1. `ProjectToken` (WPT) theo **kiến trúc ERC-3643**: token, sổ danh tính, bộ luật giao dịch tách
   rời. Token hỏi sổ danh tính `isVerified` và hỏi bộ luật `canTransfer` ở mọi lần chuyển. Các hàm
   của token đặt **đúng tên, tham số, sự kiện** như `IToken` của T-REX v4.1.6 cho phần đã làm.
2. Giữ nguyên phần riêng của dự án: snapshot cho chia lợi nhuận, luật SC-02 (ví SPV, phát hành lần
   đầu một lần, mint chỉ vào ví SPV).
3. `VNDToken` (VNDB) và `ProjectToken` (WPT) có `permit` theo ERC-2612 (CH-1 đã chốt).
4. Ứng dụng chạy như cũ trên `mock`, `hardhat-local`; `ILedgerPort` **không đổi**. Chain `evm`
   (Sepolia) báo lỗi rõ cho tới khi chủ dự án triển khai lại bộ hợp đồng mới.

## Hiện trạng đã đo (Supervisor, `dev` @ `945c833`)

```bash
grep -nE "function [a-zA-Z]+\(" packages/contracts-evm/contracts/tokens/ProjectToken.sol
# setWhitelisted, batchSetWhitelisted, setFrozen, setPaused, mintInitialSupply, mint, agentBurn,
# snapshot, forcedTransfer; mapping isWhitelisted, isFrozen; bool paused
grep -n "pragma" packages/contracts-evm/node_modules/@tokenysolutions/t-rex/contracts/token/IToken.sol
# pragma solidity 0.8.17;  (CO DINH, project chinh dung 0.8.28 -> KHONG import duoc)
ls packages/contracts-evm/trex
# bo T-REX day du (ONCHAINID, solc 0.8.17, OpenZeppelin v4), chay doc lap
grep -rln "setWhitelisted\|setFrozen\|setPaused\|agentBurn\|isWhitelisted" \
  packages/contracts-evm/scripts packages/contracts-evm/test
# 9 tep: seed-local.js, fund-sepolia.js, dod-verify-sepolia.js, helpers/seed-project-balances.js,
# helpers/spec-fixture.js, spec-p4-mint, sc-02-issuance, spec-p12-redemption, full-cycle
grep -n "isWhitelisted" packages/contracts-evm/contracts/Redemption.sol
# 83: require(projectToken.isWhitelisted(msg.sender), "chua KYC");  (hop dong khac goi ham se bi bo)
grep -n "setWhitelisted\|setFrozen\|isWhitelisted\|isFrozen\|paused" app/src/lib/ledger/evm.adapter.ts
# whitelist, isWhitelisted, freeze, isFrozen, canTransfer doc thang tren ProjectToken
```

- `mock.adapter` `whitelist` **lặp lại được** (whitelist ví đã whitelist không lỗi). Bản EVM mới phải
  giữ tính chất này.
- `addresses.json` có 4 hợp đồng; địa chỉ hardhat tất định theo thứ tự triển khai.
- ABI dùng chung ở `packages/shared/src/abi/` có kiểm thử đồng bộ `app/test/abi-contract-sync.test.ts`.

## Quyết định thiết kế

**QĐ-1. Ba thành phần, viết trong project chính (solc 0.8.28, OpenZeppelin v5).**

| Hợp đồng | Mới hay sửa | Vai trò |
|---|---|---|
| `ProjectToken` | Sửa | Token chứng khoán, giao diện theo `IToken` cho phần đã làm (QĐ-2) |
| `IdentityRegistry` | Mới | Sổ danh tính rút gọn: ví, quốc gia, đã xác minh (QĐ-4) |
| `ModularCompliance` | Mới | Bộ luật giao dịch gắn module, giao diện theo `IModularCompliance` (QĐ-5) |
| `AllowAllModule` | Mới | Module mặc định, `moduleCheck` luôn trả `true` (CH-2 đã chốt). Mở rộng module khác về sau |

Không import thư viện T-REX (pragma cố định 0.8.17). Viết **giao diện cục bộ** `IERC3643Token`,
`IERC3643Compliance`, `IERC3643Module` chép đúng chữ ký hàm và sự kiện từ T-REX v4.1.6, ghi nguồn ở
đầu tệp. Không sửa thư mục `trex/`.

**QĐ-2. Hàm của `ProjectToken` (chữ ký phải khớp `IToken`, kiểm bằng ca 1).**

| Nhóm | Hàm (chữ ký ERC-3643) | Thay cho hàm cũ |
|---|---|---|
| Tạm dừng | `pause()`, `unpause()`, `paused()` | `setPaused(bool)` |
| Đóng băng ví | `setAddressFrozen(address,bool)`, `batchSetAddressFrozen(address[],bool[])`, `isFrozen(address)` | `setFrozen` |
| Đóng băng một phần | `freezePartialTokens(address,uint256)`, `unfreezePartialTokens(address,uint256)`, `getFrozenTokens(address)` | mới |
| Liên kết | `setIdentityRegistry(address)`, `setCompliance(address)`, `identityRegistry()`, `compliance()` | mới |
| Phát hành, huỷ | `mint(address,uint256)`, `burn(address,uint256)` | `burn(address,uint256)` thay `agentBurn` |
| Chuyển | `forcedTransfer(address,address,uint256)`, `batchTransfer(address[],uint256[])`, `batchForcedTransfer(address[],address[],uint256[])` | giữ `forcedTransfer` |
| Thông tin | `onchainID()` (trả địa chỉ đã đặt, mặc định 0), `setOnchainID(address)`, `version()` (trả `"4.1.6-poc"`) | mới |

- Sự kiện theo ERC-3643: `AddressFrozen`, `TokensFrozen`, `TokensUnfrozen`, `Paused`, `Unpaused`,
  `IdentityRegistryAdded`, `ComplianceAdded`.
- **Bỏ** `isWhitelisted`, `setWhitelisted`, `batchSetWhitelisted`, `setFrozen`, `setPaused`,
  `agentBurn`. Không giữ hàm bí danh.
- **Không làm:** `recoveryAddress` (cần ONCHAINID), `batchMint`, `batchBurn` (mint chỉ vào ví SPV nên
  không cần), `setName`, `setSymbol`. Ghi rõ trong NatSpec và checkpoint.
- **Giữ nguyên:** `spvWallet`, `initialSupplyMinted`, `mintInitialSupply`, luật `mint` chỉ vào ví SPV,
  các lỗi `InitialSupplyAlreadyMinted`, `InitialSupplyNotMinted`, `MintTargetNotSpv`, `snapshot()`,
  `ERC20Snapshotable`, `ERC20Burnable` (người giữ tự đốt bằng `burn(uint256)`), `decimals` tuỳ chỉnh.
- **Vai:** giữ `AccessControl` với `MINTER_ROLE`, `AGENT_ROLE`, `SNAPSHOT_ROLE`, `PAUSER_ROLE`.
  `AGENT_ROLE` tương ứng "agent" của ERC-3643. Ghi bảng ánh xạ trong NatSpec.
- **Hàm khởi tạo giữ chữ ký cũ** `(name, symbol, decimals, admin)`. Sổ danh tính và bộ luật gắn sau
  bằng `setIdentityRegistry`, `setCompliance` (QĐ-6).

**QĐ-3. Luật trong `_update` (theo thứ tự, để lý do lỗi ổn định).**
1. Đường cưỡng chế (`forcedTransfer`, `burn(address,uint256)` của agent) bỏ qua bước 2 đến 5, như
   `_forcedMove` hiện nay. `forcedTransfer` vẫn bắt buộc bên nhận `isVerified`. Nếu số chuyển vượt
   phần chưa bị đóng băng thì giảm phần đóng băng tương ứng và phát `TokensUnfrozen` (như T-REX).
2. Không đang tạm dừng.
3. Bên gửi, bên nhận không bị đóng băng ví.
4. Chuyển nhượng: cả hai bên `identityRegistry.isVerified`; số chuyển không vượt
   `balanceOf(from) - getFrozenTokens(from)`; `compliance.canTransfer(from, to, amount)` trả `true`.
   Phát hành: bên nhận `isVerified`; `compliance.canTransfer(address(0), to, amount)`.
   Đốt do người giữ tự làm: không bị đóng băng, không vượt phần chưa đóng băng.
5. Sau khi đổi số dư: gọi `compliance.transferred`, `created` hoặc `destroyed` tương ứng.
- Chưa gắn sổ danh tính hoặc bộ luật mà có lượt chuyển: revert lỗi rõ (`IdentityRegistryNotSet`,
  `ComplianceNotSet`), không coi là cho phép.
- Dùng lỗi tuỳ biến (custom error) cho mọi điều kiện mới; cập nhật bảng `REVERT_MESSAGES` của adapter.

**QĐ-4. `IdentityRegistry` rút gọn.**
- Lưu theo ví: đã đăng ký, mã quốc gia (`uint16`, theo ISO 3166-1 số). `isVerified(wallet)` = đã đăng
  ký. Không có ONCHAINID, không có claim.
- Hàm: `registerIdentity(address,uint16)`, `batchRegisterIdentity(address[],uint16[])`,
  `deleteIdentity(address)`, `updateCountry(address,uint16)`, `isVerified(address)`,
  `investorCountry(address)`, `contains(address)`. Ba hàm đọc cuối có cùng chữ ký với T-REX; ba hàm
  ghi đầu **khác** T-REX vì T-REX nhận thêm tham số ONCHAINID. Ghi rõ điều này trong NatSpec.
- `registerIdentity` cho ví đã đăng ký: **không lỗi**, cập nhật quốc gia (giữ tính lặp lại được như
  `mock.adapter`).
- Vai `AGENT_ROLE` ghi, `DEFAULT_ADMIN_ROLE` quản trị. Sự kiện `IdentityRegistered`,
  `IdentityRemoved`, `CountryUpdated`.

**QĐ-5. `ModularCompliance` và module.**
- Hàm theo `IModularCompliance`: `bindToken`, `unbindToken`, `addModule`, `removeModule`,
  `getModules`, `getTokenBound`, `isModuleBound`, `transferred`, `created`, `destroyed`, `canTransfer`.
- `transferred`, `created`, `destroyed` **chỉ token đã gắn** được gọi. `canTransfer` là hàm đọc, trả
  `true` khi mọi module đồng ý (không có module nào thì `true`).
- Module theo `IModule`: `moduleCheck`, `moduleTransferAction`, `moduleMintAction`,
  `moduleBurnAction`, `name`. Triển khai gắn sẵn `AllowAllModule`. Kiểm thử dùng thêm một module chỉ dùng cho kiểm thử (đặt trong `contracts/test/`, ví dụ `RejectAllModule`) để chứng minh bộ luật chặn được, **không** triển khai module này.
- Không cần proxy, không cần `TREXFactory`.

**QĐ-6. Triển khai và địa chỉ.**
- `deploy.js` giữ **đúng thứ tự** bốn hợp đồng cũ (`ProjectToken`, `VNDToken`, `ProfitDistributor`,
  `Redemption`) để địa chỉ hardhat-local không đổi, rồi triển khai `IdentityRegistry`,
  `ModularCompliance`, module. Sau đó: `setIdentityRegistry`, `setCompliance`, `bindToken`,
  `addModule`. Ví SPV được truyền vào ở lần duyệt Mint đầu (SC-02), nên `deploy.js` không biết ví SPV:
  ví SPV phải được **đăng ký vào sổ danh tính trước lần duyệt Mint đầu**. Hardhat-local: `seed-local.js`
  đăng ký cùng các ví mẫu. Sepolia: bước riêng trong runbook (whitelist qua ứng dụng hoặc script).
- `addresses.json` thêm `IdentityRegistry`, `ModularCompliance` và module; ABI thêm vào
  `packages/shared/src/abi/`, kiểm thử đồng bộ ABI cập nhật.
- Bytecode hai token đổi: `scripts/evm-local.sh` (OP-03) sẽ phát hiện lệch và yêu cầu `reset`. Ghi vào
  runbook.

**QĐ-7. `permit` cho VNDB và WPT.**
- `VNDToken` kế thừa `ERC20Permit` của OpenZeppelin v5, tên miền ký `"Vietnam Dong Bank token"`, phiên
  bản `"1"`. Không đổi tên, ký hiệu, số thập phân, vai.
- Task này **không** thêm hàm vào `ILedgerPort`: SC-03 và FE-05 sẽ dùng `permit`. Chỉ cần hợp đồng,
  ABI, kiểm thử hợp đồng và một hàm tiện ích dựng dữ liệu ký EIP-712 trong `packages/shared` (để FE-05
  dùng lại), có kiểm thử.
- `permit` cho WPT (CH-1 đã chốt): `ProjectToken` kế thừa thêm `ERC20Permit`, tên miền ký là tên token, phiên bản `"1"`. `permit` chỉ cấp ủy quyền; `transferFrom` sau đó vẫn đi qua đủ luật QĐ-3.

**QĐ-8. Ứng dụng.**
- `ILedgerPort` giữ nguyên tên miền nghiệp vụ (`whitelist`, `isWhitelisted`, `freeze`, `isFrozen`,
  `canTransfer`). Chỉ `evm.adapter` đổi phần gọi hợp đồng:

| Hàm cổng | Gọi hợp đồng mới |
|---|---|
| `whitelist(wallet)` | `IdentityRegistry.registerIdentity(wallet, 704)` |
| `isWhitelisted(wallet)` | `IdentityRegistry.isVerified(wallet)` |
| `freeze(wallet, frozen)` | `ProjectToken.setAddressFrozen(wallet, frozen)` |
| `isFrozen(wallet)` | `ProjectToken.isFrozen(wallet)` |
| `canTransfer(from, to, amount)` | đọc song song: `paused`, `isFrozen` hai bên, `isVerified` hai bên, `balanceOf`, `getFrozenTokens(from)`, `ModularCompliance.canTransfer`; trả lý do theo **đúng thứ tự QĐ-3** |
| `burn` lập duyệt (SC-02) | `burn(address,uint256)` thay `agentBurn` |

- Mã quốc gia mặc định 704 đặt thành hằng số có tên trong `packages/shared`, không viết số trần.
- Thiếu địa chỉ `IdentityRegistry` hoặc `ModularCompliance` cho một chain EVM: báo lỗi rõ "bộ hợp đồng
  chain này chưa triển khai bản ERC-3643 (SC-09), chạy lại triển khai theo runbook". **Không** lùi về
  đọc hàm cũ.
- `mock.adapter`: không đổi hành vi. Nếu thêm được lý do "bộ luật từ chối" thì thêm, không bắt buộc.
- Mọi script trong `packages/contracts-evm/scripts` và `app/scripts` dùng hàm cũ phải đổi sang hàm mới.

**QĐ-9. Sepolia.** Sau merge, chain `evm` báo lỗi theo QĐ-8 cho tới khi chủ dự án triển khai lại theo
runbook OP-04 (đã có `fund-sepolia.js`, `preflight-sepolia.js`). Đây là lần triển khai lại thứ nhất
của đợt 6; OP-05 sẽ triển khai lần nữa khi có vault và hợp đồng khớp lệnh. Người làm cập nhật
`preflight-sepolia.js`, `dod-verify-sepolia.js`, `verify-deployment.js` cho bộ mới và viết runbook.
**Không** tự triển khai lên Sepolia.

## Việc cần làm

1. Giao diện cục bộ và ba hợp đồng theo QĐ-1 đến QĐ-5; `VNDToken` theo QĐ-7.
2. Sửa 9 tệp script và kiểm thử dùng hàm cũ; mọi bộ kiểm thử hợp đồng cũ xanh mà không nới điều kiện.
3. Tệp kiểm thử mới `test/sc-09-erc3643.test.js` theo bảng kiểm chứng.
4. `deploy.js`, `addresses.json`, ABI dùng chung theo QĐ-6.
5. `evm.adapter`, hằng số quốc gia, tiện ích dữ liệu ký `permit` theo QĐ-7, QĐ-8.
6. Cập nhật `docs/DEPLOYMENT.md` (runbook triển khai lại Sepolia cho bộ mới, `evm-local.sh reset`),
   `docs/tech-report.md` (đóng nợ "ERC-3643 chưa áp dụng" thành "áp dụng kiến trúc, chưa ONCHAINID"),
   `packages/contracts-evm/README.md` (bảng hàm cũ và mới).
7. Thêm `SC-09` vào `.kiro/task-status.json`.

## Ràng buộc

- Không sửa `trex/`, `ProfitDistributor`, `ProfitDistributorOracle`, `EnergyOracle` (chỉ sửa kiểm thử
  của chúng nếu kiểm thử gọi hàm cũ của WPT).
- **`Redemption` sửa đúng một chỗ** (Supervisor phát hiện khi vẽ sơ đồ liên kết): dòng 83 đang gọi
  `projectToken.isWhitelisted(msg.sender)`, hàm này bị bỏ ở QĐ-2. Đổi sang hỏi sổ danh tính của token
  (`identityRegistry().isVerified(msg.sender)`), giữ nguyên thông báo lỗi. `burnFrom` của nhà đầu tư
  đi qua luật đốt của QĐ-3. Bộ `spec-p12-redemption.test.js` phải xanh.
- Không thêm hàm vào `ILedgerPort`. Không gọi hợp đồng trực tiếp từ `components/` hay `app/`.
- Không thêm thư viện mới ngoài những gì đã có trong `package.json`.
- Không triển khai lên Sepolia. Không commit khoá riêng, RPC có khoá.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy (`efficiency.md`).

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | **Khớp chữ ký ERC-3643:** với mỗi hàm và sự kiện trong bảng QĐ-2, bộ chọn hàm (selector) và topic sự kiện của `ProjectToken` bằng giá trị tính từ chữ ký trong `IToken.sol` của T-REX v4.1.6. Danh sách chữ ký đặt trong kiểm thử, có ghi nguồn |
| 2 | Chỉ ví `isVerified` nhận được phát hành và chuyển nhượng; ví chưa đăng ký bị chặn đúng lỗi; `deleteIdentity` rồi chuyển thì bị chặn |
| 3 | Với `AllowAllModule`: chuyển hợp lệ qua được. Gắn `RejectAllModule` (chỉ trong kiểm thử): chuyển bị chặn đúng lỗi, gỡ module thì chuyển lại được; `canTransfer` của bộ luật là hàm đọc |
| 4 | Đóng băng ví chặn gửi và nhận; đóng băng một phần chặn chuyển vượt phần còn lại; `forcedTransfer` bỏ qua đóng băng, giảm phần đóng băng và phát `TokensUnfrozen` khi cần |
| 5 | `pause` chặn chuyển, `unpause` mở lại; chỉ `PAUSER_ROLE` gọi được |
| 6 | Luật SC-02 giữ nguyên: bộ `sc-02-issuance.test.js` xanh; ví SPV chưa đăng ký thì `mintInitialSupply` bị chặn |
| 7 | Snapshot và chia lợi nhuận: `full-cycle.test.js`, `spec-p7-profit-distribution.test.js` xanh |
| 8 | `transferred`, `created`, `destroyed` gọi từ địa chỉ không phải token đã gắn thì bị chặn |
| 9 | Chưa gắn sổ danh tính hoặc bộ luật thì chuyển bị chặn đúng lỗi |
| 10 | `registerIdentity` hai lần cho cùng ví không lỗi (lặp lại được) |
| 11 | `permit` VNDB **và WPT**: chữ ký hợp lệ cấp ủy quyền và `transferFrom` chạy; chữ ký hết hạn, sai người ký, dùng lại (sai nonce) đều bị từ chối. Tiện ích dữ liệu ký trong `packages/shared` tạo đúng chữ ký cho cả hai token (kiểm khứ hồi với hợp đồng). WPT: `permit` cho ví chưa xác minh vẫn cấp được ủy quyền nhưng `transferFrom` tới ví chưa xác minh bị chặn |
| 12 | Đột biến, dán đầu ra đỏ rồi hoàn nguyên: (a) bỏ kiểm `isVerified` trong `_update`, ca 2 đỏ; (b) bỏ gọi `compliance.canTransfer`, ca 3 đỏ; (c) bỏ kiểm phần chưa đóng băng, ca 4 đỏ; (d) cho mọi địa chỉ gọi `transferred`, ca 8 đỏ; (e) đổi tên miền ký `permit`, ca 11 đỏ |
| 13 | Adapter với nút hardhat thật (`TEST_HARDHAT_RPC`, như SC-02): `whitelist` rồi `isWhitelisted` đúng; `freeze`; `canTransfer` trả đúng lý do cho từng ca chặn, gồm bộ luật từ chối; luồng Mint/Burn lập duyệt chạy hết |
| 14 | Thiếu địa chỉ sổ danh tính cho chain EVM thì adapter báo lỗi đúng QĐ-8, không đọc hàm cũ |
| 15 | E2E hardhat (`mint.spec.ts`, `chain-scope.spec.ts`) và bộ mặc định `run-local-all.sh` xanh; dán số ca trước và sau |

## Điều kiện hoàn thành

- [ ] `ProjectToken` theo QĐ-2, QĐ-3; ca 1 khớp chữ ký ERC-3643 cho mọi hàm, sự kiện đã làm.
- [ ] `IdentityRegistry`, `ModularCompliance`, module theo QĐ-4, QĐ-5 (ca 2, 3, 8, 9, 10).
- [ ] Đóng băng, tạm dừng, cưỡng chế đúng (ca 4, 5).
- [ ] Luật SC-02, snapshot, chia lợi nhuận không đổi (ca 6, 7).
- [ ] `permit` VNDB, WPT và tiện ích dữ liệu ký (ca 11).
- [ ] Đột biến đỏ đúng ca (ca 12).
- [ ] Ứng dụng qua `evm.adapter` chạy đúng trên hardhat; thiếu địa chỉ báo rõ (ca 13, 14).
- [ ] Không còn lời gọi hàm cũ trong script, kiểm thử, adapter (dán lệnh `grep` ra rỗng).
- [ ] Bộ mặc định, E2E hardhat xanh (ca 15); quét bí mật sạch.
- [ ] Tài liệu, runbook Sepolia cập nhật.
- [ ] **[Chủ dự án, sau merge]** Triển khai lại Sepolia theo runbook; `/api/token?chain=evm` đọc
      được; Mint lập duyệt một lượt trên `evm` thành công, ghi mã giao dịch.

## Câu hỏi cho chủ dự án (đã trả lời 15/10)

| Mã | Câu hỏi | Chủ dự án chốt |
|---|---|---|
| CH-1 | Thêm `permit` cho WPT? | **Có**, theo đề xuất |
| CH-2 | Module tuân thủ để trình diễn? | **Không cần trình diễn.** Gắn module mặc định luôn trả `true`; mở rộng khi cần |

## Không làm

- ONCHAINID, claim, `TrustedIssuersRegistry`, `ClaimTopicsRegistry`, `TREXFactory`, proxy.
- `recoveryAddress`, `batchMint`, `batchBurn`, `setName`, `setSymbol`.
- Vault thanh toán (SC-07), hợp đồng khớp lệnh (SC-03), màn ký `permit` (FE-05).
- Triển khai Sepolia (chủ dự án làm sau merge).
