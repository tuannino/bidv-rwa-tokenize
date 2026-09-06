#!/usr/bin/env node
/**
 * Demo runner một lệnh: whitelist -> mint 100 -> in balance.
 *
 *   node scripts/demo-mint.mjs                                  # hardhat-local
 *   node scripts/demo-mint.mjs --chain mock                      # không cần chain thật
 *   node scripts/demo-mint.mjs --chain hardhat-local --amount 250
 *   BASE_URL=http://localhost:3000 node scripts/demo-mint.mjs
 *
 * Cố tình gọi qua HTTP API của app (chứ không import trực tiếp thư viện):
 * như vậy chạy đúng đường mà UI đi — RBAC, validate, waitReceipt, lưu Txn + audit.
 * Script này xanh nghĩa là luồng nghiệp vụ xanh, không phải chỉ vài hàm rời xanh.
 */

const args = process.argv.slice(2);

function arg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const CHAIN = arg('chain', 'hardhat-local');
const AMOUNT = arg('amount', '100');
// Hardhat account #1 — ví nhà đầu tư mặc định cho demo.
const WALLET = arg('wallet', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');

const C = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  dim: '\u001b[2m',
};
const log = (message) => console.log(message);
const step = (n, title) => log(`\n${C.bold}[${n}] ${title}${C.reset}`);
const good = (message) => log(`    ${C.green}OK${C.reset}  ${message}`);
const bad = (message) => log(`    ${C.red}FAIL${C.reset} ${message}`);

async function call(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${method} ${path} -> HTTP ${response.status}, body không phải JSON.`);
  }
  if (!payload.ok) {
    throw new Error(`${method} ${path} -> [${payload.code}] ${payload.error}`);
  }
  return payload.data;
}

const readBalance = () => call('GET', `/api/balance?chain=${CHAIN}&wallet=${WALLET}`);

async function main() {
  log(`${C.bold}DEMO MINT — BIDV RWA điện gió${C.reset}`);
  log(`${C.dim}server=${BASE_URL}  chain=${CHAIN}  investor=${WALLET}  amount=${AMOUNT}${C.reset}`);

  step(1, 'KYC (mock auto-approve) + whitelist on-chain');
  const onboard = await call('POST', '/api/investors', { chain: CHAIN, wallet: WALLET });
  good(`KYC ${onboard.kycReference} (${onboard.kycProvider})`);
  good(`whitelisted=${onboard.whitelisted} · tx ${onboard.txHash} (${onboard.status})`);
  if (!onboard.whitelisted) throw new Error('Whitelist không có hiệu lực on-chain.');

  step(2, 'Đọc số dư TRƯỚC khi phát hành');
  const before = BigInt((await readBalance()).balance);
  good(`balance trước = ${before}`);

  step(3, `Phát hành ${AMOUNT} SPT`);
  const mint = await call('POST', '/api/mint', { chain: CHAIN, wallet: WALLET, amount: AMOUNT });
  good(`tx ${mint.txHash} (${mint.status})`);

  step(4, 'Đọc lại số dư từ ledger');
  const after = BigInt((await readBalance()).balance);
  log(`\n    ${C.bold}BALANCE = ${after} SPT${C.reset}`);

  step(5, 'Kiểm tra nghiệm thu');
  let failed = false;

  if (mint.status !== 'CONFIRMED') {
    bad(`trạng thái tx là ${mint.status}, chưa CONFIRMED`);
    failed = true;
  } else {
    good('tx CONFIRMED');
  }

  const expected = before + BigInt(AMOUNT);
  if (after !== expected) {
    bad(`số dư sai: mong đợi ${before} + ${AMOUNT} = ${expected}, thực tế ${after}`);
    failed = true;
  } else {
    good(`số dư đúng: ${before} + ${AMOUNT} = ${after}`);
  }

  if (after !== BigInt(mint.balanceAfter)) {
    bad(`số dư đọc lại (${after}) khác số dư mà API mint trả về (${mint.balanceAfter})`);
    failed = true;
  } else {
    good('số dư khớp giữa hai lần đọc');
  }

  if (failed) {
    log(`\n${C.red}${C.bold}FAIL${C.reset} — xem các dòng FAIL ở trên.`);
    process.exit(1);
  }
  log(`\n${C.green}${C.bold}PASS${C.reset} — luồng mint chạy end-to-end trên chain "${CHAIN}".`);
}

main().catch((error) => {
  bad(error.message);
  log(
    `\n${C.dim}Gợi ý: web đã chạy chưa? (npm run dev trong app/, hoặc docker compose up)\n` +
      `Với chain hardhat-local: hardhat node phải đang chạy và contract đã deploy.${C.reset}`,
  );
  process.exit(1);
});
