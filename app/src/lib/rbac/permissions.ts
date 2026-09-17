/**
 * RBAC — bảng dữ liệu role -> permission.
 *
 * LUẬT #3: cấm `if (role === 'BANK_ADMIN')`. Mọi kiểm quyền đi qua `can(role, action)`.
 * Thêm role/quyền = SỬA BẢNG DƯỚI ĐÂY, không sửa logic nghiệp vụ.
 *
 * Phase 4 sẽ chuyển bảng này sang Prisma (xem prisma/schema.prisma: Role/Permission).
 * Chữ ký `can()` giữ nguyên để nghiệp vụ không phải sửa.
 */

export const ROLES = ['BANK_ADMIN', 'COMPLIANCE', 'INVESTOR', 'AUDITOR'] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  // đặc quyền ngân hàng
  'token:mint',
  'token:burn',
  'token:freeze',
  'token:clawback',
  'investor:whitelist',
  'kyc:approve',
  // nhà đầu tư
  'token:transfer',

  /**
   * Lệnh mua WPT. Hai hành động TÁCH RIÊNG vì hai phía khác nhau:
   * nhà đầu tư `place`, ngân hàng `execute` (chuyển VNDB và WPT trong một giao dịch).
   * Ngân hàng KHÔNG được đặt lệnh thay nhà đầu tư, nên `order:place` không cấp cho BANK_ADMIN.
   */
  'order:place',
  'order:execute',

  /**
   * Chia lợi nhuận: `snapshot` chốt quyền (chụp danh sách nắm giữ), `execute` chi trả.
   * Tách hai bước vì chốt quyền và chi trả là hai lần quyết định, và mã snapshot
   * phải lấy từ event `Snapshot` trong receipt của bước đầu.
   */
  'distribution:snapshot',
  'distribution:execute',

  /**
   * Tất toán (đóng quỹ). Dùng tiền tố `settlement:` chứ KHÔNG phải `token:redeem`,
   * vì luồng chốt là ngân hàng điều phối và đốt token, không phải nhà đầu tư tự đổi.
   * Hành động đốt tái dùng `token:burn` đã có.
   *
   * `settlement:confirm` là của NHÀ ĐẦU TƯ (xác nhận thu hồi và hoàn vốn), không phải ngân hàng.
   */
  'settlement:initiate',
  'settlement:set-nav',
  'settlement:confirm',

  /** Quản trị hai ví SPV và ví chia lợi nhuận. */
  'treasury:manage',

  /**
   * CHỈ MÔI TRƯỜNG THỬ: cán bộ ngân hàng phát hành VNDB vào ví chỉ định.
   *
   * ⚠️ Quyền này MỘT MÌNH KHÔNG đủ để cho phép. Còn phải bật cờ `ENABLE_DEMO_PAYMENT_MINT`
   * (mặc định tắt) — xem `rbac/demo-payment.ts`. Lý do hai lớp: bảng quyền là mã nguồn,
   * gán nhầm vai `BANK_ADMIN` trên môi trường thật là mở đường tự phát hành tiền.
   */
  'demo:mint-payment',

  // đọc
  'balance:read',
  'txn:read',
  'audit:read',
  /** Báo cáo đối soát — dữ liệu TOÀN HỆ, nên nhà đầu tư không có. */
  'reconcile:read',
  /**
   * Quyền VÀO kênh nhà đầu tư `(client)` — xem vị thế của chính mình.
   *
   * Tách riêng khỏi `balance:read` là có lý do: `balance:read` nằm trong `READ_ONLY`
   * mà cả BANK_ADMIN/COMPLIANCE/AUDITOR đều spread vào, nên dùng nó làm cổng kênh thì
   * KHÔNG chặn được ai (đã đo thực tế ở FE-01 v1). Quyền này chỉ cấp cho INVESTOR.
   */
  'portfolio:read',
] as const;
export type Action = (typeof ACTIONS)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Vai trò dùng khi không xác định được (nguyên tắc đóng: quyền thấp nhất). */
export const FALLBACK_ROLE: Role = 'AUDITOR';

/**
 * Nhóm quyền chỉ-đọc dùng chung cho ba vai phía ngân hàng.
 *
 * ⚠️ KHÔNG thêm `portfolio:read` vào đây. Mọi quyền trong nhóm này tự động có ở
 * BANK_ADMIN, COMPLIANCE và AUDITOR, nên quyền nào dùng làm cổng vào kênh nhà đầu tư
 * mà nằm ở đây thì mất tác dụng chặn.
 *
 * `reconcile:read` đặt ở đây CÓ CHỦ Ý: cả ba vai phía ngân hàng đều được xem báo cáo
 * đối soát, và INVESTOR không spread nhóm này nên tự động không có.
 */
const READ_ONLY: Action[] = ['balance:read', 'txn:read', 'audit:read', 'reconcile:read'];

export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  /**
   * Ngân hàng điều phối ba luồng: khớp lệnh, chia lợi nhuận, tất toán.
   *
   * ⚠️ CỐ TÌNH KHÔNG có `order:place` và `settlement:confirm`. Hai hành động đó là
   * quyết định của nhà đầu tư; ngân hàng đặt lệnh hoặc xác nhận hoàn vốn thay nhà đầu tư
   * thì mất dấu ai đã đồng ý, và sổ kiểm toán không còn dùng để đối chiếu trách nhiệm.
   */
  BANK_ADMIN: [
    'token:mint',
    'token:burn',
    'token:freeze',
    'token:clawback',
    'investor:whitelist',
    'kyc:approve',
    'order:execute',
    'distribution:snapshot',
    'distribution:execute',
    'settlement:initiate',
    'settlement:set-nav',
    'treasury:manage',
    // Cần THÊM cờ ENABLE_DEMO_PAYMENT_MINT mới thực sự chạy — xem `demo-payment.ts`.
    'demo:mint-payment',
    ...READ_ONLY,
  ],
  /**
   * Tuân thủ: xét KYC/whitelist/freeze nhưng KHÔNG phát hành token.
   *
   * Không cấp `order:execute`, `distribution:execute`, `settlement:set-nav`:
   * tuân thủ GIÁM SÁT dòng tiền, không tự thực hiện. Cùng một người vừa giám sát vừa
   * chuyển tiền thì lớp kiểm soát thứ hai không còn.
   */
  COMPLIANCE: ['investor:whitelist', 'kyc:approve', 'token:freeze', ...READ_ONLY],
  /**
   * `portfolio:read` CHỈ ở đây — đó là thứ chặn ba vai ngân hàng khỏi kênh `(client)`.
   * `order:place` và `settlement:confirm` cũng chỉ ở đây, vì là quyết định của nhà đầu tư.
   */
  INVESTOR: [
    'token:transfer',
    'order:place',
    'settlement:confirm',
    'portfolio:read',
    'balance:read',
    'txn:read',
  ],
  // Kiểm toán/Regulator: CHỈ ĐỌC (route-group `(audit)`). Không một hành động ghi nào.
  AUDITOR: [...READ_ONLY],
};
