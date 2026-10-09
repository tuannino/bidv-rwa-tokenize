import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { serverEnv } from '@/lib/config/env';

interface ReadTrace {
  id: string;
  started: number;
  enabled: boolean;
}
const context = new AsyncLocalStorage<ReadTrace>();

/** Không nhận URL, SQL, tham số, error.message hoặc dữ liệu người dùng vào log. */
function emit(trace: ReadTrace, stage: string, state: string, started: number, error?: unknown) {
  if (!trace.enabled) return;
  const code = (error as { code?: unknown } | null)?.code;
  console.info(JSON.stringify({
    event: 'op06.read', id: trace.id, stage, state,
    ms: Math.round(performance.now() - started),
    elapsedMs: Math.round(performance.now() - trace.started),
    // Chỉ SQLSTATE chuẩn, không ghi nội dung exception có thể chứa credential.
    ...(typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? { code } : {}),
  }));
}

export async function traceRead<T>(id: string | null, body: (id: string) => Promise<T>): Promise<T> {
  const trace: ReadTrace = {
    id: id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : randomUUID(),
    started: performance.now(), enabled: serverEnv().enableReadDiagnostics,
  };
  return context.run(trace, () => readStep('request', () => body(trace.id)));
}

export async function readStep<T>(stage: string, body: () => Promise<T>): Promise<T> {
  const trace = context.getStore();
  if (!trace) return body();
  const started = performance.now();
  emit(trace, stage, 'start', started);
  try {
    const result = await body();
    emit(trace, stage, 'ok', started);
    return result;
  } catch (error) {
    emit(trace, stage, 'error', started, error);
    throw error;
  }
}
