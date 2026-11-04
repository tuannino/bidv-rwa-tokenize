'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function RecallDialog({
  open,
  title,
  description,
  busy,
  submitLabel,
  destructive = false,
  submitDisabled = false,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  submitLabel: string;
  destructive?: boolean;
  submitDisabled?: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return (
    <Dialog open={open} onOpenChange={(next) => (next || busy ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        {/* FE-UX-02b QĐ-5: khung `Alert` KHÔNG có `role`; đoạn lỗi bên trong giữ `ref`, `role="alert"`,
            `tabIndex={-1}` để effect trên đưa tiêu điểm vào đúng câu lỗi. */}
        {error && (
          <Alert tone="bad">
            <p ref={errorRef} role="alert" tabIndex={-1}>{error}</p>
          </Alert>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Đóng</Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy || submitDisabled}
            onClick={onSubmit}
          >
            {busy ? 'Đang xử lý...' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
