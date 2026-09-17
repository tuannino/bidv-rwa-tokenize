/**
 * Chỗ giữ state của MỌI bản lưu trữ trong bộ nhớ.
 *
 * State đặt trên `globalThis` để không bị xoá khi Next.js nạp lại module giữa các
 * request — module scope thì mất, `globalThis` thì không.
 *
 * Vì sao gom vào MỘT chỗ thay vì mỗi bản một khoá riêng: test cần dọn sạch giữa hai ca
 * kiểm, và với năm khoá rời rạc thì `resetMemoryStore()` phải liệt kê đủ năm — thêm cổng
 * thứ sáu mà quên bổ sung là test này rò dữ liệu sang test kia, và triệu chứng là một
 * test đỏ tuỳ theo thứ tự chạy. Một khoá thì xoá là xoá hết.
 */

const GLOBAL_KEY = '__bidvMemoryStores__';

type Namespaces = Record<string, unknown>;

function namespaces(): Namespaces {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Namespaces };
  holder[GLOBAL_KEY] ??= {};
  return holder[GLOBAL_KEY];
}

/**
 * State của một vùng, tạo lần đầu bằng `init`.
 *
 * PHẢI gọi lại mỗi lần truy cập, không được giữ kết quả trong closure: giữ lại thì sau
 * `resetMemoryStores()` chỗ gọi vẫn ghi vào đối tượng cũ đã bị bỏ, và dữ liệu "biến mất"
 * theo cách rất khó lần.
 */
export function memoryState<T extends object>(namespace: string, init: () => T): T {
  const all = namespaces();
  all[namespace] ??= init();
  return all[namespace] as T;
}

/** Xoá toàn bộ dữ liệu trong bộ nhớ của mọi cổng. Dùng cho test và demo. */
export function resetMemoryStores(): void {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Namespaces };
  delete holder[GLOBAL_KEY];
}
