"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChainKey } from "@bidv/shared";
import { cn } from "@/lib/utils";
import { useSelectedChain } from "@/lib/chains/use-selected-chain";
import { setFireblocksCustodyAction } from "@/app/actions/custody";

/**
 * IN-04 A5: dòng "Lưu ký Fireblocks" ở đáy menu của Giao dịch viên và Kiểm soát viên, kèm công tắc
 * dạng viên thuốc. Dữ liệu do `AppLayout` đọc sẵn (một lần đọc database, không phải server action);
 * chỉ bấm công tắc mới gọi action.
 */
export interface CustodyToggleState {
  enabled: boolean;
  configured: boolean;
  /** Đọc công tắc lỗi ở máy chủ: hiện như đang tắt. */
  unreadable: boolean;
  scope: { ok: true; chains: ChainKey[] } | { ok: false };
}

/** Các dòng chữ nhỏ dưới công tắc, theo thứ tự hiển thị (hàm thuần, kiểm được không cần DOM). */
export function custodyNotes(state: CustodyToggleState, chain: ChainKey): string[] {
  const notes: string[] = [];
  if (state.unreadable) notes.push("Chưa đọc được trạng thái");
  if (state.enabled && !state.configured) notes.push("Thiếu cấu hình; lần duyệt sẽ bị chặn");
  if (state.enabled && !state.scope.ok) notes.push("Bảng chain sai; lần duyệt sẽ bị chặn");
  if (state.scope.ok && !state.scope.chains.includes(chain)) notes.push("Không áp dụng cho chain này");
  return notes;
}

export function CustodyToggle({ state }: { state: CustodyToggleState }) {
  const router = useRouter();
  const { chain } = useSelectedChain();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Chưa cấu hình và đang tắt: không bật được. Đang bật thì luôn tắt được, kể cả khi thiếu cấu hình.
  const locked = !state.configured && !state.enabled;
  const disabled = locked || pending;

  const toggle = () =>
    startTransition(async () => {
      setError(null);
      const result = await setFireblocksCustodyAction({ enabled: !state.enabled });
      if (result.ok) router.refresh();
      else setError(result.error);
    });

  const notes = custodyNotes(state, chain);

  return (
    <div className="px-2 pb-2">
      <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-sidebar-foreground/70">
        <span id="custody-toggle-label">Lưu ký Fireblocks</span>
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label="Lưu ký Fireblocks"
          aria-describedby={notes.length > 0 || error ? "custody-toggle-notes" : undefined}
          title={locked ? "Chưa cấu hình Fireblocks" : undefined}
          disabled={disabled}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors",
            state.enabled ? "bg-green-500" : "bg-muted-foreground/40",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform",
              state.enabled ? "translate-x-[20px]" : "translate-x-[2px]",
            )}
          />
        </button>
      </div>
      {(notes.length > 0 || error) && (
        <div id="custody-toggle-notes" className="space-y-0.5 px-3 text-[11px] text-muted-foreground">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
