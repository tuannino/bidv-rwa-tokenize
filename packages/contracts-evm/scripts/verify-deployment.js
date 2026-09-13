// Kiểm bản deploy trên chain đã đủ điều kiện cho P4/P7/P12 chưa: role on-chain, liên kết
// giữa các contract, và tham số. KHÔNG gửi giao dịch nào — chỉ đọc.
//
//   npx hardhat run scripts/verify-deployment.js --network sepolia
//
// Vì sao cần: deploy "thành công" vẫn có thể thiếu role (vd distributor không có
// SNAPSHOT_ROLE thì P7 chết ở bước chốt kỳ), hoặc contract trỏ sai token. Những lỗi đó chỉ
// lộ ra giữa lúc demo nếu không kiểm trước.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const SHARED_ADDRESSES = path.resolve(__dirname, "../../shared/src/addresses.json");
const C = { reset: "\u001b[0m", bold: "\u001b[1m", green: "\u001b[32m", red: "\u001b[31m", dim: "\u001b[2m" };

const problems = [];
const ok = (m) => console.log(`  ${C.green}OK  ${C.reset} ${m}`);
const bad = (m) => {
  console.log(`  ${C.red}SAI ${C.reset} ${m}`);
  problems.push(m);
};
const section = (t) => console.log(`\n${C.bold}${t}${C.reset}`);

function chainKeyOf(chainId) {
  return chainId === 31337n || chainId === 1337n ? "hardhat-local" : "evm";
}

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const chainKey = chainKeyOf(chainId);
  const book = JSON.parse(fs.readFileSync(SHARED_ADDRESSES, "utf8")).chains ?? {};
  const record = book[chainKey];

  console.log(`${C.bold}KIỂM BẢN DEPLOY — ${network.name} (chainKey="${chainKey}")${C.reset}`);
  if (!record) {
    bad(`addresses.json chưa có khối "${chainKey}"`);
    process.exitCode = 1;
    return;
  }

  const addr = record.contracts;
  console.log(`${C.dim}deployer ghi trong file: ${record.deployer}${C.reset}`);

  const spt = await ethers.getContractAt("ProjectToken", addr.ProjectToken);
  const vnd = await ethers.getContractAt("VNDToken", addr.VNDToken);
  const dist = await ethers.getContractAt("ProfitDistributor", addr.ProfitDistributor);
  const red = await ethers.getContractAt("Redemption", addr.Redemption);

  // ---- Token ----
  section("1. Token");
  const [symbol, name, decimals, supply] = await Promise.all([
    spt.symbol(), spt.name(), spt.decimals(), spt.totalSupply(),
  ]);
  if (symbol === "WPT") ok(`ProjectToken symbol = ${symbol} (${name}), decimals ${decimals}`);
  else bad(`ProjectToken symbol = ${symbol}, mong đợi WPT`);
  console.log(`  ${C.dim}tổng cung hiện tại: ${supply} WPT${C.reset}`);

  const vndSymbol = await vnd.symbol();
  ok(`VNDToken symbol = ${vndSymbol} (${await vnd.name()}), decimals ${await vnd.decimals()}`);

  // ---- Role của ví ngân hàng ----
  section("2. Role on-chain của ví ngân hàng (deployer)");
  const bank = record.deployer;
  for (const roleName of ["MINTER_ROLE", "AGENT_ROLE", "SNAPSHOT_ROLE", "PAUSER_ROLE"]) {
    const role = await spt[roleName]();
    if (await spt.hasRole(role, bank)) ok(`${roleName} -> ${bank}`);
    else bad(`ví ngân hàng THIẾU ${roleName} trên ProjectToken`);
  }

  // ---- Liên kết contract ----
  section("3. Liên kết giữa các contract");
  const distToken = await dist.projectToken();
  const distPayout = await dist.payoutToken();
  if (distToken.toLowerCase() === addr.ProjectToken.toLowerCase()) ok("ProfitDistributor.projectToken khớp");
  else bad(`ProfitDistributor.projectToken = ${distToken}, mong đợi ${addr.ProjectToken}`);
  if (distPayout.toLowerCase() === addr.VNDToken.toLowerCase()) ok("ProfitDistributor.payoutToken khớp VNDToken");
  else bad(`ProfitDistributor.payoutToken = ${distPayout}, mong đợi ${addr.VNDToken}`);

  const redToken = await red.projectToken();
  const redPayout = await red.payoutToken();
  if (redToken.toLowerCase() === addr.ProjectToken.toLowerCase()) ok("Redemption.projectToken khớp");
  else bad(`Redemption.projectToken = ${redToken}`);
  if (redPayout.toLowerCase() === addr.VNDToken.toLowerCase()) ok("Redemption.payoutToken khớp VNDToken");
  else bad(`Redemption.payoutToken = ${redPayout}`);
  ok(`Redemption.rate = ${await red.rate()} (VND cho 1 WPT)`);

  // ---- Điều kiện cho P7 ----
  section("4. Điều kiện cho P7 (chia lợi tức)");
  const snapshotRole = await spt.SNAPSHOT_ROLE();
  if (await spt.hasRole(snapshotRole, addr.ProfitDistributor)) {
    ok("ProfitDistributor có SNAPSHOT_ROLE (chốt kỳ được)");
  } else {
    bad("ProfitDistributor THIẾU SNAPSHOT_ROLE -> P7 sẽ chết ở bước chốt snapshot");
  }

  console.log("");
  if (problems.length) {
    console.log(`${C.red}${C.bold}${problems.length} vấn đề — bản deploy CHƯA dùng được${C.reset}`);
    process.exitCode = 1;
  } else {
    console.log(`${C.green}${C.bold}BẢN DEPLOY HỢP LỆ${C.reset} — đủ điều kiện cho P4, và P7/P12 dùng lại.`);
  }
}

main().catch((e) => {
  console.error(`\n${C.red}Lỗi:${C.reset}`, e.shortMessage ?? e.message);
  process.exitCode = 1;
});
