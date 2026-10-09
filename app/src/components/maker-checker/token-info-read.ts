import type { Result } from '@/lib/bank/result';
import type { TokenInfoView } from '@/lib/bank/token-request.service';

export const TOKEN_INFO_TIMEOUT_MS = 15_000;
export class TokenInfoTimeoutError extends Error {}

/** GET độc lập với hàng chờ Server Actions. Hủy fetch cũ; không tự gửi lại thao tác ghi. */
export async function fetchTokenInfo(
  chain: string, tokenSymbol: string, id: string, signal: AbortSignal,
): Promise<Result<TokenInfoView>> {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TOKEN_INFO_TIMEOUT_MS);
  try {
    const query = new URLSearchParams({ chain, tokenSymbol });
    const response = await fetch(`/api/token-info?${query}`, {
      cache: 'no-store', credentials: 'same-origin',
      headers: { 'X-Read-Id': id }, signal: controller.signal,
    });
    const result = await response.json() as Result<TokenInfoView>;
    if (typeof result?.ok !== 'boolean' || (!response.ok && result.ok)) {
      throw new Error('INVALID_READ_RESPONSE');
    }
    return result;
  } catch (error) {
    if (timedOut) throw new TokenInfoTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
