import { getTokenInfo } from '@/lib/bank/token-request.service';
import { httpStatusFor } from '@/lib/bank/result';
import { traceRead } from '@/lib/diagnostics/read-trace';

/** GET chỉ đọc; service giữ cùng kiểm quyền ops:read và schema như Server Action. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return traceRead(request.headers.get('x-read-id'), async (id) => {
    const started = performance.now();
    const result = await getTokenInfo({
      chain: url.searchParams.get('chain'), tokenSymbol: url.searchParams.get('tokenSymbol'),
    });
    return Response.json(result, {
      status: result.ok ? 200 : httpStatusFor[result.code],
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Read-Id': id,
        'Server-Timing': `token_info;dur=${Math.round(performance.now() - started)}`,
      },
    });
  });
}
