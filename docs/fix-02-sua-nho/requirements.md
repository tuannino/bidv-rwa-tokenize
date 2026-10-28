# FIX-02: Nhà đầu tư không bán, Giao dịch viên lập nhiều lệnh Mint, cảnh báo khi duyệt, Burn toàn bộ nguồn cung tự điền, yêu cầu

Nền: `dev` @ `a1ff3aa` (sau merge FE-23, PR #76). Người viết: giám sát. Nguồn: tệp góp ý `fix-29102026.pdf` của chủ dự án ngày 29/10/2026, mục III và IV. Mục I (ví nhận khi Người bán rút) và mục II (bỏ cấu hình ví ở Thông tin tài khoản) đã làm ở FIX-01, chủ dự án chốt bỏ khỏi task này.

## 1. Bối cảnh

- Màn Giao dịch của Nhà đầu tư (`/trade`, `components/pages/investor-trade.tsx`) có hai nút "Mua", "Bán". Máy chủ nhận lệnh `SELL` ở `previewTrade`, `previewPurchase`, `preparePermit`, `placeOrder`.
- Khi lập yêu cầu Mint, `evaluate` ở `lib/bank/token-request.service.ts` có điều kiện `noPending` "Không có yêu cầu Mint khác đang chờ cho token này" (yêu cầu `PENDING` hoặc `EXECUTING` cùng token). Burn không có điều kiện này.
- Lúc Kiểm soát viên bấm "Chấp nhận", `approveTokenRequest` chạy lại `evaluate`; vượt trần hoặc vượt phần chưa phân phối thì trả lỗi SAU khi bấm. Màn chi tiết (`approval-detail.tsx`) không báo trước.
- Chọn nguồn huỷ "Toàn bộ nguồn cung" ở màn Lập lệnh (`draft.tsx`): số lượng chỉ được điền ĐÚNG lúc đổi nguồn (`chooseSource`). Nếu chọn nguồn khi khối thông tin token chưa tải xong, hoặc thông tin token tải lại sau đó, ô số lượng rỗng hoặc cũ mà vẫn khoá (ảnh trong tệp góp ý, câu cảnh báo in dấu gạch dài thay cho số token).
- Hợp đồng `ProjectToken` tự chặn vượt trần (`SupplyCapExceeded`) và Burn vượt số dư; các kiểm ở ứng dụng là để báo sớm, không phải lớp an toàn cuối.

## 2. Mục tiêu

1. Nhà đầu tư không bán được WPT: màn không có nút "Bán", máy chủ từ chối mọi lệnh `SELL`.
2. Giao dịch viên lập được nhiều yêu cầu Mint cùng token khi các yêu cầu trước còn chờ.
3. Kiểm soát viên thấy cảnh báo ngay khi mở yêu cầu không đủ số để thực hiện; nút "Chấp nhận" khoá, chỉ "Từ chối" được.
4. Burn "Toàn bộ nguồn cung": số lượng luôn bằng tổng cung hiện tại, không sửa được.
5. Không tăng số server action khi mở các màn có sẵn.

## 3. Quyết định

- **QĐ-1: chặn bán bằng cờ môi trường `ENABLE_INVESTOR_SELL`**, mặc định `false` (theo mẫu `ENABLE_DEMO_RECALL`). `wrangler.json` ghi rõ `"ENABLE_INVESTOR_SELL": "false"`. Cờ giữ lại để bật lại khi nghiệp vụ đổi, và để bộ kiểm thử cũ có lệnh `SELL` chạy tiếp (cấu hình vitest và Playwright đặt `true`, ca mới kiểm `false`).
- **QĐ-2: thứ tự chặn.** Bốn hàm nhận `side` trả `VALIDATION` câu "Nhà đầu tư không được bán token." khi `side === 'SELL'` và cờ tắt. Phân quyền và chốt ví phiên chạy TRƯỚC (vai không có quyền vẫn nhận `FORBIDDEN`, ví chưa gắn vẫn nhận `WALLET_NOT_BOUND`); ba hàm xem trước và chuẩn bị chữ ký chặn ngay sau đó, trước mọi lần đọc chuỗi. `placeOrder` chặn NGAY SAU bước tìm lệnh cũ theo `clientRequestId`: gửi lại đúng yêu cầu đã tạo (lúc cờ còn bật) thì vẫn nhận lại lệnh cũ, chỉ lệnh `SELL` MỚI bị chặn, kèm một dòng sổ kiểm toán FAILURE. Lệnh `SELL` cũ trong dữ liệu giữ nguyên, khớp, đối soát, hết hạn như cũ.
- **QĐ-3: bỏ hẳn điều kiện `noPending`** (khỏi `evaluate`, khỏi khối kiểm tra ở màn Lập lệnh và khỏi lần kiểm lại lúc duyệt). Tham số `excludeRequestId` của `evaluate` không còn dùng thì gỡ.
- **QĐ-4: cảnh báo lúc duyệt tính ở máy chủ, trong CÙNG lần đọc chi tiết** (`getTokenRequestDetail` đã đọc khối thông tin token), trả trường mới `approveWarning` có loại, `null` khi bấm được. Chỉ tính khi yêu cầu `PENDING`, xét theo thứ tự, lấy cái đầu tiên:
  - `TOKEN_UNREADABLE`: không đọc được thông tin token: "Không đọc được số liệu token để kiểm tra.";
  - `MINT_REMAINING`: Mint, `amount > token.remaining`: "Không đủ số lượng token còn được phép phát hành.", số liệu "Số lượng yêu cầu X; còn được phép phát hành Y.";
  - `BURN_FULL_SUPPLY`: Burn nguồn `TOTAL_SUPPLY`, `amount !== token.totalSupply`: "Tổng cung đã đổi so với lúc lập yêu cầu huỷ toàn bộ nguồn cung.", số liệu "Số lượng yêu cầu X; tổng cung hiện tại Y.";
  - `BURN_UNDISTRIBUTED`: Burn (cả hai nguồn), `amount > token.undistributed`: "Không đủ số lượng token chưa phân phối còn lại.", số liệu "Số lượng yêu cầu X; phần chưa phân phối còn Y.".
  Mọi loại đều khoá RIÊNG nút "Chấp nhận"; "Từ chối" vẫn bấm được. Hai loại Burn cùng đúng một lúc thì hiện loại đứng trước.
  Không cộng trừ các yêu cầu đang `EXECUTING` (giao dịch chưa vào khối): hai lần duyệt sát nhau vượt trần thì hợp đồng chặn và yêu cầu sau về `FAILED`; trường hợp hiếm, không làm phức tạp.
- **QĐ-5: số lượng Burn "Toàn bộ nguồn cung" là giá trị suy ra**, không phải ô nhập: màn dùng `info.totalSupply` mỗi lần hiển thị và gửi. Máy chủ thêm điều kiện `fullSupply` "Số lượng bằng tổng cung" cho nguồn này (ở cả lúc lập và lúc duyệt): tổng cung đổi sau khi lập (có Mint khác hoàn tất) thì Kiểm soát viên thấy khối kiểm tra trượt và từ chối.

## 4. Ngoài phạm vi

- Mục I, II của tệp góp ý (FIX-01 đã làm).
- Nút "Lưu ký Fireblocks" ở thanh điều hướng: thuộc task tích hợp Fireblocks sau FIX-02.
- Kênh bán của Người bán (`/seller/...`), thu hồi (BE-05): không đổi.
- Giữ chỗ trần cho nhiều yêu cầu Mint đang chờ: không làm (QĐ-4).

## 5. Yêu cầu chức năng

### A. Nhà đầu tư không bán

- **A1.** `lib/config/env.ts`: `enableInvestorSell: boolFlag(false)` trong lược đồ và `enableInvestorSell: process.env.ENABLE_INVESTOR_SELL` trong `load()`. Thêm vào `.env.example` (`ENABLE_INVESTOR_SELL=false`, một dòng chú thích), `wrangler.json` `vars`.
- **A2.** `previewTrade` (`trade.service.ts`), `previewPurchase`, `preparePermit`, `placeOrder` (`purchase.service.ts`): theo QĐ-2 (thứ tự chặn). Câu lỗi là hằng số dùng chung `INVESTOR_SELL_DISABLED_MESSAGE`.
- **A3.** `getTradeContext` trả thêm `sellEnabled: boolean` (đọc cờ, không đọc chuỗi).
- **A4.** Hàm thuần `tradeSides(sellEnabled): OrderSide[]` (`['BUY']` hoặc `['BUY', 'SELL']`) trong một tệp `.ts` của `components/` (không phải `.tsx`). `investor-trade.tsx` dựng cụm nút từ `tradeSides(ctx.sellEnabled)`, chỉ hiện cụm khi có hơn một chiều, `side` cố định `BUY` khi chỉ còn một; câu mô tả đầu màn đổi thành "Mua token từ người bán theo giá phát hành do ngân hàng cấu hình." `sellEnabled` true thì giữ như cũ.
- **A5.** `vitest.config.ts` `test.env` đặt `ENABLE_INVESTOR_SELL: 'true'`; `playwright.config.ts` `webServer.env` đặt `ENABLE_INVESTOR_SELL: 'true'` (bộ e2e có sẵn nhiều luồng bán). Ghi chú ngay tại hai dòng: đặt để giữ các ca bán cũ, hành vi mặc định là tắt.

### B. Nhiều yêu cầu Mint và cảnh báo khi duyệt

- **B1.** Gỡ `noPending` theo QĐ-3.
- **B2.** `TokenRequestDetailView.approveWarning: ApproveWarning | null` theo QĐ-4, với `ApproveWarning = { kind: 'TOKEN_UNREADABLE' | 'MINT_REMAINING' | 'BURN_FULL_SUPPLY' | 'BURN_UNDISTRIBUTED'; message: string; requested: string | null; available: string | null }`; hàm thuần `approveWarningOf(request, token)` để kiểm riêng.
- **B3.** `components/maker-checker/gates.ts`: hàm mới `approveBlockReason(detail)` trả `decisionBlockReason(detail) ?? detail.approveWarning?.message ?? null`. `approval-detail.tsx`: nút "Chấp nhận" dùng `approveBlockReason`; nút "Từ chối" giữ nguyên (`decisionBlockReason` và lý do từ chối). Có `approveWarning` thì hiện một khối cảnh báo màu vàng (lớp có sẵn của khối cảnh báo trong dự án) ngay trên hai nút: câu `message` và dòng số liệu theo loại (QĐ-4), không có dòng số liệu với `TOKEN_UNREADABLE`.
- **B4.** `approveTokenRequest` giữ nguyên lần kiểm lại toàn bộ điều kiện (lớp chặn cuối ở máy chủ).

### C. Burn toàn bộ nguồn cung

- **C1.** Hàm thuần `burnAmountShown(type, source, typedAmount, totalSupply): string` trong `components/maker-checker/gates.ts`: Burn nguồn `TOTAL_SUPPLY` trả `totalSupply ?? ''`, còn lại trả `typedAmount`. `draft.tsx` tính `const amountShown = burnAmountShown(type, burnSource, amount, info?.totalSupply ?? null)` mỗi lần dựng và dùng cho ô số lượng và `payload` (nên `payloadKey` đi theo). `chooseSource` vẫn đặt nguồn và `setConfirmed(false)`, chỉ bỏ `setAmount` từ tổng cung; ô "Tôi xác nhận huỷ toàn bộ nguồn cung" và `needsConfirmation` giữ nguyên; chuyển từ "Toàn bộ nguồn cung" về "Phần chưa phân phối" thì ô số lượng rỗng.
- **C2.** Ô số lượng ở chế độ này: `readOnly`, nền xám như ô chỉ đọc khác, chú thích dưới ô "Tự điền bằng tổng cung hiện tại, không sửa được."; khi chưa có thông tin token thì chú thích là "Nhập mã token để hệ thống điền tổng cung." và nút gửi khoá (payload rỗng).
- **C3.** `burnSourceEffect`: khi `totalSupply` null, câu cảnh báo không in số ("Bạn đang yêu cầu huỷ TOÀN BỘ nguồn cung. Chỉ thực hiện được ..."), không còn dấu gạch dài thay cho số.
- **C4.** Máy chủ: điều kiện `fullSupply` theo QĐ-5, nhãn "Số lượng bằng tổng cung", chi tiết "Số lượng X; tổng cung hiện tại Y.".

## 6. Hiệu năng

Không thêm action, không thêm lần đọc chuỗi: A3 đọc cờ; B2 dùng thông tin token mà màn chi tiết đã đọc; C4 dùng `readSupplyMetrics` mà nhánh Burn của `evaluate` đã gọi. Số action khi mở `/trade`, `/draft`, `/approvals/[id]` đo trước và sau, phải bằng nhau.

## 7. Kiểm thử

Tệp mới `app/test/fix-02.test.ts` (bộ nhớ, ledger mock, theo mẫu `test/token-request.test.ts`):

| # | Ca |
|---|---|
| 1 | Cờ tắt (`ENABLE_INVESTOR_SELL=false`, `resetServerEnvCache`): `previewTrade`, `previewPurchase`, `preparePermit`, `placeOrder` với `SELL` mới đều `VALIDATION` đúng câu. Theo dõi bằng `vi.spyOn` trên ledger mock: ba hàm đầu KHÔNG gọi phương thức đọc nào của ledger (`balanceOf`, `paymentBalanceOf`, `tokenInfo`, ...); `placeOrder` không gọi phép đọc số dư, có dòng audit FAILURE, không tạo lệnh. `BUY` vẫn chạy. Vai không có quyền gọi `SELL`: vẫn `FORBIDDEN`, không phải `VALIDATION` |
| 1b | Chống gửi trùng: cờ bật, đặt lệnh `SELL` với một `clientRequestId`; tắt cờ; gửi lại đúng yêu cầu đó: nhận lại ĐÚNG lệnh cũ (cùng id), số lệnh trong kho không đổi; gửi `SELL` với `clientRequestId` mới: bị chặn |
| 2 | Cờ tắt: `getTradeContext` trả `sellEnabled: false`; cờ bật: `true`. Hàm thuần `tradeSides(false)` là `['BUY']`, `tradeSides(true)` là `['BUY', 'SELL']` |
| 3 | Hai yêu cầu Mint liên tiếp cùng token (yêu cầu đầu còn `PENDING`) đều lập được; khối kiểm tra không còn khoá `noPending` |
| 4 | Hàm thuần `approveWarningOf` ở biên: số lượng BẰNG `remaining` (Mint) hoặc BẰNG `undistributed` (Burn) thì `null`, lớn hơn 1 thì có câu. Ba yêu cầu Mint, mỗi cái bằng 60% trần còn lại tính MỘT lần trước khi lập cả ba: chi tiết cả ba `approveWarning` null; duyệt cái đầu xong, chi tiết hai cái sau có câu "Không đủ số lượng token còn được phép phát hành."; gọi `approveTokenRequest` cho cái sau vẫn bị chặn (`REQUEST_CHECK`); `rejectTokenRequest` cho nó chạy được |
| 5 | Burn "Phần chưa phân phối" lớn hơn số dư ví SPV (dựng bằng hai yêu cầu Burn, duyệt cái đầu): chi tiết cái sau có câu "Không đủ số lượng token chưa phân phối còn lại." |
| 6 | Yêu cầu không còn `PENDING`: `approveWarning` null. Không đọc được thông tin token (giả lỗi đọc như các ca `tokenError` có sẵn): `approveWarning.kind` là `TOKEN_UNREADABLE`, `approveBlockReason` khoá, `rejectTokenRequest` vẫn chạy |
| 7 | Burn "Toàn bộ nguồn cung" với số khác tổng cung: lập bị chặn, khoá lỗi `fullSupply`; bằng tổng cung (1.000): lập được, chi tiết `approveWarning` null; Mint thêm 500 hoàn tất (tổng cung và chưa phân phối 1.500): chi tiết có `BURN_FULL_SUPPLY` với số liệu 1.000 và 1.500, nút khoá; lần duyệt vẫn bị máy chủ chặn vì `fullSupply` |
| 8 | Hàm thuần: `approveBlockReason` (khoá khi có cảnh báo, khi không `PENDING`, khi tự duyệt); `burnSourceEffect` với `totalSupply` null không chứa ký tự gạch dài (U+2014) |
| 9 | Hàm thuần `burnAmountShown`: chọn "Toàn bộ nguồn cung" khi token chưa tải (`null`): `''`; token tải xong sau đó (`'1000'`): `'1000'` dù `typedAmount` vẫn rỗng; tổng cung tải lại (`'1500'`): `'1500'`; về "Phần chưa phân phối" với `typedAmount` `''` rồi gõ `'7'`: `''` rồi `'7'`; Mint luôn trả `typedAmount` |

Sửa ca có sẵn: `test/token-request.test.ts` (bỏ `noPending` ở hai ca khẳng định nó, quanh dòng 230 và 244; ca sau chỉ còn khoá lỗi `wallet`), các tệp khác khẳng định `noPending` nếu có. Ca bán cũ chạy với cờ bật qua `vitest.config.ts`. `test/maker-checker-ui.test.ts` (khối `burnSourceEffect`) và `e2e/maker-checker.spec.ts` (ô xác nhận huỷ toàn bộ nguồn cung) phải giữ xanh, không sửa khẳng định.

Giao diện: không thêm e2e (task nhỏ; Playwright chạy với cờ bật để giữ luồng bán cũ). Hai chỗ giao diện có điều kiện đi qua hàm thuần đã kiểm (`tradeSides`, `burnAmountShown`); khi nghiệm thu, giám sát đọc mã để xác nhận màn dùng đúng hai hàm này. Ảnh ở mục 8 chụp trên bản chạy với cờ mặc định (tắt).

Đột biến bắt buộc (ghi ca đỏ vào checkpoint): bỏ chặn `SELL` ở `placeOrder`; bỏ chặn ở `preparePermit`; `sellEnabled` luôn true; trả lại `noPending`; `approveWarning` so `>=` thay `>`; bỏ cảnh báo Burn; `approveBlockReason` bỏ qua `approveWarning`; bỏ điều kiện `fullSupply`; bỏ loại `BURN_FULL_SUPPLY`; `TOKEN_UNREADABLE` trả `null`; `placeOrder` chặn `SELL` TRƯỚC bước tìm lệnh cũ; `burnAmountShown` trả `typedAmount` cho `TOTAL_SUPPLY`. (Tổng 12.)

## 8. Điều kiện hoàn thành

- [ ] A1 tới A5, B1 tới B4, C1 tới C4 đã làm.
- [ ] Vitest ca 1 tới 9 (gồm 1b) xanh; 12 đột biến đều bị bắt.
- [ ] `typecheck`, `lint`, toàn bộ `vitest`, `build`, `e2e` mock xanh; `arch markers checkpoint` của `run-local-all.sh` xanh.
- [ ] Bảng số action khi mở `/trade`, `/draft`, `/approvals/[id]` trước và sau bằng nhau, ghi trong checkpoint.
- [ ] Ảnh trên `mock` vào `docs/images/fix-02/` (tên có tiền tố ngày): `/trade` không có nút Bán; màn chi tiết duyệt có khối cảnh báo và nút Chấp nhận khoá; màn Lập lệnh Burn chọn "Toàn bộ nguồn cung" có số lượng tự điền.
- [ ] Diff không thêm dòng chứa ký tự mũi tên, gạch dài, chấm giữa (trừ dòng do script sinh).
- [ ] `docs/USER_GUIDE.md` (Nhà đầu tư chỉ mua; nhiều yêu cầu Mint; cảnh báo khi duyệt; Burn toàn bộ nguồn cung), `docs/CHECKPOINT_FIX02.md`, `.kiro/task-status.json`.
