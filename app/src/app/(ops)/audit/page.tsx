import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
            <h1 className="text-xl font-semibold">Sổ kiểm toán</h1>
          </HoverHint>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bản ghi gần nhất</CardTitle>
          </CardHeader>
          <CardContent>
            {!result.ok ? (
              <p className="text-sm text-destructive">{result.error}</p>
            ) : result.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có bản ghi. Thử phát hành token ở trang /mint rồi quay lại.
              </p>
            ) : (
              <AuditTable entries={result.data} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
