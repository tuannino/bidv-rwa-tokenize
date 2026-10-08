import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INIT_SQL } from '@/lib/store/init-sql.generated';

describe('OP-06 — lược đồ Postgres nhúng trong Worker', () => {
  it('trùng từng byte với prisma/init.sql', () => {
    const source = readFileSync(path.resolve(__dirname, '../prisma/init.sql'), 'utf8');
    expect(Buffer.from(INIT_SQL)).toEqual(Buffer.from(source));
  });
});
