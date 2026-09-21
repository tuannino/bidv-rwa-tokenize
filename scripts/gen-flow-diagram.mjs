#!/usr/bin/env node
// =============================================================================
//  SINH SƠ ĐỒ LUỒNG THỰC THI từ marker @flow trong mã nguồn
//
//  Chạy từ GỐC repo:
//    node scripts/gen-flow-diagram.mjs purchase            ghi docs/flows/purchase.md
//    node scripts/gen-flow-diagram.mjs purchase --check     so tệp trên đĩa với marker
//    node scripts/gen-flow-diagram.mjs --check              so MỌI luồng + bắt tệp mồ côi
//
//  Quy ước marker: .kiro/steering/make-control.md mục 4
//  Quyết định thiết kế: .kiro/specs/mc-01-make-control/design.md QĐ-5, QĐ-6
//
// -----------------------------------------------------------------------------
//  KHÔNG QUÉT LẠI MÃ NGUỒN
// -----------------------------------------------------------------------------
//  Toàn bộ dữ liệu vào lấy từ `scan()` của scripts/scan-pending.mjs. Viết lại biểu thức
//  chính quy ở đây là tạo bản quy ước thứ hai, và nó sẽ lệch bản thứ nhất ngay lần đầu ai
//  đó sửa cú pháp — lúc đó sơ đồ mô tả một quy ước không còn tồn tại.
//
// -----------------------------------------------------------------------------
//  VÌ SAO CÓ --check (và vì sao nó nằm trong test, không nằm trong run-local-all.sh)
// -----------------------------------------------------------------------------
//  Tệp sinh ra được COMMIT vào repo, nên nó lạc hậu ÂM THẦM: ai đó sửa marker, quên sinh
//  lại, và từ đó sơ đồ nói một đằng còn mã làm một nẻo. Không có gì đổ vỡ nên không ai
//  phát hiện. `--check` biến chuyện đó thành đỏ.
//
//  Phép kiểm được cắm vào app/test/pending-markers.test.ts thay vì thêm một mục vào
//  scripts/run-local-all.sh: nó cùng một loại với các ca "marker không lạc hậu" đã có ở
//  đó, và đặt cạnh nhau thì người sửa marker thấy cả hai nghĩa vụ trong một lần chạy.
//
// -----------------------------------------------------------------------------
//  TỪ CHỐI SINH KHI SỐ BƯỚC SAI
// -----------------------------------------------------------------------------
//  Số bước trùng hoặc nhảy cách (BAD_FLOW_STEP) nghĩa là chuỗi bước không còn là một
//  chuỗi. Sinh sơ đồ từ dữ liệu đó ra một hình vẽ trông hợp lệ nhưng thiếu bước hoặc nối
//  sai — tệ hơn là không sinh, vì người đọc không có cách nào biết. Nên: từ chối, chỉ
//  sang `scan-pending.mjs --check`.
//
//  Môi trường: Node 20 trở lên, ESM thuần, KHÔNG phụ thuộc gói ngoài.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOW_NAMES, scan } from './scan-pending.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = 'docs/flows';

/** Nghiệp vụ của từng luồng — cùng bảng với steering mục 4, dùng làm tiêu đề tệp sinh ra */
const FLOW_TITLES = Object.freeze({
  purchase: 'Nhà đầu tư mua WPT',
  issue: 'Ngân hàng phát hành WPT',
  distribute: 'Chia lợi nhuận theo sản lượng',
  settle: 'Tất toán và hoàn vốn',
  onboard: 'KYC và whitelist ví',
});

/** Nhãn dài hơn mức này thì cắt — ô Mermaid quá rộng là ô không đọc được */
const MAX_LABEL_CHARS = 96;

// -----------------------------------------------------------------------------
//  NHÃN MERMAID
// -----------------------------------------------------------------------------
//  Nhãn đi vào giữa `["..."]`. Bốn ký tự phá cú pháp hoặc phá cách hiển thị:
//    "   đóng chuỗi nhãn sớm    -> &quot;
//    #   mở entity của Mermaid  -> &num;
//    <   mở thẻ HTML            -> &lt;   (trừ <br/> do CHÍNH script này chèn)
//    >   đóng thẻ HTML          -> &gt;
//  Ghi chú trong mã thật CÓ những ký tự đó: `@pending FE-06` của `listOrdersAction` chứa
//  dấu ngoặc kép quanh "vai nào xem được sổ lệnh nào". Không thoát là sơ đồ không render nổi.
//
//  `#` thoát thành `&num;` chứ KHÔNG thành `&#35;`: bản thay thế `&#35;` lại chứa `#`, nên
//  phép tự kiểm UNSAFE_IN_LABEL sẽ báo đỏ chính bản đã thoát — một phép kiểm tự bác bỏ
//  mình thì sớm muộn bị nới ra cho xanh, và lúc đó nó không còn bắt được gì.

/** Ký tự thô còn sót trong nhãn = sơ đồ hỏng. Dùng cho phép tự kiểm trước khi ghi. */
const UNSAFE_IN_LABEL = /["#`]|<(?!br\/>)|(?<!<br\/)>/;

function escapeLabel(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .trim()
    // Dấu nháy ngược BỎ HẲN chứ không thoát: Mermaid từ v10 coi `["` liền ngay một dấu
    // nháy ngược là mở "markdown string", nên ký tự này có nghĩa với bộ phân tích. Ghi chú
    // trong mã dùng nó rất nhiều (quanh tên hàm, tên quyền), mà in nguyên nó ra trong một
    // ô sơ đồ cũng không thêm gì cho người đọc.
    .replace(/`/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/#/g, '&num;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Cắt ở ranh giới từ, không cắt giữa từ — cắt giữa từ làm nhãn khó đọc hơn là ngắn */
function truncate(text, max = MAX_LABEL_CHARS) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Ghép nhiều dòng thành một nhãn Mermaid đã thoát, ngắt dòng bằng <br/> */
function mermaidLabel(lines) {
  return lines.filter((l) => l !== '' && l != null).map(escapeLabel).join('<br/>');
}

// -----------------------------------------------------------------------------
//  DỰNG NỘI DUNG
// -----------------------------------------------------------------------------

/** Ký hiệu để in: `placeOrderAction()`, hoặc `(không suy ra được tên hàm)` */
function symbolLabel(step) {
  return step.symbol ? `${step.symbol}()` : '(không suy ra được tên hàm)';
}

/**
 * Điểm cắm / điểm chặn nằm ĐÚNG trên ký hiệu của một bước.
 *
 * Đây là cách sơ đồ nói được "màn hình gọi vào chưa có" mà KHÔNG phải gắn marker vào tệp
 * không tồn tại: dữ liệu đến từ marker thật trên hàm thật, script chỉ nối hai thứ đã có.
 */
function markersOnStep(report, step) {
  return report.markers.filter(
    (m) => m.file === step.file && m.symbol !== null && m.symbol === step.symbol,
  );
}

function buildMermaid(report, steps) {
  const lines = ['flowchart TD'];

  for (const step of steps) {
    lines.push(
      `  s${step.step}["${mermaidLabel([
        `${step.step} · ${symbolLabel(step)}`,
        step.file,
        truncate(step.note),
      ])}"]`,
    );
  }

  // Điểm cắm / điểm chặn: hình bầu dục + mũi tên gạch rời, để nhìn là biết nó KHÔNG phải
  // một bước của luồng mà là một task chưa nối vào.
  let waitIndex = 0;
  const waitEdges = [];
  for (const step of steps) {
    for (const m of markersOnStep(report, step)) {
      waitIndex += 1;
      const id = `w${waitIndex}`;
      const tag = m.kind === 'pending' ? 'điểm cắm, chờ' : 'điểm chặn, cần';
      lines.push(
        `  ${id}(["${mermaidLabel([`${tag} ${m.task}`, truncate(m.note, 72)])}"])`,
      );
      waitEdges.push(`  ${id} -.-> s${step.step}`);
    }
  }

  for (let i = 1; i < steps.length; i += 1) {
    lines.push(`  s${steps[i - 1].step} --> s${steps[i].step}`);
  }
  lines.push(...waitEdges);

  return lines.join('\n');
}

function buildStepTable(steps) {
  const rows = [
    '| Bước | Tệp | Hàm | Việc |',
    '|---|---|---|---|',
  ];
  for (const s of steps) {
    rows.push(
      `| ${s.step} | \`${s.file}:${s.line}\` | \`${symbolLabel(s)}\` | ${s.note} |`,
    );
  }
  return rows.join('\n');
}

function buildPendingSection(report, steps) {
  const rows = [];
  for (const step of steps) {
    for (const m of markersOnStep(report, step)) {
      const label = m.kind === 'pending' ? 'điểm cắm' : 'điểm chặn';
      rows.push(`| ${step.step} | ${label} | \`${m.task}\` | ${m.note} |`);
    }
  }
  if (rows.length === 0) {
    return 'Không bước nào của luồng này còn marker `@pending` / `@blocked`.';
  }
  return [
    'Các bước dưới đây có marker chờ task khác. Trong sơ đồ chúng là ô bầu dục nối bằng',
    'mũi tên gạch rời — chúng **không** phải bước của luồng.',
    '',
    '| Bước | Loại | Task | Nội dung marker |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

/**
 * Toàn bộ nội dung tệp `docs/flows/<luồng>.md`.
 *
 * Hàm này THUẦN (không đọc đĩa, không ghi đĩa) để `--check` và chế độ ghi dùng đúng một
 * đường sinh. Hai đường sinh khác nhau thì `--check` sẽ so bản này với bản kia và báo lệch
 * vì lý do không liên quan gì tới marker.
 *
 * @param {ReturnType<typeof scan>} report
 * @param {string} flowName
 * @returns {string}
 */
export function renderFlowDoc(report, flowName) {
  const steps = report.flows
    .filter((f) => f.flow === flowName)
    .sort((a, b) => a.step - b.step);
  if (steps.length === 0) {
    throw new Error(`luồng "${flowName}" không có marker @flow nào`);
  }

  const files = [...new Set(steps.map((s) => s.file))];
  const title = FLOW_TITLES[flowName] ?? flowName;

  const body = `<!-- SINH TỰ ĐỘNG TỪ MARKER — ĐỪNG SỬA TAY -->

# Luồng \`${flowName}\` — ${title}

> **Tệp này do \`scripts/gen-flow-diagram.mjs\` sinh ra từ marker \`@flow\` trong mã nguồn.**
> Sửa tay sẽ bị ghi đè ở lần sinh sau, và trong khoảng thời gian trước đó thì sơ đồ nói một
> đằng còn mã làm một nẻo. Muốn đổi nội dung thì sửa marker trong mã rồi sinh lại.
>
> - Sinh lại: \`node scripts/gen-flow-diagram.mjs ${flowName}\`
> - Kiểm tệp này còn khớp marker hay không: \`node scripts/gen-flow-diagram.mjs ${flowName} --check\`
> - Quy ước marker: \`.kiro/steering/make-control.md\` mục 4

**${steps.length} bước**, gắn ở ${files.length} tệp:

${files.map((f) => `- \`${f}\``).join('\n')}

## Sơ đồ

\`\`\`mermaid
${buildMermaid(report, steps)}
\`\`\`

## Bảng bước

${buildStepTable(steps)}

## Điểm cắm trên đường đi

${buildPendingSection(report, steps)}

## Đọc sơ đồ này thế nào

- **Mũi tên liền là thứ tự nghiệp vụ, không phải cạnh gọi hàm.** Quy ước cho mỗi bước đúng
  một số nguyên liên tiếp, nên nó biểu diễn được một chuỗi thời gian chứ không biểu diễn
  được lồng nhau hay đường về. Ví dụ một hàm gọi hàm sau nó rồi nhận kết quả về thì trên sơ
  đồ chỉ thấy mũi tên đi, không thấy mũi tên về.
- **Ô bầu dục nối bằng mũi tên gạch rời không phải bước của luồng.** Đó là marker
  \`@pending\` / \`@blocked\` nằm trên đúng hàm của bước đó: một task khác còn phải gọi vào,
  hoặc còn phải xong trước.
- **Bước ở \`ledger.port.ts\` là cổng, không phải adapter.** Adapter thật (\`mock\`, \`evm\`,
  \`stellar\`) do \`getLedger(chain)\` chọn lúc chạy theo cấu hình, nên không cạnh gọi tĩnh
  nào nối được cổng với adapter (design.md QĐ-6). Sơ đồ dừng ở cổng là dừng ở chỗ còn nói
  thật được.
- **Nhánh phụ và nhánh song song không có trên sơ đồ.** Một chuỗi số nguyên không có chỗ
  cho hai đường vào cùng một bước, cũng không có chỗ cho nhánh chạy ngoài chuỗi. Những chỗ
  như vậy được nhắc trong nhãn của bước liên quan hoặc trong bình luận tại tệp bị bỏ ra.
`;
  return body;
}

// -----------------------------------------------------------------------------
//  ĐĨA
// -----------------------------------------------------------------------------

function outPathFor(flowName) {
  return path.join(OUT_DIR, `${flowName}.md`);
}

function readIfExists(rel) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}

/** Số dòng đầu tiên khác nhau, để thông báo chỉ được vào chỗ cần xem */
function firstDiffLine(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i += 1) {
    if (la[i] !== lb[i]) {
      return {
        line: i + 1,
        onDisk: la[i] ?? '(tệp trên đĩa hết ở đây)',
        fresh: lb[i] ?? '(bản sinh ra hết ở đây)',
      };
    }
  }
  return null;
}

/**
 * Tệp trên đĩa có khớp marker hiện tại hay không.
 * @param {ReturnType<typeof scan>} report
 * @param {string} flowName
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
export function checkFlowDoc(report, flowName) {
  const rel = outPathFor(flowName);
  const onDisk = readIfExists(rel);
  if (onDisk === null) {
    return {
      ok: false,
      reason: `chưa có ${rel}. Sinh bằng: node scripts/gen-flow-diagram.mjs ${flowName}`,
    };
  }
  const fresh = renderFlowDoc(report, flowName);
  if (onDisk === fresh) return { ok: true };

  const diff = firstDiffLine(onDisk, fresh);
  return {
    ok: false,
    reason:
      `${rel} đã lạc hậu so với marker @flow trong mã. Khác nhau từ dòng ${diff.line}:\n` +
      `      trên đĩa : ${truncate(diff.onDisk, 110)}\n` +
      `      sinh lại : ${truncate(diff.fresh, 110)}\n` +
      `      Sửa bằng: node scripts/gen-flow-diagram.mjs ${flowName}`,
  };
}

/**
 * Tệp trong docs/flows/ không còn luồng nào gắn marker — sinh ra rồi marker bị xóa hết.
 * @param {ReturnType<typeof scan>} report
 * @returns {string[]} đường dẫn tương đối gốc repo
 */
export function orphanFlowDocs(report) {
  const coMarker = new Set(report.flows.map((f) => f.flow));
  let entries;
  try {
    entries = fs.readdirSync(path.join(REPO_ROOT, OUT_DIR));
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.replace(/\.md$/, ''))
    .filter((name) => !coMarker.has(name))
    .map((name) => outPathFor(name));
}

// -----------------------------------------------------------------------------
//  CLI
// -----------------------------------------------------------------------------

const USAGE = `Dùng: node scripts/gen-flow-diagram.mjs <tên-luồng> [--check]
       node scripts/gen-flow-diagram.mjs --check

  <tên-luồng>          sinh docs/flows/<tên-luồng>.md từ marker @flow
  <tên-luồng> --check  không ghi gì; mã thoát 1 nếu tệp trên đĩa lệch marker
  --check              kiểm MỌI luồng đang có marker, và bắt tệp mồ côi trong docs/flows/
  --help               in hướng dẫn này

Năm tên luồng hợp lệ: ${FLOW_NAMES.join(', ')}
Quy ước marker: .kiro/steering/make-control.md mục 4`;

function flowStepErrors(report, flowName) {
  return report.errors.filter(
    (e) => e.code === 'BAD_FLOW_STEP' && e.message.includes(`"${flowName}"`),
  );
}

function generateOne(report, flowName) {
  const loi = flowStepErrors(report, flowName);
  if (loi.length > 0) {
    process.stderr.write(
      `Không sinh sơ đồ cho luồng "${flowName}": số bước đang sai, nên chuỗi bước không còn\n` +
        'là một chuỗi. Sinh từ dữ liệu đó ra một hình vẽ trông hợp lệ mà thiếu bước hoặc nối\n' +
        'sai, và người đọc không có cách nào biết.\n\n' +
        `${loi.map((e) => `  [${e.code}] ${e.file}:${e.line}\n      ${e.message}`).join('\n')}\n\n` +
        'Sửa marker rồi chạy lại. Xem đầy đủ: node scripts/scan-pending.mjs --check\n',
    );
    return 1;
  }

  let content;
  try {
    content = renderFlowDoc(report, flowName);
  } catch {
    process.stderr.write(
      `Luồng "${flowName}" là tên hợp lệ nhưng CHƯA GẮN MARKER @flow nào, nên chưa có gì để vẽ.\n\n` +
        'Sơ đồ sinh từ marker: không có marker thì không có sơ đồ, và sinh một tệp rỗng chỉ tạo\n' +
        'cảm giác luồng đã được mô tả. Gắn marker trước:\n\n' +
        `  // @flow ${flowName}:1 | <việc của bước này>\n\n` +
        'Chỉ gắn cho luồng ĐÃ hoàn thành đầu cuối ở tầng backend (.kiro/steering/make-control.md\n' +
        'mục 4). Luồng đang có marker: ' +
        `${[...new Set(report.flows.map((f) => f.flow))].sort().join(', ') || '(chưa có luồng nào)'}\n`,
    );
    return 1;
  }

  // Tự kiểm trước khi ghi: ký tự phá cú pháp Mermaid còn sót thì tệp ghi ra không render
  // nổi, và lỗi hiện ra ở chỗ xa nguyên nhân (người đọc tài liệu, không phải người sửa mã).
  const mermaidBlock = content.split('```mermaid')[1]?.split('```')[0] ?? '';
  for (const [i, line] of mermaidBlock.split('\n').entries()) {
    const label = line.match(/\["(.*)"\]|\(\["(.*)"\]\)/);
    const inner = label?.[1] ?? label?.[2];
    if (inner && UNSAFE_IN_LABEL.test(inner)) {
      process.stderr.write(
        `Nhãn Mermaid còn ký tự phá cú pháp ở dòng ${i + 1} của khối sơ đồ:\n  ${line}\n` +
          'Đây là lỗi của chính script này (hàm escapeLabel), không phải lỗi marker.\n',
      );
      return 1;
    }
  }

  const abs = path.join(REPO_ROOT, outPathFor(flowName));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const cu = readIfExists(outPathFor(flowName));
  fs.writeFileSync(abs, content, 'utf8');

  const steps = report.flows.filter((f) => f.flow === flowName).length;
  process.stdout.write(
    `${cu === content ? 'Không đổi' : cu === null ? 'Đã tạo' : 'Đã cập nhật'}: ` +
      `${outPathFor(flowName)} (${steps} bước)\n`,
  );
  return 0;
}

function checkAll(report, flowNames) {
  const loi = [];
  for (const name of flowNames) {
    const kq = checkFlowDoc(report, name);
    if (!kq.ok) loi.push(`  [LẠC HẬU] ${kq.reason}`);
  }
  for (const rel of orphanFlowDocs(report)) {
    loi.push(
      `  [MỒ CÔI]  ${rel} không còn marker @flow nào trong mã. Hoặc marker bị xóa mà quên\n` +
        '            xóa tệp, hoặc tên luồng đã đổi. Xóa tệp, hoặc gắn lại marker.',
    );
  }

  if (loi.length > 0) {
    process.stderr.write(`Sơ đồ luồng không khớp marker (${loi.length} mục):\n\n${loi.join('\n')}\n`);
    return 1;
  }
  process.stdout.write(
    flowNames.length === 0
      ? 'Chưa có luồng nào gắn marker @flow, và không có tệp mồ côi trong docs/flows/.\n'
      : `Sơ đồ khớp marker: ${flowNames.join(', ')}. Không có tệp mồ côi.\n`,
  );
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const check = args.includes('--check');
  const positional = args.filter((a) => !a.startsWith('-'));
  const unknownFlags = args.filter((a) => a.startsWith('-') && a !== '--check');
  if (unknownFlags.length > 0) {
    process.stderr.write(`Cờ không nhận ra: ${unknownFlags.join(', ')}\n\n${USAGE}\n`);
    return 2;
  }
  if (positional.length > 1) {
    process.stderr.write(
      `Chỉ nhận MỘT tên luồng, nhận được ${positional.length}: ${positional.join(', ')}\n\n${USAGE}\n`,
    );
    return 2;
  }
  if (positional.length === 0 && !check) {
    process.stderr.write(`Thiếu tên luồng.\n\n${USAGE}\n`);
    return 2;
  }

  const report = scan();

  if (positional.length === 0) {
    return checkAll(report, [...new Set(report.flows.map((f) => f.flow))].sort());
  }

  const flowName = positional[0];
  if (!FLOW_NAMES.includes(flowName)) {
    process.stderr.write(
      `Tên luồng "${flowName}" không thuộc năm tên đã chốt.\n\n` +
        `${FLOW_NAMES.map((n) => `  ${n.padEnd(11)} ${FLOW_TITLES[n]}`).join('\n')}\n\n` +
        'Năm tên này là cố định (.kiro/steering/make-control.md mục 4). Cần một luồng mới thì\n' +
        'phải sửa steering và FLOW_NAMES trong scripts/scan-pending.mjs trước, không tự đặt tên.\n',
    );
    return 2;
  }

  if (check) {
    const kq = checkFlowDoc(report, flowName);
    if (kq.ok) {
      process.stdout.write(`Khớp marker: ${outPathFor(flowName)}\n`);
      return 0;
    }
    process.stderr.write(`Sơ đồ luồng không khớp marker:\n\n  ${kq.reason}\n`);
    return 1;
  }

  return generateOne(report, flowName);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main(process.argv));
}
