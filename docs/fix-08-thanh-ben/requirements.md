# FIX-08: thanh bên chỉ sáng đúng một mục; bỏ ký tự cấm ở khung

| | |
|---|---|
| Nhánh | `fix/fix-08-thanh-ben` từ `release/ui-v2` mới nhất (@ `d2a5bca` hoặc sau: đã gồm 06a). Nếu PR khác (06b) merge vào `release/ui-v2` trong lúc làm: rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 trên nhánh đã rebase và đo lại TOÀN BỘ mốc từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend thuần, chỉ khung (`app/src/components/layout`). Không `app/src/lib/**`, `app/src/app/**`, `app/src/components/ui/*`, `nav-config.ts` (danh sách mục menu không đổi); không thêm gói npm |
| Mức kiểm thử | **B**, phạm vi ở mục 5 (khung dùng chung mọi màn của bốn vai) |
| Song song | Song song được với FE-UX-06b (khác tệp mã). Các PR cùng sửa `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách |
| Nguồn | Nghiệm thu FE-UX-05a 05/11 (thanh bên sáng hai mục ở `/seller/transactions`, `/seller/withdraw`; ảnh `20261105_FIX-08_thanh_ben_sang_hai_muc.png`); Sếp duyệt 05/11 làm FIX-08 gộp việc bỏ ký tự cấm ở khung |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi mã `release/ui-v2` @ merge-base, rồi `docs/USER_GUIDE.md` |

## 1. Mục tiêu

1. Ở mọi màn của mọi vai, thanh bên sáng **đúng một** mục (hoặc không mục nào nếu màn không có trong menu), là mục khớp đường dẫn **dài nhất**. Lỗi hiện tại: `isActive` (`sidebar.tsx:129-132`) cho mọi mục có `href` là tiền tố của đường dẫn đều sáng, nên ở `/seller/transactions`, `/seller/withdraw` mục "Tổng quan" (`/seller`) sáng cùng mục đúng. Chú thích ngay trên hàm đã ghi ý định "KHÔNG để `/seller` sáng theo" nhưng mã chưa làm đúng.
2. Bỏ ký tự cấm (U+00B7, U+2014) khỏi chữ hiển thị của khung: nhãn ô chọn vai, `title` của nhãn "Vai trò", hậu tố chain chưa dùng được, `title` của mục menu chưa mở.

Không làm: đổi danh sách, thứ tự, nhãn, biểu tượng, phím tắt của mục menu; đổi giao diện viên nang; đổi cách đọc số việc chờ; đổi hành vi nhóm thu gọn (vẫn tự mở khi chứa mục đang sáng).

## 2. Quyết định (QĐ)

- **QĐ-1. Hàm chọn mục đang sáng (tệp mới, thuần):** `components/layout/active-nav.ts` export `activeNavHref(hrefs: readonly string[], pathname: string): string | null`:
  - Một `href` khớp `pathname` khi: `href === "/"` thì chỉ khi `pathname === "/"`; còn lại khi `pathname === href` hoặc `pathname.startsWith(href + "/")` (đúng quy tắc khớp hiện tại).
  - Trả `href` khớp có độ dài lớn nhất; không `href` nào khớp thì `null`. Ví dụ `["/wallet", "/wallet-binding"]`: `/wallet-binding` ra `/wallet-binding`, `/wallet/x` ra `/wallet` (không có `/` sau tiền tố thì không khớp).
  - Không phụ thuộc React, không đọc cookie, không nhập gì ngoài kiểu.
- **QĐ-2. `sidebar.tsx`:** tính một lần `const activeHref = activeNavHref(<href của mọi mục KHÔNG `disabled` của mọi nhóm trong nav đang hiển thị, gồm nhóm ẩn của withHiddenOps>, pathname)` (mục `disabled` không dự phần, để không lấy chỗ sáng của mục bấm được; hiện chưa có mục `disabled` nào); `isActive` thành `(item) => !item.disabled && item.href === activeHref`. Giữ chữ ký `isActive` truyền cho nhóm (`containsActive` không đổi cách dùng). Sửa chú thích trên hàm cho đúng cách mới; thêm dòng `import { activeNavHref } from "./active-nav"`. Không đổi gì khác trong tệp ngoài QĐ-3 và QĐ-4.
- **QĐ-3. Đánh dấu cho trình đọc màn hình:** liên kết của mục đang sáng thêm `aria-current="page"` (`NavLink`, nhánh `Link`; mục `disabled` không có). Đây là thuộc tính mới duy nhất; lớp viên nang giữ nguyên.
- **QĐ-4. Chữ được đổi (chỉ để bỏ ký tự cấm):**
  - `channel-switcher.tsx:80` nhãn lựa chọn "{vai} \u00b7 {mã}" thành "{vai} ({mã})", ví dụ "Người bán (NB001)".
  - `channel-switcher.tsx:59` `title` "Chọn vai trò đang giả lập: chỉ dùng để demo, không phải xác thực thật".
  - `chain-selector.tsx:62` hậu tố " \u2014 chưa dùng được" thành ": chưa dùng được" (nhãn chain đã có ngoặc, ví dụ "Stellar (Soroban): chưa dùng được", tránh hai cặp ngoặc liền nhau).
  - `chain-selector.tsx:68` câu lỗi lớp `text-destructive` đổi thành `text-bad-ink` (dọn màu `destructive` còn lại của khung, chữ giữ).
  - `sidebar.tsx:426` `title` "Sắp có: chưa mở trong phiên bản này".
  - Không đổi chữ nào khác. Dòng chú thích mã có ký tự cấm không bắt buộc sửa; `header.tsx` ngoài phạm vi task và ngoài lệnh 6e.
- **QĐ-5. Test có sẵn được sửa (ngoại lệ duy nhất):** `e2e/investor-channel.spec.ts:98-101` đang khoá chữ cũ "Nhà đầu tư \u00b7 NDT001"…; sửa đúng bốn regex này thành chữ mới (`/Nhà đầu tư \(NDT001\)/`, `/Người bán \(NB001\)/`, `/Giao dịch viên \(GDV001\)/`, `/Kiểm soát viên \(KSV001\)/`), không đổi gì khác của tệp. Mọi test có sẵn khác giữ nguyên.
- **QĐ-6. Mốc test phải giữ:** `four-roles-shell.test.ts`, `four-roles-routes.test.ts` (menu theo vai, mục trỏ tới trang có thật); `fe-ux-01b-khung.spec.ts` (ô chọn vai là `select`, chọn theo `value`, ngăn kéo dưới 1100 px, thu gọn); `investor-channel.spec.ts` (ngoài bốn regex QĐ-5: đổi vai về trang mặc định, menu đổi theo); `uiux-02-dau-man.test.ts:275` (`<HoverHint hint={item.hint}>` bọc `<Link`), `uiux-02-dau-man.spec.ts:178-204` (gợi ý trên mục menu); `hf-01-hieu-nang.test.ts` (menu không gọi action ở chain mặc định); `chain-selector.spec.ts`.
- **QĐ-7. Hiệu năng:** JS gzip mọi trang đo không tăng quá 200 B (hàm nhỏ trong chunk khung dùng chung); CSS không tăng; số action khi mở không đổi ở 28 đường dẫn; ba số lỗi bằng 0 ở mọi đường dẫn.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/layout/sidebar.tsx` | QĐ-2, QĐ-3, QĐ-4 |
| `app/src/components/layout/channel-switcher.tsx`, `chain-selector.tsx` | QĐ-4 |
| `app/src/components/layout/active-nav.ts` (mới) | QĐ-1 |
| `app/e2e/investor-channel.spec.ts` | CHỈ bốn dòng 98-101, QĐ-5 |
| `app/e2e/fix-08-thanh-ben.spec.ts`, `app/test/fix-08.test.ts` (mới) | Design mục 2 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fix-08-thanh-ben/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FIX08.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác.

## 4. Điều kiện hoàn thành

- [ ] Ở `/seller/transactions`, `/seller/withdraw` chỉ mục của chính màn sáng; ở `/seller` chỉ "Tổng quan" sáng (ảnh trước và sau như ảnh nguồn).
- [ ] `activeNavHref` đúng QĐ-1, `sidebar.tsx` dùng nó đúng QĐ-2; chú thích trên hàm đã sửa.
- [ ] Mục đang sáng có `aria-current="page"`, mục khác không (QĐ-3).
- [ ] So sánh trên mọi đường dẫn trang có thật của bốn vai (design mục 2 nhóm 2): kết quả mới chỉ khác kết quả cũ ở chỗ cũ sáng từ hai mục trở lên, và ở đó mới sáng đúng mục dài nhất; checkpoint dán danh sách các chỗ khác.
- [ ] Không còn ký tự cấm trong chữ hiển thị của khung (tasks bước 6e); chữ chỉ đổi đúng QĐ-4.
- [ ] Test có sẵn chỉ sửa đúng QĐ-5; mốc QĐ-6 giữ.
- [ ] Không đổi danh sách menu, giao diện viên nang, số việc chờ, nhóm thu gọn; checkpoint liệt kê từng đoạn đổi trong `sidebar.tsx` kèm lý do an toàn.
- [ ] Số action khi mở không đổi ở 28 đường dẫn; JS, CSS trong trần QĐ-7; ba số lỗi bằng 0.
- [ ] Ảnh thanh bên 1440 px Sáng và Tối, trước và sau, vai Người bán ở ba màn `/seller`, `/seller/transactions`, `/seller/withdraw`; vai Giao dịch viên ở `/transactions` và một `/transactions/[id]`; ảnh ô chọn vai đang mở (hoặc chữ các lựa chọn) và ô chọn chain có lựa chọn chưa dùng được. Mỗi lượt một tiến trình mock MỚI khởi động với ĐỦ biến `webServer.env` của `playwright.config.ts:93-110`; dữ liệu chuẩn bị bằng `E2E_BASE_URL=http://localhost:<cổng> npx playwright test e2e/ops-transactions.spec.ts`. Script chụp ngoài repo.
- [ ] Ở 390 px, ngăn kéo menu mở ra cũng chỉ sáng đúng một mục (ảnh, vai Người bán `/seller/withdraw`).
- [ ] `fix-08-thanh-ben.spec.ts` (project mock) đủ 3 ca và `fix-08.test.ts` đủ 3 nhóm (design mục 2), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh.
- [ ] Lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/trade,/approvals,/seller,/seller/withdraw`), CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff; build; chạy `fix-08-thanh-ben`, `investor-channel`, `fe-ux-01b-khung`, `uiux-02-dau-man` (e2e và unit), `four-roles-*`, `hf-01-hieu-nang`, unit test mới; gây lỗi có chủ đích 4 điểm (trả `href` khớp NGẮN nhất thay vì dài nhất; so `pathname.startsWith(href)` không thêm `/`; bỏ `aria-current`; bỏ `!item.disabled &&` khỏi `isActive`: chỉ khoá bằng đọc mã nguồn ở unit nhóm 3 vì hiện chưa có mục `disabled`); xem ảnh | Full suite |
