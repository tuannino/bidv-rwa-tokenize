# OP-06: các bước

> Trước khi bắt đầu: đọc `.kiro/steering/efficiency.md` (checkpoint dán nguyên văn đầu ra lệnh đã chạy),
> `docs/op-06-cloudflare-db/requirements.md`, `app/src/lib/store/postgres.pool.ts`,
> `executeIssuance` trong `app/src/lib/bank/issuance.service.ts`, `test/issuance-service.test.ts` ca
> "chuỗi đã phát hành mà bảng dự án chưa ghi mốc".
> Nhánh `ops/06-cloudflare-db` từ `dev` @ `182b9b1`.
> Cần Postgres cục bộ (`docker compose up db` hoặc tương đương) để chạy bộ ràng buộc với
> `TEST_DATABASE_URL`.

## Bước 0: Đo lại và trạng thái

1. Chạy các lệnh ở "Hiện trạng đã đo". Số đo khác spec thì dùng số đo thật.
2. Đo thời gian bộ ràng buộc Postgres **trước khi sửa**:

```bash
cd app && time TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest --run test/store-constraints.test.ts
```

3. Việc 11: `OP-04` sang `done`, `OP-06` sang `inProgress`.

Commit: `chore(op-06): nhận task, đóng OP-04 theo nghiệm thu 08/10`

## Bước 1: Lược đồ nhúng (QĐ-3)

Viết kiểm thử trùng byte trước, cho đỏ, rồi viết script sinh và tệp sinh. Sửa `db:sql` sinh cả hai.
Bỏ `readFile`, `path`, `process.cwd` khỏi `postgres.pool.ts`. Chạy đột biến ca 2 và dán đầu ra.

Commit: `feat(op-06): nhúng lược đồ init.sql vào mã, bỏ đọc tệp lúc chạy`

## Bước 2: Kết nối mỗi lời gọi một Client (QĐ-1, QĐ-2)

Sửa `holder()`: không giữ `Pool`; theo QĐ-3 cập nhật 09/10, chỉ cache khởi tạo đã hoàn tất theo
chuỗi kết nối, không giữ Promise đang chạy. Lỗi không xoá thành công của lượt khác.
Hàm lấy chuỗi kết nối theo QĐ-2. `pgQuery`, `pgTransaction` mở và đóng `Client` trong `try/finally`.
Đóng `Client` cả khi truy vấn lỗi. Chạy lại bộ ràng buộc, ghi thời gian sau; quá 2 lần thì dừng hỏi.

Commit: `fix(op-06): kết nối Postgres theo từng lời gọi, hỗ trợ Hyperdrive`

## Bước 3: Đối soát mốc phát hành (QĐ-5) và seed (QĐ-6)

1. Sửa ca kiểm thử cũ thành ba ca (a), (b), (c) của việc 3, cho đỏ, rồi sửa `executeIssuance`.
2. Ca (a) chạy thêm trên `hardhat-local`: triển khai, `mintInitialSupply` bằng script, xoá trạng thái bộ
   nhớ của ứng dụng (`resetMemoryStore`), rồi duyệt một Mint, phải ra giao dịch `mint`.
3. Đột biến ca 3: khôi phục chốt cũ, ca (a) phải đỏ; dán đầu ra.
4. Seed QĐ-6 và kiểm thử trên Postgres thật.

Commit: `fix(op-06): đối soát mốc phát hành từ chuỗi thay vì chặn mãi; seed cập nhật địa chỉ`

## Bước 4: Cấu hình và Worker cục bộ

1. **[Chủ dự án]** Việc 8: tạo Neon và Hyperdrive, gửi id Hyperdrive. Trong lúc chờ, dùng id giả
   trong một nhánh nháp cục bộ, **không commit id giả**.
2. Việc 5: `wrangler.json` theo QĐ-4.
3. Việc 6: dựng bằng `npm run cf:build`, chạy Worker cục bộ trỏ Postgres cục bộ, làm đủ (a), (b), (c);
   dán lệnh và log nguyên văn (cắt bớt phần lặp, ghi rõ chỗ cắt).
4. Việc 7: đo V3 trên bản deploy hiện có. Chỉ thêm và xoá một biến thử vô hại (ví dụ
   `OP06_PROBE=1`), không đụng biến đang dùng.

Commit: `chore(op-06): cấu hình Worker dùng Postgres qua Hyperdrive`

## Bước 5: Tài liệu và bàn giao

Việc 10 và việc 12 (đổi tên nhà máy, commit riêng `chore(op-06): đổi danh sách nhà máy điện gió`). Rồi:

```bash
bash scripts/run-local-all.sh
cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npx vitest --run test/store-constraints.test.ts && cd ..
grep -rnE "@neondatabase|@supabase|supabase-js|neon\\.tech" app/src app/package.json || echo "không gắn nhà cung cấp"
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}|infura.io/v3/[0-9a-f]{20,}|alchemy.com/v2/[A-Za-z0-9_-]{20,}" || echo "không có bí mật"
```

Lệnh thứ ba kiểm QĐ-7. Lệnh thứ tư bắt chuỗi kết nối có mật khẩu trỏ tới máy khác `localhost` (chuỗi `bidv:bidv@db:5432`
của docker là ngoại lệ đã có; nếu bị bắt thì ghi rõ). Viết `docs/CHECKPOINT_OP06.md`, mục 0 đối chiếu
đủ **10** điều kiện. Điều kiện 7 (bản deploy) đánh 🔶 lúc mở PR.

```bash
node scripts/check-checkpoint.mjs docs/CHECKPOINT_OP06.md docs/op-06-cloudflare-db/requirements.md
```

## Bước 6: Sau merge **[Chủ dự án chạy, người làm ghi]**

Việc 9 trên bản deploy. Ghi kết quả vào checkpoint bằng một commit bổ sung, điều kiện 7 chuyển ✅,
`OP-06` sang `done`. Hỏng thì ghi nguyên văn lỗi, giữ `inProgress`, báo Supervisor.


## Bổ sung Owner ngày 09/10/2026: timeout trên giao diện

Owner cho phép tiếp tục commit/debug trên `ops/06-cloudflare-db` và thu thông tin để xử lý timeout.
Tra cứu token được tách khỏi hàng chờ Server Actions bằng GET, giữ service kiểm quyền; hủy fetch
cũ, báo đúng timeout/lỗi mạng và cho thử lại giữ biểu mẫu. Trace chỉ ghi id, bước, thời gian,
SQLSTATE; không ghi URL/SQL/payload/bí mật. Một lượt đọc dùng chung kết quả SPV.
Tác động bổ sung: `draft.tsx`, `token-info-read.ts`, `api/token-info/route.ts`,
`diagnostics/read-trace.ts`, config và các điểm đọc DB/RPC trong service/store.
Kiểm chức năng client/route, giao diện chỉ đọc, PostgreSQL thật và build Worker local.
Giữ điều kiện hoàn thành gốc; chưa đóng task khi chưa có bằng chứng deploy mới.
Bằng chứng ở checkpoint mục 6 và `CHECKPOINT_OP06_TIMEOUT_DETAIL.md`.


### Bổ sung VĐ-45 được Owner duyệt ngày 09/10/2026

Bỏ Promise khởi tạo dùng chung, chỉ ghi nhớ thành công sau COMMIT/đóng Client. Giả lập `pg` trong
kiểm thử để giữ A chưa xong và cho B hoàn tất độc lập; không thêm env hay nhánh code test vào
production. Kiểm lỗi/retry, A lỗi muộn, cache theo connection string và trace `db.schema.verify`.
Đột biến khôi phục Promise chung phải đỏ; hoàn nguyên rồi kiểm xanh, Postgres thật và bộ mặc định.
Cập nhật QĐ-3, guide, tech-report, checkpoint và PR #47. Bàn giao ghi rõ giảm rủi ro lan lỗi giữa
request, chưa xác nhận đã hết timeout. Giữ log bật tới khi có số đo production; OP-06 vẫn inProgress.


### Bổ sung Owner: lưu log và mã lỗi HTTP/CF-Ray

Bật observability/logs persist trong Wrangler, lấy mẫu 1 trong thời gian debug. Màn tra cứu WPT
phân biệt lỗi HTTP máy chủ (kể cả HTML của Cloudflare), quá hạn và mất kết nối; hiện status/cf-ray
khi headers đã nhận, không dựng mã giả nếu chưa có response. Giữ Mã tra cứu và biểu mẫu/thử lại.
Kiểm helper đọc và toàn bộ bộ mặc định; ghi đầu ra nguyên văn vào checkpoint mục 8.
