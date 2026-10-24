import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getContractAddress, projectTokenAbi } from '@bidv/shared';
import { createWalletClient, http, type Account, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import { todayVn } from '@/lib/bank/recall-phase';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import type { ILedgerPort } from '@/lib/ledger/ledger.port';
import { resetSignerCache, type ISigner } from '@/lib/signer';
import { getProjectStore, getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

const RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;
const INVESTOR_A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
const INVESTOR_B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Hex;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const signer: ISigner = {
  kind: 'server',
  async getAddress() { return ADMIN; },
  async getAccount() { return { address: ADMIN, type: 'json-rpc' } as Account; },
};

async function confirmed(ledger: ILedgerPort, pending: Promise<{ txHash: string }>) {
  const receipt = await ledger.waitReceipt((await pending).txHash);
  expect(receipt.status, receipt.reason).toBe('CONFIRMED');
}

const live = RPC ? describe.sequential : describe.skip;

live('BE-05 — thu hồi đầu tư trên nút Hardhat thật', () => {
  let ledger: ILedgerPort;
  const original = Object.fromEntries([
    'RPC_HARDHAT', 'SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', 'USE_MOCK_DB',
    'ENABLE_DEMO_RECALL', 'DEMO_ROLE', 'DEMO_ACTOR',
  ].map((key) => [key, process.env[key]]));

  beforeAll(async () => {
    process.env.RPC_HARDHAT = RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    process.env.ENABLE_DEMO_RECALL = 'false';
    process.env.DEMO_ROLE = 'CONTROLLER';
    process.env.DEMO_ACTOR = 'KSV001';
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetMemoryStore();
    resetStoreCache();
    ledger = createEvmLedger('hardhat-local', signer);

    for (const wallet of [ADMIN, INVESTOR_A, INVESTOR_B]) await confirmed(ledger, ledger.whitelist(wallet));
    await confirmed(ledger, ledger.mintInitialSupply(ADMIN, 1_000n));
    await confirmed(ledger, ledger.transfer(ADMIN, INVESTOR_A, 120n));
    await confirmed(ledger, ledger.transfer(ADMIN, INVESTOR_B, 80n));
    await confirmed(ledger, ledger.freeze(INVESTOR_B, true));

    const project = (await getProjectStore().listProjects({ chain: 'hardhat-local' }))[0];
    expect(project).toBeTruthy();
    expect(await getProjectStore().markIssued({
      id: project.id,
      issuedAt: new Date().toISOString(),
      contractAddress: getContractAddress('hardhat-local', 'ProjectToken'),
    })).toMatchObject({ status: 'ISSUED' });
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetStoreCache();
  });

  it('mở kỳ, pause chặn chuyển, đốt cả ví bị đóng băng và đóng dự án', async () => {
    const { freezeToken, openRecall, recallBatch } = await import('@/lib/bank/recall.service');
    const opened = await openRecall({
      chain: 'hardhat-local', maturityDate: todayVn(), noticeDays: 0,
      reason: 'Dự án đã đến hạn thu hồi',
    });
    expect(opened.ok, opened.ok ? '' : opened.error).toBe(true);
    if (!opened.ok) return;

    const frozen = await freezeToken({ chain: 'hardhat-local', roundId: opened.data.id, confirmSymbol: 'WPT' });
    expect(frozen.ok, frozen.ok ? '' : frozen.error).toBe(true);
    expect(await ledger.isSettlementMode()).toBe(true);

    const investor = createWalletClient({
      account: { address: INVESTOR_A, type: 'json-rpc' },
      chain: hardhat,
      transport: http(RPC),
    });
    await expect(investor.writeContract({
      address: getContractAddress('hardhat-local', 'ProjectToken') as Hex,
      abi: projectTokenAbi,
      functionName: 'transfer',
      args: [INVESTOR_B, 1n],
    })).rejects.toThrow();

    const recalled = await recallBatch({ chain: 'hardhat-local', roundId: opened.data.id });
    expect(recalled).toMatchObject({
      ok: true,
      data: { burned: 2, pending: 0, failed: 0, remaining: 0, outsideRemaining: '0', completed: true },
    });
    expect(await ledger.balanceOf(INVESTOR_A)).toBe(0n);
    expect(await ledger.balanceOf(INVESTOR_B)).toBe(0n);
    expect((await getProjectStore().listProjects({ chain: 'hardhat-local' }))[0].status).toBe('CLOSED');
    const recallTxns = (await getStore().listTxns({ chain: 'hardhat-local', limit: 10 }))
      .filter((row) => row.operation === 'recall');
    expect(recallTxns).toHaveLength(2);
  }, 120_000);
});
