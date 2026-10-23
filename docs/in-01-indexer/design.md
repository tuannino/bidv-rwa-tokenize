# IN-01: thiết kế (bản 2)

## 1. Bảng

```prisma
model ChainEvent {
  chain          String
  anchor         String    // định danh phiên bản chuỗi, mục 2
  contract       String    // địa chỉ hợp đồng, dạng normalizeEvmAddress
  eventName      String
  blockNumber    Decimal   @db.Decimal(78, 0)
  logIndex       Int
  txHash         String
  blockTimestamp BigInt    // giây Unix của block
  args           Json      // bigint ghi chuỗi thập phân, địa chỉ qua normalizeEvmAddress, bytes32 chuỗi hex thường
  createdAt      DateTime  @default(now()) @db.Timestamptz(3)

  @@id([chain, anchor, txHash, logIndex])
  @@index([chain, anchor, contract, eventName, blockNumber])
}

model IndexerCursor {
  chain       String    @id
  anchor      String
  vault       String    // địa chỉ vault lúc đặt cursor
  token       String    // địa chỉ WPT lúc đặt cursor
  lastBlock   Decimal   @db.Decimal(78, 0)   // đã lưu đủ tới block này
  leaseUntil  DateTime? @db.Timestamptz(3)
  leaseOwner  String?
  updatedAt   DateTime  @db.Timestamptz(3)
}
```

- Chèn lại cùng log là `ON CONFLICT DO NOTHING`.
- Không có cột cho từng tham số sự kiện. Truy vấn theo tham số (`orderRef`, `periodRef`, `to`) lọc theo trường JSON trong `args` trên tập đã thu hẹp bằng chỉ mục; khối lượng PoC nhỏ nên đủ.

## 2. Phạm vi dữ liệu: `scope = (anchor, vault, token)`

- `anchor` = mã băm của block `deployBlock` (đọc bằng `getBlock` qua RPC chính). Triển khai lại với block triển khai khác, hoặc nút Hardhat reset rồi triển khai lại cùng địa chỉ tất định, đều cho `anchor` khác vì block đó khác (mốc thời gian, giao dịch).
- `anchor` đọc một lần mỗi isolate cho mỗi chain (giữ trong biến của module, khoá theo `chain` và `deployBlock`), không đọc lại ở mỗi lần gọi. Nút Hardhat reset trong lúc dev server còn chạy: test và `evm-local.sh reset` khởi động lại tiến trình nên isolate mới đọc lại; ghi điều này vào chú thích.
- Mọi truy vấn `ChainEvent` lọc `chain`, `anchor` và `contract` hiện hành. Dòng của phạm vi cũ không xoá, không lẫn vào kết quả.

## 3. Bố cục mã

```
lib/store/chain-event.store.port.ts        IChainEventStore (kiểu, không phụ thuộc viem)
lib/store/memory.chain-event.store.ts      cho vitest và USE_MOCK_DB
lib/store/postgres.chain-event.store.ts    Postgres
lib/indexer/event-index.ts                 createEventIndex({ store, source, config }): đồng bộ và đọc, không biết viem
lib/ledger/evm.adapter.ts                  nguồn log (viem) cho event-index; năm hàm đọc gọi event-index
lib/ledger/index.ts                        factory ghép kho vào createEvmLedger (như đang ghép kho cho mock)
```

- `source` gồm bốn hàm tách bạch:
  - `head()`: block mới nhất của RPC log (`logReader()`, `cacheTime: 0`), để không hỏi log của block mà nút log chưa có.
  - `scope()`: `{ anchor, vault, token, deployBlock }` (mục 2).
  - `fetchLogs(from, to)`: log của hai hợp đồng đã giải mã, KHÔNG có mốc thời gian; đoạn dài hơn `EVM_LOG_BLOCK_CHUNK` thì chia đoạn như `scanLogs`.
  - `timestamps(blockNumbers)`: `getBlock` cho đúng các block được truyền vào.
- `createEvmLedger(chain, signer, { eventStore })`: tham số thứ ba tuỳ chọn để test cũ vẫn dựng được adapter; thiếu thì dùng kho bộ nhớ riêng của instance.
- Luật kiến trúc 1 giữ nguyên: viem chỉ trong `lib/ledger`; `lib/indexer` và `lib/store` không nhập viem.

## 4. Cổng kho

```ts
interface IChainEventStore {
  readCursor(chain): Promise<CursorRow | null>;
  /** Lấy lease nếu trống hoặc hết hạn. Phạm vi khác thì đặt lại lastBlock = deployBlock trừ 1. Trả null nếu người khác đang giữ. */
  claimLease(chain, owner, seconds, scope, resetTo): Promise<CursorRow | null>;
  /** Một transaction: chèn sự kiện (bỏ trùng), tiến cursor và gia hạn lease, CHỈ KHI leaseOwner = owner và lastBlock = expected. */
  commitSegment(chain, owner, expected, newLast, events, renewSeconds): Promise<boolean>;
  /** Trả lease, chỉ khi còn là của owner. */
  releaseLease(chain, owner): Promise<void>;
  listEvents(q: { chain, anchor, contract, eventNames?, fromBlock?, toBlock, argEquals? }): Promise<IndexedEvent[]>;
  /** Mọi ví từng là bên gửi hoặc bên nhận Transfer (bỏ địa chỉ 0), kèm số dư tính từ sự kiện, sắp theo ví. */
  tokenWallets(q: { chain, anchor, token, toBlock, limit }): Promise<Array<{ wallet, balance }>>;
}
```

- `claimLease` (Postgres), một câu:
  ```sql
  INSERT INTO "IndexerCursor" (chain, anchor, vault, token, "lastBlock", "leaseUntil", "leaseOwner", "updatedAt")
  VALUES ($1, $2, $3, $4, $5, now() + $6 * interval '1 second', $7, now())
  ON CONFLICT (chain) DO UPDATE SET
    "leaseUntil" = EXCLUDED."leaseUntil", "leaseOwner" = EXCLUDED."leaseOwner", "updatedAt" = now(),
    "lastBlock" = CASE WHEN "IndexerCursor".anchor <> EXCLUDED.anchor
                         OR "IndexerCursor".vault <> EXCLUDED.vault
                         OR "IndexerCursor".token <> EXCLUDED.token
                       THEN EXCLUDED."lastBlock" ELSE "IndexerCursor"."lastBlock" END,
    anchor = EXCLUDED.anchor, vault = EXCLUDED.vault, token = EXCLUDED.token
  WHERE "IndexerCursor"."leaseUntil" IS NULL OR "IndexerCursor"."leaseUntil" < now()
  RETURNING *;
  ```
- `commitSegment` dùng `pgTransaction`: chèn từng lô (`INSERT … ON CONFLICT DO NOTHING`), rồi
  `UPDATE … SET "lastBlock" = $new, "leaseUntil" = now() + $renew * interval '1 second', "updatedAt" = now() WHERE chain = $1 AND "leaseOwner" = $owner AND "lastBlock" = $expected`. Không cập nhật được dòng nào thì ROLLBACK, trả `false`.
- `releaseLease`: `UPDATE … SET "leaseUntil" = NULL, "leaseOwner" = NULL WHERE chain = $1 AND "leaseOwner" = $2`. Không có điều kiện owner thì chủ cũ đã hết hạn sẽ xoá lease của chủ mới.
- `tokenWallets`: hai vế `UNION ALL` (ví nhận cộng `value`, ví gửi trừ `value`) trên dòng `Transfer` của `token` tới `toBlock`, bỏ địa chỉ 0, `GROUP BY wallet ORDER BY wallet LIMIT $limit + 1` (lấy thừa một dòng để biết bị cắt). Giữ cả ví số dư 0: đó chính là ví có thể còn số dư tại snapshot cũ. Giá trị ép `numeric`.

## 5. Đồng bộ và đọc

```
readEvents(query, needTimestamps)                         // dùng chung cho năm hàm
  sc = source.scope(); head = source.head()
  target = max(sc.deployBlock - 1, head - C)
  cursor = store.readCursor(chain)
  stale = cursor == null hoặc phạm vi của cursor khác sc
  if stale hoặc cursor.lastBlock < target:
     lease = store.claimLease(chain, owner, LEASE, sc, sc.deployBlock - 1)
     if lease: syncSegments(lease)                         // có thể dừng sớm, xem dưới
     cursor = store.readCursor(chain)                      // đọc lại sau khi đồng bộ hoặc khi không lấy được lease
  base = (cursor có phạm vi bằng sc) ? cursor.lastBlock : sc.deployBlock - 1
       // không lấy được lease mà phạm vi còn cũ: coi như bảng rỗng, đọc thẳng từ block triển khai (chậm nhưng đúng)
  stored = store.listEvents(query, toBlock = base)
  tail   = source.fetchLogs(base + 1, head) lọc theo query    // có thể dùng lại phần đuôi của lượt đồng bộ cuối
  if needTimestamps: tail gắn mốc thời gian bằng source.timestamps(các block khác nhau của tail)
  return sắp xếp(stored + tail)

syncSegments(lease)
  from = lease.lastBlock + 1
  lặp tối đa INDEXER_MAX_BLOCKS_PER_SYNC block, mỗi đoạn tối đa INDEXER_SEGMENT_BLOCKS block:
     end = min(target, from + SEGMENT - 1)
     logs = source.fetchLogs(from, end)
     ts = source.timestamps(các block khác nhau có log trong đoạn)   // phải có trước khi ghi bảng
     ok = store.commitSegment(chain, owner, from - 1, end, logs gắn ts, LEASE)
     ok = false: dừng (người khác đã tiến cursor hoặc lease đã mất)
     from = end + 1; tới target thì dừng
  cuối cùng (kể cả khi lỗi): store.releaseLease(chain, owner)
  lỗi của source trong vòng lặp: bắt, ghi console.warn, dừng đồng bộ; lỗi của store: ném ra (R8)
```

- Mỗi đoạn tự gia hạn lease khi commit, nên lượt đồng bộ dài (đuổi theo lịch sử sau khi triển khai) không bị người khác chen vào giữa chừng. `INDEXER_SEGMENT_BLOCKS` mặc định 50.000 (năm lời gọi `eth_getLogs` cỡ 10.000 block), `INDEXER_LEASE_SECONDS` mặc định 60: một đoạn đo trên Sepolia phải xong dưới một nửa thời gian lease; ghi số đo vào checkpoint, vượt thì giảm cỡ đoạn.
- Vì sao vẫn kiểm `lastBlock = expected` khi đã có lease: lease có thể hết hạn giữa chừng (RPC treo lâu hơn thời gian lease) và người khác đã tiến cursor; điều kiện này làm lượt chậm tự huỷ thay vì ghi chồng.
- Khi đã bắt kịp, lượt đồng bộ chỉ còn đoạn nhỏ: được phép gộp đoạn cuối với phần đuôi trong MỘT lời gọi `fetchLogs(from, head)` rồi tách theo `end`, miễn mốc thời gian chỉ lấy cho phần cần lưu và phần cần trả.
- Một lần `fetchLogs` lấy cả hai hợp đồng (`address: [vault, token]`, không chỉ định `eventName`), giải mã theo ABI của đúng địa chỉ phát ra. Log không giải mã được: bỏ qua, `console.warn` một lần.
- `owner` của lease: `crypto.randomUUID()` mỗi lượt.

## 6. Ánh xạ năm hàm và người nắm giữ

| Hàm | Truy vấn | Mốc thời gian | Ghi chú |
|---|---|---|---|
| `vaultConfigEvents(filter)` | vault, 4 sự kiện cấu hình, `fromBlock = filter.fromBlock` | Cần | Giữ bước đổi thành `VaultConfigEvent`, thứ tự tăng dần |
| `vaultPeriodCloses(limit)` | vault, `PeriodClosed` | Cần | Mới nhất trước, cắt `limit` sau khi gộp đuôi |
| `findVaultPeriodClose(ref, hint)` | vault, `PeriodClosed`, `argEquals: { periodRef }` | Cần | Không thấy và có `hint` thì đọc biên nhận như HF-04 |
| `findVaultWithdrawals(f)` | vault, `Withdrawn`, `fromBlock`, `argEquals: { to }` | Không | Lọc `amount` sau, sắp tăng dần như cũ |
| `findOrderSettlement(id)` | vault, `OrderSettled`, `argEquals: { orderRef }` | Không | Giữ `isOrderSettled` trước; có cờ mà không thấy sự kiện thì `SETTLED_TX_UNKNOWN` |
| `listTokenWallets()` | `tokenWallets` tới block đã lưu, cộng `Transfer` của đuôi | Không | Sắp theo ví (chữ thường), `truncated` khi vượt giới hạn |

- Hàm `readPeriodCloses`, vòng quét lùi của `findOrderSettlement` và các nhánh "thiếu block triển khai" của năm hàm bị xoá. Block triển khai chỉ còn dùng ở `scope()`.
- `listTokenWallets` trả MỌI ví từng nhận hoặc gửi WPT, kèm số dư hiện tại tính từ sự kiện (có thể bằng 0). Hai cách dùng:
  - Chia lợi nhuận: dùng toàn bộ danh sách; số chia vẫn là `balanceOfAt(snapshotId)`, ví không còn số dư tại snapshot nhận 0. Đây là lý do không lọc theo số dư hiện tại: ví giữ WPT lúc chụp snapshot rồi chuyển hết trước khi lập hồ sơ vẫn phải được chia.
  - BE-05 (sau này): lọc `balance > 0` để biết ví cần thu hồi, rồi đọc lại `balanceOf` trên chuỗi trước khi đốt.

## 7. Cổng và chỗ gọi

- `ILedgerRead` (hoặc nhóm phù hợp nhất trong `ledger.port.ts`) thêm:
  `listTokenWallets(): Promise<{ wallets: Array<{ wallet: string; balance: bigint }>; truncated: boolean; asOfBlock: bigint | null }>`.
  - Giới hạn: `MAX_RECIPIENT_SCAN` (5.000), cùng giới hạn danh sách người nhận hiện có.
  - Sửa chú thích "KHÔNG có method liệt kê người nắm giữ" ở mục 4 của `ledger.port.ts`: nay có, đọc từ Indexer; lý do cấm quét trong adapter vẫn đúng và chính là lý do có Indexer.
  - Mock: mọi ví có trong `s.balances` (kể cả số dư 0 nếu có dòng), sắp theo ví, `truncated` theo cùng giới hạn, `asOfBlock = null`. Stellar: `LedgerNotImplementedError`.
- `collectRecipients`: thêm nguồn 4 sau nguồn 3, cùng hàm `add` (bỏ trùng không phân biệt hoa thường, giữ cách viết đầu tiên); `truncated` thành đúng khi nguồn 4 báo `truncated`. Sửa đoạn "GIỚI HẠN ĐÃ BIẾT" và dòng `@flow distribute:5`.
- Thứ tự danh sách người nhận cuối cùng: giữ cách hiện có (thứ tự gặp lần đầu qua các nguồn), nhưng các nguồn đều có thứ tự xác định (nguồn 4 sắp theo ví) nên hai lần chạy trên cùng dữ liệu cho cùng thứ tự.
- Tầng nghiệp vụ khác không đổi.

## 8. Triển khai Sepolia

- Lần mở đầu tiên sau khi triển khai đồng bộ tối đa `INDEXER_MAX_BLOCKS_PER_SYNC` (200.000) block; khoảng từ block triển khai tới nay cần hai tới ba lượt. Trong lúc chưa bắt kịp, kết quả vẫn đúng nhưng chậm như hiện nay.
- Sếp làm nóng sau khi triển khai: mở `/vault` ba lần, lần ba phải nhanh.
- Không đụng dữ liệu có sẵn; hai bảng mới tự tạo qua đường nâng lược đồ.

## 9. Rủi ro và giới hạn

- Reorg sâu hơn C block sau khi đã lưu: bảng giữ sự kiện của nhánh bị bỏ. C = 12 là đánh đổi cho PoC; ghi vào UserGuide và tech-report. Cách sửa: xoá các dòng `ChainEvent` và dòng `IndexerCursor` của chain đó, lần đọc sau dựng lại từ block triển khai. Hai bảng chỉ là bộ nhớ đệm nên xoá không mất dữ liệu nghiệp vụ, nhưng đây là thao tác sự cố trên production: chỉ làm khi Sếp quyết, ghi vào runbook, không viết thành chức năng.
- RPC log (publicnode) có thể đi sau RPC chính: `head` lấy từ RPC log. Đường biên nhận HF-04 vẫn bù cho chốt kỳ vừa gửi.
- `anchor` lưu theo isolate: nút Hardhat reset mà tiến trình ứng dụng không khởi động lại thì isolate cũ còn giữ `anchor` cũ. Chỉ xảy ra khi dev reset tay giữa chừng; khởi động lại dev server là đủ.
