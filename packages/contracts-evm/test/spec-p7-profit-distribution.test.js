/**
 * SPEC TEST - P7 CHIA LỢI TỨC (EVM)
 *
 * Kiểm acceptance criteria của spec `.kiro/specs/p7-profit-distribution/`.
 * Bao gồm cả nhánh nhập tay (createDistribution) và nhánh oracle
 * (createDistributionFromOracle), vì spec yêu cầu cả hai.
 *
 * Trọng tâm nghiệp vụ: phần chia phải tính theo SỐ DƯ TẠI SNAPSHOT, không phải
 * số dư hiện tại. Đây là tiêu chí dễ hỏng nhất khi dev sửa về sau.
 */
const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

/** Dựng sẵn: A giữ 700 WPT, B giữ 300 WPT, kho VNDB của distributor đã nạp. */
async function withHolders() {
  const f = await loadFixture(deploySpecFixture);
  const { project, payout, admin, investorA, investorB, distributor } = f;

  await whitelist(project, admin, [investorA, investorB]);
  await project.connect(admin).mint(investorA.address, 700);
  await project.connect(admin).mint(investorB.address, 300);

  // Ngân hàng có VNDB và cấp quyền cho distributor kéo về (safeTransferFrom).
  await payout.connect(admin).mint(admin.address, 10_000_000);
  await payout.connect(admin).approve(await distributor.getAddress(), 10_000_000);

  return f;
}

describe("SPEC P7 - Chia lợi tức", function () {
  describe("Tạo kỳ chia (nhánh nhập tay)", function () {
    it("P7-1: tạo kỳ chốt snapshot và ghi đúng tổng cung tại snapshot", async function () {
      const { distributor, admin } = await withHolders();

      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      expect(await distributor.distributionsCount()).to.equal(1n);
      const d = await distributor.distributions(0);
      expect(d.amount).to.equal(1_000_000n);
      expect(d.supplyAtSnapshot).to.equal(1000n); // 700 + 300
      expect(d.period).to.equal("Q1-2026");
    });

    it("P7-2: kho VNDB được kéo vào hợp đồng khi tạo kỳ", async function () {
      const { distributor, payout, admin } = await withHolders();

      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      expect(await payout.balanceOf(await distributor.getAddress())).to.equal(1_000_000n);
    });

    it("P7-3: amount = 0 bị từ chối", async function () {
      const { distributor, admin } = await withHolders();

      await expect(
        distributor.connect(admin).createDistribution(0, "Q1-2026")
      ).to.be.revertedWith("amount = 0");
    });

    it("P7-4: không có token đang lưu hành thì không tạo được kỳ", async function () {
      const { distributor, payout, admin } = await loadFixture(deploySpecFixture);
      await payout.connect(admin).mint(admin.address, 1_000_000);
      await payout.connect(admin).approve(await distributor.getAddress(), 1_000_000);

      await expect(
        distributor.connect(admin).createDistribution(1_000_000, "Q1-2026")
      ).to.be.revertedWith("khong co WPT dang luu hanh");
    });

    it("P7-5: ví không có DISTRIBUTOR_ROLE không tạo được kỳ", async function () {
      const { distributor, outsider } = await withHolders();

      await expect(
        distributor.connect(outsider).createDistribution(1_000_000, "Q1-2026")
      ).to.be.reverted;
    });

    it("P7-6: thiếu SNAPSHOT_ROLE thì tạo kỳ thất bại (bẫy triển khai hay gặp)", async function () {
      const { project, distributor, admin } = await withHolders();

      // Rút SNAPSHOT_ROLE để mô phỏng deploy quên cấp quyền.
      await project.connect(admin).revokeRole(
        await project.SNAPSHOT_ROLE(),
        await distributor.getAddress()
      );

      await expect(
        distributor.connect(admin).createDistribution(1_000_000, "Q1-2026")
      ).to.be.reverted;
    });
  });

  describe("Tính phần chia theo snapshot", function () {
    it("P7-7: phần chia đúng tỷ lệ nắm giữ tại thời điểm chốt", async function () {
      const { distributor, admin, investorA, investorB } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      expect(await distributor.entitlementOf(0, investorA.address)).to.equal(700_000n);
      expect(await distributor.entitlementOf(0, investorB.address)).to.equal(300_000n);
    });

    it("P7-8: MUA SAU KHI CHỐT không được chia kỳ đó", async function () {
      const { project, distributor, admin, investorA, investorB } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      // A chuyển toàn bộ cho B SAU khi chốt.
      await project.connect(investorA).transfer(investorB.address, 700);
      expect(await project.balanceOf(investorA.address)).to.equal(0n);

      // Phần chia KHÔNG đổi vì dùng balanceOfAt.
      expect(await distributor.entitlementOf(0, investorA.address)).to.equal(700_000n);
      expect(await distributor.entitlementOf(0, investorB.address)).to.equal(300_000n);
    });

    it("P7-9: ví không nắm giữ token được chia 0", async function () {
      const { distributor, admin, outsider } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      expect(await distributor.entitlementOf(0, outsider.address)).to.equal(0n);
    });

    it("P7-10: previewClaim trả 0 sau khi đã nhận", async function () {
      const { distributor, admin, investorA } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      expect(await distributor.previewClaim(0, investorA.address)).to.equal(700_000n);
      await distributor.connect(investorA).claim(0);
      expect(await distributor.previewClaim(0, investorA.address)).to.equal(0n);
    });
  });

  describe("Nhận lợi tức - mô hình pull", function () {
    it("P7-11: nhà đầu tư tự nhận và số dư VNDB tăng đúng", async function () {
      const { distributor, payout, admin, investorA } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      await distributor.connect(investorA).claim(0);

      expect(await payout.balanceOf(investorA.address)).to.equal(700_000n);
    });

    it("P7-12: nhận lần hai không trả thêm tiền", async function () {
      const { distributor, payout, admin, investorA } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      await distributor.connect(investorA).claim(0);
      await distributor.connect(investorA).claim(0); // không revert, nhưng trả 0

      expect(await payout.balanceOf(investorA.address)).to.equal(700_000n);
      expect(await distributor.hasClaimed(0, investorA.address)).to.equal(true);
    });

    it("P7-13: nhận kỳ không tồn tại bị từ chối", async function () {
      const { distributor, investorA } = await withHolders();

      await expect(
        distributor.connect(investorA).claim(99)
      ).to.be.revertedWith("ky khong ton tai");
    });
  });

  describe("Nhận lợi tức - mô hình push (ngân hàng chia hộ)", function () {
    it("P7-14: ngân hàng chia hộ cho danh sách nhà đầu tư", async function () {
      const { distributor, payout, admin, investorA, investorB } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      await distributor.connect(admin).distributeTo(0, [investorA.address, investorB.address]);

      expect(await payout.balanceOf(investorA.address)).to.equal(700_000n);
      expect(await payout.balanceOf(investorB.address)).to.equal(300_000n);
    });

    it("P7-15: ví không có quyền không được chia hộ", async function () {
      const { distributor, admin, investorA, outsider } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      await expect(
        distributor.connect(outsider).distributeTo(0, [investorA.address])
      ).to.be.reverted;
    });
  });

  describe("Nhánh oracle (sản lượng điện)", function () {
    // Doanh thu gộp = kWh * đơn giá; ròng = gộp - opex; chia = ròng * bankShareBps / 10000
    const kWh = 1_000_000n;
    const tariff = 2_000n;          // VNDB / kWh
    const opex = 500_000_000n;
    const bankShareBps = 3_000n;    // 30%

    const gross = kWh * tariff;               // 2.000.000.000
    const net = gross - opex;                 // 1.500.000.000
    const distributable = (net * bankShareBps) / 10_000n; // 450.000.000

    it("P7-16: oracle tính đúng doanh thu gộp, ròng và phần chia", async function () {
      const { oracle, admin } = await withHolders();

      await oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps);

      expect(await oracle.grossRevenueVnd(1)).to.equal(gross);
      expect(await oracle.netRevenueVnd(1)).to.equal(net);
      expect(await oracle.distributableProfitVnd(1)).to.equal(distributable);
      expect(await oracle.isFinalized(1)).to.equal(true);
    });

    it("P7-17: tạo kỳ từ oracle dùng đúng số phần chia của oracle", async function () {
      const { oracle, distributor, payout, admin } = await withHolders();
      await payout.connect(admin).mint(admin.address, distributable);
      await payout.connect(admin).approve(await distributor.getAddress(), distributable * 2n);

      await oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps);
      await distributor.connect(admin).createDistributionFromOracle(1);

      const d = await distributor.distributions(0);
      expect(d.amount).to.equal(distributable);
    });

    it("P7-18: oracle chưa chốt kỳ thì không tạo được đợt chia", async function () {
      const { oracle, distributor, admin } = await withHolders();

      // Cần 2 xác nhận nên lần submit đầu chưa finalize.
      await oracle.connect(admin).setRequiredConfirmations(2);
      await oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps);
      expect(await oracle.isFinalized(1)).to.equal(false);

      await expect(
        distributor.connect(admin).createDistributionFromOracle(1)
      ).to.be.revertedWith("oracle chua chot ky nay");
    });

    it("P7-19: một kỳ oracle không tạo đợt chia hai lần", async function () {
      const { oracle, distributor, payout, admin } = await withHolders();
      await payout.connect(admin).mint(admin.address, distributable * 3n);
      await payout.connect(admin).approve(await distributor.getAddress(), distributable * 3n);

      await oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps);
      await distributor.connect(admin).createDistributionFromOracle(1);

      await expect(
        distributor.connect(admin).createDistributionFromOracle(1)
      ).to.be.revertedWith("ky da tao dot chia");
    });

    it("P7-20: hai reporter nộp số liệu KHÁC nhau bị chặn (chống thao túng)", async function () {
      const { oracle, admin, reporter2 } = await withHolders();
      await oracle.connect(admin).setRequiredConfirmations(2);
      await oracle.connect(admin).grantRole(await oracle.REPORTER_ROLE(), reporter2.address);

      await oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps);
      await expect(
        oracle.connect(reporter2).submitReading(1, kWh + 1n, tariff, opex, bankShareBps)
      ).to.be.revertedWith("so lieu khong khop lan truoc");
    });

    it("P7-21: kỳ đã chốt thì không sửa số liệu được", async function () {
      const { oracle, admin } = await withHolders();
      await oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps);

      await expect(
        oracle.connect(admin).submitReading(1, kWh, tariff, opex, bankShareBps)
      ).to.be.revertedWith("ky da chot");
    });
  });

  describe("Quét phần dư sau thời hạn nhận", function () {
    it("P7-22: chưa hết hạn thì không quét được", async function () {
      const { distributor, admin } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");

      await expect(
        distributor.connect(admin).sweepDust(0, admin.address)
      ).to.be.revertedWith("chua het han nhan");
    });

    it("P7-23: hết hạn thì thu được phần chưa ai nhận", async function () {
      const { distributor, payout, admin, investorA } = await withHolders();
      await distributor.connect(admin).createDistribution(1_000_000, "Q1-2026");
      await distributor.connect(investorA).claim(0); // A nhận 700.000, còn 300.000

      await time.increase(181 * 24 * 60 * 60); // vượt claimWindow 180 ngày

      const before = await payout.balanceOf(admin.address);
      await distributor.connect(admin).sweepDust(0, admin.address);
      const after = await payout.balanceOf(admin.address);

      expect(after - before).to.equal(300_000n);
    });
  });
});
