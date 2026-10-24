import 'server-only';

import { randomUUID } from 'node:crypto';
import { memoryState } from './memory.state';
import { closeProjectInMemory, projectExistsInMemory } from './memory.project.store';
import { appendAuditInMemory } from './memory.store';
import {
  assertSettlementCaseStatus,
  assertSettlementRoundStatus,
  SETTLEMENT_CASE_COLUMNS,
  type ISettlementStore,
  type NewSettlementCase,
  type NewSettlementRound,
  type SettlementCaseRecord,
  type SettlementCaseStatus,
  type SettlementRoundRecord,
} from './settlement.store.port';
import {
  assertAmount,
  assertBulkSize,
  assertNoDuplicateWallet,
  assertSnapshotId,
  ForeignKeyError,
  StoreUsageError,
  UniqueConstraintError,
  MAX_BULK_ROWS,
} from './store.errors';

/**
 * Đợt tất toán + hồ sơ người nắm giữ trong bộ nhớ.
 *
 * ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3): duy nhất
 * `(roundId, holderWallet)` phải được kiểm bằng tay ở đây, vì nó là chốt chặn chi trả hoặc
 * đốt trùng cho một ví — hỏng chỗ này là mất tiền thật.
 */

interface SettlementState {
  rounds: SettlementRoundRecord[];
  cases: SettlementCaseRecord[];
}

const state = (): SettlementState => memoryState('settlement', () => ({ rounds: [], cases: [] }));

const sameWallet = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const newestRoundFirst = (a: SettlementRoundRecord, b: SettlementRoundRecord) =>
  b.initiatedAt.localeCompare(a.initiatedAt) || b.id.localeCompare(a.id);

const newestCaseFirst = (a: SettlementCaseRecord, b: SettlementCaseRecord) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

const baseRoundFields = {
  projectId: null, maturityDate: null, recallFrom: null, noticeDays: null, openedBy: null,
  reason: null, freezeRequestedAt: null, freezeTxHash: null, frozenAt: null,
  cancelledAt: null, unfreezeRequestedAt: null, unfreezeTxHash: null, activeChain: null,
} as const;

function newCase(roundId: string, row: NewSettlementCase, now: string): SettlementCaseRecord {
  const record: SettlementCaseRecord = {
    id: randomUUID(), roundId, holderWallet: row.holderWallet.toLowerCase(),
    wptAmount: assertAmount('wptAmount', row.wptAmount),
    payoutAmount: assertAmount('payoutAmount', row.payoutAmount), status: 'NOTIFIED',
    notifiedAt: null, confirmedAt: null, paidAt: null, paidTxHash: null,
    burnSentAt: null, burnedAt: null, burnTxHash: null, failedAt: null, reason: null,
    createdAt: now, updatedAt: now,
  };
  stamp(record, assertSettlementCaseStatus(row.status ?? 'NOTIFIED'), now);
  return record;
}

/** Ghi cột thời điểm (và cột mã giao dịch nếu bước đó có) theo `SETTLEMENT_CASE_COLUMNS`. */
function stamp(
  record: SettlementCaseRecord,
  status: SettlementCaseStatus,
  at: string,
  txHash?: string,
): void {
  const columns = SETTLEMENT_CASE_COLUMNS[status];
  if (txHash !== undefined && columns.txHash === null) {
    throw new StoreUsageError(
      `Bước "${status}" của SettlementCase không có cột mã giao dịch — nó không sinh giao dịch nào. ` +
        'Truyền txHash ở đây là dữ liệu bị bỏ đi mà người gọi tưởng đã lưu.',
    );
  }

  record.status = status;
  // Tên cột lấy từ bảng dữ liệu trong settlement.store.port.ts, không phải input.
  (record as unknown as Record<string, unknown>)[columns.at] = at;
  if (txHash !== undefined && columns.txHash !== null) {
    (record as unknown as Record<string, unknown>)[columns.txHash] = txHash;
  }
}

export function createMemorySettlementStore(): ISettlementStore {
  return {
    kind: 'memory',

    async openRound(round: NewSettlementRound): Promise<SettlementRoundRecord> {
      const record: SettlementRoundRecord = {
        id: randomUUID(),
        snapshotId: assertSnapshotId(round.snapshotId),
        navRate: assertAmount('navRate', round.navRate),
        status: assertSettlementRoundStatus(round.status ?? 'INITIATED'),
        chain: round.chain,
        initiatedAt: new Date().toISOString(),
        completedAt: null,
        ...baseRoundFields,
      };
      state().rounds.push(record);
      return { ...record };
    },

    async findRound(id) {
      const found = state().rounds.find((round) => round.id === id);
      return found ? { ...found } : null;
    },

    async listRounds(options = {}) {
      const { chain, status, limit = 50 } = options;
      return state()
        .rounds.filter((round) => (chain ? round.chain === chain : true))
        .filter((round) => (status ? round.status === status : true))
        .sort(newestRoundFirst)
        .slice(0, limit)
        .map((round) => ({ ...round }));
    },

    async setRoundStatus({ id, status, completedAt }) {
      const next = assertSettlementRoundStatus(status);
      const found = state().rounds.find((round) => round.id === id);
      if (!found) return null;

      found.status = next;
      if (completedAt !== undefined) found.completedAt = completedAt;
      return { ...found };
    },

    async createCases({ roundId, rows }) {
      assertBulkSize('rows', rows.length);
      assertNoDuplicateWallet(
        'SettlementCase',
        'holderWallet',
        rows.map((row) => row.holderWallet),
      );

      const now = new Date().toISOString();
      const records = rows.map((row) => newCase(roundId, row, now));

      // Đợt phải tồn tại: bản Postgres có khoá ngoài `SettlementCase_roundId_fkey`.
      if (!state().rounds.some((round) => round.id === roundId)) {
        throw new ForeignKeyError(
          'SettlementCase',
          'roundId',
          `Không có đợt tất toán nào mang mã "${roundId}".`,
        );
      }

      // TẤT CẢ HOẶC KHÔNG: kiểm hết ràng buộc duy nhất trước, rồi mới ghi dòng đầu tiên.
      for (const record of records) {
        const clash = state().cases.find(
          (item) => item.roundId === record.roundId && item.holderWallet === record.holderWallet,
        );
        if (clash) {
          throw new UniqueConstraintError(
            'SettlementCase',
            ['roundId', 'holderWallet'],
            `Ví "${record.holderWallet}" đã có hồ sơ tất toán trong đợt này.`,
          );
        }
      }

      state().cases.push(...records);
      return records.map((record) => ({ ...record }));
    },

    async markCase({ roundId, holderWallet, status, txHash }) {
      const next = assertSettlementCaseStatus(status);
      // Khớp CHÍNH XÁC như ràng buộc duy nhất của Postgres — xem ghi chú ở markPayout.
      const found = state().cases.find(
        (item) => item.roundId === roundId && item.holderWallet === holderWallet,
      );
      // Kiểm lời gọi TRƯỚC khi kết luận không tìm thấy: `markCase` với txHash cho bước
      // không có cột mã giao dịch là lỗi lập trình, và nó phải nổ ra kể cả khi hồ sơ chưa
      // tồn tại — nếu không thì lỗi chỉ hiện ra tuỳ dữ liệu.
      if (txHash !== undefined && SETTLEMENT_CASE_COLUMNS[next].txHash === null) {
        throw new StoreUsageError(
          `Bước "${next}" của SettlementCase không có cột mã giao dịch — nó không sinh giao dịch nào. ` +
            'Truyền txHash ở đây là dữ liệu bị bỏ đi mà người gọi tưởng đã lưu.',
        );
      }
      if (!found) return null;

      stamp(found, next, new Date().toISOString(), txHash);
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async listCases(options = {}) {
      const { roundId, holderWallet, status, limit = 50 } = options;
      return state()
        .cases.filter((item) => (roundId ? item.roundId === roundId : true))
        .filter((item) => (holderWallet ? sameWallet(item.holderWallet, holderWallet) : true))
        .filter((item) => (status ? item.status === status : true))
        .sort(newestCaseFirst)
        .slice(0, limit)
        .map((item) => ({ ...item }));
    },

    async openRecallRound(input) {
      if (state().rounds.some((round) => round.activeChain === input.chain)) {
        throw new UniqueConstraintError('SettlementRound', ['activeChain']);
      }
      const record: SettlementRoundRecord = {
        id: randomUUID(), snapshotId: 0, navRate: '0', status: 'INITIATED', chain: input.chain,
        initiatedAt: new Date().toISOString(), completedAt: null,
        projectId: input.projectId, maturityDate: input.maturityDate, recallFrom: input.recallFrom,
        noticeDays: input.noticeDays, openedBy: input.openedBy, reason: input.reason,
        freezeRequestedAt: null, freezeTxHash: null, frozenAt: null, cancelledAt: null,
        unfreezeRequestedAt: null, unfreezeTxHash: null, activeChain: input.chain,
      };
      state().rounds.push(record);
      appendAuditInMemory({ ...input.audit, target: record.id });
      return { ...record };
    },

    async findActiveRound(chain) {
      const found = state().rounds.find((round) => round.activeChain === chain);
      return found ? { ...found } : null;
    },

    async latestRecallRound(chain) {
      const found = state().rounds.filter((round) => round.chain === chain && round.projectId !== null)
        .sort(newestRoundFirst)[0];
      return found ? { ...found } : null;
    },

    async requestFreeze({ id, at }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found || found.status !== 'INITIATED' || found.freezeRequestedAt !== null) return false;
      found.freezeRequestedAt = at;
      return true;
    },

    async setFreezeTx({ id, txHash, clearRequest = false }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found) return;
      found.freezeTxHash = txHash;
      if (clearRequest) found.freezeRequestedAt = null;
    },

    async completeFreeze({ id, frozenAt, cases, audit }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found || found.status !== 'INITIATED') return null;
      assertNoDuplicateWallet('SettlementCase', 'holderWallet', cases.map((row) => row.holderWallet));
      const now = new Date().toISOString();
      const records = cases.map((row) => newCase(id, row, now));
      if (records.some((record) => state().cases.some((item) => item.roundId === id && item.holderWallet === record.holderWallet))) {
        throw new UniqueConstraintError('SettlementCase', ['roundId', 'holderWallet']);
      }
      found.status = 'IN_PROGRESS'; found.frozenAt = frozenAt;
      for (let start = 0; start < records.length; start += MAX_BULK_ROWS) state().cases.push(...records.slice(start, start + MAX_BULK_ROWS));
      appendAuditInMemory(audit);
      return { ...found };
    },

    async cancelRound({ id, cancelledAt, audit }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found || found.status !== 'INITIATED' || found.freezeRequestedAt !== null) return null;
      found.status = 'CANCELLED'; found.cancelledAt = cancelledAt; found.activeChain = null;
      appendAuditInMemory(audit);
      return { ...found };
    },

    async rescheduleRound({ id, maturityDate, recallFrom, noticeDays, audit }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found || found.status !== 'INITIATED' || found.freezeRequestedAt !== null) return null;
      found.maturityDate = maturityDate; found.recallFrom = recallFrom; found.noticeDays = noticeDays;
      appendAuditInMemory(audit);
      return { ...found };
    },

    async requestUnfreeze({ id, at }) {
      const found = state().rounds.find((round) => round.id === id);
      const started = state().cases.some((item) => item.roundId === id && (item.status === 'BURNING' || (item.status === 'BURNED' && item.burnTxHash !== null)));
      if (!found || found.status !== 'IN_PROGRESS' || found.unfreezeRequestedAt !== null || started) return false;
      found.unfreezeRequestedAt = at;
      return true;
    },

    async setUnfreezeTx({ id, txHash, clearRequest = false }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found) return;
      found.unfreezeTxHash = txHash;
      if (clearRequest) found.unfreezeRequestedAt = null;
    },

    async completeUnfreeze({ id, audit }) {
      const found = state().rounds.find((round) => round.id === id);
      const started = state().cases.some((item) => item.roundId === id && (item.status === 'BURNING' || (item.status === 'BURNED' && item.burnTxHash !== null)));
      if (!found || found.status !== 'IN_PROGRESS' || started) return null;
      found.status = 'INITIATED'; found.freezeRequestedAt = null; found.freezeTxHash = null;
      found.frozenAt = null; found.unfreezeRequestedAt = null; found.unfreezeTxHash = null;
      const kept = state().cases.filter((item) => item.roundId !== id || !(['NOTIFIED', 'FAILED'].includes(item.status) || (item.status === 'BURNED' && item.burnTxHash === null)));
      state().cases.splice(0, state().cases.length, ...kept);
      appendAuditInMemory(audit);
      return { ...found };
    },

    async addMissingCases({ roundId, rows }) {
      let added = 0;
      for (let start = 0; start < rows.length; start += MAX_BULK_ROWS) {
        for (const row of rows.slice(start, start + MAX_BULK_ROWS)) {
          const wallet = row.holderWallet.toLowerCase();
          if (state().cases.some((item) => item.roundId === roundId && item.holderWallet === wallet)) continue;
          state().cases.push(newCase(roundId, row, new Date().toISOString())); added += 1;
        }
      }
      return added;
    },

    async claimCase({ roundId, holderWallet, at }) {
      const found = state().cases.find((item) => item.roundId === roundId && item.holderWallet === holderWallet.toLowerCase());
      if (!found || !(['NOTIFIED', 'FAILED'] as SettlementCaseStatus[]).includes(found.status)) return null;
      found.status = 'BURNING'; found.burnTxHash = null; found.burnSentAt = at;
      found.failedAt = null; found.reason = null; found.updatedAt = at;
      return { ...found };
    },

    async attachBurnTx({ roundId, holderWallet, txHash }) {
      const found = state().cases.find((item) => item.roundId === roundId && item.holderWallet === holderWallet.toLowerCase());
      if (!found || found.status !== 'BURNING' || found.burnTxHash !== null) return false;
      found.burnTxHash = txHash; found.updatedAt = new Date().toISOString(); return true;
    },

    async settleCase({ roundId, holderWallet, to, at, reason }) {
      const found = state().cases.find((item) => item.roundId === roundId && item.holderWallet === holderWallet.toLowerCase());
      if (!found || found.status !== 'BURNING') return null;
      found.status = to; found.updatedAt = at; found.reason = reason ?? null;
      if (to === 'BURNED') found.burnedAt = at; else found.failedAt = at;
      return { ...found };
    },

    async listRoundCases({ roundId, statuses }) {
      return state().cases.filter((item) => item.roundId === roundId)
        .filter((item) => statuses === undefined || statuses.includes(item.status))
        .sort((a, b) => a.holderWallet.localeCompare(b.holderWallet)).map((item) => ({ ...item }));
    },

    async completeRound({ id, projectId, completedAt, audit }) {
      const found = state().rounds.find((round) => round.id === id);
      if (!found || found.status !== 'IN_PROGRESS' || found.projectId !== projectId || !projectExistsInMemory(projectId)) return null;
      found.status = 'COMPLETED'; found.completedAt = completedAt; found.activeChain = null;
      closeProjectInMemory(projectId); appendAuditInMemory(audit);
      return { ...found };
    },
  };
}
