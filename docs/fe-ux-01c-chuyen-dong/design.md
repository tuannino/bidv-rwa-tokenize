# FE-UX-01c: thiết kế

Nguồn: `docs/prototypes/20261101_ui_ux_ban_chot/assets/c.css` dòng 406 tới 460 (nền, easing, giảm chuyển động, beacon), 478 tới 481 (horizon), 121 tới 122 (nút), 446 (biểu tượng menu), 353 tới 354 (rise). Lấy giá trị thời lượng, easing, biên độ; tên lớp theo quy ước repo (Tailwind 4).

## 1. `globals.css`

```css
@theme inline {
  --ease-wind: cubic-bezier(.16, 1, .3, 1);
  --ease-spring: cubic-bezier(.34, 1.4, .64, 1);
}

@keyframes drift   { 0% { transform: translate(0,0) scale(1) } 50% { transform: translate(50px,30px) scale(1.08) } 100% { transform: translate(-30px,18px) scale(.96) } }
@keyframes rise    { from { opacity: 0; transform: translateY(12px) } }
@keyframes horizon { to { translate: -50% 0 } }
@keyframes beacon  { 0% { scale: 1; opacity: .55 } 70%, 100% { scale: 1.6; opacity: 0 } }

@utility lift    { transition: transform .35s var(--ease-wind), box-shadow .35s var(--ease-wind); &:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -24px color-mix(in oklab, var(--primary) 45%, transparent); } }
@utility nudge-x { transition: transform .3s var(--ease-wind); :where(.group):hover & { transform: translateX(4px); } }

[data-page-enter] { animation: rise .5s var(--ease-wind) backwards; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  [data-bgfx] > * { will-change: auto !important; }
}
```

Mã trên là hình dạng, dev chỉnh cú pháp cho Tailwind 4.3 nếu cần (ví dụ `@utility` lồng `&:hover`). `rise` chỉ khai báo `from` và dùng `backwards` (không giữ `transform` sau khi chạy xong, tránh tạo khối chứa cho phần tử `fixed` trong màn), nên khi animation bị tắt phần tử tự ở trạng thái cuối. `@utility` lồng `&:hover` không tự bọc `@media (hover: hover)` như biến thể `hover:`; bọc thêm để thống nhất.

Lưu ý Tailwind 4: các lớp `translate-*`, `rotate-*`, `scale-*` ghi vào thuộc tính CSS riêng `translate`, `rotate`, `scale`, KHÔNG vào `transform`. Test đọc đúng thuộc tính đó.

## 2. Nền trôi `components/motion/background-fx.tsx`

```tsx
export function BackgroundFx() {
  return (
    <div data-bgfx aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <i className="..." /> {/* 3 quầng, mỗi quầng: absolute rounded-full will-change-transform animate-[drift_26s_ease-in-out_infinite_alternate]; không blur */}
    </div>
  );
}
```

| Quầng | Cỡ (1440 px) | Vị trí | Màu (Sáng, độ mờ quầng 0,5; Tối 0,28) | Thời lượng |
|---|---|---|---|---|
| 1 | 620 px | phải -160 px, trên -260 px | `--chart-2` hoặc tông xanh ngọc sáng, 45% | 26 s |
| 2 | 520 px | trái 18%, dưới -320 px | `--accent` (vàng), 38% | 32 s |
| 3 | 420 px | trái -160 px, trên 30% | `--primary`, 18% | 38 s |

Mỗi quầng là `radial-gradient(circle, color-mix(in oklab, var(--token) X%, transparent), transparent 65%)`. Dưới 1100 px nhân cỡ 0,6. Đặt `<BackgroundFx />` trong `body` của `app/src/app/layout.tsx`, trước `Providers`; gốc khung trong `AppLayout` bỏ `bg-background`. Đã đọc mã: `html` không có nền nên nền `body` lan ra canvas, quầng `-z-10` nằm trên nó; gốc khung và vùng cuộn không tạo stacking context. Không dùng blur 80 px như bản chốt; nếu quầng trông gắt, tăng cỡ hoặc hạ điểm dừng `65%`, không thêm filter.

## 3. Khung và thành phần

| Chỗ | Làm |
|---|---|
| `ShellMain` (`header.tsx`) | Bọc `children` trong `<div data-page-enter>`; thêm `key={pathname}` chỉ khi kiểm QĐ-4 cho thấy cần |
| `header.tsx`, trong `header` | Thêm `<span data-horizon aria-hidden="true">`: `pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full opacity-70`. Giả phần tử `after` của nó: `absolute inset-y-0 left-0 w-[200%]`, nền lặp hai chu kỳ `linear-gradient(90deg, transparent, var(--primary) 10%, var(--accent) 25%, var(--primary) 40%, transparent 50%, var(--primary) 60%, var(--accent) 75%, var(--primary) 90%, transparent)` để nối liền khi dịch nửa chiều rộng, `animate-[horizon_8s_linear_infinite]`. `header` đã `sticky` nên là gốc định vị |
| Nút Sáng Tối | `transition-[rotate,background-color,color] duration-300 ease-spring hover:-rotate-12` |
| `NavLink` vòng tròn biểu tượng | `transition-[rotate,scale] duration-500 ease-spring group-hover:-rotate-10 group-hover:scale-112`, `Link` thêm `group` |
| Viên số việc chờ | Khác 0: viên thêm `relative isolate` (khi thu gọn đã là `absolute`, giữ `absolute`) và `data-beacon`; giả phần tử `after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:bg-accent after:-z-10 after:animate-[beacon_2.4s_ease-out_infinite]`. `isolate` để vòng nằm trên nền viên nhưng dưới chữ số. Số 0: không có `data-beacon`, không `after`. Không đổi `aria-label`, chữ số |
| `Button` `default` | Giữ `transition-all` của chuỗi gốc. Thêm `relative overflow-hidden not-disabled:not-aria-disabled:hover:-translate-y-px`; giả phần tử: `after:absolute after:inset-0 after:bg-[linear-gradient(110deg,transparent_30%,color-mix(in_oklab,var(--primary-foreground)_35%,transparent)_50%,transparent_70%)] after:-translate-x-[120%] after:transition-[translate] after:duration-700 after:ease-wind not-disabled:not-aria-disabled:hover:after:translate-x-[120%]`. Nút gốc đã có `disabled:pointer-events-none`; `aria-disabled` (Base UI không gốc, `focusableWhenDisabled`) chặn bằng `not-aria-disabled:` |


## 4. Kiểm thử mới `app/e2e/fe-ux-01c-chuyen-dong.spec.ts`

| Ca | Kiểm |
|---|---|
| 1 | `/` ở 1440 px: `[data-bgfx]` có `aria-hidden="true"`, `position: fixed`, `pointer-events: none`, có 3 con, `animationName` của con đầu là `drift`, `getBoundingClientRect` của con đầu giao với khung nhìn; nền của gốc khung (`aside` cha) là `rgba(0, 0, 0, 0)`; nền `html` là `rgba(0, 0, 0, 0)`; một nút trong `main` bấm được. Đổi màn bằng menu rồi kiểm `[data-bgfx]` vẫn là cùng một phần tử (gắn thuộc tính tạm bằng `evaluate` trước khi đổi, đọc lại sau) |
| 2 | Ở `/` (đã thu gọn thanh bên), TRƯỚC khi bấm menu, gắn bằng `addInitScript` hoặc `evaluate` một bộ nghe `animationstart` trên `document` (bắt pha capture) ghi `{tên, đường dẫn, phần tử có data-page-enter}` vào `window.__anim`, và đánh dấu phần tử `[data-page-enter]` hiện tại. Bấm "Lập lệnh", chờ `h1` của `/draft`. Kiểm: trong `window.__anim` có ĐÚNG MỘT sự kiện `rise` từ `[data-page-enter]` phát sinh sau khi bấm; phần tử `[data-page-enter]` hiện tại không còn dấu (DOM đã thay, ghi kết quả); `animationIterationCount` là `1`, `animationDuration` là `0.5s`; `expect.poll` tới khi `opacity` `1`, `transform` `none`; `aside` vẫn `data-rail="collapsed"`. Lặp cùng kiểm cho cặp `/draft` sang `/transactions` |
| 3 | Ở `/draft`: (a) một `Button` mặc định đang bật: trước khi rê, `getComputedStyle(btn, '::after').translate` có phần x âm; rê chuột, `expect.poll` `translate` của nút khác `none` và phần x của `::after` dương. (b) Gắn `aria-disabled="true"` cho một nút mặc định đang bật bằng `evaluate`, rê chuột, chờ 800 ms: `translate` của nút là `none`, phần x `::after` vẫn âm. Nút `disabled` gốc có `pointer-events-none` nên không rê. (c) Rê lên một mục menu không đang mở: vòng tròn biểu tượng có `rotate` khác `none`. (d) Rê lên nút Sáng Tối: `rotate` khác `none` |
| 4 | `[data-horizon]::after` có `animationName` `horizon`, `animationIterationCount` `infinite`. Mọi viên `[aria-label$="việc đang chờ"]` có chữ `0`: không có `data-beacon`, `::after` `animationName` `none`. Tạo một yêu cầu tạo token ở `/draft` bằng các bước điền form như `maker-checker.spec.ts` ca 3 (chép bước, không import spec cũ), rồi viên của "Lập lệnh" có chữ khác `0`, có `data-beacon`, `::after` `animationName` `beacon`. Đặt ca này cuối tệp; nếu yêu cầu thêm làm spec cũ đổi kết quả thì dừng và báo, không sửa spec cũ |
| 5 | Context `reducedMotion: 'reduce'`: ở `/` và `/draft`, quầng đầu, `[data-page-enter]`, `[data-horizon]::after` đều `animationName` `none`; quầng đầu có `willChange` `auto`; `[data-page-enter]` `opacity` `1` ngay sau khi tải; `Button` mặc định có `transitionDuration` `0s` |
