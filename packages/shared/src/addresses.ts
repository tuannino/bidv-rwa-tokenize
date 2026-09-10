/**
 * Accessor có kiểu cho địa chỉ contract.
 *
 * Hai nguồn, env thắng file:
 *   1. `addresses.json` — sinh bởi deploy script (mặc định cho hardhat-local).
 *   2. Biến môi trường `NEXT_PUBLIC_ADDR_<CHAIN>_<CONTRACT>` — dùng cho chain thật
 *      (evm testnet) và cho free-tier, nơi không đọc được filesystem lúc runtime.
 *
 * Ví dụ env: NEXT_PUBLIC_ADDR_EVM_PROJECT_TOKEN=0x...
 *            NEXT_PUBLIC_ADDR_HARDHAT_LOCAL_PROJECT_TOKEN=0x...
 */
import addressBookJson from './addresses.json';
import type { AddressBook, ChainKey, ContractName, DeploymentRecord } from './types';

export const addressBook: AddressBook = (addressBookJson as { chains: AddressBook }).chains ?? {};

/** `ProjectToken` -> `PROJECT_TOKEN`, `VNDToken` -> `VND_TOKEN` */
function screamingSnake(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

function envKey(chain: ChainKey, contract: ContractName): string {
  return `NEXT_PUBLIC_ADDR_${screamingSnake(chain.replace(/-/g, '_'))}_${screamingSnake(contract)}`;
}

function readEnv(key: string): string | undefined {
  // globalThis.process để file này vẫn nạp được ở môi trường không có process (edge/browser bundle).
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const value = env?.[key];
  return value && value.length > 0 ? value : undefined;
}

export function getDeployment(chain: ChainKey): DeploymentRecord | undefined {
  return addressBook[chain];
}

/** Trả về địa chỉ hoặc `undefined` nếu chain đó chưa deploy. */
export function findContractAddress(
  chain: ChainKey,
  contract: ContractName,
): string | undefined {
  return readEnv(envKey(chain, contract)) ?? addressBook[chain]?.contracts?.[contract];
}

/**
 * Như `findContractAddress` nhưng ném lỗi có hướng dẫn sửa.
 * Dùng ở adapter, nơi thiếu địa chỉ là lỗi cấu hình cần báo rõ.
 */
/** Network hardhat tương ứng mỗi chain — để gợi ý đúng lệnh deploy. */
const HARDHAT_NETWORK: Partial<Record<ChainKey, string>> = {
  'hardhat-local': 'localhost',
  evm: 'sepolia',
};

export function getContractAddress(chain: ChainKey, contract: ContractName): string {
  const address = findContractAddress(chain, contract);
  if (!address) {
    // Gợi ý phải nêu ĐÚNG network của chain đang dùng: trước đây luôn ghi `--network localhost`,
    // nên khi chain là `evm` thì hướng dẫn lại dẫn người đọc deploy sai mạng.
    const network = HARDHAT_NETWORK[chain];
    const deployHint = network
      ? `(a) deploy rồi nạp lại địa chỉ ` +
        `(cd packages/contracts-evm && npx hardhat run scripts/deploy.js --network ${network})`
      : `(a) deploy contract cho chain này`;

    throw new Error(
      `Chưa có địa chỉ ${contract} cho chain "${chain}". ` +
        `Cách sửa: ${deployHint}, hoặc (b) đặt biến môi trường ${envKey(chain, contract)}.`,
    );
  }
  return address;
}

export { envKey as addressEnvKey };
