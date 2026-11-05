'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface WrongChainBannerProps {
  /** Mạng ví đang ở, viết bằng chữ cho người đọc — không phải chain ID. */
  currentLabel: string;
  /** Mạng cần chuyển sang. */
  expectedLabel: string;
  onSwitch: () => void;
  /** Đang chờ ví trả lời. */
  switching?: boolean;
  /** Lý do lần chuyển trước không thành, kể cả khi người dùng tự từ chối (R3.4). */
  error?: string | null;
  /**
   * Cách xử lý thay thế, ví dụ ở trạng thái `chain-mismatch` thì có thể đổi mạng của trang
   * thay vì đổi mạng của ví. Đặt cạnh nút chuyển để người dùng thấy cả hai lối.
   */
  children?: React.ReactNode;
}

/**
 * Dải cảnh báo ví đang ở mạng khác (R3.1, R3.2, R3.4).
 *
 * Tách riêng khỏi trang kết nối ví để FE-05 (mua WPT), FE-09 (lợi nhuận) và FE-11 (tất toán)
 * dùng lại: ở các màn đó cảnh báo phải nằm ngay cạnh nút ký, chứ bắt người dùng quay về
 * trang ví rồi tự đoán vì sao nút bị mờ là cách làm tệ.
 *
 * Thành phần này KHÔNG tự quyết định gì. Nó không biết chain ID, không gọi ví, chỉ nhận nhãn
 * và một hàm xử lý. Việc quyết định nằm ở `useWalletStatus` — một chỗ duy nhất.
 *
 * Không tự động chuyển mạng (QĐ-5): chỉ chuyển khi người dùng bấm.
 */
export function WrongChainBanner({
  currentLabel,
  expectedLabel,
  onSwitch,
  switching = false,
  error = null,
  children,
}: WrongChainBannerProps) {
  return (
    <Alert
      tone="bad"
      role="alert"
      icon={<TriangleAlert className="mt-px size-[18px] shrink-0" aria-hidden="true" />}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="font-semibold">Ví đang ở mạng khác</p>
          <p>
            Ví đang ở <span className="font-semibold">{currentLabel}</span>, còn phần
            này làm việc trên <span className="font-semibold">{expectedLabel}</span>.
            Hai bên phải cùng một mạng mới thực hiện được giao dịch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSwitch} disabled={switching} size="sm">
            {switching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {switching ? 'Đang chờ ví…' : `Chuyển ví sang ${expectedLabel}`}
          </Button>
          {children}
        </div>

        {/*
          Từ chối chuyển mạng thì hiện lý do ngay tại đây và GIỮ NGUYÊN cảnh báo. Không thử lại
          tự động: gọi lại là dựng vòng lặp hộp thoại mà người dùng không thoát được.
        */}
        {error && (
          <p className="text-xs text-bad-ink" role="status">
            {error}
          </p>
        )}
      </div>
    </Alert>
  );
}
