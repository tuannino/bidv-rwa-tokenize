import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  clients: [] as Array<{ id: number; query: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }>,
  beforeQuery: undefined as undefined | ((id: number, sql: string) => Promise<void>),
}));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => { throw new Error('Node test'); } }));
vi.mock('pg', () => ({
  Client: class {
    id = fake.clients.length;
    connect = vi.fn(async () => {});
    end = vi.fn(async () => {});
    query = vi.fn(async (sql: string) => {
      await fake.beforeQuery?.(this.id, sql);
      return { rows: sql.includes('pg_class') ? [{ ready: true }] : [{ value: 1 }] };
    });
    constructor() { fake.clients.push(this); }
  },
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const catalogs = () => fake.clients.flatMap((client) => client.query.mock.calls).filter(([sql]) => sql.includes('pg_class'));

async function within<T>(promise: Promise<T>): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('B chờ A')), 300); }),
    ]);
  } finally { clearTimeout(timer); }
}

beforeEach(() => {
  vi.resetModules(); fake.clients = []; fake.beforeQuery = undefined;
  vi.stubEnv('DATABASE_URL', 'postgresql://bidv:bidv@localhost:5432/init_test');
  vi.stubEnv('ENABLE_READ_DIAGNOSTICS', 'false');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('khởi tạo Postgres không chờ I/O của lượt khác', () => {
  it('A chưa xong nhưng B vẫn đọc được bằng Client riêng', async () => {
    vi.stubEnv('ENABLE_READ_DIAGNOSTICS', 'true');
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const gate = deferred(); const started = deferred();
    fake.beforeQuery = async (id, sql) => {
      if (id === 0 && sql.includes('pg_class')) { started.resolve(); await gate.promise; }
    };
    const { pgQuery } = await import('@/lib/store/postgres.pool');
    const { traceRead } = await import('@/lib/diagnostics/read-trace');
    const idA = '12345678-1234-4234-8234-123456789012';
    const idB = 'abcdef12-1234-4234-8234-123456789012';
    const first = traceRead(idA, () => pgQuery('SELECT 1'));
    await started.promise;
    try {
      // B phải hoàn tất TRƯỚC khi mở gate A. Cách cũ sẽ hết hạn chính ca này.
      await expect(within(traceRead(idB, () => pgQuery('SELECT 1')))).resolves.toEqual([{ value: 1 }]);
      expect(catalogs()).toHaveLength(2);
      expect(fake.clients[0]!.end).not.toHaveBeenCalled();
      const rows = log.mock.calls.map(([value]) => JSON.parse(value)).filter((row) => row.stage === 'db.schema.verify');
      expect(rows.filter((row) => row.state === 'start').map((row) => row.id)).toEqual([idA, idB]);
      expect(rows.filter((row) => row.state === 'ok').map((row) => row.id)).toEqual([idB]);
    } finally { gate.resolve(); await first; }
    expect(fake.clients.every((client) => client.end.mock.calls.length === 1)).toBe(true);
  }, 1_000);

  it('khởi tạo lỗi thì lượt sau thử lại, thành công rồi không kiểm lại', async () => {
    fake.beforeQuery = async (id, sql) => {
      if (id === 0 && sql.includes('pg_class')) throw new Error('init failed');
    };
    const { pgQuery } = await import('@/lib/store/postgres.pool');
    await expect(pgQuery('SELECT 1')).rejects.toThrow('init failed');
    await expect(pgQuery('SELECT 1')).resolves.toEqual([{ value: 1 }]);
    await pgQuery('SELECT 1');
    expect(catalogs()).toHaveLength(2);
    expect(fake.clients.every((client) => client.end.mock.calls.length === 1)).toBe(true);
  });

  it('A lỗi muộn không xoá trạng thái thành công của B', async () => {
    const gate = deferred(); const started = deferred();
    fake.beforeQuery = async (id, sql) => {
      if (id === 0 && sql.includes('pg_class')) { started.resolve(); await gate.promise; }
    };
    const { pgQuery } = await import('@/lib/store/postgres.pool');
    const first = pgQuery('SELECT 1'); const failure = expect(first).rejects.toThrow('late failure');
    await started.promise;
    try { await within(pgQuery('SELECT 1')); }
    finally { gate.reject(new Error('late failure')); await failure; }
    await pgQuery('SELECT 1');
    expect(catalogs()).toHaveLength(2);
  }, 1_000);

  it('chưa cache trước COMMIT, cache thành công gắn với chuỗi kết nối', async () => {
    const gate = deferred(); const started = deferred();
    fake.beforeQuery = async (id, sql) => {
      if (id === 0 && sql === 'COMMIT') { started.resolve(); await gate.promise; }
    };
    const { pgQuery } = await import('@/lib/store/postgres.pool');
    const first = pgQuery('SELECT 1'); await started.promise;
    try { await within(pgQuery('SELECT 1')); }
    finally { gate.resolve(); await first; }
    expect(catalogs()).toHaveLength(2);
    const { resetServerEnvCache } = await import('@/lib/config/env');
    vi.stubEnv('DATABASE_URL', 'postgresql://bidv:bidv@localhost:5432/other_db'); resetServerEnvCache();
    await pgQuery('SELECT 1'); expect(catalogs()).toHaveLength(3);
    vi.stubEnv('DATABASE_URL', 'postgresql://bidv:bidv@localhost:5432/init_test'); resetServerEnvCache();
    await pgQuery('SELECT 1'); expect(catalogs()).toHaveLength(3);
  }, 1_000);

  it('trace db.schema.verify chỉ đếm lượt thực sự khởi tạo và giữ đúng id', async () => {
    vi.stubEnv('ENABLE_READ_DIAGNOSTICS', 'true');
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { pgQuery } = await import('@/lib/store/postgres.pool');
    const { traceRead } = await import('@/lib/diagnostics/read-trace');
    const id = '12345678-1234-4234-8234-123456789012';
    await traceRead(id, () => pgQuery('SELECT 1'));
    await traceRead(id, () => pgQuery('SELECT 1'));
    const rows = log.mock.calls.map(([value]) => JSON.parse(value)).filter((row) => row.stage === 'db.schema.verify');
    expect(rows.map((row) => row.state)).toEqual(['start', 'ok']);
    expect(rows.every((row) => row.id === id && typeof row.ms === 'number')).toBe(true);
  });
});
