'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Info, Link2, TriangleAlert, Wallet } from 'lucide-react';
import { CHAINS, type ChainKey } from '@bidv/shared';
import { NoWalletGuide } from '@/components/wallet/no-wallet-guide';
import { WalletStatusCard } from '@/components/wallet/wallet-status-card';
import { WrongChainBanner } from '@/components/wallet/wrong-chain-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSelectedChain } from '@/lib/chains/use-selected-chain';
import { usePublicConfig } from '@/lib/config/config-context';
import { useWalletStatus } from '@/lib/hooks/use-wallet-status';
import { chainIdLabel } from '@/lib/wallet/wallet-status';

/**
 * Trang KẾT NỐI VÍ của kênh nhà đầu tư.
 *
 * Chỉ làm một việc: chuyển trạng thái từ `useWalletStatus` thành màn hình tương ứng
 * (design.md mục 3). Không có phép quyết định nào ở đây — thêm một điều kiện `if` về ví vào
 * file này là bắt đầu có nguồn sự thật thứ hai.
 *
 * Ví ở màn này CHỈ dùng cho thao tác của nhà đầu tư (R7.1). Thao tác đặc quyền của ngân hàng
 * ký bằng khóa phía máy chủ qua `ISigner`, không đi qua ví trình duyệt (R7.2).
 *
 * Kết nối ví KHÔNG phải đăng nhập: chưa có chữ ký thì chưa chứng minh được ai sở hữu ví, nên
 * địa chỉ ví không được dùng để cấp quyền. Việc đó thuộc AU-01.
 */
export function WalletConnectPage() {
  const { status, switchToExpected, switching, switchError, disconnect } = useWalletStatus();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Ví của tôi</h1>
        <p className="text-sm text-muted-foreground">
          Kết nối ví tự quản để xem vị thế WPT và xác nhận giao dịch. Ngân hàng không giữ khóa của
          ví này.
        </p>
      </header>

      {/*
        Mỗi nhánh trả về đúng một khối. Dùng switch thay vì chuỗi `&&` để TypeScript kiểm
        được là đã phủ hết trạng thái: thêm kind mới mà quên xử lý là đỏ ngay lúc typecheck.
      */}
      {renderStatus()}

      <WalletScopeNote />
    </div>
  );

  function renderStatus() {
    switch (status.kind) {
      case 'loading':
        return <WalletSkeleton />;

      case 'mock':
        return <MockNotice />;

      case 'unsupported-chain':
        return <UnsupportedChainNotice chainLabel={status.appChain} />;

      case 'no-provider':
        return <NoWalletGuide />;

      case 'disconnected':
        return <DisconnectedCard />;

      case 'wrong-chain':
        return (
          <WrongChainBanner
            currentLabel={chainIdLabel(status.current)}
            expectedLabel={status.expectedLabel}
            onSwitch={() => void switchToExpected()}
            switching={switching}
            error={switchError}
          />
        );

      case 'chain-mismatch':
        return (
          <WrongChainBanner
            currentLabel={status.walletChain}
            expectedLabel={status.appChain}
            onSwitch={() => void switchToExpected()}
            switching={switching}
            error={switchError}
          >
            {/*
              R4.1/R4.2 — lệch mạng có HAI cách sửa và người dùng được chọn. Hệ thống không tự
              đổi mạng của ví, cũng không tự đổi mạng của trang.
            */}
            <UseWalletChainButton walletChainKey={status.walletChainKey} />
          </WrongChainBanner>
        );

      case 'ready':
        return (
          <WalletStatusCard
            address={status.address}
            chainKey={status.chainKey}
            onDisconnect={disconnect}
          />
        );
    }
  }
}

/**
 * R6.3 — khung chờ có kích thước gần với nội dung thật, để nội dung không nhảy khi hiện ra.
 * Lần kết xuất đầu luôn đi vào đây vì `useIsMounted` trả `false` ở server (R6.1).
 */
function WalletSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-64" />
        <span className="sr-only">Đang kiểm tra trạng thái ví…</span>
      </CardContent>
    </Card>
  );
}

/** R4.3 — chế độ mô phỏng: nói rõ không cần ví, và KHÔNG cảnh báo sai mạng. */
function MockNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Đang ở chế độ mô phỏng
        </CardTitle>
        <CardDescription>
          Mạng đang chọn là <span className="font-medium text-foreground">{CHAINS.mock.label}</span>.
          Chế độ này chạy hoàn toàn trong bộ nhớ của máy chủ, nên không cần ví thật và không cần
          tiền thật.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Mua WPT, nhận lợi nhuận và tất toán đều thực hiện được ngay ở chế độ này — kết quả là
          số liệu mô phỏng, không ghi lên chuỗi nào.
        </p>
        <p className="flex items-start gap-1.5">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Muốn dùng ví thật thì đổi mạng ở ô <span className="font-medium">Chain</span> trên thanh
          phía trên, chọn {CHAINS['hardhat-local'].label} hoặc {CHAINS.evm.label}.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Mạng không thuộc họ EVM (Stellar). Ví trình duyệt hiện tại không nói được giao thức đó, nên
 * mời cài ví ở đây là vô nghĩa — nói thẳng là chưa hỗ trợ.
 */
function UnsupportedChainNotice({ chainLabel }: { chainLabel: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <TriangleAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Chưa hỗ trợ ví cho mạng này
        </CardTitle>
        <CardDescription>
          Mạng đang chọn là <span className="font-medium text-foreground">{chainLabel}</span>. Ví
          trình duyệt hiện tại chỉ làm việc được với các mạng họ EVM.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Đổi mạng ở ô <span className="font-medium">Chain</span> trên thanh phía trên sang{' '}
        {CHAINS['hardhat-local'].label}, {CHAINS.evm.label} hoặc {CHAINS.mock.label} để tiếp tục.
      </CardContent>
    </Card>
  );
}

/** Có ví nhưng chưa kết nối. Giải thích vì sao cần kết nối trước khi mời bấm. */
function DisconnectedCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Chưa kết nối ví
        </CardTitle>
        <CardDescription>
          Kết nối ví để hệ thống biết địa chỉ nào đang xem, từ đó hiện đúng số WPT của bạn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>· Bước này chỉ đọc địa chỉ ví, không lấy được tiền và không ký gì.</li>
          <li>· Mỗi giao dịch sau này đều phải bạn tự xác nhận trong ví.</li>
          <li>· Ngắt kết nối được bất cứ lúc nào.</li>
        </ul>

        {/*
          Dùng `ConnectButton.Custom` để nút mang đúng kiểu của hệ thống thiết kế và nhãn
          tiếng Việt, nhưng hộp thoại chọn ví vẫn là của RainbowKit — không dựng lại phần
          khó (phát hiện ví, deep link, WalletConnect).
        */}
        <ConnectButton.Custom>
          {({ openConnectModal, connectModalOpen }) => (
            <Button onClick={openConnectModal} disabled={connectModalOpen}>
              <Wallet className="h-4 w-4" aria-hidden="true" />
              Kết nối ví
            </Button>
          )}
        </ConnectButton.Custom>
      </CardContent>
    </Card>
  );
}

/**
 * Lối sửa thứ hai cho trạng thái lệch mạng: giữ nguyên mạng của ví, đổi mạng của TRANG.
 *
 * Chỉ hiện khi mạng đó đang chọn được. Không kiểm điều này thì nút bấm xong không có gì xảy
 * ra — `useSelectedChain` lặng lẽ lùi về mạng mặc định khi lựa chọn không dùng được, và
 * người dùng sẽ tưởng nút bị hỏng.
 */
function UseWalletChainButton({ walletChainKey }: { walletChainKey: ChainKey }) {
  const config = usePublicConfig();
  const { setChain } = useSelectedChain();

  const option = config.chains.find((candidate) => candidate.key === walletChainKey);
  if (!option?.selectable) return null;

  return (
    <Button onClick={() => setChain(walletChainKey)} variant="outline" size="sm">
      Hoặc xem trang theo {option.label}
    </Button>
  );
}

/** Ranh giới với thao tác của ngân hàng (R7.1, R7.2) và với AU-01. */
function WalletScopeNote() {
  return (
    <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      Ví ở trang này chỉ dùng cho thao tác của nhà đầu tư. Các thao tác đặc quyền của ngân hàng
      (phát hành, đóng băng, thu hồi) ký bằng khóa phía máy chủ, không đi qua ví trình duyệt. Kết
      nối ví cũng chưa phải đăng nhập — vai trò hiện tại vẫn lấy từ phiên demo.
    </p>
  );
}
