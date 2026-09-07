import { z } from 'zod';
import { CHAIN_KEYS } from '@bidv/shared';

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
 */
export const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Số lượng phải là số nguyên không dấu.')
  .refine((value) => BigInt(value) > 0n, 'Số lượng phải lớn hơn 0.')
  .transform((value) => BigInt(value));

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
