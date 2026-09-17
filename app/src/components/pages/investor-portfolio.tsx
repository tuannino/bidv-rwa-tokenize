import { AssetSummary } from '@/components/investor/asset-summary';
import { IssuanceStatusBox } from '@/components/investor/issuance-status-box';
import { TokenListBox } from '@/components/investor/token-list-box';
import { TransactionHistoryBox } from '@/components/investor/transaction-history-box';

/**
 * Trang TỔNG QUAN NHÀ ĐẦU TƯ — ghép bốn hộp.
 *
 * Mỗi hộp tự gọi server action của mình và tự giữ trạng thái lỗi, nên một hộp lỗi thì ba hộp
 * còn lại vẫn hiển thị. Cố ý KHÔNG gom thành một lời gọi chung: gom lại thì `tokenInfo()` lỗi
 * là mất cả lịch sử giao dịch, dù hai thứ chẳng liên quan gì nhau.
 *
 * Server Component: không có state ở tầng này, chỉ bố cục.
 */
export function InvestorPortfolioPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Tổng quan nhà đầu tư</h1>
        <p className="text-sm text-muted-foreground">
          Vị thế WPT của ví đang kết nối, trạng thái phát hành, và danh sách dự án điện gió đã
          token hoá.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AssetSummary />
        <IssuanceStatusBox />
      </div>

      <TransactionHistoryBox />

      <TokenListBox />
    </div>
  );
}
