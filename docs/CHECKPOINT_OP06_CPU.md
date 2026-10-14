# Báo cáo bàn giao — OP-06 bổ sung: giảm CPU lớp Postgres trên Workers Free

| | |
|---|---|
| Mã task | OP-06 bổ sung giảm CPU |
| Nhánh | `ops/06-db-cpu`, từ `dev` @ `f673837` |
| Spec | `docs/op-06-db-cpu/{requirements,tasks}.md` |
| Mức kiểm chứng | Cao |
| Tiến độ | Mã/local xong; chờ Owner đo CPU production sau merge |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện | Trạng thái | Bằng chứng |
|---|---|:---:|---|
| 1 | Mỗi request Worker dùng một Client cho `pgQuery`; transaction riêng; lỗi mở lại | ✅ | mục 1; DETAIL mục 2 |
| 2 | Đường nhanh không `BEGIN`/`INSERT`; đường chậm giữ nguyên | ✅ | mục 2; DETAIL mục 3 |
| 3 | Request B không chờ khởi tạo đang chạy của A | ✅ | mục 2; DETAIL mục 4 |
| 4 | Hai đột biến làm đúng ca kiểm đỏ | ✅ | DETAIL mục 5 |
| 5 | Không rò; có bảng đếm trước/sau Worker local | ✅ | mục 3; DETAIL mục 1, 6 |
| 6 | Owner đo production 15 phút, CPU gần mock và không còn 1102 | 🔶 | mục 6 |
| 7 | Tắt diagnostics; cập nhật tài liệu | ✅ | mục 4 |
| 8 | Bộ mặc định/Postgres xanh, không có bí mật | ✅ | mục 5; DETAIL mục 4 |

**Kết luận:** 7 ✅ · 1 🔶 · 0 ❌. Mã và kiểm local đạt; chưa thể tự xác nhận biểu đồ CPU production.

### 0.2 Việc cần Owner quyết/chạy

- Sau merge, để `USE_MOCK_DB=false`, thao tác bình thường 15 phút và gửi ảnh CPU P50/P90 cùng
  kết quả lỗi 1102. Nếu vẫn không gần mức mock ngày 14/10/2026 thì nâng Workers Paid theo spec.
- Không có quyết định thiết kế hay mở rộng phạm vi nào khác cần Owner chốt.

---

## 1. Phạm vi kết nối

Worker lấy `getCloudflareContext().ctx` làm khoá `WeakMap`. OpenNext truyền `ctx` của từng lần
`fetch` vào AsyncLocalStorage riêng; ca hai object context tạo đúng hai Client. Năm `pgQuery` đồng
thời cùng context chỉ tạo một Client. Lỗi kết nối/giao thức xoá đúng entry để lần sau mở lại.
`pgTransaction` luôn gọi `withClient` riêng, nên query ngoài transaction không chen vào.

Không gọi `client.end()` trên Worker: tài liệu vòng đời Hyperdrive xác nhận runtime tự thu hồi edge
connection cuối invocation; Node/Vitest/Docker vẫn mở/đóng theo từng lời gọi. Không có Client/Pool
toàn cục dùng xuyên request.

## 2. Khởi tạo nhanh và cách ly

Cold request chạy `schemaObjectsReady` rồi một query `seedDataReady`. Query seed kiểm đủ
`SystemConfig`, `Role`, mọi project seed và quy tắc địa chỉ: chưa phát hành phải khớp cấu hình, đã có
`issuedAt` thì địa chỉ bất biến. Cả hai đúng thì query nghiệp vụ chạy trên cùng Client, không
`BEGIN`/`INSERT`. Thiếu thì kết nối riêng chạy transaction, advisory lock, DDL/seed cũ.

Promise khởi tạo chỉ nằm trong state của request; cache toàn isolate chỉ nhận kết quả đã hoàn tất.
`postgres-init-isolation.test.ts` vẫn giữ A đang chờ nhưng B hoàn tất độc lập.

## 3. Số đo Worker local

| Thao tác | Trước | Sau | Thay đổi |
|---|---:|---:|---:|
| Tải `/draft` một lần | 8 | 4 | -50% |
| `GET /api/token-info` WPT | 1 | 1 | giữ nguyên |
| Chấp nhận một yêu cầu Mint | 15 | 3 | -80% |

Đếm từ `log_connections=on`, lọc `user=bidv database=bidv_rwa` và loại `application_name=psql` /
`pg_isready`. Sau 30 lượt `/draft`, dừng Worker rồi đọc `pg_stat_activity`: mức nền trước là `0`,
sau là `0`. Lệnh và log kết nối nguyên văn ở `CHECKPOINT_OP06_CPU_DETAIL.md` mục 1 và 6.

## 4. Cấu hình và tài liệu

- `app/wrangler.json`: `USE_MOCK_DB=false`, `ENABLE_READ_DIAGNOSTICS=false`.
- `DEPLOYMENT.md`: một Client/request, transaction riêng, vòng đời Hyperdrive, giới hạn CPU Free.
- `guide.md`: trace chỉ bật tạm cho một lượt điều tra rồi trả về false.
- `tech-report.md` 4.11: thiết kế, số đo và điều kiện production còn chờ.

## 5. Bộ kiểm cuối và bí mật

Postgres sạch đạt 198/198 ca gồm 186 ràng buộc, seed, isolation và request-client; nguyên lệnh và
đầu ra ở DETAIL mục 4. Hai đột biến đã hoàn nguyên.

```bash
bash scripts/run-local-all.sh
```

```text
########## TỔNG KẾT ##########
  Phần đã chạy: arch markers checkpoint contracts app
  Đạt:     7
    PASS  luật kiến trúc (có cảnh báo)
    PASS  LỚP 3 - ĐIỂM CẮM (marker)
    PASS  LỚP 3 - KHUÔN CHECKPOINT
    PASS  LỚP 1 - SPEC TEST CONTRACT EVM
    PASS  APP - TYPECHECK
    PASS  APP - LINT
    PASS  APP - VITEST
  Không đạt: 0

  => ĐẠT các phần đã chạy: arch markers checkpoint contracts app
```

Chi tiết app trong cùng lượt: `Test Files 36 passed | 2 skipped (38)` và
`Tests 821 passed | 11 skipped (832)`; contract `84 passing`.

```bash
git log -p origin/dev..HEAD | grep -nE "postgres(ql)?://[^@ ]+:[^@ ]+@[^l1 ]|PRIVATE_KEY=0x[0-9a-fA-F]{64}" || echo "không có bí mật"
```

```text
không có bí mật
```

## 6. Khoảng cách production còn lại

Điều kiện CPU là phép đo Cloudflare Dashboard sau merge nên giữ 🔶. Task này không deploy, không làm
Mint/Burn nghiệm thu còn lại của OP-06 và không tối ưu dựng trang Next.js. Owner cần giữ
`USE_MOCK_DB=false`, thao tác bình thường 15 phút, đối chiếu P50/P90 với mốc mock và xác nhận không
còn 1102. Nếu không đạt thì dừng tối ưu ở đây và nâng Workers Paid đúng quyết định của spec.
