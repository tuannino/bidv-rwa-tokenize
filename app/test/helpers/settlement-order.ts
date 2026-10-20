import { randomUUID } from 'node:crypto';
import type { ILedgerPort, SettlementOrder } from '@/lib/ledger/ledger.port';

/** Dựng đầu vào cổng khớp lệnh với giá hiện tại; test có thể ghi đè để kiểm giá sai/trùng mã. */
export async function settlementOrder(
  ledger: ILedgerPort,
  investor: string,
  wptAmount: bigint,
  overrides: Partial<Pick<SettlementOrder, 'orderId' | 'vndAmount'>> = {},
): Promise<SettlementOrder> {
  return {
    orderId: overrides.orderId ?? randomUUID(),
    investor,
    wptAmount,
    vndAmount: overrides.vndAmount ?? (wptAmount > 0n ? await ledger.quotePurchase(wptAmount) : 0n),
  };
}
