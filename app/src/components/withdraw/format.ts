/** Định dạng dùng chung của màn Rút VNDB (`/withdraw`), dời nguyên văn từ `investor-withdraw.tsx` (FE-UX-04d QĐ-5). */

export const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;

export const nf = (value: string | bigint | null | undefined) => {
  if (value === null || value === undefined || value === '') return '-';
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return String(value);
  }
};
