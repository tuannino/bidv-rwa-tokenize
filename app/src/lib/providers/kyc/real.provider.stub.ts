import { KycProviderError, type IKycProvider, type KycDecision } from './kyc.port';

/**
 * Chỗ cắm KYC thật (Phase 4): eKYC nội bộ BIDV / bên thứ ba.
 * Ném lỗi rõ ràng thay vì âm thầm approve — approve giả trong luồng tuân thủ là rủi ro thật.
 */
export function createRealKycProvider(): IKycProvider {
  return {
    name: 'real-not-implemented',
    isMock: false,

    async verify(): Promise<KycDecision> {
      throw new KycProviderError(
        'KYC provider thật chưa hiện thực (Phase 4). Đặt USE_MOCK_KYC=true để dùng bản mock.',
      );
    },
  };
}
