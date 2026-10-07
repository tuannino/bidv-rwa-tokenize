// Dữ liệu mẫu trên chuỗi cục bộ: whitelist đúng hai ví khách hàng mẫu (NDT001, NB001).
// Chạy lại không gửi giao dịch thừa: ví đã whitelist thì bỏ qua.
//
//   npx hardhat run scripts/seed-local.js --network localhost
//
// Địa chỉ ví đọc từ packages/shared/src/sample-wallets.json, cùng tệp app đọc.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const SHARED_DIR = path.resolve(__dirname, "../../shared/src");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(SHARED_DIR, name), "utf8"));

async function main() {
  const { wallets } = readJson("sample-wallets.json");
  const address = readJson("addresses.json").chains["hardhat-local"].contracts.ProjectToken;
  const wpt = await ethers.getContractAt("ProjectToken", address);

  const pending = [];
  for (const [account, wallet] of Object.entries(wallets)) {
    if (await wpt.isWhitelisted(wallet)) console.log(`${account} ${wallet} đã whitelist`);
    else pending.push([account, wallet]);
  }
  if (pending.length > 0) {
    await (await wpt.batchSetWhitelisted(pending.map(([, wallet]) => wallet), true)).wait();
    for (const [account, wallet] of pending) console.log(`${account} ${wallet} vừa whitelist`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
