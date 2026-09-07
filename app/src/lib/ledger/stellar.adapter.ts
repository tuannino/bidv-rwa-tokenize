import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { LedgerNotImplementedError, type ILedgerPort, type TokenInfo, type TxResult } from './ledger.port';

/**
 * Chỗ cắm Stellar/Soroban (Phase 7). Contract Rust đã có ở `packages/contracts-stellar`.
 *
 * Stub này tồn tại để CHỨNG MINH biên interface đủ tổng quát: thêm chain khác họ
 * không cần sửa `ILedgerPort` hay nghiệp vụ, chỉ cần một file như file này.
 * Mọi method ném lỗi rõ ràng thay vì trả giá trị giả — số dư giả còn tệ hơn lỗi.
 */
export function createStellarLedger(chain: ChainKey = 'stellar'): ILedgerPort {
  const hint = 'Sẽ hiện thực ở Phase 7 bằng SDK Soroban (packages/contracts-stellar).';
  const todo = (operation: string): never => {
    throw new LedgerNotImplementedError(chain, operation, hint);
  };

  return {
    chain,
    async whitelist(): Promise<TxResult> {
      return todo('whitelist');
    },
    async isWhitelisted(): Promise<boolean> {
      return todo('isWhitelisted');
    },
    async freeze(): Promise<TxResult> {
      return todo('freeze');
    },
    async isFrozen(): Promise<boolean> {
      return todo('isFrozen');
    },
    async mint(): Promise<TxResult> {
      return todo('mint');
    },
    async burn(): Promise<TxResult> {
      return todo('burn');
    },
    async transfer(): Promise<TxResult> {
      return todo('transfer');
    },
    async forcedTransfer(): Promise<TxResult> {
      return todo('forcedTransfer');
    },
    async balanceOf(): Promise<bigint> {
      return todo('balanceOf');
    },
    async tokenInfo(): Promise<TokenInfo> {
      return todo('tokenInfo');
    },
    async waitReceipt(): Promise<TxResult> {
      return todo('waitReceipt');
    },
  };
}
