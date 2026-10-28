import type { OrderSide } from '@/lib/store/order.store.port';

/**
 * Chiều lệnh Nhà đầu tư được chọn ở màn Giao dịch (FIX-02 A4). Cờ `ENABLE_INVESTOR_SELL` tắt (mặc
 * định) thì chỉ còn MUA; máy chủ vẫn chặn lệnh bán độc lập với màn này.
 */
export function tradeSides(sellEnabled: boolean): OrderSide[] {
  return sellEnabled ? ['BUY', 'SELL'] : ['BUY'];
}
