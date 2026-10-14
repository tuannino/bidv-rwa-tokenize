import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, pgTransaction } from '@/lib/store/postgres.pool';
import {
  createDefaultMockLedgerState,
  decodeMockLedgerState,
  encodeMockLedgerState,
  type MockLedgerState,
  type MockLedgerStateStore,
} from './mock-state.store';

type StateRow = { state: unknown };

const WARN_STATE_BYTES = 512 * 1024;

function encoded(state: Readonly<MockLedgerState>): Record<string, unknown> {
  const value = encodeMockLedgerState(state) as unknown as Record<string, unknown>;
  const bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > WARN_STATE_BYTES) {
    console.warn(`[mock-ledger] state ${bytes} byte vượt ngưỡng cảnh báo ${WARN_STATE_BYTES} byte.`);
  }
  return value;
}

async function initializeAndRead(chain: ChainKey): Promise<MockLedgerState> {
  return pgTransaction(async (run) => {
    await run(
      `INSERT INTO "MockLedgerState" ("chain","version","state","updatedAt")
       VALUES ($1,0,$2::jsonb,CURRENT_TIMESTAMP)
       ON CONFLICT ("chain") DO NOTHING`,
      [chain, JSON.stringify(encoded(createDefaultMockLedgerState()))],
    );
    const rows = await run<StateRow>(
      `SELECT "state" FROM "MockLedgerState" WHERE "chain" = $1`,
      [chain],
    );
    if (!rows[0]) throw new Error(`Không khởi tạo được MockLedgerState cho chain ${chain}.`);
    return decodeMockLedgerState(rows[0].state);
  });
}

export function createPostgresMockLedgerStateStore(chain: ChainKey): MockLedgerStateStore {
  return {
    kind: 'postgres',

    async read(fn) {
      const rows = await pgQuery<StateRow>(
        `SELECT "state" FROM "MockLedgerState" WHERE "chain" = $1`,
        [chain],
      );
      const state = rows[0]
        ? decodeMockLedgerState(rows[0].state)
        : await initializeAndRead(chain);
      return fn(state);
    },

    async mutate(fn) {
      return pgTransaction(async (run) => {
        await run(
          `INSERT INTO "MockLedgerState" ("chain","version","state","updatedAt")
           VALUES ($1,0,$2::jsonb,CURRENT_TIMESTAMP)
           ON CONFLICT ("chain") DO NOTHING`,
          [chain, JSON.stringify(encoded(createDefaultMockLedgerState()))],
        );
        const rows = await run<StateRow>(
          `SELECT "state" FROM "MockLedgerState" WHERE "chain" = $1 FOR UPDATE`,
          [chain],
        );
        if (!rows[0]) throw new Error(`Không khoá được MockLedgerState cho chain ${chain}.`);

        const state = decodeMockLedgerState(rows[0].state);
        const result = fn(state);
        await run(
          `UPDATE "MockLedgerState"
              SET "state" = $2::jsonb, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "chain" = $1`,
          [chain, JSON.stringify(encoded(state))],
        );
        return result;
      });
    },

    async resetForTest() {
      if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
        throw new Error('Chỉ được reset MockLedgerState Postgres trong kiểm thử.');
      }
      await pgQuery(`DELETE FROM "MockLedgerState" WHERE "chain" = $1`, [chain]);
    },
  };
}
