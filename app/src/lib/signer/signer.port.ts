import type { Account, Hex } from 'viem';

/**
 * LUẬT #2: mọi thao tác ký đi qua đây. Không nhúng private key ở chỗ khác.
 *
 * Đổi custody (server key -> Fireblocks/HSM) = thêm một hiện thực + đổi factory,
 * KHÔNG sửa `ILedgerPort` hay nghiệp vụ.
 */

export type SignerKind = 'server' | 'wallet' | 'fireblocks';

export interface ISigner {
  readonly kind: SignerKind;
  /** Địa chỉ sẽ ký. `null` = chưa sẵn sàng (ví client chưa kết nối). */
  getAddress(): Promise<Hex | null>;
  /**
   * Account của viem để gắn vào `walletClient`.
   * Fireblocks là EIP-1193 provider nên cũng quy về đây được.
   */
  getAccount(): Promise<Account>;
}

/** Signer chưa dùng được — kèm hướng dẫn sửa cấu hình. */
export class SignerUnavailableError extends Error {
  readonly kind: SignerKind;
  constructor(kind: SignerKind, message: string) {
    super(message);
    this.name = 'SignerUnavailableError';
    this.kind = kind;
  }
}
