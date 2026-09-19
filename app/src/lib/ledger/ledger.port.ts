import type { ChainKey, TxResult, TxStatus } from '@bidv/shared';

/**
 * LUẬT #1: MỌI tương tác chain đi qua interface này.
 * Cấm gọi thẳng viem/ethers trong component hay route handler.
 *
 * Thêm chain  = thêm một `*.adapter.ts` + đăng ký ở `lib/ledger/index.ts`.
 * Thêm luồng  = thêm method ở đây + hiện thực ở từng adapter.
 *
 * ----------------------------------------------------------------------------
 * TỔ CHỨC: 7 interface con theo nghiệp vụ, hợp lại thành `ILedgerPort`.
 *
 * Vì sao tách: 28 method trong một khối là không đọc được, và khi đọc adapter
 * không biết method nào thuộc luồng nào. Tách theo nghiệp vụ (BE-01 design QĐ-1)
 * cho phép đọc từng nhóm độc lập, còn `ILedgerPort` vẫn là thứ DUY NHẤT tầng
 * nghiệp vụ nhìn thấy — nên không lời gọi nào phải sửa.
 *
 * KHÔNG kiểu nào của `viem` xuất hiện trong các chữ ký dưới đây: địa chỉ là
 * `string`, số lượng là `bigint`. Adapter tự chuẩn hoá bằng `normalizeEvmAddress`.
 * ----------------------------------------------------------------------------
 */
export type { ChainKey, TxResult, TxStatus };

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

/**
 * Kết quả kiểm tra trước khi gửi giao dịch (BE-01 R3).
 *
 * Cố tình KHÔNG dùng `boolean`: tầng giao diện cần hiện LÝ DO cụ thể cho người
 * dùng ("bên nhận chưa KYC") thay vì một chữ "không được". Adapter chịu trách
 * nhiệm dịch mã lỗi thô của contract thành câu tiếng Việt đọc được.
 */
export type TransferCheck = { allowed: true } | { allowed: false; reason: string };

/** Kết quả chốt quyền: vừa cần biên nhận giao dịch, vừa cần mã snapshot để tra số dư. */
export interface SnapshotResult {
  tx: TxResult;
  snapshotId: number;
}

// =============================================================================
//  1. TUÂN THỦ — whitelist/KYC, đóng băng, và kiểm tra trước khi chuyển
// =============================================================================
export interface ILedgerCompliance {
  whitelist(wallet: string): Promise<TxResult>;
  isWhitelisted(wallet: string): Promise<boolean>;
  freeze(wallet: string, frozen: boolean): Promise<TxResult>;
  isFrozen(wallet: string): Promise<boolean>;

  /**
   * Một lần chuyển `amount` từ `from` sang `to` có được phép hay không, kèm lý do.
   *
   * PHẢI là hàm ĐỌC: không gửi giao dịch, không tốn phí (BE-01 R3.2). Dùng để
   * chặn sớm ở giao diện, tránh để người dùng trả phí cho một giao dịch chắc chắn
   * bị revert.
   */
  canTransfer(from: string, to: string, amount: bigint): Promise<TransferCheck>;
}

// =============================================================================
//  2. PHÁT HÀNH / THU HỒI
// =============================================================================
export interface ILedgerIssuance {
  mint(to: string, amount: bigint): Promise<TxResult>;
  burn(from: string, amount: bigint): Promise<TxResult>;
  transfer(from: string, to: string, amount: bigint): Promise<TxResult>;
  /** Clawback: chuyển cưỡng bức, bỏ qua trạng thái đóng băng của `from`. */
  forcedTransfer(from: string, to: string, amount: bigint): Promise<TxResult>;

  /**
   * Phát hành TOÀN BỘ nguồn cung một lần vào ví thanh toán của SPV (BE-01 R1).
   *
   * Khác `mint`: đây là hành vi MỘT LẦN cho cả dự án, không phải phát hành lẻ cho
   * từng nhà đầu tư. Sau lần này, WPT đến tay nhà đầu tư qua `executePurchase`
   * (chuyển từ ví SPV), KHÔNG mint thêm.
   */
  mintInitialSupply(to: string, amount: bigint): Promise<TxResult>;
  /** Đã phát hành nguồn cung ban đầu chưa. Gọi lần hai phải bị từ chối (R1.3). */
  isInitialSupplyMinted(): Promise<boolean>;

  /**
   * Địa chỉ ví thanh toán SPV — ví đang giữ WPT chưa bán. `null` khi chưa phát hành
   * nguồn cung ban đầu.
   *
   * THÊM Ở BE-02, và đây là lý do: QĐ-2 buộc kiểm "ví SPV còn đủ WPT hay không" TRƯỚC
   * khi gửi giao dịch, mà phép kiểm đó là `balanceOf(<ví SPV>)` — cần một địa chỉ.
   * `executePurchase` biết ví đó nhưng không nói ra, nên tầng nghiệp vụ không có đường
   * nào lấy được: hoặc thêm method này, hoặc bỏ hẳn một trong bốn phép kiểm.
   *
   * Đây là hàm ĐỌC và chuỗi trả lời được thật (hợp đồng phát hành một lần giữ địa chỉ
   * này), nên khác hẳn với `holdersAt` — thứ đã bị từ chối vì ERC-20 KHÔNG lưu danh
   * sách người nắm giữ nên không lời gọi nào đọc ra được.
   *
   * KHÔNG dùng nó để chuyển tiền tới ví SPV từ tầng nghiệp vụ: việc chuyển nằm trong
   * `executePurchase`, nguyên khối cùng chiều chuyển WPT.
   */
  spvWallet(): Promise<string | null>;
}

// =============================================================================
//  3. KHỚP LỆNH MUA — nhà đầu tư trả VNDB, nhận WPT từ ví SPV
// =============================================================================
export interface ILedgerPurchase {
  /**
   * Số VNDB phải trả cho `wptAmount` WPT.
   *
   * VNDB quy đổi 1:1 với VND nên hàm này KHÔNG gọi bất kỳ nguồn tỷ giá nào
   * (BE-01 R2.6) — chỉ nhân số lượng với giá bán một WPT.
   *
   * @flow purchase:3 | chốt số VNDB phải trả, tính một lần tại lúc đặt lệnh
   */
  quotePurchase(wptAmount: bigint): Promise<bigint>;
  /** Số dư token thanh toán (VNDB) của một ví. */
  paymentBalanceOf(wallet: string): Promise<bigint>;
  /** Mức ủy quyền VNDB mà `owner` đã cấp cho hợp đồng khớp lệnh. */
  paymentAllowanceOf(owner: string): Promise<bigint>;
  /**
   * Khớp lệnh: chuyển VNDB (nhà đầu tư -> ví SPV) và chuyển WPT (ví SPV -> nhà
   * đầu tư) trong CÙNG MỘT giao dịch (BE-01 R2.4).
   *
   * Thiếu số dư, thiếu ủy quyền, hoặc ví SPV thiếu WPT thì thất bại và KHÔNG
   * để lại trạng thái nửa vời (R2.5).
   *
   * @flow purchase:8 | chuyển VNDB và WPT trong cùng một giao dịch
   */
  executePurchase(investor: string, wptAmount: bigint): Promise<TxResult>;
}

// =============================================================================
//  4. CHỐT QUYỀN (SNAPSHOT)
// =============================================================================
/**
 * KHÔNG có method liệt kê người nắm giữ, và đây là quyết định có chủ đích.
 *
 * ERC-20 chỉ lưu BẢNG SỐ DƯ theo địa chỉ, không lưu danh sách địa chỉ. Không có
 * lời gọi nào đọc ra danh sách người nắm giữ từ chuỗi. Danh sách ví cần chia lợi
 * nhuận / cần tất toán lấy từ CƠ SỞ DỮ LIỆU (bảng lệnh mua đã hoàn tất, bảng vị
 * thế nhà đầu tư), về sau từ Indexer (IN-02). BE-05/BE-06 dựng danh sách đó rồi
 * truyền vào `distributeBatch`.
 *
 * Đừng thêm `holdersAt` rồi hiện thực bằng cách quét sự kiện trong adapter: quét
 * sự kiện là việc của Indexer, làm trong adapter sẽ chậm, không phân trang được,
 * và sai ngay khi RPC giới hạn khoảng block.
 */
export interface ILedgerSnapshot {
  /** Chốt quyền tại thời điểm gọi. Mã snapshot đọc từ sự kiện contract phát ra. */
  takeSnapshot(): Promise<SnapshotResult>;
  /** Số dư WPT của một ví TẠI mã snapshot. Mã không tồn tại -> lỗi có lý do rõ. */
  balanceOfAt(wallet: string, snapshotId: number): Promise<bigint>;
  /** Tổng cung WPT TẠI mã snapshot. */
  totalSupplyAt(snapshotId: number): Promise<bigint>;
}

// =============================================================================
//  5. CHIA LỢI NHUẬN
// =============================================================================
export interface ILedgerDistribution {
  /** Số VNDB đang có trong ví chia lợi nhuận. */
  profitPoolBalance(): Promise<bigint>;
  /**
   * Chia cho MỘT LÔ người nhận.
   *
   * Adapter KHÔNG tự chia lô (BE-01 R5.3): kích thước lô phụ thuộc giới hạn tài
   * nguyên của từng chuỗi và phải đo thực tế, còn việc chạy lại lô lỗi cần trạng
   * thái trong cơ sở dữ liệu mà adapter không có. Tầng nghiệp vụ (BE-06) quyết định.
   *
   * Ví lợi nhuận không đủ tiền cho cả lô -> thất bại TRƯỚC khi chuyển cho bất kỳ
   * ai (R5.4).
   */
  distributeBatch(snapshotId: number, wallets: readonly string[]): Promise<TxResult>;
}

// =============================================================================
//  6. TẤT TOÁN
// =============================================================================
export interface ILedgerSettlement {
  /**
   * Bật/tắt giai đoạn tất toán. Khi bật: chuyển nhượng thông thường bị chặn,
   * còn `burn` vẫn hoạt động (BE-01 R6.3) — đốt token là chính việc phải làm khi
   * tất toán, nên không được chặn cùng.
   */
  setSettlementMode(enabled: boolean): Promise<TxResult>;
  isSettlementMode(): Promise<boolean>;
  /** Giá NAV: số VNDB trả cho mỗi 1 WPT khi tất toán. */
  setNavRate(rate: bigint): Promise<TxResult>;
  navRate(): Promise<bigint>;
}

// =============================================================================
//  7. ĐỌC + GIAO DỊCH
// =============================================================================
export interface ILedgerRead {
  balanceOf(wallet: string): Promise<bigint>;
  tokenInfo(): Promise<TokenInfo>;
  waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult>;
}

/**
 * Cổng duy nhất mà tầng nghiệp vụ nhìn thấy. Giữ nguyên tên `ILedgerPort` để
 * không lời gọi hiện tại nào phải sửa.
 */
export interface ILedgerPort
  extends ILedgerCompliance,
    ILedgerIssuance,
    ILedgerPurchase,
    ILedgerSnapshot,
    ILedgerDistribution,
    ILedgerSettlement,
    ILedgerRead {
  readonly chain: ChainKey;
}

/** Mặc định 30s theo requirements AC#4 (đủ cho hardhat-local: block gần như tức thì). */
export const DEFAULT_RECEIPT_TIMEOUT_MS = 30_000;

/**
 * Testnet công khai chậm hơn hẳn: block time Sepolia ~12s, và tx còn phải chờ được chọn
 * vào block. 30s có thể trôi qua khi tx vẫn hoàn toàn bình thường, làm UI báo PENDING oan.
 * 90s ≈ 7 block, đủ biên an toàn (spec p4 §T1.1).
 */
export const EVM_RECEIPT_TIMEOUT_MS = 90_000;

/**
 * Timeout chờ receipt theo chain. Một chỗ duy nhất quyết định, để thêm chain mới
 * không phải đi sửa rải rác trong nghiệp vụ.
 */
export function receiptTimeoutFor(chain: ChainKey): number {
  switch (chain) {
    case 'evm':
      return EVM_RECEIPT_TIMEOUT_MS;
    case 'hardhat-local':
    case 'stellar':
    case 'mock':
      return DEFAULT_RECEIPT_TIMEOUT_MS;
  }
}

/**
 * Lỗi từ tầng ledger. `LedgerError` mang message ĐÃ ĐỌC ĐƯỢC cho người dùng cuối
 * (revert reason của contract là tiếng Việt không dấu, ví dụ "phat hanh cho vi chua KYC").
 */
export class LedgerError extends Error {
  readonly chain: ChainKey;
  readonly operation: string;

  constructor(chain: ChainKey, operation: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LedgerError';
    this.chain = chain;
    this.operation = operation;
  }
}

/** Method chưa hiện thực ở adapter này (vd stellar stub). */
export class LedgerNotImplementedError extends LedgerError {
  constructor(chain: ChainKey, operation: string, hint: string) {
    super(chain, operation, `"${operation}" chưa hiện thực cho chain "${chain}". ${hint}`);
    this.name = 'LedgerNotImplementedError';
  }
}

/** Guard dùng chung cho mọi adapter: số lượng phải > 0 (requirements AC#3). */
export function assertPositiveAmount(chain: ChainKey, operation: string, amount: bigint): void {
  if (amount <= 0n) {
    throw new LedgerError(chain, operation, 'Số lượng phải lớn hơn 0.');
  }
}
