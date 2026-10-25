# FE-10: các bước

Nhánh: `feat/fe-10-man-thu-hoi` từ `dev` @ `4767e01`. Một PR. Không push lên `dev`.

1. Đo nền trên `4767e01`: số server action khi mở `/portfolio`, `/trade`, tổng quan Người bán (cách đo ở requirements mục 6), ghi vào checkpoint.
2. Máy chủ (design mục 1): `minNoticeDaysFor`, `isRecallLockStale`, `freezeBlockers` dùng chung cho `freezeToken` và tổng quan, bốn trường mới, `preview` khi đợt đã huỷ; `getTradeContext` trả `tradeBlock`.
3. Hàm thuần (design mục 2): `components/recall/gates.ts`, `lib/txn-labels.ts`, `formatVnDate`; `confirmBlockReason` nhận `tradeBlocked`. Vitest ca 1 tới 14.
4. Màn `/recall`, trang, menu, biểu tượng; sửa `test/four-roles-shell.test.ts`.
5. `AssetSummary`, `transaction-history-box.tsx`, `mint.tsx`, `investor-trade.tsx`, `seller-overview.tsx`.
6. `e2e/recall.spec.ts` (ca 16, 17).
7. Dọn ký tự cấm (R20), sinh lại khối marker của tech-report.
8. Tài liệu (design mục 6).
9. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
bash scripts/evm-local.sh reset
(cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/be-05-recall-evm.test.ts)
bash scripts/evm-local.sh down
( set -e; BAK="$(mktemp -d)"; mv packages/contracts-evm/artifacts "$BAK/artifacts"
  trap 'mv "$BAK/artifacts" packages/contracts-evm/artifacts && rmdir "$BAK"' EXIT
  bash scripts/run-local-all.sh arch markers checkpoint app )
bash scripts/run-local-all.sh build e2e
git diff 4767e01 HEAD | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"   # chỉ còn dòng do script sinh
```

10. Mười hai đột biến ở `requirements.md` mục 8; ghi ca đỏ của từng đột biến vào checkpoint.
11. Ca 15 trên `hardhat-local`, ảnh vào `docs/images/fe-10/`.
12. Đo lại như bước 1, cộng số action khi mở `/recall` với hai vai (phải bằng 1).

Commit mã: `feat(fe-10): màn Thu hồi token, thông báo thu hồi cho Nhà đầu tư, trạng thái giao dịch theo pha thu hồi`
Commit tài liệu: `docs(fe-10): bàn giao kiểm chứng, UserGuide; dọn ký tự cấm từ BE-05`
