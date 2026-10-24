import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getContractAddress } from '@bidv/shared';
import type { Account } from 'viem';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';
import { createMemoryChainEventStore } from '@/lib/store/memory.chain-event.store';

const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ALICE = '0x976EA74026E726554dB657fA54763abd0C3a0aa9';
const BOB = '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955';

const signer: ISigner = {
  kind: 'server',
  async getAddress() { return ADMIN; },
  async getAccount() { return { address: ADMIN, type: 'json-rpc' } as Account; },
};

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('IN-01: Indexer trên nút Hardhat thật', () => {
  const store = createMemoryChainEventStore();
  let ledger: ILedgerPort;
  const original = {
    rpc: process.env.RPC_HARDHAT,
    confirmations: process.env.INDEXER_CONFIRMATIONS,
    segmentBlocks: process.env.INDEXER_SEGMENT_BLOCKS,
    maxBlocks: process.env.INDEXER_MAX_BLOCKS_PER_SYNC,
    leaseSeconds: process.env.INDEXER_LEASE_SECONDS,
  };

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.INDEXER_CONFIRMATIONS = '0';
    process.env.INDEXER_SEGMENT_BLOCKS = '50000';
    process.env.INDEXER_MAX_BLOCKS_PER_SYNC = '200000';
    process.env.INDEXER_LEASE_SECONDS = '60';
    resetServerEnvCache();
    resetChainRegistryCache();
    ledger = createEvmLedger('hardhat-local', signer, { eventStore: store });

    for (const wallet of [ALICE, BOB]) {
      if (!(await ledger.isWhitelisted(wallet))) {
        await ledger.waitReceipt((await ledger.whitelist(wallet)).txHash);
      }
    }
  });

  afterAll(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('RPC_HARDHAT', original.rpc);
    restore('INDEXER_CONFIRMATIONS', original.confirmations);
    restore('INDEXER_SEGMENT_BLOCKS', original.segmentBlocks);
    restore('INDEXER_MAX_BLOCKS_PER_SYNC', original.maxBlocks);
    restore('INDEXER_LEASE_SECONDS', original.leaseSeconds);
    resetServerEnvCache();
    resetChainRegistryCache();
  });

  it('phát hành, chuyển và đốt hết vẫn giữ cả hai ví với số dư 0; chạy lại không nhân log', async () => {
    const vault = getContractAddress('hardhat-local', 'SpvPaymentVault');
    if (!(await ledger.isInitialSupplyMinted())) {
      await ledger.waitReceipt((await ledger.mintInitialSupply(vault, 100n)).txHash);
    }
    await ledger.waitReceipt((await ledger.forcedTransfer(vault, ALICE, 7n)).txHash);
    await ledger.waitReceipt((await ledger.forcedTransfer(ALICE, BOB, 7n)).txHash);
    await ledger.waitReceipt((await ledger.burn(BOB, 7n)).txHash);

    const first = await ledger.listTokenWallets();
    const byWallet = new Map(first.wallets.map((entry) => [entry.wallet, entry.balance]));
    expect(byWallet.get(ALICE.toLowerCase())).toBe(0n);
    expect(byWallet.get(BOB.toLowerCase())).toBe(0n);
    expect(first.wallets.map((entry) => entry.wallet)).toEqual(
      [...first.wallets.map((entry) => entry.wallet)].sort(),
    );
    expect(first.asOfBlock).not.toBeNull();

    const cursor = await store.readCursor('hardhat-local');
    expect(cursor?.lastBlock).toBe(first.asOfBlock);
    const storedBefore = await store.listEvents({
      chain: 'hardhat-local',
      anchor: cursor!.anchor,
      contract: cursor!.token,
      eventNames: ['Transfer'],
      toBlock: cursor!.lastBlock,
    });
    expect(storedBefore.filter((event) =>
      event.args.from === ALICE || event.args.to === ALICE ||
      event.args.from === BOB || event.args.to === BOB
    )).toHaveLength(3);

    const second = await ledger.listTokenWallets();
    expect(second).toEqual(first);
    expect(await store.listEvents({
      chain: 'hardhat-local',
      anchor: cursor!.anchor,
      contract: cursor!.token,
      eventNames: ['Transfer'],
      toBlock: cursor!.lastBlock,
    })).toHaveLength(storedBefore.length);
  }, 120_000);
});
