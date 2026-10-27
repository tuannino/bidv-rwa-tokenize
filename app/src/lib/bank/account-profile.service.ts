import 'server-only';

import { SAMPLE_WALLETS } from '@bidv/shared';
import { normalizeEvmAddress } from '@/lib/ledger/address';
import { assertCan, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { toResult } from './authorize';
import { err, ok, type Result } from './result';
import { accountWalletSchema } from './schemas';
import { resolveWalletOwner } from './wallet-owner';

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
    fullName: 'Công ty Cổ phần Điện gió An Viên',
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

const CUSTOMER_PROFILES = SAMPLE_ACCOUNT_PROFILES.filter(
  (profile): profile is CustomerAccountProfile => profile.kind === 'CUSTOMER',
);

/** Chỉ khớp khi CẢ mã người dùng và vai trong phiên cùng thuộc một hồ sơ. */
export function findOwnAccountProfile(role: Role, actorId: string): AccountProfileView | null {
  return PROFILES_BY_SESSION.get(profileSessionKey(role, actorId)) ?? null;
}

/** Hồ sơ khách hàng theo mã (FIX-01: chủ ví, gắn ví). Nhân viên hoặc mã lạ: `null`. */
export function findCustomerProfile(actorId: string): CustomerAccountProfile | null {
  return CUSTOMER_PROFILES.find((profile) => profile.actorId === actorId) ?? null;
}

/** Mọi hồ sơ khách hàng (Nhà đầu tư, Người bán), theo thứ tự khai báo. */
export function listCustomerProfiles(): readonly CustomerAccountProfile[] {
  return CUSTOMER_PROFILES;
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

/**
 * Ví các màn Nhà đầu tư dùng trên chain `mock` (không có ví trình duyệt, FIX-01 QĐ-9): ví mẫu của hồ
 * sơ khách hàng phiên. Ví mẫu trên `mock` luôn được coi là đã định danh (`resolveWalletOwner`).
 */
export async function ownMockWallet(): Promise<string | null> {
  const profile = await getOwnAccountProfile();
  return profile.ok && profile.data.kind === 'CUSTOMER' ? profile.data.wallet : null;
}

// =============================================================================
//  VÍ THANH TOÁN TRÊN MÀN TÀI KHOẢN (FIX-01 F2, F3)
// =============================================================================

export interface AccountWalletView {
  /** Ví đang xét: ví mẫu trên `mock`, ví đang kết nối trên chain khác; `null` khi chưa kết nối ví. */
  wallet: string | null;
  /** Ví đã được ngân hàng gắn cho hồ sơ của phiên trên chain này. */
  bound: boolean;
}

/**
 * Trạng thái định danh của ví thanh toán cho CHÍNH hồ sơ phiên. Chỉ đọc, không ghi sổ kiểm toán. Vai
 * nhân viên không có ví thanh toán: `FORBIDDEN` (quyền `wallet:connect`).
 */
export async function getAccountWallet(input: unknown): Promise<Result<AccountWalletView>> {
  const parsed = accountWalletSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;
  try {
    const role = await currentRole();
    assertCan(role, 'wallet:connect');
    const profile = findOwnAccountProfile(role, await currentActorId(role));
    if (!profile || profile.kind !== 'CUSTOMER') throw new Error(`Không tìm thấy hồ sơ khách hàng cho vai ${role}.`);
    if (chain === 'mock') return ok({ wallet: profile.wallet, bound: true });
    if (!parsed.data.wallet) return ok({ wallet: null, bound: false });
    const wallet = normalizeEvmAddress(parsed.data.wallet);
    const owner = await resolveWalletOwner(chain, wallet);
    return ok({ wallet, bound: owner?.actorId === profile.actorId });
  } catch (error) {
    return toResult(error);
  }
}
