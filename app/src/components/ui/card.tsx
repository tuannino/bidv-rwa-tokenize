import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * FE-UX-02a: sắc thẻ. `default` giữ đúng lớp cũ (nền thẻ, viền `ring-border`); `tint` nền nhạt cho
 * khối trong thẻ; `hl`, `au`, `leaf`, `gold` dùng nền ô số liệu (utility `tile-*` trong `globals.css`,
 * tự ghi đè màu chữ của phần tử con).
 */
const cardVariants = cva(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[22px] py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-[22px] *:[img:last-child]:rounded-b-[22px]",
  {
    variants: {
      tone: {
        default: "bg-card ring-1 ring-border",
        tint: "bg-muted/60",
        hl: "relative isolate tile-hl",
        au: "relative isolate tile-au",
        leaf: "relative isolate tile-leaf",
        gold: "relative isolate tile-gold",
      },
    },
    defaultVariants: { tone: "default" },
  }
)

function Card({
  className,
  size = "default",
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" } & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(cardVariants({ tone }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-[22px] px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

/** FE-UX-02a: biểu tượng tròn 32 px đặt cạnh tiêu đề thẻ (truyền biểu tượng lucide làm `children`). */
function CardTitleIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="card-title-icon"
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-muted text-primary [&_svg]:size-4 [&_svg]:stroke-[1.7]",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-[22px] border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardTitleIcon,
  CardAction,
  CardDescription,
  CardContent,
}
