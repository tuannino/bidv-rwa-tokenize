import type { Account } from 'viem';
import { SignerUnavailableError, type ISigner } from './signer.port';

/**
 * Chỗ cắm Fireblocks (Phase 5). Fireblocks phát hành EIP-1193 provider,
 * nên khi tới lúc: dựng provider từ SDK rồi trả `{ address, type: 'json-rpc' }`
 * y như `wallet.signer.ts` — nghiệp vụ và `ILedgerPort` không phải sửa gì.
 *
 * Hiện tại cố tình ném lỗi rõ ràng thay vì im lặng fallback sang khóa server:
 * fallback âm thầm ở lớp custody là rủi ro bảo mật.
 */
export function createFireblocksSigner(): ISigner {
  const notImplemented = (): never => {
    throw new SignerUnavailableError(
      'fireblocks',
      'Fireblocks signer chưa hiện thực (Phase 5). Dùng SIGNER_KIND=server cho PoC.',
    );
  };

  return {
    kind: 'fireblocks',
    async getAddress() {
      return notImplemented();
    },
    async getAccount(): Promise<Account> {
      return notImplemented();
    },
  };
}
