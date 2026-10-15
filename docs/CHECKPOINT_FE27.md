# Báo cáo bàn giao — FE-27: Đồng bộ dữ liệu theo chain

| | |
|---|---|
| Mã task | FE-27 |
| Nhánh | `feat/fe-27-chain-scope`, tạo từ `dev` @ `89a10a3` (PR #50) |
| Spec | `docs/fe-27-chain-scope-ui/requirements.md` |
| Tiến độ | Hoàn tất mã và kiểm chứng local. Chờ Supervisor nghiệm thu; Em không merge vào `dev` |

## 0. Tóm tắt nghiệm thu

### 0.1 Đối chiếu điều kiện hoàn thành

| # | Điều kiện (rút gọn từ `requirements.md`) | | Bằng chứng |
|---|---|---|---|
| 1 | Bảng rà soát đủ các màn trong `components/pages/` | ✅ | mục 2 |
| 2 | Màn đọc theo chain tải lại khi đổi chain và bỏ phản hồi cũ | ✅ | mục 3.1 · 5.2 |
| 3 | Màn Duyệt lọc theo chain, không duyệt nhầm chain | ✅ | mục 3.2 · 5.1 · 8 |
| 4 | Hàm đọc danh sách phía máy chủ lọc theo chain, có kiểm thử | ✅ | mục 3.3 · 5.1 |
| 5 | Giá phát hành theo chain, seed và đặt giá độc lập, có kiểm thử | ✅ | mục 3.4 · 5.1 |
| 6 | Đầu cuối đổi chain xanh, gồm ca phản hồi chậm | ✅ | mục 5.2 · 5.3 |
| 7 | Bộ mặc định xanh | ✅ | mục 5.4 |

**Kết luận:** 7 ✅ · 0 🔶 · 0 ❌

### 0.2 Việc cần Owner quyết

- Không có.

---

## 1. Phạm vi và số đo hiện trạng

Nhánh dùng đúng nền Owner chỉ định. Spec ghi số đo ở `615c7ef`; kế hoạch và triển khai dùng số đo
lại tại `89a10a3`:

```bash
$ git rev-parse 89a10a3
89a10a3537d673a883f5217f46a69bbd4ec502ef

$ git grep -l "useSelectedChain" 89a10a3 -- 'app/src/components/**' | wc -l
19

$ git ls-tree -r --name-only 89a10a3 app/src/components/pages | grep '\.tsx$' | wc -l
22

$ git ls-tree -r --name-only 89a10a3 app/src/components/pages | grep '\.tsx$' |
  while IFS= read -r file; do
    git grep -q "useSelectedChain" 89a10a3 -- "$file" || printf '%s\n' "$file"
  done
app/src/components/pages/account-info.tsx
app/src/components/pages/approval-detail.tsx
app/src/components/pages/approvals.tsx
app/src/components/pages/dashboard.tsx
app/src/components/pages/investor-portfolio.tsx
app/src/components/pages/kyc.tsx
app/src/components/pages/placeholder.tsx
app/src/components/pages/reconciliation.tsx

$ git grep -n "chain" 89a10a3 -- app/src/components/maker-checker/request-table.tsx
89a10a3:app/src/components/maker-checker/request-table.tsx:61:              {row.tokenSymbol} <span className="text-muted-foreground">({row.chain})</span>
```

Kết luận đo lại: tổng số tệp có hook vẫn trùng con số trong spec, nhưng tập màn cụ thể được chốt
theo nền mới. Bảng yêu cầu chỉ trình bày chain của từng dòng, chưa lọc theo chain đang chọn.

## 2. Bảng rà soát giao diện

### 2.1 Toàn bộ `components/pages/`

| Màn | Nguồn dữ liệu | Trước FE-27 | Sau FE-27 |
|---|---|---|---|
| `account-info.tsx` | Hồ sơ phiên qua Server Component | Dữ liệu tài khoản toàn cục, không thuộc chain | Không đổi; phân loại không theo chain |
| `approval-detail.tsx` | `getTokenRequestDetail` + token/ledger | Không đọc chain đang chọn; URL có thể mở yêu cầu chain khác | Khoá tải có chain; báo chain thực của yêu cầu và chặn quyết định lệch chain |
| `approvals.tsx` | thống kê + `TokenRequest` | Gộp mọi chain | Hai hàng chờ và thống kê lọc chain; kết quả cũ không được kết xuất |
| `assets.tsx` | `MOCK_PROJECTS`, `MOCK_WIND_STATS` | Dữ liệu minh hoạ chưa nối on-chain; chain chỉ dùng tạo explorer URL | Không có lượt đọc bất đồng bộ để đổi; tiếp tục được ghi rõ là dữ liệu mẫu ngoài ledger |
| `dashboard.tsx` | `MOCK_*` | Tổng quan minh hoạ chưa nối on-chain | Không có lượt đọc theo chain; không giả làm dữ liệu ledger |
| `demo-payment.tsx` | `demoPaymentContext` + ledger | Có truyền chain và cờ huỷ, nhưng state cũ còn hiện khi đổi chain | State mang khoá chain; refresh sau mutation chỉ ghi nếu chain còn khớp |
| `draft.tsx` | thống kê, danh sách yêu cầu, token info, preview | Token info/preview có chain; thống kê và danh sách chưa lọc; state tải chưa mang chain đầy đủ | Mọi input máy chủ có chain; stats/list/info mang khoá chain và bỏ phản hồi cũ |
| `investor-order-detail.tsx` | chi tiết lệnh theo ví | Đã có khoá `chain + id + wallet`, có cờ huỷ | Giữ nguyên vì đã đúng |
| `investor-orders.tsx` | danh sách lệnh theo ví | Đã có chain trong khoá truy vấn và cờ huỷ | Giữ nguyên vì đã đúng |
| `investor-portfolio.tsx` | ghép các khối dùng chung | Trang bố cục không tự đọc dữ liệu | Giữ nguyên; các khối con được rà ở mục 2.2 |
| `investor-token-detail.tsx` | vị thế token/ledger | Đã có khoá `chain + wallet + symbol`, có cờ huỷ | Giữ nguyên vì đã đúng |
| `investor-trade.tsx` | context, preview và theo dõi lệnh | Context/preview đã có khoá; bộ hẹn giờ theo dõi có thể ghi muộn | Dừng cập nhật của interval khi effect đã huỷ |
| `kyc.tsx` | trạng thái rỗng tĩnh | Chưa nối DB/KYC provider, toàn bộ chỉ tiêu bằng không | Không có dữ liệu chain để tải; luồng KYC thật vẫn ở `mint.tsx` |
| `mint.tsx` | ledger, lịch sử, trạng thái ví | Có chain và cờ huỷ, nhưng state cũ còn hiện; refresh mutation có thể ghi muộn | State mang khoá `chain + wallet`; mutation chỉ refresh đúng khoá còn hoạt động |
| `ops-order-detail.tsx` | chi tiết lệnh toàn hệ | Đã có khoá `chain + id`, có cờ huỷ | Giữ nguyên vì đã đúng |
| `ops-transactions.tsx` | danh sách lệnh + nguồn cung | Đã lọc và khoá theo chain, nhưng chưa nói rõ phạm vi đang xem | Giữ logic; thêm nhãn chain đang xem |
| `placeholder.tsx` | nội dung tĩnh | Trang chỗ trống, không đọc nghiệp vụ | Không đổi; task nhận trang sau chịu trách nhiệm nối nguồn chain |
| `reconciliation.tsx` | `MOCK_*`, danh sách kỳ rỗng | Dữ liệu minh hoạ; nguồn SCADA/EVN chưa nối | Không có lượt đọc chain; giữ cảnh báo rõ nguồn chưa nối |
| `seller-overview.tsx` | seller service + ledger/store | Đã khoá và huỷ theo chain | Giữ logic; thêm nhãn chain đang xem |
| `seller-transactions.tsx` | danh sách lệnh của SPV | Đã có chain trong khoá JSON và cờ huỷ | Giữ nguyên vì đã đúng |
| `seller-withdraw.tsx` | `useSellerOverview`; form rút tạm | Số dư đã theo chain; phần ghi còn chờ BE-13 | Giữ nguồn đọc đúng; không mở rộng nghiệp vụ rút |
| `wallet-connect.tsx` | state ví + chain selector | Không có phép đọc danh sách máy chủ; lựa chọn chain đã là input chính | Giữ nguyên |

Lệnh chốt phạm vi bảng:

```bash
$ rg --files app/src/components/pages | sort | wc -l
22
```

### 2.2 Khối dữ liệu dùng chung

| Khối | Kết quả rà soát / thay đổi |
|---|---|
| `investor/asset-summary.tsx` | Đã khoá theo `chain + wallet`, bỏ phản hồi effect đã huỷ; giữ nguyên |
| `investor/issuance-status-box.tsx` | Đã khoá theo chain và bỏ phản hồi cũ; giữ nguyên |
| `investor/transaction-history-box.tsx` | Đã khoá theo `chain + wallet`, bỏ phản hồi cũ; giữ nguyên |
| `layout/sidebar.tsx` | Số việc chờ chuyển sang đọc theo chain; phản hồi cũ bị huỷ và không dùng số chain trước làm fallback khi đổi chain |
| `maker-checker/token-info-read.ts` | Đã dùng `AbortController`; bổ sung ca E2E làm chậm phản hồi chain cũ |
| `maker-checker/request-table.tsx` | Chỉ trình bày dữ liệu service đã lọc; không tự lọc lần hai ở client |

## 3. Thay đổi chính

### 3.1 Khuôn tải lại và chống phản hồi cũ

- State bất đồng bộ mang khoá có chain; giao diện chỉ kết xuất state có khoá trùng lựa chọn hiện tại.
- Mỗi effect có cờ huỷ hoặc `AbortController`; mutation giữ khoá lúc gửi và chỉ refresh khi khoá còn
  hoạt động.
- Các màn đã đúng từ trước không bị viết lại. Sidebar không hiển thị số của chain trước trong lúc
  chờ chain mới.

### 3.2 Lập–duyệt không thể đi nhầm chain

- Schema list/detail/approve/reject bắt buộc chain.
- Danh sách, thống kê và badge menu truyền chain xuống service/store.
- URL chi tiết trực tiếp của yêu cầu thuộc chain khác trả `REQUEST_CHECK` nêu cả chain yêu cầu và
  chain đang chọn; approve/reject kiểm lại trước mọi thay đổi trạng thái.

### 3.3 Lọc phía máy chủ và Postgres

- `listTokenRequests`, thống kê Lập/Duyệt và số việc chờ nhận chain.
- `ITokenRequestStore.countRequests` nhận chain; cả memory/Postgres áp cùng điều kiện.
- Postgres thêm mệnh đề `chain = ...` vào cả list/count thay vì tải toàn bộ rồi lọc ở giao diện.

### 3.4 Giá phát hành độc lập theo chain

- Chọn khoá ghép `wpt.issue_price_vnd.<chain>` thay vì thêm cột: cổng cấu hình hiện nhận khoá chuỗi,
  nên không đổi schema/chữ ký store và lịch sử cấu hình tự tách theo khoá.
- `readIssuePriceVnd(chain)`, `getIssuePrice(chain)` và `setIssuePrice` đều dùng chain đã chọn.
- Seed sinh giá mặc định cho mọi phần tử `CHAIN_ORDER`; factory mock đóng chain vào callback nạp giá.
- Giữ thứ tự BE-04: đẩy giá xuống ledger trước, ghi DB sau; ledger không hỗ trợ vẫn trả hành vi hiện có.

## 4. Sai lệch và quyết định

- **Hiện trạng trong spec dùng SHA cũ.** Đã đo lại tại `89a10a3` theo yêu cầu Owner; kết quả ở mục 1.
- **Không migration dữ liệu cũ.** Đúng quyết định OP-07/FE-27: database được reset; seed tạo khoá theo
  chain mới.
- Không mở rộng dashboard/assets/reconciliation tĩnh thành service mới. Chúng ghi rõ dữ liệu minh hoạ
  hoặc nguồn chưa nối; FE-27 chỉ sửa dữ liệu nghiệp vụ đã có nguồn chain.

## 5. Kiểm chứng

### 5.1 Typecheck và kiểm thử nghiệp vụ hẹp

```bash
$ cd app && npm run typecheck
PASS

$ cd app && npx vitest run test/token-request.test.ts test/maker-checker-ui.test.ts \
  test/store-constraints.test.ts test/four-roles.test.ts
Test Files  4 passed (4)
Tests       193 passed (193)

$ cd app && npx vitest run test/config-service.test.ts test/demo-payment.test.ts \
  test/store-constraints.test.ts
Test Files  3 passed (3)
Tests       169 passed (169)
```

Các ca mới chốt: list/count tách chain; URL chi tiết lệch chain không duyệt được; seed đủ
`CHAIN_ORDER`; đổi giá một chain không đổi chain khác.

### 5.2 E2E đổi chain trên bốn màn

```bash
$ cd app && E2E_BASE_URL=http://localhost:3000 \
  npx playwright test e2e/chain-scope.spec.ts
1 passed
```

Ca đi qua Lập lệnh, Duyệt, Giao dịch vận hành và Tổng quan người bán; mỗi màn đổi `mock` sang
`hardhat-local` và xác nhận phạm vi hiển thị đổi theo selector.

### 5.3 E2E phản hồi chậm

```bash
$ cd app && E2E_BASE_URL=http://localhost:3000 \
  npx playwright test e2e/token-info-read.spec.ts
3 passed
```

Ca FE-27 giữ request `mock`, chuyển sang `hardhat-local`, cho phản hồi mới về trước rồi mới thả
phản hồi cũ; nội dung cũ không ghi đè.

### 5.4 Bộ Hardhat và bộ mặc định

```bash
$ bash scripts/run-local-all.sh evm
PASS  EVM - BUILD BẢN HARDHAT
PASS  EVM - DỰNG CHUỖI MỚI
PASS  EVM - E2E PROJECT HARDHAT
16 passed · 2 skipped

$ bash scripts/run-local-all.sh
PASS  luật kiến trúc (có 3 cảnh báo đã biết)
PASS  LỚP 3 - ĐIỂM CẮM (marker)
PASS  LỚP 3 - KHUÔN CHECKPOINT
PASS  LỚP 1 - SPEC TEST CONTRACT EVM — 84 passing
PASS  APP - TYPECHECK
PASS  APP - LINT
PASS  APP - VITEST — 834 passed · 17 skipped
Tổng kết: 7 PASS · 0 FAIL
```

Project Hardhat chạy cả ca đổi chain FE-27 trên bản production build và node vừa deploy. Lượt bộ mặc
định đầu phát hiện riêng khối điểm cắm sinh tự động lệch số dòng sau khi action config đổi chữ ký;
`node scripts/scan-pending.mjs --write-report` đã sinh lại, ca hẹp `pending-markers.test.ts` đạt
24/24, và lượt cổng cuối ở trên xanh toàn bộ.

## 6. Tự đánh giá ba luật kiến trúc

- [x] Mọi call chain qua `ILedgerPort`; FE-27 không gọi SDK chain từ component/service.
- [x] Mọi ký qua `ISigner`; FE-27 không thêm đường ký.
- [x] Mọi kiểm quyền qua RBAC; service lập–duyệt vẫn dùng `authorize`/`assertCan`.

## 7. Tài liệu và trạng thái

- `docs/tech-report.md`: cập nhật metadata, config/chain, lập–duyệt và mục FE-27.
- `.kiro/task-status.json`: FE-27 được chuyển sang `done` trong commit bàn giao.
- Không có marker `@pending FE-27` hoặc `@blocked FE-27` cần dọn:

```bash
$ rg -n "@(pending|blocked) FE-27" app/src packages scripts
# không có kết quả
```


## 8. Bổ sung sau review Supervisor — 15/10/2026

- Thêm ca gọi `rejectTokenRequest` bằng `hardhat-local` cho yêu cầu của `mock`: trả
  `REQUEST_CHECK`, thông báo nêu hai chain và bản ghi vẫn `PENDING`, chưa có lý do từ chối.
  Không đổi service hoặc luật nghiệp vụ; chốt từ chối sai chain đã có sẵn.
- Runbook làm mới Neon trong `DEPLOYMENT.md` cấp lại quyền ngay sau `CREATE SCHEMA public`:
  `GRANT ALL ON SCHEMA public TO "<role ứng dụng>"` và `GRANT USAGE ON SCHEMA public TO PUBLIC`.
  Ghi rõ không dùng `ALTER SCHEMA ... OWNER` vì Neon có thể báo `must be able to SET ROLE`.
  Đồng bộ hướng dẫn khởi tạo Neon trong DEPLOYMENT/guide để không còn lệnh đổi chủ mâu thuẫn.
- Ghi nhận không chặn merge: menu trái thêm lượt đếm việc chờ khi chuyển trang. Chấp nhận trên gói
  Paid hiện tại; nếu số đo sau này cho thấy chậm thì tối ưu. Lượt này không đổi mã sidebar.
- Giữ trạng thái bàn giao chờ Supervisor kiểm lại hai điểm trước khi đề xuất merge; không tự merge.

### 8.1 Kiểm thử phần sửa

Chạy từ `app/`, mã thoát 0:

```bash
npx vitest run test/maker-checker-ui.test.ts > /tmp/fe27-review-focused.log 2>&1
```

```text

 RUN  v3.2.4 /home/tuanlh/.codex/worktrees/03a6/bidv-rwa-tokenize/app

 ✓ test/maker-checker-ui.test.ts (34 tests) 251ms

 Test Files  1 passed (1)
      Tests  34 passed (34)
   Start at  09:04:55
   Duration  977ms (transform 302ms, setup 0ms, collect 506ms, tests 251ms, environment 0ms, prepare 119ms)
```

### 8.2 Bộ kiểm cuối

Chạy từ gốc repo, mã thoát 0. Chỉ trích các dòng kết quả, bỏ tiến độ và bảng marker lặp;
đầu ra của lệnh lọc giữ nguyên văn:

```bash
bash scripts/run-local-all.sh > /tmp/fe27-review-all.log 2>&1
rg '84 passing|PASS: APP|Test Files|Tests |Đạt:|Không đạt:' /tmp/fe27-review-all.log > /tmp/fe27-review-all-summary.log
```

```text
  84 passing (1s)
[32m  => PASS: APP - TYPECHECK[0m
[32m  => PASS: APP - LINT[0m
 Test Files  39 passed | 2 skipped (41)
      Tests  835 passed | 17 skipped (852)
[32m  => PASS: APP - VITEST[0m
  Đạt:     7
  Không đạt: 0
```
