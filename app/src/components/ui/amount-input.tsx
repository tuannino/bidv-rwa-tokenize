'use client';

import { digitsOnly, formatAmount } from '@/lib/format';

type AmountInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** Chuỗi chữ số thô (`'20000000'`), `''` khi rỗng. */
  value: string;
  /** Nhận chuỗi chữ số thô, đã bỏ dấu chấm và ký tự lạ. */
  onValueChange: (raw: string) => void;
};

/**
 * Ô số lượng hiện dấu chấm hàng nghìn ngay khi gõ (UIUX-01 A1): giá trị giữ chuỗi chữ số thô, ô hiện
 * `formatAmount(value)`; ô rỗng hiện rỗng (không hiện ký tự thay cho rỗng của `formatAmount`).
 *
 * PoC: không giữ vị trí con trỏ theo ký tự, vì dấu chấm chèn vào làm lệch vị trí khi sửa giữa số; gõ
 * ở cuối số là đủ cho nhu cầu hiện tại.
 */
export function AmountInput({ value, onValueChange, ...rest }: AmountInputProps) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={value === '' ? '' : formatAmount(value)}
      onChange={(event) => onValueChange(digitsOnly(event.target.value))}
    />
  );
}
