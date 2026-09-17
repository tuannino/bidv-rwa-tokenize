import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { getStore } from '@/lib/store';
import { authorize, toResult } from './authorize';
import { WPT_ISSUE_PRICE_VND, wptToVnd } from './issuance';
import { err, ok, type Result } from './result';
import { chainSchema, walletSchema } from './schemas';
import type { TxnView } from './mint.service';

/**
 * Nghiệp vụ VỊ THẾ NHÀ ĐẦU TƯ — chỉ đọc.
 *
 * Kiểm quyền và lọc theo ví đều nằm ở tầng này, không ở giao diện: server action gọi được
 * bằng POST trực tiếp (không qua UI), nên guard đặt ở component là guard không tồn tại.
 *
 * LUẬT #1 chain qua `getLedger()` · LUẬT #3 quyền qua `authorize()` -> `assertCan()`.
 *
 * ⚠️ GIỚI HẠN ĐÃ BIẾT: chưa có SIWE (AU-01) nên server KHÔNG biết ví nào thuộc phiên — ví chỉ
 * tồn tại ở client qua wagmi. Vì vậy hàm ở đây bảo đảm được "danh sách trả về không lẫn giao
 * dịch của ví khác", nhưng KHÔNG chặn được người dùng chủ động tra ví khác. Ràng buộc ví ↔ phiên
 * là việc của AU-01. Đã ghi thành câu hỏi mở trong checkpoint.
 */

const portfolioQuerySchema = z.object({
  chain: chainSchema,
  wallet: walletSchema,
});

const walletTxnQuerySchema = portfolioQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export interface PortfolioView {
  wallet: string;
  chain: ChainKey;
  /** Số dư WPT — ĐỌC TỪ CHAIN. Chuỗi vì bigint không qua được biên server -> client. */
  balance: string;
  /** Quy đổi theo giá phát hành, KHÔNG phải giá thị trường (xem `issuance.ts`). */
  valueVnd: string;
  issuePriceVnd: number;
  whitelisted: boolean;
  frozen: boolean;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    /** Tổng cung — ĐỌC TỪ CHAIN. */
    totalSupply: string;
  };
  /**
   * KHÔNG có trường số dư VNDB: `ILedgerPort` chưa có phương thức đọc số dư token thanh toán.
   * Thêm trường trả 0 sẽ là bịa số, nên bỏ hẳn và để giao diện ẩn phần đó — nợ chờ BE-01.
   */
}

/**
 * Vị thế của một ví trên một chain: số dư, trạng thái tuân thủ, và thông số token.
 *
 * Đọc `balanceOf` + `tokenInfo` song song vì hai lời gọi độc lập; một trong hai lỗi thì cả hàm
 * trả lỗi có mã, để hộp giao diện tương ứng tự hiện lỗi mà không làm sập hộp khác.
 */
export async function getPortfolio(input: unknown): Promise<Result<PortfolioView>> {
  const parsed = portfolioQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet } = parsed.data;

  try {
    await authorize('portfolio:read', wallet, chain);

    const ledger = getLedger(chain);
    const [balance, whitelisted, frozen, info] = await Promise.all([
      ledger.balanceOf(wallet),
      ledger.isWhitelisted(wallet),
      ledger.isFrozen(wallet),
      ledger.tokenInfo(),
    ]);

    const balanceString = balance.toString();

    return ok({
      wallet,
      chain,
      balance: balanceString,
      valueVnd: wptToVnd(balanceString),
      issuePriceVnd: WPT_ISSUE_PRICE_VND,
      whitelisted,
      frozen,
      token: {
        name: info.name,
        symbol: info.symbol,
        decimals: info.decimals,
        totalSupply: info.totalSupply.toString(),
      },
    });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Lịch sử giao dịch CỦA MỘT VÍ.
 *
 * `wallet` là **bắt buộc** trong schema — cố ý. `listTxns` không truyền `wallet` sẽ trả về giao
 * dịch của mọi ví; để trường này optional là mở đường cho một lần gọi thiếu tham số làm rò dữ
 * liệu ví khác ra giao diện nhà đầu tư. Bắt buộc ở schema thì lỗi đó thành lỗi validate, không
 * thành lỗi dữ liệu.
 *
 * Lọc do store thực hiện (case-insensitive trên cả `fromWallet` và `toWallet`, ở cả bản memory
 * và bản Postgres), nên giao diện không phải lọc lại và không được lọc lại.
 */
export async function getWalletTransactions(input: unknown): Promise<Result<TxnView[]>> {
  const parsed = walletTxnQuerySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { chain, wallet, limit } = parsed.data;

  try {
    await authorize('portfolio:read', wallet, chain);

    const rows = await getStore().listTxns({ chain, wallet, limit });

    return ok(
      rows.map((row) => ({
        id: row.id,
        chain: row.chain,
        operation: row.operation,
        txHash: row.txHash,
        status: row.status,
        fromWallet: row.fromWallet,
        toWallet: row.toWallet,
        amount: row.amount,
        reason: row.reason,
        actorRole: row.actorRole,
        createdAt: row.createdAt,
      })),
    );
  } catch (error) {
    return toResult(error);
  }
}

export interface TokenSummary {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  chain: ChainKey;
  issuePriceVnd: number;
}

/**
 * Thông số token trên chain đang chọn — dùng cho hộp trạng thái phát hành, không cần ví.
 *
 * Tách khỏi `getPortfolio` để hộp này hiển thị được khi ví chưa kết nối, và để một hộp lỗi
 * không kéo hộp khác theo.
 */
export async function getTokenSummary(chain: unknown): Promise<Result<TokenSummary>> {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) {
    return err('VALIDATION', 'Chain không hợp lệ.');
  }

  try {
    await authorize('portfolio:read', null, parsed.data);
    const info = await getLedger(parsed.data).tokenInfo();

    return ok({
      name: info.name,
      symbol: info.symbol,
      decimals: info.decimals,
      totalSupply: info.totalSupply.toString(),
      chain: parsed.data,
      issuePriceVnd: WPT_ISSUE_PRICE_VND,
    });
  } catch (error) {
    return toResult(error);
  }
}
