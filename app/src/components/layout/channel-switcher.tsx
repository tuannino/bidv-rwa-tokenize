'use client';

import { useTransition } from 'react';
import { UserCog } from 'lucide-react';
import { setChannel } from '@/app/actions/session';
import { usePublicConfig } from '@/lib/config/config-context';
import { CHANNELS, SAMPLE_ACCOUNTS, type Channel } from '@/lib/session/channel';

/**
 * Bộ chọn VAI TRÒ — bốn lựa chọn theo tài liệu yêu cầu, hiện ở mọi khu vực để luôn quay
 * lại được.
 *
 * FE-20 nhập bộ chọn khu vực và bộ chọn vai thành một ô: khu vực ↔ vai là một-một, nên hai
 * ô cùng đổi được vai chỉ tạo ra đường để hai cookie lệch nhau.
 *
 * ⚠️ Chỉ để demo, KHÔNG phải xác thực. Cookie thì người dùng tự đặt được. Phân quyền thật
 * nằm ở `assertCan()` trong `lib/bank/`.
 *
 * Nhập từ `lib/session/channel.ts` (dữ liệu thuần) chứ KHÔNG từ `current-channel.ts`
 * (`server-only`) — nhập bất kỳ symbol nào từ module `server-only` vào Client Component
 * đều làm vỡ build, kể cả khi chỉ lấy hằng số.
 */
const LABELS: Record<Channel, string> = {
  investor: 'Nhà đầu tư',
  seller: 'Người bán',
  teller: 'Giao dịch viên',
  controller: 'Kiểm soát viên',
};

export function ChannelSwitcher() {
  const config = usePublicConfig();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="channel-switcher"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title="Chọn vai trò đang giả lập — chỉ dùng để demo, không phải xác thực thật"
      >
        <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Vai trò</span>
      </label>

      <select
        id="channel-switcher"
        value={config.channel}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Channel;
          // Điều hướng do `setChannel` làm bằng `redirect()` ở server — xem ghi chú trong
          // `app/actions/session.ts`. Không `router.push` ở đây: component này bị unmount
          // khi guard của khu vực cũ từ chối, và push trong transition đã unmount sẽ mất.
          startTransition(() => setChannel(next));
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {LABELS[channel]} · {SAMPLE_ACCOUNTS[channel]}
          </option>
        ))}
      </select>
    </div>
  );
}
