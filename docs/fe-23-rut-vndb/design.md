# FE-23: thiết kế

## 1. Lược đồ và cổng

```prisma
/// FE-23: Nhà đầu tư rút VNDB từ ví của mình sang ví nhận đã whitelist. Ví của Nhà đầu tư ký và gửi.
model PaymentWithdrawRequest {
  id              String    @id
  chain           String
  clientRequestId String
  actorId         String
  fromWallet      String
  fromWalletKey   String    /// viết thường
  toWallet        String
  amount          Decimal   @db.Decimal(78, 0)
  purpose         String
  note            String?
  status          String    @default("CREATED")
  /// `chain:fromWalletKey` khi đang chờ (CREATED, SENDING, SUBMITTED), NULL khi đã cuối: mỗi ví một lệnh đang dở.
  activeWallet    String?
  createdBlock    Decimal?  @db.Decimal(78, 0)
  /// Mã trình duyệt báo; KHÔNG duy nhất (mã người khác báo bừa không được chiếm chỗ của lệnh thật).
  submittedTxHash String?
  submittedAt     DateTime? @db.Timestamptz(3)
  /// Lúc chuyển SENDING (A8): mốc tính hết hạn.
  sendingAt       DateTime? @db.Timestamptz(3)
  /// Mã đã chứng minh trên chuỗi; duy nhất theo chain.
  completedTxHash String?
  reason          String?
  createdAt       DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime  @updatedAt @db.Timestamptz(3)
  completedAt     DateTime? @db.Timestamptz(3)

  @@unique([chain, fromWalletKey, clientRequestId])
  @@unique([activeWallet])
  @@unique([chain, completedTxHash])
  @@index([chain, fromWalletKey, createdAt])
}
```

- Sinh lại bằng `cd app && npm run db:sql` (chạy luôn `db:embed-sql`). Bảng mới tự tạo trên database cũ khi áp lại `init.sql`, không cần `ADDED_COLUMNS`.
- `store.errors.ts`: thêm ba ràng buộc duy nhất vào `UNIQUE_CONSTRAINTS`.
- `lib/store/payment-withdraw.store.port.ts`: `PAYMENT_WITHDRAW_STATUSES`, bảng chuyển tiếp đúng mục 4 requirements (gồm các chuyển từ trạng thái cuối âm sang `COMPLETED`), `create`, `findById`, `findByClientRequest`, `findActive(chain, wallet)`, `listByWallet(chain, wallet, { statuses?, since?, sentOnly?, limit })` (`sentOnly`: `sendingAt` khác NULL), `findByCompletedTx(chain, txHash)`, `transition({ id, from, to, submittedTxHash?, completedTxHash?, reason? })` (câu có điều kiện trạng thái, trả `null` khi trạng thái đã khác; sang trạng thái cuối thì `activeWallet` NULL trong cùng câu; sang `SENDING` ghi `sendingAt`; sang `SUBMITTED` ghi `submittedAt`). Bản bộ nhớ và Postgres theo mẫu `memory.vault.store.ts`, `postgres.vault.store.ts` của lệnh rút vault.

## 2. Ledger

Ba phương thức đọc mới trên `ILedgerPort` (requirements B: `paymentTxSender`, `paymentTransferReceipt`, `findPaymentTransferByTag`) và `mockTransferPayment` chỉ có ở adapter mock (khai báo tuỳ chọn trên cổng `mockTransferPayment?`, service gọi khi họ chain là mock và phương thức có mặt; thiếu thì lỗi lập trình). Calldata dựng trong `lib/bank/payment-withdraw.service.ts`: `concat([encodeFunctionData(transfer), paymentTag(id)])` với `paymentTag(id) = keccak256(toBytes(id))`; địa chỉ VNDB lấy bằng `getContractAddress(chain, 'VNDToken')`. Trạng thái mock thêm `paymentTransfers` (requirements B), có ca giải mã trạng thái cũ thiếu trường.

## 3. Nghiệp vụ

```ts
// lib/bank/payment-withdraw.service.ts
export function paymentTargetError(input: { chain: ChainKey; fromWallet: string; toWallet: string; systemAddresses: readonly string[] }): string | null;
//   payoutWalletFormatError (dạng, địa chỉ 0, ví mẫu công khai), khác ví gửi, không thuộc systemAddresses
export function paymentTag(id: string): `0x${string}`;
export function matchesTransfer(request: { id; fromWallet; toWallet; amount: string }, evidence: { txFrom: string | null; input: `0x${string}` | null; transfers: readonly { from; to; value: bigint }[] }): boolean;
export async function beginPaymentSend(input: unknown): Promise<Result<PaymentWithdrawView & { txRequest: TxRequest | null }>>;   // A8; txRequest null trên mock
export async function checkPaymentWithdrawTarget(input: unknown): Promise<Result<{ toWallet: string }>>;
export async function createPaymentWithdraw(input: unknown): Promise<Result<PaymentWithdrawView>>;   // không trả giao dịch
export async function submitPaymentWithdrawTx(input: unknown): Promise<Result<PaymentWithdrawView>>;
export async function cancelPaymentWithdraw(input: unknown): Promise<Result<PaymentWithdrawView>>;
export async function getPaymentWithdrawPage(input: unknown): Promise<Result<{ balance: string; requests: PaymentWithdrawView[] }>>;
// TxRequest = { chainId: number; to: `0x${string}`; data: `0x${string}`; value: '0' }
// systemAddresses(chain): Object.values(addressBook[chain]?.contracts ?? {}) + vaultAddressFor(chain) + profitDistributorAddressFor(chain) + await ledger.spvWallet(), bỏ rỗng, chữ thường
// hằng số: PENDING_TTL_MS = 30 phút; RESCAN_WINDOW_MS = 24 giờ; RESCAN_LIMIT = 5
```

- `app/actions/payment-withdraw.ts`: sáu action tương ứng.
- RBAC: `payment:withdraw` vào danh sách hành động và `INVESTOR`.
- Audit: action `payment:withdraw`.

## 4. Giao diện

- `app/(investor)/withdraw/page.tsx`: `AppLayout` + `InvestorWithdrawPage`, truyền `mockWallet` từ `ownMockWallet()` như `/trade`.
- `components/pages/investor-withdraw.tsx` (`'use client'`): ví gửi là `address` của wagmi (mock: `mockWallet`); gọi `getPaymentWithdrawPageAction` theo khoá `chain|ví`.
- `lib/signer/wallet-transfer.ts`: `sendPaymentTransferWithWallet(provider, { from, chainId, to, data })` theo mẫu `wallet-permit.ts`: `createWalletSigner`, kiểm tài khoản đang chọn là `from` và chain của ví là `chainId` (sai thì ném lỗi có câu rõ), rồi `sendTransaction` qua wallet client viem; trả mã giao dịch; lỗi 4001 trả loại riêng để màn gọi huỷ với `walletRejected: true`.
- Hộp mã một lần chép theo mẫu `seller-withdraw.tsx`.
- Nhãn trạng thái: `PAYMENT_WITHDRAW_STATUS_LABELS` trong `components/withdraw/labels.ts`.
