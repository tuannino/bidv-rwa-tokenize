import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { ConfigProvider } from '@/lib/config/config-context';
import { publicConfig } from '@/lib/config/flags';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BIDV RWA — Token hóa dự án điện gió',
  description:
    'Phát hành token quyền hưởng dự án điện gió có kiểm soát: KYC/whitelist, phát hành, chia lợi tức, hoàn vốn.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Cấu hình tính ở server rồi truyền xuống: client không tự đọc env.
  const config = publicConfig();

  return (
    <html lang="vi" className={geistMono.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ConfigProvider value={config}>
          <Providers>{children}</Providers>
        </ConfigProvider>
      </body>
    </html>
  );
}
