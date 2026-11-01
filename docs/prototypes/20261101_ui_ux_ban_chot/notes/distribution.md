# distribution.html (màn `/distribution`, Chia lợi nhuận)

Màn thật: `app/src/app/(ops)/distribution/page.tsx` (breadcrumbs "Vận hành / Chia lợi nhuận", cổng `reconcile:read`), `app/src/components/pages/distribution-approval.tsx`, `app/src/components/pages/distribution-amount-label.ts`. Đã đối chiếu thêm `lib/bank/distribution-approval.service.ts` (`getDistributionOverview`: chuỗi lý do chặn, ghi chú kỳ hoạt động, khuôn mã kỳ `chain:YYYY-MM-DD-NN`) và `lib/rbac/permissions.ts` (`distribution:approve` chỉ CONTROLLER).
Vai: Kiểm soát viên (mặc định), Giao dịch viên (chỉ xem). Tệp menu sáng: `distribution.html`.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Chia lợi nhuận", câu phụ có tên chain | `DistributionApprovalPage` header, `useSelectedChain().chain` | Tên chain đọc từ dropdown Chain (`data-chain-label`) |
| Tab "Trạng thái xem thử của màn" (Chưa có kỳ hoạt động, Đang có kỳ hoạt động, Chain không có vault) | Ba nhánh dữ liệu của `getDistributionPageAction().overview`: `active === null`, `active !== null`, `supported === false` | Chỉ để xem đủ khối; không phải điều khiển của màn thật |
| Thông báo "Kỳ đã chia xong." sau khi bấm Duyệt và chia | `message` từ `run()`, `OUTCOME[outcome]` + `result.data.message` | role status, aria-label "Kết quả thao tác chia" |
| Thẻ lý do khi chain không có vault | `!data.supported`, `approveBlockers.join(' ')` (câu `unsupportedReason(chain)`) | Hiện ở trạng thái thứ ba |
| Nhóm "Quỹ chia": Số dư quỹ (ô xanh lớn) | `data.pool.poolBalance` | |
| Chưa phân bổ (ô vàng) | `data.pool.unallocatedBalance` | |
| Tổng dự trữ các kỳ | `data.pool.reservedBalance` | |
| Ngưỡng tối thiểu | `data.pool.threshold` | |
| Thẻ "Duyệt chia" (chỉ Kiểm soát viên) | `data.viewerCanApprove` | Giao dịch viên: thẻ bị gỡ, ô Ngưỡng giãn ra 8 cột |
| Danh sách "Lý do chưa duyệt được" | `data.approveBlockers` | Ẩn khi rỗng như màn thật; mỗi lý do một dòng `checks` đỏ |
| Nút "Duyệt chia {số} VNDB" (khoá khi có lý do chặn) | `Button disabled={busy or approveBlockers.length > 0 or !pool}`, nhãn từ `pool.unallocatedBalance` (không có pool thì 0) | |
| Hộp xác nhận: tiêu đề, câu phạm vi, "Lưu ý: bấm duyệt sẽ chuyển tiền.", Huỷ, Duyệt và chia | `ConfirmDialog`, `CONFIRM_SCOPE`, `CONFIRM_TRANSFER` | Dùng `<dialog>` gốc của trình duyệt |
| Thẻ "Dự kiến (tham khảo)": câu tổng cung, chốt theo ảnh chụp, tổng dự kiến, phần dư làm tròn | `data.forecast.totalSupply`, `.allocated`, `.dust` | Chỉ câu mô tả, như màn thật |
| Cảnh báo danh sách bị cắt | `data.forecast.truncated` | Tab "Danh sách người nhận bị cắt" |
| Bảng "Người nhận dự kiến": Ví, WPT hiện tại, Phần dự kiến (VNDB), nhãn vault | `data.forecast.rows[].wallet/.balance/.share/.isVault` | Nằm trong thẻ Dự kiến (tham khảo) như màn thật; cuộn dọc (129 dòng: vault + 128 nhà đầu tư) |
| Thẻ "Kỳ hoạt động": Mã kỳ, Trạng thái, Trạng thái duyệt, Số đã duyệt, Số thực tế trên chuỗi, Chốt kỳ vault, Đã trả, Còn phải chi / lỗi | `ActivePeriodCard`, `period.*`, `progress.*`, `approvedAmountLabel(period,'cell')` | 8 ô `kv-grid`; chỉ có ở trạng thái "Đang có kỳ hoạt động" |
| Ghi chú kỳ hoạt động | `active.note` | Khung thông báo |
| "Đã gửi lên chuỗi, đang đối soát (...)" | `active.pendingOnChain`, `openTxHash`, `vaultCloseTxHash` | Mẫu "Đã gửi lên chuỗi, đang đối soát." (hồ sơ trả SENT, vault đã chốt nên không có phần chốt vault) |
| Nút "Tiếp tục chia" / "Duyệt lại số thực tế" (chỉ Kiểm soát viên) | `canApprove and nextAction === 'CONTINUE' / 'REAPPROVE'` | Tab "Đang có kỳ hoạt động" ở nhánh CONTINUE; tab "Số đổi, chờ duyệt lại" ở nhánh REAPPROVE |
| Bảng "Lịch sử kỳ chia": Mã kỳ, Trạng thái, Duyệt, Người duyệt, Thời điểm duyệt, Số duyệt, Số thực tế, Duyệt lại từ, Nguồn kích hoạt, nút Xem hồ sơ/Ẩn hồ sơ | `HistoryCard`, `DistributionHistoryRow.period/.triggerSources`, `approvedAmountLabel(period,'table')` | Thời điểm duyệt tách giờ và ngày hai dòng; Trạng thái thành nhãn màu |
| Phân trang lịch sử "Trang 1/1 (5 kỳ)", Trang trước, Trang sau | `goTo`, `result.data.total/pageSize` | |
| Bảng "Hồ sơ trả từng ví": Ví, WPT tại ảnh chụp, Số chia (VNDB), Trạng thái, Giao dịch; phân trang 10 ví | `PayoutsTable`, `PayoutRowView`, `PAYOUT_STATUS`, `TxLink` | Mở khi bấm Xem hồ sơ, nằm trong khung phụ dưới bảng lịch sử, có tiêu đề kèm mã kỳ |
| Thẻ "Lịch chạy (20 lượt gần nhất)": Kỳ (hoặc "vòng rỗng"), Vòng, Nguồn, Kết quả, Bắt đầu, Lỗi | `runLog.data[]`: `periodKey`, `runNo`, `triggerSource`, `status`, `startedAt`, `error` | Tách khỏi thẻ lịch sử thành thẻ riêng; Kết quả thành nhãn màu |
| Trạng thái rỗng "Chưa có kỳ chia nào trên chain này.", "Chưa có lượt chạy nào.", "Đang đọc quỹ chia…" | `HistoryCard`, `DistributionApprovalPage` | Tab "Chain chưa có kỳ chia" và "Đang tải"; các câu đang đọc, lỗi khác ghi ở mục chưa vẽ |

## Thay đổi chỉ là trình bày
- Bốn số của Quỹ chia thành bento: ô xanh lớn (Số dư quỹ), ô vàng (Chưa phân bổ), hai ô thường; thẻ Duyệt chia đứng cạnh trong cùng lưới.
- Thẻ "Dự kiến" tách thành hai thẻ: phần giải thích (nền nhạt) và bảng người nhận (cuộn dọc). Bảng "Lịch chạy" tách khỏi thẻ lịch sử.
- Lý do chặn hiển thị dạng danh sách có biểu tượng thay cho gạch đầu dòng.
- Thêm `<style>` cục bộ: `[hidden]{display:none!important}` (để thuộc tính hidden thắng các lớp có `display`), và `.tbl.compact` thu đệm ngang bảng lịch sử 10 cột cho vừa 1440.

## Thay đổi so với bản chốt (dev mới)
Đã rà `git diff f164939 67ece1e` cho `app/src/app/(ops)/distribution/page.tsx`, `components/pages/distribution-approval.tsx`, `components/pages/distribution-amount-label.ts`, `lib/bank/distribution-approval.service.ts`, `lib/bank/distribution.service.ts`: tệp giao diện không đổi. Máy chủ thêm câu chặn khi dự án đang thu hồi hoặc đã đóng: duyệt, tiếp tục chia trả lỗi "Dự án đang thu hồi hoặc đã đóng; không thể duyệt hay tiếp tục chia lợi nhuận.", mở kỳ mới trả "Dự án đang thu hồi hoặc đã đóng; không thể mở kỳ chia lợi nhuận mới." (BE-05 `57c4fbb`); câu hiện ở chỗ báo lỗi sẵn có của màn, dữ liệu mẫu không ở pha thu hồi nên không dựng. Danh sách người nhận lấy thêm ví từ Indexer (IN-01 `35a37b0`), không đổi trường hiển thị. Không sửa trang.

## Có đụng backend: Không

## Lệch đã thấy
- Cột "Kết quả" của Lịch chạy in thẳng mã `SUCCESS` / `FAILED` / `RUNNING`, không dịch như các cột khác.
- Số trong câu do máy chủ dựng không có dấu nghìn (ví dụ "Phần chưa phân bổ 500 VNDB dưới ngưỡng 1000 VNDB", "Số trên chuỗi 5184000000 VNDB khác số đã duyệt ..."), trong khi số ở ô và bảng có dấu nghìn.
- Thời điểm dùng `toLocaleString('vi-VN')` ("15:02:11 30/4/2026"), khác `formatDateTime` ở các màn khác ("30/04/2026 15:02:11").
- Cùng một trạng thái "chưa duyệt" có hai nhãn: "Chưa có kết luận duyệt" (thẻ Kỳ hoạt động) và "Chưa duyệt" (bảng lịch sử).
- Chain không có vault: câu lý do hiện hai lần với Kiểm soát viên (thẻ thay Quỹ chia và danh sách lý do trong Duyệt chia).
- Bảng người nhận dự kiến không phân trang; với nhiều ví (tới giới hạn quét) màn thật sẽ rất dài.
- Dữ liệu mẫu chung: NDT001 "đã nhận lợi tức qua 6 kỳ" nhưng chỉ có 5 kỳ chia trước; trang dùng 5 kỳ (500, 510, 520, 540, 550 VNDB mỗi WPT, cộng 2.620 x 150 = 393.000 VNDB).

## Sửa sau rà soát độc lập (lượt 2)
- Kỳ hoạt động: bỏ "(chốt vault ...)" vì phần đó chỉ có khi `vaultCloseStatus === 'SENT'`; vault đã chốt, câu "Đã gửi lên chuỗi, đang đối soát." đến từ 26 hồ sơ trả đang ở "Đã gửi, đang đối soát" (`pendingOnChain` có `progress.sent > 0`, `distribution-approval.service.ts:547-550`; phần chốt vault ở `distribution-approval.tsx:184`). Ô "Đã trả", "Còn phải chi", số dư quỹ của trạng thái này tính từ chính các dòng hồ sơ trả trong bảng (tổng 52 dòng Đã trả), không ghi số riêng. Hồ sơ của kỳ: 52 Đã trả, 26 Đã gửi, 50 Chờ gửi, khớp "Còn phải chi / lỗi 76 / 0". Bỏ nhãn "Đang chia" ở đầu thẻ.
- Thêm tab "Số đổi, chờ duyệt lại" (REAPPROVE): Trạng thái Đã mở, Trạng thái duyệt "Số đổi, chờ duyệt lại", Số đã duyệt "Chưa có (lần duyệt 4.800.000.000 VNDB lệch số trên chuỗi)", ghi chú `describeActive`, nút "Duyệt lại số thực tế 4.812.500.000 VNDB" mở hộp xác nhận cùng tiêu đề.
- Thêm tab "Lỗi tải": màn chỉ còn câu lỗi `fresh.error` (`distribution-approval.tsx:421-422`), mẫu "Lỗi không xác định.".
- Thêm tab "Danh sách người nhận bị cắt" (câu đỏ trong thẻ Dự kiến và lý do "Danh sách người nhận chạm giới hạn quét 5000 ví, không đầy đủ."), "Chain chưa có kỳ chia" ("Chưa có kỳ chia nào trên chain này.", "Chưa có lượt chạy nào."), "Đang tải" (`.empty` "Đang đọc quỹ chia…").
- Bỏ phần dev không có: danh sách Tổng cung, Tổng dự kiến, Phần dư làm tròn (đã có trong câu mô tả); thẻ riêng "Người nhận dự kiến" (bảng nay nằm trong thẻ "Dự kiến (tham khảo)" như màn thật); tiêu đề "Hồ sơ trả từng ví, kỳ ...".
- Thông báo sau thao tác là `OUTCOME` cộng `result.data.message`, ví dụ "Kỳ đã chia xong. Kỳ "mock:2026-10-23-01" hoàn tất ở vòng 1: 3 lô, 128 hồ sơ đã chi, 0 thất bại; mốc số dư chuyển từ 0 sang 4800000000."; Tiếp tục chia ra câu PARTIAL tông lỗi như màn thật.
- Thẻ "chain không có vault" lấy chain đang chọn (`unsupportedReason(chain)`). Ví vault trong bảng dự kiến là `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2`.

## Trạng thái giữ theo dev, chưa vẽ
- "Đang đọc hồ sơ trả…", "Đang đọc lịch sử…", lỗi đọc hồ sơ, lỗi lịch chạy (`distribution-approval.tsx:219-220`, `:280-282`, `:325`).
- Ghi chú khác của kỳ hoạt động: đang mở trên chuỗi (kèm "(mở kỳ <tx>)"), chưa có lần duyệt, vault CONFLICT, đang chốt kỳ vault (`distribution-approval.service.ts` `describeActive`).
