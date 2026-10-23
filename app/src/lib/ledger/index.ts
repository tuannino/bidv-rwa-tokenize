import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { chainFamily } from '@/lib/chains/registry';
import { serverEnv } from '@/lib/config/env';
import { getBankSigner } from '@/lib/signer';
import type { ISigner } from '@/lib/signer';
import { readIssuePriceVnd } from '@/lib/store/config-values';
import { getChainEventStore } from '@/lib/store';
import { createEvmLedger } from './evm.adapter';
import { memoryMockLedgerStateStore } from './mock-state.store';
import { createMockLedger } from './mock.adapter';
import { createPostgresMockLedgerStateStore } from './postgres-mock-state.store';
import { createStellarLedger } from './stellar.adapter';
import type { ILedgerPort } from './ledger.port';

export {
  DEFAULT_RECEIPT_TIMEOUT_MS,
  MAX_TOKEN_WALLETS,
  EVM_RECEIPT_TIMEOUT_MS,
  receiptTimeoutFor,
  LedgerError,
  LedgerNotImplementedError,
  type ILedgerPort,
  // 7 interface con — export để tầng nghiệp vụ/test khai kiểu hẹp khi chỉ cần một nhóm.
  type ILedgerCompliance,
  type ILedgerIssuance,
  type ILedgerPurchase,
  type ILedgerSnapshot,
  type ILedgerDistribution,
  type ILedgerSettlement,
  type ILedgerVault,
  type ILedgerRead,
  type ChainDistribution,
  type PermitDomain,
  type PermitToken,
  type SettlementPermit,
  type SnapshotResult,
  type TokenInfo,
  type TokenWalletList,
  type TransferCheck,
  type VaultConfigEvent,
  type VaultConfigParam,
  type VaultLockMode,
  type VaultPeriodClose,
  type VaultStatus,
  type VaultWithdrawal,
  type VaultWithdrawalFilter,
  type VaultWithdrawalReceipt,
  type TxResult,
  type TxStatus,
} from './ledger.port';
export { InvalidAddressError, normalizeEvmAddress } from './address';
export { resetMockLedger } from './mock.adapter';

/** Một cờ chọn đồng thời kho nghiệp vụ và kho ledger mock; không có cấu hình pha trộn. */
export function getMockLedgerStateStore(chain: ChainKey) {
  return serverEnv().useMockDb
    ? memoryMockLedgerStateStore
    : createPostgresMockLedgerStateStore(chain);
}

/**
 * FACTORY — điểm duy nhất map chain -> adapter.
 *
 * Thêm chain mới: thêm entry ở `packages/shared/src/chains.ts`, thêm `*.adapter.ts`,
 * rồi thêm một nhánh ở đây. Nghiệp vụ (server action) KHÔNG phải sửa.
 *
 * Signer truyền vào được (mặc định = signer ngân hàng) để test có thể tiêm signer giả
 * và để Phase 5 đổi sang Fireblocks mà không chạm file này.
 */
export function getLedger(chain: ChainKey, signer: ISigner = getBankSigner(chain)): ILedgerPort {
  switch (chainFamily(chain)) {
    case 'mock':
      /**
       * Nạp giá đã cấu hình vào ledger mô phỏng (BE-04, việc 9).
       *
       * Việc này đặt Ở ĐÂY, không đặt trong `mock.adapter.ts`: mock là tầng CỔNG, cho nó nhập
       * `lib/store` là để tầng cổng phụ thuộc tầng lưu trữ, và khi đó `createMockLedger` không
       * dựng được trong test mà không có cơ sở dữ liệu. Factory là chỗ duy nhất đã biết cả hai
       * tầng, nên nó ghép — đúng vai của một factory.
       *
       * Truyền HÀM chứ không giá trị: `getLedger` là hàm đồng bộ và đang được gọi ở hàng chục
       * chỗ, còn đọc cấu hình thì bất đồng bộ. Mock gọi hàm này ở lần đầu cần giá.
       *
       * Chain thật KHÔNG cần: giá nằm trong hợp đồng khớp lệnh, nên `quotePurchase` đọc thẳng
       * từ chuỗi và không có gì phải nạp.
       */
      return createMockLedger(chain, {
        readInitialPrice: () => readIssuePriceVnd(chain),
        stateStore: getMockLedgerStateStore(chain),
        // Người ký ghi vào `operator` của sự kiện vault mock, như `msg.sender` trên chuỗi (BE-13).
        readOperator: () => signer.getAddress(),
      });
    case 'evm':
      return createEvmLedger(chain, signer, { eventStore: getChainEventStore() });
    case 'stellar':
      return createStellarLedger(chain);
  }
}
