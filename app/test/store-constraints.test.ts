import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetServerEnvCache } from '@/lib/config/env';
import {
  createMemoryDistributionStore,
} from '@/lib/store/memory.distribution.store';
import { createMemoryConfigStore } from '@/lib/store/memory.config.store';
import { createMemoryKeeperStore } from '@/lib/store/memory.keeper.store';
import { createMemoryOrderStore } from '@/lib/store/memory.order.store';
import { createMemoryProjectStore } from '@/lib/store/memory.project.store';
import { createMemorySettlementStore } from '@/lib/store/memory.settlement.store';
import { resetMemoryStores } from '@/lib/store/memory.state';
import { createPostgresConfigStore } from '@/lib/store/postgres.config.store';
import { createPostgresDistributionStore } from '@/lib/store/postgres.distribution.store';
import { createPostgresKeeperStore } from '@/lib/store/postgres.keeper.store';
import { createPostgresOrderStore } from '@/lib/store/postgres.order.store';
import type { PgQuery } from '@/lib/store/postgres.pool';
import { createPostgresProjectStore } from '@/lib/store/postgres.project.store';
import { createPostgresSettlementStore } from '@/lib/store/postgres.settlement.store';
import type { IConfigStore } from '@/lib/store/config.store.port';
import type { IDistributionStore } from '@/lib/store/distribution.store.port';
import type { IKeeperStore } from '@/lib/store/keeper.store.port';
import type { IOrderStore } from '@/lib/store/order.store.port';
import type { IProjectStore } from '@/lib/store/project.store.port';
import type { ISettlementStore } from '@/lib/store/settlement.store.port';
import { CONFIG_KEYS, WPT_TOKEN_SYMBOL, WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { SEED_PROJECT } from '@/lib/store/seed-data';
import {
  FOREIGN_KEYS,
  ForeignKeyError,
  InvalidStatusError,
  MAX_BULK_ROWS,
  StoreUsageError,
  UNIQUE_CONSTRAINTS,
  UniqueConstraintError,
  mapPgConstraintError,
} from '@/lib/store/store.errors';

/**
 * BE-09 — RÀNG BUỘC DUY NHẤT PHẢI ĐƯỢC TÔN TRỌNG Ở CẢ HAI BẢN LƯU TRỮ.
 *
 * Ba lớp kiểm, vì "cả hai bản" không kiểm được bằng một cách duy nhất:
 *
 *  1. LƯỢC ĐỒ SQL (luôn chạy) — đọc `prisma/init.sql` thật và xác nhận từng ràng buộc
 *     có mặt. Đây là bằng chứng cho phía Postgres mà KHÔNG cần Postgres đang chạy: file
 *     này chính là DDL mà `ensureSchema` áp lên cơ sở dữ liệu.
 *
 *  2. HÀNH VI (luôn chạy với bản bộ nhớ; thêm bản Postgres khi có `TEST_DATABASE_URL`) —
 *     cùng một bộ ca kiểm chạy trên mọi bản có sẵn, nên bản nào dễ tính hơn là đỏ ngay.
 *
 *  3. QUY LỖI DRIVER (luôn chạy) — bơm một hàm truy vấn giả ném lỗi đúng hình dạng của
 *     `pg` (`code: '23505'`, `constraint: '...'`) và xác nhận bản Postgres quy nó về
 *     CÙNG lớp lỗi mà bản bộ nhớ ném. Không có lớp này thì nghiệp vụ bắt lỗi được ở chế
 *     độ bộ nhớ và trượt ở chế độ Postgres.
 *
 * Chạy thêm lớp 2 với Postgres thật:
 *     docker compose up -d db
 *     TEST_DATABASE_URL=postgresql://bidv:bidv@localhost:5432/bidv_rwa npm test
 */

// ===========================================================================
//  LỚP 1 — LƯỢC ĐỒ SQL
// ===========================================================================

const INIT_SQL = readFileSync(path.resolve(__dirname, '../prisma/init.sql'), 'utf8');

/** Sáu bảng BE-09 thêm vào. */
const NEW_TABLES = [
  'PurchaseOrder',
  'DistributionPeriod',
  'DistributionPayout',
  'SettlementRound',
  'SettlementCase',
  'KeeperRun',
] as const;

/** Bảng cũ — R5.1 nói KHÔNG được sửa hay xoá cột nào của chúng. */
const OLD_TABLES = ['Txn', 'AuditLog', 'Investor', 'Role', 'Permission', 'RolePermission'] as const;
/** Ba bảng BE-04 thêm vào. */
const BE04_TABLES = ['SystemConfig', 'SystemConfigHistory', 'Project'] as const;

/** Khối `CREATE TABLE "X" ( ... )` trong init.sql. */
function tableBlock(table: string): string {
  const match = INIT_SQL.match(new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`));
  expect(match, `init.sql phải có CREATE TABLE "${table}"`).toBeTruthy();
  return match![1];
}

describe('lớp 1 — init.sql thật sự mang các ràng buộc duy nhất', () => {
  it('sáu bảng BE-09 đều được tạo', () => {
    for (const table of NEW_TABLES) {
      expect(INIT_SQL).toContain(`CREATE TABLE "${table}" (`);
    }
  });

  it('bảng cũ vẫn còn nguyên (R5.1)', () => {
    for (const table of OLD_TABLES) {
      expect(INIT_SQL).toContain(`CREATE TABLE "${table}" (`);
    }
  });

  /**
   * Chiều thuận: mọi ràng buộc đã khai trong mã đều có chỉ mục duy nhất thật.
   *
   * Thiếu chiều này thì `UNIQUE_CONSTRAINTS` có thể liệt kê một ràng buộc không tồn tại,
   * và bản Postgres sẽ nhận hai dòng trùng trong khi bản bộ nhớ từ chối.
   */
  it.each(Object.entries(UNIQUE_CONSTRAINTS))(
    'ràng buộc %s có CREATE UNIQUE INDEX đúng bảng và đúng cột',
    (name, { table, columns }) => {
      const expected = `CREATE UNIQUE INDEX "${name}" ON "${table}"(${columns
        .map((column) => `"${column}"`)
        .join(', ')});`;
      expect(INIT_SQL).toContain(expected);
    },
  );

  /**
   * Chiều nghịch: mọi chỉ mục duy nhất trên bảng BE-09 đều đã khai trong mã.
   *
   * Thiếu chiều này thì thêm một ràng buộc vào lược đồ mà quên khai ở
   * `UNIQUE_CONSTRAINTS` sẽ cho ra `UniqueConstraintError` không nói được cột nào trùng,
   * và bản bộ nhớ thì không kiểm ràng buộc đó chút nào.
   */
  it('không có chỉ mục duy nhất nào của bảng BE-09 bị bỏ ngoài UNIQUE_CONSTRAINTS', () => {
    const declared = new Set(Object.keys(UNIQUE_CONSTRAINTS));
    const found = [...INIT_SQL.matchAll(/CREATE UNIQUE INDEX "([^"]+)" ON "([^"]+)"/g)]
      .filter(([, , table]) => (NEW_TABLES as readonly string[]).includes(table))
      .map(([, name]) => name);

    expect(found.length).toBeGreaterThan(0);
    expect(found.filter((name) => !declared.has(name))).toEqual([]);
  });

  it.each(Object.entries(FOREIGN_KEYS))('khoá ngoài %s tồn tại trong init.sql', (name, { table }) => {
    expect(INIT_SQL).toContain(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY`);
  });

  /** R5.3 — mọi cột thời gian của bảng mới phải mang timezone, không thì hiển thị lệch giờ. */
  it('mọi cột thời gian của bảng BE-09 là TIMESTAMPTZ(3)', () => {
    for (const table of NEW_TABLES) {
      const block = tableBlock(table);
      const timeColumns = [...block.matchAll(/"(\w+)" TIMESTAMP\w*\(3\)/g)];
      expect(timeColumns.length, `${table} phải có cột thời gian`).toBeGreaterThan(0);
      expect(block).not.toMatch(/TIMESTAMP\(3\)/);
    }
  });

  /** R5.3 — mọi cột số tiền là Decimal(78, 0): uint256 vượt tầm int8 của Postgres. */
  it('mọi cột số tiền của bảng BE-09 là DECIMAL(78,0)', () => {
    const moneyColumns: Record<string, readonly string[]> = {
      PurchaseOrder: ['wptAmount', 'vndAmount'],
      DistributionPeriod: ['totalAmount', 'totalSupplyAt'],
      DistributionPayout: ['balanceAt', 'amount'],
      SettlementRound: ['navRate'],
      SettlementCase: ['wptAmount', 'payoutAmount'],
    };
    for (const [table, columns] of Object.entries(moneyColumns)) {
      const block = tableBlock(table);
      for (const column of columns) {
        expect(block, `${table}.${column}`).toContain(`"${column}" DECIMAL(78,0)`);
      }
    }
  });

  /** R1.3 — hai truy vấn dùng nhiều nhất trên bảng lệnh mua phải có chỉ mục. */
  it('bảng lệnh mua có chỉ mục theo ví và theo trạng thái', () => {
    expect(INIT_SQL).toContain('ON "PurchaseOrder"("investorWallet", "createdAt")');
    expect(INIT_SQL).toContain('ON "PurchaseOrder"("status", "createdAt")');
  });

  /** Task 2.3 — nhà đầu tư tra lịch sử lợi nhuận của chính mình. */
  it('bảng chi tiết chia có chỉ mục theo ví nhà đầu tư', () => {
    expect(INIT_SQL).toContain('ON "DistributionPayout"("investorWallet", "createdAt")');
  });

  /** R3.2 + R3.3 — bốn trạng thái, bốn cột thời điểm, hai cột mã giao dịch. */
  it('hồ sơ tất toán có đủ bốn cột thời điểm và hai cột mã giao dịch', () => {
    const block = tableBlock('SettlementCase');
    for (const column of ['notifiedAt', 'confirmedAt', 'paidAt', 'burnedAt']) {
      expect(block).toContain(`"${column}" TIMESTAMPTZ(3)`);
    }
    for (const column of ['paidTxHash', 'burnTxHash']) {
      expect(block).toContain(`"${column}" TEXT`);
    }
  });
});

// ===========================================================================
//  LỚP 1b — BA BẢNG BE-04 VÀ CỘT Role.isConfig
// ===========================================================================
//  Cùng ba phép kiểm đã áp cho bảng BE-09 (bảng tồn tại, cột thời gian mang timezone, cột số
//  tiền đủ dải uint256), vì ba bảng mới gặp đúng những cái bẫy đó. Không gộp vào `NEW_TABLES`
//  của BE-09: chiều nghịch ở trên lọc theo danh sách ấy để bảo đảm "mọi chỉ mục duy nhất của
//  bảng BE-09 đã khai trong mã", và trộn bảng của hai task vào một danh sách làm câu phát biểu
//  đó mất nghĩa.
describe('lớp 1b — init.sql mang ba bảng BE-04 và cột Role.isConfig', () => {
  it('ba bảng BE-04 đều được tạo', () => {
    for (const table of BE04_TABLES) {
      expect(INIT_SQL).toContain(`CREATE TABLE "${table}" (`);
    }
  });

  /**
   * Cột `isConfig` là LỚP THỨ HAI của việc đổi tham số hệ thống.
   *
   * Mặc định phải là `false` (nguyên tắc đóng): `DEFAULT true` nghĩa là vai mới thêm vào tự
   * nhiên đổi được giá bán, và không ai phải ra quyết định đó một cách tường minh.
   */
  it('Role.isConfig là BOOLEAN mặc định false', () => {
    expect(tableBlock('Role')).toContain('"isConfig" BOOLEAN NOT NULL DEFAULT false');
  });

  it('mọi cột thời gian của bảng BE-04 là TIMESTAMPTZ(3)', () => {
    for (const table of BE04_TABLES) {
      const block = tableBlock(table);
      const timeColumns = [...block.matchAll(/"(\w+)" TIMESTAMP\w*\(3\)/g)];
      expect(timeColumns.length, `${table} phải có cột thời gian`).toBeGreaterThan(0);
      expect(block).not.toMatch(/TIMESTAMP\(3\)/);
    }
  });

  /**
   * `Project.totalSupply` là uint256 — 20 triệu vừa `int8`, nhưng tổng cung của một đợt phát
   * hành khác có thể dùng token có `decimals = 18` và khi đó con số vượt tầm ngay.
   */
  it('Project.totalSupply là DECIMAL(78,0)', () => {
    expect(tableBlock('Project')).toContain('"totalSupply" DECIMAL(78,0)');
  });

  /**
   * `SystemConfig.value` là TEXT, KHÔNG phải cột số.
   *
   * Cố ý kiểm: đổi nó thành `DECIMAL`/`INTEGER` sẽ chạy được với giá phát hành rồi vỡ ở tham số
   * đầu tiên không phải số — mà `price_change_threshold` đã là hệ số, và tham số bật/tắt thì
   * chắc chắn tới.
   */
  it('SystemConfig.value là TEXT để mang được mọi kiểu tham số', () => {
    const block = tableBlock('SystemConfig');
    expect(block).toContain('"value" TEXT NOT NULL');
    expect(block).toContain('"type" TEXT NOT NULL');
  });

  /**
   * `oldValue` phải cho phép NULL: lần đặt ĐẦU TIÊN cho một khoá không có giá trị cũ, và ghi
   * `''` hay `'0'` vào đó là bịa ra một giá trị chưa từng có hiệu lực.
   */
  it('SystemConfigHistory.oldValue cho phép NULL', () => {
    const block = tableBlock('SystemConfigHistory');
    expect(block).toMatch(/"oldValue" TEXT,/);
    expect(block).toContain('"newValue" TEXT NOT NULL');
  });

  it('lịch sử tham số có chỉ mục theo khoá và thời điểm', () => {
    expect(INIT_SQL).toContain('ON "SystemConfigHistory"("key", "changedAt")');
  });
});

// ===========================================================================
//  LỚP 2 — HÀNH VI, CHẠY TRÊN MỌI BẢN CÓ SẴN
// ===========================================================================

interface Backend {
  orders: IOrderStore;
  distribution: IDistributionStore;
  settlement: ISettlementStore;
  keeper: IKeeperStore;
  config: IConfigStore;
  projects: IProjectStore;
  /** Dọn trước mỗi ca kiểm. Bản Postgres không xoá dữ liệu, chỉ dùng khoá riêng mỗi ca. */
  reset: () => void;
}

function memoryBackend(): Backend {
  return {
    orders: createMemoryOrderStore(),
    distribution: createMemoryDistributionStore(),
    settlement: createMemorySettlementStore(),
    keeper: createMemoryKeeperStore(),
    config: createMemoryConfigStore(),
    projects: createMemoryProjectStore(),
    reset: resetMemoryStores,
  };
}

/**
 * Bản Postgres THẬT, chỉ dựng khi có `TEST_DATABASE_URL`.
 *
 * Dùng đúng `pgQuery` mặc định chứ không tự mở kết nối riêng: như vậy ca kiểm đi qua cả
 * `ensureSchema` — tức là lược đồ được áp bằng chính đường mà ứng dụng dùng.
 */
function postgresBackend(): Backend {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.USE_MOCK_DB = 'false';
  resetServerEnvCache();

  return {
    orders: createPostgresOrderStore(),
    distribution: createPostgresDistributionStore(),
    settlement: createPostgresSettlementStore(),
    keeper: createPostgresKeeperStore(),
    config: createPostgresConfigStore(),
    projects: createPostgresProjectStore(),
    // Không TRUNCATE: đây có thể là cơ sở dữ liệu demo của Owner. Mỗi ca kiểm tự dùng
    // khoá riêng (uuid) nên không đụng dữ liệu cũ và chạy lại được nhiều lần.
    reset: () => {},
  };
}

const backends: Array<[label: string, make: () => Backend]> = [['bộ nhớ', memoryBackend]];
if (process.env.TEST_DATABASE_URL) backends.push(['Postgres', postgresBackend]);

const WALLET_A = '0x1111111111111111111111111111111111111111';
const WALLET_B = '0x2222222222222222222222222222222222222222';

describe.each(backends)('lớp 2 — hành vi bản %s', (_label, make) => {
  let store: Backend;

  beforeEach(() => {
    store = make();
    store.reset();
  });

  // -------------------------------------------------------------------------
  //  7.5 — mở cùng một kỳ hai lần
  // -------------------------------------------------------------------------
  describe('kỳ chia lợi nhuận', () => {
    const newPeriod = (periodKey: string) => ({
      periodKey,
      snapshotId: 1,
      totalAmount: '1000000',
      totalSupplyAt: '100',
      chain: 'mock' as const,
    });

    it('mở cùng một periodKey hai lần bị từ chối (R2.2)', async () => {
      const periodKey = `ky-${randomUUID()}`;
      await store.distribution.openPeriod(newPeriod(periodKey));

      await expect(store.distribution.openPeriod(newPeriod(periodKey))).rejects.toBeInstanceOf(
        UniqueConstraintError,
      );
    });

    it('lần mở thứ hai KHÔNG tạo thêm kỳ nào', async () => {
      const periodKey = `ky-${randomUUID()}`;
      const first = await store.distribution.openPeriod(newPeriod(periodKey));

      await expect(
        store.distribution.openPeriod({ ...newPeriod(periodKey), totalAmount: '999' }),
      ).rejects.toBeInstanceOf(UniqueConstraintError);

      // Ca kiểm từ chối phải kiểm luôn "trạng thái không đổi", không chỉ kiểm có ném lỗi:
      // một hiện thực ghi trước rồi mới kiểm cũng ném lỗi, mà dữ liệu đã hỏng.
      const found = await store.distribution.findPeriodByKey(periodKey);
      expect(found?.id).toBe(first.id);
      expect(found?.totalAmount).toBe('1000000');
    });

    it('lỗi nói rõ bảng và cột bị trùng', async () => {
      const periodKey = `ky-${randomUUID()}`;
      await store.distribution.openPeriod(newPeriod(periodKey));

      await expect(store.distribution.openPeriod(newPeriod(periodKey))).rejects.toMatchObject({
        table: 'DistributionPeriod',
        columns: ['periodKey'],
      });
    });
  });

  // -------------------------------------------------------------------------
  //  7.2 — chia trùng cho một nhà đầu tư
  // -------------------------------------------------------------------------
  describe('chi tiết chia lợi nhuận', () => {
    const openPeriod = () =>
      store.distribution.openPeriod({
        periodKey: `ky-${randomUUID()}`,
        snapshotId: 1,
        totalAmount: '1000000',
        totalSupplyAt: '100',
        chain: 'mock',
      });

    const payout = (wallet: string) => ({ investorWallet: wallet, balanceAt: '10', amount: '100' });

    it('ghi trùng (periodId, investorWallet) bị từ chối (R2.4)', async () => {
      const period = await openPeriod();
      await store.distribution.createPayouts({ periodId: period.id, rows: [payout(WALLET_A)] });

      await expect(
        store.distribution.createPayouts({ periodId: period.id, rows: [payout(WALLET_A)] }),
      ).rejects.toMatchObject({
        name: 'UniqueConstraintError',
        table: 'DistributionPayout',
        columns: ['periodId', 'investorWallet'],
      });
    });

    it('cùng một ví ở HAI kỳ khác nhau thì được — ràng buộc là cặp, không phải riêng ví', async () => {
      const first = await openPeriod();
      const second = await openPeriod();

      await store.distribution.createPayouts({ periodId: first.id, rows: [payout(WALLET_A)] });
      await expect(
        store.distribution.createPayouts({ periodId: second.id, rows: [payout(WALLET_A)] }),
      ).resolves.toHaveLength(1);
    });

    it('lô có một dòng trùng thì KHÔNG dòng nào được ghi', async () => {
      const period = await openPeriod();
      await store.distribution.createPayouts({ periodId: period.id, rows: [payout(WALLET_A)] });

      await expect(
        store.distribution.createPayouts({
          periodId: period.id,
          rows: [payout(WALLET_B), payout(WALLET_A)],
        }),
      ).rejects.toBeInstanceOf(UniqueConstraintError);

      // WALLET_B nằm TRƯỚC dòng trùng: hiện thực ghi dần từng dòng sẽ để lại nó.
      const rows = await store.distribution.listPayouts({ periodId: period.id });
      expect(rows).toHaveLength(1);
      expect(rows[0].investorWallet).toBe(WALLET_A);
    });

    it('một lô có hai cách viết hoa thường của cùng một ví bị từ chối', async () => {
      const period = await openPeriod();

      await expect(
        store.distribution.createPayouts({
          periodId: period.id,
          rows: [payout(WALLET_A), payout(WALLET_A.toUpperCase())],
        }),
      ).rejects.toBeInstanceOf(UniqueConstraintError);

      expect(await store.distribution.listPayouts({ periodId: period.id })).toHaveLength(0);
    });

    it('hồ sơ trỏ vào kỳ không tồn tại bị từ chối bằng ForeignKeyError', async () => {
      await expect(
        store.distribution.createPayouts({ periodId: randomUUID(), rows: [payout(WALLET_A)] }),
      ).rejects.toBeInstanceOf(ForeignKeyError);
    });

    it('số tiền trả ra là CHUỖI, không phải number hay bigint', async () => {
      const period = await openPeriod();
      const [row] = await store.distribution.createPayouts({
        periodId: period.id,
        rows: [{ investorWallet: WALLET_A, balanceAt: '10', amount: '123456789012345678901234567890' }],
      });

      expect(typeof row.amount).toBe('string');
      expect(row.amount).toBe('123456789012345678901234567890');
      expect(typeof period.totalSupplyAt).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  //  7.3 — chi trả hoặc đốt trùng
  // -------------------------------------------------------------------------
  describe('hồ sơ tất toán', () => {
    const openRound = () =>
      store.settlement.openRound({ snapshotId: 1, navRate: '12000', chain: 'mock' });

    const settlementCase = (wallet: string) => ({
      holderWallet: wallet,
      wptAmount: '10',
      payoutAmount: '120000',
    });

    it('ghi trùng (roundId, holderWallet) bị từ chối (R3.4)', async () => {
      const round = await openRound();
      await store.settlement.createCases({ roundId: round.id, rows: [settlementCase(WALLET_A)] });

      await expect(
        store.settlement.createCases({ roundId: round.id, rows: [settlementCase(WALLET_A)] }),
      ).rejects.toMatchObject({
        name: 'UniqueConstraintError',
        table: 'SettlementCase',
        columns: ['roundId', 'holderWallet'],
      });

      expect(await store.settlement.listCases({ roundId: round.id })).toHaveLength(1);
    });

    it('lô có một dòng trùng thì KHÔNG dòng nào được ghi', async () => {
      const round = await openRound();
      await store.settlement.createCases({ roundId: round.id, rows: [settlementCase(WALLET_A)] });

      await expect(
        store.settlement.createCases({
          roundId: round.id,
          rows: [settlementCase(WALLET_B), settlementCase(WALLET_A)],
        }),
      ).rejects.toBeInstanceOf(UniqueConstraintError);

      expect(await store.settlement.listCases({ roundId: round.id })).toHaveLength(1);
    });

    it('hồ sơ mới có mốc thời điểm của đúng trạng thái ban đầu, ba cột kia rỗng', async () => {
      const round = await openRound();
      const [record] = await store.settlement.createCases({
        roundId: round.id,
        rows: [settlementCase(WALLET_A)],
      });

      expect(record.status).toBe('NOTIFIED');
      expect(record.notifiedAt).not.toBeNull();
      expect(record.confirmedAt).toBeNull();
      expect(record.paidAt).toBeNull();
      expect(record.burnedAt).toBeNull();
    });

    it('mỗi bước ghi đúng cột thời điểm và đúng cột mã giao dịch (R3.3)', async () => {
      const round = await openRound();
      await store.settlement.createCases({ roundId: round.id, rows: [settlementCase(WALLET_A)] });

      const key = { roundId: round.id, holderWallet: WALLET_A };
      const confirmed = await store.settlement.markCase({ ...key, status: 'CONFIRMED' });
      expect(confirmed?.confirmedAt).not.toBeNull();

      const paid = await store.settlement.markCase({ ...key, status: 'PAID', txHash: '0xpaid' });
      expect(paid?.paidAt).not.toBeNull();
      expect(paid?.paidTxHash).toBe('0xpaid');
      expect(paid?.burnTxHash).toBeNull();

      const burned = await store.settlement.markCase({ ...key, status: 'BURNED', txHash: '0xburn' });
      expect(burned?.burnedAt).not.toBeNull();
      expect(burned?.burnTxHash).toBe('0xburn');
      // Bốn mốc cùng tồn tại: đó là điểm của mô hình bốn trạng thái, không phải hai.
      expect(burned?.notifiedAt).not.toBeNull();
      expect(burned?.confirmedAt).not.toBeNull();
      expect(burned?.paidAt).not.toBeNull();
      expect(burned?.paidTxHash).toBe('0xpaid');
    });

    it('truyền mã giao dịch cho bước không có giao dịch là lỗi lời gọi', async () => {
      const round = await openRound();
      await store.settlement.createCases({ roundId: round.id, rows: [settlementCase(WALLET_A)] });

      await expect(
        store.settlement.markCase({
          roundId: round.id,
          holderWallet: WALLET_A,
          status: 'CONFIRMED',
          txHash: '0xkhong-co-cot-nao-de-ghi',
        }),
      ).rejects.toBeInstanceOf(StoreUsageError);
    });

    it('hồ sơ trỏ vào đợt không tồn tại bị từ chối bằng ForeignKeyError', async () => {
      await expect(
        store.settlement.createCases({ roundId: randomUUID(), rows: [settlementCase(WALLET_A)] }),
      ).rejects.toBeInstanceOf(ForeignKeyError);
    });
  });

  // -------------------------------------------------------------------------
  //  7.4 — tiến trình hẹn giờ chạy trùng
  // -------------------------------------------------------------------------
  describe('mốc chạy tiến trình hẹn giờ', () => {
    it('chạy trùng (jobName, periodKey) bị từ chối (R4.2)', async () => {
      const jobName = `viec-${randomUUID()}`;
      await store.keeper.startRun({ jobName, periodKey: '2026-Q1' });

      await expect(
        store.keeper.startRun({ jobName, periodKey: '2026-Q1' }),
      ).rejects.toMatchObject({
        name: 'UniqueConstraintError',
        table: 'KeeperRun',
        columns: ['jobName', 'periodKey'],
      });
    });

    it('cùng công việc nhưng kỳ khác thì chạy được', async () => {
      const jobName = `viec-${randomUUID()}`;
      await store.keeper.startRun({ jobName, periodKey: '2026-Q1' });
      await expect(
        store.keeper.startRun({ jobName, periodKey: '2026-Q2' }),
      ).resolves.toMatchObject({ status: 'RUNNING' });
    });

    it('lần chạy thứ hai bị chặn KHÔNG làm đổi mốc của lần đầu', async () => {
      const jobName = `viec-${randomUUID()}`;
      const first = await store.keeper.startRun({ jobName, periodKey: '2026-Q1' });
      await store.keeper.finishRun({ id: first.id, status: 'SUCCESS' });

      await expect(store.keeper.startRun({ jobName, periodKey: '2026-Q1' })).rejects.toBeInstanceOf(
        UniqueConstraintError,
      );

      const found = await store.keeper.findRun({ jobName, periodKey: '2026-Q1' });
      expect(found?.id).toBe(first.id);
      expect(found?.status).toBe('SUCCESS');
    });
  });

  // -------------------------------------------------------------------------
  //  R1.4 — một mã giao dịch không gắn cho hai lệnh mua
  // -------------------------------------------------------------------------
  describe('lệnh mua', () => {
    const newOrder = () => ({
      chain: 'mock' as const,
      investorWallet: WALLET_A,
      wptAmount: '10',
      vndAmount: '120000',
      actorRole: 'INVESTOR' as const,
    });

    /** Đưa một lệnh tới EXECUTING theo đúng mô hình một chiều của BE-02. */
    const toExecuting = async (id: string) => {
      await store.orders.transitionOrder({ id, from: ['PLACED'], to: 'CHECKING' });
      await store.orders.transitionOrder({ id, from: ['CHECKING'], to: 'EXECUTING' });
    };

    it('hai lệnh không dùng chung một mã giao dịch (R1.4)', async () => {
      const first = await store.orders.createOrder(newOrder());
      const second = await store.orders.createOrder(newOrder());
      await toExecuting(first.id);
      await toExecuting(second.id);

      await store.orders.attachOrderTxHash({ id: first.id, txHash: '0xtrung' });

      await expect(
        store.orders.attachOrderTxHash({ id: second.id, txHash: '0xtrung' }),
      ).rejects.toMatchObject({
        name: 'UniqueConstraintError',
        table: 'PurchaseOrder',
        columns: ['txHash'],
      });

      expect((await store.orders.findOrder(second.id))?.txHash).toBeNull();
    });

    it('nhiều lệnh CHƯA có mã giao dịch cùng tồn tại — NULL không đụng ràng buộc', async () => {
      await store.orders.createOrder(newOrder());
      await store.orders.createOrder(newOrder());
      await store.orders.createOrder(newOrder());

      const rows = await store.orders.listOrders({ investorWallet: WALLET_A, status: 'PLACED' });
      expect(rows.length).toBeGreaterThanOrEqual(3);
      expect(rows.every((row) => row.txHash === null)).toBe(true);
    });

    it('chuyển trạng thái từ nguồn sai trả null và KHÔNG đổi gì (khoá lạc quan)', async () => {
      const order = await store.orders.createOrder(newOrder());

      const result = await store.orders.transitionOrder({
        id: order.id,
        from: ['EXECUTING'],
        to: 'COMPLETED',
      });

      expect(result).toBeNull();
      expect((await store.orders.findOrder(order.id))?.status).toBe('PLACED');
    });

    it('lời gọi thứ hai với cùng `from` bị chặn — đúng chỗ chặn gửi giao dịch hai lần', async () => {
      const order = await store.orders.createOrder(newOrder());

      const first = await store.orders.transitionOrder({
        id: order.id,
        from: ['PLACED'],
        to: 'CHECKING',
      });
      const second = await store.orders.transitionOrder({
        id: order.id,
        from: ['PLACED'],
        to: 'CHECKING',
      });

      expect(first?.status).toBe('CHECKING');
      expect(second).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  //  BE-04 — tham số hệ thống: mọi lần ghi phải kèm một dòng lịch sử
  // -------------------------------------------------------------------------
  describe('tham số hệ thống', () => {
    it('dữ liệu khởi tạo có giá phát hành và ngưỡng đổi giá', async () => {
      const price = await store.config.getConfig(CONFIG_KEYS.issuePriceVnd);
      const threshold = await store.config.getConfig(CONFIG_KEYS.priceChangeThreshold);

      // Không so với một con số gõ tay: con số nằm ở `lib/config/issue-terms.ts` và ca kiểm này
      // chỉ khẳng định "dòng khởi tạo có mặt, kiểu đọc được".
      expect(price?.type).toBe('bigint');
      expect(BigInt(price!.value)).toBeGreaterThan(0n);
      expect(threshold?.type).toBe('number');
      expect(Number(threshold!.value)).toBeGreaterThan(1);
    });

    it('khoá chưa cấu hình trả null, KHÔNG phải lỗi', async () => {
      expect(await store.config.getConfig(`khong.ton.tai.${randomUUID()}`)).toBeNull();
    });

    /**
     * Đây là phát biểu chính của cổng này: một lần ghi = một giá trị mới + một dòng lịch sử.
     * Thiếu dòng lịch sử thì sổ kiểm toán mất đúng lần đổi giá vừa xảy ra.
     */
    it('ghi giá trị mới kèm MỘT dòng lịch sử, giữ được giá trị cũ', async () => {
      const key = `test.gia.${randomUUID()}`;

      await store.config.setConfig({ key, value: '100', type: 'bigint', changedBy: 'BANK_ADMIN' });
      await store.config.setConfig({
        key,
        value: '250',
        type: 'bigint',
        changedBy: 'BANK_ADMIN',
        reason: 'điều chỉnh đợt hai',
      });

      expect((await store.config.getConfig(key))?.value).toBe('250');

      const history = await store.config.listConfigHistory({ key });
      expect(history).toHaveLength(2);

      /**
       * Tra theo NỘI DUNG, không theo VỊ TRÍ trong danh sách.
       *
       * Hai lần ghi liền nhau có thể trùng mốc thời gian tới từng phần nghìn giây, và khi trùng
       * thì cả hai bản hiện thực phá thế bằng `id` — một uuid ngẫu nhiên, không phải thứ tự chèn.
       * Ca kiểm dựa vào `history[0]` vì vậy đỏ tuỳ lần chạy (đã gặp thật). Thứ cần khẳng định ở
       * đây là "mỗi lần ghi có đúng một dòng, và dòng đó mang đúng giá trị cũ", không phải thứ tự.
       */
      const second = history.find((entry) => entry.newValue === '250');
      const first = history.find((entry) => entry.newValue === '100');

      expect(second).toMatchObject({ oldValue: '100', reason: 'điều chỉnh đợt hai' });
      // Lần ĐẦU cho một khoá thì không có giá trị cũ — `null`, không phải '' hay '0'.
      expect(first).toMatchObject({ oldValue: null });
    });

    it('kiểu tham số lạ bị chặn TRƯỚC khi ghi gì', async () => {
      const key = `test.kieu.${randomUUID()}`;
      await expect(
        // @ts-expect-error — giá trị ngoài CONFIG_VALUE_TYPES.
        store.config.setConfig({ key, value: '1', type: 'chuoi', changedBy: 'BANK_ADMIN' }),
      ).rejects.toBeInstanceOf(InvalidStatusError);

      expect(await store.config.getConfig(key)).toBeNull();
      expect(await store.config.listConfigHistory({ key })).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  //  BE-04 — dự án: tổng cung và khoá lạc quan chống phát hành hai lần
  // -------------------------------------------------------------------------
  describe('dự án đã token hoá', () => {
    const newProject = (tokenSymbol: string) => ({
      tokenSymbol,
      name: 'Dự án kiểm thử',
      totalSupply: '1000',
      chain: 'mock' as const,
    });

    it('dữ liệu khởi tạo có dự án WPT ở DRAFT, đúng tổng cung của nguồn duy nhất', async () => {
      const project = await store.projects.findProject({
        tokenSymbol: WPT_TOKEN_SYMBOL,
        chain: SEED_PROJECT.chain,
      });

      expect(project, 'dữ liệu khởi tạo phải có dự án WPT').not.toBeNull();
      expect(project?.status).toBe('DRAFT');
      expect(project?.issuedAt).toBeNull();
      // Đọc từ nguồn duy nhất, không gõ lại 20.000.000 ở đây.
      expect(project?.totalSupply).toBe(String(WPT_TOTAL_SUPPLY));
    });

    it('hai dự án cùng mã token bị chặn bởi ràng buộc duy nhất', async () => {
      const symbol = `T${randomUUID().slice(0, 6)}`;
      await store.projects.createProject(newProject(symbol));

      await expect(store.projects.createProject(newProject(symbol))).rejects.toBeInstanceOf(
        UniqueConstraintError,
      );
    });

    /**
     * Ràng buộc quan trọng nhất của bảng này: phát hành nguồn cung lần thứ hai phải trượt.
     *
     * Kiểm qua `markIssued` chứ không qua "đọc rồi ghi": điều kiện nằm trong chính câu UPDATE,
     * nên hai lời gọi liên tiếp chỉ một lời gọi đổi được — và lời gọi kia nhận `null` để tầng
     * nghiệp vụ biết phải dừng.
     */
    it('markIssued lần hai trả null, không đổi gì thêm', async () => {
      const symbol = `T${randomUUID().slice(0, 6)}`;
      const project = await store.projects.createProject(newProject(symbol));
      const firstAt = new Date().toISOString();

      const issued = await store.projects.markIssued({ id: project.id, issuedAt: firstAt });
      expect(issued?.status).toBe('ISSUED');
      expect(issued?.issuedAt).not.toBeNull();

      const again = await store.projects.markIssued({
        id: project.id,
        issuedAt: new Date(Date.now() + 60_000).toISOString(),
      });
      expect(again, 'lần hai KHÔNG được đổi dòng nào').toBeNull();

      // Mốc phát hành vẫn là mốc của lần ĐẦU.
      const after = await store.projects.findProject({ tokenSymbol: symbol, chain: 'mock' });
      expect(after?.issuedAt).toBe(issued?.issuedAt);
    });

    it('tổng cung sai dạng bị từ chối ở cổng', async () => {
      await expect(
        store.projects.createProject({ ...newProject(`T${randomUUID().slice(0, 6)}`), totalSupply: '1.5' }),
      ).rejects.toBeInstanceOf(StoreUsageError);
    });

    it('trạng thái dự án lạ bị từ chối', async () => {
      await expect(
        store.projects.createProject({
          ...newProject(`T${randomUUID().slice(0, 6)}`),
          // @ts-expect-error — giá trị ngoài PROJECT_STATUSES.
          status: 'DANG_PHAT_HANH',
        }),
      ).rejects.toBeInstanceOf(InvalidStatusError);
    });
  });

  // -------------------------------------------------------------------------
  //  7.6 — chỉ giá trị trạng thái hợp lệ được ghi
  // -------------------------------------------------------------------------
  describe('7.6 — chỉ trạng thái hợp lệ được ghi', () => {
    /**
     * Cột trạng thái là `String` chứ không phải enum của Postgres (QĐ-4), nên cơ sở dữ liệu
     * KHÔNG tự chặn. Đây là ca kiểm bù lại cho đánh đổi đó, và nó phải xanh ở cả hai bản.
     */
    it('lệnh mua từ chối trạng thái lạ', async () => {
      await expect(
        store.orders.createOrder({
          chain: 'mock',
          investorWallet: WALLET_A,
          wptAmount: '10',
          vndAmount: '120000',
          actorRole: 'INVESTOR',
          // @ts-expect-error — cố tình truyền giá trị ngoài danh sách để kiểm chốt chặn lúc chạy.
          status: 'PAID_PENDING_TOKEN',
        }),
      ).rejects.toBeInstanceOf(InvalidStatusError);
    });

    it('kỳ chia từ chối trạng thái lạ', async () => {
      await expect(
        store.distribution.openPeriod({
          periodKey: `ky-${randomUUID()}`,
          snapshotId: 1,
          totalAmount: '1',
          totalSupplyAt: '1',
          chain: 'mock',
          // @ts-expect-error — giá trị ngoài DISTRIBUTION_PERIOD_STATUSES.
          status: 'DANG_CHIA',
        }),
      ).rejects.toBeInstanceOf(InvalidStatusError);
    });

    it('đợt tất toán từ chối trạng thái lạ', async () => {
      await expect(
        store.settlement.openRound({
          snapshotId: 1,
          navRate: '1',
          chain: 'mock',
          // @ts-expect-error — giá trị ngoài SETTLEMENT_ROUND_STATUSES.
          status: 'DANG_CHOT',
        }),
      ).rejects.toBeInstanceOf(InvalidStatusError);
    });

    it('mốc chạy từ chối trạng thái lạ', async () => {
      const run = await store.keeper.startRun({
        jobName: `viec-${randomUUID()}`,
        periodKey: '2026-Q1',
      });
      await expect(
        // @ts-expect-error — giá trị ngoài KEEPER_RUN_STATUSES.
        store.keeper.finishRun({ id: run.id, status: 'DONE' }),
      ).rejects.toBeInstanceOf(InvalidStatusError);
    });

    it('lỗi nêu đủ danh sách giá trị được phép', async () => {
      await expect(
        store.settlement.openRound({
          snapshotId: 1,
          navRate: '1',
          chain: 'mock',
          // @ts-expect-error — giá trị ngoài SETTLEMENT_ROUND_STATUSES.
          status: 'XONG',
        }),
      ).rejects.toMatchObject({
        allowed: ['INITIATED', 'IN_PROGRESS', 'COMPLETED'],
      });
    });

    it('trạng thái lạ bị chặn TRƯỚC khi ghi gì', async () => {
      const periodKey = `ky-${randomUUID()}`;
      await expect(
        store.distribution.openPeriod({
          periodKey,
          snapshotId: 1,
          totalAmount: '1',
          totalSupplyAt: '1',
          chain: 'mock',
          // @ts-expect-error — giá trị ngoài danh sách.
          status: 'KHONG_CO',
        }),
      ).rejects.toBeInstanceOf(InvalidStatusError);

      expect(await store.distribution.findPeriodByKey(periodKey)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  //  Số tiền và mã snapshot — chặn ở cổng vì Postgres và bộ nhớ khác nhau
  // -------------------------------------------------------------------------
  describe('kiểm dữ liệu vào', () => {
    it.each([['12.5'], ['-1'], ['1e30'], [''], ['abc']])(
      'số tiền "%s" bị từ chối',
      async (amount) => {
        await expect(
          store.orders.createOrder({
            chain: 'mock',
            investorWallet: WALLET_A,
            wptAmount: amount,
            vndAmount: '1',
            actorRole: 'INVESTOR',
          }),
        ).rejects.toBeInstanceOf(StoreUsageError);
      },
    );

    it('số tiền quá 78 chữ số bị từ chối (giới hạn Decimal(78,0))', async () => {
      await expect(
        store.orders.createOrder({
          chain: 'mock',
          investorWallet: WALLET_A,
          wptAmount: '1'.repeat(79),
          vndAmount: '1',
          actorRole: 'INVESTOR',
        }),
      ).rejects.toBeInstanceOf(StoreUsageError);
    });

    it.each([[0], [-1], [1.5]])('snapshotId %s bị từ chối', async (snapshotId) => {
      await expect(
        store.settlement.openRound({ snapshotId, navRate: '1', chain: 'mock' }),
      ).rejects.toBeInstanceOf(StoreUsageError);
    });

    it('lô rỗng bị từ chối', async () => {
      const round = await store.settlement.openRound({
        snapshotId: 1,
        navRate: '1',
        chain: 'mock',
      });
      await expect(
        store.settlement.createCases({ roundId: round.id, rows: [] }),
      ).rejects.toBeInstanceOf(StoreUsageError);
    });

    it(`lô quá ${MAX_BULK_ROWS} dòng bị từ chối kèm hướng dẫn chia lô`, async () => {
      const round = await store.settlement.openRound({
        snapshotId: 1,
        navRate: '1',
        chain: 'mock',
      });
      const rows = Array.from({ length: MAX_BULK_ROWS + 1 }, (_, index) => ({
        holderWallet: `0x${index.toString(16).padStart(40, '0')}`,
        wptAmount: '1',
        payoutAmount: '1',
      }));

      await expect(
        store.settlement.createCases({ roundId: round.id, rows }),
      ).rejects.toThrow(/chia lô/i);
    });
  });
});

// ===========================================================================
//  LỚP 3 — BẢN POSTGRES QUY LỖI DRIVER VỀ CÙNG LỚP LỖI
// ===========================================================================

/** Lỗi đúng hình dạng `pg` ném ra khi vi phạm ràng buộc. */
function pgError(code: string, constraint: string): Error {
  return Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code,
    constraint,
  });
}

interface Recorder {
  query: PgQuery;
  calls: Array<{ sql: string; params: unknown[] }>;
}

/** Hàm truy vấn giả: ghi lại lời gọi, trả về `rows` hoặc ném `error`. */
function recorder(options: { rows?: object[]; error?: Error } = {}): Recorder {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = (async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (options.error) throw options.error;
    return options.rows ?? [];
  }) as unknown as PgQuery;
  return { query, calls };
}

describe('lớp 3 — bản Postgres quy lỗi ràng buộc về lớp lỗi của tầng cổng', () => {
  it.each(Object.entries(UNIQUE_CONSTRAINTS))(
    'lỗi 23505 của ràng buộc %s thành UniqueConstraintError đúng bảng/cột',
    async (name, { table, columns }) => {
      await expect(
        mapPgConstraintError(() => Promise.reject(pgError('23505', name))),
      ).rejects.toMatchObject({ name: 'UniqueConstraintError', table, columns });
    },
  );

  it.each(Object.entries(FOREIGN_KEYS))(
    'lỗi 23503 của khoá ngoài %s thành ForeignKeyError',
    async (name, { table, column }) => {
      await expect(
        mapPgConstraintError(() => Promise.reject(pgError('23503', name))),
      ).rejects.toMatchObject({ name: 'ForeignKeyError', table, column });
    },
  );

  it('ràng buộc chưa khai vẫn thành UniqueConstraintError, kèm chỉ dẫn bổ sung', async () => {
    // Vẫn phải là UniqueConstraintError: nghiệp vụ bắt theo LỚP lỗi, và một ràng buộc mới
    // chưa kịp khai không được biến thành lỗi lạ mà nghiệp vụ không xử lý.
    await expect(
      mapPgConstraintError(() => Promise.reject(pgError('23505', 'Bang_moi_cot_key'))),
    ).rejects.toThrow(/UNIQUE_CONSTRAINTS/);
  });

  it('lỗi khác được ném lại NGUYÊN VẸN, không bị bọc thành lỗi ràng buộc', async () => {
    const original = Object.assign(new Error('connection terminated'), { code: '08006' });
    await expect(mapPgConstraintError(() => Promise.reject(original))).rejects.toBe(original);
  });

  it('startRun chèn thẳng, KHÔNG đọc trước — chống chạy trùng dựa vào ràng buộc', async () => {
    const rows = [
      {
        id: 'r1',
        jobName: 'j',
        periodKey: '2026-Q1',
        startedAt: new Date(),
        finishedAt: null,
        status: 'RUNNING',
        error: null,
      },
    ];
    const spy = recorder({ rows });
    await createPostgresKeeperStore(spy.query).startRun({ jobName: 'j', periodKey: '2026-Q1' });

    // Đúng MỘT câu lệnh, và là INSERT. Có thêm một SELECT nghĩa là quay lại lối "đọc rồi
    // ghi" mà hai instance cùng vượt qua được.
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].sql).toMatch(/^\s*INSERT INTO "KeeperRun"/);
    expect(spy.calls[0].sql).not.toMatch(/SELECT/i);
  });

  it('transitionOrder đặt điều kiện trạng thái TRONG câu UPDATE', async () => {
    const spy = recorder({ rows: [] });
    await createPostgresOrderStore(spy.query).transitionOrder({
      id: 'o1',
      from: ['PLACED', 'CHECKING'],
      to: 'EXECUTING',
    });

    expect(spy.calls).toHaveLength(1);
    const { sql, params } = spy.calls[0];
    expect(sql).toMatch(/UPDATE "PurchaseOrder"/);
    // Điều kiện nằm trong chính câu cập nhật -> cơ sở dữ liệu làm trọng tài, nguyên tử.
    expect(sql).toMatch(/WHERE "id" = \$1 AND "status" = ANY\(\$\d+::text\[\]\)/);
    expect(params).toContain('o1');
    expect(params).toContainEqual(['PLACED', 'CHECKING']);
  });

  it('bản Postgres từ chối trạng thái lạ TRƯỚC khi gửi câu lệnh nào', async () => {
    const spy = recorder({ rows: [] });
    await expect(
      createPostgresOrderStore(spy.query).transitionOrder({
        id: 'o1',
        from: ['PLACED'],
        // @ts-expect-error — giá trị ngoài ORDER_STATUSES.
        to: 'DA_TRA_TIEN',
      }),
    ).rejects.toBeInstanceOf(InvalidStatusError);

    expect(spy.calls).toHaveLength(0);
  });

  it('createPayouts dồn cả lô vào MỘT câu INSERT (lô nguyên tử)', async () => {
    const spy = recorder({ rows: [] });
    await createPostgresDistributionStore(spy.query)
      .createPayouts({
        periodId: 'p1',
        rows: [
          { investorWallet: WALLET_A, balanceAt: '1', amount: '1' },
          { investorWallet: WALLET_B, balanceAt: '2', amount: '2' },
        ],
      })
      .catch(() => {
        // Hàm giả trả 0 dòng nên bước ghép kết quả sẽ báo lệch lược đồ — không phải điều
        // đang kiểm ở đây. Điều đang kiểm là SỐ câu lệnh đã gửi.
      });

    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0].sql).toMatch(/INSERT INTO "DistributionPayout"/);
    // Hai bộ VALUES trong cùng một câu lệnh.
    expect(spy.calls[0].sql.match(/gen_random_uuid\(\)::text/g)).toHaveLength(2);
  });

  it('markCase chỉ ghi cột mã giao dịch của đúng bước đó', async () => {
    const spy = recorder({ rows: [] });
    const store = createPostgresSettlementStore(spy.query);

    await store.markCase({ roundId: 'r1', holderWallet: WALLET_A, status: 'PAID', txHash: '0x1' });
    expect(spy.calls[0].sql).toContain('"paidAt" = CURRENT_TIMESTAMP');
    expect(spy.calls[0].sql).toContain('"paidTxHash" = $4');
    expect(spy.calls[0].sql).not.toContain('burnTxHash');

    await store.markCase({ roundId: 'r1', holderWallet: WALLET_A, status: 'BURNED', txHash: '0x2' });
    expect(spy.calls[1].sql).toContain('"burnedAt" = CURRENT_TIMESTAMP');
    expect(spy.calls[1].sql).toContain('"burnTxHash" = $4');
  });

  it('mọi giá trị đi vào câu lệnh dưới dạng tham số, không nội suy vào SQL', async () => {
    const spy = recorder({ rows: [] });
    const hostile = "0x'; DROP TABLE \"PurchaseOrder\"; --";

    await createPostgresOrderStore(spy.query).listOrders({ investorWallet: hostile });

    expect(spy.calls[0].sql).not.toContain('DROP TABLE');
    expect(spy.calls[0].params).toContain(hostile);
  });
});

afterAll(() => {
  // Trả env về nguyên trạng: các test khác đọc `serverEnv()` và không được thấy
  // USE_MOCK_DB=false do backend Postgres đặt vào.
  if (process.env.TEST_DATABASE_URL) {
    delete process.env.DATABASE_URL;
    delete process.env.USE_MOCK_DB;
    resetServerEnvCache();
  }
});
