import 'server-only';

import type { ChainKey } from '@bidv/shared';
import {
  LedgerNotImplementedError,
  type ILedgerPort,
  type SnapshotResult,
  type TokenInfo,
  type TransferCheck,
  type TxResult,
} from './ledger.port';

/**
 * Chỗ cắm Stellar/Soroban (Phase 7). Contract Rust đã có ở `packages/contracts-stellar`.
 *
 * Stub này tồn tại để CHỨNG MINH biên interface đủ tổng quát: thêm chain khác họ
 * không cần sửa `ILedgerPort` hay nghiệp vụ, chỉ cần một file như file này.
 * Mọi method ném lỗi rõ ràng thay vì trả giá trị giả — số dư giả còn tệ hơn lỗi.
 *
 * Vì sao KHÔNG trả 0 / mảng rỗng / false cho các hàm đọc: giá trị giả đi tiếp vào
 * nghiệp vụ và nhân lên thành quyết định sai (chia lợi nhuận 0 đồng, báo "chưa phát
 * hành" khi đã phát hành) mà không ai thấy dấu hiệu gì. Lỗi thì dừng ngay tại chỗ.
 */
export function createStellarLedger(chain: ChainKey = 'stellar'): ILedgerPort {
  const hint = 'Sẽ hiện thực ở Phase 7 bằng SDK Soroban (packages/contracts-stellar).';
  const todo = (operation: string): never => {
    throw new LedgerNotImplementedError(chain, operation, hint);
  };

  /** Gợi ý riêng cho method cần đối tượng Soroban chưa có bản Rust tương ứng. */
  const todoNeeds = (operation: string, needs: string): never => {
    throw new LedgerNotImplementedError(chain, operation, `${hint} Cần: ${needs}.`);
  };

  return {
    chain,

    // --- Tuân thủ ---
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
    async canTransfer(): Promise<TransferCheck> {
      // KHÔNG trả { allowed: false, reason: 'chưa hỗ trợ' }: giao diện sẽ hiểu là
      // "quy tắc tuân thủ từ chối" và người dùng đi sửa hồ sơ KYC vô ích.
      return todoNeeds('canTransfer', 'hàm đọc kiểm tra tuân thủ trong contract Soroban');
    },

    // --- Phát hành / thu hồi ---
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
    async mintInitialSupply(): Promise<TxResult> {
      return todoNeeds('mintInitialSupply', 'contract phát hành một lần bản Soroban (SC-02)');
    },
    async isInitialSupplyMinted(): Promise<boolean> {
      return todoNeeds('isInitialSupplyMinted', 'contract phát hành một lần bản Soroban (SC-02)');
    },

    // --- Khớp lệnh mua ---
    async quotePurchase(): Promise<bigint> {
      return todoNeeds('quotePurchase', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async paymentBalanceOf(): Promise<bigint> {
      return todoNeeds('paymentBalanceOf', 'địa chỉ token thanh toán VNDB trên Stellar');
    },
    async paymentAllowanceOf(): Promise<bigint> {
      return todoNeeds('paymentAllowanceOf', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async executePurchase(): Promise<TxResult> {
      return todoNeeds('executePurchase', 'contract khớp lệnh bản Soroban (SC-03)');
    },

    // --- Chốt quyền ---
    async takeSnapshot(): Promise<SnapshotResult> {
      return todoNeeds('takeSnapshot', 'cơ chế snapshot trong contract Soroban');
    },
    async balanceOfAt(): Promise<bigint> {
      return todoNeeds('balanceOfAt', 'cơ chế snapshot trong contract Soroban');
    },
    async totalSupplyAt(): Promise<bigint> {
      return todoNeeds('totalSupplyAt', 'cơ chế snapshot trong contract Soroban');
    },

    // --- Chia lợi nhuận ---
    async profitPoolBalance(): Promise<bigint> {
      return todoNeeds('profitPoolBalance', 'địa chỉ ví chia lợi nhuận trên Stellar');
    },
    async distributeBatch(): Promise<TxResult> {
      return todoNeeds('distributeBatch', 'contract chia lợi nhuận bản Soroban');
    },

    // --- Tất toán ---
    async setSettlementMode(): Promise<TxResult> {
      return todoNeeds('setSettlementMode', 'cờ tất toán trong contract Soroban');
    },
    async isSettlementMode(): Promise<boolean> {
      return todoNeeds('isSettlementMode', 'cờ tất toán trong contract Soroban');
    },
    async setNavRate(): Promise<TxResult> {
      return todoNeeds('setNavRate', 'contract tất toán bản Soroban');
    },
    async navRate(): Promise<bigint> {
      return todoNeeds('navRate', 'contract tất toán bản Soroban');
    },

    // --- Đọc / giao dịch ---
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
