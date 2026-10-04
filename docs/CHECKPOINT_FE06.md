# Báo cáo bàn giao — Task FE-06: Màn Giao dịch của hai vai vận hành

| | |
|---|---|
| Mã task | FE-06 |
| Nhánh | `feat/ops-transactions`, nền `dev` @ `1fb5ba6` (đã có BE-16) |
| Spec | `docs/fe-06-ops-transactions/{requirements,tasks}.md` |
| Tiến độ | Bước 4/4 xong. Chờ Supervisor nghiệm thu — Codex không merge vào `dev` |

> Máy kiểm: `node scripts/check-checkpoint.mjs docs/CHECKPOINT_FE06.md docs/fe-06-ops-transactions/requirements.md`

---

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Đúng bố cục tài liệu, thay trang chỗ trống | ✅ | mục 3.3, 3.4 |
| 2 | Bước nghiệp vụ lấy từ nghiệp vụ, không tự suy ở UI | ✅ | mục 3.1, 3.2 ca 2 |
| 3 | GDV khớp được lệnh, KSV chỉ xem | ✅ | mục 3.2 ca 3–4, 3.3 |
| 4 | Guard đúng cả bốn vai | ✅ | mục 3.2 ca 4–5, 3.3 |
| 5 | E2E cũ đã rà, bộ E2E FE-06 xanh | ✅ | mục 3.3 |
| 6 | `run-local-all.sh` xanh | ✅ | mục 7 |

**Kết luận:** 6 ✅ · 0 🔶 · 0 ❌

### 0.2 Quyết định Owner đã chốt

- Chỉ lấy phần nội dung, bố cục và dữ liệu từ hai ảnh IV.3.3/IV.4.3; giữ nguyên header/sidebar và
  phong cách UI hiện tại của source.
- Route chi tiết là `/transactions/[id]`; phần nội dung chi tiết tách thành component trình bày dùng
  chung với FE-25, nhưng mỗi khu vực giữ guard máy chủ riêng.
- Nút khớp hiện cho cả `PLACED` và `CHECKING`, đúng tập trạng thái mà `executeOrder` nhận.
- Hai tệp draft `app/actions/ops.ts` và `ops-transactions.service.ts` có nền đúng nên được kế thừa,
  rà lại và hoàn thiện; hai HTML ngoài task trong `docs/` giữ nguyên, không đưa vào thay đổi FE-06.

---

## 1. Đã làm

| Phạm vi | Thay đổi |
|---|---|
| Danh sách | `/transactions`: tiêu đề, mô tả, sáu bộ lọc, bảng chín cột, phân trang, trạng thái rỗng/tải/lỗi |
| Nghiệp vụ đọc | `listOpsOrders`: guard vận hành, lọc/đếm/phân trang, danh sách ví, bước hiện tại, quyền hành động, nguồn cung |
| Lưu trữ | `IOrderStore`: `search`, `offset`, `countOrders`, `listOrderInvestors`; memory/Postgres cùng hành vi |
| Khớp lệnh | Dùng lại `executeOrderAction`; tải lại bảng và ba số liệu nguồn cung sau cả thành công lẫn lỗi |
| Chi tiết | `/transactions/[id]`; tách `OrderDetailContent` để `/orders/[id]` của FE-25 dùng chung trình bày |
| Phân quyền | GDV có hành động; KSV có thông báo chỉ xem và không có cột/nút; Investor/Seller bị chặn |
| Kiểm thử | `ops-transactions.test.ts`, mở rộng `store-constraints`, E2E đầy đủ `ops-transactions.spec.ts` |

## 2. Đối chiếu DoD theo `tasks.md`

| Bước | DoD | Đạt? | Ghi chú |
|---|---|---|---|
| 0 | FE-06 đang làm; nền đã có BE-16; marker hợp lệ | ✅ | commit `d0f3005`, nền `1fb5ba6` |
| 1 | Việc 1–4; ca 1–2 | ✅ | mục 3.1, 3.2 |
| 2 | Việc 5–7; ca 3–5 | ✅ | mục 3.2, 3.3 |
| 3 | Rà E2E cũ và thêm E2E màn mới | ✅ | không E2E cũ nào bám placeholder `/transactions`; ca mới xanh |
| 4 | Báo cáo, trạng thái, checkpoint, kiểm cuối | ✅ | mục 6, 7; FE-06 đã chuyển `done` |

## 3. Cách chạy / kiểm thử

Mức kiểm chứng **Vừa** theo spec: kiểm chức năng ở store/service, E2E một luồng thật trên mock và rà
trực quan ở trình duyệt. Không chạy đột biến vì spec không yêu cầu.

### 3.1 Chốt kiến trúc và nguồn dữ liệu

- Component không gọi chain. `ops-transactions.service.ts` đọc nguồn cung qua `readSupplyMetrics()`
  và khớp qua action đã có; `executeOrder` tiếp tục là nơi duy nhất điều phối ledger.
- `currentStep` được service chọn từ `OrderView.steps`, mà `toOrderView()` dựng qua
  `toSettlementSteps()` của BE-14. Component chỉ đọc `currentStep.label/state`.
- `can(role, 'order:execute')` quyết định cột hành động; không có so sánh literal tên vai.
- `countOrders` và `listOrders` nhận cùng object bộ lọc. Postgres dùng `COUNT` riêng rồi
  `LIMIT/OFFSET`; memory dùng cùng hàm `filteredOrders`, tránh tổng và trang lệch nhau.
- Chi tiết dùng chung phần vẽ `OrderDetailContent`, không dùng chung phép cấp quyền: FE-25 lọc theo ví,
  FE-06 thêm cổng `ops:read` trước khi gọi hợp đồng dữ liệu chi tiết.

### 3.2 Sáu ca ở tầng Vitest

```
$ npx vitest run test/ops-transactions.test.ts test/store-constraints.test.ts \
    test/investor-trading.test.ts test/four-roles-routes.test.ts test/four-roles-shell.test.ts
 Test Files  5 passed (5)
      Tests  180 passed (180)
```

| Ca | Bằng chứng |
|---|---|
| 1 | Kết hợp từng bộ lọc ví/chiều/trạng thái, tìm gần đúng mã, danh sách ví, tổng và trang 2; cùng contract store chạy memory mặc định và chạy thêm Postgres khi có `TEST_DATABASE_URL` |
| 2 | Dòng `CHECKING` trả đúng bước `checking`, bằng chính phần tử current/failed ở chi tiết FE-25; GDV được cấp cờ khớp |
| 3 | Phát hành → đặt lệnh → GDV khớp: `PLACED → COMPLETED`, nút mất, chưa phân phối `1000 → 998`, lưu hành `0 → 2` |
| 4 | KSV đọc cùng dữ liệu nhưng `mayExecute=false`, mọi dòng `canExecute=false` |
| 5 | INVESTOR và SELLER gọi thẳng cả danh sách lẫn chi tiết đều nhận `FORBIDDEN` |
| 6 | Cây route/menu bốn vai, shell và màn FE-25 vẫn xanh sau khi thêm route động và tách component dùng chung |

### 3.3 Kiểm thử đầu-cuối

```
$ npx playwright test e2e/ops-transactions.spec.ts
  1 passed
```

Ca E2E tự dựng dữ liệu qua đường thật: GDV KYC hai ví → lập yêu cầu Mint → KSV duyệt → GDV nạp
VNDB → Investor đặt lệnh → GDV mở `/transactions`, khớp lệnh → bảng thành `Hoàn tất`, nguồn cung giảm
đúng 2 → mở `/transactions/[id]`, thấy tiến trình quyết toán → KSV mở cùng màn chỉ thấy thông báo
chỉ xem, không có nút → Investor và Seller bị `ChannelGuard` chặn.

Đã rà toàn bộ `app/e2e`: trước FE-06 không có ca nào bám nội dung placeholder `/transactions`, nên
không có ca cũ phải sửa. `playwright.config.ts` bật cờ nạp VNDB trong đúng máy chủ E2E để ca mới tự
đứng độc lập; cờ production vẫn mặc định tắt.

### 3.4 Rà trực quan theo ảnh Owner gửi

Mở ứng dụng thật ở viewport 1280×720, chuỗi `mock`, kiểm cả GDV và KSV:

- Header/sidebar giữ nguyên source; chỉ phần `main` thay đổi.
- Tiêu đề, mô tả, dãy bộ lọc, bảng/phân trang theo bố cục ảnh; ở 1280 không có tràn ngang
  (`body.scrollWidth = body.clientWidth = 1280`, form nằm trọn trong main). Dưới breakpoint, bộ lọc
  tự xuống hai cột.
- KSV hiện câu “chỉ có quyền xem” ngay trên dữ liệu và không kết xuất cột hành động.
- Màu, border, card, typography và dark/light mode đều dùng token CSS hiện tại; không thêm màu hex.

## 4. Deviation / giới hạn đã biết

- **DV-1 — bộ chọn nhà đầu tư hiện ví, không hiện tên.** Source chưa có cổng hồ sơ nhà đầu tư ánh xạ
  ví → tên. Hiện tên mẫu như ảnh sẽ bịa dữ liệu; FE-06 trả danh sách ví từng có lệnh từ store.
- **DV-2 — ba thẻ nguồn cung nằm trên bộ lọc.** Ảnh tham chiếu cũ đặt số liệu ở sidebar, trong khi
  Owner yêu cầu không sửa header/sidebar hiện tại và spec bắt số liệu nguồn cung đổi sau khớp. Ba thẻ
  dùng `readSupplyMetrics()` là vị trí duy nhất vừa đáp ứng hai ràng buộc, theo style source hiện tại.
- **DV-3 — không thêm sắp xếp cột.** Spec chỉ yêu cầu lọc và phân trang; sắp xếp riêng 12 dòng ở
  client sẽ làm thứ tự sai giữa các trang. Khi cần sort, phải thêm khoá sort vào cả hai store.

## 5. Câu hỏi mở

Không có câu hỏi chặn nghiệm thu FE-06. Nếu sau này có nguồn hồ sơ nhà đầu tư, thay nhãn ví trong
`listOrderInvestors` bằng view-model `{ wallet, displayName }`; không đổi bộ lọc lưu trữ.

## 6. Tự đánh giá ba luật kiến trúc

- [x] Mọi call chain qua `ILedgerPort`: UI chỉ gọi server action; nguồn cung qua service đã có.
- [x] Mọi ký qua `ISigner`: FE-06 không thêm đường ký; `executeOrder` giữ nguyên signer ngân hàng.
- [x] Mọi kiểm quyền qua RBAC: layout dùng `AREA_GATES.ops`, service dùng `assertCan`/`can`.

Marker `@pending FE-06` ở trang và action đã gỡ. Báo cáo công nghệ nâng 3.2 → 3.3, thêm mục 3.20 và
cập nhật sơ đồ lối vào luồng mua/bán. Bảng điểm cắm được sinh lại từ mã, không sửa tay.

## 7. Kết quả `run-local-all.sh`

Chạy **đúng một lần ở cuối task**, mã thoát **0**, đạt 7/7 phần mặc định:

```
PASS  luật kiến trúc (có 3 cảnh báo đã có từ nền)
PASS  marker                 19 điểm cắm, 13 điểm chặn, 35 bước luồng
PASS  khuôn checkpoint       24/60 dòng, 6 dòng / 6 điều kiện
PASS  contract EVM           67 passing
PASS  app typecheck
PASS  app lint
PASS  app vitest             27 tệp, 746 test
```

Ba cảnh báo kiến trúc không do FE-06 tạo: `SIGNER_KIND` đọc ngoài `lib/config`, địa chỉ ví mẫu trong
`mint.tsx`, và không đặt `BASE_REF` để so contract. Bộ kiểm vẫn kết luận “ĐẠT nhưng có cảnh báo”; mọi
phần bắt buộc đều PASS, không có FAIL.
