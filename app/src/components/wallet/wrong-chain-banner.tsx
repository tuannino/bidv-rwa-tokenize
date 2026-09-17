'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
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
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Ví đang ở mạng khác</p>
          <p className="text-sm text-muted-foreground">
            Ví đang ở <span className="font-medium text-foreground">{currentLabel}</span>, còn phần
            này làm việc trên <span className="font-medium text-foreground">{expectedLabel}</span>.
            Hai bên phải cùng một mạng mới thực hiện được giao dịch.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-7">
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
        <p className="pl-7 text-xs text-destructive" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
