import { randomUUID } from 'node:crypto';
import { createWalletClient, http, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import type { PermitPreparationView } from '@/lib/bank/purchase.service';

/**
 * Ký typed data permit do máy chủ chuẩn bị, bằng TÀI KHOẢN MẶC ĐỊNH CỦA NÚT HARDHAT (FE-05 QĐ-C).
 *
 * Nút ký hộ qua `eth_signTypedData_v4` với tài khoản mở sẵn, đúng phương thức ví trình duyệt dùng;
 * test không cầm khoá riêng nào. Số dạng chuỗi đổi về `bigint` y như màn hình làm trước khi ký.
 */
export async function signPreparedPermit(
  rpcUrl: string,
  owner: Hex,
  prepared: PermitPreparationView,
): Promise<{ value: string; deadline: string; nonce: string; signature: Hex }> {
  const wallet = createWalletClient({
    account: { address: owner, type: 'json-rpc' },
    chain: hardhat,
    transport: http(rpcUrl),
  });
  const { domain, types, primaryType, message } = prepared.typedData;
  const signature = await wallet.signTypedData({
    account: owner,
    domain: { ...domain, verifyingContract: domain.verifyingContract as Hex },
    types,
    primaryType,
    message: {
      owner: message.owner as Hex,
      spender: message.spender as Hex,
      value: BigInt(message.value),
      nonce: BigInt(message.nonce),
      deadline: BigInt(message.deadline),
    },
  });
  return { value: prepared.value, deadline: prepared.deadline, nonce: prepared.nonce, signature };
}

/**
 * Đường đầy đủ của nhà đầu tư trên chain thật: chuẩn bị, ký bằng nút, đặt lệnh. Trả cả chữ ký để
 * ca kiểm có thể gửi lại hoặc dùng chữ ký đó theo cách khác.
 */
export async function placeSignedOrder(
  rpcUrl: string,
  input: { investorWallet: Hex; side: 'BUY' | 'SELL'; wptAmount: string; clientRequestId?: string },
) {
  const { placeOrder, preparePermit } = await import('@/lib/bank/purchase.service');
  const prepared = await preparePermit({
    chain: 'hardhat-local',
    investorWallet: input.investorWallet,
    side: input.side,
    wptAmount: input.wptAmount,
  });
  if (!prepared.ok) throw new Error(`preparePermit lỗi: ${prepared.error}`);
  const permit = await signPreparedPermit(rpcUrl, input.investorWallet, prepared.data);
  const result = await placeOrder({
    chain: 'hardhat-local',
    investorWallet: input.investorWallet,
    side: input.side,
    wptAmount: input.wptAmount,
    clientRequestId: input.clientRequestId ?? randomUUID(),
    permit,
  });
  return { prepared: prepared.data, permit, result };
}
