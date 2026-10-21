import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPublicClient, http, type Account, type Hex } from 'viem';
import { hardhat } from 'viem/chains';
import { getContractAddress } from '@bidv/shared';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';
import type { ISigner } from '@/lib/signer';
import { placeSignedOrder } from './helpers/permit-signer';

/**
 * OP-05 ca 4: vòng nghiệp vụ lượt 12 đến 13.8 của runbook (QĐ-H) trên nút Hardhat THẬT, bằng service
 * của app, khẳng định TỪNG Ô bảng "Số dư kỳ vọng" của spec. Ca 5: chạy `dod-verify-sepolia.js` trên
 * `localhost` sau deploy thì thoát lỗi QĐ-J, nonce ví ký không đổi.
 *
 * Chạy riêng một lệnh trên nút vừa dựng lại (`scripts/evm-local.sh reset`): bảng giả định vault mới
 * triển khai và hai ví mới. Ba vai trò địa chỉ của runbook dùng tài khoản mở sẵn của nút (không ví
 * mẫu `NDT001`/`NB001`): INVESTOR_WALLET là #2 (ký permit qua `eth_signTypedData_v4`, không gửi giao
 * dịch nào), PAYOUT_WALLET là #6. Lượt 13.6 là bước tay duy nhất (lệnh console mint VNDB vào quỹ).
 * Lệch bảng thì báo Supervisor kèm số đo, không sửa bảng.
 */
const HARDHAT_RPC = process.env.TEST_HARDHAT_RPC;
const CHAIN = 'hardhat-local' as const;
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const INVESTOR_WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Hex;
const PAYOUT_WALLET = '0x976EA74026E726554dB657fA54763abd0C3a0aa9' as Hex;
const VAULT = getContractAddress(CHAIN, 'SpvPaymentVault');
const DISTRIBUTOR = getContractAddress(CHAIN, 'ProfitDistributor');

/** Bảng "Số dư kỳ vọng" của spec OP-05, theo đúng thứ tự cột. */
const COLUMNS = ['investorWpt', 'investorVndb', 'vaultWpt', 'vaultVndb', 'netProceeds', 'lockedAmount', 'withdrawable'] as const;
const EXPECTED: Record<string, readonly bigint[]> = {
  '13.1': [0n, 0n, 1_000_000n, 0n, 0n, 0n, 0n],
  '13.3': [0n, 20_000_000n, 1_000_000n, 0n, 0n, 0n, 0n],
  '13.4': [100n, 10_000_000n, 999_900n, 10_000_000n, 10_000_000n, 2_000_000n, 8_000_000n],
  '13.5': [60n, 14_000_000n, 999_940n, 6_000_000n, 6_000_000n, 1_200_000n, 4_800_000n],
  '13.7': [60n, 14_000_060n, 999_940n, 6_999_940n, 6_000_000n, 200_000n, 6_799_940n],
  '13.8': [60n, 14_000_060n, 999_940n, 3_599_970n, 6_000_000n, 200_000n, 3_399_970n],
};

const signer: ISigner = {
  kind: 'server',
  async getAddress() {
    return ADMIN;
  },
  async getAccount() {
    return { address: ADMIN, type: 'json-rpc' } as Account;
  },
};

const live = HARDHAT_RPC ? describe.sequential : describe.skip;

live('OP-05 ca 4: vòng trình diễn lượt 12 đến 13.8 trên nút Hardhat thật', { timeout: 120_000 }, () => {
  const keys = ['RPC_HARDHAT', 'SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL', 'USE_MOCK_DB', 'DEMO_ROLE', 'DEMO_ACTOR', 'ENABLE_DEMO_PAYMENT_MINT'] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const client = createPublicClient({ chain: hardhat, transport: http(HARDHAT_RPC) });
  let direct: ILedgerPort;
  let resetServerEnvCache: () => void;
  let investorEth: bigint;

  function actAs(role: 'CONTROLLER' | 'TELLER' | 'INVESTOR' | 'SELLER', actor: string) {
    process.env.DEMO_ROLE = role;
    process.env.DEMO_ACTOR = actor;
    resetServerEnvCache();
  }

  async function confirmed(pending: Promise<TxResult>) {
    const receipt = await direct.waitReceipt((await pending).txHash);
    expect(receipt.status, receipt.reason).toBe('CONFIRMED');
    return receipt;
  }

  /** Một dòng bảng số dư đọc thẳng từ chuỗi. */
  async function row(): Promise<bigint[]> {
    const vault = (await direct.vaultStatus())!;
    const values = {
      investorWpt: await direct.balanceOf(INVESTOR_WALLET),
      investorVndb: await direct.paymentBalanceOf(INVESTOR_WALLET),
      vaultWpt: await direct.balanceOf(VAULT),
      vaultVndb: await direct.paymentBalanceOf(VAULT),
      netProceeds: vault.netProceeds,
      lockedAmount: vault.lockedAmount,
      withdrawable: vault.withdrawable,
    };
    return COLUMNS.map((column) => values[column]);
  }

  /** So TỪNG ô, kèm tên cột, để lệch thì biết ngay ô nào và số đo bao nhiêu. */
  async function expectRow(turn: keyof typeof EXPECTED) {
    const measured = await row();
    expect(Object.fromEntries(COLUMNS.map((c, i) => [c, measured[i]])), `sau lượt ${turn}`).toEqual(
      Object.fromEntries(COLUMNS.map((c, i) => [c, EXPECTED[turn]![i]])),
    );
  }

  /** Điều kiện "Định danh" màn `/trade` kiểm trước khi cho xác nhận lệnh. */
  async function identityPassed(wptAmount: string, side: 'BUY' | 'SELL') {
    const { previewTrade } = await import('@/lib/bank/trade.service');
    const preview = await previewTrade({ chain: CHAIN, investorWallet: INVESTOR_WALLET, wptAmount, side });
    expect(preview.ok, preview.ok ? '' : preview.error).toBe(true);
    return preview.ok && preview.data.conditions.find((condition) => condition.key === 'identity')!.passed;
  }

  beforeAll(async () => {
    process.env.RPC_HARDHAT = HARDHAT_RPC;
    process.env.SERVER_SIGNER_PRIVATE_KEY_HARDHAT_LOCAL = ADMIN_KEY;
    process.env.USE_MOCK_DB = 'true';
    process.env.ENABLE_DEMO_PAYMENT_MINT = 'true';
    const env = await import('@/lib/config/env');
    resetServerEnvCache = env.resetServerEnvCache;
    const { resetChainRegistryCache } = await import('@/lib/chains/registry');
    const { resetSignerCache } = await import('@/lib/signer');
    const { createEvmLedger } = await import('@/lib/ledger/evm.adapter');
    const store = await import('@/lib/store');
    resetServerEnvCache();
    resetChainRegistryCache();
    resetSignerCache();
    store.resetMemoryStore();
    store.resetStoreCache();
    direct = createEvmLedger(CHAIN, signer);
    investorEth = await client.getBalance({ address: INVESTOR_WALLET });

    // Bước 7 runbook (ngân hàng): whitelist PAYOUT_WALLET và INVESTOR_WALLET qua màn có sẵn.
    const { onboardInvestor } = await import('@/lib/bank/mint.service');
    actAs('TELLER', 'GDV001');
    for (const wallet of [PAYOUT_WALLET, INVESTOR_WALLET]) {
      const onboarded = await onboardInvestor({ chain: CHAIN, wallet });
      expect(onboarded.ok && onboarded.data.whitelisted, onboarded.ok ? '' : onboarded.error).toBe(true);
    }
  });

  afterAll(async () => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    resetServerEnvCache();
  });

  it('lượt 12: Kiểm soát viên đặt ví nhận, PERCENT 20%, không số cố định: ba giao dịch; màn /vault hiện PERCENT, 20%, khoá 0', async () => {
    const { getVaultOverview, saveVaultConfig } = await import('@/lib/bank/vault.service');
    actAs('CONTROLLER', 'KSV001');
    const saved = await saveVaultConfig({ chain: CHAIN, percent: '20', fixedLock: '', payoutWallet: PAYOUT_WALLET });
    expect(saved.ok, saved.ok ? '' : saved.error).toBe(true);
    expect(saved.ok && saved.data.steps.map((step) => step.kind)).toEqual(['setPayoutWallet', 'setPercentRate', 'setLockMode']);
    const overview = await getVaultOverview({ chain: CHAIN });
    expect(overview.ok && overview.data.status).toMatchObject({
      lockMode: 'PERCENT',
      percentRateBps: '2000',
      lockedAmount: '0',
      payoutWallet: PAYOUT_WALLET,
    });
  });

  it('lượt 13.1: Mint đầu 1.000.000 WPT vào vault qua lập (Giao dịch viên) và duyệt (Kiểm soát viên)', async () => {
    const { approveTokenRequest, createTokenRequest } = await import('@/lib/bank/token-request.service');
    actAs('TELLER', 'GDV001');
    const created = await createTokenRequest({
      chain: CHAIN,
      type: 'MINT',
      wallet: VAULT,
      amount: '1000000',
      reason: 'OP-05 lượt 13.1: Mint đầu vào vault',
    });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    if (!created.ok) return;
    actAs('CONTROLLER', 'KSV001');
    const approved = await approveTokenRequest({ chain: CHAIN, requestId: created.data.request.id });
    expect(approved.ok, approved.ok ? '' : approved.error).toBe(true);
    await expectRow('13.1');
  });

  it('lượt 13.2: Nhà đầu tư liên kết INVESTOR_WALLET vào hồ sơ NDT001; trước đó điều kiện Định danh trượt', async () => {
    const { linkProfileWallet } = await import('@/lib/bank/account-profile.service');
    actAs('INVESTOR', 'NDT001');
    expect(await identityPassed('100', 'BUY')).toBe(false);
    const linked = await linkProfileWallet({ chain: CHAIN, wallet: INVESTOR_WALLET });
    expect(linked.ok && linked.data.linked, linked.ok ? '' : linked.error).toBe(INVESTOR_WALLET);
    expect(await identityPassed('100', 'BUY')).toBe(true);
  });

  it('lượt 13.3: nạp 20.000.000 VNDB demo cho INVESTOR_WALLET', async () => {
    const { mintDemoPayment } = await import('@/lib/bank/demo-payment.service');
    actAs('TELLER', 'GDV001');
    const minted = await mintDemoPayment({ chain: CHAIN, wallet: INVESTOR_WALLET, amount: '20000000' });
    expect(minted.ok, minted.ok ? '' : minted.error).toBe(true);
    await expectRow('13.3');
  });

  it('lượt 13.4, 13.5: mua 100 rồi bán 40 WPT bằng chữ ký permit, từng lệnh một', async () => {
    actAs('INVESTOR', 'NDT001');
    for (const [turn, side, wptAmount] of [['13.4', 'BUY', '100'], ['13.5', 'SELL', '40']] as const) {
      expect(await identityPassed(wptAmount, side)).toBe(true);
      const { result } = await placeSignedOrder(HARDHAT_RPC!, { investorWallet: INVESTOR_WALLET, side, wptAmount });
      expect(result.ok && result.data.status, result.ok ? '' : result.error).toBe('COMPLETED');
      await expectRow(turn);
    }
  });

  it('lượt 13.6, 13.7: mint 1.000.000 VNDB vào ProfitDistributor (bước tay), Kiểm soát viên duyệt thì chia ngay', async () => {
    await confirmed(direct.mintPayment(DISTRIBUTOR, 1_000_000n));
    expect(await direct.unallocatedProfit()).toBe(1_000_000n);

    const { approveDistribution } = await import('@/lib/bank/distribution-approval.service');
    actAs('CONTROLLER', 'KSV001');
    const approved = await approveDistribution({ chain: CHAIN, expectedAmount: '1000000' });
    expect(approved.ok, approved.ok ? '' : approved.error).toBe(true);
    expect(approved.ok && approved.data.outcome).toBe('DISTRIBUTED');
    await expectRow('13.7');
    expect(await direct.unallocatedProfit()).toBe(0n);
    expect(await direct.vaultStatus()).toMatchObject({
      lastPeriodRef: 1n,
      lastDistributedPrev: 1_000_000n,
      percentLocked: 200_000n,
    });
  });

  it('lượt 13.8: Người bán rút 3.399.970 VNDB về PAYOUT_WALLET; ETH của INVESTOR_WALLET không đổi suốt vòng', async () => {
    const { createWithdrawRequest } = await import('@/lib/bank/withdraw.service');
    const payoutBefore = await direct.paymentBalanceOf(PAYOUT_WALLET);
    actAs('SELLER', 'NB001');
    const created = await createWithdrawRequest({
      chain: CHAIN,
      amount: '3399970',
      purpose: 'OP-05 lượt 13.8: rút 50% phần rút được',
      note: '',
      otp: '123456',
      clientRequestId: randomUUID(),
    });
    expect(created.ok, created.ok ? '' : created.error).toBe(true);
    expect(created.ok && created.data).toMatchObject({ status: 'COMPLETED', payoutWallet: PAYOUT_WALLET });
    await expectRow('13.8');
    expect((await direct.paymentBalanceOf(PAYOUT_WALLET)) - payoutBefore).toBe(3_399_970n);
    expect(await client.getBalance({ address: INVESTOR_WALLET })).toBe(investorEth);
    expect(await client.getTransactionCount({ address: INVESTOR_WALLET })).toBe(0);
  });

  it('ca 5: dod-verify-sepolia.js trên localhost thoát lỗi QĐ-J trước khi gửi, nonce ví ký không đổi', async () => {
    const nonceBefore = await client.getTransactionCount({ address: ADMIN });
    const run = () =>
      execFileSync('npx', ['hardhat', 'run', 'scripts/dod-verify-sepolia.js', '--network', 'localhost'], {
        cwd: path.resolve(__dirname, '../../packages/contracts-evm'),
        env: { ...process.env, INVESTOR_A: INVESTOR_WALLET },
        encoding: 'utf8',
        stdio: 'pipe',
      });
    const failure = (() => {
      try {
        run();
        return null;
      } catch (error) {
        return error as { status: number | null; stdout: string; stderr: string };
      }
    })();
    expect(failure, 'script phải thoát lỗi').not.toBeNull();
    expect(failure!.status).not.toBe(0);
    expect(`${failure!.stdout}${failure!.stderr}`).toContain('bộ hợp đồng có vault, dùng runbook OP-05');
    expect(await client.getTransactionCount({ address: ADMIN })).toBe(nonceBefore);
  });
});
