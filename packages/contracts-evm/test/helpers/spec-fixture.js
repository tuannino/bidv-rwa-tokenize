/**
 * Fixture dùng chung cho spec test P4 / P7 / P12 (EVM).
 *
 * Triển khai đúng bộ contract của repo và cấp đủ role, để mỗi file spec chỉ
 * tập trung kiểm acceptance criteria chứ không lặp lại phần dựng môi trường.
 *
 * Ghi chú đơn vị: ProjectToken và VNDToken đều decimals 0 ở bản EVM, nên mọi
 * số trong test là số nguyên đơn vị nhỏ nhất, không cần parseUnits.
 */
const { ethers } = require("hardhat");

// Ký hiệu token kỳ vọng sau khi đồng bộ đổi tên (SPT -> WPT, tVND -> VNDB).
// Đặt qua biến môi trường để không phá CI trong lúc việc đổi tên chưa xong:
//   EXPECT_TOKEN_SYMBOLS=1 npx hardhat test
const EXPECTED_PROJECT_SYMBOL = "WPT";
const EXPECTED_PAYOUT_SYMBOL = "VNDB";

async function deploySpecFixture() {
  const [admin, investorA, investorB, outsider, reporter2] = await ethers.getSigners();

  // --- Token dự án (WPT) ---
  const ProjectToken = await ethers.getContractFactory("ProjectToken");
  const project = await ProjectToken.deploy(
    "Wind Project Token",
    EXPECTED_PROJECT_SYMBOL,
    0,
    admin.address
  );
  await project.waitForDeployment();

  // --- Token chi trả (VNDB) ---
  const VNDToken = await ethers.getContractFactory("VNDToken");
  const payout = await VNDToken.deploy(admin.address);
  await payout.waitForDeployment();

  // --- Oracle sản lượng điện ---
  const EnergyOracle = await ethers.getContractFactory("EnergyOracle");
  const oracle = await EnergyOracle.deploy(admin.address);
  await oracle.waitForDeployment();

  // --- Distributor có nhánh oracle (kế thừa ProfitDistributor) ---
  const ProfitDistributorOracle = await ethers.getContractFactory("ProfitDistributorOracle");
  const distributor = await ProfitDistributorOracle.deploy(
    await project.getAddress(),
    await payout.getAddress(),
    await oracle.getAddress(),
    admin.address
  );
  await distributor.waitForDeployment();

  // --- Hoàn vốn: tỷ giá 10.000 VNDB cho 1 WPT ---
  const RATE = 10000n;
  const Redemption = await ethers.getContractFactory("Redemption");
  const redemption = await Redemption.deploy(
    await project.getAddress(),
    await payout.getAddress(),
    RATE,
    admin.address
  );
  await redemption.waitForDeployment();

  // -------------------------------------------------------------------------
  // Cấp role bắt buộc.
  // Distributor tự gọi projectToken.snapshot() trong createDistribution nên
  // BẮT BUỘC có SNAPSHOT_ROLE. Thiếu role này là nguyên nhân lỗi phổ biến
  // nhất khi triển khai lên testnet.
  // -------------------------------------------------------------------------
  await project.grantRole(await project.SNAPSHOT_ROLE(), await distributor.getAddress());

  return {
    admin, investorA, investorB, outsider, reporter2,
    project, payout, oracle, distributor, redemption,
    RATE,
    EXPECTED_PROJECT_SYMBOL,
    EXPECTED_PAYOUT_SYMBOL,
  };
}

/** Whitelist một danh sách ví trên token dự án. */
async function whitelist(project, admin, wallets) {
  for (const w of wallets) {
    await project.connect(admin).setWhitelisted(w.address ?? w, true);
  }
}

/** Nạp kho VNDB cho một địa chỉ hợp đồng (distributor hoặc redemption). */
async function fundPayout(payout, admin, to, amount) {
  await payout.connect(admin).mint(to, amount);
}

module.exports = {
  deploySpecFixture,
  whitelist,
  fundPayout,
  EXPECTED_PROJECT_SYMBOL,
  EXPECTED_PAYOUT_SYMBOL,
};
