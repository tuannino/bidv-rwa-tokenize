/**
 * Chọn mục menu đang sáng (FIX-08 QĐ-1): trong các `href` khớp `pathname`, lấy `href` DÀI NHẤT.
 *
 * Quy tắc khớp giữ như cũ: `/` chỉ khớp chính nó; `href` khác khớp khi `pathname` bằng nó hoặc bắt
 * đầu bằng nó cộng dấu `/`. Lấy dài nhất để ở `/seller/withdraw` chỉ mục "Tạo lệnh rút" sáng, không
 * kéo theo "Tổng quan" (`/seller`). Không `href` nào khớp thì trả `null` (màn không có trong menu).
 */
export function activeNavHref(hrefs: readonly string[], pathname: string): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
