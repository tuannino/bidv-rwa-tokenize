import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ChainKey } from '@bidv/shared';
import { memoryState } from './memory.state';
import {
  assertProjectStatus,
  type IProjectStore,
  type NewProject,
  type ProjectRecord,
} from './project.store.port';
import { configuredProjectSeeds } from './configured-seed-data';
import { assertAmount, UniqueConstraintError } from './store.errors';

/**
 * Dự án đã token hoá, trong bộ nhớ — mặc định, chạy được ở free-tier.
 *
 * ⚠️ Bản này phải NGHIÊM NGẶT NGANG bản Postgres (BE-09 QĐ-3), kể cả ràng buộc duy nhất
 * `Project_tokenSymbol_key`: bản bộ nhớ cho tạo hai dự án cùng mã token thì demo free-tier
 * chạy được một luồng mà demo VPS từ chối.
 *
 * Dữ liệu khởi tạo nạp từ `seed-data.ts` — CÙNG nguồn với bản Postgres.
 */

interface ProjectState {
  projects: ProjectRecord[];
}

const state = (): ProjectState =>
  memoryState('project', () => {
    const now = new Date().toISOString();
    return {
      projects: configuredProjectSeeds().map((seed) => ({
        id: randomUUID(),
        tokenSymbol: seed.tokenSymbol,
        name: seed.name,
        totalSupply: assertAmount('totalSupply', seed.totalSupply),
        status: assertProjectStatus(seed.status),
        chain: seed.chain,
        contractAddress: seed.contractAddress ?? null,
        issuedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
    };
  });

/**
 * Ràng buộc `Project_tokenSymbol_chain_key`: một mã token chỉ có MỘT dòng TRÊN MỘT CHUỖI.
 *
 * Kiểm cả `chain`, không chỉ `tokenSymbol`: cùng một token tồn tại độc lập trên từng chuỗi (xem
 * lập luận ở `prisma/schema.prisma`). Bỏ `chain` khỏi phép kiểm sẽ làm bản bộ nhớ NGHIÊM hơn bản
 * Postgres — nó từ chối một dòng mà Postgres nhận, và triệu chứng là test đỏ chỉ ở chế độ bộ nhớ.
 *
 * So sánh CHÍNH XÁC, không hạ chữ thường: ràng buộc duy nhất của Postgres so chuỗi chính xác, nên
 * hạ chữ thường ở đây lại làm bản bộ nhớ nghiêm hơn theo một chiều khác.
 */
function assertSymbolFree(tokenSymbol: string, chain: ChainKey): void {
  const clash = state().projects.find(
    (project) => project.tokenSymbol === tokenSymbol && project.chain === chain,
  );
  if (!clash) return;
  throw new UniqueConstraintError(
    'Project',
    ['tokenSymbol', 'chain'],
    `Mã token này đã thuộc dự án "${clash.name}" (${clash.id}) trên chuỗi "${chain}".`,
  );
}

export function createMemoryProjectStore(): IProjectStore {
  return {
    kind: 'memory',

    async createProject(project: NewProject): Promise<ProjectRecord> {
      // Mọi phép kiểm chạy TRƯỚC mọi thay đổi trạng thái.
      assertSymbolFree(project.tokenSymbol, project.chain);
      const now = new Date().toISOString();
      const record: ProjectRecord = {
        id: randomUUID(),
        tokenSymbol: project.tokenSymbol,
        name: project.name,
        totalSupply: assertAmount('totalSupply', project.totalSupply),
        status: assertProjectStatus(project.status ?? 'DRAFT'),
        chain: project.chain,
        contractAddress: project.contractAddress ?? null,
        issuedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      state().projects.push(record);
      return { ...record };
    },

    async findProject({ tokenSymbol, chain }) {
      const found = state().projects.find(
        (project) => project.tokenSymbol === tokenSymbol && project.chain === chain,
      );
      return found ? { ...found } : null;
    },

    async markIssued({ id, issuedAt, contractAddress }) {
      const found = state().projects.find((project) => project.id === id);
      // Điều kiện GIỐNG câu UPDATE của bản Postgres: còn DRAFT và chưa có `issuedAt`. Không
      // dòng nào khớp -> `null`, và người gọi phải dừng.
      if (!found || found.status !== 'DRAFT' || found.issuedAt !== null) return null;

      found.status = 'ISSUED';
      found.issuedAt = issuedAt;
      // `undefined` = không chạm cột; `null` = xoá giá trị cũ. Giữ đúng phân biệt của bản Postgres.
      if (contractAddress !== undefined) found.contractAddress = contractAddress;
      found.updatedAt = new Date().toISOString();
      return { ...found };
    },

    async listProjects(options = {}) {
      const { chain, status, limit = 50 } = options;
      return state()
        .projects.filter((project) => (chain ? project.chain === chain : true))
        .filter((project) => (status ? project.status === status : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, limit)
        .map((project) => ({ ...project }));
    },
  };
}
