'use client';

import { useTransition } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Role } from '@/lib/rbac';
import { setDemoRole } from '@/app/actions/session';
import { usePublicConfig } from '@/lib/config/config-context';

/**
 * Ba vai của kênh Admin console. **Không** có `INVESTOR`: vai đó giờ do bộ chọn KÊNH đặt,
 * không phải bộ chọn vai. Để cả hai nơi đổi được cùng một thứ thì sẽ có lúc hai cookie lệch
 * nhau (kênh `admin` + vai `INVESTOR` = mọi trang admin đều bị chặn).
 *
 * Cố tình liệt kê tay thay vì lọc từ `ROLES`, để thêm vai mới vào RBAC không tự động lọt vào
 * bộ chọn này mà không ai xem lại.
 */
const BANK_ROLES = ['BANK_ADMIN', 'COMPLIANCE', 'AUDITOR'] as const satisfies readonly Role[];

const LABELS: Record<(typeof BANK_ROLES)[number], string> = {
  BANK_ADMIN: 'Cán bộ ngân hàng',
  COMPLIANCE: 'Tuân thủ',
  AUDITOR: 'Kiểm toán (chỉ đọc)',
};

/**
 * Bộ đổi vai trò — CHỈ để demo RBAC (thử mint bằng AUDITOR sẽ bị chặn).
 * Chỉ hiển thị trong kênh Admin console; `header.tsx` quyết định việc đó.
 * Phase 4 thay bằng SIWE thì bỏ component này.
 */
export function RoleSwitcher() {
  const config = usePublicConfig();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="role-switcher"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title="Chỉ dùng để demo RBAC — không phải xác thực thật"
      >
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Vai trò</span>
      </label>

      <select
        id="role-switcher"
        // `value` chứ không `defaultValue`: sau khi `setDemoRole` gọi `refresh()`, server
        // kết xuất lại với vai mới và ô chọn phải theo. `defaultValue` chỉ áp lần mount đầu
        // nên ô chọn sẽ trôi khỏi trạng thái thật.
        value={config.role}
        disabled={pending}
        onChange={(event) => {
          const role = event.target.value;
          startTransition(() => setDemoRole(role));
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {BANK_ROLES.map((role) => (
          <option key={role} value={role}>
            {LABELS[role]}
          </option>
        ))}
      </select>
    </div>
  );
}
