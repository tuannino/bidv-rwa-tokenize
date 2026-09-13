// Kiểm mọi điều kiện cần TRƯỚC khi deploy lên Sepolia, và sau khi deploy thì kiểm luôn
// địa chỉ đã nạp vào nguồn sự thật có khớp chain hay không.
//
//   npx hardhat run scripts/preflight-sepolia.js --network sepolia
//
// Vì sao cần: thiếu RPC/khóa/ETH thì hardhat báo lỗi rất khó truy (có khi chỉ là
// "cannot estimate gas"). Script này chỉ ra ĐÚNG thứ còn thiếu và cách lấy.
// KHÔNG in khóa bí mật — chỉ in địa chỉ suy ra được.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const SHARED_ADDRESSES = path.resolve(__dirname, "../../shared/src/addresses.json");
const CONTRACTS = ["ProjectToken", "VNDToken", "ProfitDistributor", "Redemption"];

/** Gas tối thiểu nên có: deploy 4 contract + vài tx nghiệp vụ. */
const MIN_ETH = 0.05;

const C = { reset: "\u001b[0m", bold: "\u001b[1m", green: "\u001b[32m", red: "\u001b[31m", yellow: "\u001b[33m", dim: "\u001b[2m" };
const problems = [];
const warnings = [];

const ok = (msg) => console.log(`  ${C.green}OK  ${C.reset} ${msg}`);
const bad = (msg, how) => {
  console.log(`  ${C.red}THIẾU${C.reset} ${msg}`);
  problems.push({ msg, how });
};
const warn = (msg, how) => {
  console.log(`  ${C.yellow}LƯU Ý${C.reset} ${msg}`);
  warnings.push({ msg, how });
};
const section = (title) => console.log(`\n${C.bold}${title}${C.reset}`);

/** ProjectToken -> PROJECT_TOKEN (khớp addressEnvKey trong packages/shared). */
const screamingSnake = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();

function readAddressBook() {
  try {
    return JSON.parse(fs.readFileSync(SHARED_ADDRESSES, "utf8")).chains ?? {};
  } catch {
    return {};
  }
}

async function main() {
  console.log(`${C.bold}PREFLIGHT SEPOLIA — kiểm điều kiện deploy${C.reset}`);
  console.log(`${C.dim}network=${network.name}${C.reset}`);

  // ---- 1. Biến môi trường ----
  section("1. Biến môi trường (packages/contracts-evm/.env)");
  if (process.env.SEPOLIA_RPC_URL) {
    ok(`SEPOLIA_RPC_URL đã đặt (${new URL(process.env.SEPOLIA_RPC_URL).host})`);
  } else {
    warn(
      "SEPOLIA_RPC_URL trống -> dùng endpoint công khai, có thể bị rate-limit",
      "Đặt RPC có API key (Infura/Alchemy) trong packages/contracts-evm/.env",
    );
  }

  if (process.env.PRIVATE_KEY) ok("PRIVATE_KEY đã đặt");
  else
    bad(
      "PRIVATE_KEY trống -> hardhat không có ví nào để ký",
      "cp packages/contracts-evm/.env.example .env rồi điền PRIVATE_KEY (0x + 64 hex)",
    );

  if (process.env.ETHERSCAN_API_KEY) ok("ETHERSCAN_API_KEY đã đặt");
  else
    warn(
      "ETHERSCAN_API_KEY trống -> deploy được nhưng KHÔNG verify được source",
      "Lấy key miễn phí ở https://etherscan.io/myapikey",
    );

  // ---- 2. RPC + chainId ----
  section("2. Kết nối RPC");
  let chainId;
  try {
    const net = await ethers.provider.getNetwork();
    chainId = Number(net.chainId);
    if (chainId === 11155111) ok(`RPC trả lời, chainId = ${chainId} (Sepolia)`);
    else bad(`chainId = ${chainId}, KHÔNG phải Sepolia (11155111)`, "Kiểm lại SEPOLIA_RPC_URL");
  } catch (error) {
    bad(`không gọi được RPC: ${error.shortMessage ?? error.message}`, "Kiểm SEPOLIA_RPC_URL còn sống");
  }

  // ---- 3. Ví ngân hàng + gas ----
  section("3. Ví ngân hàng (deployer) và ETH test");
  let deployer;
  const signers = await ethers.getSigners().catch(() => []);
  if (signers.length === 0) {
    // Không báo lại là "thiếu": nguyên nhân duy nhất là PRIVATE_KEY, đã báo ở mục 1.
    // Lặp cùng một nguyên nhân thành hai việc làm người đọc tưởng có hai vấn đề.
    console.log(`  ${C.dim}-    bỏ qua: chưa có PRIVATE_KEY nên chưa suy ra được ví${C.reset}`);
  } else {
    deployer = signers[0];
    ok(`địa chỉ ví: ${deployer.address}`);
    if (chainId === 11155111) {
      const wei = await ethers.provider.getBalance(deployer.address);
      const eth = Number(ethers.formatEther(wei));
      if (eth >= MIN_ETH) {
        ok(`số dư ${eth} ETH (>= ${MIN_ETH} ETH cần thiết)`);
      } else {
        bad(
          `số dư chỉ ${eth} ETH, cần >= ${MIN_ETH} ETH để deploy 4 contract + tx nghiệp vụ`,
          `Xin ETH test cho ${deployer.address} tại https://sepoliafaucet.com hoặc ` +
            `https://www.alchemy.com/faucets/ethereum-sepolia (xem docs/TESTNET_SEPOLIA.md)`,
        );
      }
    }
  }

  // ---- 4. Địa chỉ contract (chỉ có nghĩa SAU khi deploy) ----
  section("4. Địa chỉ contract cho chainKey \"evm\" (sau deploy)");
  const book = readAddressBook();
  const fromFile = book.evm?.contracts ?? {};
  let resolved = 0;

  for (const name of CONTRACTS) {
    const envKey = `NEXT_PUBLIC_ADDR_EVM_${screamingSnake(name)}`;
    const address = process.env[envKey] || fromFile[name];
    if (!address) {
      console.log(`  ${C.dim}-    ${name}: chưa có (env ${envKey} hoặc addresses.json "evm")${C.reset}`);
      continue;
    }
    if (chainId !== 11155111) continue;

    const code = await ethers.provider.getCode(address);
    if (code === "0x") {
      bad(`${name} = ${address} nhưng KHÔNG có bytecode trên Sepolia`, "Địa chỉ sai chain hoặc chưa deploy");
    } else {
      ok(`${name} = ${address} (đã có bytecode)`);
      resolved += 1;
    }
  }

  if (resolved === 0) {
    console.log(
      `  ${C.dim}=> Bình thường nếu CHƯA deploy. Chạy: npx hardhat run scripts/deploy.js --network sepolia${C.reset}`,
    );
  } else if (resolved === CONTRACTS.length) {
    // Đọc thử token để chắc app sẽ đọc được.
    const address = process.env.NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN || fromFile.ProjectToken;
    const token = await ethers.getContractAt("ProjectToken", address);
    ok(`đọc được token: ${await token.symbol()} — ${await token.name()}, decimals ${await token.decimals()}`);
  }

  // ---- Kết luận ----
  console.log("");
  if (warnings.length) {
    console.log(`${C.yellow}${C.bold}${warnings.length} lưu ý:${C.reset}`);
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w.msg}\n     -> ${w.how}`));
  }
  if (problems.length) {
    console.log(`\n${C.red}${C.bold}CHƯA SẴN SÀNG — ${problems.length} việc phải làm:${C.reset}`);
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p.msg}\n     -> ${p.how}`));
    process.exitCode = 1;
    return;
  }
  console.log(`${C.green}${C.bold}SẴN SÀNG${C.reset} — chạy tiếp:`);
  console.log("  npx hardhat run scripts/deploy.js --network sepolia");
}

main().catch((error) => {
  console.error(`\n${C.red}Preflight lỗi:${C.reset}`, error.shortMessage ?? error.message);
  process.exitCode = 1;
});
