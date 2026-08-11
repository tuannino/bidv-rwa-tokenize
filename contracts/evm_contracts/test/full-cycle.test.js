const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RWA năng lượng tái tạo — chu kỳ đầu-cuối", function () {
  let bank, treasury, invA, invB, invC, outsider;
  let spt, vnd, distributor, redemption;

  const DEC = 0n; // SPT & VND đều 0 số thập phân trong demo

  beforeEach(async function () {
    [bank, treasury, invA, invB, invC, outsider] = await ethers.getSigners();

    // Triển khai token
    spt = await ethers.deployContract("ProjectToken", ["Solar Project Token", "SPT", DEC, bank.address]);
    vnd = await ethers.deployContract("VNDToken", [bank.address]);

    // Triển khai hợp đồng nghiệp vụ
    distributor = await ethers.deployContract("ProfitDistributor", [
      await spt.getAddress(),
      await vnd.getAddress(),
      bank.address,
    ]);
    redemption = await ethers.deployContract("Redemption", [
      await spt.getAddress(),
      await vnd.getAddress(),
      1_000_000n, // 1 SPT = 1.000.000 VND
      bank.address,
    ]);

    // Distributor cần quyền chốt snapshot trên SPT
    const SNAPSHOT_ROLE = await spt.SNAPSHOT_ROLE();
    await spt.grantRole(SNAPSHOT_ROLE, await distributor.getAddress());

    // KYC các bên hợp lệ
    await spt.batchSetWhitelisted([treasury.address, invA.address, invB.address, invC.address], true);
  });

  it("Mint: chỉ MINTER mint được và chỉ mint cho ví đã KYC", async function () {
    await spt.mint(invA.address, 6000n);
    await spt.mint(invB.address, 4000n);
    expect(await spt.totalSupply()).to.equal(10000n);
    expect(await spt.balanceOf(invA.address)).to.equal(6000n);

    // mint cho ví chưa KYC -> revert
    await expect(spt.mint(outsider.address, 100n)).to.be.revertedWith("phat hanh cho vi chua KYC");

    // ví thường không mint được
    await expect(spt.connect(invA).mint(invA.address, 1n)).to.be.revertedWithCustomError(
      spt, "AccessControlUnauthorizedAccount"
    );
  });

  it("Chuyển nhượng có kiểm soát: chặn ví chưa KYC và ví bị đóng băng", async function () {
    await spt.mint(invA.address, 1000n);

    // gửi cho outsider (chưa KYC) -> revert
    await expect(spt.connect(invA).transfer(outsider.address, 10n)).to.be.revertedWith("ben nhan chua KYC");

    // gửi cho invB (KYC) -> ok
    await spt.connect(invA).transfer(invB.address, 100n);
    expect(await spt.balanceOf(invB.address)).to.equal(100n);

    // đóng băng invA -> không gửi được
    await spt.setFrozen(invA.address, true);
    await expect(spt.connect(invA).transfer(invB.address, 1n)).to.be.revertedWith("ben gui bi bang");
  });

  it("Clawback: agent thu hồi SPT từ ví bị băng về ví thu hồi", async function () {
    await spt.mint(invA.address, 500n);
    await spt.setFrozen(invA.address, true); // nghi vấn -> băng lại

    // clawback bỏ qua trạng thái băng của bên gửi
    await spt.forcedTransfer(invA.address, treasury.address, 500n);
    expect(await spt.balanceOf(invA.address)).to.equal(0n);
    expect(await spt.balanceOf(treasury.address)).to.equal(500n);
  });

  it("Snapshot công bằng: chuyển nhượng SAU khi chốt kỳ không đổi phần được chia của kỳ đó", async function () {
    await spt.mint(invA.address, 6000n);
    await spt.mint(invB.address, 4000n);

    // Ngân hàng nạp VND và tạo kỳ Q1 (chốt snapshot tại 6000/4000)
    const amountQ1 = 300_000_000n;
    await vnd.mint(bank.address, amountQ1);
    await vnd.approve(await distributor.getAddress(), amountQ1);
    await distributor.createDistribution(amountQ1, "2026-Q1");

    // Sau khi chốt, A chuyển 2000 cho B -> giờ 4000/6000
    await spt.connect(invA).transfer(invB.address, 2000n);

    // Phần của kỳ Q1 vẫn tính theo lúc chốt: A=180tr, B=120tr
    expect(await distributor.entitlementOf(0, invA.address)).to.equal(180_000_000n);
    expect(await distributor.entitlementOf(0, invB.address)).to.equal(120_000_000n);
  });

  it("Tính & chia lợi nhuận: preview đúng, claim đúng, không claim hai lần", async function () {
    await spt.mint(invA.address, 6000n);
    await spt.mint(invB.address, 4000n);

    const amountQ1 = 300_000_000n;
    await vnd.mint(bank.address, amountQ1);
    await vnd.approve(await distributor.getAddress(), amountQ1);
    await distributor.createDistribution(amountQ1, "2026-Q1");

    // preview
    expect(await distributor.previewClaim(0, invA.address)).to.equal(180_000_000n);
    expect(await distributor.previewClaim(0, invB.address)).to.equal(120_000_000n);

    // A tự nhận
    await distributor.connect(invA).claim(0);
    expect(await vnd.balanceOf(invA.address)).to.equal(180_000_000n);
    expect(await distributor.previewClaim(0, invA.address)).to.equal(0n); // đã nhận

    // claim lại -> không nhận thêm
    await distributor.connect(invA).claim(0);
    expect(await vnd.balanceOf(invA.address)).to.equal(180_000_000n);

    // Ngân hàng chia hộ cho B (push)
    await distributor.distributeTo(0, [invB.address]);
    expect(await vnd.balanceOf(invB.address)).to.equal(120_000_000n);
  });

  it("Quét phần dư: sau thời hạn nhận, phần chưa nhận trả về ngân hàng", async function () {
    await spt.mint(invA.address, 6000n);
    await spt.mint(invB.address, 4000n);

    const amountQ1 = 300_000_000n;
    await vnd.mint(bank.address, amountQ1);
    await vnd.approve(await distributor.getAddress(), amountQ1);
    await distributor.createDistribution(amountQ1, "2026-Q1");

    await distributor.connect(invA).claim(0); // chỉ A nhận (180tr), B chưa nhận (120tr)

    // chưa hết hạn -> revert
    await expect(distributor.sweepDust(0, treasury.address)).to.be.revertedWith("chua het han nhan");

    // tua thời gian qua thời hạn nhận
    await time.increase(181 * 24 * 60 * 60);
    await distributor.sweepDust(0, treasury.address);
    expect(await vnd.balanceOf(treasury.address)).to.equal(120_000_000n);
  });

  it("Hoàn vốn: đốt SPT đổi VND theo tỷ giá; giảm tổng cung", async function () {
    await spt.mint(invA.address, 1000n);

    // Ngân hàng nạp thanh khoản VND cho hợp đồng hoàn vốn
    const liq = 2_000_000_000n;
    await vnd.mint(bank.address, liq);
    await vnd.approve(await redemption.getAddress(), liq);
    await redemption.fund(liq);

    // Nhà đầu tư approve SPT rồi hoàn vốn 800 SPT -> 800.000.000 VND
    await spt.connect(invA).approve(await redemption.getAddress(), 800n);
    await redemption.connect(invA).redeem(800n);

    expect(await spt.balanceOf(invA.address)).to.equal(200n);
    expect(await spt.totalSupply()).to.equal(200n); // đã đốt 800
    expect(await vnd.balanceOf(invA.address)).to.equal(800_000_000n);

    // pause -> không hoàn vốn được
    await redemption.setPaused(true);
    await spt.connect(invA).approve(await redemption.getAddress(), 100n);
    await expect(redemption.connect(invA).redeem(100n)).to.be.revertedWith("dang tam dung");
  });

  it("Hai kỳ liên tiếp: cơ cấu sở hữu đổi giữa hai kỳ, mỗi kỳ chia theo snapshot của kỳ đó", async function () {
    await spt.mint(invA.address, 6000n);
    await spt.mint(invB.address, 4000n);

    // Q1: 6000/4000
    await vnd.mint(bank.address, 300_000_000n);
    await vnd.approve(await distributor.getAddress(), 300_000_000n);
    await distributor.createDistribution(300_000_000n, "2026-Q1");

    // đổi cơ cấu -> 5000/5000
    await spt.connect(invA).transfer(invB.address, 1000n);

    // Q2: 5000/5000
    await vnd.mint(bank.address, 200_000_000n);
    await vnd.approve(await distributor.getAddress(), 200_000_000n);
    await distributor.createDistribution(200_000_000n, "2026-Q2");

    expect(await distributor.entitlementOf(0, invA.address)).to.equal(180_000_000n); // Q1 theo 6000
    expect(await distributor.entitlementOf(1, invA.address)).to.equal(100_000_000n); // Q2 theo 5000

    // A nhận cả hai kỳ một lần
    await distributor.connect(invA).claimMany([0, 1]);
    expect(await vnd.balanceOf(invA.address)).to.equal(280_000_000n);
  });
});
