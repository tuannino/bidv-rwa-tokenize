#!/usr/bin/env node
const { wptIssuePriceVnd, wptSupplyCap } = require("../../shared/src/token-parameters.json");
// CH-3: chỉ bù số dư thiếu. Không ký trên chain khác Sepolia hoặc nạp ví mẫu công khai.
const path = require('path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { ethers } = require('ethers');
const samples = require('../../shared/src/sample-wallets.json');
const SEPOLIA_CHAIN_ID = 11155111n;
// Dự phòng 20% cho biến động gas/phí và khác biệt calldata so với mô phỏng cục bộ.
const FEE_MARGIN_PERCENT = 120n;
/**
 * Thao tác của runbook OP-05 (QĐ-E). Mọi giao dịch do VÍ KÝ MÁY CHỦ gửi (PRIVATE_KEY trùng
 * SERVER_SIGNER_PRIVATE_KEY_EVM, preflight kiểm); ví tổng chỉ cấp phí; Nhà đầu tư chỉ ký typed data nên
 * không tốn ETH và không được cấp ETH. `demo-cycle` là tổng từ `vault-config` đến `withdraw`.
 */
const CYCLE_OPERATIONS = ['vault-config', 'mint-initial', 'payment-mint', 'trade', 'profit-mint', 'distribute', 'withdraw'];
const OPERATIONS = ['deploy', 'whitelist', ...CYCLE_OPERATIONS, 'demo-cycle'];
const SENDER = 'ví ký máy chủ';
const GAS_OUTPUT_PREFIX = 'OP05_GAS=';

function refuse(message) {
  const error = new Error(message);
  error.safeMessage = message;
  throw error;
}
function assertSepolia(chainId) {
  if (BigInt(chainId) !== SEPOLIA_CHAIN_ID) refuse('Chỉ được dùng Sepolia chainId 11155111.');
}
function assertTarget(target) {
  if (!ethers.isAddress(target) || target.toLowerCase() === ethers.ZeroAddress) refuse('Địa chỉ đích không hợp lệ hoặc là địa chỉ 0.');
  const blocked = [...Object.values(samples.wallets), samples.hardhatAccount0];
  if (blocked.some((address) => address.toLowerCase() === target.toLowerCase())) {
    refuse('Từ chối nạp SepoliaETH vào tài khoản mẫu công khai của Hardhat.');
  }
}
const planFunding = (required, balance) => required > balance ? required - balance : 0n;
const feeBudget = (gas, price) => (gas * price * FEE_MARGIN_PERCENT + 99n) / 100n;
function gasPriceOf(fees) {
  const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (price == null || price <= 0n) refuse('RPC không trả giá gas hợp lệ.');
  return price;
}
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--eth' || arg === '--for') {
      const key = arg === '--eth' ? 'eth' : 'operation';
      if (opts[key] !== undefined || !argv[i + 1]) refuse('Thiếu hoặc lặp giá trị ' + arg);
      opts[key] = argv[++i];
    } else if (!arg.startsWith('-') && !opts.target) opts.target = arg;
    else refuse('Tham số không hợp lệ: ' + arg);
  }
  assertTarget(opts.target);
  if ((opts.eth !== undefined) === (opts.operation !== undefined)) refuse('Chọn đúng một: --eth <số ETH> hoặc --for <thao tác>.');
  if (opts.operation && !OPERATIONS.includes(opts.operation)) refuse('Thao tác hợp lệ: ' + OPERATIONS.join(', '));
  if (opts.eth !== undefined) {
    if (!/^\d+(\.\d{1,18})?$/.test(opts.eth) || ethers.parseEther(opts.eth) <= 0n) refuse('Số ETH phải dương, tối đa 18 chữ số thập phân.');
  }
  return opts;
}

/** Số liệu vòng trình diễn OP-05 QĐ-H (giá 100.000 VNDB/WPT, VNDB và WPT đều 0 chữ số thập phân). */
const DEMO = {
  initialSupply: 1_000_000n,
  investorVndb: 20_000_000n,
  buyWpt: 100n,
  sellWpt: 40n,
  profit: 1_000_000n,
  percentBps: 2_000n,
  withdraw: 3_399_970n,
};

/**
 * Đo gas bằng bytecode hiện tại trên Hardhat IN-PROCESS, không gửi tx Sepolia. Một tiến trình riêng
 * cưỡng chế network=hardhat để không kế thừa network Sepolia của preflight.
 *
 * Chạy THẬT cả vòng: deploy theo đúng thứ tự và các giao dịch liên kết của deploy.js, whitelist hai ví,
 * ba bước cấu hình vault (planVaultConfig của BE-13 cho vault mới: ví nhận, tỷ lệ, chế độ), Mint đầu,
 * nạp VNDB demo, mua và bán bằng permit, mint lợi nhuận, ba giao dịch chia, một lần rút. Mỗi giao dịch
 * cộng `estimateGas` vào đúng thao tác và đếm một; số giao dịch là số đo, không gõ tay.
 */
async function measureLocalGas() {
  const hre = require('hardhat');
  if (hre.network.name !== 'hardhat') refuse('Mô phỏng gas chỉ được chạy trên hardhat nội bộ.');
  const { ethers: h } = hre;
  const [admin, investor, payout] = await h.getSigners();
  const tally = Object.fromEntries([...OPERATIONS.filter((op) => op !== 'demo-cycle')].map((op) => [op, { gas: 0n, txs: 0 }]));
  async function send(op, populated) {
    const tx = await populated;
    const gas = await admin.estimateGas(tx);
    const receipt = await (await admin.sendTransaction(tx)).wait();
    if (!receipt || receipt.status !== 1) refuse(`Giao dịch mô phỏng ${op} không thành công.`);
    tally[op].gas += gas;
    tally[op].txs += 1;
    return receipt;
  }
  async function deploy(name, args) {
    const factory = await h.getContractFactory(name);
    const receipt = await send('deploy', factory.getDeployTransaction(...args));
    return factory.attach(receipt.contractAddress);
  }

  // deploy.js: chín constructor theo đúng thứ tự, rồi liên kết và cấp vai.
  const wpt = await deploy('ProjectToken', ['Wind Power Token', 'WPT', 0, admin.address, wptSupplyCap]);
  const vnd = await deploy('VNDToken', [admin.address]);
  const distributor = await deploy('ProfitDistributor', [await wpt.getAddress(), await vnd.getAddress(), admin.address]);
  await deploy('Redemption', [await wpt.getAddress(), await vnd.getAddress(), 1_000_000n, admin.address]);
  const registry = await deploy('IdentityRegistry', [admin.address]);
  const compliance = await deploy('ModularCompliance', [admin.address]);
  const allowAll = await deploy('AllowAllModule', []);
  const vault = await deploy('SpvPaymentVault', [await wpt.getAddress(), await vnd.getAddress(), admin.address]);
  const settlement = await deploy('OrderSettlement', [await vault.getAddress(), admin.address, wptIssuePriceVnd]);
  await send('deploy', wpt.setIdentityRegistry.populateTransaction(await registry.getAddress()));
  await send('deploy', wpt.setCompliance.populateTransaction(await compliance.getAddress()));
  await send('deploy', compliance.bindToken.populateTransaction(await wpt.getAddress()));
  await send('deploy', compliance.addModule.populateTransaction(await allowAll.getAddress()));
  await send('deploy', registry.registerIdentity.populateTransaction(await vault.getAddress(), 704));
  for (const roleName of ['CONFIG_ROLE', 'WITHDRAWER_ROLE', 'PAUSER_ROLE']) {
    await send('deploy', vault.grantRole.populateTransaction(await vault[roleName](), admin.address));
  }
  await send('deploy', vault.grantRole.populateTransaction(await vault.MATCHER_ROLE(), await settlement.getAddress()));
  for (const roleName of ['OPERATOR_ROLE', 'PRICE_ROLE', 'PAUSER_ROLE']) {
    await send('deploy', settlement.grantRole.populateTransaction(await settlement[roleName](), admin.address));
  }
  await send('deploy', wpt.grantRole.populateTransaction(await wpt.SNAPSHOT_ROLE(), await distributor.getAddress()));
  // ensureApplicationSignerRole của deploy.js: chỉ gửi khi constructor chưa cấp.
  for (const roleName of ['MINTER_ROLE', 'AGENT_ROLE']) {
    const role = await wpt[roleName]();
    if (!(await wpt.hasRole(role, admin.address))) await send('deploy', wpt.grantRole.populateTransaction(role, admin.address));
  }

  // Bước 7 runbook: whitelist PAYOUT_WALLET và INVESTOR_WALLET.
  for (const wallet of [payout, investor]) await send('whitelist', registry.registerIdentity.populateTransaction(wallet.address, 704));

  // Lượt 12: ví nhận, PERCENT 20% (tỷ lệ mặc định của vault mới là 0), chế độ PERCENT.
  await send('vault-config', vault.setPayoutWallet.populateTransaction(payout.address));
  await send('vault-config', vault.setPercentRate.populateTransaction(DEMO.percentBps));
  await send('vault-config', vault.setLockMode.populateTransaction(2));

  await send('mint-initial', wpt.mintInitialSupply.populateTransaction(await vault.getAddress(), DEMO.initialSupply));
  await send('payment-mint', vnd.mint.populateTransaction(investor.address, DEMO.investorVndb));

  // Lượt 13.4, 13.5: Nhà đầu tư chỉ KÝ permit (không gửi gì); ví ký máy chủ gửi hai lệnh khớp.
  const { buildPermitTypedData } = await import('../../shared/src/permit.js');
  const { chainId } = await h.provider.getNetwork();
  async function permit(token, value) {
    const deadline = BigInt((await h.provider.getBlock('latest')).timestamp) + 3600n;
    const typed = buildPermitTypedData({
      tokenName: await token.name(), version: (await token.eip712Domain()).version, chainId,
      verifyingContract: await token.getAddress(), owner: investor.address, spender: await settlement.getAddress(),
      value, nonce: await token.nonces(investor.address), deadline,
    });
    const sig = h.Signature.from(await investor.signTypedData(typed.domain, typed.types, typed.message));
    return [value, deadline, sig.v, sig.r, sig.s];
  }
  const price = BigInt(wptIssuePriceVnd);
  const ref = (label) => h.keccak256(h.toUtf8Bytes(label));
  const buyVndb = DEMO.buyWpt * price;
  await send('trade', settlement.buyWithPermit.populateTransaction(
    ref('op05-mua'), investor.address, DEMO.buyWpt, buyVndb, await permit(vnd, buyVndb)));
  await send('trade', settlement.sellWithPermit.populateTransaction(
    ref('op05-ban'), investor.address, DEMO.sellWpt, DEMO.sellWpt * price, await permit(wpt, DEMO.sellWpt)));

  await send('profit-mint', vnd.mint.populateTransaction(await distributor.getAddress(), DEMO.profit));

  // Lượt 13.7 với hai người nhận: tạo kỳ từ quỹ, chốt kỳ vault bằng TOÀN BỘ số của kỳ, một lô.
  await send('distribute', distributor.createDistributionFromPool.populateTransaction('op05-ky-1'));
  const id = (await distributor.distributionsCount()) - 1n;
  await send('distribute', vault.closePeriod.populateTransaction(1n, DEMO.profit));
  await send('distribute', distributor.distributeTo.populateTransaction(id, [investor.address, await vault.getAddress()]));

  await send('withdraw', vault.withdraw.populateTransaction(DEMO.withdraw));

  if ((await h.provider.getTransactionCount(investor.address)) !== 0) refuse('Mô phỏng sai: ví Nhà đầu tư đã gửi giao dịch.');
  return tally;
}
async function estimateOperationGas() {
  let stdout;
  try {
    ({ stdout } = await promisify(execFile)(process.execPath, [__filename, '--local-estimates'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, HARDHAT_NETWORK: 'hardhat' }, timeout: 60_000,
    }));
  } catch {
    refuse('Ước lượng gas cục bộ thất bại; chạy npx hardhat compile rồi thử lại.');
  }
  const line = stdout.split('\n').find((item) => item.startsWith(GAS_OUTPUT_PREFIX));
  if (!line) refuse('Không đo được gas cục bộ. Chạy npx hardhat compile trong packages/contracts-evm.');
  return withCycleTotal(Object.fromEntries(Object.entries(JSON.parse(line.slice(GAS_OUTPUT_PREFIX.length)))
    .map(([op, value]) => [op, { gas: BigInt(value.gas), txs: value.txs }])));
}
/** `demo-cycle` = tổng các thao tác từ `vault-config` đến `withdraw`. */
function withCycleTotal(estimates) {
  const cycle = { gas: 0n, txs: 0 };
  for (const op of CYCLE_OPERATIONS) {
    cycle.gas += estimates[op].gas;
    cycle.txs += estimates[op].txs;
  }
  return { ...estimates, 'demo-cycle': cycle };
}
/** Bảng theo thao tác, mỗi dòng ghi ví gửi. Phí dự trù đã gồm dự phòng. */
function gasTable(estimates, price, operations = OPERATIONS) {
  const rows = operations.map((op) => `| ${op} | ${estimates[op].txs} | ${estimates[op].gas} | ${ethers.formatEther(feeBudget(estimates[op].gas, price))} | ${SENDER} |`);
  return ['| Thao tác | Số giao dịch | Gas mô phỏng | Phí dự trù (ETH) | Ví gửi |', '|---|---|---|---|---|', ...rows].join('\n');
}
function safeFundingMessage(error) {
  return error?.safeMessage ?? 'Lỗi RPC khi đọc hoặc gửi giao dịch; kiểm endpoint và kết nối Sepolia.';
}
async function fund(opts, dependencies = {}) {
  assertTarget(opts.target);
  const provider = dependencies.provider;
  assertSepolia((await provider.getNetwork()).chainId);
  const fees = await provider.getFeeData();
  const price = gasPriceOf(fees);
  let required;
  const log = dependencies.log ?? console.log;
  if (opts.operation) {
    const estimates = dependencies.estimates ?? await estimateOperationGas();
    const shown = opts.operation === 'demo-cycle' ? [...CYCLE_OPERATIONS, 'demo-cycle'] : [opts.operation];
    required = feeBudget(estimates[opts.operation].gas, price);
    log(`Gas mô phỏng bytecode hiện tại; giá trần ${price} wei; dự phòng ${FEE_MARGIN_PERCENT - 100n}%. Nhà đầu tư chỉ ký, không tốn ETH.`);
    log(gasTable(estimates, price, shown));
  } else required = ethers.parseEther(opts.eth);
  const balance = await provider.getBalance(opts.target);
  const missing = planFunding(required, balance);
  log(`Đích ${ethers.getAddress(opts.target)}; cần ${ethers.formatEther(required)} ETH; có ${ethers.formatEther(balance)} ETH; bù ${ethers.formatEther(missing)} ETH.`);
  if (missing === 0n) { log('Đã đủ số dư, không gửi.'); return { required, missing }; }
  if (opts.dryRun) { log('DRY-RUN: không tạo signer, không gửi giao dịch.'); return { required, missing }; }
  const key = dependencies.key ?? process.env.FUNDER_PRIVATE_KEY;
  if (!key) refuse('Thiếu FUNDER_PRIVATE_KEY trong .env cục bộ.');
  const wallet = (dependencies.makeWallet ?? ((value, rpc) => new ethers.Wallet(value, rpc)))(key, provider);
  const tx = { to: ethers.getAddress(opts.target), value: missing, chainId: SEPOLIA_CHAIN_ID };
  if (fees.maxFeePerGas != null && fees.maxPriorityFeePerGas != null) {
    tx.maxFeePerGas = fees.maxFeePerGas; tx.maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  } else tx.gasPrice = price;
  tx.gasLimit = await provider.estimateGas({ ...tx, from: wallet.address });
  const funderBalance = dependencies.funderBalance ?? await provider.getBalance(wallet.address);
  if (funderBalance < missing + tx.gasLimit * price) refuse('Tài khoản tổng thiếu ETH cho phần bù và phí chuyển.');
  const sent = await wallet.sendTransaction(tx);
  log(`Đã gửi: https://sepolia.etherscan.io/tx/${sent.hash}`);
  const receipt = await sent.wait(1, 120_000);
  if (!receipt || receipt.status !== 1) refuse('Giao dịch cấp phí chưa có receipt thành công; kiểm tx hash trước khi thử lại.');
  log('Cấp phí thành công.');
  return { required, missing, hash: sent.hash };
}
async function main() {
  if (process.argv.slice(2).join(' ') === '--local-estimates') {
    const estimates = await measureLocalGas();
    console.log(GAS_OUTPUT_PREFIX + JSON.stringify(estimates, (_, value) => typeof value === 'bigint' ? value.toString() : value));
    return;
  }
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Dùng: node scripts/fund-sepolia.js <đích> (--eth <số ETH> | --for <' + OPERATIONS.join('|') + '>) [--dry-run]\n--eth là số dư cần có, không phải số gửi thêm. --for dùng gas đo bằng bytecode cục bộ và giá Sepolia hiện tại, dự phòng 20%.');
    return;
  }
  // Dùng transport sẵn có của Hardhat để giữ cấu hình RPC, timeout và http_proxy/no_proxy.
  // Chạy bằng node vẫn nhận tham số CLI; không gọi hardhat run và không đổi deploy.js.
  process.env.HARDHAT_NETWORK = 'sepolia';
  const { ethers: hardhatEthers } = require('hardhat');
  await fund(opts, { provider: hardhatEthers.provider });
}
module.exports = { OPERATIONS, CYCLE_OPERATIONS, SENDER, assertSepolia, assertTarget, planFunding, feeBudget, gasPriceOf, gasTable, parseArgs, fund, estimateOperationGas, withCycleTotal, safeFundingMessage };
if (require.main === module) main().catch((error) => {
  // RPC errors may embed URLs/API keys or request bodies: never print raw error objects.
  console.error('LỖI: ' + safeFundingMessage(error));
  process.exitCode = 1;
});
