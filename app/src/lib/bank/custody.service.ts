import 'server-only';

import { z } from 'zod';
import type { ChainKey } from '@bidv/shared';
import {
  fireblocksChainScope,
  fireblocksConfig,
  type FireblocksChainScope,
} from '@/lib/custody/fireblocks-config';
import { getConfigStore, getStore } from '@/lib/store';
import { authorize, toResult } from './authorize';
import { err, ok, type Result } from './result';

/**
 * IN-04: công tắc "Lưu ký Fireblocks" (requirements A3, QĐ-5, QĐ-13).
 *
 * Công tắc là cấu hình hệ thống dùng chung (`SystemConfig`, có lịch sử). `enabled` là ĐÚNG giá trị
 * người vận hành đã chọn; `configured` là cấu hình Fireblocks hiện có đủ hay không. Hai giá trị KHÔNG
 * gộp: công tắc bật mà mất cấu hình thì lần duyệt bị chặn, không bao giờ tự quay về khoá máy chủ.
 */

export const CUSTODY_CONFIG_KEY = 'custody.fireblocks.enabled';

export interface CustodyState {
  enabled: boolean;
  configured: boolean;
  configError: string | null;
  scope: FireblocksChainScope;
}

export interface CustodyLayoutState extends CustodyState {
  /** Đọc công tắc lỗi: chỉ dùng để hiển thị, KHÔNG dùng để quyết định cách thực hiện. */
  unreadable: boolean;
}

export type CustodyChoice = 'SERVER' | 'FIREBLOCKS' | 'UNRESOLVED';

function stateWith(enabled: boolean): CustodyState {
  const { config, reason } = fireblocksConfig();
  return {
    enabled,
    configured: config !== null,
    configError: config ? null : reason,
    scope: fireblocksChainScope(),
  };
}

/** Trạng thái dùng ở lần duyệt. Đọc lỗi thì NÉM: người gọi chặn lần duyệt, không đoán. */
export async function getCustodyState(): Promise<CustodyState> {
  const record = await getConfigStore().getConfig(CUSTODY_CONFIG_KEY);
  return stateWith(record?.value === 'true');
}

/** Trạng thái cho thanh điều hướng và dòng "Thực hiện qua": đọc lỗi thì báo `unreadable`, không ném. */
export async function getCustodyStateForLayout(): Promise<CustodyLayoutState> {
  try {
    return { ...(await getCustodyState()), unreadable: false };
  } catch (error) {
    console.error('[custody] Không đọc được trạng thái Lưu ký Fireblocks:', error instanceof Error ? error.name : 'Error');
    return { ...stateWith(false), unreadable: true };
  }
}

/**
 * Cách thực hiện lần duyệt trên `chain` (hàm thuần, requirements A3):
 * - công tắc tắt: `SERVER`;
 * - bật, bảng chain đọc không được: `UNRESOLVED` (lần duyệt bị chặn);
 * - bật, chain có trong bảng: `FIREBLOCKS`, BẤT KỂ `configured` (thiếu cấu hình thì lần duyệt chặn);
 * - bật, chain không có trong bảng: `SERVER`.
 */
export function custodyFor(chain: ChainKey, state: Pick<CustodyState, 'enabled' | 'scope'>): CustodyChoice {
  if (!state.enabled) return 'SERVER';
  if (!state.scope.ok) return 'UNRESOLVED';
  return state.scope.chainAssets[chain] !== undefined ? 'FIREBLOCKS' : 'SERVER';
}

const setCustodySchema = z.object({
  enabled: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

const label = (enabled: boolean) => (enabled ? 'bật' : 'tắt');

/** Bật, tắt công tắc. BẬT cần cấu hình đủ; TẮT luôn được. Mỗi lần đổi có lịch sử và dòng sổ. */
export async function setFireblocksCustody(input: unknown): Promise<Result<CustodyState>> {
  const parsed = setCustodySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  }
  const { enabled, reason } = parsed.data;
  try {
    const role = await authorize('custody:toggle', CUSTODY_CONFIG_KEY, null);
    const before = await getCustodyState();
    if (enabled && !before.configured) {
      return err('VALIDATION', 'Chưa cấu hình Fireblocks (khoá API, vault); không bật được.');
    }
    await getConfigStore().setConfig({
      key: CUSTODY_CONFIG_KEY,
      value: String(enabled),
      type: 'boolean',
      changedBy: role,
      reason: reason || null,
    });
    await getStore().appendAudit({
      actorRole: role,
      action: 'custody:toggle',
      target: CUSTODY_CONFIG_KEY,
      outcome: 'SUCCESS',
      detail: `Lưu ký Fireblocks: ${label(before.enabled)} sang ${label(enabled)}${reason ? ` (${reason})` : ''}`,
      chain: null,
    });
    return ok({ ...before, enabled });
  } catch (error) {
    return toResult(error);
  }
}
