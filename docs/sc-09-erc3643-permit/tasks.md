# SC-09: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/sc-09-erc3643-permit/requirements.md`,
> `docs/ds-01-kien-truc-hop-dong/design.md` (bản 2, mục 7),
> `packages/contracts-evm/contracts/tokens/ProjectToken.sol`, `VNDToken.sol`,
> `packages/contracts-evm/node_modules/@tokenysolutions/t-rex/contracts/token/IToken.sol`,
> `.../compliance/modular/IModularCompliance.sol`, `app/src/lib/ledger/evm.adapter.ts`.
> Nhánh `feat/sc-09-erc3643-permit` từ `dev` @ `945c833`. Commit đầu thêm `SC-09` vào
> `.kiro/task-status.json` ở `inProgress`.
> CH-1, CH-2 đã chốt 15/10 (mục cuối requirements).

## Bước 0: Đo lại

Chạy các lệnh ở "Hiện trạng đã đo", dán đầu ra. Chạy bộ kiểm thử hợp đồng và `run-local-all.sh`, ghi
số ca trước khi sửa.

## Bước 1: Giao diện cục bộ và kiểm thử khớp chữ ký (viết trước)

Chép chữ ký hàm, sự kiện cần làm từ T-REX v4.1.6 vào `IERC3643Token`, `IERC3643Compliance`,
`IERC3643Module`, ghi nguồn. Viết ca 1 trước cho đỏ.

## Bước 2: `IdentityRegistry`, `ModularCompliance`, module

Viết ca 2, 3, 8, 9, 10 trước, rồi hiện thực.

Commit: `feat(sc-09): sổ danh tính và bộ luật giao dịch theo ERC-3643`

## Bước 3: `ProjectToken` theo ERC-3643

Hiện thực QĐ-2, QĐ-3. Sửa 9 tệp script và kiểm thử dùng hàm cũ. Chạy toàn bộ kiểm thử hợp đồng; ca cũ
phải xanh mà không nới điều kiện. Nếu một ca cũ buộc phải đổi ý nghĩa (không chỉ đổi tên hàm), dừng
lại hỏi Supervisor.

Commit: `feat(sc-09): WPT theo kiến trúc ERC-3643, giữ snapshot và luật SC-02`

## Bước 4: `permit` cho VNDB và WPT

Ca 11, tiện ích dữ liệu ký trong `packages/shared`.

Commit: `feat(sc-09): permit ERC-2612 cho VNDB và WPT`

## Bước 5: Đột biến

Chạy đột biến 12a đến 12e, dán đầu ra đỏ, hoàn nguyên, dán `git status` sạch.

## Bước 6: Triển khai cục bộ, ABI, adapter

`deploy.js`, `addresses.json` (kiểm địa chỉ bốn hợp đồng cũ trên hardhat-local **không đổi**, dán so
sánh), ABI dùng chung, `evm.adapter`, hằng số quốc gia. Ca 13, 14.

```bash
bash scripts/evm-local.sh reset
cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/evm-issuance.test.ts && cd ..
grep -rn "setWhitelisted\|batchSetWhitelisted\|setFrozen\|setPaused\|agentBurn\|\"isWhitelisted\"" \
  packages/contracts-evm/scripts packages/contracts-evm/test app/src app/scripts || echo "không còn hàm cũ"
```

Commit: `feat(sc-09): nối adapter EVM với sổ danh tính và bộ luật`

## Bước 7: Tài liệu, bàn giao

Cập nhật `DEPLOYMENT.md` (runbook Sepolia, `evm-local.sh reset`), `tech-report.md`, README hợp đồng.
Rồi:

```bash
bash scripts/run-local-all.sh
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

Chạy E2E hardhat (ca 15). Viết `docs/CHECKPOINT_SC09.md`, mục 0 đối chiếu đủ **11** điều kiện; điều
kiện của chủ dự án đánh 🔶 lúc mở PR.

## Bước 8: Sau merge **[Chủ dự án]**

Triển khai lại Sepolia theo runbook mới (cấp phí bằng `fund-sepolia.js`, kiểm bằng
`preflight-sepolia.js`, xác nhận bằng `dod-verify-sepolia.js`). Cập nhật địa chỉ `evm` trong
`addresses.json` bằng commit bổ sung. Thử Mint lập duyệt trên `evm`, ghi mã giao dịch. Đạt thì
chuyển 🔶 thành ✅.
