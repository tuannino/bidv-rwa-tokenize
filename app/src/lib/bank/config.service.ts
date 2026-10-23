import 'server-only';

import { z } from 'zod';
import type { ChainKey, TxResult } from '@bidv/shared';
import { issuePriceConfigKey } from '@/lib/config/issue-price-key';
import { getLedger, receiptTimeoutFor, type ILedgerPort } from '@/lib/ledger';
import { assertCan, can } from '@/lib/rbac';
import { assertCanConfigure, isConfigRole } from '@/lib/rbac/config-role';
import { currentRole } from '@/lib/rbac/session';
import {
  getConfigStore,
  getOrderStore,
  getProjectStore,
  getStore,
  type ConfigHistoryRecord,
  type OrderStatus,
} from '@/lib/store';
import { readIssuePriceVnd, readPriceChangeThreshold } from '@/lib/store/config-values';
import { toResult } from './authorize';
import { settlesAtOnChainPrice } from './issue-price';
import { remainingIssuanceCap } from './issuance.service';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';

/**
 * Nghiệp vụ THAM SỐ HỆ THỐNG — đổi giá phát hành WPT.
 *
 * ## Thứ tự trong `setIssuePrice` là phần quan trọng nhất của tệp này
 *
 * Giá tồn tại ở HAI nơi: cơ sở dữ liệu (thứ màn hình đọc để HIỂN THỊ) và ledger (thứ
 * `executePurchase` đọc để TRỪ TIỀN). Ghi cơ sở dữ liệu trước rồi đẩy xuống ledger sau, mà bước
 * sau thất bại, thì nhà đầu tư THẤY giá mới và bị TRỪ theo giá cũ — và không phép kiểm nào bắt
 * được, vì cả hai con số đều đúng so với nguồn của chúng.
 *
 * Vì vậy: ĐẨY XUỐNG LEDGER TRƯỚC, thành công mới ghi cơ sở dữ liệu. Nếu bước ghi cơ sở dữ liệu
 * thất bại thì đẩy GIÁ CŨ xuống ledger để hai bên về lại trạng thái cũ.
 *
 * Thứ tự ngược lại không cứu được gì: không có transaction nào bao được cả một lời gọi on-chain
 * và một câu lệnh SQL, nên việc duy nhất làm được là chọn thứ tự mà hỏng giữa đường vẫn để lại
 * trạng thái GIẢI THÍCH ĐƯỢC.
 *
 * "Thành công" ở ledger nghĩa là **có biên nhận CONFIRMED** (FE-07), không phải "đã gửi": trên EVM
 * `setPurchasePrice` trả ngay sau khi gửi. Ghi database lúc đó thì giao dịch bị từ chối sẽ để lại
 * database và mọi màn nói giá mới trong khi hợp đồng vẫn chốt lệnh theo giá cũ. Biên nhận PENDING
 * (hết giờ chờ) cũng chưa phải kết cục: không ghi database; nếu chuỗi xác nhận sau, `getIssuePrice`
 * báo lệch giá và Giao dịch viên đặt lại đúng giá đó để ghi nhận (cùng luật với HF-05).
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #3 quyền qua `assertCanConfigure()` -> `assertCan()`.
 */

/**
 * Giá nhận dạng CHUỖI rồi chuyển sang `bigint`.
 *
 * `.transform()` TRƯỚC `.refine()` là bắt buộc, cùng lý do đã ghi ở `schemas.ts`: Zod 4 vẫn chạy
 * `.refine()` sau khi một check trước đó trượt, nên `BigInt("1.5")` sẽ ném `SyntaxError` THÔ ra
 * khỏi `safeParse` — mà `safeParse` được gọi ngoài khối `try`, nên lỗi đó không thành `Result`.
 */
const priceSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Giá phải là số nguyên không dấu, đơn vị VND.')
  .transform((value) => BigInt(value))
  .refine((value) => value > 0n, 'Giá phải lớn hơn 0.');

const setIssuePriceSchema = z.object({
  chain: chainSchema,
  priceVnd: priceSchema,
  /** FE-07: bắt buộc. Lý do đi vào lịch sử cấu hình kèm mã giao dịch, để người giám sát đọc được. */
  reason: z
    .string({ error: 'Phải nêu lý do đổi giá.' })
    .trim()
    .min(5, 'Lý do đổi giá tối thiểu 5 ký tự.')
    .max(200, 'Lý do đổi giá tối đa 200 ký tự.'),
  /**
   * Xác nhận đổi giá vượt ngưỡng. Mặc định `false` — nguyên tắc đóng.
   *
   * Tham số RIÊNG chứ không phải "gọi lại lần hai thì cho qua": lần gọi thứ hai không mang
   * thông tin nào chứng tỏ người dùng đã ĐỌC cảnh báo, còn một cờ tường minh thì buộc màn hình
   * phải hỏi và buộc người dùng phải trả lời.
   */
  confirmLargeChange: z.coerce.boolean().default(false),
});
export type SetIssuePriceInput = z.input<typeof setIssuePriceSchema>;

export interface IssuePriceView {
  /** Giá một WPT đang có hiệu lực; trên EVM có OrderSettlement đây là giá đọc từ chain. */
  priceVnd: string;
  /** Giá lưu trong database, để vận hành nhìn thấy độ lệch sau deploy/reset. */
  configuredPriceVnd: string;
  /** Cảnh báo R7; null khi hai nguồn khớp hoặc chain không dùng OrderSettlement. */
  warning: string | null;
  /** `priceVnd` đọc từ hợp đồng OrderSettlement (FE-07: màn ghi rõ nguồn của giá áp dụng). */
  onChain: boolean;
  /** Vai đã đặt giá lần cuối; `null` khi còn dùng mặc định trong mã. */
  updatedBy: string | null;
  updatedAt: string | null;
  /** `false` = chưa ai cấu hình, con số đang dùng là mặc định ở `lib/config/issue-terms.ts`. */
  configured: boolean;
  chain: ChainKey;
}

export interface SetIssuePriceView extends IssuePriceView {
  /** Giá trước khi đổi — để màn hình xác nhận hiện được "từ ... sang ...". */
  previousPriceVnd: string;
  chain: ChainKey;
  txHash: string;
}

/**
 * Giá phát hành đang có hiệu lực, kèm vết ai đặt lúc nào.
 *
 * KHÔNG kiểm quyền: giá phát hành là con số hiển thị cho nhà đầu tư, nên chặn nó là chặn luôn
 * màn hình vị thế. Hàm này chỉ ĐỌC một tham số công khai — khác hẳn `setIssuePrice`.
 *
 * Người gọi chỉ cần con số thì dùng `readIssuePriceVnd()` ở `lib/store/config-values.ts`; hàm
 * này thêm phần siêu dữ liệu cho màn hình cấu hình.
 */
export async function getIssuePrice(chain: ChainKey): Promise<IssuePriceView> {
  const row = await getConfigStore().getConfig(issuePriceConfigKey(chain));
  const configuredPrice = row ? BigInt(row.value) : await readIssuePriceVnd(chain);
  // Cùng quy tắc chọn nguồn với màn khách hàng (`readEffectiveIssuePrice`, FE-07).
  const onChainPrice = settlesAtOnChainPrice(chain)
    ? await getLedger(chain).quotePurchase(1n)
    : null;
  const effectivePrice = onChainPrice ?? configuredPrice;
  const warning =
    onChainPrice !== null && onChainPrice !== configuredPrice
      ? 'giá trên hợp đồng khác giá đã cấu hình'
      : null;
  if (!row) {
    // Lùi về mặc định qua CÙNG một hàm mà `getLedger` dùng, không tự lấy hằng số ở đây: hai
    // nhánh lùi về mặc định viết rời nhau sẽ lệch, và lệch ở nhánh ít chạy nhất.
    return {
      priceVnd: effectivePrice.toString(),
      configuredPriceVnd: configuredPrice.toString(),
      warning,
      onChain: onChainPrice !== null,
      updatedBy: null,
      updatedAt: null,
      configured: false,
      chain,
    };
  }
  return {
    priceVnd: effectivePrice.toString(),
    configuredPriceVnd: configuredPrice.toString(),
    warning,
    onChain: onChainPrice !== null,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    configured: true,
    chain,
  };
}

/**
 * Đổi giá phát hành: kiểm quyền -> kiểm ngưỡng -> ĐẨY XUỐNG LEDGER -> ghi cơ sở dữ liệu.
 *
 * `@flow` KHÔNG gắn ở đây: `issue` là luồng phát hành nguồn cung, còn đổi giá là một thao tác
 * quản trị đứng riêng, không phải một bước của luồng đó. Gắn vào sẽ sinh ra sơ đồ mô tả một
 * trình tự không tồn tại.
 */
export async function setIssuePrice(input: unknown): Promise<Result<SetIssuePriceView>> {
  const parsed = setIssuePriceSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, priceVnd, reason, confirmLargeChange } = parsed.data;
  const configKey = issuePriceConfigKey(chain);

  const role = await currentRole();
  const store = getStore();

  try {
    // Hai lớp: quyền `treasury:manage` RỒI cờ `isConfig` của vai.
    assertCanConfigure(role);
  } catch (error) {
    // Ghi cả lần bị chặn — kênh `(audit)` cần thấy ai đã thử đổi giá.
    await store.appendAudit({
      actorRole: role,
      action: 'treasury:manage',
      target: configKey,
      outcome: 'DENIED',
      detail: error instanceof Error ? error.message : null,
      chain,
    });
    return toResult(error);
  }

  await store.appendAudit({
    actorRole: role,
    action: 'treasury:manage',
    target: configKey,
    outcome: 'ALLOWED',
    detail: null,
    chain,
  });

  try {
    // FE-07: lệnh đã chốt số VNDB theo giá cũ mà chưa quyết toán sẽ bị hợp đồng từ chối
    // (`PriceMismatch`). Kiểm TRƯỚC khi gửi giao dịch đổi giá.
    const inFlight = await countInFlightOrders(chain);
    const inFlightTotal = inFlight.PLACED + inFlight.CHECKING + inFlight.EXECUTING;
    if (inFlightTotal > 0) {
      const detail =
        `còn ${inFlightTotal} lệnh đang xử lý trên chain ${chain} ` +
        `(Đã đặt ${inFlight.PLACED}, Đang kiểm tra ${inFlight.CHECKING}, Đang quyết toán ${inFlight.EXECUTING})`;
      await store.appendAudit({
        actorRole: role,
        action: 'treasury:manage',
        target: configKey,
        outcome: 'FAILURE',
        detail: `Đổi giá bị chặn: ${detail}.`,
        chain,
      });
      return err(
        'REQUEST_STATE',
        `Chưa đổi được giá: ${detail}. Lệnh đã chốt theo giá cũ sẽ bị hợp đồng từ chối nếu đổi ` +
          'giá lúc này. Xử lý các lệnh đó ở màn Giao dịch (/transactions) trước rồi đổi giá.',
      );
    }

    const previous = await readIssuePriceVnd(chain);
    const threshold = await readPriceChangeThreshold();

    // Ngưỡng kiểm TRƯỚC khi chạm vào ledger: một lần gõ sai chữ số không được đi tới chuỗi rồi
    // mới bị chặn, vì lúc đó giá trên chuỗi đã đổi.
    if (!confirmLargeChange && exceedsThreshold(previous, priceVnd, threshold)) {
      const message =
        `Giá mới ${priceVnd} VND lệch quá ${threshold} lần so với giá đang có hiệu lực ` +
        `${previous} VND. Kiểm lại số chữ số; nếu đúng ý thì gửi lại kèm xác nhận đổi giá lớn.`;
      // `fieldErrors.confirmLargeChange` là dấu hiệu có cấu trúc để màn mở hộp xác nhận thứ hai
      // (FE-07), không phải dò chữ trong câu báo.
      return err('VALIDATION', message, { confirmLargeChange: [message] });
    }

    const ledger = getLedger(chain);

    // --- BƯỚC 1: ledger, CHỜ BIÊN NHẬN. Không CONFIRMED thì cơ sở dữ liệu KHÔNG đổi gì.
    const tx = await ledger.setPurchasePrice(priceVnd);
    const receipt = await settle(ledger, chain, tx);
    if (receipt.status !== 'CONFIRMED') {
      const pending = receipt.status === 'PENDING';
      await store.appendAudit({
        actorRole: role,
        action: 'treasury:manage',
        target: configKey,
        outcome: 'FAILURE',
        detail: pending
          ? `Đổi giá ${previous} -> ${priceVnd} VND: đã gửi, chưa có xác nhận; tx ${tx.txHash}`
          : `Đổi giá ${previous} -> ${priceVnd} VND bị chuỗi từ chối; tx ${tx.txHash}` +
            (receipt.reason ? `; ${receipt.reason}` : ''),
        chain,
      });
      return err(
        'LEDGER',
        pending
          ? 'Giao dịch đổi giá đã gửi nhưng chưa có xác nhận. Nếu chuỗi xác nhận sau, màn sẽ hiện ' +
              'cảnh báo lệch giá; khi đó đặt lại cùng giá để ghi nhận.'
          : `Chuỗi từ chối giao dịch đổi giá (tx ${tx.txHash})${receipt.reason ? `: ${receipt.reason}` : ''}. ` +
              'Giá chưa đổi.',
      );
    }

    // --- BƯỚC 2: cơ sở dữ liệu + lịch sử, nguyên khối trong cổng lưu trữ.
    let saved;
    try {
      saved = await getConfigStore().setConfig({
        key: configKey,
        value: priceVnd.toString(),
        type: 'bigint',
        changedBy: role,
        // Mã giao dịch đi cùng lý do để khối "Lịch sử đổi giá" hiện được (FE-07).
        reason: `${reason}; tx ${tx.txHash}`,
      });
    } catch (dbError) {
      /**
       * ĐẨY LẠI GIÁ CŨ xuống ledger. Không có bước này thì ledger bán theo giá mới trong khi
       * cơ sở dữ liệu (và mọi màn hình) vẫn hiện giá cũ — hỏng đúng theo chiều tệ hơn cả lúc
       * chưa có `setPurchasePrice`, vì lần này người dùng còn nhận được thông báo thất bại và
       * tin rằng không có gì đã đổi.
       *
       * Lỗi của chính bước hoàn nguyên KHÔNG che lỗi gốc: gộp hai lý do vào một thông báo để
       * người vận hành thấy cả hai, rồi vẫn trả lỗi. Đây là tình huống cần người can thiệp, nên
       * thông báo phải nói ra số cần đặt lại.
       */
      let rollbackNote = `Đã hoàn nguyên giá trên ledger về ${previous} VND.`;
      try {
        // Hoàn nguyên cũng chờ biên nhận: "đã gửi" chưa phải "đã hoàn nguyên".
        const rollback = await settle(ledger, chain, await ledger.setPurchasePrice(previous));
        if (rollback.status !== 'CONFIRMED') {
          rollbackNote =
            `⚠️ Giao dịch hoàn nguyên giá về ${previous} VND (tx ${rollback.txHash}) ` +
            `${rollback.status === 'PENDING' ? 'chưa có xác nhận' : 'bị chuỗi từ chối'}: ledger có thể ` +
            `đang là ${priceVnd} VND còn cơ sở dữ liệu vẫn là ${previous} VND. Kiểm lại và đặt lại thủ công.`;
        }
      } catch (rollbackError) {
        rollbackNote =
          `⚠️ KHÔNG hoàn nguyên được giá trên ledger: ledger đang là ${priceVnd} VND còn cơ sở ` +
          `dữ liệu vẫn là ${previous} VND. Phải đặt lại thủ công. ` +
          `Lý do hoàn nguyên thất bại: ${rollbackError instanceof Error ? rollbackError.message : 'không rõ'}`;
      }

      await store.appendAudit({
        actorRole: role,
        action: 'treasury:manage',
        target: configKey,
        outcome: 'FAILURE',
        detail: `Ghi giá ${priceVnd} vào cơ sở dữ liệu thất bại. ${rollbackNote}`,
        chain,
      });

      return err(
        'UNKNOWN',
        `Không ghi được giá mới vào cơ sở dữ liệu nên giá chưa đổi. ${rollbackNote} ` +
          `Nguyên nhân: ${dbError instanceof Error ? dbError.message : 'không rõ'}`,
      );
    }

    await store.appendAudit({
      actorRole: role,
      action: 'treasury:manage',
      target: configKey,
      outcome: 'SUCCESS',
      detail: `Giá phát hành ${previous} -> ${priceVnd} VND; tx ${tx.txHash}; lý do: ${reason}`,
      chain,
    });

    return ok({
      priceVnd: saved.value,
      configuredPriceVnd: saved.value,
      warning: null,
      onChain: settlesAtOnChainPrice(chain),
      previousPriceVnd: previous.toString(),
      updatedBy: saved.updatedBy,
      updatedAt: saved.updatedAt,
      configured: true,
      chain,
      txHash: tx.txHash,
    });
  } catch (error) {
    return toResult(error);
  }
}

/** Lệnh còn có thể quyết toán theo giá đã chốt, tức đổi giá lúc này sẽ làm hợp đồng từ chối chúng. */
const IN_FLIGHT_STATUSES = ['PLACED', 'CHECKING', 'EXECUTING'] as const satisfies readonly OrderStatus[];
type InFlightCounts = Record<(typeof IN_FLIGHT_STATUSES)[number], number>;

/** Đếm lệnh đang xử lý trên MỘT chain, theo từng trạng thái (đếm ở cơ sở dữ liệu, không cắt trang). */
export async function countInFlightOrders(chain: ChainKey): Promise<InFlightCounts> {
  const orders = getOrderStore();
  const counts = await Promise.all(IN_FLIGHT_STATUSES.map((status) => orders.countOrders({ chain, status })));
  return { PLACED: counts[0], CHECKING: counts[1], EXECUTING: counts[2] };
}

/**
 * Chờ biên nhận theo timeout của chain. Chờ ném lỗi thì coi như PENDING: lỗi đọc biên nhận không
 * nói gì về kết cục của giao dịch (cùng luật HF-05).
 */
async function settle(ledger: ILedgerPort, chain: ChainKey, tx: TxResult): Promise<TxResult> {
  try {
    return await ledger.waitReceipt(tx.txHash, receiptTimeoutFor(chain));
  } catch {
    return { txHash: tx.txHash, status: 'PENDING' };
  }
}

/**
 * Giá mới lệch quá `threshold` LẦN so với giá cũ, theo cả hai chiều.
 *
 * So bằng phép NHÂN chứ không phép chia: `priceVnd` và `previous` là `bigint`, và chia `bigint`
 * lấy phần nguyên nên `150000n / 100000n === 1n` — đúng bằng ngưỡng, tức là mọi mức lệch dưới
 * hai lần đều bị làm tròn thành "không lệch", và phép kiểm mất tác dụng ở đúng vùng nó cần đo.
 *
 * `threshold` là `number` (hệ số, có thể không nguyên) nên quy về `bigint` bằng cách nhân cả hai
 * vế với 1000 rồi bỏ phần lẻ — đủ chính xác cho một hệ số cấu hình, và không làm phép so sánh
 * tụt về `number` nơi giá 78 chữ số mất chính xác.
 */
function exceedsThreshold(previous: bigint, next: bigint, threshold: number): boolean {
  const SCALE = 1000n;
  const scaled = BigInt(Math.round(threshold * 1000));

  // Tăng quá ngưỡng: next > previous * threshold
  if (next * SCALE > previous * scaled) return true;
  // Giảm quá ngưỡng: next < previous / threshold  <=>  next * threshold < previous
  if (next * scaled < previous * SCALE) return true;
  return false;
}

// ===========================================================================
//  MÀN /config "Giá và phát hành" (FE-07)
// ===========================================================================

/** Một dòng "Lịch sử đổi giá". `txHash` tách từ đuôi lý do "...; tx 0x..." mà `setIssuePrice` ghi. */
export interface PriceHistoryRow {
  changedAt: string;
  changedBy: ConfigHistoryRecord['changedBy'];
  oldValue: string | null;
  newValue: string;
  reason: string | null;
  txHash: string | null;
}

export interface IssuanceOverview {
  tokenSymbol: string;
  /** Trần phát hành theo bảng dự án. */
  cap: string;
  /** Tổng cung đọc từ chuỗi. */
  supply: string;
  /** Phần còn được phát hành: trần trừ tổng cung, không âm. */
  remaining: string;
  /** Tổng cung vượt trần: tình huống đối soát, màn hiện cảnh báo. */
  overCap: boolean;
  issuedAt: string | null;
  /** Ví thanh toán SPV theo chuỗi; `null` khi chưa phát hành lần đầu. */
  spvWallet: string | null;
}

export interface PriceConfigOverview {
  chain: ChainKey;
  /** Khối "Giá phát hành". Phần riêng có kết quả riêng: lỗi đọc chuỗi không làm mất cả màn. */
  price: Result<IssuePriceView>;
  /** Ngưỡng cảnh báo đổi giá (hệ số, `wpt.price_change_threshold`). */
  thresholdTimes: number;
  /** Vai đang xem đổi được giá: `treasury:manage` VÀ cờ cấu hình của vai. Tính sẵn ở máy chủ. */
  canEdit: boolean;
  /** Khối "Tình trạng phát hành"; `ok(null)` khi chain chưa có dự án. */
  issuance: Result<IssuanceOverview | null>;
  /** Khối "Lịch sử đổi giá", 20 dòng mới nhất. */
  history: PriceHistoryRow[];
  /** Lệnh đang xử lý trên chain: có thì đổi giá bị chặn, màn báo trước khi người dùng gõ. */
  inFlightOrders: InFlightCounts;
}

const PRICE_HISTORY_LIMIT = 20;
const TX_SUFFIX = /;\s*tx\s+(0x[0-9a-fA-F]+)\s*$/;

/** Tách mã giao dịch khỏi lý do lưu trong lịch sử. Dòng cũ (trước FE-07) không có mã thì `null`. */
export function splitHistoryReason(reason: string | null): { reason: string | null; txHash: string | null } {
  if (!reason) return { reason, txHash: null };
  const match = TX_SUFFIX.exec(reason);
  if (!match) return { reason, txHash: null };
  return { reason: reason.slice(0, match.index).trim() || null, txHash: match[1] };
}

async function partOf<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await run());
  } catch (error) {
    return toResult(error);
  }
}

async function readIssuanceOverview(chain: ChainKey): Promise<IssuanceOverview | null> {
  const [project] = await getProjectStore().listProjects({ chain });
  if (!project) return null;
  const [{ cap, supply, remaining }, spvWallet] = await Promise.all([
    remainingIssuanceCap(chain, project),
    getLedger(chain).spvWallet(),
  ]);
  return {
    tokenSymbol: project.tokenSymbol,
    cap: cap.toString(),
    supply: supply.toString(),
    remaining: remaining.toString(),
    overCap: supply > cap,
    issuedAt: project.issuedAt,
    spvWallet,
  };
}

/**
 * Dữ liệu MỘT lần mở màn `/config` (FE-07): bốn khối trong một lượt, các lời đọc chạy song song.
 *
 * Kiểm quyền bằng `assertCan('ops:read')`, KHÔNG `authorize`: mở màn là phép đọc, ghi sổ kiểm toán
 * ở đây là lấp sổ bằng dòng ALLOWED (lệch L-01). Cũng vì vậy màn không dùng `getIssuanceStatus`.
 */
const priceConfigOverviewSchema = z.object({ chain: chainSchema });

export async function getPriceConfigOverview(input: unknown): Promise<Result<PriceConfigOverview>> {
  const parsed = priceConfigOverviewSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  try {
    const role = await currentRole();
    assertCan(role, 'ops:read');
    const key = issuePriceConfigKey(parsed.data.chain);

    const [price, thresholdTimes, issuance, history, inFlightOrders] = await Promise.all([
      partOf(() => getIssuePrice(parsed.data.chain)),
      readPriceChangeThreshold(),
      partOf(() => readIssuanceOverview(parsed.data.chain)),
      getConfigStore().listConfigHistory({ key, limit: PRICE_HISTORY_LIMIT }),
      countInFlightOrders(parsed.data.chain),
    ]);

    return ok({
      chain: parsed.data.chain,
      price,
      thresholdTimes,
      canEdit: can(role, 'treasury:manage') && isConfigRole(role),
      issuance,
      history: history.map((row) => ({
        changedAt: row.changedAt,
        changedBy: row.changedBy,
        oldValue: row.oldValue,
        newValue: row.newValue,
        ...splitHistoryReason(row.reason),
      })),
      inFlightOrders,
    });
  } catch (error) {
    return toResult(error);
  }
}
