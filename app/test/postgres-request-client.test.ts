import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeClient = {
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
};

const fake = vi.hoisted(() => ({
  clients: [] as FakeClient[],
  currentContext: {} as object,
  failBusinessQuery: undefined as string | undefined,
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: { HYPERDRIVE: { connectionString: 'postgresql://worker/request-client' } },
    ctx: fake.currentContext,
    cf: undefined,
  }),
}));

vi.mock('pg', () => ({
  Client: class {
    connect = vi.fn(async () => {});
    end = vi.fn(async () => {});
    on = vi.fn(() => this);
    query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_class')) return { rows: [{ ready: true }] };
      if (fake.failBusinessQuery && sql === fake.failBusinessQuery) {
        fake.failBusinessQuery = undefined;
        throw Object.assign(new Error('socket reset'), { code: 'ECONNRESET' });
      }
      return { rows: [{ value: 1 }] };
    });
    constructor() { fake.clients.push(this); }
  },
}));

async function loadWarmModule() {
  const pool = await import('@/lib/store/postgres.pool');
  fake.currentContext = {};
  await pool.pgQuery('SELECT warmup');
  fake.clients = [];
  return pool;
}

beforeEach(() => {
  vi.resetModules();
  fake.clients = [];
  fake.currentContext = {};
  fake.failBusinessQuery = undefined;
  vi.stubEnv('ENABLE_READ_DIAGNOSTICS', 'false');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Postgres Client theo request Cloudflare', () => {
  it('năm pgQuery song song trong một request chỉ tạo một Client', async () => {
    const { pgQuery } = await loadWarmModule();
    fake.currentContext = {};

    await Promise.all(Array.from({ length: 5 }, () => pgQuery('SELECT business')));

    expect(fake.clients).toHaveLength(1);
    expect(fake.clients[0]!.connect).toHaveBeenCalledTimes(1);
    expect(fake.clients[0]!.query).toHaveBeenCalledTimes(5);
    expect(fake.clients[0]!.end).not.toHaveBeenCalled();
  });

  it('hai ExecutionContext khác nhau không dùng chung Client', async () => {
    const { pgQuery } = await loadWarmModule();
    const requestA = {};
    const requestB = {};

    fake.currentContext = requestA;
    const queriesA = Array.from({ length: 5 }, () => pgQuery('SELECT request_a'));
    fake.currentContext = requestB;
    const queriesB = Array.from({ length: 5 }, () => pgQuery('SELECT request_b'));
    await Promise.all([...queriesA, ...queriesB]);

    expect(fake.clients).toHaveLength(2);
    expect(fake.clients.map((client) => client.query.mock.calls.length)).toEqual([5, 5]);
  });

  it('pgTransaction luôn dùng Client riêng với pgQuery cùng request', async () => {
    const { pgQuery, pgTransaction } = await loadWarmModule();
    fake.currentContext = {};

    const reads = Promise.all(Array.from({ length: 5 }, () => pgQuery('SELECT outside')));
    const transaction = pgTransaction(async (run) => run('SELECT inside'));
    await Promise.all([reads, transaction]);

    expect(fake.clients).toHaveLength(2);
    const statements = fake.clients.map((client) =>
      client.query.mock.calls.map(([sql]) => sql),
    );
    expect(statements).toContainEqual(Array(5).fill('SELECT outside'));
    expect(statements).toContainEqual(['BEGIN', 'SELECT inside', 'COMMIT']);
  });

  it('kết nối chung lỗi thì pgQuery tiếp theo trong request mở Client mới', async () => {
    const { pgQuery } = await loadWarmModule();
    fake.currentContext = {};

    await pgQuery('SELECT first');
    fake.failBusinessQuery = 'SELECT broken';
    await expect(pgQuery('SELECT broken')).rejects.toMatchObject({ code: 'ECONNRESET' });
    await expect(pgQuery('SELECT recovered')).resolves.toEqual([{ value: 1 }]);

    expect(fake.clients).toHaveLength(2);
  });
});
