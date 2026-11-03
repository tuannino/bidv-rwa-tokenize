import type { Metadata } from 'next';
import { Roboto, Roboto_Condensed } from 'next/font/google';
import { Providers } from '@/components/providers';
import { ConfigProvider } from '@/lib/config/config-context';
import { publicConfig } from '@/lib/config/flags';
import './globals.css';

// Roboto cho chữ, Roboto Condensed cho mã kỹ thuật (lớp `font-code`). Chỉ nạp các độ đậm đang dùng.
const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});
const robotoCondensed = Roboto_Condensed({
  variable: '--font-roboto-condensed',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BIDV RWA, token hoá dự án điện gió',
  description:
    'Phát hành token quyền hưởng dự án điện gió có kiểm soát: KYC/whitelist, phát hành, chia lợi tức, hoàn vốn.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Cấu hình tính ở server rồi truyền xuống: client không tự đọc env.
  // `await` vì publicConfig() đọc cookie vai + kênh (xem lib/config/flags.ts).
  const config = await publicConfig();

  return (
    <html lang="vi" className={`${roboto.variable} ${robotoCondensed.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ConfigProvider value={config}>
          <Providers>{children}</Providers>
        </ConfigProvider>
      </body>
    </html>
  );
}
