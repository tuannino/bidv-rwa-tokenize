#!/usr/bin/env node
// =============================================================================
//  KIỂM KHUÔN CHECKPOINT — mục 0 tóm tắt nghiệm thu có đủ và đọc được trong một trang
//
//  Chạy từ GỐC repo:
//    node scripts/check-checkpoint.mjs <checkpoint.md> <requirements.md>
//    node scripts/check-checkpoint.mjs --in-progress     đọc .kiro/task-status.json
//
//  Quy ước đầy đủ: .kiro/steering/checkpoint.md
//  Nguồn trạng thái task: .kiro/task-status.json (nguồn DUY NHẤT, đọc qua
//  readTaskStatus của scripts/scan-pending.mjs — không đọc lại JSON ở đây)
//
// -----------------------------------------------------------------------------
//  NĂM MÃ LỖI, KHÔNG HƠN
// -----------------------------------------------------------------------------
//    NO_SUMMARY          không có tiêu đề mục 0
//    SUMMARY_TOO_LONG    mục 0 vượt MAX_SUMMARY_LINES dòng
//    DOD_COUNT_MISMATCH  số dòng bảng đối chiếu khác số ô "- [ ]" ở mục điều kiện
//                        hoàn thành của requirements.md
//    MISSING_EVIDENCE    có dòng mà cột bằng chứng rỗng hoặc chỉ ghi "đã làm"
//    NOT_SPLIT           cả tệp vượt MAX_FILE_LINES mà chưa có tệp _DETAIL.md
//
//  R4.2 liệt kê ĐÚNG năm ca phải đỏ. Thêm ca thứ sáu vào đây là đổi hợp đồng của
//  script mà không ai chốt, nên ba thứ dưới đây CỐ Ý không làm đỏ:
//
//    - checkpoint chưa tồn tại → BỎ QUA có thông báo. Trong lúc đang làm task thì
//      checkpoint chưa viết là bình thường; báo đỏ ở đó biến run-local-all.sh thành
//      cái đèn đỏ thường trực, và đèn đỏ thường trực thì người ta học cách bỏ qua.
//      Việc "phải có checkpoint trước khi mở PR" đã có ở branching.md §11.
//    - con số có kèm lệnh đo hay không → không phân biệt được bằng máy (steering §2).
//    - trạng thái ✅/🔶/❌ có ĐÚNG hay không → ghi ✅ cho việc chưa xong thì script
//      vẫn xanh. Đó là việc của Supervisor, và steering §4 nói rõ.
//
// -----------------------------------------------------------------------------
//  MÃ THOÁT
// -----------------------------------------------------------------------------
//    0   đạt (hoặc không có gì để kiểm)
//    1   checkpoint SAI KHUÔN — một trong năm mã lỗi trên
//    2   không chạy được: sai cách gọi, thiếu tệp requirements, nguồn trạng thái hỏng
//
//  Tách 1 với 2 để thông báo không lẫn nhau: 1 nói "sửa checkpoint", 2 nói "sửa cách
//  gọi hoặc sửa dữ liệu nền". Cả hai đều là FAIL với run-local-all.sh.
//
//  Môi trường: Node 20 trở lên, ESM thuần, KHÔNG phụ thuộc gói ngoài.
//  Đọc Markdown bằng quy tắc đơn giản (tiêu đề, dòng bắt đầu bằng `|`, ô `- [ ]`) —
//  không thêm thư viện phân tích Markdown, theo design.md mục 6.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTaskStatus } from './scan-pending.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

// -----------------------------------------------------------------------------
//  HAI NGƯỠNG — đặt ở đầu script để đổi được, lý do chọn con số ở steering §3
// -----------------------------------------------------------------------------

/**
 * Mục 0 phải đọc trọn trong một trang màn hình.
 * Đo trên tiền lệ: mục 0 của docs/CHECKPOINT_MC01.md dài 40 dòng NỘI DUNG (dòng trắng và
 * đường kẻ `---` ở cuối không tính — xem timMuc0). Đếm bằng awk theo dải `## 0.` → `## 1.`
 * sẽ ra 43; chênh 3 là ba dòng trình bày đó.
 */
export const MAX_SUMMARY_LINES = 60;

/** Quá mức này thì phần chi tiết phải tách ra tệp _DETAIL.md riêng. */
export const MAX_FILE_LINES = 800;

/** Ba ký hiệu trạng thái cố định. Script ĐẾM DÒNG BẢNG theo đúng ba ký hiệu này. */
export const STATUS_SYMBOLS = Object.freeze(['✅', '🔶', '❌']);

/** Hậu tố tệp chi tiết khi phải tách (R3.2) */
export const DETAIL_SUFFIX = '_DETAIL.md';

/** Tiêu đề mục điều kiện hoàn thành trong requirements.md, so sau khi bỏ dấu */
const DOD_HEADING_KEY = 'dieu kien hoan thanh';

/**
 * Nội dung cột bằng chứng bị coi là KHÔNG phải bằng chứng.
 * So sau khi bỏ dấu, bỏ ký tự trang trí Markdown và bỏ ký hiệu trạng thái.
 *
 * Vì sao chặn: "đã làm" trả lời đúng câu hỏi mà người review đang muốn TỰ kiểm, nên
 * nó lấy mất chính việc họ cần làm. Cột này phải ghi SỐ MỤC để nhảy tới được.
 */
export const VAGUE_EVIDENCE = Object.freeze([
  'da lam', 'lam roi', 'xong', 'da xong', 'hoan thanh', 'dat', 'da dat',
  'ok', 'oke', 'done', 'yes', 'co', 'khong', 'na', 'n/a', 'tbd', '?',
]);

// -----------------------------------------------------------------------------
//  ĐỌC MARKDOWN BẰNG QUY TẮC ĐƠN GIẢN
// -----------------------------------------------------------------------------

/** Bỏ dấu tiếng Việt + hạ chữ thường, để so tiêu đề và so cụm vô nghĩa */
export function boDau(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** `## 3.2 Tên mục` → { level: 2, title: '3.2 Tên mục' }; không phải tiêu đề thì null */
function docTieuDe(line) {
  const m = /^(#{1,6})[ \t]+(.*)$/.exec(line);
  return m ? { level: m[1].length, title: m[2].trim() } : null;
}

/**
 * Mục 0 = từ tiêu đề cấp 2 bắt đầu bằng số 0, tới trước tiêu đề cấp 1 hoặc 2 kế tiếp.
 *
 * Nhận `## 0. Tóm tắt nghiệm thu` và cả `## 0 — Tóm tắt`: chỉ đòi cấp 2 và số 0, không
 * đòi đúng chữ "Tóm tắt". Bám vào chữ của tiêu đề thì đổi cách diễn đạt là vỡ, mà thứ
 * định danh mục này là VỊ TRÍ (mục 0, mở đầu) chứ không phải tên.
 *
 * Tiêu đề con `### 0.1` KHÔNG kết thúc mục 0 vì nó cấp 3 — đúng ý: 0.1 và 0.2 nằm TRONG.
 *
 * @returns {{start:number, end:number, lines:string[]}|null} start/end là chỉ số 0-based,
 *          `end` không bao gồm; `lines` đã bỏ dòng trắng và dòng `---` ở cuối.
 */
export function timMuc0(lines) {
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const h = docTieuDe(lines[i]);
    if (h && h.level === 2 && /^0\b/.test(h.title)) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const h = docTieuDe(lines[i]);
    if (h && h.level <= 2) {
      end = i;
      break;
    }
  }

  // Dòng trắng và đường kẻ ngang trước mục sau là phần TRÌNH BÀY, không phải nội dung
  // mục 0. Tính chúng vào hạn mức 60 dòng làm ngưỡng phụ thuộc khoảng trắng.
  let cat = end;
  while (cat > start + 1 && /^(\s*|-{3,}|\*{3,}|_{3,})$/.test(lines[cat - 1])) cat -= 1;

  return { start, end, lines: lines.slice(start, cat) };
}

/** Dòng phân cách của bảng Markdown: `|---|:--:|` */
function laDongPhanCach(line) {
  return /^\|[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
}

/** Ô của một dòng bảng. Không tách ở `\|` vì đó là dấu `|` đã thoát, nằm TRONG ô. */
export function tachO(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s
    .split(/(?<!\\)\|/)
    .map((o) => o.replace(/\\\|/g, '|').trim());
}

/**
 * Bảng ĐẦU TIÊN trong một khối dòng: dòng 1 là tiêu đề cột, dòng 2 là phân cách,
 * còn lại là dòng dữ liệu.
 *
 * Vì sao "bảng đầu tiên" chứ không phải "bảng trong tiểu mục 0.1": mục 0 được phép có
 * bảng thứ hai (mục 0 của MC-01 có bảng tự kiểm §11 ở 0.2), nên đếm mọi dòng bảng là
 * sai. Còn bám vào tiêu đề `### 0.1` thì lại vỡ khi ai đó đổi cách đánh số tiểu mục.
 * Bảng đối chiếu điều kiện hoàn thành là bảng đầu tiên trong khuôn, và đó là thứ ổn
 * định nhất trong ba cách.
 *
 * @param {string[]} khoi dòng của mục 0
 * @param {number} offset chỉ số 0-based của `khoi[0]` trong toàn tệp, để ra số dòng thật
 * @returns {{header:string[]|null, rows:Array<{line:number, cells:string[], raw:string}>}}
 */
export function bangDauTien(khoi, offset = 0) {
  let i = khoi.findIndex((l) => l.trim().startsWith('|'));
  if (i === -1) return { header: null, rows: [] };

  const khoiBang = [];
  for (; i < khoi.length && khoi[i].trim().startsWith('|'); i += 1) {
    khoiBang.push({ line: offset + i + 1, raw: khoi[i] });
  }

  const khongPhanCach = khoiBang.filter((d) => !laDongPhanCach(d.raw));
  if (khongPhanCach.length === 0) return { header: null, rows: [] };

  const [dongTieuDe, ...conLai] = khongPhanCach;
  return {
    header: tachO(dongTieuDe.raw),
    rows: conLai.map((d) => ({ line: d.line, raw: d.raw, cells: tachO(d.raw) })),
  };
}

/** Dòng bảng có đúng một ký hiệu trạng thái ✅ / 🔶 / ❌ ở ô nào đó */
function coKyHieuTrangThai(cells) {
  return cells.some((o) => STATUS_SYMBOLS.some((k) => o.includes(k)));
}

/** Đếm từng ký hiệu trạng thái trên các dòng DoD, để in cho người đọc đối chiếu */
function demTrangThai(rows) {
  const tally = { '✅': 0, '🔶': 0, '❌': 0 };
  for (const r of rows) {
    for (const k of STATUS_SYMBOLS) {
      if (r.cells.some((o) => o.includes(k))) tally[k] += 1;
    }
  }
  return tally;
}

/**
 * Số điều kiện hoàn thành trong requirements.md — lấy ĐÚNG MỤC điều kiện hoàn thành,
 * không đếm mọi ô `- [ ]` trong tệp (design.md mục 6).
 *
 * Đếm cả `- [x]`: một ô đã tick vẫn là MỘT điều kiện. Chỉ đếm ô chưa tick thì ai đó
 * tick một ô là số điều kiện tự giảm, và checkpoint đúng bỗng thành sai.
 *
 * @returns {{ok:true, count:number, heading:string, items:string[]}|{ok:false, reason:string}}
 */
export function demDieuKien(requirementsText) {
  const lines = requirementsText.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const h = docTieuDe(lines[i]);
    if (h && boDau(h.title).includes(DOD_HEADING_KEY)) {
      start = i;
      level = h.level;
      break;
    }
  }
  if (start === -1) {
    return {
      ok: false,
      reason:
        'không tìm thấy mục "Điều kiện hoàn thành". Script đếm ô "- [ ]" trong ĐÚNG mục đó,\n'
        + '      không đếm mọi ô trong tệp — nên thiếu tiêu đề đó thì không có gì để đối chiếu.',
    };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const h = docTieuDe(lines[i]);
    if (h && h.level <= level) {
      end = i;
      break;
    }
  }

  const items = [];
  for (const line of lines.slice(start + 1, end)) {
    const m = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/.exec(line);
    if (m) items.push(m[2].trim());
  }
  return { ok: true, count: items.length, heading: lines[start].trim(), items };
}

// -----------------------------------------------------------------------------
//  NĂM PHÉP KIỂM
// -----------------------------------------------------------------------------

/** Nội dung ô bằng chứng sau khi bỏ trang trí Markdown và ký hiệu trạng thái */
function loiBangChung(text) {
  let s = String(text ?? '');
  for (const k of STATUS_SYMBOLS) s = s.split(k).join(' ');
  s = s.replace(/[`*_~]/g, ' ');
  const chuan = boDau(s);
  if (chuan === '') return 'ô bằng chứng rỗng';
  // Bỏ dấu câu ở hai đầu để "xong." và "ok!" cũng bị bắt
  const con = chuan.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (con === '' || VAGUE_EVIDENCE.includes(con)) {
    return `cột bằng chứng ghi "${String(text).trim()}" — đó không phải bằng chứng`;
  }
  return null;
}

/**
 * Lỗi dữ liệu nền hoặc cách gọi — CLI trả mã thoát 2, không phải 1.
 *
 * Tách khỏi năm mã lỗi khuôn vì hai loại đòi hai hành động khác nhau: mã thoát 1 nói
 * "sửa checkpoint", mã thoát 2 nói "sửa cách gọi hoặc sửa dữ liệu nền". Gộp lại thì
 * người đọc thông báo đi sửa sai chỗ.
 */
export class CheckpointInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CheckpointInputError';
  }
}

/**
 * @typedef {{code:string, file:string, line:number, message:string}} CheckpointError
 * @typedef {{summaryLines:number, dodRows:number, dodBoxes:number, totalLines:number,
 *            tally:Record<string,number>, detailExists:boolean}} CheckpointStats
 * @typedef {{errors:CheckpointError[], stats:CheckpointStats}} CheckpointReport
 */

/**
 * Lõi thuần: không đọc đĩa, nhận nội dung dạng chuỗi. Đây là ĐƯỜNG KIỂM DUY NHẤT —
 * chế độ hai tham số và chế độ --in-progress đều đi qua đây, nên không có đường nào
 * kiểm lỏng hơn đường nào.
 *
 * @param {{checkpointPath:string, checkpointText:string, requirementsPath:string,
 *          requirementsText:string, detailExists:boolean}} input
 * @returns {CheckpointReport}
 */
export function checkCheckpoint(input) {
  const { checkpointPath, checkpointText, requirementsPath, requirementsText, detailExists } = input;
  const file = checkpointPath;
  const lines = checkpointText.split(/\r?\n/);
  // Tệp kết thúc bằng newline sinh một phần tử rỗng ở cuối — không tính là một dòng,
  // để con số khớp `wc -l` mà người viết dùng để tự đo.
  const totalLines = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;

  /** @type {CheckpointError[]} */
  const errors = [];
  const stats = {
    summaryLines: 0,
    dodRows: 0,
    dodBoxes: 0,
    totalLines,
    tally: { '✅': 0, '🔶': 0, '❌': 0 },
    detailExists,
  };

  // --- NOT_SPLIT: kiểm được độc lập với mục 0, nên kiểm trước ---------------
  if (totalLines > MAX_FILE_LINES && !detailExists) {
    const detail = path.basename(file).replace(/\.md$/, DETAIL_SUFFIX);
    errors.push({
      code: 'NOT_SPLIT',
      file,
      line: totalLines,
      message:
        `cả tệp ${totalLines} dòng, vượt ngưỡng ${MAX_FILE_LINES}, mà chưa có tệp chi tiết.\n`
        + `      Tách phần chi tiết ra "${detail}" (cùng thư mục), tệp chính giữ mục 0 và các\n`
        + '      mục ngắn, và mục 0 phải trỏ được sang đúng mục trong tệp chi tiết.',
    });
  }

  // --- NO_SUMMARY ----------------------------------------------------------
  const muc0 = timMuc0(lines);
  if (muc0 === null) {
    errors.push({
      code: 'NO_SUMMARY',
      file,
      line: 1,
      message:
        'không có mục 0. Mọi checkpoint phải mở đầu bằng một tiêu đề cấp 2 bắt đầu bằng số 0,\n'
        + '      đặt ngay sau bảng thông tin task, ví dụ "## 0. Tóm tắt nghiệm thu".\n'
        + '      Khuôn kèm ví dụ điền sẵn: docs/CHECKPOINT_TEMPLATE.md',
    });
    return { errors, stats };
  }

  stats.summaryLines = muc0.lines.length;

  // --- SUMMARY_TOO_LONG ----------------------------------------------------
  if (stats.summaryLines > MAX_SUMMARY_LINES) {
    errors.push({
      code: 'SUMMARY_TOO_LONG',
      file,
      line: muc0.start + 1,
      message:
        `mục 0 dài ${stats.summaryLines} dòng, vượt ngưỡng ${MAX_SUMMARY_LINES}.\n`
        + '      Mục 0 là bản để QUYẾT, phải đọc trọn trong một trang màn hình. Phần giải thích\n'
        + '      dài chuyển xuống mục chi tiết rồi trỏ tới bằng số mục ở cột bằng chứng.',
    });
  }

  // --- DOD_COUNT_MISMATCH --------------------------------------------------
  const bang = bangDauTien(muc0.lines, muc0.start);
  const dongCoTrangThai = bang.rows.filter((r) => coKyHieuTrangThai(r.cells));
  const dongThieuTrangThai = bang.rows.filter((r) => !coKyHieuTrangThai(r.cells));
  stats.dodRows = dongCoTrangThai.length;
  stats.tally = demTrangThai(dongCoTrangThai);

  const dk = demDieuKien(requirementsText);
  if (!dk.ok) {
    // Không đếm được điều kiện thì KHÔNG suy ra được "khớp" hay "lệch". Đây là lỗi dữ
    // liệu nền, không phải lỗi khuôn checkpoint — nên ném ra cho CLI trả mã thoát 2.
    throw new CheckpointInputError(`${requirementsPath}: ${dk.reason}`);
  }
  stats.dodBoxes = dk.count;

  if (stats.dodRows !== dk.count) {
    const phuLuc = dongThieuTrangThai.length > 0
      ? `\n      ${dongThieuTrangThai.length} dòng bảng KHÔNG có ký hiệu trạng thái nào nên không được`
        + ` tính:\n        ${dongThieuTrangThai.map((r) => `dòng ${r.line}`).join(', ')}`
        + `\n      Mỗi dòng phải mang đúng một trong ${STATUS_SYMBOLS.join(' / ')}.`
      : '';
    errors.push({
      code: 'DOD_COUNT_MISMATCH',
      file,
      line: bang.rows.length > 0 ? bang.rows[0].line : muc0.start + 1,
      message:
        `bảng đối chiếu có ${stats.dodRows} dòng, nhưng "${dk.heading}" ở ${requirementsPath}\n`
        + `      có ${dk.count} điều kiện. Bảng phải đối chiếu ĐỦ, không thêm không bớt:\n`
        + '      thiếu một dòng là một điều kiện không ai đối chiếu, thêm dòng lạ là đổi phạm vi\n'
        + `      nghiệm thu mà không ai chốt.${phuLuc}`,
    });
  }

  // --- MISSING_EVIDENCE ----------------------------------------------------
  // Cột bằng chứng là ô CUỐI của dòng: bám vào ô cuối thì thêm cột phụ ở giữa không làm
  // vỡ phép kiểm, còn bám vào chỉ số cột thì vỡ.
  for (const r of dongCoTrangThai) {
    const loi = loiBangChung(r.cells[r.cells.length - 1]);
    if (loi !== null) {
      errors.push({
        code: 'MISSING_EVIDENCE',
        file,
        line: r.line,
        message:
          `${loi}. Cột cuối phải ghi SỐ MỤC của checkpoint này (ví dụ "mục 3.2" hoặc\n`
          + '      "mục 4, SL-1") để người review nhảy thẳng tới chỗ cần kiểm. Ghi "đã làm" là\n'
          + '      trả lời hộ đúng câu hỏi mà họ đang muốn tự kiểm.',
      });
    }
  }

  errors.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
  return { errors, stats };
}

/**
 * Kiểm một checkpoint đọc từ đĩa.
 * @param {string} repoRoot gốc repo (test truyền repo giả trong thư mục tạm)
 * @param {string} checkpointRel đường dẫn tương đối gốc repo
 * @param {string} requirementsRel đường dẫn tương đối gốc repo
 * @returns {CheckpointReport}
 */
export function checkCheckpointFile(repoRoot, checkpointRel, requirementsRel) {
  const doc = (rel) => {
    try {
      return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    } catch (err) {
      throw new CheckpointInputError(`không đọc được ${rel}: ${err.message}`);
    }
  };
  const detailRel = checkpointRel.replace(/\.md$/, DETAIL_SUFFIX);
  return checkCheckpoint({
    checkpointPath: checkpointRel,
    checkpointText: doc(checkpointRel),
    requirementsPath: requirementsRel,
    requirementsText: doc(requirementsRel),
    detailExists: fs.existsSync(path.join(repoRoot, detailRel)),
  });
}

// -----------------------------------------------------------------------------
//  SUY TÊN TỆP TỪ MÃ TASK
// -----------------------------------------------------------------------------
//  Hai quy ước đặt tên đang dùng trong repo, đo bằng `ls docs/`:
//    docs/CHECKPOINT_<MÃ bỏ gạch>.md            CHECKPOINT_MC01.md, CHECKPOINT_BE09.md
//    docs/CHECKPOINT_<MÃ bỏ gạch>_<hậu tố>.md   CHECKPOINT_FE01_V2.md
//  Nên phải đỡ cả dạng có hậu tố, và khi có NHIỀU tệp khớp thì DỪNG chứ không tự chọn:
//  chọn sai tệp là kiểm sai checkpoint mà không ai biết.

const CHECKPOINT_DIR = 'docs';
const SPEC_DIRS = ['.kiro/specs', 'docs'];

/** 'MC-02' → 'MC02' */
function maKhongGach(task) {
  return task.replace(/-/g, '');
}

function docThuMuc(abs) {
  try {
    return fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Tìm checkpoint và requirements của một mã task.
 * @returns {{ok:true, checkpoint:string, requirements:string}
 *          |{ok:false, thieuCheckpoint:boolean, reason:string}}
 */
export function resolveTaskFiles(repoRoot, task) {
  const ma = maKhongGach(task);

  // --- checkpoint ---
  const chinh = `${CHECKPOINT_DIR}/CHECKPOINT_${ma}.md`;
  let checkpoint = fs.existsSync(path.join(repoRoot, chinh)) ? chinh : null;
  if (checkpoint === null) {
    const re = new RegExp(`^CHECKPOINT_${ma}(_[A-Za-z0-9]+)*\\.md$`);
    const khop = docThuMuc(path.join(repoRoot, CHECKPOINT_DIR))
      .filter((e) => e.isFile() && re.test(e.name) && !e.name.endsWith(DETAIL_SUFFIX))
      .map((e) => `${CHECKPOINT_DIR}/${e.name}`)
      .sort();
    if (khop.length > 1) {
      return {
        ok: false,
        thieuCheckpoint: false,
        reason:
          `${task}: có ${khop.length} tệp checkpoint cùng khớp mã này — ${khop.join(', ')}.\n`
          + '      Script KHÔNG tự chọn: chọn sai tệp là kiểm sai checkpoint mà không ai biết.\n'
          + `      Gọi tường minh: node scripts/check-checkpoint.mjs <tệp> <requirements>`,
      };
    }
    checkpoint = khop[0] ?? null;
  }
  if (checkpoint === null) {
    return {
      ok: false,
      thieuCheckpoint: true,
      reason: `${task}: chưa có ${chinh}`,
    };
  }

  // --- requirements: thư mục spec bắt đầu bằng mã task viết thường ----------
  // Ưu tiên .kiro/specs/ vì đó là bản Kiro nạp (xem nợ kỹ thuật P2 ở tech-report 1.6.C:
  // hai bản spec song song đã lệch nhau ở 5/6 cặp, nên thứ tự ưu tiên phải tường minh).
  const tienTo = task.toLowerCase();
  for (const goc of SPEC_DIRS) {
    const ungVien = docThuMuc(path.join(repoRoot, goc))
      .filter((e) => e.isDirectory() && (e.name === tienTo || e.name.startsWith(`${tienTo}-`)))
      .map((e) => `${goc}/${e.name}/requirements.md`)
      .filter((rel) => fs.existsSync(path.join(repoRoot, rel)))
      .sort();
    if (ungVien.length > 0) return { ok: true, checkpoint, requirements: ungVien[0] };
  }

  return {
    ok: false,
    thieuCheckpoint: false,
    reason:
      `${task}: không tìm thấy requirements.md. Đã tìm thư mục bắt đầu bằng "${tienTo}" trong\n`
      + `      ${SPEC_DIRS.join(', ')}. Không có mục điều kiện hoàn thành thì không đối chiếu được.`,
  };
}

// -----------------------------------------------------------------------------
//  CHẾ ĐỘ --in-progress
// -----------------------------------------------------------------------------

/**
 * Kiểm checkpoint của MỌI task đang ở `inProgress`.
 *
 * Task đã `done` thì KHÔNG kiểm (R4.4): checkpoint của nó là vết lịch sử, và sửa lại vết
 * lịch sử để vừa một quy tắc ra sau là làm sai chính thứ mà vết đó dùng để ghi.
 *
 * @returns {{ketQua:Array<{task:string, checkpoint?:string, requirements?:string,
 *            report?:CheckpointReport, boQua?:string}>, khongCoTask:boolean}}
 */
export function checkInProgress(repoRoot = REPO_ROOT) {
  const { inProgress, errors: loiNguon } = readTaskStatus(repoRoot);
  if (loiNguon.length > 0) {
    throw new CheckpointInputError(
      `${loiNguon.map((e) => e.message).join('\n      ')}\n`
      + '      Nguồn trạng thái task hỏng thì "task nào đang làm" không xác định.\n'
      + '      Xem chi tiết: node scripts/scan-pending.mjs --check',
    );
  }

  if (inProgress.length === 0) return { ketQua: [], khongCoTask: true };

  const ketQua = [];
  for (const task of inProgress) {
    const tep = resolveTaskFiles(repoRoot, task);
    if (!tep.ok) {
      // Chưa có checkpoint thì BỎ QUA, không đỏ — lý do ở khối đầu tệp.
      // Còn "có requirements mà không tìm ra" hay "nhiều tệp cùng khớp" là lỗi dữ liệu nền.
      if (tep.thieuCheckpoint) {
        ketQua.push({ task, boQua: tep.reason });
        continue;
      }
      throw new CheckpointInputError(tep.reason);
    }
    ketQua.push({
      task,
      checkpoint: tep.checkpoint,
      requirements: tep.requirements,
      report: checkCheckpointFile(repoRoot, tep.checkpoint, tep.requirements),
    });
  }
  return { ketQua, khongCoTask: false };
}

// -----------------------------------------------------------------------------
//  IN CHO NGƯỜI ĐỌC
// -----------------------------------------------------------------------------

/** Một dòng số đo, để người viết tự đối chiếu với dòng "Kết luận" trong mục 0 */
export function formatStats(stats) {
  const t = stats.tally;
  return (
    `  mục 0: ${stats.summaryLines}/${MAX_SUMMARY_LINES} dòng`
    + ` · bảng đối chiếu ${stats.dodRows} dòng / ${stats.dodBoxes} điều kiện`
    + ` · ${t['✅']} ✅ ${t['🔶']} 🔶 ${t['❌']} ❌`
    + ` · cả tệp ${stats.totalLines}/${MAX_FILE_LINES} dòng`
    + (stats.detailExists ? ' · có tệp _DETAIL.md' : '')
  );
}

function inLoi(errors) {
  const out = [];
  for (const e of errors) {
    out.push(`  [${e.code}] ${e.file}:${e.line}`);
    out.push(`      ${e.message}`);
  }
  return out.join('\n');
}

// -----------------------------------------------------------------------------
//  CLI
// -----------------------------------------------------------------------------

const USAGE = `Dùng: node scripts/check-checkpoint.mjs <checkpoint.md> <requirements.md>
      node scripts/check-checkpoint.mjs --in-progress

  <checkpoint> <requirements>  kiểm một checkpoint cụ thể
  --in-progress                kiểm checkpoint của task đang làm, đọc .kiro/task-status.json
                               (không có task nào đang làm thì bỏ qua, mã thoát 0)
  --help                       in hướng dẫn này

Mã thoát: 0 đạt · 1 checkpoint sai khuôn · 2 không chạy được (sai cách gọi / dữ liệu nền)

Quy ước: .kiro/steering/checkpoint.md`;

function main(argv) {
  const args = argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const co = args.filter((a) => a.startsWith('-'));
  const laCo = co.length > 0;
  if (laCo && (co.length !== 1 || co[0] !== '--in-progress' || args.length !== 1)) {
    process.stderr.write(`Cách gọi không nhận ra: ${args.join(' ')}\n\n${USAGE}\n`);
    return 2;
  }

  try {
    if (laCo) {
      const { ketQua, khongCoTask } = checkInProgress();
      if (khongCoTask) {
        process.stdout.write(
          'Không có task nào ở "inProgress" trong .kiro/task-status.json — bỏ qua.\n'
          + 'Script CHỈ kiểm checkpoint của task đang làm; checkpoint của task đã done là vết\n'
          + 'lịch sử, không kiểm và không sửa lại.\n',
        );
        return 0;
      }

      let soLoi = 0;
      for (const r of ketQua) {
        if (r.boQua) {
          process.stdout.write(`BỎ QUA  ${r.boQua} — chưa viết thì chưa kiểm được khuôn.\n`);
          continue;
        }
        const n = r.report.errors.length;
        soLoi += n;
        if (n === 0) {
          process.stdout.write(`ĐẠT     ${r.task} · ${r.checkpoint}\n${formatStats(r.report.stats)}\n`);
        } else {
          process.stderr.write(
            `SAI KHUÔN  ${r.task} · ${r.checkpoint} — ${n} lỗi\n`
            + `${formatStats(r.report.stats)}\n${inLoi(r.report.errors)}\n`,
          );
        }
      }
      if (soLoi > 0) {
        process.stderr.write('\nQuy ước: .kiro/steering/checkpoint.md · Khuôn: docs/CHECKPOINT_TEMPLATE.md\n');
        return 1;
      }
      return 0;
    }

    if (args.length !== 2) {
      process.stderr.write(`Cần đúng hai tham số.\n\n${USAGE}\n`);
      return 2;
    }

    const [checkpointRel, requirementsRel] = args.map((p) => path.relative(REPO_ROOT, path.resolve(p)));
    const report = checkCheckpointFile(REPO_ROOT, checkpointRel, requirementsRel);
    if (report.errors.length === 0) {
      process.stdout.write(`ĐẠT     ${checkpointRel}\n${formatStats(report.stats)}\n`);
      return 0;
    }
    process.stderr.write(
      `SAI KHUÔN  ${checkpointRel} — ${report.errors.length} lỗi\n`
      + `${formatStats(report.stats)}\n${inLoi(report.errors)}\n`
      + '\nQuy ước: .kiro/steering/checkpoint.md · Khuôn: docs/CHECKPOINT_TEMPLATE.md\n',
    );
    return 1;
  } catch (err) {
    if (err instanceof CheckpointInputError) {
      process.stderr.write(`Không chạy được phép kiểm:\n\n      ${err.message}\n`);
      return 2;
    }
    throw err;
  }
}

// Chỉ chạy CLI khi gọi trực tiếp; khi được import (test) thì không.
const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv));
}
