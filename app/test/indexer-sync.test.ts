import { describe, expect, it, vi } from 'vitest';
import { createEventIndex, type EventIndexSource, type LiveIndexedEvent } from '@/lib/indexer/event-index';
import { createMemoryChainEventStore } from '@/lib/store/memory.chain-event.store';
import type { IndexerScope } from '@/lib/store/chain-event.store.port';

const VAULT = '0x0000000000000000000000000000000000000011';
const TOKEN = '0x0000000000000000000000000000000000000022';
const OTHER_VAULT = '0x0000000000000000000000000000000000000033';

const log = (
  contract: string,
  blockNumber: bigint,
  eventName = 'PeriodClosed',
  args: LiveIndexedEvent['args'] = { periodRef: blockNumber.toString() },
): LiveIndexedEvent => ({
  contract,
  eventName,
  blockNumber,
  logIndex: 0,
  txHash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
  args,
});

function fakeSource(input: {
  head: bigint;
  scope?: IndexerScope;
  logs?: LiveIndexedEvent[];
}): EventIndexSource & { setHead(value: bigint): void; setScope(value: IndexerScope): void } {
  let head = input.head;
  let scope = input.scope ?? { anchor: '0xanchor-a', vault: VAULT, token: TOKEN, deployBlock: 1n };
  const logs = input.logs ?? [];
  return {
    setHead(value) { head = value; },
    setScope(value) { scope = value; },
    async head() { return head; },
    async scope() { return scope; },
    async fetchLogs(from, to) {
      return logs.filter((event) =>
        (event.contract === scope.vault || event.contract === scope.token) &&
        event.blockNumber >= from && event.blockNumber <= to,
      );
    },
    async timestamps(blocks) {
      return new Map(blocks.map((block) => [block, 1_700_000_000n + block]));
    },
  };
}

const config = {
  confirmations: 2,
  segmentBlocks: 3,
  maxBlocksPerSync: 20,
  leaseSeconds: 60,
  walletLimit: 5_000,
};

describe('IN-01 event index', () => {
  it('đồng bộ idempotent và giữ phần đuôi chưa xác nhận ngoài bảng', async () => {
    const store = createMemoryChainEventStore();
    const source = fakeSource({ head: 6n, logs: [log(VAULT, 4n), log(VAULT, 6n)] });
    const index = createEventIndex({ chain: 'hardhat-local', store, source, config });

    const first = await index.readEvents({ contract: VAULT, eventNames: ['PeriodClosed'] }, true);
    expect(first.map((event) => event.blockNumber)).toEqual([4n, 6n]);
    expect((await store.readCursor('hardhat-local'))?.lastBlock).toBe(4n);
    expect((await store.listEvents({
      chain: 'hardhat-local', anchor: '0xanchor-a', contract: VAULT, toBlock: 6n,
    })).map((event) => event.blockNumber)).toEqual([4n]);

    await index.readEvents({ contract: VAULT, eventNames: ['PeriodClosed'] }, true);
    expect(await store.listEvents({
      chain: 'hardhat-local', anchor: '0xanchor-a', contract: VAULT, toBlock: 6n,
    })).toHaveLength(1);

    source.setHead(8n);
    const afterConfirmations = await index.readEvents({ contract: VAULT, eventNames: ['PeriodClosed'] }, true);
    expect(afterConfirmations.map((event) => event.blockNumber)).toEqual([4n, 6n]);
    expect((await store.listEvents({
      chain: 'hardhat-local', anchor: '0xanchor-a', contract: VAULT, toBlock: 8n,
    })).map((event) => event.blockNumber)).toEqual([4n, 6n]);
  });

  it('giới hạn số block tiến cursor nhưng lần đọc vẫn đủ qua live tail', async () => {
    const store = createMemoryChainEventStore();
    const source = fakeSource({ head: 12n, logs: [log(VAULT, 2n), log(VAULT, 11n)] });
    const index = createEventIndex({
      chain: 'hardhat-local', store, source,
      config: { ...config, confirmations: 0, maxBlocksPerSync: 3 },
    });
    const events = await index.readEvents({ contract: VAULT });
    expect((await store.readCursor('hardhat-local'))?.lastBlock).toBe(3n);
    expect(events.map((event) => event.blockNumber)).toEqual([2n, 11n]);
  });

  it('đặt lại cursor khi scope đổi dù cursor cũ đã bắt kịp', async () => {
    const store = createMemoryChainEventStore();
    const source = fakeSource({ head: 5n, logs: [log(VAULT, 2n), log(OTHER_VAULT, 3n)] });
    const index = createEventIndex({
      chain: 'hardhat-local', store, source,
      config: { ...config, confirmations: 0 },
    });
    expect(await index.readEvents({ contract: VAULT })).toHaveLength(1);
    source.setScope({ anchor: '0xanchor-b', vault: OTHER_VAULT, token: TOKEN, deployBlock: 1n });
    const changed = await index.readEvents({ contract: OTHER_VAULT });
    expect(changed).toHaveLength(1);
    expect(changed[0]?.contract).toBe(OTHER_VAULT);
    expect((await store.readCursor('hardhat-local'))?.anchor).toBe('0xanchor-b');
    expect(await store.listEvents({
      chain: 'hardhat-local', anchor: '0xanchor-b', contract: VAULT, toBlock: 5n,
    })).toEqual([]);
  });

  it('owner cũ không thể release hoặc commit lease của owner mới', async () => {
    let now = new Date('2026-10-24T00:00:00Z');
    const store = createMemoryChainEventStore({ now: () => now });
    const scope = { anchor: 'a', vault: VAULT, token: TOKEN, deployBlock: 1n };
    expect(await store.claimLease('hardhat-local', 'A', 1, scope, 0n)).not.toBeNull();
    now = new Date('2026-10-24T00:00:02Z');
    expect(await store.claimLease('hardhat-local', 'B', 60, scope, 0n)).not.toBeNull();
    await store.releaseLease('hardhat-local', 'A');
    expect((await store.readCursor('hardhat-local'))?.leaseOwner).toBe('B');
    expect(await store.commitSegment('hardhat-local', 'A', 0n, 1n, [], 60)).toBe(false);
    expect((await store.readCursor('hardhat-local'))?.lastBlock).toBe(0n);
  });

  it('lease hết hạn được lượt sau nhận và tiếp tục từ cursor cũ', async () => {
    let now = new Date('2026-10-24T00:00:00Z');
    const store = createMemoryChainEventStore({ now: () => now });
    const scope = { anchor: 'a', vault: VAULT, token: TOKEN, deployBlock: 1n };
    expect(await store.claimLease('hardhat-local', 'dead-worker', 1, scope, 0n)).not.toBeNull();

    now = new Date('2026-10-24T00:00:02Z');
    const source = fakeSource({ head: 3n, scope, logs: [log(VAULT, 2n)] });
    const index = createEventIndex({
      chain: 'hardhat-local', store, source,
      config: { ...config, confirmations: 0 },
    });
    await expect(index.readEvents({ contract: VAULT })).resolves.toHaveLength(1);
    expect((await store.readCursor('hardhat-local'))?.lastBlock).toBe(3n);
    expect((await store.readCursor('hardhat-local'))?.leaseOwner).toBeNull();
  });

  it('gia hạn lease sau từng đoạn nên worker khác không chen vào giữa lượt dài', async () => {
    let nowMs = Date.parse('2026-10-24T00:00:00Z');
    const store = createMemoryChainEventStore({ now: () => new Date(nowMs) });
    const base = fakeSource({ head: 6n, logs: [log(VAULT, 2n), log(VAULT, 4n), log(VAULT, 6n)] });
    const rivalClaims: Array<unknown> = [];
    const source: EventIndexSource = {
      ...base,
      async fetchLogs(from, to) {
        nowMs += 800;
        if (from > 1n) {
          rivalClaims.push(await store.claimLease(
            'hardhat-local', 'rival', 10,
            { anchor: '0xanchor-a', vault: VAULT, token: TOKEN, deployBlock: 1n },
            0n,
          ));
        }
        return base.fetchLogs(from, to);
      },
    };
    const index = createEventIndex({
      chain: 'hardhat-local', store, source,
      config: { ...config, confirmations: 0, segmentBlocks: 2, leaseSeconds: 1 },
    });

    await expect(index.readEvents({ contract: VAULT })).resolves.toHaveLength(3);
    expect(rivalClaims).toEqual([null, null]);
    expect((await store.readCursor('hardhat-local'))?.lastBlock).toBe(6n);
  });

  it('giữ mọi ví Transfer kể cả số dư hiện tại bằng 0, sắp theo ví', async () => {
    const alice = '0x00000000000000000000000000000000000000a1';
    const bob = '0x00000000000000000000000000000000000000b2';
    const zero = '0x0000000000000000000000000000000000000000';
    const source = fakeSource({
      head: 3n,
      logs: [
        log(TOKEN, 1n, 'Transfer', { from: zero, to: alice, value: '10' }),
        log(TOKEN, 2n, 'Transfer', { from: alice, to: bob, value: '10' }),
        log(TOKEN, 3n, 'Transfer', { from: bob, to: zero, value: '2' }),
      ],
    });
    const index = createEventIndex({
      chain: 'hardhat-local', store: createMemoryChainEventStore(), source,
      config: { ...config, confirmations: 0 },
    });
    expect(await index.listTokenWallets()).toMatchObject({
      wallets: [
        { wallet: alice, balance: 0n },
        { wallet: bob, balance: 8n },
      ],
      truncated: false,
      asOfBlock: 3n,
    });
  });

  it('đổi riêng anchor loại toàn bộ sự kiện phiên node cũ', async () => {
    const store = createMemoryChainEventStore();
    const source = fakeSource({ head: 2n, logs: [log(VAULT, 2n)] });
    const index = createEventIndex({
      chain: 'hardhat-local', store, source,
      config: { ...config, confirmations: 0 },
    });
    expect(await index.readEvents({ contract: VAULT })).toHaveLength(1);

    source.setScope({ anchor: '0xanchor-after-reset', vault: VAULT, token: TOKEN, deployBlock: 1n });
    const afterReset = await index.readEvents({ contract: VAULT });
    expect(afterReset).toHaveLength(1);
    expect(afterReset[0]?.anchor).toBe('0xanchor-after-reset');
    expect(await store.listEvents({
      chain: 'hardhat-local', anchor: '0xanchor-after-reset', contract: VAULT, toBlock: 2n,
    })).toHaveLength(1);
    expect((await store.readCursor('hardhat-local'))?.anchor).toBe('0xanchor-after-reset');
  });

  it('giới hạn danh sách ví theo thứ tự xác định và bật truncated bằng dòng sentinel', async () => {
    const zero = '0x0000000000000000000000000000000000000000';
    const alice = '0x00000000000000000000000000000000000000a1';
    const bob = '0x00000000000000000000000000000000000000b2';
    const source = fakeSource({
      head: 2n,
      logs: [
        log(TOKEN, 1n, 'Transfer', { from: zero, to: bob, value: '2' }),
        log(TOKEN, 2n, 'Transfer', { from: zero, to: alice, value: '1' }),
      ],
    });
    const index = createEventIndex({
      chain: 'hardhat-local', store: createMemoryChainEventStore(), source,
      config: { ...config, confirmations: 0, walletLimit: 1 },
    });

    expect(await index.listTokenWallets()).toMatchObject({
      wallets: [{ wallet: alice, balance: 1n }],
      truncated: true,
      asOfBlock: 2n,
    });
  });

  it('lỗi nguồn khi sync trả lease rồi đọc trực tiếp; lỗi kho không bị che', async () => {
    const store = createMemoryChainEventStore();
    const source = fakeSource({ head: 3n, logs: [log(VAULT, 2n)] });
    const realFetch = source.fetchLogs.bind(source);
    source.fetchLogs = vi.fn()
      .mockRejectedValueOnce(new Error('RPC sync hỏng'))
      .mockImplementation(realFetch);
    const index = createEventIndex({
      chain: 'hardhat-local', store, source,
      config: { ...config, confirmations: 0 }, warn: vi.fn(),
    });
    await expect(index.readEvents({ contract: VAULT })).resolves.toHaveLength(1);
    expect((await store.readCursor('hardhat-local'))?.leaseOwner).toBeNull();

    const brokenStore = { ...store, listEvents: vi.fn().mockRejectedValue(new Error('DB hỏng')) };
    const broken = createEventIndex({
      chain: 'hardhat-local', store: brokenStore, source,
      config: { ...config, confirmations: 0 }, warn: vi.fn(),
    });
    await expect(broken.readEvents({ contract: VAULT })).rejects.toThrow('DB hỏng');
  });
});
