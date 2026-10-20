import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { pgQuery, type PgQuery } from './postgres.pool';
import type { IProfileWalletStore, ProfileWalletRecord } from './profile-wallet.store.port';
import { mapPgConstraintError } from './store.errors';

/** Ví liên kết trong Postgres (`USE_MOCK_DB=false`). */

interface Row {
  actorId: string;
  chain: string;
  wallet: string;
  updatedBy: string;
  updatedAt: Date;
}

const toRecord = (row: Row): ProfileWalletRecord => ({
  actorId: row.actorId,
  chain: row.chain as ChainKey,
  wallet: row.wallet,
  updatedBy: row.updatedBy,
  updatedAt: row.updatedAt.toISOString(),
});

const COLUMNS = `"actorId", "chain", "wallet", "updatedBy", "updatedAt"`;

export function createPostgresProfileWalletStore(query: PgQuery = pgQuery): IProfileWalletStore {
  return {
    kind: 'prisma',

    async findByActor(actorId, chain) {
      const rows = await query<Row>(
        `SELECT ${COLUMNS} FROM "ProfileWallet" WHERE "actorId" = $1 AND "chain" = $2`,
        [actorId, chain],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async findByWallet(chain, wallet) {
      const rows = await query<Row>(
        `SELECT ${COLUMNS} FROM "ProfileWallet" WHERE "chain" = $1 AND "walletKey" = $2`,
        [chain, wallet.toLowerCase()],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },

    async link({ actorId, chain, wallet, updatedBy }) {
      // MỘT câu: đọc ví cũ trong CTE (ảnh chụp trước câu ghi) rồi chèn hoặc thay. Ví đã thuộc hồ sơ
      // khác thì vướng `ProfileWallet_chain_walletKey_key`.
      const rows = await mapPgConstraintError(() =>
        query<Row & { previous: string | null }>(
          `WITH prev AS (
             SELECT "wallet" FROM "ProfileWallet" WHERE "actorId" = $1 AND "chain" = $2
           )
           INSERT INTO "ProfileWallet" ("actorId", "chain", "wallet", "walletKey", "updatedBy", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT ("actorId", "chain") DO UPDATE
             SET "wallet" = EXCLUDED."wallet", "walletKey" = EXCLUDED."walletKey",
                 "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = now()
           RETURNING ${COLUMNS}, (SELECT "wallet" FROM prev) AS "previous"`,
          [actorId, chain, wallet, wallet.toLowerCase(), updatedBy],
        ),
      );
      return { previous: rows[0]!.previous, record: toRecord(rows[0]!) };
    },
  };
}
