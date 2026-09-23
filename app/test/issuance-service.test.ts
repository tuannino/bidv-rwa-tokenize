import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WPT_TOKEN_SYMBOL, WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMockLedger } from '@/lib/ledger/mock.adapter';
import { SEED_PROJECT_CHAINS } from '@/lib/store/seed-data';
import { getProjectStore, getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * BE-04 CA 4 — PHÁT HÀNH ĐÚNG TỔNG CUNG TỪ BẢNG DỰ ÁN, LẦN HAI BỊ TỪ CHỐI.
 *
 * Hai phát biểu, và phát biểu thứ hai là thứ đắt nhất nếu sai: nguồn cung phình thêm sau khi đã
 * công bố là lỗi không sửa được — token đã ở trong ví người khác.
 *
 * Mọi ca dùng chuỗi `mock`: adapter mock mô phỏng đúng ràng buộc một lần của contract, và chạy
 * được mà KHÔNG cần node lẫn khoá ký. Dùng `DEFAULT_CHAIN` ở đây sẽ đi vào `evm.adapter` và cả tệp
 * đỏ vì thiếu `SERVER_SIGNER_PRIVATE_KEY` — đã gặp thật một lần.
 *
 * `mock` nằm trong `SEED_PROJECT_CHAINS` nên dòng dự án có sẵn, không phải tự dựng.
 */

const CHAIN = 'mock';
const SPV = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

async function services() {
  return import('@/lib/bank/issuance.service');
}

async function mockLedger() {
  const { getLedger } = await import('@/lib/ledger');
  return getLedger(CHAIN);
}

/** Ví SPV phải được whitelist trước: contract chặn phát hành vào ví chưa KYC. */
async function whitelistSpv() {
  await (await mockLedger()).whitelist(SPV);
}

beforeEach(() => {
  resetMockLedger();
  resetMemoryStore();
  resetStoreCache();
  process.env.USE_MOCK_DB = 'true';
  actAs('BANK_ADMIN');
});

it('chuỗi dùng trong tệp này được nạp sẵn dự án, nên các ca dưới không phải tự dựng', () => {
  // Đặt ở đầu tệp để nếu `SEED_PROJECT_CHAINS` bỏ `mock` thì lỗi nói đúng nguyên nhân, thay vì
  // mười mấy ca đỏ với lý do "chưa có dự án".
  expect(SEED_PROJECT_CHAINS).toContain(CHAIN);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DEMO_ROLE;
  delete process.env.USE_MOCK_DB;
  resetServerEnvCache();
  resetStoreCache();
});

describe('ca 4 — phát hành đúng tổng cung lấy từ bảng dự án', () => {
  it('phát hành đúng con số trong Project, không phải con số nào truyền vào', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;

    // Đọc từ nguồn duy nhất, không gõ lại 20.000.000 ở đây.
    expect(result.data.amount).toBe(String(WPT_TOTAL_SUPPLY));
    // Và đây là con số THẬT trên chuỗi, đọc lại sau khi xong.
    expect(result.data.totalSupplyOnChain).toBe(String(WPT_TOTAL_SUPPLY));
    expect(await (await mockLedger()).balanceOf(SPV)).toBe(BigInt(WPT_TOTAL_SUPPLY));
  });

  /**
   * Chốt chặn cho việc "tổng cung không đến từ input".
   *
   * Nếu ai thêm một trường số lượng vào schema thì ca này đỏ: giá trị lạ truyền vào bị bỏ qua, và
   * hệ thống vẫn phát hành đúng con số trong bảng dự án.
   */
  it('số lượng truyền thêm vào input bị BỎ QUA, không đặt được quy mô phát hành', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const result = await issueInitialSupply({
      chain: CHAIN,
      spvWallet: SPV,
      // Không có trong schema — phải không có tác dụng gì.
      amount: '999',
      totalSupply: '1',
    });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.amount).toBe(String(WPT_TOTAL_SUPPLY));
  });

  it('đổi tổng cung trong bảng dự án thì phát hành theo con số mới', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    // Dự án thứ hai với tổng cung khác, trên cùng chain.
    const other = await getProjectStore().createProject({
      tokenSymbol: 'WPT2',
      name: 'Dự án điện gió thứ hai',
      totalSupply: '777',
      chain: CHAIN,
    });

    const result = await issueInitialSupply({
      chain: CHAIN,
      spvWallet: SPV,
      tokenSymbol: other.tokenSymbol,
    });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.amount).toBe('777');
  });

  it('ghi mốc phát hành vào bảng dự án và đổi trạng thái sang ISSUED', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const before = await getProjectStore().findProject({
      tokenSymbol: WPT_TOKEN_SYMBOL,
      chain: CHAIN,
    });
    expect(before?.issuedAt).toBeNull();
    expect(before?.status).toBe('DRAFT');

    await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    const after = await getProjectStore().findProject({
      tokenSymbol: WPT_TOKEN_SYMBOL,
      chain: CHAIN,
    });
    expect(after?.issuedAt).not.toBeNull();
    expect(after?.status).toBe('ISSUED');
  });

  /** Giao dịch phải có vết TRƯỚC khi đợi biên nhận — tiến trình chết giữa đường vẫn đối soát được. */
  it('lưu giao dịch vào sổ với đúng nghiệp vụ và số lượng', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });
    expect(result.ok).toBe(true);

    const txns = await getStore().listTxns({ chain: CHAIN });
    const issued = txns.find((txn) => txn.operation === 'mintInitialSupply');
    expect(issued).toBeDefined();
    expect(issued?.amount).toBe(String(WPT_TOTAL_SUPPLY));
    expect(issued?.toWallet).toBe(SPV);
    expect(issued?.status).toBe('CONFIRMED');
  });
});

describe('ca 4 — phát hành lần hai bị từ chối', () => {
  it('lần hai bị từ chối và KHÔNG làm phình tổng cung', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const first = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });
    expect(first.ok).toBe(true);

    const second = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe('ORDER_STATE');

    // Đây là phát biểu quan trọng nhất của cả tệp: tổng cung không đổi.
    const info = await (await mockLedger()).tokenInfo();
    expect(info.totalSupply).toBe(BigInt(WPT_TOTAL_SUPPLY));
    expect(await (await mockLedger()).balanceOf(SPV)).toBe(BigInt(WPT_TOTAL_SUPPLY));
  });

  it('lần hai KHÔNG gửi giao dịch nào, nên sổ giao dịch chỉ có một dòng phát hành', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });
    await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    const txns = await getStore().listTxns({ chain: CHAIN });
    expect(txns.filter((txn) => txn.operation === 'mintInitialSupply')).toHaveLength(1);
  });

  it('lần hai KHÔNG đổi mốc phát hành đã ghi', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const first = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    const project = await getProjectStore().findProject({
      tokenSymbol: WPT_TOKEN_SYMBOL,
      chain: CHAIN,
    });
    expect(project?.issuedAt).toBe(first.data.issuedAt);
  });

  /**
   * Cơ sở dữ liệu và chuỗi lệch nhau: chuỗi đã phát hành nhưng bảng dự án chưa ghi mốc.
   *
   * Phải TỪ CHỐI với lý do nói rõ phải đối soát, không được âm thầm phát hành lần nữa. Đây là
   * tình huống có thật: lần trước giao dịch thành công rồi tiến trình chết trước khi ghi mốc.
   */
  it('chuỗi đã phát hành mà bảng dự án chưa ghi mốc thì từ chối và đòi đối soát', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    // Phát hành THẲNG qua ledger, không qua service — nên bảng dự án không biết gì.
    await (await mockLedger()).mintInitialSupply(SPV, 500n);

    const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ORDER_STATE');
    expect(result.error).toMatch(/đối soát/i);
    // Tổng cung vẫn là con số của lần phát hành thẳng, không cộng thêm.
    expect((await (await mockLedger()).tokenInfo()).totalSupply).toBe(500n);
  });
});

describe('ca 4 — điều kiện biên', () => {
  it('chưa có dự án trên chain đang chọn thì từ chối, không phát hành bừa', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const result = await issueInitialSupply({
      chain: CHAIN,
      spvWallet: SPV,
      tokenSymbol: 'KHONGCO',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect((await (await mockLedger()).tokenInfo()).totalSupply).toBe(0n);
  });

  it('ví SPV chưa whitelist thì ledger từ chối, bảng dự án KHÔNG bị đánh dấu đã phát hành', async () => {
    const { issueInitialSupply } = await services();
    // Cố ý KHÔNG whitelist.

    const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('LEDGER');

    // Đánh dấu ở đây sẽ khoá vĩnh viễn một dự án chưa có token nào.
    const project = await getProjectStore().findProject({
      tokenSymbol: WPT_TOKEN_SYMBOL,
      chain: CHAIN,
    });
    expect(project?.issuedAt).toBeNull();
    expect(project?.status).toBe('DRAFT');
  });

  it('ví SPV sai định dạng bị chặn ở validate, không đi tới chuỗi', async () => {
    const { issueInitialSupply } = await services();

    const result = await issueInitialSupply({ chain: CHAIN, spvWallet: 'khong-phai-vi' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect((await (await mockLedger()).tokenInfo()).totalSupply).toBe(0n);
  });

  it.each([['COMPLIANCE'], ['INVESTOR'], ['AUDITOR']])(
    'vai %s không phát hành được, và lần bị chặn được ghi vào sổ kiểm toán',
    async (role) => {
      const { issueInitialSupply } = await services();
      await whitelistSpv();
      actAs(role);

      const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('FORBIDDEN');
      expect((await (await mockLedger()).tokenInfo()).totalSupply).toBe(0n);

      const audit = await getStore().listAudit({ limit: 10 });
      const denied = audit.find(
        (entry) => entry.action === 'token:mint' && entry.outcome === 'DENIED',
      );
      expect(denied?.actorRole).toBe(role);
    },
  );
});

describe('trạng thái phát hành: con số dự kiến đứng cạnh con số thật', () => {
  it('chưa phát hành: dự kiến có số, trên chuỗi là 0, mốc phát hành rỗng', async () => {
    const { getIssuanceStatus } = await services();

    const result = await getIssuanceStatus({ chain: CHAIN });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.data.plannedTotalSupply).toBe(String(WPT_TOTAL_SUPPLY));
    expect(result.data.totalSupplyOnChain).toBe('0');
    expect(result.data.issuedAt).toBeNull();
    expect(result.data.spvWallet).toBeNull();
  });

  it('đã phát hành: hai con số bằng nhau và có ví SPV', async () => {
    const { getIssuanceStatus, issueInitialSupply } = await services();
    await whitelistSpv();
    await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    const result = await getIssuanceStatus({ chain: CHAIN });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.totalSupplyOnChain).toBe(result.data.plannedTotalSupply);
    expect(result.data.issuedAt).not.toBeNull();
    expect(result.data.spvWallet?.toLowerCase()).toBe(SPV.toLowerCase());
  });
});

describe('mintToInvestorDirect — đường nền cho bản trình diễn', () => {
  /**
   * Đổi TÊN, không đổi HÀNH VI. Ca này giữ cho việc đổi tên không âm thầm đổi cả luồng mint lẻ
   * mà demo runner và test e2e đang dựa vào.
   *
   * Phải đặt khoá ký vì `mintToInvestorDirect` đọc `signer.getAddress()` KHÔNG bọc lỗi — hành vi
   * có từ trước BE-04, và BE-04 chỉ đổi tên hàm nên không sửa nó. Khoá dưới đây là số hex bịa để
   * test, không phải khoá thật, cùng cách `test/env-private-key.test.ts` đang làm.
   */
  it('vẫn mint thẳng cho ví đã whitelist như trước khi đổi tên', async () => {
    process.env.SERVER_SIGNER_PRIVATE_KEY = `0x${'1'.repeat(64)}`;
    resetServerEnvCache();
    const { resetSignerCache } = await import('@/lib/signer');
    resetSignerCache();

    try {
      const { mintToInvestorDirect } = await import('@/lib/bank/mint.service');
      const ledger = await mockLedger();
      await ledger.whitelist(INVESTOR);

      const result = await mintToInvestorDirect({
        chain: CHAIN,
        wallet: INVESTOR,
        amount: '250',
      });

      expect(result.ok, result.ok ? '' : result.error).toBe(true);
      if (!result.ok) return;
      expect(result.data.balanceAfter).toBe('250');
    } finally {
      delete process.env.SERVER_SIGNER_PRIVATE_KEY;
      resetServerEnvCache();
      resetSignerCache();
    }
  });

  /**
   * Phát hành nguồn cung thì KHÔNG đòi khoá ký trên chuỗi `mock`.
   *
   * Khác ca trên là có chủ đích: `mock` không ký gì cả, nên `actorAddress` để `null` thay vì làm cả
   * lượt phát hành thất bại. Ca này giữ cho ai đó không "dọn" nhánh bắt lỗi ở `signerAddressOrNull`
   * và vô tình làm luồng chính chết ở chế độ demo mặc định.
   */
  it('phát hành nguồn cung không cần khoá ký trên mock, actorAddress để null', async () => {
    const { issueInitialSupply } = await services();
    await whitelistSpv();

    const result = await issueInitialSupply({ chain: CHAIN, spvWallet: SPV });

    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    const txns = await getStore().listTxns({ chain: CHAIN });
    const issued = txns.find((txn) => txn.operation === 'mintInitialSupply');
    expect(issued?.actorAddress).toBeNull();
  });

  it('`mintTokens` không còn là một export — tên cũ đã được đổi hẳn', async () => {
    const mintService = await import('@/lib/bank/mint.service');

    expect('mintToInvestorDirect' in mintService).toBe(true);
    // Giữ tên cũ song song sẽ để người đọc sau chọn cái nghe "chuẩn" hơn, tức là chọn sai.
    expect('mintTokens' in mintService).toBe(false);
  });
});
