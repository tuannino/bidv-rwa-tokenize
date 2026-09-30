import type { Action } from './permissions';

/**
 * Cổng vào từng KHU VỰC giao diện (route-group) — dữ liệu thuần.
 *
 * Tách khỏi layout là có lý do cụ thể: layout là Server Component nên không unit-test được
 * bằng Vitest, mà FE-20 phải chứng minh "mỗi vai chỉ vào được khu vực của mình, có kiểm thử
 * cho CẢ HAI chiều". Để danh sách quyền nằm trong JSX thì chiều "bị chặn" chỉ kiểm được qua
 * e2e — chậm, và không bắt được trường hợp thêm khu vực mà quên cổng.
 *
 * Layout chỉ còn việc nối: `requireAny={AREA_GATES.ops}`. Bảng này là nguồn duy nhất.
 *
 * ⚠️ Mỗi cổng phải là quyền mà ĐÚNG tập vai cần vào mới có. Dùng một quyền nằm trong nhóm
 * `READ_ONLY` làm cổng riêng của một vai thì không chặn được ai — FE-01 v1 đã mắc đúng lỗi
 * này với `balance:read`. Ngoại lệ tường minh: khu vực `shared` CỐ Ý dùng `balance:read` vì
 * nó phải mở cho cả bốn vai.
 */

export const AREAS = [
  'investor',
  'seller',
  'ops',
  'draft',
  'approval',
  'wallet',
  'account',
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_GATES: Record<Area, readonly Action[]> = {
  /** Nhà đầu tư: `portfolio:read` chỉ INVESTOR có. */
  investor: ['portfolio:read'],
  /** Người bán: `seller:read` chỉ SELLER có. */
  seller: ['seller:read'],
  /** Vận hành: mở cho Giao dịch viên và Kiểm soát viên. */
  ops: ['ops:read'],
  /** Mục Lập lệnh: chỉ Giao dịch viên. Kiểm soát viên có `ops:read` nhưng bị chặn ở đây. */
  draft: ['ops:draft:read'],
  /** Mục Phê duyệt lệnh: chỉ Kiểm soát viên. Giao dịch viên bị chặn ở đây. */
  approval: ['ops:approve:read'],
  /**
   * Kết nối ví: Nhà đầu tư và Người bán — đúng hai vai thao tác bằng ví trình duyệt.
   *
   * Tách khỏi `account` dù cả hai là trang "của chính tôi", vì hai tập vai KHÁC nhau. Gộp lại
   * dưới một cổng mà cả bốn vai đều qua là mở trang kết nối ví cho hai vai vận hành, trong khi
   * thao tác ngân hàng ký bằng khóa máy chủ — xem ghi chú ở `wallet:connect`.
   */
  wallet: ['wallet:connect'],
  /**
   * Thông tin tài khoản: CẢ BỐN vai, theo tài liệu yêu cầu.
   *
   * Cổng `balance:read` cả bốn vai đều có nên gần như không chặn ai — và đó là ĐÚNG với một
   * trang nói về chính người đang đăng nhập. Vẫn bọc guard thay vì để trang ngoài mọi group,
   * để giữ bất biến "mọi trang nằm trong một khu vực có cổng": nhờ nó câu hỏi "vai nào vào
   * được trang này" luôn có một chỗ trả lời, và FE-24 siết lại thì sửa đúng một dòng.
   */
  account: ['balance:read'],
};

/** Tên khu vực hiển thị trên màn từ chối của `ChannelGuard`. */
export const AREA_LABELS: Record<Area, string> = {
  investor: 'Nhà đầu tư',
  seller: 'Người bán',
  ops: 'Vận hành',
  draft: 'Lập lệnh',
  approval: 'Phê duyệt lệnh',
  wallet: 'Kết nối ví',
  account: 'Thông tin tài khoản',
};
