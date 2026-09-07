'use client';

import { useTransition } from 'react';
import { ShieldAlert } from 'lucide-react';
import { ROLES } from '@/lib/rbac';
import { setDemoRole } from '@/app/actions/session';
import { usePublicConfig } from '@/lib/config/config-context';

const LABELS: Record<string, string> = {
  BANK_ADMIN: 'Cán bộ ngân hàng',
  COMPLIANCE: 'Tuân thủ',
  INVESTOR: 'Nhà đầu tư',
  AUDITOR: 'Kiểm toán (chỉ đọc)',
};

/**
 * Bộ đổi vai trò — CHỈ để demo RBAC (thử mint bằng AUDITOR sẽ bị chặn).
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
        defaultValue={config.role}
        disabled={pending}
        onChange={(event) => {
          const role = event.target.value;
          startTransition(() => setDemoRole(role));
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {LABELS[role] ?? role}
          </option>
        ))}
      </select>
    </div>
  );
}
