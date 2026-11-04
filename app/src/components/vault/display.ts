/** Định dạng dùng chung của màn Vault (FE-UX-03c QĐ-5: dời nguyên văn từ `vault-status.tsx`). */

export const amount = (value: string) => BigInt(value).toLocaleString('vi-VN');
export const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
