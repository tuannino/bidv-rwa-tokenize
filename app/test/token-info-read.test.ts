import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTokenInfo, TOKEN_INFO_TIMEOUT_MS, TokenInfoTimeoutError } from '@/components/maker-checker/token-info-read';

function pendingFetch() {
  return vi.fn((_url, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
  }));
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('tra cứu WPT độc lập và có hủy', () => {
  it('GET cùng session, không cache, giữ lỗi quyền trả từ service', async () => {
    const denied = { ok: false, code: 'FORBIDDEN', error: 'Không có quyền.' };
    const fetch = vi.fn().mockResolvedValue(Response.json(denied, { status: 403 }));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal)).toEqual(denied);
    expect(fetch.mock.calls[0][0]).toBe('/api/token-info?chain=evm&tokenSymbol=WPT');
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin' });
  });
  it('hết hạn hủy fetch và báo đúng loại timeout', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', pendingFetch());
    const read = fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal);
    const result = expect(read).rejects.toBeInstanceOf(TokenInfoTimeoutError);
    await vi.advanceTimersByTimeAsync(TOKEN_INFO_TIMEOUT_MS); await result;
  });
  it('lỗi mạng ngay không bị gọi nhầm timeout', async () => {
    const error = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal)).rejects.toBe(error);
  });
  it('đổi nội dung/hủy màn hình hủy lượt cũ và dọn timer', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', pendingFetch());
    const controller = new AbortController();
    const result = expect(fetchTokenInfo('evm', 'WPT', 'id', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await result; expect(vi.getTimerCount()).toBe(0);
  });
});
