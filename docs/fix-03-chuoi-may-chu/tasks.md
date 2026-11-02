# FIX-03: các bước

1. Tạo nhánh từ `dev` mới nhất (sau khi merge PR #79). Trước khi mở PR, cập nhật lại từ `dev`; xung đột ở `docs/USER_GUIDE.md`, `.kiro/task-status.json` thì giữ đủ nội dung của các task. Chép thư mục spec. Nếu số dòng ở requirements mục 3 lệch do `dev` đã đổi, tìm theo chuỗi cũ và ghi số dòng mới vào checkpoint.
2. Sửa 59 chỗ ở requirements mục 3. Import `formatAmount` từ `@/lib/format` ở tệp nào chưa có.
3. Chạy toàn bộ test; sửa chuỗi mong đợi ở test cũ theo requirements mục 5 (chỉ chuỗi). Sinh lại `docs/flows/*.md` mà `test/pending-markers.test.ts` báo lạc hậu bằng `node scripts/gen-flow-diagram.mjs <tên luồng>`.
4. Viết `app/test/fix-03-chuoi-may-chu.test.ts` (ca 1 tới 7).
5. Kiểm chứng:

```bash
(cd app && npm run typecheck && npm run lint && npx vitest --run)
(cd app && TEST_DATABASE_URL=postgresql://bidv:bidv@127.0.0.1:5432/bidv_rwa npx vitest --run)
bash scripts/run-local-all.sh arch markers checkpoint app
bash scripts/run-local-all.sh build e2e evm
# tệp cấm: phải rỗng
git diff --name-only dev... | grep -E '^app/src/(components|app)/|^app/src/lib/store/|^app/prisma/|^packages/|^scripts/|wrangler\.json|\.env' || true
# ca 1 (quét chuỗi trong lib bằng TypeScript) phải xanh; để xem danh sách khi đang sửa, chạy bản mẫu dưới (đặt ở app/, đọc typescript từ node_modules của app):
#   node scan-lib-strings.mjs src/lib
```

Bản mẫu `scan-lib-strings.mjs` (chỉ để dùng tại chỗ, KHÔNG commit; ca 1 dùng cùng logic):

```js
// Quét chuỗi trong app/src/lib (trừ lib/store): chuỗi thường, template và mọi phần chữ của template lồng.
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const BAD = /[\u2014\u00b7\u2192]|-[>]/;
const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (!path.endsWith('/store')) walk(path); continue; }
    if (!/\.tsx?$/.test(name)) continue;
    const src = readFileSync(path, 'utf8');
    const file = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      let text = null;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
      else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
      else if (ts.isJsxText(node)) text = node.getText();
      if (text !== null && BAD.test(text)) {
        const { line } = file.getLineAndCharacterOfPosition(node.getStart());
        hits.push(`${path}:${line + 1}: ${text.slice(0, 90)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
}
walk(process.argv[2] ?? 'app/src/lib');
console.log(hits.join('\n'));
console.log(`TONG ${hits.length}`);
```

6. Bảy đột biến (requirements mục 7), ghi ca đỏ.
7. Checkpoint, UserGuide, task-status.

Commit mã: `fix(fix-03): chuẩn hoá các chuỗi hiển thị trong lib theo danh sách, ô trống dùng gạch ngắn, số mẫu lợi tức`
Commit tài liệu: `docs(fix-03): checkpoint, UserGuide`
