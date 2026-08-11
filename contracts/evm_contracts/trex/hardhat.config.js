require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
const { subtask } = require("hardhat/config");

// T-REX pin cứng solc 0.8.17. Sandbox chặn binaries.soliditylang.org nên trỏ về
// gói WASM cài qua npm dưới alias "solc-0817" (= solc@0.8.17).
// Trên máy internet bình thường KHÔNG cần đoạn này — Hardhat tự tải solc.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.17") {
    try {
      return {
        compilerPath: require.resolve("solc-0817/soljson.js"),
        isSolcJs: true,
        version: args.solcVersion,
        longVersion: require("solc-0817").version(),
      };
    } catch (_) {}
  }
  return runSuper();
});

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "london" },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts,
      chainId: 11155111,
    },
    besu: {
      url: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
      accounts,
      chainId: Number(process.env.BESU_CHAIN_ID || 1337),
      gasPrice: 0,
    },
  },
};
