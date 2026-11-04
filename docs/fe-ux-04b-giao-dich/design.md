# FE-UX-04b: thiết kế

Nguồn hình ảnh: `docs/prototypes/20261101_ui_ux_ban_chot/trade.html`, `assets/c.css`. Thành phần: dùng nguyên API của FE-UX-02a đến 04a. Mốc lưới viết bằng `min-[1100px]:`, `min-[640px]:` như `dashboard.tsx:101`.

## 1. Bố cục (`/trade`, 1440 px)

| Khối | Bố cục |
|---|---|
| Đầu màn | `h1` "Giao dịch token" (`text-2xl font-semibold tracking-tight`) |
| Dòng mô phỏng | `Alert info role="note"` rộng hết, ví `font-code` |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; thẻ Đặt lệnh `col-span-7`; cột phải `col-span-5 space-y-6` gồm Tóm tắt lệnh, Thông tin token |
| Đặt lệnh | `Card`, `CardTitleIcon` `ShoppingCart`; nội dung `space-y-5`; Token rộng hết; tab chiều lệnh `grid w-full grid-cols-2 gap-1 rounded-full bg-muted p-1` ở mọi bề rộng (mỗi nút `rounded-full`); Số lượng và Giá `grid gap-4 min-[640px]:grid-cols-2`, nhãn trên ô, câu trần dưới ô Số lượng; ô Tổng giá trị dự kiến; khối kiểm tra; nút xác nhận `className="h-12 w-full"` (`Button` không có cỡ `h-12`, đặt bằng lớp) |
| Tóm tắt lệnh | `Card tone="hl"` (QĐ-6), `CardTitleIcon` `ReceiptText`; 6 dòng nhãn trái, số phải |
| Thông tin token | `Card`, `CardTitleIcon` `Wind`; 9 dòng; nhãn Trạng thái giao dịch là `Badge` |
| Lệnh vừa gửi | `Card` rộng hết dưới lưới; tiêu đề trái, "Xem chi tiết" phải; `SettlementProgress` giữ nguyên |
| Hộp đối chiếu | Giữ `Dialog` hiện có; `dl` 4 dòng dùng `Row` mới; `PermitNotice` theo QĐ-6; `dialogNote` theo QĐ-7 |
| Chưa kết nối ví | `EmptyState` giữa vùng nội dung |

390 px: một cột; tab chiều lệnh và các ô rộng hết; không cuộn ngang trang.

## 2. Ràng buộc chung

- Không màu cứng (tasks 6b). Thẻ `tone="hl"` dùng chữ phụ `text-muted-foreground`, nền ô `bg-muted` (utility `tile-hl` tự đổi); `--card`, `--border` ghi đè theo QĐ-6.
- Không thêm `role` mới. Đếm `role` trong `main` sau khi tải phải bằng mốc (e2e ca 1).
- Ảnh Sáng và Tối: kiểm khung tạm dừng, khối kiểm tra, ô vàng, thẻ xanh đọc được.

## 3. Kiểm thử mới

`app/test/fe-ux-04b.test.ts` (môi trường `node`, `renderToStaticMarkup`; dữ liệu giả đủ kiểu `OrderView`, `PermitPreparationView`, `InvestorTokenInfo`, `TradeContextView['balances']`, `TradePreviewState`):

1. **Mã nguồn:** số lời gọi QĐ-2 trong `investor-trade.tsx`; `trade-panels.tsx`, `trade-check-block.tsx` không có `Action(`, `useEffect(`, `useState(`; `investor-trade.tsx` không còn `const FIELD`, `amber-`. Dev xác nhận các số trên bản mốc, ghi trong checkpoint. Khoá thêm các biểu thức khoá ô và nút bằng `toContain` nguyên văn: `disabled={tradeBlocked || !ctx.walletBound}` (ô Số lượng; trạng thái ví chưa định danh không dựng được bằng e2e), `disabled={blockReason !== null}` (nút xác nhận), `disabled={submitting || blockReason !== null || walletBlocked || signPhase === 'preparing'}` (nút gửi). Nếu prettier tách biểu thức xuống dòng thì so sau khi gộp khoảng trắng (`source.replace(/\s+/g, ' ')`).
2. **`TradeCheckBlock`:** `idle` có "Nhập số lượng hợp lệ, hệ thống kiểm tra năm điều kiện."; `loading` có "Đang kiểm tra điều kiện…"; `error` có câu lỗi, không `role="alert"`; `error` có `notBound` thì có `data-wallet-not-bound`; `checked` 5 điều kiện (1 không đạt có `howToFix`): đúng 5 `li` theo thứ tự `key`, `data-passed` đúng, `aria-label="đạt"` 4 lần, `aria-label="không đạt"` 1 lần, chữ "Không đạt: {detail}" và `howToFix`.
3. **`TrackedOrder`** (`isSettled` đọc `settlement.outcome`, `gates.ts:198`, không đọc `status`: dữ liệu giả đặt `outcome` khớp): lệnh `REJECTED`, `settlement.outcome: 'NONE_APPLIED'`, có `reason`, chain `mock`, có `txHash`: `aria-label="Lệnh vừa gửi"`, tiêu đề chứa "Bị từ chối", liên kết `href="/orders/{id}"`, chữ "Mã giao dịch mô phỏng", chữ `reason`, không câu "Hệ thống đang tự quyết toán"; lệnh `EXECUTING`, `settlement.outcome: 'PENDING'`, không `reason`: có câu đang quyết toán, không có `data-slot="alert"`.
4. **`PermitNotice`** (walletStatus giả `canSign: true`, `status.kind: 'ready'`): `prepared: null, preparing: true` có "Đang chuẩn bị nội dung chữ ký ủy quyền…"; có `prepared` thì `data-testid="permit-notice"` chứa "{formatAmount(value)} {tokenSymbol}"; `canSign: false` thì có `blockedReason`, không `permit-notice`.
5. **`TokenInfoCard`:** `token: null` có "Chuỗi này chưa có dự án nào được token hoá."; có token, `tradingOpen: true`: 9 nhãn `dt` đúng thứ tự Dự án, Trần phát hành, Giá phát hành, Trạng thái token, Trạng thái giao dịch, Số chưa phân phối, Tuổi thọ còn lại, Lợi tức mục tiêu, Phí giao dịch; `aria-label="Thông tin token"`.
6. **`OrderSummary`:** `balances: null` có "Không có" đúng 2 lần, `aria-label="Tóm tắt lệnh"`, `data-tone="hl"`; `total: null` có "Chưa có"; 6 nhãn `dt` đúng thứ tự.
7. **`ConnectWalletPrompt`** (nhánh chưa kết nối ví: e2e mock luôn có ví hồ sơ, Hardhat `permit-order` có ví ký, nên không đi qua): có `data-slot="empty-state"`; chữ "Chưa kết nối ví"; câu "Kết nối ví ở góc trên phải, hoặc mở" và "để đặt lệnh mua hoặc bán token."; liên kết `href="/wallet"` với chữ "Ví của tôi".

`app/e2e/fe-ux-04b-giao-dich.spec.ts` (chỉ project mock, vai Nhà đầu tư; KHÔNG gửi lệnh, không đổi dữ liệu). Không giả định trần số lượng hay điều kiện đạt (phụ thuộc nguồn cung do tệp chạy trước tạo). Chờ tải xong: `networkidle`, rồi chờ `main` không còn chữ "Đang đọc số dư và thông tin token" (dùng được cả bản mốc).

| Ca | Kiểm |
|---|---|
| 1 | 1440 px: đúng một `h1`; trong `main` đúng một `[role="note"]`, và đó là `[data-slot="alert"][role="note"]` (`Alert` đặt `role` trên chính phần tử có `data-slot`), chứa "Không cần kết nối ví trình duyệt"; thẻ chứa chữ "Đặt lệnh" (exact) nằm bên trái `[aria-label="Tóm tắt lệnh"]` (x nhỏ hơn, lệch đỉnh dưới 24 px); `[aria-label="Tóm tắt lệnh"]` có `data-tone="hl"` và nằm trên `[aria-label="Thông tin token"]`; ô `Số lượng` và ô `Giá` cùng hàng (lệch đỉnh dưới 4 px); `[data-testid="quantity-cap"]` bắt đầu bằng "Tối đa"; đếm `[role="status"]`, `[role="note"]`, `[role="alert"]` trong `main` ngay sau khi tải, trước mọi tương tác, bằng hằng số mốc |
| 2 | 390 px: ô `Giá` nằm dưới ô `Số lượng`; `[aria-label="Tóm tắt lệnh"]` nằm dưới nút "Xác nhận lệnh mua"; nhập "0" vào `Số lượng` thì `[role="alert"]` trong `main` chứa "Số lượng phải là số nguyên lớn hơn 0." và nút "Xác nhận lệnh mua" `disabled` |
| 3 | 1440 và 390 px: `scrollWidth` không vượt bề rộng; không `console` loại `error`, không `pageerror`, không cảnh báo hydrate |
| 4 | Số action khi mở `/trade` (ngữ cảnh mới, cách đếm như `fix-04-noi-du-lieu-that.spec.ts:23-33` cộng chờ 1 giây sau `networkidle`): đúng 1 (`toBe`) |

Luồng đặt lệnh mua, bán, chữ ký, giao dịch tạm dừng do `ops-transactions.spec.ts`, `permit-order.spec.ts`, `recall.spec.ts` phủ.
