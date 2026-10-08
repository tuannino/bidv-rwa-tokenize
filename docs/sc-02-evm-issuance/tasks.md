# SC-02: các bước

> Trước khi bắt đầu: đọc `.kiro/steering/efficiency.md`, `tech.md`, `checkpoint.md`, và `design.md`
> cùng thư mục. Nhánh `feat/sc-02-evm-issuance` từ `dev` @ `e4dd889`. Commit đầu chuyển **chỉ**
> `SC-02` sang `inProgress` (các mã mới của kế hoạch bản 3 do OP-03 thêm).
>
> OP-03 chạy song song. Ranh giới: task này **không** sửa `run-local-all.sh`, CI, cấu hình
> Playwright, và không sửa phần ghi `addresses.json` trong `deploy.js`. Cả hai cùng sửa
> `task-status.json`; ai merge sau thì rebase.

## Bước 0: Đo lại

Chạy lại các lệnh ở "Hiện trạng đã đo", cộng `bash scripts/run-local-all.sh contracts` để ghi số ca
hợp đồng trước khi sửa (07/10 đo được 67). Số đo khác spec thì dùng số đo thật.

## Bước 1: Hợp đồng

Việc 1 tới 4. Viết ca 1 tới 4 **trước** khi sửa `ProjectToken`. Ở bước này các bộ kiểm thử cũ sẽ đỏ
vì dữ liệu dựng; đó là việc của bước 2, chưa sửa ở đây.

Commit: `feat(sc-02): khoá phát hành WPT theo ví SPV`

## Bước 2: Kiểm thử hợp đồng cũ

Việc 5 tới 8. Làm helper trước, rồi bốn tệp dựng dữ liệu, cuối cùng viết lại bộ P4 kèm bảng đối
chiếu ca cũ sang ca mới. Sau bước này `run-local-all.sh contracts` phải xanh, tổng số ca không giảm.

Chạy hai phép đột biến ngay sau bước này, dán kết quả thật vào checkpoint.

Commit: `test(sc-02): dựng số dư qua ví SPV, viết lại bộ P4 theo luật mới`

## Bước 3: Triển khai, ABI, script

Việc 9, 10, 11. Triển khai lại trên nút hardhat mới, kiểm địa chỉ không đổi, vai, ba phép đọc. Thử
script kiểm triển khai với bộ hợp đồng cũ (triển khai từ `dev` gốc lên một nút khác) để thấy nó báo
lỗi rõ (ca 11).

Commit: `chore(sc-02): đồng bộ triển khai, ABI và script trình diễn`

## Bước 4: Adapter

Việc 12, 13, 14. Gỡ đúng ba marker SC-02, không đụng marker SC-03, SC-04, SC-05. Máy kiểm phải ra 18
điểm cắm, 10 điểm chặn. Nếu OP-03 chưa merge thì tự dựng nút bằng `npx hardhat node` và `deploy.js`
như ở "Mức kiểm chứng"; kiểm thử adapter tự whitelist ví nó dùng nên không cần dữ liệu mẫu của OP-03.

Commit: `feat(sc-02): nối phát hành EVM vào ILedgerPort`

## Bước 5: Đường dữ liệu thử và đầu cuối

Việc 15, 16. Bước này cần khung hardhat của OP-03 (`scripts/evm-local.sh`, project `hardhat`, ví mẫu
đã whitelist). Nếu OP-03 chưa merge: rebase lên `dev` sau khi OP-03 merge rồi mới làm. **Không tự
dựng khung riêng.**

Commit: `test(sc-02): lập duyệt Mint/Burn đầu cuối trên hardhat`

## Bước 6: Bàn giao

```bash
bash scripts/run-local-all.sh
bash scripts/run-local-all.sh evm
cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest run test/evm-issuance.test.ts
```

Viết `docs/CHECKPOINT_SC02.md`. Mục 0 đối chiếu đủ **10** điều kiện hoàn thành, kèm mã giao dịch và
biên nhận hardhat của ca 6, 7, 8, bảng đối chiếu bộ P4, và mục DEVIATION (việc 17). Ghi rõ SC-03 vẫn
bị chặn, mua bán trên chuỗi chưa chạy. Chuyển `SC-02` sang `done`, cập nhật `docs/tech-report.md`.
Thêm vào `docs/TESTNET_SEPOLIA.md` một dòng: bộ hợp đồng Sepolia hiện tại là bản trước SC-02, phải
triển khai lại ở OP-04.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_SC02.md docs/sc-02-evm-issuance/requirements.md
```
