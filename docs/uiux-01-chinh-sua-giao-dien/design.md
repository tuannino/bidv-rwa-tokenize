# UIUX-01: thiết kế

## 1. Ô số lượng `AmountInput`

```tsx
// components/ui/amount-input.tsx  ('use client')
export function digitsOnly(text: string): string;          // bỏ mọi ký tự không phải 0-9, rồi bỏ số 0 đứng đầu (giữ một '0' nếu chỉ toàn 0)
export function AmountInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;                       // chuỗi chữ số thô, '' khi rỗng
  onValueChange: (raw: string) => void;
}): JSX.Element;
// hiển thị: value === '' ? '' : formatAmount(value); inputMode="numeric"
```

- `digitsOnly` đặt ở `lib/format.ts` để dùng cả máy chủ lẫn máy khách; `AmountInput` import nó.
- Không giữ vị trí con trỏ theo ký tự (PoC): gõ ở cuối là đủ; ghi chú trong mã.
- Dùng ở: `draft.tsx` (ô Số lượng), `mint.tsx` (ô Số lượng WPT), `vault-status.tsx` (ô Số khoá cố định), `seller-withdraw.tsx` (ô Số tiền rút) cho đồng nhất. Nhãn ô giữ nguyên để E2E `getByLabel` không đổi.

## 2. Nhãn vai dùng chung

```ts
// lib/role-labels.ts
export const ROLE_LABELS: Readonly<Record<Role, string>>;   // chuyển từ account-info.tsx
```

`account-info.tsx` và `request-table.tsx` import từ đây.

## 3. Mint, Burn

```ts
// lib/bank/token-request.service.ts
export interface ApprovalStatsView { pending: number; approvedToday: number; rejectedToday: number; history: TokenRequestRecord[] }
// getApprovalStats: thêm store.listRequests({ chain, decided: true, limit: 50 }) chạy song song với các countRequests

// lib/store/token-request.store.port.ts, listRequests(options): thêm `decided?: boolean`
//   decided true: chỉ dòng có decidedAt, xếp decidedAt giảm dần rồi id giảm dần
//   postgres: thêm điều kiện AND ($7::boolean IS NOT TRUE OR "decidedAt" IS NOT NULL) và
//     ORDER BY CASE WHEN $7 THEN "decidedAt" END DESC NULLS LAST, "createdAt" DESC, "id" DESC
//   (mặc định limit 50 giữ nguyên; không cần migration, bảng nhỏ)
//   memory: lọc và xếp tương ứng
```

```tsx
// components/maker-checker/request-table.tsx
export function resultText(row: TokenRequestRecord): string;   // xuất ra để test, đổi REJECTED, COMPLETED
export function RequestTable(props: { rows; caption; detailHref?; emptyText; variant?: 'queue' | 'history' });
// 'history' thêm cột Loại, Người duyệt, Thời điểm duyệt; bỏ Thời điểm lập, Lý do
// cột Chain sau Trạng thái ở cả hai biến thể
```

`approvals.tsx`: thẻ "Lịch sử phê duyệt" đọc `freshStats.data.history`, `variant="history"`, `detailHref` như hàng chờ. Đang tải hiện "Đang tải…"; lỗi dùng chung câu lỗi của thẻ số liệu.

## 4. Vault

```ts
// lib/bank/vault-config.ts
export type VaultConfigTarget =
  | { mode: 'PERCENT'; percentBps: bigint; payoutWallet: string }
  | { mode: 'FIXED'; fixedLock: bigint; payoutWallet: string };
export function planVaultConfig(current: VaultConfigCurrent, target: VaultConfigTarget): VaultConfigStep[];
//   bảng chuyển tiếp giữ nguyên (QĐ-C của BE-13); setPayoutWallet giữ như hiện nay, đứng đầu
export function configEffectiveAt(input: {
  lockMode: VaultLockMode;
  events: readonly { param: VaultConfigParam; blockNumber: bigint; logIndex: number; timestamp: number }[];   // thứ tự bất kỳ
}): { at: number | null; unknown: boolean };                              // quy tắc: requirements D4
```

```ts
// lib/bank/vault.service.ts
// saveVaultConfigSchema: { chain, mode: z.enum(['PERCENT','FIXED']), percent: z.string().max(20).optional().default(''),
//                          fixedLock: z.string().max(80).optional().default(''), payoutWallet: z.string().max(80) }
// kiểm C3 trước acquireOperationLock; kiểm ví nhận giữ nguyên

interface VaultConfigFormView {
  canConfigure: boolean;
  mode: 'PERCENT' | 'FIXED';               // lockMode hiện hành, UNSET thành PERCENT
  percent: string;
  fixedLock: string;                       // fixedLockAmount khi > 0, ngược lại ''
  payoutWallet: string;                    // giữ nguyên
  percentApplies: 'NOW' | 'NEXT_PERIOD';   // hiện: lastPeriodRef > 0 ? NEXT_PERIOD : NOW (SC-11 sẽ đổi thành luôn NOW)
  busy: ...;
}
interface VaultOverviewView {
  ...;
  configEffective: { at: number | null; unknown: boolean } | null;   // null khi có configEffectiveError
  configEffectiveError: string | null;     // lỗi đọc vaultConfigEvents; không che phần còn lại
}
// getVaultOverview: vaultConfigEvents() và vaultPeriodCloses(10) chạy song song, mỗi phép tự bắt lỗi
//   (Promise.allSettled hoặc bọc riêng): lỗi bên này không làm mất kết quả bên kia
```

`vault-status.tsx`:

- Biểu mẫu: nhóm `radio` có `aria-label="Chế độ khoá"`; ô theo chế độ (ô cố định dùng `AmountInput`); ô "Ví nhận tiền rút" giữ dưới nhóm; gửi `{ chain, mode, percent: mode === 'PERCENT' ? percent : '', fixedLock: mode === 'FIXED' ? fixedLock : '', payoutWallet }`. Câu hiệu lực C4 có `role="note"`.
- Khối trạng thái theo bảng D1, mỗi `Metric` giữ cấu trúc hiện có.

## 5. Tổng quan Người bán và màn Rút tiền

- `seller-overview.tsx`: đổi nhãn theo E1.
- `seller-withdraw.tsx`: ô "Số tiền rút (VNDB)" dùng `AmountInput`; còn lại giữ nguyên.

## 6. Màn tài khoản (chỉ giao diện, máy chủ không đổi)

```tsx
// components/pages/profile-wallet.tsx  ('use client')
export function ProfileWalletProvider({ children }): JSX.Element;   // gọi getProfileWalletAction một lần mỗi chain, giữ kết quả
export function PaymentWalletValue(): JSX.Element;                  // dùng trong Field "Ví thanh toán" ở account-info.tsx
export function ProfileWalletCard(): JSX.Element;                   // đọc cùng context, sau khi lưu cập nhật context
```

- `app/(account)/account/page.tsx`: khách hàng thì bọc `AccountInfoPage` và `ProfileWalletCard` trong `ProfileWalletProvider`. Vai nhân viên không bọc, không gọi action.
- `account-info.tsx`: Field nhãn "Ví thanh toán" cho cả hai loại khách hàng, nội dung `<PaymentWalletValue />` (hiện `linked ?? effective ?? "Chưa có ví thanh toán trên chain này"`). `AccountInfoPage` vẫn là thành phần máy chủ, chỉ chèn thành phần máy khách. `PaymentWalletValue` không có provider thì hiện "Đang đọc…" (để `test/account-info.test.ts` dựng được).
- Xoá `profile-wallet-card.tsx` sau khi chuyển sang `profile-wallet.tsx` (hoặc giữ tên tệp cũ, tuỳ người làm; ghi trong checkpoint).

## 7. Chữ và tài liệu

- Tệp chạm: `components/layout/nav-config.ts`, `components/pages/demo-payment.tsx`, `components/recall/round-info.tsx`, `lib/bank/recall.service.ts`, `docs/USER_GUIDE.md`.
- UserGuide, ngoài thay "trình diễn":
  - Màn Lập lệnh: ô số có dấu chấm.
  - Màn Phê duyệt lệnh: thẻ Lịch sử phê duyệt, cột Chain, câu từ chối.
  - Màn Vault: chọn một chế độ, bảng trường trạng thái mới, câu hiệu lực (ghi rõ tỷ lệ % sau kỳ đầu chờ tới lần chốt kỳ, sẽ đổi ở SC-11).
  - Màn Thông tin tài khoản: Ví thanh toán, Dùng địa chỉ ví mới.
