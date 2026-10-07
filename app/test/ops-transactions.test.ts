import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { getOrderStore, resetMemoryStore, resetStoreCache } from '@/lib/store';
import type { OrderStatus } from '@/lib/store/order.store.port';

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BOB = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);

const ops = () => import('@/lib/bank/ops-transactions.service');
const purchase = () => import('@/lib/bank/purchase.service');

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

async function createOrder(
  investorWallet: string,
  options: { side?: 'BUY' | 'SELL'; status?: OrderStatus; amount?: string } = {},
) {
  const amount = options.amount ?? '1';
  return getOrderStore().createOrder({
    chain: CHAIN,
    investorWallet,
    side: options.side ?? 'BUY',
    status: options.status,
    wptAmount: amount,
    vndAmount: (BigInt(amount) * PRICE).toString(),
    actorRole: 'INVESTOR',
  });
}

async function seedExecutableOrder() {
  const { getLedger } = await import('@/lib/ledger');
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  const ledger = getLedger(CHAIN);

  await ledger.whitelist(SPV);
  await ledger.whitelist(ALICE);
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  actAs('TELLER');
  const issued = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV, amount: '1000' });
  expect(issued.ok, issued.ok ? '' : issued.error).toBe(true);
  delete process.env.ENABLE_DEMO_TOKEN_MINT;

  seedMockLedger({
    paymentBalances: { [ALICE]: 10n * PRICE },
    paymentAllowances: { [ALICE]: 10n * PRICE },
  });
  actAs('INVESTOR');
  const placed = await (await purchase()).placeOrder({
    chain: CHAIN,
    investorWallet: ALICE,
    wptAmount: '2',
    clientRequestId: crypto.randomUUID(),
  });
  expect(placed.ok, placed.ok ? '' : placed.error).toBe(true);
  if (!placed.ok) throw new Error(placed.error);
  return placed.data.id;
}

beforeEach(() => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('TELLER');
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
  resetServerEnvCache();
  resetStoreCache();
});

describe('FE-06 — sổ lệnh vận hành', () => {
  it('lọc từng tiêu chí, trả danh sách nhà đầu tư và phân trang thật', async () => {
    const first = await createOrder(ALICE, { side: 'BUY', status: 'PLACED', amount: '1' });
    await createOrder(ALICE, { side: 'SELL', status: 'COMPLETED', amount: '2' });
    await createOrder(BOB, { side: 'BUY', status: 'FAILED', amount: '3' });

    const { listOpsOrders } = await ops();
    const byInvestor = await listOpsOrders({
      chain: CHAIN,
      investorWallet: ALICE,
      side: 'BUY',
      status: 'PLACED',
      page: 1,
      pageSize: 1,
    });
    expect(byInvestor.ok, byInvestor.ok ? '' : byInvestor.error).toBe(true);
    if (!byInvestor.ok) return;
    expect(byInvestor.data.rows.map((row) => row.id)).toEqual([first.id]);
    expect(byInvestor.data.total).toBe(1);
    expect(byInvestor.data.investors).toEqual(expect.arrayContaining([ALICE, BOB]));

    const searched = await listOpsOrders({ chain: CHAIN, q: first.id.slice(4, 15) });
    expect(searched.ok && searched.data.rows.map((row) => row.id)).toEqual([first.id]);

    const secondPage = await listOpsOrders({ chain: CHAIN, page: 2, pageSize: 1 });
    expect(secondPage.ok && secondPage.data.page).toBe(2);
    expect(secondPage.ok && secondPage.data.rows).toHaveLength(1);
    expect(secondPage.ok && secondPage.data.totalPages).toBe(3);
  });

  it('lấy bước hiện tại từ cùng ánh xạ năm bước với màn chi tiết', async () => {
    const record = await createOrder(ALICE, { status: 'CHECKING' });
    const { getOpsOrderDetail, listOpsOrders } = await ops();
    const listed = await listOpsOrders({ chain: CHAIN, q: record.id });
    const detail = await getOpsOrderDetail({ chain: CHAIN, orderId: record.id });

    expect(listed.ok, listed.ok ? '' : listed.error).toBe(true);
    expect(detail.ok, detail.ok ? '' : detail.error).toBe(true);
    if (!listed.ok || !detail.ok) return;
    const currentInDetail = detail.data.order.steps.find(
      (step) => step.state === 'current' || step.state === 'failed',
    );
    expect(listed.data.rows[0]?.currentStep).toEqual(currentInDetail);
    expect(listed.data.rows[0]?.currentStep.id).toBe('checking');
    expect(listed.data.rows[0]?.canExecute).toBe(true);
  });

  it('chỉ cho bấm can thiệp ở CHECKING hoặc EXECUTING có mã giao dịch', async () => {
    const checking = await createOrder(ALICE, { status: 'CHECKING' });
    const reconcilable = await createOrder(ALICE, { status: 'EXECUTING' });
    await getOrderStore().attachOrderTxHash({
      id: reconcilable.id,
      txHash: `0x${'a'.repeat(64)}`,
    });
    const manualOnly = await createOrder(BOB, { status: 'EXECUTING' });
    const completed = await createOrder(BOB, { status: 'COMPLETED' });

    const result = await (await ops()).listOpsOrders({ chain: CHAIN, pageSize: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = new Map(result.data.rows.map((row) => [row.id, row]));
    expect(rows.get(checking.id)).toMatchObject({ intervention: 'CONTINUE', canExecute: true });
    expect(rows.get(reconcilable.id)).toMatchObject({ intervention: 'RECONCILE', canExecute: true });
    expect(rows.get(manualOnly.id)).toMatchObject({
      intervention: 'MANUAL_RECONCILIATION',
      canExecute: false,
    });
    expect(rows.get(completed.id)).toMatchObject({ intervention: null, canExecute: false });
  });

  it('lệnh tự khớp và danh sách vận hành phản ánh ngay trạng thái cùng nguồn cung mới', async () => {
    const orderId = await seedExecutableOrder();
    const { listOpsOrders } = await ops();
    actAs('TELLER');

    const after = await listOpsOrders({ chain: CHAIN, q: orderId });
    expect(after.ok && after.data.rows[0]?.status).toBe('COMPLETED');
    expect(after.ok && after.data.rows[0]?.canExecute).toBe(false);
    expect(after.ok && after.data.supply?.undistributed).toBe('998');
    expect(after.ok && after.data.supply?.circulating).toBe('2');
  });

  it('Kiểm soát viên chỉ xem: không dòng nào có quyền khớp', async () => {
    await createOrder(ALICE, { status: 'PLACED' });
    await createOrder(BOB, { status: 'CHECKING' });
    actAs('CONTROLLER');

    const result = await (await ops()).listOpsOrders({ chain: CHAIN });
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.mayExecute).toBe(false);
    expect(result.data.rows.every((row) => row.canExecute === false)).toBe(true);
  });

  it.each(['INVESTOR', 'SELLER'])('%s bị chặn ở cả danh sách và chi tiết', async (role) => {
    const order = await createOrder(ALICE);
    actAs(role);
    const { getOpsOrderDetail, listOpsOrders } = await ops();

    await expect(listOpsOrders({ chain: CHAIN })).resolves.toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
    await expect(getOpsOrderDetail({ chain: CHAIN, orderId: order.id })).resolves.toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });
});
