const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SC-09 - ERC-3643 core", function () {
  async function deployComplianceFixture() {
    const [admin, token, investor, outsider] = await ethers.getSigners();
    const registry = await ethers.deployContract("IdentityRegistry", [admin.address]);
    const compliance = await ethers.deployContract("ModularCompliance", [admin.address]);
    const allowAll = await ethers.deployContract("AllowAllModule");
    const rejectAll = await ethers.deployContract("RejectAllModule");
    await Promise.all([
      registry.waitForDeployment(),
      compliance.waitForDeployment(),
      allowAll.waitForDeployment(),
      rejectAll.waitForDeployment(),
    ]);
    return { admin, token, investor, outsider, registry, compliance, allowAll, rejectAll };
  }

  describe("IdentityRegistry", function () {
    it("đăng ký lặp lại được, cập nhật quốc gia và xoá xác minh", async function () {
      const { investor, registry } = await deployComplianceFixture();
      await expect(registry.registerIdentity(investor.address, 704))
        .to.emit(registry, "IdentityRegistered")
        .withArgs(investor.address, 704);
      expect(await registry.isVerified(investor.address)).to.equal(true);
      expect(await registry.contains(investor.address)).to.equal(true);
      expect(await registry.investorCountry(investor.address)).to.equal(704);

      await expect(registry.registerIdentity(investor.address, 840))
        .to.emit(registry, "CountryUpdated")
        .withArgs(investor.address, 840);
      expect(await registry.investorCountry(investor.address)).to.equal(840);

      await registry.deleteIdentity(investor.address);
      expect(await registry.isVerified(investor.address)).to.equal(false);
    });

    it("chỉ AGENT_ROLE được sửa sổ và batch bắt buộc hai mảng cùng độ dài", async function () {
      const { investor, outsider, registry } = await deployComplianceFixture();
      await expect(registry.connect(outsider).registerIdentity(investor.address, 704))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.batchRegisterIdentity([investor.address], []))
        .to.be.revertedWithCustomError(registry, "ArrayLengthMismatch");
    });
  });

  describe("ModularCompliance", function () {
    it("không module thì cho qua; AllowAll cho qua; RejectAll chặn; gỡ thì cho qua", async function () {
      const { token, investor, compliance, allowAll, rejectAll } = await deployComplianceFixture();
      expect(await compliance.canTransfer(token.address, investor.address, 1)).to.equal(true);

      await compliance.addModule(await allowAll.getAddress());
      expect(await compliance.canTransfer(token.address, investor.address, 1)).to.equal(true);

      await compliance.addModule(await rejectAll.getAddress());
      expect(await compliance.canTransfer(token.address, investor.address, 1)).to.equal(false);

      await compliance.removeModule(await rejectAll.getAddress());
      expect(await compliance.canTransfer(token.address, investor.address, 1)).to.equal(true);
      expect(await compliance.getModules()).to.deep.equal([await allowAll.getAddress()]);
    });

    it("chỉ token đã gắn gọi được ba action", async function () {
      const { token, investor, outsider, compliance, allowAll } = await deployComplianceFixture();
      await compliance.bindToken(token.address);
      await compliance.addModule(await allowAll.getAddress());

      for (const [name, args] of [
        ["transferred", [token.address, investor.address, 1]],
        ["created", [investor.address, 1]],
        ["destroyed", [investor.address, 1]],
      ]) {
        await expect(compliance.connect(outsider)[name](...args))
          .to.be.revertedWithCustomError(compliance, "OnlyBoundToken")
          .withArgs(outsider.address);
        await expect(compliance.connect(token)[name](...args)).not.to.be.reverted;
      }
    });
  });
});
