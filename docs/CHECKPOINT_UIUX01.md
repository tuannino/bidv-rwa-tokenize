# Báo cáo bàn giao: UIUX-01 chỉnh sửa giao diện theo góp ý nghiệp vụ

| | |
|---|---|
| Mã task | UIUX-01 |
| Nhánh | `uiux/uiux-01-giao-dien`, tạo từ `dev` (`2541c8a`) |
| Spec | `docs/uiux-01-chinh-sua-giao-dien/{requirements,design,tasks}.md` (giám sát soạn, chép nguyên từ gói spec) |
| Commit | mã `ea9fe5f`, tài liệu là commit kế tiếp trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 7) | | Bằng chứng |
|---|---|---|---|
| 1 | A1 tới A4, B1 tới B3, C1 tới C5, D1 tới D4, E1, F1, G1 tới G5 đã làm | ✅ | mục 5 (bảng từng yêu cầu), ảnh mục 4 |
| 2 | Vitest ca 1 tới 5 xanh; `typecheck`, `lint`, `vitest`, `build`, `e2e` mock và hardhat xanh | ✅ | mục 1, 2 |
| 3 | Số action khi mở trước và sau bằng nhau | ✅ | mục 3 |
| 4 | Ảnh trên `mock` trong `docs/images/uiux-01/` (7 ảnh) | ✅ | mục 4 |
| 5 | Quét "trình diễn" chỉ ra dòng chú thích | ✅ | mục 6 (không ra dòng nào) |
| 6 | Diff không thêm dòng có mũi tên, gạch dài, chấm giữa | ✅ | mục 6 |
| 7 | UserGuide, checkpoint này, `.kiro/task-status.json` (UIUX-01 ở `done`) | ✅ | mục 7 |

**Kết luận:** 7 ✅, 0 🔶, 0 ❌. Không đổi hợp đồng, lược đồ database, `ILedgerPort`, quyền; không thêm thư viện.
Máy chủ đổi đúng ba chỗ spec cho phép: `getApprovalStats` thêm `history`, `saveVaultConfig` nhận `mode`,
`getVaultOverview` thêm `configEffective`, `configEffectiveError`, `config.mode`, `config.percentApplies`.

UserGuide: đã cập nhật Phần 1 mục 1.5, 1.7, 1.9; Phần 2; Phần 3 mục 3.2.1, 3.2.3, 3.3.2, 3.4.2, 3.4.3, 3.4.7, 3.5.1; Phụ lục B, C; Lịch sử cập nhật.

### 0.2 Việc cần Owner quyết

- Không có. Các chỗ làm khác chữ spec hoặc spec để ngỏ ghi ở mục 8.

---

## 1. Vitest

### 1.1 Tệp mới `app/test/uiux-01.test.ts` (ca 1 tới 5, chain `mock`)

```text
$ (cd app && npx vitest --run test/uiux-01.test.ts test/account-info.test.ts test/maker-checker-ui.test.ts)
 ✓ test/account-info.test.ts (8 tests) 108ms
 ✓ test/uiux-01.test.ts (13 tests) 96ms
 ✓ test/maker-checker-ui.test.ts (34 tests) 592ms
 Test Files  3 passed (3)
      Tests  55 passed (55)
```

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | `mode` PERCENT có cả hai ô: lỗi gắn ô `fixedLock`; `mode` FIXED có cả hai ô: lỗi gắn ô `percent`; câu đúng spec; `acquireOperationLock` không được gọi; không giao dịch nào. FIXED thiếu `fixedLock`: `VALIDATION` ở ô `fixedLock` |
| 2 | Đích FIXED chỉ `setFixedLock`, `setLockMode`; đích PERCENT chỉ `setPercentRate`, `setLockMode`; ví nhận đổi thì `setPayoutWallet` đứng đầu ở cả hai |
| 3 | FIXED; PERCENT có sự kiện chờ mới hơn (không tính); đầu vào lộn thứ tự, timestamp ngược thứ tự block và cùng giây (chọn theo block, logIndex); timestamp 0 cho `unknown`; UNSET và rỗng cho `null` |
| 4 | `history` chỉ yêu cầu đã quyết định, đúng chain (bỏ yêu cầu `hardhat-local`, bỏ PENDING), xếp `decidedAt` giảm dần; `resultText` của REJECTED ra "Kiểm soát viên KSV001 từ chối do: Sai chứng từ", thiếu vai thì "KSV001 từ chối do: Sai chứng từ" |
| 5 | Sau khi lưu PERCENT và chốt một kỳ, `vaultConfigEvents` ném lỗi: vẫn có `status`, `history` 1 dòng, `historyError` null, `configEffective` null, `configEffectiveError` có câu; `percentApplies` là `NEXT_PERIOD` |

### 1.2 Toàn bộ `typecheck`, `lint`, `vitest`

```text
$ (cd app && npm run typecheck && npm run lint && npx vitest --run)
 Test Files  63 passed | 14 skipped (77)
      Tests  1211 passed | 90 skipped (1301)
exit=0
```

Tệp bị bỏ qua là các tệp chỉ chạy khi có `TEST_HARDHAT_RPC`, như trước task. Ba tệp phải chạy trên nút ở mục 2.2.

## 2. Bản dựng, e2e, nút Hardhat

### 2.1 `build`, e2e mock, e2e hardhat

```text
$ USE_LOCAL_SOLC=1 bash scripts/run-local-all.sh build e2e evm > e2e.log 2>&1; echo exit=$? >> e2e.log
$ grep -E "passed \(|skipped|PASS:|exit=" e2e.log
  => PASS: APP - BUILD BẢN PHÁT HÀNH
  7 skipped
  75 passed (1.2m)
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
  2 skipped
  26 passed (36.3s)
  => PASS: EVM - E2E PROJECT HARDHAT
exit=0
```

Các ca bỏ qua là ca chỉ dành cho project kia (có từ trước). `vault-withdraw.spec.ts` chạy ở cả hai project.

### 2.2 Ba tệp vitest trên nút Hardhat (mỗi tệp một lần reset nút)

```text
$ for f in fe-08-approval-evm op-05-demo-cycle-evm be-13-vault-evm; do USE_LOCAL_SOLC=1 bash scripts/evm-local.sh reset; (cd app && TEST_HARDHAT_RPC=http://127.0.0.1:8545 npx vitest --run test/$f.test.ts); done; bash scripts/evm-local.sh down
## fe-08-approval-evm      Tests  8 passed (8)   exit=0
## op-05-demo-cycle-evm    Tests  8 passed (8)   exit=0
## be-13-vault-evm         Tests  5 passed (5)   exit=0
```

`be-13-vault-evm.test.ts` không có trong danh sách spec nhưng cũng gọi `saveVaultConfig` với hai ô, nên sửa cùng cách.

## 3. Số server action khi mở

Cách đo của HF-01: Playwright đếm yêu cầu có header `next-action` và `_rsc` từ lúc mở tới khi mạng yên thêm 2,5
giây; `next start` cổng 3300, chain `mock`, bộ nhớ. "Trước" là bản dựng `dev` @ `2541c8a` (đo trước khi sửa mã),
"sau" là bản dựng `ea9fe5f`.

```text
# trước (dev @ 2541c8a)                         # sau (ea9fe5f)
/approvals CONTROLLER {"ACTION":3,"RSC":0}      /approvals CONTROLLER {"ACTION":3,"RSC":0}
/vault CONTROLLER {"ACTION":3,"RSC":0}          /vault CONTROLLER {"ACTION":3,"RSC":0}
/vault TELLER {"ACTION":3,"RSC":0}              /vault TELLER {"ACTION":3,"RSC":0}
/account SELLER {"ACTION":1,"RSC":0}            /account SELLER {"ACTION":1,"RSC":0}
/account INVESTOR {"ACTION":1,"RSC":0}          /account INVESTOR {"ACTION":1,"RSC":0}
/draft TELLER {"ACTION":3,"RSC":0}              /draft TELLER {"ACTION":3,"RSC":0}
$ diff actions-before.txt actions-after.txt && echo GIONG
GIONG
```

Lịch sử phê duyệt đi kèm action thẻ số liệu (QĐ-5); ô "Ví thanh toán" và khối ví dùng chung một lần gọi
`getProfileWalletAction` qua `ProfileWalletProvider` (F1); `vaultConfigEvents` đọc trong cùng action tổng quan vault
(QĐ-6), song song với `vaultPeriodCloses(10)`. Trên chain EVM, tổng quan vault thêm một lần quét log sự kiện cấu hình.

## 4. Ảnh chụp (chain `mock`, dữ liệu dựng qua chính màn hình)

Máy chủ `next start` mới, dữ liệu dựng bằng Playwright qua màn hình: whitelist vault và ví NB001 ở `/mint`; Giao dịch
viên lập Mint 1.000 (Kiểm soát viên từ chối "Sai chứng từ") rồi Mint 1.234.567 (chấp nhận); Kiểm soát viên lưu vault
"Khoá số cố định" 1.500.000.

| Tệp trong `docs/images/uiux-01/` | Cho thấy |
|---|---|
| `20261026_draft_so_dinh_dang.png` | Ô Số lượng "20.000.000"; khối kiểm tra "Số lượng 20.000.000; trần còn lại 18.765.433 (trần 20.000.000 trừ tổng cung 1.234.567)."; bảng có cột Chain, Token chỉ ký hiệu, câu từ chối và câu hoàn tất mới |
| `20261026_approvals_lich_su.png` | Thẻ Lịch sử phê duyệt dưới hai hàng chờ: Loại, Người duyệt, Thời điểm duyệt, Chain, "Kiểm soát viên KSV001 từ chối do: Sai chứng từ", "KSV001 duyệt, tx 0x0000000000…" |
| `20261026_vault_che_do_co_dinh.png` | Khối Trạng thái hiện tại 11 trường (có Mức khoá cố định, Ngày cấu hình có hiệu lực); biểu mẫu chế độ "Khoá số cố định", ô "1.500.000", câu "Có hiệu lực ngay khi lưu." |
| `20261026_vault_che_do_ty_le.png` | Cùng màn, chọn "Theo tỷ lệ %": chỉ còn ô Tỷ lệ khoá (%), câu hiệu lực; ví nhận giữ dưới nhóm |
| `20261026_account_nha_dau_tu.png`, `20261026_account_nguoi_ban.png` | Ô "Ví thanh toán" theo chain (ví mẫu trên mock); khối "Ví thanh toán trên chain Mock (không cần chain)", ô "Dùng địa chỉ ví mới" để trống |
| `20261026_demo_payment.png` | Menu "Nạp VNDB"; hộp ghi chú hai dòng đúng chữ G2 |

## 5. Từng yêu cầu

| Yêu cầu | Làm ở |
|---|---|
| A1 | `components/ui/amount-input.tsx` (`AmountInput`), `digitsOnly` ở `lib/format.ts`; dùng ở `draft.tsx`, `mint.tsx`, `vault-status.tsx`, `seller-withdraw.tsx`. Nhãn ô giữ nguyên, trừ ô vault theo đúng nhãn C1 |
| A2 | Ba câu trong `evaluate` của `token-request.service.ts` dùng `formatAmount`; câu lưu hành thay gạch dài bằng dấu phẩy |
| A3 | `listRequests({ decided })` ở cổng, bản bộ nhớ, bản Postgres (đúng câu SQL thiết kế); `getApprovalStats().history`; thẻ ở `approvals.tsx` |
| A4, B1 tới B3 | `request-table.tsx`: `resultText` xuất ra, câu từ chối có vai (`lib/role-labels.ts`), câu hoàn tất mới, cột Chain, Token chỉ ký hiệu, biến thể `history` |
| C1 tới C5 | `vault-config.ts` (`VaultConfigTarget` hai chế độ), `vault.service.ts` (`mode`, kiểm một chế độ trước khi lấy khoá, `percentApplies`), `vault-status.tsx` (nhóm radio `aria-label="Chế độ khoá"`, câu hiệu lực `role="note"`) |
| D1 tới D4 | `configEffectiveAt` ở `vault-config.ts`; `getVaultOverview` đọc song song, mỗi phép tự bắt lỗi (`settle`); `VaultStatusMetrics` ở `vault-status.tsx` |
| E1 | `seller-overview.tsx` "Địa chỉ vault: ..." |
| F1 | `components/pages/profile-wallet.tsx` (`ProfileWalletProvider`, `PaymentWalletValue`, `ProfileWalletCard`), `account-info.tsx`, `app/(account)/account/page.tsx` |
| G1 tới G5 | `nav-config.ts`, `demo-payment.tsx`, `round-info.tsx`, `recall.service.ts`, `docs/USER_GUIDE.md` |

## 6. Quét chữ và ký tự cấm

```text
$ grep -rn "trình diễn" app/src --include=*.ts --include=*.tsx | grep -vE "^[^:]+:[0-9]+:\s*(//|\*|/\*|\{/\*)"; echo "exit=$?"
exit=1
$ grep -c "trình diễn" docs/USER_GUIDE.md
0
$ git diff 2541c8a HEAD | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
(không ra dòng nào)
$ node scripts/gen-flow-diagram.mjs issue --check && node scripts/gen-flow-diagram.mjs purchase --check && node scripts/scan-pending.mjs --check-report
Khớp marker: docs/flows/issue.md
Khớp marker: docs/flows/purchase.md
Khớp marker: mục điểm cắm trong docs/tech-report.md
```

Lệnh quét "trình diễn" không ra dòng nào (kể cả dòng chú thích). UserGuide có 13 chỗ (spec ghi 12; dòng Phần 2 mục 2.2
có hai chỗ), đã thay hết.

## 7. Tài liệu

- `docs/USER_GUIDE.md`: theo mục 7 thiết kế và quy tắc mục 0 của chính tệp. Dòng "Ưu tiên và mặc định" ở mục 1.7
  giữ lại, ghi "Thay bởi dòng Một chế độ khoá"; thêm dòng mới. Bỏ L-82 ("Kỳ gần nhất" không còn trên màn), sửa
  phần ví mẫu của L-10 ở mục 3.3.2 và Phụ lục C. Cập nhật số dòng mã của L-16, L-81, L-84, L-06, L-10 theo mã mới.
- `.kiro/task-status.json`: thêm `UIUX-01` vào `done` (trước đó không có trong danh sách nào).
- Spec chép vào `docs/uiux-01-chinh-sua-giao-dien/`.

## 8. Ghi chú, chỗ khác chữ spec

- **`profile-wallet-card.tsx` đã xoá**, chuyển sang `profile-wallet.tsx` (thiết kế mục 6 cho chọn). Khối ví đổi
  `aria-label` từ "Ví liên kết" sang "Ví thanh toán"; `e2e/account-info.spec.ts` sửa theo.
- **Hằng 50 dòng lịch sử** (`APPROVAL_HISTORY_LIMIT`) đặt ở `token-request.store.port.ts` để máy chủ và màn hình
  (câu "Hiện 50 quyết định gần nhất.") dùng chung; `token-request.service.ts` có `import 'server-only'` nên màn
  hình không nhập được từ đó.
- **Lỗi "chỉ nhập một trong hai"** gắn đúng vào ô của chế độ kia như spec; ô đó đang ẩn nên biểu mẫu hiện câu lỗi
  này ngay dưới ô đang hiện. Câu tổng vẫn là "Cấu hình khoá chưa hợp lệ." như các lỗi kiểm dạng khác.
- **`config.fixedLock`** điền sẵn `fixedLockAmount` khi lớn hơn 0 (thiết kế mục 4), trước đây chỉ khi đang FIXED.
- **`maker-checker-ui.test.ts`**: một khẳng định `toEqual` trên kết quả `getApprovalStats` đổi sang `toMatchObject`
  vì có thêm `history`; ý nghĩa ca giữ nguyên. Câu kết quả cũ không có test nào khẳng định.
- **`account-info.test.ts`**: đổi nhãn "Địa chỉ ví" thành "Ví thanh toán", thêm khẳng định "Đang đọc…" (dựng ở máy
  chủ không có provider). Ca nhân viên vẫn khẳng định không có "Địa chỉ ví", "Ví thanh toán".
- **E2E**: `maker-checker.spec.ts:118` so với `formatAmount(total)`; `vault-withdraw.spec.ts` chọn "Khoá số cố
  định", khẳng định ô tỷ lệ ẩn, nhập 1; dòng 47 cũ đổi sang kiểm giá trị ô "Ví nhận tiền rút". Không thêm tệp e2e.
  Các ô số khác (`mint.spec.ts`, `recall.spec.ts`, `ops-transactions.spec.ts`) chỉ `fill`, không `toHaveValue`.
- Câu chi tiết bước cấu hình vault (`describeVaultConfigStep`, có "->") và dòng "Ví thanh toán" của khối thông tin
  token ở `/draft` là chữ có từ trước, ngoài phạm vi, giữ nguyên.
