const { expect } = require("chai");
const { ethers } = require("hardhat");
const { assertP4Ready } = require("../scripts/dod-verify-sepolia");

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
});
