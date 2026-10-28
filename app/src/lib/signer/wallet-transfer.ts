import { createWalletClient, custom, type EIP1193Provider, type Hex } from 'viem';
import { SignerUnavailableError } from './signer.port';
import { createWalletSigner } from './wallet.signer';

/**
 * Gửi giao dịch rút VNDB mà máy chủ đã lập, bằng VÍ CỦA NHÀ ĐẦU TƯ (FE-23 QĐ-1).
 *
 * Đi qua `createWalletSigner` (LUẬT #2): account dạng `json-rpc`, ví giữ khoá và tự trả phí gas, viem
 * chỉ chuyển yêu cầu `eth_sendTransaction` sang ví. Kiểm tài khoản đang chọn và chain của ví TRƯỚC khi
 * máy chủ giữ chỗ lần gửi (`beginPaymentSend`), để lỗi loại này không tiêu lệnh.
 */

export interface WalletTarget {
  from: string;
  chainId: number;
}

/** Tài khoản đang chọn đúng ví gửi và ví đang ở đúng chain; sai thì ném lỗi có câu rõ. */
export async function assertWalletReady(provider: EIP1193Provider | undefined, target: WalletTarget) {
  const account = await createWalletSigner(provider).getAccount();
  if (account.address.toLowerCase() !== target.from.toLowerCase()) {
    throw new SignerUnavailableError(
      'wallet',
      `Ví đang chọn (${account.address}) khác ví gửi của lệnh (${target.from}). Chọn lại đúng ví rồi thử lại.`,
    );
  }
  const chainId = Number(await provider!.request({ method: 'eth_chainId' }));
  if (chainId !== target.chainId) {
    throw new SignerUnavailableError(
      'wallet',
      `Ví đang ở mạng ${chainId}, lệnh rút cần mạng ${target.chainId}. Chuyển mạng trong ví rồi thử lại.`,
    );
  }
  return account;
}

/** Gửi `txRequest` qua ví; trả mã giao dịch. Người dùng từ chối thì lỗi gốc (mã 4001) đi ra nguyên vẹn. */
export async function sendPaymentTransferWithWallet(
  provider: EIP1193Provider | undefined,
  request: WalletTarget & { to: Hex; data: Hex },
): Promise<Hex> {
  const account = await assertWalletReady(provider, request);
  const client = createWalletClient({ account, transport: custom(provider!) });
  return client.sendTransaction({ account, chain: null, to: request.to, data: request.data, value: 0n });
}
