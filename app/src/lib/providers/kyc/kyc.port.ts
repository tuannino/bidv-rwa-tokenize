/**
 * Cổng KYC. Có bản `mock` (mặc định) và `real` (Phase 4) chọn bằng flag `USE_MOCK_KYC`.
 * Nghiệp vụ chỉ biết interface này, không biết đang gọi mock hay hệ thống KYC thật.
 */

export interface KycSubject {
  wallet: string;
  fullName?: string;
  /** CCCD/hộ chiếu — PoC không lưu, chỉ chuyển tiếp. */
  nationalId?: string;
}

export interface KycDecision {
  approved: boolean;
  /** Mã hồ sơ để đối soát với hệ thống KYC. */
  reference: string;
  /** Lý do khi `approved = false`. */
  reason?: string;
  /** Tên provider đã ra quyết định (ghi vào audit log). */
  provider: string;
  decidedAt: string;
}

export interface IKycProvider {
  readonly name: string;
  readonly isMock: boolean;
  /** Xét hồ sơ. KHÔNG tự whitelist on-chain — việc đó do nghiệp vụ gọi `ILedgerPort`. */
  verify(subject: KycSubject): Promise<KycDecision>;
}

export class KycProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KycProviderError';
  }
}
