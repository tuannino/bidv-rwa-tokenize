# IN-04: thiết kế

## 1. Tệp mới, tệp sửa

| Tệp | Việc |
|---|---|
| `lib/config/env.ts` | Biến `FIREBLOCKS_*` (requirements A1) |
| `lib/custody/fireblocks-config.ts` | `fireblocksConfig()` (A2), đọc `serverEnv()`, tính `configRef`; `fireblocksChainScope()` đọc `FIREBLOCKS_CHAIN_ASSETS` theo requirements A2: mọi phần tử phải đúng dạng `chain:assetId`, chain là ChainKey có `chainFamily(key) === 'evm'`, không trùng; CHỈ MỘT phần tử sai là cả bảng `{ ok: false, reason }` (KHÔNG lọc bỏ phần tử sai để dùng phần còn lại); `setFireblocksConfigForTest` theo requirements B4 |
| `lib/custody/fireblocks-client.ts` | Khách REST, JWT, lớp lỗi, `classifyCreateError` và ba hằng mã lỗi (B1 tới B3) |
| `lib/custody/fireblocks-execution.ts` | `CustodyContext`, `classifyFireblocksTx`, `submitViaFireblocks`, `reconcileViaFireblocks`, `matchesPreparedCall`, `confirmFireblocksMatch` (C3 tới C5, QĐ-15), phụ thuộc truyền vào |
| `lib/bank/custody.service.ts` | `getCustodyState`, `getCustodyStateForLayout`, `setFireblocksCustody`, `custodyFor` (A3) |
| `app/actions/custody.ts` | `setFireblocksCustodyAction` |
| `lib/bank/token-request.service.ts` | C1, C3 (rẽ nhánh), C4, C6, C7 |
| `lib/bank/issuance.service.ts` | `executeIssuance` nhận `custody`, `custodyContext`, `claimTxHash` (mục 3); `SubmitTxnInput.actorAddress` (E3) |
| `lib/ledger/ledger.port.ts`, `evm.adapter.ts` | D1, D2, D2b |
| `lib/store/token-request.*` | E1, E2 (cổng, bộ nhớ, Postgres), `prisma/schema.prisma`, `init.sql`, `postgres.pool.ts` |
| `lib/rbac/permissions.ts` | `custody:toggle` |
| `components/layout/app-layout.tsx`, `sidebar.tsx`, tệp mới `components/layout/custody-toggle.tsx` | A5 |
| `components/layout/channel-guard.tsx`, tệp mới `components/layout/role-home.ts` | F1 |
| `packages/contracts-evm/scripts/fireblocks-roles.js` | G1 |

## 2. Khách Fireblocks

```ts
export interface FireblocksClient {
  createContractCall(input: { externalTxId: string; vaultId: string; assetId: string; contract: string; data: string; note: string }): Promise<{ id: string; status: string }>;
  getByExternalTxId(externalTxId: string): Promise<FireblocksTx | null>;
  getById(id: string): Promise<FireblocksTx>;
}
export function createFireblocksClient(config: FireblocksConfig, fetchImpl: typeof fetch = fetch): FireblocksClient;
export function getFireblocksClient(): FireblocksClient;      // dùng fireblocksConfig(); null thì ném lỗi lập trình
export function setFireblocksClientForTest(client: FireblocksClient | null): void;  // chỉ test

export async function signJwt(auth: { apiKey: string; privateKeyPem: string }, path: string, body: string): Promise<string>  // xuất để ca 1 kiểm trực tiếp
// header {alg:'RS256',typ:'JWT'}; payload {uri:path, nonce:crypto.randomUUID(), iat, exp:iat+25, sub:apiKey, bodyHash:hex(sha256(body))}
// base64url không đệm; khoá: importKey('pkcs8', der, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['sign']), nhớ theo isolate
```

- Thân POST dựng bằng `JSON.stringify` MỘT lần, cùng chuỗi đó vừa băm vừa gửi.
- `path` gồm `/v1/...` và chuỗi truy vấn; URL gửi là `baseUrl + path`.
- `externalTxId` trong đường dẫn qua `encodeURIComponent` (mã yêu cầu là UUID nên không đổi, nhưng vẫn mã hoá).

## 3. Thực hiện qua Fireblocks

Tất cả hàm của mục này nằm ở `lib/custody/fireblocks-execution.ts`, trừ `classifyCreateError` (ở `lib/custody/fireblocks-client.ts`, cạnh các lớp lỗi của khách).

```ts
/** Bối cảnh ký chụp lúc chiếm quyền (requirements E1, QĐ-6). */
export interface CustodyContext {
  configRef: string; vaultId: string; address: string; assetId: string; chain: ChainKey;
  contract: string | null; callDataHash: string | null;   // ghi ở bước chuẩn bị (setCustodyCall)
}

export type FireblocksVerdict =
  | { kind: 'HASH'; txHash: string; fireblocksId: string }
  | { kind: 'DEAD'; reason: string; fireblocksId: string | null }
  | { kind: 'WAIT'; reason?: string; fireblocksId: string | null };   // reason có khi FAILED không mã, subStatus khác
export function classifyFireblocksTx(tx: FireblocksTx): FireblocksVerdict;          // requirements C5

export interface SubmitDeps {
  prepare(): Promise<{ to: string; data: string }>;                                   // ledger.prepareContractCall(..., from = context.address)
  setCustodyCall(input: { contract: string; callDataHash: string }): Promise<TokenRequestRecord | null>;
  markAttempted(): void;                                                              // gọi NGAY TRƯỚC createContractCall
  client: FireblocksClient;
  onCreated(fireblocksId: string): Promise<void>;                                     // store.attachCustodyTxId; lỗi chỉ log
  sleep(ms: number): Promise<void>;                                                   // test truyền hàm không chờ
  hashWaitMs: number;
  pollMs: number;                                                                     // 3000
}

export type SubmitOutcome =
  | { kind: 'HASH'; txHash: string }
  | { kind: 'FAILED'; reason: string; definitelyNotOnChain: true }   // revert khi mô phỏng, setCustodyCall null, DEAD, REJECTED rồi 1439
  | { kind: 'UNKNOWN'; reason: string };                              // giữ EXECUTING

export async function submitViaFireblocks(
  input: { requestId: string; note: string; context: CustodyContext },   // vaultId, assetId lấy từ context
  deps: SubmitDeps,
): Promise<SubmitOutcome>;
// Thứ tự: prepare (revert: FAILED) rồi setCustodyCall (ném hoặc null: FAILED, DỪNG) rồi markAttempted
// rồi createContractCall({ externalTxId: requestId, vaultId: context.vaultId, assetId: context.assetId,
// contract: to, data, note }) đúng MỘT lần, không Idempotency-Key; lỗi tạo xử lý theo requirements C3 bước 3;
// vòng hỏi getById theo C3 bước 4. KHÔNG ném sau markAttempted: lỗi getById bị nuốt trong vòng hỏi.
// Hàm này KHÔNG gắn mã: trả HASH để người gọi gắn bằng claimTxHash (QĐ-16).

export const DUPLICATE_EXTERNAL_TX_ID = 1438;
export const NO_SUCH_EXTERNAL_TX_ID = 1439;
export const CREATE_REJECTED_CODES: ReadonlySet<number> = new Set([900, 1409, 1502, 1503, 1004, 11001, 1407, 1402, 1404, 1424, 1432, -7, -8]);
// (ba hằng và classifyCreateError ở fireblocks-client.ts)
export function classifyCreateError(error: unknown): 'DUPLICATE' | 'REJECTED' | 'UNKNOWN';
// FireblocksHttpError: code 1438 => DUPLICATE; code thuộc CREATE_REJECTED_CODES => REJECTED; còn lại (kể cả 429, 5xx) => UNKNOWN
// FireblocksNetworkError và lỗi khác => UNKNOWN

export function matchesPreparedCall(
  ctx: Pick<CustodyContext, 'address' | 'contract' | 'callDataHash'>,
  tx: { from: string; to: string | null; input: string } | null,
): boolean;  // so địa chỉ chữ thường, keccak256(input) bằng callDataHash; contract hoặc callDataHash null, hoặc tx null: false

export async function confirmFireblocksMatch(request: TokenRequestRecord): Promise<boolean>;
// đọc ledger.transactionCallOf(request.txHash) rồi matchesPreparedCall(bối cảnh của CHÍNH bản ghi truyền vào)

export async function reconcileViaFireblocks(request: TokenRequestRecord, deps: { client: FireblocksClient; currentConfig: FireblocksConfig | null }):
  Promise<{ kind: 'HASH'; txHash: string } | { kind: 'FAILED'; reason: string; definitelyNotOnChain: true } | { kind: 'WAIT'; message: string }>;
// requirements C4: cấu hình hiện tại thiếu, hoặc configRef/vaultId khác bối cảnh: WAIT câu QĐ-14, KHÔNG gọi khách;
// tra getById(custodyTxId) nếu có, không thì getByExternalTxId(request.id); lỗi tra: WAIT "Chưa đọc được Fireblocks; thử lại.";
// null (404 kèm 1439): WAIT câu QĐ-7b; có giao dịch: classifyFireblocksTx (DEAD: FAILED; WAIT: WAIT). Không có nhánh theo thời gian.
// Không bao giờ gọi createContractCall.
```

**Nối vào mã có sẵn (một đường duy nhất):**

- `executeIssuance`, `executeBurn` nhận thêm `custody` (mặc định `SERVER`), và với `FIREBLOCKS` nhận `custodyContext` và `claimTxHash`. Trang ẩn `/mint` và các nơi gọi khác không truyền gì nên đi đường `SERVER`, kiểu kết quả `IssuanceSubmission` của chúng giữ nguyên.
- Đường `FIREBLOCKS` trong hai hàm trên: gọi `submitViaFireblocks`.
  - `HASH`: gọi `claimTxHash({ id, txHash })`.
    - Trả `null` (thua, QĐ-16): ĐỌC LẠI yêu cầu (`findRequest`), trả `{ status: 'UNKNOWN', txHash: null, reason: 'Yêu cầu đang được đối soát ở lượt khác.', lostClaim: true }`; KHÔNG ghi `Txn`, KHÔNG chờ biên nhận.
    - Trả bản ghi (thắng): dựng `pending = { txHash, status: 'PENDING' }`, gọi `trackTxn` với `actorAddress` = `custodyContext.address` của bản ghi đó và `onSubmitted` rỗng (không gọi `attachRequestTxHash`); trả kết quả biên nhận kèm `claimed` (bản ghi mới, có `contract`, `callDataHash`) để bước khớp QĐ-15 dùng đúng bản ghi này. Biên nhận `FAILED`: ghi sổ như đường `SERVER`, kết quả mang `definitelyNotOnChain: false` nhưng là biên nhận `FAILED` (được phép `FAILED` theo QĐ-8b).
  - `FAILED`: trả `err('LEDGER', reason)` kèm cờ `definitelyNotOnChain: true` trong kết quả.
  - `UNKNOWN`: trả `{ status: 'UNKNOWN', txHash: null, reason }`.
- `approveTokenRequest`:
  - thêm biến `fireblocksAttempted`, truyền `markAttempted: () => { fireblocksAttempted = true; }`;
  - khối `catch`: ghi `FAILED` chỉ khi `!submitted && !fireblocksAttempted`;
  - nhánh `!outcome.ok` khi `fireblocksAttempted`: chỉ ghi `FAILED` nếu kết quả mang `definitelyNotOnChain: true` hoặc là biên nhận `FAILED`; còn lại xử lý như `UNKNOWN`;
  - `UNKNOWN`: như nhánh "chưa có biên nhận" của HF-05: giữ `EXECUTING`, audit "đã gửi Fireblocks, chưa rõ kết quả, cần đối soát" (không in `tx undefined`); có `lostClaim: true` thì KHÔNG ghi audit, chỉ trả câu QĐ-16;
  - biên nhận `CONFIRMED`: `confirmFireblocksMatch(claimed)`; sai thì giữ `EXECUTING`, audit FAILURE (QĐ-15); đúng thì `finalizeConfirmed`.
- `reconcileTokenRequest`, yêu cầu `FIREBLOCKS`:
  - chưa có `txHash`: `reconcileViaFireblocks`; `HASH` thì `claimTxHash`, thua thì trả câu QĐ-16 (không ghi gì), thắng thì dùng bản ghi trả về cho phần còn lại (không đọc lại bản cũ) và ghi MỘT dòng `Txn` (`actorAddress` = `custodyContext.address`; lỗi thì chỉ log) TRƯỚC khi đi đường biên nhận;
  - đã có `txHash` (hoặc vừa gắn): đường biên nhận hiện có; `syncTxnFromReceipt` với yêu cầu `FIREBLOCKS` CHỈ cập nhật dòng `Txn` đã có, không thêm; biên nhận `CONFIRMED` thì `confirmFireblocksMatch` trước `finalizeConfirmed`.
- Đường `SERVER` không đổi hành vi; biến `submitted` của `approveTokenRequest` vẫn đúng nghĩa (đã gắn mã giao dịch).

## 4. Lưu trữ

```prisma
// TokenRequest
  /// IN-04: cách thực hiện chốt lúc duyệt. Giá trị hợp lệ: TOKEN_REQUEST_CUSTODIES.
  custody       String    @default("SERVER")
  /// IN-04: mã giao dịch Fireblocks. Có thì đối soát tra bằng mã này, không thì theo externalTxId = id.
  custodyTxId   String?
  /// IN-04: JSON bối cảnh ký không bí mật chụp lúc duyệt (configRef, vaultId, address, assetId, chain, contract, callDataHash).
  custodyContext String?
```

```ts
// postgres.pool.ts ADDED_COLUMNS
`ALTER TABLE IF EXISTS "TokenRequest" ADD COLUMN IF NOT EXISTS "custody" TEXT NOT NULL DEFAULT 'SERVER'`,
`ALTER TABLE IF EXISTS "TokenRequest" ADD COLUMN IF NOT EXISTS "custodyTxId" TEXT`,
`ALTER TABLE IF EXISTS "TokenRequest" ADD COLUMN IF NOT EXISTS "custodyContext" TEXT`,
```

- `transitionRequest`: khi `custody`, `custodyContext` có thì `SET` cả hai trong cùng câu `UPDATE ... WHERE status = ANY(from)`.
- `attachCustodyTxId`: `UPDATE ... SET "custodyTxId" = $2 WHERE id = $1 AND status = 'EXECUTING' RETURNING *`.
- `setCustodyCall` (trả bản ghi hoặc `null`): cập nhật `custodyContext` (giữ các trường cũ, thêm `contract`, `callDataHash`) `WHERE id = $1 AND status = 'EXECUTING'`.
- `claimTxHash`: `UPDATE ... SET "txHash" = $2 WHERE id = $1 AND status = 'EXECUTING' AND "txHash" IS NULL RETURNING *`; không có dòng thì `null`.

## 5. Giao diện

- `AppLayout`: `const custody = isOpsRole(role) ? await getCustodyStateForLayout() : null;` truyền `custody` vào `Sidebar`. Chỉ bản cho layout nuốt lỗi; lần duyệt dùng `getCustodyState` (ném lỗi).
- `CustodyToggle` (`'use client'`): props `{ enabled, configured, scope }`; chữ dùng lớp của mục menu hiện có (không màu riêng); công tắc tự dựng bằng `button` (rộng khoảng 40px, cao 22px, bo tròn hết; nền `bg-green-500` khi bật, `bg-muted-foreground/40` khi tắt; núm `h-[18px] w-[18px] rounded-full bg-white shadow` dịch trái phải bằng `translate-x`, `transition-transform`), không thêm thư viện; dùng `useSelectedChain()` để hiện "Không áp dụng cho chain này"; nút công tắc `role="switch"`, `aria-checked`, `aria-label="Lưu ký Fireblocks"`; `useTransition` khi gọi action.
- `role-home.ts`: `export const roleHomeHref = (role: Role) => CHANNEL_HOME[ROLE_CHANNEL[role]];` `ChannelGuard` thêm `<Link prefetch={false} href={roleHomeHref(role)}>Về trang của vai hiện tại</Link>` kiểu nút viền.
- Màn chi tiết duyệt: `TokenRequestDetailView` thêm `custodyLabel: string` (dựng sẵn ở máy chủ theo C7).

## 6. Sổ kiểm toán

| Việc | `action` | Ghi chú |
|---|---|---|
| Bật, tắt công tắc | `custody:toggle` | `detail`: "Lưu ký Fireblocks: tắt sang bật (lý do)" |
| Chặn duyệt vì vault thiếu vai, thiếu cấu hình, bảng chain sai (`UNRESOLVED`), không đọc được trạng thái công tắc | `order:approve` FAILURE | như các lần chặn hiện có |
| Mã giao dịch Fireblocks (`custodyTxId`) | không có dòng riêng lúc tạo | nằm trong `detail` của dòng sổ kết cục (chốt, chưa rõ, `FAILED`); KHÔNG có `contractCallData` đầy đủ; lượt thua QĐ-16 không ghi |
| Chưa rõ, chờ đối soát | `order:approve` SUCCESS | như nhánh hết giờ HF-05, thêm "qua Fireblocks" |
| `FAILED` do Fireblocks | `order:approve` FAILURE | `status/subStatus` |
| Giao dịch không khớp lời gọi đã chuẩn bị (QĐ-15) | `order:approve` FAILURE | mã giao dịch, trường lệch (`from`, `to` hoặc `input`) |
| Thua lượt gắn mã (QĐ-16) | không ghi | trả câu cho người bấm, không thêm dòng sổ |
