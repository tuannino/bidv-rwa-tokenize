import type { ChainKey } from '@bidv/shared';
import { getWalletBindingStore } from '@/lib/store';

/**
 * FIX-01: gắn ví cho hồ sơ THẲNG vào cổng `WalletBinding` (bộ nhớ hoặc Postgres theo môi trường test),
 * không qua whitelist trên chuỗi. Dùng trong phần chuẩn bị của test gọi hàm có chốt chặn ví của phiên
 * (`assertOwnWallet`) với ví không phải ví mẫu trên `mock`, `hardhat-local`, hoặc trên chain `evm` giả.
 */
export async function bindWalletForTest(chain: ChainKey, wallet: string, actorId: string, boundBy = 'TEST'): Promise<void> {
  await getWalletBindingStore().bind({ chain, wallet, actorId, boundBy });
}
