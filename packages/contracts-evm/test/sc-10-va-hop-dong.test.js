const { wptSupplyCap } = require("../../shared/src/token-parameters.json");
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
    // SC-06 QĐ-C: đóng kỳ thay quét; 100 của kỳ A ở lại hợp đồng, thành phần chưa phân bổ.
    await distributor.closeDistribution(0);
    await distributor.createDistribution(100n, "B");
    const claim = distributor.connect(investorA).claim(0);
    try {
      await claim;
      const a = await distributor.distributions(0);
      console.log(`REPRO: A claimed/amount=${a.claimed}/${a.amount}; B fund=${await payout.balanceOf(await distributor.getAddress())}`);
    } catch { /* Ca đã vá: kiểm đúng custom error bên dưới. */ }
    await expect(claim).to.be.revertedWithCustomError(distributor, "DistributionClosed").withArgs(0);
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(200n);
    expect(await distributor.totalReserved()).to.equal(100n);
    expect(await distributor.unallocatedBalance()).to.equal(100n);
    await distributor.connect(investorA).claim(1);
    expect(await payout.balanceOf(investorA.address)).to.equal(100n);
    expect((await distributor.distributions(1)).claimed).to.equal(100n);
  });

  it("ca 2: distributeTo kỳ đã đóng revert cả lô", async function () {
    const { distributor, payout, admin, investorA, investorB } = await loadFixture(profitFixture);
    await distributor.createDistribution(100n, "A");
    await time.increaseTo(await deadline(distributor, 0));
    await distributor.closeDistribution(0);
    await distributor.createDistribution(100n, "B");
    await expect(distributor.distributeTo(0, [investorA.address, investorB.address]))
      .to.be.revertedWithCustomError(distributor, "DistributionClosed");
    expect(await payout.balanceOf(investorA.address)).to.equal(0n);
    expect(await payout.balanceOf(investorB.address)).to.equal(0n);
    expect(await distributor.hasClaimed(0, investorA.address)).to.equal(false);
    // SC-06 QĐ-C: số dư không đổi (kỳ A không chuyển đi đâu), dự trữ chỉ còn kỳ B.
    expect(await payout.balanceOf(await distributor.getAddress())).to.equal(200n);
    expect(await distributor.totalReserved()).to.equal(100n);
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

  it("ca 4: đóng kỳ chỉ sau hạn, đóng một lần, kỳ đã chi hết vẫn đóng được", async function () {
    const { distributor, payout, investorA } = await loadFixture(profitFixture);
    const fund = await distributor.getAddress();
    await distributor.createDistribution(100n, "A");
    await expect(distributor.closeDistribution(0)).to.be.revertedWith("chua het han nhan");
    await time.setNextBlockTimestamp(await deadline(distributor, 0));
    // SC-06 QĐ-C: đóng kỳ không chuyển tiền; số dư giữ nguyên, dự trữ giảm, phần chưa phân bổ tăng.
    await expect(distributor.closeDistribution(0))
      .to.emit(distributor, "DistributionClosed").withArgs(0, 100n);
    expect(await payout.balanceOf(fund)).to.equal(100n);
    expect(await distributor.totalReserved()).to.equal(0n);
    expect(await distributor.unallocatedBalance()).to.equal(100n);
    expect((await distributor.distributions(0)).closed).to.equal(true);
    await expect(distributor.closeDistribution(0)).to.be.revertedWithCustomError(distributor, "DistributionClosed");

    await distributor.createDistribution(100n, "B");
    await distributor.connect(investorA).claim(1);
    await time.increaseTo(await deadline(distributor, 1));
    await expect(distributor.closeDistribution(1)).to.emit(distributor, "DistributionClosed").withArgs(1, 0n);
    expect((await distributor.distributions(1)).closed).to.equal(true);
    expect(await payout.balanceOf(fund)).to.equal(100n);
    expect(await distributor.totalReserved()).to.equal(0n);
    expect(await distributor.unallocatedBalance()).to.equal(100n);
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

async function holderFixture() {
  const f = await deploySpecFixture();
  await whitelist(f.project, f.admin, [f.admin, f.investorA, f.investorB, f.outsider]);
  const holders = await ethers.deployContract("HolderCountModule", [await f.project.getAddress(), await f.compliance.getAddress()]);
  await f.compliance.addModule(await holders.getAddress());
  return { ...f, holders };
}
async function expectHolderCount(f) {
  const balances = await Promise.all([f.admin, f.investorA, f.investorB, f.outsider].map((wallet) => f.project.balanceOf(wallet.address)));
  expect(await f.holders.holderCount()).to.equal(BigInt(balances.filter((balance) => balance > 0n).length));
}

describe("SC-10 - callbacks cưỡng chế", function () {
  it("ca 7: module đếm đúng sau mint, transfer, forcedTransfer, agent burn và batch", async function () {
    const f = await loadFixture(holderFixture);
    const { project, investorA, investorB, outsider, admin } = f;
    await project.mintInitialSupply(investorA.address, 100n); await expectHolderCount(f);
    await project.connect(investorA).transfer(investorB.address, 20n); await expectHolderCount(f);
    await project.forcedTransfer(investorA.address, outsider.address, 30n); await expectHolderCount(f);
    await project['burn(address,uint256)'](investorB.address, 20n); await expectHolderCount(f);
    await project.batchForcedTransfer([investorA.address, outsider.address], [investorB.address, admin.address], [10n, 10n]);
    await expectHolderCount(f);
    expect(await f.holders.holderCount()).to.equal(4n);
  });

  it("ca 8: RejectAll chặn đường thường, cưỡng chế bỏ kiểm nhưng vẫn báo module", async function () {
    const f = await loadFixture(holderFixture);
    const { project, compliance, registry, investorA, investorB } = f;
    await project.mintInitialSupply(investorA.address, 100n);
    const reject = await ethers.deployContract("RejectAllModule");
    await compliance.addModule(await reject.getAddress());
    await expect(project.connect(investorA).transfer(investorB.address, 10n))
      .to.be.revertedWithCustomError(project, "ComplianceRejected");
    await registry.deleteIdentity(investorA.address);
    await project.setAddressFrozen(investorA.address, true);
    await project.pause();
    await expect(project.forcedTransfer(investorA.address, investorB.address, 10n)).not.to.be.reverted;
    await expectHolderCount(f);
    await expect(project['burn(address,uint256)'](investorA.address, 90n)).not.to.be.reverted;
    await expectHolderCount(f);
    expect(await f.holders.holderCount()).to.equal(1n);
  });

  it("ca 9: chưa gắn bộ luật thì cưỡng chế revert ComplianceNotSet", async function () {
    const f = await deploySpecFixture();
    const project = await ethers.deployContract("ProjectToken", ["Unbound WPT", "WPT", 0, f.admin.address, wptSupplyCap]);
    await whitelist(f.project, f.admin, [f.investorA, f.investorB]);
    await project.setIdentityRegistry(await f.registry.getAddress());
    await expect(project.forcedTransfer(f.investorA.address, f.investorB.address, 0))
      .to.be.revertedWithCustomError(project, "ComplianceNotSet");
    await expect(project['burn(address,uint256)'](f.investorA.address, 0))
      .to.be.revertedWithCustomError(project, "ComplianceNotSet");
  });
});

describe("SC-10 - CH-1 cap cố định", function () {
  it("cap: lần đầu vượt trần bị chặn và không ghi mốc, đúng trần được phép", async function () {
    const { project, registry, investorA } = await deploySpecFixture();
    const cap = BigInt(wptSupplyCap);
    await registry.registerIdentity(investorA.address, 704);
    expect(await project.cap()).to.equal(cap);
    await expect(project.mintInitialSupply(investorA.address, cap + 1n))
      .to.be.revertedWithCustomError(project, "SupplyCapExceeded").withArgs(cap, 0, cap + 1n);
    expect(await project.initialSupplyMinted()).to.equal(false);
    expect(await project.spvWallet()).to.equal(ethers.ZeroAddress);
    expect(await project.totalSupply()).to.equal(0n);
    await project.mintInitialSupply(investorA.address, cap);
    expect(await project.totalSupply()).to.equal(cap);
  });

  it("cap: mint bổ sung không vượt trần, đốt rồi chỉ mint bù trong trần", async function () {
    const { project, registry, investorA } = await deploySpecFixture();
    const cap = BigInt(wptSupplyCap);
    await registry.registerIdentity(investorA.address, 704);
    await project.mintInitialSupply(investorA.address, cap - 10n);
    await project.mint(investorA.address, 10n);
    await expect(project.mint(investorA.address, 1n)).to.be.revertedWithCustomError(project, "SupplyCapExceeded");
    expect(await project.totalSupply()).to.equal(cap);
    await project['burn(address,uint256)'](investorA.address, 5n);
    await project.mint(investorA.address, 5n);
    expect(await project.totalSupply()).to.equal(cap);
    await expect(project.mintInitialSupply(investorA.address, 1n)).to.be.revertedWithCustomError(project, "InitialSupplyAlreadyMinted");
    await expect(project.mint(investorA.address, 1n)).to.be.revertedWithCustomError(project, "SupplyCapExceeded");
  });

  it("cap: không cho triển khai cap bằng 0", async function () {
    const [admin] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("ProjectToken");
    await expect(factory.deploy("WPT", "WPT", 0, admin.address, 0)).to.be.revertedWithCustomError(factory, "InvalidSupplyCap");
  });
});
