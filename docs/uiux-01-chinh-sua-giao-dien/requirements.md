# UIUX-01: chỉnh sửa giao diện theo góp ý nghiệp vụ, yêu cầu

Nền: `dev` @ `2541c8a` (sau merge FE-10, PR #73). Người viết: giám sát. Nguồn: tệp góp ý `20261026_feature_fixed.pdf` (mục I tới IV) và bốn ý bổ sung của chủ dự án ngày 26/10/2026. Theo chốt của chủ dự án, góp ý được tách hai task: UIUX-01 (tài liệu này) gồm mọi phần chỉ là giao diện và kiểm dạng; FIX-01 (spec riêng, viết sau) gồm phần Người bán tự đặt ví nhận tiền rút và màn Rút tiền lấy ví thanh toán (góp ý III.1 ý 2, IV.1, phần đồng bộ của IV.2).

## 1. Bối cảnh và mục tiêu

Nghiệp vụ dùng thử các màn Mint, Burn, Vault, Rút tiền, Thông tin tài khoản và gửi danh sách chỉnh sửa. Đây là task sửa giao diện, sửa máy chủ chỉ ở chỗ giao diện cần. Mục tiêu:

1. Số lớn dễ đọc khi lập lệnh; Kiểm soát viên xem được lịch sử duyệt; câu từ chối rõ ai từ chối, vì sao.
2. Kiểm soát viên cấu hình vault theo MỘT chế độ khoá.
3. Màn trạng thái vault chỉ hiện các trường nghiệp vụ cần, đúng thứ tự.
4. "Ví thanh toán" là MỘT thông tin trên màn tài khoản (chỉ hiển thị; đồng bộ với ví nhận của vault làm ở FIX-01).
5. Không còn chữ "trình diễn" trên giao diện và UserGuide; dùng "PoC".
6. Không tăng số server action khi mở các màn có sẵn.

## 2. Quyết định

- **QĐ-1: phần hợp đồng tách task riêng (SC-11), làm ngay sau UIUX-01.** Góp ý III.1 "cấu hình có hiệu lực ngay" cần sửa `SpvPaymentVault`: hiện sau kỳ đầu, `setPercentRate` chỉ ghi tỷ lệ chờ tới lần `closePeriod` kế tiếp. UIUX-01 KHÔNG sửa hợp đồng, nhưng làm giao diện chờ sẵn: máy chủ trả trường `percentApplies` (`'NOW'` hoặc `'NEXT_PERIOD'`), giao diện chỉ vẽ theo trường này. Khi SC-11 xong, chỉ máy chủ đổi, giao diện không sửa.
- **QĐ-2: ví nhận tiền rút giữ như hiện nay trong UIUX-01.** Ô "Ví nhận tiền rút" của Kiểm soát viên vẫn còn, màn Rút tiền vẫn hiện ví nhận trên vault. FIX-01 chuyển ví nhận sang Người bán tự đặt (bật cả trên Sepolia, có cảnh báo và ghi nợ kỹ thuật, theo chốt của chủ dự án).
- **QĐ-3: lưu ví ở màn tài khoản giữ nguyên máy chủ** (`linkProfileWallet`) cho cả Nhà đầu tư và Người bán, không có giao dịch chuỗi; chỉ đổi nhãn và bố cục.
- **QĐ-4: "Ví thanh toán" trên màn tài khoản là ví hiệu lực trên chain đang chọn**: ví đã liên kết; chưa liên kết thì ví mẫu (chỉ trên `mock`, `hardhat-local`, đúng như `getProfileWallet` đang tính `effective`); không có thì "Chưa có ví thanh toán trên chain này". Ví mẫu tĩnh `customer.wallet` không hiện thẳng nữa.
- **QĐ-5: lịch sử phê duyệt đi kèm action thẻ số liệu.** `getApprovalStats` trả thêm `history` (50 yêu cầu đã có quyết định gần nhất của chain), nên màn `/approvals` vẫn 3 action khi mở.
- **QĐ-6: "Ngày cấu hình có hiệu lực" tính ở máy chủ** trong `getVaultOverview` (đọc thêm `vaultConfigEvents()` trong CÙNG action, lỗi đọc cách ly riêng), bằng hàm thuần `configEffectiveAt`. Không thêm action. Không suy mốc áp tỷ lệ chờ từ các lần chốt kỳ: trường hợp này mất hẳn khi SC-11 bỏ tỷ lệ chờ, nên UIUX-01 chỉ hiện ghi chú tỷ lệ chờ (D2).
- **QĐ-7: chữ "trình diễn" chỉ thay trên giao diện (chuỗi người dùng thấy, kể cả câu lỗi máy chủ) và `docs/USER_GUIDE.md`.** Chú thích mã, tên test, tên cờ (`ENABLE_DEMO_*`) giữ nguyên.
- **QĐ-8: kiểm thử tối thiểu.** Chỉ thêm vitest cho kiểm một chế độ của cấu hình vault và hai hàm thuần mới. Không thêm E2E, không đột biến. Sửa các test và E2E có sẵn bị vỡ do đổi nhãn hay thêm `mode`. Bằng chứng giao diện là ảnh chụp.

## 3. Ngoài phạm vi

- Sửa hợp đồng, triển khai lại vault (SC-11).
- Người bán tự đặt ví nhận, màn Rút tiền lấy ví thanh toán, chặn rút khi lệch ví, cảnh báo lệch ở màn tài khoản (FIX-01).
- Màn chi tiết `/approvals/<mã>`, màn Lập lệnh ngoài ô số lượng và bảng.
- Thay chữ "trình diễn" trong chú thích mã, tên test, tài liệu khác ngoài UserGuide.
- Ví nhận cho Nhà đầu tư (không có vault riêng).

## 4. Yêu cầu chức năng

### A. Luồng Mint và Burn

- **A1. Ô số lượng có dấu chấm hàng nghìn khi gõ.**
  - Áp cho bốn ô: "Số lượng" của form Lập lệnh (`components/pages/draft.tsx`, cả Mint và Burn), "Số lượng WPT" của `components/pages/mint.tsx`, "Số khoá cố định (VNDB)" ở `/vault` (C1), "Số tiền rút (VNDB)" ở `/seller/withdraw`. Nhãn các ô giữ nguyên.
  - Trạng thái giữ CHUỖI CHỮ SỐ THÔ (`"20000000"`); ô hiển thị `formatAmount(raw)` (`"20.000.000"`); `onChange` bỏ mọi ký tự không phải chữ số rồi mới lưu. Gửi máy chủ chuỗi thô như hiện nay. Ô rỗng hiện rỗng (không hiện ký tự gạch dài như `formatAmount` trả cho chuỗi rỗng).
  - Dùng chung một thành phần `AmountInput` (mục thiết kế 1), không viết lặp.
- **A2. Câu điều kiện ở khối kiểm tra có dấu chấm.** Các câu trong `evaluate` của `token-request.service.ts` có số lượng token dùng `formatAmount`. Chữ chính xác:
  - Trần: `Số lượng 20.000.000; trần còn lại 19.999.000 (trần 20.000.000 trừ tổng cung 1.000).`
  - Chưa phân phối: `Số lượng 1.000; phần chưa phân phối trong ví SPV 5.000.`
  - Lưu hành: `Còn 1.000 token đang lưu hành ngoài ví SPV, không đốt theo toàn bộ nguồn cung.` (thay ký tự gạch dài bằng dấu phẩy).
- **A3. Lịch sử phê duyệt** ở màn `/approvals` (Kiểm soát viên), thẻ thứ ba "Lịch sử phê duyệt" dưới hai hàng chờ.
  - Dữ liệu: `history` của `getApprovalStats` (QĐ-5): yêu cầu có `decidedAt` khác null, cùng chain, mọi loại, mới quyết định trước, tối đa 50.
  - Cột: Mã yêu cầu (liên kết sang chi tiết), Loại ("Tạo token" hoặc "Huỷ token"), Token, Số lượng, Người lập, Người duyệt (`checkerId`), Thời điểm duyệt (`formatDateTime(decidedAt)`), Trạng thái, Chain, Kết quả.
  - Đủ 50 dòng thì câu dưới bảng: "Hiện 50 quyết định gần nhất."
- **A4. Câu kết quả khi bị từ chối** (bảng ở màn Lập lệnh, hai hàng chờ, lịch sử): `"<vai> <mã người> từ chối do: <lý do>"`, ví dụ `Kiểm soát viên KSV001 từ chối do: Sai chứng từ`. Vai lấy từ `checkerRole` qua bảng nhãn vai dùng chung (mục thiết kế 2). Thiếu `checkerRole` thì bỏ phần vai.

### B. Bảng yêu cầu (dùng chung cho Mint và Burn)

- **B1.** Cột Token chỉ còn ký hiệu, bỏ phần `(evm)`.
- **B2.** Thêm cột "Chain" ngay sau cột "Trạng thái", hiện nhãn chain (`CHAINS[row.chain].label`).
- **B3.** Câu kết quả `COMPLETED` đổi thành `"<mã người> duyệt, tx <12 ký tự đầu>…"`; không có mã tx thì `"<mã người> duyệt"` (bỏ ký tự chấm giữa và gạch dài). Ô trống ở bảng (PENDING, không có nguồn) giữ như hiện nay vì không phải dòng thêm mới; dòng nào đã sửa thì ô trống viết "Không có".
- Áp ở `components/maker-checker/request-table.tsx` nên mọi bảng (Lập lệnh, hai hàng chờ, lịch sử) cùng đổi.

### C. Vault thanh toán SPV, cấu hình (Kiểm soát viên)

- **C1. Chọn một chế độ.** Biểu mẫu có nhóm chọn "Chế độ khoá": "Theo tỷ lệ %" hoặc "Khoá số cố định". Chỉ hiện ô của chế độ đang chọn: "Tỷ lệ khoá (%)" hoặc "Số khoá cố định (VNDB)" (ô này dùng `AmountInput`). Mặc định chọn theo `lockMode` hiện hành (`UNSET` thì "Theo tỷ lệ %").
- **C2. Ô "Ví nhận tiền rút" giữ nguyên** (QĐ-2), đặt dưới nhóm chế độ; kiểm và bước `setPayoutWallet` giữ như hiện nay.
- **C3. Máy chủ kiểm một chế độ.** Đầu vào `{ chain, mode: 'PERCENT' | 'FIXED', percent?, fixedLock?, payoutWallet }`.
  - `PERCENT`: `percent` bắt buộc, hợp lệ như hiện nay; `fixedLock` phải rỗng hoặc vắng.
  - `FIXED`: `fixedLock` bắt buộc, số nguyên lớn hơn 0; `percent` phải rỗng hoặc vắng.
  - Có cả hai: lỗi `VALIDATION` "Chỉ nhập một trong hai: tỷ lệ % hoặc số khoá cố định." gắn vào ô không thuộc chế độ đã chọn. Kiểm trước khi lấy khoá hay chạm chuỗi.
- **C4. Câu hiệu lực** dưới ô (theo `percentApplies` của tổng quan, QĐ-1):
  - Chế độ "Khoá số cố định": "Có hiệu lực ngay khi lưu."
  - "Theo tỷ lệ %" và `percentApplies === 'NOW'`: "Có hiệu lực ngay khi lưu."
  - "Theo tỷ lệ %" và `'NEXT_PERIOD'`: "Tỷ lệ mới áp từ lần chốt kỳ tiếp theo." Hiện tại máy chủ trả `'NEXT_PERIOD'` khi `lastPeriodRef > 0`, ngược lại `'NOW'`.
- **C5.** Sau khi lưu thành công, tải lại tổng quan như hiện nay. Câu kết quả và danh sách bước giữ nguyên dạng hiện có.

### D. Vault, khối "Trạng thái hiện tại" (mọi vai xem `/vault`)

- **D1. Chỉ hiện các trường sau, đúng thứ tự:**

| # | Nhãn | Giá trị | Ghi chú |
|---|---|---|---|
| 1 | Số dư VNDB | `vndbBalance` VNDB | |
| 2 | Số VNDB đang khoá | `lockedAmount` VNDB | |
| 3 | Số dư WPT | `wptBalance` WPT | |
| 4 | VNDB có thể rút | `withdrawable` VNDB | |
| 5 | Chế độ khoá | `MODE_LABEL` hiện có, giữ nguyên chữ (kể cả `UNSET`: "Chưa cấu hình, khoá toàn bộ") | Không đổi `MODE_LABEL` vì bảng lịch sử cấu hình và E2E dùng chung |
| 6 | Tỷ lệ áp | `percentRateBps` dạng % | Chỉ khi `PERCENT` |
| 7 | Mức khoá cố định | `fixedLockAmount` VNDB | Chỉ khi `FIXED` |
| 8 | Lợi nhuận chia quý trước | `lastDistributedPrev` VNDB | |
| 9 | Ngày cấu hình có hiệu lực | `formatDateTime` của `configEffectiveAt` | "Chưa cấu hình" khi null; "Không đọc được" khi lỗi đọc sự kiện |
| 10 | Địa chỉ vault | `address` | |
| 11 | Trạng thái rút | "Đang hoạt động" hoặc "Đang tạm dừng" | |

- **D2.** Có tỷ lệ chờ (`pendingPercentRateBps` khác null): một dòng ghi chú dưới bảng: "Tỷ lệ <x>% đã lưu, áp từ lần chốt kỳ tiếp theo."
- **D3.** Bỏ khỏi khối này: Thu ròng, Kỳ gần nhất, Phần khoá theo kỳ, Tỷ lệ chờ áp (thành ghi chú D2), Ví nhận tiền rút, Khoá cố định khi không ở chế độ FIXED. Các thẻ khác của `/vault` (lịch sử cấu hình, lịch sử chốt kỳ, lệnh rút cần xem) giữ nguyên.
- **D4. `configEffectiveAt`** (hàm thuần, QĐ-6). Đầu vào: `lockMode` và sự kiện cấu hình (`param`, `blockNumber`, `logIndex`, `timestamp`), thứ tự bất kỳ (hàm tự sắp theo `blockNumber` rồi `logIndex`, KHÔNG theo `timestamp` vì mock gán cùng giây). Kết quả là sự kiện mới nhất trong:
  - `LOCK_MODE` (mọi chế độ);
  - `FIXED_LOCK` khi chế độ `FIXED`;
  - `PERCENT_RATE` khi chế độ `PERCENT` (sự kiện `PENDING_PERCENT_RATE` không tính).
  - Trả `{ at: number | null; unknown: boolean }`: `UNSET` hoặc không có sự kiện thì `at: null`; sự kiện chọn ra có `timestamp` bằng 0 thì `unknown: true`.
  - Hiển thị: `at` null là "Chưa cấu hình"; `unknown` là "Không xác định được"; lỗi đọc sự kiện là "Không đọc được".
  - Máy chủ đọc `vaultConfigEvents()` và `vaultPeriodCloses(10)` song song, MỖI phép đọc tự bắt lỗi (`Promise.allSettled` hoặc bọc riêng): lỗi bên này không làm mất kết quả bên kia. Lỗi sự kiện cấu hình ghi vào `configEffectiveError`, lỗi chốt kỳ giữ `historyError` như hiện nay.
  - Lưu ý cho người đọc: sau kỳ đầu, khi tỷ lệ chờ được áp ở lần chốt kỳ, ngày ở đây vẫn là ngày lưu tỷ lệ (không phải ngày chốt kỳ). Chấp nhận vì SC-11 bỏ tỷ lệ chờ ngay sau task này.

### E. Tổng quan Người bán

- **E1.** Nhãn "Ví thanh toán: <địa chỉ vault>" ở tổng quan Người bán đổi thành "Địa chỉ vault: <địa chỉ>" để không trùng nghĩa với ví thanh toán của tài khoản. Màn `/seller/withdraw` giữ nguyên trong UIUX-01 (trừ ô số tiền dùng `AmountInput`).

### F. Màn Thông tin tài khoản (Nhà đầu tư và Người bán), chỉ giao diện

- **F1. Một thông tin "Ví thanh toán".**
  - Ô ở khối thông tin cá nhân hoặc pháp nhân: nhãn "Ví thanh toán" cho cả hai loại khách hàng; giá trị là ví hiệu lực trên chain đang chọn (QĐ-4), đổi chain thì đổi theo.
  - Khối ví bên dưới: tiêu đề "Ví thanh toán trên chain <nhãn chain>"; bỏ dòng "Ví đang liên kết"; giữ "Cập nhật lúc" khi có.
  - Ô nhập đổi nhãn thành "Dùng địa chỉ ví mới", luôn để trống khi mở và sau khi lưu thành công, chữ gợi ý `0x…`.
  - "Dùng ví đang kết nối" điền ví của trình duyệt vào ô như hiện nay.
  - "Lưu" gọi `linkProfileWalletAction` như hiện có (máy chủ không đổi); lỗi hiện dưới ô; thành công thì ô "Ví thanh toán" phía trên đổi theo.
  - Cả hai chỗ đọc từ MỘT lần gọi `getProfileWalletAction` (mục thiết kế 6).
  - Khối `[data-account-role]` của `AccountInfoPage` không có nút hay ô nhập (E2E `account-info.spec.ts` khẳng định); ô nhập và nút nằm trong khối ví.

### G. Chữ "trình diễn" và màn Nạp VNDB

- **G1.** Menu: `'Nạp VNDB (trình diễn)'` thành `'Nạp VNDB'`.
- **G2.** Màn `/demo-payment`, dưới tiêu đề "Nạp VNDB mô phỏng", hộp ghi chú thay bằng hai dòng gạch đầu dòng, đúng chữ sau (chữ đậm như mẫu):
  - **VNDB (giả lập theo yêu cầu của nghiệp vụ):** Là đồng Stablecoin do bên thứ ba phát hành dùng để thanh toán mua bán WPT Token
  - **Chức năng chỉ dùng cho bản PoC:** tạo VNDB không có tiền gửi thật đứng sau. Sẽ tắt khi lên môi trường thật
  Bỏ phần "(cờ ENABLE_DEMO_PAYMENT_MINT). Chuỗi đang dùng: …".
- **G3.** `components/recall/round-info.tsx`: "Chế độ trình diễn" thành "Chế độ PoC".
- **G4.** `lib/bank/recall.service.ts:50`: "chế độ trình diễn" thành "chế độ PoC".
- **G5.** Quét lại: không còn "trình diễn" trong chuỗi giao diện dưới `app/src` (lệnh ở tasks bước 9; chỉ còn trong chú thích). `docs/USER_GUIDE.md`: thay hết bằng "PoC" (12 chỗ), sửa câu cho đúng ngữ pháp ("nạp trình diễn" thành "nạp PoC", "Cờ trình diễn" thành "Cờ PoC").

## 5. Hiệu năng

Đo số server action (yêu cầu `POST` có header `next-action`) khi mở, trên `mock`, trước (`2541c8a`) và sau: `/approvals`, `/vault`, `/account` (Người bán, Nhà đầu tư), `/draft`. Sau phải BẰNG trước. Ghi bảng vào checkpoint.

## 6. Kiểm thử (QĐ-8)

Vitest mới, một tệp `test/uiux-01.test.ts`, chain `mock`:

| Ca | Nội dung |
|---|---|
| 1 | `saveVaultConfig` có cả `percent` và `fixedLock`: `VALIDATION` gắn đúng ô, không lấy khoá; `mode: 'FIXED'` thiếu `fixedLock`: `VALIDATION` |
| 2 | `planVaultConfig`: đích `FIXED` không có `setPercentRate`, đích `PERCENT` không có `setFixedLock`; ví nhận đổi vẫn có `setPayoutWallet` đứng đầu |
| 3 | `configEffectiveAt`: FIXED; PERCENT có thêm sự kiện chờ mới hơn (không tính); đầu vào lộn thứ tự cùng `timestamp` (chọn theo block); `timestamp` 0 cho `unknown`; `UNSET` cho `null` |
| 4 | `getApprovalStats().history`: chỉ yêu cầu đã quyết định, xếp `decidedAt` giảm dần, đúng chain; `resultText` của dòng `REJECTED` ra đúng "Kiểm soát viên <mã> từ chối do: <lý do>" |
| 5 | `getVaultOverview` khi `vaultConfigEvents` ném lỗi: vẫn trả trạng thái và lịch sử chốt kỳ, `configEffectiveError` có giá trị |

Sửa test và E2E có sẵn bị vỡ. Danh sách đã biết (người làm chạy toàn bộ và bổ sung nếu còn):

| Tệp | Lý do vỡ | Cách sửa |
|---|---|---|
| `test/be-13-vault-config.test.ts` | Đầu vào không có `mode`, có cả hai ô | Thêm `mode`, chỉ giữ ô của chế độ |
| `test/be-13-withdraw.test.ts:81`, `test/be-13-seller.test.ts:38` | `saveVaultConfig` có cả hai ô | `mode: 'FIXED', fixedLock: '400'`, giữ `payoutWallet` |
| `test/fe-08-approval-evm.test.ts:186`, `test/op-05-demo-cycle-evm.test.ts:145` (chạy khi có `TEST_HARDHAT_RPC`) | Như trên | Như trên; chạy lại hai tệp trên nút Hardhat |
| `test/account-info.test.ts` | Nhãn "Địa chỉ ví" thành "Ví thanh toán" | Đổi nhãn; `PaymentWalletValue` dựng được khi không có provider (hiện "Đang đọc…") |
| `test/maker-checker-ui.test.ts` | Có thể khẳng định câu kết quả cũ | Đổi theo A4, B3 |
| `e2e/maker-checker.spec.ts:118` | `toHaveValue(total.toString())` nay hiển thị có dấu chấm | So với `formatAmount(total)`; rà mọi `toHaveValue` trên bốn ô số |
| `e2e/vault-withdraw.spec.ts` | Biểu mẫu có nhóm chế độ, khối trạng thái không còn hiện ví nhận (`:47`) | Xem tasks bước 8 |
| `e2e/account-info.spec.ts` | Nhãn "Địa chỉ ví" | Đổi nhãn |

Nguyên tắc sửa: giữ ý nghĩa ca cũ, chỉ đổi nhãn hoặc thêm `mode`. Không thêm tệp E2E mới.

## 7. Điều kiện hoàn thành

- [ ] A1 tới A4, B1 tới B3, C1 tới C5, D1 tới D4, E1, F1, G1 tới G5 đã làm.
- [ ] Vitest ca 1 tới 5 xanh; toàn bộ `typecheck`, `lint`, `vitest`, `build`, `e2e` (mock và hardhat) xanh.
- [ ] Bảng số action khi mở (mục 5) trước và sau bằng nhau, ghi trong checkpoint.
- [ ] Ảnh chụp trên `mock` trong `docs/images/uiux-01/`: lập lệnh có số định dạng và khối kiểm tra; `/approvals` có lịch sử và câu từ chối; `/vault` khối trạng thái và biểu mẫu mỗi chế độ (2 ảnh); `/account` Nhà đầu tư và Người bán (2 ảnh); `/demo-payment`.
- [ ] Lệnh quét "trình diễn" (tasks bước 9) chỉ ra dòng chú thích.
- [ ] Diff không thêm dòng chứa ký tự mũi tên, gạch dài, chấm giữa (lệnh quét tasks bước 9).
- [ ] UserGuide cập nhật mục 7 thiết kế; `docs/CHECKPOINT_UIUX01.md`; `.kiro/task-status.json` có UIUX-01 ở `done`.
