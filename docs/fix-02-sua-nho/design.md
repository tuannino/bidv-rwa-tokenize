# FIX-02: thiết kế

## 1. Cờ bán của Nhà đầu tư

```ts
// lib/config/env.ts
enableInvestorSell: boolFlag(false),            // lược đồ
enableInvestorSell: process.env.ENABLE_INVESTOR_SELL, // trong load()
// lib/bank/purchase.service.ts (xuất để trade.service dùng chung)
export const INVESTOR_SELL_DISABLED_MESSAGE = 'Nhà đầu tư không được bán token.';
export function investorSellBlocked(side: OrderSide): boolean {
  return side === 'SELL' && !serverEnv().enableInvestorSell;
}
```

- `previewTrade`, `previewPurchase`, `preparePermit`: gọi `investorSellBlocked` ngay sau `assertSessionWallet` (phân quyền và ví phiên đã kiểm), trước `getLedger`, trả `err('VALIDATION', INVESTOR_SELL_DISABLED_MESSAGE, { side: [INVESTOR_SELL_DISABLED_MESSAGE] })`.
- `placeOrder`: kiểm NGAY SAU `if (repeated) return repeatedOrderResult(...)` (dòng tìm lệnh cũ theo `clientRequestId`), trước `classifyPlacementPermit` và `runOrderChecks`, bằng `reject('VALIDATION', INVESTOR_SELL_DISABLED_MESSAGE)` để có dòng audit FAILURE. Các bước trước đó (khoá thu hồi, kiểm chữ ký trên chain thật) giữ nguyên thứ tự hiện có.
- `TradeContextView.sellEnabled = serverEnv().enableInvestorSell`.
- `vitest.config.ts`: `test: { ..., env: { ENABLE_INVESTOR_SELL: 'true' } }`. Ca tắt cờ đặt `process.env.ENABLE_INVESTOR_SELL = 'false'` + `resetServerEnvCache()`, `afterEach` trả về `'true'` + `resetServerEnvCache()`.
- `playwright.config.ts` `webServer.env`: thêm `ENABLE_INVESTOR_SELL: 'true'`.
- `wrangler.json` `vars`: `"ENABLE_INVESTOR_SELL": "false"`.

## 2. Yêu cầu Mint, Burn

- `evaluate(draft)` bỏ khối `noPending` và tham số `excludeRequestId`; sửa hai chỗ gọi.
- Nhánh Burn, nguồn `TOTAL_SUPPLY`: thêm
  `check('fullSupply', 'Số lượng bằng tổng cung', amount === BigInt(metrics.totalSupply), \`Số lượng ${formatAmount(amount)}; tổng cung hiện tại ${formatAmount(metrics.totalSupply)}.\`)` (dùng `metrics` đã đọc, không đọc thêm).
- Hàm thuần trong `token-request.service.ts`:

```ts
export function approveWarningOf(
  request: Pick<TokenRequestRecord, 'status' | 'type' | 'amount' | 'burnSource'>,
  token: Pick<TokenInfoView, 'remaining' | 'undistributed' | 'totalSupply'> | null,
): ApproveWarning | null
// null khi status khác PENDING; token null: TOKEN_UNREADABLE
// thứ tự: TOKEN_UNREADABLE, MINT_REMAINING, BURN_FULL_SUPPLY (TOTAL_SUPPLY và amount khác totalSupply), BURN_UNDISTRIBUTED
// MINT: BigInt(amount) > BigInt(token.remaining)  => 'Không đủ số lượng token còn được phép phát hành.'
// BURN: BigInt(amount) > BigInt(token.undistributed) => 'Không đủ số lượng token chưa phân phối còn lại.'
```

- `TokenRequestDetailView` thêm `approveWarning: ApproveWarning | null` (requirements B2), `getTokenRequestDetail` gán `approveWarningOf(request, token)`; `token` null với yêu cầu `PENDING` cho loại `TOKEN_UNREADABLE`.

## 3. Giao diện

- `gates.ts`: `approveBlockReason(detail)` trả `decisionBlockReason(detail) ?? detail.approveWarning?.message ?? null`; `burnAmountShown(type, source, typedAmount, totalSupply)`; tệp mới `components/trade/sides.ts` (hoặc tệp `.ts` sẵn có của màn giao dịch) có `tradeSides(sellEnabled)`.
- `approval-detail.tsx`: `approveBlock = working ? 'Đang xử lý…' : (detail ? approveBlockReason(detail) : 'Đang tải yêu cầu…')`. Khối cảnh báo: `approveWarning.message` và, khi có, dòng số liệu dựng từ `kind`, `requested`, `available` (định dạng `formatAmount`).
- `draft.tsx`: `amountShown = burnAmountShown(...)` như requirements C1 thay cho `amount` ở ô số lượng và `payload` (`payloadKey` dựng từ `payload` nên tự đổi theo); `chooseSource` đặt nguồn, `setConfirmed(false)`, bỏ `setAmount` từ tổng cung, và khi về `UNDISTRIBUTED` thì `setAmount('')`. `burnSourceEffect` vẫn trả `amount` như cũ (chỉ đổi câu khi null).
- `burnSourceEffect(source, totalSupply)`: `totalSupply === null` thì câu không in số.
- `investor-trade.tsx`: thay mảng `(['BUY', 'SELL'] as const)` bằng `tradeSides(ctx.sellEnabled)`; chỉ một chiều thì không dựng cụm nút, `side` luôn `BUY`.
