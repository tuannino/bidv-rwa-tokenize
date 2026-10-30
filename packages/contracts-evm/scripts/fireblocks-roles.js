// IN-04 G1: cấp, thu hồi MINTER_ROLE và AGENT_ROLE trên ProjectToken cho vault Fireblocks của ngân hàng.
// Mặc định chỉ in kế hoạch; đặt FIREBLOCKS_ROLES_CONFIRM=yes mới gửi giao dịch.
//
// LƯU Ý: AGENT_ROLE ngoài Burn còn cho phép đóng băng ví và chuyển cưỡng bức (forcedTransfer). Chỉ cấp cho
// vault dùng cho luồng lập và duyệt; THU HỒI ngay khi thôi dùng Fireblocks (FIREBLOCKS_ROLES_ACTION=revoke).
//
// Dùng: FIREBLOCKS_VAULT_ADDRESS=0x... [FIREBLOCKS_ROLES_ACTION=status|grant|revoke] \
//       npx hardhat run scripts/fireblocks-roles.js --network sepolia
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const ADDRESS_FILE = path.resolve(__dirname, "../../shared/src/addresses.json");
const ACTIONS = ["status", "grant", "revoke"];
const ROLES = ["MINTER_ROLE", "AGENT_ROLE"];

function chainKey(chainId) {
  return chainId === 31337n || chainId === 1337n ? "hardhat-local" : "evm";
}

function vaultAddress() {
  const value = process.env.FIREBLOCKS_VAULT_ADDRESS;
  if (!value) throw new Error("Thiếu biến FIREBLOCKS_VAULT_ADDRESS.");
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error("FIREBLOCKS_VAULT_ADDRESS không phải địa chỉ EVM hợp lệ.");
  }
  return ethers.getAddress(value);
}

async function roleIds(token) {
  return Object.fromEntries(await Promise.all(ROLES.map(async (name) => [name, await token[name]()])));
}

async function printStatus(token, vault, ids) {
  console.log(`projectToken=${await token.getAddress()}`);
  console.log(`vault=${vault}`);
  for (const name of ROLES) console.log(`${name}=${await token.hasRole(ids[name], vault)}`);
}

/** Lời gọi cần gửi: chỉ vai chưa đúng trạng thái mong muốn. */
async function plannedCalls(token, vault, ids, action) {
  const calls = [];
  for (const name of ROLES) {
    const has = await token.hasRole(ids[name], vault);
    if (action === "grant" && !has) {
      calls.push({ label: `grantRole(${name}, ${vault})`, send: () => token.grantRole(ids[name], vault) });
    }
    if (action === "revoke" && has) {
      calls.push({ label: `revokeRole(${name}, ${vault})`, send: () => token.revokeRole(ids[name], vault) });
    }
  }
  return calls;
}

async function main() {
  const action = (process.env.FIREBLOCKS_ROLES_ACTION || "status").toLowerCase();
  if (!ACTIONS.includes(action)) throw new Error(`FIREBLOCKS_ROLES_ACTION hợp lệ: ${ACTIONS.join(", ")}.`);
  const vault = vaultAddress();
  const { chainId } = await ethers.provider.getNetwork();
  const key = chainKey(chainId);
  const book = JSON.parse(fs.readFileSync(ADDRESS_FILE, "utf8")).chains ?? {};
  const address = book[key]?.contracts?.ProjectToken;
  if (!address) throw new Error(`Chain ${key} chưa có ProjectToken trong addresses.json.`);
  const token = await ethers.getContractAt("ProjectToken", address);
  const ids = await roleIds(token);

  await printStatus(token, vault, ids);
  if (action === "status") return;

  const calls = await plannedCalls(token, vault, ids, action);
  if (calls.length === 0) {
    console.log(`Không có gì để ${action === "grant" ? "cấp" : "thu hồi"}: vault đã đúng trạng thái.`);
    return;
  }
  if (process.env.FIREBLOCKS_ROLES_CONFIRM !== "yes") {
    for (const call of calls) console.log(`DRY-RUN: sẽ gửi ${call.label}`);
    console.log("Đặt FIREBLOCKS_ROLES_CONFIRM=yes để gửi.");
    return;
  }
  for (const call of calls) {
    const tx = await call.send();
    console.log(`Đã gửi ${call.label}; tx=${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`Giao dịch ${call.label} chưa có receipt thành công.`);
    console.log(`CONFIRMED block=${receipt.blockNumber}`);
  }
  await printStatus(token, vault, ids);
}

if (require.main === module) main().catch((error) => {
  console.error(`LỖI: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { plannedCalls, printStatus };
