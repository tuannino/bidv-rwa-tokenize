import * as React from "react"
import { CheckCircle2, Info, TriangleAlert, XCircle, type LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Khối thông báo có sắc (FE-UX-02a). KHÔNG tự đặt `role`: nơi dùng truyền đúng `role` đang có
 * (`status`, `alert`, `note`) hoặc không truyền; mọi thuộc tính khác (`aria-*`, `data-*`) chuyển tiếp.
 */
const alertVariants = cva("flex items-start gap-3 rounded-[18px] px-4 py-3.5 text-[13px]", {
  variants: {
    tone: {
      ok: "bg-ok-bg text-ok-ink",
      warn: "bg-warn-bg text-warn-ink",
      bad: "bg-bad-bg text-bad-ink",
      info: "bg-info-bg text-info-ink",
    },
  },
  defaultVariants: { tone: "info" },
})

const ICONS: Record<NonNullable<VariantProps<typeof alertVariants>["tone"]>, LucideIcon> = {
  ok: CheckCircle2,
  warn: TriangleAlert,
  bad: XCircle,
  info: Info,
}

function Alert({
  tone = "info",
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants> & { icon?: React.ReactNode }) {
  const Icon = ICONS[tone ?? "info"]
  return (
    <div data-slot="alert" data-tone={tone} className={cn(alertVariants({ tone }), className)} {...props}>
      {icon ?? <Icon className="mt-px size-[18px] shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export { Alert, alertVariants }
