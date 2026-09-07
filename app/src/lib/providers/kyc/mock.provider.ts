import { normalizeEvmAddress } from '@/lib/ledger/address';
import type { IKycProvider, KycDecision, KycSubject } from './kyc.port';

/**
 * KYC mock: auto-approve. Mục đích là để luồng mint chạy được ngay, không cần tích hợp thật.
 *
 * Vẫn validate địa chỉ ví: đó là kiểm tra mà hệ thống KYC thật CHẮC CHẮN cũng làm,
 * nên mock không được nới lỏng (nếu nới, lỗi sẽ chỉ lộ ra khi cắm provider thật).
 */
export function createMockKycProvider(): IKycProvider {
  return {
    name: 'mock-auto-approve',
    isMock: true,

    async verify(subject: KycSubject): Promise<KycDecision> {
      const wallet = normalizeEvmAddress(subject.wallet); // ném InvalidAddressError nếu sai

      return {
        approved: true,
        reference: `MOCK-KYC-${wallet.slice(2, 10).toUpperCase()}`,
        provider: 'mock-auto-approve',
        decidedAt: new Date().toISOString(),
      };
    },
  };
}
