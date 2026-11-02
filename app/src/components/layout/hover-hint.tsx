'use client';

import { cloneElement, useId, type ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * UIUX-02: gợi ý hiện sau khi dừng chuột 3 giây, dựng trên `components/ui/tooltip` có sẵn (Base UI,
 * bong bóng nằm trong portal nên vùng cuộn của thanh bên không cắt). Câu gợi ý gắn vào chính phần
 * tử con qua `aria-describedby`, nên trình đọc màn hình đọc ngay, không phải chờ bong bóng; câu nằm
 * NGOÀI phần tử con nên không làm đổi tên của liên kết hay tiêu đề.
 */
const DELAY_MS = 3000;

export function HoverHint({
  hint,
  side = 'right',
  children,
}: {
  hint: string;
  side?: 'right' | 'bottom';
  children: ReactElement<{ 'aria-describedby'?: string }>;
}) {
  const hintId = useId();
  return (
    // Không cho giữ bong bóng mở bằng cách rê chuột vào nó: rời phần tử là ẩn.
    <Tooltip disableHoverablePopup>
      <TooltipTrigger delay={DELAY_MS} render={<div />}>
        {cloneElement(children, { 'aria-describedby': hintId })}
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} aria-hidden="true">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}
