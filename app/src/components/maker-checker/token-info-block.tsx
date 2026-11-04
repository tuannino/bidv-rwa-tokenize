import { Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import type { TokenInfoView } from '@/lib/bank/token-request.service';
import { formatAmount, formatDateTime } from '@/lib/format';

/**
 * Khối thông tin token — dùng chung cho thẻ tạo token, thẻ huỷ token và màn chi tiết (FE-22).
 *
 * Chỉ HIỂN THỊ `TokenInfoView` máy chủ đã tính (`getTokenInfo`). Không cộng trừ con số nào ở đây:
 * "số còn được phát hành" hay "đang lưu hành" tự tính lại ở giao diện là có hai nguồn cho cùng
 * một con số, và khối này sẽ nói khác khối kiểm tra ngay khi một trong hai đổi cách tính.
 *
 * FE-UX-02b: ô nền nhạt bo 18 px (`Card tone="tint"`, bản chốt `.inner`); giữ cặp `dt`/`dd` liền kề
 * (test đọc `dd` ngay sau `dt`) và câu lỗi nằm trong khối.
 */
export function TokenInfoBlock({
  info,
  error,
  loading,
}: {
  info: TokenInfoView | null;
  error?: string | null;
  loading?: boolean;
}) {
  return (
    <Card size="sm" tone="tint" className="rounded-[18px]" aria-label="Khối thông tin token">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
          <CardTitleIcon className="bg-card">
            <Wind />
          </CardTitleIcon>
          Thông tin token
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang đọc thông tin token…</p>
        ) : error ? (
          <p className="text-sm text-bad-ink">{error}</p>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">
            Nhập mã hoặc ký hiệu token, hệ thống tự đổ thông tin.
          </p>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item label="Dự án">{info.projectName}</Item>
            <Item label="Hợp đồng" mono>
              {info.contractAddress ?? 'chưa ghi trong bảng dự án'}
            </Item>
            <Item label="Trần phát hành" mono>
              {formatAmount(info.cap)}
            </Item>
            <Item label="Số còn được phát hành" mono>
              {formatAmount(info.remaining)}
            </Item>
            <Item label="Tổng cung hiện tại" mono>
              {formatAmount(info.totalSupply)}
            </Item>
            <Item label="Số chưa phân phối" mono>
              {formatAmount(info.undistributed)}
            </Item>
            <Item label="Số đang lưu hành" mono>
              {formatAmount(info.circulating)}
            </Item>
            <Item label="Mã người bán">{info.sellerCode}</Item>
            <Item label="Ví thanh toán" mono>
              {info.spvWallet ?? 'chưa có (chưa phát hành lần nào)'}
            </Item>
            <Item label="Phát hành lần đầu">{formatDateTime(info.issuedAt)}</Item>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Item({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-1">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? 'truncate text-right font-code' : 'truncate text-right'} title={typeof children === 'string' ? children : undefined}>
        {children}
      </dd>
    </div>
  );
}
