# OP-04: Triển khai lại Sepolia bằng bytecode SC-02, mở chain Sepolia trên bản deploy

| | |
|---|---|
| Nhánh | `ops/04-sepolia`, từ `dev` @ `dd015a1` (sau SC-02, PR #42) |
| Điểm | 3 |
| Mức kiểm chứng | **Vừa** (công cụ và cấu hình; có ký giao dịch thật trên testnet) |
| Thứ tự | Đóng đợt 5. Chạy song song được với IN-03 |
| Người làm | Codex hoặc Claude Code chuẩn bị; **chủ dự án chạy** các bước cần khoá và cấu hình Cloudflare |

## Mục tiêu

Lập duyệt Mint/Burn chạy được trên **Sepolia**, qua cả ứng dụng chạy cục bộ lẫn bản deploy trên
Cloudflare. Bộ hợp đồng Sepolia hiện là bản trước SC-02 nên phải triển khai lại.

## Quyết định của chủ dự án áp dụng (DS-01, CH-3, 08/10)

Chủ dự án có **một tài khoản tổng** giữ sẵn SepoliaETH. Mỗi khi một tài khoản cần thử phát sinh phí,
dùng tài khoản tổng chuyển **vừa đủ** phí cho giao dịch đó vào tài khoản đang thử, rồi chạy luồng như
bình thường. Task này dựng công cụ cho quy tắc đó.

## Hiện trạng đã đo

```bash
python3 -c "import json;print(json.load(open('packages/shared/src/addresses.json'))['chains']['evm'])"
# deployedAt 2026-09-10, deployer 0xCa49...9076: ban TRUOC SC-02
curl -s -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x3Fe22dcfFCFB4459a417113ED6deb5C3A23B14be","data":"0xfc2ab6f2"},"latest"]}' \
  https://ethereum-sepolia-rpc.publicnode.com
# {"error":{"code":3,"message":"execution reverted"}}: ham initialSupplyMinted() khong ton tai
grep -n "rpcEvm" app/src/lib/config/flags.ts        # chain evm chi chon duoc khi co RPC_EVM
grep -n "ensureApplicationSignerRole" packages/contracts-evm/scripts/deploy.js   # chi cap vai cho nguoi trien khai
grep -n "demo-mint.mjs --chain evm\|/mint" docs/TESTNET_SEPOLIA.md            # Buoc 7 cu: duong /mint, nay da bi chan tren EVM
grep -n "NEXT_PUBLIC_\|Secret" docs/DEPLOYMENT.md | head                       # bang bien Cloudflare
```

- `docs/TESTNET_SEPOLIA.md` Bước 7 còn hướng dẫn mint qua `/mint` và `demo-mint.mjs`. Sau SC-02,
  hai đường đó **từ chối trên chain EVM**. Runbook phải viết lại theo luồng lập duyệt.
- Bộ chọn chain khoá Sepolia khi thiếu `RPC_EVM` lúc chạy (`flags.ts`).
- Hai ví mẫu `NDT001`, `NB001` là **tài khoản mẫu công khai của Hardhat** (ai cũng có khoá). Trên
  testnet công khai, mọi SepoliaETH gửi vào hai địa chỉ này sẽ bị bot rút ngay.
- Bản deploy giữ dữ liệu nghiệp vụ trong bộ nhớ của **từng isolate** Cloudflare (`USE_MOCK_DB=true`).
  Đã đo trước đây: hai trình duyệt cùng xem một ví thấy hai trạng thái khác nhau. Luồng lập duyệt cần
  yêu cầu do Giao dịch viên lập còn đó khi Kiểm soát viên duyệt, nên có thể hỏng giữa hai isolate.

## Việc cần làm

**Công cụ cấp phí theo CH-3**

1. Script `packages/contracts-evm/scripts/fund-sepolia.js`, chạy bằng `node` và nhận tham số dòng
   lệnh (không qua `hardhat run`, vốn không nhận tham số): chuyển SepoliaETH từ tài khoản tổng
   (`FUNDER_PRIVATE_KEY`) sang một địa chỉ đích.
   - Tham số: địa chỉ đích, và một trong hai: số ETH cố định, hoặc `--for <tên thao tác>` để tự ước
     lượng phí (ước lượng gas nhân giá gas hiện tại nhân hệ số dự phòng, ghi rõ hệ số trong mã).
   - Chỉ nạp **phần thiếu**: số dư đích đã đủ thì không gửi.
   - **Từ chối** nếu chainId khác 11155111, và từ chối nạp vào bất kỳ địa chỉ nào trong danh sách tài
     khoản mẫu công khai của Hardhat (đọc từ `packages/shared/src/sample-wallets.json` cộng tài khoản
     mẫu số 0).
   - Có chế độ `--dry-run` in ra sẽ gửi bao nhiêu mà không gửi.
2. `preflight-sepolia.js` kiểm thêm: số dư của ví ký máy chủ (`SERVER_SIGNER_PRIVATE_KEY_EVM`) đủ
   cho triển khai và cho một vòng Mint, Mint, Burn; thiếu thì in đúng lệnh `fund-sepolia.js` cần chạy.

**Triển khai** (chủ dự án chạy, người làm chuẩn bị lệnh và kiểm)

3. Ví triển khai là **ví ký máy chủ của chain `evm`**, để `deploy.js` cấp vai `MINTER_ROLE`,
   `AGENT_ROLE` đúng cho ví ứng dụng dùng. Không đổi `deploy.js`.
4. Chủ dự án chạy `deploy.js --network sepolia` trên nhánh `ops/04-sepolia`, rồi commit
   `addresses.json` (khoá `evm`) và ABI sinh ra vào chính nhánh đó. Địa chỉ đi vào ứng dụng bằng
   **tệp đã commit** (cách B của runbook), không bằng biến `NEXT_PUBLIC_ADDR_EVM_*`, để một nguồn duy
   nhất.
5. Chạy `verify-deployment.js --network sepolia`: phải đọc được `initialSupplyMinted = false`,
   `spvWallet = 0x0`, ví ký có hai vai. Verify mã nguồn trên Etherscan là tuỳ chọn.
6. Whitelist ví SPV trên Sepolia. **Không dùng `NB001`** (khoá công khai). Chủ dự án tạo một địa chỉ
   SPV thử riêng cho Sepolia; ghi địa chỉ vào runbook. Ví SPV không cần ETH vì không tự gửi giao dịch.

**Ứng dụng chạy với Sepolia**

7. Chạy ứng dụng cục bộ với chain `evm` (bản build, `RPC_EVM` có API key,
   `SERVER_SIGNER_PRIVATE_KEY_EVM`), đi trọn: Giao dịch viên lập Mint lần đầu vào ví SPV thử, Kiểm soát
   viên duyệt; Mint lần hai; lập duyệt Burn phần chưa phân phối. Ghi mã giao dịch và đường dẫn
   Etherscan của ba giao dịch.
8. Cấu hình Cloudflare (chủ dự án làm theo bảng trong runbook): `RPC_EVM` và
   `SERVER_SIGNER_PRIVATE_KEY_EVM` là **Secret**; `NEXT_PUBLIC_RPC_EVM` là Build variable nếu muốn
   ví trình duyệt dùng cùng RPC. Triển khai lại.
9. Trên bản deploy: kiểm khói, chọn được chain Sepolia, và thử lại luồng ở việc 7. Nếu luồng lập
   duyệt **hỏng vì isolate** (yêu cầu vừa lập không thấy khi duyệt), **không sửa trong task này**: ghi
   lại hiện tượng, số lần thử, và đề xuất trong checkpoint. Bằng chứng chính của task là việc 7.
10. Mở rộng `scripts/smoke-test.mjs`: tham số `--chain=evm` kiểm một đường **chỉ đọc** đi qua adapter
    EVM (ví dụ trạng thái phát hành), để biết bản deploy đọc được Sepolia mà không gửi giao dịch nào.

**Tài liệu**

11. Viết lại `docs/TESTNET_SEPOLIA.md`: bỏ Bước 7 cũ; thêm bước cấp phí bằng `fund-sepolia.js`,
    bước tạo ví SPV thử, luồng lập duyệt trên Sepolia, bảng biến Cloudflare, và một dòng cảnh báo
    "không gửi SepoliaETH vào tài khoản mẫu của Hardhat".
12. Cập nhật bảng biến ở `docs/DEPLOYMENT.md` cho `RPC_EVM`, `SERVER_SIGNER_PRIVATE_KEY_EVM`,
    `NEXT_PUBLIC_RPC_EVM`.

## Ràng buộc

- Không đổi hợp đồng, adapter, nghiệp vụ.
- **Không commit khoá riêng, RPC có API key hay địa chỉ email nào.** `FUNDER_PRIVATE_KEY`,
  `PRIVATE_KEY`, `SERVER_SIGNER_PRIVATE_KEY_EVM` chỉ nằm trong `.env` đã bị bỏ qua và trong secret
  Cloudflare.
- Không gửi ETH vào địa chỉ của tài khoản mẫu Hardhat trên Sepolia.
- Dùng `viem` hoặc ethers trong `packages/contracts-evm` như các script hiện có; không đưa thư viện
  chuỗi mới vào `app/`.

## Tác động

| | Tệp |
|---|---|
| Sửa | `packages/contracts-evm/scripts/preflight-sepolia.js`, `packages/shared/src/addresses.json` (khoá `evm`), `packages/shared/generated/*`, `scripts/smoke-test.mjs`, `docs/TESTNET_SEPOLIA.md`, `docs/DEPLOYMENT.md`, `packages/contracts-evm/.env.example` (thêm `FUNDER_PRIVATE_KEY` để trống) |
| Mới | `packages/contracts-evm/scripts/fund-sepolia.js`, kiểm thử cho phần tính toán và phần từ chối của script cấp phí |
| Bị ảnh hưởng | Bản deploy Cloudflare (thêm chain Sepolia) |

## Mức kiểm chứng: Vừa

```bash
cd packages/contracts-evm && npx hardhat run scripts/preflight-sepolia.js --network sepolia
node scripts/fund-sepolia.js <địa chỉ> --for mint --dry-run
npx hardhat run scripts/verify-deployment.js --network sepolia
node scripts/smoke-test.mjs <url> --expect-commit=<sha> --chain=evm
bash scripts/run-local-all.sh
```

| Ca | Kiểm |
|---|---|
| 1 | `fund-sepolia.js` từ chối chainId khác Sepolia, từ chối địa chỉ tài khoản mẫu Hardhat, không gửi khi số dư đã đủ, `--dry-run` không gửi. Kiểm bằng kiểm thử đơn vị, không cần mạng |
| 2 | Preflight báo đủ hoặc in đúng lệnh cấp phí khi thiếu |
| 3 | `verify-deployment.js` trên Sepolia ra trạng thái đầu như việc 5 |
| 4 | Ba giao dịch Mint, Mint, Burn trên Sepolia từ ứng dụng cục bộ, có đường dẫn Etherscan, trạng thái thành công |
| 5 | Bản deploy: kiểm khói `--chain=evm` xanh; kết quả thử luồng lập duyệt ghi lại, kể cả khi hỏng vì isolate |

## Điều kiện hoàn thành

- [ ] `fund-sepolia.js` có, đúng ca 1, có kiểm thử.
- [ ] Preflight kiểm số dư ví ký và in lệnh cấp phí.
- [ ] Bộ hợp đồng Sepolia triển khai lại, `addresses.json` khoá `evm` đã commit, verify ra trạng thái đầu đúng.
- [ ] Ví SPV thử riêng cho Sepolia, không dùng tài khoản mẫu Hardhat.
- [ ] Ba giao dịch Mint, Mint, Burn trên Sepolia có bằng chứng Etherscan.
- [ ] Bản deploy chọn được Sepolia, kiểm khói `--chain=evm` xanh, kết quả thử lập duyệt trên bản deploy được ghi lại.
- [ ] `TESTNET_SEPOLIA.md` và `DEPLOYMENT.md` viết lại đúng hiện trạng.
- [ ] Không có bí mật nào trong lịch sử commit của nhánh.
- [ ] `run-local-all.sh` xanh.

## Không làm

- Không sửa việc dữ liệu bộ nhớ tách theo isolate (cần Postgres dùng chung, là task riêng nếu chủ dự
  án muốn).
- Không làm mua bán trên Sepolia (SC-03).
- Không tích hợp Fireblocks (IN-03, IN-04).
