require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
const { subtask } = require("hardhat/config");

// Môi trường sandbox chặn binaries.soliditylang.org => dùng gói `solc` cục bộ (WASM).
// Khi Sếp chạy ở máy có internet bình thường thì KHÔNG cần đoạn override này,
// Hardhat sẽ tự tải solc. Để lại cũng không sao vì nó chỉ can thiệp đúng version 0.8.28.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  try {
    if (args.solcVersion === "0.8.28") {
      const compilerPath = require.resolve("solc/soljson.js");
      return {
        compilerPath,
        isSolcJs: true,
        version: args.solcVersion,
        longVersion: require("solc").version(),
      };
    }
  } catch (_) {}
  return runSuper();
});

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris", // an toàn cho Hyperledger Besu và đa số testnet EVM
    },
  },
  networks: {
    hardhat: {},
    // Testnet công khai Sepolia. Đặt RPC + khóa trong .env (xem .env.example).
    // Mặc định là endpoint công khai không cần API key; `https://rpc.sepolia.org` cũ đã
    // CHẾT (trả HTTP 404) nên không dùng làm fallback nữa.
    // Deploy/verify nên đặt SEPOLIA_RPC_URL trỏ RPC có API key cho ổn định.
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts,
      chainId: 11155111,
    },
    // Mạng permissioned EVM (Hyperledger Besu) dựng nội bộ
    besu: {
      url: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
      accounts,
      chainId: Number(process.env.BESU_CHAIN_ID || 1337),
      gasPrice: 0, // mạng Besu dev thường free-gas
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
