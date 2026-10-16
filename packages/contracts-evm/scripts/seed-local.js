// Dữ liệu mẫu trên chuỗi cục bộ: đăng ký danh tính cho các ví khách hàng mẫu.
// Chạy lại không gửi giao dịch thừa: ví đã xác minh thì bỏ qua.
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
  const contracts = readJson("addresses.json").chains["hardhat-local"].contracts;
  const registry = await ethers.getContractAt("IdentityRegistry", contracts.IdentityRegistry);

  const pending = [];
  for (const [account, wallet] of Object.entries(wallets)) {
    if (await registry.isVerified(wallet)) console.log(`${account} ${wallet} đã xác minh`);
    else pending.push([account, wallet]);
  }
  if (pending.length > 0) {
    await (
      await registry.batchRegisterIdentity(
        pending.map(([, wallet]) => wallet),
        pending.map(() => 704),
      )
    ).wait();
    for (const [account, wallet] of pending) console.log(`${account} ${wallet} vừa xác minh`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
