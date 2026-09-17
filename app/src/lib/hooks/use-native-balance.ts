'use client';

import { useBalance } from 'wagmi';
import { formatNativeAmount } from '@/lib/wallet/format';

export interface NativeBalanceView {
  /** Số dư đã định dạng, `null` khi chưa đọc được. */
  amount: string | null;
  symbol: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Số dư đồng bản địa của ví (ETH trên hardhat-local và Sepolia).
 *
 * Đây là `eth_getBalance`, KHÔNG phải lời gọi hợp đồng, nên không thuộc phạm vi
 * `ILedgerPort` (LUẬT #1 nói về tương tác hợp đồng). Vẫn đặt trong `lib/` chứ không gọi
 * `useBalance` thẳng trong thành phần giao diện: nhờ vậy phần định dạng và phần xử lý lỗi
 * chỉ có một bản, và thành phần giao diện chỉ nhận chuỗi đã sẵn sàng để hiển thị.
 *
 * Số dư WPT và VNDB KHÔNG đọc ở đây — hai thứ đó là số dư hợp đồng, đi qua `ILedgerPort`
 * và thuộc FE-04.
 */
export function useNativeBalance(address: `0x${string}` | undefined): NativeBalanceView {
  const { data, isLoading, error } = useBalance({
    address,
    query: { enabled: address !== undefined },
  });

  return {
    amount: data ? formatNativeAmount(data.value, data.decimals) : null,
    symbol: data?.symbol ?? null,
    loading: address !== undefined && isLoading,
    /**
     * Nói rõ là "chưa đọc được" chứ không hiện số 0: trên hardhat-local, node chưa chạy là
     * trường hợp thường gặp, và số 0 lúc đó là một khẳng định sai.
     */
    error: error ? 'Chưa đọc được số dư — có thể node của mạng này chưa chạy.' : null,
  };
}
