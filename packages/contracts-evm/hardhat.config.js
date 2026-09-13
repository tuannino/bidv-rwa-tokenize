require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
const { subtask } = require("hardhat/config");

// Dùng gói `solc` cục bộ (WASM) thay vì tải binary chính thức — CHỈ khi bật tường minh:
//   USE_LOCAL_SOLC=1 npx hardhat compile
// Dành cho môi trường bị chặn binaries.soliditylang.org.
//
// ⚠️ KHÔNG bật mặc định. solcjs báo longVersion có hậu tố `.Emscripten.clang`
// ("0.8.28+commit.7893614a.Emscripten.clang"), và Etherscan từ chối metadata đó với lỗi
// "Invalid Or Not supported solc version" -> KHÔNG verify được contract (T0.6 của spec p4).
// Trước đây override này luôn bật, nên verify chắc chắn fail.
if (process.env.USE_LOCAL_SOLC === "1") {
  subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
    try {
      if (args.solcVersion === "0.8.28") {
        return {
          compilerPath: require.resolve("solc/soljson.js"),
          isSolcJs: true,
          version: args.solcVersion,
          longVersion: require("solc").version(),
        };
      }
    } catch (_) {}
    return runSuper();
  });
}

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
