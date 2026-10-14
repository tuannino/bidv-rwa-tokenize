# OP-06 bổ sung giảm CPU: các bước

> Đọc trước: `.kiro/steering/efficiency.md`, `docs/op-06-db-cpu/requirements.md`,
> `app/src/lib/store/postgres.pool.ts`, `app/test/postgres-init-isolation.test.ts`.
> Nhánh `ops/06-db-cpu` từ `dev` @ `f673837`. Hạn nửa ngày; hết hạn thì dừng và báo kết quả đo.

## Bước 0: Đo trước khi sửa

Dựng Worker cục bộ trỏ Postgres cục bộ có `log_connections=on`. Đếm số kết nối khi: tải `/draft` một
lần; gọi `/api/token-info?chain=evm&tokenSymbol=WPT` (hoặc `hardhat-local`) một lần; duyệt một yêu cầu
Mint trên `hardhat-local`. Dán lệnh và đầu ra đếm nguyên văn vào `CHECKPOINT_OP06_CPU_DETAIL.md`.
Ghi cả bằng chứng đối tượng ngữ cảnh nào của `getCloudflareContext()` khác nhau giữa hai request.

## Bước 1: Kết nối dùng chung theo request (QĐ-1, QĐ-2)

Viết ca 1, 2, 3 trước cho đỏ, rồi sửa `postgres.pool.ts`. Chạy đột biến 6a, dán đầu ra.

Commit: `fix(op-06): một kết nối Postgres mỗi request, transaction kết nối riêng`

## Bước 2: Khởi tạo đường nhanh (QĐ-3)

Viết ca 4 trước, rồi sửa. Chạy ca 5 và đột biến 6b. Chạy bộ Postgres thật:

```bash
cd app && TEST_DATABASE_URL=<postgres cục bộ> npx vitest --run test/store-constraints.test.ts test/postgres-seed.test.ts test/postgres-init-isolation.test.ts
```

Commit: `fix(op-06): bỏ transaction và seed khi lược đồ, dữ liệu khởi tạo đã đủ`

## Bước 3: Đo sau khi sửa và kiểm rò

Lặp lại phép đếm của Bước 0, lập bảng trước và sau. Tải `/draft` 30 lần rồi đếm kết nối còn mở.

## Bước 4: Cấu hình, tài liệu, bàn giao

QĐ-4 trong `wrangler.json`, cập nhật `DEPLOYMENT.md`, `tech-report.md`. Rồi:

```bash
bash scripts/run-local-all.sh
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1 ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

Viết `docs/CHECKPOINT_OP06_CPU.md`, mục 0 đối chiếu đủ **8** điều kiện; điều kiện đo trên bản deploy
đánh 🔶 lúc mở PR.

## Bước 5: Sau merge **[Chủ dự án]**

Workers Builds deploy lại (`USE_MOCK_DB` trở về `false` theo `wrangler.json`). Thao tác bình thường 15
phút, gửi ảnh biểu đồ CPU và kết quả có hay không 1102. Đạt thì chuyển 🔶 thành ✅ bằng commit bổ sung;
không đạt thì ghi số đo và chủ dự án nâng gói Workers Paid.
