import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MOCK_VAULT_ADDRESS } from '@bidv/shared';
import { CONFIG_KEYS, WPT_ISSUE_PRICE_VND } from '@/lib/config/issue-terms';
import { resetServerEnvCache } from '@/lib/config/env';
import { formatAmount, formatDateTime } from '@/lib/format';
import { resetMockLedger, seedMockLedger } from '@/lib/ledger/mock.adapter';
import { MOCK_WIND_STATS, REGION_LABELS } from '@/lib/mock-data';
import { describeVaultConfigStep } from '@/lib/bank/vault-config';
import { getConfigStore, getOrderStore, getStore, resetMemoryStore, resetStoreCache } from '@/lib/store';

/**
 * FIX-03: chuẩn hoá các chuỗi hiển thị trong `lib/` theo danh sách. Ca 1 quét mọi chuỗi trong
 * `app/src/lib` (trừ `lib/store`) bằng bộ phân tích của TypeScript, nên chú thích tự bị bỏ; ca 2 tới 7
 * kiểm các câu đã đổi trên đúng hàm dựng ra chúng.
 */
const LIB = path.resolve(__dirname, '../src/lib');
const CHAIN = 'mock';
const ALICE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const PRICE = BigInt(WPT_ISSUE_PRICE_VND);
const REASON = 'điều chỉnh giá theo quyết định';
/** Gạch dài, chấm giữa, ký tự mũi tên, mũi tên ASCII (dấu trừ rồi dấu lớn hơn). */
const BAD = /[—·→]|-[>]/;

function actAs(role: string) {
  process.env.DEMO_ROLE = role;
  resetServerEnvCache();
}

/** Mọi chuỗi thường, template và từng phần chữ của template lồng có ký tự cấm. */
function scanStrings(dir: string, hits: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== 'store') scanStrings(file, hits);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      let text: string | null = null;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
      else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
      else if (ts.isJsxText(node)) text = node.getText();
      if (text !== null && BAD.test(text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        hits.push(`${path.relative(LIB, file)}:${line + 1}: ${text.slice(0, 90)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return hits;
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

describe('FIX-03 chuỗi hiển thị trong lib', () => {
  it('ca 1: không chuỗi nào trong lib (trừ lib/store) có gạch dài, chấm giữa, mũi tên', () => {
    expect(scanStrings(LIB)).toEqual([]);
  });

  it('ca 2: ô trống là gạch ngắn, số có dấu chấm hàng nghìn', () => {
    expect(formatAmount(null)).toBe('–');
    expect(formatAmount('')).toBe('–');
    expect(formatDateTime(null)).toBe('–');
    expect(formatAmount(1500000000n)).toBe('1.500.000.000');
  });

  it('ca 3: câu bước cấu hình vault dùng chữ "thành" và số có dấu nghìn', () => {
    expect(describeVaultConfigStep({ kind: 'setFixedLock', amount: 1500000000n, previous: 0n })).toBe(
      'số khoá cố định 0 thành 1.500.000.000 VNDB',
    );
    expect(describeVaultConfigStep({ kind: 'setPercentRate', bps: 2000n, previous: 0n })).toBe('tỷ lệ khoá 0% thành 20%');
    expect(describeVaultConfigStep({ kind: 'setLockMode', mode: 'PERCENT', previous: 'UNSET' })).toBe(
      'chế độ khoá UNSET thành PERCENT',
    );
  });

  it('ca 4: giá lệch quá ngưỡng: câu lỗi có số dấu nghìn, đơn vị VNDB, không còn VND', async () => {
    const { getIssuePrice, setIssuePrice } = await import('@/lib/bank/config.service');
    const before = await getIssuePrice(CHAIN);
    const tenfold = (BigInt(before.priceVnd) * 10n).toString();

    const result = await setIssuePrice({ chain: CHAIN, reason: REASON, priceVnd: tenfold });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.error).toContain(`Giá mới ${formatAmount(tenfold)} VNDB lệch quá`);
    expect(result.error).toContain(`${formatAmount(before.priceVnd)} VNDB. Kiểm lại số chữ số`);
    expect(formatAmount(tenfold)).toMatch(/^\d{1,3}(\.\d{3})+$/);
    expect(result.error).not.toMatch(/\bVND\b(?!B)/);
  });

  it('ca 5: câu "dưới ngưỡng" của duyệt chia và của màn tổng quan có số dấu nghìn', async () => {
    const approval = await import('@/lib/bank/distribution-approval.service');
    seedMockLedger({ profitPool: 1_000_000n });
    await getConfigStore().setConfig({
      key: CONFIG_KEYS.distributionMinNewBalance,
      value: '2000000',
      type: 'bigint',
      changedBy: 'TELLER',
    });
    actAs('CONTROLLER');

    const approved = await approval.approveDistribution({ chain: CHAIN, expectedAmount: '1000000' });
    expect(!approved.ok && approved.code).toBe('INSUFFICIENT_PROFIT_POOL');
    if (!approved.ok) {
      expect(approved.error).toBe(
        'Phần chưa phân bổ 1.000.000 VNDB dưới ngưỡng 2.000.000 VNDB (distribution.min_new_balance).',
      );
    }

    const overview = await approval.getDistributionOverview({ chain: CHAIN });
    expect(overview.ok, overview.ok ? '' : overview.error).toBe(true);
    if (overview.ok) {
      expect(overview.data.approveBlockers).toContain('Phần chưa phân bổ 1.000.000 VNDB dưới ngưỡng 2.000.000 VNDB.');
    }
  });

  it('ca 6: số mẫu lợi tức đã chia và nhãn vùng', () => {
    expect(MOCK_WIND_STATS.profitDistributedVndBn).toBe(5.8);
    for (const label of Object.values(REGION_LABELS)) expect(label).not.toMatch(/·/);
  });

  it('ca 7: dòng sổ can thiệp tay giữ nguyên mã lệnh, màn chi tiết lệnh vẫn tìm thấy', async () => {
    const { issueInitialSupply } = await import('@/lib/bank/issuance.service');
    const { executeOrder } = await import('@/lib/bank/purchase.service');
    const { getOrderDetail } = await import('@/lib/bank/trade.service');
    const { getLedger } = await import('@/lib/ledger');
    const ledger = getLedger(CHAIN);
    await ledger.whitelist(MOCK_VAULT_ADDRESS);
    process.env.ENABLE_DEMO_TOKEN_MINT = 'true';
    resetServerEnvCache();
    const issued = await issueInitialSupply({ chain: CHAIN, spvWallet: MOCK_VAULT_ADDRESS, amount: '1000' });
    expect(issued.ok, issued.ok ? '' : issued.error).toBe(true);
    await ledger.whitelist(ALICE);
    seedMockLedger({ paymentBalances: { [ALICE]: 10n * PRICE }, paymentAllowances: { [ALICE]: 10n * PRICE } });
    const order = await getOrderStore().createOrder({
      chain: CHAIN,
      investorWallet: ALICE,
      clientRequestId: crypto.randomUUID(),
      side: 'BUY',
      status: 'CHECKING',
      wptAmount: '1',
      vndAmount: PRICE.toString(),
      actorRole: 'INVESTOR',
    });

    actAs('TELLER');
    const executed = await executeOrder({ chain: CHAIN, orderId: order.id });
    expect(executed.ok, executed.ok ? '' : executed.error).toBe(true);

    const intervene = (await getStore().listAudit({ limit: 100 })).filter(
      (entry) => entry.action === 'order:intervene' && entry.detail?.includes(order.id),
    );
    expect(intervene.length).toBeGreaterThan(0);
    expect(intervene[0].detail?.startsWith(`can thiệp tay, lệnh ${order.id}`)).toBe(true);

    actAs('INVESTOR');
    const detail = await getOrderDetail({ chain: CHAIN, investorWallet: ALICE, orderId: order.id });
    expect(detail.ok, detail.ok ? '' : detail.error).toBe(true);
    if (detail.ok) {
      expect(detail.data.audit.some((entry) => entry.detail === intervene[0].detail)).toBe(true);
    }
  });
});
