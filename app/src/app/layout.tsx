import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { BackgroundFx } from '@/components/motion/background-fx';
import { Providers } from '@/components/providers';
import { ConfigProvider } from '@/lib/config/config-context';
import { publicConfig } from '@/lib/config/flags';
import './globals.css';

// Roboto cho chữ, Roboto Condensed cho mã kỹ thuật (lớp `font-code`). Tệp woff2 lưu trong repo
// (nguồn google/fonts, OFL, cắt latin + vietnamese), không tải từ Google lúc build.
const Roboto = localFont({
  src: './fonts/roboto-latin-vi.woff2',
  variable: '--font-roboto',
  weight: '300 700',
  display: 'swap',
});
const RobotoCondensed = localFont({
  src: './fonts/roboto-condensed-latin-vi.woff2',
  variable: '--font-roboto-condensed',
  weight: '400 500',
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
    <html lang="vi" className={`${Roboto.variable} ${RobotoCondensed.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <BackgroundFx />
        <ConfigProvider value={config}>
          <Providers>{children}</Providers>
        </ConfigProvider>
      </body>
    </html>
  );
}
