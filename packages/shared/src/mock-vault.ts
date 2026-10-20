import { findContractAddress } from './addresses';
import { CHAINS } from './chains';
import type { ChainKey } from './types';

/**
 * Địa chỉ LOGIC của vault thanh toán SPV trên chain mock (BE-13 QĐ-G). Không ví nào giữ khoá của
 * địa chỉ này: nó là 20 byte cuối của `keccak256("bidv-rwa-tokenize:mock:SpvPaymentVault")`, nên
 * không trùng ví mẫu (`NB001` là ví NHẬN tiền rút mặc định của Người bán) và không rơi vào dải địa
 * chỉ thấp của precompile. Kiểm thử `be-13-mock-vault.test.ts` dựng lại phép băm này.
 */
export const MOCK_VAULT_ADDRESS = '0xE1237075C0AB261E3FE96E55Bc8fF5eB2aba1Cc2';

/**
 * Vault thanh toán của chain: địa chỉ logic trên mock, địa chỉ triển khai trong address book trên
 * chain thật; `undefined` khi chain chưa có vault (Mint đầu không bị ép về vault).
 */
export function vaultAddressFor(chain: ChainKey): string | undefined {
  return CHAINS[chain].family === 'mock' ? MOCK_VAULT_ADDRESS : findContractAddress(chain, 'SpvPaymentVault');
}

/**
 * FE-08: địa chỉ LOGIC của quỹ chia lợi nhuận (`ProfitDistributor`) trên chain mock, cùng cách dựng
 * với vault: 20 byte cuối của `keccak256("bidv-rwa-tokenize:mock:ProfitDistributor")`. Như trên EVM,
 * số dư VNDB của địa chỉ này CHÍNH LÀ quỹ chia: nạp VNDB vào đây là SPV nạp quỹ.
 */
export const MOCK_PROFIT_DISTRIBUTOR_ADDRESS = '0x67C48fdA18F68acf2eD6d8A80436930Ff226948e';

/** Quỹ chia lợi nhuận của chain: địa chỉ logic trên mock, địa chỉ triển khai trên chain thật. */
export function profitDistributorAddressFor(chain: ChainKey): string | undefined {
  return CHAINS[chain].family === 'mock'
    ? MOCK_PROFIT_DISTRIBUTOR_ADDRESS
    : findContractAddress(chain, 'ProfitDistributor');
}
