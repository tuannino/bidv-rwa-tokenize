# FIX-05: màn Tổng quan dùng dữ liệu thật; ghi chú dữ liệu mẫu ở 3 màn vận hành

| | |
|---|---|
| Nhánh | `fix/fix-05-tong-quan` từ `dev` mới nhất (sau khi merge FIX-04 (nối dữ liệu thật cho màn Nhà đầu tư, Người bán, Tài khoản)): cần `UnverifiedNote` và `portfolio.service.ts` của FIX-04 |
| Loại | Backend CHỈ ĐỌC (1 service, 1 server action mới, mục 3) và frontend. Không ghi dữ liệu, không đổi lược đồ, không thêm quyền |
| Mức kiểm thử | **B** (tasks bước 6) |
| Một PR | Không push lên `dev`, không merge |
| Nguồn | Project doc `20261102_man_du_lieu_mau.md` mục 6 (Sếp chốt 02/11); Sếp chốt thêm 02/11: chỉ làm màn Tổng quan, thêm 1 action chỉ đọc; `/assets`, `/kyc`, `/reconciliation` chỉ thêm ghi chú sau tiêu đề |

## 1. Mục tiêu

1. Màn Tổng quan (`/`, vai Giao dịch viên và Kiểm soát viên) thiết kế lại theo 6 cụm Sếp chốt, số liệu có nguồn thì lấy thật theo chain đang chọn, số liệu chưa có nguồn thì giữ mẫu kèm chữ chìm "unverified".
2. `/assets`, `/kyc`, `/reconciliation`: KHÔNG sửa nội dung; chỉ thêm ghi chú chữ nhỏ, mờ ngay sau tiêu đề: **"(đang hiển thị dữ liệu mẫu)"**.

## 2. Quyết định (QĐ)

- **QĐ-1. Chỉ đọc.** Backend chỉ đọc database và chuỗi, không ghi, không đổi lược đồ, không thêm quyền. Dùng quyền có sẵn `ops:read` (cổng khu vực vận hành, chỉ Giao dịch viên và Kiểm soát viên có), kiểm bằng `assertCan(await currentRole(), 'ops:read')` như `getPriceConfigOverview` (`config.service.ts:476-490`), KHÔNG dùng `authorize` vì `authorize` ghi một dòng sổ kiểm toán mỗi lần gọi (`authorize.ts:52-70`).
- **QĐ-2. Một lời gọi khi mở màn Tổng quan.** Ô chọn chain chỉ lưu phía trình duyệt nên máy chủ không biết chain đang chọn; màn gọi đúng MỘT action mới `getOpsOverviewAction(chain)` khi mở và khi đổi chain. Số lời gọi khi mở `/` tăng từ hiện tại thêm đúng 1: ngoại lệ của điều kiện HF-01 (hiệu năng mở màn), Sếp đã duyệt 02/11. Ba màn còn lại không thêm lời gọi.
- **QĐ-3. Nguồn lỗi thì không kéo cả màn đổ.** Mỗi nguồn đọc lỗi thì trường đó `null` (log máy chủ chỉ ghi tên lỗi); màn hiện "Chưa đọc được" ở đúng ô đó.
- **QĐ-4. Định nghĩa số liệu:**
  - Dự án đang triển khai: số dòng bảng dự án của chain có `status = ISSUED` (đã phát hành token). `DRAFT` (chưa phát hành) không tính. Đọc tối đa 50 dòng (giới hạn mặc định của `listProjects`), đủ cho PoC.
  - Tổng cung: `tokenInfo().totalSupply` trên chuỗi, kèm ký hiệu token.
  - Nhà đầu tư đã định danh: số hồ sơ (`actorId`) KHÁC NHAU có ít nhất một ví đã gắn trên chain (`WalletBinding`), chỉ tính hồ sơ có vai Nhà đầu tư trong danh sách hồ sơ (`findCustomerProfile(actorId)?.role === 'INVESTOR'`); hồ sơ Người bán và mã không có hồ sơ không tính. Đọc tối đa 200 ví; chạm giới hạn thì hiện dấu `+` sau số. Hồ sơ người dùng thật chờ AU-01 (đăng nhập và tài khoản thật).
  - Lợi tức đã chia: tổng `totalAmount` (VNDB) của các kỳ chia trạng thái `COMPLETED` trên chain, kèm số kỳ. Kỳ đang mở, hết hạn, đã đóng không tính. Đọc tối đa 100 kỳ; chạm giới hạn thì thêm dấu `+` sau số kỳ.
  - Biểu đồ lợi tức theo kỳ: 6 kỳ `COMPLETED` gần nhất, kỳ cũ bên trái.
- **QĐ-5. Không có nguồn thật thì giữ mẫu kèm "unverified":** sản lượng luỹ kế, biểu đồ sản lượng theo tháng, cột TCC (Tokenized Carbon Credit, chưa hỗ trợ). Bỏ hẳn khỏi màn: ô "Nhà đầu tư whitelisted", khối "Phân bổ WPT theo dự án", 3 thẻ dự án mẫu (công suất, hệ số công suất): không thuộc 6 cụm Sếp chốt.
- **QĐ-6.** Sản lượng (theo tháng, mẫu) và lợi tức (theo mã kỳ chia, ví dụ "2026-Q1") khác trục thời gian, nên một khung "Sản lượng và lợi tức theo kỳ" chứa HAI biểu đồ cạnh nhau, không vẽ chung một trục để tránh ghép sai kỳ.

## 3. Thay đổi backend (báo cáo để Sếp duyệt)

| # | Tệp | Thay đổi |
|---|---|---|
| B1 | mới `lib/bank/overview.service.ts` | `getOpsOverview(chain)`: kiểm chain, `assertCan(await currentRole(), 'ops:read')` (không ghi sổ kiểm toán, QĐ-1), rồi đọc song song 4 nguồn (mục 2 QĐ-4): `getProjectStore().listProjects({ chain, status: 'ISSUED' })`, `getLedger(chain).tokenInfo()`, `getWalletBindingStore().list(chain, 200)`, `getDistributionStore().listPeriods({ chain, status: 'COMPLETED', limit: 100 })`. Mỗi nguồn bọc `readOrNull` |
| B2 | mới `app/actions/overview.ts` | `'use server'`; `getOpsOverviewAction(chain)` chỉ gọi `getOpsOverview(chain)` (vỏ mỏng như `actions/portfolio.ts`) |
| B3 | mới `lib/bank/read-or-null.ts`; `lib/bank/portfolio.service.ts` | Chuyển hàm `orNull` của FIX-04 thành hàm dùng chung `readOrNull(scope, label, read)`; `portfolio.service.ts` bỏ bản riêng, import bản chung với `scope = 'portfolio'`. Không đổi hành vi (câu log giữ nguyên `[portfolio] Không đọc được ...`) |

`lib/indexer/**`, `lib/ledger/**`, `lib/store/**`, `lib/rbac/**` KHÔNG đổi.

### 3.1. Đánh giá an toàn

| Khía cạnh | Đánh giá |
|---|---|
| Ghi dữ liệu | Không. 3 truy vấn đọc database, 1 lời gọi đọc hợp đồng (`tokenInfo`); không chạm Indexer; không ghi sổ kiểm toán (dùng `assertCan`, không `authorize`). Ghi chú: chain mock chạy với Postgres, `tokenInfo` có sẵn bước khởi tạo dòng trạng thái ledger mẫu nếu chưa có (`postgres-mock-state.store.ts:26-33`, hành vi cũ, không phải dữ liệu nghiệp vụ, không có trên chain thật) |
| Quyền | `ops:read` có sẵn; Nhà đầu tư, Người bán gọi trực tiếp action thì bị từ chối (kiểm trong service, không dựa vào giao diện) |
| Lược đồ, hợp đồng | Không đổi |
| Dữ liệu trả ra | Chỉ số đếm và tổng; KHÔNG trả địa chỉ ví, mã hồ sơ |
| Số lời gọi khi mở | `/` thêm đúng 1 (QĐ-2, đã duyệt); 3 màn còn lại không đổi |
| Hiệu năng | 4 lần đọc chạy song song; đọc có giới hạn (200 ví, 100 kỳ). Đo thời gian trả lời action trên hardhat cục bộ (10 lần, trung vị), ghi checkpoint; quá 1 giây thì báo Supervisor trước khi mở PR |
| Hành vi cũ | B3 chỉ chuyển chỗ hàm, test FIX-04 (ca 2, 4, 8) phải giữ nguyên xanh |
| Hoàn tác | Revert commit, không migration |

Mức rủi ro: **Thấp.**

## 4. Thay đổi frontend

| # | Tệp | Thay đổi |
|---|---|---|
| F1 | `components/pages/dashboard.tsx` | Viết lại theo design mục 2: gọi `getOpsOverviewAction(chain)` theo `useSelectedChain()`; hàng 5 thẻ số liệu (Dự án đang triển khai, Tổng cung token kèm cột theo loại token, Nhà đầu tư đã định danh, Sản lượng luỹ kế, Lợi tức đã chia); khung "Sản lượng và lợi tức theo kỳ" gồm biểu đồ "Lợi tức theo kỳ" (thật) và "Sản lượng theo tháng" (mẫu, "unverified"). Giữ tiêu đề "Tổng quan" và nút "Phát hành WPT". Bỏ các khối ở QĐ-5 |
| F2 | mới `components/ui/sample-data-note.tsx` | `SampleDataNote`: `<span className="text-sm font-normal text-muted-foreground">(đang hiển thị dữ liệu mẫu)</span>` |
| F3 | `components/pages/assets.tsx`, `kyc.tsx`, `reconciliation.tsx` | Thêm `<SampleDataNote />` ngay SAU khối tiêu đề (cùng hàng, NGOÀI thẻ `h1` và ngoài `HoverHint`, để tên tiêu đề và gợi ý không đổi). Không sửa gì khác |

Câu chữ mới viết đúng như design; không thêm câu khác. Không ký tự cấm.

## 5. Phạm vi tệp

Được sửa: các tệp ở mục 3 và 4, test (mục 6), tài liệu (mục 7).

Không được sửa: mọi tệp khác trong `lib/**` (gồm `lib/mock-data.ts`), `app/src/app/api/**`, các action khác, `app/prisma/**`, `packages/**`, `scripts/**`, `app/wrangler.json`, `.env*`.

## 6. Kiểm thử (mức B)

Test cũ: không dự kiến phải đổi. Nếu có test đỏ do đổi chữ trên màn Tổng quan thì chỉ sửa chuỗi mong đợi, ghi tên test và lý do vào checkpoint.

Vitest mới `app/test/fix-05-tong-quan.test.ts`:

| Ca | Nội dung |
|---|---|
| 1 | Giao dịch viên, chain mock (bộ nhớ). Chuẩn bị: đánh dấu dự án mẫu của chain là đã phát hành bằng `getProjectStore().markIssued({ id, issuedAt })` (dòng mẫu ban đầu là `DRAFT`, `seed-data.ts:140-146`); gắn ví bằng `getWalletBindingStore().bind({ chain, wallet, actorId, boundBy })` (gọi store, không gọi `bindWallet` vì service chặn mã không có hồ sơ): 2 ví cho `NDT001`, 1 ví cho `NB001` (Người bán), 1 ví cho `NDT999` (không có hồ sơ); tạo 7 kỳ `COMPLETED` và 1 kỳ `OPEN` bằng `getDistributionStore().openPeriod({ periodKey, snapshotId, totalAmount, totalSupplyAt, chain, status })` với số tiền khác nhau, mỗi kỳ cách nhau 1 giây bằng `vi.useFakeTimers({ toFake: ['Date'] })` và `vi.setSystemTime(...)` để thứ tự ổn định. Kỳ vọng: `issuedProjects === 1`; `supply.totalSupply` bằng `tokenInfo().totalSupply`; `investors` là `{ count: 1, truncated: false }`; `profit.totalAmount` bằng tổng 7 kỳ `COMPLETED`, `periods === 7`; `series.map(p => p.periodKey)` đúng bằng 6 kỳ `COMPLETED` mới nhất, kỳ cũ trước, không có kỳ `OPEN` |
| 2 | Từng nguồn ném lỗi, mỗi lần một nguồn (store: `vi.spyOn(getProjectStore(), 'listProjects')` và tương tự, vì store là bản dùng chung; ledger: `vi.spyOn(ledgerModule, 'getLedger').mockReturnValue(...)` như `test/config-service.test.ts:328`, vì `getLedger()` tạo đối tượng mới mỗi lần): kết quả vẫn `ok`, đúng trường đó `null`, 3 trường còn lại đúng; lỗi mang chuỗi `https://rpc.example/KEY123` thì không tham số `console.error` nào chứa `KEY123` |
| 3 | Kiểm soát viên gọi được; Nhà đầu tư, Người bán nhận `FORBIDDEN`; chain sai nhận `VALIDATION`; gọi thành công hay bị từ chối đều KHÔNG thêm dòng sổ kiểm toán (đếm `getStore().listAudit` trước và sau) |
| 3b | Chạy với Postgres (`describe.skipIf(!process.env.TEST_DATABASE_URL)`): 1 dự án `ISSUED`, 2 kỳ `COMPLETED`, 1 kỳ `OPEN`, 2 ví `NDT001`: `issuedProjects === 1`, `periods === 2`, `investors.count === 1` |
| 4 | `list` trả đủ 200 ví thì `investors.truncated === true`; `listPeriods` trả đủ 100 kỳ thì `profit.truncated === true` |
| 5 | Quét mã: `portfolio.service.ts` và `overview.service.ts` import `readOrNull` từ `./read-or-null`, không còn định nghĩa hàm `orNull` riêng |
| 6 | Quét mã `dashboard.tsx`: có `getOpsOverviewAction`; không còn `MOCK_PROJECTS`, `whitelistedInvestors`, `wptIssued`, `profitDistributedVndBn`, `distributionPeriods`; có ít nhất 3 lần `<UnverifiedNote`. `assets.tsx`, `kyc.tsx`, `reconciliation.tsx` đều có `<SampleDataNote />` và không có `SampleDataNote` nằm giữa `<h1` và `</h1>` |

Test FIX-04 (`app/test/fix-04-noi-du-lieu-that.test.ts`, nhất là ca 2, 4, 8) phải giữ nguyên xanh sau B3.

E2E mới `app/e2e/fix-05-tong-quan.spec.ts` (chain mock):

- Giao dịch viên mở `/`: tiêu đề cấp 1 `toHaveText('Tổng quan')`; thấy 5 nhãn thẻ đúng design; có chữ "unverified"; không còn "whitelisted"; ô "Dự án đang triển khai" là một số.
- Đếm lời gọi server action khi mở `/` theo cách `e2e/recall.spec.ts:84-91`, chạy trên máy chủ mặc định của Playwright (bản build, không bật `USE_DEV` vì chế độ phát triển gọi effect hai lần): bằng số trên `dev` cộng 1 (ghi số trước và sau vào checkpoint).
- `/assets`, `/kyc`, `/reconciliation`: thấy "(đang hiển thị dữ liệu mẫu)"; tiêu đề cấp 1 khớp CHÍNH XÁC chữ cũ bằng `toHaveText` ("Dự án điện gió đã token hoá", "Nhà đầu tư & KYC", "Đối soát doanh thu điện").

## 7. Tài liệu

- `docs/CHECKPOINT_FIX05.md`: "Phạm vi: backend chỉ đọc (B1 tới B3) và frontend"; thời gian trả lời action (mục 3.1); số lời gọi khi mở `/` trước và sau; đột biến.
- `docs/USER_GUIDE.md`: ý nghĩa 5 thẻ số liệu của Tổng quan (theo QĐ-4); ý nghĩa "unverified" và "(đang hiển thị dữ liệu mẫu)".
- `.kiro/task-status.json`.

## 8. Đột biến bắt buộc (10 cái, ghi ca đỏ)

1. Đếm cả hồ sơ Người bán: ca 1 đỏ.
2. Không gộp theo hồ sơ (đếm ví thay vì hồ sơ): ca 1 đỏ.
3. Tính cả kỳ không `COMPLETED` (bỏ bộ lọc trạng thái): ca 1 đỏ.
4. `series` để kỳ mới trước, hoặc không cắt 6 kỳ: ca 1 đỏ.
5. Một nguồn lỗi thì ném cả lời gọi (bỏ `readOrNull` ở một nguồn): ca 2 đỏ.
6. `readOrNull` ghi `error.message`: ca 2 đỏ.
7. Đổi quyền thành `balance:read`: ca 3 đỏ.
8. `dashboard.tsx` dùng lại `MOCK_WIND_STATS.wptIssued`: ca 6 đỏ.
9. Đặt `<SampleDataNote />` vào trong `h1` ở `kyc.tsx`: ca 6 và e2e đỏ.
10. Đổi `assertCan` thành `authorize`: ca 3 đỏ (có dòng sổ kiểm toán mới).

## 9. Điều kiện hoàn thành

- [ ] B1 tới B3 đúng mục 3; F1 tới F3 đúng mục 4; `lib/indexer/**`, `lib/ledger/**`, `lib/store/**`, `lib/rbac/**` không đổi.
- [ ] Số lời gọi khi mở `/` bằng `dev` cộng 1; `/assets`, `/kyc`, `/reconciliation` không đổi (số trong checkpoint).
- [ ] Thời gian trả lời action trong checkpoint; không quá 1 giây (hoặc đã báo Supervisor).
- [ ] `git diff --name-only` chỉ có tệp ở mục 5; lệnh kiểm tệp cấm rỗng.
- [ ] Chạy đúng lệnh mức B ở tasks bước 6, tất cả xanh; test FIX-04 vẫn xanh; 10 đột biến bị bắt.
- [ ] Ảnh `/` (Sáng và Tối), `/assets`, `/kyc`, `/reconciliation` (Sáng) ở `docs/screenshots/fix-05/`.
- [ ] Không ký tự cấm trong chữ mới thêm.
