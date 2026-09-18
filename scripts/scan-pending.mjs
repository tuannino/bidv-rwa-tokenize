#!/usr/bin/env node
// =============================================================================
//  QUÉT ĐIỂM CẮM — đọc marker @pending / @blocked / @flow trong mã nguồn
//
//  Chạy từ GỐC repo:
//    node scripts/scan-pending.mjs            in bảng cho người đọc (mã thoát 0)
//    node scripts/scan-pending.mjs --json     in JSON ra stdout, KHÔNG in gì khác
//    node scripts/scan-pending.mjs --check    mã thoát 1 nếu marker có lỗi
//
//  Quy ước đầy đủ: .kiro/steering/make-control.md
//  Nguồn trạng thái task: .kiro/task-status.json (nguồn DUY NHẤT)
//
// -----------------------------------------------------------------------------
//  CÚ PHÁP NHẬN DẠNG
// -----------------------------------------------------------------------------
//    @pending <MÃ-TASK> | <đã sẵn những gì>     code ĐÃ chạy được, chờ người gọi
//    @blocked <MÃ-TASK> | <thiếu gì>            code CHƯA chạy được, đang ném lỗi
//    @flow <tên-luồng>:<số bước> | <việc của bước này>
//
//  <MÃ-TASK> dạng [A-Z]{2,3}-\d{2} và phải nằm trong hợp done+inProgress+planned
//  của .kiro/task-status.json. <tên-luồng> chỉ được là một trong năm tên:
//  purchase, issue, distribute, settle, onboard.
//
//  Một dòng mang TỐI ĐA MỘT marker. Dòng vừa có marker đúng vừa có từ khóa bị cấm
//  thì chỉ báo lỗi từ khóa bị cấm — dòng đó đang ở trạng thái lỗi nên không đếm
//  vào bảng.
//
// -----------------------------------------------------------------------------
//  --check BÁO ĐỎ ĐÚNG NHỮNG TRƯỜNG HỢP SAU, KHÔNG HƠN
// -----------------------------------------------------------------------------
//    BAD_SYNTAX        có từ khóa nhưng không khớp cú pháp đầy đủ (thiếu mã task,
//                      thiếu dấu |, mô tả rỗng, số bước thập phân, sai chữ hoa)
//    UNKNOWN_TASK      mã task không có trong .kiro/task-status.json
//    STALE_TASK        marker lạc hậu: mã task đã nằm trong danh sách done
//    FORBIDDEN_KEYWORD biến thể bị cấm theo steering mục 5
//    BAD_FLOW_NAME     tên luồng ngoài năm tên đã chốt
//    BAD_FLOW_STEP     số bước trùng, không bắt đầu từ 1, hoặc nhảy cách
//    BAD_TASK_STATUS   .kiro/task-status.json vi phạm bất biến "một mã ở đúng một
//                      danh sách" — khi đó UNKNOWN_TASK và STALE_TASK vô nghĩa nên
//                      phải đỏ chứ không được im lặng bỏ qua
//
//  CÒN NHIỀU ĐIỂM CẮM LÀ BÌNH THƯỜNG, KHÔNG LÀM ĐỎ. Điểm cắm là trạng thái công
//  việc, không phải lỗi. Đừng thêm phép kiểm "số điểm cắm phải giảm".
//
// -----------------------------------------------------------------------------
//  VÌ SAO PHẢI TỰ LOẠI TRỪ BA TỆP (đừng xóa danh sách SELF_EXCLUDED)
// -----------------------------------------------------------------------------
//  Chính tệp này chứa chuỗi marker trong khối chú thích và trong biểu thức chính
//  quy. app/test/pending-markers.test.ts (Bước 4) chứa marker giả làm dữ liệu
//  kiểm thử. scripts/gen-flow-diagram.mjs (Bước 9) cũng khớp cùng cú pháp.
//
//  Nếu quét luôn ba tệp đó thì --check đỏ vì marker GIẢ — lỗi không có thật, và
//  người sửa sẽ đi tìm nguyên nhân ở chỗ không có gì sai. Vì vậy ba tệp này bị
//  loại theo đường dẫn tường minh. Thêm tệp mới vào danh sách chỉ khi tệp đó
//  thật sự là công cụ/kiểm thử của chính cơ chế marker, không phải để "cho xanh".
//
// -----------------------------------------------------------------------------
//  CẤU TRÚC --json (ổn định, test và scripts/gen-flow-diagram.mjs đọc vào)
// -----------------------------------------------------------------------------
//  {
//    "markers": [ { "kind": "pending"|"blocked", "task": "FE-05",
//                   "file": "app/src/...", "line": 12,
//                   "note": "...", "symbol": "placeOrderAction"|null } ],
//    "flows":   [ { "flow": "purchase", "step": 3, "file": "...", "line": 12,
//                   "note": "...", "symbol": "..."|null } ],
//    "byTask":  { "FE-05": 3 },                       tổng điểm cắm + điểm chặn
//    "errors":  [ { "code": "...", "file": "...", "line": 0, "message": "..." } ],
//    "summary": { "pending": 0, "blocked": 0, "flows": 0, "errors": 0 }
//  }
//
//  "symbol" là tên hàm/biến ở dòng khai báo ngay dưới marker, dùng để vẽ sơ đồ
//  luồng. Suy không ra thì là null — KHÔNG đoán.
//  Mã thoát của --json luôn là 0: nó là bản xuất dữ liệu, lỗi nằm trong "errors".
//
//  Môi trường: Node 20 trở lên, ESM thuần, KHÔNG phụ thuộc gói ngoài.
//  Không dùng fs.globSync (chỉ có từ Node 22) — tự đi cây thư mục.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Vị trí gốc repo: tệp này nằm ở <gốc>/scripts/ ---------------------------
const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TASK_STATUS_FILE = '.kiro/task-status.json';

// --- Phạm vi quét ------------------------------------------------------------
// Marker sống trong MÃ NGUỒN. docs/ và .kiro/ bị loại có chủ đích: hai thư mục
// đó chứa VÍ DỤ về marker (steering, spec, checkpoint), quét vào là báo lỗi giả.
const SCAN_ROOTS = [
  'app/src',
  'app/test',
  'app/e2e',
  'packages/*/src',
  'packages/*/contracts',
  'scripts',
];

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.open-next',
  '.git',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  'test-results',
  'playwright-report',
  'blob-report',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
  '.sol', '.rs', '.sh',
]);

// Xem khối "VÌ SAO PHẢI TỰ LOẠI TRỪ BA TỆP" ở đầu tệp trước khi sửa danh sách này.
const SELF_EXCLUDED = new Set([
  'scripts/scan-pending.mjs',
  'scripts/gen-flow-diagram.mjs',
  'app/test/pending-markers.test.ts',
]);

// --- Cú pháp -----------------------------------------------------------------
// Đây là NƠI DUY NHẤT định nghĩa cú pháp marker. Bước 9 và test nhập từ đây,
// không viết lại biểu thức chính quy ở chỗ khác.
export const TASK_CODE_SOURCE = '[A-Z]{2,3}-\\d{2}';

/** `@pending FE-05 | mô tả` hoặc `@blocked SC-02 | mô tả` */
export const MARKER_RE = new RegExp(
  `@(pending|blocked)[ \\t]+(${TASK_CODE_SOURCE})[ \\t]*\\|(.*)$`,
);

/** `@flow purchase:3 | mô tả` — số bước là số nguyên, không thập phân */
export const FLOW_RE = /@flow[ \t]+([a-z][a-z0-9-]*):(\d{1,3})[ \t]*\|(.*)$/;

/** Dò "có từ khóa" để phân biệt "sai cú pháp" với "không phải marker" */
export const LOOSE_RE = /@(pending|blocked|flow)/i;

/** Biến thể dạng marker bị cấm (steering mục 5) — so không phân biệt chữ hoa */
export const FORBIDDEN_MARKER_RE = /@waiting|@blocked-by|@pending-on|@todo/gi;

/** Từ khóa ghi chú bị cấm — CHỈ dạng chữ hoa, để không bắt oan chữ thường
 *  trong câu văn tiếng Anh thông thường (ví dụ từ "hack" trong một câu giải thích) */
export const FORBIDDEN_WORD_RE = /\b(TODO|FIXME|HACK|XXX)\b/g;

/** Năm tên luồng đã chốt (steering mục 4) */
export const FLOW_NAMES = Object.freeze([
  'purchase',
  'issue',
  'distribute',
  'settle',
  'onboard',
]);

// Nhãn tiếng Việt cho hai loại marker
const KIND_LABEL = { pending: 'điểm cắm', blocked: 'điểm chặn' };
const KIND_TAG = { pending: '[cắm] ', blocked: '[chặn]' };

// --- Suy tên ký hiệu từ dòng khai báo ngay dưới marker -----------------------
// Thứ tự quan trọng: mẫu hẹp trước, mẫu method chung chung để cuối.
const SYMBOL_PATTERNS = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/,
  /^\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+)*(?:async\s+)?(?:get\s+|set\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/,
];

/** Dòng chỉ chứa chú thích, thuộc tính, hoặc rỗng — bỏ qua khi tìm khai báo */
function isSkippableLine(line) {
  const t = line.trim();
  if (t === '') return true;
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#')) return true;
  if (t.startsWith('@')) return true; // decorator TS
  return false;
}

/** Tên hàm/biến ở khai báo ngay dưới marker; null nếu suy không ra */
export function inferSymbol(lines, markerIndex) {
  for (let i = markerIndex + 1; i < lines.length && i <= markerIndex + 5; i += 1) {
    const line = lines[i];
    if (isSkippableLine(line)) continue;
    for (const re of SYMBOL_PATTERNS) {
      const m = re.exec(line);
      if (m) return m[1];
    }
    return null; // gặp dòng mã nhưng không nhận ra khai báo → đừng đoán
  }
  return null;
}

// --- Đọc nguồn trạng thái task ----------------------------------------------
/**
 * Đọc .kiro/task-status.json và kiểm bất biến "một mã ở đúng một danh sách".
 * Trả về { done:Set, valid:Set, errors:[] }.
 */
export function readTaskStatus(repoRoot = REPO_ROOT) {
  const errors = [];
  const abs = path.join(repoRoot, TASK_STATUS_FILE);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    errors.push({
      code: 'BAD_TASK_STATUS',
      file: TASK_STATUS_FILE,
      line: 0,
      message: `không đọc được nguồn trạng thái task: ${err.message}`,
    });
    return { done: new Set(), valid: new Set(), errors };
  }

  const lists = { done: raw.done ?? [], inProgress: raw.inProgress ?? [], planned: raw.planned ?? [] };
  const seen = new Map();
  for (const [listName, codes] of Object.entries(lists)) {
    for (const code of codes) {
      if (seen.has(code)) {
        errors.push({
          code: 'BAD_TASK_STATUS',
          file: TASK_STATUS_FILE,
          line: 0,
          message: `mã task ${code} xuất hiện ở cả "${seen.get(code)}" và "${listName}" — `
            + 'bất biến của steering mục 7 là một mã ở ĐÚNG MỘT danh sách',
        });
      } else {
        seen.set(code, listName);
      }
    }
  }

  return {
    done: new Set(lists.done),
    valid: new Set(seen.keys()),
    errors,
  };
}

// --- Đi cây thư mục (không dùng fs.globSync vì nó chỉ có từ Node 22) ---------
// Chỉ hỗ trợ đúng một đoạn `*` (đủ cho `packages/*/src`), không cần glob tổng quát.
function expandRoot(repoRoot, pattern) {
  const segments = pattern.split('/');
  const starIndex = segments.indexOf('*');
  if (starIndex === -1) {
    return fs.existsSync(path.join(repoRoot, pattern)) ? [pattern] : [];
  }
  const parent = segments.slice(0, starIndex).join('/');
  const tail = segments.slice(starIndex + 1).join('/');
  const parentAbs = path.join(repoRoot, parent);
  if (!fs.existsSync(parentAbs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(parentAbs, { withFileTypes: true })) {
    if (!entry.isDirectory() || EXCLUDE_DIRS.has(entry.name)) continue;
    const candidate = [parent, entry.name, tail].filter(Boolean).join('/');
    if (fs.existsSync(path.join(repoRoot, candidate))) out.push(candidate);
  }
  return out;
}

function walkFiles(repoRoot, relDir, acc) {
  const abs = path.join(repoRoot, relDir);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walkFiles(repoRoot, rel, acc);
    } else if (entry.isFile()) {
      if (!CODE_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (SELF_EXCLUDED.has(rel)) continue;
      acc.push(rel);
    }
  }
  return acc;
}

/** Danh sách tệp trong phạm vi quét, đường dẫn tương đối gốc repo */
export function listScannedFiles(repoRoot = REPO_ROOT) {
  const files = [];
  for (const pattern of SCAN_ROOTS) {
    for (const root of expandRoot(repoRoot, pattern)) {
      walkFiles(repoRoot, root, files);
    }
  }
  return [...new Set(files)].sort();
}

// --- Bóc nội dung marker ----------------------------------------------------
/** Bỏ đuôi chú thích khối và khoảng trắng hai đầu của phần mô tả */
function cleanNote(raw) {
  return raw.replace(/\*\/\s*$/, '').replace(/-->\s*$/, '').trim();
}

function findForbidden(line) {
  const hits = new Set();
  for (const re of [FORBIDDEN_MARKER_RE, FORBIDDEN_WORD_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) hits.add(m[0]);
  }
  return [...hits];
}

// --- Kiểm số bước của một luồng ---------------------------------------------
// Bước 9 và app/test/pending-markers.test.ts dùng lại hàm này, không cài lại.
/**
 * Số bước trong cùng một luồng phải bắt đầu từ 1, cách nhau 1, không trùng.
 * @param {Array<{flow:string, step:number, file:string, line:number}>} flows
 * @returns {Array<{code:string,file:string,line:number,message:string}>}
 */
export function validateFlowSteps(flows) {
  const errors = [];
  const byFlow = new Map();
  for (const f of flows) {
    if (!byFlow.has(f.flow)) byFlow.set(f.flow, []);
    byFlow.get(f.flow).push(f);
  }

  for (const [flowName, items] of [...byFlow.entries()].sort()) {
    const sorted = [...items].sort((a, b) => a.step - b.step);

    // Trùng số bước
    const bySt = new Map();
    for (const it of sorted) {
      if (!bySt.has(it.step)) bySt.set(it.step, []);
      bySt.get(it.step).push(it);
    }
    for (const [step, group] of [...bySt.entries()].sort((a, b) => a[0] - b[0])) {
      if (group.length > 1) {
        const where = group.map((g) => `${g.file}:${g.line}`).join(', ');
        for (const g of group) {
          errors.push({
            code: 'BAD_FLOW_STEP',
            file: g.file,
            line: g.line,
            message: `luồng "${flowName}" có ${group.length} marker cùng bước ${step} (${where})`,
          });
        }
      }
    }

    // Không bắt đầu từ 1
    const steps = [...bySt.keys()].sort((a, b) => a - b);
    if (steps.length > 0 && steps[0] !== 1) {
      const first = bySt.get(steps[0])[0];
      errors.push({
        code: 'BAD_FLOW_STEP',
        file: first.file,
        line: first.line,
        message: `luồng "${flowName}" bắt đầu ở bước ${steps[0]}, phải bắt đầu từ 1 `
          + '(thiếu bước đầu = có ai xóa hàm mà quên sửa marker)',
      });
    }

    // Nhảy cách
    for (let i = 1; i < steps.length; i += 1) {
      const gap = steps[i] - steps[i - 1];
      if (gap > 1) {
        const item = bySt.get(steps[i])[0];
        const missing = [];
        for (let s = steps[i - 1] + 1; s < steps[i]; s += 1) missing.push(s);
        errors.push({
          code: 'BAD_FLOW_STEP',
          file: item.file,
          line: item.line,
          message: `luồng "${flowName}" nhảy cách: có bước ${steps[i - 1]} rồi tới `
            + `${steps[i]}, thiếu bước ${missing.join(', ')}`,
        });
      }
    }
  }

  return errors;
}

// --- Quét ------------------------------------------------------------------
/**
 * Quét toàn bộ phạm vi, trả về báo cáo đầy đủ.
 * @returns {{markers:Array, flows:Array, byTask:Object, errors:Array, summary:Object}}
 */
export function scan(repoRoot = REPO_ROOT) {
  const { done, valid, errors: statusErrors } = readTaskStatus(repoRoot);
  const markers = [];
  const flows = [];
  const errors = [...statusErrors];

  for (const file of listScannedFiles(repoRoot)) {
    let text;
    try {
      text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineNo = i + 1;

      const forbidden = findForbidden(line);
      if (forbidden.length > 0) {
        errors.push({
          code: 'FORBIDDEN_KEYWORD',
          file,
          line: lineNo,
          message: `từ khóa bị cấm: ${forbidden.join(', ')} — steering mục 5 chỉ cho `
            + '@pending, @blocked, @flow; cần diễn đạt khác thì viết sau dấu |',
        });
        continue;
      }

      const mk = MARKER_RE.exec(line);
      if (mk) {
        const [, kind, task, rawNote] = mk;
        const note = cleanNote(rawNote);
        if (note === '') {
          errors.push({
            code: 'BAD_SYNTAX',
            file,
            line: lineNo,
            message: `@${kind} ${task} có mô tả rỗng — phải nói rõ `
              + (kind === 'pending' ? 'ĐÃ SẴN gì' : 'THIẾU gì'),
          });
          continue;
        }
        if (!valid.has(task)) {
          errors.push({
            code: 'UNKNOWN_TASK',
            file,
            line: lineNo,
            message: `mã task ${task} không có trong ${TASK_STATUS_FILE} `
              + '(hợp done + inProgress + planned)',
          });
          continue;
        }
        if (done.has(task)) {
          errors.push({
            code: 'STALE_TASK',
            file,
            line: lineNo,
            message: `marker lạc hậu: ${task} đã done. Task xong thì phải dọn marker `
              + '(steering mục 7, vế b)',
          });
          continue;
        }
        markers.push({ kind, task, file, line: lineNo, note, symbol: inferSymbol(lines, i) });
        continue;
      }

      const fl = FLOW_RE.exec(line);
      if (fl) {
        const [, flowName, rawStep, rawNote] = fl;
        const note = cleanNote(rawNote);
        if (note === '') {
          errors.push({
            code: 'BAD_SYNTAX',
            file,
            line: lineNo,
            message: `@flow ${flowName}:${rawStep} có mô tả rỗng — phải nói việc của bước này`,
          });
          continue;
        }
        if (!FLOW_NAMES.includes(flowName)) {
          errors.push({
            code: 'BAD_FLOW_NAME',
            file,
            line: lineNo,
            message: `tên luồng "${flowName}" không thuộc năm tên đã chốt: ${FLOW_NAMES.join(', ')}`,
          });
          continue;
        }
        flows.push({
          flow: flowName,
          step: Number(rawStep),
          file,
          line: lineNo,
          note,
          symbol: inferSymbol(lines, i),
        });
        continue;
      }

      if (LOOSE_RE.test(line)) {
        errors.push({
          code: 'BAD_SYNTAX',
          file,
          line: lineNo,
          message: 'có từ khóa marker nhưng sai cú pháp. Đúng phải là '
            + '"@pending <MÃ-TASK> | <mô tả>", "@blocked <MÃ-TASK> | <mô tả>" hoặc '
            + '"@flow <tên-luồng>:<số nguyên> | <mô tả>"',
        });
      }
    }
  }

  errors.push(...validateFlowSteps(flows));

  markers.sort((a, b) => a.task.localeCompare(b.task) || a.file.localeCompare(b.file) || a.line - b.line);
  flows.sort((a, b) => a.flow.localeCompare(b.flow) || a.step - b.step);
  errors.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));

  const byTask = {};
  for (const m of markers) byTask[m.task] = (byTask[m.task] ?? 0) + 1;

  return {
    markers,
    flows,
    byTask,
    errors,
    summary: {
      pending: markers.filter((m) => m.kind === 'pending').length,
      blocked: markers.filter((m) => m.kind === 'blocked').length,
      flows: flows.length,
      errors: errors.length,
    },
  };
}

// --- In bảng cho người đọc --------------------------------------------------
export function formatTable(report) {
  const out = [];
  out.push('ĐIỂM CẮM ĐANG CHỜ');
  out.push('');

  if (report.markers.length === 0) {
    out.push('  Chưa có điểm cắm nào: không có marker @pending / @blocked nào trong phạm vi quét.');
    out.push('  Đây là trạng thái bình thường, không phải lỗi — còn hay hết điểm cắm đều');
    out.push('  không làm `--check` đỏ. Quy ước: .kiro/steering/make-control.md');
    out.push('');
  } else {
    const tasks = [...new Set(report.markers.map((m) => m.task))].sort();
    for (const task of tasks) {
      const items = report.markers.filter((m) => m.task === task);
      const counts = [];
      for (const kind of ['pending', 'blocked']) {
        const n = items.filter((i) => i.kind === kind).length;
        if (n > 0) counts.push(`${n} ${KIND_LABEL[kind]}`);
      }
      out.push(`${task}  (${counts.join(', ')})`);
      const width = Math.min(
        Math.max(...items.map((i) => `${i.file}:${i.line}`.length)),
        58,
      );
      for (const i of items) {
        out.push(`  ${KIND_TAG[i.kind]}  ${`${i.file}:${i.line}`.padEnd(width)}  ${i.note}`);
      }
      out.push('');
    }
  }

  out.push('LUỒNG NGHIỆP VỤ (marker @flow)');
  out.push('');
  if (report.flows.length === 0) {
    out.push('  Chưa có marker @flow nào. Sơ đồ luồng sinh từ marker, chưa gắn thì chưa sinh được.');
  } else {
    const names = [...new Set(report.flows.map((f) => f.flow))].sort();
    for (const name of names) {
      const items = report.flows.filter((f) => f.flow === name);
      out.push(`${name}  (${items.length} bước)`);
      const width = Math.min(
        Math.max(...items.map((i) => `${i.file}:${i.line}`.length)),
        58,
      );
      for (const i of items) {
        const sym = i.symbol ? `::${i.symbol}` : '';
        out.push(`  ${String(i.step).padStart(2)}  ${`${i.file}:${i.line}`.padEnd(width)}  ${i.note}${sym ? `  ${sym}` : ''}`);
      }
      out.push('');
    }
  }

  out.push('');
  const s = report.summary;
  out.push(`Tổng: ${s.pending} điểm cắm · ${s.blocked} điểm chặn · ${s.flows} bước luồng`);
  if (s.errors > 0) {
    out.push(`Có ${s.errors} lỗi marker. Chạy \`node scripts/scan-pending.mjs --check\` để xem chi tiết.`);
  }
  return out.join('\n');
}

// --- CLI -------------------------------------------------------------------
const USAGE = `Dùng: node scripts/scan-pending.mjs [--json | --check]

  (không cờ)  in bảng điểm cắm cho người đọc, mã thoát 0
  --json      in JSON ra stdout (chỉ JSON, không gì khác), mã thoát 0
  --check     mã thoát 1 nếu có lỗi marker, 0 nếu không; lỗi in ra stderr
  --help      in hướng dẫn này

Quy ước marker: .kiro/steering/make-control.md`;

function main(argv) {
  const flags = argv.slice(2);
  const unknown = flags.filter((f) => !['--json', '--check', '--help', '-h'].includes(f));
  if (unknown.length > 0) {
    process.stderr.write(`Cờ không nhận ra: ${unknown.join(', ')}\n\n${USAGE}\n`);
    return 2;
  }
  if (flags.includes('--help') || flags.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const report = scan();

  if (flags.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  }

  if (flags.includes('--check')) {
    if (report.errors.length === 0) {
      process.stdout.write(
        `Marker hợp lệ: ${report.summary.pending} điểm cắm, ${report.summary.blocked} điểm chặn, `
        + `${report.summary.flows} bước luồng. Không có lỗi.\n`,
      );
      return 0;
    }
    process.stderr.write(`Có ${report.errors.length} lỗi marker:\n\n`);
    for (const e of report.errors) {
      const where = e.line > 0 ? `${e.file}:${e.line}` : e.file;
      process.stderr.write(`  [${e.code}] ${where}\n      ${e.message}\n`);
    }
    process.stderr.write('\nQuy ước: .kiro/steering/make-control.md\n');
    return 1;
  }

  process.stdout.write(`${formatTable(report)}\n`);
  return 0;
}

// Chỉ chạy CLI khi gọi trực tiếp; khi được import (test, gen-flow-diagram) thì không.
const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv));
}
