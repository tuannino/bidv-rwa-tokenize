'use server';

import { setFireblocksCustody } from '@/lib/bank/custody.service';

/**
 * IN-04: bật, tắt công tắc "Lưu ký Fireblocks". Vỏ mỏng: kiểm quyền `custody:toggle`, kiểm cấu hình
 * và ghi sổ nằm TRONG service (server action gọi được bằng POST trực tiếp). Chỉ chạy khi người dùng
 * bấm công tắc, không chạy khi mở màn.
 */
export async function setFireblocksCustodyAction(input: unknown) {
  return setFireblocksCustody(input);
}
