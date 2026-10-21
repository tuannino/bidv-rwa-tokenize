import type { ChainKey } from '@bidv/shared';
import type { StoreKind } from './store.errors';

/**
 * Cổng lưu trữ VÍ LIÊN KẾT vào hồ sơ (OP-05 QĐ-I): mỗi hồ sơ một ví mỗi chain, một ví chỉ thuộc một
 * hồ sơ trên một chain.
 *
 * Cổng này chỉ LƯU TRỮ. Ai được liên kết, ví nào bị từ chối và ghi sổ kiểm toán là việc của
 * `lib/bank/account-profile.service.ts`.
 */

export interface ProfileWalletRecord {
  actorId: string;
  chain: ChainKey;
  wallet: string;
  updatedBy: string;
  updatedAt: string;
}

export interface LinkProfileWalletInput {
  actorId: string;
  chain: ChainKey;
  /** Đã chuẩn hoá ở tầng nghiệp vụ; cổng tự dựng khoá viết thường. */
  wallet: string;
  updatedBy: string;
}

export interface IProfileWalletStore {
  readonly kind: StoreKind;

  findByActor(actorId: string, chain: ChainKey): Promise<ProfileWalletRecord | null>;

  /** So không phân biệt hoa thường. */
  findByWallet(chain: ChainKey, wallet: string): Promise<ProfileWalletRecord | null>;

  /**
   * Ghi hoặc thay ví của `(actorId, chain)` bằng MỘT câu ghi, trả kèm ví cũ để ghi sổ kiểm toán.
   * Ví đã thuộc hồ sơ khác trên cùng chain thì ném `UniqueConstraintError`: ràng buộc duy nhất là
   * trọng tài, không phải phép đọc trước.
   */
  link(input: LinkProfileWalletInput): Promise<{ previous: string | null; record: ProfileWalletRecord }>;
}
