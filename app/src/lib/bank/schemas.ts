import { z } from 'zod';
import { CHAIN_KEYS } from '@bidv/shared';
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
export const amountSchema = z
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
 * ID lệnh: UUID, không phải chuỗi tự do.
 *
 * Ràng buộc dạng ở đây có giá trị thật: `executeOrder` tra lệnh theo id, nhận chuỗi
 * tuỳ ý thì một lời gọi sai sẽ đi tới tận truy vấn cơ sở dữ liệu mới trượt, và lỗi
 * trả về là "không tìm thấy lệnh" — nghe như lệnh đã biến mất, chứ không phải id sai.
 *
 * `.trim()` rồi mới `.pipe(z.uuid())`, không phải `z.uuid().trim()`: thứ tự sau sẽ kiểm
 * dạng TRƯỚC khi cắt khoảng trắng, nên một id dán từ log có xuống dòng ở cuối bị coi là
 * sai dạng. `z.string().uuid()` đã `@deprecated` ở Zod 4 nên không dùng.
 */
export const orderIdSchema = z
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
