"use client";

import { useState } from "react";
import { RefreshCw, Search, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nhà đầu tư &amp; KYC</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Duyệt KYC, whitelist ví để được nắm giữ WPT, đóng băng/mở băng khi cần.
          </p>
        </div>
        <button
          type="button"
          title="Làm mới"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Tổng nhà đầu tư" value="0" sub="Đã đăng ký trên hệ thống" />
        <KpiCard label="Đã whitelist" value="0" sub="Đủ điều kiện nhận WPT" />
        <KpiCard label="Chờ duyệt KYC" value="0" sub="Cần xử lý trong 24h" warn />
        <KpiCard label="Đang đóng băng" value="0" sub="Tạm dừng chuyển nhượng on-chain" danger />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="space-y-3 border-b border-border p-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_2fr_1.2fr_1fr_1fr] gap-3 border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Nhà đầu tư</span>
          <span>CCCD</span>
          <span>Cấp KYC</span>
          <span>Khẩu vị RR</span>
          <span>Địa chỉ ví</span>
          <span className="text-right">WPT nắm giữ</span>
          <span>Trạng thái</span>
          <span>Đăng ký</span>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
          <UserCheck className="h-9 w-9 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chưa có nhà đầu tư nào trong danh sách.</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Bảng này đọc từ DB nhà đầu tư, nối ở Phase 4. Hiện tại luồng KYC + whitelist chạy ở
            chế độ mock tại trang <span className="font-mono">/mint</span>.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>Hiển thị 0–0 / 0 nhà đầu tư</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded border border-border px-3 py-1 opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded border border-border px-3 py-1 opacity-50"
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  warn,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        danger ? "border-destructive/40" : warn ? "border-accent/50" : "border-border",
      )}
    >
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-2xl font-bold tracking-tight",
          danger ? "text-destructive" : warn ? "text-accent" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1 text-xs transition-colors",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
