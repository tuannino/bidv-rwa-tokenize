import 'server-only';

import { randomUUID } from 'node:crypto';
import { memoryState } from './memory.state';
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
      const records: SettlementCaseRecord[] = rows.map((row: NewSettlementCase) => {
        const record: SettlementCaseRecord = {
          id: randomUUID(),
          roundId,
          holderWallet: row.holderWallet,
          wptAmount: assertAmount('wptAmount', row.wptAmount),
          payoutAmount: assertAmount('payoutAmount', row.payoutAmount),
          status: 'NOTIFIED',
          notifiedAt: null,
          confirmedAt: null,
          paidAt: null,
          paidTxHash: null,
          burnedAt: null,
          burnTxHash: null,
          createdAt: now,
          updatedAt: now,
        };
        // Hồ sơ không bao giờ có trạng thái mà thiếu mốc thời gian của trạng thái đó.
        stamp(record, assertSettlementCaseStatus(row.status ?? 'NOTIFIED'), now);
        return record;
      });

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
  };
}
