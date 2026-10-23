import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { getLedger, LedgerNotImplementedError } from '@/lib/ledger';
import { getOrderStore, getProjectStore, getVaultStore } from '@/lib/store';
import { readTokenTerms, type TokenTerms } from '@/lib/store/config-values';
import { readEffectiveIssuePrice } from './issue-price';
import { ORDER_STATUSES, type OrderRecord, type OrderStatus } from '@/lib/store/order.store.port';
import { WITHDRAW_STATUSES, type WithdrawRequestRecord, type WithdrawStatus } from '@/lib/store/vault.store.port';
import type { ProjectStatus } from '@/lib/store/project.store.port';
import { authorize, toResult } from './authorize';
import { readSupplyMetrics, type SupplyMetrics } from './issuance.service';
import { orderDailyStats } from './purchase.service';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';

/**
 * Nghiệp vụ KÊNH NGƯỜI BÁN (FE-21) — CHỈ ĐỌC.
 *
 * Người bán là bên vận hành ví thanh toán SPV: mọi lệnh mua và bán WPT đều khớp với ví đó, nên "dữ liệu
 * của mình" là sổ lệnh và số dư của ví SPV trên chuỗi đang chọn. Cổng là `seller:read`, chỉ vai
 * `SELLER` có — ba vai kia gọi thẳng server action cũng bị chặn ở đây, không chỉ ở layout.
 *
 * Mọi con số tính ở tầng này; màn hình chỉ hiển thị (FE-21 yêu cầu 16).
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #3 quyền qua `authorize()`.
 */

const overviewSchema = z.object({ chain: chainSchema });

/** Múi giờ nghiệp vụ: "trong ngày" và lọc theo ngày tính theo giờ Việt Nam, không theo UTC. */
const vnDate = (iso: string | Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));

// ponytail: lọc + phân trang trong bộ nhớ trên tối đa 500 lệnh mới nhất; cần thêm offset/lọc ở cổng lưu trữ khi sổ lệnh vượt mức đó
const ORDER_SCAN_LIMIT = 500;

/** SC-04 chưa nối cờ tất toán EVM; đừng để thiếu cờ đó che toàn bộ số liệu vault chỉ đọc. */
const readSettlementModeForOverview = async (ledger: ReturnType<typeof getLedger>) => {
  try {
    return await ledger.isSettlementMode();
  } catch (error) {
    if (error instanceof LedgerNotImplementedError) return false;
    throw error;
  }
};

export interface SellerTokenRow extends SupplyMetrics {
  tokenSymbol: string;
  projectName: string;
  issuePriceVnd: string;
  tokenStatus: ProjectStatus;
  /** `false` khi chuỗi đang ở chế độ tất toán: ngừng bán. */
  tradingOpen: boolean;
  terms: TokenTerms;
}

/**
 * Luật khoá đọc từ vault trên chuỗi. BE-13 QĐ-H gỡ nguồn cấu hình FE-21 (hạn mức và phí): chain
 * nào cũng có vault (mock có vault mô phỏng), chain không có vault thì không rút được.
 */
export type SellerWithdrawPolicy = {
  source: 'on-chain';
  lockMode: 'UNSET' | 'FIXED' | 'PERCENT';
  fixedLockAmount: string;
  percentRateBps: string;
  netProceeds: string;
  percentLocked: string;
};

export interface SellerOverviewView {
  chain: ChainKey;
  /** Ví thanh toán SPV theo chuỗi; `null` khi chưa phát hành lần nào. */
  spvWallet: string | null;
  /**
   * Lệnh khớp trong ngày (giờ Việt Nam), tách hai chiều từ BE-14. Lấy từ `orderDailyStats` — một
   * chỗ đếm duy nhất cho Tổng quan Người bán và bảng điều khiển vận hành.
   */
  today: {
    buyCount: number;
    buyWpt: string;
    buyVnd: string;
    sell: { count: number; wpt: string; vnd: string };
  };
  tokens: SellerTokenRow[];
  wallet: {
    /** Vault khi chain đã triển khai vault; nếu chưa thì là ví SPV đã Mint lần đầu. */
    paymentWallet: string | null;
    /** VNDB trong ví thanh toán; `null` khi chưa có vault và chưa có ví SPV. */
    paymentVnd: string | null;
    /** VNDB trong ví chia lợi nhuận. */
    profitPoolVnd: string;
    /** `null` khi chain không có vault. */
    lockedVnd: string | null;
    withdrawableVnd: string | null;
    policy: SellerWithdrawPolicy | null;
    /** Ví nhận tiền rút đã đặt trên vault; `null` khi chưa đặt hoặc không có vault. */
    payoutWallet: string | null;
    /** Rút đang tạm dừng trên vault. */
    withdrawalsPaused: boolean;
    /** Cảnh báo đối soát khi ProjectToken vẫn ghi một ví SPV khác vault. */
    warning: string | null;
  };
}

/** Tổng quan Người bán: lệnh khớp trong ngày, nguồn cung, tồn kho, số dư và hạn mức rút. */
export async function getSellerOverview(input: unknown): Promise<Result<SellerOverviewView>> {
  const parsed = overviewSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain } = parsed.data;

  try {
    await authorize('seller:read', null, chain);

    const ledger = getLedger(chain);
    const [spvWallet, vault, projects, issuePrice, terms, tradingPaused, profitPool, daily] =
      await Promise.all([
        ledger.spvWallet(),
        ledger.vaultStatus(),
        getProjectStore().listProjects({ chain }),
        // Giá áp dụng cho lệnh (FE-07, L-02), cùng nguồn với giá chốt lệnh.
        readEffectiveIssuePrice(chain),
        readTokenTerms(),
        readSettlementModeForOverview(ledger),
        ledger.profitPoolBalance(),
        orderDailyStats({ chain }),
      ]);
    if (!daily.ok) return daily;

    const paymentWallet = vault?.address ?? spvWallet;
    const tokens = await Promise.all(
      projects.map(async (project) => ({
        tokenSymbol: project.tokenSymbol,
        projectName: project.name,
        issuePriceVnd: issuePrice.toString(),
        tokenStatus: project.status,
        tradingOpen: !tradingPaused,
        terms,
        ...(await readSupplyMetrics(chain, project, Promise.resolve(paymentWallet))),
      })),
    );

    const paymentVnd = vault
      ? vault.vndbBalance.toString()
      : paymentWallet
        ? (await ledger.paymentBalanceOf(paymentWallet)).toString()
        : null;
    const withdrawPolicy: SellerWithdrawPolicy | null = vault
      ? {
          source: 'on-chain',
          lockMode: vault.lockMode,
          fixedLockAmount: vault.fixedLockAmount.toString(),
          percentRateBps: vault.percentRateBps.toString(),
          netProceeds: vault.netProceeds.toString(),
          percentLocked: vault.percentLocked.toString(),
        }
      : null;
    const warning =
      vault && spvWallet && spvWallet.toLowerCase() !== vault.address.toLowerCase()
        ? `Ví SPV trên chuỗi không phải vault: ${spvWallet}. Vault hiện tại: ${vault.address}.`
        : null;

    return ok({
      chain,
      spvWallet,
      today: {
        buyCount: daily.data.bySide.BUY.count,
        buyWpt: daily.data.bySide.BUY.wptAmount,
        buyVnd: daily.data.bySide.BUY.vndAmount,
        sell: {
          count: daily.data.bySide.SELL.count,
          wpt: daily.data.bySide.SELL.wptAmount,
          vnd: daily.data.bySide.SELL.vndAmount,
        },
      },
      tokens,
      wallet: {
        paymentWallet,
        paymentVnd,
        profitPoolVnd: profitPool.toString(),
        lockedVnd: vault ? vault.lockedAmount.toString() : null,
        withdrawableVnd: vault ? vault.withdrawable.toString() : null,
        policy: withdrawPolicy,
        payoutWallet: vault?.payoutWallet ?? null,
        withdrawalsPaused: vault?.withdrawalsPaused ?? false,
        warning,
      },
    });
  } catch (error) {
    return toResult(error);
  }
}

/** Loại giao dịch: hai chiều lệnh (BE-14 thêm `SELL`) và lệnh rút của Người bán (BE-13). */
export const SELLER_TXN_TYPES = ['BUY', 'SELL', 'WITHDRAW'] as const;
export type SellerTxnType = (typeof SELLER_TXN_TYPES)[number];

/** Tập trạng thái lọc được theo loại; không lọc loại thì nhận cả hai tập. */
export const SELLER_TXN_STATUSES: Readonly<Record<SellerTxnType, readonly string[]>> = {
  BUY: ORDER_STATUSES,
  SELL: ORDER_STATUSES,
  WITHDRAW: WITHDRAW_STATUSES,
};

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD.');

const transactionsSchema = z.object({
  chain: chainSchema,
  /** Tìm theo mã lệnh hoặc địa chỉ ví nhà đầu tư, không phân biệt hoa thường. */
  q: z.string().trim().max(100).optional(),
  type: z.enum(SELLER_TXN_TYPES).optional(),
  status: z.string().max(40).optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Union phân biệt theo `type` (QĐ-I): lệnh mua bán mang trạng thái lệnh, lệnh rút mang trạng thái rút. */
export type SellerTxnRow =
  | {
      type: 'BUY' | 'SELL';
      id: string;
      investorWallet: string;
      wptAmount: string;
      vndAmount: string;
      status: OrderStatus;
      createdAt: string;
      updatedAt: string;
    }
  | {
      type: 'WITHDRAW';
      id: string;
      payoutWallet: string;
      vndAmount: string;
      status: WithdrawStatus;
      purpose: string;
      txHash: string | null;
      createdAt: string;
      updatedAt: string;
    };

export interface SellerTxnPage {
  rows: SellerTxnRow[];
  total: number;
  page: number;
  pageSize: number;
}

const orderRow = (o: OrderRecord): SellerTxnRow => ({
  type: o.side,
  id: o.id,
  investorWallet: o.investorWallet,
  wptAmount: o.wptAmount,
  vndAmount: o.vndAmount,
  status: o.status,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});

const withdrawRow = (w: WithdrawRequestRecord): SellerTxnRow => ({
  type: 'WITHDRAW',
  id: w.id,
  payoutWallet: w.payoutWallet,
  vndAmount: w.amount,
  status: w.status,
  purpose: w.purpose,
  txHash: w.txHash,
  createdAt: w.createdAt,
  updatedAt: w.updatedAt,
});

/** Mới nhất trước, rồi `id` giảm dần: hai bản ghi cùng thời điểm vẫn có thứ tự cố định để phân trang. */
const newestFirst = (a: SellerTxnRow, b: SellerTxnRow) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/** Danh sách giao dịch của Người bán: lệnh mua bán gộp với lệnh rút, có lọc và phân trang. Chỉ đọc. */
export async function listSellerTransactions(input: unknown): Promise<Result<SellerTxnPage>> {
  const parsed = transactionsSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, q, type, status, from, to, page, pageSize } = parsed.data;

  try {
    if (status !== undefined) {
      const allowed = type ? SELLER_TXN_STATUSES[type] : [...ORDER_STATUSES, ...WITHDRAW_STATUSES];
      if (!allowed.includes(status)) {
        return err('VALIDATION', 'Trạng thái không thuộc loại giao dịch đang lọc.', {
          status: [`Trạng thái hợp lệ: ${[...new Set(allowed)].join(', ')}.`],
        });
      }
    }

    await authorize('seller:read', null, chain);

    const wantsOrders = type !== 'WITHDRAW' && (status === undefined || (ORDER_STATUSES as readonly string[]).includes(status));
    const wantsWithdrawals =
      (type === undefined || type === 'WITHDRAW') &&
      (status === undefined || (WITHDRAW_STATUSES as readonly string[]).includes(status));
    const [orders, withdrawals] = await Promise.all([
      wantsOrders
        ? getOrderStore().listOrders({
            chain,
            status: status as OrderStatus | undefined,
            side: type,
            limit: ORDER_SCAN_LIMIT,
          })
        : [],
      wantsWithdrawals
        ? getVaultStore().listWithdrawRequests({
            chain,
            statuses: status === undefined ? undefined : [status as WithdrawStatus],
            limit: ORDER_SCAN_LIMIT,
          })
        : [],
    ]);
    const needle = q?.toLowerCase();
    const inRange = (createdAt: string) => (!from || vnDate(createdAt) >= from) && (!to || vnDate(createdAt) <= to);
    const rows = [
      ...orders
        .filter((o) => !needle || o.id.toLowerCase().includes(needle) || o.investorWallet.toLowerCase().includes(needle))
        .map(orderRow),
      ...withdrawals
        .filter(
          (w) =>
            !needle ||
            w.id.toLowerCase().includes(needle) ||
            w.payoutWallet.toLowerCase().includes(needle) ||
            (w.txHash?.toLowerCase().includes(needle) ?? false),
        )
        .map(withdrawRow),
    ]
      .filter((row) => inRange(row.createdAt))
      .sort(newestFirst);

    return ok({
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
    });
  } catch (error) {
    return toResult(error);
  }
}
