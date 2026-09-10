import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { chainFamily } from '@/lib/chains/registry';
import { getBankSigner } from '@/lib/signer';
import type { ISigner } from '@/lib/signer';
import { createEvmLedger } from './evm.adapter';
import { createMockLedger } from './mock.adapter';
import { createStellarLedger } from './stellar.adapter';
import type { ILedgerPort } from './ledger.port';

export {
  DEFAULT_RECEIPT_TIMEOUT_MS,
  EVM_RECEIPT_TIMEOUT_MS,
  receiptTimeoutFor,
  LedgerError,
  LedgerNotImplementedError,
  type ILedgerPort,
  type TokenInfo,
  type TxResult,
  type TxStatus,
} from './ledger.port';
export { InvalidAddressError, normalizeEvmAddress } from './address';
export { resetMockLedger } from './mock.adapter';

/**
 * FACTORY — điểm duy nhất map chain -> adapter.
 *
 * Thêm chain mới: thêm entry ở `packages/shared/src/chains.ts`, thêm `*.adapter.ts`,
 * rồi thêm một nhánh ở đây. Nghiệp vụ (server action) KHÔNG phải sửa.
 *
 * Signer truyền vào được (mặc định = signer ngân hàng) để test có thể tiêm signer giả
 * và để Phase 5 đổi sang Fireblocks mà không chạm file này.
 */
export function getLedger(chain: ChainKey, signer: ISigner = getBankSigner()): ILedgerPort {
  switch (chainFamily(chain)) {
    case 'mock':
      return createMockLedger(chain);
    case 'evm':
      return createEvmLedger(chain, signer);
    case 'stellar':
      return createStellarLedger(chain);
  }
}
