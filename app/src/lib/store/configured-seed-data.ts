import 'server-only';

import { getContractAddress } from '@bidv/shared';
import { serverEnv } from '@/lib/config/env';
import { SEED_PROJECTS, type SeedProjectRow } from './seed-data';

/** Một nguồn cho memory/Postgres; Sepolia chỉ được đăng ký khi người vận hành bật cờ. */
export function configuredProjectSeeds(): readonly SeedProjectRow[] {
  if (!serverEnv().enableSepoliaDemoProject) return SEED_PROJECTS;
  return [
    ...SEED_PROJECTS,
    {
      ...SEED_PROJECTS[0],
      chain: 'evm',
      contractAddress: getContractAddress('evm', 'ProjectToken'),
    },
  ];
}
