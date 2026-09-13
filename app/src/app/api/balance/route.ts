import { readBalance } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/** GET /api/balance?chain=...&wallet=0x... — số dư on-chain + trạng thái tuân thủ. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await readBalance({
    chain: url.searchParams.get('chain') ?? undefined,
    wallet: url.searchParams.get('wallet') ?? undefined,
  });

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
