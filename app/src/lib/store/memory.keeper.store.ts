import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  assertKeeperRunStatus,
  type IKeeperStore,
  type KeeperRunRecord,
} from './keeper.store.port';
import { memoryState } from './memory.state';
import { UniqueConstraintError } from './store.errors';

/**
 * Mốc chạy tiến trình hẹn giờ trong bộ nhớ.
 *
 * ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3): duy nhất
 * `(jobName, periodKey)` là toàn bộ giá trị của bảng này. Bỏ phép kiểm đó ở đây thì
 * `startRun` luôn thành công trong chế độ bộ nhớ, và mọi test "chống chạy trùng" viết trên
 * bản bộ nhớ đều xanh một cách vô nghĩa.
 */

interface KeeperState {
  runs: KeeperRunRecord[];
}

const state = (): KeeperState => memoryState('keeper', () => ({ runs: [] }));

const newestFirst = (a: KeeperRunRecord, b: KeeperRunRecord) =>
  b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id);

export function createMemoryKeeperStore(): IKeeperStore {
  return {
    kind: 'memory',

    async startRun({ jobName, periodKey }) {
      if (state().runs.some((run) => run.jobName === jobName && run.periodKey === periodKey)) {
        throw new UniqueConstraintError(
          'KeeperRun',
          ['jobName', 'periodKey'],
          `Công việc "${jobName}" đã có lần chạy cho kỳ "${periodKey}" — một bản khác đã nhận việc này.`,
        );
      }

      const record: KeeperRunRecord = {
        id: randomUUID(),
        jobName,
        periodKey,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: 'RUNNING',
        error: null,
      };
      state().runs.push(record);
      return { ...record };
    },

    async finishRun({ id, status, error }) {
      const next = assertKeeperRunStatus(status);
      const found = state().runs.find((run) => run.id === id);
      if (!found) return null;

      found.status = next;
      found.finishedAt = new Date().toISOString();
      if (error !== undefined) found.error = error;
      return { ...found };
    },

    async findRun({ jobName, periodKey }) {
      const found = state().runs.find(
        (run) => run.jobName === jobName && run.periodKey === periodKey,
      );
      return found ? { ...found } : null;
    },

    async listRuns(options = {}) {
      const { jobName, status, limit = 50 } = options;
      return state()
        .runs.filter((run) => (jobName ? run.jobName === jobName : true))
        .filter((run) => (status ? run.status === status : true))
        .sort(newestFirst)
        .slice(0, limit)
        .map((run) => ({ ...run }));
    },
  };
}
