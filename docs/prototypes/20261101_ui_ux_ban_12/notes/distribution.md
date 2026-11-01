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
| Thẻ "Dự kiến (tham khảo)": câu tổng cung, chốt theo ảnh chụp, tổng dự kiến, phần dư làm tròn | `data.forecast.totalSupply`, `.allocated`, `.dust` | Ba số được nhắc lại thành hàng khoá giá trị dưới câu |
| Cảnh báo danh sách bị cắt | `data.forecast.truncated` | Không hiện vì dữ liệu mẫu không cắt; giữ ở dạng lý do chặn khi có |
| Bảng "Người nhận dự kiến": Ví, WPT hiện tại, Phần dự kiến (VNDB), nhãn vault | `data.forecast.rows[].wallet/.balance/.share/.isVault` | Tách thành thẻ riêng; cuộn dọc trong thẻ (129 dòng: vault + 128 nhà đầu tư) |
| Thẻ "Kỳ hoạt động": Mã kỳ, Trạng thái, Trạng thái duyệt, Số đã duyệt, Số thực tế trên chuỗi, Chốt kỳ vault, Đã trả, Còn phải chi / lỗi | `ActivePeriodCard`, `period.*`, `progress.*`, `approvedAmountLabel(period,'cell')` | 8 ô `kv-grid`; chỉ có ở trạng thái "Đang có kỳ hoạt động" |
| Ghi chú kỳ hoạt động | `active.note` | Khung thông báo |
| "Đã gửi lên chuỗi, đang đối soát (...)" | `active.pendingOnChain`, `openTxHash`, `vaultCloseTxHash` | |
| Nút "Tiếp tục chia" / "Duyệt lại số thực tế" (chỉ Kiểm soát viên) | `canApprove and nextAction === 'CONTINUE' / 'REAPPROVE'` | Mẫu ở nhánh CONTINUE; nút duyệt lại không hiện vì kỳ mẫu không lệch số |
| Bảng "Lịch sử kỳ chia": Mã kỳ, Trạng thái, Duyệt, Người duyệt, Thời điểm duyệt, Số duyệt, Số thực tế, Duyệt lại từ, Nguồn kích hoạt, nút Xem hồ sơ/Ẩn hồ sơ | `HistoryCard`, `DistributionHistoryRow.period/.triggerSources`, `approvedAmountLabel(period,'table')` | Thời điểm duyệt tách giờ và ngày hai dòng; Trạng thái thành nhãn màu |
| Phân trang lịch sử "Trang 1/1 (5 kỳ)", Trang trước, Trang sau | `goTo`, `result.data.total/pageSize` | |
| Bảng "Hồ sơ trả từng ví": Ví, WPT tại ảnh chụp, Số chia (VNDB), Trạng thái, Giao dịch; phân trang 10 ví | `PayoutsTable`, `PayoutRowView`, `PAYOUT_STATUS`, `TxLink` | Mở khi bấm Xem hồ sơ, nằm trong khung phụ dưới bảng lịch sử, có tiêu đề kèm mã kỳ |
| Thẻ "Lịch chạy (20 lượt gần nhất)": Kỳ (hoặc "vòng rỗng"), Vòng, Nguồn, Kết quả, Bắt đầu, Lỗi | `runLog.data[]`: `periodKey`, `runNo`, `triggerSource`, `status`, `startedAt`, `error` | Tách khỏi thẻ lịch sử thành thẻ riêng; Kết quả thành nhãn màu |
| Trạng thái rỗng "Chưa có kỳ chia nào trên chain này.", "Chưa có lượt chạy nào.", các câu đang đọc và lỗi | `HistoryCard`, `DistributionApprovalPage` | Không dựng vì đã chọn trạng thái có dữ liệu; nội dung giữ nguyên khi áp vào app |

## Thay đổi chỉ là trình bày
- Bốn số của Quỹ chia thành bento: ô xanh lớn (Số dư quỹ), ô vàng (Chưa phân bổ), hai ô thường; thẻ Duyệt chia đứng cạnh trong cùng lưới.
- Thẻ "Dự kiến" tách thành hai thẻ: phần giải thích (nền nhạt) và bảng người nhận (cuộn dọc). Bảng "Lịch chạy" tách khỏi thẻ lịch sử.
- Lý do chặn hiển thị dạng danh sách có biểu tượng thay cho gạch đầu dòng.
- Thêm `<style>` cục bộ: `[hidden]{display:none!important}` (để thuộc tính hidden thắng các lớp có `display`), và `.tbl.compact` thu đệm ngang bảng lịch sử 10 cột cho vừa 1440.

## Có đụng backend không
Không. Mọi số, câu và trạng thái đều đã có trong `getDistributionPageAction`, `listDistributionPeriodsAction`, `listDistributionPayoutsAction`. Tab trạng thái xem thử chỉ có ở bản HTML.

## Lệch đã thấy
- Cột "Kết quả" của Lịch chạy in thẳng mã `SUCCESS` / `FAILED` / `RUNNING`, không dịch như các cột khác.
- Số trong câu do máy chủ dựng không có dấu nghìn (ví dụ "Phần chưa phân bổ 500 VNDB dưới ngưỡng 1000 VNDB", "Số trên chuỗi 5184000000 VNDB khác số đã duyệt ..."), trong khi số ở ô và bảng có dấu nghìn.
- Thời điểm dùng `toLocaleString('vi-VN')` ("15:02:11 30/4/2026"), khác `formatDateTime` ở các màn khác ("30/04/2026 15:02:11").
- Cùng một trạng thái "chưa duyệt" có hai nhãn: "Chưa có kết luận duyệt" (thẻ Kỳ hoạt động) và "Chưa duyệt" (bảng lịch sử).
- Chain không có vault: câu lý do hiện hai lần với Kiểm soát viên (thẻ thay Quỹ chia và danh sách lý do trong Duyệt chia).
- Bảng người nhận dự kiến không phân trang; với nhiều ví (tới giới hạn quét) màn thật sẽ rất dài.
- Dữ liệu mẫu chung: NDT001 "đã nhận lợi tức qua 6 kỳ" nhưng chỉ có 5 kỳ chia trước; trang dùng 5 kỳ (500, 510, 520, 540, 550 VNDB mỗi WPT, cộng 2.620 x 150 = 393.000 VNDB).
