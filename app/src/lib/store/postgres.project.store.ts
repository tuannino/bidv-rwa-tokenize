import 'server-only';

import type { ChainKey } from '@bidv/shared';
import {
  assertProjectStatus,
  type IProjectStore,
  type NewProject,
  type ProjectRecord,
  type ProjectStatus,
} from './project.store.port';
import { pgQuery, type PgQuery } from './postgres.pool';
import { assertAmount, mapPgConstraintError } from './store.errors';

/**
 * Dự án đã token hoá, trong Postgres (`USE_MOCK_DB=false`).
 *
 * Mọi GIÁ TRỊ đi vào câu lệnh dưới dạng tham số `$n`. Không có tên cột nào đến từ input.
 */

interface ProjectRow {
  id: string;
  tokenSymbol: string;
  name: string;
  /** `pg` trả `numeric` về dạng chuỗi — đúng thứ ta cần. */
  totalSupply: string;
  status: string;
  chain: string;
  contractAddress: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const toProject = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  tokenSymbol: row.tokenSymbol,
  name: row.name,
  totalSupply: row.totalSupply,
  status: row.status as ProjectStatus,
  chain: row.chain as ChainKey,
  contractAddress: row.contractAddress,
  issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export function createPostgresProjectStore(query: PgQuery = pgQuery): IProjectStore {
  return {
    kind: 'prisma',

    async createProject(project: NewProject): Promise<ProjectRecord> {
      const rows = await mapPgConstraintError(() =>
        query<ProjectRow>(
          `INSERT INTO "Project"
             ("id","tokenSymbol","name","totalSupply","status","chain","contractAddress","updatedAt")
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            project.tokenSymbol,
            project.name,
            assertAmount('totalSupply', project.totalSupply),
            assertProjectStatus(project.status ?? 'DRAFT'),
            project.chain,
            project.contractAddress ?? null,
          ],
        ),
      );
      return toProject(rows[0]);
    },

    async findProject({ tokenSymbol, chain }) {
      const rows = await query<ProjectRow>(
        `SELECT * FROM "Project" WHERE "tokenSymbol" = $1 AND "chain" = $2`,
        [tokenSymbol, chain],
      );
      return rows[0] ? toProject(rows[0]) : null;
    },

    async markIssued({ id, issuedAt, contractAddress }) {
      const params: unknown[] = [id, issuedAt, 'ISSUED' satisfies ProjectStatus];
      const sets = [
        '"status" = $3',
        '"issuedAt" = $2::timestamptz',
        '"updatedAt" = CURRENT_TIMESTAMP',
      ];
      // `undefined` = không chạm cột; `null` = xoá giá trị cũ. Dựng SET động để phân biệt được —
      // `COALESCE($n, "col")` thì không xoá được.
      if (contractAddress !== undefined) {
        params.push(contractAddress);
        sets.push(`"contractAddress" = $${params.length}`);
      }
      params.push('DRAFT' satisfies ProjectStatus);

      // Điều kiện nằm TRONG câu UPDATE: cơ sở dữ liệu làm trọng tài, nên hai lời gọi đồng thời
      // chỉ một bên đổi được. Đọc `issuedAt` rồi mới ghi thì cả hai đều thấy `null`, đều kết
      // luận "chưa phát hành", và nguồn cung ra gấp đôi con số đã công bố.
      const rows = await mapPgConstraintError(() =>
        query<ProjectRow>(
          `UPDATE "Project" SET ${sets.join(', ')}
            WHERE "id" = $1 AND "status" = $${params.length} AND "issuedAt" IS NULL
            RETURNING *`,
          params,
        ),
      );
      return rows[0] ? toProject(rows[0]) : null;
    },

    async listProjects(options = {}) {
      const { chain, status, limit = 50 } = options;
      const rows = await query<ProjectRow>(
        `SELECT * FROM "Project"
          WHERE ($1::text IS NULL OR "chain" = $1)
            AND ($2::text IS NULL OR "status" = $2)
          ORDER BY "createdAt" DESC, "id" DESC
          LIMIT $3`,
        [chain ?? null, status ?? null, limit],
      );
      return rows.map(toProject);
    },
  };
}
