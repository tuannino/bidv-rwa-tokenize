/**
 * RBAC — bảng dữ liệu role -> permission.
 *
 * LUẬT #3: cấm `if (role === 'TELLER')`. Mọi kiểm quyền đi qua `can(role, action)`.
 * Thêm role/quyền = SỬA BẢNG DƯỚI ĐÂY, không sửa logic nghiệp vụ.
 *
 * Phase 4 sẽ chuyển bảng này sang Prisma (xem prisma/schema.prisma: Role/Permission).
 * Chữ ký `can()` giữ nguyên để nghiệp vụ không phải sửa.
 */

/**
 * Bốn vai trò theo tài liệu yêu cầu người sử dụng (FE-20).
 *
 * | Mã | Tài liệu yêu cầu gọi là |
 * |---|---|
 * | `INVESTOR` | Nhà đầu tư |
 * | `SELLER` | Người bán |
 * | `TELLER` | Giao dịch viên |
 * | `CONTROLLER` | Kiểm soát viên |
 *
 * `TELLER` là vai `BANK_ADMIN` cũ ĐỔI TÊN, giữ nguyên bộ quyền: FE-20 chỉ dựng khung, còn
 * việc tách đặc quyền của Giao dịch viên theo mô hình lập–duyệt thuộc BE-12. Đổi tên mà
 * không đổi quyền là có chủ ý — bớt quyền của vai này ở đây sẽ làm đỏ toàn bộ `lib/bank`
 * mà không thay được nghiệp vụ nào, vì chưa có bên nào đi qua bước phê duyệt.
 *
 * Hai vai cũ — tuân thủ và kiểm toán — **không còn trong tài liệu yêu cầu** nên đã gỡ.
 * `CONTROLLER` nhận phần CHỈ ĐỌC của chúng; phần ghi của vai tuân thủ
 * (`investor:whitelist`, `kyc:approve`, `token:freeze`) **không** chuyển sang —
 * Kiểm soát viên phê duyệt việc của người khác, không tự làm.
 */
export const ROLES = ['INVESTOR', 'SELLER', 'TELLER', 'CONTROLLER'] as const;
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
   * Ngân hàng KHÔNG được đặt lệnh thay nhà đầu tư, nên `order:place` không cấp cho
   * TELLER.
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
   * gán nhầm vai `TELLER` trên môi trường thật là mở đường tự phát hành tiền.
   */
  'demo:mint-payment',

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
  /** Báo cáo đối soát — dữ liệu TOÀN HỆ, nên nhà đầu tư không có. */
  'reconcile:read',
  /**
   * Quyền VÀO khu vực nhà đầu tư `(investor)` — xem vị thế của chính mình.
   *
   * Tách riêng khỏi `balance:read` là có lý do: `balance:read` nằm trong `READ_ONLY`
   * mà mọi vai phía ngân hàng đều spread vào, nên dùng nó làm cổng khu vực thì
   * KHÔNG chặn được ai (đã đo thực tế ở FE-01 v1). Quyền này chỉ cấp cho INVESTOR.
   */
  'portfolio:read',

  /**
   * ===================== FE-20: bốn cổng KHU VỰC =====================
   *
   * Bốn hành động dưới đây là **cổng hiển thị**, không phải quyền nghiệp vụ. Mỗi cái trả lời
   * đúng một câu: "vai này có được MỞ khu vực đó không". Hậu tố `:read` là cố ý — nó nói rõ
   * đây là quyền XEM một khu vực, nên khi BE-12 khai quyền nghiệp vụ thật (`order:draft`,
   * `order:approve`) thì không trùng tên và không ai nhầm hai thứ với nhau.
   *
   * Vì sao phải có cổng riêng thay vì tái dùng quyền nghiệp vụ: FE-20 **chưa** được khai
   * quyền lập và duyệt (thuộc BE-12), mà khung vẫn phải chặn được Kiểm soát viên khỏi mục
   * Lập lệnh và ngược lại. Không có cổng riêng thì hai mục đó mở cho cả hai vai, và lần
   * BE-12 siết lại sẽ là một thay đổi hành vi thầm lặng ở giao diện đang chạy.
   */
  /** Vào khu vực Người bán. Chỉ SELLER — nên nó cũng là thứ chặn ba vai kia. */
  'seller:read',
  /**
   * Mở trang Kết nối ví. Nhà đầu tư và Người bán — hai vai thao tác bằng ví trình duyệt.
   *
   * ⚠️ KHÔNG cấp cho hai vai vận hành, và đây không phải chuyện gọn gàng. Thao tác đặc quyền
   * của ngân hàng ký bằng khóa phía máy chủ qua `ISigner` (FE-02 R7.2), nên bày trang kết nối
   * ví cho Giao dịch viên là mời họ ký việc của ngân hàng bằng ví cá nhân — đúng ngược thiết kế.
   *
   * Phải là quyền RIÊNG chứ không dùng `balance:read`: cả bốn vai đều có `balance:read`
   * (nó nằm trong `READ_ONLY`), nên dùng nó làm cổng thì không chặn được ai.
   */
  'wallet:connect',
  /** Vào khu vực Vận hành (bảng điều khiển, giao dịch, chia lợi nhuận). TELLER + CONTROLLER. */
  'ops:read',
  /** Mở mục Lập lệnh. CHỈ TELLER — Kiểm soát viên không tự lập lệnh mình sẽ duyệt. */
  'ops:draft:read',
  /** Mở mục Phê duyệt lệnh. CHỈ CONTROLLER — Giao dịch viên không tự duyệt lệnh mình lập. */
  'ops:approve:read',
] as const;
export type Action = (typeof ACTIONS)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Vai trò dùng khi không xác định được (nguyên tắc đóng: quyền thấp nhất).
 *
 * FE-20 đổi từ `AUDITOR` sang `SELLER` vì `AUDITOR` không còn. Trong bốn vai mới, `SELLER`
 * có bộ quyền NHỎ NHẤT: không một hành động ghi nào, và không một quyền đọc toàn hệ nào
 * (`audit:read`, `order:read:all`, `reconcile:read` đều không có). `CONTROLLER` cũng sạch
 * quyền ghi nhưng đọc được dữ liệu toàn hệ, nên chọn nó làm nơi quy về sẽ biến một cookie
 * gõ sai thành quyền xem sổ kiểm toán — đúng thứ nguyên tắc đóng phải tránh.
 *
 * ⚠️ Đây là quyết định FE-20 phải tự ra vì `requirements.md` không nói tới; đã ghi vào
 * mục câu hỏi mở của `docs/CHECKPOINT_FE20.md`.
 */
export const FALLBACK_ROLE: Role = 'SELLER';

/**
 * Nhóm quyền chỉ-đọc dùng chung cho hai vai phía ngân hàng (TELLER, CONTROLLER).
 *
 * ⚠️ KHÔNG thêm quyền cổng khu vực nào vào đây (`portfolio:read`, `seller:read`,
 * `ops:draft:read`, `ops:approve:read`). Mọi quyền trong nhóm này tự động có ở cả hai vai
 * vận hành, nên quyền nào dùng làm cổng mà nằm ở đây thì mất tác dụng chặn.
 *
 * `reconcile:read` đặt ở đây CÓ CHỦ Ý: cả hai vai vận hành đều được xem báo cáo
 * đối soát, còn INVESTOR và SELLER không spread nhóm này nên tự động không có.
 */
const READ_ONLY: Action[] = [
  'balance:read',
  'txn:read',
  'audit:read',
  // Hai vai vận hành đều phải xem được sổ lệnh toàn hệ để đối soát. `order:read:all`
  // KHÔNG phải cổng khu vực, nên đặt ở đây không vi phạm cảnh báo phía trên.
  'order:read',
  'order:read:all',
  'reconcile:read',
  // Cổng khu vực Vận hành: đúng hai vai này, và cả hai đều spread nhóm — nên đặt ở đây
  // là cách ngắn nhất nói "khu vực vận hành mở cho mọi vai vận hành".
  'ops:read',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  /**
   * Nhà đầu tư.
   *
   * `portfolio:read` CHỈ ở đây — đó là thứ chặn ba vai kia khỏi khu vực `(investor)`.
   * `order:place` và `settlement:confirm` cũng chỉ ở đây, vì là quyết định của nhà đầu tư.
   * `order:read` có, nhưng KHÔNG có `order:read:all`.
   */
  INVESTOR: [
    'token:transfer',
    'order:place',
    'order:read',
    'settlement:confirm',
    'portfolio:read',
    'wallet:connect',
    'balance:read',
    'txn:read',
  ],
  /**
   * Người bán — vai MỚI của FE-20, và là `FALLBACK_ROLE`.
   *
   * Bộ quyền nhỏ nhất trong bốn vai: xem khu vực của mình, xem số dư và giao dịch của ví
   * mình, xem lệnh của ví mình. KHÔNG một hành động ghi nào, và KHÔNG spread `READ_ONLY`
   * nên tự động không có dữ liệu toàn hệ (`audit:read`, `order:read:all`, `reconcile:read`).
   *
   * Nghiệp vụ tạo lệnh rút của Người bán thuộc BE-12; ở đây chưa cấp quyền ghi nào cho nó.
   */
  SELLER: ['seller:read', 'wallet:connect', 'balance:read', 'txn:read', 'order:read'],
  /**
   * Giao dịch viên — `BANK_ADMIN` cũ đổi tên, GIỮ NGUYÊN bộ quyền, cộng cổng khu vực.
   *
   * ⚠️ CỐ TÌNH KHÔNG có `order:place` và `settlement:confirm`. Hai hành động đó là
   * quyết định của nhà đầu tư; ngân hàng đặt lệnh hoặc xác nhận hoàn vốn thay nhà đầu tư
   * thì mất dấu ai đã đồng ý, và sổ kiểm toán không còn dùng để đối chiếu trách nhiệm.
   *
   * ⚠️ `ops:draft:read` ở đây và KHÔNG ở `CONTROLLER`: người lập lệnh không phải người duyệt.
   */
  TELLER: [
    'token:mint',
    'token:burn',
    'token:freeze',
    'token:clawback',
    'investor:whitelist',
    'kyc:approve',
    // Khớp lệnh và dọn lệnh treo là việc của ngân hàng: giao dịch do ví ngân hàng ký.
    'order:execute',
    'order:expire',
    'distribution:snapshot',
    'distribution:execute',
    'settlement:initiate',
    'settlement:set-nav',
    'treasury:manage',
    // Cần THÊM cờ ENABLE_DEMO_PAYMENT_MINT mới thực sự chạy — xem `demo-payment.ts`.
    'demo:mint-payment',
    'ops:draft:read',
    ...READ_ONLY,
  ],
  /**
   * Kiểm soát viên — vai MỚI của FE-20. Nhận phần CHỈ ĐỌC của hai vai đã gỡ, cộng cổng
   * mục Phê duyệt lệnh. Không một hành động ghi nào.
   *
   * ⚠️ KHÔNG nhận phần ghi của vai tuân thủ cũ (`investor:whitelist`, `kyc:approve`,
   * `token:freeze`) dù vai đó đã gỡ. Kiểm soát viên duyệt việc của Giao dịch viên; cho nó
   * tự làm mấy việc đó là gộp người làm với người duyệt vào một chỗ, tức mất đúng lớp kiểm
   * soát thứ hai mà vai này tồn tại để tạo ra. Ba hành động đó vẫn có chủ ở `TELLER` nên
   * không quyền nào thành vô chủ.
   *
   * ⚠️ `ops:approve:read` ở đây và KHÔNG ở `TELLER`: người duyệt không phải người lập.
   * Quyền DUYỆT thật (`order:approve`) thuộc BE-12, chưa khai ở FE-20.
   */
  CONTROLLER: ['ops:approve:read', ...READ_ONLY],
};
