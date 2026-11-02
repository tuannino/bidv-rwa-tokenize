# UIUX-02: đầu màn: ô chọn token, bỏ dòng mô tả, gợi ý trên menu; ghi nợ kỹ thuật đa token

| | |
|---|---|
| Nhánh | `feat/uiux-02-dau-man` từ `dev` @ `67ece1e` (hoặc `dev` mới nhất nếu đã merge `docs/ui-ux-ban-chot`) |
| Loại | Chỉ frontend và tài liệu. **Không sửa backend** |
| Một PR | Không push lên `dev`, không merge |

## 1. Mục tiêu

1. Thể hiện định hướng "hệ thống hỗ trợ nhiều loại token, nhiều dự án" trên giao diện: 10 màn nghiệp vụ thao tác trên token dự án (mục 3) có một ô chọn token ở đầu màn. Hiện chỉ chọn được token đang chạy (WPT); dòng thứ hai là TCC kèm thẻ "(chưa hỗ trợ)" chữ mờ, không chọn được. Người dùng bấm để xổ danh sách hoặc gõ mã token để lọc.
2. Ghi nợ kỹ thuật đa token thành tài liệu riêng và trỏ từ `docs/tech-report.md`.
3. Mọi màn bỏ dòng mô tả dưới tiêu đề (subtitle). Mô tả chức năng màn, viết lại ngắn gọn, thành gợi ý hiện khi dừng chuột khoảng 3 giây trên mục menu tương ứng (màn không có trong menu: trên tiêu đề màn). Tiêu đề màn "Tổng quan điện gió" đổi thành "Tổng quan"; mục menu vẫn giữ tên "Bảng điều khiển".

Ô chọn **chỉ để hiển thị**: không đổi dữ liệu, không thêm lời gọi, không gửi mã token đi đâu. Việc nối thật thuộc nợ MT-05 (bỏ chọn dự án ngầm, mọi action nhận mã token).

## 2. Quyết định

- **QĐ-1.** Một component dùng chung `TokenScopeSelect` dạng **ô chọn có gõ lọc** (combobox): bấm vào thì xổ danh sách token; người dùng cũng gõ được mã token, mỗi ký tự gõ vào lọc danh sách, dòng khớp nhất lên đầu. Tự viết, không thêm gói npm. Component này sẽ là nền cho dropdown của đợt làm mới giao diện, nên viết gọn, đúng chuẩn trợ năng.
- **QĐ-2.** Danh sách: các token thật (mặc định một dòng `WPT_TOKEN_SYMBOL` từ `lib/config/issue-terms.ts`), rồi luôn có thêm dòng `TCC` kèm thẻ "(chưa hỗ trợ)": thẻ chữ mờ (`text-muted-foreground`), cả dòng `aria-disabled="true"`, con trỏ `not-allowed`, KHÔNG chọn được bằng chuột hay bàn phím; `title` "Tokenized Carbon Credit, chưa hỗ trợ trong PoC".
- **QĐ-2b. Quy tắc lọc** (hàm thuần `tokenScopeOptions(tokens, query)`, xuất ra để test): bỏ khoảng trắng hai đầu, không phân biệt hoa thường. Truy vấn rỗng: đủ danh sách theo thứ tự gốc. Có truy vấn: giữ dòng mà mã token BẮT ĐẦU bằng truy vấn (hạng 0), mã CHỨA truy vấn (hạng 1), hoặc tên dự án hay tên loại token chứa truy vấn (hạng 2); sắp theo hạng, cùng hạng giữ thứ tự gốc. Không dòng nào khớp: hiện một dòng "Không có token khớp" (không chọn được).
- **QĐ-2c. Bàn phím, chuột:** vào ô (Tab) hoặc bấm vào ô thì chọn sẵn toàn bộ chữ, gõ là thay chứ không nối; bấm vào ô thì mở đủ danh sách. Từ trạng thái ĐÓNG, mũi tên xuống mở danh sách và trỏ dòng chọn được đầu tiên. Mũi tên lên, xuống đi qua các dòng chọn được (bỏ qua dòng khoá); tiêu điểm luôn ở ô nhập, dòng đang trỏ báo bằng `aria-activedescendant`. Enter chọn dòng đang trỏ; chưa trỏ dòng nào thì chọn dòng chọn được đầu tiên (khớp nhất); không có dòng chọn được thì không làm gì, danh sách vẫn mở. Esc đóng và trả chữ về token đang chọn; rời ô (blur, bấm ra ngoài) cũng vậy: chữ gõ dở mà không chọn thì bỏ. Bấm chuột vào dòng chọn được thì chọn và đóng.
- **QĐ-3.** Ô KHÔNG bao giờ bị khoá vì chỉ có một token: người dùng phải mở được để thấy dòng TCC. Chỉ khoá khi màn truyền `disabled` vì lý do nghiệp vụ có sẵn (màn Giao dịch token khi giao dịch tạm dừng).
- **QĐ-3b.** Danh sách token truyền vào rỗng (vd `/trade` trên chain chưa có dự án, `ctx.tokens = []`): ô trống, gợi ý (`placeholder`) "Chưa có token"; danh sách chỉ có dòng TCC khoá; KHÔNG tự điền WPT.
- **QĐ-3c. Truy vấn và đồng bộ props:** chữ người dùng GÕ (truy vấn) tách khỏi token đang chọn: vừa mở thì hiện đủ danh sách; đã gõ thì luôn lọc theo đúng chữ đã gõ, kể cả khi chữ đó trùng token đang chọn (gõ `WPT` hay `wpt` chỉ còn WPT). Props đổi từ bên ngoài thì đóng danh sách, bỏ dòng đang trỏ, xoá truy vấn rồi: `value` đổi thì chọn theo `value` mới; `tokens` đổi thì giữ token đang chọn nếu còn trong danh sách, không thì lấy `value`, rồi token đầu tiên, rồi rỗng (`tokens = []` thì ô trống như QĐ-3b). `disabled` thành `true` khi danh sách đang mở: đóng ngay, bỏ dòng đang trỏ, mọi thao tác chuột và bàn phím sau đó không làm gì. Mọi chuyển trạng thái nằm trong hàm thuần `tokenScopeReducer` (xuất ra để test).
- **QĐ-4.** Component client (`'use client'`), chỉ giữ trạng thái GIAO DIỆN (đang mở, chữ đang gõ, dòng đang trỏ, token đang chọn). KHÔNG gọi dữ liệu, không gọi action, không đọc hay ghi URL, `localStorage`, cookie; chọn token khác không làm gì ngoài đổi chữ hiển thị (PoC chỉ chọn được một token). Dùng được bên trong component máy chủ (Tổng quan NĐT).
- **QĐ-5.** Trợ năng theo mẫu combobox của WAI-ARIA: ô nhập `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`; danh sách `role="listbox"`; mỗi dòng `role="option"`, `aria-selected`. Nhãn hiển thị "Token" gắn với ô bằng `htmlFor`/`id`. Màn Giao dịch token giữ `aria-label="Token"`.
- **QĐ-6.** Vị trí: một hàng riêng ngay sau khối tiêu đề ngoài cùng của màn (phần tử `header`, hoặc khối ngoài cùng chứa `h1` nếu màn không có `header`), trên mọi nội dung khác, rộng `w-full sm:w-72`. Không đặt vào trong hàng flex của tiêu đề. **Ngoại lệ duy nhất: `/trade`** giữ ô ở chỗ cũ trong thẻ "Đặt lệnh" (chỉ hiện khi đã có `ctx`), vì đó là ô có sẵn của biểu mẫu đặt lệnh.

## 3. Phạm vi màn

| Vai | Màn | Tệp | Token truyền vào |
|---|---|---|---|
| GDV | `/draft` Lập lệnh | `components/pages/draft.tsx` | mặc định |
| KSV | `/approvals` Phê duyệt lệnh | `components/pages/approvals.tsx` | mặc định |
| KSV, GDV | `/config` Giá và phát hành | `components/pages/price-config.tsx` | mặc định |
| KSV, GDV | `/vault` Vault thanh toán SPV | `components/pages/vault-status.tsx` | mặc định |
| KSV, GDV | `/distribution` Chia lợi nhuận | `components/pages/distribution-approval.tsx` | mặc định |
| KSV, GDV | `/recall` Thu hồi token | `components/pages/recall.tsx` | mặc định |
| NĐT | `/trade` Giao dịch token | `components/pages/investor-trade.tsx` | THAY ô `select` Token đang có (dòng 306-315): `tokens` từ `ctx.tokens`, giá trị `ctx.token?.tokenSymbol`, `disabled={tradeBlocked}` (bỏ điều kiện `ctx.tokens.length <= 1`, theo QĐ-3) |
| NĐT | `/portfolio` Tổng quan | `components/pages/investor-portfolio.tsx` | mặc định |
| NB | `/seller` Tổng quan | `components/pages/seller-overview.tsx` | mặc định |
| NB | `/seller/withdraw` Tạo lệnh rút | `components/pages/seller-withdraw.tsx` | mặc định |

**Không thêm ô chọn**, kèm lý do:

| Màn | Lý do |
|---|---|
| `/withdraw` Rút VNDB | VNDB là token thanh toán dùng chung mọi dự án, không thuộc một token dự án |
| `/transactions`, `/orders`, `/seller/transactions` (danh sách) | Danh sách sau này lọc theo token là việc của MT-05 (bỏ chọn dự án ngầm); thêm ô bây giờ dễ hiểu nhầm là bộ lọc |
| `/transactions/[id]`, `/approvals/[id]`, `/orders/[id]`, `/tokens/[symbol]` (chi tiết) | Bản ghi đã mang token của chính nó |
| `/`, `/assets`, `/kyc`, `/reconciliation`, `/audit`, `/mint`, `/demo-payment`, `/wallet-binding`, `/account`, `/wallet` | Màn tổng hợp, quản trị hoặc không thao tác trên một token dự án |

## 3b. Bỏ dòng mô tả, gợi ý trên menu

- **QĐ-7.** Xoá đoạn `<p>` mô tả ngay dưới `h1` ở 23 chỗ trong bảng dưới (số dòng theo `dev` @ `67ece1e`). Phần thay đổi theo dữ liệu trong các đoạn này (tên chain, câu đổi theo cờ cho phép bán, mốc "Cập nhật", "KYC ở chế độ mock") bỏ luôn, không chuyển đi đâu; chain đã hiện ở khối trạng thái mạng của thanh bên.

| Tệp | `h1` | Đoạn xoá |
|---|---|---|
| `components/pages/account-info.tsx` | 64 | 67-69 |
| `components/pages/approvals.tsx` | 62 | 63-67 |
| `components/pages/assets.tsx` | 67 | 68-71 |
| `components/pages/dashboard.tsx` | 56 | 57-60 |
| `components/pages/distribution-approval.tsx` | 403 | 404-407 |
| `components/pages/draft.tsx` | 144 | 145-148 |
| `components/pages/investor-orders.tsx` | 108 | 109 |
| `components/pages/investor-portfolio.tsx` | 19 | 20-23 |
| `components/pages/investor-trade.tsx` | 269 | 270-274 |
| `components/pages/investor-withdraw.tsx` | 256 | 257-260 |
| `components/pages/kyc.tsx` | 43 | 44-46 |
| `components/pages/mint.tsx` | 171 | 172-176 |
| `components/pages/ops-transactions.tsx` | 138 | 139-142 |
| `components/pages/price-config.tsx` | 434 | 435-437 |
| `components/pages/recall.tsx` | 147 | 148 |
| `components/pages/reconciliation.tsx` | 44 | 45-48 |
| `components/pages/seller-overview.tsx` | 129 | 130-133 |
| `components/pages/seller-transactions.tsx` | 126 | 127-129 |
| `components/pages/seller-withdraw.tsx` | 201 | 202-204 |
| `components/pages/vault-status.tsx` | 516 | 517-519 |
| `components/pages/wallet-binding.tsx` | 88 | 89-92 |
| `components/pages/wallet-connect.tsx` | 36 | 37-40 |
| `app/(ops)/audit/page.tsx` | 25 | 26-28 |

  GIỮ, không phải dòng mô tả: mã yêu cầu dưới tiêu đề Chi tiết yêu cầu (`approval-detail.tsx:176`, là dữ liệu); câu lỗi `role="alert"` ở `app/(account)/account/page.tsx:27`; dòng dữ liệu (vùng, địa điểm, trạng thái) dưới tiêu đề `investor-token-detail.tsx:89-91`; khối cảnh báo ở `demo-payment.tsx` (không phải dòng mô tả); màn chi tiết lệnh không có dòng mô tả.

  Biến chỉ dùng cho đoạn đã xoá thì xoá theo, ví dụ `mounted`, `updatedAt` và import `useIsMounted` ở `dashboard.tsx` (đồng hồ hiển thị phía trình duyệt, không đọc dữ liệu). KHÔNG xoá lời gọi đọc dữ liệu hay action nào; nếu một lời gọi chỉ còn phục vụ đoạn đã xoá thì GIỮ và ghi vào checkpoint để Supervisor quyết.

- **QĐ-8.** `NavItem` (`components/layout/nav-config.ts`) thêm trường bắt buộc `hint: string`. Mọi mục menu, kể cả `DEMO_PAYMENT_NAV_ITEM`, `WALLET_BINDING_NAV_ITEM`, mang đúng câu ở bảng dưới (chép nguyên văn):

| Vai | Mục menu | `hint` |
|---|---|---|
| NĐT | Tổng quan (`/portfolio`) | Xem số WPT đang giữ, tình trạng phát hành và các dự án đã token hoá. |
| NĐT | Giao dịch token | Đặt lệnh giao dịch WPT bằng VNDB theo giá phát hành. |
| NĐT | Quản lý lệnh | Theo dõi các lệnh đã đặt và trạng thái quyết toán. |
| NĐT | Rút VNDB | Chuyển VNDB từ ví của bạn sang ví nhận đã đăng ký, xác nhận bằng mã một lần. |
| NĐT, NB | Kết nối ví | Kết nối ví tự quản để xem tài sản và ký giao dịch. |
| NĐT, NB | Thông tin tài khoản | Xem hồ sơ và ví gắn với tài khoản đang đăng nhập. |
| GDV, KSV | Thông tin tài khoản | Xem hồ sơ cán bộ của tài khoản đang đăng nhập. |
| NB | Tổng quan (`/seller`) | Xem tình hình bán token, nguồn cung và số dư ví của người bán. |
| NB | Danh sách giao dịch | Xem lệnh mua bán đã khớp với ví người bán và các lệnh rút VNDB. |
| NB | Tạo lệnh rút | Rút VNDB từ vault thanh toán về ví nhận, xác nhận bằng mã một lần. |
| GDV, KSV | Bảng điều khiển (`/`) | Xem nhanh số liệu tổng hợp về dự án, token, nhà đầu tư và lợi tức. |
| GDV | Lập lệnh | Lập yêu cầu phát hành hoặc huỷ token để Kiểm soát viên duyệt. |
| GDV | Giao dịch | Theo dõi mọi lệnh mua bán và xử lý lệnh bị kẹt. |
| KSV | Giao dịch | Theo dõi mọi lệnh mua bán và bước quyết toán hiện tại. |
| GDV | Chia lợi nhuận (chỉ xem) | Xem các kỳ chia lợi nhuận và trạng thái chi trả. |
| KSV | Chia lợi nhuận | Duyệt số tiền của kỳ và chia lợi nhuận cho người nắm giữ WPT. |
| GDV | Vault thanh toán SPV | Xem lượng WPT, VNDB đang giữ và phần tiền bị khoá trong vault của SPV. |
| KSV | Vault thanh toán SPV | Xem số dư vault của SPV, đối soát lệnh rút và cấu hình mức khoá. |
| GDV | Giá và phát hành | Đặt giá phát hành WPT và theo dõi tình trạng phát hành. |
| KSV | Giá và phát hành | Xem giá phát hành WPT và tình trạng phát hành. |
| GDV | Thu hồi token (chỉ xem) | Xem lịch và trạng thái thu hồi WPT khi dự án hết hạn. |
| KSV | Thu hồi token | Lập lịch, đóng băng và thu hồi WPT khi dự án hết hạn. |
| KSV | Phê duyệt lệnh | Duyệt hoặc từ chối yêu cầu phát hành, huỷ token do Giao dịch viên lập. |
| GDV | Nạp VNDB | Nạp VNDB thử vào ví để trình diễn, chỉ dùng trong PoC. |
| GDV | Định danh ví | Định danh ví trên chuỗi và gắn ví vào hồ sơ khách hàng. |

  Màn không có trong menu, gợi ý đặt trên tiêu đề màn (`h1`):

| Màn | Tệp | Gợi ý |
|---|---|---|
| `/audit` Sổ kiểm toán | `app/(ops)/audit/page.tsx` | Xem lịch sử mọi thao tác và lần kiểm quyền trong hệ thống. |
| `/mint` | `components/pages/mint.tsx` | Phát hành WPT trực tiếp để tạo dữ liệu thử, chỉ dùng trong PoC. |
| `/assets` | `components/pages/assets.tsx` | Xem danh sách dự án điện gió đã token hoá. |
| `/kyc` | `components/pages/kyc.tsx` | Xem nhà đầu tư, trạng thái định danh và whitelist ví. |
| `/reconciliation` | `components/pages/reconciliation.tsx` | So khớp sản lượng điện, hoá đơn và số liệu trên chuỗi theo từng kỳ. |

- **QĐ-9.** Một component mỏng `HoverHint` (`components/layout/hover-hint.tsx`, client) dựng trên `components/ui/tooltip.tsx` CÓ SẴN (Base UI, hiện chưa màn nào dùng). Không viết tooltip mới, không thêm gói.
  - Hiện gợi ý sau **3000 ms** dừng chuột (`TooltipTrigger delay={3000}`); rời chuột thì ẩn ngay. Giữ tiêu điểm bàn phím thì Base UI hiện ngay (chấp nhận, tốt cho người dùng bàn phím).
  - Bong bóng nằm trong portal của Base UI nên vùng menu có `overflow-y-auto` không cắt mất; bên phải mục menu, bên dưới tiêu đề màn.
  - Trợ năng: câu gợi ý luôn có trong DOM ở một `span` `sr-only` đặt NGOÀI phần tử con (không đổi tên của liên kết menu hay tiêu đề, e2e tìm theo tên vẫn đúng); chính phần tử con (liên kết menu, `h1`) mang `aria-describedby` trỏ tới câu đó, nên trình đọc màn hình đọc ngay không cần chờ; bong bóng đặt `aria-hidden="true"` để không đọc hai lần.
  - Không gọi dữ liệu, không lưu gì. Màn hình cảm ứng không có gợi ý (chấp nhận).
  - Rời phần tử là ẩn, kể cả khi đưa chuột vào bong bóng (`<Tooltip disableHoverablePopup>`).
  - Ở chế độ duyệt, trình đọc màn hình có thể đọc câu `sr-only` thêm một lần như chữ thường (chấp nhận trong PoC).
  - Câu `sr-only` là chữ thật trong thanh bên, nên các bài e2e kiểm chữ của thanh bên (`investor-channel.spec.ts:153-187`, `getByRole('complementary')` có hoặc không chứa tên mục) và các `getByText` không `exact` cũng đọc thấy nó. Supervisor đã đối chiếu: câu ở bảng QĐ-8 không trùng chữ nào các bài đó tìm. Dev KHÔNG sửa câu gợi ý; muốn đổi thì báo Supervisor.
  - Dùng cho mục menu trong `sidebar.tsx` (chỉ nhánh `Link`; nhánh `disabled` dạng `div` KHÔNG bọc vì hiện không mục nào dùng, và giữ nguyên dòng `title` ở `sidebar.tsx:292`) và cho 5 tiêu đề ở bảng trên.
- **QĐ-10.** Đổi tên CHỈ trên màn: tiêu đề `dashboard.tsx:56` "Tổng quan điện gió" thành "Tổng quan"; breadcrumb `app/(ops)/page.tsx:6` thành "Tổng quan". Mục menu GIỮ NGUYÊN "Bảng điều khiển" (`nav-config.ts:153, 191`), không sửa `test/four-roles-shell.test.ts`. Nội dung màn Tổng quan giữ nguyên; thiết kế lại thuộc đợt chuẩn hoá dữ liệu sau FIX-04 (nối dữ liệu thật, chỉ đọc).
- **QĐ-11.** Bài e2e `e2e/chain-scope.spec.ts` (FE-27, màn đổi theo chain) đang kiểm chữ "Chain đang xem: ..." trong dòng mô tả của 4 màn. Để giữ đúng sức kiểm (biến `chain` CỦA MÀN đã đổi), phần tử ngoài cùng của ĐÚNG 4 màn bài này kiểm (`draft.tsx`, `ops-transactions.tsx`, `approvals.tsx`, `seller-overview.tsx`) thêm thuộc tính `data-chain={chain}` (các màn khác từng in chain trong dòng mô tả không thêm, tránh mã thừa); e2e đổi `getByText('Chain đang xem: X')` thành `expect(page.locator('[data-chain="X"]')).toBeVisible()`. Chỉ đổi cách định vị, không nới điều kiện.

## 4. Tài liệu

- **D1.** Chép nguyên văn tệp `docs/20261102_NO_KY_THUAT_DA_TOKEN.md` do Supervisor cung cấp (trong gói spec) vào repo. Không sửa nội dung.
- **D2.** `docs/tech-report.md`:
  - Bảng "Quy ước ký hiệu token": thêm dòng `TCC` | Tokenized Carbon Credit | chưa có hợp đồng | Token tín chỉ carbon; CHƯA hỗ trợ, chỉ xuất hiện như lựa chọn bị khoá ở ô chọn token.
  - Mục 1.6.C: thêm dòng **P2** "Hệ thống ngầm định một token dự án trên mỗi chain (sổ địa chỉ, ledger, 4 bảng dữ liệu, cấu hình `wpt.*`, chọn dự án ngầm)" | "Chi tiết và lộ trình MT-01 tới MT-07 ở `docs/20261102_NO_KY_THUAT_DA_TOKEN.md`".
- **D3.** `docs/USER_GUIDE.md`: đoạn ngắn mô tả ô chọn token (gõ lọc, dòng TCC chưa hỗ trợ), gợi ý khi dừng chuột trên menu, và việc tiêu đề màn "Tổng quan điện gió" đổi thành "Tổng quan" (mục menu vẫn là "Bảng điều khiển"). Câu mô tả màn trong UserGuide (nếu đang chép dòng mô tả cũ) đổi theo câu gợi ý mới.
- **D4.** `docs/CHECKPOINT_UIUX02.md` ghi "Phạm vi: chỉ frontend và tài liệu", danh sách tệp đã sửa, kết quả kiểm, đột biến; `.kiro/task-status.json`.

## 5. Phạm vi tệp

Được sửa hoặc thêm:

- `app/src/components/token/token-scope-select.tsx` (mới, gồm component và hàm thuần `tokenScopeOptions`)
- 10 tệp màn ở mục 3 (chỉ thêm import và một phần tử JSX; riêng `investor-trade.tsx` thay ô `select` cũ)
- 23 tệp ở bảng QĐ-7 (xoá dòng mô tả; 4 tệp thêm `data-chain` theo QĐ-11; 5 tệp thêm `HoverHint` trên tiêu đề theo QĐ-8)
- `app/src/components/layout/hover-hint.tsx` (mới), `app/src/components/layout/nav-config.ts` (thêm `hint`), `app/src/components/layout/sidebar.tsx` (bọc mục menu bằng `HoverHint`), `app/src/app/(ops)/page.tsx` (breadcrumb)
- `app/e2e/chain-scope.spec.ts` (chỉ cách định vị chain, QĐ-11)
- `app/test/uiux-02-dau-man.test.ts` (mới), `app/e2e/uiux-02-dau-man.spec.ts` (mới)
- `docs/screenshots/uiux-02/*` (ảnh)
- `docs/20261102_NO_KY_THUAT_DA_TOKEN.md` (mới), `docs/tech-report.md`, `docs/USER_GUIDE.md`, `docs/CHECKPOINT_UIUX02.md`, `docs/uiux-02-dau-man/*` (chép spec), `.kiro/task-status.json`

Không được sửa: `app/src/lib/**`, `app/src/app/actions/**`, `app/src/app/api/**`, `app/prisma/**`, `packages/**`, `scripts/**`, `app/wrangler.json`, `.env*`, mọi `gates.ts`, `sides.ts`. Lệnh kiểm ở tasks bước 6 phải rỗng.

## 6. Kiểm thử

Vitest `app/test/uiux-02-dau-man.test.ts`, ca 1 tới 5 cho ô chọn token (môi trường node; hàm thuần, và `renderToStaticMarkup` của `react-dom/server` dựng bằng `React.createElement`; không thêm gói):

| Ca | Nội dung |
|---|---|
| 1 | Dựng mặc định: ô `input` có `id` truyền vào, `role="combobox"`, `aria-expanded="false"`, giá trị `WPT`, không `disabled`; `label` "Token" trỏ đúng `id`. Truyền `disabled`: ô có `disabled`. `tokens=[]`: giá trị rỗng, `placeholder` "Chưa có token" |
| 2 | `tokenScopeOptions(mặc định, '')`: hai dòng theo thứ tự WPT (chọn được), TCC (khoá, thẻ "(chưa hỗ trợ)", tên "Tokenized Carbon Credit") |
| 3 | Lọc: `'w'` chỉ WPT; `'tc'` chỉ TCC; `' T '` ra TCC trước (hạng 0) rồi WPT (hạng 1); `'carbon'` chỉ TCC (theo tên loại); có `projectName` "Dự án điện gió An Viên" thì `'an viên'` ra WPT; `'zz'` rỗng; hoa thường như nhau |
| 4 | Quét mã: mỗi tệp trong 10 tệp màn ở mục 3 có đúng MỘT chỗ dùng `<TokenScopeSelect`; `investor-trade.tsx` không còn ô `select` Token cũ, không còn `ctx.tokens.length <= 1`; `investor-withdraw.tsx` không dùng |
| 5b | `tokenScopeReducer`: mở rồi gõ `WPT` chỉ còn WPT, gõ `wpt` cũng vậy; từ trạng thái đóng, `move` xuống thì mở và trỏ WPT, `choose` thì chọn WPT và đóng; `choose` dòng TCC (theo chỉ số, hoặc gõ `tc` rồi `choose`) không đổi lựa chọn, danh sách vẫn mở; `sync` với `disabled: true` khi đang mở thì đóng, `active = -1`, sau đó `open`, `type`, `choose` trả về đúng trạng thái cũ; `sync` với `tokens: []` thì giá trị rỗng, danh sách chỉ còn TCC; `sync` đổi `value` sang token khác trong danh sách thì chọn token đó |
| 5 | Quét mã: `token-scope-select.tsx` không có `localStorage`, `sessionStorage`, `document.cookie`, `fetch(`, `useRouter`, `useSearchParams`, import từ `@/app/actions` |

Playwright `app/e2e/uiux-02-dau-man.spec.ts`, phần ô chọn token (chain mock, đổi vai bằng cách các spec hiện có đang làm). Định vị bằng `page.locator('#token-scope')`, KHÔNG dùng `getByLabel('Token')` không `exact` (nhiều nhãn khác chứa chữ "token", gây lỗi strict mode).

- Với từng màn ở mục 3 theo đúng vai: ô hiện, giá trị `WPT`, không khoá; bấm vào thì `listbox` hiện, có dòng WPT và dòng TCC với `aria-disabled="true"`, chữ "TCC" và "(chưa hỗ trợ)".
- Riêng `/vault` (KSV), kiểm thao tác, gõ bằng `page.keyboard.type` (không dùng `fill`): bấm vào ô rồi gõ `WPT`: chỉ còn dòng WPT; Esc; gõ `tc` chỉ còn dòng TCC; bấm dòng TCC (`click({ force: true })`) thì không chọn, danh sách vẫn mở; gõ `zz` thấy "Không có token khớp"; Esc thì giá trị `WPT`, danh sách đóng; gõ `w` rồi Enter: giá trị `WPT`, danh sách đóng; gõ `t`: dòng TCC trước, WPT sau; mũi tên xuống trỏ WPT (bỏ qua TCC), Enter: giá trị `WPT`; gõ `tc` rồi Enter: không chọn, danh sách vẫn mở; bấm ra ngoài: giá trị `WPT`, danh sách đóng. Bàn phím từ trạng thái đóng: Tab tới ô, mũi tên xuống thì danh sách mở và `aria-activedescendant` trỏ dòng WPT, Enter thì giá trị `WPT`, danh sách đóng, tiêu điểm vẫn ở ô.
- Màn hình nhỏ (khung 390 x 844), `/vault` (KSV): danh sách xổ nằm trọn trong khung ngang (không tràn), bấm chọn WPT được; trang không cuộn ngang.
- Không sửa spec e2e cũ, trừ `chain-scope.spec.ts` theo QĐ-11.

Cùng tệp vitest, ca 6 tới 10 cho dòng mô tả và gợi ý:

| Ca | Nội dung |
|---|---|
| 6 | Mọi mục của `NAV_BY_ROLE` (mọi vai), `DEMO_PAYMENT_NAV_ITEM`, `WALLET_BINDING_NAV_ITEM` có `hint` không rỗng, ĐÚNG nguyên văn bảng QĐ-8 (so theo vai và `href`); không câu nào có gạch dài, chấm giữa, ký tự mũi tên |
| 7 | Nhãn `/` của GDV, KSV vẫn là "Bảng điều khiển"; `dashboard.tsx` có tiêu đề "Tổng quan", không còn "Tổng quan điện gió"; breadcrumb `app/(ops)/page.tsx` là "Tổng quan" |
| 8 | Quét từng tệp ở bảng QĐ-7: KHÔNG còn câu mở đầu của dòng mô tả cũ (danh sách câu ở design mục 4) |
| 9 | 4 tệp ở QĐ-11 có `data-chain={chain}`, `wallet-binding.tsx` không có; 5 tệp ở bảng gợi ý tiêu đề dùng `HoverHint` với đúng câu; `sidebar.tsx` dùng `HoverHint` với `item.hint` |
| 10 | Quét `hover-hint.tsx`: import từ `@/components/ui/tooltip`; có `3000`; có `aria-describedby` và `sr-only`; không `localStorage`, `fetch(`, import từ `@/app/actions`, không tự dùng `setTimeout` |

Cùng tệp Playwright, phần dòng mô tả và gợi ý (chain mock):

- Vai KSV, định vị liên kết bằng `getByRole('link', { name: /^Phê duyệt lệnh/ })` (tên liên kết có cả số việc chờ và phím tắt nên không dùng `exact`); kiểm `toHaveAccessibleDescription(<câu QĐ-8>)` ngay khi tải và tên liên kết không chứa câu gợi ý. Rê chuột lên liên kết: sau 1 giây chưa có `[data-slot="tooltip-content"]`; sau 3,5 giây có, đúng câu QĐ-8, nằm bên phải thanh bên (không bị cắt); rời chuột thì mất ngay.
- Vai GDV, mở `/`: tiêu đề `h1` "Tổng quan"; menu vẫn có mục "Bảng điều khiển".
- Vai GDV, mở `/audit`: rê lên tiêu đề "Sổ kiểm toán" 3,5 giây thì hiện đúng câu gợi ý.
- Đi qua mọi màn ở bảng QĐ-7 theo vai được vào: trong `page.getByRole('main')` (KHÔNG tìm cả trang, vì câu gợi ý `sr-only` của thanh bên có thể trùng chữ) không còn câu mở đầu cũ ở design mục 6.

## 7. Đột biến bắt buộc (ghi ca đỏ vào checkpoint)

1. Dòng TCC chọn được (bỏ kiểm khoá khi bấm chuột).
2. Enter chọn được dòng khoá.
3. Bỏ thẻ "(chưa hỗ trợ)".
4. Giá trị mặc định thành `TCC`.
5. Lọc bỏ qua tên loại token (chỉ theo mã).
6. Lọc phân biệt hoa thường.
7. Bỏ ô chọn khỏi `vault-status.tsx`.
8. Giữ `disabled={ctx.tokens.length <= 1 || tradeBlocked}` ở màn Giao dịch token.
9. Ô luôn `disabled`.
10. Blur không trả chữ về token đang chọn.
11. Gợi ý hiện ngay khi rê chuột (độ trễ 0).
12. `delay` bằng 600 (mặc định Base UI) thay vì 3000.
13. Bỏ `aria-describedby` khỏi mục menu.
14. Một mục menu thiếu `hint` (thử `Phê duyệt lệnh`), hoặc câu khác bảng QĐ-8.
15. Giữ lại dòng mô tả ở `vault-status.tsx`.
16. Bỏ `data-chain` ở `approvals.tsx` (bài `chain-scope.spec.ts` phải đỏ).
17. Lọc bỏ qua truy vấn khi chữ gõ trùng token đang chọn (lỗi cũ `text !== selected`): gõ `WPT` vẫn hiện TCC.
18. `disabled` thành `true` khi đang mở mà danh sách vẫn mở hoặc `choose` vẫn chọn được.

## 8. Điều kiện hoàn thành

- [ ] Dòng mô tả đã bỏ ở đủ 23 chỗ (QĐ-7); mọi mục menu có gợi ý đúng nguyên văn QĐ-8; 5 màn ngoài menu có gợi ý trên tiêu đề; `HoverHint` đúng QĐ-9; tiêu đề màn Tổng quan QĐ-10 (menu vẫn "Bảng điều khiển"); `data-chain` QĐ-11.
- [ ] `TokenScopeSelect` đúng QĐ-1 tới QĐ-6; 10 màn ở mục 3 có ô chọn đúng vị trí QĐ-6 (kể cả ngoại lệ `/trade`); màn Giao dịch token dùng chung component, không còn ô `select` Token riêng.
- [ ] Số lời gọi server action khi mở mỗi màn không đổi (ghi số trước và sau của 10 màn ở mục 3 và 23 màn ở QĐ-7 vào checkpoint); `test/hf-01-hieu-nang.test.ts` xanh không sửa.
- [ ] D1 tới D4 xong; tệp nợ kỹ thuật trùng nguyên văn tệp Supervisor gửi.
- [ ] `git diff --name-only` chỉ có tệp ở mục 5; lệnh kiểm tệp cấm rỗng.
- [ ] Typecheck, lint (0 lỗi, 0 cảnh báo mới), vitest, e2e mock và hardhat xanh; 18 đột biến đều bị bắt.
- [ ] Ảnh 10 màn có danh sách đang xổ (thấy thẻ "(chưa hỗ trợ)" mờ), thêm một ảnh đang gõ lọc, một ảnh gợi ý menu đang hiện, một ảnh màn sau khi bỏ dòng mô tả, Sáng và Tối, đặt ở `docs/screenshots/uiux-02/`.
- [ ] Không còn gạch dài, chấm giữa, ký tự mũi tên trong chữ mới thêm.
