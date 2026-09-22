import { FALLBACK_ROLE, ROLES, isRole, type Role } from './permissions';

/**
 * LỚP THỨ HAI cho việc đổi tham số hệ thống: vai có được đổi **cấu hình** hay không.
 *
 * Độc lập với bảng quyền `ROLE_PERMISSIONS`, cùng mô hình hai lớp với cờ
 * `ENABLE_DEMO_PAYMENT_MINT` ở `demo-payment.ts`. Vì sao cần lớp thứ hai cho riêng việc đổi
 * giá: `treasury:manage` là quyền quản trị hai ví SPV và ví lợi nhuận — một vai cần quyền đó
 * để điều phối dòng tiền vẫn có thể là vai KHÔNG được ấn định giá bán. Gộp hai câu hỏi vào
 * một quyền là buộc chúng phải luôn cùng câu trả lời.
 *
 * ⚠️ File này KHÔNG `import 'server-only'` và cũng KHÔNG được export ra `rbac/index.ts`.
 * Không `server-only` vì nó chỉ có dữ liệu thuần, không đọc env, không mở kết nối. Không vào
 * barrel vì `assertCanConfigure` là chốt chặn phía máy chủ; để nó trong barrel là mời component
 * gọi một guard mà nó không có quyền quyết định.
 *
 * ## Vì sao bảng nằm TRONG MÃ dù lược đồ đã có cột `Role.isConfig`
 *
 * Giống y bảng `ROLE_PERMISSIONS`: `prisma/schema.prisma` đã khai `Role`/`Permission`/
 * `RolePermission` từ Phase 1 nhưng nguồn đang có hiệu lực vẫn là bảng trong mã, và AU-02 mới
 * là task chuyển sang đọc cơ sở dữ liệu. Cột `Role.isConfig` thêm ở BE-04 là ĐÍCH để AU-02
 * chuyển tới, khai sớm để lược đồ không phải đổi lần nữa.
 *
 * BE-04 cố ý KHÔNG đọc cột đó: spec ghi rõ "không chuyển toàn bộ phân quyền sang cơ sở dữ
 * liệu (thuộc AU-02)", và đọc một cột quyền từ cơ sở dữ liệu trong khi mọi cột còn lại vẫn ở
 * mã nguồn là để hệ thống có hai nguồn phân quyền cùng lúc — trạng thái tệ hơn cả hai phương
 * án thuần.
 */

/**
 * Vai nào được đổi tham số hệ thống. Khai ĐỦ mọi vai, không dùng danh sách thưa.
 *
 * `Record<Role, boolean>` bắt buộc liệt kê hết, nên thêm vai mới vào `ROLES` mà quên vai đó ở
 * đây là lỗi biên dịch. Dùng `Role[]` kiểu "danh sách vai được phép" thì vai mới im lặng nhận
 * `false`, đúng theo nguyên tắc đóng nhưng không ai buộc phải NGHĨ về nó — và lần sau người
 * thêm vai `TREASURY` sẽ không biết là có một quyết định cần ra ở đây.
 */
export const CONFIG_ROLES: Record<Role, boolean> = {
  /** Cán bộ ngân hàng ấn định giá phát hành — đây là vai duy nhất được đổi cấu hình. */
  BANK_ADMIN: true,
  /**
   * Tuân thủ GIÁM SÁT tham số, không tự đặt. Cùng lập luận với việc COMPLIANCE không có
   * `order:execute`: người giám sát mà đổi được chính con số mình giám sát thì lớp kiểm soát
   * thứ hai không còn.
   */
  COMPLIANCE: false,
  INVESTOR: false,
  AUDITOR: false,
};

/** Vai có được đổi tham số hệ thống không. Vai lạ quy về `AUDITOR` — nguyên tắc đóng. */
export function isConfigRole(role: unknown): boolean {
  const resolved: Role = isRole(role) ? role : FALLBACK_ROLE;
  return CONFIG_ROLES[resolved];
}

/**
 * Vai được đổi cấu hình, dùng để nạp cột `Role.isConfig` lúc khởi tạo cơ sở dữ liệu.
 *
 * Suy ra từ `CONFIG_ROLES` thay vì liệt kê lại: liệt kê lại là có hai nguồn, và chúng lệch
 * nhau ở lần đổi đầu tiên — lúc đó cơ sở dữ liệu nói một đằng, guard chạy một nẻo.
 */
export const CONFIG_ROLE_NAMES: readonly Role[] = ROLES.filter((role) => CONFIG_ROLES[role]);
