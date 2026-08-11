const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFullSuite, onboardInvestor } = require("../scripts/deploy-lib");

describe("ERC-3643 (T-REX) — bộ thật của Tokeny", function () {
  this.timeout(120000);
  let deployer, tokenIssuer, claimIssuer, alice, bob, mallory;
  let suite, token, ir;

  before(async () => {
    [deployer, tokenIssuer, claimIssuer, alice, bob, mallory] = await ethers.getSigners();
    suite = await deployFullSuite({ deployer, tokenIssuer, claimIssuer }, { name: "Solar Project Token", symbol: "SPT", decimals: 0 });
    token = suite.token;
    ir = suite.identityRegistry;
    // Token deploy ở trạng thái paused => agent mở khoá để giao dịch được
    await (await token.connect(tokenIssuer).unpause()).wait();
  });

  it("deploy đủ 6 thành phần và token là ERC-20 hợp lệ", async () => {
    expect(await token.name()).to.equal("Solar Project Token");
    expect(await token.symbol()).to.equal("SPT");
    expect(await token.decimals()).to.equal(0);
    expect(suite.addresses.identityRegistry).to.properAddress;
    expect(suite.addresses.compliance).to.properAddress;
  });

  it("chỉ nhà đầu tư đã KYC (isVerified) mới nhận được mint", async () => {
    // Chưa onboard => chưa verified => mint phải revert
    expect(await ir.isVerified(alice.address)).to.equal(false);
    await expect(token.connect(tokenIssuer).mint(alice.address, 1000)).to.be.reverted;

    // Onboard Alice & Bob
    await onboardInvestor(suite, tokenIssuer, claimIssuer, alice);
    await onboardInvestor(suite, tokenIssuer, claimIssuer, bob);
    expect(await ir.isVerified(alice.address)).to.equal(true);
    expect(await ir.isVerified(bob.address)).to.equal(true);

    await (await token.connect(tokenIssuer).mint(alice.address, 6000)).wait();
    await (await token.connect(tokenIssuer).mint(bob.address, 4000)).wait();
    expect(await token.balanceOf(alice.address)).to.equal(6000);
    expect(await token.totalSupply()).to.equal(10000);
  });

  it("transfer giữa hai nhà đầu tư đã KYC thì được, sang ví lạ thì bị chặn", async () => {
    await (await token.connect(alice).transfer(bob.address, 1000)).wait();
    expect(await token.balanceOf(bob.address)).to.equal(5000);

    // Mallory chưa KYC => nhận token bị chặn bởi IdentityRegistry
    await expect(token.connect(alice).transfer(mallory.address, 100)).to.be.reverted;
  });

  it("agent đóng băng ví và thu hồi (forcedTransfer) — đúng quyền lực compliance ERC-3643", async () => {
    // Đóng băng Bob: Bob không chuyển đi được
    await (await token.connect(tokenIssuer).setAddressFrozen(bob.address, true)).wait();
    await expect(token.connect(bob).transfer(alice.address, 1)).to.be.reverted;

    // Gỡ băng rồi thu hồi cưỡng bức 500 từ Bob về Alice (kịch bản toà án/khôi phục)
    await (await token.connect(tokenIssuer).setAddressFrozen(bob.address, false)).wait();
    const bobBefore = await token.balanceOf(bob.address);
    await (await token.connect(tokenIssuer).forcedTransfer(bob.address, alice.address, 500)).wait();
    expect(await token.balanceOf(bob.address)).to.equal(bobBefore - 500n);
  });

  it("burn bởi agent giảm tổng cung (dùng cho hoàn vốn/redemption)", async () => {
    const supplyBefore = await token.totalSupply();
    await (await token.connect(tokenIssuer).burn(alice.address, 500)).wait();
    expect(await token.totalSupply()).to.equal(supplyBefore - 500n);
  });
});
