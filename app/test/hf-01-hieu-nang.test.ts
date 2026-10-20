import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HF-01: chặn quay lại ba nguồn lượt Worker thừa đã làm hệ thống chậm (đo ngày 21/10/2026).
 *
 * Kiểm trên mã nguồn vì cả ba là cách gọi, không phải kết quả nghiệp vụ: chạy giao diện thì
 * vẫn đúng số liệu, chỉ chậm, nên không có kiểm thử chức năng nào đỏ khi chúng quay lại.
 */
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('HF-01: hạn chế lượt gọi Worker khi mở trang', () => {
  it('ca 1: mọi Link trong menu bên trái tắt prefetch', () => {
    const source = read('src/components/layout/sidebar.tsx');
    const links = source.match(/<Link\b[^>]*>/gs) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const tag of links) expect(tag).toContain('prefetch={false}');
  });

  it('ca 2: menu không gọi action số việc chờ cho chain mặc định (đã có số từ server)', () => {
    const source = read('src/components/layout/sidebar.tsx');
    expect(source).toMatch(/const needsFetch = chain !== config\.defaultChain;/);
    expect(source).toMatch(/useEffect\(\(\) => \{\s*if \(!needsFetch\) return;/);
  });

  it('ca 3: màn rút gọi đúng một action khi mở (đối soát và đọc danh sách gộp)', () => {
    const source = read('src/components/pages/seller-withdraw.tsx');
    expect(source).toContain('reconcileAndListMyWithdrawRequestsAction({ chain })');
    expect(source).not.toContain('listMyWithdrawRequestsAction');
    expect(source).not.toContain('reconcileWithdrawRequestsAction');
  });

  it('ca 4: client đọc EVM gom lô JSON-RPC, client ghi không gom', () => {
    const source = read('src/lib/ledger/evm.adapter.ts');
    expect(source).toMatch(/createPublicClient\(\{[^}]*transport: http\(rpcUrl, \{ batch: \{ batchSize: RPC_READ_BATCH_SIZE \} \}\)/s);
    expect(source).toMatch(/createWalletClient\(\{ account, chain: viemChain, transport: http\(rpcUrl\) \}\)/);
  });
});
