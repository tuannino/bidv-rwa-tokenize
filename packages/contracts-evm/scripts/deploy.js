// Triển khai bộ hợp đồng RWA ĐIỆN GIÓ + xuất địa chỉ/ABI sang packages/shared.
//
//   npx hardhat run scripts/deploy.js --network localhost
//
// Sau khi deploy, script ghi:
//   packages/shared/src/addresses.json        <- MỘT nguồn sự thật về địa chỉ (web đọc)
//   packages/shared/generated/<Name>.abi.json <- ABI đầy đủ, CHỈ để test đối chiếu (không ship lên web)
//
// Thứ tự deploy KHÔNG được đổi tuỳ tiện: địa chỉ hardhat-local là tất định theo nonce,
// và addresses.json cho hardhat-local được commit dựa trên thứ tự này.
const fs = require("fs");
const path = require("path");
const { ethers, network, artifacts } = require("hardhat");

const SHARED_DIR = path.resolve(__dirname, "../../shared");
const ADDRESSES_FILE = path.join(SHARED_DIR, "src/addresses.json");
const GENERATED_ABI_DIR = path.join(SHARED_DIR, "generated");

/** Map chainId -> ChainKey của app (xem packages/shared/src/types.ts). */
function chainKeyFor(chainId) {
  if (chainId === 31337n || chainId === 1337n) return "hardhat-local";
  return "evm";
}

/** Xuất ABI đầy đủ (không bytecode) để test đối chiếu với ABI tối giản. */
async function exportAbi(contractName) {
  const artifact = await artifacts.readArtifact(contractName);
  fs.mkdirSync(GENERATED_ABI_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(GENERATED_ABI_DIR, `${contractName}.abi.json`),
    `${JSON.stringify(artifact.abi, null, 2)}\n`,
    "utf8",
  );
}

/** Ghi addresses.json, GIỮ LẠI các chain khác đã có trong file. */
function writeAddresses(chainKey, record) {
  let book = { _comment: "", chains: {} };
  if (fs.existsSync(ADDRESSES_FILE)) {
    try {
      book = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
    } catch {
      /* file hỏng thì ghi lại từ đầu */
    }
  }
  book._comment =
    "SINH TỰ ĐỘNG bởi packages/contracts-evm/scripts/deploy.js — đừng sửa tay. " +
    "Địa chỉ hardhat-local là tất định (cùng deployer + cùng thứ tự deploy) nên commit được, " +
    "dùng cả ở free-tier (không có filesystem).";
  book.chains = { ...(book.chains || {}), [chainKey]: record };
  fs.mkdirSync(path.dirname(ADDRESSES_FILE), { recursive: true });
  fs.writeFileSync(ADDRESSES_FILE, `${JSON.stringify(book, null, 2)}\n`, "utf8");
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = deployer.address; // ngân hàng = admin + minter + agent + snapshot + pauser
  const { chainId } = await ethers.provider.getNetwork();
  const chainKey = chainKeyFor(chainId);

  console.log(`Mạng: ${network.name} (chainId=${chainId}) -> chainKey="${chainKey}"`);
  console.log(`Người triển khai (ngân hàng): ${admin}`);

  // 1) Token — chủ đề ĐIỆN GIÓ. Ký hiệu WPT = Wind Power Token (docs/SPEC.md §1), decimals = 0.
  const wpt = await ethers.deployContract("ProjectToken", [
    "Wind Power Token",
    "WPT",
    0,
    admin,
  ]);
  await wpt.waitForDeployment();

  const vnd = await ethers.deployContract("VNDToken", [admin]);
  await vnd.waitForDeployment();

  // 2) Nghiệp vụ (chưa dùng ở P1, deploy sẵn cho P2/P3)
  const distributor = await ethers.deployContract("ProfitDistributor", [
    await wpt.getAddress(),
    await vnd.getAddress(),
    admin,
  ]);
  await distributor.waitForDeployment();

  const rate = 1_000_000n; // 1 WPT = 1.000.000 tVND
  const redemption = await ethers.deployContract("Redemption", [
    await wpt.getAddress(),
    await vnd.getAddress(),
    rate,
    admin,
  ]);
  await redemption.waitForDeployment();

  // 3) Distributor cần chốt snapshot trên WPT
  const SNAPSHOT_ROLE = await wpt.SNAPSHOT_ROLE();
  await (await wpt.grantRole(SNAPSHOT_ROLE, await distributor.getAddress())).wait();

  const contracts = {
    ProjectToken: await wpt.getAddress(),
    VNDToken: await vnd.getAddress(),
    ProfitDistributor: await distributor.getAddress(),
    Redemption: await redemption.getAddress(),
  };

  // 4) Xuất sang packages/shared
  writeAddresses(chainKey, {
    chainId: Number(chainId),
    deployer: admin,
    deployedAt: new Date().toISOString(),
    contracts,
  });
  for (const name of ["ProjectToken", "VNDToken", "ProfitDistributor", "Redemption"]) {
    await exportAbi(name);
  }

  console.log("\n=== ĐỊA CHỈ HỢP ĐỒNG ===");
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`${name.padEnd(20)} ${address}`);
  }
  console.log(`\nĐã ghi: ${path.relative(process.cwd(), ADDRESSES_FILE)}`);
  console.log(`Đã ghi ABI đối chiếu: ${path.relative(process.cwd(), GENERATED_ABI_DIR)}/`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
