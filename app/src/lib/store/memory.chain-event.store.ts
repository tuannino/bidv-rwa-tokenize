import type { ChainKey } from '@bidv/shared';
import type {
  ChainEventQuery,
  IChainEventStore,
  IndexedEvent,
  IndexerCursorRow,
  IndexerScope,
  TokenWalletQuery,
} from './chain-event.store.port';

interface State {
  cursors: Map<ChainKey, IndexerCursorRow>;
  events: Map<string, IndexedEvent>;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const eventKey = (event: IndexedEvent) =>
  `${event.chain}:${event.anchor}:${event.txHash.toLowerCase()}:${event.logIndex}`;
const sameScope = (row: IndexerCursorRow, scope: IndexerScope) =>
  row.anchor === scope.anchor && row.vault === scope.vault && row.token === scope.token;
const cloneCursor = (row: IndexerCursorRow): IndexerCursorRow => ({
  ...row,
  leaseUntil: row.leaseUntil ? new Date(row.leaseUntil) : null,
  updatedAt: new Date(row.updatedAt),
});
const cloneEvent = (event: IndexedEvent): IndexedEvent => ({ ...event, args: { ...event.args } });

export interface MemoryChainEventStoreOptions {
  now?: () => Date;
}

export function createMemoryChainEventStore(
  options: MemoryChainEventStoreOptions = {},
): IChainEventStore {
  const data: State = { cursors: new Map(), events: new Map() };
  const now = options.now ?? (() => new Date());

  return {
    kind: 'memory',

    async readCursor(chain) {
      const row = data.cursors.get(chain);
      return row ? cloneCursor(row) : null;
    },

    async claimLease(chain, owner, seconds, scope, resetTo) {
      const current = data.cursors.get(chain);
      const instant = now();
      if (current?.leaseUntil && current.leaseUntil.getTime() >= instant.getTime()) return null;
      const changed = !current || !sameScope(current, scope);
      const row: IndexerCursorRow = {
        chain,
        anchor: scope.anchor,
        vault: scope.vault,
        token: scope.token,
        lastBlock: changed ? resetTo : current.lastBlock,
        leaseUntil: new Date(instant.getTime() + seconds * 1_000),
        leaseOwner: owner,
        updatedAt: instant,
      };
      data.cursors.set(chain, row);
      return cloneCursor(row);
    },

    async commitSegment(chain, owner, expected, newLast, events, renewSeconds) {
      const row = data.cursors.get(chain);
      if (!row || row.leaseOwner !== owner || row.lastBlock !== expected) return false;
      for (const event of events) data.events.set(eventKey(event), cloneEvent(event));
      const instant = now();
      row.lastBlock = newLast;
      row.leaseUntil = new Date(instant.getTime() + renewSeconds * 1_000);
      row.updatedAt = instant;
      return true;
    },

    async releaseLease(chain, owner) {
      const row = data.cursors.get(chain);
      if (!row || row.leaseOwner !== owner) return;
      row.leaseOwner = null;
      row.leaseUntil = null;
      row.updatedAt = now();
    },

    async listEvents(query: ChainEventQuery) {
      const names = query.eventNames ? new Set(query.eventNames) : null;
      return [...data.events.values()]
        .filter((event) => event.chain === query.chain)
        .filter((event) => event.anchor === query.anchor)
        .filter((event) => event.contract === query.contract)
        .filter((event) => !names || names.has(event.eventName))
        .filter((event) => query.fromBlock === undefined || event.blockNumber >= query.fromBlock)
        .filter((event) => event.blockNumber <= query.toBlock)
        .filter((event) =>
          Object.entries(query.argEquals ?? {}).every(([key, value]) => String(event.args[key]) === value),
        )
        .sort((a, b) =>
          a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex,
        )
        .map(cloneEvent);
    },

    async tokenWallets(query: TokenWalletQuery) {
      const balances = new Map<string, bigint>();
      const touch = (wallet: string, delta: bigint) => {
        const key = wallet.toLowerCase();
        if (key === ZERO_ADDRESS) return;
        balances.set(key, (balances.get(key) ?? 0n) + delta);
      };
      for (const event of data.events.values()) {
        if (
          event.chain !== query.chain ||
          event.anchor !== query.anchor ||
          event.contract !== query.token ||
          event.eventName !== 'Transfer' ||
          event.blockNumber > query.toBlock
        ) continue;
        const value = BigInt(String(event.args.value ?? '0'));
        touch(String(event.args.to ?? ZERO_ADDRESS), value);
        touch(String(event.args.from ?? ZERO_ADDRESS), -value);
      }
      return [...balances]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, query.limit)
        .map(([wallet, balance]) => ({ wallet, balance }));
    },
  };
}
