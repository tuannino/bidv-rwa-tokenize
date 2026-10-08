#!/usr/bin/env node
/**
 * KIỂM KHÓI — xác nhận một bản đang chạy còn sống và đang chạy ĐÚNG bản mình nghĩ.
 *
 * Chạy bằng tay:
 *     node scripts/smoke-test.mjs http://localhost:3000
 *     node scripts/smoke-test.mjs https://<địa-chỉ> --expect-commit=$(git rev-parse HEAD)
 *     node scripts/smoke-test.mjs http://localhost:3000 --chain=hardhat-local --timeout=15000
 *     node scripts/smoke-test.mjs https://<địa-chỉ> --chain=evm --expect-commit=<sha>
 *
 * Mã thoát:  0 = đạt · 1 = có phép kiểm không đạt · 2 = gọi sai (thiếu địa chỉ, tham số lạ)
 *
 * ## Hai phép kiểm, và vì sao đúng hai phép đó
 *
 * 1. `GET /api/version` — trả lời "máy đang chạy bản nào". Một mình nó đủ để phân biệt "triển
 *    khai xong" với "triển khai xong nhưng vẫn là bản cũ", thứ mà `curl -I` báo 200 không phân
 *    biệt được.
 * 2. `GET /api/token?chain=mock` — một đường dẫn CHỈ ĐỌC đi qua tầng nghiệp vụ và cổng ledger.
 *    Cần phép kiểm này vì `/api/version` không chạm gì ngoài `process.env`: nó vẫn xanh khi
 *    tầng nghiệp vụ hỏng hoàn toàn.
 *
 * Mặc định `chain=mock` có chủ đích: bản mock luôn trả lời được, không cần node chuỗi lẫn cơ sở
 * dữ liệu, nên phép kiểm này đỏ thì đỏ vì ỨNG DỤNG, không vì hạ tầng chưa lên. Muốn kiểm chuỗi
 * thật thì truyền `--chain=`. Với `evm`, kiểm thêm metadata WPT và tổng cung đọc qua
 * EVM adapter. Đây là kiểm chỉ đọc, không chứng minh quyền ký hay Mint/Burn đã chạy.
 *
 * ## KHÔNG ghi gì
 *
 * Chỉ gọi `GET`. Kiểm khói chạy trên môi trường thật, nên một phép kiểm có ghi sẽ để lại dữ
 * liệu rác trong sổ sách ngân hàng mỗi lần triển khai.
 *
 * CHƯA gắn vào quy trình triển khai (OP-01 chỉ làm phần kiểm, không làm phần triển khai).
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CHAIN = 'mock';

const c = {
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  grn: (s) => `\u001b[32m${s}\u001b[0m`,
  yel: (s) => `\u001b[33m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
};

function usage() {
  console.error(`Dùng: node scripts/smoke-test.mjs <địa-chỉ-gốc> [tuỳ chọn]

  <địa-chỉ-gốc>            vd http://localhost:3000 hoặc https://ten-mien

Tuỳ chọn:
  --chain=<khoá>           chuỗi truyền cho /api/token (mặc định ${DEFAULT_CHAIN})
  --expect-commit=<sha>    ĐỎ nếu mã commit đang chạy khác giá trị này
  --timeout=<ms>           hạn chờ mỗi yêu cầu (mặc định ${DEFAULT_TIMEOUT_MS})`);
}

function parseArgs(argv) {
  let baseUrl;
  const opts = { chain: DEFAULT_CHAIN, expectCommit: undefined, timeoutMs: DEFAULT_TIMEOUT_MS };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') return { help: true, opts };
    if (arg.startsWith('--chain=')) opts.chain = arg.slice('--chain='.length);
    else if (arg.startsWith('--expect-commit=')) opts.expectCommit = arg.slice('--expect-commit='.length).trim();
    else if (arg.startsWith('--timeout=')) opts.timeoutMs = Number(arg.slice('--timeout='.length));
    else if (arg.startsWith('-')) return { error: `Tham số lạ: ${arg}` };
    else if (baseUrl === undefined) baseUrl = arg;
    else return { error: `Chỉ nhận MỘT địa chỉ gốc, nhận thêm: ${arg}` };
  }

  if (!baseUrl) return { error: 'Thiếu địa chỉ gốc.' };
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    return { error: `--timeout phải là số dương (ms), nhận: ${opts.timeoutMs}` };
  }
  try {
    // Chuẩn hoá và bỏ dấu `/` cuối để không sinh ra `//api/version`.
    const parsed = new URL(baseUrl);
    return { baseUrl: parsed.origin + parsed.pathname.replace(/\/$/, ''), opts };
  } catch {
    return { error: `Địa chỉ gốc không hợp lệ: ${baseUrl}` };
  }
}

/**
 * Gọi một đường dẫn, trả về `{ status, json }` hoặc `{ error }`.
 *
 * Có hạn chờ, KHÔNG để `fetch` chờ vô hạn: địa chỉ không truy cập được là ca dùng chính của
 * tập lệnh này, và một lần treo im lặng ở đó làm cả bước triển khai đứng lại không rõ lý do.
 */
async function get(baseUrl, path, timeoutMs) {
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { url, status: res.status, error: `thân phản hồi không phải JSON: ${text.slice(0, 120)}` };
    }
    return { url, status: res.status, json };
  } catch (cause) {
    const reason = cause?.name === 'TimeoutError' ? `quá hạn ${timeoutMs}ms` : (cause?.message ?? String(cause));
    return { url, error: `không gọi được: ${reason}` };
  }
}

const results = [];
const pass = (name, detail) => results.push({ name, detail, ok: true });
const fail = (name, detail) => results.push({ name, detail, ok: false });

/** Phép kiểm 1: đường dẫn đọc phiên bản. */
async function checkVersion(baseUrl, opts) {
  const name = 'GET /api/version';
  const res = await get(baseUrl, '/api/version', opts.timeoutMs);
  if (res.error) return fail(name, `${res.url} — ${res.error}`);
  if (res.status !== 200) return fail(name, `mong 200, nhận ${res.status}`);

  const data = res.json?.ok === true ? res.json.data : undefined;
  if (!data) return fail(name, `thân phản hồi không có { ok: true, data }: ${JSON.stringify(res.json).slice(0, 160)}`);

  const missing = ['commit', 'branch', 'buildTime'].filter(
    (k) => typeof data[k] !== 'string' || data[k].trim() === '',
  );
  if (missing.length > 0) return fail(name, `thiếu hoặc rỗng: ${missing.join(', ')}`);
  if (Number.isNaN(Date.parse(data.buildTime))) {
    return fail(name, `buildTime không đọc được thành mốc thời gian: ${data.buildTime}`);
  }

  // `source` nói từng trường lấy từ biến môi trường hay là giá trị dự phòng. Dự phòng KHÔNG
  // phải lỗi (chạy cục bộ là như vậy), nhưng trên môi trường thật nó nghĩa là quy trình triển
  // khai chưa truyền biến — in ra để người chạy thấy, không đỏ.
  const fallbacks = Object.entries(data.source ?? {})
    .filter(([, v]) => v === 'fallback')
    .map(([k]) => k);
  const note = fallbacks.length > 0 ? c.yel(` (dự phòng: ${fallbacks.join(', ')})`) : '';
  pass(name, `commit=${data.commit} nhánh=${data.branch} dựng=${data.buildTime}${note}`);

  if (opts.expectCommit) {
    const nameCommit = 'mã commit đang chạy khớp --expect-commit';
    if (data.commit === opts.expectCommit) pass(nameCommit, data.commit);
    else fail(nameCommit, `đang chạy ${data.commit}, mong ${opts.expectCommit}`);
  }
}

/** Phép kiểm 2: một đường dẫn CHỈ ĐỌC đi qua tầng nghiệp vụ. */
async function checkReadOnly(baseUrl, opts) {
  const path = `/api/token?chain=${encodeURIComponent(opts.chain)}`;
  const name = `GET ${path}`;
  const res = await get(baseUrl, path, opts.timeoutMs);
  if (res.error) return fail(name, `${res.url} — ${res.error}`);
  if (res.status !== 200) {
    return fail(name, `mong 200, nhận ${res.status} — ${JSON.stringify(res.json).slice(0, 160)}`);
  }

  const data = res.json?.ok === true ? res.json.data : undefined;
  if (!data) return fail(name, `thân phản hồi không có { ok: true, data }: ${JSON.stringify(res.json).slice(0, 160)}`);
  if (opts.chain === 'evm' && (data.symbol !== 'WPT' || data.decimals !== 0 ||
      typeof data.name !== 'string' || data.name.trim() === '' ||
      typeof data.totalSupply !== 'string' || !/^\d+$/.test(data.totalSupply))) {
    return fail(name, 'Phản hồi Sepolia không có metadata WPT decimals=0 và tổng cung nguyên không âm hợp lệ.');
  }
  if (typeof data.symbol !== 'string' || data.symbol.trim() === '') {
    return fail(name, `thiếu ký hiệu token trong phản hồi: ${JSON.stringify(data).slice(0, 160)}`);
  }
  if (data.chain !== opts.chain) {
    return fail(name, `trả về chuỗi "${data.chain}" trong khi yêu cầu "${opts.chain}"`);
  }
  pass(name, `${data.symbol} trên ${data.chain}, tổng cung ${data.totalSupply}`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    usage();
    return 0;
  }
  if (parsed.error) {
    console.error(c.red(parsed.error));
    console.error();
    usage();
    return 2;
  }

  const { baseUrl, opts } = parsed;
  console.log(`KIỂM KHÓI ${baseUrl}  ${c.dim(`(chuỗi=${opts.chain}, hạn chờ=${opts.timeoutMs}ms)`)}\n`);

  await checkVersion(baseUrl, opts);
  await checkReadOnly(baseUrl, opts);

  for (const r of results) {
    console.log(`  ${r.ok ? c.grn('PASS') : c.red('FAIL')}  ${r.name}\n        ${r.detail}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log();
  if (failed > 0) {
    console.log(c.red(`  => CHƯA ĐẠT: ${failed}/${results.length} phép kiểm đỏ.`));
    return 1;
  }
  console.log(c.grn(`  => ĐẠT toàn bộ ${results.length} phép kiểm.`));
  return 0;
}

process.exitCode = await main();
