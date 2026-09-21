import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  MIN_NOTE_CHARS,
  REPORT_FILE,
  VAGUE_PHRASES,
  checkReportSection,
  listScannedFiles,
  scan,
} from '../../scripts/scan-pending.mjs';
import { checkFlowDoc, orphanFlowDocs } from '../../scripts/gen-flow-diagram.mjs';

/**
 * Chốt an toàn cho cơ chế điểm cắm (`.kiro/steering/make-control.md`).
 *
 * Marker `@pending` / `@blocked` là thứ CON NGƯỜI khai, nên nó lệch mã nguồn được.
 * Lệch kiểu nguy hiểm nhất là marker chờ một task ĐÃ XONG: nó nói với người đọc
 * "chỗ này còn dở" trong khi chỗ đó đã được cắm xong từ lâu. Sai kiểu đó không làm
 * gì đổ vỡ, nên không ai phát hiện — tới lúc bảng điểm cắm đầy rác thì không ai còn
 * tin nó, và cả cơ chế thành vô dụng.
 *
 * Test này biến việc DỌN MARKER thành việc bắt buộc khi hoàn thành task, thay vì
 * việc nhớ được thì làm. Cùng tinh thần với `abi-contract-sync.test.ts`: chốt một
 * quyết định viết tay bằng một phép đối chiếu tự động.
 *
 * Hai tầng, và cần cả hai:
 *
 *  - Tầng 1 kiểm REPO THẬT. Đây là cái chặn thật, nhưng hiện nó xanh — mà một test
 *    luôn xanh thì không phân biệt được "cơ chế đúng" với "cơ chế không chạy".
 *  - Tầng 2 kiểm CHÍNH PHÉP KIỂM, bằng repo giả dựng trong thư mục tạm. Nó chứng
 *    minh tầng 1 có răng: đưa marker sai vào thì `scan()` phải báo đúng mã lỗi.
 *
 * Cú pháp marker và mọi ngưỡng đều NHẬP từ `scripts/scan-pending.mjs`, không khai
 * lại ở đây. Hai bản quy ước sẽ lệch nhau, và lúc đó test bảo vệ một quy ước không
 * còn tồn tại.
 */

// Bốn ca có tên theo design.md mục 3. Mã lỗi nào không thuộc bốn ca này thì rơi vào
// phép kiểm chốt chặn cuối, nên thêm mã lỗi mới vào script không tạo lỗ hổng im lặng.
const CACH_SUA: Record<string, string> = {
  BAD_SYNTAX:
    'Cú pháp đúng, chọn một trong ba dạng:\n' +
    '    // @pending <MÃ-TASK> | <đã sẵn những gì>\n' +
    '    // @blocked <MÃ-TASK> | <thiếu gì>\n' +
    '    // @flow <tên-luồng>:<số nguyên> | <việc của bước này>\n' +
    '  Hay quên nhất: thiếu dấu | , hoặc mô tả rỗng, hoặc số bước ghi thập phân.\n' +
    '  Marker phải đứng ngay sau dấu mở chú thích (`// @pending ...`), không lọt giữa câu văn.',
  UNKNOWN_TASK:
    'Mã task phải nằm trong `.kiro/task-status.json` (hợp done + inProgress + planned).\n' +
    '  Mở tệp đó ra: hoặc bạn gõ sai mã, hoặc task này chưa được khai. Đừng sửa test.',
  STALE_TASK:
    'Task đã `done` mà marker vẫn chờ nó. Đúng hai cách sửa, chọn một:\n' +
    '    (a) DỌN MARKER — điểm cắm đã được dùng, marker hết việc (steering mục 7, vế b);\n' +
    '    (b) bỏ mã khỏi "done" trong `.kiro/task-status.json` — task chưa thật sự xong.\n' +
    '  Không có cách thứ ba. Nới phép kiểm cho xanh là bỏ luôn lý do test này tồn tại.',
  VAGUE_NOTE:
    'Mô tả sau dấu | vô dụng với người đọc. Người nhận task đọc đúng câu đó để biết\n' +
    `  mình KHÔNG phải viết lại cái gì (@pending) hoặc còn thiếu đúng cái gì (@blocked).\n` +
    `  Ngưỡng: tối thiểu ${MIN_NOTE_CHARS} ký tự, và không được gần như chỉ gồm một cụm\n` +
    `  vô nghĩa (${VAGUE_PHRASES.join(', ')}).\n` +
    '  Ví dụ đủ: "đã sẵn: validate Zod + kiểm quyền + ghi sổ kiểm toán, chỉ cần gọi".',
  BAD_FLOW_STEP:
    'Số bước trong cùng một luồng phải là một CHUỖI SỐ NGUYÊN LIÊN TIẾP TỪ 1:\n' +
    '  không trùng, không nhảy cách, không bắt đầu từ số khác 1.\n' +
    '  Ba kiểu sai và ý nghĩa của từng kiểu:\n' +
    '    trùng số      — hai hàm cùng nhận là bước thứ n, nên thứ tự giữa chúng không xác định;\n' +
    '    nhảy cách     — thiếu bước giữa, dấu hiệu ai đó xóa hàm mà quên sửa marker;\n' +
    '    không từ 1    — thiếu bước đầu, cùng một dấu hiệu như trên.\n' +
    '  Cần chèn một bước vào giữa thì ĐÁNH SỐ LẠI CẢ LUỒNG. Số thập phân (purchase:3.5) là\n' +
    '  sai cú pháp và cũng bỏ mất chính phép kiểm này (steering mục 4).',
};

const CA_CO_TEN = new Set(Object.keys(CACH_SUA));

const report = scan();

/** `app/src/x.ts:12  thông báo` — dán được vào terminal để mở đúng dòng */
function viTri(loi: { file: string; line: number; message: string }): string {
  const where = loi.line > 0 ? `${loi.file}:${loi.line}` : loi.file;
  return `${where}\n      ${loi.message}`;
}

function loiTheoMa(code: string): string[] {
  return report.errors.filter((e) => e.code === code).map(viTri);
}

function thongBao(code: string): string {
  return `\n\n  [${code}] — ${CACH_SUA[code]}\n`;
}

describe('Marker điểm cắm trong repo thật', () => {
  // Chống rỗng ruột: bốn ca dưới đây đều là "không có lỗi loại X". Nếu phạm vi quét
  // rỗng thì cả bốn xanh mà không kiểm gì. Khẳng định này làm chỗ đó lộ ra.
  it('phạm vi quét đọc được mã nguồn thật, không rỗng', () => {
    const files = listScannedFiles();
    expect(files.length, 'không quét được tệp nào — kiểm SCAN_ROOTS trong scripts/scan-pending.mjs').toBeGreaterThan(0);
    expect(
      files.filter((f: string) => f.startsWith('app/src/lib/ledger/')).length,
      'không thấy tệp nào trong app/src/lib/ledger — phạm vi quét đã lệch khỏi mã nguồn',
    ).toBeGreaterThan(0);
  });

  it('ca 1 — mọi marker đúng cú pháp', () => {
    expect(loiTheoMa('BAD_SYNTAX'), thongBao('BAD_SYNTAX')).toEqual([]);
  });

  it('ca 2 — mã task trong marker đều tồn tại', () => {
    expect(loiTheoMa('UNKNOWN_TASK'), thongBao('UNKNOWN_TASK')).toEqual([]);
  });

  it('ca 3 — không marker nào chờ task đã hoàn thành', () => {
    expect(loiTheoMa('STALE_TASK'), thongBao('STALE_TASK')).toEqual([]);
  });

  it('ca 4 — mô tả marker không rỗng và không chung chung', () => {
    // Mô tả RỖNG không tới được đây: script báo nó là BAD_SYNTAX (ca 1). Ở đây là
    // phần còn lại của yêu cầu: mô tả có chữ nhưng không nói được gì.
    expect(loiTheoMa('VAGUE_NOTE'), thongBao('VAGUE_NOTE')).toEqual([]);
  });

  it('ca 5 — số bước của mỗi luồng là chuỗi liên tiếp từ 1', () => {
    expect(loiTheoMa('BAD_FLOW_STEP'), thongBao('BAD_FLOW_STEP')).toEqual([]);
  });

  it('chốt chặn — không còn loại lỗi marker nào khác', () => {
    const khac = report.errors.filter((e) => !CA_CO_TEN.has(e.code));
    expect(
      khac.map((e) => `[${e.code}] ${viTri(e)}`),
      '\n\n  Có loại lỗi marker ngoài bốn ca có tên. Chạy `node scripts/scan-pending.mjs --check`\n' +
        '  để xem chi tiết và cách sửa. Phép kiểm này cố ý bắt TẤT CẢ mã lỗi còn lại, để mã\n' +
        '  lỗi mới thêm vào script không lặng lẽ nằm ngoài tầm test.\n',
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
//  TẦNG 2 — kiểm chính phép kiểm, bằng repo giả trong thư mục tạm
// ---------------------------------------------------------------------------

const daTao: string[] = [];

afterAll(() => {
  for (const root of daTao) rmSync(root, { recursive: true, force: true });
});

const TRANG_THAI_GIA = JSON.stringify({
  done: ['BE-02'],
  inProgress: ['MC-01'],
  planned: ['FE-05'],
});

/**
 * Repo giả: `.kiro/task-status.json` + một tệp mã trong phạm vi quét.
 * Không chạm repo thật, nên đột biến không thể lọt vào commit.
 */
function repoGia(noiDung: string, trangThai: string = TRANG_THAI_GIA): string {
  const root = mkdtempSync(path.join(tmpdir(), 'mc01-marker-'));
  daTao.push(root);
  for (const [rel, text] of Object.entries({
    '.kiro/task-status.json': trangThai,
    'app/src/probe.ts': noiDung,
  })) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text, 'utf8');
  }
  return root;
}

const MO_TA_DU = 'đã sẵn: validate Zod + kiểm quyền, chỉ cần gọi';

interface DotBien {
  ten: string;
  ca: string;
  code: string;
  than: string;
  soLoi?: number;
}

// Thêm ca mới = thêm một dòng vào bảng này.
//
// Ba ca BAD_FLOW_STEP ở cuối bảng có một ràng buộc không hiển nhiên: `validateFlowSteps`
// báo lỗi nhảy cách và lỗi "không bắt đầu từ 1" TẠI marker của bước LỚN HƠN, nên muốn lỗi
// đầu tiên nằm ở dòng 1 (phép kiểm chung của bảng này khẳng định thế) thì marker bước lớn
// phải viết TRƯỚC trong tệp giả. Thứ tự marker trong tệp không liên quan tới thứ tự bước —
// đó cũng chính là lý do số bước phải khai tường minh chứ không suy từ vị trí dòng.
const DOT_BIEN: DotBien[] = [
  {
    ten: 'thiếu dấu | sau mã task',
    ca: 'ca 1',
    code: 'BAD_SYNTAX',
    than: `// @pending FE-05 ${MO_TA_DU}\nexport function probe() { return 1; }\n`,
  },
  {
    ten: 'mã task không có trong nguồn trạng thái',
    ca: 'ca 2',
    code: 'UNKNOWN_TASK',
    than: `// @pending XX-99 | ${MO_TA_DU}\nexport function probe() { return 1; }\n`,
  },
  {
    ten: 'marker chờ task đã done',
    ca: 'ca 3',
    code: 'STALE_TASK',
    than: `// @pending BE-02 | ${MO_TA_DU}\nexport function probe() { return 1; }\n`,
  },
  {
    ten: 'mô tả chung chung',
    ca: 'ca 4',
    code: 'VAGUE_NOTE',
    than: '// @pending FE-05 | chờ làm\nexport function probe() { return 1; }\n',
  },
  {
    // Hai bước 2, một bước 1: chuỗi vẫn bắt đầu từ 1 và không có khoảng trống, nên lỗi DUY
    // NHẤT là lỗi trùng — cô lập đúng một triệu chứng thay vì kéo theo hai lỗi khác.
    ten: 'hai bước cùng số trong một luồng',
    ca: 'ca 5',
    code: 'BAD_FLOW_STEP',
    soLoi: 2, // một lỗi cho MỖI marker trong nhóm trùng, để cả hai chỗ đều chỉ ra được
    than:
      '// @flow purchase:2 | validate rồi lưu lệnh PLACED\nexport function mot() { return 1; }\n\n' +
      '// @flow purchase:2 | chốt số VNDB phải trả\nexport function hai() { return 2; }\n\n' +
      '// @flow purchase:1 | nhận yêu cầu đặt lệnh\nexport function ba() { return 3; }\n',
  },
  {
    ten: 'chuỗi bước nhảy cách',
    ca: 'ca 5',
    code: 'BAD_FLOW_STEP',
    than:
      '// @flow purchase:3 | chốt số VNDB phải trả\nexport function mot() { return 1; }\n\n' +
      '// @flow purchase:1 | nhận yêu cầu đặt lệnh\nexport function hai() { return 2; }\n',
  },
  {
    ten: 'chuỗi bước không bắt đầu từ 1',
    ca: 'ca 5',
    code: 'BAD_FLOW_STEP',
    than:
      '// @flow purchase:2 | validate rồi lưu lệnh PLACED\nexport function mot() { return 1; }\n\n' +
      '// @flow purchase:3 | chốt số VNDB phải trả\nexport function hai() { return 2; }\n',
  },
];

describe('Phép kiểm có răng — đột biến trên repo giả', () => {
  it('đối chứng: marker đúng thì không sinh lỗi và vào được bảng', () => {
    const root = repoGia(`// @pending FE-05 | ${MO_TA_DU}\nexport function probe() { return 1; }\n`);
    const bao = scan(root);
    expect(bao.errors, 'marker ĐÚNG mà vẫn báo lỗi thì phép kiểm bắt oan').toEqual([]);
    expect(bao.markers.map((m) => ({ kind: m.kind, task: m.task, symbol: m.symbol }))).toEqual([
      { kind: 'pending', task: 'FE-05', symbol: 'probe' },
    ]);
  });

  it('nhiều điểm cắm cũng không phải lỗi', () => {
    // Chốt lại điều steering nhấn mạnh: điểm cắm là TRẠNG THÁI CÔNG VIỆC, không phải
    // lỗi. Kiểm trên repo giả chứ không trên repo thật, vì trên repo thật thì khẳng
    // định "không có lỗi" chỉ lặp lại bốn ca ở tầng 1 dưới một cái tên nói sai việc
    // nó làm — đột biến ca 3 sẽ kéo nó đỏ theo với thông báo vô dụng.
    const root = repoGia(
      `// @pending FE-05 | ${MO_TA_DU}\nexport function mot() { return 1; }\n\n` +
        `// @blocked SC-02 | thiếu hợp đồng phát hành một lần, chưa contract nào giữ cờ\n` +
        `export function hai() { return 2; }\n\n` +
        `// @pending FE-05 | đã sẵn quy đổi VNDB sang WPT theo giá phát hành\n` +
        `export function ba() { return 3; }\n`,
      JSON.stringify({ done: ['BE-02'], inProgress: ['MC-01'], planned: ['FE-05', 'SC-02'] }),
    );
    const bao = scan(root);
    expect(bao.errors, 'nhiều marker hợp lệ mà vẫn đỏ thì người sau sẽ xóa marker cho xanh').toEqual([]);
    expect(bao.byTask).toEqual({ 'FE-05': 2, 'SC-02': 1 });
    expect(bao.summary).toEqual({ pending: 2, blocked: 1, flows: 0, errors: 0 });
  });

  it.each(DOT_BIEN)('$ca — $ten phải sinh $code', ({ code, than, soLoi = 1 }) => {
    const root = repoGia(than);
    const bao = scan(root);
    expect(
      bao.errors.map((e) => e.code),
      `đột biến không bị bắt, hoặc bị bắt sai mã. Lỗi thật nhận được:\n` +
        `${bao.errors.map(viTri).join('\n') || '  (không có lỗi nào)'}\n`,
    ).toEqual(Array.from({ length: soLoi }, () => code));
    expect(bao.errors[0].file, 'lỗi phải chỉ đúng tệp').toBe('app/src/probe.ts');
    expect(bao.errors[0].line, 'lỗi phải chỉ đúng dòng').toBe(1);
    expect(bao.errors[0].message.length, 'thông báo lỗi phải có tính chẩn đoán').toBeGreaterThan(30);
  });

  it('nguồn trạng thái task hỏng thì báo đỏ, không im lặng bỏ qua', () => {
    // Khi một mã nằm ở hai danh sách thì ca 2 và ca 3 cho kết quả tùy thứ tự đọc —
    // nền của cả bốn ca sụp. Im lặng đi qua thì test xanh mà vô nghĩa.
    const root = repoGia(
      `// @pending FE-05 | ${MO_TA_DU}\nexport function probe() { return 1; }\n`,
      JSON.stringify({ done: ['FE-05'], inProgress: ['MC-01'], planned: ['FE-05'] }),
    );
    const bao = scan(root);
    expect(bao.errors.map((e) => e.code)).toContain('BAD_TASK_STATUS');
  });
});

// ---------------------------------------------------------------------------
//  SƠ ĐỒ LUỒNG TRONG docs/flows/ PHẢI KHỚP MARKER
// ---------------------------------------------------------------------------
//  Cùng một loại sai với ca 3 (marker lạc hậu), chỉ đổi chỗ: tệp sinh ra được COMMIT, nên
//  nó lệch mã ÂM THẦM khi ai đó sửa marker rồi quên sinh lại. Không có gì đổ vỡ nên không
//  ai phát hiện, và sơ đồ nói một đằng còn mã làm một nẻo.
//
//  Phép kiểm nằm ở đây thay vì thành một mục mới trong scripts/run-local-all.sh: nó cùng
//  họ với các ca trên, và người sửa marker thấy cả hai nghĩa vụ trong một lần chạy.
//
//  Danh sách luồng lấy TỪ MARKER, không gõ tay: gắn thêm một luồng mới thì ca này tự phủ
//  luôn luồng đó, không phải nhớ sửa test.

describe('Sơ đồ luồng sinh ra khớp marker trong mã', () => {
  const tenLuong = [...new Set(report.flows.map((f) => f.flow))].sort();

  it('có ít nhất một luồng đã gắn marker để sơ đồ có thứ mà mô tả', () => {
    // Chống rỗng ruột, cùng lý do như ca "phạm vi quét không rỗng": nếu chưa luồng nào gắn
    // marker thì ca dưới chạy zero lần và xanh mà không kiểm gì.
    expect(
      tenLuong,
      'chưa luồng nào có marker @flow — xem .kiro/steering/make-control.md mục 4',
    ).not.toEqual([]);
  });

  it.each(tenLuong)('docs/flows/%s.md khớp marker hiện tại', (ten) => {
    const kq = checkFlowDoc(report, ten);
    expect(
      kq.ok ? null : kq.reason,
      '\n\n  Sơ đồ trên đĩa đã lạc hậu so với marker @flow. Sinh lại bằng\n' +
        `  \`node scripts/gen-flow-diagram.mjs ${ten}\` rồi commit tệp sinh ra.\n` +
        '  ĐỪNG sửa tay tệp trong docs/flows/: lần sinh sau ghi đè, và trong khoảng thời gian\n' +
        '  trước đó thì sơ đồ nói một đằng còn mã làm một nẻo.\n',
    ).toBeNull();
  });

  it('không tệp nào trong docs/flows/ mất gốc marker', () => {
    expect(
      orphanFlowDocs(report),
      '\n\n  Tệp sơ đồ còn trên đĩa nhưng luồng tương ứng không còn marker @flow nào trong mã.\n' +
        '  Hoặc marker bị xóa mà quên xóa tệp, hoặc tên luồng đã đổi. Xóa tệp, hoặc gắn lại\n' +
        '  marker. Giữ nguyên là giữ một sơ đồ không còn gốc trong mã nguồn.\n',
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
//  MỤC ĐIỂM CẮM TRONG docs/tech-report.md PHẢI KHỚP MARKER
// ---------------------------------------------------------------------------
//  Cùng một loại sai với hai nhóm trên, chỉ đổi chỗ lần thứ ba: R10.2 đòi mục điểm cắm trong báo
//  cáo công nghệ phải SINH TỰ ĐỘNG, và tệp sinh ra được COMMIT — nên nó lệch mã ÂM THẦM khi ai
//  đó sửa marker rồi quên sinh lại.
//
//  Ở đây hại hơn ở docs/flows/: báo cáo công nghệ là tài liệu tham chiếu ĐẦU TIÊN của dev mới
//  (nó nói thế ngay ở đầu tệp). Một bảng điểm cắm lạc hậu trong đó nói với người vào sau rằng
//  chỗ nào còn dở, mà nói sai.
//
//  Phép kiểm nằm ở đây thay vì thành mục thứ tám của scripts/run-local-all.sh: cùng lý do đã ghi
//  cho phép kiểm sơ đồ luồng — người sửa marker thấy mọi nghĩa vụ trong một lần chạy.

describe('Mục điểm cắm trong báo cáo công nghệ khớp marker', () => {
  it(`${REPORT_FILE} có mục điểm cắm và mục đó khớp marker hiện tại`, () => {
    const kq = checkReportSection(report);
    expect(
      kq.ok ? null : kq.reason,
      '\n\n  Mục điểm cắm trong báo cáo công nghệ đã lạc hậu so với marker trong mã. Sinh lại\n' +
        '  bằng `node scripts/scan-pending.mjs --write-report` rồi commit tệp đã sinh.\n' +
        '  ĐỪNG sửa tay khối giữa hai mốc <!-- BEGIN:diem-cam --> / <!-- END:diem-cam -->:\n' +
        '  lần sinh sau ghi đè, và trong khoảng thời gian trước đó thì bảng nói một đằng còn\n' +
        '  mã làm một nẻo. Chữ NGOÀI hai mốc thì viết tay, script không chạm tới.\n',
    ).toBeNull();
  });

  it('phép kiểm có răng: báo cáo lệch marker thì phải báo đỏ', () => {
    // Ca trên là "không có lỗi", nên nó xanh cả khi checkReportSection hỏng và luôn trả ok.
    // Đột biến ở đây làm trên BÁO CÁO ĐANG CÓ THẬT nhưng với dữ liệu marker đã bớt một dòng —
    // không chạm đĩa, nên không có đường nào lọt vào commit.
    expect(report.markers.length, 'cần ít nhất một marker để bớt đi').toBeGreaterThan(0);
    const thieuMotDong = {
      ...report,
      markers: report.markers.slice(1),
      summary: { ...report.summary, pending: report.summary.pending - 1 },
    };
    const kq = checkReportSection(thieuMotDong);
    expect(
      kq.ok,
      'bảng trong báo cáo vẫn được coi là khớp dù dữ liệu marker đã khác — phép kiểm rỗng ruột',
    ).toBe(false);
    expect(
      kq.ok ? '' : kq.reason,
      'thông báo lệch phải chỉ ra lệnh sinh lại, không chỉ nói "khác nhau"',
    ).toContain('--write-report');
  });
});
