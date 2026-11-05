import type { SellerWithdrawPolicy } from '@/lib/bank/seller.service';

/** Định dạng dùng chung của các màn Người bán, dời nguyên văn từ `seller-overview.tsx` (FE-UX-05a QĐ-4). */

export const nf = (value: string | null | undefined) => {
  if (value === null || value === undefined) return '—';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export const describePolicy = (policy: SellerWithdrawPolicy | null) => {
  if (policy === null) return 'Chain này chưa có vault thanh toán: chưa rút được.';
  if (policy.lockMode === 'UNSET') return 'Nguồn on-chain: chưa cấu hình, vault khoá toàn bộ.';
  if (policy.lockMode === 'FIXED') {
    return `Nguồn on-chain: khoá cố định ${nf(policy.fixedLockAmount)} VNDB.`;
  }
  return (
    `Nguồn on-chain: khoá ${Number(policy.percentRateBps) / 100}% theo kỳ, làm tròn xuống; ` +
    `thu ròng ${nf(policy.netProceeds)} VNDB, phần khoá kỳ gần nhất ${nf(policy.percentLocked)} VNDB.`
  );
};
