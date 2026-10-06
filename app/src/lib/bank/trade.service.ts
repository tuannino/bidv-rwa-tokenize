import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { assertCan, can } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { getProjectStore, getStore } from '@/lib/store';
import { readIssuePriceVnd, readTokenTerms, type TokenTerms } from '@/lib/store/config-values';
import { formatAmount } from '@/lib/format';
import type { OrderSide } from '@/lib/store/order.store.port';
import type { AuditRecord } from '@/lib/store';
import type { ProjectRecord, ProjectStatus } from '@/lib/store/project.store.port';
import { toResult } from './authorize';
import { readSupplyMetrics } from './issuance.service';
import { listOrders, previewPurchase, type OrderView, type PurchasePreviewView } from './purchase.service';
import { err, ok, type Result } from './result';
import { chainSchema, previewPurchaseSchema, walletSchema } from './schemas';

/**
 * PHÉP ĐỌC PHÍA MÁY CHỦ cho hai màn của Nhà đầu tư (FE-25): Giao dịch token và Quản lý lệnh.
 *
 * Màn hình KHÔNG tự tính điều kiện, trần số lượng hay tiến trình (FE-25 ràng buộc). Mọi con số
 * và mọi kết luận "đạt / không đạt" sinh ở đây rồi đi qua server action; component chỉ vẽ.
 *
 * Tái dùng, không viết lại: điều kiện số dư là ĐÚNG bộ kiểm `runOrderChecks` của BE-14 (qua
 * `previewPurchase`), chỉ tiêu nguồn cung qua `readSupplyMetrics`, danh sách lệnh và năm bước
 * quyết toán qua `listOrders`. Tệp này chỉ ghép và thêm bốn điều kiện tài liệu yêu cầu.
 *
 * Kiểm quyền bằng `assertCan`, KHÔNG `authorize`: cả ba hàm là hàm ĐỌC mà màn hình gọi liên tục
 * (mở trang, gõ số lượng, làm mới tiến trình); ghi sổ kiểm toán mỗi lần đọc sẽ nhấn chìm sổ: cùng
 * lý do với `previewPurchase`.
 *
 * LUẬT #1 chain qua `getLedger()`; LUẬT #3 quyền qua `assertCan()` / `can()`.
 */

// =============================================================================
//  BỐI CẢNH GIAO DỊCH: thông tin token, số dư, trần số lượng từng chiều
// =============================================================================

const tradeContextSchema = z.object({
  chain: chainSchema,
  wallet: walletSchema,
});

export interface InvestorTokenInfo {
  tokenSymbol: string;
  projectName: string;
  /** Trần phát hành theo bảng dự án. */
  cap: string;
  /** Giá phát hành đang có hiệu lực (VNDB / 1 token). */
  issuePriceVnd: string;
  /** Trạng thái token theo bảng dự án. */
  tokenStatus: ProjectStatus;
  /** Còn giao dịch được không: `false` khi chuỗi đang ở giai đoạn tất toán. */
  tradingOpen: boolean;
  /** Số chưa phân phối (còn trong ví thanh toán người bán). */
  undistributed: string;
  terms: TokenTerms;
}

/** Trần số lượng của một chiều, kèm câu nói rõ giới hạn nào đang ràng buộc. */
export interface QuantityCap {
  max: string;
  reason: string;
}

export interface TradeContextView {
  chain: ChainKey;
  wallet: string;
  /** Token đang mở trên chuỗi này, cho ô chọn token. */
  tokens: Array<{ tokenSymbol: string; projectName: string }>;
  /** Thông tin token đang chọn; `null` khi chuỗi chưa có dự án nào. */
  token: InvestorTokenInfo | null;
  balances: {
    /** WPT ví đang giữ. */
    wpt: string;
    /** VNDB ví đang có. */
    vndb: string;
  };
  /** Giá dùng để khớp lệnh: cùng nguồn với số VNDB chốt khi đặt lệnh. */
  priceVnd: string;
  caps: Record<OrderSide, QuantityCap>;
}

/**
 * Trần số lượng mỗi chiều, đúng công thức tài liệu yêu cầu:
 *   - Mua: không vượt `số dư VNDB / giá` (làm tròn xuống) và không vượt số chưa phân phối.
 *   - Bán: không vượt số token đang giữ.
 * Tính ở đây để màn hình không có công thức thứ hai.
 */
function quantityCaps(
  vndb: bigint,
  price: bigint,
  undistributed: bigint,
  held: bigint,
): Record<OrderSide, QuantityCap> {
  const affordable = price > 0n ? vndb / price : 0n;
  const buyMax = affordable < undistributed ? affordable : undistributed;
  // Câu hiển thị thẳng trên màn hình nên số có phân cách hàng nghìn (FE-25 việc 14).
  const n = formatAmount;
  const buyReason =
    affordable <= undistributed
      ? `Tối đa ${n(buyMax)} token: số dư ${n(vndb)} VNDB chia cho giá ${n(price)} VNDB.`
      : `Tối đa ${n(buyMax)} token: số chưa phân phối của người bán chỉ còn ${n(undistributed)}.`;
  return {
    BUY: { max: buyMax.toString(), reason: buyReason },
    SELL: { max: held.toString(), reason: `Tối đa ${n(held)} token: số token ví đang giữ.` },
  };
}

/**
 * Bối cảnh màn Giao dịch token cho một ví: token, số dư, giá, trần số lượng hai chiều.
 *
 * Gọi khi mở trang, khi đổi ví / chuỗi, và sau khi lệnh khớp để số dư cập nhật.
 */
export async function getTradeContext(input: unknown): Promise<Result<TradeContextView>> {
  const parsed = tradeContextSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet } = parsed.data;

  try {
    assertCan(await currentRole(), 'order:place');

    const ledger = getLedger(chain);
    const [projects, held, vndb, price, issuePrice, terms, settling] = await Promise.all([
      getProjectStore().listProjects({ chain }),
      ledger.balanceOf(wallet),
      ledger.paymentBalanceOf(wallet),
      // Giá MỘT token theo đúng nguồn mà đặt lệnh dùng để chốt số VNDB (`quotePurchase`).
      ledger.quotePurchase(1n),
      readIssuePriceVnd(),
      readTokenTerms(),
      ledger.isSettlementMode(),
    ]);

    const project = projects[0] ?? null;
    const token = project ? await tokenInfoOf(chain, project, issuePrice, terms, !settling) : null;
    const undistributed = token ? BigInt(token.undistributed) : 0n;

    return ok({
      chain,
      wallet,
      tokens: projects.map((p) => ({ tokenSymbol: p.tokenSymbol, projectName: p.name })),
      token,
      balances: { wpt: held.toString(), vndb: vndb.toString() },
      priceVnd: price.toString(),
      caps: quantityCaps(vndb, price, undistributed, held),
    });
  } catch (error) {
    return toResult(error);
  }
}

async function tokenInfoOf(
  chain: ChainKey,
  project: ProjectRecord,
  issuePrice: bigint,
  terms: TokenTerms,
  tradingOpen: boolean,
): Promise<InvestorTokenInfo> {
  const metrics = await readSupplyMetrics(chain, project);
  return {
    tokenSymbol: project.tokenSymbol,
    projectName: project.name,
    cap: metrics.cap,
    issuePriceVnd: issuePrice.toString(),
    tokenStatus: project.status,
    tradingOpen,
    undistributed: metrics.undistributed,
    terms,
  };
}

// =============================================================================
//  KHỐI KIỂM TRA TRƯỚC LỆNH: năm điều kiện theo tài liệu
// =============================================================================

/** Năm điều kiện theo tài liệu yêu cầu, đúng thứ tự hiển thị. */
export const TRADE_CONDITION_KEYS = ['account', 'identity', 'wallet', 'token', 'risk'] as const;
export type TradeConditionKey = (typeof TRADE_CONDITION_KEYS)[number];

export interface TradeCondition {
  key: TradeConditionKey;
  label: string;
  passed: boolean;
  /** Câu nói rõ đã kiểm gì và thấy gì. */
  detail: string;
  /** Việc cần làm khi không đạt; `null` khi đạt. */
  howToFix: string | null;
}

export interface TradePreviewView {
  side: OrderSide;
  wptAmount: string;
  /** Tổng giá trị dự kiến (VNDB) theo giá hiện hành: chưa chốt, chốt khi đặt lệnh. */
  vndAmount: string;
  conditions: TradeCondition[];
  /** Mọi điều kiện đạt: nút xác nhận chỉ mở khi `true`. */
  canConfirm: boolean;
}

const LABELS: Record<TradeConditionKey, string> = {
  account: 'Tài khoản',
  identity: 'Định danh',
  wallet: 'Ví',
  token: 'Token được phép giao dịch',
  risk: 'Rủi ro',
};

const condition = (
  key: TradeConditionKey,
  passed: boolean,
  detail: string,
  howToFix: string | null = null,
): TradeCondition => ({ key, label: LABELS[key], passed, detail, howToFix: passed ? null : howToFix });

/**
 * Điều kiện "rủi ro" ĐỌC TỪ bộ kiểm số dư của BE-14, không phải hồ sơ khẩu vị rủi ro (hệ thống
 * chưa có). Owner chọn cách này: nó chặn được thật lệnh hỏng (thiếu VNDB, thiếu uỷ quyền, người
 * bán hết hàng hoặc hết tiền mua lại), và cùng một bộ kiểm với lúc đặt và lúc khớp lệnh.
 */
function riskCondition(preview: PurchasePreviewView): TradeCondition {
  const failed = preview.checks.find((check) => !check.ok);
  if (!failed || failed.ok) {
    // Bộ kiểm dừng ở phép trượt đầu tiên; không có phép trượt nghĩa là đạt tất cả.
    return condition(
      'risk',
      true,
      `Đạt ${preview.checks.length} phép kiểm số dư và thanh khoản của lệnh ${preview.side === 'BUY' ? 'mua' : 'bán'}. ` +
        'Chưa có hồ sơ khẩu vị rủi ro nhà đầu tư nên chưa đối chiếu hồ sơ.',
    );
  }
  return condition('risk', false, failed.reason, failed.howToFix);
}

/**
 * Xem trước một lệnh: năm điều kiện + tổng giá trị dự kiến. KHÔNG ghi gì vào cơ sở dữ liệu.
 *
 * Màn hình gọi sau mỗi lần đổi số lượng (đã hoãn), nên trả lại `side` và `wptAmount` để màn hình
 * bỏ phản hồi đã cũ.
 */
export async function previewTrade(input: unknown): Promise<Result<TradePreviewView>> {
  const parsed = previewPurchaseSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, investorWallet, side } = parsed.data;

  try {
    // Quyền `order:place` được kiểm trong `previewPurchase`; vai khác nhận FORBIDDEN tại đó.
    // Truyền NGUYÊN input, không truyền `parsed.data`: schema đã đổi số lượng sang `bigint`, đưa vào
    // lần parse thứ hai của `previewPurchase` thì bị từ chối là sai dạng.
    const preview = await previewPurchase(input);
    if (!preview.ok) return preview;

    const ledger = getLedger(chain);
    const [role, whitelisted, frozen, settling, spv, projects] = await Promise.all([
      currentRole(),
      ledger.isWhitelisted(investorWallet),
      ledger.isFrozen(investorWallet),
      ledger.isSettlementMode(),
      ledger.spvWallet(),
      getProjectStore().listProjects({ chain }),
    ]);
    const project = projects[0] ?? null;

    const conditions: TradeCondition[] = [
      condition(
        'account',
        can(role, 'order:place'),
        'Tài khoản Nhà đầu tư có quyền đặt lệnh mua và bán.',
        'Chỉ tài khoản Nhà đầu tư đặt được lệnh.',
      ),
      condition(
        'identity',
        whitelisted,
        whitelisted
          ? `Ví ${investorWallet} đã định danh (KYC) và nằm trong danh sách được phép.`
          : `Ví ${investorWallet} chưa định danh (KYC).`,
        'Hoàn tất định danh tại ngân hàng để ví được đưa vào danh sách được phép.',
      ),
      condition(
        'wallet',
        !frozen,
        frozen ? `Ví ${investorWallet} đang bị đóng băng.` : `Ví ${investorWallet} không bị đóng băng.`,
        'Liên hệ ngân hàng để xử lý trạng thái đóng băng của ví.',
      ),
      tokenCondition(project, spv, settling),
      riskCondition(preview.data),
    ];

    return ok({
      side,
      wptAmount: preview.data.wptAmount,
      vndAmount: preview.data.vndAmount,
      conditions,
      canConfirm: conditions.every((c) => c.passed),
    });
  } catch (error) {
    return toResult(error);
  }
}

function tokenCondition(
  project: ProjectRecord | null,
  spv: string | null,
  settling: boolean,
): TradeCondition {
  if (!project) {
    return condition('token', false, 'Chuỗi này chưa có dự án nào được token hoá.', 'Chọn chuỗi có dự án đang mở bán.');
  }
  if (!spv || project.status === 'DRAFT') {
    return condition(
      'token',
      false,
      `${project.tokenSymbol} chưa phát hành nên chưa giao dịch được.`,
      'Chờ ngân hàng phát hành token.',
    );
  }
  if (project.status === 'CLOSED' || settling) {
    return condition(
      'token',
      false,
      `${project.tokenSymbol} đang ở giai đoạn tất toán hoặc đã đóng: giao dịch thông thường tạm dừng.`,
      'Theo dõi thông báo tất toán của ngân hàng.',
    );
  }
  return condition('token', true, `${project.tokenSymbol} đã phát hành và đang mở giao dịch.`);
}

// =============================================================================
//  CHI TIẾT LỆNH: thông tin lệnh, năm bước, nhật ký kiểm toán của lệnh
// =============================================================================

const orderDetailSchema = z.object({
  chain: chainSchema,
  /** Bắt buộc với vai không có `order:read:all`: `listOrders` quyết định, không phải ở đây. */
  investorWallet: walletSchema.optional(),
  orderId: z.string().trim().pipe(z.uuid('Mã lệnh phải là UUID.')),
});

export interface OrderAuditEntry {
  at: string;
  action: string;
  actorRole: string;
  outcome: AuditRecord['outcome'];
  detail: string | null;
}

export interface OrderDetailView {
  order: OrderView;
  audit: OrderAuditEntry[];
}

/** Số dòng sổ kiểm toán quét để tìm nhật ký của một lệnh: bằng giới hạn giữ dòng của bản bộ nhớ. */
// ponytail: sổ kiểm toán chưa có cột mã lệnh nên lọc theo chuỗi chi tiết trong 500 dòng mới nhất; lệnh cũ hơn thì nhật ký rỗng, cần cột `orderId` ở AuditLog khi sổ lớn
const AUDIT_SCAN_LIMIT = 500;

/**
 * Chi tiết một lệnh cho màn Quản lý lệnh.
 *
 * Phạm vi xem đi qua CHÍNH `listOrders` (lọc theo ví ở tầng nghiệp vụ, BE-14 việc 12): nhà đầu tư
 * dò mã lệnh của ví khác nhận `ORDER_STATE` "không tìm thấy", không nhận lệnh đó. Nhật ký kiểm toán
 * chỉ trả sau khi lệnh đã qua cổng đó.
 */
export async function getOrderDetail(input: unknown): Promise<Result<OrderDetailView>> {
  const parsed = orderDetailSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, investorWallet, orderId } = parsed.data;

  try {
    const listed = await listOrders({ chain, investorWallet, orderId });
    if (!listed.ok) return listed;
    const order = listed.data[0];
    if (!order) return err('ORDER_STATE', `Không tìm thấy lệnh ${orderId} trong phạm vi được xem.`);

    const audit = (await getStore().listAudit({ limit: AUDIT_SCAN_LIMIT }))
      .filter((entry) => entry.detail?.includes(orderId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((entry) => ({
        at: entry.createdAt,
        action: entry.action,
        actorRole: entry.actorRole,
        outcome: entry.outcome,
        detail: entry.detail,
      }));

    return ok({ order, audit });
  } catch (error) {
    return toResult(error);
  }
}
