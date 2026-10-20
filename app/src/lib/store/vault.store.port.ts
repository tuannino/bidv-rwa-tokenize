import type { ChainKey } from '@bidv/shared';
import { assertStatus, type StoreKind } from './store.errors';

/**
 * Cổng lưu trữ vận hành VAULT (BE-13): khoá vận hành bền theo chain (QĐ-D).
 *
 * Cổng này chỉ LƯU TRỮ. Ai được lấy khoá, giữ khoá bao lâu và khi nào nhả là việc của
 * `lib/bank/vault.service.ts` (cấu hình) và service rút.
 */

/** `CONFIG`: một lần lưu cấu hình khoá. `WITHDRAW`: một lệnh rút đang dở. */
export const VAULT_OPERATION_KINDS = ['CONFIG', 'WITHDRAW'] as const;
export type VaultOperationKind = (typeof VAULT_OPERATION_KINDS)[number];

export const assertVaultOperationKind = (value: string): VaultOperationKind =>
  assertStatus('VaultOperationLock', VAULT_OPERATION_KINDS, value);

export interface VaultOperationLockRecord {
  chain: ChainKey;
  kind: VaultOperationKind;
  refId: string;
  actor: string;
  acquiredAt: string;
}

export interface AcquireVaultLockInput {
  chain: ChainKey;
  kind: VaultOperationKind;
  refId: string;
  actor: string;
  /**
   * Chỉ cho lần lấy khoá `CONFIG`: khoá `CONFIG` đang giữ mà lấy từ TRƯỚC mốc này (treo quá thời
   * gian chờ biên nhận) thì bị tiếp quản trong cùng một câu lệnh. Khoá `WITHDRAW` không bao giờ
   * bị tiếp quản.
   */
  takeOverConfigBefore?: Date;
}

export interface IVaultStore {
  readonly kind: StoreKind;

  /**
   * Lấy khoá vận hành của chain bằng MỘT câu ghi. Trả bản ghi khoá khi lấy được, `null` khi chain
   * đang có thao tác khác giữ khoá. KHÔNG đọc trước rồi ghi: hai tiến trình cùng đọc "chưa ai giữ"
   * sẽ cùng gửi giao dịch.
   */
  acquireOperationLock(input: AcquireVaultLockInput): Promise<VaultOperationLockRecord | null>;

  /** Nhả khoá nếu nó còn thuộc `refId`; `false` khi khoá đã bị tiếp quản hoặc không còn. */
  releaseOperationLock(input: { chain: ChainKey; refId: string }): Promise<boolean>;

  findOperationLock(chain: ChainKey): Promise<VaultOperationLockRecord | null>;
}
