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

/**
 * Explorer theo chain — chỉ chain công khai mới có. Lấy từ cùng nguồn sự thật mà app dùng
 * (`packages/shared/src/chains.ts`), chỉ nhắc lại phần cần cho script CLI này.
 */
const EXPLORER = { evm: 'https://sepolia.etherscan.io' };
const txLink = (hash) => (EXPLORER[CHAIN] ? `${EXPLORER[CHAIN]}/tx/${hash}` : null);

/** Chain công khai chậm hơn: cho phép chờ lâu hơn trước khi kết luận. */
const IS_PUBLIC_CHAIN = CHAIN === 'evm';

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

  if (IS_PUBLIC_CHAIN) {
    log(
      `${C.dim}chain công khai: mỗi tx phải chờ lên block (~12s/block), tổng có thể mất vài chục giây.${C.reset}`,
    );
  }

  step(1, 'KYC (mock auto-approve) + whitelist on-chain');
  const onboard = await call('POST', '/api/investors', { chain: CHAIN, wallet: WALLET });
  good(`KYC ${onboard.kycReference} (${onboard.kycProvider})`);
  good(`whitelisted=${onboard.whitelisted} · tx ${onboard.txHash} (${onboard.status})`);
  if (txLink(onboard.txHash)) good(`explorer: ${txLink(onboard.txHash)}`);
  if (!onboard.whitelisted) throw new Error('Whitelist không có hiệu lực on-chain.');

  step(2, 'Đọc số dư TRƯỚC khi phát hành');
  const before = BigInt((await readBalance()).balance);
  good(`balance trước = ${before}`);

  step(3, `Phát hành ${AMOUNT} WPT`);
  const mint = await call('POST', '/api/mint', { chain: CHAIN, wallet: WALLET, amount: AMOUNT });
  good(`tx ${mint.txHash} (${mint.status})`);
  if (txLink(mint.txHash)) good(`explorer: ${txLink(mint.txHash)}`);

  step(4, 'Đọc lại số dư từ ledger');
  const after = BigInt((await readBalance()).balance);
  log(`\n    ${C.bold}BALANCE = ${after} WPT${C.reset}`);

  step(5, 'Kiểm tra nghiệm thu');
  let failed = false;

  if (mint.status === 'PENDING') {
    // Timeout KHÔNG phải thất bại: tx vẫn có thể vào block sau (p4 AC#9).
    bad(`tx còn PENDING sau khi hết thời gian chờ — chưa kết luận được`);
    if (txLink(mint.txHash)) log(`         Tra trạng thái thật: ${txLink(mint.txHash)}`);
    failed = true;
  } else if (mint.status !== 'CONFIRMED') {
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
  if (txLink(mint.txHash)) {
    log(`${C.dim}Bằng chứng độc lập (nộp kèm checkpoint): ${txLink(mint.txHash)}${C.reset}`);
  }
}

main().catch((error) => {
  bad(error.message);
  const hints = ['web đã chạy chưa? (npm run dev trong app/, hoặc docker compose up)'];

  if (CHAIN === 'hardhat-local') {
    hints.push('hardhat node phải đang chạy và contract đã deploy');
  }
  if (IS_PUBLIC_CHAIN) {
    hints.push(
      'chain evm (Sepolia) cần: NEXT_PUBLIC_ADDR_EVM_* đã điền, SERVER_SIGNER_PRIVATE_KEY là ví ngân hàng CÓ ETH test',
      'kiểm nhanh: cd packages/contracts-evm && npx hardhat run scripts/preflight-sepolia.js --network sepolia',
    );
  }

  log(`\n${C.dim}Gợi ý:\n${hints.map((h) => `  - ${h}`).join('\n')}${C.reset}`);
  process.exit(1);
});
