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
   * ĐẶT lệnh mua WPT (BE-02 R1.1). Của nhà đầu tư.
   *
   * ⚠️ Năm quyền `order:*` dưới đây thuộc phạm vi BE-08. BE-02 khai trước vì không có
   *    chúng thì không kiểm được quyền nào cả — xem DEVIATION trong docs/CHECKPOINT_BE02.md.
   */
  'order:place',
  /**
   * KHỚP lệnh (BE-02 R3.1). Của NGÂN HÀNG, không phải nhà đầu tư — tách khỏi
   * `order:place` là điểm quan trọng nhất trong nhóm này.
   *
   * Vì sao: giao dịch khớp lệnh do ví ngân hàng/SPV ký (`getBankSigner`), và nó chuyển
   * WPT RA KHỎI ví thanh toán SPV. Gộp hai quyền làm một thì ai đặt được lệnh cũng
   * tự khớp được lệnh của mình, tức là tự rút token khỏi ví SPV theo ý mình.
   */
  'order:execute',
  /** Cho lệnh treo quá hạn về trạng thái kết thúc (R4.4). BE-07 gọi theo lịch. */
  'order:expire',
  // đọc
  'balance:read',
  'txn:read',
  'audit:read',
  /** Xem lệnh mua. Nhà đầu tư có, nhưng chỉ xem được lệnh của ví mình (R5.1). */
  'order:read',
  /**
   * Xem lệnh của MỌI ví, lọc theo trạng thái (R5.2). Chỉ ba vai ngân hàng.
   *
   * Đây là thứ phân biệt R5.1 với R5.2 mà KHÔNG cần `if (role === 'INVESTOR')`:
   * `listOrders` hỏi `can(role, 'order:read:all')` rồi mới quyết định có được phép
   * bỏ trống bộ lọc ví hay không.
   */
  'order:read:all',
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
 */
const READ_ONLY: Action[] = [
  'balance:read',
  'txn:read',
  'audit:read',
  // Ba vai ngân hàng đều phải xem được sổ lệnh toàn hệ để đối soát. `order:read:all`
  // KHÔNG phải cổng kênh, nên đặt ở đây không vi phạm cảnh báo phía trên.
  'order:read',
  'order:read:all',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  BANK_ADMIN: [
    'token:mint',
    'token:burn',
    'token:freeze',
    'token:clawback',
    'investor:whitelist',
    'kyc:approve',
    // Khớp lệnh và dọn lệnh treo là việc của ngân hàng: giao dịch do ví ngân hàng ký.
    'order:execute',
    'order:expire',
    ...READ_ONLY,
  ],
  // Tuân thủ: xét KYC/whitelist/freeze nhưng KHÔNG phát hành token, KHÔNG khớp lệnh.
  COMPLIANCE: ['investor:whitelist', 'kyc:approve', 'token:freeze', ...READ_ONLY],
  // `portfolio:read` CHỈ ở đây — đó là thứ chặn ba vai ngân hàng khỏi kênh `(client)`.
  // `order:place` cũng chỉ ở đây; `order:read` có nhưng KHÔNG có `order:read:all`.
  INVESTOR: [
    'token:transfer',
    'portfolio:read',
    'order:place',
    'order:read',
    'balance:read',
    'txn:read',
  ],
  // Kiểm toán/Regulator: CHỈ ĐỌC (route-group `(audit)`).
  AUDITOR: [...READ_ONLY],
};
