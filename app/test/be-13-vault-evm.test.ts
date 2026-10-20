import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_WALLETS, getContractAddress, spvPaymentVaultAbi } from '@bidv/shared';
import { createPublicClient, createWalletClient, http, type Abi, type Account, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { LedgerError } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';
import { placeSignedOrder } from './helpers/permit-signer';

/**
 * BE-13 trên nút Hardhat thật: ca 7 (cấu hình và rút qua service) rồi cổng cấu hình và rút của
 * adapter EVM. Chạy riêng một lệnh trên nút vừa dựng lại (`scripts/evm-local.sh reset`): ca 7 cần
 * vault mới triển khai để `withdrawable` đúng 8.000.000 sau một lệnh mua 100 WPT.
 */
const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const PAYOUT = SAMPLE_WALLETS.NB001;
const UNVERIFIED = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';

const signer: ISigner = {
  kind: 'server',
  async getAddress() { return ADMIN; },
  async getAccount() { return { address: ADMIN, type: 'json-rpc' } as Account; },
};

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Hex;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

live('BE-13 ca 7: Kiểm soát viên cấu hình, Người bán rút qua service trên nút Hardhat thật', () => {
  const vault = getContractAddress('hardhat-local', 'SpvPaymentVault') as Hex;
  const ledger = createEvmLedger('hardhat-local', signer);
  const keys = ['RPC_HARDHAT', 'SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', 'USE_MOCK_DB', 'DEMO_ROLE', 'DEMO_ACTOR'] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  async function actAs(role: 'CONTROLLER' | 'SELLER' | 'INVESTOR', actor: string) {
    process.env.DEMO_ROLE = role;
    process.env.DEMO_ACTOR = actor;
    resetServerEnvCache();
  }

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    const { resetSignerCache } = await import('@/lib/signer');
    const { resetMemoryStore, resetStoreCache } = await import('@/lib/store');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    resetMemoryStore();
    resetStoreCache();

    for (const wallet of [INVESTOR, PAYOUT]) await ledger.waitReceipt((await ledger.whitelist(wallet)).txHash);
    await ledger.waitReceipt((await ledger.mintInitialSupply(vault, 5_000n)).txHash);
    await ledger.waitReceipt((await ledger.mintPayment(INVESTOR, 2_000_000_000n)).txHash);
  });

  afterAll(async () => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    const { resetSignerCache } = await import('@/lib/signer');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
  });

  it('PERCENT 20%, mua 100 WPT (withdrawable 8.000.000), rút 3.000.000: COMPLETED, số dư đúng, Txn và audit có dòng, khoá đã nhả', async () => {
    const { saveVaultConfig } = await import('@/lib/bank/vault.service');
    const { createWithdrawRequest } = await import('@/lib/bank/withdraw.service');
    const { getStore, getVaultStore } = await import('@/lib/store');

    await actAs('CONTROLLER', 'KSV001');
    const saved = await saveVaultConfig({ chain: 'hardhat-local', percent: '20', fixedLock: '', payoutWallet: PAYOUT });
    expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
    expect(saved.ok && saved.data.steps.map((step) => step.kind)).toEqual(['setPayoutWallet', 'setPercentRate', 'setLockMode']);

    await actAs('INVESTOR', 'NDT001');
    const { result: buy } = await placeSignedOrder(HARDHAT_RPC!, { investorWallet: INVESTOR, side: 'BUY', wptAmount: '100' });
    expect(buy.ok && buy.data.status).toBe('COMPLETED');
    const before = (await ledger.vaultStatus())!;
    expect(before).toMatchObject({ lockMode: 'PERCENT', netProceeds: 10_000_000n, lockedAmount: 2_000_000n, withdrawable: 8_000_000n });
    const payoutBefore = await ledger.paymentBalanceOf(PAYOUT);

    await actAs('SELLER', 'NB001');
    const created = await createWithdrawRequest({
      chain: 'hardhat-local',
      amount: '3000000',
      purpose: 'Chi trả vận hành',
      note: '',
      otp: '123456',
      clientRequestId: randomUUID(),
    });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;
    expect(created.data).toMatchObject({ status: 'COMPLETED', amount: '3000000', payoutWallet: PAYOUT });
    expect(await ledger.paymentBalanceOf(PAYOUT)).toBe(payoutBefore + 3_000_000n);
    expect((await ledger.vaultStatus())?.withdrawable).toBe(5_000_000n);

    const receipt = await ledger.vaultWithdrawalReceipt(created.data.txHash!);
    expect(receipt?.withdrawals).toEqual([expect.objectContaining({ to: PAYOUT, amount: 3_000_000n, operator: ADMIN })]);
    expect(await getStore().findTxnByHash('hardhat-local', created.data.txHash!)).toMatchObject({
      operation: 'vault:withdraw',
      status: 'CONFIRMED',
      amount: '3000000',
    });
    const audits = await getStore().listAudit({ limit: 100 });
    expect(audits.some((row) => row.action === 'vault:withdraw' && row.outcome === 'SUCCESS' && row.detail?.includes('hoàn tất'))).toBe(true);
    expect(await getVaultStore().findOperationLock('hardhat-local')).toBeNull();
  });

  it('ca 5b (QĐ-C1): hai lần lưu nữa và một lần đổi bằng vault-admin.js; lịch sử đủ, dòng script ghi "ngoài app"', async () => {
    const { getVaultConfigHistory, saveVaultConfig } = await import('@/lib/bank/vault.service');
    await actAs('CONTROLLER', 'KSV001');
    for (const input of [{ percent: '25', fixedLock: '' }, { percent: '25', fixedLock: '500' }]) {
      const saved = await saveVaultConfig({ chain: 'hardhat-local', payoutWallet: PAYOUT, ...input });
      expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
    }
    // Script khẩn cấp: cùng ví admin #0 ký nhưng không đi qua app, nên không có dòng Txn.
    execFileSync('npx', ['hardhat', 'run', 'scripts/vault-admin.js', '--network', 'localhost'], {
      cwd: path.resolve(__dirname, '../../packages/contracts-evm'),
      env: { ...process.env, VAULT_ADMIN_ACTION: 'set-rate', VAULT_PERCENT_BPS: '3000', VAULT_ADMIN_CONFIRM: 'yes' },
      stdio: 'pipe',
    });

    const history = await getVaultConfigHistory({ chain: 'hardhat-local' });
    expect(history.ok, history.ok ? '' : history.error).toBe(true);
    if (!history.ok) return;
    const app = { source: 'APP', role: 'CONTROLLER', signer: ADMIN };
    expect(history.data.rows.slice(0, 7).map(({ param, oldValue, newValue, actor }) => ({ param, oldValue, newValue, actor }))).toEqual([
      { param: 'PERCENT_RATE', oldValue: '2500', newValue: '3000', actor: { source: 'OUTSIDE_APP' } },
      { param: 'LOCK_MODE', oldValue: 'PERCENT', newValue: 'FIXED', actor: app },
      { param: 'FIXED_LOCK', oldValue: '0', newValue: '500', actor: app },
      { param: 'PERCENT_RATE', oldValue: '2000', newValue: '2500', actor: app },
      { param: 'LOCK_MODE', oldValue: 'UNSET', newValue: 'PERCENT', actor: app },
      { param: 'PERCENT_RATE', oldValue: '0', newValue: '2000', actor: app },
      { param: 'PAYOUT_WALLET', oldValue: null, newValue: PAYOUT, actor: app },
    ]);
    expect(history.data.rows.every((row) => row.timestamp > 0)).toBe(true);
  }, 120_000);
});

live('BE-13: cổng cấu hình và rút vault trên nút Hardhat thật', () => {
  const oldRpc = process.env.RPC_HARDHAT;
  const vaultAddress = getContractAddress('hardhat-local', 'SpvPaymentVault') as Hex;
  const ledger = createEvmLedger('hardhat-local', signer);

  beforeAll(() => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    resetServerEnvCache();
    resetChainRegistryCache();
  });

  afterAll(() => {
    if (oldRpc === undefined) delete process.env.RPC_HARDHAT;
    else process.env.RPC_HARDHAT = oldRpc;
    resetServerEnvCache();
    resetChainRegistryCache();
  });

  /** Gọi thẳng hàm vault không có trong cổng (tạm dừng rút), như `vault-admin.js`. */
  async function adminWrite(functionName: string) {
    const account: Account = { address: ADMIN, type: 'json-rpc' };
    const publicClient = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
    const walletClient = createWalletClient({ account, chain: hardhat, transport: http(HARDHAT_RPC) });
    const { request } = await publicClient.simulateContract({
      account,
      address: vaultAddress,
      abi: spvPaymentVaultAbi as Abi,
      functionName: functionName as never,
    });
    const hash = await walletClient.writeContract(request as never);
    expect((await publicClient.waitForTransactionReceipt({ hash })).status).toBe('success');
  }

  async function confirmed(pending: Promise<{ txHash: string }>) {
    const { txHash } = await pending;
    expect(await ledger.waitReceipt(txHash)).toMatchObject({ status: 'CONFIRMED' });
    return txHash;
  }

  it('bốn setter cấu hình lên chuỗi; ví nhận chưa xác minh và chế độ UNSET bị từ chối', async () => {
    await confirmed(ledger.whitelist(PAYOUT));
    await confirmed(ledger.setVaultPayoutWallet(PAYOUT));
    await confirmed(ledger.setVaultFixedLock(100n));
    await confirmed(ledger.setVaultLockMode('FIXED'));
    await confirmed(ledger.setVaultPercentRate(2_000n));
    expect(await ledger.vaultStatus()).toMatchObject({
      lockMode: 'FIXED',
      fixedLockAmount: 100n,
      percentRateBps: 2_000n,
      payoutWallet: PAYOUT,
    });

    await expect(ledger.setVaultPayoutWallet(UNVERIFIED)).rejects.toThrow(
      'Ví nhận tiền rút chưa được xác minh trong sổ danh tính.',
    );
    await expect(ledger.setVaultPercentRate(10_001n)).rejects.toThrow('Tỷ lệ khoá không được vượt 100%.');
    await expect(ledger.setVaultLockMode('UNSET' as 'FIXED')).rejects.toThrow(LedgerError);
  });

  it('rút về ví nhận: biên nhận có sự kiện Withdrawn, quét ứng viên từ claimedBlock, block tăng', async () => {
    await confirmed(ledger.mintPayment(vaultAddress, 1_000n));
    const status = await ledger.vaultStatus();
    expect(status?.withdrawable).toBe(status!.vndbBalance - 100n);
    const payoutBefore = await ledger.paymentBalanceOf(PAYOUT);

    await expect(ledger.withdrawFromVault(status!.withdrawable + 1n)).rejects.toThrow(
      'Số tiền rút vượt phần VNDB hiện được phép rút.',
    );

    const claimedBlock = await ledger.latestBlockNumber();
    const txHash = await confirmed(ledger.withdrawFromVault(300n));
    expect(await ledger.latestBlockNumber()).toBeGreaterThan(claimedBlock);
    expect(await ledger.paymentBalanceOf(PAYOUT)).toBe(payoutBefore + 300n);

    const receipt = await ledger.vaultWithdrawalReceipt(txHash);
    expect(receipt).toMatchObject({ txHash, status: 'CONFIRMED' });
    expect(receipt?.withdrawals).toHaveLength(1);
    expect(receipt?.withdrawals[0]).toMatchObject({ to: PAYOUT, amount: 300n, operator: ADMIN, txHash });

    const candidates = await ledger.findVaultWithdrawals({ fromBlock: claimedBlock, to: PAYOUT, amount: 300n });
    expect(candidates).toEqual(receipt?.withdrawals);
    expect(await ledger.findVaultWithdrawals({ fromBlock: claimedBlock, to: PAYOUT, amount: 299n })).toEqual([]);
    expect(await ledger.findVaultWithdrawals({ fromBlock: receipt!.withdrawals[0].blockNumber + 1n })).toEqual([]);

    // Giao dịch khác của vault: có biên nhận, không có sự kiện rút. Mã lạ: chưa có biên nhận.
    const configTx = await confirmed(ledger.setVaultFixedLock(100n));
    expect((await ledger.vaultWithdrawalReceipt(configTx))?.withdrawals).toEqual([]);
    expect(await ledger.vaultWithdrawalReceipt(`0x${'ab'.repeat(32)}`)).toBeNull();
  });

  it('vault tạm dừng thì rút bị từ chối với câu riêng của vault', async () => {
    await adminWrite('pauseWithdrawals');
    try {
      await expect(ledger.withdrawFromVault(1n)).rejects.toThrow('Vault đang tạm dừng rút.');
    } finally {
      await adminWrite('unpauseWithdrawals');
    }
  });
});
