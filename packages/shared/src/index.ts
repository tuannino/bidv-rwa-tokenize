import sampleWalletsJson from './sample-wallets.json';

export * from './types';
export * from './chains';
export * from './abi/index';
export { buildPermitTypedData } from './permit.js';
export type { PermitAddress, PermitTypedData, PermitTypedDataInput } from './permit.js';
export {
  addressBook,
  addressEnvKey,
  findContractAddress,
  getContractAddress,
} from './addresses';

/** Ví của tài khoản khách hàng mẫu, theo mã tài khoản. Script dữ liệu mẫu trên chuỗi đọc cùng tệp. */
export const SAMPLE_WALLETS: Readonly<Record<'NDT001' | 'NB001', string>> = sampleWalletsJson.wallets;
