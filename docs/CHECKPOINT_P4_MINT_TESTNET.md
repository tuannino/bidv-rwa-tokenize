# Báo cáo bàn giao — P4: Mint trên Ethereum testnet (Sepolia)

> Điền theo `docs/CHECKPOINT_TEMPLATE.md`.

| | |
|---|---|
| Branch | `p4/mint-testnet` |
| Spec | `.kiro/specs/p4-mint-testnet/{requirements,design,tasks}.md` + `#steering-testnet` |
| Trạng thái | ⚠️ **BỊ CHẶN** ở Phase 0 — chờ Owner cấp ví Sepolia + credential |
| Contract | **KHÔNG sửa một dòng Solidity nào** (13/13 test vẫn xanh) |

## 0. Tóm tắt trong một đoạn

Phase 0 của P4 (deploy lên Sepolia) cần một ví có ETH test và ba credential mà **chỉ Owner
cấp được**: `PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`. Tôi không tự tạo khóa hộ
Owner và không qua được faucet (captcha/đăng nhập). Nên tôi đã làm **toàn bộ phần không cần
bí mật**, và biến phần bị chặn thành một lệnh tự kiểm (`preflight-sepolia.js`) cộng runbook
7 bước (`docs/TESTNET_SEPOLIA.md`). Khi Owner làm xong bước 1–2, phần còn lại là chạy lệnh.

Trong quá trình chuẩn bị đã phát hiện và sửa **một lỗi chặn thật**: RPC Sepolia mặc định
trong repo đã chết, khiến mọi thao tác Sepolia fail trước khi kịp thử gì (mục 2).

## 1. Đã làm

| Commit | Nội dung |
|---|---|
| `c137110` `docs:` | Nhận spec P4/P7/P12 + steering testnet |
| `8a6cf4e` `fix(chain):` | Thay RPC Sepolia mặc định đã chết |
| `e0f50f7` `feat(ledger):` | Timeout receipt theo chain, Sepolia 90s (**T1.1**) |
| `ab0dd25` `fix(shared):` | Gợi ý deploy nêu đúng network + test khoá tên biến địa chỉ |
| `e5f1294` `feat(testnet):` | Preflight + `.env.example` + runbook + demo runner chain `evm` (**T0.2**, **T1.6**) |

## 2. Lỗi chặn đã phát hiện và sửa (ngoài spec)

**RPC Sepolia mặc định đã chết.** `https://rpc.sepolia.org` trả HTTP 404 — không còn là
endpoint JSON-RPC. Nó là mặc định ở **cả hai** chỗ:

- `packages/shared/src/chains.ts` → `CHAINS.evm.defaultRpcUrl`
- `packages/contracts-evm/hardhat.config.js` → fallback của network `sepolia`

Hệ quả: kể cả sau khi Owner cấp khóa, deploy và mọi thao tác đọc vẫn fail với lỗi khó truy.
Steering `testnet.md` §3 và §6 cũng đang giới thiệu endpoint này.

Đã đo 5 endpoint công khai, chọn `https://ethereum-sepolia-rpc.publicnode.com`
(trả đúng `chainId 11155111`). `sepolia.drpc.org` và `rpc.ankr.com/eth_sepolia` cũng không
dùng được (lần lượt "chain is not available" và "Unauthorized").

## 3. Đối chiếu DoD

### Phase 0 — Bring-up

| Task | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| T0.1 Ví + ETH test | `eth_getBalance` > 0 | ⛔ **CHẶN** | Cần Owner: tạo ví testnet + faucet. Preflight kiểm hộ, có link faucet |
| T0.2 `.env` + `.env.example` | `.env.example` đủ biến, không commit giá trị thật | ✅ | Thêm mới `packages/contracts-evm/.env.example`; mở rộng `.env.example` gốc với `NEXT_PUBLIC_ADDR_EVM_*`, `RPC_EVM`. `.env` thật là việc của Owner |
| T0.3 `hardhat compile` sạch | compile pass | ✅ | `Nothing to compile` (artifact hiện có còn hợp lệ); 13/13 test xanh |
| T0.4 Deploy Sepolia | in 4 địa chỉ + khối `"evm"` | ⛔ **CHẶN** | Cần T0.1/T0.2 |
| T0.5 Nạp địa chỉ | `getContractAddress('evm',...)` đúng | 🟡 **Cơ chế xong, chờ giá trị** | Đường env đã kiểm bằng test; chưa có địa chỉ thật vì chưa deploy |
| T0.6 Verify Etherscan | 4 contract "Verified" | ⛔ **CHẶN** | Lệnh + thứ tự tham số đã ghi sẵn ở runbook bước 6 |

### Phase 1 — Mint trên testnet

| Task | DoD | Đạt? | Bằng chứng |
|---|---|---|---|
| T1.1 Timeout riêng chain `evm` | Không PENDING oan trước ~90s | ✅ | `EVM_RECEIPT_TIMEOUT_MS=90_000` + `receiptTimeoutFor()`; 5 test |
| T1.2 Whitelist trên Sepolia | `isWhitelisted`=true, tx trên Etherscan | ⛔ **CHẶN** | Cần Phase 0 |
| T1.3 Mint 100 từ UI | `balanceOf`=100 on-chain | ⛔ **CHẶN** | Cần Phase 0 |
| T1.4 Chặn trước khi tốn gas | 2 ca không sinh tx | 🟡 **Một nửa** | `amount<=0`, ví sai định dạng: đã kiểm trên chain `evm`, trả 400 VALIDATION, không chạm chain. Ca "chưa whitelist" cần contract đã deploy để `simulateContract` chạy |
| T1.5 Guard quyền | role khác BANK_ADMIN bị chặn | ✅ | Trên chain `evm`: AUDITOR/INVESTOR/COMPLIANCE đều 403 FORBIDDEN, không chạm chain |
| T1.6 Demo runner testnet | Một lệnh ra kết quả | 🟡 **Code xong, chờ chain** | `--chain evm` in link Etherscan; hiện fail đúng cách kèm hướng dẫn |

### Kết quả đo được (không hồi quy)

```
13 passing      # contracts EVM (hardhat test)
 5 passing      # T-REX (ERC-3643)
 8 passing      # Stellar (cargo test --workspace)
30 passed       # vitest  (26 cũ + 4 mới: 5 timeout, 4 env địa chỉ — trừ trùng)
 5 passed       # playwright
typecheck sạch · lint 0 error
demo-mint --chain hardhat-local: PASS (BALANCE = 100 WPT)
```

Vitest tăng 21 → 30 test; không test nào cũ bị sửa.

## 4. DEVIATION so với spec

1. **Đổi RPC mặc định** (mục 2). Ngoài phạm vi task nhưng là điều kiện cần để bất kỳ task
   Sepolia nào chạy được. Steering `testnet.md` §3/§6 nên cập nhật theo — tôi **không tự sửa
   steering** vì đó là tài liệu của Supervisor.
2. **Sửa thông báo lỗi `getContractAddress`** nêu đúng network. Nhỏ, nhưng đúng lúc P4 mới
   thêm chain thứ hai nên gợi ý sai sẽ dẫn người đọc deploy sai mạng.
3. **Thêm `preflight-sepolia.js`** — không có trong `tasks.md`. Lý do: T0.1/T0.2 là việc của
   Owner, cần một cách tự kiểm thay vì mô tả bằng lời.
4. **Thêm `RPC_EVM`** (bản không `NEXT_PUBLIC_`) vào `.env.example`. `config/env.ts` vốn đã
   đọc biến này và ưu tiên nó, nhưng `.env.example` chưa liệt kê — thiếu tài liệu cho một
   biến đã tồn tại. Hữu ích để không đẩy RPC có API key vào bundle browser.
5. **Chưa bắt đầu P7/P12.** Handoff yêu cầu làm sau khi P4 xong; P4 chưa xong (mục 5).

## 5. Câu hỏi mở / việc cần Owner

### ⛔ Chặn P4 (và cả P7/P12, vì dùng chung bring-up)

Cần Owner làm **bước 1–2** trong `docs/TESTNET_SEPOLIA.md`:

1. Tạo ví **chỉ dùng cho testnet**, xin ~0.05 ETH test qua faucet.
2. `cp packages/contracts-evm/.env.example .env` rồi điền `PRIVATE_KEY`,
   `SEPOLIA_RPC_URL` (nên có API key), `ETHERSCAN_API_KEY`.

Xong thì xác nhận bằng:

```bash
cd packages/contracts-evm && npx hardhat run scripts/preflight-sepolia.js --network sepolia
```

Thấy `SẴN SÀNG` là tôi chạy tiếp T0.4 → T1.6 và cập nhật checkpoint này với 4 địa chỉ
contract + link Etherscan cho từng giao dịch.

⚠️ **Đừng dán private key vào chat.** Chỉ điền vào `.env` (đã `.gitignore`). Nếu Owner muốn
tôi tự chạy deploy thì file `.env` trên máy là đủ — tôi đọc qua hardhat, không in ra.

### Câu hỏi 1 (P2): tôi có nên tự chạy deploy?

Deploy lên mạng công khai là hành động khó đảo (tốn ETH thật của testnet, sinh contract vĩnh
viễn trên chain). Hai cách hiểu:

- (a) Owner điền `.env` rồi tôi chạy `deploy.js` + verify + T1.2/T1.3.
- (b) Owner tự chạy bước 4–6, tôi chỉ kiểm chứng và điền checkpoint.

**Đề xuất: (a)** — nhanh hơn và tôi kiểm chứng được ngay, nhưng tôi sẽ hỏi lại trước khi bấm
deploy chứ không tự động.

### Câu hỏi 2 (P2): `docs/tech-report*.md` từ vòng trước vẫn treo

Ba việc tôi đã nêu lần trước và chưa được trả lời, vẫn còn nguyên:
WPT là "Wind **Power** Token" (như Owner nhắn) hay "Wind **Project** Token" (như doc ghi);
`tVND` → `VNDB` có làm không; và hai file cần chuyển vào `.kiro/steering/` mới có tác dụng.
Chúng không chặn P4 nhưng sẽ chặn P7/P12 (P7 chi trả bằng token tiền tệ — nếu đổi tên thì
nên đổi trước khi tôi viết UI/port cho nó).

### Chỗ chưa chắc

- **Nghiệm thu P4 chưa thể tuyên bố PASS.** Theo steering §8, một luồng chỉ PASS testnet khi
  có tx CONFIRMED tra được trên Etherscan. Tôi không tự nhận đã đạt khi chưa có bằng chứng đó.
- **`hardhat compile` báo `Nothing to compile`.** Artifact hiện có sinh từ lần compile trước
  và contract không đổi, nên đúng là không cần compile lại. Nếu Supervisor muốn bằng chứng
  compile sạch từ đầu thì `npx hardhat clean && npx hardhat compile`.

## 6. Tự đánh giá 3 LUẬT kiến trúc

- [x] **Mọi call chain qua `ILedgerPort`** — `grep -rn "from 'viem'" app/src | grep -v src/lib/` → rỗng.
      `receiptTimeoutFor` đặt trong `ledger.port.ts`, nghiệp vụ chỉ gọi hàm, không tự biết con số.
- [x] **Mọi ký qua `ISigner`** — `SERVER_SIGNER_PRIVATE_KEY` chỉ ở `lib/config/env.ts` (khai báo)
      và `lib/signer/server.signer.ts` (dùng). Preflight đọc `PRIVATE_KEY` qua hardhat và **chỉ in
      địa chỉ suy ra**, không in khóa.
- [x] **Mọi kiểm quyền qua RBAC** — `grep -rn "role ===\|role ==" app/src | grep -v src/lib/rbac/`
      → rỗng. Kiểm thực tế trên chain `evm`: 3 role bị 403 trước khi chạm chain.
- [x] **Contract Solidity không đổi** — `git diff c137110..HEAD -- '*.sol'` → rỗng.
- [x] **ABI/địa chỉ chỉ ở `packages/shared`** — không thêm bản copy nào; preflight đọc lại
      `packages/shared/src/addresses.json` chứ không tự giữ danh sách địa chỉ.
