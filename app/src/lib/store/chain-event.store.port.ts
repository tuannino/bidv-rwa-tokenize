import type { ChainKey } from '@bidv/shared';

export interface IndexerScope {
  anchor: string;
  vault: string;
  token: string;
  deployBlock: bigint;
}

export type IndexedEventArgs = Record<string, string | number | boolean | null>;

export interface IndexedEvent {
  chain: ChainKey;
  anchor: string;
  contract: string;
  eventName: string;
  blockNumber: bigint;
  logIndex: number;
  txHash: string;
  blockTimestamp: bigint;
  args: IndexedEventArgs;
}

export type LiveIndexedEvent = Omit<IndexedEvent, 'chain' | 'anchor' | 'blockTimestamp'>;

export interface IndexerCursorRow {
  chain: ChainKey;
  anchor: string;
  vault: string;
  token: string;
  lastBlock: bigint;
  leaseUntil: Date | null;
  leaseOwner: string | null;
  updatedAt: Date;
}

export interface ChainEventQuery {
  chain: ChainKey;
  anchor: string;
  contract: string;
  eventNames?: readonly string[];
  fromBlock?: bigint;
  toBlock: bigint;
  argEquals?: Readonly<Record<string, string>>;
}

export interface TokenWalletQuery {
  chain: ChainKey;
  anchor: string;
  token: string;
  toBlock: bigint;
  limit: number;
}

export interface IChainEventStore {
  readonly kind: 'memory' | 'prisma';
  readCursor(chain: ChainKey): Promise<IndexerCursorRow | null>;
  claimLease(
    chain: ChainKey,
    owner: string,
    seconds: number,
    scope: IndexerScope,
    resetTo: bigint,
  ): Promise<IndexerCursorRow | null>;
  commitSegment(
    chain: ChainKey,
    owner: string,
    expected: bigint,
    newLast: bigint,
    events: readonly IndexedEvent[],
    renewSeconds: number,
  ): Promise<boolean>;
  releaseLease(chain: ChainKey, owner: string): Promise<void>;
  listEvents(query: ChainEventQuery): Promise<IndexedEvent[]>;
  tokenWallets(query: TokenWalletQuery): Promise<Array<{ wallet: string; balance: bigint }>>;
}
