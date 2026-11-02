import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { getLedger } from '@/lib/ledger';
import { getDistributionStore, getProjectStore, getWalletBindingStore } from '@/lib/store';
import { findCustomerProfile } from './account-profile.service';
import { readOrNull } from './read-or-null';
import { assertCan, can } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { toResult } from './authorize';
import { err, ok, type Result } from './result';
import { chainSchema } from './schemas';

/** FIX-05: giới hạn đọc mỗi nguồn; chạm giới hạn thì báo `truncated`, không đọc thêm. */
export const OVERVIEW_PERIOD_LIMIT = 100;
export const OVERVIEW_BINDING_LIMIT = 200;
/** Số kỳ gần nhất trên biểu đồ lợi tức. */
export const OVERVIEW_SERIES_LENGTH = 6;

export interface OpsOverview {
  chain: ChainKey;
  /** Số dự án đã phát hành token trên chain (`status = ISSUED`); `null` khi đọc lỗi. */
  issuedProjects: number | null;
  /** Tổng cung token trên chuỗi; `null` khi đọc lỗi. */
  supply: { symbol: string; totalSupply: string } | null;
  /** Số hồ sơ nhà đầu tư có ít nhất một ví đã gắn; `null` khi đọc lỗi. */
  investors: { count: number; truncated: boolean } | null;
  /** Kỳ chia đã hoàn tất (`COMPLETED`): tổng VNDB, số kỳ, 6 kỳ gần nhất (cũ trước); `null` khi đọc lỗi. */
  profit: {
    totalAmount: string;
    periods: number;
    truncated: boolean;
    series: Array<{ periodKey: string; amount: string }>;
  } | null;
}

/** FIX-05: số liệu tổng hợp cho màn Tổng quan. Chỉ đọc; mỗi nguồn lỗi thì trường đó `null`. */
export async function getOpsOverview(chain: unknown): Promise<Result<OpsOverview>> {
  const parsed = chainSchema.safeParse(chain);
  if (!parsed.success) return err('VALIDATION', 'Chain không hợp lệ.');
  try {
    // Đọc khi mở màn: assertCan, KHÔNG authorize (authorize ghi sổ kiểm toán mỗi lần, lệch L-01).
    assertCan(await currentRole(), 'ops:read');
    const key = parsed.data;
    const [projects, info, bindings, periods] = await Promise.all([
      readOrNull('overview', 'listProjects', () => getProjectStore().listProjects({ chain: key, status: 'ISSUED' })),
      readOrNull('overview', 'tokenInfo', () => getLedger(key).tokenInfo()),
      readOrNull('overview', 'walletBindings', () => getWalletBindingStore().list(key, OVERVIEW_BINDING_LIMIT)),
      readOrNull('overview', 'listPeriods', () =>
        getDistributionStore().listPeriods({ chain: key, status: 'COMPLETED', limit: OVERVIEW_PERIOD_LIMIT }),
      ),
    ]);
    return ok({
      chain: key,
      issuedProjects: projects ? projects.length : null,
      supply: info ? { symbol: info.symbol, totalSupply: info.totalSupply.toString() } : null,
      investors: bindings
        ? {
            count: new Set(
              bindings
                // Hồ sơ Nhà đầu tư: quyền `portfolio:read` chỉ vai Nhà đầu tư có; kiểm qua RBAC, không so vai cứng (luật 3).
                .filter((row) => {
                  const profile = findCustomerProfile(row.actorId);
                  return profile !== null && can(profile.role, 'portfolio:read');
                })
                .map((row) => row.actorId),
            ).size,
            truncated: bindings.length >= OVERVIEW_BINDING_LIMIT,
          }
        : null,
      profit: periods
        ? {
            totalAmount: periods.reduce((sum, row) => sum + BigInt(row.totalAmount), 0n).toString(),
            periods: periods.length,
            truncated: periods.length >= OVERVIEW_PERIOD_LIMIT,
            series: periods
              .slice(0, OVERVIEW_SERIES_LENGTH)
              .reverse()
              .map((row) => ({ periodKey: row.periodKey, amount: row.totalAmount })),
          }
        : null,
    });
  } catch (error) {
    return toResult(error);
  }
}
