import { mintToInvestorDirect } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/**
 * POST /api/mint — phát hành WPT TRỰC TIẾP cho nhà đầu tư đã whitelist.
 *
 * ⚠️ Đường nền cho bản trình diễn, không phải luồng phát hành chính — xem
 * `mintToInvestorDirect` trong `lib/bank/mint.service.ts`. Luồng chính là phát hành một lần
 * vào ví SPV (`lib/bank/issuance.service.ts`) rồi nhà đầu tư mua từ đó.
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
