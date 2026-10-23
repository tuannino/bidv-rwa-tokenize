# FE-07: các bước

1. Đo nền trên `dev` @ `f11f1ae`: số action khi mở `/portfolio`, `/seller`, `/seller/withdraw`, `/tokens/WPT`, `/trade`; chạy các ca FE-07 với mã cũ, ghi ca nào đỏ.
2. `config.service`: chờ biên nhận, chặn lệnh đang xử lý, lý do bắt buộc, mã giao dịch trong lịch sử.
3. `readEffectiveIssuePrice` và đổi bốn chỗ đọc giá ở màn khách hàng.
4. Action tổng quan, màn `/config`, mục menu.
5. Tài liệu: UserGuide, tech-report (gồm khối Fireblocks ở `design.md` mục 5), checkpoint, `task-status.json` (FE-07 và BE-18 vào `done`), gỡ marker `@pending FE-07`.
6. Kiểm chứng:

```bash
(cd app && npx vitest --run test/config-service.test.ts test/fe-07-price-config.test.ts test/issue-price-single-source.test.ts)
for f in test/evm-order-settlement.test.ts test/evm-issuance.test.ts; do
  bash scripts/evm-local.sh reset
  (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run "$f")
done
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
bash scripts/run-local-all.sh build e2e
```

7. Đột biến (mỗi đột biến làm ít nhất một ca đỏ, ghi vào checkpoint):
   - ghi database trước khi chờ biên nhận (ca 1 hoặc 2 đỏ);
   - bỏ kiểm lệnh đang xử lý (ca 4 đỏ);
   - `getSellerOverview` đọc lại `readIssuePriceVnd` (ca 8 đỏ);
   - action tổng quan dùng `authorize` (ca 7 đỏ).
8. Đo hiệu năng sau khi làm, so với bước 1.

Commit mã: `feat(fe-07): màn giá phát hành và nguồn cung; đổi giá chờ xác nhận chuỗi; một nguồn giá cho màn khách hàng`
Commit tài liệu: `docs(fe-07): bàn giao kiểm chứng, UserGuide, ghi chú Fireblocks vào tech-report`
