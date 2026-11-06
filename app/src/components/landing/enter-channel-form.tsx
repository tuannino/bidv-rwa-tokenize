import { setChannel } from '@/app/actions/session';
import type { Channel } from '@/lib/session/channel';

/**
 * FE-UX-07a QĐ-4: vào một khu vực từ trang giới thiệu. Form gọi `setChannel` có sẵn (đặt hai cookie
 * rồi `redirect` tới `CHANNEL_HOME`); nút con là `<button type="submit">`. Không gọi gì khi mở trang.
 */
export function EnterChannelForm({
  channel,
  className,
  children,
}: {
  channel: Channel;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={setChannel.bind(null, channel)} className={className}>
      {children}
    </form>
  );
}
