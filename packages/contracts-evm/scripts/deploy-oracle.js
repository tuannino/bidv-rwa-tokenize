const { ethers, network } = require("hardhat");

// Deploy bản CÓ ORACLE: ProjectToken + VND + EnergyOracle + ProfitDistributorOracle + Redemption.
//   npx hardhat run scripts/deploy-oracle.js --network besu
async function main() {
  const [admin] = await ethers.getSigners();
  console.log("Mạng:", network.name, "| Admin:", admin.address);

  const wpt = await ethers.deployContract("ProjectToken", ["Wind Power Token", "WPT", 0, admin.address]);
  const vnd = await ethers.deployContract("VNDToken", [admin.address]);
  const oracle = await ethers.deployContract("EnergyOracle", [admin.address]);
  const dist = await ethers.deployContract("ProfitDistributorOracle", [
    await wpt.getAddress(),
    await vnd.getAddress(),
    await oracle.getAddress(),
    admin.address,
  ]);
  const redemption = await ethers.deployContract("Redemption", [
    await wpt.getAddress(),
    await vnd.getAddress(),
    1_000_000n,
    admin.address,
  ]);

  // Distributor cần quyền chốt snapshot trên WPT
  await wpt.grantRole(await wpt.SNAPSHOT_ROLE(), await dist.getAddress());

  console.log("\n=== ĐỊA CHỈ ===");
  console.log("ProjectToken (WPT)      :", await wpt.getAddress());
  console.log("VNDToken (tVND)         :", await vnd.getAddress());
  console.log("EnergyOracle            :", await oracle.getAddress());
  console.log("ProfitDistributorOracle :", await dist.getAddress());
  console.log("Redemption              :", await redemption.getAddress());
  console.log("\nBước tiếp: cấp REPORTER_ROLE cho các node đọc công-tơ, whitelist nhà đầu tư, mint WPT.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
