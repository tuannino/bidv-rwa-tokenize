import type { Result } from '@/lib/bank/result';
import type { TokenInfoView } from '@/lib/bank/token-request.service';

export const TOKEN_INFO_TIMEOUT_MS = 15_000;
interface ResponseMetadata { status: number; cfRay: string | null }
export class TokenInfoTimeoutError extends Error {
  constructor(readonly response?: ResponseMetadata) { super(); }
}
export class TokenInfoServerError extends Error {
  constructor(readonly response: ResponseMetadata, detail?: string) { super(detail); }
}
export class TokenInfoNetworkError extends Error {
  constructor(readonly response?: ResponseMetadata) { super(); }
}

export function tokenInfoReadErrorMessage(error: unknown, id: string): string {
  const response = error instanceof TokenInfoTimeoutError || error instanceof TokenInfoServerError || error instanceof TokenInfoNetworkError
    ? error.response : undefined;
  const message = error instanceof TokenInfoServerError
    ? `Máy chủ trả lỗi.${error.message ? ` ${error.message}` : ''}`
    : error instanceof TokenInfoTimeoutError
      ? 'Quá thời gian chờ đọc thông tin token (15 giây).'
      : 'Mất kết nối tới máy chủ khi đọc thông tin token.';
  return `${message}${response ? ` HTTP ${response.status}.` : ''}${response?.cfRay ? ` CF-Ray: ${response.cfRay}.` : ''} Vui lòng thử lại. Mã tra cứu: ${id}`;
}

/** GET độc lập với hàng chờ Server Actions. Hủy fetch cũ; không tự gửi lại thao tác ghi. */
export async function fetchTokenInfo(
  chain: string, tokenSymbol: string, id: string, signal: AbortSignal,
): Promise<Result<TokenInfoView>> {
  const controller = new AbortController();
  let timedOut = false;
  let metadata: ResponseMetadata | undefined;
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
    metadata = { status: response.status, cfRay: response.headers.get('cf-ray') };
    let result: Result<TokenInfoView>;
    try { result = await response.json() as Result<TokenInfoView>; }
    catch (error) {
      if (!response.ok || error instanceof SyntaxError) throw new TokenInfoServerError(metadata, 'Phản hồi không hợp lệ.');
      throw error;
    }
    if (typeof result?.ok !== 'boolean' || (!response.ok && result.ok)) {
      throw new TokenInfoServerError(metadata, 'Phản hồi không hợp lệ.');
    }
    if (!response.ok || !result.ok) {
      throw new TokenInfoServerError(metadata, !result.ok && typeof result.error === 'string' ? result.error : undefined);
    }
    return result;
  } catch (error) {
    if (timedOut) throw new TokenInfoTimeoutError(metadata);
    if (signal.aborted || error instanceof TokenInfoServerError) throw error;
    throw new TokenInfoNetworkError(metadata);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
