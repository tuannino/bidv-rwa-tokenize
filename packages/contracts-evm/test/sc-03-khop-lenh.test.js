const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

const PRICE = 100_000n;

function ref(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

async function signPermit(token, owner, spender, value, deadline) {
  const { buildPermitTypedData } = await import("../../shared/src/permit.js");
  const { chainId } = await ethers.provider.getNetwork();
  const typed = buildPermitTypedData({
    tokenName: await token.name(), version: (await token.eip712Domain()).version, chainId, verifyingContract: await token.getAddress(),
    owner: owner.address, spender, value, nonce: await token.nonces(owner.address), deadline,
  });
  return ethers.Signature.from(await owner.signTypedData(typed.domain, typed.types, typed.message));
}

async function deployFixture() {
  const f = await deploySpecFixture();
  const vault = await ethers.deployContract("SpvPaymentVault", [
    await f.project.getAddress(), await f.payout.getAddress(), f.admin.address,
  ]);
  await vault.waitForDeployment();
  await whitelist(f.project, f.admin, [await vault.getAddress(), f.investorA, f.investorB, f.outsider]);
  await f.project.mintInitialSupply(await vault.getAddress(), 10_000n);
  const settlement = await ethers.deployContract("OrderSettlement", [
    await vault.getAddress(), f.admin.address, PRICE,
  ]);
  await settlement.waitForDeployment();
  await vault.grantRole(await vault.MATCHER_ROLE(), await settlement.getAddress());
  for (const role of ["OPERATOR_ROLE", "PRICE_ROLE", "PAUSER_ROLE"]) {
    await settlement.grantRole(await settlement[role](), f.admin.address);
  }
  return { ...f, vault, settlement };
}

async function fundBuy(f, investor, amount) {
  const cost = amount * PRICE;
  await f.payout.mint(investor.address, cost);
  await f.payout.connect(investor).approve(await f.settlement.getAddress(), cost);
}

async function giveWpt(f, investor, amount) {
  await f.project.forcedTransfer(await f.vault.getAddress(), investor.address, amount);
  await f.project.connect(investor).approve(await f.settlement.getAddress(), amount);
}

describe("SC-03 - OrderSettlement", function () {
  it("ca 1: triển khai nối đúng vault, token, giá và matcher duy nhất", async function () {
    const f = await loadFixture(deployFixture);
    expect(await f.settlement.vault()).to.equal(await f.vault.getAddress());
    expect(await f.settlement.projectToken()).to.equal(await f.project.getAddress());
    expect(await f.settlement.paymentToken()).to.equal(await f.payout.getAddress());
    expect(await f.settlement.price()).to.equal(PRICE);
    expect(await f.vault.getRoleMemberCount(await f.vault.MATCHER_ROLE())).to.equal(1n);
    expect(await f.vault.getRoleMember(await f.vault.MATCHER_ROLE(), 0n)).to.equal(await f.settlement.getAddress());
    await expect(ethers.deployContract("OrderSettlement", [await f.vault.getAddress(), f.admin.address, 0n]))
      .to.be.revertedWithCustomError(f.settlement, "ZeroPrice");
  });

  it("ca 2: mua chuyển đủ hai chân, chỉ vault phát OrderSettled và matcher không giữ tiền", async function () {
    const f = await loadFixture(deployFixture);
    await fundBuy(f, f.investorA, 100n);
    const orderRef = ref("buy-ok");
    await expect(f.settlement.buy(orderRef, f.investorA.address, 100n, 10_000_000n))
      .to.emit(f.vault, "OrderSettled").withArgs(orderRef, f.investorA.address, 0n, 100n, 10_000_000n, PRICE);
    expect(await f.payout.balanceOf(f.investorA.address)).to.equal(0n);
    expect(await f.payout.balanceOf(await f.vault.getAddress())).to.equal(10_000_000n);
    expect(await f.project.balanceOf(f.investorA.address)).to.equal(100n);
    expect(await f.project.balanceOf(await f.vault.getAddress())).to.equal(9_900n);
    expect(await f.payout.balanceOf(await f.settlement.getAddress())).to.equal(0n);
    expect(await f.project.balanceOf(await f.settlement.getAddress())).to.equal(0n);
  });

  it("ca 3: bán chuyển đủ hai chân và giảm thu ròng", async function () {
    const f = await loadFixture(deployFixture);
    await fundBuy(f, f.investorA, 100n);
    await f.settlement.buy(ref("buy-before-sell"), f.investorA.address, 100n, 10_000_000n);
    await f.project.connect(f.investorA).approve(await f.settlement.getAddress(), 40n);
    await f.settlement.sell(ref("sell-ok"), f.investorA.address, 40n, 4_000_000n);
    expect(await f.project.balanceOf(f.investorA.address)).to.equal(60n);
    expect(await f.payout.balanceOf(f.investorA.address)).to.equal(4_000_000n);
    expect(await f.vault.netProceeds()).to.equal(6_000_000n);
  });

  it("ca 4: giá đổi giữa đặt và khớp bị từ chối trước khi chuyển", async function () {
    const f = await loadFixture(deployFixture);
    await fundBuy(f, f.investorA, 100n);
    await f.settlement.setPrice(110_000n);
    await expect(f.settlement.buy(ref("old-price"), f.investorA.address, 100n, 10_000_000n))
      .to.be.revertedWithCustomError(f.settlement, "PriceMismatch").withArgs(11_000_000n, 10_000_000n);
    expect(await f.payout.balanceOf(f.investorA.address)).to.equal(10_000_000n);
  });

  it("ca 5: đổi giá cần vai, cấm zero và phát đúng sự kiện", async function () {
    const f = await loadFixture(deployFixture);
    await expect(f.settlement.setPrice(110_000n)).to.emit(f.settlement, "PriceSet")
      .withArgs(PRICE, 110_000n, f.admin.address);
    await expect(f.settlement.setPrice(0n)).to.be.revertedWithCustomError(f.settlement, "ZeroPrice");
    await expect(f.settlement.connect(f.outsider).setPrice(1n))
      .to.be.revertedWithCustomError(f.settlement, "AccessControlUnauthorizedAccount");
  });

  it("ca 6: gửi lại mua, mua permit và bán đều báo OrderAlreadySettled đầu tiên", async function () {
    const f = await loadFixture(deployFixture);
    await fundBuy(f, f.investorA, 100n);
    const buyRef = ref("duplicate-buy");
    await f.settlement.buy(buyRef, f.investorA.address, 100n, 10_000_000n);
    await expect(f.settlement.buy(buyRef, f.investorA.address, 100n, 10_000_000n))
      .to.be.revertedWithCustomError(f.settlement, "OrderAlreadySettled").withArgs(buyRef);

    await f.payout.mint(f.investorB.address, PRICE);
    const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    const sig = await signPermit(f.payout, f.investorB, await f.settlement.getAddress(), PRICE, now + 3600n);
    const permitRef = ref("duplicate-permit");
    const permit = [PRICE, now + 3600n, sig.v, sig.r, sig.s];
    await f.settlement.buyWithPermit(permitRef, f.investorB.address, 1n, PRICE, permit);
    await expect(f.settlement.buyWithPermit(permitRef, f.investorB.address, 1n, PRICE, permit))
      .to.be.revertedWithCustomError(f.settlement, "OrderAlreadySettled").withArgs(permitRef);

    await f.project.connect(f.investorA).approve(await f.settlement.getAddress(), 1n);
    await f.settlement.sell(ref("sell-once"), f.investorA.address, 1n, PRICE);
    await expect(f.settlement.sell(ref("sell-once"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.settlement, "OrderAlreadySettled").withArgs(ref("sell-once"));
  });

  it("ca 7: bốn lỗi chiều mua hoàn nguyên cả hai chân", async function () {
    const f = await loadFixture(deployFixture);
    const settlementAddress = await f.settlement.getAddress();
    const vaultAddress = await f.vault.getAddress();
    const unverified = (await ethers.getSigners())[8];
    await f.payout.mint(unverified.address, PRICE);
    await f.payout.connect(unverified).approve(settlementAddress, PRICE);
    await expect(f.settlement.buy(ref("unverified"), unverified.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.project, "IdentityNotVerified");
    await f.payout.mint(f.investorA.address, PRICE);
    await expect(f.settlement.buy(ref("no-allowance"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.payout, "ERC20InsufficientAllowance");
    await f.payout.connect(f.investorA).approve(settlementAddress, PRICE);
    await f.payout.burn(f.investorA.address, PRICE);
    await expect(f.settlement.buy(ref("no-balance"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.payout, "ERC20InsufficientBalance");
    await f.project.forcedTransfer(vaultAddress, f.outsider.address, 10_000n);
    await fundBuy(f, f.investorA, 1n);
    const emptyRef = ref("empty-vault");
    await expect(f.settlement.buy(emptyRef, f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.project, "InsufficientUnfrozenTokens");
    expect(await f.vault.isOrderSettled(emptyRef)).to.equal(false);
    expect(await f.payout.balanceOf(vaultAddress)).to.equal(0n);
  });

  it("ca 8: bốn lỗi chiều bán hoàn nguyên cả hai chân", async function () {
    const f = await loadFixture(deployFixture);
    const vaultAddress = await f.vault.getAddress();
    await giveWpt(f, f.investorA, 4n);
    await f.project.setAddressFrozen(f.investorA.address, true);
    await expect(f.settlement.sell(ref("frozen"), f.investorA.address, 1n, PRICE)).to.be.reverted;
    await f.project.setAddressFrozen(f.investorA.address, false);
    await f.project.connect(f.investorA).approve(await f.settlement.getAddress(), 0n);
    await expect(f.settlement.sell(ref("no-wpt-allowance"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.project, "ERC20InsufficientAllowance");
    await f.project.connect(f.investorA).approve(await f.settlement.getAddress(), 4n);
    await expect(f.settlement.sell(ref("no-vndb"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.payout, "ERC20InsufficientBalance");
    const reject = await ethers.deployContract("RejectAllModule");
    await f.compliance.addModule(await reject.getAddress());
    await f.payout.mint(vaultAddress, PRICE);
    const rejectRef = ref("reject-module");
    await expect(f.settlement.sell(rejectRef, f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.project, "ComplianceRejected");
    expect(await f.vault.isOrderSettled(rejectRef)).to.equal(false);
  });

  it("ca 9: phần khoá lớn hơn số dư không chặn bán lại", async function () {
    const f = await loadFixture(deployFixture);
    await giveWpt(f, f.investorA, 1n);
    await f.vault.grantRole(await f.vault.CONFIG_ROLE(), f.admin.address);
    await f.vault.setFixedLock(1_000_000n);
    await f.vault.setLockMode(1);
    await f.payout.mint(await f.vault.getAddress(), PRICE);
    await expect(f.settlement.sell(ref("fixed-lock"), f.investorA.address, 1n, PRICE)).not.to.be.reverted;
  });

  it("ca 10: permit VNDB chạy, ràng buộc value và bỏ qua permit đã dùng", async function () {
    const f = await loadFixture(deployFixture);
    const settlementAddress = await f.settlement.getAddress();
    const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    await f.payout.mint(f.investorA.address, PRICE * 3n);
    const sig = await signPermit(f.payout, f.investorA, settlementAddress, PRICE, now + 3600n);
    await f.settlement.buyWithPermit(ref("permit-buy"), f.investorA.address, 1n, PRICE,
      [PRICE, now + 3600n, sig.v, sig.r, sig.s]);
    const mismatch = await signPermit(f.payout, f.investorA, settlementAddress, PRICE + 1n, now + 3600n);
    await expect(f.settlement.buyWithPermit(ref("permit-mismatch"), f.investorA.address, 1n, PRICE,
      [PRICE + 1n, now + 3600n, mismatch.v, mismatch.r, mismatch.s]))
      .to.be.revertedWithCustomError(f.settlement, "PermitValueMismatch").withArgs(PRICE, PRICE + 1n);
    const sent = await signPermit(f.payout, f.investorA, settlementAddress, PRICE, now + 3600n);
    await f.payout.permit(f.investorA.address, settlementAddress, PRICE, now + 3600n, sent.v, sent.r, sent.s);
    await f.settlement.buyWithPermit(ref("permit-pre-sent"), f.investorA.address, 1n, PRICE,
      [PRICE, now + 3600n, sent.v, sent.r, sent.s]);
    const expired = await signPermit(f.payout, f.investorA, settlementAddress, PRICE, now - 1n);
    await expect(f.settlement.buyWithPermit(ref("permit-expired"), f.investorA.address, 1n, PRICE,
      [PRICE, now - 1n, expired.v, expired.r, expired.s]))
      .to.be.revertedWithCustomError(f.payout, "ERC20InsufficientAllowance");
  });

  it("ca 11: permit WPT chạy và chữ ký gửi trước vẫn dùng được", async function () {
    const f = await loadFixture(deployFixture);
    const settlementAddress = await f.settlement.getAddress();
    await f.project.forcedTransfer(await f.vault.getAddress(), f.investorA.address, 2n);
    await f.payout.mint(await f.vault.getAddress(), PRICE * 2n);
    const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
    const first = await signPermit(f.project, f.investorA, settlementAddress, 1n, now + 3600n);
    await f.settlement.sellWithPermit(ref("permit-sell"), f.investorA.address, 1n, PRICE,
      [1n, now + 3600n, first.v, first.r, first.s]);
    const sent = await signPermit(f.project, f.investorA, settlementAddress, 1n, now + 3600n);
    await f.project.permit(f.investorA.address, settlementAddress, 1n, now + 3600n, sent.v, sent.r, sent.s);
    await f.settlement.sellWithPermit(ref("permit-sell-pre-sent"), f.investorA.address, 1n, PRICE,
      [1n, now + 3600n, sent.v, sent.r, sent.s]);
  });

  it("ca 12: pause chặn bốn đường lệnh nhưng không chặn giá hay vault", async function () {
    const f = await loadFixture(deployFixture);
    await f.vault.grantRole(await f.vault.WITHDRAWER_ROLE(), f.admin.address);
    await f.vault.setPayoutWallet(f.outsider.address);
    await f.vault.grantRole(await f.vault.CONFIG_ROLE(), f.admin.address);
    await f.vault.setFixedLock(0n);
    await f.vault.setLockMode(1);
    await f.payout.mint(await f.vault.getAddress(), 1n);
    await f.settlement.pause();
    const dummy = [0n, 0n, 0, ethers.ZeroHash, ethers.ZeroHash];
    for (const call of [
      () => f.settlement.buy(ref("paused-buy"), f.investorA.address, 1n, PRICE),
      () => f.settlement.sell(ref("paused-sell"), f.investorA.address, 1n, PRICE),
      () => f.settlement.buyWithPermit(ref("paused-buy-p"), f.investorA.address, 1n, PRICE, dummy),
      () => f.settlement.sellWithPermit(ref("paused-sell-p"), f.investorA.address, 1n, PRICE, dummy),
    ]) await expect(call()).to.be.revertedWithCustomError(f.settlement, "EnforcedPause");
    await expect(f.settlement.setPrice(PRICE + 1n)).not.to.be.reverted;
    await expect(f.vault.withdraw(1n)).not.to.be.reverted;
    await f.settlement.unpause();
  });

  it("ca 13: bốn đường lệnh và pause đều bị chặn đúng vai", async function () {
    const f = await loadFixture(deployFixture);
    const s = f.settlement.connect(f.outsider);
    const dummy = [0n, 0n, 0, ethers.ZeroHash, ethers.ZeroHash];
    for (const call of [
      () => s.buy(ref("role-buy"), f.investorA.address, 1n, PRICE),
      () => s.sell(ref("role-sell"), f.investorA.address, 1n, PRICE),
      () => s.buyWithPermit(ref("role-buy-p"), f.investorA.address, 1n, PRICE, dummy),
      () => s.sellWithPermit(ref("role-sell-p"), f.investorA.address, 1n, PRICE, dummy),
      () => s.pause(),
    ]) await expect(call()).to.be.revertedWithCustomError(f.settlement, "AccessControlUnauthorizedAccount");
  });

  it("ca 14: thay phiên bản giữ dấu orderRef ở vault", async function () {
    const f = await loadFixture(deployFixture);
    await fundBuy(f, f.investorA, 1n);
    const oldRef = ref("v1-order");
    await f.settlement.buy(oldRef, f.investorA.address, 1n, PRICE);
    await f.settlement.pause();
    await f.vault.revokeRole(await f.vault.MATCHER_ROLE(), await f.settlement.getAddress());
    const v2 = await ethers.deployContract("OrderSettlement", [await f.vault.getAddress(), f.admin.address, PRICE]);
    await v2.waitForDeployment();
    await f.vault.grantRole(await f.vault.MATCHER_ROLE(), await v2.getAddress());
    await v2.grantRole(await v2.OPERATOR_ROLE(), f.admin.address);
    await expect(f.settlement.buy(ref("paused-v1"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.settlement, "EnforcedPause");
    await expect(v2.buy(oldRef, f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(v2, "OrderAlreadySettled").withArgs(oldRef);
    await f.payout.mint(f.investorA.address, PRICE);
    await f.payout.connect(f.investorA).approve(await v2.getAddress(), PRICE);
    await expect(v2.buy(ref("v2-order"), f.investorA.address, 1n, PRICE)).not.to.be.reverted;
  });

  it("ca 15: module gọi lồng sell bị đúng ReentrancyGuardReentrantCall", async function () {
    const f = await loadFixture(deployFixture);
    await giveWpt(f, f.investorA, 2n);
    await f.payout.mint(await f.vault.getAddress(), PRICE * 2n);
    const module = await ethers.deployContract("ReentrantSettlementModule", [await f.settlement.getAddress()]);
    await module.waitForDeployment();
    await f.compliance.addModule(await module.getAddress());
    await f.settlement.grantRole(await f.settlement.OPERATOR_ROLE(), await module.getAddress());
    const nestedRef = ref("nested-sell");
    await module.arm(nestedRef, f.investorA.address, 1n, PRICE);
    await expect(f.settlement.sell(ref("outer-sell"), f.investorA.address, 1n, PRICE))
      .to.be.revertedWithCustomError(f.settlement, "ReentrancyGuardReentrantCall");
    expect(await f.vault.isOrderSettled(nestedRef)).to.equal(false);
  });
});
