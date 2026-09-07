import { ShieldX } from 'lucide-react';
import { can, type Action, type Role } from '@/lib/rbac';
import { currentRole } from '@/lib/rbac/session';

/**
 * Guard RBAC cho một KÊNH (route-group).
 *
 * Đặt ở layout của group nên mọi trang trong group được bảo vệ, kể cả trang thêm sau này.
 * `requireAny`: có MỘT trong các quyền là vào được kênh.
 *
 * Đây là guard hiển thị. Chốt chặn thật vẫn nằm ở service (`assertCan`), vì server action
 * và route handler gọi được trực tiếp mà không đi qua layout nào.
 */
export async function ChannelGuard({
  requireAny,
  channel,
  children,
}: {
  requireAny: readonly Action[];
  channel: string;
  children: React.ReactNode;
}) {
  const role: Role = await currentRole();
  const allowed = requireAny.some((action) => can(role, action));

  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Không có quyền vào kênh {channel}</h1>
        <p className="text-sm text-muted-foreground">
          Vai trò hiện tại là <span className="font-mono text-foreground">{role}</span>, không có quyền nào
          trong: <span className="font-mono">{requireAny.join(', ')}</span>.
        </p>
        <p className="text-xs text-muted-foreground">
          Đổi vai trò ở góc trên phải (chỉ khả dụng trong PoC).
        </p>
      </div>
    </div>
  );
}
