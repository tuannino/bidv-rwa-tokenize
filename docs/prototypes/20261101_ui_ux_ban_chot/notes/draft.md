# draft.html (màn `/draft`, Lập lệnh)

Màn thật (dev `67ece1e`): `app/src/app/(ops-draft)/draft/page.tsx` (breadcrumbs "Vận hành", "Lập lệnh"), `app/src/components/pages/draft.tsx` (`DraftPage`, `RequestForm`, `Field`). Component con đã đọc: `components/ui/amount-input.tsx` (`AmountInput`), `components/maker-checker/stat-card.tsx`, `token-info-block.tsx`, `token-info-read.ts`, `request-check-block.tsx`, `request-table.tsx`, `status-badge.tsx`, `gates.ts` (`burnAmountShown`, `burnSourceEffect`, `submitBlockReason`). Câu chữ khối kiểm tra lấy từ `lib/bank/token-request.service.ts` (`evaluate`), định dạng số từ `lib/format.ts` (`formatAmount`, `digitsOnly`), nhãn chain từ `packages/shared/src/chains.ts`. Vai: Giao dịch viên. `components/pages/mint.tsx` cũng đổi (ô số lượng dùng `AmountInput`, cột thao tác dùng `operationLabel`) nhưng màn `/mint` không có trong bản xem thử.

| Khối hoặc trường trên giao diện mới | Nguồn trong màn thật | Ghi chú |
|---|---|---|
| Tiêu đề "Lập lệnh", câu phụ, "Chain đang xem: mock" | `DraftPage` header, `useSelectedChain().chain` | Chain đổi theo dropdown Chain (`data-chain-label`) |
| Ô "Yêu cầu tạo token đang chờ" (xanh nổi bật) | `StatCard`, `getDraftStatsAction(chain).pendingMint` | Đếm yêu cầu PENDING của chính GDV001: 1. Gửi thêm thì tăng |
| Ô "Yêu cầu huỷ token đang chờ" | `StatCard`, `getDraftStatsAction(chain).pendingBurn` | GDV001 có 1. Tổng 2 khớp số việc chờ cạnh menu "Lập lệnh" do khung `shell.js` vẽ (`countPendingWork`: yêu cầu PENDING của chính người lập) |
| Thẻ "Tạo token" và thẻ "Huỷ token" | `RequestForm type="MINT"/"BURN"`, biểu tượng cộng tròn và lửa ở góc | Không có nhãn phụ, như màn thật |
| Ô "Mã hoặc ký hiệu token" | `symbol` | |
| Khối "Thông tin token": 10 dòng Dự án, Hợp đồng, Trần phát hành, Số còn được phát hành, Tổng cung hiện tại, Số chưa phân phối, Số đang lưu hành, Mã người bán, Ví thanh toán, Phát hành lần đầu | `TokenInfoBlock`, `TokenInfoView` qua `fetchTokenInfo` | Không đổi so với bản chốt |
| Trạng thái khối thông tin: rỗng, lỗi có "Mã tra cứu", nút "Thử đọc lại thông tin token" | `TokenInfoBlock`, `tokenInfoReadErrorMessage` | Xoá ô ký hiệu hoặc gõ ký hiệu khác WPT để xem |
| Ô "Ví đích (ví thanh toán SPV)" chỉ đọc, gợi ý | `info.spvWallet ?? wallet`, `hint` | Gợi ý trong mã có gạch dài, trang dùng dấu phẩy |
| Dropdown "Nguồn huỷ": Phần chưa phân phối, Toàn bộ nguồn cung | `BURN_SOURCE_LABELS`, `chooseSource` | Chọn lại "Phần chưa phân phối" thì ô Số lượng về rỗng (`setAmount('')`) |
| Cảnh báo đỏ huỷ TOÀN BỘ nguồn cung, ô "Tôi xác nhận huỷ toàn bộ nguồn cung" | `burnSourceEffect().warning`, `confirmed` | Chưa có thông tin token thì câu không in số: "Bạn đang yêu cầu huỷ TOÀN BỘ nguồn cung. Chỉ thực hiện..." |
| Ô "Số lượng" hiện dấu chấm hàng nghìn ngay khi gõ | `AmountInput` (`formatAmount` khi hiện, `digitsOnly` khi gõ) | Gõ "1234567" hiện "1.234.567"; giá trị gửi đi là chuỗi chữ số thô |
| Ô "Số lượng" của Burn toàn bộ nguồn cung: tự điền tổng cung, khoá, gợi ý "Tự điền bằng tổng cung hiện tại, không sửa được." hoặc "Nhập mã token để hệ thống điền tổng cung." | `burnAmountShown`, `fullSupplyAmount`, `hint` của `Field` | Nền ô khoá nhạt hơn (`bg-muted/40`) |
| Ngày hiệu lực, Lý do, Chứng từ, Ghi chú | `effectiveDate`, `reason`, `documentRef`, `note` | |
| Khối "Kiểm tra trước khi lập" Mint: Dự án tồn tại, Dự án chưa tới hạn thu hồi, Không vượt trần còn lại, Ví đích hợp lệ | `RequestCheckBlock`, `previewTokenRequestAction` (`evaluate`) | Câu trần: "Số lượng 300.000; trần còn lại 10.000.000 (trần 20.000.000 trừ tổng cung 10.000.000)." Gõ số lớn hơn 10.000.000 để thấy dòng trượt |
| Khối kiểm tra Burn: Dự án tồn tại, Có ví thanh toán SPV trên chuỗi, Không vượt phần chưa phân phối; khi toàn bộ nguồn cung thêm Số lượng bằng tổng cung, Không còn token đang lưu hành | như trên | Toàn bộ nguồn cung trên dữ liệu mẫu trượt hai điều kiện |
| Nút gửi, dòng "Chưa gửi được: ..." | `submitBlockReason(preview, needsConfirmation && !confirmed)` | Có thêm lý do "Huỷ theo toàn bộ nguồn cung phải xác nhận lại trước khi gửi." |
| Thông báo "Đã gửi yêu cầu tạo/huỷ ... WPT (mã ...). Yêu cầu đang chờ Kiểm soát viên duyệt." | `feedback` tone success | Hiện ở cả hai thẻ; gửi xong xoá các ô như màn thật và thêm một dòng "Chờ duyệt" vào bảng |
| Thẻ "Yêu cầu đã lập", câu mô tả | `Card`, `CardDescription`, `mine: true` | Không có nhãn người lập ở tiêu đề, như màn thật |
| Bảng "Yêu cầu tạo token": Mã yêu cầu, Thời điểm lập, Token, Số lượng, Người lập, Lý do, Trạng thái, Chain, Kết quả | `RequestTable` biến thể `queue` | Token chỉ ký hiệu; cột Chain là `CHAINS[chain].label` ("Mock (không cần chain)") |
| Bảng "Yêu cầu huỷ token": thêm cột Nguồn | như trên, `showSource` | |
| Kết quả: "–", "KSV001 duyệt, tx 0x8c41e2d0a7…", "Kiểm soát viên KSV001 từ chối do: Chứng từ chưa ký" | `resultText` (vai lấy từ `ROLE_LABELS`) | Có `title` đủ chữ |
| Trạng thái rỗng bảng, lỗi bảng | `emptyText`, `freshMine.error` | Không dựng |

Lớp cục bộ: `[hidden]` ép ẩn, thu đệm ô bảng (8px, `.trunc` 180px), nền ô số chỉ đọc.

## Thay đổi chỉ là trình bày
Hai thẻ số liệu thành ô bento; hai thẻ biểu mẫu cạnh nhau như màn thật (`xl:grid-cols-2`); khối thông tin và khối kiểm tra thành ô nền nhạt; kiểm tra hiện bằng `.checks`; thời điểm lập tách ngày và giờ hai dòng; cột Chain cho xuống dòng để bảng 10 cột vừa khung.

## Thay đổi so với bản chốt (dev mới)
- Bỏ điều kiện "Không có yêu cầu Mint khác đang chờ cho token này": Giao dịch viên lập được nhiều yêu cầu Mint cùng token, nút "Gửi yêu cầu tạo token" mở ngay trên dữ liệu mẫu (FIX-02 `90995a1`, QĐ-3).
- Thêm điều kiện Mint "Dự án chưa tới hạn thu hồi" (BE-05 `57c4fbb`).
- Câu điều kiện in số có dấu chấm hàng nghìn, "trần ... trừ tổng cung ..." thay cho dấu trừ; câu lưu hành dùng dấu phẩy (UIUX-01 `ea9fe5f`, A2).
- Ô Số lượng hiện dấu chấm khi gõ (UIUX-01 `ea9fe5f`, A1).
- Burn "Toàn bộ nguồn cung": số lượng luôn là tổng cung hiện tại, có gợi ý dưới ô, thêm điều kiện "Số lượng bằng tổng cung", câu cảnh báo không in số khi chưa có tổng cung, đổi về "Phần chưa phân phối" thì ô số rỗng (FIX-02 `90995a1`, C1 đến C3, QĐ-5).
- Bảng yêu cầu: thêm cột Chain sau Trạng thái, Token chỉ còn ký hiệu, câu từ chối "Kiểm soát viên KSV001 từ chối do: ...", câu hoàn tất "KSV001 duyệt, tx ..." (UIUX-01 `ea9fe5f`, A4, B1 đến B3).
- Dữ liệu mẫu thống nhất với approvals.html và approval-detail.html: mã đầy đủ, giờ lập, lý do của `7f3a21c0`, `5e0c7b92`, `c02f9a17`, `a4471f3d` (người lập GDV001).

## Có đụng backend: Không

## Lệch đã thấy
- Gợi ý ô Ví đích trong mã còn gạch dài (ký tự cấm); trang dùng dấu phẩy.
- `resultText` của trạng thái Chờ duyệt trả gạch dài; trang dùng "–".
- Bảng hồ sơ dự án chưa có địa chỉ hợp đồng và ngày phát hành lần đầu trong bộ dữ liệu chung; trang giữ `0x5FbDB2315678afecb367f032d93F642f64180aa3` và 02/03/2026 09:00:00.
- Địa chỉ vault, ví thanh toán SPV trên mock đổi thành `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2` (`packages/shared/src/mock-vault.ts`; trên mock Mint chỉ vào vault nên ví SPV là vault). config.html, distribution.html, demo-payment.html vẫn dùng `0x0da94B…6861`.

## Sửa sau rà soát độc lập (lượt 2)
- Bỏ nhãn "Mint", "Burn", "Của GDV001" (màn thật không có). Gửi xong đưa Nguồn huỷ về "Phần chưa phân phối" (`draft.tsx:361`).
- Ví thanh toán, ví đích trên mock là `MOCK_VAULT_ADDRESS` `0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2` (`packages/shared/src/mock-vault.ts:11`; Mint trên mock chỉ vào vault).
- Thêm thanh "Trạng thái xem thử": Có dữ liệu; Đang tải (ô đếm "–", khối token "Đang đọc thông tin token…", hai bảng `.empty` "Đang tải…"); Chưa lập yêu cầu (ô đếm 0, "Chưa lập yêu cầu tạo token nào.", "Chưa lập yêu cầu huỷ token nào."; số việc chờ cạnh menu do khung `shell.js` vẽ nên giữ 2, trong app số này đọc cùng nguồn `countPendingWork` nên sẽ là 0); Lỗi máy chủ (lỗi số liệu dưới hai ô đếm, lỗi bảng trong thẻ Yêu cầu đã lập, bấm gửi ra khung đỏ). Câu lỗi mẫu "Lỗi không xác định." là câu mặc định của `toResult`.
- Tương tác thêm: mỗi lần đổi nội dung có một nhịp "Đang kiểm tra điều kiện…" (`request-check-block.tsx`), nút gửi "Chưa gửi được: Đang gửi…" một nhịp; xoá ô Lý do thì khối kiểm tra hiện "Dữ liệu không hợp lệ. Lý do: Phải nêu lý do." (preview `invalid`, `describeInvalid`).
- Bảng "Yêu cầu tạo token" xếp mới lập trước như `listRequests` (`memory.token-request.store.ts:212`): `5e0c7b92` (07:31) rồi `7f3a21c0` (06:12).
