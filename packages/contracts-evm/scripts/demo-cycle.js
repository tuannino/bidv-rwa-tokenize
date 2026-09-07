// Chạy trọn một chu kỳ trên mạng in-process (hardhat) để minh họa.
//   npx hardhat run scripts/demo-cycle.js
const { ethers } = require("hardhat");

const f = (x) => x.toLocaleString("vi-VN");

async function main() {
  const [bank, invA, invB] = await ethers.getSigners();

  const wpt = await ethers.deployContract("ProjectToken", ["Wind Power Token", "WPT", 0, bank.address]);
  const vnd = await ethers.deployContract("VNDToken", [bank.address]);
  const distributor = await ethers.deployContract("ProfitDistributor", [
    await wpt.getAddress(), await vnd.getAddress(), bank.address,
  ]);
  const redemption = await ethers.deployContract("Redemption", [
    await wpt.getAddress(), await vnd.getAddress(), 1_000_000n, bank.address,
  ]);
  await wpt.grantRole(await wpt.SNAPSHOT_ROLE(), await distributor.getAddress());

  console.log("1) KYC hai nhà đầu tư");
  await wpt.batchSetWhitelisted([invA.address, invB.address], true);

  console.log("2) Ngân hàng phát hành WPT: A=6000, B=4000");
  await wpt.mint(invA.address, 6000n);
  await wpt.mint(invB.address, 4000n);

  console.log("3) Chốt kỳ Q1 và nạp 300.000.000 VND lợi nhuận");
  await vnd.mint(bank.address, 300_000_000n);
  await vnd.approve(await distributor.getAddress(), 300_000_000n);
  await distributor.createDistribution(300_000_000n, "2026-Q1");

  console.log("   -> phần A dự kiến:", f(await distributor.previewClaim(0, invA.address)), "VND");
  console.log("   -> phần B dự kiến:", f(await distributor.previewClaim(0, invB.address)), "VND");

  console.log("4) A tự nhận, ngân hàng chia hộ B");
  await distributor.connect(invA).claim(0);
  await distributor.distributeTo(0, [invB.address]);
  console.log("   -> VND của A:", f(await vnd.balanceOf(invA.address)));
  console.log("   -> VND của B:", f(await vnd.balanceOf(invB.address)));

  console.log("5) Hoàn vốn: A đổi 1000 WPT lấy VND (rate 1.000.000)");
  await vnd.mint(bank.address, 2_000_000_000n);
  await vnd.approve(await redemption.getAddress(), 2_000_000_000n);
  await redemption.fund(2_000_000_000n);
  await wpt.connect(invA).approve(await redemption.getAddress(), 1000n);
  await redemption.connect(invA).redeem(1000n);
  console.log("   -> WPT của A còn:", f(await wpt.balanceOf(invA.address)));
  console.log("   -> tổng cung WPT:", f(await wpt.totalSupply()));
  console.log("   -> VND của A:", f(await vnd.balanceOf(invA.address)));

  console.log("\nHoàn tất chu kỳ demo.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
