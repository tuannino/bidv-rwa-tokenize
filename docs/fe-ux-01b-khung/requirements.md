# FE-UX-01b: khung giao diện (thanh bên, thanh đầu, ngăn kéo điện thoại, logo)

| | |
|---|---|
| Nhánh | `feat/fe-ux-01b-khung` từ `release/ui-v2` sau khi PR #84 (FE-UX-01a) đã merge |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend. Có một thay đổi trong `lib/` chỉ là hằng số màu thương hiệu (`lib/brand.ts`, QĐ-7), cần Sếp duyệt trước khi giao |
| Mức kiểm thử | **B**, cộng e2e đầy đủ một lần vì khung có trên mọi màn |
| Nguồn | Kế hoạch 03/11; `docs/20261101_UI_UX_BAN_GIAO_SUPERVISOR.md` mục 5 (khung, theo bản 12), mục 4.5 (biểu tượng); `docs/prototypes/20261101_ui_ux_ban_chot/assets/shell.css`, `shell.js`, `logo.js` |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi kế hoạch 03/11, rồi mã `release/ui-v2` sau #84, rồi tài liệu bàn giao, cuối cùng là bản xem thử |

## 1. Mục tiêu

Dựng lại khung theo bản chốt mà KHÔNG đổi menu, quyền, lời gọi dữ liệu hay logic của các điều khiển trong khung:

1. Thanh bên dạng thẻ nổi, rộng 270 px, thu gọn còn 88 px và nhớ lựa chọn; logo mới; chọn vai ở đầu, chọn chain và trạng thái mạng ở đáy.
2. Thanh đầu chỉ còn tên màn, nút "Kết nối ví" và nút Sáng Tối; bỏ dòng crumb (QĐ-11 của bản chốt).
3. Dưới 1100 px thanh bên thành ngăn kéo, mở bằng nút menu ở thanh đầu (sửa UX-04).
4. Xử lý 4 dòng `font-mono` còn lại trong `components/layout` và các màu cứng trong khung.

Không làm: chuyển động JS (viên nang trượt theo con trỏ, thanh đầu co theo cuộn, dropdown xổ lò xo: FE-UX-08), chuyển động CSS và nền trôi (FE-UX-01c), ô chọn tuỳ biến thay `select` gốc, đổi bố cục màn.

## 2. Quyết định (QĐ)

- **QĐ-1. Không đổi logic khung.** Giữ nguyên: `NAV_BY_ROLE`, `withHiddenOps`, `roleHomeHref`, cách đọc số việc chờ, `CustodyToggle` (state, `setFireblocksCustodyAction`, `custodyNotes`, điều kiện `custody:toggle`), điều kiện `investor:whitelist`, `canMintDemoPayment`, logic `ChannelGuard`, `ChainSelector`, `ChannelSwitcher`, hàm đổi theme, toàn bộ props hiện tại của `ConnectButton` (`accountStatus="avatar"`, `chainStatus="icon"`, `showBalance={false}`, `label`). Chỉ đổi markup, class, vị trí, câu chữ khung (QĐ-6).
- **QĐ-2. Giữ mốc mà test hiện có dựa vào** (không sửa `app/test/**`; e2e cũ chỉ sửa selector khi bắt buộc, xem mục 3):
  - Thanh bên là `<aside>` (vai trò `complementary`) chứa chữ `vai trò <ROLE>`, tên nhóm menu, liên kết menu có tên truy cập là nhãn mục.
  - Số liên kết trong `aside` không đổi so với mốc (ví dụ đúng 7 ở Nhà đầu tư, `investor-channel.spec.ts:206`): logo là MỘT liên kết; khi thu gọn, các ô vai và chain là `button`, không phải liên kết.
  - Số việc chờ nằm TRONG thẻ `a` của mục (`maker-checker.spec.ts:90`), giữ `aria-label="<N> việc đang chờ"`, chữ là số (kể cả `0`), vẫn hiện khi thu gọn.
  - `select#channel-switcher`, `select#chain-selector` là phần tử gốc, giữ nguyên chữ mọi `option` (`investor-channel.spec.ts:95-101`); khi thu gọn, `select` vẫn nằm trong DOM (ẩn bằng `sr-only`), không bị gỡ.
  - Toàn trang có đúng một `h1`, nằm trong `<main>` (`uiux-02.spec.ts:213`); tên màn trên thanh đầu KHÔNG là heading.
  - Thanh đầu (`header`) KHÔNG nằm trong `<main>` (`wallet-connect.spec.ts:159`).
  - Nút theme giữ `title` bắt đầu bằng `Chuyển sang` và hiện ở 390 px.
  - Nút "Kết nối ví" vẫn ở góc trên phải vùng nội dung (`ops-transactions.spec.ts:138, 222`).
  - Unit test: `NavLink` giữ `prefetch={false}` và chuỗi `needsFetch` (test hf-01); `HoverHint` vẫn bọc ngoài `Link` (`uiux-02` unit :275); chuỗi `withHiddenOps` không đổi (`demo-payment` :236).
- **QĐ-3. Thu gọn (từ 1100 px trở lên):** nút thu gọn ở đáy thanh bên; lưu `localStorage` khoá `bidv-rail` (`'1'` thu gọn, khác là mở). Đọc qua store ở `components/layout/shell-state.ts` bằng `useSyncExternalStore`: giá trị phía máy chủ là "mở", đọc ghi bọc `try/catch`, khi ghi thì tự phát sự kiện để các hook cùng tab cập nhật (sự kiện `storage` chỉ chạy ở tab khác). Không lệch hydrate. Hiệu ứng đổi rộng chỉ bật sau khi đã mount (tránh trượt khi tải lại ở trạng thái thu gọn), kèm `motion-reduce:transition-none`. Dưới 1100 px bỏ qua trạng thái thu gọn (ngăn kéo luôn đầy đủ).
- **QĐ-4. Ngăn kéo dưới 1100 px:** thanh bên ẩn, thanh đầu có nút menu (`aria-label="Mở menu"`, `aria-expanded`, `aria-controls="app-sidebar"`). `AppLayout` là Server Component nên trạng thái mở nằm trong store `shell-state.ts` (mức module, client), không đặt state trong `app-layout.tsx`. Mở: ngăn kéo trượt từ trái, lớp phủ mờ, `header` và `main` có `inert`. Đóng: `aside` có `invisible` và `inert` (không đọc được, không tab vào được). Đóng bằng nút X, chạm lớp phủ, Esc, bấm một mục menu, hoặc khi đường dẫn đổi; "đổi đường dẫn" làm bằng state suy ra (lưu đường dẫn lúc mở, so khi render), KHÔNG `setState` trong `useEffect`. Từ 1100 px trở lên luôn hiện thanh bên, không có `inert`.
- **QĐ-5. Thanh đầu:** cột nội dung là một `div` cuộn chứa `header` (dính đỉnh) rồi `main`; bỏ `overflow-y-auto` ở `main`. Trái: tên màn là phần tử cuối của `breadcrumbs` (`p`, một dòng, `truncate`); phải: `ConnectButton` (mọi vai) và nút Sáng Tối. Bỏ dòng crumb; KHÔNG đổi dữ liệu `breadcrumbs` các trang truyền vào. Crumb hiện tại không phải liên kết nên không mất điều hướng. 4 màn chi tiết (`/approvals/[id]`, `/transactions/[id]`, `/orders/[id]`, `/tokens/[symbol]`) hiện đúng phần tử cuối như trang đang truyền; dev ghi tên hiển thị của 4 màn trong checkpoint.
- **QĐ-6. Câu chữ khung:** dấu chấm giữa ở dòng trạng thái thành dấu phẩy (`{chain}, vai trò {ROLE}`); câu `channel-guard.tsx` "Đổi vai trò ở góc trên phải" thành "Bấm 'Về trang của vai hiện tại' rồi đổi vai ở đầu thanh bên". Không đổi câu khác, kể cả chữ `option`.
- **QĐ-7. Màu thương hiệu (`lib/brand.ts`, cần Sếp duyệt):** chỉ đổi giá trị và thêm hằng số, không đổi tên khoá đang dùng: `green` thành `#016B69` (xanh ngọc logo), `gold` thành `#FEC629` (bông mai); thêm `walletAccent` `#c9971c` / `walletAccentForeground` `#0e1e1d` (Sáng) và `walletAccentDark` `#e0b44a` / `walletAccentForegroundDark` `#1d1300` (Tối) cho nút "Kết nối ví" vàng. `greenLight`, `goldLight` không còn ai dùng thì xoá. Không tệp `lib/` nào khác.
- **QĐ-8. Màu cứng trong khung:** công tắc Lưu ký đổi `bg-green-500` sang `bg-primary`, núm `bg-white` sang `bg-background`; mọi màu khác trong `components/layout` qua token.
- **QĐ-9. Sửa token Tối `--chart-4`:** `#1e8886` thành `#5bbab8` (đang làm màu chữ ở `ops-transactions.tsx:232`; `#1e8886` chỉ đạt 4,16:1 trên `--card` Tối, `#5bbab8` đạt 7,74:1). Sửa sót của spec FE-UX-01a.
- **QĐ-10. Logo không vào bundle client:** `BidvLogo` dựng ở server (`app-layout.tsx`) rồi truyền vào `Sidebar` qua prop `ReactNode` (`logo`, `logoMark`); đường bông mai khai báo một lần bằng `<symbol>` và dùng lại bằng `<use>`; toạ độ làm tròn 1 chữ số thập phân hoặc chạy SVGO. Phần SVG logo sau tối ưu không quá 6 KB gzip.

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/components/layout/{app-layout,sidebar,header,custody-toggle,chain-selector,channel-switcher,channel-guard,hover-hint}.tsx` | Markup, class, vị trí; logic theo QĐ-1 |
| `app/src/components/layout/shell-state.ts` (mới) | Store thu gọn và ngăn kéo (QĐ-3, QĐ-4) |
| `app/src/components/bidv-logo.tsx` | Logo mới (design mục 2) |
| `app/src/components/providers.tsx` | Chỉ hai hằng `LIGHT_WALLET_THEME`, `DARK_WALLET_THEME` dùng khoá mới của `BRAND` |
| `app/src/lib/brand.ts` | QĐ-7 |
| `app/src/app/globals.css` | QĐ-9, biến độ rộng thanh bên nếu cần |
| `app/e2e/fe-ux-01b-khung.spec.ts` (mới) | Design mục 6 |
| E2E có sẵn | Chỉ sửa selector khi markup đổi, giữ nguyên điều kiện kiểm; mỗi tệp sửa liệt kê tên và lý do trong checkpoint |
| `docs/fe-ux-01b-khung/*` (chép spec này), `docs/CHECKPOINT_FEUX01B.md`, `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Mọi tệp khác là cấm, gồm `components/layout/nav-config.ts`, `role-home.ts`, mọi tệp màn, `app/test/**`, `lib/**` ngoài `brand.ts`. Lệnh kiểm ở tasks bước 9 phải rỗng.

## 4. Điều kiện hoàn thành

- [ ] Thanh bên đúng design mục 1 ở 1440 px: `aside` rộng 270 px, thu gọn 88 px (đo `getBoundingClientRect().width` của `aside`, chưa tính lề 12 px), nhớ lựa chọn sau khi tải lại; không lệch hydrate, không trượt khi tải lại ở trạng thái thu gọn.
- [ ] Menu của 4 vai (Giao dịch viên, Kiểm soát viên, Nhà đầu tư, Người bán) có đúng mục, nhãn, thứ tự, nhóm, số liên kết như mốc (so danh sách lấy bằng script ở design mục 5).
- [ ] Nhóm "Nghiệp vụ ẩn" gập được và tự mở khi đang ở màn trong nhóm; "Nạp VNDB", "Định danh ví" hiện đúng điều kiện cũ.
- [ ] Số việc chờ hiện cả số 0 (nền xám), khác 0 nền vàng, vẫn hiện khi thu gọn; nằm trong thẻ `a`; `aria-label` giữ nguyên.
- [ ] Công tắc Lưu ký: đủ 4 câu `custodyNotes`, khoá khi chưa cấu hình, dòng lỗi action; chỉ hiện với vai có `custody:toggle`.
- [ ] Ô chọn vai ở đầu thanh bên, ô chọn chain và trạng thái mạng ở đáy; `#channel-switcher`, `#chain-selector` vẫn là `select` gốc, chữ `option` không đổi, đổi giá trị chạy như cũ.
- [ ] Thanh đầu: tên màn đúng phần tử cuối của `breadcrumbs` ở 28 đường dẫn (kể cả 4 màn chi tiết); không còn dòng crumb; `header` ngoài `main`; toàn trang đúng một `h1`; nút "Kết nối ví" vàng ở góc trên phải; nút Sáng Tối chạy và hiện ở 390 px.
- [ ] Dưới 1100 px (kiểm ở 390 px): không tràn ngang ở 28 đường dẫn; ngăn kéo đóng thì `aside` ẩn và không tab vào được; mở bằng nút menu; đóng được bằng X, lớp phủ, Esc, bấm mục menu, đổi đường dẫn; khi mở `header`, `main` có `inert`; tiêu điểm vào ngăn kéo khi mở và về nút menu khi đóng.
- [ ] `rg -n "font-mono" app/src -g '*.tsx'` trả 0 dòng; không còn màu cứng trong `components/layout` (lệnh ở tasks bước 10b rỗng).
- [ ] Số server action khi mở màn không đổi ở 28 đường dẫn; JS gzip ở `/`, `/approvals`, `/portfolio`, `/trade` không tăng quá 10 KB so với sau #84; cảnh báo hydrate vẫn 0; SVG logo không quá 6 KB gzip (QĐ-10).
- [ ] `app/e2e/fe-ux-01b-khung.spec.ts` đủ các ca design mục 6, xanh; mỗi ca có phép kiểm cụ thể.
- [ ] Lệnh danh sách trắng rỗng; quét ký tự cấm rỗng; `run-local-all.sh arch markers checkpoint contracts app build e2e evm` đạt toàn bộ, kèm log.
- [ ] Không mã dư thừa: `NetworkStatus` cũ, `ChevronRight` và crumb, lớp, biến, import không dùng xoá hẳn; không giữ hai kiểu khung song song.
- [ ] Checkpoint ghi phạm vi, danh sách tệp, thay đổi `lib/brand.ts`, mọi selector e2e đã sửa kèm lý do, 4 màn chi tiết, số đo trước và sau, ảnh 28 đường dẫn ở 1440 và 390 (Sáng, Tối) gửi kèm.
