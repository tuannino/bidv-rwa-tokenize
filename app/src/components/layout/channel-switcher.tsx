'use client';

import { useTransition } from 'react';
import { Building2 } from 'lucide-react';
import { setChannel } from '@/app/actions/session';
import { usePublicConfig } from '@/lib/config/config-context';
import { CHANNELS, type Channel } from '@/lib/session/channel';

/**
 * Bộ chọn KÊNH — hai lựa chọn, hiện ở cả hai kênh để luôn quay lại được.
 *
 * ⚠️ Chỉ để demo, KHÔNG phải xác thực. Đổi kênh cũng đổi vai (xem `setChannel`), và cookie
 * thì người dùng tự đặt được. Phân quyền thật nằm ở `assertCan()` trong `lib/bank/`.
 *
 * Nhập từ `lib/session/channel.ts` (dữ liệu thuần) chứ KHÔNG từ `current-channel.ts`
 * (`server-only`) — nhập bất kỳ symbol nào từ module `server-only` vào Client Component
 * đều làm vỡ build, kể cả khi chỉ lấy hằng số.
 */
const LABELS: Record<Channel, string> = {
  investor: 'Nhà đầu tư',
  admin: 'Admin console',
};

export function ChannelSwitcher() {
  const config = usePublicConfig();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="channel-switcher"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title="Chọn kênh giao diện — chỉ dùng để demo, không phải xác thực thật"
      >
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Kênh</span>
      </label>

      <select
        id="channel-switcher"
        value={config.channel}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Channel;
          // Điều hướng do `setChannel` làm bằng `redirect()` ở server — xem ghi chú trong
          // `app/actions/session.ts`. Không `router.push` ở đây: component này bị unmount
          // khi guard của kênh cũ từ chối, và push trong transition đã unmount sẽ mất.
          startTransition(() => setChannel(next));
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {LABELS[channel]}
          </option>
        ))}
      </select>
    </div>
  );
}
