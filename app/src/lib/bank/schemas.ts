import { z } from 'zod';
import { CHAIN_KEYS } from '@bidv/shared';
import { WPT_TOKEN_SYMBOL } from '@/lib/config/issue-terms';
import { ORDER_STATUSES } from './purchase.state';

/**
 * MỘT schema dùng chung cho form (client) và server action/route (server).
 * Không viết validate hai lần -> không lệch FE/BE.
 */

export const walletSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Địa chỉ ví phải là 0x + 40 ký tự hex.');

export const chainSchema = z.enum(CHAIN_KEYS);

/**
 * Số lượng token. WPT có decimals = 0 nên đây là SỐ NGUYÊN, nhận dạng chuỗi:
 * `number` của JS mất chính xác từ 2^53, còn uint256 thì lớn hơn nhiều.
 *
 * ⚠️ THỨ TỰ `.transform()` TRƯỚC `.refine()` LÀ BẮT BUỘC, không phải sở thích.
 *
 * Zod 4 vẫn chạy các `.refine()` còn lại SAU khi một check trước đó đã trượt (trừ khi
 * khai `abort`). Bản cũ đặt `.refine((v) => BigInt(v) > 0n)` ngay sau `.regex()`, nên với
 * `"1.5"` hay `"abc"` thì regex trượt rồi refine vẫn gọi `BigInt()` và ném `SyntaxError`
 * THÔ ra khỏi `safeParse`. Mà `safeParse` được gọi NGOÀI khối `try` của mọi service, nên
 * lỗi đó không thành `Result` mã `VALIDATION` — nó nổ thẳng ra server action, và ở
 * production Next che message thành "An error occurred". Người dùng nhập "1.5" sẽ thấy một
 * lỗi hệ thống vô nghĩa thay vì "số lượng phải là số nguyên".
 *
 * `.transform()` thì khác `.refine()`: nó tạo một pipe, và pipe KHÔNG chạy khi vế trước đã
 * trượt. Nên chuyển đổi sang `bigint` trước rồi so sánh trên `bigint` là an toàn.
 */
/**
 * KHÔNG `export`: đây là khối xây dựng cho `mintSchema` và `placeOrderSchema` trong cùng
 * tệp, không tệp nào ngoài tệp này dùng tới. Form cần validate riêng ô số lượng thì lấy
 * `placeOrderSchema.shape.wptAmount` — vẫn đúng một nguồn quy tắc, không thêm mặt tiền.
 */
const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Số lượng phải là số nguyên không dấu.')
  .transform((value) => BigInt(value))
  .refine((value) => value > 0n, 'Số lượng phải lớn hơn 0.');

export const onboardInvestorSchema = z.object({
  chain: chainSchema,
  wallet: walletSchema,
  fullName: z.string().trim().max(120).optional(),
  nationalId: z.string().trim().max(40).optional(),
});
export type OnboardInvestorInput = z.input<typeof onboardInvestorSchema>;

export const mintSchema = z.object({
  chain: chainSchema,
  wallet: walletSchema,
  amount: amountSchema,
});
/** `z.input` để form dùng amount dạng chuỗi; server nhận được bigint sau parse. */
export type MintInput = z.input<typeof mintSchema>;

/**
 * Phát hành nguồn cung ban đầu (BE-04).
 *
 * ⚠️ KHÔNG có trường số lượng, và đó là chốt chặn chính của schema này. Tổng cung đọc từ
 * `Project.totalSupply`; nhận nó từ input nghĩa là ai gọi được server action cũng đặt được quy mô
 * phát hành của cả dự án. Một `amount` optional ở đây cũng không được: optional thì vẫn có đường
 * truyền vào.
 *
 * `tokenSymbol` mặc định là token duy nhất của PoC, để lời gọi thường không phải truyền. Nhận
 * tham số để về sau có dự án thứ hai thì không phải đổi chữ ký.
 */
export const issueInitialSupplySchema = z.object({
  chain: chainSchema,
  /** Ví thanh toán SPV — nơi giữ toàn bộ WPT chưa bán. */
  spvWallet: walletSchema,
  tokenSymbol: z.string().trim().min(1).max(20).default(WPT_TOKEN_SYMBOL),
});
export type IssueInitialSupplyInput = z.input<typeof issueInitialSupplySchema>;

export const balanceQuerySchema = z.object({
  chain: chainSchema,
  wallet: walletSchema,
});

export const txnQuerySchema = z.object({
  chain: chainSchema.optional(),
  wallet: walletSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// =============================================================================
//  LỆNH MUA WPT (BE-02)
// =============================================================================

/**
 * Đặt lệnh. `wptAmount` nhận CHUỖI rồi chuyển sang `bigint` qua `amountSchema` —
 * cùng một schema với mint, không viết lại quy tắc "số nguyên dương" lần thứ hai.
 */
export const placeOrderSchema = z.object({
  chain: chainSchema,
  investorWallet: walletSchema,
  wptAmount: amountSchema,
});
/** `z.input` để form gửi `wptAmount` dạng chuỗi; server nhận `bigint` sau parse. */
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/**
 * Xem trước điều kiện mua (BE-03). CÙNG ba trường với đặt lệnh, nên dùng LẠI schema đó
 * thay vì khai lần thứ hai.
 *
 * Khai lại một schema cùng nội dung thì hai bản sẽ lệch nhau ở lần sửa đầu tiên, và hệ quả
 * đúng là thứ màn hình xem trước tồn tại để tránh: xem trước trả lời "đủ điều kiện" cho một
 * dữ liệu mà đặt lệnh từ chối vì sai dạng. Bút danh riêng ở đây chỉ để chỗ gọi đọc ra đúng
 * việc nó đang làm.
 */
export const previewPurchaseSchema = placeOrderSchema;
export type PreviewPurchaseInput = z.input<typeof previewPurchaseSchema>;

/**
 * ID lệnh: UUID, không phải chuỗi tự do.
 *
 * Ràng buộc dạng ở đây có giá trị thật: `executeOrder` tra lệnh theo id, nhận chuỗi
 * tuỳ ý thì một lời gọi sai sẽ đi tới tận truy vấn cơ sở dữ liệu mới trượt, và lỗi
 * trả về là "không tìm thấy lệnh" — nghe như lệnh đã biến mất, chứ không phải id sai.
 *
 * `.trim()` rồi mới `.pipe(z.uuid())`, không phải `z.uuid().trim()`: thứ tự sau sẽ kiểm
 * dạng TRƯỚC khi cắt khoảng trắng, nên một id dán từ log có xuống dòng ở cuối bị coi là
 * sai dạng. `z.string().uuid()` đã `@deprecated` ở Zod 4 nên không dùng.
 *
 * KHÔNG `export`: chỉ `executeOrderSchema` trong cùng tệp dùng tới.
 */
const orderIdSchema = z
  .string()
  .trim()
  .pipe(z.uuid('Mã lệnh phải là UUID.'));

export const executeOrderSchema = z.object({
  chain: chainSchema,
  orderId: orderIdSchema,
});
export type ExecuteOrderInput = z.input<typeof executeOrderSchema>;

/**
 * Truy vấn lệnh.
 *
 * `investorWallet` optional ở SCHEMA nhưng BẮT BUỘC ở tầng nghiệp vụ cho vai không có
 * quyền xem toàn bộ — xem `listOrders` trong `purchase.service.ts`. Đặt bắt buộc ngay
 * tại đây thì vai ngân hàng mất khả năng xem toàn hệ (R5.2); để nghiệp vụ quyết định
 * theo quyền là cách duy nhất phục vụ được cả R5.1 và R5.2 bằng một schema.
 */
export const orderQuerySchema = z.object({
  chain: chainSchema.optional(),
  investorWallet: walletSchema.optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type OrderQueryInput = z.input<typeof orderQuerySchema>;

/**
 * Hết hạn lệnh treo. Chặn dưới 1 phút là có chủ ý: gọi với 0 sẽ hết hạn ngay cả lệnh
 * vừa đặt xong một phần nghìn giây trước, tức là giết luồng mua ngay khi ai đó gọi
 * nhầm tham số.
 */
export const expireOrdersSchema = z.object({
  olderThanMinutes: z.coerce.number().int().min(1).max(60 * 24 * 30).default(30),
});
export type ExpireOrdersInput = z.input<typeof expireOrdersSchema>;

// =============================================================================
//  CHIA LỢI NHUẬN (BE-06)
// =============================================================================

/**
 * Mã kỳ chia do nghiệp vụ đặt, ví dụ `2026-Q1`. DUY NHẤT toàn hệ.
 *
 * Ràng buộc bộ ký tự là có giá trị thật, không phải làm cho có: mã kỳ đi vào `target` của sổ kiểm
 * toán và vào thông báo lỗi hiển thị cho người dùng, nên một mã chứa ký tự điều khiển hay dấu
 * `|` sẽ làm lệch bảng trong báo cáo và mở đường cho chuỗi lạ đi qua nhật ký. Cho phép chữ, số
 * và ba dấu nối là đủ cho mọi cách đặt tên kỳ (`2026-Q1`, `2026_06`, `thang.06`).
 *
 * KHÔNG `export`: chỉ hai schema trong cùng tệp này dùng tới.
 */
const periodKeySchema = z
  .string()
  .trim()
  .min(1, 'Mã kỳ không được rỗng.')
  .max(40, 'Mã kỳ tối đa 40 ký tự.')
  .regex(/^[A-Za-z0-9._-]+$/, 'Mã kỳ chỉ gồm chữ, số và các dấu . _ -');

/**
 * Mã kỳ chia trong cơ sở dữ liệu: UUID.
 *
 * `.trim()` rồi mới `.pipe(z.uuid())`, cùng thứ tự và cùng lý do với `orderIdSchema`.
 */
const periodIdSchema = z.string().trim().pipe(z.uuid('Mã kỳ chia phải là UUID.'));

/** Mở kỳ chia. KHÔNG có trường số tiền: tổng tiền đọc từ ví chia lợi nhuận trên chuỗi. */
export const openPeriodSchema = z.object({
  chain: chainSchema,
  periodKey: periodKeySchema,
});
export type OpenPeriodInput = z.input<typeof openPeriodSchema>;

/**
 * Trỏ tới một kỳ ĐÃ MỞ, dùng cho xem trước và cho chia theo lô.
 *
 * ⚠️ KHÔNG có trường kích thước lô. Kích thước lô đọc từ tham số hệ thống
 * `distribution.batch_size`; nhận nó từ input là tạo nguồn thứ hai, và khi hai nguồn lệch nhau
 * thì số lần gọi `distributeBatch` phụ thuộc người bấm chứ không phụ thuộc cấu hình đã đo trên
 * chuỗi.
 */
export const distributionPeriodSchema = z.object({
  chain: chainSchema,
  periodId: periodIdSchema,
});
export type DistributionPeriodInput = z.input<typeof distributionPeriodSchema>;

/**
 * Tra một kỳ theo mã kỳ HOẶC mã trong cơ sở dữ liệu — đúng một trong hai.
 *
 * Nhận cả hai vì hai người gọi biết hai thứ khác nhau: tiến trình vừa mở kỳ đang giữ `periodId`,
 * còn cán bộ ngân hàng chỉ biết `periodKey` ("2026-Q1") vì đó là thứ họ tự đặt. Bắt buộc
 * `periodId` sẽ buộc màn hình phải lưu một uuid mà người dùng không bao giờ nhìn thấy.
 *
 * Đòi ĐÚNG MỘT chứ không phải "ít nhất một": truyền cả hai mà chúng trỏ vào hai kỳ khác nhau thì
 * mọi thứ tự ưu tiên đều là đoán, và kết quả là đọc trạng thái của một kỳ mà người gọi không hỏi.
 */
export const distributionPeriodQuerySchema = z
  .object({
    chain: chainSchema,
    periodId: periodIdSchema.optional(),
    periodKey: periodKeySchema.optional(),
  })
  .refine((value) => Boolean(value.periodId) !== Boolean(value.periodKey), {
    message: 'Truyền đúng một trong hai: periodId hoặc periodKey.',
    path: ['periodId'],
  });
export type DistributionPeriodQueryInput = z.input<typeof distributionPeriodQuerySchema>;

// =============================================================================
//  TIẾN TRÌNH TỰ ĐỘNG CHIA (BE-07)
// =============================================================================

/**
 * Chạy MỘT vòng của tiến trình tự động chia.
 *
 * ⚠️ CHỈ có `chain`. Không có mã kỳ, không có số lô, không có ngưỡng — và đó là toàn bộ
 * điểm của tiến trình này: nó TỰ phát hiện phải làm gì. Nhận mã kỳ từ input là mời người gọi
 * chỉ định kỳ nào phải chia, tức là quay về đúng luồng bấm tay mà BE-06 đã có; còn nhận
 * ngưỡng hay số lô là tạo nguồn thứ hai cạnh tham số hệ thống, và khi hai nguồn lệch thì
 * quyết định "có mở kỳ hay không" phụ thuộc người gọi chứ không phụ thuộc cấu hình.
 *
 * `chain` vẫn phải có vì ảnh chụp số dư và ví lợi nhuận thuộc về MỘT chuỗi; một vòng chạy
 * không xử lý được hai chuỗi cùng lúc.
 */
export const distributionCycleSchema = z.object({
  chain: chainSchema,
});
export type DistributionCycleInput = z.input<typeof distributionCycleSchema>;

/** Đọc lịch chạy của tiến trình tự động chia. Cùng chặn 200 dòng với các truy vấn khác. */
export const keeperRunQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type KeeperRunQueryInput = z.input<typeof keeperRunQuerySchema>;
