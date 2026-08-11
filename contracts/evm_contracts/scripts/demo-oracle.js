const { ethers } = require("hardhat");

// Demo một chu kỳ chia lợi nhuận LẤY SỐ TỪ ORACLE sản lượng điện.
//   npx hardhat run scripts/demo-oracle.js
function vnd(n) {
  return n.toLocaleString("vi-VN");
}

async function main() {
  const [bank, oem, auditor, invA, invB] = await ethers.getSigners();

  // Triển khai
  const spt = await ethers.deployContract("ProjectToken", ["Solar Project Token", "SPT", 0, bank.address]);
  const vndToken = await ethers.deployContract("VNDToken", [bank.address]);
  const oracle = await ethers.deployContract("EnergyOracle", [bank.address]);
  const dist = await ethers.deployContract("ProfitDistributorOracle", [
    await spt.getAddress(),
    await vndToken.getAddress(),
    await oracle.getAddress(),
    bank.address,
  ]);
  await spt.grantRole(await spt.SNAPSHOT_ROLE(), await dist.getAddress());

  // KYC + phát hành: A 6000 (60%), B 4000 (40%)
  await spt.batchSetWhitelisted([invA.address, invB.address], true);
  await spt.mint(invA.address, 6000n);
  await spt.mint(invB.address, 4000n);
  console.log("Phát hành SPT: A=6000 (60%), B=4000 (40%), tổng cung =", (await spt.totalSupply()).toString());

  // Yêu cầu 2 xác nhận (O&M + kiểm toán độc lập)
  await oracle.setRequiredConfirmations(2);
  await oracle.grantRole(await oracle.REPORTER_ROLE(), oem.address);
  await oracle.grantRole(await oracle.REPORTER_ROLE(), auditor.address);

  // Kỳ 2026-Q1: 1.000.000 kWh × 2.000 VND/kWh, opex 200 triệu, chia 80%
  const PERIOD = 202601n;
  console.log("\n[Q1] O&M đẩy số liệu: 1.000.000 kWh × 2.000 VND, opex 200.000.000, chia 80%");
  await oracle.connect(oem).submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);
  console.log("     Đã chốt?", await oracle.isFinalized(PERIOD), "(mới 1/2 xác nhận)");
  console.log("[Q1] Kiểm toán độc lập xác nhận cùng số liệu...");
  await oracle.connect(auditor).submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);
  console.log("     Đã chốt?", await oracle.isFinalized(PERIOD));

  console.log("\n     Doanh thu (gross) :", vnd(await oracle.grossRevenueVnd(PERIOD)), "VND");
  console.log("     Lãi ròng   (net) :", vnd(await oracle.netRevenueVnd(PERIOD)), "VND");
  const payout = await oracle.distributableProfitVnd(PERIOD);
  console.log("     Chia được        :", vnd(payout), "VND (80%)");

  // Ngân hàng nạp VND + approve, tạo đợt chia từ oracle
  await vndToken.mint(bank.address, payout);
  await vndToken.approve(await dist.getAddress(), payout);
  await dist.createDistributionFromOracle(PERIOD);
  console.log("\n[Q1] Tạo đợt chia #0 từ oracle. Suất chia theo snapshot sở hữu:");
  console.log("     A (60%) nhận:", vnd(await dist.previewClaim(0, invA.address)), "VND");
  console.log("     B (40%) nhận:", vnd(await dist.previewClaim(0, invB.address)), "VND");

  await dist.connect(invA).claim(0);
  await dist.connect(invB).claim(0);
  console.log("     Số dư VND A:", vnd(await vndToken.balanceOf(invA.address)));
  console.log("     Số dư VND B:", vnd(await vndToken.balanceOf(invB.address)));
  console.log("\nHoàn tất demo oracle.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
