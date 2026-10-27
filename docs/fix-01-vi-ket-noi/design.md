# FIX-01: thiết kế

## 1. Lược đồ và cổng lưu trữ

```prisma
/// FIX-01: ví đã được ngân hàng định danh và gắn cho hồ sơ. Một hồ sơ nhiều ví mỗi chain, một ví một hồ sơ mỗi chain.
model WalletBinding {
  chain     String
  /// Địa chỉ viết thường, khoá duy nhất theo chain.
  walletKey String
  /// Địa chỉ đã chuẩn hoá checksum.
  wallet    String
  actorId   String
  boundBy   String
  boundAt   DateTime @default(now()) @db.Timestamptz(3)

  @@id([chain, walletKey])
  @@index([chain, actorId])
  @@index([chain, boundAt])
}
```

- Sinh lại `prisma/init.sql` và `src/lib/store/init-sql.generated.ts` bằng lệnh có sẵn (`npm run db:sql`).
- Không thêm câu chép dữ liệu (QĐ-1, QĐ-7). `store.errors.ts`: gỡ dòng `ProfileWallet_chain_walletKey_key`; KHÔNG thêm dòng cho `WalletBinding` (khoá chính không có `CREATE UNIQUE INDEX` riêng nên `test/store-constraints.test.ts` sẽ đỏ, và `bind` dùng `ON CONFLICT DO NOTHING` rồi `SELECT` nên không gặp lỗi trùng của Postgres).

```ts
// lib/store/wallet-binding.store.port.ts
export interface WalletBindingRecord { chain: ChainKey; wallet: string; actorId: string; boundBy: string; boundAt: string }
export interface IWalletBindingStore {
  readonly kind: StoreKind;
  findByWallet(chain: ChainKey, wallet: string): Promise<WalletBindingRecord | null>;   // so không phân biệt hoa thường
  list(chain: ChainKey, limit: number): Promise<WalletBindingRecord[]>;                  // boundAt giảm dần
  /** Thêm; ví đã thuộc hồ sơ khác thì ném UniqueConstraintError; đã thuộc đúng hồ sơ thì trả bản ghi cũ, `created: false`. */
  bind(input: { chain: ChainKey; wallet: string; actorId: string; boundBy: string }): Promise<{ record: WalletBindingRecord; created: boolean }>;
}
// memory + postgres; postgres.bind dùng INSERT ... ON CONFLICT ("chain","walletKey") DO NOTHING RETURNING,
//   không trả dòng thì SELECT dòng đang có: cùng actorId là created:false, khác actorId thì ném UniqueConstraintError
// lib/store/index.ts: getWalletBindingStore(); gỡ getProfileWalletStore và hai bản cài ProfileWallet
```

## 2. Chủ sở hữu ví và chốt chặn

```ts
// lib/bank/wallet-owner.ts  (server-only)
export async function resolveWalletOwner(chain: ChainKey, wallet: string): Promise<CustomerAccountProfile | null>;
//   binding = getWalletBindingStore().findByWallet(chain, wallet), có thì là hồ sơ có actorId đó
//   không có và chain thuộc ['mock','hardhat-local']: hồ sơ khách hàng có `wallet` (ví mẫu) trùng địa chỉ
//   còn lại null
export class WalletNotBoundError extends Error {}         // message 'Ví chưa được định danh'
export async function assertOwnWallet(input: {
  role: Role; actorId: string; chain: ChainKey; wallet: string;
  audit?: { action: Action };                               // có thì ghi DENIED trước khi ném
}): Promise<void>;
//   role không phải INVESTOR hoặc SELLER: return
//   owner?.actorId !== actorId: (audit) rồi throw new WalletNotBoundError()
export function isPublicSampleWallet(wallet: string): boolean;   // so với PUBLIC_SAMPLE_WALLETS của @bidv/shared, không lập danh sách mới
export const SAMPLE_WALLET_CHAINS: readonly ChainKey[];          // chuyển từ account-profile.service
```

- `result.ts`: thêm `'WALLET_NOT_BOUND'` vào `ErrorCode`, `httpStatusFor.WALLET_NOT_BOUND = 403`. `toResult` (ở `lib/bank/authorize.ts`) nhận `WalletNotBoundError`.
- `account-profile.service.ts` xuất thêm `findCustomerProfile(actorId)` và `listCustomerProfiles()` (đọc `SAMPLE_ACCOUNT_PROFILES` đang để riêng) cho `resolveWalletOwner`, A1 bước 2, `listWalletBindings.profiles`.
- Thứ tự trong mỗi hàm bị chặn: kiểm quyền, `await assertOwnWallet(...)`, rồi mới các phép đọc khác (không đưa vào `Promise.all`).
- Gọi ở: `portfolio.service.ts` (`getPortfolio`, `getWalletTransactions`, có audit), `purchase.service.ts` (`listOrders` khi `!seesEveryOrder`, `placeOrder` có audit; `previewPurchase`, `preparePermit` không audit), `mint.service.ts` (`listTransactions`, `readBalance` với vai khách hàng, có audit), `trade.service.ts` (`getTradeContext` dùng `resolveWalletOwner` trực tiếp để trả `walletBound`, không ném).
- `trade.service.ts` `previewTrade`: thay `findInvestorProfileByWallet` bằng `resolveWalletOwner`, so `actorId` (requirements D3).
- `account-profile.service.ts`: gỡ `walletOfProfile`, `findInvestorProfileByWallet`, `getProfileWallet`, `linkProfileWallet`, `ProfileWalletView`; `ownMockWallet` trả `profile.wallet` của hồ sơ khách hàng phiên; thêm `getAccountWallet({ chain, wallet? })` (mục 6). `schemas.ts`: gỡ `linkProfileWalletSchema`, `profileWalletSchema` nếu không còn dùng.

## 3. Gắn ví

```ts
// lib/bank/wallet-binding.service.ts
export interface WalletBindingView {
  wallet: string; actorId: string; profileName: string; role: Role;
  boundBy: string; boundAt: string;     // chỉ dữ liệu DB, không đọc chuỗi theo từng dòng (A2)
}
export async function bindProfileWallet(input: unknown): Promise<Result<{ binding: WalletBindingView; txHash: string | null; created: boolean }>>;
export async function listWalletBindings(input: unknown): Promise<Result<{ rows: WalletBindingView[]; truncated: boolean; profiles: Array<{ actorId: string; fullName: string; role: Role }> }>>;
// schema: { chain, actorId: z.string().max(40), wallet: z.string().max(80) }
// quyền gắn: authorize('investor:whitelist', wallet, chain) rồi assertCan(role, 'kyc:approve') (như onboardInvestor)
// quyền xem danh sách: assertCan(role, 'investor:whitelist') (không audit mỗi lần mở)
// thứ tự đúng requirements A1; dùng lại getKycProvider, getBankSigner, ledger.whitelist/waitReceipt, store.saveTxn như onboardInvestor
// listWalletBindings trả kèm `profiles` (danh sách hồ sơ khách hàng cho ô chọn) để màn chỉ cần 1 action
```

```ts
// app/actions/wallet-binding.ts: bindProfileWalletAction, listWalletBindingsAction
// app/(ops)/wallet-binding/page.tsx: AppLayout + WalletBindingPage; cổng quyền như trang /demo-payment (kiểm can(role,'investor:whitelist'))
// components/pages/wallet-binding.tsx ('use client')
```

## 4. Menu

```ts
// nav-config.ts
export interface NavGroup { label: string | null; items: readonly NavItem[]; collapsible?: boolean }
export const WALLET_BINDING_NAV_ITEM: NavItem = { href: '/wallet-binding', label: 'Định danh ví', icon: 'BadgeCheck', shortcut: 'I' };
export function withHiddenOps(nav: NavSection, input: { demoPayment: boolean; walletBinding: boolean }): NavSection;
//   chèn nhóm { label: 'Nghiệp vụ ẩn', collapsible: true, items } ngay sau nhóm đầu tiên khi items khác rỗng
//   items = [ ...(demoPayment ? [DEMO_PAYMENT_NAV_ITEM] : []), ...(walletBinding ? [WALLET_BINDING_NAV_ITEM] : []) ]
// app-layout.tsx: withHiddenOps(NAV_BY_ROLE[role], { demoPayment: canMintDemoPayment(role), walletBinding: can(role, 'investor:whitelist') })
// gỡ withDemoPayment (sửa test dùng nó)
// nav-config.ts: thêm 'BadgeCheck' vào kiểu NavIconName; sidebar.tsx: NAV_ICONS thêm BadgeCheck; nhóm collapsible vẽ <button aria-expanded aria-controls> + danh sách id tương ứng;
//   trạng thái mở giữ trong state cục bộ, giá trị đầu = nhóm có mục khớp pathname
```

`can(role, 'investor:whitelist')` hiện chỉ đúng với `TELLER`, nên nhóm chỉ ở menu Giao dịch viên đúng QĐ-5.

## 5. Giao diện Nhà đầu tư

```tsx
// components/investor/wallet-not-bound-notice.tsx
export function WalletNotBoundNotice({ wallet }: { wallet: string }): JSX.Element;
// role="alert", tiêu đề "Ví chưa được định danh", dòng phụ theo requirements E1
```

- Dùng ở: `asset-summary.tsx`, `transaction-history-box.tsx`, `investor-orders.tsx`, `investor-order-detail.tsx`, `investor-trade.tsx` (khối số dư và đặt lệnh khi `walletBound === false`; khoá nút gửi qua `confirmBlockReason` hoặc điều kiện tương đương), `investor-token-detail.tsx`, `components/trading/trade-check-block.tsx`, `components/trading/gates.ts` (đúng danh sách requirements E4).
- Nhận biết: `result.ok === false && result.code === 'WALLET_NOT_BOUND'`.

## 6. Màn tài khoản

```ts
// account-profile.service.ts
export async function getAccountWallet(input: unknown): Promise<Result<{ wallet: string | null; bound: boolean }>>;
// schema { chain, wallet?: string }; quyền 'wallet:connect' (chỉ hai vai khách hàng); vai nhân viên: FORBIDDEN
// chain 'mock': wallet = ví mẫu hồ sơ phiên, bound = true
// khác: wallet vắng thì { wallet: null, bound: false }; có thì chuẩn hoá, bound = resolveWalletOwner(...)?.actorId === actorId
// app/actions/account.ts: getAccountWalletAction thay hai action cũ
```

- Đổi tên tệp và thành phần để bỏ chữ ProfileWallet: `components/pages/account-wallet.tsx`, `AccountWalletProvider`, `PaymentWalletValue`. `AccountWalletProvider` gọi `getAccountWalletAction({ chain, wallet: chain === 'mock' ? undefined : address })` mỗi khi giá trị THỰC SỰ truyền đi đổi (khoá effect theo `chain` và ví truyền đi, trên `mock` ví truyền đi luôn `undefined` nên không gọi lại khi wagmi đổi); `PaymentWalletValue` hiện ví và nhãn theo requirements F2; xoá `ProfileWalletCard` (khối nhập); sửa chú thích còn nhắc ProfileWallet ở `account-info.tsx`.
- `app/(account)/account/page.tsx`: bỏ `ProfileWalletCard`.

## 7. Rút tiền

```ts
// lib/bank/payout-wallet.ts
export function payoutWalletFormatError(input: { chain: ChainKey; wallet: string }): string | null;
//   G5 bước 2: sai dạng; địa chỉ 0; isPublicSampleWallet và chain không thuộc SAMPLE_WALLET_CHAINS
export function payoutWalletVaultError(input: { wallet: string; vault: string | null }): string | null;
//   phần ví của G5 bước 5: vault null; ví bằng địa chỉ vault
export async function checkPayoutWallet(input: unknown): Promise<Result<{ wallet: string }>>;
//   assertCan(role, 'vault:withdraw'); payoutWalletFormatError; vaultStatus() + payoutWalletVaultError; isWhitelisted
//   không đạt: err('VALIDATION', câu, { payoutWallet: [câu] })
```

```ts
// lib/store/vault.store.port.ts
export const WITHDRAW_STATUSES = ['PAYOUT_SENDING','PAYOUT_SENT','PAYOUT_SET','PAYOUT_REVIEW','SENDING','SENT','COMPLETED','FAILED','NEEDS_REVIEW'] as const;
// WITHDRAW_TRANSITIONS theo bảng requirements G4; WITHDRAW_TERMINAL_STATUSES giữ ['COMPLETED','FAILED']
// WithdrawRequestRecord thêm payoutTxHash: string | null
// createWithdrawRequest(input & { status: 'PAYOUT_SENDING' | 'SENDING' })
// transitionWithdrawRequest({ id, from, to, txHash?, payoutTxHash?, reason? })
// listWithdrawRequests({ statuses }) dùng được với các trạng thái mới (đối soát truyền cả PAYOUT_SENDING, PAYOUT_SENT)
// memory + postgres; postgres.pool.ts ADDED_COLUMNS: ALTER TABLE IF EXISTS "WithdrawRequest" ADD COLUMN IF NOT EXISTS "payoutTxHash" TEXT

// lib/ledger/ledger.port.ts (ILedgerVault)
hasPendingSignerTx(): Promise<boolean>;
txReceiptStatus(txHash: string): Promise<'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN'>;   // không chờ
// evm.adapter: getTransactionCount({ address: ví ký máy chủ, blockTag: 'pending' }) > ... 'latest';
//   getTransactionReceipt, không có thì getTransaction (thấy: PENDING, không thấy: UNKNOWN)
// mock.adapter: false; CONFIRMED. stellar.adapter: LedgerNotImplementedError
```

```ts
// lib/bank/withdraw.service.ts
// createWithdrawSchema thêm payoutWallet: z.string().max(80)
// createWithdrawRequest theo requirements G5:
//   bước 1 tới 3 trước khoá; bước 4 lấy khoá WITHDRAW (refId = id lệnh); bước 5 đọc chuỗi trong khoá; bước 6 tạo lệnh
//   bước 7 tách hàm sendPayoutChange(ledger, request, role): Promise<WithdrawRequestRecord>
//     dùng cùng cách phân loại lỗi với sendWithdraw (LedgerError.reverted = chắc chắn chưa gửi)
//   bước 8 gọi sendWithdraw hiện có, thêm đọc vaultStatus() lần cuối ngay trước withdrawFromVault
// repeatedResult: so thêm payoutWallet (không phân biệt hoa thường); áp cho mọi trạng thái
export async function continueWithdrawRequest(input: unknown): Promise<Result<WithdrawRequestView>>;   // G6
// reconcileWithdrawRequests: listWithdrawRequests statuses thêm PAYOUT_SENDING, PAYOUT_SENT;
//   PAYOUT_SENT: txReceiptStatus(payoutTxHash): CONFIRMED + ví khớp thì PAYOUT_SET, CONFIRMED + ví khác thì PAYOUT_REVIEW,
//     FAILED thì FAILED + nhả khoá, PENDING giữ, UNKNOWN quá receiptTimeoutFor(chain) tính từ updatedAt thì PAYOUT_REVIEW
//   PAYOUT_SENDING quá thời gian thì PAYOUT_REVIEW
// listWithdrawReviews: statuses ['NEEDS_REVIEW', 'PAYOUT_REVIEW']
// resolveWithdrawRequest: nhận from NEEDS_REVIEW (như cũ) hoặc PAYOUT_REVIEW; PAYOUT_REVIEW chỉ FAILED và chỉ khi !hasPendingSignerTx()
export async function cancelWithdrawRequest(input: unknown): Promise<Result<WithdrawRequestView>>;     // G6d
// WithdrawRequestView thêm payoutTxHash
```

- `app/actions/withdraw.ts`: thêm `checkPayoutWalletAction`, `continueWithdrawRequestAction`, `cancelWithdrawRequestAction`.
- `vault-status.tsx` khối "Lệnh rút cần xem xét": dòng `PAYOUT_REVIEW` chỉ có nút đánh dấu thất bại (không có ô mã giao dịch xác nhận).
- `seller-withdraw.tsx`:
  - bỏ chặn "vault chưa có ví nhận" (G2b); ô "Ví nhận" sửa được, điền sẵn `wallet.payoutWallet ?? ''`; nút "Dùng ví đang kết nối" (wagmi `useAccount`, ẩn khi `chain === 'mock'`); câu đổi ví (G1); nhãn đổi từ "Ví nhận (đặt bởi Kiểm soát viên)" thành "Ví nhận";
  - bấm "Tạo lệnh rút" gọi `checkPayoutWalletAction` rồi mới mở hộp mã; gửi `payoutWallet`;
  - kết quả `PAYOUT_SENT` hiện câu chờ biên nhận (G5 bước 7);
  - bảng "Yêu cầu rút của tôi": nhãn ba trạng thái mới (`WITHDRAW_STATUS_LABELS` ở `seller-transactions.tsx`), nút "Gửi lệnh rút" và "Huỷ" cho dòng `PAYOUT_SET` (hộp mã một lần dùng chung cho nút gửi).
- Câu bận khoá giữ như hiện nay (khoá `CONFIG` chỉ còn do Kiểm soát viên giữ), trừ việc bỏ chữ "Kiểm soát viên" ở câu về ví nhận (G7).

## 8. Cấu hình vault

- `vault-config.ts`: `VaultConfigStep` còn ba nhánh; `VaultConfigTarget` bỏ `payoutWallet`; `VaultConfigCurrent` bỏ `payoutWallet`; `planVaultConfig` bỏ dòng đầu; `describeVaultConfigStep`, `VAULT_CONFIG_STEP_LABELS` bỏ nhánh.
- `vault.service.ts`: schema bỏ `payoutWallet`; bỏ chuẩn hoá, kiểm whitelist, kiểm trùng vault của ví nhận; `sendConfigStep` bỏ nhánh; `configFailure` bỏ `payoutChanged`; `VaultConfigFormView` bỏ `payoutWallet`.
- `vault-status.tsx`: bỏ ô, bỏ trường trong state và lệnh gửi; thêm câu H2.
- `getVaultConfigHistory` giữ nguyên (vẫn đọc `PAYOUT_WALLET`).
