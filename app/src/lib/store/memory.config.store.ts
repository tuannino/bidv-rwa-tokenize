import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  assertConfigValueType,
  type ConfigChange,
  type ConfigHistoryRecord,
  type ConfigRecord,
  type IConfigStore,
} from './config.store.port';
import { memoryState } from './memory.state';
import { SEED_ACTOR_ROLE, SEED_CONFIG_ROWS } from './seed-data';

/**
 * Tham số hệ thống trong bộ nhớ — mặc định, chạy được ở free-tier (không cần Postgres).
 *
 * ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3): chặn cùng giá trị `type` lạ, ghi
 * dòng lịch sử ở cùng những lần ghi, ném cùng lớp lỗi. Bản bộ nhớ dễ tính hơn sẽ sinh loại lỗi
 * chỉ hiện ra khi chạy `docker compose up`.
 *
 * Dữ liệu khởi tạo nạp từ `seed-data.ts` — CÙNG nguồn với bản Postgres, nên demo free-tier và
 * demo VPS bắt đầu từ một trạng thái.
 */

interface ConfigState {
  /** Khoá -> dòng hiện hành. `Map` vì `key` là khoá chính, tra theo khoá là việc duy nhất. */
  values: Map<string, ConfigRecord>;
  history: ConfigHistoryRecord[];
}

const state = (): ConfigState =>
  memoryState('config', () => {
    const values = new Map<string, ConfigRecord>();
    const now = new Date().toISOString();
    for (const row of SEED_CONFIG_ROWS) {
      values.set(row.key, {
        key: row.key,
        value: row.value,
        type: assertConfigValueType(row.type),
        updatedBy: SEED_ACTOR_ROLE,
        updatedAt: now,
      });
    }
    // Lịch sử KHỞI TẠO rỗng: dòng seed không phải một lần "ai đó đổi giá", nên bịa ra một bản
    // ghi lịch sử cho nó là đưa vào sổ kiểm toán một hành động không có người thực hiện.
    return { values, history: [] };
  });

/** Mới nhất trước; `id` chỉ để phá thế bằng khi hai dòng cùng mốc thời gian. */
const newestFirst = (a: ConfigHistoryRecord, b: ConfigHistoryRecord) =>
  b.changedAt.localeCompare(a.changedAt) || b.id.localeCompare(a.id);

export function createMemoryConfigStore(): IConfigStore {
  return {
    kind: 'memory',

    async getConfig(key) {
      const found = state().values.get(key);
      return found ? { ...found } : null;
    },

    async setConfig(change: ConfigChange): Promise<ConfigRecord> {
      // Mọi phép kiểm chạy TRƯỚC mọi thay đổi trạng thái: `type` lạ phải bị chặn khi chưa có
      // dòng nào bị sửa, nếu không thì giá đã đổi mà lời gọi báo thất bại.
      const type = assertConfigValueType(change.type);
      const s = state();

      // Đọc giá trị cũ TRONG hiện thực, không nhận từ người gọi: khoảng giữa "người gọi đọc"
      // và "người gọi ghi" là chỗ một lần đổi khác chen vào, và dòng lịch sử sẽ ghi một giá
      // trị cũ không phải giá trị vừa bị thay.
      const previous = s.values.get(change.key);
      const now = new Date().toISOString();

      const record: ConfigRecord = {
        key: change.key,
        value: change.value,
        type,
        updatedBy: change.changedBy,
        updatedAt: now,
      };

      // Hai việc liền nhau, không có nhánh từ chối nào ở giữa — tương đương transaction của
      // bản Postgres.
      s.values.set(change.key, record);
      s.history.unshift({
        id: randomUUID(),
        key: change.key,
        oldValue: previous?.value ?? null,
        newValue: change.value,
        changedBy: change.changedBy,
        reason: change.reason ?? null,
        changedAt: now,
      });

      return { ...record };
    },

    async listConfigHistory(options = {}) {
      const { key, limit = 50 } = options;
      return state()
        .history.filter((entry) => (key ? entry.key === key : true))
        .sort(newestFirst)
        .slice(0, limit)
        .map((entry) => ({ ...entry }));
    },
  };
}
