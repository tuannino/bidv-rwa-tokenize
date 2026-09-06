import { listTransactions } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/** GET /api/txns?chain=...&wallet=...&limit=... — lịch sử giao dịch đã lưu. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await listTransactions({
    chain: url.searchParams.get('chain') ?? undefined,
    wallet: url.searchParams.get('wallet') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
