import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/token-info/route';
import { resetServerEnvCache } from '@/lib/config/env';
import { resetMemoryStore, resetStoreCache } from '@/lib/store';
import { resetMockLedger } from '@/lib/ledger';
import { WPT_TOKEN_SYMBOL } from '@/lib/config/issue-terms';
import { readStep, traceRead } from '@/lib/diagnostics/read-trace';

beforeEach(() => {
  vi.stubEnv('USE_MOCK_DB', 'true'); vi.stubEnv('DEMO_ROLE', 'TELLER');
  vi.stubEnv('ENABLE_READ_DIAGNOSTICS', 'false');
  resetServerEnvCache(); resetMemoryStore(); resetStoreCache(); resetMockLedger();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); resetServerEnvCache(); });
const idA = '12345678-1234-4234-8234-123456789012';
const idB = 'abcdef12-1234-4234-8234-123456789012';
const request = () => new Request(`http://localhost/api/token-info?chain=mock&tokenSymbol=${WPT_TOKEN_SYMBOL}`, { headers: { 'X-Read-Id': idA } });

describe('GET token-info giữ kiểm quyền/validation', () => {
  it('service thật đọc thông tin, không cache và có mã tra cứu', async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-read-id')).toBe(idA);
    expect((await response.json()).data.tokenSymbol).toBe(WPT_TOKEN_SYMBOL);
  });
  it('một lượt tra cứu chỉ đọc ví SPV một lần', async () => {
    const ledgerModule = await import('@/lib/ledger');
    const ledger = ledgerModule.getLedger('mock');
    const readSpv = vi.spyOn(ledger, 'spvWallet');
    vi.spyOn(ledgerModule, 'getLedger').mockReturnValue(ledger);
    expect((await GET(request())).status).toBe(200);
    expect(readSpv).toHaveBeenCalledTimes(1);
  });
  it('Nhà đầu tư không được đọc cổng vận hành', async () => {
    vi.stubEnv('DEMO_ROLE', 'INVESTOR'); resetServerEnvCache();
    const response = await GET(request()); expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('FORBIDDEN');
  });
  it('không lùi về chain mặc định khi query sai', async () => {
    expect((await GET(new Request('http://localhost/api/token-info?chain=bad&tokenSymbol=WPT'))).status).toBe(400);
  });
});
describe('diagnostics chỉ đo thời gian trong từng request', () => {
  it('mặc định không in log', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    await traceRead(idA, () => readStep('test', async () => 'ok')); expect(log).not.toHaveBeenCalled();
  });
  it('hai request đồng thời không lẫn id và không log message/credential', async () => {
    vi.stubEnv('ENABLE_READ_DIAGNOSTICS', 'true'); resetServerEnvCache();
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    await Promise.all([
      traceRead(idA, () => readStep('first', async () => { await Promise.resolve(); return 'ok'; })),
      traceRead(idB, () => readStep('second', async () => { throw Object.assign(new Error('PRIVATE credential'), { code: '57014' }); })).catch(() => {}),
    ]);
    const rows = log.mock.calls.map(([value]) => JSON.parse(value));
    expect(rows.filter((r) => r.stage === 'first').every((r) => r.id === idA)).toBe(true);
    expect(rows.filter((r) => r.stage === 'second').every((r) => r.id === idB)).toBe(true);
    expect(rows.some((r) => r.code === '57014')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('credential');
  });
});
