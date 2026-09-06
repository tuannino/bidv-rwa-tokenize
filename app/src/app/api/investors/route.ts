import { onboardInvestor } from '@/lib/bank/mint.service';
import { httpStatusFor } from '@/lib/bank/result';

/**
 * POST /api/investors — KYC (mock auto-approve) + whitelist on-chain.
 *
 * Transport mỏng có chủ ý: RBAC, validate, audit đều nằm trong `mint.service`,
 * nên endpoint này không thể lỡ mất guard nào.
 * Dùng bởi demo runner (`npm run demo:mint`) và test e2e.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await onboardInvestor(body);

  return Response.json(result, {
    status: result.ok ? 200 : httpStatusFor[result.code],
  });
}
