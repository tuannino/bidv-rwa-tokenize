import 'server-only';

import { randomUUID } from 'node:crypto';
import { memoryState } from './memory.state';
import { assertAmount, UniqueConstraintError } from './store.errors';
import {
  assertTokenRequestBurnSource,
  assertTokenRequestStatus,
  assertTokenRequestTransition,
  assertTokenRequestType,
  DECISION_STATUSES,
  type ITokenRequestStore,
  type NewTokenRequest,
  OUTCOME_STATUSES,
  type TokenRequestRecord,
  type TokenRequestTransition,
} from './token-request.store.port';

/**
 * Yêu cầu Mint / Burn trong bộ nhớ — mặc định, chạy được ở free-tier.
 *
 * ⚠️ Phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3): cùng ràng buộc `TokenRequest_txHash_key`,
 * cùng bảng chuyển tiếp một chiều, cùng lớp lỗi.
 *
 * Mỗi hàm ghi chạy đồng bộ từ lúc tìm dòng tới lúc đổi dòng (không `await` ở giữa), nên hai lời
 * gọi đồng thời trên cùng tiến trình cũng chỉ một bên đổi được — cùng kết quả với câu `UPDATE`
 * có điều kiện của bản Postgres.
 */

interface TokenRequestState {
  requests: TokenRequestRecord[];
}

const state = (): TokenRequestState => memoryState('tokenRequest', () => ({ requests: [] }));

const newestFirst = (a: TokenRequestRecord, b: TokenRequestRecord) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/** Postgres coi mỗi NULL là khác nhau, nên chỉ kiểm khi có mã giao dịch. */
function assertTxHashFree(txHash: string | undefined, ownerId: string): void {
  if (txHash === undefined) return;
  const clash = state().requests.find((r) => r.txHash === txHash && r.id !== ownerId);
  if (!clash) return;
  throw new UniqueConstraintError(
    'TokenRequest',
    ['txHash'],
    `Mã giao dịch này đã gắn cho yêu cầu "${clash.id}".`,
  );
}

export function createMemoryTokenRequestStore(): ITokenRequestStore {
  return {
    kind: 'memory',

    async createRequest(request: NewTokenRequest) {
      // Mọi phép kiểm chạy TRƯỚC mọi thay đổi trạng thái.
      const now = new Date().toISOString();
      const record: TokenRequestRecord = {
        id: randomUUID(),
        chain: request.chain,
        tokenSymbol: request.tokenSymbol,
        type: assertTokenRequestType(request.type),
        amount: assertAmount('amount', request.amount),
        burnSource:
          request.burnSource == null ? null : assertTokenRequestBurnSource(request.burnSource),
        wallet: request.wallet,
        reason: request.reason,
        documentRef: request.documentRef ?? null,
        // Chuẩn hoá về cùng dạng bản Postgres trả ra (`timestamptz` → ISO UTC).
        effectiveDate: request.effectiveDate
          ? new Date(request.effectiveDate).toISOString()
          : null,
        note: request.note ?? null,
        makerId: request.makerId,
        makerRole: request.makerRole,
        checkerId: null,
        checkerRole: null,
        status: 'PENDING',
        rejectReason: null,
        failureReason: null,
        txHash: null,
        createdAt: now,
        decidedAt: null,
        completedAt: null,
        updatedAt: now,
      };
      state().requests.push(record);
      return { ...record };
    },

    async findRequest(id) {
      const found = state().requests.find((r) => r.id === id);
      return found ? { ...found } : null;
    },

    async transitionRequest(transition: TokenRequestTransition) {
      const to = assertTokenRequestStatus(transition.to);
      const from = transition.from.map((status) => assertTokenRequestStatus(status));
      assertTokenRequestTransition(from, to);

      const found = state().requests.find((r) => r.id === transition.id);
      if (!found || !from.includes(found.status)) return null;

      assertTxHashFree(transition.txHash, found.id);

      const now = new Date().toISOString();
      found.status = to;
      if (transition.checkerId !== undefined) found.checkerId = transition.checkerId;
      if (transition.checkerRole !== undefined) found.checkerRole = transition.checkerRole;
      if (transition.rejectReason !== undefined) found.rejectReason = transition.rejectReason;
      if (transition.failureReason !== undefined) found.failureReason = transition.failureReason;
      if (transition.txHash !== undefined) found.txHash = transition.txHash;
      if (DECISION_STATUSES.includes(to)) found.decidedAt = now;
      if (OUTCOME_STATUSES.includes(to)) found.completedAt = now;
      found.updatedAt = now;
      return { ...found };
    },

    async attachRequestTxHash({ id, txHash }) {
      const found = state().requests.find((r) => r.id === id);
      if (!found || found.status !== 'EXECUTING') return null;

      assertTxHashFree(txHash, found.id);

      found.txHash = txHash;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async listRequests(options = {}) {
      const { chain, tokenSymbol, type, status, makerId, limit = 50 } = options;
      return state()
        .requests.filter((r) => (chain ? r.chain === chain : true))
        .filter((r) => (tokenSymbol ? r.tokenSymbol === tokenSymbol : true))
        .filter((r) => (type ? r.type === type : true))
        .filter((r) => (status ? r.status === status : true))
        .filter((r) => (makerId ? r.makerId === makerId : true))
        .sort(newestFirst)
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },

    async countRequests({ status, makerId, excludeMakerId }) {
      const wanted = assertTokenRequestStatus(status);
      return state().requests.filter(
        (r) =>
          r.status === wanted &&
          (makerId === undefined || r.makerId === makerId) &&
          (excludeMakerId === undefined || r.makerId !== excludeMakerId),
      ).length;
    },
  };
}
