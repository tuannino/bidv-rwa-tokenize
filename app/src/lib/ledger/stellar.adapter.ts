import 'server-only';

import type { ChainKey } from '@bidv/shared';
import {
  LedgerNotImplementedError,
  type ChainDistribution,
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
    async spvWallet(): Promise<string | null> {
      return todoNeeds('spvWallet', 'contract phát hành một lần bản Soroban (SC-02)');
    },

    // --- Khớp lệnh mua ---
    async quotePurchase(): Promise<bigint> {
      return todoNeeds('quotePurchase', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async setPurchasePrice(): Promise<TxResult> {
      return todoNeeds('setPurchasePrice', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async paymentBalanceOf(): Promise<bigint> {
      return todoNeeds('paymentBalanceOf', 'địa chỉ token thanh toán VNDB trên Stellar');
    },
    async paymentAllowanceOf(): Promise<bigint> {
      return todoNeeds('paymentAllowanceOf', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async wptAllowanceOf(): Promise<bigint> {
      return todoNeeds('wptAllowanceOf', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async findOrderSettlement(): Promise<never> {
      return todoNeeds('findOrderSettlement', 'sự kiện quyết toán và contract khớp lệnh bản Soroban (SC-03)');
    },
    async latestBlockTimestamp(): Promise<bigint> {
      return todoNeeds('latestBlockTimestamp', 'đọc ledger mới nhất của Soroban RPC (FE-05)');
    },
    async permitDomain(): Promise<never> {
      return todoNeeds('permitDomain', 'cơ chế ủy quyền bằng chữ ký cho token Soroban (FE-05)');
    },
    async permitNonce(): Promise<bigint> {
      return todoNeeds('permitNonce', 'cơ chế ủy quyền bằng chữ ký cho token Soroban (FE-05)');
    },
    async mintPayment(): Promise<TxResult> {
      return todoNeeds('mintPayment', 'token thanh toán VNDB bản Soroban và vai phát hành trên token đó');
    },
    async executePurchase(): Promise<TxResult> {
      return todoNeeds('executePurchase', 'contract khớp lệnh bản Soroban (SC-03)');
    },
    async executeSale(): Promise<TxResult> {
      return todoNeeds('executeSale', 'contract khớp lệnh bản Soroban (SC-03)');
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
    // SC-06: quỹ chia một chiều. Không trả 0 cho hàm đọc, cùng lý do ở đầu tệp.
    async unallocatedProfit(): Promise<bigint> {
      return todoNeeds('unallocatedProfit', 'contract chia lợi nhuận bản Soroban có sổ dự trữ');
    },
    async reservedProfit(): Promise<bigint> {
      return todoNeeds('reservedProfit', 'contract chia lợi nhuận bản Soroban có sổ dự trữ');
    },
    async openDistribution(): Promise<TxResult> {
      return todoNeeds('openDistribution', 'contract chia lợi nhuận bản Soroban');
    },
    async findDistribution(): Promise<ChainDistribution | null> {
      return todoNeeds('findDistribution', 'contract chia lợi nhuận bản Soroban');
    },
    async distributionState(): Promise<ChainDistribution> {
      return todoNeeds('distributionState', 'contract chia lợi nhuận bản Soroban');
    },
    async isDistributionPaid(): Promise<boolean> {
      return todoNeeds('isDistributionPaid', 'contract chia lợi nhuận bản Soroban');
    },
    async closeDistribution(): Promise<TxResult> {
      return todoNeeds('closeDistribution', 'contract chia lợi nhuận bản Soroban');
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

    // SC-07: Stellar chưa triển khai vault, nhưng đây là trạng thái hợp lệ thay vì lỗi adapter.
    async vaultStatus() {
      return null;
    },
    async vaultPeriodCloses() {
      return [];
    },
    // SC-06: không có vault thì không có kỳ nào để chốt; gửi chốt là lỗi gọi sai chain.
    async closeVaultPeriod(): Promise<TxResult> {
      return todoNeeds('closeVaultPeriod', 'vault thanh toán SPV bản Soroban');
    },
    async findVaultPeriodClose() {
      return null;
    },
    // BE-13: ghi và đối soát vault là lỗi gọi sai chain, từ chối rõ ràng thay vì trả rỗng.
    async setVaultPercentRate(): Promise<TxResult> {
      return todoNeeds('setVaultPercentRate', 'vault thanh toán SPV bản Soroban');
    },
    async setVaultFixedLock(): Promise<TxResult> {
      return todoNeeds('setVaultFixedLock', 'vault thanh toán SPV bản Soroban');
    },
    async setVaultLockMode(): Promise<TxResult> {
      return todoNeeds('setVaultLockMode', 'vault thanh toán SPV bản Soroban');
    },
    async setVaultPayoutWallet(): Promise<TxResult> {
      return todoNeeds('setVaultPayoutWallet', 'vault thanh toán SPV bản Soroban');
    },
    async withdrawFromVault(): Promise<TxResult> {
      return todoNeeds('withdrawFromVault', 'vault thanh toán SPV bản Soroban');
    },
    async findVaultWithdrawals(): Promise<never> {
      return todoNeeds('findVaultWithdrawals', 'sự kiện rút của vault thanh toán SPV bản Soroban');
    },
    async vaultWithdrawalReceipt(): Promise<never> {
      return todoNeeds('vaultWithdrawalReceipt', 'sự kiện rút của vault thanh toán SPV bản Soroban');
    },
    // Không có vault thì không có lịch sử cấu hình: trạng thái hợp lệ, như `vaultPeriodCloses`.
    async vaultConfigEvents() {
      return [];
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
    async latestBlockNumber(): Promise<bigint> {
      return todoNeeds('latestBlockNumber', 'đọc ledger mới nhất của Soroban RPC (BE-13)');
    },
  };
}
