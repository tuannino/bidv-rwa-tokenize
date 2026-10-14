# OP-06 bổ sung: giảm CPU của lớp kết nối Postgres trên Worker gói Free

| | |
|---|---|
| Nhánh | `ops/06-db-cpu`, từ `dev` @ `f673837` (PR #48) |
| Điểm | 2 |
| Mức kiểm chứng | **Cao** (đổi lớp kết nối dùng chung cho 8 cổng lưu trữ) |
| Hạn | **Nửa ngày làm việc.** Hết hạn mà điều kiện 6 không đạt thì dừng, chủ dự án nâng gói Workers Paid |
| Người làm | Codex. Chủ dự án đo trên bản deploy |

## Mục tiêu

Bản deploy (Cloudflare Workers gói Free, giới hạn **10 mili giây CPU mỗi request**) liên tục báo lỗi
1102 "Worker exceeded CPU time limit" từ khi bật Postgres. Chủ dự án thử đặt `USE_MOCK_DB=true` ngày
14/10 thì thao tác bình thường. Vậy **lớp kết nối Postgres là phần đẩy CPU vượt ngưỡng**.

Task này giảm số lần mở kết nối và số câu chạy lúc khởi động để bản deploy chạy được trên gói Free với
`USE_MOCK_DB=false`. Không đổi nghiệp vụ, không đổi chữ ký `pgQuery`, `pgTransaction`.

## Hiện trạng đã đo (Supervisor, `dev` @ `f673837`)

```bash
grep -n "export const pgQuery" -A8 app/src/lib/store/postgres.pool.ts
# moi lan goi pgQuery mo mot Client moi (withClient), dong ngay sau truy van
grep -n "async function ensureSchema" -A18 app/src/lib/store/postgres.pool.ts
# moi tien trinh moi: BEGIN, kiem danh muc, roi LUON chay seedInitialData (nhieu cau INSERT), COMMIT
grep -n "Promise.all" app/src/lib/bank/token-request.service.ts
# nhieu cho goi song song nhieu truy van, moi truy van mot ket noi rieng
grep -n "ENABLE_READ_DIAGNOSTICS" app/wrangler.json
# dang bat "true"
```

| # | Điểm tốn CPU | Hậu quả |
|---|---|---|
| C1 | Mỗi `pgQuery` mở một `Client` mới. Một trang như `/draft` chạy nhiều truy vấn nên mở nhiều kết nối, mỗi kết nối phải bắt tay và xác thực (có thể là SCRAM, tính toán nặng) | CPU tăng theo số truy vấn; còn có thể chạm giới hạn 6 kết nối đồng thời mỗi request của Hyperdrive gói Free khi gọi song song |
| C2 | `ensureSchema` ở mỗi tiến trình mới luôn mở transaction và chạy toàn bộ seed, kể cả khi lược đồ và dữ liệu khởi tạo đã đủ | Thêm một kết nối và nhiều câu lệnh vào đúng request khởi động lạnh, vốn đã nặng nhất |
| C3 | Nhật ký đo `op06.read` đang bật | Thêm việc ghi log mỗi bước; nhỏ nhưng không cần nữa |

## Quyết định thiết kế

**QĐ-1. Mỗi request dùng chung MỘT kết nối cho các truy vấn đọc ghi lẻ (`pgQuery`).**
- Trên Worker: gắn kết nối với **request hiện tại**. Khoá là đối tượng ngữ cảnh riêng của request lấy
  từ `getCloudflareContext()` (ví dụ `ctx`, người làm kiểm đối tượng nào thật sự khác nhau giữa các
  request và ghi bằng chứng). Lưu trong `WeakMap`, không giữ ở phạm vi toàn cục theo kiểu dùng xuyên
  request (vẫn đúng luật Cloudflare: không dùng I/O của request này cho request khác).
- Nhiều `pgQuery` song song trong cùng request dùng chung kết nối đó; `pg` tự xếp hàng câu lệnh.
- Kết nối lỗi (mất kết nối, lỗi giao thức) thì bỏ khỏi `WeakMap` để lượt sau mở lại; không nuốt lỗi.
- **Đóng kết nối:** người làm tìm và chứng minh cách đóng an toàn khi request kết thúc (ví dụ
  `ctx.waitUntil`, hoặc để runtime tự huỷ I/O khi request xong). Bắt buộc có bằng chứng không rò kết
  nối (điều kiện 5). Không được để kết nối sống sang request khác.
- Ngoài Worker (Node, Vitest, Docker) không có ngữ cảnh request: giữ hành vi hiện tại, mỗi lời gọi một
  kết nối. Bộ kiểm thử hiện có không phải đổi.

**QĐ-2. `pgTransaction` giữ kết nối RIÊNG như hiện nay.** Không chạy transaction trên kết nối dùng
chung, vì `pgQuery` song song của cùng request sẽ lọt vào giữa `BEGIN` và `COMMIT`.

**QĐ-3. Khởi tạo: đường nhanh không mở transaction, không chạy seed khi đã đủ.**
- Đường nhanh (đa số tiến trình): trên kết nối dùng chung của request, chạy kiểm danh mục hiện có
  (`schemaObjectsReady`) và **một** truy vấn kiểm dữ liệu khởi tạo đã đủ (đủ khoá `SystemConfig`, đủ
  `Role`, mỗi dự án seed đã có dòng và địa chỉ hợp đồng đúng hoặc dự án đã phát hành, đúng điều kiện
  QĐ-6 của OP-06). Cả hai đúng thì xong, không `BEGIN`, không `INSERT`.
- Đường chậm (thiếu lược đồ hoặc thiếu dữ liệu khởi tạo): giữ nguyên logic hiện tại (kết nối riêng,
  `BEGIN`, khoá tư vấn, DDL nếu cần, seed, `COMMIT`).
- Trong cùng một request, nhiều `pgQuery` song song chỉ chạy khởi tạo **một lần** (ghi nhớ theo
  request, được phép vì cùng request). Giữa các request vẫn giữ luật của commit `403588f`: chỉ ghi nhớ
  trạng thái **đã khởi tạo xong**, không chờ phép khởi tạo của request khác.

**QĐ-4. Tắt nhật ký đo** `ENABLE_READ_DIAGNOSTICS` trong `wrangler.json` (đặt `"false"`). Giữ mã đo để
bật lại khi cần.

## Việc cần làm

1. Hiện thực QĐ-1, QĐ-2 trong `app/src/lib/store/postgres.pool.ts`. Không sửa 8 tệp `postgres.*.store.ts`.
2. Hiện thực QĐ-3: hàm kiểm dữ liệu khởi tạo bằng một truy vấn, tách đường nhanh và đường chậm.
3. QĐ-4 trong `wrangler.json`. `USE_MOCK_DB` trong `wrangler.json` giữ `"false"` (chủ dự án đang tạm
   đặt `true` trên dashboard; lần deploy sau merge sẽ trả về `false`, đúng ý đồ).
4. **Đo trước và sau trên Worker cục bộ** (`npm run cf:build`, `wrangler dev`, Postgres cục bộ bật
   `log_connections=on` hoặc đếm qua `pg_stat_activity`): số kết nối mở ra khi tải `/draft` một lần,
   khi tra cứu WPT ở `/api/token-info`, và khi duyệt một yêu cầu Mint trên `hardhat-local`. Ghi bảng
   trước và sau vào checkpoint, dán nguyên văn log đếm.
5. Kiểm không rò kết nối: tải `/draft` 30 lần liên tiếp rồi đếm kết nối còn mở trên Postgres cục bộ sau
   khi dừng; phải về mức nền (không tăng theo số lần tải).
6. Cập nhật `docs/DEPLOYMENT.md` (mục cơ sở dữ liệu: một kết nối mỗi request, transaction kết nối
   riêng, giới hạn CPU gói Free) và `docs/tech-report.md`.
7. Ghi VĐ mới vào checkpoint: nguyên nhân lỗi 1102 sau OP-06 và số đo trước, sau.

## Ràng buộc

- Không đổi chữ ký `pgQuery`, `pgTransaction`, không đổi lược đồ, không thêm thư viện.
- Không giữ kết nối ở phạm vi toàn cục dùng chung giữa các request.
- Không đổi nghiệp vụ, hợp đồng, adapter, signer.
- Checkpoint dán nguyên văn đầu ra lệnh đã chạy (`efficiency.md`).

## Mức kiểm chứng: Cao

| Ca | Kiểm |
|---|---|
| 1 | Đơn vị (giả lập `pg` và ngữ cảnh request): trong một request, 5 `pgQuery` song song chỉ tạo **1** `Client`; hai request khác nhau tạo hai `Client` khác nhau |
| 2 | Đơn vị: `pgTransaction` luôn tạo `Client` riêng, không dùng kết nối chung; `pgQuery` song song không lọt vào transaction |
| 3 | Đơn vị: kết nối chung lỗi thì lượt sau mở kết nối mới |
| 4 | Đơn vị: lược đồ và dữ liệu khởi tạo đủ thì không có `BEGIN` và không có `INSERT`; thiếu dữ liệu khởi tạo thì chạy đường chậm |
| 5 | Ca cũ trong `postgres-init-isolation.test.ts` vẫn xanh (A chưa xong thì B vẫn chạy độc lập) |
| 6 | Đột biến: (a) trả lại "mỗi `pgQuery` một `Client`" thì ca 1 đỏ; (b) bỏ kiểm dữ liệu khởi tạo, luôn seed, thì ca 4 đỏ |
| 7 | Postgres thật: bộ ràng buộc 186 ca và seed xanh |
| 8 | Worker cục bộ: bảng đếm kết nối trước, sau (việc 4) và kiểm rò (việc 5) |

## Điều kiện hoàn thành

- [ ] Trên Worker, mỗi request dùng một kết nối cho `pgQuery`; transaction dùng kết nối riêng (ca 1, 2, 3).
- [ ] Khởi tạo đường nhanh không `BEGIN`, không `INSERT` khi đã đủ; đường chậm giữ nguyên (ca 4).
- [ ] Luật không chờ khởi tạo của request khác vẫn giữ (ca 5).
- [ ] Đột biến đỏ đúng ca (ca 6).
- [ ] Không rò kết nối, có bảng đếm trước và sau trên Worker cục bộ (ca 8).
- [ ] **[Chủ dự án, sau merge]** Bản deploy với `USE_MOCK_DB=false`: CPU P50, P90 gần mức khi thử `USE_MOCK_DB=true` ngày 14/10, không còn 1102 khi thao tác bình thường 15 phút; có ảnh biểu đồ CPU trước và sau.
- [ ] `ENABLE_READ_DIAGNOSTICS` tắt; tài liệu cập nhật.
- [ ] Bộ mặc định, bộ Postgres thật xanh; không có bí mật trong lịch sử commit.

## Không làm

- Không tối ưu phần dựng trang Next.js, không đổi kiến trúc (cách B, C đã bàn).
- Không đổi nhà cung cấp hay cấu hình Hyperdrive.
- Không làm phần kiểm Mint/Burn còn lại của OP-06 (làm sau khi bản deploy ổn định).
