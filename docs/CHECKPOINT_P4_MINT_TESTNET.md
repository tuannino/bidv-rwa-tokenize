# Báo cáo bàn giao — P4: Mint trên Ethereum testnet (Sepolia)

> Điền theo `docs/CHECKPOINT_TEMPLATE.md`.

| | |
|---|---|
| Branch | `p4/mint-testnet` |
| Spec | `.kiro/specs/p4-mint-testnet/{requirements,design,tasks}.md` + `#steering-testnet` |
| Trạng thái | ✅ **PASS** — mint chạy thật trên Sepolia, tra được trên Etherscan |
| Contract | **KHÔNG sửa một dòng Solidity nào** |

## 0. Bằng chứng nghiệm thu

Bộ contract trên Sepolia (deployer = ví ngân hàng `0xCa49Fb2590800C9524f2BC57Ecd80C3Cc75D9076`),
**cả 4 đã Verified**:

| Contract | Địa chỉ | Etherscan |
|---|---|---|
| ProjectToken (WPT) | `0x3Fe22dcfFCFB4459a417113ED6deb5C3A23B14be` | [#code](https://sepolia.etherscan.io/address/0x3Fe22dcfFCFB4459a417113ED6deb5C3A23B14be#code) |
| VNDToken | `0xF9ceD0D827020D4A8778E0B4DBEdF46bb14f9fCd` | [#code](https://sepolia.etherscan.io/address/0xF9ceD0D827020D4A8778E0B4DBEdF46bb14f9fCd#code) |
| ProfitDistributor | `0x675f0e3dBc7a0c6dB11442F3a236b6427442CdB5` | [#code](https://sepolia.etherscan.io/address/0x675f0e3dBc7a0c6dB11442F3a236b6427442CdB5#code) |
| Redemption | `0x39eC24eC638dc9e394ED7bb7A6ff72c3DfBd1d68` | [#code](https://sepolia.etherscan.io/address/0x39eC24eC638dc9e394ED7bb7A6ff72c3DfBd1d68#code) |

Giao dịch của luồng mint (nhà đầu tư `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`):

| Bước | Tx | Block | Kết quả |
|---|---|---|---|
| whitelist | [`0x905113…89a1`](https://sepolia.etherscan.io/tx/0x905113645414b5e749fca2d34ebe48e3427cb55c706970d3fc2bcb03058389a1) | 11680568 | SUCCESS, gas 48 110 |
| mint 100 WPT | [`0x625c90…46f3`](https://sepolia.etherscan.io/tx/0x625c9064cdccb1ba386ea7a511bb3894b7586fa00bdd306f24df208ccdfd46f3) | 11680569 | SUCCESS, gas 84 924 |
| mint 100 WPT (lần 2) | [`0xf927e4…2576`](https://sepolia.etherscan.io/tx/0xf927e44fc26ed6c68c725f9ee3146cc2d1219823d3e8ae8e461959ba9ed02576) | — | SUCCESS |

Đọc trực tiếp từ chain (không qua app), sau lần mint đầu:

```
balanceOf(investor) = 100      totalSupply() = 100      isWhitelisted(investor) = 1
```

Sau lần mint thứ hai: `balanceOf = 200`.

## 1. Đã làm

| Commit | Nội dung |
|---|---|
| `c137110` `docs:` | Nhận spec P4/P7/P12 + steering testnet |
| `8a6cf4e` `fix(chain):` | Thay RPC Sepolia mặc định đã chết |
| `e0f50f7` `feat(ledger):` | Timeout receipt theo chain, Sepolia 90s (**T1.1**) |
| `ab0dd25` `fix(shared):` | Gợi ý deploy nêu đúng network + test tên biến địa chỉ |
| `e5f1294` `feat(testnet):` | Preflight + env mẫu + runbook + demo runner chain `evm` (**T0.2**, **T1.6**) |
| `8f84d82` `fix(ledger):` | Ký cục bộ rồi gửi raw tx thay vì nhờ node ký |
| `d3c2193` `fix(signer):` | Khóa ký theo chain + nhận khóa không có `0x` |
| `954c95b` `fix(contracts):` | solc WASM thành opt-in để verify được (**T0.6**) |
| `90392d8` `feat(testnet):` | Script kiểm bản deploy + nạp địa chỉ Sepolia (**T0.5**) |

## 2. Bốn lỗi chặn đã phát hiện và sửa

Đây là phần đáng chú ý nhất: cả bốn đều **không thể lộ ra trên hardhat-local**, chỉ xuất hiện
khi chạy thật trên mạng công khai.

**(a) RPC mặc định đã chết.** `https://rpc.sepolia.org` trả HTTP 404. Nó là mặc định ở cả
`packages/shared/src/chains.ts` và `hardhat.config.js`, nên chặn mọi thao tác Sepolia ngay từ
đầu. Đã đo 5 endpoint, chọn `ethereum-sepolia-rpc.publicnode.com`.
⚠️ Steering `testnet.md` §3/§6 vẫn giới thiệu endpoint chết này — tôi không tự sửa steering.

**(b) Adapter nhờ NODE ký thay vì tự ký.** Mint fail:
`The method "eth_sendTransaction" does not exist`. `writer()` trả về **địa chỉ** ví rồi truyền
vào `simulateContract({ account })`; viem coi hex address là account kiểu `json-rpc` nên
`writeContract` gọi `eth_sendTransaction` — tức nhờ node ký. Hardhat-local có account mở sẵn
nên chạy được; RPC công khai không hỗ trợ. Sửa: truyền cả object `Account` (kiểu `local`) để
viem tự ký rồi gửi `eth_sendRawTransaction`.

**(c) Khóa ký toàn cục nhưng role thì theo chain.** Sau khi đặt khóa ví Sepolia, mint trên
hardhat-local revert `AccessControlUnauthorizedAccount` (`0xe2517d3f`) — vì ví Sepolia không có
role trên contract local. Chain-selector cho đổi chain lúc chạy, nên một khóa dùng chung làm
hỏng đúng tính năng cốt lõi. Thêm `SERVER_SIGNER_PRIVATE_KEY_<CHAIN>`, fallback về khóa chung;
cache signer đổi từ khoá theo `kind` sang `(kind, chain)`.

**(d) Verify Etherscan không thể thành công.** `hardhat.config.js` luôn ép dùng gói `solc` WASM,
báo `longVersion` có hậu tố `.Emscripten.clang`, Etherscan từ chối với
`Invalid Or Not supported solc version`. Comment cũ ghi "để lại cũng không sao" là sai. Nay
override chỉ bật khi `USE_LOCAL_SOLC=1`.

Ngoài ra: khóa MetaMask xuất ra **không có tiền tố `0x`**, viem thì bắt buộc có và chỉ báo
`invalid private key ... got string`. Nay tự thêm tiền tố (5 test).

## 3. Đối chiếu DoD

### Phase 0 — Bring-up (P7/P12 dùng lại, không deploy lại)

| Task | DoD | Đạt? | Bằng chứng |
|---|---|---|---|
| T0.1 Ví + ETH test | balance > 0 | ✅ | `0xCa49…9076`, 3.0879 ETH (Owner tự làm) |
| T0.2 `.env` + `.env.example` | đủ biến, không commit giá trị thật | ✅ | Thêm `packages/contracts-evm/.env.example`; `.env` thật gitignored |
| T0.3 `hardhat compile` sạch | compile pass | ✅ | `clean` + `compile` bằng binary chính thức, 23 file, evmVersion paris |
| T0.4 Deploy Sepolia | 4 địa chỉ + khối `"evm"` | ✅ | Owner deploy lúc 16:17; tôi **không deploy lại** để khỏi sinh contract trùng |
| T0.5 Nạp địa chỉ | `getContractAddress('evm',…)` đúng | ✅ | `addresses.json` có khối `"evm"`; `/api/token?chain=evm` trả `WPT — Wind Power Token` |
| T0.6 Verify Etherscan | 4 contract "Verified" | ✅ | API Etherscan xác nhận `Verified=YES`, `compiler=v0.8.28+commit.7893614a` cho cả 4 |

Thêm `verify-deployment.js` (chỉ đọc): xác nhận symbol/decimals, 4 role của ví ngân hàng,
liên kết giữa các contract, `rate = 1 000 000`, và **`ProfitDistributor` có `SNAPSHOT_ROLE`** —
điều kiện then chốt cho P7.

### Phase 1 — Mint trên testnet

| Task | DoD | Đạt? | Bằng chứng |
|---|---|---|---|
| T1.1 Timeout riêng chain `evm` | không PENDING oan trước ~90s | ✅ | `EVM_RECEIPT_TIMEOUT_MS=90_000`; 5 test; cả 3 tx đều CONFIRMED trong hạn |
| T1.2 Whitelist trên Sepolia | `isWhitelisted`=true, tx trên Etherscan | ✅ | tx `0x905113…`, block 11680568, `isWhitelisted = 1` |
| T1.3 Mint 100 | `balanceOf`=100 on-chain | ✅ | tx `0x625c90…`, `balanceOf = 100`, `totalSupply = 100` |
| T1.4 Chặn trước khi tốn gas | 2 ca không sinh tx | ✅ | **nonce ví ngân hàng không đổi (7 → 7)** sau khi thử mint ví chưa whitelist (409) và amount=0 (400) |
| T1.5 Guard quyền | role khác BANK_ADMIN bị chặn | ✅ | AUDITOR/INVESTOR/COMPLIANCE đều 403 FORBIDDEN trên chain `evm`, không chạm chain |
| T1.6 Demo runner testnet | một lệnh ra kết quả | ✅ | `node scripts/demo-mint.mjs --chain evm` → PASS + link Etherscan từng tx |

### Kết quả đo được

```
13 passing   # contracts EVM        5 passing   # T-REX        8 passing   # Stellar
36 passed    # vitest (21 -> 36)    5 passed    # playwright
typecheck sạch · lint 0 error

demo-mint --chain evm            PASS   BALANCE = 100 -> 200 WPT trên Sepolia
demo-mint --chain hardhat-local  PASS   BALANCE = 200 WPT
demo-mint --chain mock           PASS   BALANCE = 100 WPT
```

**Cả ba chain PASS trong cùng một lần chạy, không phải đổi env** — đó là kiểm chứng cho bản
sửa (c).

## 4. DEVIATION so với spec

1. **Không tự chạy `deploy.js`.** Owner đã deploy trước khi tôi bắt đầu. Deploy lại sẽ sinh 4
   contract trùng, tốn gas và đổi địa chỉ. Thay vào đó tôi viết `verify-deployment.js` để kiểm
   bản deploy đó đủ điều kiện.
2. **Đổi RPC mặc định** (mục 2a) — ngoài phạm vi task nhưng là điều kiện cần.
3. **Thêm `preflight-sepolia.js`, `verify-deployment.js`** — không có trong `tasks.md`.
4. **Thêm `SERVER_SIGNER_PRIVATE_KEY_<CHAIN>`** — mở rộng cấu hình, không có trong design.
   Bắt buộc phải có nếu muốn hardhat-local và Sepolia cùng dùng được.
5. **Sửa `hardhat.config.js`** — file cấu hình, không phải logic contract. `git diff -- '*.sol'`
   vẫn rỗng.
6. **Sửa một test cũ** (`evm-address-env.test.ts`): nó giả định chain `evm` chưa deploy nên đỏ
   sau khi deploy thật. Nay kiểm thứ tự ưu tiên env-thắng-file, không phụ thuộc trạng thái file.

## 5. Câu hỏi mở / chỗ chưa chắc

### ⛔ Chặn P7/P12: `tVND` → `VNDB` cần SỬA CONTRACT

Owner đã chốt dùng `VNDB`. Nhưng ký hiệu này **ghi cứng trong Solidity**:

```solidity
constructor(address admin) ERC20("Tokenized VND", "tVND")
```

Không phải tham số constructor, nên đổi được **chỉ bằng cách sửa `VNDToken.sol`** — vi phạm
"contract giữ nguyên", nên theo đúng chỉ thị tôi **dừng và hỏi**.

Kéo theo: `VNDToken` đổi thì phải **deploy lại 3 contract** (`VNDToken`, và
`ProfitDistributor`/`Redemption` vì cả hai giữ địa chỉ VNDToken là `immutable`), rồi verify lại.
`ProjectToken` (WPT) **không ảnh hưởng**, nên P4 vẫn PASS.

Ba cách, xin Owner chọn:
- **(a)** Sửa `VNDToken.sol` → `ERC20("Vietnam Dong Bank token", "VNDB")`, chạy lại 13 test,
  deploy lại 3 contract, verify lại. Sạch nhất, tốn thêm ~0.01 ETH test.
- **(b)** Giữ `tVND` on-chain, chỉ hiển thị "VNDB" ở UI. Rẻ nhưng lệch giữa UI và chain —
  đúng loại lỗi mà kiểm toán sẽ bắt.
- **(c)** Hoãn tới khi làm P7, gộp một lần deploy.

**Đề xuất: (a) làm ngay trước khi vào P7**, vì P7 chi trả bằng token này; để muộn thì phải sửa
lại UI/port đã viết.

### Câu hỏi 2 (P2): steering `testnet.md` còn RPC chết

§3 và §6 vẫn ghi `https://rpc.sepolia.org`. Tôi không sửa steering của Supervisor. Nên cập nhật
để người sau không lặp lại.

### Chỗ chưa chắc

- **`HANDOFF_P4_P7_P12.md` đã bị xoá khỏi đĩa** và không phải do tôi. Tôi để phần xoá đó **ngoài
  commit** của mình để Owner tự quyết (khôi phục bằng `git checkout c137110 -- docs/20260910_…`).
- **Khóa ví ngân hàng giờ nằm trong `app/.env.local`** (gitignored). Dev server đang chạy có thể
  ký bất kỳ giao dịch nào bằng ví đó. Chấp nhận được với testnet; Phase 5 thay bằng Fireblocks.
- **RPC dùng cho app là Infura của Owner**, đặt ở `RPC_EVM` (không phải `NEXT_PUBLIC_`) để API
  key không lọt vào bundle browser.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`** — `grep -rn "from 'viem'" app/src | grep -v src/lib/` → rỗng.
- [x] **Mọi ký qua `ISigner`** — khóa chỉ đọc ở `lib/config/env.ts` (`signerPrivateKeyFor`) và
      `lib/signer/server.signer.ts`. Preflight đọc `PRIVATE_KEY` qua hardhat và chỉ in địa chỉ.
- [x] **Mọi kiểm quyền qua RBAC** — `grep -rn "role ===\|role ==" app/src | grep -v src/lib/rbac/`
      → rỗng. Kiểm thật trên chain `evm`: 3 role bị 403 trước khi chạm chain.
- [x] **Contract Solidity không đổi** — `git diff c137110..HEAD -- '*.sol'` → rỗng.
- [x] **ABI/địa chỉ chỉ ở `packages/shared`** — không thêm bản copy nào.
