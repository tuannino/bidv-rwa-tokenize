const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deploySpecFixture, whitelist } = require("./helpers/spec-fixture");
const table = require("./fixtures/be13-vault-lock-table.json");

/**
 * BE-13 QĐ-G: chạy bảng số khoá dùng chung trên hợp đồng thật. Vault mock và hàm thuần của app
 * (`app/test/be-13-mock-vault.test.ts`) chạy CÙNG bảng; ba nơi khớp số sau từng bước thì mock
 * không thể dễ tính hơn hợp đồng. Không sửa `SpvPaymentVault`.
 */
const LOCK_MODES = { FIXED: 1, PERCENT: 2 };

async function deployVault() {
  const f = await deploySpecFixture();
  const vault = await ethers.deployContract("SpvPaymentVault", [
    await f.project.getAddress(),
    await f.payout.getAddress(),
    f.admin.address,
  ]);
  await vault.waitForDeployment();
  await whitelist(f.project, f.admin, [await vault.getAddress(), f.investorA, f.outsider]);
  await f.project.mintInitialSupply(await vault.getAddress(), 10_000n);
  for (const role of ["MATCHER_ROLE", "CONFIG_ROLE", "WITHDRAWER_ROLE"]) {
    await vault.grantRole(await vault[role](), f.admin.address);
  }
  await vault.setPayoutWallet(f.outsider.address);
  return { ...f, vault };
}

function orderRef(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("BE-13 - bảng số khoá vault dùng chung với mock", function () {
  for (const scenario of table.scenarios) {
    it(`${scenario.name}: ${scenario.note}`, async function () {
      const f = await deployVault();
      const vaultAddress = await f.vault.getAddress();
      let price = BigInt(scenario.price);
      for (const [index, step] of scenario.steps.entries()) {
        const label = `${scenario.name}#${index} ${step.op}`;
        const payoutBefore = await f.payout.balanceOf(f.outsider.address);
        if (step.op === "fund") {
          await f.payout.mint(vaultAddress, BigInt(step.amount));
        } else if (step.op === "setPercentRate") {
          await f.vault.setPercentRate(BigInt(step.bps));
        } else if (step.op === "setFixedLock") {
          await f.vault.setFixedLock(BigInt(step.amount));
        } else if (step.op === "setLockMode") {
          await f.vault.setLockMode(LOCK_MODES[step.mode]);
        } else if (step.op === "setPrice") {
          price = BigInt(step.price);
        } else if (step.op === "buy") {
          const wpt = BigInt(step.wpt);
          await f.payout.mint(vaultAddress, wpt * price);
          await f.vault.settleBuy(orderRef(label), f.investorA.address, wpt, wpt * price, price);
        } else if (step.op === "sell") {
          const wpt = BigInt(step.wpt);
          await f.project.connect(f.admin).forcedTransfer(f.investorA.address, vaultAddress, wpt);
          await f.vault.settleSell(orderRef(label), f.investorA.address, wpt, wpt * price, price);
        } else if (step.op === "closePeriod") {
          await f.vault.closePeriod(BigInt(step.periodRef), BigInt(step.distributedPrev));
        } else if (step.op === "withdrawHalf") {
          await f.vault.withdraw((await f.vault.withdrawable()) / 2n);
        } else if (step.op === "withdraw") {
          await f.vault.withdraw(BigInt(step.amount));
        } else {
          throw new Error(`Bước lạ trong bảng số: ${step.op}`);
        }

        const want = step.expect;
        expect(await f.vault.netProceeds(), `${label} netProceeds`).to.equal(BigInt(want.netProceeds));
        expect(await f.payout.balanceOf(vaultAddress), `${label} vndbBalance`).to.equal(BigInt(want.vndbBalance));
        expect(await f.vault.lockedAmount(), `${label} locked`).to.equal(BigInt(want.locked));
        expect(await f.vault.withdrawable(), `${label} withdrawable`).to.equal(BigInt(want.withdrawable));
        if (want.percentLocked !== undefined) {
          expect(await f.vault.percentLocked(), `${label} percentLocked`).to.equal(BigInt(want.percentLocked));
        }
        if (want.percentRateBps !== undefined) {
          expect(await f.vault.percentRateBps(), `${label} percentRateBps`).to.equal(BigInt(want.percentRateBps));
        }
        if (want.pendingPercentRateBps !== undefined) {
          expect(await f.vault.hasPendingRate(), `${label} hasPendingRate`).to.equal(true);
          expect(await f.vault.pendingPercentRateBps(), `${label} pending`).to.equal(BigInt(want.pendingPercentRateBps));
        }
        if (want.withdrawn !== undefined) {
          const received = (await f.payout.balanceOf(f.outsider.address)) - payoutBefore;
          expect(received, `${label} withdrawn`).to.equal(BigInt(want.withdrawn));
        }
      }
    });
  }
});
