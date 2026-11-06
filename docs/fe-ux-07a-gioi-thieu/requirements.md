# FE-UX-07a: Trang giới thiệu công khai (`/gioi-thieu`), nút về đầu trang, lối vào từ thanh bên Nhà đầu tư

| | |
|---|---|
| Nhánh | `feat/fe-ux-07a-gioi-thieu` từ `release/ui-v2` mới nhất (@ `29c5708` hoặc sau: đã gồm 05b, 05c, 06a, 06b, FIX-08). Nếu PR khác merge vào `release/ui-v2` trong lúc làm (PR đồng bộ `dev` mang FIX-09, FE-UX-07b): rebase lên head mới, chạy lại TOÀN BỘ kiểm thử mục 5 trên nhánh đã rebase và đo lại TOÀN BỘ mốc từ merge-base mới; checkpoint ghi merge-base đã dùng và log của lần chạy sau rebase |
| PR | Một PR, **base `release/ui-v2`**, KHÔNG vào `dev`. Không tự merge |
| Loại | Frontend. Không `lib/**`, `app/actions/**`, `app/api/**`; không thêm gói npm; không sửa `components/ui/*`. Được sửa đúng các tệp ở mục 3, gồm MỘT dòng chèn thành phần liên kết vào `components/layout/sidebar.tsx` (QĐ-9), một khối token ở `globals.css` (QĐ-6), thêm biến thể ở `components/bidv-logo.tsx` (QĐ-7), test có sẵn `four-roles-routes.test.ts` (QĐ-2) |
| Mức kiểm thử | **B**, phạm vi ở mục 5. Thanh bên có ở mọi trang có khung nên chạy đủ e2e project mock và toàn bộ project Hardhat |
| Song song | FE-UX-07b (thanh đầu, nhãn chain) làm SAU task này vì dùng biến thể logo `compact` (QĐ-7); hai task cùng sửa `globals.css` (khối token riêng), `docs/USER_GUIDE.md`, `.kiro/task-status.json`: PR merge sau tự gộp, mỗi mã ở đúng một danh sách. Song song được với PR đồng bộ `dev`. Tệp tạm của lệnh kiểm dùng tên riêng (tasks bước 6) |
| Nguồn | Bản chốt `docs/prototypes/20261101_ui_ux_ban_chot/index.html` (trang giới thiệu); Sếp chốt 06/11 (đường dẫn riêng, công khai, số mẫu kèm "unverified", video tạm, bỏ khối "Sơ đồ trang xem thử", không dùng lenis); Sếp góp ý 06/11 (4 câu chữ mới, nút về đầu trang; lần hai: liên kết "Giới thiệu dự án" trên thanh bên, chỉ Nhà đầu tư); góp ý trợ lý của Sếp (ngưỡng cuộn tích luỹ, video không tải khi giảm chuyển động); `lib/mock-data.ts`, `lib/config/issue-terms.ts` (nguồn số mẫu duy nhất của app) |
| Thứ tự ưu tiên khi nguồn xung đột | Spec này, rồi góp ý Sếp 06/11, rồi bản chốt `index.html`, rồi mã `release/ui-v2` @ merge-base |

## 1. Mục tiêu

1. Dựng trang giới thiệu công khai `/gioi-thieu` theo bản chốt `index.html`: ai cũng mở được, không cần vai, không có thanh bên; chọn vai ở trang này thì vào đúng khu vực của vai đó. Trang không gọi server action nào khi mở.
2. Thêm nút nổi về đầu trang theo góp ý Sếp.
3. Thêm lối vào trang từ ứng dụng: dòng "Giới thiệu dự án" có mũi tên trên thanh bên, chỉ hiện với Nhà đầu tư.

Không làm: hiệu ứng JS (số lăn, tiêu đề tách chữ, hiện dần khi cuộn: FE-UX-08); khối "Sơ đồ trang xem thử"; thư viện cuộn mượt (lenis); nối số liệu thật; liên kết tới `/gioi-thieu` cho ba vai còn lại; sửa thanh đầu của khung, đổi nhãn chain (FE-UX-07b); trang chi tiết cho hai dự án mẫu.

## 2. Quyết định (QĐ)

- **QĐ-1. Đường dẫn và nhóm route.** Trang ở `app/src/app/(public)/gioi-thieu/page.tsx` (Server Component), nhóm `(public)` có `layout.tsx` KHÔNG gắn `ChannelGuard`, chỉ trả `children` (chú thích: nhóm công khai, chỉ chứa trang giới thiệu, không đọc vai). Trang KHÔNG dùng `AppLayout`. `export const metadata` với `title: 'Giới thiệu, BIDV RWA token hoá dự án điện gió'` và `description` lấy câu dẫn màn đầu (design mục 1, khối 2). Root layout giữ nguyên.
- **QĐ-2. Test cây route.** Sửa `app/test/four-roles-routes.test.ts` cho phép ĐÚNG MỘT nhóm công khai:
  - Phép kiểm `groups.sort()` so với `AREA_DIR` đổi thành: tập nhóm bằng `AREA_DIR` cộng đúng `'(public)'`.
  - Thêm phép kiểm: các trang trong `(public)` đúng bằng `['/gioi-thieu']` (dùng `routesIn('(public)')`); `layout.tsx` của `(public)` không chứa `ChannelGuard`, không chứa `AREA_GATES`; không đường dẫn nào của `(public)` trùng đường dẫn của khu vực có cổng.
  - Không sửa phép kiểm nào khác của tệp; checkpoint dán diff tệp này.
- **QĐ-3. Không gọi máy chủ khi mở.** Mở `/gioi-thieu` có 0 yêu cầu POST mang header `next-action` (e2e ca 1). Trang không có `useEffect` gọi mạng, không `fetch`. Số liệu đọc lúc dựng ở máy chủ từ `MOCK_PROJECTS`, `MOCK_WIND_STATS` (`lib/mock-data.ts`), `WPT_ANNUAL_YIELD_PERCENT` (`lib/config/issue-terms.ts`), không chép lại số.
- **QĐ-4. Vào khu vực bằng `setChannel` có sẵn.** Mọi nút vào hệ thống là `<form action={…}>` gọi `setChannel` của `app/actions/session.ts` (không sửa tệp này, không sửa `lib/session/**`). Bảng nút và khu vực:

  | Nút | Khu vực | Trang đích (từ `CHANNEL_HOME`) |
  |---|---|---|
  | "Vào hệ thống" (thanh trên), "Vào Bảng điều khiển" (khối kết), "Vào khu vận hành" (thẻ Giao dịch viên) | `teller` | `/` |
  | "Tôi là nhà đầu tư" (màn đầu), "Vào khu nhà đầu tư" (thẻ vai và khối kết) | `investor` | `/portfolio` |
  | "Vào khu người bán" | `seller` | `/seller` |
  | "Vào khu kiểm soát" | `controller` | `/` |

  Mỗi vai một mục trong hằng `LANDING_ROLES` (design mục 2) để unit test khoá bảng này. Thẻ dự án KHÔNG là liên kết (bản chốt trỏ `token-detail` cần vai Nhà đầu tư và `setChannel` chỉ về `CHANNEL_HOME`; hai dự án mẫu trỏ `#`). Ba nút ở màn đầu và thanh trên giữ dạng nút của bản chốt.
- **QĐ-5. Câu chữ.** Lấy nguyên văn bản chốt `index.html`, trừ đúng 4 chỗ Sếp sửa 06/11 và các chỗ ghi ở design mục 1:

  | Vị trí | Bản chốt | Mới |
  |---|---|---|
  | `h1` màn đầu | "Gió An Viên, lợi tức về ví bạn" | "Nền tảng Token hoá dự án điện gió, đầu tư bền vững, lợi tức dài hạn" |
  | Câu phụ khối "Ba dự án điện gió" | "Mỗi dự án có token riêng. WPT của Điện gió An Viên đã phát hành trên chuỗi; hai dự án còn lại đang là dữ liệu mẫu." | "Đầu tư dài hạn, lợi nhuận bền vững - Đối tác của BIDV" (dấu gạch nối U+002D có khoảng trắng hai bên, đúng như Sếp viết) |
  | Chặng "Gió" | "62 tua-bin tại An Viên quay theo mùa gió" | "Các dự án điện gió lớn phù hợp định hướng ESG, sản lượng điện đều đặn" |
  | Chặng "Doanh thu" | "Tiền điện về vault thanh toán SPV" | "Tiền điện định kỳ chuyển về vault thanh toán do BIDV quản lý" |

  Không đổi câu nào khác; câu có trong bản chốt mà trang không dùng (khối Sơ đồ, câu của trình xem artifact) thì bỏ. Không ký tự cấm (U+00B7, U+2014, U+2192, U+00D7, chuỗi `-\x3e` (gạch nối liền dấu lớn hơn)).
- **QĐ-6. Màu.** Không mã màu trong tệp `.tsx`, `.module.css` của task (tasks bước 6b). `--tile-hl`, `--tile-au` là GRADIENT (`globals.css:116`, `:121`), không dùng làm `background-color`: nền màn đầu, khối kết, ảnh thẻ dự án dùng utility có sẵn `tile-hl`, `tile-au` (`globals.css:266`, `:276`; utility còn đặt lại `--foreground`, `--muted-foreground`, `--primary` trong khối, đúng ý cho chữ trên nền tối) hoặc `bg-(image:--tile-hl)`. `--tile-hl` giống nhau ở Sáng và Tối; `--tile-au` Tối đậm hơn một chút (`globals.css:181`), chấp nhận. Bảng đổi màu bản chốt sang token ở design mục 4. Thêm ĐÚNG một token vào `:root` của `globals.css`, KHÔNG khai báo lại trong `.dark`: `--lp-deep: #115d5c;` (bằng `--g700` của bản chốt `c.css:6`, chữ của nút trắng trên nền tối, 7,6:1 trên `--tile-hl-ink`), kèm chú thích một dòng. Không thêm `@keyframes` vào `globals.css`; keyframes của trang nằm trong `components/landing/landing.module.css` và chỉ dùng `var(...)`.
- **QĐ-7. Logo trên thanh trên.** Thêm biến thể `variant="inline"` vào `components/bidv-logo.tsx`: cùng hình chữ và bông mai (khai báo `<symbol id="bidv-flower">` như bản đầy đủ), cao 24 px, vạch ngăn dọc 1,5 px màu `bg-border`, khối chữ "RWA" / "Tokenize Platform" xếp dọc bên phải (bản chốt `.lp-logo`). Hai biến thể `full`, `icon` giữ nguyên từng ký tự (checkpoint dán diff). Trang giới thiệu không có thanh bên nên không có bản `full` khác trong DOM, `<use href="#bidv-flower">` vẫn trỏ được. Logo dựng ở SERVER (`landing-page.tsx`) rồi truyền vào `LandingChrome` qua prop `logo: React.ReactNode`, như `app-layout.tsx` truyền cho `Sidebar` (`bidv-logo.tsx:4-5`: đường vẽ không vào JS trình duyệt). Thêm luôn biến thể `variant="compact"` cho FE-UX-07b (logo nhỏ trên thanh đầu dưới 1100 px, bản chốt `shell.js:190`, `shell.css:167-168`): hình chữ cao 16 px, KHÔNG khai báo `<symbol>` mà dùng `<use href="#bidv-flower">` (trong khung, bản `full` của thanh bên luôn có trong DOM, `bidv-logo.tsx:9`; khai báo lại sẽ trùng `id`), một dòng chữ 10 px "<b>RWA</b> Tokenize Platform" dưới hình; `role="img"` `aria-label="BIDV"`. Task này chỉ thêm biến thể, chưa dùng ở đâu (unit nhóm 4 dựng thử).
- **QĐ-8. Nút về đầu trang (góp ý Sếp 06/11).**
  - Một nút `button` tròn 40 px, biểu tượng mũi tên lên, `aria-label="Về đầu trang"`, `position: fixed`, góc trên bên phải: `top: 84px` (ngay dưới thanh trên, không đè thanh trên khi thanh hiện lại), `right: max(12px, calc((100% - 1200px) / 2 - 56px))`.
  - Ẩn khi `scrollY` chưa quá 80% chiều cao cửa sổ; hiện khi đã quá. Lúc ẩn: `opacity-0`, `pointer-events-none`, `inert`, không vào thứ tự Tab. Chuyển hiện, ẩn bằng opacity và dịch 8 px, 300 ms.
  - Kiểu "mờ": lúc nghỉ toàn nút `opacity` 0,6, nền `bg-card/40`, viền `ring-1 ring-border/60`, KHÔNG `backdrop-filter` (để thấy rõ chữ bên dưới khi nút đè nội dung); di chuột hoặc `:focus-visible` thì `opacity` 1, nền `bg-card/85`.
  - Màn từ 1304 px trở lên nút nằm trọn trong lề phải, ngoài khung nội dung 1200 px (không che nội dung). Màn hẹp hơn nút được đè lên mép nội dung (Sếp duyệt 06/11), vẫn ở độ mờ trên.
  - Bấm: cuộn về đầu (`behavior: 'smooth'`, hoặc `'auto'` khi người dùng chọn giảm chuyển động), rồi chuyển tiêu điểm về liên kết logo của thanh trên (`focus({ preventScroll: true })`).
- **QĐ-9. Liên kết "Giới thiệu dự án" trên thanh bên (Sếp góp ý 06/11, chỉ Nhà đầu tư).**
  - Thành phần mới `components/layout/intro-link.tsx` (`'use client'` nếu cần `usePublicConfig`; nhận `collapsed: boolean`, `onNavigate?: () => void`). `sidebar.tsx` chỉ thêm import và MỘT dòng `{config.role === "INVESTOR" && <IntroLink collapsed={collapsed} onNavigate={closeDrawer} />}` làm phần tử ĐẦU TIÊN của khối đáy (`sidebar.tsx`, khối "Đáy: Lưu ký, chọn chain", ngay trên `ChainSelector`; đúng ô đỏ trong ảnh Sếp gửi). Không đổi gì khác của `sidebar.tsx` (checkpoint dán diff). Không thêm vào `nav-config.ts` (không phải mục menu, không vào `aside nav`, không `aria-current`).
  - Dựng: `Link` của `next/link` với `prefetch={false}` đặt TRƯỚC mọi thuộc tính có `=>` (phép kiểm `hf-01-hieu-nang.test.ts:21` dùng `/<Link\b[^>]*>/`, dừng ở dấu `>` đầu tiên); `onClick={onNavigate}` (không viết hàm mũi tên trong thẻ), `href="/gioi-thieu"`, lớp `group flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; chữ "Giới thiệu dự án"; sau chữ là biểu tượng `ArrowRight` cỡ `size-4`, màu xanh mờ `text-primary/50`, dịch sang phải khi di chuột (`nudge-x`, cha có `group`), `aria-hidden`.
  - Thanh bên thu gọn (88 px): chỉ còn biểu tượng, canh giữa, `aria-label="Giới thiệu dự án"`, `title="Giới thiệu dự án"`; chữ ẩn bằng `sr-only` như các mục khác.
  - Biểu tượng: `ArrowRight` hiện chưa có ở `sidebar.tsx`; nếu thêm làm JS mọi trang có khung tăng quá 256 B gzip thì chọn biểu tượng có sẵn trong thanh bên (`ChevronRight`), ghi DEVIATION.
  - Ba vai còn lại không thấy liên kết. Bấm liên kết ở ngăn kéo (dưới 1100 px) thì đóng ngăn kéo (`onNavigate`).
- **QĐ-10. Thanh trên của trang giới thiệu.** Rộng bằng khung nội dung `min(1200px, 100% - 48px)` (bản chốt dùng `100% - 28px`, lệch khung nội dung 10 px mỗi bên dưới 1248 px, cùng loại lỗi lệch lề Sếp nêu ở thanh đầu của khung (FE-UX-07b); spec này sửa luôn ở trang giới thiệu). Ẩn khi cuộn xuống quá 160 px (dịch lên, mờ đi), hiện lại khi cuộn lên. Ngưỡng 6 px tính từ ĐIỂM ĐẢO CHIỀU GẦN NHẤT (`anchorY`), không từ vị trí của sự kiện trước (bản chốt so với sự kiện trước nên cuộn chậm 1 đến 6 px mỗi sự kiện thì thanh không bao giờ ẩn hoặc hiện): khi thanh đang hiện, `anchorY` theo điểm thấp nhất (`min`) đã qua, ẩn khi `y > 160` và `y - anchorY > 6`; khi đang ẩn, `anchorY` theo điểm cao nhất (`max`), hiện khi `anchorY - y > 6`; mỗi lần đổi trạng thái đặt `anchorY = y`; `y <= 160` thì luôn hiện. Một trình nghe `scroll` thụ động dùng chung cho thanh trên và nút về đầu trang, gom vào một `requestAnimationFrame` mỗi khung hình; `anchorY` giữ trong `useRef`; chỉ gọi `setState` khi `navHidden` hoặc `showTop` thực sự đổi. Quyết định tính bằng hàm thuần `landingChromeState` (design mục 2) để unit test được.
- **QĐ-11. Lối vào trang.** Chỉ có liên kết của QĐ-9 (Nhà đầu tư). Ba vai còn lại mở bằng đường dẫn; Supervisor hỏi Sếp sau nếu cần.
- **QĐ-12. Số mẫu.** Sáu ô số liệu và thẻ hai dự án Phú Quý, Ninh Thuận có `UnverifiedNote` (`components/ui/unverified-note.tsx`, không sửa). Số đọc từ hằng (QĐ-3). Ô "Lợi tức đã chia" lấy `MOCK_WIND_STATS.profitDistributedVndBn` (5,8 tỷ), `distributionPeriods` (6 kỳ), KHÁC số vẽ tay 86,4 tỷ của bản chốt, để khớp `/assets` (`assets.tsx:155`); ô "Lợi tức mục tiêu" lấy `WPT_ANNUAL_YIELD_PERCENT` (hằng mặc định của điều khoản phát hành; trang tĩnh không đọc cấu hình đang hiệu lực nên vẫn kèm `UnverifiedNote` với `title="Hằng mặc định, chưa đọc cấu hình đang hiệu lực"`). Checkpoint ghi lệch này.
- **QĐ-13. Video.** Mã video tạm `M52hkUDVe5w` khai báo đúng MỘT hằng. Khi người dùng không chọn giảm chuyển động: sau khi hydrate, khung video là `iframe` `https://www.youtube-nocookie.com/embed/M52hkUDVe5w?autoplay=1&mute=1&loop=1&playlist=M52hkUDVe5w&rel=0&modestbranding=1&playsinline=1` (như bản chốt khi chạy trong app), `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`, `allowFullScreen`, `title` design mục 1 khối 2. Khi chọn giảm chuyển động: giữ ảnh nền có nút phát, KHÔNG phát sinh yêu cầu mạng nào tới YouTube (`youtube`, `youtube-nocookie`, `ytimg`, `googlevideo`) trước khi bấm, kể cả kiểu tạo `iframe` rồi gỡ sau hydrate; bấm nút thì mới thay bằng `iframe`. Không `setState` đồng bộ trong effect (luật `react-hooks/set-state-in-effect`); đọc `prefers-reduced-motion` bằng `useSyncExternalStore` như `lib/hooks/use-is-mounted.ts`, `getServerSnapshot` trả "giảm chuyển động" để HTML máy chủ và lượt hydrate luôn là ảnh nền có nút phát, KHÔNG có `iframe`; chỉ sau hydrate, khi người dùng không chọn giảm chuyển động, mới dựng `iframe`. Liên kết "Không xem được? Mở trên YouTube" mở tab mới, `rel="noopener noreferrer"`.
- **QĐ-14. Ảnh 3D tạm.** Chép đúng các tệp cần dùng từ `docs/prototypes/20261101_ui_ux_ban_chot/assets/3d/` sang `app/public/landing/3d/` (giữ tên: `leaf`, `zap`, `classic`, `scales`, `moneybag`, `coin`, `office`, `memo`, `check`, `id`, `shield`, `handshake`, `ledger`, 13 tệp `.webp`) cùng `LICENSE.txt` (MIT, chép nguyên). Dùng `<img>` thường (`width`, `height` 56 hoặc 64 hoặc 34 theo vị trí, `alt=""`, `loading="lazy"`, `decoding="async"`), không `next/image`; dòng `eslint-disable-next-line @next/next/no-img-element` nếu lint cảnh báo, kèm lý do một dòng.
- **QĐ-15. Hiệu năng.**
  - JS gzip `/gioi-thieu` (cộng gzip mọi tệp script tải khi mở, đo như `tools/20261104_do_moc_measure.js`) không vượt JS gzip của `/account` đo cùng cách, cùng bản build.
  - Các trang có khung: JS theo byte so bản build mốc riêng không tăng quá 256 B gzip mỗi trang (liên kết thanh bên, QĐ-9); lệch do thứ tự module mà không thêm mã thì ghi giải thích.
  - CSS dùng chung gzip không tăng quá 1,5 KB; CSS riêng của trang giới thiệu (module) gzip không quá 4 KB; tổng ảnh `public/landing/3d` không quá 60 KB.
  - Biểu tượng: trong Server Component dùng tự do (không vào JS trình duyệt). `Sun`, `Moon` (nút đổi giao diện), `ArrowRight` (nút "Vào hệ thống") đã có ở khung: dựng ở `landing-page.tsx` rồi truyền vào `LandingChrome` qua prop (`themeIcons: { sun: React.ReactNode; moon: React.ReactNode }`, `enterIcon: React.ReactNode`), không nhập trong tệp client. `ArrowUp` (nút về đầu trang) chưa có ở khung, nhập trực tiếp được. Trong Client Component của trang (`landing-chrome.tsx`, `hero-video.tsx`, `enter-channel-form.tsx`) nếu một biểu tượng cũng có ở khung (`header.tsx`, `sidebar.tsx`) làm chunk dùng chung đổi, JS các trang có khung tăng, thì truyền biểu tượng từ Server Component qua `children` hoặc đổi biểu tượng cùng nghĩa, ghi DEVIATION (như 05a, 05c).
  - `metrics.json` của các đường dẫn đo: ba số lỗi không tăng so với mốc; `/gioi-thieu` 0 lỗi console, 0 `pageerror`, 0 cảnh báo hydrate (e2e ca 1, ca 5).

## 3. Phạm vi tệp (danh sách trắng)

| Được sửa | Ghi chú |
|---|---|
| `app/src/app/(public)/layout.tsx`, `app/src/app/(public)/gioi-thieu/page.tsx` (mới) | QĐ-1 |
| `app/src/components/landing/*` (mới): `landing-page.tsx`, `landing-chrome.tsx`, `hero-video.tsx`, `turbine-scene.tsx`, `enter-channel-form.tsx`, `landing-data.ts`, `landing.module.css` | Design mục 1, 2; tách khác thì ghi DEVIATION |
| `app/public/landing/3d/*.webp` (13 tệp), `app/public/landing/3d/LICENSE.txt` (mới) | QĐ-14 |
| `app/src/components/bidv-logo.tsx` | CHỈ thêm biến thể `inline`, `compact`, QĐ-7 |
| `app/src/components/layout/intro-link.tsx` (mới) | QĐ-9 |
| `app/src/components/layout/sidebar.tsx` | CHỈ import và một dòng chèn `IntroLink`, QĐ-9 |
| `app/src/app/globals.css` | CHỈ một token `--lp-deep` và chú thích, QĐ-6 |
| `app/test/four-roles-routes.test.ts` | CHỈ theo QĐ-2 |
| `app/e2e/investor-channel.spec.ts` | CHỈ `:203-206`: số liên kết trong thanh bên của Nhà đầu tư từ 7 thành 8 (thêm liên kết QĐ-9) kèm sửa chú thích tương ứng |
| `app/e2e/fe-ux-07a-gioi-thieu.spec.ts`, `app/test/fe-ux-07a.test.ts` (mới) | Design mục 3 |
| `docs/tech-report.md` | CHỈ khi số dòng marker dời, chỉ đổi khối tự sinh bằng `node scripts/scan-pending.mjs --write-report` |
| `docs/fe-ux-07a-gioi-thieu/{requirements,design,tasks}.md`, `docs/CHECKPOINT_FEUX07A.md` (và `_DETAIL.md` nếu quá 800 dòng), `docs/USER_GUIDE.md`, `.kiro/task-status.json` | Theo quy ước repo |

Cấm mọi tệp khác, gồm `lib/**`, `app/actions/**`, `app/api/**`, `components/ui/**`, các tệp khác trong `components/layout/**` (kể cả `header.tsx`, `nav-config.ts`, `chain-selector.tsx`), `app/src/app/layout.tsx`, test và e2e có sẵn (trừ `four-roles-routes.test.ts` và đúng một chỗ của `investor-channel.spec.ts` dưới đây), `playwright.config.ts`, `package*.json`, `docs/prototypes/**`.

## 4. Điều kiện hoàn thành

- [ ] `/gioi-thieu` đủ 8 khối theo design mục 1, thứ tự đúng bản chốt, không có khối "Sơ đồ trang xem thử"; checkpoint có bảng từng khối bản chốt và phần dựng tương ứng.
- [ ] Trang công khai: mở được không cần cookie vai, không có thanh bên, không `ChannelGuard`; `four-roles-routes.test.ts` sửa đúng QĐ-2 và xanh.
- [ ] Bốn câu chữ đổi đúng QĐ-5, mọi câu khác đúng nguyên văn bản chốt (trừ chỗ design mục 1 ghi rõ); không ký tự cấm.
- [ ] Nút vào khu vực đúng bảng QĐ-4 (unit nhóm 2 khoá `LANDING_ROLES`, e2e ca 4 vào thật cả bốn khu vực).
- [ ] Nút về đầu trang đúng QĐ-8: ẩn ở đầu trang, hiện sau 80% chiều cao cửa sổ, mờ lúc nghỉ, rõ khi di chuột hoặc tiêu điểm, nằm trong lề phải từ 1304 px, bấm thì về đầu và tiêu điểm về logo.
- [ ] Thanh trên trang giới thiệu đúng QĐ-10: mép trùng khung nội dung ở 1440, 1280, 390 px, ẩn khi cuộn xuống, hiện khi cuộn lên, kể cả khi cuộn chậm 2 px mỗi lần.
- [ ] Liên kết "Giới thiệu dự án" đúng QĐ-9: chỉ Nhà đầu tư thấy, nằm ngay trên ô chọn chain, có mũi tên xanh mờ, dẫn tới `/gioi-thieu`, thu gọn chỉ còn biểu tượng có tên; `sidebar.tsx` chỉ thêm import và một dòng; ảnh thanh bên Nhà đầu tư mở rộng, thu gọn, Sáng, Tối.
- [ ] Không mã màu trong tệp phạm vi; `globals.css` chỉ thêm `--lp-deep`; `bidv-logo.tsx` chỉ thêm biến thể `inline`, `compact` (QĐ-6, QĐ-7).
- [ ] Mở `/gioi-thieu` 0 server action (QĐ-3); số mẫu đọc từ hằng, có `UnverifiedNote` (QĐ-12); video đúng QĐ-13 ở cả hai chế độ chuyển động (giảm chuyển động: 0 yêu cầu tới YouTube trước khi bấm).
- [ ] JS, CSS, ảnh trong trần QĐ-15 (bảng byte); `/gioi-thieu` 0 lỗi console, 0 `pageerror`, 0 cảnh báo hydrate; các đường dẫn đo khác không tăng lỗi so với mốc.
- [ ] Ảnh `/gioi-thieu` cả trang ở 1440, 1100 và 390 px, Sáng và Tối, cộng ảnh nút về đầu trang đang hiện (1440 trong lề, 390 đè nội dung), chụp trên tiến trình mock MỚI khởi động từ bản build nhánh với ĐỦ biến `webServer.env` (`playwright.config.ts:93-110`). Script chụp ngoài repo, không commit.
- [ ] `fe-ux-07a-gioi-thieu.spec.ts` (project mock) đủ 6 ca và `fe-ux-07a.test.ts` đủ 5 nhóm (design mục 3), xanh.
- [ ] Kiểm thử đúng mục 5, đạt, kèm log; log có mục "EVM - E2E PROJECT HARDHAT" xanh; lệnh danh sách trắng, màu cứng, ký tự cấm (tasks bước 6) đúng kỳ vọng.
- [ ] Không mã dư thừa: hằng, hàm, import, lớp không dùng xoá hẳn; không thêm gói npm.

## 5. Phạm vi kiểm thử

| Ai | Chạy | Không chạy |
|---|---|---|
| Dev | `bash scripts/run-local-all.sh arch markers checkpoint app build e2e evm` một lần, khi cổng e2e trống, lưu log; đo bằng `tools/20261104_do_moc_measure.js` (gửi kèm, sha256 `6079a0d679000d4c2bbe559d5a3eb90d362bb018243d45c0888f2fad26cdae1c`; `JS_PAGES=/,/portfolio,/seller,/approvals,/account`) cho 28 đường dẫn có khung (JS mọi trang có khung tăng không quá 256 B gzip do liên kết thanh bên, QĐ-15); JS `/gioi-thieu` đo bằng e2e ca 5 (design mục 3); JS theo byte so bản mốc build riêng; CSS theo cách 01c. Gửi riêng đoạn log từ "EVM - E2E PROJECT HARDHAT" tới hết | `contracts` |
| Supervisor | Đọc diff (đặc biệt `sidebar.tsx`, `bidv-logo.tsx`, `globals.css`, `four-roles-routes.test.ts`); build; chạy `fe-ux-07a-gioi-thieu`, `fe-ux-01b-khung`, `fe-ux-01c-chuyen-dong`, `fix-08`, `uiux-02-dau-man` (e2e và unit), `four-roles-routes`, `four-roles-shell`, `hf-01-hieu-nang`, unit mới; gây lỗi có chủ đích 4 điểm (đổi điều kiện hiện liên kết thành `!== "INVESTOR"`; đổi khu vực của nút "Vào khu người bán" thành `investor`; bỏ `inert` của nút về đầu trang lúc ẩn; thêm `ChannelGuard` vào `(public)/layout.tsx`); xem ảnh | Full suite |
