# OP-04: các bước

> Trước khi bắt đầu: đọc `.kiro/steering/efficiency.md` (checkpoint dán nguyên văn đầu ra lệnh đã
> chạy), `checkpoint.md`, `docs/TESTNET_SEPOLIA.md`, `docs/DEPLOYMENT.md`.
> Nhánh `ops/04-sepolia` từ `dev` @ `dd015a1`. Commit đầu chuyển `OP-04` sang `inProgress`.
>
> Task có **hai người làm**: người viết mã chuẩn bị script, kiểm thử, tài liệu; **chủ dự án** chạy các
> bước cần khoá (cấp phí, triển khai, whitelist, đặt secret Cloudflare). Những bước của chủ dự án được
> đánh dấu **[Chủ dự án]**. Người viết mã không bao giờ nhận khoá riêng qua chat hay commit.

## Bước 0: Đo lại

Chạy các lệnh ở "Hiện trạng đã đo". Số đo khác spec thì dùng số đo thật, ghi vào checkpoint.

## Bước 1: Script cấp phí và preflight

Việc 1, 2. Viết kiểm thử ca 1 trước. Phần tính toán (ước lượng phí, quyết định có gửi không, danh sách
địa chỉ bị từ chối) tách thành hàm thuần để kiểm không cần mạng.

Commit: `feat(op-04): cấp phí Sepolia từ tài khoản tổng, preflight kiểm ví ký`

## Bước 2: Kiểm khói `--chain=evm` và tài liệu

Việc 10, 11, 12. Runbook mới phải đủ để chủ dự án tự làm Bước 3 mà không phải hỏi lại: mỗi lệnh có
biến cần đặt, đầu ra mong đợi, và cách xử lý khi thiếu phí.

Commit: `docs(op-04): runbook Sepolia theo luồng lập duyệt, kiểm khói chain evm`

## Bước 3: Triển khai Sepolia **[Chủ dự án]**

Theo runbook mới: preflight, cấp phí cho ví ký máy chủ bằng `fund-sepolia.js`, `deploy.js --network
sepolia`, commit `addresses.json` và ABI sinh ra vào nhánh, `verify-deployment.js`, tạo ví SPV thử và
whitelist nó. Gửi lại cho người viết mã: **đầu ra nguyên văn** của preflight, deploy, verify (không
kèm khoá), và địa chỉ ví SPV thử.

## Bước 4: Luồng lập duyệt trên Sepolia từ ứng dụng cục bộ

Việc 7. Người viết mã hoặc chủ dự án chạy (ai giữ `SERVER_SIGNER_PRIVATE_KEY_EVM` thì người đó chạy).
Ghi ba mã giao dịch và đường dẫn Etherscan.

## Bước 5: Bản deploy **[Chủ dự án đặt secret]**

Việc 8, 9. Sau khi merge và Workers Builds dựng xong, chạy kiểm khói `--chain=evm`, rồi thử luồng
lập duyệt trên bản deploy. Ghi kết quả, kể cả khi hỏng vì isolate.

Lưu ý thứ tự: bước này cần nhánh đã merge để Workers Builds dựng từ `dev`. Nên **checkpoint ghi kết
quả Bước 5 ở một commit bổ sung sau merge**, hoặc chủ dự án nghiệm thu Bước 5 riêng. Điều kiện số 6
được đánh 🔶 trong checkpoint lúc mở PR, và chuyển ✅ sau khi chạy.

## Bước 6: Bàn giao

```bash
bash scripts/run-local-all.sh
git log -p origin/dev..HEAD | grep -nE "PRIVATE_KEY=0x[0-9a-fA-F]{64}|infura.io/v3/[0-9a-f]{20,}|alchemy.com/v2/[A-Za-z0-9_-]{20,}" || echo "không có bí mật"
```

Lệnh thứ hai là bằng chứng cho điều kiện "không có bí mật trong lịch sử commit". Khoá công khai của
tài khoản mẫu Hardhat (`0xac09...ff80`) là ngoại lệ đã có sẵn trong repo; nếu lệnh bắt trúng nó thì
ghi rõ trong checkpoint.

Viết `docs/CHECKPOINT_OP04.md`, mục 0 đối chiếu đủ **9** điều kiện. Chuyển `OP-04` sang `done` sau khi
điều kiện 6 đã chạy.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP04.md docs/op-04-sepolia/requirements.md
```
