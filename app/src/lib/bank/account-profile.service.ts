import 'server-only';

import { PUBLIC_SAMPLE_WALLETS, SAMPLE_WALLETS, type ChainKey } from '@bidv/shared';
import { normalizeEvmAddress } from '@/lib/ledger/address';
import { assertCan, type Role } from '@/lib/rbac';
import { currentActorId, currentRole } from '@/lib/rbac/session';
import { getProfileWalletStore, getStore, UniqueConstraintError } from '@/lib/store';
import { toResult } from './authorize';
import { err, ok, type Result } from './result';
import { linkProfileWalletSchema, profileWalletSchema } from './schemas';

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

const INVESTOR_PROFILES = SAMPLE_ACCOUNT_PROFILES.filter(
  (profile): profile is CustomerAccountProfile =>
    profile.kind === 'CUSTOMER' && profile.customerType === 'INDIVIDUAL',
);

/** Chỉ khớp khi CẢ mã người dùng và vai trong phiên cùng thuộc một hồ sơ. */
export function findOwnAccountProfile(role: Role, actorId: string): AccountProfileView | null {
  return PROFILES_BY_SESSION.get(profileSessionKey(role, actorId)) ?? null;
}

/**
 * Chain thử nghiệm: hồ sơ chưa liên kết ví thì dùng ví mẫu Hardhat như trước, và nhận liên kết ví mẫu
 * (kiểm thử và e2e dùng ví mẫu). Chain khác (`evm` Sepolia, `stellar`) không có ví mặc định: bắt buộc
 * liên kết, và ví mẫu công khai bị từ chối (OP-05 QĐ-I).
 */
const SAMPLE_WALLET_CHAINS: readonly ChainKey[] = ['mock', 'hardhat-local'];

const usesSampleWallets = (chain: ChainKey) => SAMPLE_WALLET_CHAINS.includes(chain);

/** Ví của hồ sơ khách hàng trên một chain: ví đã liên kết, không có thì ví mẫu trên chain thử nghiệm. */
export async function walletOfProfile(profile: CustomerAccountProfile, chain: ChainKey): Promise<string | null> {
  const linked = await getProfileWalletStore().findByActor(profile.actorId, chain);
  if (linked) return linked.wallet;
  return usesSampleWallets(chain) ? profile.wallet : null;
}

/**
 * Tra hồ sơ nhà đầu tư theo ví TRÊN MỘT CHAIN để khối kiểm tra trước lệnh đọc KYC và khẩu vị rủi ro.
 * Ví đã liên kết thắng; ví mẫu chỉ còn là ví của hồ sơ trên chain thử nghiệm khi hồ sơ đó chưa liên
 * kết ví khác trên chain này.
 */
export async function findInvestorProfileByWallet(
  chain: ChainKey,
  wallet: string,
): Promise<CustomerAccountProfile | null> {
  const store = getProfileWalletStore();
  const linked = await store.findByWallet(chain, wallet);
  if (linked) return INVESTOR_PROFILES.find((profile) => profile.actorId === linked.actorId) ?? null;
  if (!usesSampleWallets(chain)) return null;
  const normalized = wallet.toLowerCase();
  const sample = INVESTOR_PROFILES.find((profile) => profile.wallet.toLowerCase() === normalized);
  if (!sample) return null;
  return (await store.findByActor(sample.actorId, chain)) ? null : sample;
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
 * Ví các màn Nhà đầu tư dùng trên chain `mock` (không có ví trình duyệt): ví liên kết của hồ sơ phiên,
 * chưa liên kết thì ví mẫu. Cùng nguồn với điều kiện "Định danh" nên hai bên không lệch nhau.
 */
export async function ownMockWallet(): Promise<string | null> {
  const profile = await getOwnAccountProfile();
  return profile.ok && profile.data.kind === 'CUSTOMER' ? walletOfProfile(profile.data, 'mock') : null;
}

// =============================================================================
//  VÍ LIÊN KẾT (OP-05 QĐ-I)
// =============================================================================

export interface ProfileWalletView {
  chain: ChainKey;
  /** Ví đã liên kết trên chain này, `null` khi chưa liên kết. */
  linked: string | null;
  /** Ví app dùng cho hồ sơ trên chain này: ví liên kết, hoặc ví mẫu trên chain thử nghiệm. */
  effective: string | null;
  updatedAt: string | null;
}

/** Hồ sơ khách hàng của phiên; vai nhân viên không có ví liên kết. Quyền `wallet:connect` chặn ở đây. */
async function ownCustomerProfile(): Promise<{ role: Role; profile: CustomerAccountProfile }> {
  const role = await currentRole();
  assertCan(role, 'wallet:connect');
  const profile = findOwnAccountProfile(role, await currentActorId(role));
  if (!profile || profile.kind !== 'CUSTOMER') throw new Error(`Không tìm thấy hồ sơ khách hàng cho vai ${role}.`);
  return { role, profile };
}

/** Ví liên kết của CHÍNH hồ sơ phiên trên một chain. Chỉ đọc, không ghi sổ kiểm toán. */
export async function getProfileWallet(input: unknown): Promise<Result<ProfileWalletView>> {
  const parsed = profileWalletSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;
  try {
    const { profile } = await ownCustomerProfile();
    const linked = await getProfileWalletStore().findByActor(profile.actorId, chain);
    return ok({
      chain,
      linked: linked?.wallet ?? null,
      effective: linked?.wallet ?? (usesSampleWallets(chain) ? profile.wallet : null),
      updatedAt: linked?.updatedAt ?? null,
    });
  } catch (error) {
    return toResult(error);
  }
}

/**
 * Người dùng đang đăng nhập liên kết một ví vào hồ sơ CỦA MÌNH trên một chain (CH-2).
 *
 * Mã hồ sơ lấy từ phiên, không nhận từ trình duyệt. Trên chain thật từ chối ví mẫu công khai của
 * Hardhat (cùng danh sách `fund-sepolia.js`). Một ví chỉ thuộc một hồ sơ trên một chain (ràng buộc
 * duy nhất là trọng tài). Mọi kết cục vào sổ kiểm toán: ai, chain, ví cũ, ví mới.
 *
 * ⚠️ Liên kết KHÔNG whitelist trên chuỗi và KHÔNG chứng minh quyền sở hữu ví (nợ kỹ thuật, AU-01).
 */
export async function linkProfileWallet(input: unknown): Promise<Result<ProfileWalletView>> {
  const parsed = linkProfileWalletSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION', 'Dữ liệu không hợp lệ.', parsed.error.flatten().fieldErrors);
  const { chain } = parsed.data;
  const role = await currentRole();
  const actorId = await currentActorId(role);
  const audit = (outcome: 'DENIED' | 'SUCCESS' | 'FAILURE', detail: string) =>
    getStore().appendAudit({ actorRole: role, action: 'profile:wallet:link', target: actorId, outcome, detail, chain });

  try {
    await ownCustomerProfile();
  } catch (error) {
    await audit('DENIED', error instanceof Error ? error.message : 'Không có quyền.');
    return toResult(error);
  }

  try {
    const wallet = normalizeEvmAddress(parsed.data.wallet);
    const isPublicSample = PUBLIC_SAMPLE_WALLETS.some((sample) => sample.toLowerCase() === wallet.toLowerCase());
    if (!usesSampleWallets(chain) && isPublicSample) {
      const message = `Ví ${wallet} là ví mẫu công khai của Hardhat (khoá riêng ai cũng biết), không liên kết được trên chain ${chain}.`;
      await audit('FAILURE', message);
      return err('VALIDATION', message, { wallet: [message] });
    }
    const { previous, record } = await getProfileWalletStore().link({ actorId, chain, wallet, updatedBy: actorId });
    await audit('SUCCESS', `${actorId} liên kết ví trên ${chain}: ví cũ ${previous ?? 'không có'}, ví mới ${record.wallet}.`);
    return ok({ chain, linked: record.wallet, effective: record.wallet, updatedAt: record.updatedAt });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const message = 'Ví này đã liên kết với một hồ sơ khác trên chain này.';
      await audit('FAILURE', message);
      return err('VALIDATION', message, { wallet: [message] });
    }
    await audit('FAILURE', error instanceof Error ? error.message : 'Lỗi không xác định.');
    return toResult(error);
  }
}

