import { AssetSummary } from '@/components/investor/asset-summary';
import { IssuanceStatusBox } from '@/components/investor/issuance-status-box';
import { TokenListBox } from '@/components/investor/token-list-box';
import { TransactionHistoryBox } from '@/components/investor/transaction-history-box';
import { TokenScopeSelect } from '@/components/token/token-scope-select';

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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tổng quan nhà đầu tư</h1>
        <TokenScopeSelect id="token-scope" className="w-full sm:w-72" />
      </header>

      {/* Lưới 12 cột từ 1100 px, thứ tự DOM giữ: Tài sản (7) cạnh Trạng thái phát hành (5); Giao dịch (7) cạnh Danh sách token (5). */}
      <div className="grid gap-6 min-[1100px]:grid-cols-12">
        <div className="grid min-[1100px]:col-span-7">
          <AssetSummary />
        </div>
        <div className="grid min-[1100px]:col-span-5">
          <IssuanceStatusBox />
        </div>
        <div className="grid min-[1100px]:col-span-7">
          <TransactionHistoryBox />
        </div>
        <div className="grid min-[1100px]:col-span-5">
          <TokenListBox />
        </div>
      </div>
    </div>
  );
}
