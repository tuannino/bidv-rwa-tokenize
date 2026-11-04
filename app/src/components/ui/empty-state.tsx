import * as React from "react"
import { Inbox, Loader2, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Trạng thái rỗng, đang tải (`loading`), lỗi (`tone="bad"`) của danh sách (FE-UX-02a). KHÔNG tự đặt
 * `role`; nơi dùng truyền `role` nếu chỗ đó đang có (ví dụ lỗi danh sách `role="alert"`). Chữ đặt trong
 * `children`, giữ nguyên câu của màn. `data-loading` đánh dấu trạng thái đang tải cho e2e.
 */
function EmptyState({
  icon,
  loading = false,
  tone = "default",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { icon?: React.ReactNode; loading?: boolean; tone?: "default" | "bad" }) {
  return (
    <div
      data-slot="empty-state"
      data-tone={tone}
      data-loading={loading ? "" : undefined}
      className={cn(
        "grid place-items-center gap-2.5 rounded-[18px] px-4 py-8 text-center text-sm",
        tone === "bad" ? "bg-bad-bg text-bad-ink" : "bg-muted text-muted-foreground",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[52px] place-items-center rounded-full bg-card [&_svg]:size-6",
          tone === "bad" ? "text-bad-ink" : "text-primary"
        )}
      >
        {loading ? <Loader2 className="animate-spin" /> : (icon ?? (tone === "bad" ? <XCircle /> : <Inbox />))}
      </span>
      <div>{children}</div>
    </div>
  )
}

export { EmptyState }
