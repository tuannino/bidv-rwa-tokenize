import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTokenInfo, TOKEN_INFO_TIMEOUT_MS, TokenInfoTimeoutError, TokenInfoServerError, TokenInfoNetworkError, tokenInfoReadErrorMessage } from '@/components/maker-checker/token-info-read';

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
    await expect(fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal)).rejects.toMatchObject({
      response: { status: 403, cfRay: null }, message: denied.error,
    });
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
    await expect(fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal)).rejects.toBeInstanceOf(TokenInfoNetworkError);
    const message = tokenInfoReadErrorMessage(new TokenInfoNetworkError(), 'id');
    expect(message).toContain('Mất kết nối'); expect(message).not.toContain('HTTP');
    expect(message).not.toContain('CF-Ray'); expect(message).not.toContain('Quá thời gian');
  });
  it('đổi nội dung/hủy màn hình hủy lượt cũ và dọn timer', async () => {
    vi.useFakeTimers(); vi.stubGlobal('fetch', pendingFetch());
    const controller = new AbortController();
    const result = expect(fetchTokenInfo('evm', 'WPT', 'id', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await result; expect(vi.getTimerCount()).toBe(0);
  });
});


describe('thông báo tra cứu phân biệt HTTP, timeout và mạng', () => {
  it('lỗi Cloudflare HTML vẫn hiện HTTP và cf-ray, không nhầm mất kết nối', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>upstream unavailable</html>', {
      status: 502, headers: { 'cf-ray': 'abc123-SIN' },
    })));
    const error = await fetchTokenInfo('evm', 'WPT', 'lookup-id', new AbortController().signal).catch((error) => error);
    expect(error).toBeInstanceOf(TokenInfoServerError);
    const message = tokenInfoReadErrorMessage(error, 'lookup-id');
    expect(message).toContain('Máy chủ trả lỗi'); expect(message).toContain('HTTP 502');
    expect(message).toContain('CF-Ray: abc123-SIN'); expect(message).toContain('Mã tra cứu: lookup-id');
    expect(message).not.toContain('Mất kết nối'); expect(message).not.toContain('<html>');
  });
  it('lỗi JSON giữ thông báo nghiệp vụ và HTTP khi không có cf-ray', () => {
    const message = tokenInfoReadErrorMessage(new TokenInfoServerError({ status: 403, cfRay: null }, 'Không có quyền.'), 'id');
    expect(message).toContain('Máy chủ trả lỗi'); expect(message).toContain('Không có quyền.');
    expect(message).toContain('HTTP 403'); expect(message).not.toContain('CF-Ray');
  });
  it('phản hồi 200 sai khuôn được gọi là lỗi máy chủ, có status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ unexpected: true })));
    const error = await fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal).catch((error) => error);
    expect(error).toBeInstanceOf(TokenInfoServerError);
    expect(tokenInfoReadErrorMessage(error, 'id')).toContain('HTTP 200');
  });
  it('quá hạn đọc body vẫn giữ HTTP/cf-ray đã nhận', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => Promise.resolve({
      status: 200, ok: true, headers: new Headers({ 'cf-ray': 'abc456-HKG' }),
      json: () => new Promise((_resolve, reject) => {
        options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    })));
    const read = fetchTokenInfo('evm', 'WPT', 'id', new AbortController().signal);
    const result = read.catch((error) => error);
    await vi.advanceTimersByTimeAsync(TOKEN_INFO_TIMEOUT_MS);
    const error = await result;
    expect(error).toBeInstanceOf(TokenInfoTimeoutError);
    expect(error).toMatchObject({ response: { status: 200, cfRay: 'abc456-HKG' } });
    const message = tokenInfoReadErrorMessage(error, 'id');
    expect(message).toContain('Quá thời gian chờ'); expect(message).toContain('HTTP 200');
    expect(message).toContain('CF-Ray: abc456-HKG'); expect(message).not.toContain('Mất kết nối');
    expect(vi.getTimerCount()).toBe(0);
  });
});
