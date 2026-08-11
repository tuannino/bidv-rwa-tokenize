// Triển khai bộ hợp đồng RWA năng lượng tái tạo.
// Dùng cho mạng bất kỳ đã cấu hình trong hardhat.config.js
//   npx hardhat run scripts/deploy.js --network <mạng>
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address; // ngân hàng = admin/agent/minter/... (đổi tùy nhu cầu)

  console.log("Mạng:", network.name);
  console.log("Người triển khai (ngân hàng):", admin);

  // 1) Token
  const spt = await ethers.deployContract("ProjectToken", ["Solar Project Token", "SPT", 0, admin]);
  await spt.waitForDeployment();
  const vnd = await ethers.deployContract("VNDToken", [admin]);
  await vnd.waitForDeployment();

  // 2) Nghiệp vụ
  const distributor = await ethers.deployContract("ProfitDistributor", [
    await spt.getAddress(),
    await vnd.getAddress(),
    admin,
  ]);
  await distributor.waitForDeployment();

  const rate = 1_000_000n; // 1 SPT = 1.000.000 VND (đổi tùy phương án)
  const redemption = await ethers.deployContract("Redemption", [
    await spt.getAddress(),
    await vnd.getAddress(),
    rate,
    admin,
  ]);
  await redemption.waitForDeployment();

  // 3) Cấp quyền: Distributor được chốt snapshot trên SPT
  const SNAPSHOT_ROLE = await spt.SNAPSHOT_ROLE();
  await (await spt.grantRole(SNAPSHOT_ROLE, await distributor.getAddress())).wait();

  console.log("\n=== ĐỊA CHỈ HỢP ĐỒNG ===");
  console.log("ProjectToken (SPT):   ", await spt.getAddress());
  console.log("VNDToken (tVND):      ", await vnd.getAddress());
  console.log("ProfitDistributor:    ", await distributor.getAddress());
  console.log("Redemption:           ", await redemption.getAddress());
  console.log("\nGhi lại các địa chỉ trên để tương tác ở các bước sau.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
