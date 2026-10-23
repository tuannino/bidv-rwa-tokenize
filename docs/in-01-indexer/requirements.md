# IN-01: Indexer gọn (A-gọn), yêu cầu (bản 2)

Nền: `dev` @ `2fbdde8`. Người viết: giám sát. Quyết định phạm vi: Sếp chốt phương án A-gọn (23/10/2026).

Bản 2 (24/10) sửa theo phản biện: danh sách ví cho chia lợi nhuận đúng theo snapshot; đặt lại cursor khi đổi địa chỉ kể cả khi cursor đã bắt kịp; lease có rào owner và gia hạn theo đoạn; nhận diện nút Hardhat reset; thứ tự và giới hạn danh sách ví; tách lấy log và lấy mốc thời gian.

## 1. Bối cảnh

- Năm chỗ đọc sự kiện trong `evm.adapter.ts` quét từ block triển khai (`deployBlock` 11959727) tới block mới nhất, mỗi đoạn 10.000 block, không lưu lại gì:
  - `vaultConfigEvents` (lịch sử cấu hình vault), `vaultPeriodCloses` và `findVaultPeriodClose` (qua `readPeriodCloses`), `findVaultWithdrawals` (từ `claimedBlock`, đối soát lệnh rút), `findOrderSettlement` (quét lùi từng đoạn 5.000 block tới block triển khai).
- Số lời gọi `eth_getLogs` tăng tuyến tính theo tuổi chuỗi: khoảng 43 lời gọi mỗi lần quét vào 19/12, và `/vault` quét hai lần mỗi lần mở.
- Danh sách người nhận chia lợi nhuận dựng từ cơ sở dữ liệu nên bỏ sót ví nhận WPT bằng chuyển trực tiếp (giới hạn ghi ở `collectRecipients`, hẹn IN-01 đóng). BE-05 (thu hồi tất toán) cũng cần danh sách người đang nắm WPT.

## 2. Mục tiêu

1. Không còn lần đọc nào quét từ block triển khai sau khi Indexer đã bắt kịp.
2. Kết quả mọi hàm đọc sự kiện giữ nguyên như hiện nay (cùng dữ liệu, cùng thứ tự, cùng mốc thời gian), kể cả sự kiện vừa phát ra.
3. Có danh sách mọi ví từng nắm WPT lấy từ chuỗi, dùng cho chia lợi nhuận ngay và cho BE-05 sau này.
4. Không thêm hạ tầng: không cron, không Queue, không dịch vụ riêng; chỉ thêm hai bảng Postgres.

## 3. Quyết định

- **QĐ-IN1: hai bảng.** `ChainEvent` (sự kiện đã xác nhận) và `IndexerCursor` (đã lưu tới block nào, ai đang đồng bộ). Không thêm bảng số dư; số dư tính từ `ChainEvent` khi đọc.
- **QĐ-IN2: đồng bộ theo nhu cầu.** Mỗi lần một hàm đọc sự kiện được gọi trên chain EVM, Indexer đồng bộ phần còn thiếu rồi mới đọc. Không chạy theo lịch (nợ kỹ thuật).
- **QĐ-IN3: chỉ lưu block đã đủ xác nhận.** Chỉ lưu tới `max(deployBlock trừ 1, head trừ INDEXER_CONFIRMATIONS)` (mặc định 12). Phần đuôi chưa đủ xác nhận đọc thẳng từ chuỗi ở mỗi lần đọc, dùng xong bỏ, không lưu.
- **QĐ-IN4: khoá bằng lease trên dòng cursor**, không dùng advisory lock (Hyperdrive gom kết nối nên khoá theo phiên không tin được; khoá theo transaction buộc giữ transaction mở trong lúc gọi RPC).
  - Lấy, gia hạn, trả lease đều có điều kiện `leaseOwner = owner`; tiến cursor có thêm điều kiện `lastBlock = giá trị cũ`.
  - Đồng bộ theo đoạn; mỗi đoạn commit riêng và gia hạn lease, nên lượt dài không bị chen giữa chừng.
  - Ai không lấy được lease thì không đồng bộ, vẫn đọc đủ (bảng cộng phần còn thiếu đọc thẳng).
- **QĐ-IN5: phạm vi sự kiện.** Mọi sự kiện của hai hợp đồng: `SpvPaymentVault` và `ProjectToken` (WPT). Hợp đồng khác ngoài phạm vi.
- **QĐ-IN6: giữ chữ ký `ILedgerPort`.** Năm hàm đọc sự kiện giữ nguyên chữ ký nên tầng nghiệp vụ không đổi. Adapter EVM đọc qua Indexer thay vì tự quét. Thêm đúng một hàm cổng: `listTokenWallets()` trả mọi ví từng gửi hoặc nhận WPT kèm số dư hiện tại (có thể bằng 0), sắp theo ví, có cờ `truncated`.
- **QĐ-IN7: chain mô phỏng giữ nguyên** cách hiện thực trong bộ nhớ; `listTokenWallets` của mock đọc bảng số dư mô phỏng.
- **QĐ-IN8: dữ liệu Indexer là bộ nhớ đệm có thể dựng lại, gắn với một phạm vi `(anchor, vault, token)`.** `anchor` là mã băm của block triển khai, nên triển khai lại hoặc nút Hardhat reset đều đổi phạm vi. Mọi lần đọc kiểm phạm vi trước tiên; phạm vi khác thì đặt lại cursor về block triển khai, kể cả khi cursor cũ đã bắt kịp. Dòng cũ không xoá; mọi truy vấn lọc theo phạm vi hiện hành.

## 4. Ngoài phạm vi (nợ kỹ thuật)

- Đồng bộ theo lịch (Cron Trigger), IN-02 (phát hiện tiền vào quỹ bằng sự kiện), theo dõi giao dịch gửi qua Fireblocks (IN-03).
- Reorg sâu hơn `INDEXER_CONFIRMATIONS` block: không xử lý; ghi giới hạn vào UserGuide.
- Màn quản trị Indexer, nút đồng bộ tay, phân trang danh sách ví (PoC dùng giới hạn 5.000 như danh sách người nhận hiện có).
- Lịch sử sự kiện VNDB, phân phối lợi nhuận, khớp lệnh.

## 5. Yêu cầu chức năng

- **R1. Bảng.** Thêm `ChainEvent`, `IndexerCursor` vào `schema.prisma`, sinh lại `init.sql` và `init-sql.generated.ts` (`npm run db:sql`). Cơ sở dữ liệu đang chạy tự có bảng mới qua đường nâng lược đồ sẵn có; không reset, không xoá dữ liệu.
- **R2. Đồng bộ.** `syncSegments` lưu sự kiện của hai hợp đồng từ `cursor + 1` tới đích (QĐ-IN3), mỗi đoạn tối đa `INDEXER_SEGMENT_BLOCKS` block, mỗi lượt tối đa `INDEXER_MAX_BLOCKS_PER_SYNC` block. Mốc thời gian của block có sự kiện lấy trước khi ghi. Mỗi đoạn ghi sự kiện và tiến cursor trong cùng một transaction. Chạy lại không sinh dòng trùng.
- **R3. Đọc đủ.** Mọi lần đọc trả hợp của: sự kiện trong bảng (tới cursor, cùng phạm vi) và sự kiện đọc thẳng từ `cursor + 1` tới block mới nhất. Bình thường đoạn đọc thẳng chỉ khoảng C block; khi Indexer còn chậm (vừa triển khai, lease đang bận, phạm vi vừa đổi mà không lấy được lease) thì đoạn này dài hơn và được quét theo đoạn như hiện nay, kết quả vẫn đúng.
- **R4. Năm hàm đọc sự kiện** của adapter EVM đổi sang R3, giữ nguyên chữ ký và kết quả:
  - `vaultConfigEvents(filter)`, `vaultPeriodCloses(limit)`, `findVaultPeriodClose(periodRef, hintTxHash)` (giữ đường biên nhận của HF-04), `findVaultWithdrawals(filter)`, `findOrderSettlement(orderId)` (giữ bước `isOrderSettled` trước).
  - `vaultWithdrawalReceipt` không đổi.
- **R5. Danh sách ví WPT.** `listTokenWallets()` trả `{ wallets: [{ wallet, balance }], truncated, asOfBlock }`: mọi ví từng là bên gửi hoặc bên nhận `Transfer` (bỏ địa chỉ 0), số dư tính từ sự kiện gồm mint, chuyển, đốt (kể cả `burn` cưỡng chế của AGENT), cộng phần đuôi chưa xác nhận. Sắp theo ví (chữ thường). Giới hạn `MAX_RECIPIENT_SCAN`; vượt thì `truncated = true`.
- **R6. Chia lợi nhuận.** `collectRecipients` thêm nguồn thứ tư: toàn bộ ví từ `listTokenWallets()` (KHÔNG lọc số dư hiện tại). Ba nguồn cũ giữ nguyên. `truncated` của kết quả bật khi bất kỳ nguồn nào bị cắt, kể cả nguồn 4. Số tiền chia vẫn tính bằng `balanceOfAt` tại snapshot như cũ.
- **R7. Cấu hình** qua `env.ts`: `INDEXER_CONFIRMATIONS` (12), `INDEXER_SEGMENT_BLOCKS` (50000), `INDEXER_MAX_BLOCKS_PER_SYNC` (200000), `INDEXER_LEASE_SECONDS` (60). Bỏ `ORDER_SETTLEMENT_EVENT_BLOCK_CHUNK` nếu không còn chỗ dùng (cập nhật `.env.example` và wrangler).
- **R8. Lỗi.**
  - Lỗi của nguồn chuỗi (`fetchLogs`, `timestamps`) trong lúc đồng bộ: dừng lượt đồng bộ, trả lease, đọc theo R3.
  - Lỗi RPC ở phần đọc thẳng: `LedgerError` như hiện nay.
  - Lỗi cơ sở dữ liệu (`readCursor`, `claimLease`, `commitSegment`, `listEvents`, `tokenWallets`): ném ra như mọi chỗ khác, không lùi về quét từ block triển khai.

## 6. Hiệu năng (điều kiện nghiệm thu)

- Số server action khi mở `/vault`, `/vault` lịch sử cấu hình, `/distribution`, `/seller/withdraw` không tăng so với nền.
- Sau khi Indexer bắt kịp, một lần gọi bất kỳ hàm ở R4 hoặc `listTokenWallets` gây tối đa: 1 `eth_blockNumber`, 1 `eth_getLogs` (đoạn đồng bộ nhỏ gộp với phần đuôi), và `eth_getBlock` chỉ cho block có sự kiện cần lưu hoặc cần trả mốc thời gian. Không lời gọi `eth_getLogs` nào bắt đầu từ block triển khai. Mã băm block triển khai đọc một lần mỗi isolate.
- Lần đọc không ghi sổ kiểm toán. Ghi `ChainEvent` và `IndexerCursor` trong lúc đọc được phép (là bộ nhớ đệm, không phải sổ).
- Một đoạn `INDEXER_SEGMENT_BLOCKS` trên Sepolia phải xong dưới một nửa `INDEXER_LEASE_SECONDS`; ghi số đo vào checkpoint.
- Ghi số đo trước và sau vào checkpoint (bước 1 và bước cuối ở `tasks.md`).

## 7. Ca kiểm

Hardhat (`test/evm-indexer.test.ts`, mới) trừ khi ghi khác; vitest đơn vị dùng kho bộ nhớ và nguồn log giả (`test/indexer-sync.test.ts`, mới). Ca dán nhãn (đơn vị) chạy cả với kho Postgres nếu bộ test hiện có chạy được Postgres cục bộ.

| Ca | Nội dung | Kỳ vọng |
|---|---|---|
| 1 | Đồng bộ lần đầu, chạy lại lần hai | Cursor bằng `head trừ C`; số dòng không đổi ở lần hai |
| 2 | Sự kiện nằm trong C block cuối | Có trong kết quả đọc, không có trong bảng; đào thêm C block rồi đọc lại thì có trong bảng, kết quả không đổi |
| 3 | Hai lượt đồng bộ cùng lúc (đơn vị) | Chỉ một lượt gọi nguồn log cho đoạn đó; kết quả hai lần đọc như nhau; không dòng trùng |
| 4 | Lease hết hạn (người giữ chết giữa chừng, đơn vị) | Lượt sau lấy được lease, đồng bộ tiếp từ cursor cũ |
| 5 | Khoảng thiếu lớn hơn `INDEXER_MAX_BLOCKS_PER_SYNC` (đơn vị) | Cursor tiến đúng số tối đa; kết quả đọc vẫn đủ |
| 6 | Cursor cũ ĐÃ bắt kịp, đổi địa chỉ vault sang hợp đồng triển khai từ trước, không có block mới (đơn vị) | Lần đọc đầu tiên đặt lại cursor về block triển khai mới và trả đủ lịch sử của hợp đồng mới; không sự kiện nào của địa chỉ cũ |
| 7 | Lịch sử cấu hình vault: đặt chế độ khoá, khoá cố định, tỷ lệ, ví nhận | `vaultConfigEvents` trùng từng trường với bản chụp từ mã cũ ở bước 1, cả mốc thời gian |
| 8 | `vaultPeriodCloses(10)` sau ba lần chốt kỳ | Mới nhất trước, có mốc thời gian, tối đa 10 |
| 9 | `findVaultPeriodClose`: sự kiện trong bảng; trong phần đuôi; RPC log chậm có `hintTxHash` | Tìm thấy cả ba; ca HF-04 cũ vẫn xanh |
| 10 | `findVaultWithdrawals` lọc `fromBlock`, `to`, `amount` | Đúng tập sự kiện; các ca đối soát lệnh rút cũ vẫn xanh |
| 11 | `findOrderSettlement`: lệnh khớp cũ (trong bảng), lệnh vừa khớp (phần đuôi), lệnh chưa khớp | `SETTLED` có đúng mã giao dịch; `SETTLED`; `NOT_SETTLED` |
| 12 | `listTokenWallets` sau: phát hành, mua, chuyển giữa hai nhà đầu tư, AGENT đốt hết một ví | Số dư từng ví trùng `balanceOf`; ví bị đốt hết VẪN có trong danh sách với số dư 0; danh sách sắp theo ví |
| 13 | `collectRecipients` với ví nhận WPT bằng chuyển trực tiếp, không có lệnh mua (vitest) | Ví đó có trong danh sách |
| 14 | Đếm lời gọi RPC (transport đếm) sau khi bắt kịp | Đúng giới hạn ở mục 6; không `eth_getLogs` nào có `fromBlock` bằng block triển khai |
| 15 | Mock: `listTokenWallets` (vitest) | Trả các ví trong trạng thái mô phỏng, sắp theo ví |
| 16 | Ví A nhận WPT bằng chuyển trực tiếp; chụp snapshot; A chuyển hết cho B; lập hồ sơ chia (Hardhat, hoặc vitest với ledger mock nếu dựng kỳ chia trên Hardhat quá nặng) | A có trong danh sách người nhận và nhận đúng phần theo `balanceOfAt` tại snapshot; B nhận 0 cho kỳ đó |
| 17 | Chủ A hết lease, B lấy lease, A gọi `releaseLease` rồi `commitSegment` (đơn vị) | Lease của B còn nguyên; commit của A trả `false`, cursor không đổi |
| 18 | Lượt đồng bộ ba đoạn, lease ngắn hơn tổng thời gian ba đoạn nhưng dài hơn một đoạn (đơn vị, đồng hồ giả) | Lượt khác không lấy được lease giữa chừng; cursor tiến hết ba đoạn |
| 19 | Nút Hardhat reset, triển khai lại cùng địa chỉ tất định, cùng kho dữ liệu (đơn vị với `scope()` giả đổi `anchor`; Hardhat nếu khởi động lại được trong test) | Cursor đặt lại; sự kiện của phiên bản cũ không xuất hiện |
| 20 | Nguồn 4 vượt giới hạn (đơn vị, giới hạn nhỏ qua tham số test) | `collectRecipients` trả `truncated = true` và lỗi cắt danh sách như hiện có |
| 21 | Lỗi `fetchLogs` khi đồng bộ; lỗi `listEvents` (đơn vị) | Lỗi nguồn: lease được trả, kết quả đọc vẫn đủ; lỗi kho: ném ra, không quét từ block triển khai |

## 8. Đột biến (mỗi đột biến làm ít nhất một ca đỏ)

- Lưu cả phần đuôi chưa đủ xác nhận vào bảng (ca 2).
- Bỏ điều kiện `lastBlock = expected` khi tiến cursor (ca 3 hoặc 17).
- Bỏ điều kiện owner trong `releaseLease` (ca 17).
- Chỉ kiểm phạm vi khi cursor chưa bắt kịp (ca 6).
- Bỏ `anchor` khỏi điều kiện truy vấn (ca 19).
- Lọc `balance > 0` trong `listTokenWallets` hoặc ở nguồn 4 (ca 12 hoặc 16).
- Bỏ qua `Transfer` về địa chỉ 0 khi tính số dư (ca 12).
- Chỉ đọc bảng, không đọc phần từ cursor tới block mới nhất (ca 2 hoặc 5).

## 9. Điều kiện hoàn thành

- [ ] Có hai bảng cache và đủ hai hiện thực kho; nâng lược đồ không xoá dữ liệu có sẵn.
- [ ] Đồng bộ theo đoạn, giới hạn mỗi lượt, lease có owner fence/CAS/gia hạn và ghi idempotent.
- [ ] Năm hàm lịch sử EVM đọc bảng cộng live tail, giữ chữ ký/kết quả và đường biên nhận HF-04.
- [ ] `listTokenWallets` đúng mint/chuyển/đốt, giữ ví số dư 0, sắp ổn định và báo `truncated`.
- [ ] Chia lợi nhuận dùng nguồn ví thứ tư mà không lọc số dư hiện tại; mock/Stellar đúng quyết định.
- [ ] Bốn biến Indexer có mặc định; biến quét lệnh cũ được gỡ khỏi mã, env mẫu và Wrangler.
- [ ] Kiểm chứng đơn vị, Hardhat, hồi quy, luật kiến trúc và phép đo lease/RPC đạt yêu cầu.
- [ ] UserGuide, tech-report, runbook, checkpoint và trạng thái task được cập nhật.
