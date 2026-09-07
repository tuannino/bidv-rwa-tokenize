import 'server-only';

import { serverEnv } from '@/lib/config/env';
import { createMockKycProvider } from './mock.provider';
import { createRealKycProvider } from './real.provider.stub';
import type { IKycProvider } from './kyc.port';

export {
  KycProviderError,
  type IKycProvider,
  type KycDecision,
  type KycSubject,
} from './kyc.port';

let cached: IKycProvider | undefined;

/** Factory theo flag `USE_MOCK_KYC` (mặc định true). */
export function getKycProvider(): IKycProvider {
  cached ??= serverEnv().useMockKyc ? createMockKycProvider() : createRealKycProvider();
  return cached;
}

/** Test dùng để nạp lại provider sau khi đổi flag. */
export function resetKycProviderCache(): void {
  cached = undefined;
}
