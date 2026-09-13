/**
 * SPEC TEST - P12 TẤT TOÁN / HOÀN VỐN (EVM)
 *
 * Kiểm acceptance criteria của spec `.kiro/specs/p12-redemption/`.
 *
 * Lưu ý mô hình EVM: redeem dùng `burnFrom` nên nhà đầu tư PHẢI approve WPT
 * cho hợp đồng Redemption trước. Đây là điểm khác biệt so với bản Stellar
 * (Soroban burn chính chủ, không cần approve) và là chỗ dev hay quên.
 */
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

/** A giữ 100 WPT, kho VNDB của Redemption đã nạp 2.000.000, tỷ giá 10.000. */
async function readyToRedeem() {
  const f = await loadFixture(deploySpecFixture);
  const { project, payout, admin, investorA, redemption } = f;

  await whitelist(project, admin, [investorA]);
  await project.connect(admin).mint(investorA.address, 100);

  // Ngân hàng nạp kho VNDB qua fund() (cần approve trước vì fund dùng transferFrom).
  await payout.connect(admin).mint(admin.address, 2_000_000);
  await payout.connect(admin).approve(await redemption.getAddress(), 2_000_000);
  await redemption.connect(admin).fund(2_000_000);

  return f;
}

describe("SPEC P12 - Tất toán WPT sang VNDB", function () {
  describe("Cấu hình của ngân hàng", function () {
    it("P12-1: MANAGER đặt được tỷ giá", async function () {
      const { redemption, admin } = await loadFixture(deploySpecFixture);

      await redemption.connect(admin).setRate(12_000);
      expect(await redemption.rate()).to.equal(12_000n);
    });

    it("P12-2: tỷ giá 0 bị từ chối", async function () {
      const { redemption, admin } = await loadFixture(deploySpecFixture);

      await expect(redemption.connect(admin).setRate(0)).to.be.revertedWith("rate = 0");
    });

    it("P12-3: ví không có MANAGER_ROLE không đặt được tỷ giá", async function () {
      const { redemption, outsider } = await loadFixture(deploySpecFixture);

      await expect(redemption.connect(outsider).setRate(12_000)).to.be.reverted;
    });

    it("P12-4: nạp kho làm tăng thanh khoản VNDB của hợp đồng", async function () {
      const { redemption, payout } = await readyToRedeem();

      expect(await payout.balanceOf(await redemption.getAddress())).to.equal(2_000_000n);
    });

    it("P12-5: quote tính đúng theo tỷ giá", async function () {
      const { redemption, RATE } = await readyToRedeem();

      expect(await redemption.quote(100)).to.equal(100n * RATE);
    });
  });

  describe("Luồng tất toán thành công", function () {
    it("P12-6: đổi WPT lấy VNDB đúng quote, WPT bị đốt, tổng cung giảm", async function () {
      const { redemption, project, payout, investorA, RATE } = await readyToRedeem();
      const supplyBefore = await project.totalSupply();

      await project.connect(investorA).approve(await redemption.getAddress(), 100);
      await redemption.connect(investorA).redeem(100);

      expect(await project.balanceOf(investorA.address)).to.equal(0n);
      expect(await project.totalSupply()).to.equal(supplyBefore - 100n);
      expect(await payout.balanceOf(investorA.address)).to.equal(100n * RATE);
    });

    it("P12-7: tất toán một phần thì phần còn lại vẫn giữ", async function () {
      const { redemption, project, investorA } = await readyToRedeem();

      await project.connect(investorA).approve(await redemption.getAddress(), 40);
      await redemption.connect(investorA).redeem(40);

      expect(await project.balanceOf(investorA.address)).to.equal(60n);
    });

    it("P12-8: thanh khoản kho giảm đúng số đã trả", async function () {
      const { redemption, project, payout, investorA, RATE } = await readyToRedeem();

      await project.connect(investorA).approve(await redemption.getAddress(), 50);
      await redemption.connect(investorA).redeem(50);

      expect(await payout.balanceOf(await redemption.getAddress()))
        .to.equal(2_000_000n - 50n * RATE);
    });
  });

  describe("Các ca bị chặn", function () {
    it("P12-9: đang tạm dừng thì không tất toán được", async function () {
      const { redemption, project, admin, investorA } = await readyToRedeem();
      await project.connect(investorA).approve(await redemption.getAddress(), 100);
      await redemption.connect(admin).setPaused(true);

      await expect(
        redemption.connect(investorA).redeem(100)
      ).to.be.revertedWith("dang tam dung");
    });

    it("P12-10: số lượng 0 bị từ chối", async function () {
      const { redemption, investorA } = await readyToRedeem();

      await expect(
        redemption.connect(investorA).redeem(0)
      ).to.be.revertedWith("sptAmount = 0");
    });

    it("P12-11: ví chưa KYC không tất toán được", async function () {
      const { redemption, project, admin, investorA } = await readyToRedeem();
      await project.connect(investorA).approve(await redemption.getAddress(), 100);

      // Gỡ whitelist để mô phỏng ví chưa KYC.
      await project.connect(admin).setWhitelisted(investorA.address, false);

      await expect(
        redemption.connect(investorA).redeem(100)
      ).to.be.revertedWith("chua KYC");
    });

    it("P12-12: kho VNDB thiếu thì từ chối và KHÔNG đốt WPT", async function () {
      const { redemption, project, payout, admin, investorA } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);
      await project.connect(admin).mint(investorA.address, 100);

      // Chỉ nạp kho 1.000 VNDB, không đủ cho 100 WPT * 10.000.
      await payout.connect(admin).mint(admin.address, 1_000);
      await payout.connect(admin).approve(await redemption.getAddress(), 1_000);
      await redemption.connect(admin).fund(1_000);

      await project.connect(investorA).approve(await redemption.getAddress(), 100);

      await expect(
        redemption.connect(investorA).redeem(100)
      ).to.be.revertedWith("thieu thanh khoan VND");

      // WPT không bị đốt.
      expect(await project.balanceOf(investorA.address)).to.equal(100n);
    });

    it("P12-13: THIẾU APPROVE thì tất toán thất bại (bẫy hay gặp của bản EVM)", async function () {
      const { redemption, project, investorA } = await readyToRedeem();

      // Cố ý KHÔNG approve.
      await expect(redemption.connect(investorA).redeem(100)).to.be.reverted;

      expect(await project.balanceOf(investorA.address)).to.equal(100n);
    });

    it("P12-14: approve thiếu so với số muốn tất toán thì thất bại", async function () {
      const { redemption, project, investorA } = await readyToRedeem();

      await project.connect(investorA).approve(await redemption.getAddress(), 30);
      await expect(redemption.connect(investorA).redeem(100)).to.be.reverted;
    });
  });

  describe("Rút thanh khoản", function () {
    it("P12-15: MANAGER rút được VNDB dư khỏi kho", async function () {
      const { redemption, payout, admin } = await readyToRedeem();
      const before = await payout.balanceOf(admin.address);

      await redemption.connect(admin).withdraw(admin.address, 500_000);

      expect(await payout.balanceOf(admin.address) - before).to.equal(500_000n);
    });

    it("P12-16: ví không có quyền không rút được kho", async function () {
      const { redemption, outsider } = await readyToRedeem();

      await expect(
        redemption.connect(outsider).withdraw(outsider.address, 1_000)
      ).to.be.reverted;
    });
  });
});
