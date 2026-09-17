import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { addressKey, normalizeEvmAddress } from './address';
import {
  LedgerError,
  assertPositiveAmount,
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

/** Ảnh chụp bất biến tại một lần chốt quyền. */
interface SnapshotRecord {
  /** Số dư WPT của từng ví tại thời điểm chốt (bản COPY, không tham chiếu). */
  balances: Map<string, bigint>;
  totalSupply: bigint;
  /**
   * Quỹ VNDB dùng để chia cho kỳ này = số dư ví lợi nhuận TẠI thời điểm chốt.
   *
   * Cố định tại đây, không đọc lại lúc chia: nếu lấy số dư hiện thời làm tử số thì
   * lô thứ hai sẽ tính ra phần nhỏ hơn lô thứ nhất (vì lô một đã rút quỹ ra) — cùng
   * một quyền lại nhận khác nhau. Contract thật cũng chốt `amount` một lần trong
   * `ProfitDistributor.createDistribution`.
   */
  distributable: bigint;
  /** Ví đã nhận của kỳ này — tương đương `hasClaimed` của contract, chống chia hai lần. */
  paid: Set<string>;
}

interface MockState {
  balances: Map<string, bigint>;
  whitelisted: Set<string>;
  frozen: Set<string>;
  totalSupply: bigint;
  nonce: number;

  // --- Phát hành một lần ---
  initialSupplyMinted: boolean;
  /** Ví thanh toán SPV: giữ WPT chưa bán, nhận VNDB khi khớp lệnh. */
  spvWallet?: string;

  // --- Khớp lệnh mua ---
  /** Giá bán 1 WPT tính bằng VNDB. VNDB quy đổi 1:1 với VND nên KHÔNG có tỷ giá. */
  wptPriceVnd: bigint;
  /** Số dư token thanh toán VNDB. */
  paymentBalances: Map<string, bigint>;
  /** owner -> mức ủy quyền VNDB đã cấp cho hợp đồng khớp lệnh. */
  paymentAllowances: Map<string, bigint>;

  // --- Chốt quyền ---
  snapshots: Map<number, SnapshotRecord>;
  /** Mã snapshot gần nhất; 0 = chưa chốt lần nào (giống `getCurrentSnapshotId`). */
  lastSnapshotId: number;

  // --- Chia lợi nhuận ---
  /** Số VNDB đang có trong ví chia lợi nhuận. */
  profitPool: bigint;

  // --- Tất toán ---
  settlementMode: boolean;
  navRate: bigint;
}

const TOKEN: Omit<TokenInfo, 'totalSupply'> = {
  name: 'Wind Power Token (mock)',
  symbol: 'WPT',
  decimals: 0, // khớp contract thật
};

/**
 * Giá bán mặc định 1 WPT = 100.000 VNDB.
 *
 * KHÔNG để 0: giá 0 làm `quotePurchase` trả 0 và khớp lệnh thành "mua không mất tiền",
 * tức mock dễ tính hơn contract thật ở đúng chỗ dễ sai nhất.
 */
const DEFAULT_WPT_PRICE_VND = 100_000n;

/** Giá NAV mặc định khi tất toán = giá phát hành. Nghiệp vụ đặt lại bằng `setNavRate`. */
const DEFAULT_NAV_RATE = DEFAULT_WPT_PRICE_VND;

/**
 * Giữ state trên globalThis: Next.js dev reload module giữa các request,
 * biến module-level thường sẽ bị reset và balance "bốc hơi" giữa hai lần bấm.
 */
const GLOBAL_KEY = '__bidvMockLedgerState__';

function state(): MockState {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockState };
  holder[GLOBAL_KEY] ??= {
    balances: new Map(),
    whitelisted: new Set(),
    frozen: new Set(),
    totalSupply: 0n,
    nonce: 0,

    initialSupplyMinted: false,
    spvWallet: undefined,

    wptPriceVnd: DEFAULT_WPT_PRICE_VND,
    paymentBalances: new Map(),
    paymentAllowances: new Map(),

    snapshots: new Map(),
    lastSnapshotId: 0,

    profitPool: 0n,

    settlementMode: false,
    navRate: DEFAULT_NAV_RATE,
  };
  return holder[GLOBAL_KEY];
}

/** Chỉ dùng cho test/demo runner: về trạng thái trắng. */
export function resetMockLedger(): void {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockState };
  delete holder[GLOBAL_KEY];
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

export function seedMockLedger(seed: MockLedgerSeed): void {
  const s = state();
  for (const [wallet, amount] of Object.entries(seed.paymentBalances ?? {})) {
    s.paymentBalances.set(addressKey(normalizeEvmAddress(wallet)), amount);
  }
  for (const [wallet, amount] of Object.entries(seed.paymentAllowances ?? {})) {
    s.paymentAllowances.set(addressKey(normalizeEvmAddress(wallet)), amount);
  }
  if (seed.profitPool !== undefined) s.profitPool = seed.profitPool;
  if (seed.wptPriceVnd !== undefined) s.wptPriceVnd = seed.wptPriceVnd;
}

function fakeTxHash(): string {
  const s = state();
  s.nonce += 1;
  // Dạng 0x + 64 hex để UI/validation coi như tx hash thật.
  return `0x${s.nonce.toString(16).padStart(64, '0')}`;
}

export function createMockLedger(chain: ChainKey = 'mock'): ILedgerPort {
  const confirmed = (): TxResult => ({ txHash: fakeTxHash(), status: 'CONFIRMED' });

  /**
   * Kiểu ghi trên BIẾN, không phải trên hàm mũi nhọn.
   *
   * TypeScript chỉ coi một hàm là "không bao giờ trả về" (để thu hẹp kiểu sau lời gọi)
   * khi khai báo biến có annotation tường minh. Viết `const reject = (...): never =>`
   * thì sau `if (!record) reject(...)` biến `record` vẫn còn `| undefined`.
   */
  const reject: (operation: string, message: string) => never = (operation, message) => {
    throw new LedgerError(chain, operation, message);
  };

  const requireWhitelisted = (operation: string, wallet: string, label: string): void => {
    if (!state().whitelisted.has(addressKey(wallet))) {
      reject(operation, `${label} chưa KYC/whitelist: ${wallet}`);
    }
  };

  const requireNotFrozen = (operation: string, wallet: string, label: string): void => {
    if (state().frozen.has(addressKey(wallet))) {
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
  const requireNotSettling = (operation: string): void => {
    if (state().settlementMode) {
      reject(operation, 'Đang trong giai đoạn tất toán: chuyển nhượng thông thường bị tạm dừng.');
    }
  };

  const balance = (wallet: string): bigint => state().balances.get(addressKey(wallet)) ?? 0n;

  const setBalance = (wallet: string, value: bigint): void => {
    state().balances.set(addressKey(wallet), value);
  };

  const paymentBalance = (wallet: string): bigint =>
    state().paymentBalances.get(addressKey(wallet)) ?? 0n;

  const setPaymentBalance = (wallet: string, value: bigint): void => {
    state().paymentBalances.set(addressKey(wallet), value);
  };

  const allowance = (wallet: string): bigint =>
    state().paymentAllowances.get(addressKey(wallet)) ?? 0n;

  /**
   * Lấy ảnh chụp theo mã, từ chối với lý do rõ nếu mã không tồn tại.
   * Khớp hai `require` của `ERC20Snapshotable._valueAt` ("id la 0", "id chua ton tai").
   */
  const requireSnapshot = (operation: string, snapshotId: number): SnapshotRecord => {
    const s = state();
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

  return {
    chain,

    // =========================================================================
    //  TUÂN THỦ
    // =========================================================================
    async whitelist(wallet) {
      state().whitelisted.add(addressKey(normalizeEvmAddress(wallet)));
      return confirmed();
    },

    async isWhitelisted(wallet) {
      return state().whitelisted.has(addressKey(normalizeEvmAddress(wallet)));
    },

    async freeze(wallet, frozen) {
      const key = addressKey(normalizeEvmAddress(wallet));
      if (frozen) state().frozen.add(key);
      else state().frozen.delete(key);
      return confirmed();
    },

    async isFrozen(wallet) {
      return state().frozen.has(addressKey(normalizeEvmAddress(wallet)));
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
      const s = state();

      const deny = (reason: string): TransferCheck => ({ allowed: false, reason });

      if (s.settlementMode) {
        return deny('Đang trong giai đoạn tất toán: chuyển nhượng thông thường bị tạm dừng.');
      }
      if (s.frozen.has(addressKey(sender))) return deny(`Bên gửi đang bị đóng băng: ${sender}`);
      if (s.frozen.has(addressKey(receiver))) return deny(`Bên nhận đang bị đóng băng: ${receiver}`);
      if (!s.whitelisted.has(addressKey(sender))) {
        return deny(`Bên gửi chưa KYC/whitelist: ${sender}`);
      }
      if (!s.whitelisted.has(addressKey(receiver))) {
        return deny(`Bên nhận chưa KYC/whitelist: ${receiver}`);
      }
      if (balance(sender) < amount) {
        return deny(`Số dư WPT không đủ: cần ${amount}, ví ${sender} chỉ có ${balance(sender)}.`);
      }
      return { allowed: true };
    },

    // =========================================================================
    //  PHÁT HÀNH / THU HỒI
    // =========================================================================
    async mint(to, amount) {
      assertPositiveAmount(chain, 'mint', amount);
      const receiver = normalizeEvmAddress(to);
      requireWhitelisted('mint', receiver, 'Bên nhận');
      requireNotFrozen('mint', receiver, 'Bên nhận');

      setBalance(receiver, balance(receiver) + amount);
      state().totalSupply += amount;
      return confirmed();
    },

    async burn(from, amount) {
      // KHÔNG kiểm settlementMode: đốt phải chạy được khi tất toán (R6.3).
      assertPositiveAmount(chain, 'burn', amount);
      const holder = normalizeEvmAddress(from);
      if (balance(holder) < amount) reject('burn', `Số dư không đủ để đốt: ${holder}`);

      setBalance(holder, balance(holder) - amount);
      state().totalSupply -= amount;
      return confirmed();
    },

    async transfer(from, to, amount) {
      assertPositiveAmount(chain, 'transfer', amount);
      requireNotSettling('transfer');
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);

      requireNotFrozen('transfer', sender, 'Bên gửi');
      requireNotFrozen('transfer', receiver, 'Bên nhận');
      requireWhitelisted('transfer', sender, 'Bên gửi');
      requireWhitelisted('transfer', receiver, 'Bên nhận');
      if (balance(sender) < amount) reject('transfer', `Số dư không đủ: ${sender}`);

      setBalance(sender, balance(sender) - amount);
      setBalance(receiver, balance(receiver) + amount);
      return confirmed();
    },

    async forcedTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'forcedTransfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);

      // Giống contract: bỏ qua trạng thái băng của `from`, nhưng `to` vẫn phải KYC.
      requireWhitelisted('forcedTransfer', receiver, 'Bên nhận (clawback)');
      if (balance(sender) < amount) reject('forcedTransfer', `Số dư không đủ: ${sender}`);

      setBalance(sender, balance(sender) - amount);
      setBalance(receiver, balance(receiver) + amount);
      return confirmed();
    },

    /**
     * Phát hành toàn bộ nguồn cung MỘT LẦN vào ví thanh toán SPV.
     * Gọi lần hai bị từ chối (R1.3) — đây là ràng buộc quan trọng nhất của luồng
     * phát hành: nguồn cung phình thêm sau khi công bố là lỗi không sửa được.
     */
    async mintInitialSupply(to, amount) {
      assertPositiveAmount(chain, 'mintInitialSupply', amount);
      const s = state();
      if (s.initialSupplyMinted) {
        reject(
          'mintInitialSupply',
          `Nguồn cung ban đầu đã được phát hành vào ví ${s.spvWallet ?? '(không rõ)'}. ` +
            `Không phát hành lần hai. Muốn thêm nguồn cung thì phải qua quy trình tăng vốn riêng.`,
        );
      }

      const receiver = normalizeEvmAddress(to);
      requireWhitelisted('mintInitialSupply', receiver, 'Ví thanh toán SPV');
      requireNotFrozen('mintInitialSupply', receiver, 'Ví thanh toán SPV');

      setBalance(receiver, balance(receiver) + amount);
      s.totalSupply += amount;
      s.initialSupplyMinted = true;
      s.spvWallet = receiver;
      return confirmed();
    },

    async isInitialSupplyMinted() {
      return state().initialSupplyMinted;
    },

    // =========================================================================
    //  KHỚP LỆNH MUA
    // =========================================================================
    async quotePurchase(wptAmount) {
      assertPositiveAmount(chain, 'quotePurchase', wptAmount);
      // VNDB 1:1 với VND — chỉ nhân, KHÔNG gọi nguồn tỷ giá nào (R2.6).
      return wptAmount * state().wptPriceVnd;
    },

    async paymentBalanceOf(wallet) {
      return paymentBalance(normalizeEvmAddress(wallet));
    },

    async paymentAllowanceOf(owner) {
      return allowance(normalizeEvmAddress(owner));
    },

    /**
     * Khớp lệnh nguyên tử: VNDB nhà đầu tư -> ví SPV, WPT ví SPV -> nhà đầu tư.
     *
     * MỌI kiểm tra chạy TRƯỚC mọi thay đổi trạng thái. Đó là cách duy nhất giữ
     * đúng R2.5 "không để lại trạng thái nửa vời" trong một hàm không có transaction:
     * nếu trừ VNDB rồi mới phát hiện SPV thiếu WPT thì tiền đã bay mà token chưa về.
     */
    async executePurchase(investor, wptAmount) {
      assertPositiveAmount(chain, 'executePurchase', wptAmount);
      requireNotSettling('executePurchase');
      const s = state();

      if (!s.initialSupplyMinted || !s.spvWallet) {
        reject(
          'executePurchase',
          'Chưa phát hành nguồn cung ban đầu — không có WPT nào để bán. Gọi mintInitialSupply trước.',
        );
      }
      const spv = s.spvWallet;
      const buyer = normalizeEvmAddress(investor);

      requireNotFrozen('executePurchase', buyer, 'Nhà đầu tư');
      requireNotFrozen('executePurchase', spv, 'Ví thanh toán SPV');
      requireWhitelisted('executePurchase', buyer, 'Nhà đầu tư');
      requireWhitelisted('executePurchase', spv, 'Ví thanh toán SPV');

      const cost = wptAmount * s.wptPriceVnd;
      if (paymentBalance(buyer) < cost) {
        reject(
          'executePurchase',
          `Số dư VNDB không đủ: cần ${cost}, ví ${buyer} chỉ có ${paymentBalance(buyer)}.`,
        );
      }
      if (allowance(buyer) < cost) {
        reject(
          'executePurchase',
          `Ủy quyền VNDB không đủ: cần ${cost}, đã cấp ${allowance(buyer)}. ` +
            `Nhà đầu tư phải approve cho hợp đồng khớp lệnh trước.`,
        );
      }
      if (balance(spv) < wptAmount) {
        reject(
          'executePurchase',
          `Ví thanh toán SPV không đủ WPT: cần ${wptAmount}, chỉ còn ${balance(spv)}.`,
        );
      }

      // --- Từ đây trở xuống không còn nhánh từ chối nào: đổi trạng thái nguyên khối.
      setPaymentBalance(buyer, paymentBalance(buyer) - cost);
      setPaymentBalance(spv, paymentBalance(spv) + cost);
      s.paymentAllowances.set(addressKey(buyer), allowance(buyer) - cost);
      setBalance(spv, balance(spv) - wptAmount);
      setBalance(buyer, balance(buyer) + wptAmount);
      return confirmed();
    },

    // =========================================================================
    //  CHỐT QUYỀN
    // =========================================================================
    async takeSnapshot(): Promise<SnapshotResult> {
      const s = state();
      s.lastSnapshotId += 1; // giống ERC20Snapshotable: mã đầu tiên là 1, 0 = chưa chốt
      s.snapshots.set(s.lastSnapshotId, {
        // COPY sâu: mua/bán sau thời điểm chốt không được làm sai lệch ảnh chụp.
        balances: new Map(s.balances),
        totalSupply: s.totalSupply,
        distributable: s.profitPool,
        paid: new Set(),
      });
      return { tx: confirmed(), snapshotId: s.lastSnapshotId };
    },

    async balanceOfAt(wallet, snapshotId) {
      const record = requireSnapshot('balanceOfAt', snapshotId);
      return record.balances.get(addressKey(normalizeEvmAddress(wallet))) ?? 0n;
    },

    async totalSupplyAt(snapshotId) {
      return requireSnapshot('totalSupplyAt', snapshotId).totalSupply;
    },

    // =========================================================================
    //  CHIA LỢI NHUẬN
    // =========================================================================
    async profitPoolBalance() {
      return state().profitPool;
    },

    /**
     * Chia cho MỘT lô ví. Adapter KHÔNG tự chia lô (R5.3).
     *
     * Phần mỗi ví = distributable * balanceOfAt / totalSupplyAt, chia lấy phần nguyên
     * giống contract (phần lẻ đọng lại trong quỹ, contract thật quét bằng `sweepDust`).
     */
    async distributeBatch(snapshotId, wallets) {
      const record = requireSnapshot('distributeBatch', snapshotId);
      const s = state();

      if (wallets.length === 0) {
        reject('distributeBatch', 'Danh sách ví trống — tầng nghiệp vụ phải truyền vào ít nhất một ví.');
      }
      if (record.totalSupply === 0n) {
        // Khớp require "khong co WPT dang luu hanh" của ProfitDistributor.
        reject(
          'distributeBatch',
          `Tổng cung WPT tại snapshot ${snapshotId} bằng 0 — không có quyền nào để chia.`,
        );
      }

      // Gộp trùng TRƯỚC khi tính: cùng một ví xuất hiện hai lần trong lô không được
      // nhận hai lần. Danh sách do nghiệp vụ dựng từ DB nên trùng là chuyện có thật.
      const payouts = new Map<string, bigint>();
      for (const wallet of wallets) {
        const key = addressKey(normalizeEvmAddress(wallet));
        if (record.paid.has(key) || payouts.has(key)) continue; // đã nhận kỳ này -> bỏ qua
        const held = record.balances.get(key) ?? 0n;
        payouts.set(key, (record.distributable * held) / record.totalSupply);
      }

      const total = [...payouts.values()].reduce((sum, amount) => sum + amount, 0n);
      if (s.profitPool < total) {
        // TRƯỚC khi chuyển cho bất kỳ ai (R5.4).
        reject(
          'distributeBatch',
          `Ví chia lợi nhuận không đủ tiền: cần ${total} VNDB cho lô này, chỉ có ${s.profitPool}. ` +
            `Nạp thêm quỹ hoặc giảm kích thước lô.`,
        );
      }

      for (const [key, amount] of payouts) {
        record.paid.add(key);
        if (amount > 0n) setPaymentBalance(key, paymentBalance(key) + amount);
      }
      s.profitPool -= total;
      return confirmed();
    },

    // =========================================================================
    //  TẤT TOÁN
    // =========================================================================
    async setSettlementMode(enabled) {
      state().settlementMode = enabled;
      return confirmed();
    },

    async isSettlementMode() {
      return state().settlementMode;
    },

    async setNavRate(rate) {
      assertPositiveAmount(chain, 'setNavRate', rate);
      state().navRate = rate;
      return confirmed();
    },

    async navRate() {
      return state().navRate;
    },

    // =========================================================================
    //  ĐỌC / GIAO DỊCH
    // =========================================================================
    async balanceOf(wallet) {
      return balance(normalizeEvmAddress(wallet));
    },

    async tokenInfo() {
      return { ...TOKEN, totalSupply: state().totalSupply };
    },

    async waitReceipt(txHash) {
      // Mock xác nhận ngay ở bước ghi, nên ở đây chỉ khẳng định lại.
      return { txHash, status: 'CONFIRMED' };
    },
  };
}
