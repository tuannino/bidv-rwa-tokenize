import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CheckpointInputError,
  MAX_FILE_LINES,
  MAX_SUMMARY_LINES,
  STATUS_SYMBOLS,
  checkCheckpointFile,
  checkInProgress,
  demDieuKien,
  resolveTaskFiles,
} from '../../scripts/check-checkpoint.mjs';

/**
 * Chốt an toàn cho khuôn checkpoint (`.kiro/steering/checkpoint.md`).
 *
 * Mục 0 là thứ Supervisor đọc để QUYẾT. Nó lệch phần chi tiết được, và lệch kiểu nguy
 * hiểm nhất là **thiếu một dòng**: một điều kiện hoàn thành không ai đối chiếu, mà
 * không có gì đổ vỡ nên không ai phát hiện. Task vẫn được nghiệm thu PASS.
 *
 * Toàn bộ test chạy trên **tệp mẫu dựng trong thư mục tạm**, không chạy trên checkpoint
 * thật. Hai lý do, cả hai đều là bài học đã trả giá:
 *
 *  - Chạy trên repo thật thì test bám vào trạng thái repo và đỏ vì lý do không liên
 *    quan (MC-01 SL-6 đã sửa đúng loại lỗi này).
 *  - Checkpoint thật của task đã `done` **không** đạt khuôn mới, và đó là ĐÚNG:
 *    `CHECKPOINT_MC01.md` dài 5013 dòng, `CHECKPOINT_BE09.md` có mục 0 không phải bảng
 *    đối chiếu. Chúng là vết lịch sử, R4.4 cấm kiểm lại. Test bám vào chúng sẽ đòi sửa
 *    vết lịch sử để cho xanh.
 *
 * Mọi ngưỡng và ký hiệu đều **nhập từ script**, không khai lại: hai bản quy ước sẽ lệch
 * nhau, và lúc đó test bảo vệ một quy ước không còn tồn tại.
 */

const daTao: string[] = [];

afterAll(() => {
  for (const root of daTao) rmSync(root, { recursive: true, force: true });
});

// --- Tệp mẫu -----------------------------------------------------------------

const REQ_PATH = 'docs/mau-task/requirements.md';
const CP_PATH = 'docs/CHECKPOINT_MAU.md';

/** requirements mẫu: 3 điều kiện hoàn thành, kèm 2 ô `- [ ]` NGOÀI mục đó để bẫy phép đếm */
const REQUIREMENTS_MAU = [
  '# XX-01 — task mẫu: requirements',
  '',
  '## 1. Yêu cầu chức năng',
  '',
  'Danh sách dưới đây KHÔNG phải điều kiện hoàn thành, script không được đếm:',
  '',
  '- [ ] một ô đánh dấu ở mục khác',
  '- [ ] một ô đánh dấu nữa ở mục khác',
  '',
  '## 2. Điều kiện hoàn thành',
  '',
  '- [ ] Điều kiện thứ nhất.',
  '- [ ] Điều kiện thứ hai.',
  '- [ ] Điều kiện thứ ba.',
  '',
  '## 3. Ngoài phạm vi',
  '',
  '- [ ] ô này cũng không được đếm',
  '',
].join('\n');

interface Muc0Opts {
  /** Dòng dữ liệu của bảng đối chiếu; mặc định 3 dòng khớp 3 điều kiện */
  rows?: string[];
  /** Thêm dòng chèn vào mục 0 để đẩy độ dài vượt ngưỡng */
  chenThem?: number;
  /** Bỏ hẳn tiêu đề mục 0 */
  khongCoMuc0?: boolean;
  /** Số dòng rác thêm vào phần chi tiết, để đẩy cả tệp vượt ngưỡng */
  chenPhanChiTiet?: number;
}

const ROWS_DUNG = [
  '| 1 | Điều kiện thứ nhất | ✅ | mục 3.1 |',
  '| 2 | Điều kiện thứ hai | 🔶 | mục 4, SL-1 |',
  '| 3 | Điều kiện thứ ba | ❌ | mục 0.2 |',
];

/** Checkpoint mẫu theo đúng khuôn của docs/CHECKPOINT_TEMPLATE.md */
function checkpointMau(opts: Muc0Opts = {}): string {
  const { rows = ROWS_DUNG, chenThem = 0, khongCoMuc0 = false, chenPhanChiTiet = 0 } = opts;

  const muc0 = [
    '## 0. Tóm tắt nghiệm thu',
    '',
    '### 0.1 Đối chiếu điều kiện hoàn thành',
    '',
    '| # | Điều kiện | | Bằng chứng |',
    '|---|---|---|---|',
    ...rows,
    '',
    ...Array.from({ length: chenThem }, (_, i) => `Dòng chèn thứ ${i + 1} để kéo dài mục 0.`),
    '',
    `**Kết luận:** ${rows.length} dòng`,
    '',
    '### 0.2 Việc cần Owner quyết',
    '',
    '- Không có.',
    '',
    '---',
    '',
  ];

  return [
    '# Báo cáo bàn giao — XX-01: task mẫu',
    '',
    '| | |',
    '|---|---|',
    '| Mã task | XX-01 |',
    '',
    '---',
    '',
    ...(khongCoMuc0 ? [] : muc0),
    '## 1. Đã làm',
    '',
    'Phần chi tiết.',
    '',
    ...Array.from({ length: chenPhanChiTiet }, (_, i) => `Dòng chi tiết thứ ${i + 1}.`),
    '',
  ].join('\n');
}

/**
 * Repo giả: requirements mẫu + checkpoint mẫu. Không chạm repo thật, nên đột biến không
 * thể lọt vào commit.
 */
function repoGia(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'mc02-checkpoint-'));
  daTao.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text, 'utf8');
  }
  return root;
}

function repoChuan(checkpoint: string, thema: Record<string, string> = {}): string {
  return repoGia({ [REQ_PATH]: REQUIREMENTS_MAU, [CP_PATH]: checkpoint, ...thema });
}

function kiem(root: string) {
  return checkCheckpointFile(root, CP_PATH, REQ_PATH);
}

/** `[MÃ] docs/x.md:12  thông báo` — dán được vào terminal */
function viTri(loi: { code: string; file: string; line: number; message: string }): string {
  return `[${loi.code}] ${loi.file}:${loi.line}\n      ${loi.message}`;
}

// ---------------------------------------------------------------------------
//  CA XANH — đối chứng
// ---------------------------------------------------------------------------

describe('Checkpoint đúng khuôn thì không báo lỗi', () => {
  it('ca xanh — mục 0 đủ bảng, đủ bằng chứng, trong cả hai ngưỡng', () => {
    const bao = kiem(repoChuan(checkpointMau()));
    expect(
      bao.errors.map(viTri),
      'checkpoint ĐÚNG khuôn mà vẫn báo lỗi thì phép kiểm bắt oan, và người sau sẽ học cách bỏ qua nó',
    ).toEqual([]);
    expect(bao.stats.dodRows, 'phải nhận đúng 3 dòng bảng').toBe(3);
    expect(bao.stats.dodBoxes, 'phải đếm đúng 3 điều kiện, không tính 3 ô ngoài mục đó').toBe(3);
    expect(bao.stats.tally).toEqual({ '✅': 1, '🔶': 1, '❌': 1 });
    expect(bao.stats.summaryLines).toBeLessThanOrEqual(MAX_SUMMARY_LINES);
  });

  it('đếm điều kiện lấy ĐÚNG mục điều kiện hoàn thành, không đếm cả tệp', () => {
    // Bẫy của tệp mẫu: 3 ô trong mục DoD, 3 ô ở hai mục khác. Đếm cả tệp ra 6.
    const dk = demDieuKien(REQUIREMENTS_MAU);
    expect(dk.ok).toBe(true);
    if (!dk.ok) return;
    expect(dk.count, 'đếm cả tệp sẽ ra 6 — design.md mục 6 đòi lấy đúng mục').toBe(3);
    expect(dk.heading).toContain('Điều kiện hoàn thành');
  });

  it('cả tệp dài nhưng ĐÃ tách _DETAIL.md thì không đỏ', () => {
    const root = repoChuan(checkpointMau({ chenPhanChiTiet: MAX_FILE_LINES + 50 }), {
      'docs/CHECKPOINT_MAU_DETAIL.md': '# Chi tiết\n',
    });
    const bao = kiem(root);
    expect(bao.stats.totalLines).toBeGreaterThan(MAX_FILE_LINES);
    expect(bao.stats.detailExists).toBe(true);
    expect(bao.errors.map(viTri), 'đã tách rồi mà vẫn đòi tách thì ngưỡng thành vô nghĩa').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
//  NĂM CA ĐỎ — mỗi ca một mã lỗi (kiểm chứng bằng đột biến, tasks.md 3.3)
// ---------------------------------------------------------------------------

interface DotBien {
  ten: string;
  code: string;
  checkpoint: string;
  themTep?: Record<string, string>;
  /** Chuỗi phải có trong thông báo, để lỗi nói được cách sửa chứ không chỉ nói "sai" */
  thongBaoChua: string;
}

const DOT_BIEN: DotBien[] = [
  {
    ten: 'bỏ hẳn tiêu đề mục 0',
    code: 'NO_SUMMARY',
    checkpoint: checkpointMau({ khongCoMuc0: true }),
    thongBaoChua: 'CHECKPOINT_TEMPLATE.md',
  },
  {
    ten: `mục 0 dài hơn ${MAX_SUMMARY_LINES} dòng`,
    code: 'SUMMARY_TOO_LONG',
    checkpoint: checkpointMau({ chenThem: MAX_SUMMARY_LINES + 5 }),
    thongBaoChua: `vượt ngưỡng ${MAX_SUMMARY_LINES}`,
  },
  {
    ten: 'bảng thiếu một dòng so với điều kiện hoàn thành',
    code: 'DOD_COUNT_MISMATCH',
    checkpoint: checkpointMau({ rows: ROWS_DUNG.slice(0, 2) }),
    thongBaoChua: 'không thêm không bớt',
  },
  {
    ten: 'cột bằng chứng ghi "đã làm" thay vì số mục',
    code: 'MISSING_EVIDENCE',
    checkpoint: checkpointMau({
      rows: [...ROWS_DUNG.slice(0, 2), '| 3 | Điều kiện thứ ba | ❌ | đã làm |'],
    }),
    thongBaoChua: 'SỐ MỤC',
  },
  {
    ten: `cả tệp vượt ${MAX_FILE_LINES} dòng mà chưa tách _DETAIL.md`,
    code: 'NOT_SPLIT',
    checkpoint: checkpointMau({ chenPhanChiTiet: MAX_FILE_LINES + 50 }),
    thongBaoChua: 'CHECKPOINT_MAU_DETAIL.md',
  },
];

describe('Phép kiểm có răng — năm đột biến, mỗi đột biến một mã lỗi', () => {
  it.each(DOT_BIEN)('$code — $ten', ({ code, checkpoint, themTep, thongBaoChua }) => {
    const bao = kiem(repoChuan(checkpoint, themTep));
    expect(
      bao.errors.map((e) => e.code),
      'đột biến không bị bắt, hoặc bị bắt sai mã. Lỗi thật nhận được:\n'
        + `${bao.errors.map(viTri).join('\n') || '  (không có lỗi nào)'}\n`,
    ).toEqual([code]);
    expect(bao.errors[0].file, 'lỗi phải chỉ đúng tệp').toBe(CP_PATH);
    expect(bao.errors[0].line, 'lỗi phải chỉ ra một dòng có thật').toBeGreaterThan(0);
    expect(
      bao.errors[0].message,
      'thông báo phải nói CÁCH SỬA, không chỉ nói là sai',
    ).toContain(thongBaoChua);
  });

  it('chốt chặn — năm ca trên phủ đúng tập mã lỗi của script', () => {
    // Thêm mã lỗi thứ sáu vào script mà không thêm ca ở đây thì phép kiểm này đỏ. Cố ý:
    // R4.2 chốt ĐÚNG năm ca, mã lỗi mới là đổi hợp đồng của script và phải được chốt lại.
    expect(new Set(DOT_BIEN.map((d) => d.code))).toEqual(
      new Set(['NO_SUMMARY', 'SUMMARY_TOO_LONG', 'DOD_COUNT_MISMATCH', 'MISSING_EVIDENCE', 'NOT_SPLIT']),
    );
  });

  it('bảng có dòng nhưng thiếu ký hiệu trạng thái thì báo rõ dòng nào', () => {
    // Dòng không mang ✅/🔶/❌ không được tính là dòng đối chiếu, nên nó ra DOD_COUNT_MISMATCH.
    // Thông báo phải chỉ đúng dòng, nếu không người sửa đi đếm tay cả bảng.
    const bao = kiem(
      repoChuan(checkpointMau({ rows: [...ROWS_DUNG.slice(0, 2), '| 3 | Điều kiện thứ ba | | mục 5 |'] })),
    );
    expect(bao.errors.map((e) => e.code)).toEqual(['DOD_COUNT_MISMATCH']);
    expect(bao.errors[0].message).toContain('KHÔNG có ký hiệu trạng thái');
    expect(bao.errors[0].message).toContain(STATUS_SYMBOLS.join(' / '));
  });

  it('cột bằng chứng rỗng cũng là MISSING_EVIDENCE', () => {
    const bao = kiem(
      repoChuan(checkpointMau({ rows: [...ROWS_DUNG.slice(0, 2), '| 3 | Điều kiện thứ ba | ❌ | |'] })),
    );
    expect(bao.errors.map((e) => e.code)).toEqual(['MISSING_EVIDENCE']);
  });
});

// ---------------------------------------------------------------------------
//  R4.3 / R4.4 — CHỈ KIỂM TASK ĐANG LÀM
// ---------------------------------------------------------------------------
//  Đây là phần dễ sai âm thầm nhất: nếu --in-progress lặng lẽ không kiểm gì thì mọi ca
//  trên vẫn xanh, run-local-all.sh vẫn xanh, và không ai biết cổng này đã rỗng ruột.

const CP_XX01 = 'docs/CHECKPOINT_XX01.md';
const REQ_XX01 = '.kiro/specs/xx-01-task-mau/requirements.md';

function repoTaskStatus(trangThai: object, thema: Record<string, string> = {}): string {
  return repoGia({
    '.kiro/task-status.json': JSON.stringify(trangThai),
    [REQ_XX01]: REQUIREMENTS_MAU,
    ...thema,
  });
}

describe('--in-progress chỉ kiểm checkpoint của task đang làm', () => {
  it('không có task nào đang làm thì bỏ qua, không đỏ', () => {
    const root = repoTaskStatus({ done: ['XX-01'], inProgress: [], planned: [] });
    const kq = checkInProgress(root);
    expect(kq.khongCoTask).toBe(true);
    expect(kq.ketQua).toEqual([]);
  });

  it('KHÔNG kiểm checkpoint của task đã done, dù checkpoint đó sai khuôn nặng', () => {
    // Checkpoint của XX-01 ở đây vừa thiếu mục 0 vừa dài quá ngưỡng. Task đã `done` nên
    // script phải KHÔNG chạm tới: vết lịch sử không sửa lại để vừa một quy tắc ra sau.
    const root = repoTaskStatus(
      { done: ['XX-01'], inProgress: [], planned: [] },
      { [CP_XX01]: checkpointMau({ khongCoMuc0: true, chenPhanChiTiet: MAX_FILE_LINES + 50 }) },
    );

    const kq = checkInProgress(root);
    expect(kq.khongCoTask, 'task done vẫn bị coi là đang làm').toBe(true);
    expect(kq.ketQua, 'đã kiểm checkpoint của task done — vi phạm R4.4').toEqual([]);

    // Đối chứng: chính tệp đó, kiểm tường minh thì PHẢI đỏ. Không có khẳng định này thì
    // ca trên xanh cả khi script hỏng và không kiểm được gì cả.
    const truc = checkCheckpointFile(root, CP_XX01, REQ_XX01);
    expect(truc.errors.map((e) => e.code).sort()).toEqual(['NOT_SPLIT', 'NO_SUMMARY']);
  });

  it('task đang làm và checkpoint đúng khuôn thì đạt', () => {
    const root = repoTaskStatus(
      { done: [], inProgress: ['XX-01'], planned: [] },
      { [CP_XX01]: checkpointMau() },
    );
    const kq = checkInProgress(root);
    expect(kq.khongCoTask).toBe(false);
    expect(kq.ketQua).toHaveLength(1);
    expect(kq.ketQua[0].task).toBe('XX-01');
    expect(kq.ketQua[0].checkpoint, 'phải suy ra đúng tên tệp từ mã task').toBe(CP_XX01);
    expect(kq.ketQua[0].requirements, 'phải ưu tiên bản .kiro/specs/').toBe(REQ_XX01);
    expect(kq.ketQua[0].report?.errors.map(viTri)).toEqual([]);
  });

  it('task đang làm và checkpoint sai khuôn thì đỏ', () => {
    const root = repoTaskStatus(
      { done: [], inProgress: ['XX-01'], planned: [] },
      { [CP_XX01]: checkpointMau({ rows: ROWS_DUNG.slice(0, 1) }) },
    );
    const kq = checkInProgress(root);
    expect(kq.ketQua[0].report?.errors.map((e) => e.code)).toEqual(['DOD_COUNT_MISMATCH']);
  });

  it('task đang làm mà chưa viết checkpoint thì BỎ QUA, không đỏ', () => {
    // Trong lúc đang làm task thì checkpoint chưa có là bình thường. Báo đỏ ở đây biến
    // run-local-all.sh thành đèn đỏ thường trực, và đèn đỏ thường trực thì bị bỏ qua.
    // Nghĩa vụ "phải có checkpoint trước khi mở PR" nằm ở branching.md §11.
    const root = repoTaskStatus({ done: [], inProgress: ['XX-01'], planned: [] });
    const kq = checkInProgress(root);
    expect(kq.ketQua).toHaveLength(1);
    expect(kq.ketQua[0].report, 'không có gì để kiểm thì không được sinh báo cáo').toBeUndefined();
    expect(kq.ketQua[0].boQua).toContain(CP_XX01);
  });

  it('nguồn trạng thái task hỏng thì ném lỗi, không im lặng bỏ qua', () => {
    // Một mã ở hai danh sách thì "task nào đang làm" không xác định. Im lặng đi qua thì
    // cổng này rỗng ruột mà vẫn xanh.
    const root = repoTaskStatus({ done: ['XX-01'], inProgress: ['XX-01'], planned: [] });
    expect(() => checkInProgress(root)).toThrow(CheckpointInputError);
  });

  it('requirements không tìm được thì ném lỗi dữ liệu nền, không coi là đạt', () => {
    const root = repoGia({
      '.kiro/task-status.json': JSON.stringify({ done: [], inProgress: ['XX-01'], planned: [] }),
      [CP_XX01]: checkpointMau(),
    });
    expect(() => checkInProgress(root)).toThrow(CheckpointInputError);
  });
});

describe('Suy tên tệp từ mã task', () => {
  it('nhận cả dạng có hậu tố, ví dụ CHECKPOINT_FE01_V2.md', () => {
    const root = repoGia({
      '.kiro/specs/fe-01-investor-channel-v2/requirements.md': REQUIREMENTS_MAU,
      'docs/CHECKPOINT_FE01_V2.md': checkpointMau(),
    });
    const kq = resolveTaskFiles(root, 'FE-01');
    expect(kq.ok).toBe(true);
    if (!kq.ok) return;
    expect(kq.checkpoint).toBe('docs/CHECKPOINT_FE01_V2.md');
  });

  it('nhiều tệp cùng khớp thì DỪNG, không tự chọn', () => {
    // Tự chọn một trong hai là kiểm sai checkpoint mà không ai biết.
    const root = repoGia({
      '.kiro/specs/fe-01-investor-channel/requirements.md': REQUIREMENTS_MAU,
      'docs/CHECKPOINT_FE01_V1.md': checkpointMau(),
      'docs/CHECKPOINT_FE01_V2.md': checkpointMau(),
    });
    const kq = resolveTaskFiles(root, 'FE-01');
    expect(kq.ok).toBe(false);
    if (kq.ok) return;
    expect(kq.thieuCheckpoint).toBe(false);
    expect(kq.reason).toContain('KHÔNG tự chọn');
  });

  it('tệp _DETAIL.md không bị nhận là checkpoint chính', () => {
    const root = repoGia({
      '.kiro/specs/xx-01-task-mau/requirements.md': REQUIREMENTS_MAU,
      'docs/CHECKPOINT_XX01_DETAIL.md': '# Chi tiết\n',
    });
    const kq = resolveTaskFiles(root, 'XX-01');
    expect(kq.ok).toBe(false);
    if (kq.ok) return;
    expect(kq.thieuCheckpoint, 'chỉ có tệp chi tiết thì coi như chưa có checkpoint chính').toBe(true);
  });
});
