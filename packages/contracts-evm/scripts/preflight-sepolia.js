// Chỉ đọc Sepolia và mô phỏng gas cục bộ; không ký/gửi giao dịch testnet.
const fs = require('fs');
const path = require('path');
const { ethers, network } = require('hardhat');
const { assertSepolia, assertTarget, feeBudget, gasPriceOf, estimateOperationGas } = require('./fund-sepolia');
const SHARED_ADDRESSES = path.resolve(__dirname, '../../shared/src/addresses.json');

async function signerFunding(provider, address, estimates) {
  const [balance, fees] = await Promise.all([provider.getBalance(address), provider.getFeeData()]);
  // Deploy gồm bốn constructor và cấp SNAPSHOT_ROLE; thêm whitelist SPV + Mint/Mint/Burn.
  const gas = estimates.deploy + estimates.whitelist + estimates.cycle;
  const required = feeBudget(gas, gasPriceOf(fees));
  return { balance, required, enough: balance >= required,
    command: `node scripts/fund-sepolia.js ${address} --eth ${ethers.formatEther(required)}` };
}
async function main() {
  let problems = 0;
  const ok = (message) => console.log('OK: ' + message);
  const bad = (message) => { problems++; console.log('THIẾU: ' + message); };
  console.log(`PREFLIGHT SEPOLIA — network=${network.name}`);
  if (process.env.SEPOLIA_RPC_URL) ok('SEPOLIA_RPC_URL đã đặt (không in endpoint bí mật).');
  else console.log('LƯU Ý: dùng RPC công khai; nên đặt SEPOLIA_RPC_URL có API key trong .env.');
  assertSepolia((await ethers.provider.getNetwork()).chainId);
  ok('RPC trả chainId 11155111.');
  const keys = ['PRIVATE_KEY', 'SERVER_SIGNER_PRIVATE_KEY_EVM'];
  const wallets = {};
  for (const key of keys) {
    if (!process.env[key]) { bad(`${key} chưa đặt trong packages/contracts-evm/.env.`); continue; }
    try {
      const value = process.env[key];
      const wallet = new ethers.Wallet(value.startsWith('0x') ? value : '0x' + value);
      assertTarget(wallet.address);
      wallets[key] = wallet;
      ok(`${key}: ${wallets[key].address}`);
    } catch { bad(`${key} không hợp lệ hoặc là ví mẫu Hardhat.`); }
  }
  const deployer = wallets.PRIVATE_KEY;
  const signer = wallets.SERVER_SIGNER_PRIVATE_KEY_EVM;
  if (deployer && signer && deployer.address !== signer.address) {
    bad('PRIVATE_KEY và SERVER_SIGNER_PRIVATE_KEY_EVM phải là cùng ví; không đổi deploy.js để cấp vai ví khác.');
  }
  if (signer) {
    const estimates = await estimateOperationGas();
    const result = await signerFunding(ethers.provider, signer.address, estimates);
    console.log(`Gas mô phỏng: deploy=${estimates.deploy}, whitelist=${estimates.whitelist}, Mint/Mint/Burn=${estimates.cycle}; dự phòng 20%.`);
    console.log(`Ví ký có ${ethers.formatEther(result.balance)} ETH; cần ${ethers.formatEther(result.required)} ETH.`);
    if (result.enough) ok('Đủ phí triển khai, whitelist và một vòng Mint, Mint, Burn.');
    else {
      bad('Ví ký thiếu phí. Trong packages/contracts-evm, cấp đúng phần thiếu bằng:');
      console.log(result.command);
      console.log(result.command + ' --dry-run');
    }
  }
  const book = JSON.parse(fs.readFileSync(SHARED_ADDRESSES, 'utf8'));
  console.log('Địa chỉ hiện tại lấy từ addresses.json, không dùng NEXT_PUBLIC_ADDR_EVM_*:');
  for (const [name, address] of Object.entries(book.chains.evm?.contracts ?? {})) {
    const code = await ethers.provider.getCode(address);
    console.log(`${name} ${address}: ${code === '0x' ? 'chưa có bytecode' : 'có bytecode (chưa khẳng định SC-02)'}`);
  }
  if (!process.env.ETHERSCAN_API_KEY) console.log('LƯU Ý: verify source Etherscan là tùy chọn, chưa có ETHERSCAN_API_KEY.');
  console.log(problems ? `CHƯA SẴN SÀNG — ${problems} việc cần xử lý.` : 'SẴN SÀNG — chạy npx hardhat run scripts/deploy.js --network sepolia');
  process.exitCode = problems ? 1 : 0;
}
module.exports = { signerFunding };
if (require.main === module) main().catch((error) => {
  console.error('Preflight lỗi: ' + (error.safeMessage ?? 'Không đọc được RPC hoặc mô phỏng gas. Kiểm .env và chạy npx hardhat compile; không gửi khóa/RPC bí mật vào checkpoint.'));
  process.exitCode = 1;
});
