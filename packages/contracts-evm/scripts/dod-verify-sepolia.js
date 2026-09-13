/**
 * LỚP 2 - NGHIỆM THU DoD TRÊN ETHEREUM TESTNET (SEPOLIA)
 *
 * Chạy chu kỳ nghiệp vụ THẬT trên Sepolia và in bằng chứng: số dư trước/sau,
 * hash giao dịch và link Etherscan cho từng bước. Đây là thứ dán vào checkpoint.
 *
 * Cách chạy (từ packages/contracts-evm):
 *   npx hardhat run scripts/dod-verify-sepolia.js --network sepolia
 *
 * Biến môi trường cần có:
 *   SEPOLIA_RPC_URL, PRIVATE_KEY                        (ví ngân hàng, có ETH test)
 *   ADDR_PROJECT_TOKEN, ADDR_VND_TOKEN,
 *   ADDR_PROFIT_DISTRIBUTOR, ADDR_REDEMPTION            (địa chỉ đã deploy)
 *   ADDR_ENERGY_ORACLE                                  (tùy chọn, để chạy nhánh oracle)
 *   INVESTOR_A, INVESTOR_B                               (địa chỉ ví nhà đầu tư)
 *
 * Cờ chọn luồng (mặc định chạy cả ba):
 *   ONLY=p4 | p7 | p12
 *
 * LƯU Ý: script này TIÊU ETH THẬT của testnet và thay đổi trạng thái on-chain.
 * Không chạy trên mạng chính.
 */
const { ethers, network } = require("hardhat");

const EXPLORER = "https://sepolia.etherscan.io";
const ONLY = (process.env.ONLY || "").toLowerCase();

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Thiếu biến môi trường ${k}`);
  return v;
};

let step = 0;
const results = [];

function head(t) {
  console.log(`\n${"=".repeat(72)}\n  ${t}\n${"=".repeat(72)}`);
}

/** Gửi giao dịch, chờ xác nhận, in link tra cứu. */
async function send(label, txPromise) {
  step += 1;
  process.stdout.write(`  [${step}] ${label} ... `);
  const tx = await txPromise;
  const rc = await tx.wait();
  const ok = rc.status === 1;
  console.log(ok ? "CONFIRMED" : "FAILED");
  console.log(`      tx:   ${tx.hash}`);
  console.log(`      link: ${EXPLORER}/tx/${tx.hash}`);
  console.log(`      gas:  ${rc.gasUsed.toString()}`);
  results.push({ step, label, hash: tx.hash, ok, gas: rc.gasUsed.toString() });
  if (!ok) throw new Error(`Giao dịch thất bại: ${label}`);
  return rc;
}

function assertEq(label, actual, expected) {
  const a = actual.toString();
  const e = expected.toString();
  const ok = a === e;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${a}${ok ? "" : ` (kỳ vọng ${e})`}`);
  results.push({ label, ok, actual: a, expected: e });
  if (!ok) throw new Error(`DoD không đạt: ${label}`);
}

async function main() {
  if (network.name === "hardhat") {
    throw new Error("Script này dành cho testnet. Thêm --network sepolia.");
  }

  const [bank] = await ethers.getSigners();
  const investorA = need("INVESTOR_A");
  const investorB = process.env.INVESTOR_B || investorA;

  head("MÔI TRƯỜNG");
  console.log(`  Mạng:          ${network.name}`);
  console.log(`  Ví ngân hàng:  ${bank.address}`);
  const ethBal = await ethers.provider.getBalance(bank.address);
  console.log(`  Số dư ETH:     ${ethers.formatEther(ethBal)}`);
  if (ethBal === 0n) throw new Error("Ví ngân hàng hết ETH test. Nạp qua faucet Sepolia.");

  const project = await ethers.getContractAt("ProjectToken", need("ADDR_PROJECT_TOKEN"));
  const payout = await ethers.getContractAt("VNDToken", need("ADDR_VND_TOKEN"));

  head("BU7 - ĐỌC ĐƯỢC THÔNG TIN TOKEN TRÊN TESTNET");
  const [nm, sym, dec] = await Promise.all([project.name(), project.symbol(), project.decimals()]);
  console.log(`  Token dự án:   ${nm} (${sym}), decimals ${dec}`);
  console.log(`  Token chi trả: ${await payout.name()} (${await payout.symbol()})`);
  console.log(`  Link contract: ${EXPLORER}/address/${await project.getAddress()}`);
  if (sym !== "WPT") {
    console.log(`  WARN  ký hiệu là "${sym}", kỳ vọng "WPT" (nợ P1 đổi tên chưa xong)`);
  }

  // =====================================================================
  //  P4 - MINT
  // =====================================================================
  if (!ONLY || ONLY === "p4") {
    head("P4 - PHÁT HÀNH WPT");
    const before = await project.balanceOf(investorA);
    console.log(`  Số dư WPT của A trước: ${before}`);

    if (!(await project.isWhitelisted(investorA))) {
      await send("whitelist nhà đầu tư A", project.setWhitelisted(investorA, true));
    } else {
      console.log("  (A đã whitelist, bỏ qua)");
    }
    assertEq("A đã whitelist", await project.isWhitelisted(investorA), true);

    const MINT = 100n;
    await send(`mint ${MINT} WPT cho A`, project.mint(investorA, MINT));
    assertEq("số dư WPT của A sau mint", await project.balanceOf(investorA), before + MINT);
  }

  // =====================================================================
  //  P7 - CHIA LỢI TỨC
  // =====================================================================
  if (!ONLY || ONLY === "p7") {
    head("P7 - CHIA LỢI TỨC");
    const distributor = await ethers.getContractAt(
      "ProfitDistributorOracle",
      need("ADDR_PROFIT_DISTRIBUTOR")
    );
    const distAddr = await distributor.getAddress();

    // Điều kiện gate: distributor phải có SNAPSHOT_ROLE, thiếu là lỗi hay gặp nhất.
    const hasSnap = await project.hasRole(await project.SNAPSHOT_ROLE(), distAddr);
    assertEq("distributor có SNAPSHOT_ROLE", hasSnap, true);

    const AMOUNT = 1_000_000n;
    const bankVnd = await payout.balanceOf(bank.address);
    console.log(`  Số dư VNDB của ngân hàng: ${bankVnd}`);
    if (bankVnd < AMOUNT) {
      await send(`mint ${AMOUNT} VNDB cho ngân hàng`, payout.mint(bank.address, AMOUNT));
    }
    await send("approve VNDB cho distributor", payout.approve(distAddr, AMOUNT));

    const period = `DOD-${Date.now()}`;
    await send(`tạo kỳ chia ${AMOUNT} VNDB`, distributor.createDistribution(AMOUNT, period));

    const id = (await distributor.distributionsCount()) - 1n;
    const d = await distributor.distributions(id);
    console.log(`  Kỳ id=${id}, snapshotId=${d.snapshotId}, tổng cung tại snapshot=${d.supplyAtSnapshot}`);
    assertEq("tổng tiền kỳ chia", d.amount, AMOUNT);

    const entA = await distributor.entitlementOf(id, investorA);
    const entB = await distributor.entitlementOf(id, investorB);
    console.log(`  Phần của A: ${entA}   Phần của B: ${entB}`);
    assertEq(
      "tổng phần chia không vượt tổng tiền",
      entA + entB <= AMOUNT,
      true
    );

    // Ngân hàng chia hộ để không cần khóa của nhà đầu tư.
    const vndBeforeA = await payout.balanceOf(investorA);
    await send("chia hộ cho A", distributor.distributeTo(id, [investorA]));
    assertEq("VNDB của A sau khi nhận", await payout.balanceOf(investorA), vndBeforeA + entA);
    assertEq("A đã được đánh dấu đã nhận", await distributor.hasClaimed(id, investorA), true);

    // Nhánh oracle (tùy chọn)
    if (process.env.ADDR_ENERGY_ORACLE) {
      head("P7 - NHÁNH ORACLE SẢN LƯỢNG");
      const oracle = await ethers.getContractAt("EnergyOracle", process.env.ADDR_ENERGY_ORACLE);
      const pid = Math.floor(Date.now() / 1000);
      await send(
        `nộp số liệu sản lượng kỳ ${pid}`,
        oracle.submitReading(pid, 1_000_000, 2_000, 500_000_000, 3_000)
      );
      assertEq("kỳ oracle đã chốt", await oracle.isFinalized(pid), true);
      const profit = await oracle.distributableProfitVnd(pid);
      console.log(`  Lợi nhuận phân phối theo oracle: ${profit}`);
      assertEq("lợi nhuận phân phối đúng công thức", profit, 450_000_000n);
    } else {
      console.log("\n  (Bỏ qua nhánh oracle: chưa đặt ADDR_ENERGY_ORACLE)");
    }
  }

  // =====================================================================
  //  P12 - TẤT TOÁN
  // =====================================================================
  if (!ONLY || ONLY === "p12") {
    head("P12 - TẤT TOÁN");
    const redemption = await ethers.getContractAt("Redemption", need("ADDR_REDEMPTION"));
    const redAddr = await redemption.getAddress();

    const rate = await redemption.rate();
    const paused = await redemption.paused();
    console.log(`  Tỷ giá: ${rate} VNDB / WPT     Tạm dừng: ${paused}`);
    assertEq("không ở trạng thái tạm dừng", paused, false);

    const REDEEM = 10n;
    const quote = await redemption.quote(REDEEM);
    console.log(`  Quote cho ${REDEEM} WPT: ${quote} VNDB`);

    const liq = await payout.balanceOf(redAddr);
    console.log(`  Thanh khoản VNDB của hợp đồng: ${liq}`);
    if (liq < quote) {
      const gap = quote - liq;
      await send(`mint ${gap} VNDB để nạp kho`, payout.mint(bank.address, gap));
      await send("approve VNDB cho Redemption", payout.approve(redAddr, gap));
      await send(`nạp kho ${gap} VNDB`, redemption.fund(gap));
    }
    assertEq("thanh khoản đủ cho lần tất toán", (await payout.balanceOf(redAddr)) >= quote, true);

    // Bản EVM cần approve WPT vì redeem dùng burnFrom.
    // Ví ngân hàng tự tất toán để không cần khóa của nhà đầu tư.
    const wptBank = await project.balanceOf(bank.address);
    if (wptBank < REDEEM) {
      if (!(await project.isWhitelisted(bank.address))) {
        await send("whitelist ví ngân hàng", project.setWhitelisted(bank.address, true));
      }
      await send(`mint ${REDEEM} WPT cho ví ngân hàng`, project.mint(bank.address, REDEEM));
    }

    const supplyBefore = await project.totalSupply();
    const vndBefore = await payout.balanceOf(bank.address);

    await send("approve WPT cho Redemption", project.approve(redAddr, REDEEM));
    await send(`tất toán ${REDEEM} WPT`, redemption.redeem(REDEEM));

    assertEq("tổng cung WPT giảm đúng", await project.totalSupply(), supplyBefore - REDEEM);
    assertEq("VNDB nhận về đúng quote", (await payout.balanceOf(bank.address)) - vndBefore, quote);
  }

  // =====================================================================
  head("TỔNG KẾT NGHIỆM THU");
  const failed = results.filter((r) => r.ok === false);
  const txs = results.filter((r) => r.hash);
  console.log(`  Giao dịch đã gửi: ${txs.length}`);
  console.log(`  Kiểm tra thất bại: ${failed.length}`);
  console.log("\n  Danh sách giao dịch để dán vào checkpoint:");
  for (const t of txs) {
    console.log(`    - ${t.label}: ${EXPLORER}/tx/${t.hash}`);
  }
  if (failed.length > 0) {
    console.log("\n  => KHÔNG ĐẠT DoD.");
    process.exitCode = 1;
  } else {
    console.log("\n  => ĐẠT DoD trên testnet.");
  }
}

main().catch((e) => {
  console.error(`\n  LỖI: ${e.message}`);
  process.exitCode = 1;
});
