import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { getOrderStore, getProjectStore } from '@/lib/store';
import {
  readIssuePriceVnd,
  readSellerWithdrawFee,
  readSellerWithdrawPolicy,
  readTokenTerms,
  type TokenTerms,
} from '@/lib/store/config-values';
import { ORDER_STATUSES, type OrderRecord, type OrderStatus } from '@/lib/store/order.store.port';
import type { ProjectStatus } from '@/lib/store/project.store.port';
import { authorize, toResult } from './authorize';
import { readSupplyMetrics, type SupplyMetrics } from './issuance.service';
import { orderDailyStats } from './purchase.service';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';
import { computeWithdrawLimit, type WithdrawPolicy } from './withdraw-limit';

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

export interface SellerTokenRow extends SupplyMetrics {
  tokenSymbol: string;
  projectName: string;
  issuePriceVnd: string;
  tokenStatus: ProjectStatus;
  /** `false` khi chuỗi đang ở chế độ tất toán: ngừng bán. */
  tradingOpen: boolean;
  terms: TokenTerms;
}

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
    /** VNDB trong ví thanh toán; `null` khi chưa có ví SPV. */
    paymentVnd: string | null;
    /** VNDB trong ví chia lợi nhuận. */
    profitPoolVnd: string;
    /** `null` khi chưa cấu hình hạn mức hoặc chưa có ví SPV. */
    lockedVnd: string | null;
    withdrawableVnd: string | null;
    policy: WithdrawPolicy | null;
    /** Phí một lần rút; `null` khi chưa cấu hình. */
    withdrawFeeVnd: string | null;
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
    const [spvWallet, projects, issuePrice, terms, tradingPaused, profitPool, policy, fee, daily] =
      await Promise.all([
        ledger.spvWallet(),
        getProjectStore().listProjects({ chain }),
        readIssuePriceVnd(),
        readTokenTerms(),
        ledger.isSettlementMode(),
        ledger.profitPoolBalance(),
        readSellerWithdrawPolicy(),
        readSellerWithdrawFee(),
        orderDailyStats({ chain }),
      ]);
    if (!daily.ok) return daily;

    const tokens = await Promise.all(
      projects.map(async (project) => ({
        tokenSymbol: project.tokenSymbol,
        projectName: project.name,
        issuePriceVnd: issuePrice.toString(),
        tokenStatus: project.status,
        tradingOpen: !tradingPaused,
        terms,
        ...(await readSupplyMetrics(chain, project)),
      })),
    );

    const paymentVnd = spvWallet ? (await ledger.paymentBalanceOf(spvWallet)).toString() : null;
    const limit = paymentVnd !== null && policy ? computeWithdrawLimit(paymentVnd, policy) : null;

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
        paymentVnd,
        profitPoolVnd: profitPool.toString(),
        lockedVnd: limit?.lockedVnd ?? null,
        withdrawableVnd: limit?.withdrawableVnd ?? null,
        policy,
        withdrawFeeVnd: fee?.toString() ?? null,
      },
    });
  } catch (error) {
    return toResult(error);
  }
}

/** Loại giao dịch = chiều lệnh (BE-14 thêm `SELL`). Loại khác (rút) thêm vào đây khi có nghiệp vụ. */
export const SELLER_TXN_TYPES = ['BUY', 'SELL'] as const;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD.');

const transactionsSchema = z.object({
  chain: chainSchema,
  /** Tìm theo mã lệnh hoặc địa chỉ ví nhà đầu tư, không phân biệt hoa thường. */
  q: z.string().trim().max(100).optional(),
  type: z.enum(SELLER_TXN_TYPES).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface SellerTxnRow {
  id: string;
  investorWallet: string;
  type: (typeof SELLER_TXN_TYPES)[number];
  wptAmount: string;
  vndAmount: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SellerTxnPage {
  rows: SellerTxnRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Danh sách giao dịch của Người bán, có lọc và phân trang. Chỉ đọc. */
export async function listSellerTransactions(input: unknown): Promise<Result<SellerTxnPage>> {
  const parsed = transactionsSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, q, type, status, from, to, page, pageSize } = parsed.data;

  try {
    await authorize('seller:read', null, chain);

    const orders = await getOrderStore().listOrders({ chain, status, side: type, limit: ORDER_SCAN_LIMIT });
    const needle = q?.toLowerCase();
    const matches = (o: OrderRecord) =>
      (!needle || o.id.toLowerCase().includes(needle) || o.investorWallet.toLowerCase().includes(needle)) &&
      (!from || vnDate(o.createdAt) >= from) &&
      (!to || vnDate(o.createdAt) <= to);
    // Lọc loại đã đẩy xuống cổng lưu trữ (`side`), cùng lần đọc với lọc trạng thái.
    const filtered = orders.filter(matches);

    return ok({
      rows: filtered.slice((page - 1) * pageSize, page * pageSize).map((o) => ({
        id: o.id,
        investorWallet: o.investorWallet,
        type: o.side,
        wptAmount: o.wptAmount,
        vndAmount: o.vndAmount,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
      total: filtered.length,
      page,
      pageSize,
    });
  } catch (error) {
    return toResult(error);
  }
}
