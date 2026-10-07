import 'server-only';

import { SAMPLE_WALLETS } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { err, ok, type Result } from './result';

/** Trạng thái dùng chung cho tài khoản mẫu; AU-01 sẽ thay bằng trạng thái từ phiên thật. */
export type AccountStatus = 'ACTIVE' | 'LOCKED';
export type IdentityStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
export type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH';
export type AmlStatus = 'CLEARED' | 'REVIEW' | 'FLAGGED';

interface AccountProfileBase {
  actorId: string;
  role: Role;
  status: AccountStatus;
  fullName: string;
  phone: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface CustomerAccountProfile extends AccountProfileBase {
  kind: 'CUSTOMER';
  role: 'INVESTOR' | 'SELLER';
  customerType: 'INDIVIDUAL' | 'ORGANIZATION';
  /** Người liên hệ của pháp nhân; cá nhân không có trường này. */
  contactPerson: string | null;
  identityStatus: IdentityStatus;
  riskRating: RiskRating;
  amlStatus: AmlStatus;
  dailyTransactionLimitVnd: string;
  wallet: string;
}

export interface EmployeeAccountProfile extends AccountProfileBase {
  kind: 'EMPLOYEE';
  role: 'TELLER' | 'CONTROLLER';
}

export type AccountProfileView = CustomerAccountProfile | EmployeeAccountProfile;

/**
 * Hồ sơ mẫu duy nhất của bốn tài khoản demo.
 *
 * Đây là dữ liệu hồ sơ của PoC, không phải dữ liệu on-chain. AU-01 sẽ thay nguồn đọc bằng phiên
 * đăng nhập và kho người dùng; giữ nguyên kiểu trả về để trang tài khoản không phải đổi lại.
 */
const SAMPLE_ACCOUNT_PROFILES: readonly AccountProfileView[] = [
  {
    kind: 'CUSTOMER',
    actorId: 'NDT001',
    role: 'INVESTOR',
    status: 'ACTIVE',
    fullName: 'Nguyễn Văn An',
    phone: '0912 345 678',
    email: 'an.nguyen@example.com',
    createdAt: '2026-01-15T02:00:00.000Z',
    lastActiveAt: '2026-10-06T01:30:00.000Z',
    customerType: 'INDIVIDUAL',
    contactPerson: null,
    identityStatus: 'APPROVED',
    riskRating: 'LOW',
    amlStatus: 'CLEARED',
    dailyTransactionLimitVnd: '500000000',
    wallet: SAMPLE_WALLETS.NDT001,
  },
  {
    kind: 'CUSTOMER',
    actorId: 'NB001',
    role: 'SELLER',
    status: 'ACTIVE',
    fullName: 'Công ty Cổ phần Điện gió Bạc Liêu',
    phone: '0291 395 8888',
    email: 'contact@diengiobaclieu.vn',
    createdAt: '2025-12-10T02:00:00.000Z',
    lastActiveAt: '2026-10-06T01:15:00.000Z',
    customerType: 'ORGANIZATION',
    contactPerson: 'Trần Thị Bình',
    identityStatus: 'APPROVED',
    riskRating: 'LOW',
    amlStatus: 'CLEARED',
    dailyTransactionLimitVnd: '5000000000',
    wallet: SAMPLE_WALLETS.NB001,
  },
  {
    kind: 'EMPLOYEE',
    actorId: 'GDV001',
    role: 'TELLER',
    status: 'ACTIVE',
    fullName: 'Lê Minh Cường',
    phone: '024 2220 0588',
    email: 'cuong.lm@bidv.com.vn',
    createdAt: '2025-11-01T02:00:00.000Z',
    lastActiveAt: '2026-10-06T01:45:00.000Z',
  },
  {
    kind: 'EMPLOYEE',
    actorId: 'KSV001',
    role: 'CONTROLLER',
    status: 'ACTIVE',
    fullName: 'Phạm Thu Dung',
    phone: '024 2220 0588',
    email: 'dung.pt@bidv.com.vn',
    createdAt: '2025-11-01T02:00:00.000Z',
    lastActiveAt: '2026-10-06T01:40:00.000Z',
  },
];

const profileSessionKey = (role: Role, actorId: string) => `${role}:${actorId}`;

const PROFILES_BY_SESSION = new Map(
  SAMPLE_ACCOUNT_PROFILES.map((profile) => [
    profileSessionKey(profile.role, profile.actorId),
    profile,
  ]),
);

const INVESTOR_PROFILES = SAMPLE_ACCOUNT_PROFILES.filter(
  (profile): profile is CustomerAccountProfile =>
    profile.kind === 'CUSTOMER' && profile.customerType === 'INDIVIDUAL',
);

/** Chỉ khớp khi CẢ mã người dùng và vai trong phiên cùng thuộc một hồ sơ. */
export function findOwnAccountProfile(role: Role, actorId: string): AccountProfileView | null {
  return PROFILES_BY_SESSION.get(profileSessionKey(role, actorId)) ?? null;
}

/** Tra hồ sơ nhà đầu tư theo ví để khối kiểm tra trước lệnh đọc KYC và khẩu vị rủi ro. */
export function findInvestorProfileByWallet(wallet: string): CustomerAccountProfile | null {
  const normalized = wallet.toLowerCase();
  return INVESTOR_PROFILES.find((profile) => profile.wallet.toLowerCase() === normalized) ?? null;
}

/**
 * Hồ sơ của CHÍNH phiên hiện tại. Không nhận mã hồ sơ từ trình duyệt nên vai này không thể yêu
 * cầu hồ sơ của vai khác bằng cách sửa tham số URL hay payload.
 */
export async function getOwnAccountProfile(): Promise<Result<AccountProfileView>> {
  const role = await currentRole();
  const actorId = await currentActorId(role);
  const profile = findOwnAccountProfile(role, actorId);
  return profile
    ? ok(profile)
    : err('UNKNOWN', `Không tìm thấy hồ sơ ${actorId} cho vai ${role}.`);
}
