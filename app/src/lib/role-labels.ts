import type { Role } from '@/lib/rbac';

/** Nhãn vai cho người dùng, dùng chung ở màn tài khoản và bảng yêu cầu Mint, Burn (UIUX-01). */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  INVESTOR: 'Nhà đầu tư',
  SELLER: 'Người bán',
  TELLER: 'Giao dịch viên',
  CONTROLLER: 'Kiểm soát viên',
};
