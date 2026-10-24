import { randomUUID } from 'node:crypto';
import type { ChainKey } from '@bidv/shared';
import type {
  ChainEventQuery,
  IChainEventStore,
  IndexedEvent,
  IndexedEventArgs,
  IndexerScope,
  LiveIndexedEvent,
} from '@/lib/store/chain-event.store.port';

export interface EventIndexSource {
  head(): Promise<bigint>;
  scope(): Promise<IndexerScope>;
  fetchLogs(fromBlock: bigint, toBlock: bigint): Promise<LiveIndexedEvent[]>;
  timestamps(blockNumbers: readonly bigint[]): Promise<Map<bigint, bigint>>;
}

export interface EventIndexConfig {
  confirmations: number;
  segmentBlocks: number;
  maxBlocksPerSync: number;
  leaseSeconds: number;
  walletLimit: number;
}

export interface ReadEventQuery {
  contract: string;
  eventNames?: readonly string[];
  fromBlock?: bigint;
  argEquals?: Readonly<Record<string, string>>;
}

export interface EventIndex {
  readEvents(query: ReadEventQuery, needTimestamps?: boolean): Promise<IndexedEvent[]>;
  listTokenWallets(): Promise<{
    wallets: Array<{ wallet: string; balance: bigint }>;
    truncated: boolean;
    asOfBlock: bigint;
  }>;
}

interface PreparedRead {
  scope: IndexerScope;
  head: bigint;
  base: bigint;
  reusableTail: LiveIndexedEvent[] | null;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const scopeMatches = (
  cursor: { anchor: string; vault: string; token: string } | null,
  scope: IndexerScope,
) =>
  cursor !== null &&
  cursor.anchor === scope.anchor &&
  cursor.vault === scope.vault &&
  cursor.token === scope.token;

const sortEvents = (events: IndexedEvent[]) =>
  events.sort((a, b) =>
    a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex,
  );

const liveMatches = (event: LiveIndexedEvent, query: ReadEventQuery) =>
  event.contract === query.contract &&
  (!query.eventNames || query.eventNames.includes(event.eventName)) &&
  (query.fromBlock === undefined || event.blockNumber >= query.fromBlock) &&
  Object.entries(query.argEquals ?? {}).every(([key, value]) => String(event.args[key]) === value);

const distinctBlocks = (events: readonly LiveIndexedEvent[]) =>
  [...new Set(events.map((event) => event.blockNumber))];

const withTimestamps = (
  chain: ChainKey,
  scope: IndexerScope,
  events: readonly LiveIndexedEvent[],
  timestamps: ReadonlyMap<bigint, bigint>,
): IndexedEvent[] =>
  events.map((event) => ({
    ...event,
    chain,
    anchor: scope.anchor,
    blockTimestamp: timestamps.get(event.blockNumber) ?? 0n,
  }));

export function createEventIndex(input: {
  chain: ChainKey;
  store: IChainEventStore;
  source: EventIndexSource;
  config: EventIndexConfig;
  warn?: (message: string, error: unknown) => void;
}): EventIndex {
  const { chain, store, source, config } = input;
  const warn = input.warn ?? ((message, error) => console.warn(message, error));

  const syncSegments = async (
    owner: string,
    scope: IndexerScope,
    head: bigint,
    target: bigint,
    start: bigint,
  ): Promise<LiveIndexedEvent[] | null> => {
    let expected = start;
    let remaining = BigInt(config.maxBlocksPerSync);
    let reusableTail: LiveIndexedEvent[] | null = null;
    try {
      while (expected < target && remaining > 0n) {
        const from = expected + 1n;
        const segmentSize = BigInt(config.segmentBlocks);
        const end = [target, from + segmentSize - 1n, from + remaining - 1n].reduce((a, b) =>
          a < b ? a : b,
        );
        const fetchTo = end === target ? head : end;
        let fetched: LiveIndexedEvent[];
        let timestamps: Map<bigint, bigint>;
        try {
          fetched = await source.fetchLogs(from, fetchTo);
          const persistent = fetched.filter((event) => event.blockNumber <= end);
          timestamps = await source.timestamps(distinctBlocks(persistent));
        } catch (error) {
          warn(`Indexer ${chain}: nguồn chuỗi lỗi khi đồng bộ ${from}-${end}; đọc trực tiếp phần còn thiếu.`, error);
          break;
        }
        const persistent = fetched.filter((event) => event.blockNumber <= end);
        const committed = await store.commitSegment(
          chain,
          owner,
          expected,
          end,
          withTimestamps(chain, scope, persistent, timestamps),
          config.leaseSeconds,
        );
        if (!committed) break;
        expected = end;
        remaining -= end - from + 1n;
        if (end === target) reusableTail = fetched.filter((event) => event.blockNumber > end);
      }
      return reusableTail;
    } finally {
      await store.releaseLease(chain, owner);
    }
  };

  const prepare = async (): Promise<PreparedRead> => {
    const scope = await source.scope();
    const head = await source.head();
    const floor = scope.deployBlock - 1n;
    const confirmed = head - BigInt(config.confirmations);
    const target = confirmed > floor ? confirmed : floor;
    let cursor = await store.readCursor(chain);
    const stale = !scopeMatches(cursor, scope);
    let reusableTail: LiveIndexedEvent[] | null = null;
    if (stale || (cursor && cursor.lastBlock < target)) {
      const owner = randomUUID();
      const lease = await store.claimLease(chain, owner, config.leaseSeconds, scope, floor);
      if (lease) reusableTail = await syncSegments(owner, scope, head, target, lease.lastBlock);
      cursor = await store.readCursor(chain);
    }
    const base = scopeMatches(cursor, scope) ? cursor!.lastBlock : floor;
    return { scope, head, base, reusableTail: base === target ? reusableTail : null };
  };

  const tailFor = async (prepared: PreparedRead): Promise<LiveIndexedEvent[]> => {
    if (prepared.reusableTail) return prepared.reusableTail;
    if (prepared.base >= prepared.head) return [];
    return source.fetchLogs(prepared.base + 1n, prepared.head);
  };

  return {
    async readEvents(query, needTimestamps = false) {
      const prepared = await prepare();
      const storedQuery: ChainEventQuery = {
        chain,
        anchor: prepared.scope.anchor,
        contract: query.contract,
        eventNames: query.eventNames,
        fromBlock: query.fromBlock,
        toBlock: prepared.base,
        argEquals: query.argEquals,
      };
      const stored = await store.listEvents(storedQuery);
      const matchingTail = (await tailFor(prepared)).filter((event) => liveMatches(event, query));
      const timestamps = needTimestamps
        ? await source.timestamps(distinctBlocks(matchingTail))
        : new Map<bigint, bigint>();
      return sortEvents([
        ...stored,
        ...withTimestamps(chain, prepared.scope, matchingTail, timestamps),
      ]);
    },

    async listTokenWallets() {
      const prepared = await prepare();
      const limitWithSentinel = config.walletLimit + 1;
      const stored = await store.tokenWallets({
        chain,
        anchor: prepared.scope.anchor,
        token: prepared.scope.token,
        toBlock: prepared.base,
        limit: limitWithSentinel,
      });
      const balances = new Map(stored.map((entry) => [entry.wallet.toLowerCase(), entry.balance]));
      const touch = (wallet: unknown, delta: bigint) => {
        const key = String(wallet ?? ZERO_ADDRESS).toLowerCase();
        if (key === ZERO_ADDRESS) return;
        balances.set(key, (balances.get(key) ?? 0n) + delta);
      };
      for (const event of await tailFor(prepared)) {
        if (event.contract !== prepared.scope.token || event.eventName !== 'Transfer') continue;
        const value = BigInt(String(event.args.value ?? '0'));
        touch(event.args.to, value);
        touch(event.args.from, -value);
      }
      const all = [...balances]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([wallet, balance]) => ({ wallet, balance }));
      return {
        wallets: all.slice(0, config.walletLimit),
        truncated: all.length > config.walletLimit,
        asOfBlock: prepared.head,
      };
    },
  };
}

export type { IndexedEvent, IndexedEventArgs, IndexerScope, LiveIndexedEvent };
