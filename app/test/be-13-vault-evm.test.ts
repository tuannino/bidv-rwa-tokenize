import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_WALLETS, getContractAddress, spvPaymentVaultAbi } from '@bidv/shared';
import { createPublicClient, createWalletClient, http, type Abi, type Account, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import { resetChainRegistryCache } from '@/lib/chains/registry';
import { resetServerEnvCache } from '@/lib/config/env';
import { createEvmLedger } from '@/lib/ledger/evm.adapter';
import { LedgerError } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';

/**
 * BE-13 trên nút Hardhat thật: cổng cấu hình và rút vault của adapter EVM (bước 2). Chạy riêng một
 * lệnh trên nút vừa dựng lại (`scripts/evm-local.sh reset`), như các tệp nút thật khác.
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

live('BE-13 — cổng cấu hình và rút vault trên nút Hardhat thật', () => {
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
