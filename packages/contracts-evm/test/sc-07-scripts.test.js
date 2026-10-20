const { expect } = require("chai");
const { ethers } = require("hardhat");
const { assertP4Ready, assertNoVaultSuite } = require("../scripts/dod-verify-sepolia");

describe("SC-07 - công cụ an toàn", function () {
  it("ca 25: P4 cũ dừng trước giao dịch khi chưa Mint đầu", async function () {
    const [admin] = await ethers.getSigners();
    const project = await ethers.deployContract("ProjectToken", [
      "Wind Power Token", "WPT", 0, admin.address, 20_000_000n,
    ]);
    const nonceBefore = await ethers.provider.getTransactionCount(admin.address);
    await expect(assertP4Ready(project)).to.be.rejectedWith("Từ chối P4 trước khi gửi giao dịch");
    expect(await project.initialSupplyMinted()).to.equal(false);
    expect(await ethers.provider.getTransactionCount(admin.address)).to.equal(nonceBefore);
  });

  it("OP-05 ca 5: chặn cứng khi address book của chain có SpvPaymentVault, không cần signer", function () {
    const book = {
      chains: {
        "hardhat-local": { chainId: 31337, contracts: { ProjectToken: "0x1", SpvPaymentVault: "0x2" } },
        evm: { chainId: 11155111, contracts: { ProjectToken: "0x3" } },
      },
    };
    expect(() => assertNoVaultSuite(31337n, book)).to.throw("bộ hợp đồng có vault, dùng runbook OP-05");
    expect(() => assertNoVaultSuite(11155111n, book)).not.to.throw();
    expect(() => assertNoVaultSuite(5n, book)).not.to.throw();
    const withVault = { chains: { evm: { chainId: 11155111, contracts: { SpvPaymentVault: "0x4" } } } };
    expect(() => assertNoVaultSuite(11155111n, withVault)).to.throw("dùng runbook OP-05");
  });
});
