const { wptSupplyCap } = require("../../shared/src/token-parameters.json");
const { expect } = require("chai");
const { ethers } = require("hardhat");

async function signPermit(token, owner, spender, value, deadline, signer = owner) {
  const { buildPermitTypedData } = await import("../../shared/src/permit.js");
  const { chainId } = await ethers.provider.getNetwork();
  const typedData = buildPermitTypedData({
    tokenName: await token.name(),
    version: (await token.eip712Domain()).version,
    chainId,
    verifyingContract: await token.getAddress(),
    owner: owner.address,
    spender: spender.address,
    value,
    nonce: await token.nonces(owner.address),
    deadline,
  });
  const raw = await signer.signTypedData(typedData.domain, typedData.types, typedData.message);
  const signature = ethers.Signature.from(raw);
  return { v: signature.v, r: signature.r, s: signature.s, typedData };
}

describe("SC-09 - ERC-3643 core", function () {
  async function deployTokenFixture() {
    const [admin, spv, investorA, investorB, outsider] = await ethers.getSigners();
    const project = await ethers.deployContract("ProjectToken", [
      "Wind Project Token",
      "WPT",
      0,
      admin.address,
      wptSupplyCap,
    ]);
    const registry = await ethers.deployContract("IdentityRegistry", [admin.address]);
    const compliance = await ethers.deployContract("ModularCompliance", [admin.address]);
    const allowAll = await ethers.deployContract("AllowAllModule");
    await Promise.all([
      project.waitForDeployment(),
      registry.waitForDeployment(),
      compliance.waitForDeployment(),
      allowAll.waitForDeployment(),
    ]);
    await project.setIdentityRegistry(await registry.getAddress());
    await project.setCompliance(await compliance.getAddress());
    await compliance.bindToken(await project.getAddress());
    await compliance.addModule(await allowAll.getAddress());
    await registry.batchRegisterIdentity(
      [spv.address, investorA.address, investorB.address],
      [704, 704, 704],
    );
    return { admin, spv, investorA, investorB, outsider, project, registry, compliance, allowAll };
  }

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

  describe("ProjectToken", function () {
    it("khớp selector và topic của phần IToken T-REX v4.1.6 đã hiện thực", async function () {
      const { project } = await deployTokenFixture();
      const functionSignatures = [
        "setOnchainID(address)",
        "pause()",
        "unpause()",
        "setAddressFrozen(address,bool)",
        "freezePartialTokens(address,uint256)",
        "unfreezePartialTokens(address,uint256)",
        "setIdentityRegistry(address)",
        "setCompliance(address)",
        "forcedTransfer(address,address,uint256)",
        "mint(address,uint256)",
        "burn(address,uint256)",
        "batchTransfer(address[],uint256[])",
        "batchForcedTransfer(address[],address[],uint256[])",
        "batchSetAddressFrozen(address[],bool[])",
        "onchainID()",
        "version()",
        "identityRegistry()",
        "compliance()",
        "paused()",
        "isFrozen(address)",
        "getFrozenTokens(address)",
      ];
      for (const signature of functionSignatures) {
        expect(project.interface.getFunction(signature).selector).to.equal(ethers.id(signature).slice(0, 10));
      }

      const eventSignatures = [
        "AddressFrozen(address,bool,address)",
        "TokensFrozen(address,uint256)",
        "TokensUnfrozen(address,uint256)",
        "Paused(address)",
        "Unpaused(address)",
        "IdentityRegistryAdded(address)",
        "ComplianceAdded(address)",
      ];
      for (const signature of eventSignatures) {
        expect(project.interface.getEvent(signature).topicHash).to.equal(ethers.id(signature));
      }
      expect(await project.version()).to.equal("4.1.6-poc");
    });

    it("chỉ ví đã xác minh được nhận/chuyển; xoá danh tính chặn ngay", async function () {
      const { admin, spv, investorA, investorB, outsider, project, registry } =
        await deployTokenFixture();
      await project.connect(admin).mintInitialSupply(spv.address, 100);
      await expect(project.connect(spv).transfer(outsider.address, 1))
        .to.be.revertedWithCustomError(project, "IdentityNotVerified")
        .withArgs(outsider.address);

      await project.connect(spv).transfer(investorA.address, 10);
      await registry.connect(admin).deleteIdentity(investorA.address);
      await expect(project.connect(investorA).transfer(investorB.address, 1))
        .to.be.revertedWithCustomError(project, "IdentityNotVerified")
        .withArgs(investorA.address);
    });

    it("bộ luật RejectAll chặn đúng lỗi và gỡ module thì chuyển lại được", async function () {
      const { admin, spv, investorA, project, compliance } = await deployTokenFixture();
      const rejectAll = await ethers.deployContract("RejectAllModule");
      await rejectAll.waitForDeployment();
      await project.connect(admin).mintInitialSupply(spv.address, 100);
      await compliance.connect(admin).addModule(await rejectAll.getAddress());

      await expect(project.connect(spv).transfer(investorA.address, 1))
        .to.be.revertedWithCustomError(project, "ComplianceRejected")
        .withArgs(spv.address, investorA.address, 1);
      await compliance.connect(admin).removeModule(await rejectAll.getAddress());
      await expect(project.connect(spv).transfer(investorA.address, 1)).not.to.be.reverted;
    });

    it("đóng băng toàn phần và một phần; cưỡng chế tự mở đúng phần cần dùng", async function () {
      const { admin, spv, investorA, project } = await deployTokenFixture();
      await project.connect(admin).mintInitialSupply(spv.address, 100);

      await project.connect(admin).setAddressFrozen(spv.address, true);
      await expect(project.connect(spv).transfer(investorA.address, 1))
        .to.be.revertedWithCustomError(project, "WalletFrozen")
        .withArgs(spv.address);
      await project.connect(admin).setAddressFrozen(spv.address, false);
      await project.connect(admin).setAddressFrozen(investorA.address, true);
      await expect(project.connect(spv).transfer(investorA.address, 1))
        .to.be.revertedWithCustomError(project, "WalletFrozen")
        .withArgs(investorA.address);
      await project.connect(admin).setAddressFrozen(investorA.address, false);

      await project.connect(admin).freezePartialTokens(spv.address, 80);
      await expect(project.connect(spv).transfer(investorA.address, 21))
        .to.be.revertedWithCustomError(project, "InsufficientUnfrozenTokens")
        .withArgs(spv.address, 20, 21);
      await expect(project.connect(admin).forcedTransfer(spv.address, investorA.address, 50))
        .to.emit(project, "TokensUnfrozen")
        .withArgs(spv.address, 30);
      expect(await project.getFrozenTokens(spv.address)).to.equal(50);
      expect(await project.balanceOf(spv.address)).to.equal(50);
    });

    it("pause/unpause chặn và mở chuyển; chỉ PAUSER_ROLE gọi được", async function () {
      const { admin, spv, investorA, outsider, project } = await deployTokenFixture();
      await project.connect(admin).mintInitialSupply(spv.address, 100);
      await expect(project.connect(outsider).pause())
        .to.be.revertedWithCustomError(project, "AccessControlUnauthorizedAccount");
      await project.connect(admin).pause();
      await expect(project.connect(spv).transfer(investorA.address, 1))
        .to.be.revertedWithCustomError(project, "TokenPaused");
      await project.connect(admin).unpause();
      await expect(project.connect(spv).transfer(investorA.address, 1)).not.to.be.reverted;
    });

    it("thiếu sổ danh tính hoặc bộ luật báo custom error rõ", async function () {
      const [admin, spv] = await ethers.getSigners();
      const project = await ethers.deployContract("ProjectToken", [
        "Wind Project Token",
        "WPT",
        0,
        admin.address,
        wptSupplyCap,
      ]);
      await project.waitForDeployment();
      await expect(project.mintInitialSupply(spv.address, 1))
        .to.be.revertedWithCustomError(project, "IdentityRegistryNotSet");

      const registry = await ethers.deployContract("IdentityRegistry", [admin.address]);
      await registry.waitForDeployment();
      await project.setIdentityRegistry(await registry.getAddress());
      await registry.registerIdentity(spv.address, 704);
      await expect(project.mintInitialSupply(spv.address, 1))
        .to.be.revertedWithCustomError(project, "ComplianceNotSet");
    });
  });

  describe("ERC-2612 permit", function () {
    async function verifyPermitLifecycle(token, owner, spender, recipient) {
      const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
      const valid = await signPermit(token, owner, spender, 50n, now + 3600n);
      await token.permit(
        owner.address,
        spender.address,
        50n,
        now + 3600n,
        valid.v,
        valid.r,
        valid.s,
      );
      expect(await token.allowance(owner.address, spender.address)).to.equal(50n);
      await token.connect(spender).transferFrom(owner.address, recipient.address, 10n);

      await expect(
        token.permit(
          owner.address,
          spender.address,
          50n,
          now + 3600n,
          valid.v,
          valid.r,
          valid.s,
        ),
      ).to.be.revertedWithCustomError(token, "ERC2612InvalidSigner");

      const expired = await signPermit(token, owner, spender, 1n, now - 1n);
      await expect(
        token.permit(
          owner.address,
          spender.address,
          1n,
          now - 1n,
          expired.v,
          expired.r,
          expired.s,
        ),
      ).to.be.revertedWithCustomError(token, "ERC2612ExpiredSignature");

      const [, , , , wrongSigner] = await ethers.getSigners();
      const wrong = await signPermit(token, owner, spender, 1n, now + 3600n, wrongSigner);
      await expect(
        token.permit(
          owner.address,
          spender.address,
          1n,
          now + 3600n,
          wrong.v,
          wrong.r,
          wrong.s,
        ),
      ).to.be.revertedWithCustomError(token, "ERC2612InvalidSigner");
    }

    it("VNDB: helper ký đúng domain; permit, transferFrom, expiry, sai signer và replay", async function () {
      const [admin, owner, spender, recipient] = await ethers.getSigners();
      const payout = await ethers.deployContract("VNDToken", [admin.address]);
      await payout.waitForDeployment();
      await payout.connect(admin).mint(owner.address, 100);
      await verifyPermitLifecycle(payout, owner, spender, recipient);
      expect(await payout.balanceOf(recipient.address)).to.equal(10n);
    });

    it("WPT: permit độc lập KYC nhưng transferFrom vẫn qua identity và compliance", async function () {
      const { admin, spv, investorA, investorB, outsider, project } = await deployTokenFixture();
      await project.connect(admin).mintInitialSupply(spv.address, 100);
      await verifyPermitLifecycle(project, spv, investorB, investorA);
      expect(await project.balanceOf(investorA.address)).to.equal(10n);

      const now = BigInt((await ethers.provider.getBlock("latest")).timestamp);
      const unverified = await signPermit(project, outsider, investorB, 5n, now + 3600n);
      await project.permit(
        outsider.address,
        investorB.address,
        5n,
        now + 3600n,
        unverified.v,
        unverified.r,
        unverified.s,
      );
      expect(await project.allowance(outsider.address, investorB.address)).to.equal(5n);
      await expect(project.connect(investorB).transferFrom(spv.address, outsider.address, 1))
        .to.be.revertedWithCustomError(project, "IdentityNotVerified")
        .withArgs(outsider.address);
    });
  });
});
