import type { ChainKey } from '@bidv/shared';
import type {
  ChainEventQuery,
  IChainEventStore,
  IndexedEvent,
  IndexedEventArgs,
  IndexerCursorRow,
  TokenWalletQuery,
} from './chain-event.store.port';
import { pgQuery, pgTransaction, type PgQuery, type PgTransaction } from './postgres.pool';

interface CursorDbRow {
  chain: string;
  anchor: string;
  vault: string;
  token: string;
  lastBlock: string;
  leaseUntil: Date | null;
  leaseOwner: string | null;
  updatedAt: Date;
}

interface EventDbRow {
  chain: string;
  anchor: string;
  contract: string;
  eventName: string;
  blockNumber: string;
  logIndex: number;
  txHash: string;
  blockTimestamp: string;
  args: IndexedEventArgs;
}

const toCursor = (row: CursorDbRow): IndexerCursorRow => ({
  chain: row.chain as ChainKey,
  anchor: row.anchor,
  vault: row.vault,
  token: row.token,
  lastBlock: BigInt(row.lastBlock),
  leaseUntil: row.leaseUntil,
  leaseOwner: row.leaseOwner,
  updatedAt: row.updatedAt,
});

const toEvent = (row: EventDbRow): IndexedEvent => ({
  chain: row.chain as ChainKey,
  anchor: row.anchor,
  contract: row.contract,
  eventName: row.eventName,
  blockNumber: BigInt(row.blockNumber),
  logIndex: row.logIndex,
  txHash: row.txHash,
  blockTimestamp: BigInt(row.blockTimestamp),
  args: row.args,
});

class LostIndexerLease extends Error {}

export function createPostgresChainEventStore(
  query: PgQuery = pgQuery,
  transaction: PgTransaction = pgTransaction,
): IChainEventStore {
  return {
    kind: 'prisma',

    async readCursor(chain) {
      const rows = await query<CursorDbRow>(`SELECT * FROM "IndexerCursor" WHERE "chain" = $1`, [chain]);
      return rows[0] ? toCursor(rows[0]) : null;
    },

    async claimLease(chain, owner, seconds, scope, resetTo) {
      const rows = await query<CursorDbRow>(
        `INSERT INTO "IndexerCursor"
           ("chain","anchor","vault","token","lastBlock","leaseUntil","leaseOwner","updatedAt")
         VALUES ($1,$2,$3,$4,$5::numeric,now() + $6 * interval '1 second',$7,now())
         ON CONFLICT ("chain") DO UPDATE SET
           "leaseUntil" = EXCLUDED."leaseUntil",
           "leaseOwner" = EXCLUDED."leaseOwner",
           "updatedAt" = now(),
           "lastBlock" = CASE
             WHEN "IndexerCursor"."anchor" <> EXCLUDED."anchor"
               OR "IndexerCursor"."vault" <> EXCLUDED."vault"
               OR "IndexerCursor"."token" <> EXCLUDED."token"
             THEN EXCLUDED."lastBlock" ELSE "IndexerCursor"."lastBlock" END,
           "anchor" = EXCLUDED."anchor", "vault" = EXCLUDED."vault", "token" = EXCLUDED."token"
         WHERE "IndexerCursor"."leaseUntil" IS NULL OR "IndexerCursor"."leaseUntil" < now()
         RETURNING *`,
        [chain, scope.anchor, scope.vault, scope.token, resetTo.toString(), seconds, owner],
      );
      return rows[0] ? toCursor(rows[0]) : null;
    },

    async commitSegment(chain, owner, expected, newLast, events, renewSeconds) {
      try {
        return await transaction(async (run) => {
          for (let offset = 0; offset < events.length; offset += 400) {
            const batch = events.slice(offset, offset + 400);
            const params: unknown[] = [];
            const values = batch.map((event, index) => {
              const base = index * 9;
              params.push(
                event.chain,
                event.anchor,
                event.contract,
                event.eventName,
                event.blockNumber.toString(),
                event.logIndex,
                event.txHash,
                event.blockTimestamp.toString(),
                JSON.stringify(event.args),
              );
              return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5}::numeric,$${base + 6},$${base + 7},$${base + 8}::bigint,$${base + 9}::jsonb)`;
            });
            await run(
              `INSERT INTO "ChainEvent"
                 ("chain","anchor","contract","eventName","blockNumber","logIndex","txHash","blockTimestamp","args")
               VALUES ${values.join(',')}
               ON CONFLICT DO NOTHING`,
              params,
            );
          }
          const rows = await run<{ chain: string }>(
            `UPDATE "IndexerCursor"
                SET "lastBlock" = $4::numeric,
                    "leaseUntil" = now() + $5 * interval '1 second',
                    "updatedAt" = now()
              WHERE "chain" = $1 AND "leaseOwner" = $2 AND "lastBlock" = $3::numeric
              RETURNING "chain"`,
            [chain, owner, expected.toString(), newLast.toString(), renewSeconds],
          );
          if (rows.length === 0) throw new LostIndexerLease();
          return true;
        });
      } catch (error) {
        if (error instanceof LostIndexerLease) return false;
        throw error;
      }
    },

    async releaseLease(chain, owner) {
      await query(
        `UPDATE "IndexerCursor"
            SET "leaseUntil" = NULL, "leaseOwner" = NULL, "updatedAt" = now()
          WHERE "chain" = $1 AND "leaseOwner" = $2`,
        [chain, owner],
      );
    },

    async listEvents(input: ChainEventQuery) {
      const rows = await query<EventDbRow>(
        `SELECT "chain","anchor","contract","eventName","blockNumber","logIndex","txHash","blockTimestamp","args"
           FROM "ChainEvent"
          WHERE "chain" = $1 AND "anchor" = $2 AND "contract" = $3
            AND ($4::text[] IS NULL OR "eventName" = ANY($4::text[]))
            AND ($5::numeric IS NULL OR "blockNumber" >= $5::numeric)
            AND "blockNumber" <= $6::numeric
          ORDER BY "blockNumber" ASC, "logIndex" ASC`,
        [
          input.chain,
          input.anchor,
          input.contract,
          input.eventNames ? [...input.eventNames] : null,
          input.fromBlock?.toString() ?? null,
          input.toBlock.toString(),
        ],
      );
      return rows
        .map(toEvent)
        .filter((event) =>
          Object.entries(input.argEquals ?? {}).every(([key, value]) => String(event.args[key]) === value),
        );
    },

    async tokenWallets(input: TokenWalletQuery) {
      const rows = await query<{ wallet: string; balance: string }>(
        `WITH movements AS (
           SELECT lower("args"->>'to') AS wallet, ("args"->>'value')::numeric AS delta
             FROM "ChainEvent"
            WHERE "chain" = $1 AND "anchor" = $2 AND "contract" = $3
              AND "eventName" = 'Transfer' AND "blockNumber" <= $4::numeric
              AND lower("args"->>'to') <> '0x0000000000000000000000000000000000000000'
           UNION ALL
           SELECT lower("args"->>'from') AS wallet, -("args"->>'value')::numeric AS delta
             FROM "ChainEvent"
            WHERE "chain" = $1 AND "anchor" = $2 AND "contract" = $3
              AND "eventName" = 'Transfer' AND "blockNumber" <= $4::numeric
              AND lower("args"->>'from') <> '0x0000000000000000000000000000000000000000'
         )
         SELECT wallet, sum(delta)::text AS balance
           FROM movements
          GROUP BY wallet
          ORDER BY wallet
          LIMIT $5`,
        [input.chain, input.anchor, input.token, input.toBlock.toString(), input.limit],
      );
      return rows.map((row) => ({ wallet: row.wallet, balance: BigInt(row.balance) }));
    },
  };
}
