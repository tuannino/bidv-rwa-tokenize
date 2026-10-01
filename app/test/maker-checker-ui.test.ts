import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WPT_TOKEN_SYMBOL, WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { formatAmount, formatDateTime } from '@/lib/format';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { resetMemoryStore, resetStoreCache } from '@/lib/store';
import { TOKEN_REQUEST_STATUSES } from '@/lib/store/token-request.store.port';
import { SAMPLE_ACCOUNTS } from '@/lib/session/channel';
import {
  STATUS_LABELS,
  burnSourceEffect,
  submitBlockReason,
  type PreviewState,
} from '@/components/maker-checker/gates';

/**
 * FE-22 — màn Lập lệnh và Phê duyệt lệnh.
 *
 * Vitest chạy môi trường `node`, không dựng DOM. Nên mỗi ca kiểm ở hai tầng mà màn hình đứng lên:
 * (1) phép đọc / ghi của máy chủ mà màn hình gọi, (2) hàm thuần trong `components/maker-checker/
 * gates.ts` quyết định nút nào bị khoá và vì sao. Màn hình thật kiểm ở `e2e/maker-checker.spec.ts`.
 *
 * Mọi ca chạy chuỗi `mock` + bộ lưu trữ trong bộ nhớ. Trần đọc từ `WPT_TOTAL_SUPPLY`, không gõ số.
 * Dựng nền "đã có token" bằng CHÍNH quy trình lập–duyệt, không bằng đường phát hành trực tiếp: sau
 * FE-22 đường trực tiếp chỉ còn cho dữ liệu thử sau hai lớp chặn.
 */

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const CAP = BigInt(WPT_TOTAL_SUPPLY);

function actAs(role: string, actor?: string) {
  process.env.DEMO_ROLE = role;
  if (actor === undefined) delete process.env.DEMO_ACTOR;
  else process.env.DEMO_ACTOR = actor;
  resetServerEnvCache();
}
const teller = () => actAs('TELLER', SAMPLE_ACCOUNTS.teller);
const controller = (actor: string = SAMPLE_ACCOUNTS.controller) => actAs('CONTROLLER', actor);

const service = () => import('@/lib/bank/token-request.service');

async function ledger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

const mintInput = (amount: bigint | string) => ({
  type: 'MINT',
  chain: CHAIN,
  tokenSymbol: WPT_TOKEN_SYMBOL,
  amount: String(amount),
  wallet: SPV,
  reason: 'phát hành đợt tiếp theo',
});

const burnInput = (amount: bigint | string, burnSource: 'UNDISTRIBUTED' | 'TOTAL_SUPPLY') => ({
  type: 'BURN',
  chain: CHAIN,
  tokenSymbol: WPT_TOKEN_SYMBOL,
  amount: String(amount),
  burnSource,
  reason: 'thu hồi phần chưa bán',
});

/** Giao dịch viên lập, trả mã yêu cầu. */
async function draft(input: Record<string, unknown>): Promise<string> {
  const { createTokenRequest } = await service();
  teller();
  const result = await createTokenRequest(input);
  if (!result.ok) throw new Error(result.error);
  return result.data.request.id;
}

/** Lập rồi duyệt một yêu cầu Mint — dựng nền "đã phát hành" bằng chính quy trình lập–duyệt. */
async function issueViaApproval(amount: bigint) {
  const { approveTokenRequest } = await service();
  const id = await draft(mintInput(amount));
  controller();
  const approved = await approveTokenRequest({ requestId: id });
  if (!approved.ok) throw new Error(approved.error);
  teller();
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
//  Bước 1 — thành phần dùng chung
// ===========================================================================

describe('việc 19 — số có phân cách hàng nghìn, mốc thời gian đủ ngày và giờ', () => {
  it('số lượng dạng chuỗi giữ chính xác vượt 2^53 và có dấu chấm hàng nghìn', () => {
    expect(formatAmount('1000000')).toBe('1.000.000');
    expect(formatAmount('9007199254740993')).toBe('9.007.199.254.740.993');
    expect(formatAmount(1234)).toBe('1.234');
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount('khong-phai-so')).toBe('khong-phai-so');
  });

  it('mốc thời gian hiện dd/mm/yyyy hh:mm:ss theo giờ Việt Nam, không phụ thuộc máy chủ', () => {
    // 17:05:09 UTC là 00:05:09 ngày hôm sau ở Hà Nội — đúng chỗ dễ sai ngày nhất.
    expect(formatDateTime('2026-10-01T17:05:09.000Z')).toBe('02/10/2026 00:05:09');
    expect(formatDateTime(null)).toBe('—');
  });
});

describe('việc 13 — đủ năm trạng thái của BE-12 đều có nhãn', () => {
  it('nhãn cho mọi trạng thái, hai trạng thái trung gian hiện là đang xử lý và thất bại', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...TOKEN_REQUEST_STATUSES].sort());
    expect(STATUS_LABELS.EXECUTING).toBe('Đang xử lý');
    expect(STATUS_LABELS.FAILED).toBe('Thất bại');
  });
});

describe('ca 1 — nhập ký hiệu token thì khối thông tin token tự đổ đủ chỉ tiêu', () => {
  it('chưa phát hành: đủ chỉ tiêu, còn được phát hành bằng trần, chưa có ví thanh toán', async () => {
    const { getTokenInfo } = await service();

    const result = await getTokenInfo({ chain: CHAIN, tokenSymbol: 'wpt' });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      tokenSymbol: WPT_TOKEN_SYMBOL,
      cap: CAP.toString(),
      remaining: CAP.toString(),
      totalSupply: '0',
      undistributed: '0',
      circulating: '0',
      sellerCode: SAMPLE_ACCOUNTS.seller,
      spvWallet: null,
    });
    expect(result.data.projectName.length).toBeGreaterThan(0);
    expect('contractAddress' in result.data).toBe(true);
  });

  it('sau khi phát hành và có token lưu hành: số liệu đọc lại từ chuỗi', async () => {
    const { getTokenInfo } = await service();
    await issueViaApproval(1000n);
    const spv = (await (await ledger()).spvWallet())!;
    const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    await (await ledger()).whitelist(INVESTOR);
    await (await ledger()).transfer(spv, INVESTOR, 300n);

    const result = await getTokenInfo({ chain: CHAIN, tokenSymbol: WPT_TOKEN_SYMBOL });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      remaining: (CAP - 1000n).toString(),
      totalSupply: '1000',
      undistributed: '700',
      circulating: '300',
      spvWallet: SPV,
    });
  });

  it('ký hiệu không có dự án: VALIDATION nói rõ, không phải lỗi hệ thống', async () => {
    const { getTokenInfo } = await service();
    const result = await getTokenInfo({ chain: CHAIN, tokenSymbol: 'KHONGCO' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.error).toMatch(/Chưa có dự án "KHONGCO"/);
  });

  it('vai không có quyền vận hành bị chặn', async () => {
    const { getTokenInfo } = await service();
    actAs('INVESTOR');
    const result = await getTokenInfo({ chain: CHAIN, tokenSymbol: WPT_TOKEN_SYMBOL });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });
});

// ===========================================================================
//  Bước 2 — màn Lập lệnh
// ===========================================================================

/** Khối kiểm tra đúng như màn hình nhận: gọi đúng hàm xem trước mà server action bọc. */
async function previewState(input: Record<string, unknown>): Promise<PreviewState> {
  const { previewTokenRequest } = await service();
  const result = await previewTokenRequest(input);
  if (!result.ok) throw new Error(result.error);
  return { kind: 'checked', checks: result.data.checks, allPassed: result.data.allPassed };
}

describe('ca 2 — số lượng vượt trần còn lại thì nút gửi bị khoá, hiện đúng lý do', () => {
  it('khối kiểm tra máy chủ trả "cap" trượt; nút gửi khoá và lý do nêu đúng trần còn lại', async () => {
    await issueViaApproval(CAP - 100n);

    const preview = await previewState(mintInput(101n));
    const reason = submitBlockReason(preview);

    expect(reason).not.toBeNull();
    expect(reason).toMatch(/Không vượt trần còn lại/);
    expect(reason).toMatch(/trần còn lại 100/);
    // Chỉ điều kiện trần trượt — lý do không lẫn điều kiện đạt.
    expect(reason).not.toMatch(/Ví đích hợp lệ/);
  });

  it('đúng bằng trần còn lại thì mọi điều kiện đạt và nút gửi mở', async () => {
    await issueViaApproval(CAP - 100n);
    expect(submitBlockReason(await previewState(mintInput(100n)))).toBeNull();
  });

  it('chưa có kết quả kiểm tra thì nút gửi khoá — không mở trước khi máy chủ trả lời', () => {
    expect(submitBlockReason({ kind: 'idle' })).not.toBeNull();
    expect(submitBlockReason({ kind: 'loading' })).toMatch(/Đang kiểm tra/);
    expect(submitBlockReason({ kind: 'invalid', message: 'Lý do: Phải nêu lý do.' })).toMatch(/lý do/);
  });
});

describe('ca 3 — gửi xong thì yêu cầu chờ duyệt, số việc chờ của Kiểm soát viên tăng', () => {
  it('lập yêu cầu: trạng thái PENDING, số liệu cả hai màn và số cạnh menu đều tăng', async () => {
    const { countPendingWork, getApprovalStats, getDraftStats, listTokenRequests } = await service();
    await issueViaApproval(1000n);

    controller();
    const before = await getApprovalStats();
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const id = await draft(burnInput(10n, 'UNDISTRIBUTED'));

    const mine = await listTokenRequests({ mine: true, type: 'BURN' });
    expect(mine.ok && mine.data.map((r) => [r.id, r.status])).toEqual([[id, 'PENDING']]);
    const drafted = await getDraftStats();
    expect(drafted.ok && drafted.data).toEqual({ pendingMint: 0, pendingBurn: 1 });

    controller();
    const after = await getApprovalStats();
    expect(after.ok && after.data.pending).toBe(before.data.pending + 1);
    expect(await countPendingWork('CONTROLLER', SAMPLE_ACCOUNTS.controller)).toEqual({
      draft: 0,
      approval: before.data.pending + 1,
    });
  });

  it('bảng "yêu cầu đã lập" chỉ chứa yêu cầu của chính người lập', async () => {
    const { listTokenRequests } = await service();
    await issueViaApproval(1000n);
    const own = await draft(burnInput(10n, 'UNDISTRIBUTED'));
    actAs('TELLER', 'GDV002');
    const { createTokenRequest } = await service();
    const other = await createTokenRequest(burnInput(20n, 'UNDISTRIBUTED'));
    expect(other.ok).toBe(true);

    teller();
    const mine = await listTokenRequests({ mine: true });
    expect(mine.ok && mine.data.map((r) => r.id)).toEqual(
      expect.arrayContaining([own]),
    );
    expect(mine.ok && mine.data.every((r) => r.makerId === SAMPLE_ACCOUNTS.teller)).toBe(true);
    // Không có cờ thì vẫn thấy toàn bộ (hàng chờ của Kiểm soát viên dùng đường này).
    const all = await listTokenRequests({ type: 'BURN' });
    expect(all.ok && all.data).toHaveLength(2);
  });
});

describe('ca 4 — chọn nguồn toàn bộ nguồn cung thì có cảnh báo xác nhận lại', () => {
  it('tự điền số lượng bằng tổng cung máy chủ trả, kèm cảnh báo và đòi xác nhận', async () => {
    const { getTokenInfo } = await service();
    await issueViaApproval(1000n);
    const info = await getTokenInfo({ chain: CHAIN, tokenSymbol: WPT_TOKEN_SYMBOL });
    expect(info.ok).toBe(true);
    if (!info.ok) return;

    const effect = burnSourceEffect('TOTAL_SUPPLY', info.data.totalSupply);

    expect(effect.amount).toBe('1000');
    expect(effect.needsConfirmation).toBe(true);
    expect(effect.warning).toMatch(/TOÀN BỘ nguồn cung \(1\.000 token\)/);
    expect(burnSourceEffect('UNDISTRIBUTED', info.data.totalSupply)).toEqual({
      amount: null,
      needsConfirmation: false,
      warning: null,
    });
  });

  it('mọi điều kiện đạt nhưng chưa xác nhận lại thì nút gửi vẫn khoá', async () => {
    await issueViaApproval(1000n);
    const preview = await previewState(burnInput(1000n, 'TOTAL_SUPPLY'));
    expect(preview.kind === 'checked' && preview.allPassed).toBe(true);

    expect(submitBlockReason(preview, true)).toMatch(/xác nhận lại/);
    expect(submitBlockReason(preview, false)).toBeNull();
  });
});
