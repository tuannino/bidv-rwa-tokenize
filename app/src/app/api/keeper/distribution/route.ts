import { runDistributionCycle } from '@/lib/bank/distribution-trigger.service';
import { expireStaleOrders } from '@/lib/bank/purchase.service';
import { httpStatusFor } from '@/lib/bank/result';
import { keeperSecretMatches, serverEnv } from '@/lib/config/env';

/**
 * ĐIỂM VÀO cho tiến trình định kỳ của ngân hàng (BE-07).
 *
 * ## Vì sao là route handler chứ không phải bộ hẹn giờ trong ứng dụng
 *
 * Dựng `setInterval` trong tiến trình Next.js hỏng theo hai chiều ngược nhau, và cả hai đều
 * sinh ra từ cùng một chỗ sai. Trên VPS nhiều bản chạy song song thì MỖI bản chạy một bộ hẹn
 * giờ, tức là mỗi lịch nổ nhiều lần. Trên free-tier serverless thì không có tiến trình nào
 * sống đủ lâu để lịch nổ lần nào. Việc gọi định kỳ vì vậy thuộc HẠ TẦNG — cron của ngân hàng,
 * Cloudflare Cron Trigger, hay `systemd timer` — còn ứng dụng chỉ cung cấp một điểm vào.
 *
 * ## Vì sao KHÔNG mở công khai
 *
 * Lời gọi này CHUYỂN TIỀN cho nhà đầu tư. Bảo vệ bằng khoá bí mật trong `KEEPER_SECRET`, gửi
 * qua `Authorization: Bearer <khoá>`. Thiếu biến môi trường thì route từ chối HẾT: "chưa cấu
 * hình" phải là đóng, vì hỏng theo chiều mở ở đây nghĩa là ai biết đường dẫn cũng kích hoạt
 * được một lượt chia.
 *
 * Khoá bí mật KHÔNG thay RBAC. Nó chỉ trả lời "người gọi có phải tiến trình định kỳ của mình
 * hay không"; quyền `distribution:execute` và `order:expire` vẫn kiểm trong service theo vai
 * của phiên (PoC đọc `DEMO_ROLE`, AU-01 thay bằng SIWE). Hai lớp cho hai câu hỏi khác nhau,
 * nên gộp lại là mất một lớp.
 *
 * ## Không có GET
 *
 * `GET` là phương thức ĐỌC và Next.js cho phép đệm nó. Một lượt chia tiền sau một `GET` sẽ
 * chạy lại mỗi lần có thứ gì đi dò đường dẫn, và có thể trả về kết quả đã đệm của lượt trước.
 * Phương thức không được hỗ trợ trả về 405, đúng thứ ta muốn.
 *
 * ⚠️ TỆP NÀY KHÔNG CÓ MARKER VỊ TRÍ LUỒNG, cùng giới hạn đã ghi ở `api/purchase/route.ts`:
 * quy ước cho mỗi bước ĐÚNG MỘT số nguyên, nên hai transport song song vào cùng một bước
 * service không biểu diễn được. Bước vận chuyển gắn ở `app/src/app/actions/distribution.ts`.
 */

/** Hai việc chạy theo lịch. Danh sách đóng: tên lạ bị từ chối ở validate. */
const JOBS = ['distribution', 'expire-orders'] as const;
type Job = (typeof JOBS)[number];

const isJob = (value: unknown): value is Job => JOBS.includes(value as Job);

/** Khoá bí mật trong `Authorization: Bearer <khoá>`; `null` nếu header thiếu hoặc sai dạng. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;

  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme.toLowerCase() !== 'bearer' || rest.length !== 1) return null;
  return rest[0];
}

/**
 * POST /api/keeper/distribution — chạy MỘT vòng công việc theo lịch.
 *
 * Thân yêu cầu (đều không bắt buộc):
 *   `job`   `"distribution"` (mặc định) chạy một vòng chia tự động, `"expire-orders"` cho
 *           lệnh mua treo quá hạn về `EXPIRED`.
 *   `chain` chuỗi cần xử lý; thiếu thì lấy chain mặc định của bản triển khai.
 *
 * Vì sao `chain` có mặc định trong khi `distributionCycleSchema` đòi nó: một dòng cron gọn
 * nhất là `curl -X POST -H "Authorization: Bearer $KEEPER_SECRET" <url>` không kèm thân. Mặc
 * định lấy từ `NEXT_PUBLIC_DEFAULT_CHAIN` — cấu hình của bản triển khai, không phải hằng số
 * viết cứng ở tầng vận chuyển.
 */
export async function POST(request: Request) {
  if (!keeperSecretMatches(bearerToken(request))) {
    /**
     * MỘT câu trả lời cho cả hai trường hợp "thiếu khoá" và "khoá sai", và không nói khoá đã
     * được cấu hình hay chưa. Phân biệt ra là chỉ cho người dò biết họ đang ở bước nào.
     *
     * 401 chứ không 403: 403 nghĩa là "đã biết anh là ai, nhưng không được phép", mà ở đây ta
     * chưa nhận diện được người gọi. 403 dành cho lỗi RBAC trả về từ service.
     */
    return Response.json(
      {
        ok: false,
        code: 'FORBIDDEN',
        error:
          'Điểm vào tiến trình định kỳ cần khoá bí mật ở header `Authorization: Bearer <khoá>`.',
      },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const job = fields.job ?? 'distribution';
  if (!isJob(job)) {
    return Response.json(
      {
        ok: false,
        code: 'VALIDATION',
        error: `Công việc "${String(job)}" không có. Chọn một trong: ${JOBS.join(', ')}.`,
      },
      { status: httpStatusFor.VALIDATION },
    );
  }

  const result =
    job === 'expire-orders'
      ? await expireStaleOrders(fields)
      : await runDistributionCycle({
          ...fields,
          chain: fields.chain ?? serverEnv().defaultChain,
        });

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
