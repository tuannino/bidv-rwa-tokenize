/** Định dạng và lớp ô nhập dùng chung của màn Vault (FE-UX-03c QĐ-5: dời nguyên văn từ `vault-status.tsx`). */

export const amount = (value: string) => BigInt(value).toLocaleString('vi-VN');
export const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

export const FIELD =
  'w-full rounded-md border border-border bg-background px-3 py-2 font-code text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
