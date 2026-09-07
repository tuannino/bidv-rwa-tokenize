import { AppLayout } from '@/components/layout/app-layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listAuditLog } from '@/lib/bank/audit.service';

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
          <h1 className="text-xl font-semibold">Sổ kiểm toán</h1>
          <p className="text-sm text-muted-foreground">
            Mọi lần kiểm quyền và mọi thao tác đặc quyền. Kênh này không có hàm ghi.
          </p>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời điểm</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-xs">{entry.actorRole}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.target ? `${entry.target.slice(0, 10)}…` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.outcome === 'SUCCESS' || entry.outcome === 'ALLOWED'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {entry.outcome}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[28rem] truncate text-xs text-muted-foreground">
                        {entry.detail ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
