# FE-10: thiết kế

## 1. Thay đổi máy chủ (nhỏ)

```ts
// lib/bank/recall.service.ts
export function minNoticeDaysFor(chain: ChainKey, demo: boolean): 0 | 1;
export function isRecallLockStale(lock: { kind: string; acquiredAt: string }, chain: ChainKey, now: number): boolean;
//   kind === 'RECALL' && now - Date.parse(acquiredAt) > recallBudget(chain) + 120_000
export function freezeBlockers(input: {
  chain: ChainKey; round: SettlementRoundRecord; today: string;
  orders: InFlightCounts; activeDistribution: boolean; walletsTruncated: boolean;
  lock: { kind: string; acquiredAt: string } | null; settlementMode: boolean | null; now: number;
}): string[];
//   thứ tự: chưa tới recallFrom; lệnh đang xử lý > 0; kỳ chia hoạt động; danh sách ví bị cắt;
//   khoá chain (bỏ khoá RECALL quá hạn); settlementMode === null
// freezeToken: gom đầu vào như hiện nay, gọi freezeBlockers({ ..., lock: null }) và trả câu đầu tiên

interface RecallOverview {               // thêm
  chainLock: { kind: string; acquiredAt: string; stale: boolean } | null;   // thêm `stale`
  today: string;
  minNoticeDays: 0 | 1;
  canFreeze: boolean;
  freezeBlockers: string[];
}
// getRecallOverview: preview đọc listTokenWallets() khi !round || round.status === 'INITIATED' || round.status === 'CANCELLED'
```

```ts
// lib/bank/trade.service.ts
interface TradeContextView {
  ...;
  tradeBlock: { phase: RecallPhaseKind; settlementMode: boolean | null; maturityDate: string | null; recallFrom: string | null } | null;
}
// getTradeContext: block = tradingBlocked(recallPhase, settling)
//   bỏ `return err(...)`; tradeBlock = block.blocked ? {...} : null; token.tradingOpen = !block.blocked
```

## 2. Hàm thuần

```ts
// components/recall/gates.ts  (không 'use client', không import server-only)
export function currentStep(o: RecallOverview): 1 | 2 | 3 | 4 | null;
export type RecallControls = {
  open: boolean; openBlockedReason: string | null;          // dự án chưa phát hành, đã đóng
  reschedule: boolean; cancel: boolean;
  freeze: 'send' | 'recheck' | 'blocked' | 'hidden';
  unfreeze: 'send' | 'recheck' | 'locked-after-burn' | 'hidden';
  recall: { mode: 'hidden' | 'blocked' | 'first' | 'next'; askConfirm: boolean; blockedReason: string | null };
};
export function recallControls(o: RecallOverview): RecallControls;   // canManage false: mọi thứ hidden/false
export function symbolMatches(typed: string, symbol: string): boolean;            // typed.trim() === symbol
export const CASE_STATUS_LABELS: Record<string, string>;
export function chainLockMessage(lock: RecallOverview['chainLock']): string | null;   // null khi không khoá hoặc stale
export function tradingStatusLabel(phase: RecallPhaseKind, tradingOpen: boolean, page: 'trade' | 'seller'): string;
export function recallNoticeText(recall: NonNullable<PortfolioView['recall']>): { title: string; body: string };
export function tradeBlockText(block: NonNullable<TradeContextView['tradeBlock']>): string;

// lib/txn-labels.ts
export const OPERATION_LABELS: Record<string, string>;
export function operationLabel(code: string): string;

// lib/format.ts
export function formatVnDate(value: string): string;   // 'YYYY-MM-DD' thành 'dd/mm/yyyy'; chuỗi khác trả nguyên
```

- `recall.askConfirm = o.canUnfreeze` (cùng điều kiện máy chủ dùng: chưa có hồ sơ `BURNING`, chưa có hồ sơ `BURNED` mang mã).
- `tradingStatusLabel` và `tradeBlockText` đặt trong `components/recall/gates.ts` vì cả `/trade` và tổng quan Người bán cùng dùng; `recallNoticeText` cũng ở đây.
- Kiểu `RecallOverview`, `PortfolioView`, `TradeContextView` import kiểu (`import type`) từ tầng nghiệp vụ như `price-config.tsx` đang làm.

## 3. Màn `/recall`

- Tệp: `app/(ops)/recall/page.tsx` (máy chủ), `components/pages/recall.tsx` (máy khách, giữ trạng thái và gọi action), các phần con trong `components/recall/`: `steps.tsx`, `round-info.tsx`, `controls.tsx`, `dialogs.tsx`, `cases-table.tsx`.
- Bố cục: thanh bốn bước; dưới là hai cột trên màn rộng (trái: thông tin đợt và nút; phải: trạng thái token trên chuỗi, tổng cung ngoài vault, điều kiện đóng băng hoặc kết quả lô gần nhất); bảng hồ sơ hoặc danh sách dự kiến toàn bề ngang; một cột trên điện thoại.
- Mỗi lúc tối đa một nút chính. Đóng băng và thu hồi lần đầu dùng biến thể `destructive` của `Button`; nút khác `outline` hoặc `ghost`.
- Hộp thoại dùng `Dialog` có sẵn (như `price-config.tsx`). Nút xác nhận khoá trong lúc gửi; lỗi hiện trong hộp thoại.
- Số căn phải, `tabular-nums`, `formatAmount`. Ngày `formatVnDate`.

## 4. Nhà đầu tư và Người bán

- `AssetSummary`: khi `data.recall` khác `null`, khung cảnh báo ở đầu thẻ với `recallNoticeText`.
- `transaction-history-box.tsx`, `mint.tsx`: ô `operation` dùng `operationLabel`.
- `investor-trade.tsx`: đọc `context.data.tradeBlock`; khác `null` thì khối tạm dừng (`tradeBlockText`, đường dẫn `/portfolio`) và truyền `tradeBlocked: true` vào `confirmBlockReason`; thẻ token dùng `tradingStatusLabel(…, 'trade')`.
- `seller-overview.tsx`: `tradingStatusLabel(recallPhase, tradingOpen, 'seller')`.

## 5. E2E `e2e/recall.spec.ts`

- Chỉ dự án `mock` (không thêm vào `testMatch` của dự án `hardhat`). Tên tệp xếp sau `permit-order.spec.ts`, trước `token-info-read.spec.ts`.
- Phụ thuộc: dự án phải `ISSUED`, việc này do `maker-checker.spec.ts` hoặc `mint.spec.ts` chạy trước làm. Ghi chú phụ thuộc ở đầu tệp.
- `test.describe.configure({ mode: 'serial' })`.
- `beforeAll` (tạo context từ `browser`, `actAs` CONTROLLER): mở `/recall`; nếu không thấy nút "Mở đợt thu hồi" (dự án chưa phát hành, hoặc đợt cũ còn sót) thì `test.skip` với lý do in rõ.
- Ca 16 theo thứ tự: CONTROLLER mở đợt (ngày đọc từ thuộc tính `min` của ô ngày, số ngày 0, lý do); kiểm nút đóng băng đang bật, nếu khoá thì in `freezeBlockers` hiện trên màn rồi dừng; INVESTOR mở `/trade` thấy khối tạm dừng và nút gửi khoá; TELLER mở `/recall` không thấy nút ghi, đếm 1 action; CONTROLLER đóng băng (gõ ký hiệu), mở đóng băng (ký hiệu, lý do), huỷ đợt (lý do); INVESTOR mở `/trade` không còn khối tạm dừng.
- Đổi vai bằng cookie như `fe-07-price-config.spec.ts` (`actAs`).
- Đếm action: yêu cầu `POST` có header `next-action` từ `goto` tới khi màn hiện xong.
- `afterAll` chỉ qua giao diện: context mới, `actAs` CONTROLLER, mở `/recall`; thấy "Mở đóng băng trên toàn hệ thống" thì làm; thấy "Huỷ đợt" thì làm; cuối cùng kiểm thấy "Mở đợt thu hồi". Chú thích lý do: ledger mock dùng chung cho các tệp sau.

## 6. Tài liệu

- UserGuide: mục Thu hồi token theo vai (Kiểm soát viên, Giao dịch viên, Nhà đầu tư, Người bán), nhãn "Chế độ trình diễn", cảnh báo không đảo ngược sau lần đốt đầu tiên; đổi trạng thái FE-10 trong bảng chức năng.
- checkpoint `docs/CHECKPOINT_FE10.md`; `task-status.json`: FE-10 vào `done`.
