import { Download, ExternalLink, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Trạng thái `no-provider` — trình duyệt chưa có ví nào (R2.1, R2.2).
 *
 * Chữ viết cho cán bộ ngân hàng đọc: không có "provider", "injected", "EIP-1193". Người
 * chưa từng dùng ví cần biết ba điều theo đúng thứ tự — ví là cái gì, tải ở đâu, sau khi
 * cài thì làm gì. Thiếu bước cuối là chỗ hay bị kẹt nhất: cài xong mà không tải lại trang
 * thì màn hình vẫn y nguyên, và người dùng tưởng mình làm sai.
 */

const WALLETS: { name: string; href: string; note: string }[] = [
  {
    name: 'MetaMask',
    href: 'https://metamask.io/download/',
    note: 'Phổ biến nhất, có bản tiện ích cho Chrome, Edge, Firefox.',
  },
  {
    name: 'Rabby',
    href: 'https://rabby.io/',
    note: 'Đổi mạng dễ hơn, phù hợp khi phải qua lại giữa mạng nội bộ và mạng thử.',
  },
];

export function NoWalletGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Chưa có ví trong trình duyệt
        </CardTitle>
        <CardDescription>
          Ví là phần mở rộng của trình duyệt, dùng để giữ token và xác nhận giao dịch. Không có ví
          thì chưa xem được vị thế và chưa mua được WPT.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <Step n={1} />
            <div className="space-y-2">
              <p className="text-foreground">Cài một trong các ví dưới đây:</p>
              <ul className="space-y-2">
                {WALLETS.map((wallet) => (
                  <li key={wallet.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <a
                      href={wallet.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {wallet.name}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">(mở tab mới)</span>
                    </a>
                    <span className="text-xs text-muted-foreground">{wallet.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          <li className="flex gap-3">
            <Step n={2} />
            <p className="text-foreground">
              Tạo ví mới hoặc mở ví đã có, làm theo hướng dẫn của phần mở rộng.
            </p>
          </li>

          <li className="flex gap-3">
            <Step n={3} />
            <p className="text-foreground">
              <span className="font-medium">Tải lại trang này</span>, rồi bấm Kết nối ví. Trang
              không tự nhận ví vừa cài, nên bước tải lại là bắt buộc.
            </p>
          </li>
        </ol>

        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Hệ thống chấp nhận mọi ví EVM cài trong trình duyệt. Ví do ngân hàng giữ hộ sẽ có sau,
          chưa mở trong phiên bản này.
        </p>
      </CardContent>
    </Card>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-medium text-muted-foreground"
    >
      {n}
    </span>
  );
}
