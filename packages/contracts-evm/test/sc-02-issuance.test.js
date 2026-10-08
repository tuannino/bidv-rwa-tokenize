const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

describe("SC-02 - Phát hành EVM khóa theo ví SPV", function () {
  it("lần đầu ghi ví, cờ, số dư và phát đúng sự kiện", async function () {
    const { project, admin, investorA: spv } = await loadFixture(deploySpecFixture);
    await whitelist(project, admin, [spv]);

    await expect(project.connect(admin).mintInitialSupply(spv.address, 1_000n))
      .to.emit(project, "InitialSupplyMinted")
      .withArgs(spv.address, 1_000n, admin.address);

    expect(await project.spvWallet()).to.equal(spv.address);
    expect(await project.initialSupplyMinted()).to.equal(true);
    expect(await project.balanceOf(spv.address)).to.equal(1_000n);
    expect(await project.totalSupply()).to.equal(1_000n);
  });

  it("lần đầu chỉ chạy một lần, kể cả sau khi đốt hết", async function () {
    const { project, admin, investorA: spv } = await loadFixture(deploySpecFixture);
    await whitelist(project, admin, [spv]);
    await project.connect(admin).mintInitialSupply(spv.address, 100n);
    await project.connect(admin).agentBurn(spv.address, 100n);

    expect(await project.totalSupply()).to.equal(0n);
    expect(await project.initialSupplyMinted()).to.equal(true);
    await expect(project.connect(admin).mintInitialSupply(spv.address, 1n)).to.be.revertedWithCustomError(
      project,
      "InitialSupplyAlreadyMinted",
    );
  });

  it("mint thường bị chặn trước lần đầu và khi nhắm ví khác SPV", async function () {
    const { project, admin, investorA: spv, investorB } = await loadFixture(deploySpecFixture);
    await whitelist(project, admin, [spv, investorB]);

    await expect(project.connect(admin).mint(spv.address, 1n)).to.be.revertedWithCustomError(
      project,
      "InitialSupplyNotMinted",
    );
    await project.connect(admin).mintInitialSupply(spv.address, 100n);
    await expect(project.connect(admin).mint(investorB.address, 1n))
      .to.be.revertedWithCustomError(project, "MintTargetNotSpv")
      .withArgs(investorB.address, spv.address);

    await project.connect(admin).mint(spv.address, 25n);
    expect(await project.balanceOf(spv.address)).to.equal(125n);
  });

  it("thiếu MINTER_ROLE không được phát hành và không ghi cờ", async function () {
    const { project, outsider, investorA: spv } = await loadFixture(deploySpecFixture);

    await expect(project.connect(outsider).mintInitialSupply(spv.address, 1n)).to.be.revertedWithCustomError(
      project,
      "AccessControlUnauthorizedAccount",
    );
    expect(await project.initialSupplyMinted()).to.equal(false);
    expect(await project.spvWallet()).to.equal(ethers.ZeroAddress);
  });

  it("ví 0 và số lượng 0 bị chặn bằng custom error, không ghi cờ", async function () {
    const { project, admin, investorA: spv } = await loadFixture(deploySpecFixture);

    await expect(project.connect(admin).mintInitialSupply(ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(
      project,
      "ZeroAddress",
    );
    await expect(project.connect(admin).mintInitialSupply(spv.address, 0n)).to.be.revertedWithCustomError(
      project,
      "ZeroAmount",
    );
    expect(await project.initialSupplyMinted()).to.equal(false);
  });

  it("ví chưa whitelist bị hook chặn và hoàn nguyên ví/cờ", async function () {
    const { project, admin, investorA: spv } = await loadFixture(deploySpecFixture);

    await expect(project.connect(admin).mintInitialSupply(spv.address, 1n)).to.be.revertedWith(
      "phat hanh cho vi chua KYC",
    );
    expect(await project.initialSupplyMinted()).to.equal(false);
    expect(await project.spvWallet()).to.equal(ethers.ZeroAddress);
  });

  it("ví bị đóng băng bị hook chặn và hoàn nguyên ví/cờ", async function () {
    const { project, admin, investorA: spv } = await loadFixture(deploySpecFixture);
    await whitelist(project, admin, [spv]);
    await project.connect(admin).setFrozen(spv.address, true);

    await expect(project.connect(admin).mintInitialSupply(spv.address, 1n)).to.be.revertedWith(
      "ben nhan bi bang",
    );
    expect(await project.initialSupplyMinted()).to.equal(false);
    expect(await project.spvWallet()).to.equal(ethers.ZeroAddress);
  });

  it("token tạm dừng bị hook chặn và hoàn nguyên ví/cờ", async function () {
    const { project, admin, investorA: spv } = await loadFixture(deploySpecFixture);
    await whitelist(project, admin, [spv]);
    await project.connect(admin).setPaused(true);

    await expect(project.connect(admin).mintInitialSupply(spv.address, 1n)).to.be.revertedWith(
      "token dang tam dung",
    );
    expect(await project.initialSupplyMinted()).to.equal(false);
    expect(await project.spvWallet()).to.equal(ethers.ZeroAddress);
  });
});
