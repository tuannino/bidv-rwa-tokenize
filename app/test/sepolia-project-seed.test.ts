import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getContractAddress } from '@bidv/shared';
import { resetServerEnvCache } from '@/lib/config/env';
import { WPT_TOKEN_SYMBOL, WPT_TOTAL_SUPPLY } from '@/lib/config/issue-terms';
import { configuredProjectSeeds } from '@/lib/store/configured-seed-data';
import { createMemoryProjectStore } from '@/lib/store/memory.project.store';
import { resetMemoryStores } from '@/lib/store/memory.state';

const query = { tokenSymbol: WPT_TOKEN_SYMBOL, chain: 'evm' as const };

beforeEach(() => {
  vi.stubEnv('ENABLE_SEPOLIA_DEMO_PROJECT', 'false');
  resetServerEnvCache();
  resetMemoryStores();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
  resetMemoryStores();
});

function enableSepolia() {
  vi.stubEnv('ENABLE_SEPOLIA_DEMO_PROJECT', 'true');
  resetServerEnvCache();
}

describe('OP-04 đăng ký dự án Sepolia có chủ đích', () => {
  it('mặc định không tạo dự án public testnet', async () => {
    expect(configuredProjectSeeds().map((row) => row.chain)).toEqual(['mock', 'hardhat-local']);
    expect(await createMemoryProjectStore().findProject(query)).toBeNull();
  });

  it('bật cờ tạo WPT DRAFT đúng địa chỉ và trần, giữ hai dự án cục bộ', async () => {
    enableSepolia();
    const store = createMemoryProjectStore();
    expect(configuredProjectSeeds().map((row) => row.chain)).toEqual(['mock', 'hardhat-local', 'evm']);
    expect(await store.findProject(query)).toMatchObject({
      ...query,
      status: 'DRAFT',
      issuedAt: null,
      totalSupply: String(WPT_TOTAL_SUPPLY),
      contractAddress: getContractAddress('evm', 'ProjectToken'),
    });
    for (const chain of ['mock', 'hardhat-local'] as const) {
      expect(await store.findProject({ tokenSymbol: WPT_TOKEN_SYMBOL, chain })).not.toBeNull();
    }
  });

  it('đọc lại không reset dự án đã phát hành', async () => {
    enableSepolia();
    const store = createMemoryProjectStore();
    const project = (await store.findProject(query))!;
    const issuedAt = new Date().toISOString();
    await store.markIssued({ id: project.id, issuedAt });
    expect(await createMemoryProjectStore().findProject(query)).toMatchObject({
      id: project.id, status: 'ISSUED', issuedAt,
    });
  });
});
