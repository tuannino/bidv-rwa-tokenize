import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ILedgerPort, TxResult } from '@/lib/ledger/ledger.port';
import { WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { getStore, getTokenRequestStore, resetMemoryStore, resetStoreCache } from '@/lib/store';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';

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

/**
 * HF-05: vỏ bọc `@/lib/ledger` mặc định chuyển tiếp nguyên vẹn sang adapter thật. Bật `chainFault`
 * thì biên nhận trả PENDING / FAILED / ném lỗi, hoặc đọc tổng cung ném lỗi: các tình huống mà
 * chuỗi `mock` (luôn CONFIRMED ngay) không tự dựng được. Đếm số lần gửi Mint/Burn để chốt "đối
 * soát không bao giờ gửi giao dịch mới".
 */
const chainFault = vi.hoisted(() => ({
  receipt: null as null | 'PENDING' | 'FAILED' | 'throw',
  tokenInfoThrows: false,
  sends: 0,
}));

vi.mock('@/lib/ledger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ledger')>();
  return {
    ...actual,
    getLedger: (...args: Parameters<typeof actual.getLedger>): ILedgerPort => {
      const real = actual.getLedger(...args);
      return {
        ...real,
        async mint(to: string, amount: bigint) {
          chainFault.sends += 1;
          return real.mint(to, amount);
        },
        async mintInitialSupply(to: string, amount: bigint) {
          chainFault.sends += 1;
          return real.mintInitialSupply(to, amount);
        },
        async burn(from: string, amount: bigint) {
          chainFault.sends += 1;
          return real.burn(from, amount);
        },
        async tokenInfo() {
          if (chainFault.tokenInfoThrows) throw new Error('RPC đọc tổng cung tạm lỗi.');
          return real.tokenInfo();
        },
        async waitReceipt(txHash: string, timeoutMs?: number): Promise<TxResult> {
          if (chainFault.receipt === 'PENDING') return { txHash, status: 'PENDING' };
          if (chainFault.receipt === 'FAILED') {
            return { txHash, status: 'FAILED', reason: 'Giao dịch bị revert on-chain.' };
          }
          if (chainFault.receipt === 'throw') throw new Error('Mất kết nối RPC khi đọc biên nhận.');
          return real.waitReceipt(txHash, timeoutMs);
        },
      };
    },
  };
});

const CHAIN = 'mock';
/** BE-13 QĐ-G: Mint đầu trên mock phải vào vault logic, không còn vào ví `NB001`. */
const SPV = MOCK_VAULT_ADDRESS;
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

/**
 * Phát hành thẳng một phần trần bằng Giao dịch viên — dựng nền "đã có ví SPV trên chuỗi".
 *
 * FE-22: đây là đường DỮ LIỆU THỬ, nên bật cờ `ENABLE_DEMO_TOKEN_MINT` đúng trong lúc dựng nền rồi
 * tắt — các ca bên dưới chạy như môi trường thật, nơi cờ tắt.
 */
async function issueDirect(amount: bigint) {
  const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
  const previous = { role: process.env.DEMO_ROLE, actor: process.env.DEMO_ACTOR };
  process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
  teller();
  const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV, amount: String(amount) });
  delete process.env.ENABLE_DEMO_TOKEN_MINT;
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
  chainFault.receipt = null;
  chainFault.tokenInfoThrows = false;
  chainFault.sends = 0;
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
    const result = await approveTokenRequest({ chain: CHAIN, requestId: id });

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
    const result = await approveTokenRequest({ chain: CHAIN, requestId: id });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect(await supply()).toBe(700n);
    expect((await (await ledger()).spvWallet())?.toLowerCase()).toBe(SPV.toLowerCase());
  });

  it('duyệt Burn: tổng cung giảm đúng tại ví SPV', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(burnInput(300n, 'UNDISTRIBUTED'));

    controller();
    const result = await approveTokenRequest({ chain: CHAIN, requestId: id });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect(await supply()).toBe(700n);
    expect(await (await ledger()).balanceOf(SPV)).toBe(700n);
  });

  it('Giao dịch viên không duyệt được — thiếu quyền, tổng cung giữ nguyên', async () => {
    const { approveTokenRequest } = await service();
    await issueDirect(1000n);
    const id = await draft(mintInput(500n));

    actAs('TELLER', 'GDV002');
    const result = await approveTokenRequest({ chain: CHAIN, requestId: id });

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
      const result = await rejectTokenRequest({ chain: CHAIN, requestId: id, reason });
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
    const rejected = await rejectTokenRequest({ chain: CHAIN, requestId: id, reason: 'Thiếu chứng từ gốc' });

    expect(rejected.ok, rejected.ok ? '' : rejected.error).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.status).toBe('REJECTED');
    expect(rejected.data.rejectReason).toBe('Thiếu chứng từ gốc');
    expect(rejected.data.txHash).toBeNull();
    expect(await supply()).toBe(1000n);

    const late = await approveTokenRequest({ chain: CHAIN, requestId: id });
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
    const approved = await approveTokenRequest({ chain: CHAIN, requestId: id });
    const rejected = await rejectTokenRequest({ chain: CHAIN, requestId: id, reason: 'tự huỷ' });

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
      approveTokenRequest({ chain: CHAIN, requestId: id }),
      approveTokenRequest({ chain: CHAIN, requestId: id }),
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
    const result = await approveTokenRequest({ chain: CHAIN, requestId: id });

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
    await rejectTokenRequest({ chain: CHAIN, requestId: other.data.request.id, reason: 'trùng' });
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

// ===========================================================================
//  HF-05: chưa có biên nhận thì chưa có kết cục; đối soát chốt theo biên nhận
// ===========================================================================

const audits = async () => getStore().listAudit({ limit: 500 });
const successOf = async (action: string) =>
  (await audits()).filter((entry) => entry.action === action && entry.outcome === 'SUCCESS');
/** Dòng `order:approve` SUCCESS do lượt CHỐT ghi: không tính dòng "đã gửi, chưa có biên nhận". */
const finalizeApprovals = async (requestId: string) =>
  (await successOf('order:approve')).filter(
    (entry) => entry.target === requestId && !entry.detail?.includes('chưa có biên nhận'),
  );
const txnsOf = async (txHash: string) =>
  (await getStore().listTxns({ chain: CHAIN, limit: 500 })).filter((t) => t.txHash === txHash);
const project = async () => {
  const { getProjectStore } = await import('@/lib/store');
  const { WPT_TOKEN_SYMBOL } = await import('@/lib/config/issue-terms');
  return getProjectStore().findProject({ tokenSymbol: WPT_TOKEN_SYMBOL, chain: CHAIN });
};

/** Duyệt khi biên nhận còn PENDING: trả yêu cầu EXECUTING có mã giao dịch. */
async function approvePending(id: string) {
  const { approveTokenRequest } = await service();
  controller();
  chainFault.receipt = 'PENDING';
  const result = await approveTokenRequest({ chain: CHAIN, requestId: id });
  chainFault.receipt = null;
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw new Error(result.error);
  expect(result.data.status).toBe('EXECUTING');
  expect(result.data.txHash).toMatch(/^0x/);
  return result.data.txHash!;
}

async function reconcile(id: string, chain: string = CHAIN) {
  const { reconcileTokenRequest } = await service();
  return reconcileTokenRequest({ chain, requestId: id });
}

describe('HF-05: duyệt khi biên nhận còn PENDING', () => {
  it('ca 1: Mint lần đầu PENDING: EXECUTING có mã, mốc phát hành vẫn rỗng, không có token:mint SUCCESS', async () => {
    const id = await draft(mintInput(700n));
    expect((await project())?.issuedAt).toBeNull();

    const txHash = await approvePending(id);

    const stored = await getTokenRequestStore().findRequest(id);
    expect(stored?.status).toBe('EXECUTING');
    expect(stored?.txHash).toBe(txHash);
    expect(stored?.completedAt).toBeNull();
    expect((await project())?.issuedAt).toBeNull();
    expect(await successOf('token:mint')).toHaveLength(0);
    const approval = (await successOf('order:approve')).find((entry) => entry.target === id);
    expect(approval?.detail).toContain('đã gửi, chưa có biên nhận, cần đối soát');
    expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['PENDING']);
  });

  it('ca 2: Burn PENDING: EXECUTING, không có token:burn SUCCESS', async () => {
    await issueDirect(1000n);
    const id = await draft(burnInput(300n, 'UNDISTRIBUTED'));

    await approvePending(id);

    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('EXECUTING');
    expect(await successOf('token:burn')).toHaveLength(0);
  });
});

describe('HF-05: đối soát yêu cầu đang thực hiện', () => {
  it('ca 3: đối soát Mint ca 1 khi CONFIRMED: COMPLETED, có mốc, đúng một token:mint, Txn CONFIRMED; lần hai bị chặn', async () => {
    const id = await draft(mintInput(700n));
    const txHash = await approvePending(id);
    const sendsAfterApprove = chainFault.sends;

    const result = await reconcile(id);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.completedAt).not.toBeNull();
    expect((await project())?.issuedAt).not.toBeNull();
    const mints = await successOf('token:mint');
    expect(mints).toHaveLength(1);
    expect(mints[0].detail).toContain(`tx ${txHash}`);
    expect(await finalizeApprovals(id)).toHaveLength(1);
    expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['CONFIRMED']);

    const again = await reconcile(id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe('REQUEST_STATE');
    expect(await successOf('token:mint')).toHaveLength(1);
    expect(await finalizeApprovals(id)).toHaveLength(1);
    expect(await txnsOf(txHash)).toHaveLength(1);
    expect(chainFault.sends, 'đối soát không gửi giao dịch mới').toBe(sendsAfterApprove);
  });

  it('ca 3b: Burn PENDING rồi đối soát CONFIRMED: COMPLETED, đúng một token:burn, Txn CONFIRMED', async () => {
    await issueDirect(1000n);
    const id = await draft(burnInput(300n, 'UNDISTRIBUTED'));
    const txHash = await approvePending(id);

    const result = await reconcile(id);

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('COMPLETED');
    expect(await successOf('token:burn')).toHaveLength(1);
    expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['CONFIRMED']);
  });

  it('ca 4: còn PENDING (gọi nhiều lần, kể cả đọc biên nhận lỗi) giữ EXECUTING; biên nhận FAILED thì FAILED', async () => {
    const id = await draft(mintInput(700n));
    const txHash = await approvePending(id);

    for (const receipt of ['PENDING', 'PENDING', 'throw'] as const) {
      chainFault.receipt = receipt;
      const result = await reconcile(id);
      expect(result.ok, result.ok ? '' : result.error).toBe(true);
      if (result.ok) expect(result.data.status).toBe('EXECUTING');
      expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['PENDING']);
    }
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('EXECUTING');

    chainFault.receipt = 'FAILED';
    const failed = await reconcile(id);

    expect(failed.ok, failed.ok ? '' : failed.error).toBe(true);
    if (!failed.ok) return;
    expect(failed.data.status).toBe('FAILED');
    expect(failed.data.failureReason).toMatch(/revert/);
    expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['FAILED']);
    expect((await project())?.issuedAt).toBeNull();
    expect(await successOf('token:mint')).toHaveLength(0);
    const failure = (await audits()).find(
      (entry) => entry.target === id && entry.action === 'order:approve' && entry.outcome === 'FAILURE',
    );
    expect(failure?.detail).toContain('biên nhận FAILED');
  });

  it('ca 4b: dòng Txn bị mất thì đối soát tạo đúng một dòng, không tạo trùng', async () => {
    const id = await draft(mintInput(700n));
    const txHash = await approvePending(id);
    // Chỉ xoá sổ giao dịch, giữ yêu cầu: như tiến trình cũ chết trước khi ghi dòng `Txn`.
    const { memoryState } = await import('@/lib/store/memory.state');
    memoryState('txn', () => ({ txns: [] as unknown[], audit: [] as unknown[] })).txns.length = 0;
    expect(await txnsOf(txHash)).toHaveLength(0);

    chainFault.receipt = 'PENDING';
    await reconcile(id);
    await reconcile(id);
    expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['PENDING']);
    chainFault.receipt = null;
    await reconcile(id);
    expect((await txnsOf(txHash)).map((t) => t.status)).toEqual(['CONFIRMED']);
  });

  it('ca 5: bị chặn khi không có mã giao dịch, vai không có quyền duyệt, hoặc sai chain đang chọn', async () => {
    const withoutTx = await draft(mintInput(700n));
    await getTokenRequestStore().transitionRequest({ id: withoutTx, from: ['PENDING'], to: 'EXECUTING' });
    controller();
    const noTx = await reconcile(withoutTx);
    expect(noTx.ok).toBe(false);
    if (!noTx.ok) {
      expect(noTx.code).toBe('REQUEST_STATE');
      expect(noTx.error).toMatch(/chưa có mã giao dịch/);
    }

    resetMemoryStore();
    resetStoreCache();
    const id = await draft(mintInput(700n));
    await approvePending(id);

    actAs('TELLER', 'GDV002');
    const denied = await reconcile(id);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN');

    controller();
    const wrongChain = await reconcile(id, 'hardhat-local');
    expect(wrongChain.ok).toBe(false);
    if (!wrongChain.ok) expect(wrongChain.code).toBe('REQUEST_CHECK');

    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('EXECUTING');
    expect(await successOf('token:mint')).toHaveLength(0);
  });

  it.each(['MINT', 'BURN'] as const)(
    'ca 5b (%s): hai lượt đối soát song song: một lượt hoàn tất, đúng một dòng sổ token và một order:approve, không gửi gì',
    async (type) => {
      if (type === 'BURN') await issueDirect(1000n);
      const id = await draft(type === 'MINT' ? mintInput(700n) : burnInput(300n, 'UNDISTRIBUTED'));
      await approvePending(id);
      chainFault.sends = 0;

      controller();
      const results = await Promise.all([reconcile(id), reconcile(id)]);

      const done = results.filter((r) => r.ok && r.data.status === 'COMPLETED');
      expect(done).toHaveLength(1);
      const loser = results.find((r) => !r.ok);
      expect(loser && !loser.ok ? loser.error : '').toMatch(/đã được chốt ở lượt khác|không còn chờ đối soát/);
      expect(await successOf(type === 'MINT' ? 'token:mint' : 'token:burn')).toHaveLength(1);
      expect(await finalizeApprovals(id)).toHaveLength(1);
      expect(chainFault.sends, 'đối soát không gọi ledger.mint / ledger.burn').toBe(0);
    },
  );

  it('ca 5c: CONFIRMED mà đọc tổng cung lỗi: giữ EXECUTING, không ghi SUCCESS, không FAILED; gỡ lỗi rồi đối soát lại thì COMPLETED', async () => {
    const id = await draft(mintInput(700n));
    await approvePending(id);

    chainFault.tokenInfoThrows = true;
    const blocked = await reconcile(id);
    chainFault.tokenInfoThrows = false;

    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/đã xác nhận trên chuỗi, chưa chốt được.*bấm Đối soát lại/);
    expect((await getTokenRequestStore().findRequest(id))?.status).toBe('EXECUTING');
    expect((await project())?.issuedAt).toBeNull();
    expect(await successOf('token:mint')).toHaveLength(0);

    const retried = await reconcile(id);
    expect(retried.ok && retried.data.status).toBe('COMPLETED');
    expect(await successOf('token:mint')).toHaveLength(1);
  });

  it('ca 5c: CONFIRMED mà thao tác chốt ném lỗi: giữ EXECUTING, không ghi gì; đối soát lại thì COMPLETED', async () => {
    const id = await draft(mintInput(700n));
    await approvePending(id);
    const store = getTokenRequestStore();
    const spy = vi
      .spyOn(store, 'finalizeTokenRequest')
      .mockRejectedValueOnce(new Error('mất kết nối cơ sở dữ liệu'));

    const blocked = await reconcile(id);

    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/chưa chốt được \(mất kết nối cơ sở dữ liệu\)/);
    expect((await store.findRequest(id))?.status).toBe('EXECUTING');
    expect(await successOf('token:mint')).toHaveLength(0);

    spy.mockRestore();
    const retried = await reconcile(id);
    expect(retried.ok && retried.data.status).toBe('COMPLETED');
    expect(await successOf('token:mint')).toHaveLength(1);
  });
});
