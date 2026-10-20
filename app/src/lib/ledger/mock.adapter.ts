import 'server-only';

import { orderRefFromOrderId, type ChainKey } from '@bidv/shared';
import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { addressKey, normalizeEvmAddress } from './address';
import {
  MOCK_CLAIM_WINDOW_MS,
  memoryMockLedgerStateStore,
  type MockDistributionRecord,
  type MockLedgerState,
  type MockLedgerStateStore,
  type MockSnapshotRecord,
} from './mock-state.store';
import {
  LedgerError,
  assertPositiveAmount,
  type ChainDistribution,
  type ILedgerPort,
  type SnapshotResult,
  type TokenInfo,
  type TransferCheck,
  type TxResult,
} from './ledger.port';

/**
 * Ledger trong bộ nhớ — mint chạy KHÔNG cần chain. Dùng cho demo public/free-tier,
 * nơi không thể dựng hardhat node (docs/DEPLOYMENT.md).
 *
 * Adapter này CỐ Ý mô phỏng đúng các ràng buộc tuân thủ của `ProjectToken._update`
 * (chưa KYC / bị băng / paused) và của ba luồng mint/burn/distribute. Nếu mock dễ
 * tính hơn contract thật thì demo sẽ "chạy được ở mock, hỏng ở chain thật" — đúng
 * loại lỗi mock phải ngăn.
 *
 * Bảng ràng buộc bắt buộc: `docs/be-01-ledger-port/design.md` mục 3.
 */

const TOKEN: Omit<TokenInfo, 'totalSupply'> = {
  name: 'Wind Power Token (mock)',
  symbol: 'WPT',
  decimals: 0, // khớp contract thật
};

/** Giá mặc định vẫn suy ra từ nguồn duy nhất; state-store chỉ chịu trách nhiệm lưu nó. */
const DEFAULT_WPT_PRICE_VND = BigInt(WPT_ISSUE_PRICE_VND);
const MAX_UINT256 = (1n << 256n) - 1n;

/** Chỉ dùng cho test/demo runner: về trạng thái trắng. */
export function resetMockLedger(
  store: MockLedgerStateStore = memoryMockLedgerStateStore,
): void | Promise<void> {
  if (!store.resetForTest) throw new Error(`Kho mock ${store.kind} không hỗ trợ reset.`);
  return store.resetForTest();
}

/**
 * Nạp trạng thái ngoài phạm vi `ILedgerPort` — CHỈ cho test và demo runner.
 *
 * Vì sao cần: VNDB, mức ủy quyền, quỹ lợi nhuận và giá bán do các hệ thống khác
 * sinh ra (core banking phát hành VNDB, nhà đầu tư approve từ ví của họ, kế toán
 * chuyển tiền vào ví lợi nhuận). `ILedgerPort` chỉ ĐỌC những thứ đó — nó không có
 * method tạo ra chúng, và cũng không nên có. Ở chain thật, `VNDToken.mint` và
 * `approve` lo phần này.
 *
 * KHÔNG gọi hàm này từ nghiệp vụ. Nó không tồn tại ở `evm.adapter`.
 */
export interface MockLedgerSeed {
  /** Số dư VNDB theo ví. */
  paymentBalances?: Record<string, bigint>;
  /** Mức ủy quyền VNDB đã cấp cho hợp đồng khớp lệnh, theo ví. */
  paymentAllowances?: Record<string, bigint>;
  /** Số VNDB trong ví chia lợi nhuận. */
  profitPool?: bigint;
  /** Giá bán 1 WPT tính bằng VNDB. */
  wptPriceVnd?: bigint;
}

export function seedMockLedger(
  seed: MockLedgerSeed,
  store: MockLedgerStateStore = memoryMockLedgerStateStore,
): Promise<void> {
  return store.mutate((s) => {
    for (const [wallet, amount] of Object.entries(seed.paymentBalances ?? {})) {
      s.paymentBalances.set(addressKey(normalizeEvmAddress(wallet)), amount);
    }
    for (const [wallet, amount] of Object.entries(seed.paymentAllowances ?? {})) {
      s.paymentAllowances.set(addressKey(normalizeEvmAddress(wallet)), amount);
    }
    if (seed.profitPool !== undefined) s.profitPool = seed.profitPool;
    if (seed.wptPriceVnd !== undefined) {
      s.wptPriceVnd = seed.wptPriceVnd;
      s.priceHydrated = true;
    }
  });
}

function fakeTxHash(s: MockLedgerState): string {
  s.nonce += 1;
  // Dạng 0x + 64 hex để UI/validation coi như tx hash thật.
  return `0x${s.nonce.toString(16).padStart(64, '0')}`;
}

/**
 * Tuỳ chọn dựng ledger mô phỏng.
 *
 * `readInitialPrice` là cách FACTORY `getLedger` nạp giá đã cấu hình vào mock mà mock KHÔNG
 * phải nhập `lib/store`. Adapter chỉ biết "có một hàm trả về giá"; ai cấp hàm đó, và nó đọc
 * bảng nào, là việc của factory.
 *
 * Vì sao là HÀM chứ không phải một `bigint`: `createMockLedger` là hàm đồng bộ và được gọi ở
 * mọi chỗ dùng `getLedger()`, còn đọc cơ sở dữ liệu thì bất đồng bộ. Nhận hàm rồi gọi nó LẦN
 * ĐẦU CẦN GIÁ giữ được `getLedger` đồng bộ, nên không lời gọi nào hiện tại phải sửa.
 */
export interface MockLedgerOptions {
  readInitialPrice?: () => Promise<bigint>;
  stateStore?: MockLedgerStateStore;
}

export function createMockLedger(
  chain: ChainKey = 'mock',
  options: MockLedgerOptions = {},
): ILedgerPort {
  const store = options.stateStore ?? memoryMockLedgerStateStore;
  const confirmed = (s: MockLedgerState): TxResult => ({ txHash: fakeTxHash(s), status: 'CONFIRMED' });

  /**
   * Kiểu ghi trên BIẾN, không phải trên hàm mũi nhọn.
   *
   * TypeScript chỉ coi một hàm là "không bao giờ trả về" (để thu hẹp kiểu sau lời gọi)
   * khi khai báo biến có annotation tường minh. Viết `const reject = (...): never =>`
   * thì sau `if (!record) reject(...)` biến `record` vẫn còn `| undefined`.
   */
  const reject: (operation: string, message: string) => never = (operation, message) => {
    // Mock từ chối theo đúng luật hợp đồng, nên tương đương một lần revert: chắc chắn không ghi.
    throw new LedgerError(chain, operation, message, { reverted: true });
  };

  const storeFailure = (operation: string, error: unknown): never => {
    if (error instanceof LedgerError) throw error;
    throw new LedgerError(
      chain,
      operation,
      `Không đọc/ghi được trạng thái chain mock từ kho ${store.kind}.`,
      { cause: error },
    );
  };

  const read = async <T>(
    operation: string,
    fn: (state: Readonly<MockLedgerState>) => T,
  ): Promise<T> => {
    try {
      return await store.read(fn);
    } catch (error) {
      return storeFailure(operation, error);
    }
  };

  const mutate = async <T>(
    operation: string,
    fn: (state: MockLedgerState) => T,
  ): Promise<T> => {
    try {
      return await store.mutate(fn);
    } catch (error) {
      return storeFailure(operation, error);
    }
  };

  const requireWhitelisted = (
    s: Readonly<MockLedgerState>,
    operation: string,
    wallet: string,
    label: string,
  ): void => {
    if (!s.whitelisted.has(addressKey(wallet))) {
      reject(operation, `${label} chưa KYC/whitelist: ${wallet}`);
    }
  };

  const requireNotFrozen = (
    s: Readonly<MockLedgerState>,
    operation: string,
    wallet: string,
    label: string,
  ): void => {
    if (s.frozen.has(addressKey(wallet))) {
      reject(operation, `${label} đang bị đóng băng: ${wallet}`);
    }
  };

  /**
   * Giai đoạn tất toán chặn MỌI chuyển nhượng thông thường (BE-01 R6.3).
   *
   * Cố ý KHÔNG chặn `burn`: đốt token là chính việc phải làm khi tất toán.
   * Cũng KHÔNG chặn `forcedTransfer`: clawback là cơ chế ngoại lệ mà ngân hàng cần
   * đúng vào lúc xử lý sự vụ, chặn nó lại là tự bịt đường thoát.
   */
  const requireNotSettling = (s: Readonly<MockLedgerState>, operation: string): void => {
    if (s.settlementMode) {
      reject(operation, 'Đang trong giai đoạn tất toán: chuyển nhượng thông thường bị tạm dừng.');
    }
  };

  const balance = (s: Readonly<MockLedgerState>, wallet: string): bigint =>
    s.balances.get(addressKey(wallet)) ?? 0n;

  const setBalance = (s: MockLedgerState, wallet: string, value: bigint): void => {
    s.balances.set(addressKey(wallet), value);
  };

  const paymentBalance = (s: Readonly<MockLedgerState>, wallet: string): bigint =>
    s.paymentBalances.get(addressKey(wallet)) ?? 0n;

  const setPaymentBalance = (s: MockLedgerState, wallet: string, value: bigint): void => {
    s.paymentBalances.set(addressKey(wallet), value);
  };

  const allowance = (s: Readonly<MockLedgerState>, wallet: string): bigint =>
    s.paymentAllowances.get(addressKey(wallet)) ?? 0n;

  /**
   * Giá bán một WPT đang có hiệu lực, nạp từ cấu hình ở LẦN ĐẦU cần tới.
   *
   * Nạp MỘT LẦN cho mỗi vòng đời state, không đọc lại mỗi lần gọi. Đọc lại mỗi lần sẽ biến cơ
   * sở dữ liệu thành nguồn giá thứ hai bên cạnh `state().wptPriceVnd`, và khi đó `setPurchasePrice`
   * mất tác dụng — đúng thứ mà `lib/bank/config.service.ts` dựa vào để bảo đảm "đẩy xuống ledger
   * thành công mới ghi cơ sở dữ liệu".
   *
   * ĐÂY KHÔNG PHẢI ĐỆM XUYÊN YÊU CẦU theo nghĩa bị cấm: mọi lần đổi giá đều đi qua
   * `setPurchasePrice`, tức là cập nhật chính ô state này ngay lập tức. Lần nạp ở đây chỉ bù
   * đúng một tình huống: tiến trình vừa khởi động lại nên state mất, còn cơ sở dữ liệu vẫn giữ
   * giá đã đặt.
   *
   * Lỗi khi đọc cấu hình KHÔNG bị chặn lại: giá là con số ra tiền, nên thà để lời gọi thất bại
   * với lý do rõ còn hơn âm thầm bán theo giá mặc định.
   */
  const configuredPrice = async (): Promise<bigint | undefined> => {
    if (!options.readInitialPrice) return DEFAULT_WPT_PRICE_VND;
    const configured = await options.readInitialPrice();
    assertPositiveAmount(chain, 'readInitialPrice', configured);
    return configured;
  };

  const hydratePrice = (s: MockLedgerState, configured: bigint | undefined): bigint => {
    if (!s.priceHydrated && configured !== undefined) {
      s.wptPriceVnd = configured;
      s.priceHydrated = true;
    }
    return s.wptPriceVnd;
  };

  /**
   * Lấy ảnh chụp theo mã, từ chối với lý do rõ nếu mã không tồn tại.
   * Khớp hai `require` của `ERC20Snapshotable._valueAt` ("id la 0", "id chua ton tai").
   */
  const requireSnapshot = (
    s: Readonly<MockLedgerState>,
    operation: string,
    snapshotId: number,
  ): MockSnapshotRecord => {
    if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
      reject(
        operation,
        `Mã snapshot phải là số nguyên dương, nhận được ${snapshotId}. ` +
          `Mã snapshot lấy từ kết quả takeSnapshot().`,
      );
    }
    const record = s.snapshots.get(snapshotId);
    if (!record) {
      reject(
        operation,
        `Mã snapshot ${snapshotId} không tồn tại. ` +
          (s.lastSnapshotId === 0
            ? 'Chưa chốt quyền lần nào — gọi takeSnapshot() trước.'
            : `Mã hợp lệ hiện có: 1..${s.lastSnapshotId}.`),
      );
    }
    return record;
  };

  /** Mock không có địa chỉ hợp đồng; nhãn cố định theo chain để kỳ vẫn gắn được với "hợp đồng". */
  const distributorLabel = `${chain}:ProfitDistributor`;

  const unallocated = (s: Readonly<MockLedgerState>): bigint =>
    s.profitPool > s.distributionLedger.totalReserved
      ? s.profitPool - s.distributionLedger.totalReserved
      : 0n;

  /** Lấy kỳ chia theo mã, từ chối như `require(id < distributions.length, "ky khong ton tai")`. */
  const requireDistribution = (
    s: Readonly<MockLedgerState>,
    operation: string,
    distributionId: number,
  ): MockDistributionRecord => {
    const found = Number.isSafeInteger(distributionId)
      ? s.distributionLedger.distributions.get(distributionId)
      : undefined;
    if (!found) reject(operation, `Kỳ chia ${distributionId} không tồn tại.`);
    return found;
  };

  const toChainDistribution = (
    distributionId: number,
    record: MockDistributionRecord,
  ): ChainDistribution => ({
    distributor: distributorLabel,
    distributionId,
    snapshotId: record.snapshotId,
    amount: record.amount,
    claimed: record.claimed,
    totalSupplyAt: record.totalSupplyAt,
    claimDeadline: new Date(record.claimDeadline),
    expired: Date.now() >= record.claimDeadline,
    closed: record.closed,
  });

  return {
    chain,

    // =========================================================================
    //  TUÂN THỦ
    // =========================================================================
    async whitelist(wallet) {
      const normalized = normalizeEvmAddress(wallet);
      return mutate('whitelist', (s) => {
        s.whitelisted.add(addressKey(normalized));
        return confirmed(s);
      });
    },

    async isWhitelisted(wallet) {
      const normalized = normalizeEvmAddress(wallet);
      return read('isWhitelisted', (s) => s.whitelisted.has(addressKey(normalized)));
    },

    async freeze(wallet, frozen) {
      const key = addressKey(normalizeEvmAddress(wallet));
      return mutate('freeze', (s) => {
        if (frozen) s.frozen.add(key);
        else s.frozen.delete(key);
        return confirmed(s);
      });
    },

    async isFrozen(wallet) {
      const normalized = normalizeEvmAddress(wallet);
      return read('isFrozen', (s) => s.frozen.has(addressKey(normalized)));
    },

    /**
     * Kiểm TRƯỚC, không đổi trạng thái. Thứ tự kiểm giống `transfer` để lý do trả về
     * đúng là lý do mà `transfer` sẽ từ chối — lệch thứ tự thì giao diện báo một lỗi
     * còn giao dịch chết vì lỗi khác.
     */
    async canTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'canTransfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);
      const deny = (reason: string): TransferCheck => ({ allowed: false, reason });
      return read('canTransfer', (s) => {
        if (s.settlementMode) {
          return deny('Đang trong giai đoạn tất toán: chuyển nhượng thông thường bị tạm dừng.');
        }
        if (s.frozen.has(addressKey(sender))) return deny(`Bên gửi đang bị đóng băng: ${sender}`);
        if (s.frozen.has(addressKey(receiver))) return deny(`Bên nhận đang bị đóng băng: ${receiver}`);
        if (!s.whitelisted.has(addressKey(sender))) return deny(`Bên gửi chưa KYC/whitelist: ${sender}`);
        if (!s.whitelisted.has(addressKey(receiver))) return deny(`Bên nhận chưa KYC/whitelist: ${receiver}`);
        if (balance(s, sender) < amount) {
          return deny(`Số dư WPT không đủ: cần ${amount}, ví ${sender} chỉ có ${balance(s, sender)}.`);
        }
        return { allowed: true };
      });
    },

    // =========================================================================
    //  PHÁT HÀNH / THU HỒI
    // =========================================================================
    async mint(to, amount) {
      assertPositiveAmount(chain, 'mint', amount);
      const receiver = normalizeEvmAddress(to);
      return mutate('mint', (s) => {
        requireWhitelisted(s, 'mint', receiver, 'Bên nhận');
        requireNotFrozen(s, 'mint', receiver, 'Bên nhận');
        setBalance(s, receiver, balance(s, receiver) + amount);
        s.totalSupply += amount;
        return confirmed(s);
      });
    },

    async burn(from, amount) {
      // KHÔNG kiểm settlementMode: đốt phải chạy được khi tất toán (R6.3).
      assertPositiveAmount(chain, 'burn', amount);
      const holder = normalizeEvmAddress(from);
      return mutate('burn', (s) => {
        if (balance(s, holder) < amount) reject('burn', `Số dư không đủ để đốt: ${holder}`);
        setBalance(s, holder, balance(s, holder) - amount);
        s.totalSupply -= amount;
        return confirmed(s);
      });
    },

    async transfer(from, to, amount) {
      assertPositiveAmount(chain, 'transfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);
      return mutate('transfer', (s) => {
        requireNotSettling(s, 'transfer');
        requireNotFrozen(s, 'transfer', sender, 'Bên gửi');
        requireNotFrozen(s, 'transfer', receiver, 'Bên nhận');
        requireWhitelisted(s, 'transfer', sender, 'Bên gửi');
        requireWhitelisted(s, 'transfer', receiver, 'Bên nhận');
        if (balance(s, sender) < amount) reject('transfer', `Số dư không đủ: ${sender}`);
        setBalance(s, sender, balance(s, sender) - amount);
        setBalance(s, receiver, balance(s, receiver) + amount);
        return confirmed(s);
      });
    },

    async forcedTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'forcedTransfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);
      return mutate('forcedTransfer', (s) => {
        requireWhitelisted(s, 'forcedTransfer', receiver, 'Bên nhận (clawback)');
        if (balance(s, sender) < amount) reject('forcedTransfer', `Số dư không đủ: ${sender}`);
        setBalance(s, sender, balance(s, sender) - amount);
        setBalance(s, receiver, balance(s, receiver) + amount);
        return confirmed(s);
      });
    },

    /**
     * Phát hành toàn bộ nguồn cung MỘT LẦN vào ví thanh toán SPV.
     * Gọi lần hai bị từ chối (R1.3) — đây là ràng buộc quan trọng nhất của luồng
     * phát hành: nguồn cung phình thêm sau khi công bố là lỗi không sửa được.
     */
    async mintInitialSupply(to, amount) {
      assertPositiveAmount(chain, 'mintInitialSupply', amount);
      const receiver = normalizeEvmAddress(to);
      return mutate('mintInitialSupply', (s) => {
        if (s.initialSupplyMinted) {
          reject(
            'mintInitialSupply',
            `Nguồn cung ban đầu đã được phát hành vào ví ${s.spvWallet ?? '(không rõ)'}. ` +
              `Không phát hành lần hai. Muốn thêm nguồn cung thì phải qua quy trình tăng vốn riêng.`,
          );
        }
        requireWhitelisted(s, 'mintInitialSupply', receiver, 'Ví thanh toán SPV');
        requireNotFrozen(s, 'mintInitialSupply', receiver, 'Ví thanh toán SPV');
        setBalance(s, receiver, balance(s, receiver) + amount);
        s.totalSupply += amount;
        s.initialSupplyMinted = true;
        s.spvWallet = receiver;
        return confirmed(s);
      });
    },

    async isInitialSupplyMinted() {
      return read('isInitialSupplyMinted', (s) => s.initialSupplyMinted);
    },

    async spvWallet() {
      // `?? null` chứ không trả `undefined`: `null` là "chưa phát hành", một câu trả
      // lời có nghĩa; `undefined` trông như lỗi lập trình và JSON hoá thì mất luôn field.
      return read('spvWallet', (s) => s.spvWallet ?? null);
    },

    // =========================================================================
    //  KHỚP LỆNH MUA / BÁN
    // =========================================================================
    async quotePurchase(wptAmount) {
      assertPositiveAmount(chain, 'quotePurchase', wptAmount);
      const configured = await configuredPrice();
      return mutate('quotePurchase', (s) => wptAmount * hydratePrice(s, configured));
    },

    /**
     * Đặt giá bán một WPT. Đây là thứ `quotePurchase` và `executePurchase` cùng đọc, nên
     * đổi ở đây là đổi CẢ giá báo và giá trừ tiền — đúng một con số, không có cách nào lệch.
     *
     * `assertPositiveAmount` chạy TRƯỚC khi gán: giá 0 hoặc âm bị chặn khi state chưa đổi,
     * nên một lời gọi sai không để lại "mua không mất tiền".
     *
     * KHÔNG chặn theo ngưỡng đổi giá ở đây. Ngưỡng là quy tắc NGHIỆP VỤ và nó cần biết giá
     * cũ trong cơ sở dữ liệu cùng lời xác nhận của người dùng — adapter không có hai thứ đó.
     * `lib/bank/config.service.ts` kiểm ngưỡng trước khi gọi xuống.
     */
    async setPurchasePrice(pricePerWpt) {
      assertPositiveAmount(chain, 'setPurchasePrice', pricePerWpt);
      return mutate('setPurchasePrice', (s) => {
        s.wptPriceVnd = pricePerWpt;
        s.priceHydrated = true;
        return confirmed(s);
      });
    },

    async paymentBalanceOf(wallet) {
      const normalized = normalizeEvmAddress(wallet);
      return read('paymentBalanceOf', (s) => paymentBalance(s, normalized));
    },

    async paymentAllowanceOf(owner) {
      const normalized = normalizeEvmAddress(owner);
      return read('paymentAllowanceOf', (s) => allowance(s, normalized));
    },

    async wptAllowanceOf() {
      // Mock không mô phỏng ủy quyền WPT; chain EVM mới là nơi approve/permit được thực thi.
      return MAX_UINT256;
    },

    async latestBlockTimestamp() {
      // Mock không có block: giờ máy chủ là đồng hồ của nó (FE-05 CH-2).
      return BigInt(Math.floor(Date.now() / 1000));
    },

    /**
     * Mock không có chữ ký permit (FE-05 QĐ-A): đặt lệnh trên mock không hỏi ký. Hai hàm này chỉ
     * tồn tại để mock đủ cổng; tầng nghiệp vụ chặn mock trước khi tới đây.
     */
    async permitDomain() {
      return reject('permitDomain', 'Chain mock không dùng chữ ký permit; đặt lệnh trên mock không cần ký.');
    },

    async permitNonce() {
      return reject('permitNonce', 'Chain mock không dùng chữ ký permit; đặt lệnh trên mock không cần ký.');
    },

    async findOrderSettlement(orderId) {
      orderRefFromOrderId(orderId);
      return read('findOrderSettlement', (s) => {
        const txHash = s.settledOrders.get(orderId.toLowerCase());
        return txHash
          ? { status: 'SETTLED' as const, txHash, blockNumber: 0n }
          : { status: 'NOT_SETTLED' as const };
      });
    },

    /**
     * Như `VNDToken.mint`: cộng số dư, KHÔNG kiểm KYC / đóng băng (contract không kiểm). Vai
     * `MINTER_ROLE` không mô phỏng được vì mock không có người ký.
     *
     * ⚠️ LỆCH CONTRACT CÓ CHỦ Ý (Owner chốt ở BE-16): cộng luôn MỨC ỦY QUYỀN cho hợp đồng khớp lệnh
     * bằng đúng số vừa nạp. `VNDToken.mint` không làm việc này; trên chuỗi thật nhà đầu tư tự
     * `approve` bằng ví của mình. Mock không có đường nào để nhà đầu tư approve, nên không cộng thì
     * sau khi nạp lệnh mua vẫn chết ở phép kiểm ủy quyền. Gỡ khi có đường approve thật (SC-03).
     */
    async mintPayment(to, amount) {
      assertPositiveAmount(chain, 'mintPayment', amount);
      const receiver = normalizeEvmAddress(to);
      return mutate('mintPayment', (s) => {
        setPaymentBalance(s, receiver, paymentBalance(s, receiver) + amount);
        s.paymentAllowances.set(addressKey(receiver), allowance(s, receiver) + amount);
        return confirmed(s);
      });
    },

    /**
     * Khớp lệnh nguyên tử: VNDB nhà đầu tư -> ví SPV, WPT ví SPV -> nhà đầu tư.
     *
     * MỌI kiểm tra chạy TRƯỚC mọi thay đổi trạng thái. Đó là cách duy nhất giữ
     * đúng R2.5 "không để lại trạng thái nửa vời" trong một hàm không có transaction:
     * nếu trừ VNDB rồi mới phát hiện SPV thiếu WPT thì tiền đã bay mà token chưa về.
     */
    async executePurchase(order) {
      const orderId = order.orderId.toLowerCase();
      orderRefFromOrderId(orderId);
      if (await read('executePurchase', (s) => s.settledOrders.has(orderId))) {
        reject('executePurchase', `Mã lệnh ${order.orderId} đã được quyết toán.`);
      }
      const configured = await configuredPrice();
      return mutate('executePurchase', (s) => {
        if (s.settledOrders.has(orderId)) reject('executePurchase', `Mã lệnh ${order.orderId} đã được quyết toán.`);
        assertPositiveAmount(chain, 'executePurchase', order.wptAmount);
        const buyer = normalizeEvmAddress(order.investor);
        requireNotSettling(s, 'executePurchase');
        const price = hydratePrice(s, configured);
        if (!s.initialSupplyMinted || !s.spvWallet) {
          reject('executePurchase', 'Chưa phát hành nguồn cung ban đầu — không có WPT nào để bán. Gọi mintInitialSupply trước.');
        }
        const spv = s.spvWallet;
        requireNotFrozen(s, 'executePurchase', buyer, 'Nhà đầu tư');
        requireNotFrozen(s, 'executePurchase', spv, 'Ví thanh toán SPV');
        requireWhitelisted(s, 'executePurchase', buyer, 'Nhà đầu tư');
        requireWhitelisted(s, 'executePurchase', spv, 'Ví thanh toán SPV');
        const cost = order.wptAmount * price;
        if (order.vndAmount !== cost) {
          reject('executePurchase', `Thành tiền lệnh ${order.vndAmount} VNDB không khớp giá hiện tại ${cost} VNDB.`);
        }
        if (paymentBalance(s, buyer) < cost) {
          reject('executePurchase', `Số dư VNDB không đủ: cần ${cost}, ví ${buyer} chỉ có ${paymentBalance(s, buyer)}.`);
        }
        if (allowance(s, buyer) < cost) {
          reject('executePurchase', `Ủy quyền VNDB không đủ: cần ${cost}, đã cấp ${allowance(s, buyer)}. Nhà đầu tư phải approve cho hợp đồng khớp lệnh trước.`);
        }
        if (balance(s, spv) < order.wptAmount) {
          reject('executePurchase', `Ví thanh toán SPV không đủ WPT: cần ${order.wptAmount}, chỉ còn ${balance(s, spv)}.`);
        }
        setPaymentBalance(s, buyer, paymentBalance(s, buyer) - cost);
        setPaymentBalance(s, spv, paymentBalance(s, spv) + cost);
        s.paymentAllowances.set(addressKey(buyer), allowance(s, buyer) - cost);
        setBalance(s, spv, balance(s, spv) - order.wptAmount);
        setBalance(s, buyer, balance(s, buyer) + order.wptAmount);
        const tx = confirmed(s);
        s.settledOrders.set(orderId, tx.txHash);
        return tx;
      });
    },

    /**
     * Khớp lệnh BÁN nguyên tử (BE-14): WPT nhà đầu tư -> ví SPV, VNDB ví SPV -> nhà đầu tư.
     *
     * Cùng kỷ luật với `executePurchase`: MỌI kiểm tra chạy TRƯỚC mọi thay đổi trạng thái, nên
     * ví SPV thiếu VNDB thì token của nhà đầu tư chưa hề rời ví. Cùng nguồn giá với
     * `quotePurchase`, nên số VNDB đã báo lúc đặt lệnh và số thật sự trả là một.
     *
     * Mock không mô phỏng thao tác approve WPT nên `wptAllowanceOf` trả mức tối đa. Phép kiểm
     * vẫn chạy ở service để cùng luồng với EVM, nơi allowance thật được đọc từ ProjectToken.
     */
    async executeSale(order) {
      const orderId = order.orderId.toLowerCase();
      orderRefFromOrderId(orderId);
      if (await read('executeSale', (s) => s.settledOrders.has(orderId))) {
        reject('executeSale', `Mã lệnh ${order.orderId} đã được quyết toán.`);
      }
      const configured = await configuredPrice();
      return mutate('executeSale', (s) => {
        if (s.settledOrders.has(orderId)) reject('executeSale', `Mã lệnh ${order.orderId} đã được quyết toán.`);
        assertPositiveAmount(chain, 'executeSale', order.wptAmount);
        const seller = normalizeEvmAddress(order.investor);
        requireNotSettling(s, 'executeSale');
        const price = hydratePrice(s, configured);
        if (!s.initialSupplyMinted || !s.spvWallet) {
          reject('executeSale', 'Chưa phát hành nguồn cung ban đầu — chưa có ví thanh toán người bán để nhận lại WPT.');
        }
        const spv = s.spvWallet;
        requireNotFrozen(s, 'executeSale', seller, 'Nhà đầu tư');
        requireNotFrozen(s, 'executeSale', spv, 'Ví thanh toán SPV');
        requireWhitelisted(s, 'executeSale', seller, 'Nhà đầu tư');
        requireWhitelisted(s, 'executeSale', spv, 'Ví thanh toán SPV');
        const proceeds = order.wptAmount * price;
        if (order.vndAmount !== proceeds) {
          reject('executeSale', `Thành tiền lệnh ${order.vndAmount} VNDB không khớp giá hiện tại ${proceeds} VNDB.`);
        }
        if (balance(s, seller) < order.wptAmount) {
          reject('executeSale', `Số dư WPT không đủ: cần ${order.wptAmount}, ví ${seller} chỉ có ${balance(s, seller)}.`);
        }
        if (paymentBalance(s, spv) < proceeds) {
          reject('executeSale', `Ví thanh toán SPV không đủ VNDB: cần ${proceeds}, chỉ còn ${paymentBalance(s, spv)}.`);
        }
        setBalance(s, seller, balance(s, seller) - order.wptAmount);
        setBalance(s, spv, balance(s, spv) + order.wptAmount);
        setPaymentBalance(s, spv, paymentBalance(s, spv) - proceeds);
        setPaymentBalance(s, seller, paymentBalance(s, seller) + proceeds);
        const tx = confirmed(s);
        s.settledOrders.set(orderId, tx.txHash);
        return tx;
      });
    },

    // =========================================================================
    //  CHỐT QUYỀN
    // =========================================================================
    async takeSnapshot(): Promise<SnapshotResult> {
      return mutate('takeSnapshot', (s) => {
        s.lastSnapshotId += 1;
        s.snapshots.set(s.lastSnapshotId, {
          balances: new Map(s.balances),
          totalSupply: s.totalSupply,
        });
        return { tx: confirmed(s), snapshotId: s.lastSnapshotId };
      });
    },

    async balanceOfAt(wallet, snapshotId) {
      const normalized = normalizeEvmAddress(wallet);
      return read('balanceOfAt', (s) =>
        requireSnapshot(s, 'balanceOfAt', snapshotId).balances.get(addressKey(normalized)) ?? 0n,
      );
    },

    async totalSupplyAt(snapshotId) {
      return read('totalSupplyAt', (s) => requireSnapshot(s, 'totalSupplyAt', snapshotId).totalSupply);
    },

    // =========================================================================
    //  CHIA LỢI NHUẬN
    // =========================================================================
    async profitPoolBalance() {
      return read('profitPoolBalance', (s) => s.profitPool);
    },

    async unallocatedProfit() {
      return read('unallocatedProfit', (s) => unallocated(s));
    },

    async reservedProfit() {
      return read('reservedProfit', (s) => s.distributionLedger.totalReserved);
    },

    /**
     * Ngang hàng `createDistributionFromPool` (SC-06 QĐ-B): nhãn dùng một lần, kỳ lấy ĐÚNG phần
     * chưa phân bổ. Trước SC-06 mock lấy toàn bộ quỹ, kể cả phần kỳ trước còn nợ (tính trùng).
     */
    async openDistribution(periodKey) {
      return mutate('openDistribution', (s) => {
        const ledger = s.distributionLedger;
        if (periodKey.length === 0) reject('openDistribution', 'Mã kỳ chia không được để trống.');
        if (ledger.byPeriod.has(periodKey)) {
          reject('openDistribution', `Mã kỳ chia "${periodKey}" đã dùng; mỗi mã chỉ tạo được một kỳ.`);
        }
        const amount = unallocated(s);
        if (amount === 0n) {
          reject('openDistribution', 'Quỹ chia lợi nhuận không có phần chưa phân bổ nào để mở kỳ.');
        }
        if (s.totalSupply === 0n) {
          reject('openDistribution', 'Tổng cung WPT tại thời điểm chốt bằng 0: không có quyền để chia.');
        }
        s.lastSnapshotId += 1;
        s.snapshots.set(s.lastSnapshotId, { balances: new Map(s.balances), totalSupply: s.totalSupply });
        const id = ledger.nextDistributionId;
        ledger.nextDistributionId += 1;
        ledger.distributions.set(id, {
          snapshotId: s.lastSnapshotId,
          period: periodKey,
          amount,
          claimed: 0n,
          totalSupplyAt: s.totalSupply,
          claimDeadline: Date.now() + MOCK_CLAIM_WINDOW_MS,
          closed: false,
          paid: new Set(),
        });
        ledger.byPeriod.set(periodKey, id);
        ledger.totalReserved += amount;
        return confirmed(s);
      });
    },

    async findDistribution(periodKey) {
      return read('findDistribution', (s) => {
        const id = s.distributionLedger.byPeriod.get(periodKey);
        if (id === undefined) return null;
        return toChainDistribution(id, requireDistribution(s, 'findDistribution', id));
      });
    },

    async distributionState(distributionId) {
      return read('distributionState', (s) =>
        toChainDistribution(distributionId, requireDistribution(s, 'distributionState', distributionId)),
      );
    },

    /**
     * Chia cho MỘT lô ví của kỳ `distributionId`. Adapter KHÔNG tự chia lô (R5.3).
     *
     * Phần mỗi ví = amount * balanceOfAt / totalSupplyAt, chia lấy phần nguyên giống contract;
     * phần lẻ ở lại dự trữ của kỳ đến khi đóng kỳ rồi về quỹ chưa phân bổ.
     */
    async distributeBatch(distributionId, wallets) {
      return mutate('distributeBatch', (s) => {
        const record = requireDistribution(s, 'distributeBatch', distributionId);
        if (record.closed) reject('distributeBatch', `Kỳ chia ${distributionId} đã đóng.`);
        if (Date.now() >= record.claimDeadline) {
          reject('distributeBatch', `Kỳ chia ${distributionId} đã hết thời hạn nhận.`);
        }
        if (wallets.length === 0) reject('distributeBatch', 'Danh sách ví trống — tầng nghiệp vụ phải truyền vào ít nhất một ví.');
        const snapshot = requireSnapshot(s, 'distributeBatch', record.snapshotId);
        const payouts = new Map<string, bigint>();
        for (const wallet of wallets) {
          const key = addressKey(normalizeEvmAddress(wallet));
          if (record.paid.has(key) || payouts.has(key)) continue;
          const held = snapshot.balances.get(key) ?? 0n;
          payouts.set(key, (record.amount * held) / record.totalSupplyAt);
        }
        const total = [...payouts.values()].reduce((sum, amount) => sum + amount, 0n);
        if (record.claimed + total > record.amount) {
          reject('distributeBatch', `Lô chia vượt phần còn lại của kỳ ${distributionId}.`);
        }
        if (s.profitPool < total) {
          reject('distributeBatch', `Ví chia lợi nhuận không đủ tiền: cần ${total} VNDB cho lô này, chỉ có ${s.profitPool}. Nạp thêm quỹ hoặc giảm kích thước lô.`);
        }
        for (const [key, amount] of payouts) {
          record.paid.add(key);
          if (amount > 0n) setPaymentBalance(s, key, paymentBalance(s, key) + amount);
        }
        record.claimed += total;
        s.distributionLedger.totalReserved -= total;
        s.profitPool -= total;
        return confirmed(s);
      });
    },

    async isDistributionPaid(distributionId, wallet) {
      const key = addressKey(normalizeEvmAddress(wallet));
      return read('isDistributionPaid', (s) =>
        requireDistribution(s, 'isDistributionPaid', distributionId).paid.has(key),
      );
    },

    /** Ngang hàng `closeDistribution`: chỉ sau hạn nhận, không chuyển tiền, trả phần còn lại về quỹ. */
    async closeDistribution(distributionId) {
      return mutate('closeDistribution', (s) => {
        const record = requireDistribution(s, 'closeDistribution', distributionId);
        if (record.closed) reject('closeDistribution', `Kỳ chia ${distributionId} đã đóng.`);
        if (Date.now() < record.claimDeadline) {
          reject('closeDistribution', 'Chưa hết thời hạn nhận lợi nhuận của kỳ này.');
        }
        record.closed = true;
        s.distributionLedger.totalReserved -= record.amount - record.claimed;
        return confirmed(s);
      });
    },

    // =========================================================================
    //  TẤT TOÁN
    // =========================================================================
    async setSettlementMode(enabled) {
      return mutate('setSettlementMode', (s) => {
        s.settlementMode = enabled;
        return confirmed(s);
      });
    },

    async isSettlementMode() {
      return read('isSettlementMode', (s) => s.settlementMode);
    },

    async setNavRate(rate) {
      assertPositiveAmount(chain, 'setNavRate', rate);
      return mutate('setNavRate', (s) => {
        s.navRate = rate;
        return confirmed(s);
      });
    },

    async navRate() {
      return read('navRate', (s) => s.navRate);
    },

    async vaultStatus() {
      return null;
    },

    async vaultPeriodCloses() {
      return [];
    },

    // SC-06 QĐ-G: chain mock không có vault thanh toán nên không có kỳ vault để chốt.
    async closeVaultPeriod() {
      return reject('closeVaultPeriod', 'Chain mock không có vault thanh toán SPV; không áp dụng.');
    },

    async findVaultPeriodClose() {
      return null;
    },

    // =========================================================================
    //  ĐỌC / GIAO DỊCH
    // =========================================================================
    async balanceOf(wallet) {
      const normalized = normalizeEvmAddress(wallet);
      return read('balanceOf', (s) => balance(s, normalized));
    },

    async tokenInfo() {
      return read('tokenInfo', (s) => ({ ...TOKEN, totalSupply: s.totalSupply }));
    },

    async waitReceipt(txHash) {
      return read('waitReceipt', () => ({ txHash, status: 'CONFIRMED' as const }));
    },
  };
}
