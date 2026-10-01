import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { getStore, getTokenRequestStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * BE-12 — LẬP–DUYỆT YÊU CẦU MINT / BURN.
 *
 * Mọi ca dùng chuỗi `mock` và bộ lưu trữ trong bộ nhớ, cùng lý do với `issuance-service.test.ts`.
 * Trần đọc từ dòng dự án khởi tạo (`WPT_TOTAL_SUPPLY`), không gõ lại số.
 *
 * Người thực hiện giả lập bằng hai biến: `DEMO_ROLE` (vai) và `DEMO_ACTOR` (mã tài khoản). Tách
 * hai biến là thứ cho ca 5 dựng được "cùng một người, đủ quyền duyệt" — điều bảng quyền một mình
 * không bao giờ cho phép.
 */

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const CAP = BigInt(WPT_TOTAL_SUPPLY);

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}

const teller = () => actAs('TELLER', 'GDV001');
const controller = (actor = 'KSV001') => actAs('CONTROLLER', actor);

async function service() {
  return import('@/lib/bank/token-request.service');
}

async function ledger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

const supply = async () => (await (await ledger()).tokenInfo()).totalSupply;

/** Phát hành thẳng một phần trần bằng Giao dịch viên — dựng nền "đã có ví SPV trên chuỗi". */
async function issueDirect(amount: bigint) {
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  const previous = { role: process.env.DEMO_ROLE, actor: process.env.DEMO_ACTOR };
  teller();
  const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV, amount: String(amount) });
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  actAs(previous.role ?? 'TELLER', previous.actor);
}

const mintInput = (amount: bigint | string, extra: Record<string, unknown> = {}) => ({
  type: 'MINT',
  chain: CHAIN,
  amount: String(amount),
  wallet: SPV,
  reason: 'phát hành đợt tiếp theo',
  documentRef: 'QD-2026-001',
  effectiveDate: '2026-10-01',
  ...extra,
});

const burnInput = (amount: bigint | string, burnSource: string) => ({
  type: 'BURN',
  chain: CHAIN,
  amount: String(amount),
  burnSource,
  reason: 'thu hồi phần chưa bán',
});

/** Lập một yêu cầu bằng Giao dịch viên, trả mã yêu cầu. */
async function draft(input: Record<string, unknown>): Promise<string> {
  const { createTokenRequest } = await service();
  teller();
  const result = await createTokenRequest(input);
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.data.request.id;
}

beforeEach(async () => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  teller();
  await (await ledger()).whitelist(SPV);
});

afterEach(() => {
  delete process.env.DEMO_ROLE;
  delete process.env.DEMO_ACTOR;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

// ===========================================================================
//  Lập
// ===========================================================================

describe('ca 1 — lập yêu cầu vượt trần còn lại bị chặn, nêu đúng điều kiện trượt', () => {
  it('vượt trần: REQUEST_CHECK, fieldErrors chỉ có "cap", không ghi yêu cầu nào', async () => {
    const { createTokenRequest } = await service();
    await issueDirect(CAP - 100n);

    const result = await createTokenRequest(mintInput(101n));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('REQUEST_CHECK');
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(['cap']);
    expect(result.error).toMatch(/trần còn lại 100/);
    expect(await getTokenRequestStore().listRequests()).toHaveLength(0);
  });

  it('khối kiểm tra trước trả từng điều kiện kèm trạng thái, kể cả quyền lập', async () => {
    const { previewTokenRequest } = await service();
    await issueDirect(CAP - 100n);

    const result = await previewTokenRequest(mintInput(101n));

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.allPassed).toBe(false);
    const status = Object.fromEntries(result.data.checks.map((c) => [c.key, c.passed]));
    expect(status).toEqual({
      permission: true,
      project: true,
      cap: false,
      wallet: true,
      noPending: true,
    });
  });

  it('ví đích khác ví SPV đã đăng ký và yêu cầu Mint đang chờ cùng token đều bị chặn', async () => {
    const { createTokenRequest } = await service();
    await issueDirect(10n);
    await (await ledger()).whitelist(INVESTOR);
    await draft(mintInput(5n));

    const result = await createTokenRequest(mintInput(5n, { wallet: INVESTOR }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(['noPending', 'wallet']);
  });

  it('vai không có quyền lập bị chặn và lần bị chặn vào sổ kiểm toán', async () => {
    const { createTokenRequest } = await service();
    controller();

    const result = await createTokenRequest(mintInput(1n));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
    const audit = await getStore().listAudit({ limit: 10 });
    expect(audit.some((a) => a.action === 'order:draft' && a.outcome === 'DENIED')).toBe(true);
  });

  it('lần lập bị chặn vì điều kiện cũng vào sổ kiểm toán', async () => {
    const { createTokenRequest } = await service();
    await createTokenRequest(mintInput(CAP + 1n));

    const audit = await getStore().listAudit({ limit: 10 });
    const blocked = audit.find((a) => a.action === 'order:draft' && a.outcome === 'FAILURE');
    expect(blocked?.detail).toMatch(/trần còn lại/);
  });
});

describe('ca 2 — yêu cầu đang chờ KHÔNG làm đổi tổng cung', () => {
  it('lập Mint xong: PENDING, tổng cung và sổ giao dịch giữ nguyên', async () => {
    await issueDirect(1000n);
    const txnsBefore = (await getStore().listTxns({ chain: CHAIN })).length;

    const id = await draft(mintInput(500n));

    const request = await getTokenRequestStore().findRequest(id);
    expect(request?.status).toBe('PENDING');
    expect(request?.makerId).toBe('GDV001');
    expect(request?.txHash).toBeNull();
    expect(request?.effectiveDate).toBe('2026-10-01T00:00:00.000Z');
    expect(await supply()).toBe(1000n);
    expect((await getStore().listTxns({ chain: CHAIN })).length).toBe(txnsBefore);
  });

  it('lập Burn xong: số dư ví SPV giữ nguyên', async () => {
    await issueDirect(1000n);
    await draft(burnInput(300n, 'UNDISTRIBUTED'));

    expect(await (await ledger()).balanceOf(SPV)).toBe(1000n);
    expect(await supply()).toBe(1000n);
  });
});

describe('ca 6 — Burn theo toàn bộ nguồn cung bị chặn khi còn token lưu hành', () => {
  /** Đưa token ra lưu hành bằng một lần chuyển thẳng qua ledger. */
  async function circulate(amount: bigint) {
    const l = await ledger();
    await l.whitelist(INVESTOR);
    await l.transfer(SPV, INVESTOR, amount);
  }

  it('còn token ngoài ví SPV: TOTAL_SUPPLY bị chặn với điều kiện "circulation"', async () => {
    const { createTokenRequest } = await service();
    await issueDirect(1000n);
    await circulate(1n);

    const result = await createTokenRequest(burnInput(10n, 'TOTAL_SUPPLY'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(['circulation']);
  });

  it('cùng tình huống, nguồn UNDISTRIBUTED vẫn lập được', async () => {
    await issueDirect(1000n);
    await circulate(1n);
    await draft(burnInput(10n, 'UNDISTRIBUTED'));
  });

  it('không còn token lưu hành thì TOTAL_SUPPLY lập được', async () => {
    await issueDirect(1000n);
    await draft(burnInput(1000n, 'TOTAL_SUPPLY'));
  });

  it('vượt phần chưa phân phối bị chặn', async () => {
    const { createTokenRequest } = await service();
    await issueDirect(1000n);
    await circulate(400n);

    const result = await createTokenRequest(burnInput(601n, 'UNDISTRIBUTED'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(['undistributed']);
  });
});

// ===========================================================================
//  Duyệt
// ===========================================================================

describe('ca 3 — duyệt thì tổng cung tăng đúng, mã giao dịch được ghi', () => {
  it('duyệt Mint: COMPLETED, người duyệt + mốc + mã giao dịch có mặt, tổng cung tăng đúng', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    controller();
    const result = await approveTokenRequest({ requestId: id });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.checkerId).toBe('KSV001');
    expect(result.data.decidedAt).not.toBeNull();
    expect(result.data.completedAt).not.toBeNull();
    expect(result.data.txHash).toMatch(/^0x/);
    expect(await supply()).toBe(1500n);

    const txn = (await getStore().listTxns({ chain: CHAIN })).find(
      (t) => t.txHash === result.data.txHash,
    );
    expect(txn?.amount).toBe('500');
    expect(txn?.actorRole).toBe('CONTROLLER');
  });

  it('yêu cầu Mint đầu tiên của dự án đi qua phát hành lần đầu và tạo ví SPV trên chuỗi', async () => {
    const { approveTokenRequest } = await service();
    const id = await draft(mintInput(700n));

    controller();
    const result = await approveTokenRequest({ requestId: id });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect(await supply()).toBe(700n);
    expect((await (await ledger()).spvWallet())?.toLowerCase()).toBe(SPV.toLowerCase());
  });

  it('duyệt Burn: tổng cung giảm đúng tại ví SPV', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(burnInput(300n, 'UNDISTRIBUTED'));

    controller();
    const result = await approveTokenRequest({ requestId: id });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect(await supply()).toBe(700n);
    expect(await (await ledger()).balanceOf(SPV)).toBe(700n);
  });

  it('Giao dịch viên không duyệt được — thiếu quyền, tổng cung giữ nguyên', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    actAs('TELLER', 'GDV002');
    const result = await approveTokenRequest({ requestId: id });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
    expect(await supply()).toBe(1000n);
  });
});

describe('ca 4 — từ chối', () => {
  it('không có lý do thì bị chặn, yêu cầu vẫn chờ, lần bị chặn vào sổ', async () => {
    const { rejectTokenRequest } = await service();
    const id = await draft(mintInput(500n));

    controller();
    for (const reason of [undefined, '', '   ']) {
      const result = await rejectTokenRequest({ requestId: id, reason });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('VALIDATION');
    }
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('PENDING');
    const audit = await getStore().listAudit({ limit: 20 });
    expect(
      audit.filter((a) => a.action === 'order:approve' && a.outcome === 'FAILURE'),
    ).toHaveLength(3);
  });

  it('từ chối hợp lệ: REJECTED kèm lý do, tổng cung không đổi, duyệt sau đó bị chặn', async () => {
    const { approveTokenRequest, rejectTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    controller();
    const rejected = await rejectTokenRequest({ requestId: id, reason: 'Thiếu chứng từ gốc' });

    expect(rejected.ok, rejected.ok ? '' : rejected.error).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.status).toBe('REJECTED');
    expect(rejected.data.rejectReason).toBe('Thiếu chứng từ gốc');
    expect(rejected.data.txHash).toBeNull();
    expect(await supply()).toBe(1000n);

    const late = await approveTokenRequest({ requestId: id });
    expect(late.ok).toBe(false);
    if (late.ok) return;
    expect(late.code).toBe('REQUEST_STATE');
    expect(await supply()).toBe(1000n);
  });
});

describe('ca 5 — người lập không duyệt được yêu cầu của chính mình, kể cả khi đủ quyền', () => {
  it('cùng mã tài khoản, đang mang vai có quyền duyệt: SELF_APPROVAL, token không đổi', async () => {
    const { approveTokenRequest, rejectTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    // Cùng người GDV001, nay mang vai Kiểm soát viên — đủ quyền `order:approve`.
    controller('GDV001');
    const approved = await approveTokenRequest({ requestId: id });
    const rejected = await rejectTokenRequest({ requestId: id, reason: 'tự huỷ' });

    for (const result of [approved, rejected]) {
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('SELF_APPROVAL');
    }
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('PENDING');
    expect(await supply()).toBe(1000n);

    const audit = await getStore().listAudit({ limit: 20 });
    expect(
      audit.filter((a) => a.action === 'order:approve' && a.outcome === 'DENIED'),
    ).toHaveLength(2);
  });
});

// ===========================================================================
//  Hai đột biến của spec
// ===========================================================================

describe('đột biến 1 — hai lần duyệt đồng thời cùng một yêu cầu', () => {
  it('chỉ một lần tác động token: tổng cung tăng đúng một lần, một lần duyệt nhận REQUEST_STATE', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    controller();
    const results = await Promise.all([
      approveTokenRequest({ requestId: id }),
      approveTokenRequest({ requestId: id }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.find((r) => !r.ok);
    expect(loser && !loser.ok ? loser.code : null).toBe('REQUEST_STATE');
    expect(await supply()).toBe(1500n);
    const mints = (await getStore().listTxns({ chain: CHAIN })).filter((t) => t.operation === 'mint');
    expect(mints).toHaveLength(1);
  });
});

describe('đột biến 2 — điều kiện đổi giữa lúc lập và lúc duyệt', () => {
  it('lần phát hành khác chạm trần sau khi lập: duyệt bị chặn, nêu "cap", yêu cầu vẫn chờ', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    // Giữa lúc lập và lúc duyệt, một lần phát hành khác ăn hết trần.
    await issueDirect(CAP - 1000n);

    controller();
    const result = await approveTokenRequest({ requestId: id });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('REQUEST_CHECK');
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(['cap']);
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('PENDING');
    expect(await supply()).toBe(CAP);

    const audit = await getStore().listAudit({ limit: 20 });
    expect(
      audit.some((a) => a.action === 'order:approve' && a.outcome === 'FAILURE' && /cap|trần/.test(a.detail ?? '')),
    ).toBe(true);
  });
});

// ===========================================================================
//  Số việc đang chờ
// ===========================================================================

describe('ca 8 — số việc đang chờ đếm đúng theo vai', () => {
  it('Giao dịch viên đếm yêu cầu mình lập; Kiểm soát viên đếm yêu cầu người khác lập', async () => {
    const { countPendingWork, rejectTokenRequest } = await service();
    await issueDirect(1000n);

    await draft(burnInput(10n, 'UNDISTRIBUTED')); // GDV001
    await draft(mintInput(10n)); // GDV001
    actAs('TELLER', 'GDV002');
    const { createTokenRequest } = await service();
    const other = await createTokenRequest(burnInput(20n, 'UNDISTRIBUTED'));
    expect(other.ok).toBe(true);
    if (!other.ok) return;

    expect(await countPendingWork('TELLER', 'GDV001')).toEqual({ draft: 2, approval: 0 });
    expect(await countPendingWork('TELLER', 'GDV002')).toEqual({ draft: 1, approval: 0 });
    expect(await countPendingWork('CONTROLLER', 'KSV001')).toEqual({ draft: 0, approval: 3 });
    // Người lập mang vai duyệt: yêu cầu của chính mình không phải việc chờ mình duyệt.
    expect(await countPendingWork('CONTROLLER', 'GDV001')).toEqual({ draft: 0, approval: 1 });
    for (const role of ['INVESTOR', 'SELLER'] as const) {
      expect(await countPendingWork(role, 'X')).toEqual({ draft: 0, approval: 0 });
    }

    // Đã xử lý thì không còn là việc chờ.
    controller();
    await rejectTokenRequest({ requestId: other.data.request.id, reason: 'trùng' });
    expect(await countPendingWork('CONTROLLER', 'KSV001')).toEqual({ draft: 0, approval: 2 });
  });

  it('nguồn số cạnh menu đọc đúng phiên hiện tại', async () => {
    const { pendingWorkCounts } = await import('@/lib/nav/pending-work');
    await draft(mintInput(10n));

    teller();
    expect(await pendingWorkCounts()).toEqual({ draft: 1, approval: 0 });
    controller();
    expect(await pendingWorkCounts()).toEqual({ draft: 0, approval: 1 });
  });
});
