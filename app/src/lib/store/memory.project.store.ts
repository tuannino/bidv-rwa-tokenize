import 'server-only';

import { randomUUID } from 'node:crypto';
import { memoryState } from './memory.state';
import {
  assertProjectStatus,
  type IProjectStore,
  type NewProject,
  type ProjectRecord,
} from './project.store.port';
import { SEED_PROJECT } from './seed-data';
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
      projects: [
        {
          id: randomUUID(),
          tokenSymbol: SEED_PROJECT.tokenSymbol,
          name: SEED_PROJECT.name,
          totalSupply: assertAmount('totalSupply', SEED_PROJECT.totalSupply),
          status: assertProjectStatus(SEED_PROJECT.status),
          chain: SEED_PROJECT.chain,
          contractAddress: null,
          issuedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  });

/**
 * Ràng buộc `Project_tokenSymbol_key`: một mã token chỉ có MỘT dòng.
 *
 * So sánh CHÍNH XÁC, không hạ chữ thường: ràng buộc duy nhất của Postgres so chuỗi chính xác,
 * nên hạ chữ thường ở đây sẽ làm bản bộ nhớ NGHIÊM hơn bản Postgres — lệch theo chiều ngược
 * lại vẫn là lệch, và triệu chứng là một test đỏ chỉ khi có Postgres thật.
 */
function assertSymbolFree(tokenSymbol: string): void {
  const clash = state().projects.find((project) => project.tokenSymbol === tokenSymbol);
  if (!clash) return;
  throw new UniqueConstraintError(
    'Project',
    ['tokenSymbol'],
    `Mã token này đã thuộc dự án "${clash.name}" (${clash.id}).`,
  );
}

export function createMemoryProjectStore(): IProjectStore {
  return {
    kind: 'memory',

    async createProject(project: NewProject): Promise<ProjectRecord> {
      // Mọi phép kiểm chạy TRƯỚC mọi thay đổi trạng thái.
      assertSymbolFree(project.tokenSymbol);
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
