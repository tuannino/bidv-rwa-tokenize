-- OP-05 QĐ-F: kiểm database CHỈ ĐỌC trước và sau khi chuyển sang database mới.
--
--   psql "<chuỗi kết nối, chỉ trên máy chạy>" -v chain=evm -v token=<ProjectToken trong addresses.json> \
--        -v ON_ERROR_STOP=1 -f scripts/op05-db-check.sql
--
-- Cả tệp nằm trong MỘT transaction READ ONLY rồi ROLLBACK: Postgres từ chối mọi câu ghi. Chỉ xuất số
-- đếm và cột định danh, không xuất dữ liệu người dùng. Tập trạng thái "chưa kết thúc" lấy từ mã, tệp
-- nguồn ghi ở từng dòng; `app/test/op-05-db-check-sql.test.ts` đối chiếu với hằng số trong mã.

BEGIN TRANSACTION READ ONLY;

-- Phần 1: bản ghi chưa kết thúc. Database cũ (bước 3): lưu làm lịch sử. Database mới (bước 11): mọi dòng 0.
SELECT 'PurchaseOrder' AS "bảng", count(*) AS "chưa kết thúc", string_agg("id", ', ') AS "mã"
  FROM "PurchaseOrder" WHERE "chain" = :'chain'
   AND "status" IN ('PLACED', 'CHECKING', 'EXECUTING')            -- nguồn: app/src/lib/bank/purchase.state.ts (ngoài TERMINAL_ORDER_STATUSES)
UNION ALL
SELECT 'TokenRequest', count(*), string_agg("id", ', ')
  FROM "TokenRequest" WHERE "chain" = :'chain'
   AND "status" IN ('PENDING', 'EXECUTING')                       -- nguồn: app/src/lib/store/token-request.store.port.ts
UNION ALL
SELECT 'Txn', count(*), string_agg("id", ', ')
  FROM "Txn" WHERE "chain" = :'chain'
   AND "status" IN ('PENDING')                                    -- nguồn: TxStatus trong app/prisma/schema.prisma
UNION ALL
SELECT 'DistributionPeriod', count(*), string_agg("periodKey", ', ')
  FROM "DistributionPeriod" WHERE "chain" = :'chain'
   AND ("status" IN ('OPENING', 'OPEN', 'DISTRIBUTING')           -- nguồn: ACTIVE_PERIOD_STATUSES, app/src/lib/store/distribution.store.port.ts
        OR "vaultCloseStatus" IN ('PENDING', 'SENT', 'CONFLICT')) -- nguồn: VAULT_CLOSE_STATUSES trừ DONE, cùng tệp
UNION ALL
SELECT 'DistributionPayout', count(*), string_agg(p."id", ', ')
  FROM "DistributionPayout" p JOIN "DistributionPeriod" d ON d."id" = p."periodId" WHERE d."chain" = :'chain'
   AND p."status" IN ('PENDING', 'SENT', 'FAILED')                -- nguồn: DISTRIBUTION_PAYOUT_STATUSES trừ PAID, EXPIRED, cùng tệp
UNION ALL
SELECT 'KeeperRun', count(*), string_agg("jobName" || ' ' || "periodKey", ', ')
  FROM "KeeperRun"                                                -- bảng không có cột chain: đếm mọi chain
 WHERE "status" IN ('RUNNING')                                    -- nguồn: app/src/lib/store/keeper.store.port.ts
UNION ALL
SELECT 'WithdrawRequest', count(*), string_agg("id", ', ')
  FROM "WithdrawRequest" WHERE "chain" = :'chain'
   AND "status" IN ('SENDING', 'SENT', 'NEEDS_REVIEW');           -- nguồn: WITHDRAW_STATUSES trừ WITHDRAW_TERMINAL_STATUSES, app/src/lib/store/vault.store.port.ts

-- Phần 2 (database mới, bước 11): dự án WPT trỏ đúng ProjectToken mới và chưa phát hành.
SELECT "tokenSymbol", "chain", "contractAddress",
       lower("contractAddress") = lower(:'token') AS "khớp address book",
       "issuedAt" IS NULL AS "chưa phát hành"
  FROM "Project" WHERE "tokenSymbol" = 'WPT' AND "chain" = :'chain';

-- Giá đã cấu hình (nếu có dòng) phải bằng `price()` của OrderSettlement đọc ở bước 6.
SELECT "key", "value" FROM "SystemConfig" WHERE "key" = 'wpt.issue_price_vnd.' || :'chain';

-- Bảng Role đủ dòng seed (bốn vai của app).
SELECT count(*) AS "số vai", string_agg("name", ', ' ORDER BY "name") AS "vai" FROM "Role";

ROLLBACK;
