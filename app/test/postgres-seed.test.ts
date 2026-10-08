import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { resetServerEnvCache } from '@/lib/config/env';
import { configuredProjectSeeds } from '@/lib/store/configured-seed-data';
import { pgQuery, seedInitialData } from '@/lib/store/postgres.pool';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousUseMockDb = process.env.USE_MOCK_DB;
const previousEnableSepoliaDemoProject = process.env.ENABLE_SEPOLIA_DEMO_PROJECT;

describe.skipIf(!TEST_DATABASE_URL)('Postgres seed dự án', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.USE_MOCK_DB = 'false';
    process.env.ENABLE_SEPOLIA_DEMO_PROJECT = 'true';
    resetServerEnvCache();
    await pgQuery('SELECT 1');
  });

  afterAll(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousUseMockDb === undefined) delete process.env.USE_MOCK_DB;
    else process.env.USE_MOCK_DB = previousUseMockDb;
    if (previousEnableSepoliaDemoProject === undefined) {
      delete process.env.ENABLE_SEPOLIA_DEMO_PROJECT;
    } else {
      process.env.ENABLE_SEPOLIA_DEMO_PROJECT = previousEnableSepoliaDemoProject;
    }
    resetServerEnvCache();
  });

  it('cập nhật contractAddress trước phát hành nhưng giữ nguyên sau phát hành', async () => {
    const project = configuredProjectSeeds().find(
      (row) => row.chain === 'evm' && row.contractAddress,
    );
    expect(project?.contractAddress).toBeTruthy();

    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE "Project"
         SET "contractAddress" = '0x0000000000000000000000000000000000000001',
             "issuedAt" = NULL
         WHERE "tokenSymbol" = $1 AND "chain" = $2`,
        [project!.tokenSymbol, project!.chain],
      );

      await seedInitialData(client);
      const beforeIssuance = await client.query<{ contractAddress: string }>(
        `SELECT "contractAddress" FROM "Project"
         WHERE "tokenSymbol" = $1 AND "chain" = $2`,
        [project!.tokenSymbol, project!.chain],
      );
      expect(beforeIssuance.rows[0]?.contractAddress).toBe(project!.contractAddress);

      const lockedAddress = '0x0000000000000000000000000000000000000002';
      await client.query(
        `UPDATE "Project"
         SET "contractAddress" = $3, "issuedAt" = CURRENT_TIMESTAMP
         WHERE "tokenSymbol" = $1 AND "chain" = $2`,
        [project!.tokenSymbol, project!.chain, lockedAddress],
      );

      await seedInitialData(client);
      const afterIssuance = await client.query<{ contractAddress: string }>(
        `SELECT "contractAddress" FROM "Project"
         WHERE "tokenSymbol" = $1 AND "chain" = $2`,
        [project!.tokenSymbol, project!.chain],
      );
      expect(afterIssuance.rows[0]?.contractAddress).toBe(lockedAddress);
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  });
});
