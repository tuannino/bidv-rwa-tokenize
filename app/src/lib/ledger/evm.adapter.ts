import 'server-only';

import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  toFunctionSelector,
  TransactionReceiptNotFoundError,
  type Abi,
  type Account,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import {
  addressBook,
  findContractAddress,
  getContractAddress,
  identityRegistryAbi,
  modularComplianceAbi,
  orderRefFromOrderId,
  orderSettlementAbi,
  profitDistributorAbi,
  projectTokenAbi,
  spvPaymentVaultAbi,
  VIETNAM_COUNTRY_CODE,
  vndTokenAbi,
  type ChainKey,
  type ContractName,
} from '@bidv/shared';
import { rpcUrlFor, viemChainFor } from '@/lib/chains/registry';
import { serverEnv } from '@/lib/config/env';
import type { ISigner } from '@/lib/signer';
import { normalizeEvmAddress } from './address';
import {
  LedgerError,
  LedgerNotImplementedError,
  assertPositiveAmount,
  receiptTimeoutFor,
  type ChainDistribution,
  type ILedgerPort,
  type PermitToken,
  type SettlementOrder,
  type SnapshotResult,
  type TokenInfo,
  type TransferCheck,
  type TxResult,
  type VaultLockMode,
  type VaultPeriodClose,
  type VaultWithdrawal,
} from './ledger.port';

/**
 * Adapter EVM (hardhat-local + evm testnet) bằng viem.
 * ABI/địa chỉ lấy từ `@bidv/shared` — không copy ABI vào đây.
 *
 * Ghi chú thiết kế: mỗi thao tác ghi đều `simulateContract` TRƯỚC khi gửi.
 * Nhờ vậy vi phạm tuân thủ (chưa KYC, bị băng, thiếu role) trả lỗi đọc được ngay
 * và KHÔNG tốn một tx thất bại on-chain — khớp requirements AC#2.
 *
 * ----------------------------------------------------------------------------
 * NỢ CÓ CHỦ ĐÍCH — các method còn marker @blocked
 *
 * Khớp lệnh đã nối vào OrderSettlement ở SC-03. Những method chia lợi nhuận/tất toán
 * còn thiếu quyết định hợp đồng tiếp tục ném `LedgerNotImplementedError` kèm gợi ý rõ,
 * thay vì nối tạm vào một contract có ngữ nghĩa gần gần.
 *
 * Mỗi method như vậy có một marker điểm chặn ở ngay trên khai báo của nó, nêu đúng task
 * phải xong trước. KHÔNG liệt kê danh sách task ở đây: hai chỗ cùng nói một việc thì một
 * chỗ sẽ lạc hậu. Bảng tổng: `node scripts/scan-pending.mjs`.
 *
 * Nối sai còn tệ hơn chưa nối: `Redemption.paused` chẳng hạn NGƯỢC hướng với "bật
 * giai đoạn tất toán", nối vào sẽ cho ra một hệ thống chạy được nhưng làm ngược.
 *
 * Method KHÔNG chờ hợp đồng mới thì hiện thực ngay ở đây, vì `ProjectToken` và
 * `VNDToken` đã có đủ hàm: canTransfer, takeSnapshot, balanceOfAt, totalSupplyAt,
 * paymentBalanceOf, profitPoolBalance.
 * Bảng đầy đủ: `docs/CHECKPOINT_BE01.md`.
 * ----------------------------------------------------------------------------
 */

/**
 * Dịch revert reason thô của contract sang câu tiếng Việt đọc được.
 *
 * Contract revert bằng tiếng Việt KHÔNG DẤU (Solidity chỉ chứa ASCII cho gọn), ví
 * dụ "ben nhan chua KYC". Đưa nguyên chuỗi đó lên giao diện thì người dùng đọc
 * được nhưng trông như lỗi hệ thống, và các mã dạng `ERC20InsufficientAllowance`
 * thì hoàn toàn không đọc được.
 *
 * Thêm require/custom error mới trong contract thì bổ sung vào bảng này.
 */
const REVERT_MESSAGES: Record<string, string> = {
  // --- ProjectToken._update ---
  'token dang tam dung': 'Token đang tạm dừng chuyển nhượng.',
  'ben gui bi bang': 'Ví bên gửi đang bị đóng băng.',
  'ben nhan bi bang': 'Ví bên nhận đang bị đóng băng.',
  'ben gui chua KYC': 'Ví bên gửi chưa KYC/whitelist.',
  'ben nhan chua KYC': 'Ví bên nhận chưa KYC/whitelist.',
  'phat hanh cho vi chua KYC': 'Không phát hành được cho ví chưa KYC/whitelist.',
  'clawback: to chua KYC': 'Ví nhận trong lệnh thu hồi chưa KYC/whitelist.',

  // --- ERC20Snapshotable._valueAt ---
  'Snapshot: id la 0': 'Mã snapshot không hợp lệ (0). Mã phải lấy từ kết quả takeSnapshot().',
  'Snapshot: id chua ton tai':
    'Mã snapshot chưa tồn tại trên chuỗi. Mã phải lấy từ kết quả takeSnapshot().',

  // --- ProfitDistributor ---
  'khong co WPT dang luu hanh': 'Tổng cung WPT tại thời điểm chốt bằng 0 — không có quyền để chia.',
  'ky khong ton tai': 'Kỳ chia lợi nhuận không tồn tại.',
  'chua het han nhan': 'Chưa hết thời hạn nhận lợi nhuận của kỳ này.',
  'khong con du': 'Kỳ chia này không còn phần dư để quét.',
  // SC-06: quỹ một chiều, kỳ tạo từ phần chưa phân bổ.
  EmptyPeriod: 'Mã kỳ chia không được để trống.',
  DuplicatePeriod: 'Mã kỳ chia này đã dùng trên chuỗi; mỗi mã chỉ tạo được một kỳ.',
  NothingToDistribute: 'Quỹ chia lợi nhuận không có phần chưa phân bổ nào để mở kỳ.',
  DistributionClosed: 'Kỳ chia đã đóng; phần chưa trả đã trở về quỹ chưa phân bổ.',
  ClaimWindowEnded: 'Kỳ chia đã hết thời hạn nhận.',
  DistributionOverdrawn: 'Lô chia vượt phần còn lại của kỳ.',
  SafeERC20FailedOperation:
    'Chuyển VNDB thất bại — thường là hợp đồng thiếu số dư hoặc thiếu ủy quyền.',

  // --- Redemption ---
  'dang tam dung': 'Chức năng hoàn vốn đang tạm dừng.',
  'thieu thanh khoan VND': 'Hợp đồng hoàn vốn không đủ thanh khoản VNDB.',
  'chua KYC': 'Ví chưa KYC/whitelist.',

  // --- Custom error của OpenZeppelin v5 ---
  AccessControlUnauthorizedAccount:
    'Ví ký giao dịch không có quyền on-chain cho thao tác này (thiếu role).',
  ERC20InsufficientBalance: 'Số dư token không đủ cho thao tác này.',
  ERC20InsufficientAllowance:
    'Mức ủy quyền VNDB/WPT của ví nhà đầu tư không đủ — chủ ví phải approve cho OrderSettlement trước.',
  ERC20InvalidReceiver: 'Địa chỉ nhận không hợp lệ.',

  // --- ProjectToken: phát hành theo ví SPV (SC-02) ---
  InitialSupplyAlreadyMinted: 'Nguồn cung ban đầu đã được phát hành.',
  InitialSupplyNotMinted: 'Nguồn cung ban đầu chưa được phát hành.',
  MintTargetNotSpv: 'Ví nhận không trùng với ví SPV đã đăng ký.',
  SupplyCapExceeded: 'Tổng cung sau phát hành vượt trần cố định của hợp đồng.',
  InvalidSupplyCap: 'Trần nguồn cung khi triển khai phải lớn hơn 0.',
  ZeroAddress: 'Địa chỉ ví SPV không được là địa chỉ 0.',
  ZeroAmount: 'Số lượng phát hành phải lớn hơn 0.',
  TokenPaused: 'Token đang tạm dừng chuyển nhượng.',
  WalletFrozen: 'Ví tham gia giao dịch đang bị đóng băng.',
  IdentityRegistryNotSet: 'ProjectToken chưa được nối với sổ danh tính ERC-3643.',
  ComplianceNotSet: 'ProjectToken chưa được nối với bộ luật tuân thủ ERC-3643.',
  IdentityNotVerified: 'Ví chưa được xác minh trong sổ danh tính ERC-3643.',
  ComplianceRejected: 'Bộ luật tuân thủ ERC-3643 từ chối giao dịch.',
  InsufficientUnfrozenTokens: 'Số WPT khả dụng không đủ vì một phần số dư đang bị đóng băng.',
  ZeroPrice: 'Giá một WPT phải lớn hơn 0.',
  ZeroOrderRef: 'Mã lệnh không được để trống.',
  OrderAlreadySettled: 'Mã lệnh này đã được quyết toán.',
  AmountPriceMismatch: 'Thành tiền VNDB không khớp số lượng WPT nhân đơn giá.',
  InvalidLockMode: 'Không thể đặt chế độ khoá về Chưa cấu hình.',
  RateTooHigh: 'Tỷ lệ khoá không được vượt 100%.',
  InvalidPeriodRef: 'Mã kỳ phải tăng tuần tự và không được chốt lại kỳ cũ.',
  PayoutWalletNotSet: 'Vault chưa cấu hình ví nhận tiền rút.',
  PayoutWalletNotVerified: 'Ví nhận tiền rút chưa được xác minh trong sổ danh tính.',
  ExceedsWithdrawable: 'Số tiền rút vượt phần VNDB hiện được phép rút.',
  PriceMismatch: 'Thành tiền VNDB đã chốt không khớp số lượng WPT nhân giá hiện hành trên hợp đồng.',
  PermitValueMismatch: 'Giá trị permit phải bằng đúng số token của lệnh.',
  EnforcedPause: 'Hợp đồng khớp lệnh đang tạm dừng.',
};

function translateRevert(raw: string): string {
  // `amount = 0` / `wptAmount = 0` / `rate = 0`: cùng một ý, gộp bằng khớp mẫu.
  if (/^\w+ = 0$/.test(raw)) return 'Số lượng phải lớn hơn 0.';
  const known = REVERT_MESSAGES[raw];
  if (known) return known;
  // Chỉ còn 4 byte selector = ABI tối giản thiếu mục `error` tương ứng. Nói thẳng
  // cách sửa, đừng đẩy một chuỗi hex ra trước mặt người dùng mà không giải thích.
  if (/^0x[0-9a-fA-F]{8}$/.test(raw)) {
    return (
      `Contract từ chối với mã lỗi ${raw} chưa giải mã được. ` +
      `Cách sửa: thêm mục error tương ứng vào packages/shared/src/abi.`
    );
  }
  return `Contract từ chối: ${raw}`;
}

/**
 * Hàng gửi giao dịch theo (chain, ví ký), dùng chung cho mọi adapter trong tiến trình.
 *
 * Hai lời gọi ghi đồng thời từ CÙNG một ví máy chủ (ví dụ hai lệnh đặt cùng lúc, FE-05 ca 7b) mà
 * không xếp hàng thì cùng đọc một nonce giao dịch, và lời gọi sau bị RPC từ chối "nonce too low":
 * lệnh hỏng vì một lý do không liên quan tới nghiệp vụ. Xếp hàng mô phỏng + gửi (KHÔNG gồm chờ biên
 * nhận) làm lời gọi sau mô phỏng trên trạng thái đã có giao dịch trước, nên nó nhận đúng lỗi nghiệp
 * vụ (ví dụ chữ ký đã dùng) thay vì lỗi nonce. Chỉ trong một tiến trình: nhiều instance cùng ví ký
 * vẫn cần hàng đợi ở tầng custody, việc của khâu triển khai.
 *
 * `factory` dựng adapter mới ở mỗi `getLedger`, nên hàng đợi phải ở mức module, không ở adapter.
 */
const sendQueues = new Map<string, Promise<void>>();

/**
 * Selector của `ERC20InsufficientAllowance`. Lỗi này do TOKEN ném bên trong `OrderSettlement`, nên ABI
 * khớp lệnh không giải được tên và viem chỉ đưa ra 4 byte; nhận diện theo selector để câu lỗi vẫn
 * nói đúng nguyên nhân (FE-05 ca 7b: chữ ký đã dùng, ký lại).
 */
const ERC20_INSUFFICIENT_ALLOWANCE = toFunctionSelector('ERC20InsufficientAllowance(address,uint256,uint256)');

function inSendQueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = sendQueues.get(key) ?? Promise.resolve();
  const run = previous.then(task);
  const done = run.then(
    () => undefined,
    () => undefined,
  );
  sendQueues.set(key, done);
  void done.then(() => {
    if (sendQueues.get(key) === done) sendQueues.delete(key);
  });
  return run;
}

export function createEvmLedger(chain: ChainKey, signer: ISigner): ILedgerPort {
  const rpcUrl = rpcUrlFor(chain);
  const viemChain = viemChainFor(chain);

  let publicClient: PublicClient | undefined;
  let walletClient: WalletClient | undefined;

  const reader = (): PublicClient => {
    publicClient ??= createPublicClient({ chain: viemChain, transport: http(rpcUrl) });
    return publicClient;
  };

  /**
   * SC-09 là một lần nâng cấp nguyên khối: ProjectToken mới không được vận hành với
   * bộ địa chỉ cũ thiếu registry/compliance. Chặn mọi lời gọi EVM trước RPC để Sepolia
   * chưa triển khai lại không rơi vào trạng thái nửa cũ, nửa mới khó chẩn đoán.
   */
  const addressOf = (contract: ContractName): Hex => {
    if (
      !findContractAddress(chain, 'IdentityRegistry') ||
      !findContractAddress(chain, 'ModularCompliance')
    ) {
      throw new LedgerError(
        chain,
        'configuration',
        'bộ hợp đồng chain này chưa triển khai bản ERC-3643 (SC-09), chạy lại triển khai theo runbook',
      );
    }
    return getContractAddress(chain, contract) as Hex;
  };

  const sc02Operations = new Set([
    'mint',
    'mintInitialSupply',
    'isInitialSupplyMinted',
    'spvWallet',
  ]);
  const sc02NewOperations = new Set([
    'mintInitialSupply',
    'isInitialSupplyMinted',
    'spvWallet',
  ]);

  const sc02Action = (raw: string): string => {
    switch (raw) {
      case 'InitialSupplyAlreadyMinted':
        return 'Đọc spvWallet() rồi dùng mint(...) đúng ví SPV nếu cần phát hành bổ sung.';
      case 'InitialSupplyNotMinted':
        return 'Lập và duyệt lệnh phát hành nguồn cung ban đầu bằng mintInitialSupply trước.';
      case 'MintTargetNotSpv':
        return 'Đọc spvWallet() và phát hành bổ sung đúng địa chỉ đó.';
      case 'IdentityNotVerified':
        return 'Hoàn tất KYC/whitelist cho ví SPV rồi thử lại.';
      case 'WalletFrozen':
        return 'Gỡ đóng băng ví SPV sau khi hoàn tất kiểm soát rồi thử lại.';
      case 'TokenPaused':
        return 'Bỏ tạm dừng ProjectToken rồi thử lại.';
      case 'ComplianceRejected':
        return 'Kiểm tra các module trong ModularCompliance rồi thử lại.';
      case 'AccessControlUnauthorizedAccount':
        return 'Cấp MINTER_ROLE cho ví vận hành trên ProjectToken rồi thử lại.';
      case 'ZeroAddress':
        return 'Nhập địa chỉ ví SPV hợp lệ, khác địa chỉ 0.';
      case 'ZeroAmount':
        return 'Nhập số lượng phát hành lớn hơn 0.';
      default:
        return 'Kiểm tra trạng thái phát hành, ví SPV, whitelist và vai MINTER_ROLE rồi thử lại.';
    }
  };

  const oldSc02Contract = (operation: string, error: BaseError): boolean => {
    if (!sc02NewOperations.has(operation)) return false;
    const zeroData = error.walk((item) => item instanceof ContractFunctionZeroDataError);
    if (zeroData instanceof ContractFunctionZeroDataError) return true;

    const reverted = error.walk((item) => item instanceof ContractFunctionRevertedError);
    if (!(reverted instanceof ContractFunctionRevertedError)) return false;
    return (
      (!reverted.reason && !reverted.data?.errorName && !reverted.signature) ||
      /without a reason/i.test(reverted.reason ?? '') ||
      /function selector was not recognized/i.test(reverted.reason ?? '')
    );
  };

  /**
   * Trả về CẢ object `Account`, không chỉ địa chỉ.
   *
   * Quan trọng: `simulateContract({ account })` đưa `account` vào `request`, rồi
   * `writeContract(request)` dùng chính nó để quyết định cách gửi.
   *   - truyền địa chỉ (hex)  -> viem coi là account kiểu `json-rpc` -> gọi `eth_sendTransaction`,
   *     tức là NHỜ NODE KÝ. Hardhat-local có account mở sẵn nên chạy được, còn RPC công khai
   *     (Sepolia) KHÔNG hỗ trợ method này -> lỗi 'eth_sendTransaction does not exist'.
   *   - truyền object account kiểu `local` -> viem tự ký rồi gửi `eth_sendRawTransaction`.
   * Đây là lỗi chỉ lộ ra trên testnet, nên đừng "đơn giản hoá" về địa chỉ.
   */
  const writer = async (): Promise<{ client: WalletClient; account: Account }> => {
    const account = await signer.getAccount();
    walletClient ??= createWalletClient({ account, chain: viemChain, transport: http(rpcUrl) });
    return { client: walletClient, account };
  };

  /** Bóc revert reason của contract ra message đọc được, giữ lỗi gốc ở `cause`. */
  const fail: (operation: string, error: unknown) => never = (operation, error) => {
    if (error instanceof BaseError) {
      if (oldSc02Contract(operation, error)) {
        throw new LedgerError(
          chain,
          operation,
          `ProjectToken (${addressOf('ProjectToken')}) là bản trước SC-02 nên không có ` +
            `${operation}(). Nguyên nhân: contract không trả dữ liệu cho hàm mới. ` +
            'Cách xử lý: triển khai lại bộ hợp đồng bằng deploy.js rồi nạp lại địa chỉ.',
          { cause: error },
        );
      }
      const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
      if (reverted instanceof ContractFunctionRevertedError) {
        /**
         * Thứ tự này QUAN TRỌNG và trước đây bị ngược.
         *
         * Với `require(cond, "chuoi")`, viem đặt `data.errorName = "Error"` (tên của
         * error dựng sẵn `Error(string)`) và để chuỗi thật ở `reason`. Ưu tiên
         * `errorName` như trước sẽ biến MỌI lỗi tuân thủ thành đúng một câu
         * "Contract từ chối: Error" — mất sạch lý do, đúng thứ cần nhất khi mint hỏng.
         *
         * Với custom error của OZ v5 thì ngược lại: `reason` rỗng, `errorName` có tên.
         * Nên đọc `reason` trước, rồi `errorName`, cuối cùng mới tới 4 byte selector.
         */
        const raw =
          reverted.reason ??
          reverted.data?.errorName ??
          reverted.signature ??
          reverted.shortMessage;
        const translated =
          raw === 'EnforcedPause' && operation === 'withdrawFromVault'
            ? 'Vault đang tạm dừng rút.'
            : (raw === 'ERC20InsufficientAllowance' || raw === ERC20_INSUFFICIENT_ALLOWANCE) &&
          (operation === 'executePurchase' || operation === 'executeSale')
            ? `Mức ủy quyền ${operation === 'executePurchase' ? 'VNDB' : 'WPT'} không đủ cho ` +
              `OrderSettlement (${addressOf('OrderSettlement')}): chữ ký ủy quyền đã hết hạn hoặc đã dùng ` +
              '(đặt lệnh lại để ký mới), hoặc lệnh không có chữ ký mà ví chưa approve đủ.'
            : translateRevert(raw);
        const message = sc02Operations.has(operation)
          ? `ProjectToken (${addressOf('ProjectToken')}) từ chối ${operation}. ` +
            `Nguyên nhân: ${translated} Cách xử lý: ${sc02Action(raw)}`
          : translated;
        throw new LedgerError(chain, operation, message, { cause: error, reverted: true });
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

  /** Đọc từ một contract bất kỳ trong `packages/shared`. */
  const readOn = async <T>(
    operation: string,
    contract: ContractName,
    abi: Abi | readonly unknown[],
    functionName: string,
    args: readonly unknown[],
  ): Promise<T> => {
    try {
      return (await reader().readContract({
        address: addressOf(contract),
        abi: abi as Abi,
        functionName: functionName as never,
        args: args as never,
      })) as T;
    } catch (error) {
      return fail(operation, error);
    }
  };

  const read = async <T>(
    operation: string,
    functionName: string,
    args: readonly unknown[],
  ): Promise<T> => readOn<T>(operation, 'ProjectToken', projectTokenAbi, functionName, args);

  /**
   * simulate -> write -> trả PENDING, trên một contract bất kỳ trong `packages/shared`. Người gọi tự
   * `waitReceipt` để kiểm soát timeout. `onError` cho method cần câu lỗi riêng trước khi rơi về `fail`.
   */
  const writeOn = async (
    operation: string,
    contract: ContractName,
    abi: Abi | readonly unknown[],
    functionName: string,
    args: readonly unknown[],
    onError: (error: unknown) => Promise<void> = async () => {},
  ): Promise<TxResult> => {
    try {
      const { client, account } = await writer();
      const txHash = await inSendQueue(`${chain}:${account.address.toLowerCase()}`, async () => {
        const { request } = await reader().simulateContract({
          account,
          address: addressOf(contract),
          abi: abi as Abi,
          functionName: functionName as never,
          args: args as never,
        });
        return client.writeContract(request as never);
      });
      return { txHash, status: 'PENDING' };
    } catch (error) {
      await onError(error);
      return fail(operation, error);
    }
  };

  const write = (operation: string, functionName: string, args: readonly unknown[]) =>
    writeOn(operation, 'ProjectToken', projectTokenAbi, functionName, args);

  /**
   * Guard cục bộ cho mã snapshot: chặn trước khi tốn một lượt gọi RPC.
   * Contract cũng chặn (`require(snapshotId > 0)`) nhưng báo bằng chuỗi thô.
   */
  const assertSnapshotId: (operation: string, snapshotId: number) => void = (
    operation,
    snapshotId,
  ) => {
    if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
      throw new LedgerError(
        chain,
        operation,
        `Mã snapshot phải là số nguyên dương, nhận được ${snapshotId}. ` +
          `Mã snapshot lấy từ kết quả takeSnapshot().`,
      );
    }
  };

  /** Mã kỳ chia trên chuỗi bắt đầu từ 0 (chỉ số mảng `distributions`), khác mã snapshot. */
  const assertDistributionId: (operation: string, distributionId: number) => void = (
    operation,
    distributionId,
  ) => {
    if (!Number.isSafeInteger(distributionId) || distributionId < 0) {
      throw new LedgerError(
        chain,
        operation,
        `Mã kỳ chia phải là số nguyên không âm, nhận được ${distributionId}. ` +
          'Mã lấy từ findDistribution(periodKey).',
      );
    }
  };

  /** Đọc trên token nhận permit: VNDB cho lệnh mua, WPT cho lệnh bán (FE-05). */
  const readPermitToken = <T>(
    operation: string,
    token: PermitToken,
    functionName: string,
    args: readonly unknown[],
  ): Promise<T> =>
    token === 'payment'
      ? readOn<T>(operation, 'VNDToken', vndTokenAbi, functionName, args)
      : readOn<T>(operation, 'ProjectToken', projectTokenAbi, functionName, args);

  /**
   * Hàm và tham số khớp lệnh theo chiều (FE-05 QĐ-G): có chữ ký permit thì `buyWithPermit` /
   * `sellWithPermit`, không có thì `buy` / `sell` (lệnh trước FE-05, dựa vào ủy quyền thực tế).
   */
  const settlementCall = (
    side: 'buy' | 'sell',
    order: SettlementOrder,
  ): [functionName: string, args: readonly unknown[]] => {
    const args = [
      orderRefFromOrderId(order.orderId),
      normalizeEvmAddress(order.investor),
      order.wptAmount,
      order.vndAmount,
    ] as const;
    if (!order.permit) return [side, args];
    const { value, deadline, v, r, s } = order.permit;
    return [`${side}WithPermit`, [...args, { value, deadline, v, r, s }]];
  };

  const readDistributor = <T>(operation: string, functionName: string, args: readonly unknown[]) =>
    readOn<T>(operation, 'ProfitDistributor', profitDistributorAbi, functionName, args);

  /** Một kỳ đọc từ `distributions(id)`, gắn với địa chỉ ProfitDistributor hiện hành (SC-06 QĐ-E). */
  const readDistribution = async (
    operation: string,
    distributionId: number,
  ): Promise<ChainDistribution> => {
    const [[snapshotId, amount, supplyAtSnapshot, claimed, , , claimDeadline, closed], latest] =
      await Promise.all([
        readDistributor<readonly [bigint, bigint, bigint, bigint, bigint, string, bigint, boolean]>(
          operation,
          'distributions',
          [BigInt(distributionId)],
        ),
        reader()
          .getBlock()
          .catch((error: unknown) => fail(operation, error)),
      ]);
    return {
      distributor: normalizeEvmAddress(addressOf('ProfitDistributor')),
      distributionId,
      snapshotId: Number(snapshotId),
      amount,
      claimed,
      totalSupplyAt: supplyAtSnapshot,
      claimDeadline: new Date(Number(claimDeadline) * 1000),
      // Cùng phép so với `_claim`: `block.timestamp >= claimDeadline` là hết hạn.
      expired: latest.timestamp >= claimDeadline,
      closed,
    };
  };

  /**
   * Sự kiện `PeriodClosed` của vault từ block triển khai, mới nhất trước. `periodRef` lọc theo
   * tham số indexed. Dùng chung cho lịch sử công khai (SC-07) và đối soát chốt kỳ (SC-06 QĐ-G).
   */
  const readPeriodCloses = async (
    operation: string,
    vaultAddress: string,
    periodRef?: bigint,
  ): Promise<VaultPeriodClose[]> => {
    const deployBlock = addressBook[chain]?.deployBlock;
    if (deployBlock === undefined) {
      throw new LedgerError(
        chain,
        operation,
        'Thiếu block triển khai trong address book; không quét lịch sử vault từ block 0.',
      );
    }
    try {
      const logs = (await reader().getContractEvents({
        address: normalizeEvmAddress(vaultAddress) as Hex,
        abi: spvPaymentVaultAbi as Abi,
        eventName: 'PeriodClosed',
        ...(periodRef === undefined ? {} : { args: { periodRef } }),
        fromBlock: BigInt(deployBlock),
        toBlock: 'latest',
      })) as Array<{
        args: { periodRef?: bigint; distributedPrev?: bigint; rateBps?: bigint; percentLocked?: bigint; operator?: string };
        transactionHash: Hex;
        blockNumber: bigint;
        logIndex: number;
      }>;
      return logs
        .sort((a, b) => Number(b.blockNumber - a.blockNumber) || b.logIndex - a.logIndex)
        .map((log) => ({
          periodRef: log.args.periodRef ?? 0n,
          distributedPrev: log.args.distributedPrev ?? 0n,
          rateBps: log.args.rateBps ?? 0n,
          percentLocked: log.args.percentLocked ?? 0n,
          operator: normalizeEvmAddress(log.args.operator ?? '0x0000000000000000000000000000000000000000'),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: 0,
        }));
    } catch (error) {
      return fail(operation, error);
    }
  };

  /** Địa chỉ vault của chain; chưa triển khai thì ghi và đối soát vault là gọi sai chain (BE-13). */
  const requireVault = (operation: string): string => {
    const vault = findContractAddress(chain, 'SpvPaymentVault');
    if (!vault) {
      throw new LedgerError(
        chain,
        operation,
        'Chain này chưa có vault thanh toán SPV trong address book; không áp dụng.',
      );
    }
    return normalizeEvmAddress(vault);
  };

  const writeVault = (operation: string, functionName: string, args: readonly unknown[]) => {
    requireVault(operation);
    return writeOn(operation, 'SpvPaymentVault', spvPaymentVaultAbi, functionName, args);
  };

  type WithdrawnLog = {
    args: { to?: string; amount?: bigint; operator?: string };
    transactionHash: Hex;
    blockNumber: bigint;
    logIndex: number;
  };

  const toVaultWithdrawal = (log: WithdrawnLog): VaultWithdrawal => ({
    to: normalizeEvmAddress(log.args.to ?? '0x0000000000000000000000000000000000000000'),
    amount: log.args.amount ?? 0n,
    operator: normalizeEvmAddress(log.args.operator ?? '0x0000000000000000000000000000000000000000'),
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
  });

  /** Gợi ý thống nhất cho các method còn chờ hợp đồng — nêu đúng thứ đang thiếu. */
  const pendingContract: (operation: string, needs: string) => never = (operation, needs) => {
    throw new LedgerNotImplementedError(
      chain,
      operation,
      `Chờ ${needs}. Hiện dùng chain "mock" để phát triển; xem docs/CHECKPOINT_BE01.md mục nợ.`,
    );
  };

  return {
    chain,

    // =========================================================================
    //  TUÂN THỦ
    // =========================================================================
    async whitelist(wallet) {
      return writeOn(
        'whitelist',
        'IdentityRegistry',
        identityRegistryAbi,
        'registerIdentity',
        [normalizeEvmAddress(wallet), VIETNAM_COUNTRY_CODE],
      );
    },

    async isWhitelisted(wallet) {
      return readOn<boolean>(
        'isWhitelisted',
        'IdentityRegistry',
        identityRegistryAbi,
        'isVerified',
        [normalizeEvmAddress(wallet)],
      );
    },

    async freeze(wallet, frozen) {
      return write('freeze', 'setAddressFrozen', [normalizeEvmAddress(wallet), frozen]);
    },

    async isFrozen(wallet) {
      return read<boolean>('isFrozen', 'isFrozen', [normalizeEvmAddress(wallet)]);
    },

    /**
     * Gộp mọi kiểm tra của `ProjectToken._update` thành tám lời gọi ĐỌC song song.
     * Không gửi giao dịch, không tốn phí (R3.2).
     *
     * Thứ tự trả lý do giống thứ tự `require` trong contract, để lý do báo ra đúng
     * là lý do giao dịch sẽ chết — lệch thứ tự thì giao diện chỉ vào sai chỗ.
     */
    async canTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'canTransfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);

      const [
        paused,
        senderFrozen,
        receiverFrozen,
        senderKyc,
        receiverKyc,
        senderBalance,
        senderFrozenTokens,
        complianceAllowed,
      ] = await Promise.all([
          read<boolean>('canTransfer', 'paused', []),
          read<boolean>('canTransfer', 'isFrozen', [sender]),
          read<boolean>('canTransfer', 'isFrozen', [receiver]),
          readOn<boolean>(
            'canTransfer',
            'IdentityRegistry',
            identityRegistryAbi,
            'isVerified',
            [sender],
          ),
          readOn<boolean>(
            'canTransfer',
            'IdentityRegistry',
            identityRegistryAbi,
            'isVerified',
            [receiver],
          ),
          read<bigint>('canTransfer', 'balanceOf', [sender]),
          read<bigint>('canTransfer', 'getFrozenTokens', [sender]),
          readOn<boolean>(
            'canTransfer',
            'ModularCompliance',
            modularComplianceAbi,
            'canTransfer',
            [sender, receiver, amount],
          ),
        ]);

      const deny = (reason: string): TransferCheck => ({ allowed: false, reason });

      if (paused) return deny(REVERT_MESSAGES['token dang tam dung']);
      if (senderFrozen) return deny(`Bên gửi đang bị đóng băng: ${sender}`);
      if (receiverFrozen) return deny(`Bên nhận đang bị đóng băng: ${receiver}`);
      if (!senderKyc) return deny(`Bên gửi chưa KYC/whitelist: ${sender}`);
      if (!receiverKyc) return deny(`Bên nhận chưa KYC/whitelist: ${receiver}`);
      if (senderBalance < amount) {
        return deny(`Số dư WPT không đủ: cần ${amount}, ví ${sender} chỉ có ${senderBalance}.`);
      }
      const available = senderBalance - senderFrozenTokens;
      if (available < amount) {
        return deny(
          `Số WPT khả dụng không đủ: cần ${amount}, ví ${sender} chỉ dùng được ${available} ` +
            `do ${senderFrozenTokens} WPT đang bị đóng băng.`,
        );
      }
      if (!complianceAllowed) return deny('Bộ luật tuân thủ ERC-3643 từ chối giao dịch.');
      return { allowed: true };
    },

    // =========================================================================
    //  PHÁT HÀNH / THU HỒI
    // =========================================================================
    async mint(to, amount) {
      assertPositiveAmount(chain, 'mint', amount);
      return write('mint', 'mint', [normalizeEvmAddress(to), amount]);
    },

    async burn(from, amount) {
      assertPositiveAmount(chain, 'burn', amount);
      // ERC-3643 agent burn: ngân hàng (AGENT_ROLE) đốt được cả ví đang bị băng.
      return write('burn', 'burn', [normalizeEvmAddress(from), amount]);
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

    async mintInitialSupply(to, amount) {
      assertPositiveAmount(chain, 'mintInitialSupply', amount);
      return write('mintInitialSupply', 'mintInitialSupply', [normalizeEvmAddress(to), amount]);
    },

    async isInitialSupplyMinted() {
      return read<boolean>('isInitialSupplyMinted', 'initialSupplyMinted', []);
    },

    async spvWallet() {
      const wallet = await read<string>('spvWallet', 'spvWallet', []);
      return /^0x0{40}$/i.test(wallet) ? null : normalizeEvmAddress(wallet);
    },

    // =========================================================================
    //  KHỚP LỆNH MUA
    // =========================================================================
    async quotePurchase(wptAmount) {
      assertPositiveAmount(chain, 'quotePurchase', wptAmount);
      const price = await readOn<bigint>('quotePurchase', 'OrderSettlement', orderSettlementAbi, 'price', []);
      return wptAmount * price;
    },

    /**
     * KHÔNG nối tạm vào `EnergyOracle` hay một hàm `setPrice` của contract nào khác đang có.
     * Giá bán phải nằm ĐÚNG chỗ mà `executePurchase` đọc để trừ tiền; đặt nó vào một contract
     * khác thì giá báo cho nhà đầu tư và giá thật sự trừ là hai con số, tức là dựng lại chính
     * lỗi mà `setPurchasePrice` được thêm vào để dẹp — nhưng lần này có vẻ "đã xong".
     *
     */
    async setPurchasePrice(pricePerWpt) {
      assertPositiveAmount(chain, 'setPurchasePrice', pricePerWpt);
      return writeOn('setPurchasePrice', 'OrderSettlement', orderSettlementAbi, 'setPrice', [pricePerWpt]);
    },

    /** Đọc được ngay: VNDToken đã deploy, địa chỉ có trong packages/shared. */
    async paymentBalanceOf(wallet) {
      return readOn<bigint>('paymentBalanceOf', 'VNDToken', vndTokenAbi, 'balanceOf', [
        normalizeEvmAddress(wallet),
      ]);
    },

    /**
     * `VNDToken.allowance` đã có trong ABI, nhưng `spender` phải là địa
     * chỉ hợp đồng khớp lệnh — chưa tồn tại. Truyền một địa chỉ khác vào sẽ trả về
     * một con số có vẻ hợp lệ nhưng vô nghĩa, tệ hơn là báo lỗi.
     *
     */
    async paymentAllowanceOf(owner) {
      return readOn<bigint>('paymentAllowanceOf', 'VNDToken', vndTokenAbi, 'allowance', [
        normalizeEvmAddress(owner),
        addressOf('OrderSettlement'),
      ]);
    },

    async wptAllowanceOf(owner) {
      return read<bigint>('wptAllowanceOf', 'allowance', [
        normalizeEvmAddress(owner),
        addressOf('OrderSettlement'),
      ]);
    },

    async latestBlockTimestamp() {
      try {
        return (await reader().getBlock()).timestamp;
      } catch (error) {
        return fail('latestBlockTimestamp', error);
      }
    },

    async permitDomain(token) {
      const [fields, name, version, chainId, verifyingContract, salt, extensions] =
        await readPermitToken<
          readonly [Hex, string, string, bigint, Hex, Hex, readonly bigint[]]
        >('permitDomain', token, 'eip712Domain', []);
      return { fields, name, version, chainId, verifyingContract, salt, extensions };
    },

    async permitNonce(token, owner) {
      return readPermitToken<bigint>('permitNonce', token, 'nonces', [normalizeEvmAddress(owner)]);
    },

    async findOrderSettlement(orderId) {
      const orderRef = orderRefFromOrderId(orderId);
      const settled = await readOn<boolean>(
        'findOrderSettlement',
        'SpvPaymentVault',
        spvPaymentVaultAbi,
        'isOrderSettled',
        [orderRef],
      );
      if (!settled) return { status: 'NOT_SETTLED' as const };

      const deployBlock = addressBook[chain]?.deployBlock;
      if (deployBlock === undefined) {
        throw new LedgerError(
          chain,
          'findOrderSettlement',
          'Thiếu block triển khai trong address book; không thể tìm sự kiện OrderSettled an toàn.',
        );
      }
      try {
        const lower = BigInt(deployBlock);
        const chunk = BigInt(serverEnv().orderSettlementEventBlockChunk);
        let toBlock = await reader().getBlockNumber();
        while (toBlock >= lower) {
          const fromBlock = toBlock - lower + 1n > chunk ? toBlock - chunk + 1n : lower;
          const logs = (await reader().getContractEvents({
            address: addressOf('SpvPaymentVault'),
            abi: spvPaymentVaultAbi as Abi,
            eventName: 'OrderSettled',
            args: { orderRef } as never,
            fromBlock,
            toBlock,
          })) as Array<{ transactionHash: Hex; blockNumber: bigint; logIndex: number }>;
          if (logs.length > 0) {
            const found = logs.sort(
              (left, right) => Number(right.blockNumber - left.blockNumber) || right.logIndex - left.logIndex,
            )[0];
            return { status: 'SETTLED' as const, txHash: found.transactionHash, blockNumber: found.blockNumber };
          }
          if (fromBlock === lower) break;
          toBlock = fromBlock - 1n;
        }
        return { status: 'SETTLED_TX_UNKNOWN' as const };
      } catch (error) {
        return fail('findOrderSettlement', error);
      }
    },

    /**
     * `VNDToken.mint` đã có, chỉ đòi ví ký có `MINTER_ROLE`. Thiếu vai thì câu chung "thiếu role"
     * của bảng dịch không đủ: người vận hành cần biết ví nào, thiếu vai gì, trên hợp đồng nào.
     */
    async mintPayment(to, amount) {
      assertPositiveAmount(chain, 'mintPayment', amount);
      return writeOn(
        'mintPayment',
        'VNDToken',
        vndTokenAbi,
        'mint',
        [normalizeEvmAddress(to), amount],
        async (error) => {
          const reverted =
            error instanceof BaseError
              ? error.walk((e) => e instanceof ContractFunctionRevertedError)
              : null;
          if (
            reverted instanceof ContractFunctionRevertedError &&
            reverted.data?.errorName === 'AccessControlUnauthorizedAccount'
          ) {
            throw new LedgerError(
              chain,
              'mintPayment',
              `Ví vận hành ${await signer.getAddress()} thiếu vai MINTER_ROLE trên hợp đồng VNDToken ` +
                `(${addressOf('VNDToken')}). Cấp bằng VNDToken.grantRole(MINTER_ROLE, <ví vận hành>) từ ví quản trị.`,
              { cause: error },
            );
          }
        },
      );
    },

    async executePurchase(order) {
      assertPositiveAmount(chain, 'executePurchase', order.wptAmount);
      return writeOn('executePurchase', 'OrderSettlement', orderSettlementAbi, ...settlementCall('buy', order));
    },

    async executeSale(order) {
      assertPositiveAmount(chain, 'executeSale', order.wptAmount);
      return writeOn('executeSale', 'OrderSettlement', orderSettlementAbi, ...settlementCall('sell', order));
    },

    // =========================================================================
    //  CHỐT QUYỀN
    // =========================================================================
    /**
     * Mã snapshot đọc từ event `Snapshot` trong receipt, KHÔNG tự tăng số đếm.
     *
     * Vì sao không đọc giá trị trả về của `snapshot()`: hàm ghi không trả dữ liệu
     * qua `eth_sendTransaction`. Vì sao không dùng `getCurrentSnapshotId()` sau khi
     * gửi: giữa hai lời gọi có thể có tx snapshot khác chen vào và ta lấy về mã của
     * người khác — sai âm thầm, và sai đúng vào lúc chia lợi nhuận.
     *
     * Đây là method ghi duy nhất tự chờ receipt: không có receipt thì không có mã
     * snapshot, nên trả PENDING là vô nghĩa.
     */
    async takeSnapshot(): Promise<SnapshotResult> {
      const tx = await write('takeSnapshot', 'snapshot', []);
      const receipt = await reader()
        .waitForTransactionReceipt({ hash: tx.txHash as Hex, timeout: receiptTimeoutFor(chain) })
        .catch((error: unknown) =>
          fail(
            'takeSnapshot',
            error instanceof Error
              ? new Error(
                  `Đã gửi giao dịch chốt quyền (${tx.txHash}) nhưng chưa lấy được biên nhận, ` +
                    `nên chưa biết mã snapshot. Tra lại tx này trước khi chốt lần nữa. ` +
                    `Nguyên nhân: ${error.message}`,
                )
              : error,
          ),
        );

      if (receipt.status !== 'success') {
        throw new LedgerError(
          chain,
          'takeSnapshot',
          `Giao dịch chốt quyền bị revert on-chain (${tx.txHash}).`,
        );
      }

      const events = parseEventLogs({
        abi: projectTokenAbi,
        logs: receipt.logs,
        eventName: 'Snapshot',
      });
      const id = events[0]?.args?.id;
      if (id === undefined) {
        throw new LedgerError(
          chain,
          'takeSnapshot',
          `Không tìm thấy event Snapshot trong biên nhận ${tx.txHash}. ` +
            `Kiểm tra ProjectToken đúng địa chỉ và ABI trong packages/shared còn khớp contract.`,
        );
      }

      return { tx: { txHash: tx.txHash, status: 'CONFIRMED' }, snapshotId: Number(id) };
    },

    async balanceOfAt(wallet, snapshotId) {
      assertSnapshotId('balanceOfAt', snapshotId);
      return read<bigint>('balanceOfAt', 'balanceOfAt', [
        normalizeEvmAddress(wallet),
        BigInt(snapshotId),
      ]);
    },

    async totalSupplyAt(snapshotId) {
      assertSnapshotId('totalSupplyAt', snapshotId);
      return read<bigint>('totalSupplyAt', 'totalSupplyAt', [BigInt(snapshotId)]);
    },

    // =========================================================================
    //  CHIA LỢI NHUẬN
    // =========================================================================
    /** Quỹ chia = số dư VNDB của hợp đồng ProfitDistributor. Cả hai đã deploy. */
    async profitPoolBalance() {
      return readOn<bigint>('profitPoolBalance', 'VNDToken', vndTokenAbi, 'balanceOf', [
        addressOf('ProfitDistributor'),
      ]);
    },

    async unallocatedProfit() {
      return readDistributor<bigint>('unallocatedProfit', 'unallocatedBalance', []);
    },

    async reservedProfit() {
      return readDistributor<bigint>('reservedProfit', 'totalReserved', []);
    },

    /**
     * `createDistributionFromPool(periodKey)`: hợp đồng tự chụp ảnh và chốt số tiền bằng phần
     * chưa phân bổ, nên kỳ trên chuỗi và số tiền của nó KHÔNG phụ thuộc lần đọc nào trước đó.
     * Trả PENDING để nghiệp vụ lưu mã giao dịch trước khi chờ biên nhận.
     */
    async openDistribution(periodKey) {
      return writeOn(
        'openDistribution',
        'ProfitDistributor',
        profitDistributorAbi,
        'createDistributionFromPool',
        [periodKey],
      );
    },

    /** `distributionIdOfPeriod` rồi `distributions(id)`: tra thẳng, không quét sự kiện. */
    async findDistribution(periodKey) {
      const [exists, id] = await readDistributor<readonly [boolean, bigint]>(
        'findDistribution',
        'distributionIdOfPeriod',
        [periodKey],
      );
      return exists ? readDistribution('findDistribution', Number(id)) : null;
    },

    async distributionState(distributionId) {
      assertDistributionId('distributionState', distributionId);
      return readDistribution('distributionState', distributionId);
    },

    /**
     * `ProfitDistributor.distributeTo(distributionId, wallets)`. Mã kỳ chia lấy từ
     * `findDistribution` lúc mở kỳ và lưu ở `DistributionPeriod.distributionId` (SC-06 gộp SC-05).
     */
    async distributeBatch(distributionId, wallets) {
      assertDistributionId('distributeBatch', distributionId);
      if (wallets.length === 0) {
        throw new LedgerError(
          chain,
          'distributeBatch',
          'Danh sách ví trống: tầng nghiệp vụ phải truyền vào ít nhất một ví.',
        );
      }
      return writeOn('distributeBatch', 'ProfitDistributor', profitDistributorAbi, 'distributeTo', [
        BigInt(distributionId),
        wallets.map((wallet) => normalizeEvmAddress(wallet)),
      ]);
    },

    async isDistributionPaid(distributionId, wallet) {
      assertDistributionId('isDistributionPaid', distributionId);
      return readDistributor<boolean>('isDistributionPaid', 'hasClaimed', [
        BigInt(distributionId),
        normalizeEvmAddress(wallet),
      ]);
    },

    async closeDistribution(distributionId) {
      assertDistributionId('closeDistribution', distributionId);
      return writeOn(
        'closeDistribution',
        'ProfitDistributor',
        profitDistributorAbi,
        'closeDistribution',
        [BigInt(distributionId)],
      );
    },

    // =========================================================================
    //  TẤT TOÁN
    // =========================================================================
    /**
     * Chưa contract nào phơi ra cờ "đang tất toán" đúng nghĩa.
     * `ProjectToken.paused` chặn chuyển nhượng và vẫn cho agent `burn(address,uint256)` (khớp R6.3),
     * còn `Redemption.paused` thì NGƯỢC hướng. Chọn sai một trong hai sẽ ra hệ thống
     * chạy được nhưng làm ngược — cần Owner/Supervisor xác nhận trước khi nối.
     *
     * @blocked SC-04 | thiếu quyết định cờ "đang tất toán" nằm ở contract nào; hai ứng viên hiện có thì ngược hướng nhau
     */
    async setSettlementMode() {
      return pendingContract('setSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
    },

    /** @blocked SC-04 | thiếu quyết định cờ "đang tất toán" nằm ở contract nào, nên chưa có cờ nào để đọc */
    async isSettlementMode() {
      return pendingContract('isSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
    },

    /** @blocked SC-04 | thiếu quyết định giá NAV có phải `Redemption.rate` hay không */
    async setNavRate(rate) {
      assertPositiveAmount(chain, 'setNavRate', rate);
      return pendingContract('setNavRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
    },

    /** @blocked SC-04 | thiếu quyết định giá NAV có phải `Redemption.rate` hay không */
    async navRate() {
      return pendingContract('navRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
    },

    // =========================================================================
    //  VAULT THANH TOÁN SPV: đọc (SC-07), chốt kỳ (SC-06), cấu hình và rút (BE-13)
    // =========================================================================
    async vaultStatus() {
      const vaultAddress = findContractAddress(chain, 'SpvPaymentVault');
      if (!vaultAddress) return null;
      const vault = normalizeEvmAddress(vaultAddress);
      const [
        wptBalance,
        vndbBalance,
        mode,
        fixedLockAmount,
        percentRateBps,
        pendingRate,
        hasPendingRate,
        netProceeds,
        lockedAmount,
        withdrawable,
        lastPeriodRef,
        lastDistributedPrev,
        percentLocked,
        payoutWallet,
        withdrawalsPaused,
      ] = await Promise.all([
        read<bigint>('vaultStatus', 'balanceOf', [vault]),
        readOn<bigint>('vaultStatus', 'VNDToken', vndTokenAbi, 'balanceOf', [vault]),
        readOn<number>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'lockMode', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'fixedLockAmount', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'percentRateBps', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'pendingPercentRateBps', []),
        readOn<boolean>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'hasPendingRate', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'netProceeds', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'lockedAmount', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'withdrawable', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'lastPeriodRef', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'lastDistributedPrev', []),
        readOn<bigint>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'percentLocked', []),
        readOn<string>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'payoutWallet', []),
        readOn<boolean>('vaultStatus', 'SpvPaymentVault', spvPaymentVaultAbi, 'paused', []),
      ]);
      const lockModes: VaultLockMode[] = ['UNSET', 'FIXED', 'PERCENT'];
      const lockMode = lockModes[Number(mode)];
      if (!lockMode) throw new LedgerError(chain, 'vaultStatus', `Chế độ khoá vault không hợp lệ: ${mode}.`);
      return {
        address: vault,
        wptBalance,
        vndbBalance,
        lockMode,
        fixedLockAmount,
        percentRateBps,
        pendingPercentRateBps: hasPendingRate ? pendingRate : null,
        netProceeds,
        lockedAmount,
        withdrawable,
        lastPeriodRef,
        lastDistributedPrev,
        percentLocked,
        payoutWallet: /^0x0{40}$/i.test(payoutWallet) ? null : normalizeEvmAddress(payoutWallet),
        withdrawalsPaused,
      };
    },

    async vaultPeriodCloses(limit) {
      const vaultAddress = findContractAddress(chain, 'SpvPaymentVault');
      if (!vaultAddress || limit <= 0) return [];
      const latest = (await readPeriodCloses('vaultPeriodCloses', vaultAddress)).slice(0, limit);
      try {
        return await Promise.all(
          latest.map(async (close): Promise<VaultPeriodClose> => {
            const block = await reader().getBlock({ blockNumber: close.blockNumber });
            return { ...close, timestamp: Number(block.timestamp) };
          }),
        );
      } catch (error) {
        return fail('vaultPeriodCloses', error);
      }
    },

    /** `closePeriod` cần CONFIG_ROLE của vault; ví ký máy chủ giữ vai này từ lúc triển khai. */
    async closeVaultPeriod(periodRef, distributedPrev) {
      if (!findContractAddress(chain, 'SpvPaymentVault')) {
        throw new LedgerError(
          chain,
          'closeVaultPeriod',
          'Chain này chưa có vault thanh toán SPV trong address book nên không có kỳ vault để chốt.',
        );
      }
      return writeOn('closeVaultPeriod', 'SpvPaymentVault', spvPaymentVaultAbi, 'closePeriod', [
        periodRef,
        distributedPrev,
      ]);
    },

    async findVaultPeriodClose(periodRef) {
      const vaultAddress = findContractAddress(chain, 'SpvPaymentVault');
      if (!vaultAddress) return null;
      const [found] = await readPeriodCloses('findVaultPeriodClose', vaultAddress, periodRef);
      if (!found) return null;
      try {
        const block = await reader().getBlock({ blockNumber: found.blockNumber });
        return { ...found, timestamp: Number(block.timestamp) };
      } catch (error) {
        return fail('findVaultPeriodClose', error);
      }
    },

    /*
     * Cấu hình khoá (BE-13 QĐ-C): CONFIG_ROLE cho ba setter khoá, DEFAULT_ADMIN_ROLE cho ví nhận;
     * ví ký máy chủ giữ cả hai từ lúc triển khai. `simulateContract` trong `writeOn` bắt revert
     * (`RateTooHigh`, `PayoutWalletNotVerified`, ...) trước khi gửi.
     */
    async setVaultPercentRate(bps) {
      return writeVault('setVaultPercentRate', 'setPercentRate', [bps]);
    },

    async setVaultFixedLock(amount) {
      return writeVault('setVaultFixedLock', 'setFixedLock', [amount]);
    },

    async setVaultLockMode(mode) {
      // Thứ tự enum trong hợp đồng: UNSET = 0, FIXED = 1, PERCENT = 2.
      const value = ({ FIXED: 1, PERCENT: 2 } as const)[mode];
      if (value === undefined) {
        throw new LedgerError(chain, 'setVaultLockMode', 'Không thể đặt chế độ khoá về Chưa cấu hình.');
      }
      return writeVault('setVaultLockMode', 'setLockMode', [value]);
    },

    async setVaultPayoutWallet(wallet) {
      return writeVault('setVaultPayoutWallet', 'setPayoutWallet', [normalizeEvmAddress(wallet)]);
    },

    /** `withdraw` cần WITHDRAWER_ROLE; tiền luôn về `payoutWallet` đã đặt trên vault (QĐ-E). */
    async withdrawFromVault(amount) {
      return writeVault('withdrawFromVault', 'withdraw', [amount]);
    },

    async findVaultWithdrawals({ fromBlock, to, amount }) {
      const vault = requireVault('findVaultWithdrawals');
      try {
        const logs = (await reader().getContractEvents({
          address: vault as Hex,
          abi: spvPaymentVaultAbi as Abi,
          eventName: 'Withdrawn',
          ...(to === undefined ? {} : { args: { to: normalizeEvmAddress(to) } }),
          fromBlock,
          toBlock: 'latest',
        })) as WithdrawnLog[];
        return logs
          .map(toVaultWithdrawal)
          .filter((event) => amount === undefined || event.amount === amount)
          .sort((a, b) => Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex);
      } catch (error) {
        return fail('findVaultWithdrawals', error);
      }
    },

    async vaultWithdrawalReceipt(txHash) {
      const vault = requireVault('vaultWithdrawalReceipt');
      try {
        const receipt = await reader().getTransactionReceipt({ hash: txHash as Hex });
        // Chỉ nhận sự kiện do CHÍNH vault phát: hợp đồng khác cùng chữ ký sự kiện không tính.
        const logs = receipt.logs.filter((log) => log.address.toLowerCase() === vault.toLowerCase());
        const events = parseEventLogs({ abi: spvPaymentVaultAbi, logs, eventName: 'Withdrawn' }) as unknown as WithdrawnLog[];
        return {
          txHash,
          status: receipt.status === 'success' ? ('CONFIRMED' as const) : ('FAILED' as const),
          withdrawals: events.map(toVaultWithdrawal),
        };
      } catch (error) {
        if (error instanceof BaseError && error.walk((e) => e instanceof TransactionReceiptNotFoundError)) {
          return null;
        }
        return fail('vaultWithdrawalReceipt', error);
      }
    },

    // =========================================================================
    //  ĐỌC / GIAO DỊCH
    // =========================================================================
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

    // Mặc định theo chain: hardhat-local 30s, evm (Sepolia) 90s.
    async waitReceipt(txHash, timeoutMs = receiptTimeoutFor(chain)) {
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

    async latestBlockNumber() {
      try {
        // viem mặc định đệm số block vài giây; `claimedBlock` cần số mới nhất thật.
        return await reader().getBlockNumber({ cacheTime: 0 });
      } catch (error) {
        return fail('latestBlockNumber', error);
      }
    },
  };
}
