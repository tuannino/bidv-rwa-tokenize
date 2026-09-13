/**
 * SPEC TEST - P4 MINT (EVM)
 *
 * Kiểm acceptance criteria của spec `.kiro/specs/p4-mint-testnet/requirements.md`
 * ở tầng contract, chạy trên hardhat network (không cần mạng).
 *
 * Nguyên tắc: mỗi `it` ánh xạ tới MỘT tiêu chí. Tên test ghi kèm mã tiêu chí
 * để khi đỏ là biết ngay spec nào chưa đạt.
 */
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");

describe("SPEC P4 - Phát hành WPT", function () {
  describe("Whitelist (điều kiện tuân thủ trước khi phát hành)", function () {
    it("P4-1: AGENT whitelist được ví, isWhitelisted phản ánh đúng", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);

      expect(await project.isWhitelisted(investorA.address)).to.equal(false);
      await project.connect(admin).setWhitelisted(investorA.address, true);
      expect(await project.isWhitelisted(investorA.address)).to.equal(true);
    });

    it("P4-2: whitelist theo lô cho nhiều ví cùng lúc", async function () {
      const { project, admin, investorA, investorB } = await loadFixture(deploySpecFixture);

      await project.connect(admin).batchSetWhitelisted(
        [investorA.address, investorB.address],
        true
      );
      expect(await project.isWhitelisted(investorA.address)).to.equal(true);
      expect(await project.isWhitelisted(investorB.address)).to.equal(true);
    });

    it("P4-3: ví KHÔNG có AGENT_ROLE không được whitelist", async function () {
      const { project, outsider, investorA } = await loadFixture(deploySpecFixture);

      await expect(
        project.connect(outsider).setWhitelisted(investorA.address, true)
      ).to.be.reverted; // AccessControlUnauthorizedAccount
    });
  });

  describe("Mint", function () {
    it("P4-4: mint cho ví đã whitelist làm tăng số dư và tổng cung", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);

      await project.connect(admin).mint(investorA.address, 1000);

      expect(await project.balanceOf(investorA.address)).to.equal(1000n);
      expect(await project.totalSupply()).to.equal(1000n);
    });

    it("P4-5: mint cho ví CHƯA whitelist bị chặn (không tạo token)", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);

      await expect(
        project.connect(admin).mint(investorA.address, 1000)
      ).to.be.revertedWith("phat hanh cho vi chua KYC");

      expect(await project.totalSupply()).to.equal(0n);
    });

    it("P4-6: ví KHÔNG có MINTER_ROLE không mint được", async function () {
      const { project, admin, investorA, outsider } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);

      await expect(
        project.connect(outsider).mint(investorA.address, 1000)
      ).to.be.reverted;
    });

    it("P4-7: mint 0 không làm đổi tổng cung", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);

      await project.connect(admin).mint(investorA.address, 0);
      expect(await project.totalSupply()).to.equal(0n);
    });
  });

  describe("Đóng băng và tạm dừng (ràng buộc tuân thủ)", function () {
    it("P4-8: ví bị đóng băng không nhận được token phát hành", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);
      await project.connect(admin).setFrozen(investorA.address, true);

      await expect(
        project.connect(admin).mint(investorA.address, 100)
      ).to.be.revertedWith("ben nhan bi bang");
    });

    it("P4-9: khi tạm dừng toàn hệ thì không phát hành được", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);
      await project.connect(admin).setPaused(true);

      await expect(
        project.connect(admin).mint(investorA.address, 100)
      ).to.be.revertedWith("token dang tam dung");
    });

    it("P4-10: chuyển nhượng đòi CẢ HAI đầu đã whitelist", async function () {
      const { project, admin, investorA, investorB } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);
      await project.connect(admin).mint(investorA.address, 500);

      // investorB chưa whitelist
      await expect(
        project.connect(investorA).transfer(investorB.address, 100)
      ).to.be.revertedWith("ben nhan chua KYC");

      await whitelist(project, admin, [investorB]);
      await project.connect(investorA).transfer(investorB.address, 100);
      expect(await project.balanceOf(investorB.address)).to.equal(100n);
    });
  });

  describe("Thu hồi cưỡng chế (clawback / forcedTransfer)", function () {
    it("P4-11: AGENT đốt cưỡng chế làm giảm tổng cung", async function () {
      const { project, admin, investorA } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);
      await project.connect(admin).mint(investorA.address, 1000);

      await project.connect(admin).agentBurn(investorA.address, 400);

      expect(await project.balanceOf(investorA.address)).to.equal(600n);
      expect(await project.totalSupply()).to.equal(600n);
    });

    it("P4-12: forcedTransfer chuyển được kể cả khi bên gửi bị đóng băng", async function () {
      const { project, admin, investorA, investorB } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA, investorB]);
      await project.connect(admin).mint(investorA.address, 1000);
      await project.connect(admin).setFrozen(investorA.address, true);

      await project.connect(admin).forcedTransfer(investorA.address, investorB.address, 300);

      expect(await project.balanceOf(investorA.address)).to.equal(700n);
      expect(await project.balanceOf(investorB.address)).to.equal(300n);
    });

    it("P4-13: forcedTransfer sang ví chưa KYC bị chặn", async function () {
      const { project, admin, investorA, outsider } = await loadFixture(deploySpecFixture);
      await whitelist(project, admin, [investorA]);
      await project.connect(admin).mint(investorA.address, 1000);

      await expect(
        project.connect(admin).forcedTransfer(investorA.address, outsider.address, 100)
      ).to.be.revertedWith("clawback: to chua KYC");
    });
  });

  describe("Thông tin token", function () {
    it("P4-14: decimals của bản EVM là 0 (đơn vị nguyên)", async function () {
      const { project } = await loadFixture(deploySpecFixture);
      expect(await project.decimals()).to.equal(0n);
    });

    // Nợ P1 "đồng bộ đổi tên token" đã trả xong, nên cổng này chạy MẶC ĐỊNH.
    // Chỉ đặt EXPECT_TOKEN_SYMBOLS=0 nếu cố tình muốn bỏ qua (không nên).
    const symbolCheck = process.env.EXPECT_TOKEN_SYMBOLS === "0" ? it.skip : it;
    symbolCheck("P4-15: ký hiệu token là WPT và VNDB", async function () {
      const { project, payout } = await loadFixture(deploySpecFixture);
      expect(await project.symbol()).to.equal("WPT");
      expect(await payout.symbol()).to.equal("VNDB");
    });
  });
});
