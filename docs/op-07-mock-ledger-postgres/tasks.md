# OP-07: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/op-07-mock-ledger-postgres/requirements.md`,
> `app/src/lib/ledger/mock.adapter.ts`, `app/src/lib/ledger/index.ts`, `app/src/lib/store/postgres.pool.ts`
> (PR #49: kết nối theo request), `app/test/mock-ledger.test.ts`.
> Nhánh `ops/07-mock-ledger-pg` từ `dev` @ `615c7ef`. Commit đầu chuyển `OP-07` sang `inProgress`
> (thêm vào `.kiro/task-status.json` nếu chưa có).

## Bước 0: Đo lại

Chạy các lệnh ở "Hiện trạng đã đo". Tái hiện lỗi hồi quy trước khi sửa: hai thể hiện ledger mock (mô
phỏng bằng cách xoá trạng thái bộ nhớ giữa hai bước) với Postgres cho dữ liệu nghiệp vụ; whitelist ở bước
một, duyệt Mint ở bước hai báo ví chưa whitelist. Dán đầu ra.

## Bước 1: Cổng kho trạng thái và kho bộ nhớ (QĐ-1)

Refactor để mỗi hàm `ILedgerPort` gọi đúng một `read` hoặc `mutate`. Chạy 59 ca cũ, phải xanh mà không
sửa nội dung ca nào. Nếu một ca buộc phải sửa, dừng lại hỏi Supervisor.

Commit: `refactor(op-07): tách trạng thái chain mock khỏi logic qua cổng kho`

## Bước 2: Kho Postgres (QĐ-2, QĐ-3)

Bảng `MockLedgerState`, `npm run db:sql`, mã hoá và giải mã có kiểm thử khứ hồi, kho Postgres, factory
không lùi âm thầm. Viết bộ kiểm thử hợp đồng chung chạy hai kho. Ca 1, 2, 3, 6, 8 trên Postgres thật.

Commit: `feat(op-07): lưu bền trạng thái chain mock trong Postgres có khoá dòng`

## Bước 3: Đột biến và hồi quy theo chain

Đột biến 9a, 9b, 9c, 9d, dán đầu ra đỏ rồi hoàn nguyên. Ca 4, 5 (hồi quy `Txn` theo chain). Ca 11, 12 (chế độ ngắt database, không pha trộn) và ca 13 (chạy bộ Playwright mặc định, dán số ca trước và sau).

## Bước 4: Runbook làm mới database và cache Hyperdrive (QĐ-6, QĐ-7)

Viết runbook trong `DEPLOYMENT.md`. Kiểm ca 10 trên Postgres cục bộ, dán đầu ra.
**Không** chạy trên production.

Commit: `docs(op-07): runbook làm mới database và tắt cache Hyperdrive`

## Bước 5: Đo kết nối, tài liệu, bàn giao

Đo số kết nối Postgres khi duyệt một Mint trên mock (Worker cục bộ, `log_connections=on`), ghi bảng.
Cập nhật tài liệu. Rồi:

```bash
bash scripts/run-local-all.sh
cd app && TEST_DATABASE_URL=<postgres cục bộ> npx vitest --run && cd ..
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1d ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_OP07.md`, mục 0 đối chiếu đủ **10** điều kiện; điều kiện trên bản deploy đánh 🔶
lúc mở PR.

## Bước 6: Sau merge **[Chủ dự án]**

Tắt cache Hyperdrive (nếu chưa làm), làm mới database theo runbook, mở web một lần cho ứng dụng tự dựng lại. Thử luồng ở điều kiện trên bản deploy, ghi request ID. Đạt thì chuyển 🔶 thành ✅ bằng commit bổ sung.
