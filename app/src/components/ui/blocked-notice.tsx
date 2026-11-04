import * as React from "react"
import { ShieldX } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Khối "chức năng không khả dụng" của trang bị chặn theo quyền hoặc cờ (FE-UX-02a). `title` vẫn là
 * `h1` của trang; `children` giữ nguyên câu chữ của trang (test so khớp từng ký tự).
 */
function BlockedNotice({
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & { title: React.ReactNode }) {
  return (
    <div
      data-slot="blocked-notice"
      className={cn("mx-auto max-w-md space-y-3 rounded-[22px] bg-bad-bg p-6 text-center text-bad-ink", className)}
      {...props}
    >
      <ShieldX className="mx-auto size-8" aria-hidden="true" />
      <h1 className="text-lg font-semibold">{title}</h1>
      {children}
    </div>
  )
}

export { BlockedNotice }
