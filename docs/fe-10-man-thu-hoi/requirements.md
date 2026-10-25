# FE-10: màn Thu hồi token và hiển thị cho Nhà đầu tư, yêu cầu

Nền: `dev` @ `4767e01` (sau merge BE-05, PR #72). Người viết: giám sát. Spec gốc: `docs/be-05-fe-10-thu-hoi/` (R11 tới R13, QĐ-R13, QĐ-R14). Tài liệu này thay phần FE-10 của spec gốc ở mọi chỗ khác nhau, vì đã đối chiếu với mã BE-05 thật và qua một vòng phản biện độc lập.

## 1. Bối cảnh

- BE-05 đã có đủ máy chủ: bảy action trong `app/actions/recall.ts`; `getPortfolio` trả `recall`; tổng quan Người bán trả `recallPhase`.
- Còn thiếu: màn `/recall`, mục menu, nội dung thông báo cho Nhà đầu tư, nhãn lịch sử giao dịch, trạng thái giao dịch ở `/trade` và tổng quan Người bán.
- Các chỗ BE-05 chưa đủ cho giao diện, FE-10 sửa nhỏ ở máy chủ (QĐ-F1, QĐ-F2).

## 2. Mục tiêu

1. Kiểm soát viên làm trọn đợt thu hồi trên màn `/recall`; Giao dịch viên xem cùng màn, không có nút ghi.
2. Nhà đầu tư thấy thông báo thu hồi và dòng "Thu hồi" trong lịch sử giao dịch.
3. `/trade` và tổng quan Người bán hiện đúng trạng thái giao dịch theo pha thu hồi, không hiện lỗi chung.
4. Không tăng số server action khi mở các màn có sẵn; mở `/recall` đúng 1 action.

## 3. Quyết định

- **QĐ-F1: `getTradeContext` không trả lỗi khi bị chặn theo đợt thu hồi.** Hiện BE-05 trả `REQUEST_STATE` (`trade.service.ts`, sau `tradingBlocked`), nên cả màn `/trade` hiện lỗi chung. Đổi thành trả `ok` như trước, thêm `tradeBlock: { phase: RecallPhaseKind; settlementMode: boolean | null; maturityDate: string | null; recallFrom: string | null } | null`, và `token.tradingOpen = !blocked` (hiện chỉ theo `isSettlementMode`). `placeOrder` và `previewTrade` (qua `previewPurchase`, `recallTradeBlock` ở `purchase.service.ts`) giữ nguyên chặn ở máy chủ; ca `[ca 5]`, `[ca 6]` trong `be-05-recall.test.ts` giữ nguyên làm bằng chứng. Chưa có test nào khẳng định `getTradeContext` trả lỗi; ca 9 là test mới.
- **QĐ-F2: tổng quan thu hồi trả thêm** để giao diện không tự suy:
  - `today`: `todayVn()`, dùng làm `min` của ô ngày.
  - `minNoticeDays`: từ hàm mới `minNoticeDaysFor(chain, demo)` (0 khi chain `mock`, `hardhat-local` hoặc `demo` true; ngược lại 1), `validateRecallDates` dùng chính hàm này.
  - `freezeBlockers: string[]` và `canFreeze: boolean`, tính bằng hàm THUẦN mới `freezeBlockers({ round, today, orders, activeDistribution, walletsTruncated, lock, settlementMode, now, chain })` từ các giá trị tổng quan đã đọc (không đọc thêm). Thứ tự câu giữ đúng thứ tự `freezeToken` đang kiểm: chưa tới ngày thu hồi, còn lệnh đang xử lý, còn kỳ chia hoạt động, danh sách ví bị cắt; sau đó khoá chain (bỏ qua khoá `RECALL` đã quá hạn tiếp quản, xem dưới), cờ đóng băng không đọc được. `freezeToken` gọi cùng hàm với `lock: null` và trả câu ĐẦU TIÊN như hiện nay. `canFreeze = round.status === 'INITIATED' && !round.freezeRequestedAt && blockers.length === 0`. Khoá chain ở tổng quan chỉ là thông tin; chốt chặn thật vẫn là khoá máy chủ.
  - Xuất `isRecallLockStale(lock, chain, now)` dùng chung ngưỡng `recallBudget(chain) + 120 giây` với `withRecallLock`. Tổng quan trả `chainLock: { kind, acquiredAt, stale: boolean } | null`, `stale` tính ở máy chủ, để giao diện không cần đồng hồ hay ngưỡng.
  - Khi đợt gần nhất `CANCELLED`, tổng quan cũng trả `preview` (đọc `listTokenWallets()` như khi không có đợt).
- **QĐ-F3: nội dung thông báo cho Nhà đầu tư là hàm thuần** `recallNoticeText(recall)`; `AssetSummary` hiện nó trong thẻ khi `data.recall` khác `null`, dùng chính kết quả `getPortfolioAction` đang có. Không tạo thành phần mới tự gọi action. Lưu ý: trên chain mock, `AssetSummary` chỉ có dữ liệu khi ví đã kết nối, nên E2E không kiểm hộp này (kiểm bằng vitest ca 12).
- **QĐ-F4: quyết định hiển thị là hàm thuần** trong `components/recall/gates.ts` (cùng mẫu `components/maker-checker/gates.ts`). Vitest kiểm các hàm này; màn chỉ vẽ.
- **QĐ-F5: E2E chỉ chạy luồng đảo ngược được.** Ledger mock dùng trạng thái chung cho mọi tệp E2E; luồng đốt đóng dự án và làm hỏng các tệp chạy sau. E2E chạy: mở đợt, `/trade` của Nhà đầu tư tạm dừng, Giao dịch viên xem, đóng băng, mở đóng băng, huỷ đợt, `/trade` mở lại. Luồng đốt kiểm bằng vitest (BE-05 đã có, cộng gates FE-10) và một lượt chạy trên `hardhat-local` (ca 15).
- **QĐ-F6: ngày hiển thị** dạng `dd/mm/yyyy` bằng hàm mới `formatVnDate('YYYY-MM-DD')` trong `lib/format.ts` (tách chuỗi, không qua `new Date`). Câu tạm dừng ở `/trade` dựng ở máy khách từ các trường của `tradeBlock`, không hiện nguyên câu máy chủ (câu máy chủ có ngày dạng `YYYY-MM-DD`). Mốc thời gian đầy đủ (`completedAt`, `frozenAt`) dùng `formatDateTime` có sẵn.

## 4. Ngoài phạm vi

- Mọi thay đổi máy chủ ngoài QĐ-F1, QĐ-F2.
- Truyền ví mặc định cho `AssetSummary` trên chain mock.
- Thông báo đẩy, email; màn lịch sử các đợt đã kết thúc.
- Chain Stellar: tổng quan thu hồi lỗi ngay khi đọc token (adapter Stellar chưa hiện thực); màn hiện khối lỗi R15.

## 5. Yêu cầu chức năng

### Màn `/recall` "Thu hồi token"

- **R1. Định tuyến và menu.**
  - Trang `app/(ops)/recall/page.tsx` theo mẫu `/config` (`assertCan('ops:read')`, breadcrumb "Vận hành / Thu hồi token").
  - Menu nhóm Vận hành, đặt ngay sau mục "Giá và phát hành": Kiểm soát viên "Thu hồi token", Giao dịch viên "Thu hồi token (chỉ xem)"; phím tắt `U`; biểu tượng `Undo2` (thêm vào `NavIconName` và `NAV_ICONS`).
  - Sửa test menu: `test/four-roles-shell.test.ts` (`URD_MENU` của TELLER và CONTROLLER, danh sách `opsOnly` thêm `/recall`), và test khác nếu có khẳng định danh sách mục.
- **R2. Một action khi mở**: `getRecallOverviewAction({ chain })`. Sau mỗi thao tác ghi (thành công hay thất bại) tải lại bằng chính action này. Đổi chain thì tải lại.
- **R3. Bốn bước** trên đầu màn ("Đã mở đợt", "Đến hạn", "Đã đóng băng", "Hoàn tất"), có `aria-current="step"` ở bước hiện tại: `SCHEDULED` bước 1, `NOTICE` bước 2, `FROZEN` bước 3, `CLOSED` bước 4. Không có đợt hoặc đợt `CANCELLED`: không hiện thanh bước.
- **R4. Khối thông tin**:
  - Có đợt chưa huỷ: ngày hết hạn, ngày bắt đầu thu hồi, số ngày báo trước, số ngày tới mỗi mốc (`daysToMaturity`, `daysToRecall`; "hôm nay" khi 0, "đã qua" khi âm), lý do mở, trạng thái token trên chuỗi (`settlementMode`: "Đang đóng băng", "Đang mở", "Không đọc được"), tổng cung ngoài vault.
  - Đợt gần nhất `CANCELLED`: một dòng "Đợt gần nhất đã huỷ" kèm mốc của đợt đó.
  - Nhãn "Chế độ trình diễn" khi `demoMode`.
- **R5. Mở đợt** (khi `controls.open`): chỉ khi `canManage`, dự án `ISSUED`, và không có đợt hoặc đợt gần nhất `CANCELLED`.
  - Ô ngày (`type="date"`, `min = today`), ô số ngày báo trước (mặc định 30, `min = minNoticeDays`, tối đa 365, câu gợi ý nêu mức tối thiểu), ô lý do (5 tới 200 ký tự, đếm ký tự), dòng "Ngày bắt đầu thu hồi: …" tính bằng `addDays` của `recall-phase.ts` khi hai ô hợp lệ. Nút "Mở đợt thu hồi".
  - Dự án chưa `ISSUED` (ví dụ dữ liệu mẫu `DRAFT`): câu "Dự án chưa phát hành nên chưa mở được đợt thu hồi". Dự án `CLOSED`: câu "Dự án đã đóng" (kèm `formatDateTime(round.completedAt)` khi có).
- **R6. Sửa mốc** (đợt `INITIATED`, chưa có `freezeRequestedAt`, `canManage`): hộp thoại cùng ba ô như mở đợt, điền sẵn mốc hiện tại.
- **R7. Huỷ đợt** (cùng điều kiện sửa mốc, cộng `settlementMode !== true`): hộp thoại có ô lý do; câu "Huỷ đợt sẽ mở lại giao dịch nếu đã tới ngày hết hạn".
- **R8. Đóng băng** (đợt `INITIATED`, `canManage`):
  - Chưa có `freezeRequestedAt`: nút "Đóng băng trên toàn hệ thống" bật khi `canFreeze`; khoá thì liệt kê `freezeBlockers` dưới nút.
  - Có `freezeRequestedAt`: thay nút bằng "Đang chờ xác nhận đóng băng" và nút "Kiểm tra lại". Nút này gọi `freezeTokenAction` với `confirmSymbol = project.tokenSymbol`, không mở hộp thoại. Câu nhỏ cạnh nút: "Quá 10 phút chưa có xác nhận, hệ thống sẽ gửi lại lệnh đóng băng (gửi lại không gây hại)."
  - Hộp xác nhận: "Tạm dừng {tên token} ({ký hiệu}) trên chuỗi {chain}. Mọi chuyển nhượng, mua bán {ký hiệu} dừng. Có thể mở đóng băng trước khi đốt ví đầu tiên; sau đó không mở lại được. Token khác không bị ảnh hưởng." Ô có `<label>` "Gõ {ký hiệu} để xác nhận"; nút xác nhận chỉ bật khi `symbolMatches` (bỏ khoảng trắng đầu cuối, phân biệt hoa thường).
- **R9. Mở đóng băng** (đợt `IN_PROGRESS`, `canManage`):
  - `canUnfreeze` true, chưa có `unfreezeRequestedAt`: nút phụ "Mở đóng băng trên toàn hệ thống"; hộp xác nhận gõ ký hiệu và lý do.
  - Có `unfreezeRequestedAt`: "Đang chờ xác nhận mở đóng băng" và nút "Kiểm tra lại", mở lại hộp thoại (vì máy chủ cần lý do), điền sẵn lý do lần trước nếu còn trong bộ nhớ màn. Cùng câu nhỏ về gửi lại sau 10 phút.
  - `canUnfreeze` false: câu "Đã bắt đầu thu hồi, không mở đóng băng được nữa".
- **R10. Thu hồi** (đợt `IN_PROGRESS`, `canManage`):
  - `recall.mode`: `hidden` khi không thoả điều kiện trên; `blocked` khi có `unfreezeRequestedAt`, hoặc `settlementMode !== true`, hoặc `chainLock` khác `null` và `stale` false (hiện lý do); `first` khi `canUnfreeze` true (chưa đốt ví nào); `next` khi ngược lại.
  - Nhãn: `first` "Thu hồi toàn bộ", `next` "Thu hồi lô tiếp theo". `first` hỏi xác nhận (gõ ký hiệu, câu "Từ lần này không mở đóng băng được nữa"); `next` không hỏi.
  - Đang chạy: nút khoá, chữ "Đang thu hồi lô (tối đa 10 ví)…". Xong lô: khối kết quả (đã đốt, đang chờ, lỗi, còn lại, WPT ngoài vault còn lại) và danh sách `errors` (ví rút gọn, lý do), `aria-live="polite"`; giữ tới khi tải lại xong.
- **R11. Bảng hồ sơ ví**: ví (rút gọn, nút chép), số WPT lúc lập, số đã đốt (`burnedAmount`, trống khi chưa có), trạng thái (Chờ đốt, Đang gửi, Đã đốt, Lỗi), mã giao dịch mở trình duyệt khối (`explorerTxUrl`; không có thì mã rút gọn), lý do lỗi. Giữ thứ tự máy chủ trả.
- **R12. Danh sách dự kiến** (khi `preview` khác `null`): bảng ví và số dư sẽ bị thu hồi, tổng số ví và tổng WPT; `preview.truncated` thì cảnh báo.
- **R13. Khoá chain**: `chainLock` khác `null` và `stale` false: `WITHDRAW` "Có lệnh rút vault đang xử lý; Kiểm soát viên xử lý ở màn Vault trước", `CONFIG` "Đang lưu cấu hình vault", `RECALL` "Đang có thao tác thu hồi khác".
- **R14. Giao dịch viên**: thấy R3, R4, R11, R12, R13; không thấy khối và nút ghi (`canManage` do máy chủ trả).
- **R15. Lỗi**: lỗi từ action ghi hiện trong hộp thoại hoặc dưới nút, `role="alert"`, chuyển tiêu điểm tới lỗi; lỗi tải tổng quan hiện khối lỗi có nút "Thử lại".

### Nhà đầu tư và Người bán

- **R16. `/portfolio`**: `recallNoticeText(recall)` trả tiêu đề và nội dung; `AssetSummary` hiện ở đầu thẻ, khung cảnh báo theo mẫu có sẵn ở `price-config.tsx` (`border-amber-400/60 bg-amber-50 text-amber-950`, nền tối `dark:bg-amber-950/40 dark:text-amber-100`):
  - `NOTICE`: "Dự án hết hạn ngày {maturityDate}. Từ ngày {recallFrom} ngân hàng sẽ thu hồi {amount} WPT trong ví này (còn {daysLeft} ngày). Giao dịch mua bán đã tạm dừng. Thanh toán thực hiện ngoài hệ thống." (`daysLeft` 0: "từ hôm nay"; âm: bỏ cụm "còn … ngày")
  - `FROZEN`: "WPT đang bị đóng băng để thu hồi. Số WPT sẽ hoặc đã bị thu hồi: {amount}."
  - `CLOSED`: "Dự án đã đóng. Đã thu hồi {amount} WPT của ví này."
  - Ngày qua `formatVnDate`, số qua `formatAmount`.
- **R17. Nhãn lịch sử giao dịch**: `lib/txn-labels.ts` với `OPERATION_LABELS` và `operationLabel(code)`; dùng ở `components/investor/transaction-history-box.tsx` và `components/pages/mint.tsx` (hai chỗ đang in thẳng `operation`; người làm grep thêm). Nhãn: `purchase` "Mua", `sale` "Bán", `mint` "Phát hành", `mintInitialSupply` "Phát hành nguồn cung ban đầu", `payment-mint` "Cấp VNDB thử", `burn` "Huỷ token", `recall` "Thu hồi", `freeze` "Đóng băng toàn hệ thống", `unfreeze` "Mở đóng băng", `whitelist` "Định danh ví", `distribute` "Nhận chia lợi nhuận", `distribution-open` "Mở kỳ chia", `vault-close-period` "Chốt kỳ vault", `vault:withdraw` "Rút VNDB từ vault"; mã bắt đầu bằng `vault:` còn lại: "Cấu hình vault"; mã khác: nguyên mã.
- **R18. `/trade`**: khi `tradeBlock` khác `null`:
  - Khối "Giao dịch tạm dừng" trên biểu mẫu, câu dựng từ `tradeBlock` (QĐ-F6) và đường dẫn "Xem thông báo ở Tổng quan" tới `/portfolio`.
  - Biểu mẫu khoá: `components/trading/gates.ts` `confirmBlockReason` nhận thêm tham số thứ năm tuỳ chọn `tradeBlocked = false` (ba lời gọi trong `investor-trading.test.ts` giữ nguyên) và trả lý do khi true; các ô `disabled`.
  - Dòng "Trạng thái giao dịch" của thẻ token: `tradingStatusLabel`.
- **R19. Tổng quan Người bán**: dòng "Trạng thái giao dịch" dùng `tradingStatusLabel(recallPhase, tradingOpen, 'seller')`.
- **`tradingStatusLabel(phase, tradingOpen, page)`**: mở: `'trade'` "Đang mở", `'seller'` "Đang mở bán"; đóng: `NOTICE` "Tạm dừng (đến hạn dự án)", `FROZEN` "Tạm dừng (đã đóng băng)", `CLOSED` "Đã đóng", `NONE` hoặc `SCHEDULED` mà không mở (cờ đóng băng bật ngoài đợt) "Tạm dừng (đang đóng băng)".

### Dọn từ BE-05

- **R20.** Dò ra đúng 26 dòng; sửa tay 25 dòng có mũi tên phải (U+2192), gạch dài (U+2014) hoặc chấm giữa (U+00B7) mà BE-05 thêm vào. Lệnh dò (UTF-8):
  ```bash
  git diff 4767e01^1 4767e01 | python3 -c "import sys,re;[print(l,end='') for l in sys.stdin if l.startswith('+') and not l.startswith('+++') and re.search('[\\u2192\\u2014\\u00b7]',l)]"
  ```
  Theo tệp: `app/test/be-05-recall.test.ts` 4, `be-05-recall-evm.test.ts` 1, `be-05-recall-postgres.test.ts` 1, `maker-checker-ui.test.ts` 1, `token-request.test.ts` 1, `docs/CHECKPOINT_BE05.md` 11, `docs/tech-report.md` 7. Trong tech-report, dòng do `scripts/scan-pending.mjs` sinh (dòng tổng số điểm cắm và điểm chặn) là 1 trong 26 dòng đó: không sửa tay, chạy lại script sau khi sửa các dòng khác (nếu script vẫn sinh ký tự đó thì giữ, ghi vào checkpoint). Không đụng mã nguồn và tài liệu khác.

## 6. Hiệu năng (điều kiện nghiệm thu)

- Mở `/recall`: đúng 1 server action, cả hai vai.
- Mở `/portfolio`, `/trade`, tổng quan Người bán: số action bằng nền. Cách đo: Playwright đếm yêu cầu `POST` có header `next-action` từ `goto` tới `networkidle` (mẫu `e2e/token-info-read.spec.ts`), chạy trên mã nền và mã mới.
- Không dùng đồng hồ máy khách để quyết định gì về mốc thời gian.

## 7. Ca kiểm

Vitest môi trường `node` (không DOM) theo mẫu `test/maker-checker-ui.test.ts`; E2E Playwright dự án `mock`.

| Ca | Nội dung | Kỳ vọng |
|---|---|---|
| 1 | gates `currentStep`: không đợt, `SCHEDULED`, `NOTICE`, `FROZEN`, `CLOSED`, `CANCELLED` | Đúng R3 |
| 2 | gates `recallControls`: mọi trạng thái đợt; `canManage` true và false; dự án `DRAFT`, `ISSUED`, `CLOSED` | Giao dịch viên không có nút ghi; mở đợt chỉ khi `ISSUED`; đúng R5 tới R10 |
| 3 | gates: có `freezeRequestedAt` chưa `IN_PROGRESS`; có `unfreezeRequestedAt` | "Kiểm tra lại", không hiện nút gửi mới; thu hồi `blocked` |
| 4 | gates: `canUnfreeze` false | Không có nút mở đóng băng, có câu R9; thu hồi `next` |
| 5 | `symbolMatches`: đúng; sai hoa thường; có khoảng trắng đầu cuối | Bật; khoá; bật |
| 6 | gates thu hồi: `first` hỏi xác nhận, `next` không; `settlementMode` false hoặc khoá chain còn hạn thì `blocked` | Đúng R10 |
| 7 | `operationLabel`: các mã ở R17, mã `vault:setPercentRate`, mã lạ | Đúng |
| 8 | `tradingStatusLabel`: mọi pha, mở và đóng, hai trang | Đúng |
| 9 | (mới, trong `be-05-recall.test.ts`) `getTradeContext` khi `NOTICE`, `FROZEN`, `CLOSED`, cờ đóng băng bật không có đợt, không chặn | `ok`; `tradeBlock` và `token.tradingOpen` đúng; `placeOrder` vẫn `REQUEST_STATE` |
| 10 | `freezeBlockers` (thuần) cho từng điều kiện, khoá `RECALL` còn hạn và quá hạn, khoá `WITHDRAW`; tổng quan trả `today`, `minNoticeDays`, `canFreeze` | Khớp `freezeToken`: khi `canFreeze` true thì `freezeToken` không bị từ chối vì điều kiện |
| 11 | `minNoticeDaysFor`: `mock`, `hardhat-local`, chain EVM thường cờ tắt và bật | 0, 0, 1, 0 |
| 12 | `recallNoticeText`: ba pha; `daysLeft` dương, 0, âm | Đúng R16 |
| 13 | `confirmBlockReason` với `tradeBlocked` true | Có lý do, nút gửi khoá |
| 14 | Menu: hai vai vận hành có mục đúng nhãn và vị trí; Nhà đầu tư, Người bán không có; `opsOnly` chứa `/recall` | Đúng |
| 15 | Trên `hardhat-local`: mở đợt, đóng băng, thu hồi tới khi dự án đóng; Nhà đầu tư thấy dòng "Thu hồi" có mã giao dịch | Đạt; ảnh chụp lưu `docs/images/fe-10/`. Người làm chạy được bằng Playwright với ví giả hoặc chạy tay; không chạy được thì ghi rõ, Supervisor chạy |
| 16 | E2E `e2e/recall.spec.ts` (xem design mục 5): mở đợt (ngày lấy từ thuộc tính `min` của ô ngày, 0 ngày báo trước); `/trade` của Nhà đầu tư hiện khối tạm dừng và biểu mẫu khoá; Giao dịch viên thấy màn không có nút ghi; Kiểm soát viên đóng băng (gõ ký hiệu), mở đóng băng, huỷ đợt; `/trade` mở lại | Đạt; mở `/recall` đúng 1 action với mỗi vai |
| 17 | E2E dọn dẹp `afterAll` khi ca 16 hỏng giữa chừng | Các tệp E2E chạy sau vẫn xanh |

## 8. Đột biến (mỗi đột biến làm ít nhất một ca đỏ)

- gates trả nút ghi khi `canManage` false (ca 2).
- Mở đợt khi dự án chưa `ISSUED` (ca 2).
- gates hiện nút gửi đóng băng khi đã có `freezeRequestedAt` (ca 3).
- gates hiện nút mở đóng băng khi `canUnfreeze` false (ca 4).
- `symbolMatches` không phân biệt hoa thường (ca 5).
- Bỏ hỏi xác nhận ở lần thu hồi đầu tiên (ca 6).
- Thiếu nhãn `recall` (ca 7).
- `getTradeContext` trả lại lỗi khi bị chặn (ca 9).
- `freezeBlockers` bỏ điều kiện kỳ chia, hoặc coi khoá `RECALL` quá hạn là bận (ca 10).
- `minNoticeDaysFor` trả 0 cho chain EVM thường khi cờ tắt (ca 11).
- `recallNoticeText` sai pha (ca 12).
- `confirmBlockReason` bỏ qua `tradeBlocked` (ca 13).
