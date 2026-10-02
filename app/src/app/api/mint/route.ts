import { mintToInvestorDirect } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/**
 * POST /api/mint — phát hành WPT TRỰC TIẾP cho nhà đầu tư đã whitelist.
 *
 * ⚠️ ĐƯỜNG DỮ LIỆU THỬ, không phải luồng phát hành chính — xem `mintToInvestorDirect` trong
 * `lib/bank/mint.service.ts`. Từ FE-22 nằm sau hai lớp chặn: quyền `demo:mint-token` và cờ
 * `ENABLE_DEMO_TOKEN_MINT` (mặc định tắt — tắt thì trả 403). Tạo token chính thức đi qua lập–duyệt.
 *
 * Giữ nguyên đường dẫn `/api/mint`: demo runner và test e2e đang gọi nó.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await mintToInvestorDirect(body);

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
