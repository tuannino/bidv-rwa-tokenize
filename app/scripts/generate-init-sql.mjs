#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(APP_ROOT, 'prisma', 'init.sql');
const outputPath = path.join(APP_ROOT, 'src', 'lib', 'store', 'init-sql.generated.ts');

const sql = await readFile(sqlPath, 'utf8');
const output = `// Tệp sinh tự động từ prisma/init.sql — không sửa tay.\n` +
  `// Chạy \`npm run db:embed-sql\` hoặc \`npm run db:sql\` để sinh lại.\n` +
  `export const INIT_SQL = ${JSON.stringify(sql)};\n`;

await writeFile(outputPath, output, 'utf8');
console.log(`Đã nhúng ${Buffer.byteLength(sql)} byte từ prisma/init.sql.`);
