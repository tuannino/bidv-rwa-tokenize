import { mintTokens } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/** POST /api/mint — phát hành WPT cho nhà đầu tư đã whitelist. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await mintTokens(body);

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
