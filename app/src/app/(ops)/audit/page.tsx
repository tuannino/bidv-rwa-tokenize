import { AppLayout } from '@/components/layout/app-layout';
import { ScrollText } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listAuditLog } from '@/lib/bank/audit.service';
import { HoverHint } from '@/components/layout/hover-hint';
import { AuditTable } from '@/components/audit/audit-table';

/**
 * Sổ kiểm toán — chỉ đọc. Server Component: đọc thẳng qua service, không có action nào.
 * Ghi cả lần ALLOWED và DENIED nên thấy được cả những thao tác đã bị RBAC chặn.
 */
export default async function AuditPage() {
  const result = await listAuditLog(100);

  return (
    <AppLayout breadcrumbs={[{ label: 'Kiểm toán' }, { label: 'Sổ kiểm toán' }]}>
      <div className="space-y-6">
        <header className="space-y-1">
          <HoverHint hint="Xem lịch sử mọi thao tác và lần kiểm quyền trong hệ thống." side="bottom">
            <h1 className="text-2xl font-semibold tracking-tight">Sổ kiểm toán</h1>
          </HoverHint>
        </header>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2.5 text-base">
              <CardTitleIcon>
                <ScrollText />
              </CardTitleIcon>
              Bản ghi gần nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!result.ok ? (
              <Alert tone="bad">{result.error}</Alert>
            ) : result.data.length === 0 ? (
              <EmptyState icon={<ScrollText />}>
                Chưa có bản ghi. Thử phát hành token ở trang /mint rồi quay lại.
              </EmptyState>
            ) : (
              <AuditTable entries={result.data} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
