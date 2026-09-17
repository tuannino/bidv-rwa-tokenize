import { describe, expect, it } from 'vitest';
import { CHAINS } from '@bidv/shared';
import { formatNativeAmount, shortenAddress } from '@/lib/wallet/format';
import { describeSwitchError, isUserRejection } from '@/lib/wallet/switch-error';
import {
  ALLOWED_CHAIN_IDS,
  WALLET_CHAIN_KEYS,
  blockedSigningReason,
  canSignWith,
  chainIdToSwitchTo,
  chainKeyOfChainId,
  resolveWalletStatus,
  type WalletStatusInput,
  type WalletStatusKind,
} from '@/lib/wallet/wallet-status';

const HARDHAT_ID = CHAINS['hardhat-local'].chainId!;
const SEPOLIA_ID = CHAINS.evm.chainId!;
/** chainId ngoài danh sách được phép — Ethereum mainnet, ví hay để sẵn ở đây. */
const MAINNET_ID = 1;

const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;

/** Trạng thái "mọi thứ đúng" — mỗi ca chỉ đổi đúng thứ nó muốn thử. */
function input(overrides: Partial<WalletStatusInput> = {}): WalletStatusInput {
  return {
    mounted: true,
    appChain: 'hardhat-local',
    hasInjectedProvider: true,
    isConnected: true,
    address: WALLET,
    walletChainId: HARDHAT_ID,
    ...overrides,
  };
}

describe('resolveWalletStatus — bảy nhánh theo thứ tự ưu tiên (design QĐ-3)', () => {
  it('1. chưa hydrate thì loading, không phụ thuộc trạng thái ví', () => {
    // R6.1 — lần kết xuất đầu phải giống server. Kể cả khi ví đã kết nối sẵn.
    expect(resolveWalletStatus(input({ mounted: false })).kind).toBe('loading');
    expect(
      resolveWalletStatus(input({ mounted: false, isConnected: false, hasInjectedProvider: false }))
        .kind,
    ).toBe('loading');
  });

  it('2. chain mock thì mock, KHÔNG đòi ví và KHÔNG cảnh báo sai chain', () => {
    // R4.3 — đây là chế độ của bản triển khai miễn phí, đa số người xem demo gặp đầu tiên.
    const cases: Partial<WalletStatusInput>[] = [
      { hasInjectedProvider: false, isConnected: false, address: undefined, walletChainId: undefined },
      { walletChainId: MAINNET_ID },
      { walletChainId: SEPOLIA_ID },
      { isReconnecting: true },
    ];

    for (const override of cases) {
      const status = resolveWalletStatus(input({ appChain: 'mock', ...override }));
      expect(status.kind, `mock + ${JSON.stringify(override)}`).toBe('mock');
    }
  });

  it('3. chain stellar thì unsupported-chain, không mời cài ví EVM', () => {
    // Task 1.5. Đặt TRƯỚC no-provider: mời cài MetaMask cho người đang xem Stellar là vô nghĩa.
    const status = resolveWalletStatus(
      input({ appChain: 'stellar', hasInjectedProvider: false, isConnected: false }),
    );

    expect(status.kind).toBe('unsupported-chain');
    if (status.kind !== 'unsupported-chain') throw new Error('sai nhánh');
    expect(status.appChainKey).toBe('stellar');
    expect(status.appChain).toBe(CHAINS.stellar.label);
  });

  it('4. ví đang kết nối lại thì loading, không nháy qua "chưa kết nối"', () => {
    expect(
      resolveWalletStatus(input({ isReconnecting: true, isConnected: false, address: undefined }))
        .kind,
    ).toBe('loading');
  });

  it('5. không có ví được tiêm thì no-provider', () => {
    const status = resolveWalletStatus(
      input({ hasInjectedProvider: false, isConnected: false, address: undefined }),
    );
    expect(status.kind).toBe('no-provider');
  });

  it('5b. đã kết nối được thì KHÔNG kết luận no-provider dù phép dò không thấy', () => {
    // Ví chỉ công bố theo EIP-6963 và không đặt `window.ethereum` là trường hợp thật.
    const status = resolveWalletStatus(input({ hasInjectedProvider: false, isConnected: true }));
    expect(status.kind).toBe('ready');
  });

  it('6. có ví nhưng chưa kết nối thì disconnected', () => {
    expect(
      resolveWalletStatus(input({ isConnected: false, address: undefined, walletChainId: undefined }))
        .kind,
    ).toBe('disconnected');

    // Đã báo isConnected nhưng chưa có địa chỉ cũng là chưa kết nối — không được coi là ready.
    expect(resolveWalletStatus(input({ address: undefined })).kind).toBe('disconnected');
  });

  it('7. chainId ngoài danh sách được phép thì wrong-chain, nêu rõ đang ở đâu cần đi đâu', () => {
    // R3.1
    const status = resolveWalletStatus(input({ walletChainId: MAINNET_ID }));

    expect(status.kind).toBe('wrong-chain');
    if (status.kind !== 'wrong-chain') throw new Error('sai nhánh');
    expect(status.current).toBe(MAINNET_ID);
    expect(status.expected).toBe(HARDHAT_ID);
    expect(status.expectedLabel).toBe(CHAINS['hardhat-local'].label);
  });

  it('8. chain được phép nhưng lệch chain đang xem thì chain-mismatch', () => {
    // R4.1 — ví ở Sepolia, ứng dụng đang xem hardhat-local.
    const status = resolveWalletStatus(input({ walletChainId: SEPOLIA_ID }));

    expect(status.kind).toBe('chain-mismatch');
    if (status.kind !== 'chain-mismatch') throw new Error('sai nhánh');
    expect(status.walletChainKey).toBe('evm');
    expect(status.appChainKey).toBe('hardhat-local');
    expect(status.walletChain).toBe(CHAINS.evm.label);
    expect(status.appChain).toBe(CHAINS['hardhat-local'].label);
    expect(status.expected).toBe(HARDHAT_ID);
  });

  it('9. khớp hết thì ready, mang theo địa chỉ và chain key', () => {
    const status = resolveWalletStatus(input());

    expect(status.kind).toBe('ready');
    if (status.kind !== 'ready') throw new Error('sai nhánh');
    expect(status.address).toBe(WALLET);
    expect(status.chainKey).toBe('hardhat-local');
  });

  it('ví ở Sepolia và ứng dụng cũng xem Sepolia thì ready, không cảnh báo', () => {
    const status = resolveWalletStatus(input({ appChain: 'evm', walletChainId: SEPOLIA_ID }));
    expect(status.kind).toBe('ready');
  });

  it('phủ đủ cả tám nhánh của WalletStatus', () => {
    // Chốt bằng test: thêm nhánh mới mà quên phủ là đỏ ngay, không phải phát hiện lúc chạy thật.
    const seen = new Set<WalletStatusKind>([
      resolveWalletStatus(input({ mounted: false })).kind,
      resolveWalletStatus(input({ appChain: 'mock' })).kind,
      resolveWalletStatus(input({ appChain: 'stellar' })).kind,
      resolveWalletStatus(input({ hasInjectedProvider: false, isConnected: false })).kind,
      resolveWalletStatus(input({ isConnected: false, address: undefined })).kind,
      resolveWalletStatus(input({ walletChainId: MAINNET_ID })).kind,
      resolveWalletStatus(input({ walletChainId: SEPOLIA_ID })).kind,
      resolveWalletStatus(input()).kind,
    ]);

    expect([...seen].sort()).toEqual(
      [
        'chain-mismatch',
        'disconnected',
        'loading',
        'mock',
        'no-provider',
        'ready',
        'unsupported-chain',
        'wrong-chain',
      ].sort(),
    );
  });
});

describe('canSign — một chỗ quyết định cho FE-05/FE-09/FE-11', () => {
  it('chỉ ready và mock mới ký được', () => {
    expect(canSignWith(resolveWalletStatus(input()))).toBe(true);
    expect(canSignWith(resolveWalletStatus(input({ appChain: 'mock' })))).toBe(true);
  });

  it('mọi trạng thái còn lại đều chặn ký và nêu được lý do', () => {
    // R3.5 — chặn thì phải nói vì sao, không được tắt nút im lặng.
    const blocked = [
      input({ mounted: false }),
      input({ appChain: 'stellar' }),
      input({ hasInjectedProvider: false, isConnected: false }),
      input({ isConnected: false, address: undefined }),
      input({ walletChainId: MAINNET_ID }),
      input({ walletChainId: SEPOLIA_ID }),
    ];

    for (const candidate of blocked) {
      const status = resolveWalletStatus(candidate);
      expect(canSignWith(status), `${status.kind} không được ký`).toBe(false);
      expect(blockedSigningReason(status), `${status.kind} phải có lý do`).toBeTruthy();
    }
  });

  it('ký được thì không có lý do chặn', () => {
    expect(blockedSigningReason(resolveWalletStatus(input()))).toBeNull();
    expect(blockedSigningReason(resolveWalletStatus(input({ appChain: 'mock' })))).toBeNull();
  });

  it('lý do khi sai chain nêu tên mạng, không nêu chain ID trơ', () => {
    const status = resolveWalletStatus(input({ walletChainId: SEPOLIA_ID }));
    const reason = blockedSigningReason(status);

    expect(reason).toContain(CHAINS.evm.label);
    expect(reason).toContain(CHAINS['hardhat-local'].label);
  });
});

describe('chainIdToSwitchTo — chỉ có nghĩa với hai trạng thái về chain', () => {
  it('wrong-chain và chain-mismatch trả chainId của chain đang xem', () => {
    expect(chainIdToSwitchTo(resolveWalletStatus(input({ walletChainId: MAINNET_ID })))).toBe(
      HARDHAT_ID,
    );
    expect(chainIdToSwitchTo(resolveWalletStatus(input({ walletChainId: SEPOLIA_ID })))).toBe(
      HARDHAT_ID,
    );
    expect(
      chainIdToSwitchTo(resolveWalletStatus(input({ appChain: 'evm', walletChainId: MAINNET_ID }))),
    ).toBe(SEPOLIA_ID);
  });

  it('các trạng thái khác trả undefined — không có gì để chuyển', () => {
    for (const candidate of [
      input(),
      input({ mounted: false }),
      input({ appChain: 'mock' }),
      input({ appChain: 'stellar' }),
      input({ isConnected: false, address: undefined }),
    ]) {
      expect(chainIdToSwitchTo(resolveWalletStatus(candidate))).toBeUndefined();
    }
  });
});

describe('danh sách chain được phép suy ra từ packages/shared', () => {
  it('chỉ gồm chain họ EVM có chainId', () => {
    expect([...WALLET_CHAIN_KEYS].sort()).toEqual(['evm', 'hardhat-local']);
    expect([...ALLOWED_CHAIN_IDS].sort()).toEqual([HARDHAT_ID, SEPOLIA_ID].sort());
  });

  it('mock và stellar KHÔNG nằm trong danh sách ví kết nối được', () => {
    expect(WALLET_CHAIN_KEYS).not.toContain('mock');
    expect(WALLET_CHAIN_KEYS).not.toContain('stellar');
  });

  it('chainKeyOfChainId tra đúng, chainId lạ trả undefined', () => {
    expect(chainKeyOfChainId(HARDHAT_ID)).toBe('hardhat-local');
    expect(chainKeyOfChainId(SEPOLIA_ID)).toBe('evm');
    expect(chainKeyOfChainId(MAINNET_ID)).toBeUndefined();
    expect(chainKeyOfChainId(undefined)).toBeUndefined();
  });
});

describe('format — hiển thị địa chỉ và số dư', () => {
  it('rút gọn địa chỉ giữ 6 đầu 4 cuối', () => {
    expect(shortenAddress(WALLET)).toBe('0x7099…79C8');
  });

  it('chuỗi quá ngắn thì trả nguyên văn, không rút gọn thành vô nghĩa', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234');
  });

  it('số dư cắt phần thập phân, KHÔNG làm tròn lên', () => {
    // 1.999999... ETH: làm tròn lên thành 2 là nói người dùng có nhiều tiền hơn thực tế.
    expect(formatNativeAmount(1_999_999_999_999_999_999n, 18)).toBe('1,9999');
    expect(formatNativeAmount(10_000_000_000_000_000_000_000n, 18)).toBe('10.000');
    expect(formatNativeAmount(0n, 18)).toBe('0');
    expect(formatNativeAmount(1_500_000_000_000_000_000n, 18)).toBe('1,5');
  });
});

describe('switch-error — bóc lỗi của ví theo tầng cause', () => {
  it('nhận ra người dùng từ chối qua name ở tầng trong', () => {
    const wrapped = Object.assign(new Error('Switch failed'), {
      cause: Object.assign(new Error('User rejected'), { name: 'UserRejectedRequestError' }),
    });

    expect(isUserRejection(wrapped)).toBe(true);
    expect(describeSwitchError(wrapped, 'Hardhat Local')).toContain('từ chối');
    // R3.4 — vẫn phải nói rõ là chưa xong, không được trình bày như đã kết nối thành công.
    expect(describeSwitchError(wrapped, 'Hardhat Local')).toContain('Hardhat Local');
  });

  it('nhận ra từ chối qua mã 4001', () => {
    expect(isUserRejection({ cause: { cause: { code: 4001 } } })).toBe(true);
  });

  it('lỗi thường thì KHÔNG bị coi là từ chối', () => {
    expect(isUserRejection(new Error('mất mạng'))).toBe(false);
    expect(isUserRejection(undefined)).toBe(false);
  });

  it('mã 4902 ra câu hướng dẫn thêm mạng thủ công', () => {
    expect(describeSwitchError({ code: 4902 }, 'Hardhat Local')).toContain('thêm mạng');
  });

  it('chuỗi cause vòng lại không làm treo', () => {
    const a: { name: string; cause?: unknown } = { name: 'A' };
    const b = { name: 'B', cause: a };
    a.cause = b;

    expect(isUserRejection(a)).toBe(false);
    expect(describeSwitchError(a, 'Hardhat Local')).toBeTruthy();
  });

  it('dùng shortMessage của viem, không dán message dài', () => {
    const error = {
      message: 'dòng dài kèm gợi ý gỡ lỗi\nVersion: viem@2.x',
      shortMessage: 'Chain không khả dụng.',
    };
    const text = describeSwitchError(error, 'Sepolia');

    expect(text).toContain('Chain không khả dụng.');
    expect(text).not.toContain('Version:');
  });
});
