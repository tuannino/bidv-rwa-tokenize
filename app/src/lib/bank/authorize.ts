import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { LedgerError, InvalidAddressError } from '@/lib/ledger';
import { KycProviderError } from '@/lib/providers/kyc';
import { ForbiddenError, assertCan, type Action, type Role } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';
import { SignerUnavailableError } from '@/lib/signer';
import { getStore } from '@/lib/store';
import { err, type Result } from './result';

/**
 * Guard + quy lỗi dùng chung cho MỌI nghiệp vụ trong `lib/bank/`.
 *
 * Trước đây hai hàm này nằm private trong `mint.service.ts`. Tách ra khi có nghiệp vụ thứ
 * hai cần đúng hành vi đó (`portfolio.service.ts`): sao chép sẽ tạo **hai đường ghi audit**
 * song song, và chúng sẽ lệch nhau ở lần sửa đầu tiên — sổ kiểm toán mà thiếu bản ghi thì
 * không dùng được để đối chiếu trách nhiệm.
 */

/** Quy lỗi ném ra thành `Result` có mã — một chỗ, dùng cho mọi nghiệp vụ. */
export function toResult<T>(error: unknown): Result<T> {
  if (error instanceof ForbiddenError) return err('FORBIDDEN', error.message);
  if (error instanceof InvalidAddressError) return err('VALIDATION', error.message);
  if (error instanceof SignerUnavailableError) return err('SIGNER', error.message);
  if (error instanceof KycProviderError) return err('PROVIDER', error.message);
  if (error instanceof LedgerError) return err('LEDGER', error.message);
  return err('UNKNOWN', error instanceof Error ? error.message : 'Lỗi không xác định.');
}

/**
 * Kiểm quyền RỒI ghi audit cho CẢ hai kết cục.
 *
 * Ghi cả lần bị chặn là có chủ ý — kênh `(audit)` cần thấy ai đã thử làm gì.
 */
export async function authorize(
  action: Action,
  target: string | null,
  chain: ChainKey | null,
): Promise<Role> {
  const role = await currentRole();
  const store = getStore();
  try {
    assertCan(role, action);
  } catch (error) {
    await store.appendAudit({
      actorRole: role,
      action,
      target,
      outcome: 'DENIED',
      detail: error instanceof Error ? error.message : null,
      chain,
    });
    throw error;
  }
  await store.appendAudit({
    actorRole: role,
    action,
    target,
    outcome: 'ALLOWED',
    detail: null,
    chain,
  });
  return role;
}
