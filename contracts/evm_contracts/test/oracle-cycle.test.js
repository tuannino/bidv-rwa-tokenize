const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle sản lượng điện + chia lợi nhuận theo công thức", function () {
  let bank, reporter2, invA, invB;
  let spt, vnd, oracle, distributor;

  const DEC = 0n;
  const PERIOD = 202601n; // 2026-Q1

  beforeEach(async function () {
    [bank, reporter2, invA, invB] = await ethers.getSigners();

    spt = await ethers.deployContract("ProjectToken", ["Solar Project Token", "SPT", DEC, bank.address]);
    vnd = await ethers.deployContract("VNDToken", [bank.address]);
    oracle = await ethers.deployContract("EnergyOracle", [bank.address]);

    distributor = await ethers.deployContract("ProfitDistributorOracle", [
      await spt.getAddress(),
      await vnd.getAddress(),
      await oracle.getAddress(),
      bank.address,
    ]);

    // distributor cần quyền chốt snapshot trên SPT
    await spt.grantRole(await spt.SNAPSHOT_ROLE(), await distributor.getAddress());

    // KYC + phát hành SPT: A 6000, B 4000
    await spt.batchSetWhitelisted([invA.address, invB.address], true);
    await spt.mint(invA.address, 6000n);
    await spt.mint(invB.address, 4000n);
  });

  it("Công thức lợi nhuận: gross = kWh×giá, net = gross−opex, chia = net×share", async function () {
    // 1.000.000 kWh × 2.000 VND = 2.000.000.000 VND doanh thu
    // − 200.000.000 opex = 1.800.000.000 net
    // × 80% (8000 bps) = 1.440.000.000 VND chia được
    await oracle.submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);

    expect(await oracle.grossRevenueVnd(PERIOD)).to.equal(2_000_000_000n);
    expect(await oracle.netRevenueVnd(PERIOD)).to.equal(1_800_000_000n);
    expect(await oracle.distributableProfitVnd(PERIOD)).to.equal(1_440_000_000n);
    expect(await oracle.isFinalized(PERIOD)).to.equal(true); // requiredConfirmations mặc định = 1
  });

  it("Đa xác nhận: cần đủ 2 reporter khớp số liệu mới chốt; số liệu lệch bị từ chối", async function () {
    await oracle.setRequiredConfirmations(2);
    await oracle.grantRole(await oracle.REPORTER_ROLE(), reporter2.address);

    await oracle.submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);
    expect(await oracle.isFinalized(PERIOD)).to.equal(false);

    // reporter2 đẩy số liệu LỆCH => bị chặn
    await expect(
      oracle.connect(reporter2).submitReading(PERIOD, 999_999n, 2_000n, 200_000_000n, 8000)
    ).to.be.reverted;

    // reporter2 đẩy ĐÚNG => đủ 2 xác nhận => chốt
    await oracle.connect(reporter2).submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);
    expect(await oracle.isFinalized(PERIOD)).to.equal(true);
  });

  it("Tạo đợt chia từ oracle rồi nhà đầu tư nhận đúng theo tỷ lệ nắm giữ", async function () {
    await oracle.submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);
    const amount = await oracle.distributableProfitVnd(PERIOD); // 1.440.000.000

    // Ngân hàng nạp đủ VND và approve cho distributor
    await vnd.mint(bank.address, amount);
    await vnd.approve(await distributor.getAddress(), amount);

    await distributor.createDistributionFromOracle(PERIOD);

    // A giữ 60% => 864.000.000 ; B giữ 40% => 576.000.000
    expect(await distributor.previewClaim(0, invA.address)).to.equal(864_000_000n);
    expect(await distributor.previewClaim(0, invB.address)).to.equal(576_000_000n);

    await distributor.connect(invA).claim(0);
    await distributor.connect(invB).claim(0);
    expect(await vnd.balanceOf(invA.address)).to.equal(864_000_000n);
    expect(await vnd.balanceOf(invB.address)).to.equal(576_000_000n);
  });

  it("Không chia được khi oracle chưa chốt, và không chia trùng một kỳ", async function () {
    await oracle.setRequiredConfirmations(2);
    await oracle.submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000); // mới 1 xác nhận

    await vnd.mint(bank.address, 10_000_000_000n);
    await vnd.approve(await distributor.getAddress(), 10_000_000_000n);

    // chưa chốt => revert
    await expect(distributor.createDistributionFromOracle(PERIOD)).to.be.reverted;

    // chốt rồi tạo được
    await oracle.grantRole(await oracle.REPORTER_ROLE(), reporter2.address);
    await oracle.connect(reporter2).submitReading(PERIOD, 1_000_000n, 2_000n, 200_000_000n, 8000);
    await distributor.createDistributionFromOracle(PERIOD);

    // tạo lại cùng kỳ => revert
    await expect(distributor.createDistributionFromOracle(PERIOD)).to.be.reverted;
  });

  it("opex vượt doanh thu => lợi nhuận chia = 0 (không âm)", async function () {
    await oracle.submitReading(PERIOD, 1_000n, 2_000n, 5_000_000n, 8000); // gross 2.000.000 < opex 5.000.000
    expect(await oracle.netRevenueVnd(PERIOD)).to.equal(0n);
    expect(await oracle.distributableProfitVnd(PERIOD)).to.equal(0n);
  });
});
