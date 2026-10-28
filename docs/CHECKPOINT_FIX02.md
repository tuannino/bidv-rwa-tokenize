# Báo cáo bàn giao: FIX-02 Nhà đầu tư không bán, nhiều yêu cầu Mint, cảnh báo khi duyệt, Burn toàn bộ nguồn cung tự điền

| | |
|---|---|
| Mã task | FIX-02 |
| Nhánh | `fix/fix-02-sua-nho`, tạo từ `dev` (`a1ff3aa`) |
| Spec | `docs/fix-02-sua-nho/{requirements,design,tasks}.md` (chép nguyên từ gói spec) |
| Commit | mã `90995a1`, tài liệu là commit kế tiếp trên nhánh |
| Tiến độ | Xong. Chờ Owner merge; Claude Code **không** merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 8) | | Bằng chứng |
|---|---|---|---|
| 1 | A1 tới A5, B1 tới B4, C1 tới C4 đã làm | ✅ | mục 5 |
| 2 | Vitest ca 1 tới 9 (gồm 1b) xanh; 12 đột biến đều bị bắt | ✅ | mục 1.1, 1.3 |
| 3 | `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` mock, `arch markers checkpoint` xanh | ✅ | mục 1.2, 2 |
| 4 | Số action khi mở `/trade`, `/draft`, `/approvals/[id]` trước và sau bằng nhau | ✅ | mục 3 |
| 5 | Ba ảnh trên `mock` trong `docs/images/fix-02/` | ✅ | mục 4 |
| 6 | Diff không thêm dòng có mũi tên, gạch dài, chấm giữa | ✅ | mục 6 (không ra dòng nào) |
| 7 | `docs/USER_GUIDE.md`, checkpoint này, `.kiro/task-status.json` | ✅ | mục 7 |

**Kết luận:** 7 ✅, 0 🔶, 0 ❌. Không đổi hợp đồng, không thêm thư viện, không đổi lược đồ.
Cờ mới `ENABLE_INVESTOR_SELL` (mặc định `false`) trong `lib/config/env.ts`, `.env.example`,
`app/wrangler.json`; `vitest.config.ts` và `playwright.config.ts` bật cờ để các ca bán có sẵn chạy như trước.
`grep -rn "noPending" app/src app/test` không ra dòng nào.

UserGuide: đã cập nhật Phần 1 mục 1.4, 1.6; Phần 2; Phần 3 mục 3.1.2, 3.4.2 (gồm đoạn L-12), 3.4.4;
Phụ lục C; Lịch sử cập nhật.

### 0.2 Việc cần Owner quyết

- Không có việc chặn. Bỏ L-12 khỏi UserGuide vì điều kiện gây kẹt đã gỡ; L-15 (yêu cầu EXECUTING không có
  mã giao dịch không có nút xử lý) đổi đề xuất thành task riêng. Các chỗ làm khác chữ spec ở mục 8.

---

## 1. Vitest

### 1.1 Tệp mới `app/test/fix-02.test.ts`

```text
$ (cd app && npx vitest --run test/fix-02.test.ts)
 Test Files  1 passed (1)
      Tests  17 passed (17)
```

Chain `mock`, bộ lưu trữ trong bộ nhớ. Ca cần cờ tắt thì đặt `ENABLE_INVESTOR_SELL=false` rồi
`resetServerEnvCache()`; `afterEach` trả cờ về `true` như `vitest.config.ts`. Theo dõi ledger bằng vỏ bọc
`vi.mock('@/lib/ledger')`: mọi lời gọi phương thức của cổng được ghi tên khi bật theo dõi (mục 8.1).

| Ca | Nội dung đã kiểm |
|---|---|
| 1 | Cờ tắt: `previewTrade`, `previewPurchase`, `preparePermit` với `SELL` trả `VALIDATION` "Nhà đầu tư không được bán token.", không gọi phương thức nào của ledger; `placeOrder` `VALIDATION` cùng câu, không đọc số dư, có audit `order:place` FAILURE chứa câu, số lệnh không đổi. `BUY` vẫn chạy (xem trước, đặt lệnh). TELLER, CONTROLLER, SELLER gọi `SELL` ở bốn hàm: `FORBIDDEN` |
| 1b | Cờ bật đặt `SELL` với một `clientRequestId`; tắt cờ, gửi lại: cùng id lệnh, số lệnh không đổi; `clientRequestId` mới: bị chặn, số lệnh không đổi |
| 2 | `getTradeContext`: cờ tắt `sellEnabled: false`, cờ bật `true`; `tradeSides(false)` là `['BUY']`, `tradeSides(true)` là `['BUY', 'SELL']` |
| 3 | Hai yêu cầu Mint liên tiếp cùng token đều lập được (hai PENDING); khối kiểm tra Mint đúng năm khoá `permission, project, recall, cap, wallet` |
| 4 | `approveWarningOf` ở biên: Mint bằng `remaining` và Burn bằng `undistributed` thì `null`, lớn hơn 1 thì có câu và số liệu. Ba yêu cầu Mint mỗi cái 60% trần còn lại (tính một lần): cả ba `approveWarning` null; duyệt cái đầu, hai cái sau `MINT_REMAINING` đúng số; duyệt cái sau `REQUEST_CHECK`, giữ PENDING; từ chối chạy |
| 5 | Tổng cung 1.000, hai Burn "Phần chưa phân phối" 600; duyệt cái đầu: cái sau `BURN_UNDISTRIBUTED`, yêu cầu 600, còn 400 |
| 6 | Yêu cầu đã từ chối: `approveWarning` null (cả hàm thuần với trạng thái REJECTED). Đọc tổng cung lỗi: `token` null, `TOKEN_UNREADABLE`, `approveBlockReason` trả câu cảnh báo, từ chối vẫn chạy |
| 7 | Burn toàn bộ 999 khi tổng cung 1.000: chặn, chỉ khoá `fullSupply`, chi tiết "Số lượng 999; tổng cung hiện tại 1.000."; 1.000: lập được, cảnh báo null; Mint 500 hoàn tất: `BURN_FULL_SUPPLY` yêu cầu 1000, có 1500, nút khoá; duyệt bị `REQUEST_CHECK` có `fullSupply`, giữ PENDING |
| 8 | `approveBlockReason`: null khi không có gì; khoá khi có cảnh báo, khi tự duyệt, khi không PENDING. `burnSourceEffect('TOTAL_SUPPLY', null)`: không in số, không chứa U+2014 |
| 9 | `burnAmountShown`: toàn bộ khi chưa có token `''`; tải xong `'1000'` dù chưa gõ; tải lại `'1500'`; gõ `'7'` vẫn `'1500'`; về "Phần chưa phân phối" `''` rồi `'7'`; Mint luôn trả số đã gõ |

### 1.2 Toàn bộ `typecheck`, `lint`, `vitest`

```text
$ (cd app && npx tsc --noEmit -p . && npx eslint src test --quiet)
exit=0
$ (cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
 Test Files  68 passed | 10 skipped (78)
      Tests  1390 passed | 71 skipped (1461)
```

Mười tệp bỏ qua là các tệp cần nút Hardhat (`TEST_HARDHAT_RPC`), như FE-23.

Test có sẵn đã sửa: `test/token-request.test.ts` bỏ `noPending` ở hai ca khẳng định nó (ca sau chỉ còn khoá
`wallet`); ca "còn token ngoài ví SPV: TOTAL_SUPPLY bị chặn" đổi khoá lỗi mong đợi từ `['circulation']` sang
`['fullSupply', 'circulation']` vì số 10 cũng khác tổng cung 1.000 (mục 8.2). `test/maker-checker-ui.test.ts`
và `e2e/maker-checker.spec.ts` không sửa, vẫn xanh. `test/pending-markers.test.ts` xanh sau khi sinh lại
`docs/flows/purchase.md` (`node scripts/gen-flow-diagram.mjs purchase`; chỉ đổi số dòng).

### 1.3 Đột biến (12/12 bị bắt)

Mỗi đột biến sửa mã, chạy `test/fix-02.test.ts`, `test/token-request.test.ts`,
`test/maker-checker-ui.test.ts` có `TEST_DATABASE_URL`, rồi trả mã về nguyên. Kịch bản ngoài repo:
`scratchpad/fix02/mutate.py`.

| # | Đột biến | Ca đỏ |
|---|---|---|
| 1 | Bỏ chặn `SELL` ở `placeOrder` | ca 1 (`placeOrder`), ca 1b |
| 2 | Bỏ chặn ở `preparePermit` | ca 1 (ba hàm xem trước) |
| 3 | `sellEnabled` luôn `true` | ca 2 |
| 4 | Trả lại điều kiện "không có yêu cầu Mint khác đang chờ" | ca 3, 4, 7 và 30 ca có sẵn của `token-request.test.ts`, `maker-checker-ui.test.ts` (33) |
| 5 | `approveWarning` so `>=` thay `>` | ca 4 (biên), ca 7 |
| 6 | Bỏ cảnh báo Burn vượt phần chưa phân phối | ca 4 (biên), ca 5 |
| 7 | `approveBlockReason` bỏ qua `approveWarning` | ca 6, 7, 8 |
| 8 | Bỏ điều kiện `fullSupply` | ca 7; ca "TOTAL_SUPPLY bị chặn" của `token-request.test.ts` |
| 9 | Bỏ loại `BURN_FULL_SUPPLY` | ca 7 |
| 10 | `TOKEN_UNREADABLE` trả `null` | ca 6 |
| 11 | `placeOrder` chặn `SELL` trước bước tìm lệnh cũ | ca 1b |
| 12 | `burnAmountShown` trả `typedAmount` cho `TOTAL_SUPPLY` | ca 9 |

## 2. Bản dựng, e2e, job A

```text
$ CI=1 bash scripts/run-local-all.sh build e2e > build-e2e.log 2>&1; echo EXIT=$?
EXIT=0
$ grep -E "passed|skipped|ĐẠT" build-e2e.log
  7 skipped             # các ca chỉ chạy trên hardhat (mint.spec.ts, permit-order.spec.ts), như FE-23
  77 passed (1.2m)      # project mock, bằng số của FE-23
  => ĐẠT các phần đã chạy: build e2e
```

Playwright bật `ENABLE_INVESTOR_SELL` cho máy chủ e2e, nên ca bán có sẵn ở `/trade` (`ops-transactions.spec.ts` bấm nút "Bán") chạy như trước.

Mô phỏng job A (cất `packages/contracts-evm/artifacts`):

```text
$ TEST_DATABASE_URL=... bash scripts/run-local-all.sh arch markers checkpoint app; echo EXIT=$?
  PASS: 20   FAIL: 0   WARN: 3      # 3 cảnh báo có từ trước, không tệp nào của FIX-02
  Test Files  68 passed | 10 skipped (78)
  => ĐẠT các phần đã chạy: arch markers checkpoint app
EXIT=0
```

## 3. Số server action khi mở (mock, `next start`, đếm header `next-action`)

Cách đo HF-01: mở màn, đợi mạng yên rồi thêm 2,5 giây. Một yêu cầu Mint dựng qua `/draft` để có mã cho
`/approvals/[id]`. Máy chủ đo không đặt `ENABLE_INVESTOR_SELL` (cờ tắt).

| Màn | Vai | Trước (`a1ff3aa`) | Sau |
|---|---|---|---|
| `/trade` | Nhà đầu tư | 1 | 1 |
| `/draft` | Giao dịch viên | 3 | 3 |
| `/approvals/[id]` | Kiểm soát viên | 1 | 1 |

`sellEnabled` đi trong `getTradeContext` và `approveWarning` trong `getTokenRequestDetail` có sẵn; ô số lượng
Burn toàn bộ tính từ khối thông tin token đã tải, không thêm lần đọc nào.

## 4. Ảnh (`docs/images/fix-02/`, mock, cờ `ENABLE_INVESTOR_SELL` mặc định)

| Tệp | Nội dung |
|---|---|
| `20261029_giao_dich_chi_mua.png` | `/trade` của Nhà đầu tư: không có hai nút Mua, Bán; câu "Mua token từ người bán theo giá phát hành do ngân hàng cấu hình."; tóm tắt "Loại lệnh: Mua" |
| `20261029_duyet_canh_bao_khoa_chap_nhan.png` | `/approvals/[id]` của Kiểm soát viên: Burn 600 sau khi Burn 600 khác đã duyệt; khối vàng "Không đủ số lượng token chưa phân phối còn lại.", "Số lượng yêu cầu 600; phần chưa phân phối còn 400."; nút "Chấp nhận" khoá |
| `20261029_lap_lenh_burn_toan_bo_tu_dien.png` | Thẻ "Huỷ token" ở `/draft`: chọn "Toàn bộ nguồn cung" TRƯỚC khi nhập mã token; sau khi khối thông tin token tải, ô số lượng tự điền 400 (bằng tổng cung), nền xám, chú thích "Tự điền bằng tổng cung hiện tại, không sửa được." |

## 5. Yêu cầu và nơi làm

| Mã | Nơi làm |
|---|---|
| A1 | `lib/config/env.ts` (`enableInvestorSell`, `boolFlag(false)`); `.env.example`; `app/wrangler.json` |
| A2 | `lib/bank/purchase.service.ts`: `INVESTOR_SELL_DISABLED_MESSAGE`, `investorSellBlocked`; chặn ở `previewPurchase` (sau chốt ví phiên), `preparePermit` (trước kiểm chain permit), `placeOrder` (ngay sau bước tìm lệnh cũ, qua `reject` nên có audit FAILURE); `previewTrade` gọi `previewPurchase` trước nên chặn theo |
| A3 | `lib/bank/trade.service.ts`: `TradeContextView.sellEnabled` |
| A4 | `components/trading/sides.ts` (`tradeSides`); `components/pages/investor-trade.tsx`: một chiều thì không hiện hai nút, câu mô tả theo cờ |
| A5 | `app/vitest.config.ts`, `app/playwright.config.ts` bật cờ, có chú thích |
| B1 | `lib/bank/token-request.service.ts`: `evaluate` bỏ khối "không có yêu cầu Mint khác đang chờ" và tham số loại trừ, sửa chỗ gọi lúc duyệt |
| B2 | Cùng tệp: `ApproveWarningKind`, `ApproveWarning`, `approveWarningOf`; `TokenRequestDetailView.approveWarning` |
| B3 | `components/maker-checker/gates.ts`: `approveBlockReason`, `approveWarningFigures`; `components/pages/approval-detail.tsx`: khối cảnh báo vàng trên hai nút, nút "Chấp nhận" theo `approveBlockReason` |
| B4 | `approveTokenRequest` giữ nguyên lần kiểm lại toàn bộ (`evaluate`) |
| C1, C2 | `gates.ts`: `burnAmountShown`; `components/pages/draft.tsx`: `amountShown` cho ô số lượng và `payload`, `chooseSource` không còn điền số, về "Phần chưa phân phối" thì xoá số; ô chỉ đọc nền xám, hai câu chú thích |
| C3 | `gates.ts`: `burnSourceEffect` với tổng cung null không in số |
| C4 | `token-request.service.ts`: điều kiện `fullSupply` "Số lượng bằng tổng cung" trước `circulation` |

## 6. Quét

```text
$ grep -rn "noPending" app/src app/test                     # không ra dòng nào
$ node scripts/scan-pending.mjs --check-report              # Khớp marker
$ git add -N . && git diff a1ff3aa | python3 (lọc dòng thêm có mũi tên, gạch dài, chấm giữa, dấu nhân)
(không ra dòng nào)
```

Ca 8 viết ký tự cần cấm dưới dạng thoát `'\u2014'` để chính tệp test không chứa ký tự đó.

## 7. Tài liệu

- `docs/USER_GUIDE.md`: như dòng UserGuide ở mục 0.1. Bỏ L-12 (mục 3.4.2 và Phụ lục C); dòng quyết định cũ
  "Một yêu cầu Mint đang chờ mỗi lúc" giữ lại, ghi "Thay bởi" theo quy tắc mục 0.
- `docs/flows/purchase.md`: sinh lại (chỉ số dòng đổi).
- `.kiro/task-status.json`: FIX-02 thêm vào `done` (không có sẵn trong `planned`).

## 8. Chỗ làm khác chữ spec hoặc spec để ngỏ

1. **Theo dõi ledger bằng vỏ bọc thay `vi.spyOn`.** `getLedger` dựng adapter mới mỗi lần gọi, nên gắn
   `vi.spyOn` lên một đối tượng không bắt được lời gọi trong service. Vỏ bọc `vi.mock` ghi tên mọi phương
   thức được gọi (đọc hay ghi), chặt hơn yêu cầu "không gọi phương thức đọc nào".
2. **Sửa ca có sẵn ngoài danh sách spec.** Ca "còn token ngoài ví SPV: TOTAL_SUPPLY bị chặn" của
   `token-request.test.ts` đổi khoá lỗi mong đợi (mục 1.2): đây là hệ quả trực tiếp của C4, không đổi ý ca.
3. **Câu phụ dưới khối cảnh báo duyệt.** Ngoài câu và dòng số liệu, khối có thêm dòng "Nút "Chấp nhận" đã
   khoá; có thể từ chối yêu cầu này." để Kiểm soát viên biết vẫn từ chối được.
4. **Ngày.** Ảnh và UserGuide ghi 29/10/2026 theo ngày của tệp góp ý trong spec; đồng hồ máy chạy là 28/10.
