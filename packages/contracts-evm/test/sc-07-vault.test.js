const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

const PRICE = 100_000n;
const BPS_DENOMINATOR = 10_000n;

function orderRef(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

async function deployVaultFixture() {
  const f = await deploySpecFixture();
  const vault = await ethers.deployContract("SpvPaymentVault", [
    await f.project.getAddress(),
    await f.payout.getAddress(),
    f.admin.address,
  ]);
  await vault.waitForDeployment();
  await whitelist(f.project, f.admin, [
    await vault.getAddress(),
    f.investorA,
    f.investorB,
    f.outsider,
  ]);
  await f.project.mintInitialSupply(await vault.getAddress(), 10_000n);
  await vault.grantRole(await vault.MATCHER_ROLE(), f.admin.address);
  await vault.grantRole(await vault.CONFIG_ROLE(), f.admin.address);
  await vault.grantRole(await vault.WITHDRAWER_ROLE(), f.admin.address);
  await vault.grantRole(await vault.PAUSER_ROLE(), f.admin.address);
  return { ...f, vault };
}

async function incomingBuy(f, label, investor, wptAmount, price = PRICE) {
  const vndbAmount = wptAmount * price;
  await f.payout.mint(await f.vault.getAddress(), vndbAmount);
  await f.vault.settleBuy(orderRef(label), investor.address, wptAmount, vndbAmount, price);
}

async function outgoingSell(f, label, investor, wptAmount, price = PRICE) {
  const vndbAmount = wptAmount * price;
  await f.project.connect(f.admin).forcedTransfer(investor.address, await f.vault.getAddress(), wptAmount);
  await f.vault.settleSell(orderRef(label), investor.address, wptAmount, vndbAmount, price);
}

describe("SC-07 - SpvPaymentVault: luật khoá và quyết toán", function () {
  it("ca 1: triển khai an toàn ở UNSET và chưa cấp matcher", async function () {
    const f = await deploySpecFixture();
    const vault = await ethers.deployContract("SpvPaymentVault", [
      await f.project.getAddress(), await f.payout.getAddress(), f.admin.address,
    ]);
    await f.payout.mint(await vault.getAddress(), 123n);
    expect(await vault.projectToken()).to.equal(await f.project.getAddress());
    expect(await vault.paymentToken()).to.equal(await f.payout.getAddress());
    expect(await vault.lockMode()).to.equal(0n);
    expect(await vault.lockedAmount()).to.equal(123n);
    expect(await vault.withdrawable()).to.equal(0n);
    expect(await vault.hasRole(await vault.DEFAULT_ADMIN_ROLE(), f.admin.address)).to.equal(true);
    expect(await vault.getRoleMemberCount(await vault.MATCHER_ROLE())).to.equal(0n);
  });

  it("ca 2: PERCENT kỳ đầu bám theo thu ròng sau từng lệnh", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setPercentRate(2_000);
    await f.vault.setLockMode(2);
    await incomingBuy(f, "buy-1000", f.investorA, 1_000n);
    expect(await f.vault.netProceeds()).to.equal(100_000_000n);
    expect(await f.vault.lockedAmount()).to.equal(20_000_000n);
    await outgoingSell(f, "sell-300", f.investorA, 300n);
    expect(await f.vault.netProceeds()).to.equal(70_000_000n);
    expect(await f.vault.lockedAmount()).to.equal(14_000_000n);
    expect(await f.vault.withdrawable()).to.equal(56_000_000n);
  });

  it("ca 3: thu ròng dừng ở 0 thay vì âm", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setPercentRate(2_000);
    await f.vault.setLockMode(2);
    await incomingBuy(f, "buy-base", f.investorA, 1_000n);
    await outgoingSell(f, "sell-base", f.investorA, 300n);
    await f.project.forcedTransfer(await f.vault.getAddress(), f.investorA.address, 100n);
    await f.payout.mint(await f.vault.getAddress(), 20_000_000n);
    await outgoingSell(f, "sell-over", f.investorA, 800n);
    expect(await f.vault.netProceeds()).to.equal(0n);
    expect(await f.vault.lockedAmount()).to.equal(0n);
  });

  it("ca 4: FIXED không chặn mua lại và số rút được chặn ở 0", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setFixedLock(50_000_000n);
    await f.vault.setLockMode(1);
    await f.payout.mint(await f.vault.getAddress(), 60_000_000n);
    await f.project.forcedTransfer(await f.vault.getAddress(), f.investorA.address, 300n);
    await outgoingSell(f, "fixed-sell", f.investorA, 200n);
    expect(await f.payout.balanceOf(await f.vault.getAddress())).to.equal(40_000_000n);
    expect(await f.vault.lockedAmount()).to.equal(50_000_000n);
    expect(await f.vault.withdrawable()).to.equal(0n);
    await f.vault.setPayoutWallet(f.outsider.address);
    await expect(f.vault.withdraw(1n)).to.be.revertedWithCustomError(f.vault, "ExceedsWithdrawable")
      .withArgs(1n, 0n);
    await incomingBuy(f, "fixed-buy", f.investorA, 100n);
    expect(await f.vault.withdrawable()).to.equal(0n);
    await f.payout.mint(await f.vault.getAddress(), 1n);
    expect(await f.vault.withdrawable()).to.equal(1n);
  });

  it("ca 5: chốt kỳ lưu phần khoá và không đổi sau lệnh mới", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setPercentRate(2_000);
    await f.vault.setLockMode(2);
    await expect(f.vault.closePeriod(1n, 50_000_000n))
      .to.emit(f.vault, "PeriodClosed")
      .withArgs(1n, 50_000_000n, 2_000n, 10_000_000n, f.admin.address);
    await incomingBuy(f, "after-close", f.investorA, 100n);
    expect(await f.vault.lockedAmount()).to.equal(10_000_000n);
  });

  it("ca 6: tỷ lệ sau chốt chỉ áp ở kỳ tiếp theo", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setPercentRate(2_000);
    await f.vault.setLockMode(2);
    await f.vault.closePeriod(1n, 50_000_000n);
    await expect(f.vault.setPercentRate(3_000)).to.emit(f.vault, "PercentRateSet").withArgs(3_000n, true);
    expect(await f.vault.percentRateBps()).to.equal(2_000n);
    expect(await f.vault.pendingPercentRateBps()).to.equal(3_000n);
    expect(await f.vault.hasPendingRate()).to.equal(true);
    await f.vault.closePeriod(2n, 40_000_000n);
    expect(await f.vault.percentRateBps()).to.equal(3_000n);
    expect(await f.vault.percentLocked()).to.equal(12_000_000n);
    expect(await f.vault.hasPendingRate()).to.equal(false);
  });

  it("ca 7: trước lần chốt đầu tỷ lệ mới có hiệu lực ngay", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setPercentRate(2_000);
    await f.vault.setLockMode(2);
    await incomingBuy(f, "first-period", f.investorA, 1_000n);
    expect(await f.vault.lockedAmount()).to.equal(20_000_000n);
    await f.vault.setPercentRate(1_000);
    expect(await f.vault.percentRateBps()).to.equal(1_000n);
    expect(await f.vault.lockedAmount()).to.equal(10_000_000n);
  });

  it("ca 8: FIXED hiệu lực ngay và không thể quay về UNSET", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setFixedLock(7n);
    await f.vault.setPercentRate(5_000);
    await incomingBuy(f, "switch", f.investorA, 1n, 10n);
    await f.vault.setLockMode(1);
    expect(await f.vault.lockedAmount()).to.equal(7n);
    await f.vault.setLockMode(2);
    expect(await f.vault.lockedAmount()).to.equal(5n);
    await f.vault.setFixedLock(9n);
    await f.vault.setLockMode(1);
    expect(await f.vault.lockedAmount()).to.equal(9n);
    await expect(f.vault.setLockMode(0)).to.be.revertedWithCustomError(f.vault, "InvalidLockMode");
  });

  it("ca 9: mã kỳ tuần tự ở mọi chế độ", async function () {
    const f = await loadFixture(deployVaultFixture);
    await expect(f.vault.closePeriod(2n, 0n)).to.be.revertedWithCustomError(f.vault, "InvalidPeriodRef")
      .withArgs(1n, 2n);
    await f.vault.closePeriod(1n, 0n);
    await expect(f.vault.closePeriod(1n, 0n)).to.be.revertedWithCustomError(f.vault, "InvalidPeriodRef")
      .withArgs(2n, 1n);
    await f.vault.setLockMode(1);
    await f.vault.closePeriod(2n, 10n);
    expect(await f.vault.lastPeriodRef()).to.equal(2n);
  });

  it("ca 10: tỷ lệ tối đa và mulDiv xử lý số lớn", async function () {
    const f = await loadFixture(deployVaultFixture);
    await expect(f.vault.setPercentRate(10_001)).to.be.revertedWithCustomError(f.vault, "RateTooHigh")
      .withArgs(10_001n);
    await f.vault.setPercentRate(BPS_DENOMINATOR);
    const huge = 1n << 255n;
    await f.vault.closePeriod(1n, huge);
    expect(await f.vault.percentLocked()).to.equal(huge);
  });

  it("ca 11: orderRef dùng đúng một lần cho cả hai chiều", async function () {
    const f = await loadFixture(deployVaultFixture);
    const ref = orderRef("same-order");
    expect(await f.vault.isOrderSettled(ref)).to.equal(false);
    await f.payout.mint(await f.vault.getAddress(), PRICE);
    await f.vault.settleBuy(ref, f.investorA.address, 1n, PRICE, PRICE);
    expect(await f.vault.isOrderSettled(ref)).to.equal(true);
    await expect(f.vault.settleSell(ref, f.investorA.address, 1n, PRICE, PRICE))
      .to.be.revertedWithCustomError(f.vault, "OrderAlreadySettled").withArgs(ref);
    await expect(f.vault.settleBuy(ethers.ZeroHash, f.investorA.address, 1n, PRICE, PRICE))
      .to.be.revertedWithCustomError(f.vault, "ZeroOrderRef");
  });

  it("ca 12: số lượng, giá và thành tiền phải khớp", async function () {
    const f = await loadFixture(deployVaultFixture);
    for (const side of ["settleBuy", "settleSell"]) {
      await expect(f.vault[side](orderRef(`${side}-price`), f.investorA.address, 1n, 0n, 0n))
        .to.be.revertedWithCustomError(f.vault, "ZeroPrice");
      await expect(f.vault[side](orderRef(`${side}-amount`), f.investorA.address, 0n, 0n, PRICE))
        .to.be.revertedWithCustomError(f.vault, "ZeroAmount");
      await expect(f.vault[side](orderRef(`${side}-mismatch`), f.investorA.address, 2n, PRICE, PRICE))
        .to.be.revertedWithCustomError(f.vault, "AmountPriceMismatch")
        .withArgs(2n, PRICE, PRICE);
    }
    expect(await f.project.balanceOf(f.investorA.address)).to.equal(0n);
  });

  it("ca 13: mọi hàm ghi được chặn đúng vai", async function () {
    const f = await loadFixture(deployVaultFixture);
    const v = f.vault.connect(f.outsider);
    const calls = [
      () => v.settleBuy(orderRef("role-buy"), f.investorA.address, 1n, PRICE, PRICE),
      () => v.settleSell(orderRef("role-sell"), f.investorA.address, 1n, PRICE, PRICE),
      () => v.setLockMode(1),
      () => v.setFixedLock(1n),
      () => v.setPercentRate(1n),
      () => v.closePeriod(1n, 1n),
      () => v.withdraw(1n),
      () => v.pauseWithdrawals(),
      () => v.setPayoutWallet(f.investorA.address),
    ];
    for (const call of calls) await expect(call()).to.be.revertedWithCustomError(f.vault, "AccessControlUnauthorizedAccount");
  });

  it("ca 14: chỉ rút phần được phép tới ví nhận đã xác minh", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setFixedLock(40n);
    await f.vault.setLockMode(1);
    await f.payout.mint(await f.vault.getAddress(), 100n);
    await expect(f.vault.withdraw(1n)).to.be.revertedWithCustomError(f.vault, "PayoutWalletNotSet");
    const unverified = (await ethers.getSigners())[8];
    await expect(f.vault.setPayoutWallet(unverified.address))
      .to.be.revertedWithCustomError(f.vault, "PayoutWalletNotVerified").withArgs(unverified.address);
    await f.vault.setPayoutWallet(f.outsider.address);
    await expect(f.vault.withdraw(61n)).to.be.revertedWithCustomError(f.vault, "ExceedsWithdrawable")
      .withArgs(61n, 60n);
    await expect(f.vault.withdraw(60n)).to.emit(f.vault, "Withdrawn")
      .withArgs(f.outsider.address, 60n, f.admin.address);
    expect(await f.payout.balanceOf(f.outsider.address)).to.equal(60n);
  });

  it("ca 15: pause chỉ chặn rút, không chặn quyết toán và chốt kỳ", async function () {
    const f = await loadFixture(deployVaultFixture);
    await f.vault.setPayoutWallet(f.outsider.address);
    await f.vault.setFixedLock(0n);
    await f.vault.setLockMode(1);
    await f.payout.mint(await f.vault.getAddress(), PRICE + 1n);
    await expect(f.vault.pauseWithdrawals()).to.emit(f.vault, "Paused").withArgs(f.admin.address);
    await expect(f.vault.withdraw(1n)).to.be.revertedWithCustomError(f.vault, "EnforcedPause");
    await f.vault.settleBuy(orderRef("paused-buy"), f.investorA.address, 1n, PRICE, PRICE);
    await f.vault.closePeriod(1n, PRICE);
    await f.project.connect(f.investorA).transfer(await f.vault.getAddress(), 1n);
    await f.vault.settleSell(orderRef("paused-sell"), f.investorA.address, 1n, PRICE, PRICE);
    await expect(f.vault.unpauseWithdrawals()).to.emit(f.vault, "Unpaused").withArgs(f.admin.address);
    await expect(f.vault.withdraw(1n)).not.to.be.reverted;
  });
});
