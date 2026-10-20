const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");
const { wptSupplyCap } = require("../../shared/src/token-parameters.json");

/**
 * SC-06: ProfitDistributor là quỹ chia một chiều (QĐ-A đến QĐ-C, spec docs/sc-06-chia-loi-nhuan).
 *
 * Fixture dùng ProfitDistributor GỐC (không phải bản oracle) vì đây là hợp đồng deploy.js triển khai.
 * WPT decimals 0, VNDB decimals 0: mọi số là đơn vị nhỏ nhất.
 */

const Q1 = "mock:2026-Q1";
const DAY = 24 * 60 * 60;

async function baseFixture() {
  const [admin, investorA, investorB, outsider] = await ethers.getSigners();
  const project = await ethers.deployContract("ProjectToken", [
    "Wind Project Token", "WPT", 0, admin.address, wptSupplyCap,
  ]);
  const registry = await ethers.deployContract("IdentityRegistry", [admin.address]);
  const compliance = await ethers.deployContract("ModularCompliance", [admin.address]);
  const allowAll = await ethers.deployContract("AllowAllModule");
  await project.setIdentityRegistry(await registry.getAddress());
  await project.setCompliance(await compliance.getAddress());
  await compliance.bindToken(await project.getAddress());
  await compliance.addModule(await allowAll.getAddress());
  const payout = await ethers.deployContract("VNDToken", [admin.address]);
  const distributor = await ethers.deployContract("ProfitDistributor", [
    await project.getAddress(), await payout.getAddress(), admin.address,
  ]);
  await project.grantRole(await project.SNAPSHOT_ROLE(), await distributor.getAddress());
  for (const wallet of [admin, investorA, investorB, outsider]) {
    await registry.registerIdentity(wallet.address, 704);
  }
  return { admin, investorA, investorB, outsider, project, registry, payout, distributor };
}

/** Nhà đầu tư A giữ 60 WPT, B giữ 40 WPT: phần chia 60% và 40%. */
async function holdersFixture() {
  const f = await baseFixture();
  await f.project.mintInitialSupply(f.admin.address, 100n);
  await f.project.transfer(f.investorA.address, 60n);
  await f.project.transfer(f.investorB.address, 40n);
  return f;
}

/** Nạp quỹ bằng chuyển VNDB thường (QĐ-27): không gọi hàm nào của ProfitDistributor. */
async function deposit(f, amount) {
  await f.payout.mint(await f.distributor.getAddress(), amount);
}

/**
 * Bất biến sổ dự trữ (QĐ-A): `totalReserved` bằng tổng `amount - claimed` của các kỳ chưa đóng,
 * và không vượt số dư VNDB của hợp đồng.
 */
async function expectReserveInvariant(f) {
  const count = await f.distributor.distributionsCount();
  let owed = 0n;
  for (let id = 0n; id < count; id++) {
    const d = await f.distributor.distributions(id);
    if (!d.closed) owed += d.amount - d.claimed;
  }
  const reserved = await f.distributor.totalReserved();
  const balance = await f.payout.balanceOf(await f.distributor.getAddress());
  expect(reserved, "totalReserved = tổng phần còn nợ của kỳ chưa đóng").to.equal(owed);
  expect(reserved <= balance, "totalReserved không vượt số dư").to.equal(true);
  expect(await f.distributor.unallocatedBalance()).to.equal(balance - reserved);
}

/**
 * Ca 6, phần dùng chung: mọi `Transfer` VNDB ra khỏi hợp đồng phải đi kèm một `Claimed` cùng
 * người nhận, cùng số tiền, cùng giao dịch. Nhờ vậy bất kỳ đường chuyển tiền nào khác (rút về
 * admin, trả cho người gọi khi đóng kỳ) đều bị bắt, ở MỌI ca trong tệp này.
 */
async function expectOnlyClaimTransfers(f) {
  const distributorAddress = await f.distributor.getAddress();
  const transfers = await f.payout.queryFilter(f.payout.filters.Transfer(distributorAddress));
  const claims = await f.distributor.queryFilter(f.distributor.filters.Claimed());
  const claimKeys = new Set(
    claims.map((c) => `${c.transactionHash}|${c.args.account}|${c.args.amount}`),
  );
  for (const t of transfers) {
    const key = `${t.transactionHash}|${t.args.to}|${t.args.value}`;
    expect(claimKeys.has(key), `VNDB ra khỏi quỹ không qua claim: ${key}`).to.equal(true);
  }
}

describe("SC-06 - ProfitDistributor: quỹ chia một chiều", function () {
  let current;
  afterEach(async function () {
    if (current) await expectOnlyClaimTransfers(current);
    current = undefined;
  });
  const use = async (fixture) => {
    current = await loadFixture(fixture);
    return current;
  };

  it("ca 1: tạo kỳ từ quỹ lấy đúng phần chưa phân bổ, tra được theo nhãn", async function () {
    const f = await use(holdersFixture);
    await deposit(f, 1_000_000n);
    expect(await f.distributor.unallocatedBalance()).to.equal(1_000_000n);
    const [existsBefore] = await f.distributor.distributionIdOfPeriod(Q1);
    expect(existsBefore).to.equal(false);

    await expect(f.distributor.createDistributionFromPool(Q1))
      .to.emit(f.distributor, "DistributionCreated");
    const d = await f.distributor.distributions(0);
    expect(d.amount).to.equal(1_000_000n);
    expect(d.period).to.equal(Q1);
    expect(await f.distributor.totalReserved()).to.equal(1_000_000n);
    expect(await f.distributor.unallocatedBalance()).to.equal(0n);
    const [exists, id] = await f.distributor.distributionIdOfPeriod(Q1);
    expect(exists).to.equal(true);
    expect(id).to.equal(0n);
    await expectReserveInvariant(f);
  });

  it("ca 2: nhãn rỗng, nhãn trùng, quỹ chưa phân bổ 0, tổng cung 0 đều revert", async function () {
    const f = await use(holdersFixture);
    await deposit(f, 1_000n);
    await expect(f.distributor.createDistributionFromPool(""))
      .to.be.revertedWithCustomError(f.distributor, "EmptyPeriod");
    await f.distributor.createDistributionFromPool(Q1);
    await expect(f.distributor.createDistributionFromPool("mock:2026-Q2"))
      .to.be.revertedWithCustomError(f.distributor, "NothingToDistribute");
    await deposit(f, 500n);
    await expect(f.distributor.createDistributionFromPool(Q1))
      .to.be.revertedWithCustomError(f.distributor, "DuplicatePeriod").withArgs(Q1);
    expect(await f.distributor.distributionsCount()).to.equal(1n);

    const empty = await baseFixture();
    await deposit(empty, 1_000n);
    await expect(empty.distributor.createDistributionFromPool(Q1))
      .to.be.revertedWith("khong co WPT dang luu hanh");
  });

  it("ca 3: không tính trùng, kỳ sau chỉ lấy tiền nạp thêm, trả hết hai kỳ không thiếu tiền", async function () {
    const f = await use(holdersFixture);
    await deposit(f, 1_000_000n);
    await f.distributor.createDistributionFromPool("mock:A");
    await f.distributor.connect(f.investorA).claim(0);
    expect((await f.distributor.distributions(0)).claimed).to.equal(600_000n);
    await expectReserveInvariant(f);

    await deposit(f, 500_000n);
    expect(await f.distributor.unallocatedBalance()).to.equal(500_000n);
    await f.distributor.createDistributionFromPool("mock:B");
    expect((await f.distributor.distributions(1)).amount).to.equal(500_000n);
    await expectReserveInvariant(f);

    await f.distributor.connect(f.investorA).claim(1);
    await f.distributor.distributeTo(0, [f.investorB.address]);
    await f.distributor.distributeTo(1, [f.investorB.address]);
    expect(await f.payout.balanceOf(f.investorA.address)).to.equal(900_000n);
    expect(await f.payout.balanceOf(f.investorB.address)).to.equal(600_000n);
    expect(await f.payout.balanceOf(await f.distributor.getAddress())).to.equal(0n);
    expect(await f.distributor.totalReserved()).to.equal(0n);
    await expectReserveInvariant(f);
  });

  it("ca 4: đóng kỳ sau hạn trả phần còn lại về quỹ, kỳ sau lấy lại được", async function () {
    const f = await use(holdersFixture);
    await deposit(f, 1_000_000n);
    await f.distributor.createDistributionFromPool("mock:A");
    await f.distributor.connect(f.investorA).claim(0);
    await time.increaseTo((await f.distributor.distributions(0)).claimDeadline);

    const balanceBefore = await f.payout.balanceOf(await f.distributor.getAddress());
    const reservedBefore = await f.distributor.totalReserved();
    const unallocatedBefore = await f.distributor.unallocatedBalance();
    await expect(f.distributor.closeDistribution(0))
      .to.emit(f.distributor, "DistributionClosed").withArgs(0, 400_000n);
    expect(await f.payout.balanceOf(await f.distributor.getAddress())).to.equal(balanceBefore);
    expect(await f.distributor.totalReserved()).to.equal(reservedBefore - 400_000n);
    expect(await f.distributor.unallocatedBalance()).to.equal(unallocatedBefore + 400_000n);
    const a = await f.distributor.distributions(0);
    expect(a.closed).to.equal(true);
    expect(a.claimed, "claimed giữ nghĩa đã trả").to.equal(600_000n);
    await expectReserveInvariant(f);

    await f.distributor.createDistributionFromPool("mock:C");
    expect((await f.distributor.distributions(1)).amount).to.equal(400_000n);
    await expectReserveInvariant(f);
    await expect(f.distributor.connect(f.investorB).claim(0))
      .to.be.revertedWithCustomError(f.distributor, "DistributionClosed").withArgs(0);
  });

  it("ca 5: đóng trước hạn, đóng hai lần, ví thiếu vai admin đều revert; kỳ đã trả hết đóng với 0", async function () {
    const f = await use(holdersFixture);
    await deposit(f, 1_000n);
    await f.distributor.createDistributionFromPool("mock:A");
    await expect(f.distributor.closeDistribution(0)).to.be.revertedWith("chua het han nhan");

    await f.distributor.distributeTo(0, [f.investorA.address, f.investorB.address]);
    await time.increaseTo((await f.distributor.distributions(0)).claimDeadline);
    await expect(f.distributor.connect(f.outsider).closeDistribution(0))
      .to.be.revertedWithCustomError(f.distributor, "AccessControlUnauthorizedAccount");
    // DISTRIBUTOR_ROLE không đủ: đóng kỳ là việc của DEFAULT_ADMIN_ROLE.
    await f.distributor.grantRole(await f.distributor.DISTRIBUTOR_ROLE(), f.outsider.address);
    await expect(f.distributor.connect(f.outsider).closeDistribution(0))
      .to.be.revertedWithCustomError(f.distributor, "AccessControlUnauthorizedAccount");

    await expect(f.distributor.closeDistribution(0))
      .to.emit(f.distributor, "DistributionClosed").withArgs(0, 0n);
    await expect(f.distributor.closeDistribution(0))
      .to.be.revertedWithCustomError(f.distributor, "DistributionClosed").withArgs(0);
    await expectReserveInvariant(f);
  });

  it("ca 6: không còn đường rút, VNDB chỉ ra khỏi quỹ cho ví được chia", async function () {
    const f = await use(holdersFixture);
    for (const name of ["sweepDust", "withdraw", "rescue"]) {
      expect(f.distributor.interface.getFunction(name), `ABI không có ${name}`).to.equal(null);
    }
    expect(f.distributor.interface.getEvent("DustSwept"), "ABI không có DustSwept").to.equal(null);

    await deposit(f, 1_000_000n);
    await f.distributor.createDistributionFromPool("mock:A");
    await f.distributor.connect(f.investorA).claim(0);
    await time.increaseTo((await f.distributor.distributions(0)).claimDeadline);
    await f.distributor.closeDistribution(0);
    await f.distributor.createDistributionFromPool("mock:B");
    await f.distributor.distributeTo(1, [f.investorA.address, f.investorB.address]);
    await expectOnlyClaimTransfers(f);
    expect(await f.payout.balanceOf(f.admin.address)).to.equal(0n);
  });

  it("ca 7: bất biến sổ dự trữ sau mỗi bước của một chuỗi ngẫu nhiên có hạt giống cố định", async function () {
    const f = await use(holdersFixture);
    let seed = 20261020;
    const next = (n) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const investors = [f.investorA, f.investorB];
    const done = { deposit: 0, create: 0, claim: 0, distribute: 0, close: 0 };
    let label = 0;
    for (let step = 0; step < 60; step++) {
      const count = Number(await f.distributor.distributionsCount());
      const action = next(5);
      if (action === 0) {
        await deposit(f, BigInt(1 + next(1_000_000)));
        done.deposit++;
      } else if (action === 1 && (await f.distributor.unallocatedBalance()) > 0n) {
        await f.distributor.createDistributionFromPool(`mock:r${label++}`);
        done.create++;
      } else if (action === 2 && count > 0) {
        const id = next(count);
        const d = await f.distributor.distributions(id);
        const now = BigInt(await time.latest());
        if (!d.closed && now + 1n < d.claimDeadline) {
          await f.distributor.connect(investors[next(2)]).claim(id);
          done.claim++;
        }
      } else if (action === 3 && count > 0) {
        const id = next(count);
        const d = await f.distributor.distributions(id);
        const now = BigInt(await time.latest());
        if (!d.closed && now + 1n < d.claimDeadline) {
          await f.distributor.distributeTo(id, [f.investorA.address, f.investorB.address]);
          done.distribute++;
        }
      } else if (action === 4 && count > 0) {
        await time.increase((30 + next(200)) * DAY);
        const id = next(count);
        const d = await f.distributor.distributions(id);
        if (!d.closed && BigInt(await time.latest()) >= d.claimDeadline) {
          await f.distributor.closeDistribution(id);
          done.close++;
        }
      }
      await expectReserveInvariant(f);
    }
    // Chuỗi phải đi qua đủ năm loại bước, nếu không bất biến chỉ được kiểm trên một phần mô hình.
    for (const [kind, n] of Object.entries(done)) expect(n, `số bước ${kind}`).to.be.greaterThan(0);
  });

  it("ca 8: createDistribution kéo tiền cũng cộng dự trữ; trộn hai cách vẫn đúng ca 3", async function () {
    const f = await use(holdersFixture);
    await f.payout.mint(f.admin.address, 1_000_000n);
    await f.payout.approve(await f.distributor.getAddress(), 1_000_000n);
    await f.distributor.createDistribution(1_000_000n, "mock:A");
    expect(await f.distributor.totalReserved()).to.equal(1_000_000n);
    expect(await f.distributor.unallocatedBalance()).to.equal(0n);
    const [pulledLabelUsed] = await f.distributor.distributionIdOfPeriod("mock:A");
    expect(pulledLabelUsed, "kéo tiền không ghi bảng chống trùng").to.equal(false);
    await f.distributor.connect(f.investorA).claim(0);
    await expectReserveInvariant(f);

    await deposit(f, 500_000n);
    await f.distributor.createDistributionFromPool("mock:B");
    expect((await f.distributor.distributions(1)).amount).to.equal(500_000n);
    await f.distributor.connect(f.investorA).claim(1);
    await f.distributor.distributeTo(0, [f.investorB.address]);
    await f.distributor.distributeTo(1, [f.investorB.address]);
    expect(await f.payout.balanceOf(f.investorA.address)).to.equal(900_000n);
    expect(await f.payout.balanceOf(f.investorB.address)).to.equal(600_000n);
    expect(await f.payout.balanceOf(await f.distributor.getAddress())).to.equal(0n);
    await expectReserveInvariant(f);
  });

  it("ca 9: phần của SPV vào vault, netProceeds của vault không đổi", async function () {
    const f = await use(baseFixture);
    const vault = await ethers.deployContract("SpvPaymentVault", [
      await f.project.getAddress(), await f.payout.getAddress(), f.admin.address,
    ]);
    const vaultAddress = await vault.getAddress();
    await f.registry.registerIdentity(vaultAddress, 704);
    await f.project.mintInitialSupply(vaultAddress, 1_000n);
    await f.project.forcedTransfer(vaultAddress, f.investorA.address, 600n);
    expect(await f.project.balanceOf(vaultAddress)).to.equal(400n);

    const netBefore = await vault.netProceeds();
    await deposit(f, 1_000_000n);
    await f.distributor.createDistributionFromPool("mock:A");
    await f.distributor.distributeTo(0, [vaultAddress, f.investorA.address]);
    expect(await f.payout.balanceOf(vaultAddress)).to.equal(400_000n);
    expect(await f.payout.balanceOf(f.investorA.address)).to.equal(600_000n);
    expect(await vault.netProceeds()).to.equal(netBefore);
    await expectReserveInvariant(f);
  });
});
