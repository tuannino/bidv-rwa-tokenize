import { Alert } from '@/components/ui/alert';
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
          <Alert tone="warn" role="status">
            <p className="font-semibold">{notice.title}</p>
            <p>{notice.body}</p>
          </Alert>
        );
      })()}
      <div>
        <div className="text-[13px] text-muted-foreground">
          {data.token.symbol} đang giữ
        </div>
        <div className="tabular-nums text-5xl font-semibold tracking-tight">{nf(data.balance)}</div>
      </div>

      {/* Hai ô cạnh nhau từ 640 px: giá trị quy đổi; trạng thái tuân thủ và ví. */}
      <div className="grid gap-3 min-[640px]:grid-cols-2">
        <div className="space-y-1 rounded-[18px] bg-muted p-4">
          <div className="space-y-1">
            <span className="block text-[13px] text-muted-foreground">Giá trị theo giá phát hành</span>
            <span className="block tabular-nums text-2xl font-semibold">
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

        <div className="flex flex-wrap content-start items-center gap-2 rounded-[18px] bg-muted p-4">
          <Badge variant={data.whitelisted ? 'ok' : 'bad'}>
            {data.whitelisted ? 'đã KYC' : 'chưa KYC'}
          </Badge>
          {data.frozen && <Badge variant="bad">đang đóng băng</Badge>}
          <span className="w-full font-code text-[11px] text-muted-foreground">
            {data.wallet.slice(0, 10)}…{data.wallet.slice(-4)}
          </span>
        </div>
      </div>

      {/* FIX-04 F1: số dư VNDB đọc cùng lời gọi; đọc lỗi thì chỉ dòng này báo, hộp vẫn hiện. */}
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Số dư VNDB</span>
        {data.paymentBalance === null ? (
          <span className="text-sm text-muted-foreground">Chưa đọc được số dư VNDB</span>
        ) : (
          <span className="tabular-nums text-lg font-semibold">{nf(data.paymentBalance)} VNDB</span>
        )}
      </div>
    </div>
  );
}
