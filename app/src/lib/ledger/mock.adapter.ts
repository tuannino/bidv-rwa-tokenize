import 'server-only';

import type { ChainKey } from '@bidv/shared';
import { addressKey, normalizeEvmAddress } from './address';
import {
  LedgerError,
  assertPositiveAmount,
  type ILedgerPort,
  type TokenInfo,
  type TxResult,
} from './ledger.port';

/**
 * Ledger trong bộ nhớ — mint chạy KHÔNG cần chain. Dùng cho demo public/free-tier,
 * nơi không thể dựng hardhat node (docs/DEPLOYMENT.md).
 *
 * Adapter này CỐ Ý mô phỏng đúng các ràng buộc tuân thủ của `ProjectToken._update`
 * (chưa KYC / bị băng / paused). Nếu mock dễ tính hơn contract thật thì demo sẽ
 * "chạy được ở mock, hỏng ở chain thật" — đúng loại lỗi mock phải ngăn.
 */

interface MockState {
  balances: Map<string, bigint>;
  whitelisted: Set<string>;
  frozen: Set<string>;
  totalSupply: bigint;
  nonce: number;
}

const TOKEN: Omit<TokenInfo, 'totalSupply'> = {
  name: 'Wind Power Project Token (mock)',
  symbol: 'SPT',
  decimals: 0, // khớp contract thật
};

/**
 * Giữ state trên globalThis: Next.js dev reload module giữa các request,
 * biến module-level thường sẽ bị reset và balance "bốc hơi" giữa hai lần bấm.
 */
const GLOBAL_KEY = '__bidvMockLedgerState__';

function state(): MockState {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockState };
  holder[GLOBAL_KEY] ??= {
    balances: new Map(),
    whitelisted: new Set(),
    frozen: new Set(),
    totalSupply: 0n,
    nonce: 0,
  };
  return holder[GLOBAL_KEY];
}

/** Chỉ dùng cho test/demo runner: về trạng thái trắng. */
export function resetMockLedger(): void {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockState };
  delete holder[GLOBAL_KEY];
}

function fakeTxHash(): string {
  const s = state();
  s.nonce += 1;
  // Dạng 0x + 64 hex để UI/validation coi như tx hash thật.
  return `0x${s.nonce.toString(16).padStart(64, '0')}`;
}

export function createMockLedger(chain: ChainKey = 'mock'): ILedgerPort {
  const confirmed = (): TxResult => ({ txHash: fakeTxHash(), status: 'CONFIRMED' });

  const reject = (operation: string, message: string): never => {
    throw new LedgerError(chain, operation, message);
  };

  const requireWhitelisted = (operation: string, wallet: string, label: string): void => {
    if (!state().whitelisted.has(addressKey(wallet))) {
      reject(operation, `${label} chưa KYC/whitelist: ${wallet}`);
    }
  };

  const requireNotFrozen = (operation: string, wallet: string, label: string): void => {
    if (state().frozen.has(addressKey(wallet))) {
      reject(operation, `${label} đang bị đóng băng: ${wallet}`);
    }
  };

  const balance = (wallet: string): bigint => state().balances.get(addressKey(wallet)) ?? 0n;

  const setBalance = (wallet: string, value: bigint): void => {
    state().balances.set(addressKey(wallet), value);
  };

  return {
    chain,

    async whitelist(wallet) {
      state().whitelisted.add(addressKey(normalizeEvmAddress(wallet)));
      return confirmed();
    },

    async isWhitelisted(wallet) {
      return state().whitelisted.has(addressKey(normalizeEvmAddress(wallet)));
    },

    async freeze(wallet, frozen) {
      const key = addressKey(normalizeEvmAddress(wallet));
      if (frozen) state().frozen.add(key);
      else state().frozen.delete(key);
      return confirmed();
    },

    async isFrozen(wallet) {
      return state().frozen.has(addressKey(normalizeEvmAddress(wallet)));
    },

    async mint(to, amount) {
      assertPositiveAmount(chain, 'mint', amount);
      const receiver = normalizeEvmAddress(to);
      requireWhitelisted('mint', receiver, 'Bên nhận');
      requireNotFrozen('mint', receiver, 'Bên nhận');

      setBalance(receiver, balance(receiver) + amount);
      state().totalSupply += amount;
      return confirmed();
    },

    async burn(from, amount) {
      assertPositiveAmount(chain, 'burn', amount);
      const holder = normalizeEvmAddress(from);
      if (balance(holder) < amount) reject('burn', `Số dư không đủ để đốt: ${holder}`);

      setBalance(holder, balance(holder) - amount);
      state().totalSupply -= amount;
      return confirmed();
    },

    async transfer(from, to, amount) {
      assertPositiveAmount(chain, 'transfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);

      requireNotFrozen('transfer', sender, 'Bên gửi');
      requireNotFrozen('transfer', receiver, 'Bên nhận');
      requireWhitelisted('transfer', sender, 'Bên gửi');
      requireWhitelisted('transfer', receiver, 'Bên nhận');
      if (balance(sender) < amount) reject('transfer', `Số dư không đủ: ${sender}`);

      setBalance(sender, balance(sender) - amount);
      setBalance(receiver, balance(receiver) + amount);
      return confirmed();
    },

    async forcedTransfer(from, to, amount) {
      assertPositiveAmount(chain, 'forcedTransfer', amount);
      const sender = normalizeEvmAddress(from);
      const receiver = normalizeEvmAddress(to);

      // Giống contract: bỏ qua trạng thái băng của `from`, nhưng `to` vẫn phải KYC.
      requireWhitelisted('forcedTransfer', receiver, 'Bên nhận (clawback)');
      if (balance(sender) < amount) reject('forcedTransfer', `Số dư không đủ: ${sender}`);

      setBalance(sender, balance(sender) - amount);
      setBalance(receiver, balance(receiver) + amount);
      return confirmed();
    },

    async balanceOf(wallet) {
      return balance(normalizeEvmAddress(wallet));
    },

    async tokenInfo() {
      return { ...TOKEN, totalSupply: state().totalSupply };
    },

    async waitReceipt(txHash) {
      // Mock xác nhận ngay ở bước ghi, nên ở đây chỉ khẳng định lại.
      return { txHash, status: 'CONFIRMED' };
    },
  };
}
