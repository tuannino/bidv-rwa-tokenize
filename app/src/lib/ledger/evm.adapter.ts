import 'server-only';

import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { getContractAddress, projectTokenAbi, type ChainKey } from '@bidv/shared';
import { rpcUrlFor, viemChainFor } from '@/lib/chains/registry';
import type { ISigner } from '@/lib/signer';
import { normalizeEvmAddress } from './address';
import {
  DEFAULT_RECEIPT_TIMEOUT_MS,
  LedgerError,
  assertPositiveAmount,
  type ILedgerPort,
  type TokenInfo,
  type TxResult,
} from './ledger.port';

/**
 * Adapter EVM (hardhat-local + evm testnet) bằng viem.
 * ABI/địa chỉ lấy từ `@bidv/shared` — không copy ABI vào đây.
 *
 * Ghi chú thiết kế: mỗi thao tác ghi đều `simulateContract` TRƯỚC khi gửi.
 * Nhờ vậy vi phạm tuân thủ (chưa KYC, bị băng, thiếu role) trả lỗi đọc được ngay
 * và KHÔNG tốn một tx thất bại on-chain — khớp requirements AC#2.
 */
export function createEvmLedger(chain: ChainKey, signer: ISigner): ILedgerPort {
  const rpcUrl = rpcUrlFor(chain);
  const viemChain = viemChainFor(chain);

  let publicClient: PublicClient | undefined;
  let walletClient: WalletClient | undefined;

  const reader = (): PublicClient => {
    publicClient ??= createPublicClient({ chain: viemChain, transport: http(rpcUrl) });
    return publicClient;
  };

  const tokenAddress = (): Hex => getContractAddress(chain, 'ProjectToken') as Hex;

  const writer = async (): Promise<{ client: WalletClient; account: Hex }> => {
    const account = await signer.getAccount();
    walletClient ??= createWalletClient({ account, chain: viemChain, transport: http(rpcUrl) });
    return { client: walletClient, account: account.address };
  };

  /** Bóc revert reason của contract ra message đọc được, giữ lỗi gốc ở `cause`. */
  const fail = (operation: string, error: unknown): never => {
    if (error instanceof BaseError) {
      const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
      if (reverted instanceof ContractFunctionRevertedError) {
        const reason = reverted.data?.errorName ?? reverted.reason ?? reverted.shortMessage;
        throw new LedgerError(chain, operation, `Contract từ chối: ${reason}`, { cause: error });
      }
      throw new LedgerError(chain, operation, error.shortMessage, { cause: error });
    }
    throw new LedgerError(
      chain,
      operation,
      error instanceof Error ? error.message : 'Lỗi không xác định khi gọi chain.',
      { cause: error },
    );
  };

  const read = async <T>(operation: string, functionName: string, args: readonly unknown[]): Promise<T> => {
    try {
      return (await reader().readContract({
        address: tokenAddress(),
        abi: projectTokenAbi,
        functionName: functionName as never,
        args: args as never,
      })) as T;
    } catch (error) {
      return fail(operation, error);
    }
  };

  /** simulate -> write -> trả PENDING. Người gọi tự `waitReceipt` để kiểm soát timeout. */
  const write = async (
    operation: string,
    functionName: string,
    args: readonly unknown[],
  ): Promise<TxResult> => {
    try {
      const { client, account } = await writer();
      const { request } = await reader().simulateContract({
        account,
        address: tokenAddress(),
        abi: projectTokenAbi,
        functionName: functionName as never,
        args: args as never,
      });
      const txHash = await client.writeContract(request as never);
      return { txHash, status: 'PENDING' };
    } catch (error) {
      return fail(operation, error);
    }
  };

  return {
    chain,

    async whitelist(wallet) {
      return write('whitelist', 'setWhitelisted', [normalizeEvmAddress(wallet), true]);
    },

    async isWhitelisted(wallet) {
      return read<boolean>('isWhitelisted', 'isWhitelisted', [normalizeEvmAddress(wallet)]);
    },

    async freeze(wallet, frozen) {
      return write('freeze', 'setFrozen', [normalizeEvmAddress(wallet), frozen]);
    },

    async isFrozen(wallet) {
      return read<boolean>('isFrozen', 'isFrozen', [normalizeEvmAddress(wallet)]);
    },

    async mint(to, amount) {
      assertPositiveAmount(chain, 'mint', amount);
      return write('mint', 'mint', [normalizeEvmAddress(to), amount]);
    },

    async burn(from, amount) {
      assertPositiveAmount(chain, 'burn', amount);
      // agentBurn: ngân hàng (AGENT_ROLE) đốt được cả ví đang bị băng.
      return write('burn', 'agentBurn', [normalizeEvmAddress(from), amount]);
    },

    async transfer(from, to, amount) {
      assertPositiveAmount(chain, 'transfer', amount);
      const sender = normalizeEvmAddress(from);
      const signerAddress = await signer.getAddress();

      if (!signerAddress || signerAddress.toLowerCase() !== sender.toLowerCase()) {
        // Cố tình KHÔNG âm thầm dùng forcedTransfer: đó là đặc quyền clawback,
        // gọi lẫn vào transfer thường sẽ che mất một hành vi cần audit riêng.
        throw new LedgerError(
          chain,
          'transfer',
          `transfer chỉ ký được cho chính ví của signer (${signerAddress ?? 'chưa có'}). ` +
            `Muốn chuyển hộ ví khác thì dùng forcedTransfer (cần AGENT_ROLE, có audit riêng).`,
        );
      }
      return write('transfer', 'transfer', [normalizeEvmAddress(to), amount]);
    },

    async forcedTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'forcedTransfer', amount);
      return write('forcedTransfer', 'forcedTransfer', [
        normalizeEvmAddress(from),
        normalizeEvmAddress(to),
        amount,
      ]);
    },

    async balanceOf(wallet) {
      return read<bigint>('balanceOf', 'balanceOf', [normalizeEvmAddress(wallet)]);
    },

    async tokenInfo(): Promise<TokenInfo> {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        read<string>('tokenInfo', 'name', []),
        read<string>('tokenInfo', 'symbol', []),
        read<number>('tokenInfo', 'decimals', []),
        read<bigint>('tokenInfo', 'totalSupply', []),
      ]);
      return { name, symbol, decimals: Number(decimals), totalSupply };
    },

    async waitReceipt(txHash, timeoutMs = DEFAULT_RECEIPT_TIMEOUT_MS) {
      try {
        const receipt = await reader().waitForTransactionReceipt({
          hash: txHash as Hex,
          timeout: timeoutMs,
        });
        return receipt.status === 'success'
          ? { txHash, status: 'CONFIRMED' }
          : { txHash, status: 'FAILED', reason: 'Giao dịch bị revert on-chain.' };
      } catch (error) {
        // Hết thời gian chờ KHÔNG phải là thất bại chắc chắn — tx vẫn có thể vào block sau.
        return {
          txHash,
          status: 'PENDING',
          reason: `Chưa có receipt sau ${timeoutMs}ms: ${
            error instanceof BaseError ? error.shortMessage : String(error)
          }`,
        };
      }
    },
  };
}
