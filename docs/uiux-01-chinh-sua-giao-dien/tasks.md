# UIUX-01: các bước

Nhánh: `uiux/uiux-01-giao-dien` từ `dev` @ `2541c8a`. Một PR. Không push lên `dev`.

1. Đo nền trên `2541c8a` số action khi mở các màn ở requirements mục 5, ghi vào checkpoint.
2. Dùng chung: `digitsOnly` (`lib/format.ts`), `AmountInput`, `lib/role-labels.ts`.
3. Mint, Burn (A, B): `draft.tsx`, `mint.tsx`, câu trong `evaluate`, `request-table.tsx`, store `listRequests({ decided })` hai bản, `getApprovalStats().history`, thẻ Lịch sử ở `approvals.tsx`.
4. Vault (C, D): `vault-config.ts`, `saveVaultConfig`, `getVaultOverview`, `vault-status.tsx`.
5. Tài khoản (F): `profile-wallet.tsx`, `account-info.tsx`, trang `/account`.
6. Người bán (E): nhãn ở `seller-overview.tsx`, `AmountInput` ở `seller-withdraw.tsx`.
7. Chữ (G): bốn tệp mã, UserGuide.
8. Test: `test/uiux-01.test.ts` ca 1 tới 5; sửa test và E2E có sẵn bị vỡ (requirements mục 6). Với `e2e/vault-withdraw.spec.ts`: Kiểm soát viên chọn "Khoá số cố định", nhập 1, điền ví nhận như cũ, lưu; giữ khẳng định chế độ "Khoá số tiền cố định" ở khối trạng thái và bảng lịch sử; dòng 47 (thấy ví nhận trên `/vault`) đổi sang kiểm giá trị ô "Ví nhận tiền rút" của biểu mẫu. Phần rút của Người bán giữ nguyên. Chạy cả hai project `mock` và `hardhat`.
9. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
bash scripts/run-local-all.sh build e2e
# chữ "trình diễn" còn trong chuỗi giao diện: chỉ được ra dòng chú thích (//, *, /**)
grep -rn "trình diễn" app/src --include=*.ts --include=*.tsx | grep -vE "^[^:]+:[0-9]+:\s*(//|\*|/\*|\{/\*)"
# ký tự cấm trong dòng thêm mới: chỉ được ra dòng do script sinh
git diff 2541c8a HEAD | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
```

10. Đo lại như bước 1; chụp ảnh theo "Điều kiện hoàn thành" vào `docs/images/uiux-01/`.
11. `docs/CHECKPOINT_UIUX01.md` (bảng action trước và sau, danh sách test đã sửa và lý do, ảnh), `.kiro/task-status.json`.

Commit mã: `feat(uiux-01): định dạng số, lịch sử phê duyệt, cấu hình vault một chế độ, khối trạng thái vault, ví thanh toán ở màn tài khoản, đổi chữ trình diễn thành PoC`
Commit tài liệu: `docs(uiux-01): UserGuide, checkpoint, ảnh`
