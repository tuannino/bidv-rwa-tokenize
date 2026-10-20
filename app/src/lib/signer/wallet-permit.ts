import { createWalletClient, custom, type EIP1193Provider, type Hex } from 'viem';
import type { PermitPreparationView } from '@/lib/bank/purchase.service';
import { SignerUnavailableError } from './signer.port';
import { createWalletSigner } from './wallet.signer';

/**
 * Ký typed data permit mà máy chủ đã chuẩn bị, bằng VÍ CỦA NHÀ ĐẦU TƯ (FE-05 QĐ-A bước 2).
 *
 * Đi qua `createWalletSigner` (LUẬT #2): account dạng `json-rpc`, ví giữ khoá, viem chỉ chuyển yêu
 * cầu `eth_signTypedData_v4` sang ví. Không gửi giao dịch nào, nên không tốn phí. Số trong typed
 * data là chuỗi thập phân (qua được biên máy chủ); đổi về `bigint` ngay tại đây trước khi ký.
 *
 * Ví đang chọn phải đúng là ví đặt lệnh: ký bằng ví khác thì máy chủ cũng từ chối, nhưng chặn ở
 * đây để người dùng không phải mở ví ký một chữ ký chắc chắn vô dụng.
 */
export async function signPermitWithWallet(
  provider: EIP1193Provider | undefined,
  typedData: PermitPreparationView['typedData'],
): Promise<Hex> {
  const account = await createWalletSigner(provider).getAccount();
  if (account.address.toLowerCase() !== typedData.message.owner.toLowerCase()) {
    throw new SignerUnavailableError(
      'wallet',
      `Ví đang chọn (${account.address}) khác ví đặt lệnh (${typedData.message.owner}). Chọn lại đúng ví rồi thử lại.`,
    );
  }
  const client = createWalletClient({ account, transport: custom(provider!) });
  return client.signTypedData({
    account,
    domain: { ...typedData.domain, verifyingContract: typedData.domain.verifyingContract as Hex },
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: {
      owner: typedData.message.owner as Hex,
      spender: typedData.message.spender as Hex,
      value: BigInt(typedData.message.value),
      nonce: BigInt(typedData.message.nonce),
      deadline: BigInt(typedData.message.deadline),
    },
  });
}
