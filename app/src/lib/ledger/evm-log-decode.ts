import { decodeEventLog, toEventSelector, type Abi, type Log } from 'viem';
import { projectTokenAbi, spvPaymentVaultAbi } from '@bidv/shared';
import type { LiveIndexedEvent } from '@/lib/indexer/event-index';
import type { IndexedEventArgs } from '@/lib/store/chain-event.store.port';
import { normalizeEvmAddress } from './address';

/**
 * Giải mã log thô của Indexer EVM (FIX-07). Vòng lặp dời nguyên văn từ `evm.adapter.ts` (`fetchLogs`),
 * cộng hai thay đổi:
 *  1. Sự kiện đã biết là không theo dõi (`IGNORED_EVENT_SIGNATURES`) bị bỏ IM LẶNG trước khi giải mã;
 *     log không có `topics[0]` coi như không giải mã được.
 *  2. Cảnh báo "không giải mã được" chỉ một lần cho mỗi chain trong một bản nạp mô-đun (trước đây cờ nằm
 *     trong adapter nên lặp lại mỗi lần dựng adapter), câu kèm topic đầu và địa chỉ hợp đồng.
 *
 * Giữ `strict: false` như cũ (QĐ-5, ghi nợ): log của sự kiện đang theo dõi mà `data` hỏng vẫn ra sự kiện thiếu
 * tham số không `indexed` và được lưu, không cảnh báo. Đổi hành vi này cần kiểm trên Sepolia trước.
 */

/**
 * Sự kiện có trong ABI đầy đủ của `ProjectToken` và `SpvPaymentVault`
 * (`packages/shared/generated/*.abi.json`) nhưng KHÔNG có trong ABI rút gọn mà Indexer dùng
 * (`packages/shared/src/abi/project-token.ts`, `spv-payment-vault.ts`): hợp đồng phát các sự kiện quản trị này
 * (AccessControl, Pausable, ERC-20, gắn IdentityRegistry, Compliance lúc triển khai) nhưng nghiệp vụ hiện
 * không đọc. Đưa sự kiện nào vào theo dõi thì sửa ABI rút gọn và gỡ khỏi danh sách này
 * (`test/fix-07-evm-log-decode.test.ts` đối chiếu hai ABI và báo khi lệch).
 */
export const IGNORED_EVENT_SIGNATURES = [
  'Approval(address,address,uint256)',
  'ComplianceAdded(address)',
  'IdentityRegistryAdded(address)',
  'EIP712DomainChanged()',
  'Paused(address)',
  'Unpaused(address)',
  'RoleGranted(bytes32,address,address)',
  'RoleRevoked(bytes32,address,address)',
  'RoleAdminChanged(bytes32,bytes32,bytes32)',
  'TokensFrozen(address,uint256)',
  'TokensUnfrozen(address,uint256)',
] as const;

/** Topic đầu (chữ thường) của các sự kiện bỏ qua, tính lúc nạp mô-đun, không chép tay mã hex. */
export const IGNORED_EVENT_TOPICS: ReadonlySet<string> = new Set(
  IGNORED_EVENT_SIGNATURES.map((signature) => toEventSelector(signature).toLowerCase()),
);

/** Chain đã cảnh báo "không giải mã được" trong bản nạp mô-đun này. */
const warnedChains = new Set<string>();

function warnUndecodable(chain: string, log: Log, error: unknown) {
  if (warnedChains.has(chain)) return;
  warnedChains.add(chain);
  console.warn(
    `Indexer ${chain}: bỏ log không giải mã được; các log sau chỉ bỏ qua im lặng. Topic ${log.topics[0] ?? '(không có)'}, hợp đồng ${log.address}.`,
    error,
  );
}

const serializeEventArgs = (raw: unknown): IndexedEventArgs => {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => {
      if (typeof value === 'bigint') return [key, value.toString()];
      if (typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)) {
        return [key, normalizeEvmAddress(value)];
      }
      if (typeof value === 'string' && value.startsWith('0x')) return [key, value.toLowerCase()];
      if (typeof value === 'number' || typeof value === 'boolean' || value === null) return [key, value];
      return [key, String(value)];
    }),
  );
};

/**
 * Log thô của viem thành sự kiện Indexer lưu. `scope.vault` quyết định ABI giải mã (vault hay token), như
 * trước; log thiếu `blockNumber`, `logIndex`, `transactionHash` bị bỏ không cảnh báo; kết quả sắp theo block
 * rồi `logIndex`.
 */
export function decodeEvmLogs(
  logs: readonly Log[],
  scope: { vault: string; token: string },
  chain: string,
): LiveIndexedEvent[] {
  const events: LiveIndexedEvent[] = [];
  for (const log of logs) {
    const topic = log.topics[0];
    if (!topic) {
      warnUndecodable(chain, log, new Error('Log không có topics[0].'));
      continue;
    }
    if (IGNORED_EVENT_TOPICS.has(topic.toLowerCase())) continue;
    try {
      const fromVault = log.address.toLowerCase() === scope.vault.toLowerCase();
      const decoded = decodeEventLog({
        abi: (fromVault ? spvPaymentVaultAbi : projectTokenAbi) as Abi,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      if (!decoded.eventName || log.blockNumber === null || log.logIndex === null || log.transactionHash === null) continue;
      events.push({
        contract: normalizeEvmAddress(log.address),
        eventName: decoded.eventName,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
        txHash: log.transactionHash,
        args: serializeEventArgs(decoded.args),
      });
    } catch (error) {
      warnUndecodable(chain, log, error);
    }
  }
  return events.sort((a, b) =>
    a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex,
  );
}
