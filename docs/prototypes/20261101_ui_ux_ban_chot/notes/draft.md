# draft.html (màn `/draft`, Lập lệnh)

Màn thật: `app/src/app/(ops-draft)/draft/page.tsx` (breadcrumbs "Vận hành", "Lập lệnh"), `app/src/components/pages/draft.tsx` (`DraftPage`, `RequestForm`, `Field`). Component con đã đọc: `components/maker-checker/stat-card.tsx`, `token-info-block.tsx`, `token-info-read.ts`, `request-check-block.tsx`, `request-table.tsx`, `status-badge.tsx`, `gates.ts`. Câu chữ khối kiểm tra lấy từ `lib/bank/token-request.service.ts` (`evaluate`). Vai: Giao dịch viên.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Lập lệnh", câu phụ, "Chain đang xem: mock" | `DraftPage` header, `useSelectedChain().chain` | Chain đổi theo dropdown Chain (`data-chain-label`) |
| Ô "Yêu cầu tạo token đang chờ" (xanh nổi bật) | `StatCard`, `getDraftStatsAction(chain).pendingMint` | Đếm theo `makerId` của phiên: GDV001 có 1 |
| Ô "Yêu cầu huỷ token đang chờ" (vàng) | `StatCard`, `getDraftStatsAction(chain).pendingBurn` | GDV001 có 1. Giá trị `null` hiện "–" (màn thật dùng gạch ngang dài) |
| Dòng lỗi đọc số liệu | `freshStats.error` | Không hiện ở trạng thái có dữ liệu; nếu cần dùng `.alert.bad` |
| Thẻ "Tạo token" (biểu tượng cộng tròn) và thẻ "Huỷ token" (biểu tượng lửa) | `RequestForm type="MINT"/"BURN"`, `TYPE_TEXT` | Thêm nhãn nhỏ "Mint"/"Burn" là tên loại `type`, không phải trường mới |
| Ô "Mã hoặc ký hiệu token" (chữ hoa, mono, placeholder WPT) | `symbol`, input `id={mint|burn}-symbol` | |
| Khối "Thông tin token" (biểu tượng gió): Dự án, Hợp đồng, Trần phát hành, Số còn được phát hành, Tổng cung hiện tại, Số chưa phân phối, Số đang lưu hành, Mã người bán, Ví thanh toán, Phát hành lần đầu | `TokenInfoBlock`, `TokenInfoView` (`projectName`, `contractAddress`, `cap`, `remaining`, `totalSupply`, `undistributed`, `circulating`, `sellerCode`, `spvWallet`, `issuedAt`) qua `fetchTokenInfo` (`/api/token-info`) | Đủ 10 dòng, cùng thứ tự. Câu thay thế khi thiếu ("chưa ghi trong bảng dự án", "chưa có (chưa phát hành lần nào)") giữ nguyên trong mã |
| Trạng thái khối thông tin: rỗng "Nhập mã hoặc ký hiệu token, hệ thống tự đổ thông tin.", lỗi đỏ kèm "Mã tra cứu", nút "Thử đọc lại thông tin token" | `TokenInfoBlock` (`!info`, `error`), `tokenInfoReadErrorMessage`, `setLookupRevision` | Xem thử: xoá ô ký hiệu để thấy trạng thái rỗng; gõ ký hiệu khác WPT để thấy lỗi và nút đọc lại. "Đang đọc thông tin token…" là trạng thái tải, không dựng |
| Ô "Ví đích (ví thanh toán SPV)" chỉ đọc kèm gợi ý "Đã có ví thanh toán trên chuỗi, yêu cầu tạo token chỉ vào đúng ví này." | `info.spvWallet ?? wallet`, `readOnly`, `hint` | Khi chưa có ví: ô nhập được, gợi ý "Chưa phát hành lần nào: nhập ví thanh toán SPV sẽ nhận token." (xem thử bằng cách xoá ký hiệu) |
| Dropdown "Nguồn huỷ": Phần chưa phân phối, Toàn bộ nguồn cung | `BURN_SOURCE_LABELS`, `chooseSource` | Vẫn là `select` |
| Cảnh báo đỏ huỷ TOÀN BỘ nguồn cung kèm ô "Tôi xác nhận huỷ toàn bộ nguồn cung" | `burnSourceEffect().warning`, `confirmed` | Hiện khi chọn "Toàn bộ nguồn cung"; ô Số lượng tự điền tổng cung và khoá như màn thật |
| Số lượng, Ngày hiệu lực (2 cột) | `amount` (khoá khi `TOTAL_SUPPLY`), `effectiveDate` | |
| Lý do, Chứng từ (placeholder "Số quyết định, số hồ sơ…"), Ghi chú (textarea 2 dòng) | `reason`, `documentRef`, `note` | |
| Khối "Kiểm tra trước khi lập": từng điều kiện, Đạt/Không đạt kèm chi tiết; câu chờ "Hệ thống kiểm tra điều kiện ngay khi đủ dữ liệu." | `RequestCheckBlock`, `previewTokenRequestAction` (`checks[].label/passed/detail`) | Mint: Dự án tồn tại, Không vượt trần còn lại, Ví đích hợp lệ, Không có yêu cầu Mint khác đang chờ (trượt vì `7f3a21c0` đang PENDING). Burn: Dự án tồn tại, Có ví thanh toán SPV, Không vượt phần chưa phân phối, và Không còn token đang lưu hành khi chọn toàn bộ nguồn cung. Dạng `.checks` thay danh sách biểu tượng |
| Nút "Gửi yêu cầu tạo token"/"Gửi yêu cầu huỷ token", dòng "Chưa gửi được: …" | `submit`, `blockReason` = `submitBlockReason(preview, needsConfirmation)` | Nút khoá đúng theo lý do |
| Thông báo thành công "Đã gửi yêu cầu huỷ … (mã …). Yêu cầu đang chờ Kiểm soát viên duyệt." | `feedback` (`tone: 'success'`) | Hiện khi bấm nút gửi của thẻ Huỷ (đang mở). Thông báo lỗi dùng `.alert.bad` cùng chỗ |
| Thẻ "Yêu cầu đã lập", câu mô tả | `Card` "Yêu cầu đã lập", `CardDescription` | Nhãn "Của GDV001" là người lập của phiên (`mine: true`) |
| Bảng "Yêu cầu tạo token": Mã yêu cầu, Thời điểm lập, Token (chain), Số lượng, Người lập, Lý do, Trạng thái, Kết quả | `RequestTable` (`rows = listTokenRequestsAction({ mine: true, type: 'MINT', limit: 50 })`) | Không có cột Nguồn vì không có dòng BURN (`showSource`). Mã yêu cầu không là liên kết (màn thật không truyền `detailHref`) |
| Bảng "Yêu cầu huỷ token": thêm cột Nguồn | như trên, `type: 'BURN'`, `BURN_SOURCE_LABELS` | |
| Trạng thái (Chờ duyệt, Hoàn tất, Từ chối…) | `StatusBadge`, `STATUS_LABELS` | Đủ năm nhãn trong mã; dữ liệu mẫu dùng ba |
| Kết quả: "–", "KSV001 duyệt, tx 0x8c41e2d0a7…", "KSV001: Chứng từ chưa ký" | `resultText(row)` | Chấm giữa đổi thành dấu phẩy |
| Trạng thái rỗng bảng "Chưa lập yêu cầu tạo token nào." / "Chưa lập yêu cầu huỷ token nào.", lỗi bảng | `emptyText`, `freshMine.error` | Không hiện ở trạng thái có dữ liệu; dựng bằng `.empty` khi cần |

Lớp cục bộ: `<style>` nhỏ trong trang gồm `[hidden] { display: none !important; }` (vì `.alert`, `.checks li` đặt `display` đè thuộc tính `hidden`) và thu đệm ô bảng (`.tbl td` 8px, `.trunc` 190px) để bảng 9 cột vừa khung 1440.

## Thay đổi chỉ là trình bày
Hai thẻ số liệu thành ô bento (xanh nổi bật và vàng), số đếm lên. Hai thẻ biểu mẫu đặt cạnh nhau như màn thật (`xl:grid-cols-2`). Khối thông tin token và khối kiểm tra thành ô nền nhạt bo tròn; kiểm tra hiện bằng danh sách `.checks` có vòng đạt hoặc trượt. Thời điểm lập trong bảng tách hai dòng ngày và giờ. Các trạng thái (rỗng, lỗi đọc token, nguồn huỷ toàn bộ, gửi thành công) có thể xem bằng thao tác trên trang.

## Có đụng backend không
Không.

## Lệch đã thấy
- Bộ dữ liệu mẫu chung có HAI yêu cầu Tạo token đang chờ cho WPT (`7f3a21c0` của GDV001 và `91bd0e44` của GDV002). Điều kiện "Không có yêu cầu Mint khác đang chờ cho token này" (`evaluate`, lọc theo chain + token, không theo người lập) chặn lập yêu cầu thứ hai, nên trạng thái này không thể xảy ra qua màn thật. Trang này chỉ hiện yêu cầu của GDV001 nên không lộ mâu thuẫn, nhưng màn Phê duyệt sẽ thấy cả hai.
- Số việc chờ cạnh mục menu "Lập lệnh" trong `ui.js` là 3, nhưng theo `countPendingWork` nó đếm yêu cầu CHÍNH người này đã lập đang chờ: GDV001 có 2 (1 tạo + 1 huỷ). Đề nghị sửa `PENDING.draft` thành 2 trong tệp dùng chung (không thuộc phần này).
- Chi tiết điều kiện ở máy chủ in số nguyên thô (ví dụ `trần còn lại 10000000`), không định dạng nghìn; trang mẫu định dạng cho dễ đọc. Câu "Còn … token đang lưu hành ngoài ví SPV, không đốt…" ở máy chủ nối bằng gạch ngang dài (ký tự cấm), trang mẫu đổi thành dấu phẩy.
- Bảng hồ sơ dự án chưa có địa chỉ hợp đồng và ngày phát hành lần đầu trong bộ dữ liệu chung; trang dùng `0x5FbDB2315678afecb367f032d93F642f64180aa3` và 02/03/2026 09:00:00 làm mẫu, cần thống nhất với trang Chi tiết token nếu có.
