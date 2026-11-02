import { cn } from '@/lib/utils';

/** FIX-04 QĐ-4: ghi chú chữ chìm cho số liệu chưa có nguồn thật trong hệ thống. */
export function UnverifiedNote({
  className,
  title = 'Chưa có nguồn dữ liệu thật trong hệ thống',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={cn('shrink-0 text-xs font-normal text-muted-foreground', className)}>
      unverified
    </span>
  );
}
