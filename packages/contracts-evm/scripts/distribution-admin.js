// Đóng kỳ chia lợi nhuận sau hạn nhận (SC-06 QĐ-H). Mặc định chỉ in kế hoạch;
// đặt DISTRIBUTION_ADMIN_CONFIRM=yes mới gửi giao dịch.
//
//   DISTRIBUTION_ADMIN_ACTION=status|close DISTRIBUTION_PERIOD_KEY=<chain>:<mã kỳ> \
//     npx hardhat run scripts/distribution-admin.js --network <mạng>
//
// `closeDistribution` không chuyển tiền: phần chưa trả trở về quỹ chưa phân bổ, kỳ sau chia tiếp.
// Ứng dụng đọc lại kỳ ở lượt chia sau và chuyển kỳ sang CLOSED. Cần DEFAULT_ADMIN_ROLE.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const ADDRESS_FILE = path.resolve(__dirname, "../../shared/src/addresses.json");
const ACTIONS = ["status", "close"];

function chainKey(chainId) {
  return chainId === 31337n || chainId === 1337n ? "hardhat-local" : "evm";
}

/** Kỳ trên chuỗi theo nhãn, kèm phần sẽ trở về quỹ nếu đóng bây giờ. */
async function readPeriod(distributor, periodKey) {
  const [exists, id] = await distributor.distributionIdOfPeriod(periodKey);
  if (!exists) throw new Error(`Không có kỳ chia mang nhãn "${periodKey}" trên chuỗi.`);
  const d = await distributor.distributions(id);
  const block = await ethers.provider.getBlock("latest");
  return {
    id,
    amount: d.amount,
    claimed: d.claimed,
    released: d.amount - d.claimed,
    claimDeadline: d.claimDeadline,
    closed: d.closed,
    expired: BigInt(block.timestamp) >= d.claimDeadline,
  };
}

function printPeriod(periodKey, period) {
  console.log(`periodKey=${periodKey}`);
  for (const [key, value] of Object.entries(period)) console.log(`${key}=${value}`);
}

async function main() {
  const action = (process.env.DISTRIBUTION_ADMIN_ACTION || "status").toLowerCase();
  if (!ACTIONS.includes(action)) throw new Error(`DISTRIBUTION_ADMIN_ACTION hợp lệ: ${ACTIONS.join(", ")}.`);
  const periodKey = process.env.DISTRIBUTION_PERIOD_KEY;
  if (!periodKey) throw new Error("Thiếu biến DISTRIBUTION_PERIOD_KEY (nhãn kỳ, ví dụ evm:2026-Q1).");

  const { chainId } = await ethers.provider.getNetwork();
  const key = chainKey(chainId);
  const book = JSON.parse(fs.readFileSync(ADDRESS_FILE, "utf8")).chains ?? {};
  const address = book[key]?.contracts?.ProfitDistributor;
  if (!address) throw new Error(`Chain ${key} chưa có ProfitDistributor trong addresses.json.`);
  const distributor = await ethers.getContractAt("ProfitDistributor", address);

  const period = await readPeriod(distributor, periodKey);
  printPeriod(periodKey, period);
  if (action === "status") return;

  if (period.closed) throw new Error(`Kỳ "${periodKey}" đã đóng.`);
  if (!period.expired) {
    throw new Error(`Kỳ "${periodKey}" chưa hết hạn nhận (hạn ${period.claimDeadline}); hợp đồng sẽ từ chối.`);
  }
  const label = `closeDistribution(${period.id}) trả ${period.released} VNDB về quỹ chưa phân bổ`;
  if (process.env.DISTRIBUTION_ADMIN_CONFIRM !== "yes") {
    console.log(`DRY-RUN: sẽ gửi ${label}`);
    console.log("Đặt DISTRIBUTION_ADMIN_CONFIRM=yes để gửi.");
    return;
  }
  const tx = await distributor.closeDistribution(period.id);
  console.log(`Đã gửi ${label}; tx=${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Giao dịch đóng kỳ chưa có receipt thành công.");
  console.log(`CONFIRMED block=${receipt.blockNumber}`);
}

if (require.main === module) main().catch((error) => {
  console.error(`LỖI: ${error.message}`);
  process.exitCode = 1;
});

module.exports = { readPeriod };
