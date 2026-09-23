import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { CONFIG_KEYS } from '@/lib/config/issue-terms';
import { getLedger } from '@/lib/ledger';
import { assertCanConfigure } from '@/lib/rbac/config-role';
import { currentRole } from '@/lib/rbac/session';
import { getConfigStore, getStore } from '@/lib/store';
import { readIssuePriceVnd, readPriceChangeThreshold } from '@/lib/store/config-values';
import { toResult } from './authorize';
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
  reason: z.string().trim().max(200).optional(),
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
  /** Giá một WPT, đơn vị VND. Chuỗi vì bigint không qua được biên server -> client. */
  priceVnd: string;
  /** Vai đã đặt giá lần cuối; `null` khi còn dùng mặc định trong mã. */
  updatedBy: string | null;
  updatedAt: string | null;
  /** `false` = chưa ai cấu hình, con số đang dùng là mặc định ở `lib/config/issue-terms.ts`. */
  configured: boolean;
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
export async function getIssuePrice(): Promise<IssuePriceView> {
  const row = await getConfigStore().getConfig(CONFIG_KEYS.issuePriceVnd);
  if (!row) {
    // Lùi về mặc định qua CÙNG một hàm mà `getLedger` dùng, không tự lấy hằng số ở đây: hai
    // nhánh lùi về mặc định viết rời nhau sẽ lệch, và lệch ở nhánh ít chạy nhất.
    return {
      priceVnd: (await readIssuePriceVnd()).toString(),
      updatedBy: null,
      updatedAt: null,
      configured: false,
    };
  }
  return {
    priceVnd: BigInt(row.value).toString(),
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    configured: true,
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
      target: CONFIG_KEYS.issuePriceVnd,
      outcome: 'DENIED',
      detail: error instanceof Error ? error.message : null,
      chain,
    });
    return toResult(error);
  }

  await store.appendAudit({
    actorRole: role,
    action: 'treasury:manage',
    target: CONFIG_KEYS.issuePriceVnd,
    outcome: 'ALLOWED',
    detail: null,
    chain,
  });

  try {
    const previous = await readIssuePriceVnd();
    const threshold = await readPriceChangeThreshold();

    // Ngưỡng kiểm TRƯỚC khi chạm vào ledger: một lần gõ sai chữ số không được đi tới chuỗi rồi
    // mới bị chặn, vì lúc đó giá trên chuỗi đã đổi.
    if (!confirmLargeChange && exceedsThreshold(previous, priceVnd, threshold)) {
      return err(
        'VALIDATION',
        `Giá mới ${priceVnd} VND lệch quá ${threshold} lần so với giá đang có hiệu lực ` +
          `${previous} VND. Kiểm lại số chữ số; nếu đúng ý thì gửi lại kèm xác nhận đổi giá lớn.`,
      );
    }

    const ledger = getLedger(chain);

    // --- BƯỚC 1: ledger. Thất bại ở đây thì cơ sở dữ liệu KHÔNG đổi gì.
    const tx = await ledger.setPurchasePrice(priceVnd);

    // --- BƯỚC 2: cơ sở dữ liệu + lịch sử, nguyên khối trong cổng lưu trữ.
    let saved;
    try {
      saved = await getConfigStore().setConfig({
        key: CONFIG_KEYS.issuePriceVnd,
        value: priceVnd.toString(),
        type: 'bigint',
        changedBy: role,
        reason: reason ?? null,
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
        await ledger.setPurchasePrice(previous);
      } catch (rollbackError) {
        rollbackNote =
          `⚠️ KHÔNG hoàn nguyên được giá trên ledger: ledger đang là ${priceVnd} VND còn cơ sở ` +
          `dữ liệu vẫn là ${previous} VND. Phải đặt lại thủ công. ` +
          `Lý do hoàn nguyên thất bại: ${rollbackError instanceof Error ? rollbackError.message : 'không rõ'}`;
      }

      await store.appendAudit({
        actorRole: role,
        action: 'treasury:manage',
        target: CONFIG_KEYS.issuePriceVnd,
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
      target: CONFIG_KEYS.issuePriceVnd,
      outcome: 'SUCCESS',
      detail: `Giá phát hành ${previous} -> ${priceVnd} VND; tx ${tx.txHash}${reason ? `; lý do: ${reason}` : ''}`,
      chain,
    });

    return ok({
      priceVnd: saved.value,
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
