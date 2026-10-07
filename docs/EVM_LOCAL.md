# Chạy ứng dụng trên chuỗi hardhat cục bộ

Dựng nút hardhat, triển khai bộ hợp đồng, nạp dữ liệu mẫu và chạy kiểm thử đầu cuối trên đó bằng
vài lệnh lặp lại được (OP-03). Mọi lệnh chạy từ **gốc repo**.

Trên `hardhat-local` hiện chạy được: kết nối ví, KYC và whitelist, số dư, phát hành trực tiếp ở
màn `/mint` (cờ trình diễn). Lập duyệt Mint/Burn, mua bán, chia lợi nhuận còn chặn ở SC-02, SC-03,
SC-05 (`grep -n "@blocked" app/src/lib/ledger/evm.adapter.ts`).

## 1. Cài một lần

Node 22 (như CI), npm, `curl`.

```bash
git clone <repository-url>
cd bidv-rwa-tokenize
(cd packages/contracts-evm && npm ci)
(cd app && npm ci)
```

## 2. Dựng chuỗi

```bash
bash scripts/evm-local.sh up
```

`up` dựng nút ở `http://127.0.0.1:8545` nếu chưa chạy, triển khai nếu nút còn trống, rồi whitelist
hai ví khách hàng mẫu `NDT001` và `NB001` (địa chỉ lấy từ `packages/shared/src/sample-wallets.json`).
Chạy lại `up` không triển khai lại và không gửi giao dịch thừa. Cuối lệnh in các biến app cần.

`up` **không bao giờ triển khai đè**. Nó dừng và bảo chạy `reset` khi:

- bytecode ở địa chỉ trong `addresses.json` lệch bản biên dịch hiện tại (vừa sửa hợp đồng);
- nút đã có giao dịch mà chưa có hợp đồng (triển khai lên đó sẽ ra địa chỉ khác địa chỉ đã commit).

```bash
bash scripts/evm-local.sh reset   # dừng nút, dựng nút mới, triển khai, nạp ví mẫu
bash scripts/evm-local.sh down    # dừng nút
```

Nhật ký nút: `$TMPDIR/bidv-evm-local-8545/node.log`, không nằm trong cây làm việc. Dựng hay
`reset` bao nhiêu lần thì `git status` vẫn sạch: `deploy.js` chỉ ghi `addresses.json` khi địa
chỉ đổi.

Cổng 8545 đã có nút khác (ví dụ một worktree khác) thì đặt cổng riêng cho cả phiên:
`export EVM_LOCAL_PORT=8645`, và đặt `RPC_HARDHAT` của app theo cổng đó.

## 3. Chạy app trên chuỗi này

Đặt vào `app/.env.local` (tạo từ `.env.example` nếu chưa có) đúng các biến `up` in ra:

```dotenv
NEXT_PUBLIC_DEFAULT_CHAIN=hardhat-local
RPC_HARDHAT=http://127.0.0.1:8545
SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Khoá trên là khoá **công khai** của Hardhat account #0, chỉ dùng cho chuỗi cục bộ.

```bash
cd app && npm run dev
```

> ⚠️ **Sau `reset` phải khởi động lại app.** Với `USE_MOCK_DB=true`, dữ liệu nghiệp vụ nằm trong bộ
> nhớ tiến trình app. Chuỗi mới mà app cũ thì hai bên lệch nhau, ví dụ bảng dự án đã ghi mốc phát
> hành nhưng chuỗi chưa phát hành gì.

## 4. Kiểm thử đầu cuối

Cả hai bộ chạy trên **bản build** (`next start`), không phải `next dev`.

```bash
# Bộ `mock`: toàn bộ ca, KHÔNG được có nút hardhat đang chạy (chain-selector.spec.ts kiểm trang
# báo lỗi khi không có nút). Dừng nút trước: bash scripts/evm-local.sh down
bash scripts/run-local-all.sh build e2e

# Bộ `hardhat`: dựng bản build riêng ở app/.next-hardhat, reset chuỗi, chạy project `hardhat`,
# rồi dừng app và nút, kể cả khi có ca đỏ.
bash scripts/run-local-all.sh evm
```

Chạy tay project `hardhat` khi đã có nút và bản build `.next-hardhat`:

```bash
bash scripts/evm-local.sh reset
cd app && E2E_CHAIN=hardhat-local npx playwright test
```

Gỡ lỗi bằng `next dev` thay vì bản build: thêm `E2E_DEV=1` vào lệnh Playwright.

## 5. Dọn

```bash
bash scripts/evm-local.sh down
```

Bản build `app/.next-hardhat` nằm trong `.gitignore`; xoá tay nếu cần chỗ.
