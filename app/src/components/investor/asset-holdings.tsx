import { Badge } from '@/components/ui/badge';
import type { PortfolioView } from '@/lib/bank/portfolio.service';
import { recallNoticeText } from '@/components/recall/gates';

/**
 * Phần số liệu của hộp "Tài sản đã đầu tư" (FE-UX-04a QĐ-5): dời nguyên văn nhánh `data` từ `asset-summary.tsx`.
 * Chỉ nhận dữ liệu, không gọi action, không có state hay effect.
 */

const nf = (value: string) => {
  try {
    return BigInt(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

export function AssetHoldings({ data }: { data: PortfolioView }) {
  return (
    <div className="space-y-4">
      {data.recall && (() => {
        const notice = recallNoticeText(data.recall);
        return (
          <div role="status" className="rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">{notice.title}</p>
            <p>{notice.body}</p>
          </div>
        );
      })()}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {data.token.symbol} đang giữ
        </div>
        <div className="tabular-nums text-3xl font-bold text-primary">{nf(data.balance)}</div>
      </div>

      <div className="space-y-1 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Giá trị theo giá phát hành</span>
          <span className="tabular-nums text-lg font-semibold text-foreground">
            {nf(data.valueVnd)} ₫
          </span>
        </div>
        {/*
          Ghi rõ đây KHÔNG phải giá thị trường: hệ thống chưa có thị trường thứ cấp nên
          không có giá giao dịch. Trình bày như định giá là sai bản chất.
        */}
        <p className="text-xs text-muted-foreground">
          Quy đổi theo giá phát hành {nf(data.issuePriceVnd)} ₫/
          {data.token.symbol}. Chưa có thị trường thứ cấp nên đây không phải giá giao dịch.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Badge variant={data.whitelisted ? 'default' : 'destructive'}>
          {data.whitelisted ? 'đã KYC' : 'chưa KYC'}
        </Badge>
        {data.frozen && <Badge variant="destructive">đang đóng băng</Badge>}
        <span className="ml-auto font-code text-[11px] text-muted-foreground">
          {data.wallet.slice(0, 10)}…{data.wallet.slice(-4)}
        </span>
      </div>

      {/* FIX-04 F1: số dư VNDB đọc cùng lời gọi; đọc lỗi thì chỉ dòng này báo, hộp vẫn hiện. */}
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Số dư VNDB</span>
        {data.paymentBalance === null ? (
          <span className="text-sm text-muted-foreground">Chưa đọc được số dư VNDB</span>
        ) : (
          <span className="tabular-nums text-lg font-semibold text-foreground">{nf(data.paymentBalance)} VNDB</span>
        )}
      </div>
    </div>
  );
}
