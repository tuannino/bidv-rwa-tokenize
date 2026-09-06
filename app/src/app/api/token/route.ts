import { resolveChainKey } from '@/lib/chains/registry';
import { tokenOverview } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/** GET /api/token?chain=... — thông tin token trên chain đang chọn. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await tokenOverview(resolveChainKey(url.searchParams.get('chain')));

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
