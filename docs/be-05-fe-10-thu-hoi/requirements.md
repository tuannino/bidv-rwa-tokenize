# BE-05 và FE-10: thu hồi token khi dự án hết hạn (PoC), yêu cầu

Nền: `dev` @ `c35fa17` (sau merge IN-01). Người viết: giám sát. Thiết kế gốc: `claude/20261022_thiet_ke_tat_toan.md` Phần A. Spec đã qua hai vòng phản biện độc lập đối chiếu mã nguồn trước khi giao. Bản 2 (24/10) thêm theo Sếp: cờ trình diễn, sửa mốc khi chưa đóng băng, chặn lùi ngày về quá khứ, nút mở đóng băng.

## 1. Bối cảnh

- Sếp chốt 22/10 (QĐ-TT1 tới QĐ-TT4): PoC chỉ thu hồi token, không trả tiền trên chuỗi; token thu hồi bị đốt bằng quyền AGENT (`burn(ví, số)`); máy chủ kiểm hạn; Nhà đầu tư thấy thông báo từ ngày hết hạn dự án, bị thu hồi từ ngày hết hạn cộng N ngày (mặc định 30).
- Sếp chốt 24/10:
  - Kiểm soát viên mở đợt và thu hồi (Giao dịch viên chỉ xem).
  - Có tạm dừng token dự án trên chuỗi, là một bước riêng: nút **"Đóng băng trên toàn hệ thống"** (nhãn không gắn tên token vì hệ thống có nhiều token), sau đó mới có nút **"Thu hồi toàn bộ"**.
- IN-01 đã có `listTokenWallets()`: danh sách mọi ví từng nắm WPT lấy từ chuỗi. Danh sách ví bị thu hồi lấy từ đây, không dựng từ database.
- Hiện `placeOrder` không kiểm trạng thái dự án ở máy chủ (chỉ màn xem trước kiểm). BE-05 phải chặn ở máy chủ.
- Đã đối chiếu hợp đồng: `ProjectToken` có `pause`, `unpause`, `paused`; `burn` của AGENT bỏ qua cả tạm dừng lẫn ví bị đóng băng riêng (`_forcedMove`); PAUSER cấp cho ví triển khai, cũng là ví ngân hàng. Tạm dừng chặn mua bán qua `OrderSettlement`, phát hành thêm, tự đốt; KHÔNG chặn `snapshot()`, `forcedTransfer` của AGENT, permit.

## 2. Mục tiêu

1. Kiểm soát viên mở một đợt thu hồi cho dự án trên một chain, có ngày hết hạn và số ngày báo trước.
2. Từ ngày hết hạn: Nhà đầu tư thấy thông báo; lệnh mua bán mới và duyệt phát hành thêm bị chặn ở máy chủ.
3. Từ ngày bắt đầu thu hồi: Kiểm soát viên đóng băng token dự án trên chuỗi, rồi thu hồi (đốt) toàn bộ WPT ngoài vault SPV theo lô.
4. Nhà đầu tư thấy dòng "Thu hồi" trong lịch sử giao dịch, có mã giao dịch.
5. Hết WPT ngoài vault: đợt hoàn tất, dự án sang `CLOSED`.

## 3. Quyết định

- **QĐ-R1: dùng lại bảng `SettlementRound` và `SettlementCase`** (có từ BE-09, cổng `ISettlementStore` có hai bản), thêm cột và trạng thái, không tạo bảng mới. Lý do: bản đầy đủ (SC-04, nợ kỹ thuật) dùng đúng hai bảng này với giá NAV và bước trả tiền; PoC là trường hợp riêng không trả tiền.
  - Đợt thu hồi tạo bằng hàm kho mới `openRecallRound`, ghi `snapshotId = 0` và `navRate = '0'` làm giá trị đánh dấu "không chụp, không trả tiền". `openRound` cũ và phép kiểm `assertSnapshotId` (từ 1) giữ nguyên cho bản đầy đủ. Ghi rõ ở chú thích cổng.
  - Hồ sơ thu hồi ghi `payoutAmount = '0'`. Ví lưu chữ thường.
- **QĐ-R2: trạng thái đợt**: `INITIATED` (đã mở, đang báo trước), `IN_PROGRESS` (đã đóng băng, đang thu hồi), `COMPLETED`, thêm `CANCELLED` (huỷ trước khi đóng băng). Mỗi chain tối đa một đợt chưa kết thúc (cột `activeChain` duy nhất, cùng mẫu `DistributionPeriod`).
- **QĐ-R3: trạng thái hồ sơ ví**: `NOTIFIED` (chờ đốt), `BURNING` (đã chiếm để gửi; có hoặc chưa có mã giao dịch), `BURNED`, `FAILED` (được gửi lại ở lô sau). `CONFIRMED`, `PAID` để cho bản đầy đủ.
- **QĐ-R4: mốc theo ngày Việt Nam** (`Asia/Ho_Chi_Minh`), lưu `YYYY-MM-DD`, schema từ chối ngày không có thật. `recallFrom = maturityDate + noticeDays`. "Đến hạn": hôm nay lớn hơn hoặc bằng `maturityDate`; "được thu hồi": hôm nay lớn hơn hoặc bằng `recallFrom`.
- **QĐ-R5: số ngày báo trước nhập khi mở đợt**, mặc định 30, tối đa 365. Chain `mock` và `hardhat-local` cho phép 0 (demo); chain EVM khác tối thiểu 1, trừ khi bật cờ trình diễn (QĐ-R13). Không thêm khoá SystemConfig.
- **QĐ-R6: đóng băng là `ProjectToken.pause()`**, nối vào hai hàm cổng đang `@blocked SC-04`: `setSettlementMode(enabled)` (true là `pause`, false là `unpause`) và `isSettlementMode()` (đọc `paused()`). `setNavRate`, `navRate` giữ `@blocked SC-04`, đổi lý do thành "nợ kỹ thuật: bản tất toán đầy đủ".
  - Phạm vi: chỉ token dự án của đợt (hiện là WPT, tên và ký hiệu đọc từ dự án); VNDB và token khác không bị tạm dừng.
  - Có nút mở đóng băng, nhưng chỉ trước khi đốt ví đầu tiên (QĐ-R14).
  - Điều kiện bấm: khoá chain trống (lệnh rút `NEEDS_REVIEW` phải được xử lý trước); đã tới `recallFrom`; không còn lệnh `PLACED`, `CHECKING`, `EXECUTING` (dùng lại `countInFlightOrders`); chain không có kỳ chia lợi nhuận đang hoạt động (`DistributionPeriod.activeChain`); danh sách ví từ Indexer không bị cắt.
  - Hộp xác nhận bắt gõ lại ký hiệu token (thao tác chỉ đảo ngược được trước khi đốt, một người làm).
- **QĐ-R7: danh sách ví thu hồi lập khi đóng băng xong**: `listTokenWallets()` lọc `balance > 0`, bỏ ví SPV (so không phân biệt hoa thường; WPT chưa bán ở vault đốt bằng luồng Burn của BE-12). Mỗi lô lập bổ sung (bỏ qua ví đã có hồ sơ) cho ví có số dư dương chưa có hồ sơ.
- **QĐ-R8: một khoá thao tác theo chain** cho đóng băng, thu hồi lô, huỷ đợt: dùng lại `VaultOperationLock` với loại mới `RECALL` (có tiếp quản khi treo quá thời gian chờ biên nhận, như loại `CONFIG`). Lý do: chặn hai lần bấm, chặn huỷ chen giữa lúc đang gửi đóng băng, và chặn trùng nonce giữa các isolate Workers (hàng đợi gửi của adapter chỉ trong một tiến trình). Không lấy được khoá thì trả `REQUEST_STATE` "đang có thao tác khác trên chain".
- **QĐ-R9: mỗi lô** tối đa `RECALL_BATCH_SIZE = 10` hồ sơ: chiếm hồ sơ, đọc số dư, gửi, lưu mã giao dịch ngay khi có (luật HF-05), gửi hồ sơ kế; xong cả lô mới chờ biên nhận song song với một hạn chung. Biên nhận chưa có thì hồ sơ giữ `BURNING`, lô sau đối soát lại. Số dư 0 thì hồ sơ thành `BURNED` không có giao dịch.
- **QĐ-R10: giao dịch treo** (quá `RECALL_STUCK_MINUTES = 10` phút chưa có biên nhận, hoặc đã bắt đầu gửi mà chưa lưu được mã): trạng thái chuỗi đã cho thấy kết quả (đã tạm dừng; số dư ví bằng 0) thì chốt theo đó; nếu chưa thì GỬI LẠI (gửi lại vô hại vì lệnh thừa revert). Dấu đã gửi đóng băng (`freezeRequestedAt`) chỉ bị xoá khi có kết cục chắc chắn: biên nhận `FAILED`, hoặc revert lúc mô phỏng. Lỗi hết giờ hay mất kết nối khi gửi KHÔNG xoá dấu.
- **QĐ-R11: hoàn tất** khi không còn hồ sơ khác `BURNED` và trên chuỗi `totalSupply` trừ số dư WPT của ví SPV bằng 0. Đợt `COMPLETED`, dự án `CLOSED` trong cùng một thao tác lưu trữ.
- **QĐ-R13: trình diễn và mốc thời gian** (Sếp chốt 24/10).
  - Cờ môi trường `ENABLE_DEMO_RECALL` (mặc định `false`, đọc qua `env.ts`, cùng kiểu các cờ demo hiện có): bật thì mọi chain, kể cả Sepolia, cho đặt số ngày báo trước bằng 0. Màn `/recall` hiện nhãn "Chế độ trình diễn" khi cờ bật.
  - Không bao giờ cho ngày hết hạn trước hôm nay, kể cả khi bật cờ: khi mở đợt và khi sửa mốc. Không có cách nào chỉnh giờ hệ thống hay lùi ngày.
  - Sửa mốc: Kiểm soát viên đổi `maturityDate` và `noticeDays` khi đợt `INITIATED` và chưa ghi `freezeRequestedAt`; có lý do; ghi sổ kiểm toán gồm mốc cũ và mốc mới.
- **QĐ-R14: mở đóng băng** (Sếp chốt 24/10).
  - Nút "Mở đóng băng trên toàn hệ thống" (`unpause`), Kiểm soát viên, quyền `settlement:recall`, gõ lại ký hiệu token, có lý do, dưới khoá chain.
  - Chỉ cho khi đợt `IN_PROGRESS` và chưa đốt ví nào: không có hồ sơ `BURNING`, không có hồ sơ `BURNED` mang mã giao dịch. Đã đốt dù một ví thì không mở được nữa (thu hồi dở rồi mở lại giao dịch là trạng thái không nhất quán: một phần Nhà đầu tư mất token, phần còn lại giao dịch tiếp).
  - Mở xong: đợt về `INITIATED`, xoá dấu và mã đóng băng, xoá các hồ sơ chưa đốt của đợt; sau đó được sửa mốc, huỷ đợt, hoặc đóng băng lại. Nếu đã quá `maturityDate` thì giao dịch trong ứng dụng vẫn bị chặn theo pha `NOTICE` cho tới khi huỷ đợt hoặc sửa mốc ra tương lai.
  - Không có nút mở đóng băng khi không có đợt (tạm dừng do ai đó gọi ngoài ứng dụng): ngoài phạm vi, xử lý bằng script khi Sếp quyết.
- **QĐ-R12: quyền.**
  - `settlement:initiate` chuyển từ Giao dịch viên sang Kiểm soát viên (mở, huỷ đợt).
  - Thêm `settlement:recall`, chỉ Kiểm soát viên (đóng băng, thu hồi).
  - Xem `/recall`: `ops:read`. Nhà đầu tư: `portfolio:read` sẵn có.
  - Đây là ngoại lệ có chủ đích với nguyên tắc lập và duyệt (Sếp chốt 24/10); ghi mục SAI KHÁC trong checkpoint và tech-report.

## 4. Ngoài phạm vi (nợ kỹ thuật)

- Trả tiền trên chuỗi, giá NAV, hợp đồng `ProjectSettlement` (SC-04).
- Mở đóng băng sau khi đã đốt ví đầu tiên; mở lại dự án sau khi đóng.
- Đốt WPT còn ở vault SPV (luồng Burn của BE-12).
- Thông báo qua email, tin nhắn.
- Hơn 5.000 ví (Indexer cắt danh sách; PoC từ chối đóng băng thay vì phân trang).
- `forcedTransfer` của AGENT vẫn chạy khi tạm dừng; ứng dụng không có đường gọi nó, nên tổng cung ngoài vault không tăng trong lúc thu hồi theo đường ứng dụng.

## 5. Yêu cầu chức năng

### BE-05

- **R1. Dữ liệu.**
  - `SettlementRound` thêm: `projectId`, `maturityDate`, `recallFrom` (TEXT `YYYY-MM-DD`), `noticeDays` (INTEGER), `openedBy`, `reason` (lý do mở; lý do huỷ chỉ ở sổ kiểm toán), `freezeRequestedAt`, `freezeTxHash`, `frozenAt`, `cancelledAt`, `activeChain` (chỉ mục duy nhất).
  - `SettlementCase` thêm: `burnSentAt`, `failedAt`, `reason`.
  - Đăng ký chỉ mục `SettlementRound_activeChain_key` trong `UNIQUE_CONSTRAINTS`; trùng khi mở đợt trả `REQUEST_STATE`.
  - Hai bản kho (bộ nhớ, Postgres) có đủ các hàm mới ở design mục 2.
- **R2. Mở đợt** (`openRecall`): `maturityDate` (không trước hôm nay), `noticeDays` (QĐ-R5), lý do (5 tới 200 ký tự). Dự án của chain phải `ISSUED`; chain chưa có đợt chưa kết thúc. Sổ kiểm toán `settlement:initiate`.
- **R3. Huỷ đợt** (`cancelRecall`): dưới khoá chain; chỉ khi `INITIATED`, `freezeRequestedAt` rỗng và `isSettlementMode()` là false. Có lý do. Huỷ sau `maturityDate` thì giao dịch mở lại.
- **R3b. Sửa mốc** (`rescheduleRecall`): theo QĐ-R13, dưới khoá chain; `maturityDate` mới không trước hôm nay; `noticeDays` theo QĐ-R5 và cờ trình diễn; tính lại `recallFrom`.
- **R4. Chặn theo đợt** (một hàm `readRecallPhase` và `tradingBlocked` dùng chung, không viết điều kiện rời):
  - `placeOrder` (mua và bán), xem trước, `getTradeContext`: chặn khi pha là `NOTICE`, `FROZEN`, `CLOSED`, hoặc `isSettlementMode()` là true dù không có đợt.
  - Duyệt yêu cầu Mint (BE-12, `evaluate` của `token-request.service.ts`): chặn từ `NOTICE`. Burn ở vault vẫn được.
  - Mở kỳ chia lợi nhuận và duyệt chia: chặn khi pha là `FROZEN` hoặc `CLOSED`.
  - Câu báo nêu ngày hết hạn và ngày thu hồi.
- **R5. Đóng băng** (`freezeToken`), dưới khoá chain:
  - Điều kiện ở QĐ-R6; người gọi có `settlement:recall`.
  - Đã tạm dừng trên chuỗi: không gửi, chốt luôn.
  - Đã có `freezeRequestedAt`: lấy mã từ `freezeTxHash` hoặc từ dòng `Txn` `freeze` PENDING; có mã thì hỏi biên nhận (`CONFIRMED` chốt; `FAILED` xoá mã và dấu, báo được bấm lại); chưa có kết cục thì áp QĐ-R10, chưa tới hạn treo thì báo "đang chờ xác nhận".
  - Chưa gửi: ghi `freezeRequestedAt` có điều kiện (đợt còn `INITIATED`, cột còn rỗng), gửi `setSettlementMode(true)`, ghi `Txn` PENDING `operation = 'freeze'` và `freezeTxHash` ngay khi có mã, chờ biên nhận. Revert lúc mô phỏng: xoá dấu. Lỗi khác khi gửi: giữ dấu.
  - Chốt: một thao tác lưu trữ: đợt `IN_PROGRESS`, `frozenAt`, hồ sơ `NOTIFIED` (QĐ-R7, có thể rỗng, chia lô không quá 1.000 dòng mỗi câu), sổ kiểm toán.
- **R5b. Mở đóng băng** (`unfreezeToken`), dưới khoá chain, theo QĐ-R14:
  - Ghi `unfreezeRequestedAt` có điều kiện (đợt `IN_PROGRESS`, chưa đốt ví nào, cột còn rỗng); gửi `setSettlementMode(false)`; ghi `Txn` PENDING `operation = 'unfreeze'` và `unfreezeTxHash` ngay khi có mã; chờ biên nhận.
  - Chốt (biên nhận `CONFIRMED`, hoặc `isSettlementMode()` đã false): một thao tác lưu trữ: đợt `INITIATED`, xoá `freezeRequestedAt`, `freezeTxHash`, `frozenAt`, `unfreezeRequestedAt`, `unfreezeTxHash`, xoá hồ sơ `NOTIFIED`, `FAILED` và `BURNED` không mã của đợt, sổ kiểm toán.
  - `FAILED` hoặc revert lúc mô phỏng: xoá dấu mở đóng băng. Treo: áp QĐ-R10 (gửi lại, không xoá dấu).
  - Trong lúc có `unfreezeRequestedAt`: lô thu hồi bị từ chối (không đốt khi đang mở đóng băng).
- **R6. Thu hồi một lô** (`recallBatch`), dưới khoá chain:
  1. Đợt `IN_PROGRESS` và `isSettlementMode()` true (false thì dừng, báo lệch, không đốt).
  2. Đối soát `BURNING`: có mã thì hỏi biên nhận (`CONFIRMED` sang `BURNED`, `FAILED` sang `FAILED` có lý do, chưa có thì QĐ-R10); không có mã thì nhận mã từ dòng `Txn` `recall` PENDING của ví đó tạo sau `burnSentAt`, không có dòng nào thì: số dư 0 sang `BURNED`, còn lại sang `FAILED` ("gửi không thành").
  3. Lập bổ sung hồ sơ (QĐ-R7), bỏ qua ví đã có hồ sơ.
  4. Lấy tối đa 10 hồ sơ `NOTIFIED` hoặc `FAILED`, sắp theo ví. Mỗi hồ sơ: chiếm (`NOTIFIED|FAILED` sang `BURNING`, xoá mã cũ, ghi `burnSentAt`); đọc `balanceOf`; 0 thì `BURNED`; còn lại gửi `burn`, ghi `Txn` PENDING `operation = 'recall'` (`fromWallet` là ví, `amount` là số đốt) và gắn mã vào hồ sơ ngay khi có; lỗi revert lúc mô phỏng thì `FAILED` ngay.
  5. Chờ biên nhận các mã vừa gửi song song, hạn chung `receiptTimeoutFor(chain)`; cập nhật hồ sơ và dòng `Txn`.
  6. Kiểm hoàn tất (QĐ-R11). Còn WPT ngoài vault khi mọi hồ sơ đã `BURNED`: báo số còn lại, lô sau bước 3 bổ sung.
- **R7. Hoàn tất**: một thao tác lưu trữ: đợt `COMPLETED`, `completedAt`, `activeChain` rỗng, dự án `CLOSED`, sổ kiểm toán.
- **R8. Đọc tổng quan** (`getRecallOverview`, `assertCan('ops:read')`): đợt hiện tại hoặc đợt thu hồi gần nhất (`projectId` khác rỗng); mốc, số ngày còn lại; `isSettlementMode`; lệnh đang xử lý; kỳ chia đang hoạt động; hồ sơ (đủ, không cắt 50); khi chưa đóng băng thì danh sách dự kiến từ `listTokenWallets()`; tổng cung ngoài vault; `canManage`. Không ghi dữ liệu nghiệp vụ, không ghi sổ kiểm toán (Indexer có thể ghi bộ nhớ đệm của nó như IN-01).
- **R9. Dữ liệu cho Nhà đầu tư**: `getPortfolio` trả thêm `recall`: `null` khi pha là `NONE` hoặc `SCHEDULED`; ngược lại `{ maturityDate, recallFrom, daysLeft, phase: 'NOTICE' | 'FROZEN' | 'CLOSED', amount }` (`amount` là số dư hiện tại khi chưa đốt, số đã đốt khi đã đốt). Không thêm server action, không thêm dòng sổ kiểm toán ngoài dòng `portfolio:read` sẵn có.
- **R10. Mock khớp EVM**: mock `mint`, `mintInitialSupply` bị chặn khi `settlementMode`; `setSettlementMode(true)` khi đã bật và `setSettlementMode(false)` khi chưa bật thì lỗi như EVM. Thêm `isTransactionKnown(txHash)` vào cổng (EVM: `getTransaction`; mock: có trong trạng thái).

### FE-10

- **R11. Màn `/recall` "Thu hồi token"** (nhóm Vận hành của cả hai vai; Giao dịch viên: "Thu hồi token (chỉ xem)"):
  - Chưa có đợt: khối "Mở đợt thu hồi" (ngày hết hạn, số ngày báo trước, lý do; hiện sẵn ngày bắt đầu thu hồi).
  - Có đợt: mốc, đếm ngược, bốn bước (Đã mở, Đến hạn, Đã đóng băng, Hoàn tất); nút "Huỷ đợt" khi được phép.
  - Nút "Đóng băng trên toàn hệ thống": khoá kèm câu giải thích khi chưa tới `recallFrom`, còn lệnh đang xử lý, còn kỳ chia đang hoạt động, hoặc danh sách ví bị cắt. Hộp xác nhận nêu tên token, nói không bỏ đóng băng được, token khác không bị ảnh hưởng, bắt gõ lại ký hiệu token.
  - Nút "Mở đóng băng trên toàn hệ thống": chỉ khi đã đóng băng và chưa đốt ví nào; hộp xác nhận gõ lại ký hiệu, có lý do. Sau lần đốt đầu tiên nút ẩn, thay bằng câu "Đã thu hồi, không mở đóng băng được".
  - Nút "Sửa mốc": khi đợt chưa đóng băng; ô ngày không cho chọn ngày trước hôm nay.
  - Nhãn "Chế độ trình diễn" khi cờ `ENABLE_DEMO_RECALL` bật.
  - Nút "Thu hồi toàn bộ": chỉ khi đã đóng băng; mỗi lần bấm một lô; sau lô tải lại bằng chính action mở màn; còn việc thì nhãn "Thu hồi lô tiếp theo".
  - Bảng ví: ví (rút gọn, nút chép), số WPT, trạng thái, mã giao dịch mở Etherscan, lý do lỗi. Trên bảng: tổng cung ngoài vault còn lại.
  - Giao dịch viên thấy cùng màn, không có khối và nút ghi.
- **R12. `/portfolio`**: hộp "Thông báo thu hồi" khi `recall` khác `null` (ngày hết hạn, ngày thu hồi, số ngày còn lại, số WPT, câu "thanh toán thực hiện ngoài hệ thống"). Lịch sử giao dịch có nhãn tiếng Việt cho `operation` ("Thu hồi" cho `recall`, "Đóng băng" cho `freeze`; mã khác có nhãn thì dùng, chưa có thì giữ mã).
- **R13. `/trade` và tổng quan Người bán**: dòng "Trạng thái giao dịch" và điều kiện token theo pha: "Tạm dừng (đến hạn dự án)" ở `NOTICE`, "Tạm dừng (đã đóng băng)" ở `FROZEN`, "Đã đóng" ở `CLOSED`; câu giải thích dẫn tới thông báo ở `/portfolio`.

## 6. Hiệu năng (điều kiện nghiệm thu)

- Mở `/recall`: đúng 1 server action. `/portfolio`, `/trade`, tổng quan Người bán: số action không tăng.
- Một lần bấm "Thu hồi toàn bộ": tối đa 10 lệnh đốt; chờ biên nhận một lần cho cả lô (không chờ từng ví); không quét log từ block triển khai.
- Đọc không ghi sổ kiểm toán mới.

## 7. Ca kiểm

Vitest dùng ledger mock, kho bộ nhớ, `vi.setSystemTime`; biên nhận giả bằng mẫu `vi.mock` có sẵn ở `test/config-service.test.ts`. Ca nhãn (PG) chạy thêm bản Postgres khi có `TEST_DATABASE_URL`. Hardhat: `test/be-05-recall-evm.test.ts` (mới).

| Ca | Nội dung | Kỳ vọng |
|---|---|---|
| 1 | Mở đợt sai: Giao dịch viên; ngày quá khứ; ngày không có thật; `noticeDays = 0` trên chain EVM khác `hardhat-local`; dự án chưa phát hành; đã có đợt; hai lần mở cùng lúc | Từ chối đúng mã; Giao dịch viên `FORBIDDEN` có dòng DENIED; lần mở thứ hai `REQUEST_STATE` |
| 2 | Mở đợt hợp lệ; `noticeDays = 0`, hết hạn hôm nay trên mock | `INITIATED`, `recallFrom` đúng; pha `NOTICE` ngay và được đóng băng ngay |
| 3 | Trước `maturityDate`: đặt lệnh, duyệt Mint | Được; `recall` là `null` |
| 4 | Ranh giới nửa đêm giờ Việt Nam (16:59Z và 17:00Z ngày trước hạn) | Pha đổi đúng lúc 17:00Z |
| 5 | Từ `maturityDate`: đặt lệnh mua, bán; xem trước; duyệt Mint | `REQUEST_STATE` ở máy chủ, cùng lý do ở xem trước; duyệt Mint bị chặn |
| 6 | Dự án `CLOSED` không có đợt; `isSettlementMode` true không có đợt | Đặt lệnh bị chặn |
| 7 | Đóng băng sai: trước `recallFrom`; còn lệnh `PLACED`; còn kỳ chia hoạt động; danh sách ví bị cắt; Giao dịch viên | Từ chối, không gửi giao dịch |
| 8 | Đóng băng hợp lệ | `IN_PROGRESS`; hồ sơ `NOTIFIED` cho ví có số dư trừ ví SPV; không có hồ sơ cho ví số dư 0 |
| 9 | Đóng băng khi không có Nhà đầu tư nào | `IN_PROGRESS` với 0 hồ sơ; lô đầu hoàn tất ngay |
| 10 | Đóng băng: chờ biên nhận ném lỗi giữa chừng (giả tiến trình chết) | `freezeTxHash` đã lưu; lần bấm sau không gửi lần hai |
| 11 | Đóng băng: biên nhận `FAILED`; treo quá 10 phút; lỗi hết giờ khi gửi rồi bấm Huỷ đợt; tiến trình chết sau khi ghi dấu, trước khi lưu mã | `FAILED`: được gửi lại; treo: gửi lại, dấu giữ nguyên; huỷ bị từ chối; dấu không mã quá 10 phút: nhận mã từ sổ hoặc gửi lại |
| 12 | Huỷ đợt khi `INITIATED`; sau khi đã ghi `freezeRequestedAt`; huỷ sau `maturityDate` | Được; từ chối; giao dịch mở lại |
| 13 | Thu hồi 23 ví | Lô 1, 2 mỗi lô 10, lô 3 còn 3 rồi hoàn tất; dự án `CLOSED`; mỗi ví đúng một dòng `recall` |
| 14 | Chờ biên nhận ném lỗi sau khi gửi 2 ví (giả tiến trình chết) | Hai hồ sơ đã có `burnTxHash`; lô sau đối soát, `ledger.burn` không được gọi lại cho hai ví đó |
| 15 | Biên nhận `FAILED` cho 1 ví; lỗi revert lúc mô phỏng cho 1 ví | Cả hai `FAILED` có lý do; lô sau gửi lại với `burnTxHash` mới (mã cũ bị xoá khi chiếm); chưa hoàn tất khi còn hồ sơ này |
| 16 | Hai lần bấm thu hồi cùng lúc; khoá `RECALL` của lượt đã chết được tiếp quản sau ngân sách | Một lần `REQUEST_STATE` (khoá); `ledger.burn` gọi đúng một lần mỗi ví; một dòng `recall` mỗi ví; khoá chết được tiếp quản, khoá đang chạy thì không |
| 17 | Ví bị đóng băng riêng (`freeze`) | Vẫn bị đốt |
| 18 | Ví có số dư nhưng chưa có hồ sơ (Indexer chậm, giả lập); hồ sơ đã có cho ví khác | Lô sau lập bổ sung đúng ví đó, không lỗi trùng; chưa hoàn tất khi còn WPT ngoài vault |
| 19 | `isSettlementMode` false lúc `IN_PROGRESS` | Lô không đốt gì, báo lệch |
| 20 | Kỳ chia: mở kỳ hoặc duyệt khi pha `FROZEN` | Bị chặn |
| 21 | Quyền: Giao dịch viên gọi đóng băng, thu hồi, huỷ | `FORBIDDEN`, có dòng DENIED |
| 22 | Đọc tổng quan; `getPortfolio` có đợt | Tổng quan không thêm dòng sổ; `getPortfolio` chỉ có dòng `portfolio:read` như nền |
| 23 | (PG) Kho: chiếm có điều kiện, gắn mã có điều kiện, `activeChain` duy nhất, lập bổ sung bỏ qua trùng, hoàn tất nguyên tử, nâng lược đồ trên database cũ | Đúng; database cũ có đủ cột mới |
| 24 | Hardhat: phát hành, hai Nhà đầu tư mua, một ví bị đóng băng riêng; mở đợt (`noticeDays = 0`, hết hạn hôm nay); đặt lệnh bị chặn; đóng băng; chuyển WPT trên chuỗi bị từ chối; thu hồi | Tổng cung ngoài vault bằng 0; đợt `COMPLETED`; dự án `CLOSED`; mỗi ví có sự kiện `Transfer` về địa chỉ 0 khớp `txHash` trong sổ |
| 25 | Cờ trình diễn: `noticeDays = 0` trên chain EVM thường khi cờ tắt; khi cờ bật; ngày hết hạn trước hôm nay khi cờ bật | Từ chối; được; từ chối |
| 26 | Sửa mốc: khi `INITIATED`; ngày mới trước hôm nay; sau khi đã ghi `freezeRequestedAt`; Giao dịch viên | Được, sổ có mốc cũ và mới, `recallFrom` tính lại; từ chối; từ chối; `FORBIDDEN` |
| 27 | Mở đóng băng trước khi đốt (có hồ sơ `NOTIFIED`) | Token mở lại; đợt `INITIATED`; hồ sơ bị xoá; sau đó huỷ đợt được, hoặc đóng băng lại lập hồ sơ mới |
| 28 | Mở đóng băng sau khi đã đốt một ví; khi có hồ sơ `BURNING` | Từ chối, không gửi giao dịch |
| 29 | Mở đóng băng: biên nhận `PENDING` rồi bấm Thu hồi; biên nhận `FAILED` | Thu hồi bị từ chối; `FAILED` thì dấu được xoá, vẫn `IN_PROGRESS` |
| 30 | Hardhat: đóng băng, chuyển WPT bị từ chối, mở đóng băng, chuyển WPT được lại; đóng băng lại rồi thu hồi | Đúng như mô tả |
| 31 | E2E (mock): Kiểm soát viên mở đợt, sửa mốc, đóng băng (gõ ký hiệu), mở đóng băng, đóng băng lại, thu hồi; Nhà đầu tư thấy hộp thông báo và dòng "Thu hồi"; Giao dịch viên thấy màn không có nút | Đạt; mở `/recall` đúng 1 action |

## 8. Đột biến (mỗi đột biến làm ít nhất một ca đỏ)

- Bỏ chặn ở `placeOrder` (chỉ giữ ở xem trước) (ca 5).
- Bỏ chặn duyệt Mint (ca 5).
- Lưu mã giao dịch đốt sau khi chờ biên nhận (ca 14); lưu `freezeTxHash` sau khi chờ biên nhận (ca 10).
- Bỏ khoá thao tác chain ở `recallBatch` (ca 16).
- Chiếm hồ sơ không xoá mã cũ (ca 15).
- Hoàn tất khi mọi hồ sơ `BURNED` mà không kiểm tổng cung ngoài vault (ca 18).
- Bỏ điều kiện lệnh đang xử lý hoặc kỳ chia khi đóng băng (ca 7).
- Không bỏ ví SPV khỏi danh sách (ca 8).
- Cho huỷ khi đã có `freezeRequestedAt` (ca 12).
- Xoá dấu đóng băng khi gửi lỗi hết giờ (ca 11).
- Tổng quan dùng `authorize` thay vì `assertCan` (ca 22).
- Cho mở đóng băng khi đã có hồ sơ `BURNED` mang mã (ca 28).
- Cho ngày hết hạn trước hôm nay khi cờ trình diễn bật (ca 25).
- Không chặn lô thu hồi khi đang mở đóng băng (ca 29).
