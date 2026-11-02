/**
 * Lần đọc THÊM lỗi thì trả `null` và ghi log, không làm cả lời gọi thất bại (FIX-04 QĐ-3, FIX-05 QĐ-3).
 * Log chỉ ghi tên lỗi: nội dung lỗi có thể chứa địa chỉ RPC kèm khoá.
 */
export async function readOrNull<T>(scope: string, label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.error(`[${scope}] Không đọc được ${label}:`, error instanceof Error ? error.name : 'Error');
    return null;
  }
}
