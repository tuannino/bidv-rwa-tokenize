import type { ChainKey } from '@bidv/shared';
import type { StoreKind } from './store.errors';

/**
 * Cổng lưu trữ VÍ ĐÃ GẮN cho hồ sơ (FIX-01 QĐ-1): ví đã được ngân hàng định danh trên chuỗi và gắn
 * cho một hồ sơ khách hàng. Một hồ sơ nhiều ví mỗi chain, một ví chỉ thuộc một hồ sơ mỗi chain
 * (khoá chính `(chain, walletKey)`).
 *
 * Cổng này chỉ LƯU TRỮ. Ai được gắn, kiểm danh tính, whitelist và ghi sổ kiểm toán là việc của
 * `lib/bank/wallet-binding.service.ts`.
 */

export interface WalletBindingRecord {
  chain: ChainKey;
  /** Địa chỉ đã chuẩn hoá checksum. */
  wallet: string;
  actorId: string;
  /** Mã tài khoản đã gắn ví. */
  boundBy: string;
  boundAt: string;
}

export interface BindWalletInput {
  chain: ChainKey;
  /** Đã chuẩn hoá ở tầng nghiệp vụ; cổng tự dựng khoá viết thường. */
  wallet: string;
  actorId: string;
  boundBy: string;
}

export interface IWalletBindingStore {
  readonly kind: StoreKind;

  /** So không phân biệt hoa thường. */
  findByWallet(chain: ChainKey, wallet: string): Promise<WalletBindingRecord | null>;

  /** Mọi ví đã gắn trên chain, mới gắn trước, tối đa `limit` dòng. */
  list(chain: ChainKey, limit: number): Promise<WalletBindingRecord[]>;

  /**
   * Gắn ví. Ví đã thuộc hồ sơ khác trên chain thì ném `UniqueConstraintError`; đã thuộc đúng hồ sơ
   * này thì trả bản ghi cũ với `created: false`. Câu ghi là trọng tài khi hai lần gắn tranh nhau,
   * không phải phép đọc trước.
   */
  bind(input: BindWalletInput): Promise<{ record: WalletBindingRecord; created: boolean }>;
}
