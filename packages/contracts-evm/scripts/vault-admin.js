// Cấu hình tạm SpvPaymentVault cho tới FE-07. Mặc định chỉ in kế hoạch;
// đặt VAULT_ADMIN_CONFIRM=yes mới gửi giao dịch.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const ADDRESS_FILE = path.resolve(__dirname, "../../shared/src/addresses.json");
const ACTIONS = [
  "status", "set-mode", "set-fixed", "set-rate", "close-period",
  "set-payout", "pause", "unpause",
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến ${name}.`);
  return value;
}

function uint(name) {
  const value = required(name);
  if (!/^\d+$/.test(value)) throw new Error(`${name} phải là số nguyên không âm.`);
  return BigInt(value);
}

function chainKey(chainId) {
  return chainId === 31337n || chainId === 1337n ? "hardhat-local" : "evm";
}

async function printStatus(vault) {
  const values = await Promise.all([
    vault.getAddress(), vault.projectToken(), vault.paymentToken(), vault.lockMode(),
    vault.fixedLockAmount(), vault.percentRateBps(), vault.pendingPercentRateBps(),
    vault.hasPendingRate(), vault.netProceeds(), vault.lockedAmount(), vault.withdrawable(),
    vault.lastPeriodRef(), vault.lastDistributedPrev(), vault.percentLocked(),
    vault.payoutWallet(), vault.paused(),
  ]);
  const keys = [
    "vault", "projectToken", "paymentToken", "lockMode", "fixedLockAmount",
    "percentRateBps", "pendingPercentRateBps", "hasPendingRate", "netProceeds",
    "lockedAmount", "withdrawable", "lastPeriodRef", "lastDistributedPrev",
    "percentLocked", "payoutWallet", "withdrawalsPaused",
  ];
  for (let i = 0; i < keys.length; i++) console.log(`${keys[i]}=${values[i]}`);
}

function actionCall(vault, action) {
  if (action === "set-mode") {
    const raw = required("VAULT_LOCK_MODE").toUpperCase();
    const modes = { FIXED: 1, PERCENT: 2 };
    if (!modes[raw]) throw new Error("VAULT_LOCK_MODE chỉ nhận FIXED hoặc PERCENT.");
    return { label: `setLockMode(${raw})`, send: () => vault.setLockMode(modes[raw]) };
  }
  if (action === "set-fixed") {
    const amount = uint("VAULT_FIXED_AMOUNT");
    return { label: `setFixedLock(${amount})`, send: () => vault.setFixedLock(amount) };
  }
  if (action === "set-rate") {
    const bps = uint("VAULT_PERCENT_BPS");
    return { label: `setPercentRate(${bps})`, send: () => vault.setPercentRate(bps) };
  }
  if (action === "close-period") {
    const periodRef = uint("VAULT_PERIOD_REF");
    const distributed = uint("VAULT_DISTRIBUTED_PREV");
    const label = process.env.VAULT_PERIOD_LABEL ? ` label=${process.env.VAULT_PERIOD_LABEL}` : "";
    return {
      label: `closePeriod(${periodRef}, ${distributed})${label}`,
      send: () => vault.closePeriod(periodRef, distributed),
    };
  }
  if (action === "set-payout") {
    const wallet = required("VAULT_PAYOUT_WALLET");
    if (!ethers.isAddress(wallet) || wallet === ethers.ZeroAddress) throw new Error("VAULT_PAYOUT_WALLET không hợp lệ.");
    return { label: `setPayoutWallet(${ethers.getAddress(wallet)})`, send: () => vault.setPayoutWallet(wallet) };
  }
  if (action === "pause") return { label: "pauseWithdrawals()", send: () => vault.pauseWithdrawals() };
  if (action === "unpause") return { label: "unpauseWithdrawals()", send: () => vault.unpauseWithdrawals() };
  throw new Error(`VAULT_ADMIN_ACTION hợp lệ: ${ACTIONS.join(", ")}.`);
}

async function main() {
  const action = (process.env.VAULT_ADMIN_ACTION || "status").toLowerCase();
  const { chainId } = await ethers.provider.getNetwork();
  const key = chainKey(chainId);
  const book = JSON.parse(fs.readFileSync(ADDRESS_FILE, "utf8")).chains ?? {};
  const address = book[key]?.contracts?.SpvPaymentVault;
  if (!address) throw new Error(`Chain ${key} chưa có SpvPaymentVault trong addresses.json.`);
  const vault = await ethers.getContractAt("SpvPaymentVault", address);
  if (action === "status") return printStatus(vault);

  const call = actionCall(vault, action);
  if (process.env.VAULT_ADMIN_CONFIRM !== "yes") {
    console.log(`DRY-RUN: sẽ gửi ${call.label}`);
    console.log("Đặt VAULT_ADMIN_CONFIRM=yes để gửi.");
    return;
  }
  const tx = await call.send();
  console.log(`Đã gửi ${call.label}; tx=${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Giao dịch vault chưa có receipt thành công.");
  console.log(`CONFIRMED block=${receipt.blockNumber}`);
}

if (require.main === module) main().catch((error) => {
  console.error(`LỖI: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { actionCall, printStatus };
