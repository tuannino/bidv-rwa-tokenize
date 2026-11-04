import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Ô số liệu (FE-UX-02a). Gốc có `data-kpi`, `data-tone`; nhận và chuyển tiếp mọi thuộc tính còn lại
 * (`data-testid`, `aria-*`). Phần tử `tabular-nums` ĐẦU TIÊN trong ô là giá trị và chỉ chứa giá trị;
 * đơn vị nằm ngoài nó. Sắc `hl`, `au`, `leaf`, `gold` dùng utility `tile-*` (nền gradient, chữ theo nền).
 */
const kpiVariants = cva(
  "lift relative isolate flex min-w-0 flex-col overflow-hidden rounded-[22px] p-5 text-card-foreground",
  {
    variants: {
      tone: {
        default: "bg-card ring-1 ring-border",
        hl: "tile-hl",
        au: "tile-au",
        leaf: "tile-leaf",
        gold: "tile-gold",
      },
      size: {
        md: "",
        lg: "min-h-[300px]",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  }
)

const iconVariants = cva("grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5", {
  variants: {
    tone: {
      default: "bg-muted text-primary",
      hl: "bg-(--tile-hl-chip) text-(--tile-hl-bar)",
      au: "bg-(--tile-au-chip) text-(--tile-au-sub)",
      leaf: "bg-primary text-primary-foreground",
      gold: "bg-accent text-accent-foreground",
    },
  },
  defaultVariants: { tone: "default" },
})

type KpiProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof kpiVariants> & {
    label: React.ReactNode
    value: React.ReactNode
    unit?: React.ReactNode
    sub?: React.ReactNode
    icon?: React.ReactNode
    children?: React.ReactNode
  }

function Kpi({ label, value, unit, sub, icon, tone = "default", size = "md", className, children, ...props }: KpiProps) {
  return (
    <div data-kpi="" data-tone={tone} className={cn(kpiVariants({ tone, size }), className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span aria-hidden="true" className={iconVariants({ tone })}>
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          "font-bold leading-tight tracking-tight [overflow-wrap:anywhere]",
          size === "lg" ? "mt-auto pt-6 text-[40px]" : "mt-3 text-[28px]"
        )}
      >
        <span className="tabular-nums">{value}</span>
        {unit && <small className="ml-1 text-sm font-medium text-muted-foreground">{unit}</small>}
      </p>
      {sub && <div className="mt-1.5 text-[13px] text-muted-foreground">{sub}</div>}
      {children}
    </div>
  )
}

export { Kpi, kpiVariants }
