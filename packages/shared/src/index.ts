import sampleWalletsJson from './sample-wallets.json';

export * from './types';
export * from './chains';
export * from './abi/index';
export { buildPermitTypedData } from './permit.js';
export type { PermitAddress, PermitTypedData, PermitTypedDataInput } from './permit.js';
export { orderIdFromOrderRef, orderRefFromOrderId } from './order-ref';
export {
  addressBook,
  addressEnvKey,
  findContractAddress,
  getContractAddress,
} from './addresses';
export {
  MOCK_PROFIT_DISTRIBUTOR_ADDRESS,
  MOCK_VAULT_ADDRESS,
  profitDistributorAddressFor,
  vaultAddressFor,
} from './mock-vault';

/** Ví của tài khoản khách hàng mẫu, theo mã tài khoản. Script dữ liệu mẫu trên chuỗi đọc cùng tệp. */
export const SAMPLE_WALLETS: Readonly<Record<'NDT001' | 'NB001', string>> = sampleWalletsJson.wallets;

/**
 * Ví mẫu công khai của Hardhat (khoá riêng ai cũng biết): hai ví mẫu cộng ví ký mặc định #0. Cùng
 * danh sách `fund-sepolia.js` từ chối nạp; app từ chối liên kết các ví này trên chain thật (OP-05).
 */
export const PUBLIC_SAMPLE_WALLETS: readonly string[] = [
  ...Object.values(sampleWalletsJson.wallets),
  sampleWalletsJson.hardhatAccount0,
];

export { default as tokenParameters } from './token-parameters.json';
