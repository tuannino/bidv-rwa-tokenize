import type { Account, EIP1193Provider, Hex } from 'viem';
import { SignerUnavailableError, type ISigner } from './signer.port';

/**
 * Signer bằng ví người dùng (RainbowKit/wagmi) — dùng cho thao tác của NHÀ ĐẦU TƯ
 * (transfer, redeem ở P2). KHÔNG dùng cho mint: mint là đặc quyền ngân hàng.
 *
 * Nhận provider EIP-1193 từ ngoài vào (wagmi connector) để file này không phụ thuộc React.
 */
export function createWalletSigner(provider: EIP1193Provider | undefined): ISigner {
  const requireProvider = (): EIP1193Provider => {
    if (!provider) {
      throw new SignerUnavailableError('wallet', 'Chưa kết nối ví. Bấm "Connect Wallet" trước.');
    }
    return provider;
  };

  const firstAccount = async (): Promise<Hex | null> => {
    const accounts = (await requireProvider().request({ method: 'eth_accounts' })) as Hex[];
    return accounts[0] ?? null;
  };

  return {
    kind: 'wallet',
    getAddress: firstAccount,
    async getAccount(): Promise<Account> {
      const address = await firstAccount();
      if (!address) {
        throw new SignerUnavailableError('wallet', 'Ví đã kết nối nhưng không có account nào.');
      }
      // JSON-RPC account: viem sẽ đẩy yêu cầu ký sang ví, không giữ khóa.
      return { address, type: 'json-rpc' } as Account;
    },
  };
}
