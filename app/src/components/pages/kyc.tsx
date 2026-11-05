"use client";

import { useState } from "react";
import { RefreshCw, Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fieldClass } from "@/components/ui/field";
import { Kpi } from "@/components/ui/kpi";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoverHint } from "@/components/layout/hover-hint";
import { SampleDataNote } from "@/components/ui/sample-data-note";
import { FilterBtn } from "@/components/ops/filter-button";

/**
 * Nhà đầu tư & KYC.
 *
 * Trang này chưa nối dữ liệu thật (Phase 4: KYC provider + Prisma). Luồng KYC đang
 * chạy được là bản mock ở trang /mint — KYC auto-approve rồi whitelist on-chain.
 *
 * Vòng này chỉ dọn màu: bỏ các class màu xám/trắng cố định (hỏng ở light theme)
 * sang theme token, và làm trạng thái rỗng nói rõ lý do.
 */

type KycLevel = "ALL" | "LEVEL1" | "LEVEL2" | "VIP";
type KycStatus = "ALL" | "ACTIVE" | "PENDING" | "FROZEN";

const LEVEL_LABELS: Record<KycLevel, string> = {
  ALL: "Tất cả",
  LEVEL1: "Level 1",
  LEVEL2: "Level 2",
  VIP: "VIP",
};

/** Bảng sát mép thẻ (`Card` không đệm): ô đầu và cuối cách mép như thanh lọc. */
const TABLE_EDGE = "[&_td:first-child]:pl-4 [&_th:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4";

const STATUS_LABELS: Record<KycStatus, string> = {
  ALL: "Tất cả",
  ACTIVE: "Hoạt động",
  PENDING: "Chờ duyệt",
  FROZEN: "Đóng băng",
};

export function KycPage() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<KycLevel>("ALL");
  const [status, setStatus] = useState<KycStatus>("ALL");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <HoverHint hint="Xem nhà đầu tư, trạng thái định danh và whitelist ví." side="bottom">
            <h1 className="text-2xl font-semibold tracking-tight">Nhà đầu tư &amp; KYC</h1>
          </HoverHint>
          <SampleDataNote />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* QĐ-5: chưa có hành động, khoá kèm chú thích. */}
          <Button
            variant="ghost"
            size="icon"
            title="Làm mới"
            aria-label="Làm mới"
            disabled
            aria-describedby="kyc-poc-note"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <span id="kyc-poc-note" className="text-xs text-muted-foreground">
            Chưa hỗ trợ trong PoC
          </span>
        </div>
      </div>

      <div className="grid gap-4 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
        <Kpi tone="hl" label="Tổng nhà đầu tư" value="0" sub="Đã đăng ký trên hệ thống" />
        <Kpi label="Đã whitelist" value="0" sub="Đủ điều kiện nhận WPT" />
        <Kpi tone="gold" label="Chờ duyệt KYC" value="0" sub="Cần xử lý trong 24h" />
        <Kpi label="Đang đóng băng" value="0" sub="Tạm dừng chuyển nhượng on-chain" />
      </div>

      <Card className="gap-0 py-0">
        <div className="space-y-3 border-b border-border p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="kyc-search" className="sr-only">
              Tìm nhà đầu tư
            </label>
            <input
              id="kyc-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, CCCD hoặc địa chỉ ví..."
              className={`${fieldClass} pl-10`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Cấp KYC:</span>
            {(Object.keys(LEVEL_LABELS) as KycLevel[]).map((item) => (
              <FilterBtn
                key={item}
                active={level === item}
                onClick={() => setLevel(item)}
                label={LEVEL_LABELS[item]}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Trạng thái:</span>
            {(Object.keys(STATUS_LABELS) as KycStatus[]).map((item) => (
              <FilterBtn
                key={item}
                active={status === item}
                onClick={() => setStatus(item)}
                label={STATUS_LABELS[item]}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">0 kết quả</p>
        </div>

        <Table className={TABLE_EDGE}>
          <TableHeader>
            <TableRow>
              <TableHead>Nhà đầu tư</TableHead>
              <TableHead>CCCD</TableHead>
              <TableHead>Cấp KYC</TableHead>
              <TableHead>Khẩu vị RR</TableHead>
              <TableHead>Địa chỉ ví</TableHead>
              <TableHead className="text-right">WPT nắm giữ</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Đăng ký</TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        <div className="p-4">
          <EmptyState icon={<UserCheck />}>
            <p>Chưa có nhà đầu tư nào trong danh sách.</p>
            <p className="mx-auto mt-1 max-w-md text-xs">
              Bảng này đọc từ DB nhà đầu tư, nối ở Phase 4. Hiện tại luồng KYC + whitelist chạy ở
              chế độ mock tại trang <span className="font-code">/mint</span>.
            </p>
          </EmptyState>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>Hiển thị 0–0 / 0 nhà đầu tư</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled>
              Trang trước
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              Trang sau
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
