const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

async function profitFixture() {
  const f = await deploySpecFixture();
  await whitelist(f.project, f.admin, [f.investorA, f.investorB, f.outsider]);
  await f.project.mintInitialSupply(f.investorA.address, 100n);
  await f.payout.mint(f.admin.address, 1_000n);
  await f.payout.approve(await f.distributor.getAddress(), 1_000n);
  return f;
}

// Đọc deadline đã lưu nếu có; baseline chưa có trường này dùng luật cũ để tái hiện đúng lỗi.
async function deadline(distributor, id) {
  const d = await distributor.distributions(id);
  return d.claimDeadline ?? d.createdAt + await distributor.claimWindow();
}

describe("SC-10 - ProfitDistributor", function () {
  it("ca 1: claim kỳ A sau quét không lấy quỹ kỳ B", async function () {
    const { distributor, payout, admin, investorA } = await loadFixture(profitFixture);
    await distributor.createDistribution(100n, "A");
    await time.increase(181 * 24 * 60 * 60);
    await distributor.sweepDust(0, admin.address);
    await distributor.createDistribution(100n, "B");
    const claim = distributor.connect(investorA).claim(0);
    try {
      await claim;
      const a = await distributor.distributions(0);
      console.log(`REPRO: A claimed/amount=${a.claimed}/${a.amount}; B fund=${await payout.balanceOf(await distributor.getAddress())}`);
    } catch { /* Ca đã vá: kiểm đúng custom error bên dưới. */ }
    await expect(claim).to.be.revertedWithCustomError(distributor, "DistributionClosed").withArgs(0);
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(100n);
    await distributor.connect(investorA).claim(1);
    expect(await payout.balanceOf(investorA.address)).to.equal(100n);
    expect((await distributor.distributions(1)).claimed).to.equal(100n);
  });

  it("ca 2: distributeTo kỳ đã đóng revert cả lô", async function () {
    const { distributor, payout, admin, investorA, investorB } = await loadFixture(profitFixture);
    await distributor.createDistribution(100n, "A");
    await time.increaseTo(await deadline(distributor, 0));
    await distributor.sweepDust(0, admin.address);
    await distributor.createDistribution(100n, "B");
    await expect(distributor.distributeTo(0, [investorA.address, investorB.address]))
      .to.be.revertedWithCustomError(distributor, "DistributionClosed");
    expect(await payout.balanceOf(investorA.address)).to.equal(0n);
    expect(await payout.balanceOf(investorB.address)).to.equal(0n);
    expect(await distributor.hasClaimed(0, investorA.address)).to.equal(false);
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(100n);
  });

  it("ca 3: đúng deadline và sau deadline chưa quét không nhận được", async function () {
    const { distributor, payout, investorA, investorB } = await loadFixture(profitFixture);
    await distributor.createDistribution(100n, "A");
    const end = await deadline(distributor, 0);
    await time.setNextBlockTimestamp(end);
    await expect(distributor.connect(investorA).claim(0))
      .to.be.revertedWithCustomError(distributor, "ClaimWindowEnded").withArgs(0, end);
    await expect(distributor.distributeTo(0, [investorA.address, investorB.address]))
      .to.be.revertedWithCustomError(distributor, "ClaimWindowEnded");
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(100n);
    expect((await distributor.distributions(0)).claimed).to.equal(0n);
  });

  it("ca 4: sweep chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được", async function () {
    const { distributor, payout, admin, investorA } = await loadFixture(profitFixture);
    await distributor.createDistribution(100n, "A");
    await expect(distributor.sweepDust(0, admin.address)).to.be.revertedWith("chua het han nhan");
    await time.setNextBlockTimestamp(await deadline(distributor, 0));
    await expect(distributor.sweepDust(0, admin.address))
      .to.emit(distributor, "DistributionClosed").withArgs(0, 100n)
      .and.to.emit(distributor, "DustSwept").withArgs(0, admin.address, 100n);
    expect((await distributor.distributions(0)).closed).to.equal(true);
    await expect(distributor.sweepDust(0, admin.address)).to.be.revertedWithCustomError(distributor, "DistributionClosed");

    await distributor.createDistribution(100n, "B");
    await distributor.connect(investorA).claim(1);
    await time.increaseTo(await deadline(distributor, 1));
    const tx = distributor.sweepDust(1, admin.address);
    await expect(tx).to.emit(distributor, "DistributionClosed").withArgs(1, 0n);
    await expect(tx).not.to.emit(distributor, "DustSwept");
    expect((await distributor.distributions(1)).closed).to.equal(true);
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(0n);
  });

  it("ca 5: đổi claimWindow không đổi hạn kỳ cũ", async function () {
    const { distributor, investorA } = await loadFixture(profitFixture);
    await distributor.setClaimWindow(100);
    await distributor.createDistribution(100n, "A");
    const a = await distributor.distributions(0);
    expect(a.claimDeadline).to.equal(a.createdAt + 100n);
    await distributor.setClaimWindow(10);
    await distributor.createDistribution(100n, "B");
    const b = await distributor.distributions(1);
    expect(b.claimDeadline).to.equal(b.createdAt + 10n);
    expect((await distributor.distributions(0)).claimDeadline).to.equal(a.claimDeadline);
    await time.increaseTo(b.claimDeadline);
    await expect(distributor.connect(investorA).claim(1)).to.be.revertedWithCustomError(distributor, "ClaimWindowEnded");
    await expect(distributor.connect(investorA).claim(0)).not.to.be.reverted;
  });

  it("ca 6: hai kỳ mở, tự nhận và chia lô không trả trùng hay vượt quỹ", async function () {
    const { distributor, project, payout, investorA, investorB } = await loadFixture(profitFixture);
    await project.connect(investorA).transfer(investorB.address, 40n);
    await distributor.createDistribution(100n, "A");
    await project.connect(investorA).transfer(investorB.address, 10n);
    await distributor.createDistribution(200n, "B");
    await distributor.connect(investorA).claimMany([0, 1]);
    expect(await payout.balanceOf(investorA.address)).to.equal(160n);
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(140n);
    await distributor.distributeTo(0, [investorA.address, investorB.address]);
    await distributor.distributeTo(1, [investorA.address, investorB.address]);
    expect(await payout.balanceOf(investorB.address)).to.equal(140n);
    expect((await distributor.distributions(0)).claimed).to.equal(100n);
    expect((await distributor.distributions(1)).claimed).to.equal(200n);
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(0n);
  });
});
