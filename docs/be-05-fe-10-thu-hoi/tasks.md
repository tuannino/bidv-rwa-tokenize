# BE-05 và FE-10: các bước

Nhánh: `feat/be-05-fe-10-thu-hoi` từ `dev` @ `c35fa17`. Một PR, hai commit (BE trước, FE sau). Không push lên `dev`.

1. Đo nền: số server action và số dòng sổ kiểm toán khi mở `/portfolio`, `/trade`, tổng quan Người bán; chạy ca 3 và 5 với mã cũ, ghi ca nào đỏ (ca 5 phải đỏ: hiện `placeOrder` và duyệt Mint không chặn).
2. BE-05:
   1. Dữ liệu: `ADDED_COLUMNS`, `schema.prisma`, `npm run db:sql`, `UNIQUE_CONSTRAINTS`; trạng thái và bảng cột ở cổng; bản bộ nhớ và Postgres của các hàm mới (design mục 2); loại khoá `RECALL` (design mục 4).
   2. Quyền và các test quyền liệt kê ở design mục 8.
   3. Cổng và adapter: `setSettlementMode`, `isSettlementMode` (EVM qua `pause`, `unpause`, `paused`), `isTransactionKnown`; mock theo design mục 9; đổi lý do marker của `setNavRate`, `navRate`. Tách `submitTxn` khỏi `trackTxn`.
   4. `recall-phase.ts`, `recall.service.ts` (mở, sửa mốc, huỷ, đóng băng, mở đóng băng, thu hồi lô, tổng quan), cờ `ENABLE_DEMO_RECALL`; chặn ở `placeOrder`, `evaluate` (Mint), mở kỳ chia và duyệt chia; đổi `trade.service`, `seller.service`, `portfolio.service` sang `readRecallPhase`.
   5. Actions trong `app/actions/`.
3. FE-10: màn `/recall`, nav, hộp thông báo `/portfolio`, nhãn lịch sử giao dịch, dòng trạng thái ở `/trade` và tổng quan Người bán.
4. Tài liệu:
   - UserGuide: luồng thu hồi (vai, bước, mốc), cách trình diễn bằng cờ `ENABLE_DEMO_RECALL`, cảnh báo không đảo ngược sau lần đốt đầu tiên trên Sepolia, cập nhật dòng "Tất toán" ở bảng chức năng (PoC: thu hồi không trả tiền; bản đầy đủ: nợ kỹ thuật SC-04), mục giới hạn mới nếu có.
   - tech-report: QĐ-R1 tới QĐ-R14, mục SAI KHÁC về một người làm cả mở đợt lẫn thu hồi; nợ kỹ thuật (trả tiền trên chuỗi, mở đóng băng sau khi đã đốt, đốt vault, bản đầy đủ).
   - runbook (`docs/DEPLOYMENT.md`): diễn tập thu hồi trên `hardhat-local`; trên Sepolia chỉ chạy khi Sếp quyết.
   - checkpoint `docs/CHECKPOINT_BE05_FE10.md`; `task-status.json`: BE-05, FE-10 vào `done`; gỡ marker `@pending BE-05` ở `lib/store/index.ts`.
5. Kiểm chứng:

```bash
(cd app && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://... npx vitest --run test/<tệp kho thu hồi>.test.ts)   # nếu có Postgres cục bộ; không có thì ghi rõ trong checkpoint
for f in test/be-05-recall-evm.test.ts test/evm-order-settlement.test.ts test/sc-06-distribution-evm.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
bash scripts/run-local-all.sh build e2e
```

6. Mười lăm đột biến ở `requirements.md` mục 8; ghi ca đỏ của từng đột biến vào checkpoint.
7. Đo lại như bước 1, cộng số action khi mở `/recall` (phải bằng 1).

Commit mã BE: `feat(be-05): đợt thu hồi token khi hết hạn dự án; chặn đặt lệnh ở máy chủ; đóng băng, mở đóng băng token dự án và đốt theo lô`
Commit mã FE: `feat(fe-10): màn Thu hồi token, thông báo thu hồi cho Nhà đầu tư, trạng thái giao dịch theo đợt thu hồi`
Commit tài liệu: `docs(be-05, fe-10): bàn giao kiểm chứng, UserGuide, tech-report, runbook diễn tập thu hồi`
