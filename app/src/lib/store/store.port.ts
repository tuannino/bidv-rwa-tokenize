import type { ChainKey, TxStatus } from '@bidv/shared';
import type { Action, Role } from '@/lib/rbac';

/**
 * Cổng lưu trữ giao dịch + audit log.
 *
 * Có hai hiện thực chọn bằng flag `USE_MOCK_DB`:
 *   - `memory` (mặc định): chạy được ở free-tier, nơi không có Postgres.
 *   - `prisma`  : Postgres thật, dùng khi `docker compose up`.
 * Nghiệp vụ chỉ thấy interface này.
 */

export interface TxnRecord {
  id: string;
  chain: ChainKey;
  /** Tên nghiệp vụ: 'mint' | 'whitelist' | 'burn' | ... */
  operation: string;
  txHash: string;
  status: TxStatus;
  /** Ví nguồn (null khi phát hành). */
  fromWallet: string | null;
  toWallet: string | null;
  /** Lưu chuỗi: bigint không JSON-hoá được và Postgres numeric an toàn hơn int8. */
  amount: string | null;
  reason: string | null;
  /** Vai trò đã thực hiện — phục vụ đối soát trách nhiệm. */
  actorRole: Role;
  actorAddress: string | null;
  createdAt: string;
}

export type NewTxn = Omit<TxnRecord, 'id' | 'createdAt'>;

export interface AuditRecord {
  id: string;
  actorRole: Role;
  action: Action | string;
  /** Đối tượng bị tác động (ví, mã hồ sơ KYC, ...). */
  target: string | null;
  outcome: 'ALLOWED' | 'DENIED' | 'SUCCESS' | 'FAILURE';
  detail: string | null;
  chain: ChainKey | null;
  createdAt: string;
}

export type NewAudit = Omit<AuditRecord, 'id' | 'createdAt'>;

export interface ITxnStore {
  readonly kind: 'memory' | 'prisma';
  saveTxn(txn: NewTxn): Promise<TxnRecord>;
  updateTxnStatus(id: string, status: TxStatus, reason?: string): Promise<void>;
  listTxns(options?: { chain?: ChainKey; wallet?: string; limit?: number }): Promise<TxnRecord[]>;
  appendAudit(entry: NewAudit): Promise<AuditRecord>;
  listAudit(options?: { limit?: number }): Promise<AuditRecord[]>;
}
