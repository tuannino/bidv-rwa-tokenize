import type { ChainKey, TxResult, TxStatus } from '@bidv/shared';

/**
 * LUẬT #1: MỌI tương tác chain đi qua interface này.
 * Cấm gọi thẳng viem/ethers trong component hay route handler.
 *
 * Thêm chain  = thêm một `*.adapter.ts` + đăng ký ở `lib/ledger/index.ts`.
 * Thêm luồng  = thêm method ở đây + hiện thực ở từng adapter.
 */
export type { ChainKey, TxResult, TxStatus };

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

export interface ILedgerPort {
  readonly chain: ChainKey;

  // --- Tuân thủ ---
  whitelist(wallet: string): Promise<TxResult>;
  isWhitelisted(wallet: string): Promise<boolean>;
  freeze(wallet: string, frozen: boolean): Promise<TxResult>;
  isFrozen(wallet: string): Promise<boolean>;

  // --- Phát hành / thu hồi ---
  mint(to: string, amount: bigint): Promise<TxResult>;
  burn(from: string, amount: bigint): Promise<TxResult>;
  transfer(from: string, to: string, amount: bigint): Promise<TxResult>;
  /** Clawback: chuyển cưỡng bức, bỏ qua trạng thái đóng băng của `from`. */
  forcedTransfer(from: string, to: string, amount: bigint): Promise<TxResult>;

  // --- Đọc ---
  balanceOf(wallet: string): Promise<bigint>;
  tokenInfo(): Promise<TokenInfo>;

  // --- Giao dịch ---
  waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult>;
}

/** Mặc định 30s theo requirements AC#4 (đủ cho hardhat-local: block gần như tức thì). */
export const DEFAULT_RECEIPT_TIMEOUT_MS = 30_000;

/**
 * Testnet công khai chậm hơn hẳn: block time Sepolia ~12s, và tx còn phải chờ được chọn
 * vào block. 30s có thể trôi qua khi tx vẫn hoàn toàn bình thường, làm UI báo PENDING oan.
 * 90s ≈ 7 block, đủ biên an toàn (spec p4 §T1.1).
 */
export const EVM_RECEIPT_TIMEOUT_MS = 90_000;

/**
 * Timeout chờ receipt theo chain. Một chỗ duy nhất quyết định, để thêm chain mới
 * không phải đi sửa rải rác trong nghiệp vụ.
 */
export function receiptTimeoutFor(chain: ChainKey): number {
  switch (chain) {
    case 'evm':
      return EVM_RECEIPT_TIMEOUT_MS;
    case 'hardhat-local':
    case 'stellar':
    case 'mock':
      return DEFAULT_RECEIPT_TIMEOUT_MS;
  }
}

/**
 * Lỗi từ tầng ledger. `LedgerError` mang message ĐÃ ĐỌC ĐƯỢC cho người dùng cuối
 * (revert reason của contract là tiếng Việt không dấu, ví dụ "phat hanh cho vi chua KYC").
 */
export class LedgerError extends Error {
  readonly chain: ChainKey;
  readonly operation: string;

  constructor(chain: ChainKey, operation: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LedgerError';
    this.chain = chain;
    this.operation = operation;
  }
}

/** Method chưa hiện thực ở adapter này (vd stellar stub). */
export class LedgerNotImplementedError extends LedgerError {
  constructor(chain: ChainKey, operation: string, hint: string) {
    super(chain, operation, `"${operation}" chưa hiện thực cho chain "${chain}". ${hint}`);
    this.name = 'LedgerNotImplementedError';
  }
}

/** Guard dùng chung cho mọi adapter: số lượng phải > 0 (requirements AC#3). */
export function assertPositiveAmount(chain: ChainKey, operation: string, amount: bigint): void {
  if (amount <= 0n) {
    throw new LedgerError(chain, operation, 'Số lượng phải lớn hơn 0.');
  }
}
