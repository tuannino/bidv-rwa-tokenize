#!/usr/bin/env node
// CH-3: chỉ bù số dư thiếu. Không ký trên chain khác Sepolia hoặc nạp ví mẫu công khai.
const path = require('path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { ethers } = require('ethers');
const samples = require('../../shared/src/sample-wallets.json');
const SEPOLIA_CHAIN_ID = 11155111n;
// Dự phòng 20% cho biến động gas/phí và khác biệt calldata so với mô phỏng cục bộ.
const FEE_MARGIN_PERCENT = 120n;
const HARDHAT_ACCOUNT0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const OPERATIONS = ['deploy', 'mint-initial', 'mint', 'burn', 'whitelist', 'cycle'];
const GAS_OUTPUT_PREFIX = 'OP04_GAS=';

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
  const blocked = [...Object.values(samples.wallets), HARDHAT_ACCOUNT0];
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

/**
 * Đo gas bằng bytecode hiện tại trên Hardhat IN-PROCESS, không gửi tx Sepolia.
 * Một tiến trình riêng cưỡng chế network=hardhat để không kế thừa network Sepolia của preflight.
 * Không dùng hằng gas đoán tay; mô phỏng gồm constructor, cấp vai, whitelist, Mint/Mint/Burn.
 */
async function measureLocalGas() {
  const hre = require('hardhat');
  if (hre.network.name !== 'hardhat') refuse('Mô phỏng gas chỉ được chạy trên hardhat nội bộ.');
  const [admin, spv, distributorAddress] = await hre.ethers.getSigners();
  const args = {
    ProjectToken: ['Wind Power Token', 'WPT', 0, admin.address],
    VNDToken: [admin.address],
    ProfitDistributor: [spv.address, distributorAddress.address, admin.address],
    Redemption: [spv.address, distributorAddress.address, 1_000_000n, admin.address],
  };
  let deploy = 0n;
  for (const [name, constructorArgs] of Object.entries(args)) {
    const factory = await hre.ethers.getContractFactory(name);
    deploy += await admin.estimateGas(await factory.getDeployTransaction(...constructorArgs));
  }
  const token = await hre.ethers.deployContract('ProjectToken', args.ProjectToken);
  await token.waitForDeployment();
  deploy += await token.grantRole.estimateGas(await token.SNAPSHOT_ROLE(), distributorAddress.address);
  // MINTER_ROLE/AGENT_ROLE đã có trong constructor, deploy.js không gửi thêm tx.
  const whitelist = await token.setWhitelisted.estimateGas(spv.address, true);
  await (await token.setWhitelisted(spv.address, true)).wait();
  const initial = await token.mintInitialSupply.estimateGas(spv.address, 1000n);
  await (await token.mintInitialSupply(spv.address, 1000n)).wait();
  const mint = await token.mint.estimateGas(spv.address, 250n);
  await (await token.mint(spv.address, 250n)).wait();
  const burn = await token.agentBurn.estimateGas(spv.address, 300n);
  return { deploy, 'mint-initial': initial, mint, burn, whitelist, cycle: initial + mint + burn };
}
async function estimateOperationGas() {
  const { stdout } = await promisify(execFile)(process.execPath, [__filename, '--local-estimates'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, HARDHAT_NETWORK: 'hardhat' }, timeout: 60_000,
  });
  const line = stdout.split('\n').find((item) => item.startsWith(GAS_OUTPUT_PREFIX));
  if (!line) refuse('Không đo được gas cục bộ. Chạy npx hardhat compile trong packages/contracts-evm.');
  return Object.fromEntries(Object.entries(JSON.parse(line.slice(GAS_OUTPUT_PREFIX.length))).map(([key, value]) => [key, BigInt(value)]));
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
    required = feeBudget(estimates[opts.operation], price);
    log(`Gas mô phỏng bytecode hiện tại: ${estimates[opts.operation]}; giá trần ${price} wei; dự phòng ${FEE_MARGIN_PERCENT - 100n}%.`);
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
module.exports = { assertSepolia, assertTarget, planFunding, feeBudget, gasPriceOf, parseArgs, fund, estimateOperationGas };
if (require.main === module) main().catch((error) => {
  // RPC errors may embed URLs/API keys or request bodies: never print raw error objects.
  console.error('LỖI: ' + (error.safeMessage ?? 'Không hoàn tất cấp phí/ước lượng. Kiểm RPC, khóa trong .env, bản biên dịch và tx hash đã in (nếu có).'));
  process.exitCode = 1;
});
