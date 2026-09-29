import { buildInfo } from '@/lib/config/build-info';

/**
 * Bắt buộc chạy lúc có yêu cầu, KHÔNG dựng sẵn lúc build.
 *
 * Next 16 không cache Route Handler theo mặc định, nhưng hàm `GET` dưới đây không dùng API
 * nào phụ thuộc yêu cầu, nên nó là ứng viên để tối ưu thành tĩnh — và nếu điều đó xảy ra thì
 * `BUILD_TIME`/`BUILD_COMMIT_SHA` bị đóng băng vào bản dựng. Với một đường dẫn đọc phiên bản
 * thì hỏng ngầm: nó vẫn trả 200 kèm một mã commit CŨ, tức kiểm khói sau triển khai báo xanh
 * cho đúng thứ nó phải phát hiện. Khai tường minh để hành vi không đổi theo phiên bản Next.
 */
export const dynamic = 'force-dynamic';

/**
 * GET /api/version — mã commit, nhánh, thời điểm dựng bản của bản đang chạy.
 *
 * KHÔNG yêu cầu xác thực, có chủ đích: đây là đường dẫn để kiểm khói sau triển khai
 * (`scripts/smoke-test.mjs`) và để trả lời "máy đang chạy bản nào" khi có sự cố — hai việc
 * phải làm được TRƯỚC khi đăng nhập được. Nó chỉ trả về mã commit, tên nhánh và mốc thời
 * gian; không đọc cơ sở dữ liệu, không gọi chuỗi, không chạm biến bí mật nào.
 *
 * Trả về theo khuôn `Result<T>` của `lib/bank/result.ts` (`{ ok, data }`) để người gọi không
 * phải phân biệt đường dẫn này với các đường dẫn khác.
 */
export function GET() {
  return Response.json({ ok: true, data: buildInfo() }, { status: 200 });
}
