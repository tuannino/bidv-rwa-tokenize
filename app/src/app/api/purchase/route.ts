import { executeOrder, listOrders, placeOrder } from '@/lib/bank/purchase.service';
import { httpStatusFor } from '@/lib/bank/result';

/**
 * Transport HTTP cho luồng mua WPT — dùng bởi kịch bản demo và kiểm thử đầu cuối.
 *
 * ⚠️ KHÔNG có guard quyền ở tệp này. Toàn bộ kiểm quyền và ghi sổ kiểm toán nằm trong
 * `purchase.service`, để hai transport (server action + route handler) không thể lệch nhau.
 * Xem ghi chú đầy đủ ở `app/src/app/actions/purchase.ts`.
 *
 * `expireStaleOrders` CỐ Ý không có ở đây: nó là thao tác dọn dẹp theo lịch của BE-07, mở
 * một điểm vào HTTP cho nó là mời gọi việc gọi tay giữa lúc có lệnh đang xử lý.
 *
 * ⚠️ TỆP NÀY KHÔNG CÓ MARKER VỊ TRÍ LUỒNG, và đó là giới hạn của quy ước chứ không phải
 * bỏ sót. Quy ước ở `.kiro/steering/make-control.md` mục 4 cho mỗi bước ĐÚNG MỘT số nguyên,
 * nên hai transport song song vào cùng một bước service không biểu diễn được: gắn cả hai
 * chỗ sẽ thành hai marker trùng số bước và `scan-pending.mjs --check` báo `BAD_FLOW_STEP`.
 * Vì vậy bước vận chuyển chỉ gắn ở `app/src/app/actions/purchase.ts`, còn đường này được
 * nhắc trong chính nhãn của bước đó. Sơ đồ sinh ra: `docs/flows/purchase.md`.
 */

/**
 * POST /api/purchase — đặt lệnh, hoặc khớp lệnh khi thân yêu cầu có `orderId`.
 *
 * Một điểm vào cho hai việc là vì `Result` đã mang mã lỗi riêng cho từng tình huống, nên
 * không cần hai đường dẫn để phân biệt kết quả. Phân nhánh bằng sự có mặt của `orderId`,
 * KHÔNG bằng một trường `action` tự đặt: `orderId` là dữ liệu thật của nghiệp vụ, còn
 * `action` là một tên do transport bịa ra và service sẽ phải biết tới nó.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  const isExecute =
    typeof body === 'object' && body !== null && 'orderId' in body && body.orderId !== undefined;

  const result = isExecute ? await executeOrder(body) : await placeOrder(body);

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}

/** GET /api/purchase?chain=...&investorWallet=...&status=...&limit=... — sổ lệnh. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await listOrders({
    chain: url.searchParams.get('chain') ?? undefined,
    investorWallet: url.searchParams.get('investorWallet') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
