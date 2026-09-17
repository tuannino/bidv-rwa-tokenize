import 'server-only';

import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Abi,
  type Account,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import {
  getContractAddress,
  projectTokenAbi,
  vndTokenAbi,
  type ChainKey,
  type ContractName,
} from '@bidv/shared';
import { rpcUrlFor, viemChainFor } from '@/lib/chains/registry';
import type { ISigner } from '@/lib/signer';
import { normalizeEvmAddress } from './address';
import {
  LedgerError,
  LedgerNotImplementedError,
  assertPositiveAmount,
  receiptTimeoutFor,
  type ILedgerPort,
  type SnapshotResult,
  type TokenInfo,
  type TransferCheck,
  type TxResult,
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
 * NỢ CÓ CHỦ ĐÍCH — các method chờ hợp đồng SC-02/SC-03
 *
 * `ILedgerPort` mô tả ba luồng đã chốt, nhưng hợp đồng cho hai luồng khớp lệnh và
 * tất toán CHƯA có trên `dev`. Theo `docs/be-01-ledger-port/design.md` mục 5,
 * những method đó ném `LedgerNotImplementedError` kèm gợi ý nêu rõ thứ còn thiếu,
 * thay vì nối tạm vào một contract có ngữ nghĩa gần gần.
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
    'Mức ủy quyền token không đủ — chủ ví phải approve cho hợp đồng trước.',
  ERC20InvalidReceiver: 'Địa chỉ nhận không hợp lệ.',
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

export function createEvmLedger(chain: ChainKey, signer: ISigner): ILedgerPort {
  const rpcUrl = rpcUrlFor(chain);
  const viemChain = viemChainFor(chain);

  let publicClient: PublicClient | undefined;
  let walletClient: WalletClient | undefined;

  const reader = (): PublicClient => {
    publicClient ??= createPublicClient({ chain: viemChain, transport: http(rpcUrl) });
    return publicClient;
  };

  const addressOf = (contract: ContractName): Hex => getContractAddress(chain, contract) as Hex;
  const tokenAddress = (): Hex => addressOf('ProjectToken');

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
        throw new LedgerError(chain, operation, translateRevert(raw), { cause: error });
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

    /**
     * Gộp mọi kiểm tra của `ProjectToken._update` thành sáu lời gọi ĐỌC song song.
     * Không gửi giao dịch, không tốn phí (R3.2).
     *
     * Thứ tự trả lý do giống thứ tự `require` trong contract, để lý do báo ra đúng
     * là lý do giao dịch sẽ chết — lệch thứ tự thì giao diện chỉ vào sai chỗ.
     */
    async canTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'canTransfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);

      const [paused, senderFrozen, receiverFrozen, senderKyc, receiverKyc, senderBalance] =
        await Promise.all([
          read<boolean>('canTransfer', 'paused', []),
          read<boolean>('canTransfer', 'isFrozen', [sender]),
          read<boolean>('canTransfer', 'isFrozen', [receiver]),
          read<boolean>('canTransfer', 'isWhitelisted', [sender]),
          read<boolean>('canTransfer', 'isWhitelisted', [receiver]),
          read<bigint>('canTransfer', 'balanceOf', [sender]),
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

    /**
     * NỢ SC-02. `ProjectToken.mint` phát hành được nhiều lần và không lưu cờ "đã
     * phát hành nguồn cung ban đầu", nên không có cách nào giữ ràng buộc R1.3
     * ("phát hành lần hai phải bị từ chối") ở tầng adapter: kiểm bằng
     * `totalSupply > 0` thì một lần mint lẻ bất kỳ cũng khoá luôn việc phát hành.
     */
    async mintInitialSupply() {
      return pendingContract('mintInitialSupply', 'hợp đồng phát hành một lần (SC-02)');
    },

    async isInitialSupplyMinted() {
      return pendingContract('isInitialSupplyMinted', 'hợp đồng phát hành một lần (SC-02)');
    },

    /**
     * NỢ SC-02: địa chỉ ví thanh toán SPV do hợp đồng phát hành một lần giữ.
     *
     * KHÔNG lấy tạm địa chỉ ví ngân hàng đang ký làm ví SPV. Hai ví có thể trùng nhau
     * trong một lần dựng demo, nhưng chúng là hai vai khác nhau — ví ngân hàng ký giao
     * dịch, ví SPV giữ token chưa bán. Nối tạm thì phép kiểm "SPV còn đủ WPT" sẽ đo số
     * dư của ví SAI, và nó vẫn "chạy" nên không ai phát hiện tới lúc chạy thật.
     */
    async spvWallet() {
      return pendingContract('spvWallet', 'hợp đồng phát hành một lần (SC-02)');
    },

    // =========================================================================
    //  KHỚP LỆNH MUA
    // =========================================================================
    /** NỢ SC-03: giá bán một WPT nằm trong hợp đồng khớp lệnh, chưa có contract nào giữ. */
    async quotePurchase(wptAmount) {
      assertPositiveAmount(chain, 'quotePurchase', wptAmount);
      return pendingContract('quotePurchase', 'hợp đồng khớp lệnh (SC-03)');
    },

    /** Đọc được ngay: VNDToken đã deploy, địa chỉ có trong packages/shared. */
    async paymentBalanceOf(wallet) {
      return readOn<bigint>('paymentBalanceOf', 'VNDToken', vndTokenAbi, 'balanceOf', [
        normalizeEvmAddress(wallet),
      ]);
    },

    /**
     * NỢ SC-03. `VNDToken.allowance` đã có trong ABI, nhưng `spender` phải là địa
     * chỉ hợp đồng khớp lệnh — chưa tồn tại. Truyền một địa chỉ khác vào sẽ trả về
     * một con số có vẻ hợp lệ nhưng vô nghĩa, tệ hơn là báo lỗi.
     */
    async paymentAllowanceOf() {
      return pendingContract('paymentAllowanceOf', 'địa chỉ hợp đồng khớp lệnh (SC-03)');
    },

    async executePurchase(investor, wptAmount) {
      assertPositiveAmount(chain, 'executePurchase', wptAmount);
      return pendingContract('executePurchase', 'hợp đồng khớp lệnh (SC-03)');
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

    /**
     * NỢ SC-03/BE-06. `ProfitDistributor.distributeTo` nhận `distributionId`, KHÔNG
     * nhận `snapshotId`: một kỳ chia gắn với một snapshot VÀ một số tiền đã chốt.
     *
     * Muốn nối, phải có mapping snapshotId -> distributionId. Mapping đó là trạng
     * thái nghiệp vụ (đọc từ event `DistributionCreated` rồi lưu vào cơ sở dữ liệu),
     * không phải việc của adapter — dò bằng cách quét `distributions(i)` trong đây
     * là nhét logic nghiệp vụ vào tầng chuyển đổi, đúng thứ BE-01 cấm.
     */
    async distributeBatch() {
      return pendingContract(
        'distributeBatch',
        'quyết định mapping snapshotId -> distributionId ở BE-06',
      );
    },

    // =========================================================================
    //  TẤT TOÁN
    // =========================================================================
    /**
     * NỢ: chưa contract nào phơi ra cờ "đang tất toán" đúng nghĩa.
     * `ProjectToken.paused` chặn chuyển nhượng và vẫn cho `agentBurn` (khớp R6.3),
     * còn `Redemption.paused` thì NGƯỢC hướng. Chọn sai một trong hai sẽ ra hệ thống
     * chạy được nhưng làm ngược — cần Owner/Supervisor xác nhận trước khi nối.
     */
    async setSettlementMode() {
      return pendingContract('setSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
    },

    async isSettlementMode() {
      return pendingContract('isSettlementMode', 'xác nhận cờ tất toán nối vào contract nào');
    },

    async setNavRate(rate) {
      assertPositiveAmount(chain, 'setNavRate', rate);
      return pendingContract('setNavRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
    },

    async navRate() {
      return pendingContract('navRate', 'xác nhận giá NAV có phải Redemption.rate hay không');
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
  };
}
