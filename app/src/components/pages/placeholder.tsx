import { Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Trang chỗ trống cho màn hình chưa làm (FE-20 yêu cầu 8).
 *
 * Mỗi trang PHẢI nói ba thứ, và thứ tự đó là thứ tự người đọc cần:
 * 1. Màn này sẽ làm gì — để người demo biết đang thiếu gì, không đoán là hỏng.
 * 2. Task nào thay thế — để người nhận task sau biết chỗ phải sửa.
 * 3. Khung đã sẵn những gì — để task đó KHÔNG dựng lại đường dẫn, guard, menu.
 *
 * Vì sao là trang thật chứ không phải mục menu mờ (`NavItem.disabled`): mục mờ bấm không ra
 * trang nào, nên không có chỗ nào ghi ba thứ trên. Người dùng chỉ thấy một mục xám và không
 * biết vì sao; người nhận task sau không có gì để đọc.
 */
export function PlaceholderPage({
  title,
  purpose,
  task,
  ready,
  notes,
}: {
  /** Tên màn hình đúng như trong menu. */
  title: string;
  /** Màn này sẽ làm gì, viết cho người demo đọc. */
  purpose: string;
  /** Mã task sẽ thay trang này. */
  task: string;
  /** Khung đã dựng sẵn những gì cho task đó. */
  ready: readonly string[];
  /** Ghi chú thêm, ví dụ các màn rời sẽ được gộp vào đây. */
  notes?: readonly string[];
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          <Badge variant="outline" className="font-mono text-xs">
            chờ {task}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{purpose}</p>
      </header>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-2.5">
          <Construction className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <CardTitle className="text-base">Màn hình chưa dựng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Khung điều hướng và kiểm quyền của trang này đã chạy. Task{' '}
            <span className="font-mono text-foreground">{task}</span> chỉ thay phần thân.
          </p>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Đã sẵn
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {ready.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {notes !== undefined && notes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lưu ý
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
