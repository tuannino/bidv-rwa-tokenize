import type { TokenSummary } from '@/lib/bank/portfolio.service';

type ActionResult = { ok: true; data: TokenSummary } | { ok: false; error: string };
export type Loaded = { key: string; data: TokenSummary | null; error: string | null };

/** Câu an toàn khi lời gọi bị reject (lỗi mạng, phản hồi không đọc được): không lộ nội dung lỗi. */
export const LOAD_FAILED = 'Chưa đọc được thông tin token, thử tải lại trang.';

const inflight = new Map<string, Promise<unknown>>();

/**
 * FIX-04 F2: gộp lời gọi đang chạy theo khoá, để hai hộp của Tổng quan Nhà đầu tư chỉ tạo MỘT lời gọi
 * (HF-01 (hiệu năng mở màn): không tăng số lời gọi khi mở màn). Xong, kể cả bị reject, thì bỏ khỏi
 * bảng gộp: lần sau gọi lại được.
 */
export function shareInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const started = run().finally(() => inflight.delete(key));
  inflight.set(key, started);
  return started;
}

/** Luôn trả `Loaded`, KHÔNG reject: kết quả lỗi và lời gọi bị reject đều thành `error`. */
export async function loadTokenSummary(chain: string, call: (chain: string) => Promise<ActionResult>): Promise<Loaded> {
  try {
    const result = await shareInflight(`token-summary:${chain}`, () => call(chain));
    return result.ok ? { key: chain, data: result.data, error: null } : { key: chain, data: null, error: result.error };
  } catch {
    return { key: chain, data: null, error: LOAD_FAILED };
  }
}

/** Kết quả của chain cũ không được dùng cho chain đang chọn. */
export function freshFor(chain: string, loaded: Loaded | null): Loaded | null {
  return loaded?.key === chain ? loaded : null;
}

/** F4: tên dự án thật khi có; còn lại (đang tải, lỗi, `null`) thì tên mẫu kèm cờ "unverified". */
export function projectNameView(fresh: Loaded | null, sampleName: string): { text: string; unverified: boolean } {
  const name = fresh?.data?.projectName;
  return name ? { text: name, unverified: false } : { text: sampleName, unverified: true };
}
