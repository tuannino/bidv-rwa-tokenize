# recall.html (màn `/recall`, Thu hồi token)

Màn thật đã đọc (dev `67ece1e`): `app/src/app/(ops)/recall/page.tsx` (breadcrumbs "Vận hành / Thu hồi token", cổng `ops:read`), `app/src/components/pages/recall.tsx`, toàn bộ `app/src/components/recall/` (`cases-table.tsx`, `controls.tsx`, `dialogs.tsx`, `gates.ts`, `round-info.tsx`, `steps.tsx`), `app/src/app/actions/recall.ts`. Đối chiếu thêm `lib/bank/recall.service.ts` (`getRecallOverview`, `freezeBlockers`, `recallBatch`, `minNoticeDaysFor`, `RECALL_BATCH_SIZE = 10`), `lib/bank/recall-phase.ts` (`recallPhaseOf`, `addDays`, `daysBetween`), `lib/store/memory.settlement.store.ts` (mở đóng băng xoá hồ sơ chưa đốt), `e2e/recall.spec.ts`, `docs/USER_GUIDE.md` (Phụ lục B, C).
Vai: Kiểm soát viên (mặc định, thao tác, quyền `settlement:recall`), Giao dịch viên (chỉ xem, menu "Thu hồi token (chỉ xem)"). Tệp menu sáng: `recall.html` (mục có sẵn trong `assets/shell.js`).

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Thu hồi token", câu phụ "Lập lịch, đóng băng và thu hồi WPT khi dự án hết hạn. Thanh toán thực hiện ngoài hệ thống trong phạm vi PoC." | `RecallPage` | |
| Thanh "Trạng thái xem thử": Kiểm soát viên 11 tab, Giao dịch viên 9 tab (bỏ "Chờ đóng băng", "Thao tác bị chặn" vì vai này không có nút) | Không có trên màn thật | Mặc định "Đã đóng băng" (có đủ bước, hồ sơ và hai nút chính) |
| Câu "Đang tải tình trạng thu hồi..." | `!loaded` (recall.tsx:132-134) | `.empty` có biểu tượng loader; tab "Đang tải" |
| Câu lỗi "Không tải được tình trạng thu hồi.", nút "Thử lại" | `loadError` (recall.tsx:135-142) | Tab "Lỗi tải" |
| Bốn bước "Đã mở đợt", "Đến hạn", "Đã đóng băng", "Hoàn tất" | `RecallSteps`, `currentStep` (SCHEDULED 1, NOTICE 2, FROZEN 3, CLOSED 4), bước hiện tại `aria-current="step"` | Ẩn khi chưa có đợt hoặc đợt đã huỷ; dùng `.steps` của bản chốt (xong, đang) |
| Thẻ "Tình trạng đợt thu hồi" | `Card` + `RoundInfo` | |
| Nhãn "Đợt: ..." (Chưa có đợt, Chưa mở, Đã lập lịch, Đang báo trước, Đang thu hồi, Đã hoàn tất) | `PHASE_LABEL`, Badge secondary | Nhãn xanh dương |
| Nhãn "Chế độ PoC" | `overview.demoMode` | Mẫu để tắt (cờ `ENABLE_DEMO_RECALL` mặc định tắt) |
| Nhãn "Đã huỷ" | `round.status === 'CANCELLED'` | Nhãn đỏ |
| Nhãn "Token trên chuỗi: Đang mở, Đang đóng băng, Đã đóng băng sau thu hồi, Không đọc được" | `settlementMode`, `completed` | Đỏ khi đang đóng băng và chưa hoàn tất |
| Mười ô: Dự án, Ngày hết hạn, Bắt đầu thu hồi, Báo trước, Tới ngày hết hạn, Tới ngày thu hồi, WPT ngoài vault, Lệnh đang xử lý, Kỳ chia đang mở, Mở đợt lúc | `Item` trong `RoundInfo` | Ngày `formatVnDate`, thời điểm `formatDateTime`; "Hôm nay", "Còn N ngày", "Đã qua N ngày" |
| Câu "Đợt gần nhất đã huỷ: hết hạn ..., bắt đầu thu hồi ..." | `round.status === 'CANCELLED'` | Tab "Đã huỷ" |
| Câu "Dự án đã đóng lúc ..." | `project.status === 'CLOSED' && round.completedAt` | Tab "Hoàn tất" |
| "Lý do: ..." | `round.reason` | |
| Cảnh báo khoá chain (lệnh rút vault, cấu hình vault, thao tác thu hồi khác) | `chainLockMessage` | Logic có trong trang, không dựng tab riêng |
| Cảnh báo "Danh sách ví đang bị cắt; không thể đóng băng an toàn." | `preview.truncated` | Logic có, không dựng tab riêng |
| Khối vàng "Chưa thể đóng băng:" và danh sách lý do | `freezeBlockers` (chưa tới ngày thu hồi, còn lệnh đang xử lý, còn kỳ chia, ví bị cắt, khoá chain, không đọc được trạng thái) | Tab "Đã lập lịch": chưa tới ngày 30/01/2027 và còn 2 lệnh đang xử lý |
| Khối tiến độ lô "Đã đốt N; đang chờ N; lỗi N; còn lại N. WPT ngoài vault: ...", " Đợt thu hồi đã hoàn tất." | `progress` sau `recallBatchAction` | Hiện sau khi bấm Thu hồi toàn bộ hoặc Thu hồi lô tiếp theo |
| Câu "Giao dịch viên chỉ được xem tình trạng và danh sách hồ sơ." | `!overview.canManage` | Thay toàn bộ nút ở vai Giao dịch viên |
| Nút "Mở đợt thu hồi" | `controls.open` (dự án ISSUED, chưa có đợt hoặc đợt đã huỷ) | |
| Nút "Sửa mốc", "Huỷ đợt" | `controls.reschedule` (INITIATED, chưa yêu cầu đóng băng), `controls.cancel` (thêm điều kiện chưa đóng băng trên chuỗi) | |
| Nút "Đóng băng trên toàn hệ thống" | `freeze === 'send'` (`canFreeze`) | Tab "Đến hạn" |
| "Đang chờ xác nhận đóng băng", nút "Kiểm tra lại", câu "Quá 10 phút chưa có xác nhận, hệ thống sẽ gửi lại lệnh. Gửi lại không gây hại." | `freeze === 'recheck'` | Tab "Chờ đóng băng" |
| Nút "Mở đóng băng trên toàn hệ thống" (hoặc "Đang chờ xác nhận mở đóng băng" + "Kiểm tra lại") | `unfreeze === 'send' / 'recheck'` | |
| Câu "Đã bắt đầu thu hồi, không mở đóng băng được nữa." | `unfreeze === 'locked-after-burn'` | Tab "Đang thu hồi" |
| Nút đỏ "Thu hồi toàn bộ" (lô đầu, qua hộp xác nhận), "Thu hồi lô tiếp theo" (gửi ngay, chữ đổi "Đang thu hồi lô (tối đa 10 ví)...") | `recall.mode === 'first' / 'next'` | |
| Câu lý do chặn thu hồi, câu "Dự án đã đóng.", "Dự án chưa phát hành nên chưa mở được đợt thu hồi." | `recall.blockedReason`, `openBlockedReason` | |
| Câu lỗi thao tác ngoài hộp thoại | `actionError && stage === 'idle'` (recall.tsx:167) | `.alert bad`. Tab "Chờ đóng băng": lần "Kiểm tra lại" đầu tiên trả "Giao dịch đóng băng đang chờ xác nhận." (recall.service.ts), lần sau đã xác nhận. Lỗi trong hộp thoại vẫn còn hiện ở đây sau khi đóng hộp như dev |
| Hộp thoại đang chạy: nút gửi đổi chữ "Đang xử lý...", nút "Đóng" và nút gửi khoá, không đóng được bằng phím Esc | `RecallDialog` `busy` (dialogs.tsx:47, 56-63) | Mọi hộp thoại |
| Dòng lỗi trong hộp thoại | `RecallDialog` `error` (dialogs.tsx:54, `role="alert"`, nhận focus) | Tab "Thao tác bị chặn": lần gửi đầu tiên ở bất kỳ hộp thoại nào trả "Đang có thao tác khác trên chain; vui lòng chờ thao tác đó kết thúc." (`withRecallLock`), gửi lại thì qua |
| Thẻ "Hồ sơ thu hồi" hoặc "Danh sách ví dự kiến" | `cases.length > 0 ? ... : ...` | |
| Câu "Dự kiến N ví, tổng X WPT." | `previewTotal` khi chưa có hồ sơ | 128 ví, 3.412.500 WPT |
| Câu rỗng "Chưa có ví ngoài vault cần thu hồi." | `rows.length === 0` | Logic có |
| Bảng: Ví (rút gọn 12 và 8 ký tự, nút sao chép), WPT, Đã đốt, Trạng thái, Giao dịch / lỗi | `RecallCasesTable` | Trạng thái thành nhãn màu: Dự kiến, Chờ đốt, Đang gửi, Đã đốt, Lỗi; giao dịch là liên kết "Xem giao dịch" chỉ trên evm, chain khác là mã rút gọn 10 và 8 ký tự; lỗi in đỏ dưới ô |
| Hộp "Mở đợt thu hồi" hoặc "Sửa mốc thu hồi": câu "Ngày hết hạn không được trước hôm nay. Chain này cần báo trước ít nhất N ngày.", Ngày hết hạn, Số ngày báo trước, "Ngày bắt đầu thu hồi: ...", Lý do, "n/200 ký tự", nút "Đóng", "Mở đợt" hoặc "Lưu mốc mới" | `RecallDialog` thứ nhất, `datesValid`, `reasonValid` | Mặc định ngày mai và 30 ngày; Sửa mốc lấy mốc đang có; N = 0 trên mock, hardhat-local, 1 trên evm |
| Hộp "Huỷ đợt thu hồi": câu "Huỷ đợt sẽ mở lại giao dịch nếu đã tới ngày hết hạn. Đợt đã huỷ vẫn được giữ trong lịch sử.", Lý do huỷ, nút "Đóng", "Xác nhận huỷ" (đỏ) | `RecallDialog` thứ hai | |
| Hộp "Đóng băng token", "Thu hồi lô đầu", "Mở đóng băng token": câu mô tả theo loại, ô "Gõ WPT để xác nhận", ô "Lý do mở đóng băng" (chỉ mở đóng băng), nút "Đóng" và nút xác nhận | `RecallDialog` thứ ba, `symbolMatches` | Nút xác nhận khoá tới khi gõ đúng ký hiệu (và lý do 5 tới 200 ký tự khi mở đóng băng); nút đỏ trừ Mở đóng băng |

Trang chạy được trọn luồng như e2e: Chưa mở đợt, Mở đợt (ngày hôm nay, 0 ngày), Đóng băng, Thu hồi toàn bộ, Thu hồi lô tiếp theo cho tới khi đủ 128 ví thì chuyển sang Hoàn tất (dự án đóng); Mở đóng băng đưa đợt về trước đóng băng và bỏ hồ sơ chưa đốt; Huỷ đợt chuyển sang đợt đã huỷ. Logic cổng nút chép từ `gates.ts`, lý do chặn đóng băng chép từ `freezeBlockers`.

Dữ liệu mẫu: hôm nay 23/10/2026; dự án "Dự án điện gió An Viên (WPT)"; 128 ví ngoài vault cùng bộ với màn Chia lợi nhuận (NDT001 `0x70997970…dc79C8` giữ 150 WPT và 127 ví khác), tổng 3.412.500 WPT, khớp tổng cung 10.000.000 trừ 6.587.500 trong vault. Hồ sơ lưu ví chữ thường như `recallWallets`. Tab "Đang thu hồi": 19 ví đã đốt, 1 ví lỗi "Gửi giao dịch đốt không thành.", 108 ví chờ đốt.

## Thay đổi so với bản chốt (dev mới)
- Màn mới hoàn toàn, chưa có trong bản chốt (bản chốt dựng trên dev `f164939`). Nguồn: `57c4fbb` (BE-05: đợt thu hồi, chặn đặt lệnh, đóng băng, mở đóng băng, đốt theo lô; tạo `actions/recall.ts`), `34623ef` (FE-10: màn Thu hồi token), `5e26fb1` (FE-10: nhãn "Đợt: ...", pha FROZEN đổi thành "Đang thu hồi", nhãn "Token trên chuỗi: ..." có "Đã đóng băng sau thu hồi", bước đã xong rõ hơn), `ea9fe5f` (UIUX-01: "Chế độ trình diễn" đổi thành "Chế độ PoC").
- Mục menu "Thu hồi token (chỉ xem)" cho Giao dịch viên và "Thu hồi token" cho Kiểm soát viên đã có sẵn trong `assets/shell.js`; trang khai `data-nav="recall.html"`, `data-roles="controller,teller"`.
- Trình bày theo phong cách bản chốt: bước tiến độ trong thẻ riêng; mười trường thành lưới ô `.kv-grid` năm cột; nhãn trạng thái trên đầu thẻ; khối chặn và tiến độ thành `.alert`; ba hộp xác nhận là hộp nổi `<dialog>` mở bằng nút.

- Theo rà soát độc lập: thêm chữ "Đang xử lý..." khi hộp thoại đang chạy, dòng lỗi trong hộp thoại, lỗi ngoài hộp thoại khi kiểm tra lại đóng băng; ô tải dùng `.empty`.

Breadcrumb ("Vận hành / Thu hồi token") không vẽ: chủ dự án đã bỏ dòng phụ trên tiêu đề; khung trang là `assets/shell.js`.

## Trạng thái giữ theo dev, chưa vẽ
- Cảnh báo khoá chain trong thẻ tình trạng (lệnh rút vault, cấu hình vault, thao tác thu hồi khác): round-info.tsx:55, gates.ts:42-49; logic có trong trang.
- "Danh sách ví đang bị cắt; không thể đóng băng an toàn.": round-info.tsx:56; logic có trong trang.
- Nhãn "Chế độ PoC": round-info.tsx:34, cờ `ENABLE_DEMO_RECALL` mặc định tắt.
- "Đang chờ xác nhận mở đóng băng" + "Kiểm tra lại", lý do chặn "Đang mở đóng băng; không thể đồng thời gửi lệnh thu hồi.": controls.tsx:32, gates.ts:79-80; logic có trong trang.
- Danh sách lỗi theo ví trong khối tiến độ lô (`progress.errors`): round-info.tsx:67; mô phỏng lô luôn thành công.
- "Chưa có ví ngoài vault cần thu hồi.": cases-table.tsx:49; logic có trong trang.

## Có đụng backend: Không
Mọi trường có sẵn trong `getRecallOverviewAction` (một action khi mở màn); thao tác dùng sáu action còn lại của `actions/recall.ts`.

## Lệch đã thấy (để chủ dự án quyết)
- Khi đang tải hoặc lỗi tải, dev trả về sớm chỉ một dòng chữ, không có tiêu đề và câu phụ (recall.tsx:132-142); bản xem thử giữ tiêu đề để đặt thanh trạng thái xem thử.
- Màn thật không có ô số liệu nổi bật nào (không `kpi hl`/`kpi au`); bản này giữ đúng như vậy, chỉ dùng lưới ô.
- Rút gọn mã ở màn này dùng ba dấu chấm ("..."), màn Giá và phát hành, Chia lợi nhuận dùng ký tự "…".
- Bảng hồ sơ không phân trang (in đủ mọi ví); bản xem thử cho cuộn trong khung cao 480 px.
- Lý do mở đợt không đổi khi Sửa mốc hoặc Huỷ đợt (máy chủ chỉ ghi lý do mới vào sổ kiểm toán), nên dòng "Lý do:" vẫn là lý do mở đợt ban đầu.
