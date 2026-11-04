/**
 * Nền trôi (FE-UX-01c QĐ-3): ba quầng sáng trôi chậm phía sau mọi nội dung. Dựng ở server (không
 * "use client"), đặt MỘT lần trong `app/layout.tsx` nên không dựng lại khi đổi màn.
 *
 * Mỗi quầng là `radial-gradient` mờ dần sẵn (không `filter: blur`), màu lấy từ token qua `color-mix`,
 * chỉ animate `transform` (keyframes `drift` trong `globals.css`). Giao diện Tối mờ hơn Sáng; dưới
 * 1100 px quầng nhỏ còn khoảng 60%. Giảm chuyển động: quầng đứng yên, vẫn hiện.
 */
const BLOB = "absolute rounded-full will-change-transform opacity-50 dark:opacity-28";

export function BackgroundFx() {
  return (
    <div data-bgfx aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <i
        className={`${BLOB} -top-[260px] -right-40 size-[620px] animate-[drift_26s_ease-in-out_infinite_alternate] bg-[radial-gradient(circle,color-mix(in_oklab,var(--chart-3)_45%,transparent),transparent_65%)] max-[1099px]:-top-[156px] max-[1099px]:-right-24 max-[1099px]:size-[372px]`}
      />
      <i
        className={`${BLOB} -bottom-[320px] left-[18%] size-[520px] animate-[drift_32s_ease-in-out_infinite_alternate] bg-[radial-gradient(circle,color-mix(in_oklab,var(--accent)_38%,transparent),transparent_65%)] max-[1099px]:-bottom-[192px] max-[1099px]:size-[312px]`}
      />
      <i
        className={`${BLOB} top-[30%] -left-40 size-[420px] animate-[drift_38s_ease-in-out_infinite_alternate] bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_65%)] max-[1099px]:-left-24 max-[1099px]:size-[252px]`}
      />
    </div>
  );
}
