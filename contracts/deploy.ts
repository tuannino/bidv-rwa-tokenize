/**
 * Deploy script — AssetRegistry trên Polygon Amoy
 * Chạy: npx ts-node contracts/deploy.ts
 *
 * Yêu cầu: DEPLOYER_PRIVATE_KEY trong .env
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

// Sau khi compile bằng hardhat: artifacts/contracts/AssetRegistry.sol/AssetRegistry.json
const ARTIFACT_PATH = path.join(
  __dirname,
  "../artifacts/contracts/AssetRegistry.sol/AssetRegistry.json"
);

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");

  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.NEXT_PUBLIC_ALCHEMY_ID
    ? `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`
    : "https://rpc-amoy.polygon.technology"; // public RPC fallback

  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });

  console.log(`Deploying AssetRegistry from: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} MATIC`);

  if (balance === 0n) {
    console.error(
      "No MATIC balance. Get test MATIC from: https://faucet.polygon.technology/"
    );
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf-8"));
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });

  console.log(`Transaction hash: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ AssetRegistry deployed at: ${receipt.contractAddress}`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(
    `   Explorer: https://amoy.polygonscan.com/address/${receipt.contractAddress}`
  );

  // Lưu địa chỉ contract vào .env.local
  const envLine = `\nNEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=${receipt.contractAddress}\n`;
  fs.appendFileSync(path.join(__dirname, "../app/.env.local"), envLine);
  console.log("Contract address saved to app/.env.local");
}

main().catch(console.error);
