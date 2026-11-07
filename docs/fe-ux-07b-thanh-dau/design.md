# FE-UX-07b: thiết kế

## 1. Số đo bản chốt (màn `transactions.html`, `portfolio.html`, đo ngày 06/11 bằng `tools/20261106_do_thanh_dau_ban_chot.js`)

| Phần | 1440 px, đầu trang (`--hp` 0) | 1440 px, cuộn 500 px (`--hp` 1) | 390 px, đầu trang | 390 px, cuộn |
|---|---|---|---|---|
| Thanh | cao 44, đỉnh 10, lề 24, bo 18, đệm `0 8 0 20`, nền trong suốt | như trái, nền `rgba(3,46,45,.9)` (Tối `rgba(2,30,29,.92)`), bóng `0 10px 28px -18px rgba(1,40,39,.9)` | cao 46, đỉnh 8, lề 12, bo 16, đệm `0 8 0 12`, nền `rgba(3,46,45,.04)` (Tối 0) | nền `.9` (Tối `.92`) |
| Tên màn | `opacity` 0, dịch xuống 14 px | `opacity` 1, chữ trắng 14 px đậm 700, vạch 3 x 16 px gradient | `opacity` 0 | `opacity` 1 |
| Logo nhỏ | không có | không có | `BidvLogo` cao 16 kèm "RWA Tokenize Platform" 10 px, `opacity` 1 | `opacity` 0 |
| Nút ví | cao 30, rộng 103, chữ 13 px 500, gradient `#e0b44a` sang `#c9971c`, chữ `#1d1300`, bóng vàng | như trái, bóng tối | cao 30, rộng 38, chỉ biểu tượng | như trái |
| Nút Sáng Tối | 30 x 30, nền trắng 70% (Tối `rgba(17,23,23,.7)`) | nền trắng 12%, viền trắng 20%, chữ trắng | như 1440 | như 1440 |
| Đường chân trời | cao 2, cách mép 20 (`shell.css:299`), `opacity` 0 | `opacity` 1 (`shell.css:281`) | như 1440 | như 1440 |
| Mờ nền | không | `blur(18px) saturate(1.35)` | `blur(14px)` | `blur(14px)` |

Mốc bề rộng: bản chốt coi 1100 px là màn hẹp (`max-width: 1100px`), app coi 1100 px là màn rộng; số trong bảng đo ở 1440 và 390 nên không bị ảnh hưởng.

App hiện tại (`release/ui-v2` @ `29c5708`, đo cùng cách): thanh cao 56 (390 px: 48), đỉnh 0 khi cuộn, lề 12 px ở mọi bề rộng (từ 1100 px lệch nội dung 12 px mỗi bên), nền thẻ trắng 80% cố định, bo 22, tên màn 16 px chữ thường hiện cố định, nút ví RainbowKit cao 40 chữ 16 px đậm, nút Sáng Tối 36. Ảnh so sánh: `20261106_thanh_dau_ban_chot_va_ui_v2_1440.png`, `..._390.png` (Supervisor gửi kèm).

## 2. Cấu trúc

```
<header ref data-on? style="--hp: …" class="sticky top-2.5 mt-2.5 mx-6 h-11 … before:… (nền) after?:… (bóng)">
  [nút menu, dưới 1100 px]
  <div relative min-w-0 flex-1>
    [logo nhỏ, dưới 1100 px, opacity theo --hp]
    <p> [vạch màu] tên màn </p>          (opacity, transform theo --hp)
  </div>
  <div tb-right gap-2> <HeaderWalletButton/> [nút Sáng Tối] </div>
  <span data-horizon …/>                  (giữ, opacity theo --hp)
</header>
```

- `header-progress.ts`: `headerProgress({ scrollTop, range }): number` (kẹp 0..1, `range` dưới 60 coi là 60); `progressRange(container, main): number` (đọc `getBoundingClientRect` của `main h1`, quy về toạ độ nội dung, trừ 30, tối thiểu 60, không có h1 thì 100); `stepProgress({ current, target, reduce }): number` (một bước làm mượt, dừng khi lệch dưới 0,002, `reduce` thì trả `target`).
- `header.tsx`: một `useEffect` gắn trình nghe trên `headerRef.current.parentElement` (vùng cuộn) và `window` `resize`; phụ thuộc `pathname` để tính lại. Đọc `prefers-reduced-motion` bằng `matchMedia` trong effect (không cần state).
- `header-wallet-button.tsx`: `HeaderWalletButton` (client, `ConnectButton.Custom`) và `HeaderWalletButtonView` (thuần).

## 3. Kiểm thử mới

`app/test/fe-ux-07b.test.ts` (môi trường `node`; `renderToStaticMarkup`, `createElement`; viết ký tự cấm bằng escape `\u00b7`, `\u2014`):

1. **Mã nguồn:** `header.tsx` không `useState(` cho tiến độ (cho phép `useState` khác nếu có, liệt kê trong checkpoint; mong đợi 0), có `setProperty('--hp'`, có `requestAnimationFrame(`, `cancelAnimationFrame(`, `addEventListener('scroll'` kèm `passive: true` và `removeEventListener('scroll'`; có các lớp (so theo ranh giới token, ví dụ `/(^|\s)top-2(\s|$)/`, để `top-2.5` không làm khớp nhầm `top-2`) `min-[1100px]:mx-6`, `mx-3`, `top-2`, `min-[1100px]:top-2.5`, không `top-0`, không `bg-card/80`; giữ `inert={open}`, `id={MENU_BUTTON_ID}`, `data-horizon`, `title={resolvedTheme === "dark" ? "Chuyển sang Light mode" : "Chuyển sang Dark mode"}`; không còn `<ConnectButton` trực tiếp (chỉ `HeaderWalletButton`). `globals.css` có đủ 7 token QĐ-9, `--hdr-on`, `--hdr-shadow` có ở cả `:root` và `.dark`. Không mã màu trong `header.tsx`, `header-wallet-button.tsx`. `chains.ts`: `CHAINS['hardhat-local'].label === 'Private Chain'`, `key`, `chainId` 31337, `defaultRpcUrl` như cũ; `git diff` của tệp này đúng 1 dòng (kiểm ở tasks 6a, không ở unit).
2. **Hàm thuần:** `headerProgress` kẹp đúng (âm, 0, giữa, quá `range`, `range` 10 thì dùng 60); `stepProgress`: `reduce` trả thẳng đích; không `reduce` thì sau tối đa 40 bước từ 0 tới 1 đạt đúng 1 (dừng khi lệch dưới 0,002), mỗi bước đơn điệu.
3. **`HeaderWalletButtonView`:** bốn trạng thái: `disconnected` có chữ "Kết nối ví", biểu tượng `aria-hidden`, lớp gradient dùng `--hdr-gold-from`; dưới 640 px chữ bọc `max-[640px]:sr-only` (hoặc tương đương) và nút có `aria-label="Kết nối ví"`; `wrong-network` có "Sai mạng" và lớp `bg-bad-bg`; `connected` có `label` truyền vào; `loading` có `aria-hidden="true"` và không nhận bấm. Không U+00B7, U+2014.
4. **Nhãn chain:** `CHAINS['hardhat-local'].label === 'Private Chain'`; `wallet-status.ts` với app ở `evm` và ví ở chain 31337 ra trạng thái `chain-mismatch` có `walletChain === 'Private Chain'` (`wallet-status.ts:153`); với app ở `hardhat-local` và ví ở chain 1 ra `wrong-chain` có `expectedLabel === 'Private Chain'` (`:145`). (App ở `mock` trả `{ kind: 'mock' }` ngay, `:110`, không dùng nhãn.)

`app/e2e/fe-ux-07b-thanh-dau.spec.ts` (chỉ project mock; chờ tải: `networkidle` cộng 1 giây; đọc kiểu bằng `getComputedStyle`; giá trị chuyển dần thì đọc bằng `expect.poll`):

| Ca | Kiểm |
|---|---|
| 1 | Hình học, vai Giao dịch viên `/transactions` (sau khi tệp `ops-transactions` tạo dữ liệu nếu chạy trong bộ đầy đủ; chạy riêng thì trang vẫn đủ dài, nếu vùng cuộn không cuộn được 600 px thì khẳng định điều đó trước và dùng `/approvals` của Kiểm soát viên, ghi checkpoint): 1440, 1100, 1099, 390 px: mép trái, phải `header` lệch mép nội dung `main` (mép cộng `padding`) không quá 1 px; cao 44 (từ 1100) hoặc 46 (dưới 1100) lệch 1 px; bo 18 hoặc 16. Cuộn vùng cuộn 600 px (khẳng định `scrollTop >= 600`): đỉnh `header` 10 (từ 1100) hoặc 8 px lệch 1 px |
| 2 | Hai trạng thái, 1440 px Sáng: đầu trang `--hp` của `header` bằng 0, `opacity` của `p` tên màn 0, `opacity` của `[data-horizon]` 0; cuộn 500 px: `--hp` tới 1 (poll), `data-on` có, `p` `opacity` 1 và màu chữ `rgb(255, 255, 255)`, cỡ 14 px, đậm 700; màu nền tính của lớp nền (`::before`) là `rgba(3, 46, 45, 0.9)` nhân `opacity` 1; cuộn về 0: `--hp` về 0. Tối: nền `rgba(2, 30, 29, 0.92)`. 390 px Sáng ở đầu trang: lớp nền `opacity` khoảng 0,044 (0,04 / 0,9, lệch 0,01) |
| 3 | Giảm chuyển động (`reducedMotion: 'reduce'`): cuộn 500 px, chờ hai `requestAnimationFrame` liên tiếp rồi đọc `--hp` một lần (không poll): bằng 1; `getComputedStyle([data-horizon], '::after').animationName` là `none` (như `fe-ux-01c-chuyen-dong.spec.ts:177`) |
| 4 | Nút: 1440 px nút "Kết nối ví" cao 30 lệch 1, chữ 13 px; nút Sáng Tối 30 x 30; 390 px nút ví chỉ biểu tượng, rộng 38 lệch 1, tên truy cập "Kết nối ví"; bấm nút ví mở hộp thoại RainbowKit (`[role="dialog"]` hiện), `Escape` đóng. Dưới 1100 px ở đầu trang có logo nhỏ trong `header` (`role="img"` tên "BIDV"), `opacity` 1; cuộn 500 px thì `opacity` 0 và hộp bao logo không giao hộp bao tên màn khi `--hp` bằng 1 |
| 5 | Nhãn chain: thanh bên `#chain-selector option[value="hardhat-local"]` có chữ "Private Chain"; không phần tử nào trong trang có chữ "Hardhat Local". Mở 5 màn (`/`, `/portfolio`, `/seller`, `/approvals`, `/wallet` theo đúng vai): 0 `console` loại `error`, 0 `pageerror`, 0 thông điệp chứa "hydrat" ở 1440 và 390 px |
