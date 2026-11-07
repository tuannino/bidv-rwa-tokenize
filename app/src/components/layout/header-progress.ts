/**
 * FE-UX-07b QĐ-2: tiến độ cuộn `--hp` (0 đến 1) của thanh đầu, như bản chốt (`shell.js:302-310`).
 * Hàm thuần để unit test; `header.tsx` ghi kết quả thẳng lên phần tử `header`, không `setState`.
 */

/** Quãng cuộn tối thiểu (px) để thanh chuyển hết trạng thái. */
const MIN_RANGE = 60;
/** Không có `h1` trong `main` thì dùng quãng này. */
const DEFAULT_RANGE = 100;
/** Thanh chuyển xong khi đáy `h1` còn cách đỉnh vùng cuộn chừng này (px). */
const TITLE_OFFSET = 30;
/** Hệ số làm mượt mỗi khung hình và ngưỡng dừng. */
const EASE = 0.2;
const SETTLE = 0.002;

/** Đích tiến độ: vị trí cuộn chia quãng, kẹp trong 0..1; quãng dưới 60 coi là 60. */
export function headerProgress({ scrollTop, range }: { scrollTop: number; range: number }): number {
  return Math.min(1, Math.max(0, scrollTop / Math.max(MIN_RANGE, range)));
}

/**
 * Quãng cuộn: đáy `h1` đầu tiên của `main` theo toạ độ nội dung vùng cuộn, trừ 30, tối thiểu 60;
 * không có `h1` thì 100.
 */
export function progressRange(container: HTMLElement, main: Element | null): number {
  const title = main?.querySelector("h1");
  if (!title) return DEFAULT_RANGE;
  const bottom = title.getBoundingClientRect().bottom - container.getBoundingClientRect().top + container.scrollTop;
  return Math.max(MIN_RANGE, bottom - TITLE_OFFSET);
}

/** Một bước làm mượt về đích; lệch dưới 0,002 thì về hẳn đích; giảm chuyển động thì về đích ngay. */
export function stepProgress({ current, target, reduce }: { current: number; target: number; reduce: boolean }): number {
  if (reduce) return target;
  const next = current + (target - current) * EASE;
  return Math.abs(target - next) < SETTLE ? target : next;
}
