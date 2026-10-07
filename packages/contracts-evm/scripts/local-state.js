// Kiểm nút hardhat cục bộ so với addresses.json và bản biên dịch hiện tại. KHÔNG gửi giao dịch.
// Do scripts/evm-local.sh gọi; mã thoát là kết luận:
//
//   0   bytecode ở mọi địa chỉ khớp bản biên dịch   -> không cần triển khai
//   10  chưa có hợp đồng nào và nút còn mới (khối 0) -> triển khai được
//   20  lệch bản biên dịch, thiếu một phần, hoặc nút đã có giao dịch lạ -> phải `reset`
//
//   npx hardhat run scripts/local-state.js --network localhost
const fs = require("fs");
const path = require("path");
const { ethers, artifacts } = require("hardhat");

const ADDRESSES_FILE = path.resolve(__dirname, "../../shared/src/addresses.json");

/**
 * Bytecode trên chuỗi, với các vùng `immutable` đặt về 0 như trong artifact.
 * Giá trị immutable (decimals, địa chỉ token) chỉ có sau constructor nên artifact để trống.
 */
async function maskedOnchainCode(name, code) {
  const artifact = await artifacts.readArtifact(name);
  const buildInfo = await artifacts.getBuildInfo(`${artifact.sourceName}:${artifact.contractName}`);
  const refs =
    buildInfo.output.contracts[artifact.sourceName][artifact.contractName].evm.deployedBytecode
      .immutableReferences ?? {};
  let hex = code.slice(2).toLowerCase();
  for (const { start, length } of Object.values(refs).flat()) {
    hex = hex.slice(0, start * 2) + "0".repeat(length * 2) + hex.slice((start + length) * 2);
  }
  return { onchain: hex, compiled: artifact.deployedBytecode.slice(2).toLowerCase() };
}

async function main() {
  const book = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  const contracts = book.chains?.["hardhat-local"]?.contracts ?? {};
  const problems = [];
  let present = 0;

  for (const [name, address] of Object.entries(contracts)) {
    const code = await ethers.provider.getCode(address);
    if (code === "0x") {
      problems.push(`${name} chưa có ở ${address}`);
      continue;
    }
    present += 1;
    const { onchain, compiled } = await maskedOnchainCode(name, code);
    if (onchain !== compiled) problems.push(`${name} ở ${address} lệch bản biên dịch hiện tại`);
  }

  if (problems.length === 0 && present > 0) {
    console.log("Hợp đồng đã có và khớp bản biên dịch hiện tại.");
    return;
  }
  const block = await ethers.provider.getBlockNumber();
  if (present === 0 && block === 0) {
    console.log("Nút mới, chưa có hợp đồng.");
    process.exitCode = 10;
    return;
  }
  if (present === 0) problems.push(`nút đã có ${block} khối, triển khai lên đó sẽ ra địa chỉ khác`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exitCode = 20;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
