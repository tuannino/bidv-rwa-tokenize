import 'server-only';

import { CHAIN_ORDER, CHAINS, type ChainKey } from '@bidv/shared';
import type { Role } from '@/lib/rbac';
import { canMintDemoPayment } from '@/lib/rbac/demo-payment';
import { currentRole } from '@/lib/rbac/session';
import type { Channel } from '@/lib/session/channel';
import { currentChannel } from '@/lib/session/current-channel';
import { serverEnv } from './env';

/**
 * Feature flags + "chain nào thực sự chọn được" — tính ở server rồi truyền xuống client.
 * Client KHÔNG tự đọc env: tránh lệch giữa server/client và tránh rò biến server.
 */

export interface ChainOption {
  key: ChainKey;
  label: string;
  hint: string;
  /** false = hiện trong dropdown nhưng disable, kèm `disabledReason`. */
  selectable: boolean;
  disabledReason?: string;
}

export interface PublicConfig {
  defaultChain: ChainKey;
  chains: ChainOption[];
  mocks: {
    kyc: boolean;
    oracle: boolean;
    corebank: boolean;
    db: boolean;
  };
  /**
   * Vai trò ĐANG CÓ HIỆU LỰC, đọc từ cookie qua `currentRole()` — cùng một nguồn với
   * `ChannelGuard` và `lib/bank/`.
   *
   * Trước đây trường này lấy `env.demoRole`, tức giá trị mặc định lúc khởi động, nên sau
   * khi đổi vai thì giao diện vẫn hiển thị vai cũ và `can(config.role, ...)` gate sai nút.
   * Đó là lỗi hiển thị, không phải lỗ hổng: chốt chặn thật vẫn ở `assertCan()` trong service.
   *
   * Phase 4: lấy từ session SIWE, chữ ký giữ nguyên.
   */
  role: Role;
  /** Kênh đang xem — quyết định hiện/ẩn bộ chọn vai và menu nào. KHÔNG dùng để phân quyền. */
  channel: Channel;
  /**
   * Có bày chức năng phát hành VNDB demo lên giao diện không.
   *
   * Tính bằng ĐÚNG hàm mà chốt chặn phía server dùng (`canMintDemoPayment`), nên nút và
   * guard không thể lệch nhau. Nếu client tự làm `config.enableDemoPaymentMint &&
   * can(config.role, 'demo:mint-payment')` thì hai lớp bị nhân bản ở hai nơi và sẽ lệch
   * ở lần sửa đầu tiên.
   *
   * ⚠️ Đây là gợi ý HIỂN THỊ, không phải chốt chặn. Server action gọi được bằng POST trực
   * tiếp, nên service vẫn phải `assertCanMintDemoPayment()`.
   */
  demoPaymentMint: boolean;
}

function reasonUnavailable(key: ChainKey): string | undefined {
  const env = serverEnv();
  const info = CHAINS[key];

  if (!info.implemented) return 'Chưa hiện thực (adapter stub) — để Phase 7.';

  if (key === 'hardhat-local' && !env.rpcHardhat && !info.defaultRpcUrl) {
    return 'Thiếu RPC — đặt NEXT_PUBLIC_RPC_HARDHAT.';
  }
  if (key === 'evm' && !env.rpcEvm) {
    return 'Thiếu RPC testnet — đặt NEXT_PUBLIC_RPC_EVM (Phase 6).';
  }
  return undefined;
}

/**
 * `async` vì phải đọc cookie (vai + kênh) — `cookies()` của Next 16 trả Promise.
 * Chỉ có một chỗ gọi (`src/app/layout.tsx`, vốn đã là async Server Component).
 */
export async function publicConfig(): Promise<PublicConfig> {
  const env = serverEnv();
  const [role, channel] = await Promise.all([currentRole(), currentChannel()]);

  const chains: ChainOption[] = CHAIN_ORDER.map((key) => {
    const info = CHAINS[key];
    const disabledReason = reasonUnavailable(key);
    return {
      key,
      label: info.label,
      hint: info.hint,
      selectable: disabledReason === undefined,
      disabledReason,
    };
  });

  // Chain mặc định phải chọn được, nếu không thì lùi về `mock` (luôn chạy được).
  const defaultOption = chains.find((option) => option.key === env.defaultChain);
  const defaultChain: ChainKey = defaultOption?.selectable ? env.defaultChain : 'mock';

  return {
    defaultChain,
    chains,
    mocks: {
      kyc: env.useMockKyc,
      oracle: env.useMockOracle,
      corebank: env.useMockCorebank,
      db: env.useMockDb,
    },
    role,
    channel,
    demoPaymentMint: canMintDemoPayment(role),
  };
}
