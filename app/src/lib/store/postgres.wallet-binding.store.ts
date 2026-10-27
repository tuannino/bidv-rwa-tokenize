import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, type PgQuery } from './postgres.pool';
import { UniqueConstraintError } from './store.errors';
import type { IWalletBindingStore, WalletBindingRecord } from './wallet-binding.store.port';

/** Ví đã gắn trong Postgres (`USE_MOCK_DB=false`). */

interface Row {
  chain: string;
  wallet: string;
  actorId: string;
  boundBy: string;
  boundAt: Date;
}

const toRecord = (row: Row): WalletBindingRecord => ({
  chain: row.chain as ChainKey,
  wallet: row.wallet,
  actorId: row.actorId,
  boundBy: row.boundBy,
  boundAt: row.boundAt.toISOString(),
});

const COLUMNS = `"chain", "wallet", "actorId", "boundBy", "boundAt"`;

export function createPostgresWalletBindingStore(query: PgQuery = pgQuery): IWalletBindingStore {
  return {
    kind: 'prisma',

    async findByWallet(chain, wallet) {
      const rows = await query<Row>(
        `SELECT ${COLUMNS} FROM "WalletBinding" WHERE "chain" = $1 AND "walletKey" = $2`,
        [chain, wallet.toLowerCase()],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async list(chain, limit) {
      const rows = await query<Row>(
        `SELECT ${COLUMNS} FROM "WalletBinding" WHERE "chain" = $1
          ORDER BY "boundAt" DESC, "walletKey" ASC LIMIT $2`,
        [chain, limit],
      );
      return rows.map(toRecord);
    },

    async bind({ chain, wallet, actorId, boundBy }) {
      // Khoá chính là trọng tài: thua tranh chấp thì câu chèn không trả dòng nào, rồi đọc dòng
      // đang có để phân biệt "đã gắn đúng hồ sơ này" với "thuộc hồ sơ khác".
      const inserted = await query<Row>(
        `INSERT INTO "WalletBinding" ("chain", "walletKey", "wallet", "actorId", "boundBy", "boundAt")
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT ("chain", "walletKey") DO NOTHING
         RETURNING ${COLUMNS}`,
        [chain, wallet.toLowerCase(), wallet, actorId, boundBy],
      );
      if (inserted[0]) return { record: toRecord(inserted[0]), created: true };
      const existing = await query<Row>(
        `SELECT ${COLUMNS} FROM "WalletBinding" WHERE "chain" = $1 AND "walletKey" = $2`,
        [chain, wallet.toLowerCase()],
      );
      if (!existing[0] || existing[0].actorId !== actorId) {
        throw new UniqueConstraintError('WalletBinding', ['chain', 'walletKey']);
      }
      return { record: toRecord(existing[0]), created: false };
    },
  };
}
