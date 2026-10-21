import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from '@/lib/bank/purchase.state';
import {
  ACTIVE_PERIOD_STATUSES,
  DISTRIBUTION_PAYOUT_STATUSES,
  VAULT_CLOSE_STATUSES,
} from '@/lib/store/distribution.store.port';
import { KEEPER_RUN_STATUSES } from '@/lib/store/keeper.store.port';
import { TOKEN_REQUEST_STATUSES } from '@/lib/store/token-request.store.port';
import { WITHDRAW_STATUSES, WITHDRAW_TERMINAL_STATUSES } from '@/lib/store/vault.store.port';

/**
 * OP-05 QĐ-F: tập trạng thái "chưa kết thúc" trong `scripts/op05-db-check.sql` phải lấy từ mã. Thêm
 * trạng thái mới trong mã mà quên sửa câu kiểm thì runbook báo "0 bản ghi dở" sai: test này đỏ.
 */
const sql = readFileSync(path.resolve(__dirname, '../../scripts/op05-db-check.sql'), 'utf8');

/** Danh sách trong `IN (...)` thứ `nth` (đếm từ 0) của khối SELECT bắt đầu bằng nhãn bảng. */
function listOf(label: string, nth = 0): string[] {
  const start = sql.indexOf(`'${label}'`);
  expect(start, label).toBeGreaterThan(-1);
  const block = sql.slice(start, sql.indexOf('UNION ALL', start) === -1 ? undefined : sql.indexOf('UNION ALL', start));
  const lists = [...block.matchAll(/IN \(([^)]*)\)/g)].map((m) => m[1]!.split(',').map((s) => s.trim().replace(/'/g, '')));
  return lists[nth]!;
}

const without = <T extends string>(all: readonly T[], drop: readonly string[]) => all.filter((s) => !drop.includes(s));

describe('OP-05 QĐ-F: câu kiểm database chỉ đọc khớp trạng thái trong mã', () => {
  it('cả tệp trong một transaction READ ONLY rồi ROLLBACK, không có câu ghi', () => {
    expect(sql).toMatch(/^BEGIN TRANSACTION READ ONLY;$/m);
    expect(sql.trim().endsWith('ROLLBACK;')).toBe(true);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|COMMIT)\b/);
  });

  it('mỗi bảng dùng đúng tập chưa kết thúc của mã', () => {
    expect(listOf('PurchaseOrder')).toEqual(without(ORDER_STATUSES, TERMINAL_ORDER_STATUSES));
    expect(listOf('TokenRequest')).toEqual(without(TOKEN_REQUEST_STATUSES, ['COMPLETED', 'REJECTED', 'FAILED']));
    expect(listOf('Txn')).toEqual(['PENDING']);
    expect(listOf('DistributionPeriod')).toEqual([...ACTIVE_PERIOD_STATUSES]);
    expect(listOf('DistributionPeriod', 1)).toEqual(without(VAULT_CLOSE_STATUSES, ['DONE']));
    expect(listOf('DistributionPayout')).toEqual(without(DISTRIBUTION_PAYOUT_STATUSES, ['PAID', 'EXPIRED']));
    expect(listOf('KeeperRun')).toEqual(without(KEEPER_RUN_STATUSES, ['SUCCESS', 'FAILED']));
    expect(listOf('WithdrawRequest')).toEqual(without(WITHDRAW_STATUSES, WITHDRAW_TERMINAL_STATUSES));
  });
});
