# FIX-04: nối dữ liệu thật cho màn Nhà đầu tư, Người bán, Tài khoản; ghi chú "unverified"

| | |
|---|---|
| Nhánh | `fix/fix-04-noi-du-lieu-that` từ `dev` mới nhất (sau khi merge FIX-03 (chuẩn hoá chuỗi hiển thị trong `lib/`)) |
| Loại | Backend CHỈ ĐỌC (2 điểm, mục 3) và frontend. Không ghi dữ liệu, không đổi lược đồ, không đổi quyền, không thêm action |
| Một PR | Không push lên `dev`, không merge |
| Nguồn | Project doc `20261102_man_du_lieu_mau.md` (rà 28 màn, Sếp chốt 02/11) |

## 1. Mục tiêu

1. Màn đang hiện số mẫu trong khi hệ thống ĐÃ có dữ liệu thật thì hiện dữ liệu thật: số dư VNDB và tên dự án (Tổng quan Nhà đầu tư), lệnh bán trong ngày (Tổng quan Người bán).
2. Khối không có nguồn dữ liệu thật trong hệ thống (sản lượng, công suất, tổ máy, giá PPA, vùng, vị trí, trạng thái vận hành, số nhà đầu tư nắm giữ, hai dự án Phú Quý và Ninh Thuận, hồ sơ tài khoản mẫu) giữ nguyên số mẫu nhưng ghi chú chữ chìm **"unverified"** (Sếp chốt), thay nhãn "dữ liệu mẫu" cũ; sửa chỗ gắn nhãn sai (số mẫu đứng dưới nhãn "on-chain").

Phạm vi task này: `/portfolio`, `/tokens/[symbol]`, `/seller`, `/account`. Màn Tổng quan (`/`, thiết kế lại 6 cụm), `/assets`, `/kyc`, `/reconciliation` thuộc FIX-05 (nối dữ liệu thật cho màn tổng hợp vận hành) vì cần nguồn đọc mới phía máy chủ và thiết kế lại màn, rủi ro khác hẳn.

**Không làm trong task này: số nhà đầu tư nắm giữ thật.** Nguồn duy nhất là chỉ mục sự kiện (`listTokenWallets`); trên chain EVM, mỗi lần đọc có thể kéo Indexer đồng bộ và GHI bộ đệm chỉ mục vào database (`lib/indexer/event-index.ts:144-160`, `commitSegment`), lâu khi chỉ mục đã cũ. Không còn là "chỉ đọc", nên tách ra, chờ Sếp duyệt riêng. Trong task này ô số người nắm giữ giữ số mẫu kèm "unverified".

## 2. Quyết định (QĐ)

- **QĐ-1. Chỉ đọc.** Mọi thay đổi backend chỉ ĐỌC dữ liệu đã có (chuỗi, database), không kích hoạt đồng bộ Indexer. Không ghi, không đổi lược đồ, không thêm quyền, không thêm server action, không đổi tên hay tham số action.
- **QĐ-2. Không tăng số lời gọi khi mở màn** (điều kiện của HF-01 (hiệu năng mở màn) đã sửa). Dữ liệu mới đi theo lời gọi màn ĐANG có. Riêng Tổng quan Nhà đầu tư: hai hộp cùng cần `getTokenSummaryAction` thì dùng chung MỘT lời gọi (mục 4, F2).
- **QĐ-3. Đọc thêm lỗi thì không kéo cả hộp đổ.** Trường đọc thêm có giá trị `null` khi đọc lỗi (log máy chủ chỉ ghi tên lỗi, không ghi nội dung lỗi vì có thể chứa địa chỉ RPC kèm khoá); giao diện hiện "Chưa đọc được", phần còn lại của hộp vẫn hiện như trước.
- **QĐ-4. "unverified".** Một component dùng chung `UnverifiedNote` (`components/ui/unverified-note.tsx`): chữ thường "unverified", cỡ `text-xs`, màu `text-muted-foreground`, `title` nêu lý do (mặc định "Chưa có nguồn dữ liệu thật trong hệ thống"). Thay MỌI chỗ dùng `MockBadge` hiện có (3 tệp), rồi xoá `MockBadge` khỏi `components/investor/mock-badge.tsx` (giữ `OnChainBadge`). FIX-05 dùng lại component này.
- **QĐ-5.** Tên dự án ở trang chi tiết token, mã dự án, vùng, vị trí, trạng thái vận hành vẫn lấy từ `lib/mock-data.ts` (chưa có nguồn thật; trang chi tiết không gọi `getTokenSummaryAction`), chỉ thêm ghi chú. Không sửa `lib/mock-data.ts`. Chấp nhận: tên dự án ở Tổng quan Nhà đầu tư (bảng dự án, ví dụ "Dự án điện gió An Viên") có thể khác tên ở trang chi tiết (mẫu, "Điện gió An Viên"); ghi vào checkpoint.

## 3. Thay đổi backend (báo cáo để Sếp duyệt)

| # | Tệp | Thay đổi | Lý do |
|---|---|---|---|
| B1 | `lib/bank/portfolio.service.ts`, `getPortfolio` | `PortfolioView` thêm `paymentBalance: string \| null`: đọc `ledger.paymentBalanceOf(wallet)` trong CÙNG lô `Promise.all` đang có; lỗi riêng lần đọc này thì `null` (QĐ-3). Xoá chú thích cũ "KHÔNG có trường số dư VNDB..." (dòng 71-76) | Bỏ câu "Số dư VNDB chưa hiển thị được... (chờ BE-01)": BE-01 (cổng đọc số dư VNDB trên ledger) đã có `paymentBalanceOf` (`ledger.port.ts:285`), màn Giao dịch token đang dùng (`trade.service.ts:164`) |
| B2 | `lib/bank/portfolio.service.ts`, `getTokenSummary` | `TokenSummary` thêm `projectName: string \| null` (từ `getProjectStore().findProject({ tokenSymbol: info.symbol, chain })`, một truy vấn đọc bảng dự án); không có dòng hoặc lỗi thì `null` (QĐ-3) | Tên dự án thật thay tên mẫu |

`recall.service.ts`, `lib/indexer/**`, `lib/ledger/**` KHÔNG đổi.

### 3.1. Đánh giá an toàn

| Khía cạnh | Đánh giá |
|---|---|
| Ghi dữ liệu | Không. `paymentBalanceOf` là lời gọi đọc hợp đồng; `findProject` là truy vấn đọc. Không chạm Indexer |
| Lược đồ, hợp đồng, quyền | Không đổi. B1, B2 nằm sau đúng `authorize('portfolio:read', ...)` và `assertSessionWallet` (B1) đang có |
| Hành vi cũ | Trường cũ giữ nguyên tên, kiểu, giá trị; chỉ THÊM trường. Hai kiểu chỉ được client dùng làm kiểu, thêm trường không làm hỏng chỗ dùng cũ. Đọc thêm lỗi thì trường mới `null`, không làm lời gọi cũ thất bại (QĐ-3) |
| Số lời gọi khi mở màn | Không tăng (QĐ-2) |
| Hiệu năng | B1: thêm 1 lần đọc chuỗi, chạy song song trong lô đang có. B2: thêm 1 truy vấn bảng dự án sau `tokenInfo`. Đo thời gian trả lời hai action trước và sau trên hardhat cục bộ, ghi checkpoint; tăng quá 300 ms thì báo Supervisor trước khi mở PR. Giới hạn chấp nhận: `orNull` chỉ bắt lỗi, KHÔNG giới hạn thời gian chờ; RPC treo thì cả lô chờ. Không thêm timeout (thêm là đổi backend nhiều hơn), vì `paymentBalanceOf` đi cùng RPC với `balanceOf` đang có sẵn trong lô: RPC treo thì hôm nay lời gọi cũng đã treo, B1 không tạo kiểu hỏng mới. Dev kiểm một lần trên chain mock: cho `paymentBalanceOf` chậm 2 giây, ghi vào checkpoint thời gian `getPortfolio` (kỳ vọng khoảng 2 giây) |
| Dữ liệu cũ | Không chạm |
| Hoàn tác | Revert commit, không migration |

Mức rủi ro: **Thấp.**

## 4. Thay đổi frontend

| # | Màn, tệp | Thay đổi |
|---|---|---|
| F1 | `/portfolio`, `components/investor/asset-summary.tsx` | Bỏ đoạn "Số dư VNDB chưa hiển thị được..." (chú thích R5.4 (yêu cầu cũ về số dư VNDB) và đoạn chữ, dòng 156-164); hiện dòng "Số dư VNDB" với `paymentBalance` định dạng như số dư WPT; `null` thì "Chưa đọc được số dư VNDB". Bỏ import không còn dùng |
| F2 | `/portfolio`, mới `components/investor/use-token-summary.ts` và `components/investor/token-summary-state.ts` | Hook client `useTokenSummary(chain)` dùng chung cho `issuance-status-box.tsx` và `token-list-box.tsx`: hai hộp cùng gọi thì chỉ MỘT lời gọi `getTokenSummaryAction` cho mỗi chain (gộp lời gọi đang chạy). Logic tách thành tệp thuần `token-summary-state.ts` (`shareInflight`, `loadTokenSummary`, `freshFor`, `projectNameView`) để test. Lời gọi bị reject (lỗi mạng, phản hồi hỏng) thì cả hai hộp thoát trạng thái tải, hiện câu an toàn `LOAD_FAILED`; kết quả của chain cũ không ghi đè chain mới; component đã unmount không cập nhật state. Hai hộp KHÔNG import `getTokenSummaryAction` trực tiếp |
| F3 | `/portfolio`, `issuance-status-box.tsx` | Dùng `useTokenSummary`, bỏ import không còn dùng. Dòng "Dự án" hiện `projectName` thật (bỏ nhãn mẫu); `null` thì "Chưa đọc được". Dòng "Trạng thái vận hành" giữ giá trị mẫu, nhãn đổi thành `UnverifiedNote` |
| F4 | `/portfolio`, `token-list-box.tsx` (đã là client) | Dùng `useTokenSummary`. Dòng token đã lên chuỗi: tên dự án lấy `projectName`; đang tải, lỗi hoặc `null` thì hiện tên mẫu KÈM `UnverifiedNote` ngay cạnh tên (`title` "Tên mẫu, chưa đọc được tên dự án trong hệ thống"), dùng hàm thuần `projectNameView` (design mục 2). Ô "nhà đầu tư nắm giữ" của dòng này giữ số mẫu, thêm `UnverifiedNote` (`title` "Chưa đếm được người nắm giữ thật"). Dòng vùng và trạng thái của MỌI dòng: thêm `UnverifiedNote`. Hai dòng dự án mẫu: `MockBadge` thay bằng `UnverifiedNote` (giữ `title` "Dự án chưa triển khai token trên chuỗi"), các ô bên trong không thêm ghi chú nữa. Viết lại chú thích đầu tệp (dòng 15-24) cho đúng hiện trạng |
| F5 | `/tokens/[symbol]`, `components/pages/investor-token-detail.tsx` | Dòng phụ dưới tiêu đề (vùng, vị trí, trạng thái, dòng 89-92): thêm `UnverifiedNote` cuối dòng. Thẻ "Thông tin dự án" và "Tình hình vận hành" (và biểu đồ sản lượng trong thẻ đó): `MockBadge` thay bằng `UnverifiedNote`. Thẻ "Thông tin token" của dự án chưa lên chuỗi: `MockBadge` thay bằng `UnverifiedNote`. Dòng "WPT dự kiến phát hành" (số mẫu, dòng 192-195, hiện khi chưa có dữ liệu ví): thêm `UnverifiedNote` ngay trong dòng đó (sửa lỗi số mẫu đứng dưới nhãn "on-chain") |
| F6 | `/seller`, `components/pages/seller-overview.tsx:157-158` | "Số lượng bán", "Tổng giá trị bán" hiện `data.today.sell.wpt` (đơn vị WPT, gợi ý `${data.today.sell.count} lệnh`) và `data.today.sell.vnd` (VNDB), cùng cách hiện như hai ô "mua" ngay bên trái; bỏ câu "Hệ thống chưa có lệnh bán lại." |
| F7 | `/account`, `components/pages/account-info.tsx` | Hồ sơ lấy từ `SAMPLE_ACCOUNT_PROFILES` (chưa có kho người dùng, chờ AU-01 (đăng nhập và tài khoản thật)). `Section` thêm prop tuỳ chọn `note?: React.ReactNode` hiện cạnh tiêu đề. Gắn `UnverifiedNote` (`title` "Hồ sơ mẫu, chưa có kho người dùng") cho CẢ 4 khối: "Thông tin cá nhân/pháp nhân", "Thông tin tài khoản", "Hồ sơ định danh và rủi ro", "Thông tin cán bộ". Riêng khối cá nhân/pháp nhân, `title` là "Hồ sơ mẫu, chưa có kho người dùng; riêng Ví thanh toán lấy từ ví kết nối và trạng thái định danh trong hệ thống" (địa chỉ từ wagmi, trên chain mock là ví mẫu; trạng thái từ `WalletBinding`; không đọc chuỗi). Trường "Ví thanh toán" giữ nguyên |
| F8 | mới `components/ui/unverified-note.tsx`; `components/investor/mock-badge.tsx` | QĐ-4. Bỏ import `FlaskConical` khi xoá `MockBadge` |

Câu chữ mới viết đúng như bảng; không thêm câu khác. Không ký tự cấm.

## 5. Phạm vi tệp

Được sửa: `lib/bank/portfolio.service.ts`, các tệp ở mục 4, test (mục 6), tài liệu (mục 7).

Không được sửa: mọi tệp khác trong `lib/**` (gồm `lib/mock-data.ts`, `lib/bank/recall.service.ts`, `lib/indexer/**`, `lib/ledger/**`, `lib/store/**`), `app/src/app/actions/**`, `app/src/app/api/**`, `app/prisma/**`, `packages/**`, `scripts/**`, `app/wrangler.json`, `.env*`. Lệnh kiểm ở tasks bước 6.

## 6. Kiểm thử

**Mức kiểm thử: B** (frontend và backend chỉ đọc; quy định mức ở tasks bước 6). Chỉ chạy đúng phần dưới, không chạy toàn bộ e2e, không chạy e2e hardhat.

Test cũ phải đổi vì hành vi đổi có chủ đích (ghi vào checkpoint):

- `test/portfolio-service.test.ts:118` ("KHÔNG có trường số dư VNDB (chờ BE-01)"): đổi thành kiểm `paymentBalance` bằng đúng số dư VNDB của ví trên ledger mock.
- `e2e/investor-channel.spec.ts:302-308` ("Nhãn dữ liệu mẫu", tìm chữ "dữ liệu mẫu"): đổi thành tìm "unverified".
- Test khác đỏ do đổi chữ thì chỉ sửa chuỗi mong đợi, ghi tên test và lý do vào checkpoint.

Vitest mới `app/test/fix-04-noi-du-lieu-that.test.ts`:

| Ca | Nội dung |
|---|---|
| 1 | `getPortfolio` (chain mock, ví đã gắn, ví có VNDB khác 0): `paymentBalance` bằng `paymentBalanceOf` của ví; các trường cũ không đổi so với trước |
| 2 | `getPortfolio` khi `paymentBalanceOf` ném (bọc ledger bằng `vi.mock` như các test có sẵn): lời gọi vẫn `ok`, `paymentBalance === null`, `balance` vẫn đúng |
| 3 | `getTokenSummary` (mock): `projectName` đúng tên trong bảng dự án; các trường cũ không đổi |
| 4 | `getTokenSummary` khi `findProject` ném: vẫn `ok`, `projectName === null`, các trường khác đúng; khi bảng dự án không có dòng: `projectName === null` |
| 5 | `getTokenSummary` không chạy khi không có quyền `portfolio:read` (giữ nguyên cổng như trước) |
| 6 | `shareInflight`, `loadTokenSummary`, `freshFor` (tệp `token-summary-state.ts`): (a) hai lần gọi cùng chain lúc lời gọi đầu đang chạy thì `call` chạy MỘT lần, cả hai nhận cùng kết quả; khoá khác chạy riêng; (b) `call` reject: cả hai lần gọi đang chờ đều trả `{ data: null, error: LOAD_FAILED }`, không reject; (c) sau khi reject, gọi lại thì `call` chạy lần mới và trả kết quả mới; (d) `freshFor("hardhat-local", kết quả key "mock")` là `null` |
| 6b | `projectNameView`: có `projectName` thì `{ text: tên thật, unverified: false }`; `fresh` là `null` (đang tải), `data` là `null` (lỗi), `projectName` là `null` thì đều `{ text: tên mẫu, unverified: true }` |
| 7 | Quét mã: không còn `MockBadge` trong `app/src`; `UnverifiedNote` có mặt ở `issuance-status-box.tsx`, `token-list-box.tsx`, `investor-token-detail.tsx`, `account-info.tsx`; trong `investor-token-detail.tsx`, khối JSX của dòng `label="WPT dự kiến phát hành"` chứa `<UnverifiedNote`; `account-info.tsx` có đúng 4 lần `note={<UnverifiedNote`; `issuance-status-box.tsx` và `token-list-box.tsx` không import `getTokenSummaryAction`; `asset-summary.tsx` không còn "chờ BE-01"; `seller-overview.tsx` không còn "Hệ thống chưa có lệnh bán lại" |
| 8 | Log không lộ nội dung lỗi: cho `paymentBalanceOf` ném lỗi có chuỗi `https://rpc.example/KEY123`, bắt `console.error`, kiểm không tham số log nào chứa `KEY123` |

E2E mới `app/e2e/fix-04-noi-du-lieu-that.spec.ts` (chain mock):

- Nhà đầu tư: `/portfolio` không còn "chờ BE-01"; hộp Trạng thái phát hành hiện tên dự án từ bảng dự án (không phải "Chưa đọc được"); có chữ "unverified".
- Đếm lời gọi server action khi mở `/portfolio`, `/seller`, `/account` theo cách `e2e/recall.spec.ts:84-91` (đếm POST có header `next-action` tới `networkidle`): không tăng so với `dev`; ghi số trước và sau vào checkpoint.
- Người bán: `/seller` không còn "Hệ thống chưa có lệnh bán lại."; ô "Số lượng bán" hiện số.
- `/account`: có "unverified" cạnh tiêu đề khối hồ sơ.
- Lời gọi bị reject: chặn request `getTokenSummaryAction` bằng `page.route` (abort POST có header `next-action` khi mở `/portfolio`): hộp Trạng thái phát hành và Danh sách token đều hết "Đang tải" trong 10 giây; dòng token thật hiện tên mẫu kèm "unverified"; bỏ chặn, tải lại thì hiện tên dự án thật.

Số dư VNDB ở `/portfolio` cần ví kết nối qua wagmi, chain mock không có ví: kiểm bằng vitest ca 1, ca 2 và ảnh chụp trên hardhat (mục 9), không viết e2e mock cho phần này.

## 7. Tài liệu

- `docs/CHECKPOINT_FIX04.md`: "Phạm vi: backend chỉ đọc (B1, B2) và frontend"; số đo hiệu năng trước và sau (mục 3.1); số lời gọi khi mở 4 màn trước và sau; thời gian `getPortfolio` khi `paymentBalanceOf` chậm 2 giây (giới hạn đã chấp nhận, mục 3.1); tên dự án hai nơi có thể khác (QĐ-5); test cũ đã đổi kèm lý do; đột biến.
- `docs/USER_GUIDE.md`: số dư VNDB ở Tổng quan Nhà đầu tư; ý nghĩa ghi chú "unverified".
- `.kiro/task-status.json`.

## 8. Đột biến bắt buộc (10 cái, ghi ca đỏ)

1. B1 đọc lỗi thì ném cả `getPortfolio` (bỏ `orNull`): ca 2 đỏ.
2. B2 `findProject` lỗi thì ném cả `getTokenSummary`: ca 4 đỏ.
3. `orNull` ghi `error.message`: ca 8 đỏ.
4. `shareInflight` không gộp (mỗi lần gọi đều chạy `run`): ca 6 đỏ.
5. `issuance-status-box.tsx` gọi thẳng `getTokenSummaryAction` thay vì dùng hook: ca 7 đỏ.
6. Bỏ `UnverifiedNote` ở dòng "WPT dự kiến phát hành": ca 7 đỏ.
7. `seller-overview.tsx` vẫn hiện câu "Hệ thống chưa có lệnh bán lại.": ca 7 và e2e đỏ.
8. Bỏ `note` ở một khối của `account-info.tsx`: ca 7 đỏ.
9. `loadTokenSummary` bỏ `try/catch`: ca 6 (b) và e2e lời gọi bị reject đỏ.
10. `projectNameView` trả `unverified: false` khi dùng tên mẫu: ca 6b đỏ.

## 9. Điều kiện hoàn thành

- [ ] B1, B2 đúng mục 3; F1 tới F8 đúng mục 4; `recall.service.ts`, `lib/indexer/**`, `lib/ledger/**` không đổi.
- [ ] Không tăng số lời gọi khi mở `/portfolio`, `/tokens/[symbol]`, `/seller`, `/account` (số trước và sau trong checkpoint).
- [ ] Số đo hiệu năng hai action trong checkpoint; không tăng quá 300 ms (hoặc đã báo Supervisor).
- [ ] `git diff --name-only` chỉ có tệp ở mục 5; lệnh kiểm tệp cấm rỗng.
- [ ] Typecheck, lint (0 lỗi, không cảnh báo mới), vitest (cả Postgres) xanh; 5 tệp e2e ở tasks bước 6 xanh trên chain mock; 10 đột biến bị bắt.
- [ ] Ảnh `/portfolio` (hardhat, có ví, thấy Số dư VNDB), `/tokens/WPT`, `/seller`, `/account` (Sáng) ở `docs/screenshots/fix-04/`.
- [ ] Không ký tự cấm trong chữ mới thêm.
