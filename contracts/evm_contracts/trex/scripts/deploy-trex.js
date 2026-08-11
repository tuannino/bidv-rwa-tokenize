const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { deployFullSuite } = require("./deploy-lib");

// Deploy trọn bộ ERC-3643 (T-REX) lên mạng đang chọn (hardhat/sepolia/besu).
// Cách chạy:
//   npx hardhat run scripts/deploy-trex.js --network sepolia
//   npx hardhat run scripts/deploy-trex.js --network besu
//
// Trên testnet/mạng thật chỉ có 1 khóa (deployer). Để demo đủ vai, ta để
// deployer kiêm luôn tokenIssuer & claimIssuer. Khi lên sản xuất, TÁCH các vai
// này ra các ví/multisig khác nhau (xem mục 7 tài liệu hướng dẫn).
async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const tokenIssuer = signers[1] || deployer;
  const claimIssuer = signers[2] || deployer;

  console.log("Mạng:", network.name);
  console.log("Deployer:", deployer.address);

  const suite = await deployFullSuite(
    { deployer, tokenIssuer, claimIssuer },
    { name: "Solar Project Token", symbol: "SPT", decimals: 0 }
  );

  console.log("\n=== ĐỊA CHỈ TRIỂN KHAI (ERC-3643 / T-REX) ===");
  for (const [k, v] of Object.entries(suite.addresses)) {
    console.log(k.padEnd(18), v);
  }
  console.log("tokenIssuer".padEnd(18), tokenIssuer.address);
  console.log("claimIssuerSigner".padEnd(18), claimIssuer.address);

  const out = {
    network: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    tokenIssuer: tokenIssuer.address,
    claimIssuerSigner: claimIssuer.address,
    ...suite.addresses,
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `trex-${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("\nĐã lưu địa chỉ vào:", file);
  console.log("\nBước tiếp: onboard nhà đầu tư (tạo ONCHAINID + claim KYC) rồi mint.");
  console.log("Xem scripts/deploy-lib.js -> onboardInvestor(...) hoặc mục 6 tài liệu hướng dẫn.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
