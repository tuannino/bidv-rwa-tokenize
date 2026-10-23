# FE-07: màn giá phát hành và nguồn cung; một nguồn giá cho mọi màn

> Mức kiểm chứng: **cao** (giá quyết định số tiền mỗi lệnh). Nhánh `feat/fe-07-cau-hinh-gia` từ `dev` @ `f11f1ae`.
> Thay spec FE-07 cũ trong `20261007_spec_dot5_v3.zip` (đã lỗi thời: phần hạn mức khoá vault đã làm ở BE-13 tại màn `/vault`).
> Nguồn: UserGuide Phụ lục C lệch L-02; quy tắc "mọi tham số cấu hình có lịch sử" (Sếp chốt 20/10); bài học HF-05.

## Mục tiêu

1. Giao dịch viên đặt giá phát hành WPT trên màn hình, có xác nhận, lý do và lịch sử. Kiểm soát viên xem cùng màn, không sửa.
2. Màn cùng hiện tình trạng phát hành: trần, tổng cung trên chuỗi, phần còn được phát hành, mốc phát hành, ví SPV.
3. **Một nguồn giá cho khách hàng (đóng L-02):** mọi màn hiện "giá phát hành" cho Nhà đầu tư và Người bán dùng đúng giá mà lệnh sẽ được chốt.
4. Đổi giá chỉ ghi database **sau khi chuỗi xác nhận** (cùng loại lỗi với HF-05).

## Hiện trạng đã đo (đọc mã tại `f11f1ae`)

Quy ước: đường dẫn tính từ `app/src/`.

- **Máy chủ đã có, chưa màn nào dùng:**
  - `setIssuePriceAction`, `getIssuePriceAction` (`app/actions/config.ts`, marker `@pending FE-07`).
  - `getIssuePrice` (`lib/bank/config.service.ts:95`) trả giá có hiệu lực (trên chuỗi khi có OrderSettlement), giá trong database, cảnh báo lệch, người và thời điểm đặt.
  - `listConfigHistory` có ở cổng lưu trữ cấu hình (`lib/store/config.store.port.ts:108`); `setConfig` tự ghi lịch sử.
  - `issuanceStatusAction` (`app/actions/bank.ts:49`, marker `@pending FE-07`).
- **Quyền:** đổi giá cần `treasury:manage` và cờ cấu hình của vai (`lib/rbac/config-role.ts`). Chỉ **Giao dịch viên** được đổi; Kiểm soát viên giám sát, không tự đặt.
- **Lỗi 1, đổi giá không chờ xác nhận:** `setIssuePrice` gọi `ledger.setPurchasePrice` (adapter EVM `writeOn` trả PENDING ngay sau khi gửi, `lib/ledger/evm.adapter.ts:850`) rồi **ghi database ngay** (`config.service.ts:196-205`). Giao dịch bị chuỗi từ chối thì database và mọi màn nói giá mới, còn chuỗi vẫn chốt lệnh theo giá cũ.
- **Lỗi 2, L-02:** màn khách hàng đọc giá từ SystemConfig, còn lệnh chốt theo `OrderSettlement.price`:
  - `lib/bank/portfolio.service.ts:93` và `:187` (`/portfolio`, `/tokens/[symbol]`);
  - `lib/bank/seller.service.ts:118` (`/seller`, `/seller/withdraw`);
  - `lib/bank/trade.service.ts:139` (thẻ "Thông tin token" ở `/trade`; riêng ô "Giá" đã đọc `quotePurchase`).
- **Lỗi 3, lệnh đang xử lý khi đổi giá:** `OrderSettlement.buy` và `sell` kiểm `vndb == wpt nhân price` lúc thực thi. Lệnh đã đặt theo giá cũ mà chưa quyết toán sẽ bị chuỗi từ chối (`PriceMismatch`). Hiện không có gì ngăn đổi giá khi còn lệnh như vậy.
- `getIssuanceStatus` kiểm quyền bằng `authorize('balance:read')`, nên mỗi lần đọc ghi một dòng sổ (lệch L-01). Màn mới không được dùng đường này khi mở.

## Việc cần làm

1. **Màn `/config` "Giá và phát hành"** (khu `(ops)`, cổng `ops:read`; mục menu cho cả Giao dịch viên và Kiểm soát viên, đặt sau "Vault thanh toán SPV"):
   - **Khối "Giá phát hành":** giá đang áp dụng cho lệnh mới (nguồn: chuỗi nếu có OrderSettlement), giá đã cấu hình trong database, người và thời điểm đặt gần nhất, ngưỡng cảnh báo đổi giá (`wpt.price_change_threshold`). Hai giá khác nhau thì hiện cảnh báo vàng: "Giá trên hợp đồng khác giá đã cấu hình", kèm hướng dẫn: Giao dịch viên đặt lại đúng giá mong muốn để hai nơi khớp.
   - **Khối "Đổi giá"** (chỉ hiện với vai được đổi cấu hình): ô giá mới (số nguyên VND), ô lý do (bắt buộc), nút "Đổi giá". Bấm thì hiện hộp xác nhận: "Đổi giá phát hành từ X sang Y VNDB. Áp dụng ngay cho mọi lệnh mới." Nếu máy chủ trả lỗi vượt ngưỡng: hộp xác nhận thứ hai nêu rõ mức lệch, có ô đánh dấu "Tôi đã kiểm số chữ số", rồi mới gửi lại với `confirmLargeChange: true`.
   - **Khối "Tình trạng phát hành":** trần theo bảng dự án, tổng cung trên chuỗi, phần còn được phát hành, mốc phát hành lần đầu, ví SPV (rút gọn, có nút chép). Trần và tổng cung lệch bất thường (tổng cung vượt trần) thì hiện cảnh báo.
   - **Khối "Lịch sử đổi giá":** 20 dòng gần nhất từ `SystemConfigHistory` của khoá `wpt.issue_price_vnd.<chain>`: thời điểm, vai, giá cũ, giá mới, lý do, mã giao dịch.
2. **Một server action khi mở** `getPriceConfigOverviewAction({ chain })` gom bốn khối trên. Kiểm quyền bằng `assertCan('ops:read')` (đọc **không** ghi sổ kiểm toán). Tính sẵn cờ `canEdit` để màn không gọi thêm action.
3. **Sửa `setIssuePrice`:**
   - Gửi `setPurchasePrice` rồi **chờ biên nhận** (`waitReceipt`, timeout theo chain).
   - CONFIRMED: ghi database và lịch sử như hiện nay; ghi mã giao dịch vào lý do lịch sử (dạng "lý do; tx 0x...") để khối lịch sử hiện được.
   - FAILED: không ghi database, sổ FAILURE, trả lỗi `LEDGER`.
   - PENDING (hết giờ chờ): không ghi database, sổ FAILURE "đã gửi, chưa có xác nhận", trả lỗi nói rõ: "Giao dịch đổi giá đã gửi nhưng chưa có xác nhận. Nếu chuỗi xác nhận sau, màn sẽ hiện cảnh báo lệch giá; khi đó đặt lại cùng giá để ghi nhận."
   - Nhánh hoàn nguyên khi ghi database lỗi: giữ, và cũng chờ biên nhận của giao dịch hoàn nguyên.
   - `reason` thành **bắt buộc** (5 tới 200 ký tự).
   - **Chặn đổi giá khi còn lệnh đang xử lý** trên chain đó (trạng thái PLACED, CHECKING, EXECUTING): trả `REQUEST_STATE` kèm số lệnh theo từng trạng thái, hướng dẫn xử lý ở `/transactions` trước. Kiểm trước khi gửi giao dịch.
4. **Một nguồn giá cho khách hàng (L-02):** thêm hàm `readEffectiveIssuePrice(chain)` (trả giá áp dụng cho lệnh: `quotePurchase(1n)` khi chain có OrderSettlement, ngược lại giá cấu hình). Bốn chỗ ở mục hiện trạng đổi sang hàm này. Riêng `/trade` dùng lại kết quả `quotePurchase` đã đọc, không đọc thêm. Màn khách hàng **không** hiện cảnh báo lệch (cảnh báo là việc của nhân viên).
5. **Tài liệu:**
   - `docs/USER_GUIDE.md`: Phần 1 mục 1.6 (dòng quyết định về giá), Phần 2 (thêm dòng `/config`, sửa trạng thái các màn khách hàng), Phần 3 (mục mới cho `/config`; sửa nguồn "Giá phát hành" ở `/portfolio`, `/trade`, `/seller`, `/tokens/[symbol]`), Phụ lục B (khoá giá), Phụ lục C (xoá L-02), bảng lịch sử.
   - `docs/tech-report.md`: thêm mục **"Fireblocks: quyết định cho PoC và mô hình tham chiếu"** theo nội dung ở `design.md` mục 5 (Supervisor soạn sẵn, coder chép nguyên văn).
   - `.kiro/task-status.json`: FE-07 vào `done`; **BE-18 vào `done`** (đã thực hiện qua DS-01 bản 5, SC-06, FE-08; không còn marker nào trỏ tới BE-18), ghi lý do trong tech-report.
   - Gỡ marker `@pending FE-07` ở `app/actions/config.ts` và `app/actions/bank.ts` (hai action đã có màn dùng; `issueInitialSupplyAction` vẫn là đường dữ liệu thử, sửa chú thích tương ứng).

## Ràng buộc

- **Hiệu năng:** `/config` đúng 1 server action khi mở. `/portfolio`, `/seller`, `/seller/withdraw`, `/tokens/[symbol]` giữ nguyên số action khi mở; mỗi màn thêm tối đa 1 lời đọc chuỗi, chạy song song trong `Promise.all` đang có (đi chung lô HTTP). Ghi số đo trước và sau vào checkpoint.
- Đọc không ghi sổ kiểm toán ở mọi chỗ mới thêm.
- Không đổi hợp đồng, lược đồ database, `ILedgerPort`. Được thêm hàm vào tầng nghiệp vụ và một khoá quyền đọc nếu cần (không thêm quyền ghi).
- Giữ test `issue-price-single-source` xanh (một nguồn giá mặc định trong mã).
- Giao diện theo các nguyên tắc ở `docs/20261023_UI_UX_UPGRADE_REQUIREMENT.md` mục 3.1 ở mức không cần đổi thành phần dùng chung: một nút chính, số căn phải dùng `tabular-nums`, không nhãn chữ hoa nhỏ, tiêu đề khối là `h2`. Không làm UX-01 tới UX-17 trong task này.
- Không thêm lập duyệt hai người cho việc đổi giá (giữ quyết định hiện có: Giao dịch viên đặt, Kiểm soát viên giám sát qua lịch sử và sổ kiểm toán).

## Tác động

- `lib/bank/config.service.ts`, `lib/bank/portfolio.service.ts`, `lib/bank/seller.service.ts`, `lib/bank/trade.service.ts`, `lib/store/config-values.ts` (hoặc nơi đặt `readEffectiveIssuePrice`)
- `app/actions/config.ts`, `app/actions/bank.ts` (chú thích marker)
- Mới: `app/(ops)/config/page.tsx`, `components/pages/price-config.tsx`
- `components/layout/nav-config.ts`
- Test: `test/config-service.test.ts`, `test/fe-07-price-config.test.ts` (mới), `e2e/fe-07-price-config.spec.ts` (mới), test hiện có của portfolio, seller, trade nếu kỳ vọng nguồn giá
- `docs/USER_GUIDE.md`, `docs/tech-report.md`, `docs/CHECKPOINT_FE07.md`, `.kiro/task-status.json`

## Điều kiện hoàn thành

- [ ] `config-service.test.ts` thêm các ca, mỗi ca xanh với mã mới, đỏ với mã cũ:
  - FE-07 ca 1: biên nhận PENDING khi đổi giá: database và lịch sử không đổi; sổ FAILURE; lỗi trả về không dùng chữ "thành công".
  - FE-07 ca 2: biên nhận FAILED: database không đổi.
  - FE-07 ca 3: CONFIRMED: database đổi, đúng một dòng lịch sử có mã giao dịch.
  - FE-07 ca 4: còn lệnh PLACED, CHECKING hoặc EXECUTING trên chain: bị chặn trước khi gửi giao dịch (`setPurchasePrice` không được gọi); lệnh ở chain khác không chặn.
  - FE-07 ca 5: thiếu lý do hoặc lý do dưới 5 ký tự: `VALIDATION`.
  - FE-07 ca 6: Kiểm soát viên gọi đổi giá: `DENIED`, sổ ghi lần bị chặn (giữ hành vi cũ).
- [ ] `fe-07-price-config.test.ts`:
  - ca 7: `getPriceConfigOverviewAction` trả đủ bốn khối, `canEdit` đúng theo vai, **không** thêm dòng `AuditLog` nào.
  - ca 8: chain có giá trên chuỗi khác database: `readEffectiveIssuePrice` trả giá trên chuỗi; `getPortfolio`, `getSellerOverview`, phần thông tin token của `/trade` trả cùng con số đó.
- [ ] Nút Hardhat: đổi giá thật qua `setIssuePrice`, đọc lại `OrderSettlement.price` bằng giá mới; đặt một lệnh mua sau đổi giá thành công với giá mới. Chạy lại `evm-order-settlement`, `evm-issuance`.
- [ ] E2E mock `fe-07-price-config.spec.ts`: Giao dịch viên đổi giá có hộp xác nhận; đổi vượt ngưỡng cần đánh dấu "đã kiểm"; Kiểm soát viên thấy màn nhưng không thấy khối "Đổi giá"; sau đổi giá, Nhà đầu tư mở `/trade` và `/portfolio` thấy giá mới.
- [ ] Đo số action khi mở: `/config` = 1; bốn màn khách hàng không đổi.
- [ ] Ít nhất 4 đột biến bị bắt: ghi database trước khi chờ biên nhận; bỏ kiểm lệnh đang xử lý; một màn khách hàng đọc lại giá database; action tổng quan dùng `authorize` thay `assertCan`.
- [ ] `issue-price-single-source` xanh. Mô phỏng job A xanh. Bản dựng và toàn bộ e2e mock xanh.

## Không làm

- Không làm màn cho các tham số khác ở Phụ lục B (lợi tức, tuổi thọ, phí, tham số chia): ghi vào nợ kỹ thuật "màn tham số hệ thống".
- Không đổi luật khoá vault (đã ở `/vault`).
- Không làm lập duyệt hai người cho đổi giá.
- Không làm các yêu cầu UX-01 tới UX-17.
