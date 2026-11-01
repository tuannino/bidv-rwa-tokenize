# approval-detail.html (màn `/approvals/[id]`, Chi tiết yêu cầu)

Màn thật (dev `67ece1e`): `app/src/app/(control)/approvals/[id]/page.tsx` (breadcrumbs "Kiểm soát / Phê duyệt lệnh / <8 ký tự mã>"), `app/src/components/pages/approval-detail.tsx` (`ApprovalDetailPage`, `outcomeFeedback`, `Row`), `components/maker-checker/token-info-block.tsx`, `gates.ts` (`decisionBlockReason`, `approveBlockReason`, `approveWarningFigures`, `rejectBlockReason`, `BURN_SOURCE_LABELS`), `status-badge.tsx`. Đã đối chiếu `lib/bank/token-request.service.ts` (`getTokenRequestDetail`: `selfApprovalReason`, `canReconcile`, `approveWarning` qua `approveWarningOf`, `custodyLabel` qua `custodyLabelOf`/`recordedCustodyLabel`, `timelineOf`), `lib/bank/custody.service.ts` (`custodyFor`), `docs/RUNBOOK_FIREBLOCKS.md` (vault 11, địa chỉ `0xc7F6…83F1`, bảng chain mặc định chỉ `evm`).
Vai: chỉ Kiểm soát viên. Tệp menu sáng: `approvals.html`.

Trang đọc mã sau dấu `#` để hiện một trong năm yêu cầu mẫu: `7f3a21c0` (mặc định), `c02f9a17` chờ duyệt; `91bd0e44` đang xử lý; `5e0c7b92` hoàn tất; `a4471f3d` từ chối. Breadcrumb không vẽ trong bản xem thử (quyết định của chủ dự án), mã đầy đủ hiện dưới tiêu đề. Cả năm yêu cầu thuộc chain mock.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Chi tiết yêu cầu", mã đầy đủ, liên kết "Về danh sách" | header, `Link href="/approvals"` | |
| Thanh "Trạng thái xem thử": Theo dữ liệu, Cảnh báo khi duyệt, Không đọc được token, Duyệt chưa có xác nhận, Duyệt bị lỗi | không phải khối thật | Bốn tab sau chỉ dùng được với yêu cầu Chờ duyệt |
| Thẻ "Hành động", nhãn trạng thái | `StatusBadge` | |
| Khung lý do khoá (ổ khoá) | `decisionBlockReason(detail)` | Mở `#91bd0e44`, `#5e0c7b92`, `#a4471f3d` để thấy |
| Ô "Lý do từ chối" | `textarea#reject-reason` | Gợi ý trong mã có gạch dài, trang dùng dấu phẩy |
| Khung cảnh báo vàng khi duyệt: câu đậm, dòng số liệu, "Nút "Chấp nhận" đã khoá; có thể từ chối yêu cầu này." | `approveWarning`, `approveWarningFigures`, `data-testid="approve-warning"` | Mint: "Không đủ số lượng token còn được phép phát hành." + "Số lượng yêu cầu 250.000; còn được phép phát hành 120.000."; Burn: "Không đủ số lượng token chưa phân phối còn lại." + "...; phần chưa phân phối còn 40.000." |
| Nút "Chấp nhận" | `approveBlock = approveBlockReason(detail)` | Khoá khi có lý do khoá hoặc có cảnh báo; `title` là câu cảnh báo |
| Nút "Từ chối", dòng "Từ chối: Phải nhập lý do từ chối." | `rejectBlock` | Cảnh báo không khoá nút này |
| Nút "Đối soát" | `detail.canReconcile` (EXECUTING, có `txHash` hoặc custody FIREBLOCKS kể cả chưa có mã, có `order:approve`) | Hiện ở `#91bd0e44` và sau khi duyệt ở tab "Duyệt chưa có xác nhận" |
| Khung phản hồi sau thao tác, rồi đọc lại chi tiết | `outcomeFeedback` (success, warning, error), `reload()` | Chấp nhận: "Đã chấp nhận. Yêu cầu đã thực hiện xong trên chuỗi.", nhãn thành Hoàn tất, nút khoá, nhật ký thêm dòng. Tab "Duyệt chưa có xác nhận": "Đã gửi lên chuỗi nhưng chưa có xác nhận sau 30 giây. Yêu cầu giữ trạng thái Đang thực hiện; bấm Đối soát sau ít phút." (vàng), nhãn Đang xử lý, hiện nút Đối soát. Tab "Duyệt bị lỗi": câu `describeInvalid` của lần kiểm lại (đỏ), rồi đọc lại như màn thật (`approval-detail.tsx:147`): khối token ra số mới (còn được phát hành 120.000), hiện cảnh báo vàng, khoá nút Chấp nhận. Từ chối: nhãn Từ chối, "Thực hiện qua" thành "Không thực hiện (đã từ chối)" |
| Câu lỗi đỏ thay danh sách trong khối token | `detail.tokenError` | Tab "Không đọc được token": "Chưa có dự án \"WPT\" trên chuỗi \"mock\"." kèm cảnh báo TOKEN_UNREADABLE "Không đọc được số liệu token để kiểm tra." (không có dòng số liệu) |
| Thẻ "Thông tin token" (10 dòng) | `TokenInfoBlock` | Đứng bên trái như màn thật; ở trạng thái cảnh báo các số đổi thành một bộ tự khớp |
| Thẻ "Nội dung yêu cầu" 13 dòng: Loại, Token, Số lượng, Nguồn (chỉ yêu cầu huỷ), Ví tác động, Lý do, Chứng từ, Ngày hiệu lực, Ghi chú, Người lập, Thời điểm lập, Mã giao dịch, Thực hiện qua | `detail.request.*`, `detail.custodyLabel` | Giá trị thiếu là "–" |
| Dòng "Thực hiện qua" | `custodyLabelOf` (`token-request.service.ts:1466-1480`) | Yêu cầu Chờ duyệt đọc công tắc của khung qua tham số `?custody=` dùng chung với `shell.js`: mặc định và `on` là "Khoá ký máy chủ" (mock không có trong bảng chain của Fireblocks, mặc định chỉ `evm`); `unreadable` là "Chưa đọc được"; `badscope` là "Chưa xác định (bảng chain của Lưu ký Fireblocks sai)". Đã duyệt: "Khoá ký máy chủ"; từ chối: "Không thực hiện (đã từ chối)" |
| Thẻ "Nhật ký" | `detail.timeline[]` (`timelineOf`) | Đang xử lý: "Chấp nhận, đang xử lý trên chuỗi", chi tiết "Đã gửi giao dịch ..., chưa biết kết cục, cần đối soát." |

## Thay đổi chỉ là trình bày
Khối Hành động: ô lý do và cảnh báo bên trái, nút lớn bên phải; hai thẻ thông tin đứng cạnh nhau; nhật ký nối người thao tác bằng dấu phẩy.

## Thay đổi so với bản chốt (dev mới)
- Thêm khung cảnh báo khi duyệt, khoá riêng nút "Chấp nhận" (FIX-02 `90995a1`, B3, QĐ-4). Thêm thanh trạng thái xem thử để thấy cảnh báo.
- Thêm dòng "Thực hiện qua" cuối "Nội dung yêu cầu" (IN-04 `ef48347`, C7).
- Đổi thứ tự hai thẻ cho đúng màn thật: "Thông tin token" trước, "Nội dung yêu cầu" sau (màn thật đã như vậy từ trước, bản chốt đặt ngược).
- Sửa nhãn nhật ký của yêu cầu Đang xử lý cho đúng `timelineOf` ("Chấp nhận, đang xử lý trên chuỗi"), bản chốt ghi sai.
- Người lập `a4471f3d` là GDV001 để khớp draft.html.

## Có đụng backend: Không

## Lệch đã thấy
- "Ngày hiệu lực" in nguyên chuỗi ISO (`2026-10-24`), không theo `formatVnDate`.
- Câu nhật ký Đang xử lý và gợi ý ô lý do từ chối có gạch dài trong mã; trang đổi thành dấu phẩy.
- Chain đang chọn khác mock: máy chủ trả lỗi "Yêu cầu <mã> thuộc chain mock, không phải chain đang chọn <chain>." (`token-request.service.ts:1587-1591`), màn chỉ còn tiêu đề và khung lỗi đỏ; đổi Chain ở thanh bên để xem.
- Bộ dữ liệu mẫu chung không có địa chỉ hợp đồng WPT; trang dùng `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
- Địa chỉ vault, ví thanh toán SPV trên mock đổi thành `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2` (`packages/shared/src/mock-vault.ts`; trên mock Mint chỉ vào vault nên ví SPV là vault). config.html, distribution.html, demo-payment.html vẫn dùng `0x0da94B…6861`.

## Trạng thái giữ theo dev, chưa vẽ
- Đang tải: màn chỉ có tiêu đề, khối chi tiết chưa hiện; "Đang tải yêu cầu…" chỉ là `title` của nút Chấp nhận (`approval-detail.tsx:137-139`).
- Cảnh báo BURN_FULL_SUPPLY "Tổng cung đã đổi so với lúc lập yêu cầu huỷ toàn bộ nguồn cung." kèm "Số lượng yêu cầu ...; tổng cung hiện tại ..." (`token-request.service.ts:1516-1523`, `gates.ts` `approveWarningFigures`): mẫu không có yêu cầu huỷ toàn bộ nguồn cung.
- Câu `notice` khi giữ Đang xử lý qua Fireblocks (`approval-detail.tsx:68-69`, `token-request.service.ts` `keepExecuting`) và câu đối soát thất bại "Đã đối soát: giao dịch không thực hiện được trên chuỗi, yêu cầu chuyển Thất bại (...)." (`approval-detail.tsx:79-85`).
- Nhãn "Thực hiện qua" chỉ có trên chain trong bảng Fireblocks: "Fireblocks, vault <id> (<địa chỉ rút gọn>)", "Fireblocks (thiếu cấu hình; lần duyệt sẽ bị chặn)", và "; mã Fireblocks <mã>" sau khi duyệt (`token-request.service.ts:1453-1480`).
- Lý do khoá `selfApprovalReason` "Bạn (KSV001) đã lập yêu cầu này nên không được duyệt hay từ chối nó, kể cả khi có quyền." (`token-request.service.ts:1612-1615`): mẫu không có yêu cầu do KSV001 lập.

