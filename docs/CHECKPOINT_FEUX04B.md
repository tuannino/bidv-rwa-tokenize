# Báo cáo bàn giao: FE-UX-04b màn Giao dịch token

| | |
|---|---|
| Mã task | FE-UX-04b |
| Phạm vi | **Frontend thuần.** Không `lib/`, `app/**`, `components/ui/**`, `components/investor/**`, `components/wallet/**`, `components/recall/**`, `components/token/**`, `components/trading/{gates,sides,settlement-progress,order-detail-content,order-status-tone}`; không gói npm mới; không đổi câu chữ, trường, thứ tự trường, nút, nhãn nút theo bước ký, điều kiện khoá, lời gọi server action, số action khi mở màn |
| Nhánh | `feat/fe-ux-04b-giao-dich`, tạo từ `release/ui-v2` @ `e914807` (sau merge PR #93 FE-UX-04a). **Merge-base dùng để đo mốc: `e914807`** (không dùng số của `ad133aa`) |
| Spec | `docs/fe-ux-04b-giao-dich/{requirements,design,tasks}.md` (chép nguyên) |
| Commit | spec `f028b6d`; e2e nháp `054aff5`; dời nguyên văn `1fa7afe`; unit nhóm 1, 2, 5 `4415a53`; đổi kiểu, unit nhóm 3, 4, 6, 7 `60cf007`; số `role` mốc `98ed215`; UserGuide, task-status `d6027c2`; biểu tượng `ShoppingBasket` `1f66a57`; tài liệu: các commit cuối trên nhánh |
| Tiến độ | Xong. Một PR, base `release/ui-v2`, chờ Supervisor nghiệm thu; Claude Code **không** merge |

Tệp mới: `app/src/components/trading/trade-panels.tsx` (`PermitNotice`, `Row`, `OrderSummary`, `TokenInfoCard`,
`TrackedOrder`, `ConnectWalletPrompt`, `TOKEN_STATUS_LABELS`).

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md` mục 4) | | Bằng chứng |
|---|---|---|---|
| 1 | Màn đúng bố cục bản chốt trừ "Không làm"; bảng đối chiếu từng dòng `notes/trade.md` | ✅ | mục 2.2, 7 |
| 2 | Bố cục, thứ tự đúng QĐ-3, QĐ-4; trong `main` đúng một `role="note"` | ✅ | mục 1.2 (ca 1), 2.2 |
| 3 | Sáu phần dời đúng QĐ-5 (chỉ thêm `export`), commit riêng; dán đoạn trước và sau | ✅ | mục 2.1 |
| 4 | Đổi kiểu đúng QĐ-6, QĐ-7; không còn `amber-*`, `text-destructive`, `FIELD` | ✅ | mục 2.2, 6 (6b) |
| 5 | Không đổi chữ, trường, nút, điều kiện khoá (6d) | ✅ | mục 6 |
| 6 | Diff giữ logic (QĐ-1, QĐ-2); liệt kê đoạn đổi gần hook, effect, handler, điều kiện khoá | ✅ | mục 2.3 |
| 7 | `/trade` mở đúng 1 action (ca 4), 28 đường dẫn không đổi; JS, CSS trong trần; `/trade` lỗi 0 | ✅ | mục 1.2, 4 |
| 8 | Mốc test QĐ-8 giữ; không sửa test có sẵn | ✅ | mục 1.1, 2.4 |
| 9 | Ảnh 1440, 390, Sáng, Tối, trước và sau, 4 bước, tiến trình mock mới mỗi lượt, đủ env | ✅ | mục 5 |
| 10 | Trạng thái không dựng được trên mock: unit test và ảnh dựng ngoài repo | ✅ | mục 1.3, 5 |
| 11 | `fe-ux-04b-giao-dich.spec.ts` đủ 4 ca, `fe-ux-04b.test.ts` đủ 7 nhóm, xanh | ✅ | mục 1.2, 1.3 |
| 12 | Kiểm thử mục 5 đạt, kèm log; "EVM - E2E PROJECT HARDHAT" xanh (có `permit-order`) | ✅ | mục 1.1 |
| 13 | Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng | ✅ | mục 6 |
| 14 | Không mã dư thừa | ✅ | mục 2.5 |

**Kết luận:** 14 ✅, 0 🔶, 0 ❌. JS gzip `/trade` +929 B so bản mốc build riêng (trần 3 KB); các trang đo khác lệch -91 đến +35 B, đã so chunk: cùng kích thước thô, chỉ khác thứ tự, mã số module (mục 4); CSS -265 B; action khớp 28/28 (`/trade` 1); `hydration`, `consoleErrors`, `pageErrors` 0 ở mọi đường dẫn cả mốc lẫn sau; số `role` trong `main` bằng mốc (`note` 1). Mức rủi ro: thấp (sáu phần dời khoá bằng unit test trước khi
đổi kiểu; state, effect, handler, điều kiện khoá không đổi, ba biểu thức khoá khoá nguyên văn bằng unit test).

UserGuide: "Chốt tại"; 3.1.2 thêm "Bố cục"; dòng mã L-04 theo tệp mới.

### 0.2 Việc cần Owner quyết

- Biểu tượng thẻ Đặt lệnh: em dùng `ShoppingBasket` thay `ShoppingCart` mà QĐ-7 nêu (mục 8). Sếp duyệt hoặc chọn
  giữ `ShoppingCart` và chấp nhận mọi trang thêm khoảng 46 B.

---

## 1. Kiểm thử (requirements mục 5, phần dev)

### 1.1 Lệnh và kết quả

`FE-UX-04b` ở `inProgress` của `.kiro/task-status.json` khi chạy. Chạy khi cổng e2e trống (máy chủ mới), trên HEAD
`1f66a57` cộng checkpoint chưa commit, Postgres bật.

```text
$ TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm
  => PASS có cảnh báo: luật kiến trúc          # PASS 20, FAIL 0, WARN 3 (như mốc)
  => PASS: LỚP 3 - ĐIỂM CẮM (marker)
ĐẠT     FE-UX-04b, docs/CHECKPOINT_FEUX04B.md
  => PASS: LỚP 3 - KHUÔN CHECKPOINT
  => PASS: APP - TYPECHECK
  => PASS: APP - LINT
      Tests  1573 passed | 74 skipped (1647)   # mốc 1551 + 22 ca mới của fe-ux-04b.test.ts
  => PASS: APP - VITEST
  => PASS: APP - BUILD BẢN PHÁT HÀNH
FE-UX-04b role counts /trade: {"status":0,"note":1,"alert":0}
      130 passed, 7 skipped (4.1m)            # project mock đầy đủ: 126 ca cũ + 4 ca mới
  => PASS: APP - E2E (PLAYWRIGHT)
  => PASS: EVM - BUILD BẢN HARDHAT
  => PASS: EVM - DỰNG CHUỖI MỚI
      26 passed, 2 skipped (44.5s)            # có permit-order.spec.ts (đặt lệnh có chữ ký trên /trade)
  => PASS: EVM - E2E PROJECT HARDHAT
  => ĐẠT các phần đã chạy: arch markers checkpoint app build e2e evm
EXIT=0
```

Log gửi kèm (không commit): `20261104_feux04b_run_local_all.log` (dòng khoá ký Hardhat #0 trong env máy chủ cục bộ đã
che) và riêng đoạn từ "EVM - E2E PROJECT HARDHAT" tới hết: `20261104_feux04b_evm_e2e.log`. Không chạy `contracts`.
Dòng `RpcRequestError` trong phần vitest là stderr của `hf-03-doc-log-evm.test.ts` ca 3 (cố ý giả RPC báo quá giới
hạn khoảng block; ca đạt), có ở các lượt trước.

### 1.2 e2e mới `app/e2e/fe-ux-04b-giao-dich.spec.ts` (project mock, vai Nhà đầu tư; không gửi lệnh)

Chờ tải như nhau ở mốc và sau: `networkidle`, rồi `main` không còn chữ "Đang đọc số dư và thông tin token".

| Ca | Kiểm | Mốc `e914807` | Sau |
|---|---|---|---|
| 1 | 1440 px: đếm `role` trước; một `h1`; trong `main` đúng một `[role="note"]` và đó là `[data-slot="alert"][role="note"]`, chứa "Không cần kết nối ví trình duyệt"; thẻ "Đặt lệnh" bên trái Tóm tắt lệnh, lệch đỉnh dưới 24 px; Tóm tắt lệnh `data-tone="hl"`, nằm trên Thông tin token; ô Số lượng và Giá lệch đỉnh dưới 4 px; câu trần bắt đầu "Tối đa"; `role` bằng hằng số | đỏ (dòng mô phỏng là `p`, chưa phải `Alert`) | xanh |
| 2 | 390 px: Giá dưới Số lượng; Tóm tắt lệnh dưới nút "Xác nhận lệnh mua"; nhập "0" thì `[role="alert"]` trong `main` chứa "Số lượng phải là số nguyên lớn hơn 0.", nút khoá | xanh | xanh |
| 3 | 1440 và 390 px, ngữ cảnh mới: `scrollWidth` không vượt bề rộng; 0 lỗi console, 0 `pageerror`, 0 cảnh báo hydrate | xanh | xanh |
| 4 | Số action khi mở `/trade` (POST có `next-action`, `networkidle` cộng 1 giây, ngữ cảnh mới): đúng 1 | xanh | xanh |

Hằng số `role` đo trên bản build mốc `e914807` bằng chính ca 1 trong lượt e2e mock đầy đủ trên máy chủ mới:
`{ status: 0, note: 1, alert: 0 }` (lượt đó 129 ca đạt, 1 ca đỏ đúng như cột Mốc). Lượt sau cho đúng số đó.

### 1.3 Unit test mới `app/test/fe-ux-04b.test.ts` (môi trường `node`, 22 ca)

Nhóm 1 (mã nguồn `investor-trade.tsx`): 1 `getTradeContextAction(`, 1 `previewTradeAction(`, 1 `listOrdersAction(`,
1 `placeOrderAction(`, 1 `preparePermitAction(`, 3 `useEffect(` (số mốc xác nhận trên `e914807` trước khi viết:
1, 1, 1, 1, 1, 3); `trade-panels.tsx`, `trade-check-block.tsx` không `Action(`, `useEffect(`, `useState(`; trang
không còn `const FIELD`, `amber-`; ba biểu thức khoá giữ nguyên văn sau khi gộp khoảng trắng:
`disabled={tradeBlocked || !ctx.walletBound}`, `disabled={blockReason !== null}`,
`disabled={submitting || blockReason !== null || walletBlocked || signPhase === 'preparing'}`.

Nhóm 2 (`TradeCheckBlock`): `idle`, `loading` đúng câu; `error` có câu lỗi, không `role="alert"`; `notBound` có
`data-wallet-not-bound`; `checked` 5 điều kiện (1 không đạt có `howToFix`): 5 `li` đúng thứ tự `key`, `data-passed`
đúng, `aria-label="đạt"` 4 lần, `aria-label="không đạt"` 1 lần, chữ "Không đạt: {detail}" và `howToFix`.

Nhóm 3 (`TrackedOrder`): `REJECTED`, `outcome: 'NONE_APPLIED'`, có `reason`, mock: `aria-label`, "Bị từ chối",
`href="/orders/{id}"`, "Mã giao dịch mô phỏng", `reason`, không câu đang quyết toán; `EXECUTING`, `PENDING`, không
`reason`: có câu đang quyết toán, không `data-slot="alert"`.

Nhóm 4 (`PermitNotice`, ví `ready`): đang chuẩn bị; đã chuẩn bị có `permit-notice` chứa
"{formatAmount(value)} {tokenSymbol}"; `canSign: false` có `blockedReason`, không `permit-notice`.

Nhóm 5 (`TokenInfoCard`): `token: null` đúng câu; có token: 9 nhãn `dt` đúng thứ tự, `aria-label`.

Nhóm 6 (`OrderSummary`): `balances: null` có "Không có" 2 lần, `aria-label`, `data-tone="hl"`; `total: null` có
"Chưa có"; 6 nhãn `dt` đúng thứ tự.

Nhóm 7 (`ConnectWalletPrompt`): `data-slot="empty-state"`, "Chưa kết nối ví", hai câu, liên kết `/wallet` "Ví của tôi".

Nhóm 1 (phần số lời gọi), 2, 5 viết và xanh ngay trên mã vừa dời (`4415a53`, trước khi đổi kiểu), vẫn xanh sau.

Tự gây lỗi 4 điểm Supervisor định thử, trên bản sao làm việc rồi hoàn lại:

| Lỗi gây ra | Kết quả |
|---|---|
| Bỏ riêng `\|\| !ctx.walletBound` khỏi `disabled` của ô Số lượng | nhóm 1 ca "biểu thức khoá" đỏ |
| Thêm `role="note"` vào câu `blockReason` (bản build riêng `.next-mut`, e2e trên máy chủ mới) | `fe-ux-04b-giao-dich` ca 1 đỏ (`[role="note"]` 2 thay vì 1); `investor-channel` "bấm mục Giao dịch token ở mock…" và `ops-transactions` "Mock không cần ví" đỏ (strict mode, `getByRole('note')` ra 2 phần tử) |
| `TradeCheckBlock` đổi `aria-label="không đạt"` thành "đạt" | nhóm 2 ca `checked` đỏ (5 lần "đạt", 0 "không đạt") |
| Thêm một lời gọi `getTradeContextAction(` vào trang | nhóm 1 ca `getTradeContextAction(` đỏ (2 thay vì 1) |

## 2. Thay đổi

### 2.1 Dời sáu phần sang `trade-panels.tsx` (QĐ-5)

Commit `1fa7afe` chỉ dời mã. `investor-trade.tsx:427-473` (`PermitNotice` kèm chú thích) và `:478-609` (`Row`,
`OrderSummary`, `TOKEN_STATUS_LABELS`, `TokenInfoCard`, `TrackedOrder`, `ConnectWalletPrompt`) @ `e914807` thành
`components/trading/trade-panels.tsx`; `FIELD` (`:475-476`), `SIGN_PHASE_LABELS`, `PREVIEW_DEBOUNCE_MS`,
`TRACK_INTERVAL_MS` ở lại trang. Phép thay duy nhất: `export` trước sáu hàm. Trang nhập lại sáu tên; bỏ import không
còn dùng (`Wallet`, `Wind`, `Badge`, `WrongChainBanner`, `InvestorTokenInfo`, `SettlementProgress`,
`ORDER_STATUS_LABELS`, `tradingStatusLabel`).

So sánh (bỏ dòng trống) đoạn trước và thân tệp mới bỏ `export `: `diff` rỗng, 174 dòng giống hệt. Đầu đoạn trước, @
`e914807`:

```tsx
/**
 * Câu xác nhận chữ ký trên chain thật (FE-05 QĐ-I): số và token sẽ ký, giờ hết hạn, không tốn phí.
 * Ví sai mạng thì hiện ngay dải cảnh báo dùng chung, nút ký bị khoá theo `canSign`.
 */
function PermitNotice({
```

Sau (`trade-panels.tsx` @ `1fa7afe`):

```tsx
/**
 * Câu xác nhận chữ ký trên chain thật (FE-05 QĐ-I): số và token sẽ ký, giờ hết hạn, không tốn phí.
 * Ví sai mạng thì hiện ngay dải cảnh báo dùng chung, nút ký bị khoá theo `canSign`.
 */
export function PermitNotice({
```

Chỗ nhập trong trang:

```tsx
import {
  ConnectWalletPrompt,
  OrderSummary,
  PermitNotice,
  Row,
  TokenInfoCard,
  TrackedOrder,
} from '@/components/trading/trade-panels';
```

Chỗ gọi trong trang không đổi ký tự nào (`<PermitNotice … />`, `<Row …>`, `<OrderSummary … />`, `<TokenInfoCard … />`,
`<TrackedOrder … />`, `return <ConnectWalletPrompt />`).

### 2.2 Màn (bố cục theo design mục 1)

| Khối | Đổi |
|---|---|
| Đầu màn | `h1` `text-2xl font-semibold tracking-tight`; không câu phụ |
| Dòng mô phỏng | `Alert tone="info" role="note"`, chữ giữ, ví `font-code break-all` (390 px không tràn) |
| Đang tải, lỗi | `EmptyState loading` "Đang đọc số dư và thông tin token…"; lỗi `Alert bad` không `role` |
| Lưới | `grid gap-6 min-[1100px]:grid-cols-12`; Đặt lệnh `col-span-7`; cột phải `col-span-5 space-y-6` (Tóm tắt lệnh, Thông tin token); Lệnh vừa gửi ngoài lưới, rộng hết |
| Đặt lệnh | `CardTitleIcon` `ShoppingBasket` (mục 8); `space-y-5`; thứ tự khối giữ; khung tạm dừng `Alert warn role="alert"` ba phần; tab chiều lệnh `grid w-full grid-cols-2 gap-1 rounded-full bg-muted p-1`, nút `rounded-full`, giữ `role`, `aria-selected`, `variant`, `disabled`; Số lượng và Giá `grid gap-4 min-[640px]:grid-cols-2`, ô `fieldClass` (Số lượng cộng `aria-invalid:border-destructive`), câu lỗi `text-bad-ink role="alert"`; Tổng giá trị dự kiến ô `tile-gold rounded-[18px] px-4 py-3` (thêm `relative isolate overflow-hidden` cho vân trang trí của `tile-gold`); nút xác nhận `h-12 w-full`; `submitError` `Alert bad` |
| Tóm tắt lệnh | `Card tone="hl"` cộng `[--card:var(--tile-hl-chip)] [--border:var(--tile-hl-chip)]`, `CardTitleIcon` `ReceiptText`; 6 dòng giữ; số Tổng giá trị dự kiến `text-(--tile-hl-bar)` |
| Thông tin token | Bỏ `bg-muted/30`, `CardTitleIcon` `Wind` (bỏ biểu tượng rời); 9 dòng giữ; Trạng thái giao dịch `Badge` `ok`/`warn` |
| `Row` | Dòng kẻ ngăn `py-2.5` (`border-b`, bỏ ở dòng cuối); `dt`, `dd` anh em trong một `div`; `valueClassName`; `mono` thành `tabular-nums font-semibold` |
| Lệnh vừa gửi | Tiêu đề trái, "Xem chi tiết" phải (bọc `div` flex); `reason` `Alert bad`; `SettlementProgress` giữ |
| Hộp đối chiếu | `Dialog` giữ; `dl` 4 `Row` mới; `PermitNotice` khung `rounded-[14px] bg-muted p-3`, `blockedReason` `Alert bad`; `dialogNote` `Alert bad role="alert" data-testid="sign-note"` |
| Khối kiểm tra | `section` giữ `aria-label`; `h3` thêm `ShieldCheck` `aria-hidden`; mỗi `li` ô `rounded-[14px] bg-muted/60 px-3 py-2.5`; `XCircle`, câu không đạt `text-bad-ink`; lỗi xem trước `Alert bad` không `role` |
| Chưa kết nối ví | `EmptyState` biểu tượng `Wallet`, `py-16`, hai câu, liên kết giữ |

### 2.3 Đoạn đổi gần hook, effect, handler, điều kiện khoá (QĐ-1, QĐ-2)

Không đổi mọi `useState`, `useRef`, ba effect, `contextKey`, `previewKey`, `intent`, `freshPrepared`,
`preparePermit`, `openConfirm`, `submit`, `walletBlocked`, `return <ConnectWalletPrompt />`. Các đoạn có đụng:

- Tab chiều lệnh: `tradeSides(ctx.sellEnabled).length > 1 &&`, `role="tab"`, `aria-selected={side === value}`,
  `variant`, `disabled={tradeBlocked}`, `onClick={() => setSide(value)}` giữ từng ký tự; chỉ thêm `className`.
- Ô Số lượng: `aria-label`, `inputMode`, `value`, `aria-invalid`, `disabled={tradeBlocked || !ctx.walletBound}`,
  `onChange` giữ; `className` đổi `FIELD` thành `fieldClass` cộng `aria-invalid:border-destructive`; bọc thêm lưới
  hai cột với ô Giá. Ô Giá giữ `aria-label`, `value`, `readOnly`.
- Nút xác nhận: `disabled={blockReason !== null}`, `onClick={openConfirm}`, chữ giữ; lớp `h-12 w-full`.
- Nút Quay lại, nút gửi trong hộp: không đổi (biểu thức `disabled`, nhãn theo `signPhase`, `needsPermit`,
  `submitting`).
- `submitError`, `dialogNote`, `freshContext.error`: điều kiện hiện giữ, chỉ đổi phần tử hiển thị.
- `TokenScopeSelect`: không đổi (`disabled={tradeBlocked}`).

### 2.4 Mốc test QĐ-8

Không sửa tệp test có sẵn. Đã chạy riêng trên bản sau (máy chủ mới): `fe-ux-04b-giao-dich`, `investor-channel`,
`ops-transactions`, `recall`, `fe-07-price-config`, `uiux-02-dau-man` (41 ca đạt); unit `uiux-02-dau-man.test.ts`,
`four-roles-shell.test.ts`, `fe-ux-04b.test.ts`. Cả bộ trong 1.1, gồm `permit-order.spec.ts` trên Hardhat.

### 2.5 Mã dư thừa

Đã xoá: `FIELD`, `Loader2` trong trang (khối đang tải thành `EmptyState`), biểu tượng `Wind` rời ở Thông tin token,
lớp `amber-*`, `text-destructive`, `bg-muted/30`, `size="sm"` hai thẻ cột phải. Import không còn dùng bỏ ở commit
dời. Lint đạt.

## 4. Đo trước và sau

Cùng máy, cùng quy trình (script ngoài repo): máy chủ mới cổng 3300, tạo dữ liệu bằng `maker-checker`,
`ops-transactions`, `permit-order`, `recall`; đo bằng `tools/20261104_do_moc_measure.js` (sha256 `6079a0d6…` khớp
spec) với `JS_PAGES=/,/portfolio,/trade,/approvals`. Tiến trình đo khác tiến trình chụp ảnh. JS theo byte: script
riêng cộng gzip mọi script khi mở trang (cùng cách cộng của công cụ), máy chủ mới cổng 3500 sau `ops-transactions`
(để có `/orders/[id]`), mỗi trang đo hai lần, hai lần bằng nhau.

| Mục | Mốc `e914807` | Sau `1f66a57` | Trần |
|---|---|---|---|
| Số action khi mở màn | 28 đường dẫn; `/trade` 1 | Khớp 28/28 | không đổi |
| `hydration`, `consoleErrors`, `pageErrors` (cộng 4 biến thể) | 0 ở cả 28 đường dẫn | 0 ở cả 28 đường dẫn | `/trade` 0, khác không tăng |
| JS gzip `/trade` (công cụ) | 479,1 KB | 480,0 KB | |
| JS gzip `/`, `/portfolio`, `/approvals` (công cụ) | 558,2; 456,9; 455,2 KB | bằng nhau | không tăng |
| CSS gzip (`.next/static/chunks/*.css`, 1 tệp, gzip mức 9) | 19.625 B | 19.360 B (-265 B) | +2 KB |
| `role` trong `main` (ca 1) | status 0, note 1, alert 0 | giống hệt | bằng mốc |

JS gzip theo byte. Bản mốc của lượt e2e đầy đủ build đúng mã `e914807` (nhánh lúc đó chỉ thêm spec và e2e); bản mốc
build riêng build lại `e914807` sau bản cuối, cùng phiên (`NEXT_DIST_DIR=.next-moc`, đã xoá):

| Trang | Mốc (lượt e2e) | Mốc build riêng | Sau `1f66a57` | Chênh so build riêng | Trần |
|---|---|---|---|---|---|
| `/trade` | 490.643 | 490.639 | 491.568 | +929 | +3.072 |
| `/portfolio` | 467.817 | 467.811 | 467.846 | +35 | không tăng |
| `/tokens/WPT` | 463.073 | 463.069 | 463.073 | +4 | không tăng |
| `/orders` | 548.654 | 548.652 | 548.654 | +2 | không tăng |
| `/orders/[id]` | 463.133 | 463.128 | 463.133 | +5 | không tăng |
| `/withdraw` | 484.033 | 484.023 | 484.033 | +10 | không tăng |
| `/` | 571.628 | 571.624 | 571.628 | +4 | không tăng |
| `/approvals` | 466.109 | 466.105 | 466.105 | 0 | không tăng |
| `/distribution` | 479.585 | 479.578 | 479.584 | +6 | không tăng |
| `/vault` | 469.634 | 469.633 | 469.542 | -91 | không tăng |

Các trang ngoài `/trade` lệch -91 đến +35 B, cả âm lẫn dương; hai bản mốc lệch nhau 0 đến 10 B. Đã lưu và so từng
chunk của `/portfolio`, `/vault`, `/withdraw` (ba trang lệch nhiều nhất ngoài `/trade`) giữa bản mốc build riêng và
bản sau `1f66a57` (`chunk_diff.txt` gửi kèm): mọi chunk khác tên có cùng kích thước thô (chunk chung 178.700 B và
178.700 B; `/portfolio` 36.898 B và 36.898 B; `/vault` 43.653 B và 43.653 B; `/withdraw` 67.978 B và 67.978 B), khác
ở mã số module, thứ tự module, mã tham chiếu server action; không thêm mã. Lệch gzip là nhiễu nén; công cụ đo báo các
trang này bằng nhau. Ở lượt so bản sau đầu tiên (`98ed215`), chunk riêng của `/trade` tăng từ 86.996 B lên 89.064 B
thô (thành phần dùng chung `Alert`, `EmptyState`, `CardTitleIcon`, biểu tượng mới).

Bản sau đầu tiên (`98ed215`, biểu tượng `ShoppingCart`) làm MỌI trang tăng khoảng 46 B: so chunk chung thấy module
`shopping-cart` bị tách khỏi chunk khung để dùng chung với trang `/trade` (chunk chung 178.700 B thành 178.799 B). Đã
đổi sang `ShoppingBasket` (mục 8), đo và chụp lại toàn bộ trên `1f66a57`.

CSS mốc lấy từ bản build mốc sạch (19.625 B). CSS giảm vì các lớp `amber-*` chỉ màn này dùng đã bỏ.

## 5. Ảnh (gửi kèm, không commit)

- `/trade` 4 bước, vai Nhà đầu tư, 1440 và 390, Sáng và Tối, trước (`moc/anh/`) và sau (`sau/anh/`): (a) vừa mở;
  (b) nhập "1", chờ đủ 5 `li[data-check]`; (c) bấm "Xác nhận lệnh mua", chụp hộp đối chiếu; (d) bấm "Gửi lệnh", chờ
  "Hoàn tất" trong thẻ Lệnh vừa gửi, chụp. Mỗi lượt một tiến trình mock MỚI cổng 3400: `npx next start --port 3400`
  với đủ biến môi trường của `webServer.env` (`NEXT_PUBLIC_DEFAULT_CHAIN`, `USE_MOCK_KYC`, `USE_MOCK_DB`,
  `DEMO_ROLE`, `ENABLE_DEMO_TOKEN_MINT`, `ENABLE_DEMO_PAYMENT_MINT`, `ENABLE_INVESTOR_SELL`, khoá ký mẫu Hardhat,
  `RPC_HARDHAT`); `E2E_BASE_URL=http://localhost:3400 npx playwright test e2e/ops-transactions.spec.ts` (2 ca đạt);
  chụp; tắt. Mốc (bản build `e914807`): bật 17:35:04Z, tắt 17:35:56Z. Sau (bản build `1f66a57`): bật 18:01:17Z, tắt
  18:02:09Z (04/11/2026, UTC). Hai lượt cùng kết quả bốn bước; `scrollWidth` không vượt bề rộng, 0 lỗi console.
  Mỗi tổ hợp gửi một lệnh mua 1 token (đúng công thức), nên số dư trong ảnh giảm dần theo thứ tự chụp.
- 28 đường dẫn của script đo, trước (`moc/do/`) và sau (`sau/do/`), 1440 và 390, Sáng và Tối.
- Trạng thái không dựng được trên mock (10 trạng thái): khối kiểm tra có "Không đạt", lỗi xem trước, ví chưa định
  danh; khung giao dịch tạm dừng; lệnh bị từ chối có lý do; `PermitNotice` đang chuẩn bị, đã chuẩn bị, không ký được;
  Thông tin token khi chưa có dự án; Tóm tắt lệnh khi `balances` rỗng (trong vỏ thẻ của nó). HTML dựng bằng
  `renderToStaticMarkup` với dữ liệu giả (test tạm, xoá ngay, không commit), CSS bản build tương ứng,
  `page.setContent`, font hệ thống, Sáng và Tối, 1440 (khung 760 px) và 390 (`anh_tinh_moc/`, `anh_tinh_sau/`).
  Trước dùng mã @ `1fa7afe` (đã dời, chưa đổi kiểu) và CSS bản mốc; sau dùng mã cuối và CSS bản sau. Khung giao dịch
  tạm dừng là khối trong trang: dựng đúng ba phần tử như trang (trước: `div` lớp `amber-*` như mã mốc; sau: `Alert
  warn role="alert"`), không chạy `recall.spec.ts`. Khối kiểm tra, `PermitNotice` đặt trong vỏ `Card`.

## 6. Lệnh kiểm (tasks bước 6, `LC_ALL=C`)

```text
6a $ git diff --name-only --diff-filter=d ... | grep -vE '^(...danh sách trắng...)$'      # rỗng
   $ git diff --name-only --diff-filter=D origin/release/ui-v2...HEAD                     # rỗng
6b $ rg -n '...màu cứng...|text-destructive' <ba tệp>                                     # rỗng
6c $ comm -13 /tmp/del.txt /tmp/add.txt | rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' # rỗng
6d $ comm -23 <(ext /tmp/del.txt) <(ext /tmp/add.txt)                                   # rỗng
6e $ rg -n '[\x{00B7}\x{2014}\x{2192}\x{00D7}]|-\x3e' <năm tệp> | rg -v '<dòng chú thích>'   # rỗng
```

Chạy trên HEAD `1f66a57`, `LC_ALL=C`. 6d rỗng: không chuỗi tiếng Việt nào mất hoặc đổi. `docs/tech-report.md` không
đổi (marker không nằm trong tệp đã sửa); bảng tệp viết tay của tệp đó chưa có `trade-panels.tsx` là nợ tài liệu
(requirements mục 3 không cho sửa tay), mục 8.

## 7. Đối chiếu notes (`notes/trade.md`)

Cột "Kết quả": **Làm** (đúng bản chốt), **Giữ** (màn thật đã như vậy hoặc chỉ giữ chữ), **Không làm** (kèm lý do).

| Dòng notes (Ánh xạ) | Kết quả |
|---|---|
| Tiêu đề, câu mô tả | Làm tiêu đề; không câu mô tả (requirements mục 1, test cấm câu phụ) |
| Dòng chế độ mô phỏng thành alert | Làm: `Alert info` giữ `role="note"` (một `note` trên trang) |
| Thẻ "Đặt lệnh" | Làm: `CardTitleIcon` (`ShoppingBasket`, mục 8), lưới 7/12 |
| Dropdown Token (khoá) | Giữ `TokenScopeSelect` của UIUX-02 (notes đã cũ ở ô này), rộng hết thẻ |
| Nút Mua / Bán (chỉ khi bật bán) | Làm: cụm bo tròn `bg-muted p-1`, hai nút chia đều; giữ `role`, điều kiện hiện, khoá |
| Ô Số lượng (không hậu tố) | Giữ ô thường, không hậu tố "WPT", không `AmountInput` (requirements mục 1); lớp `fieldClass` |
| Câu trần dưới ô | Giữ `data-testid="quantity-cap"` |
| Lỗi số lượng (đỏ) | Giữ `role="alert"`, màu `text-bad-ink` |
| Ô Giá chỉ để xem | Giữ `readOnly`; cùng hàng Số lượng từ 640 px |
| Ô vàng Tổng giá trị dự kiến | Làm: `tile-gold rounded-[18px]`, giữ "Chưa có" |
| Khối Kiểm tra trước lệnh | Làm: tiêu đề có `ShieldCheck`, mỗi điều kiện một ô; giữ chữ, `data-*`, `aria-label` |
| Nút xác nhận, câu khoá dưới nút | Giữ chữ, điều kiện; nút `h-12 w-full`; `submitError` thành `Alert bad` |
| Thẻ xanh Tóm tắt lệnh | Làm: `Card tone="hl"`, `ReceiptText`, 6 dòng giữ, số tổng màu vàng nhạt |
| Thẻ Thông tin token | Làm: `Wind` trong tiêu đề, 9 dòng giữ, nhãn trạng thái `Badge ok/warn` |
| Hộp đối chiếu có nút X đóng | Giữ `Dialog` hiện có, không thêm nút X riêng (requirements mục 1); 4 dòng `Row` mới |
| Câu chữ ký, nhãn bước ký trên nút (chain thật) | Giữ chữ, nhãn theo `signPhase`; khung `rounded-[14px] bg-muted` |
| Thẻ Lệnh vừa gửi | Làm: tiêu đề trái, "Xem chi tiết" phải; `reason` `Alert bad`; `SettlementProgress` giữ (FE-UX-02a) |
| Bước chưa có mốc hiện "–" | Không làm ở task này: thuộc `SettlementProgress`, tệp cấm sửa |
| Trạng thái Chưa kết nối ví | Làm: `EmptyState` `Wallet` |
| Thanh Trạng thái xem thử | Không làm: không phải khối màn thật; trạng thái kiểm bằng unit test và ảnh dựng tĩnh |
| Thông báo Ví chưa được định danh | Giữ `WalletNotBoundNotice` (vỏ đã đổi ở FE-UX-04a) |
| Khung vàng Giao dịch tạm dừng | Làm: `Alert warn role="alert"`, ba phần giữ |
| Nhãn Trạng thái giao dịch | Giữ chữ `tradingStatusLabel`; sắc `ok`/`warn` |
| Đang đọc số dư; câu lỗi đỏ | Làm: `EmptyState loading`; `Alert bad` |
| Kiểu cục bộ `.total`, `.entries`, `.modal`, `dt` trong hero `rgba` | Làm `.total` bằng `tile-gold`; `.entries`, hộp thoại giữ của thành phần dùng chung; chữ phụ trong hero dùng `text-muted-foreground` của `tile-hl` thay `rgba` |
| Thay đổi trình bày: bố cục 7/5; Số lượng và Giá cùng hàng; ô tổng vàng; danh sách điều kiện có biểu tượng | Làm |
| Token cùng hàng cụm Mua / Bán khi bật bán | Không làm: design mục 1 đặt Token rộng hết, tab chiều lệnh hàng riêng |
| Mục "Lệch đã thấy" (3 dòng) | Không làm: logic hoặc chữ (requirements mục 1) |
| "Trạng thái giữ theo dev, chưa vẽ" (sai mạng, câu huỷ ký, `submitError`) | Giữ hành vi; câu huỷ ký thành `Alert bad role="alert"`, `submitError` thành `Alert bad` |

## 8. Nợ và DEVIATION

- **Biểu tượng thẻ Đặt lệnh (lệch QĐ-7).** QĐ-7 ghi `ShoppingCart`. Biểu tượng này đã có trong menu khung chung
  (`components/layout/sidebar.tsx`); dùng thêm ở trang `/trade` thì bundler tách nó khỏi chunk khung thành module
  dùng chung, mọi trang thêm khoảng 46 B gzip, trái QĐ-9 "các trang đo khác không tăng". Em đổi sang `ShoppingBasket`
  (cùng nghĩa giỏ mua, không có trong khung), giống cách FE-UX-03c đổi `KeyRound` sang `LockKeyhole`. Nếu Sếp muốn
  giữ đúng `ShoppingCart`, đổi lại một dòng import và một dòng JSX; giá là khoảng 46 B mỗi trang.
- **`Card size="sm"` ở Tóm tắt lệnh, Thông tin token** bỏ để hai thẻ cột phải cùng khoảng đệm với thẻ Đặt lệnh như
  bản chốt.
- **Nợ tài liệu:** bảng tệp viết tay ở `docs/tech-report.md` chưa liệt kê `components/trading/trade-panels.tsx`
  (requirements mục 3 không cho sửa tay).
- **Chưa làm theo requirements mục 1 "Không làm":** câu phụ dưới tiêu đề; hậu tố "WPT" và `AmountInput` ở ô Số lượng;
  nút X riêng cho hộp đối chiếu; đổi `SettlementProgress`; biểu tượng trang trí trên nút; hiệu ứng (FE-UX-08); sửa lệch
  trong notes (nhãn "Đã phát hành", số dư VNDB).
- **Lượt bộ kiểm thử đầu tiên** em dừng giữa chừng vì Postgres chưa bật (cần cho `TEST_DATABASE_URL`); bật lại rồi
  chạy lại từ đầu, log nộp là lượt sau.

## 9. Tự đánh giá 3 luật kiến trúc

- [x] Mọi call chain qua ILedgerPort: không đổi mã gọi chuỗi.
- [x] Mọi ký qua ISigner: không đổi (ký permit vẫn qua `signPermitWithWallet` ở trang).
- [x] Mọi kiểm quyền qua RBAC: không đổi.
